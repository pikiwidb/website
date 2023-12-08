---
title: Pika 新存储结构
author: --
date: '2023-12-02'
---
<table class="d-block" role="presentation" data-paste-markdown-skip=""><tbody class="d-block js-translation-source" data-target-translation-id="5679674" data-target-translation-type="discussion"><tr class="d-block"><td class="d-block color-fg-default comment-body markdown-body js-comment-body"><p dir="auto">Pika 有给存储结构取名代号的传统，譬如第一代取名 Nemo，第二代取名 Blackwidow， 当前版本我们决定取名 Floyd，没有什么特殊意义，一个代号而已。</p><p dir="auto">目前 Pika 的数据层级架构是：DB -&gt; Slot -&gt; Blackwidow。下面文档中提到的 分片，就是 Slot。</p><p dir="auto">当前，一个 DB 下只有一个 Slot，一个 Slot 下使用一个 Blackwidow。Blackwidow 支持的数据类型 String/List/Set/Zset/Hashtable，每种数据类型使用一个 RocksDB 实例，所以一个 Slot 下共有五个 Blackwidow。</p><h2 dir="auto">考虑点</h2><table role="table"><thead><tr><th align="left">Item</th><th align="left">Proirity</th><th align="left">Description</th></tr></thead><tbody><tr><td align="left">使用 protobuf V3 协议取代二进制</td><td align="left">P0</td><td align="left">基于以后扩展性考量，兼具性能</td></tr><tr><td align="left">每个类型用一个 column family，统一放在一个 RocksDB 中</td><td align="left">P0</td><td align="left">Blackwidow 中每个数据类型使用一个 RocksDB，造成了不同数据类型可以取名相同的问题</td></tr><tr><td align="left">多 RocksDB 实例</td><td align="left">P0</td><td align="left">上面一个 RocksDB 中可以通过 column family 实现不同数据类型的逻辑隔离，但是为了性能考虑，还会继续保持多 RocksDB 实例，目前考量是每个 slot 一个 RocksDB 实例。方便数据以 slot 粒度进行迁移。</td></tr><tr><td align="left">复杂数据结构重构 hash zset</td><td align="left">P0</td><td align="left">如 Blackwidow 中的 hashtable 的读写性能不够好，特别是 hmset 和 hmget</td></tr><tr><td align="left">出现慢查询的 key 执行 compact Range</td><td align="left">P1</td><td align="left">该技术点出自 <a class="issue-link js-issue-link" data-error-text="Failed to load title" data-id="1912804314" data-permission-text="Title is private" data-url="https://github.com/OpenAtomFoundation/pika/issues/2040" data-hovercard-type="issue" data-hovercard-url="/OpenAtomFoundation/pika/issues/2040/hovercard" href="https://github.com/OpenAtomFoundation/pika/issues/2040">#2040</a></td></tr><tr><td align="left">删除过时 sst 文件</td><td align="left">P1</td><td align="left">该技术点出自 <a class="issue-link js-issue-link" data-error-text="Failed to load title" data-id="1916849497" data-permission-text="Title is private" data-url="https://github.com/OpenAtomFoundation/pika/issues/2053" data-hovercard-type="issue" data-hovercard-url="/OpenAtomFoundation/pika/issues/2053/hovercard" href="https://github.com/OpenAtomFoundation/pika/issues/2053">#2053</a></td></tr></tbody></table><h2 dir="auto">2. 整体架构</h2><p dir="auto">新的存储架构中，Pika 实例存储引擎包括内存缓存和硬盘持久存储 RocksDB。每个 Pika 实例由一个内存缓存和多个 RocksDB 实例构成，每个数据分片对应一个 RocksDB 实例。同一个Pika实例的多个 RocksDB 实例共享同一个 compaction 和 flush 线程池。</p><p dir="auto">每个数据分片对应一个 RocksDB 实例的好处是：</p><ol dir="auto"><li>Pika serverless 架构中，计算节点扩缩容时，S3 上的存量数据不需要修改，新的计算节点从 S3 上拉取对应分片的元数据和 sst 文件即可。</li><li>非 serverless 架构中，slot 迁移可以用类似主从复制的方式直接迁移 sst 文件，加快数据迁移速度。</li><li>分片迁移完成之后，由于整个分片的数据存储在同一个 RocksDB 实例中，因此可以将整个 RocksDB 的数据直接删掉。不需要额外通过 RocksDB 的 compaction 来清理无效数据。</li><li>key 长度减少，不再需要分片前缀。</li></ol><h2 dir="auto">3. 数据格式</h2><p dir="auto">为了方便后续的数据格式兼容问题，4.0 的数据存储时考虑使用 protobuf 序列化之后再存如 RocksDB 。但序列化之后存入 RocksDB ，需要考虑序列化/反序列化导致的 CPU 性能开销。待测试验证。</p><p dir="auto">目前 blackwidow 中不同的数据类型存储在不同的 RocksDB 实例中，业务的实际使用场景中，可能会更集中在某一个数据类型中，因此相当于是单个 RocksDB 实例在承担Pika节点上所有的流量。因此考虑不再按照数据类型区分 RocksDB 实例。为了防止数据冲突，目前想到有两种解决方法：</p><ol dir="auto"><li>不同的数据类型放在同一个 RocksDB 实例的不同column family中。</li><li>数据类型通过增加前缀进行区分，如：'kv'：表示string类型。'li'：表示list类型，'se':表示set类型等等。</li></ol><p dir="auto">为了兼容 Redis 协议，即为同一个数据类型的数据设置统一的过期时间值，复合数据类型中的meta信息还是需要保留，否则 ttl/expire 接口操作性能耗时增加。增加meta信息导导致的数据写入过程中产生的查询开销，计划通过增加内存 cache 的方式进行缓解，即读 meta 时也是优先读内存缓存 cache，读不到再查硬盘。</p><h2 dir="auto">4. 性能优化</h2><h2 dir="auto">4.1 dealslowkey</h2><p dir="auto">参考新浪微博的经验，当Pika上层代码发现一个慢查询key时，发起一次manual compaction，compaction的范围即对应的key前缀对应的数据范围。性能待验证。</p><h2 dir="auto">4.2 新技术探索</h2><p dir="auto">主要是包括了 RocksDB 的异步IO，协程，remote compaction等新技术的测试和落地</p></td></tr></tbody></table>

Beta Was this translation helpful? [Give feedback.](https://github.com/OpenAtomFoundation/pika/discussions/2052#)

1 You must be logged in to vote

All reactions

## Replies: 3 comments · 7 replies

- [Oldest](https://github.com/OpenAtomFoundation/pika/discussions/2052?sort=old)
- [Newest](https://github.com/OpenAtomFoundation/pika/discussions/2052?sort=new)
- [Top](https://github.com/OpenAtomFoundation/pika/discussions/2052?sort=top)

Comment options

Quote reply

edited

### 

[![](https://avatars.githubusercontent.com/u/7959374?s=64&v=4)

AlexStocks

](https://github.com/AlexStocks)[Sep 28, 2023](https://github.com/OpenAtomFoundation/pika/discussions/2052#discussioncomment-7133481)

Maintainer Author

\-

<table class="d-block" role="presentation" data-paste-markdown-skip=""><tbody class="d-block js-translation-source" data-target-translation-id="7133481" data-target-translation-type="comment"><tr class="d-block"><td class="d-block color-fg-default comment-body markdown-body js-comment-body"><p dir="auto">Floyd 一定要保证 zscore 中字段的顺序。</p></td></tr></tbody></table>

Beta Was this translation helpful? [Give feedback.](https://github.com/OpenAtomFoundation/pika/discussions/2052#)

1 You must be logged in to vote

All reactions

2 replies

[![@AlexStocks](https://avatars.githubusercontent.com/u/7959374?s=60&v=4)](https://github.com/AlexStocks)

Comment options

Quote reply

edited

#### 

[AlexStocks](https://github.com/AlexStocks) [Oct 9, 2023](https://github.com/OpenAtomFoundation/pika/discussions/2052#discussioncomment-7226585)

Maintainer Author

\-

<table class="d-block" role="presentation" data-paste-markdown-skip=""><tbody class="d-block js-translation-source" data-target-translation-id="7226585" data-target-translation-type="comment"><tr class="d-block"><td class="d-block color-fg-default comment-body markdown-body js-comment-body px-3 pt-0 pb-2"><p dir="auto">Answer1：<br>【关于zset 兼容性】<br>protobuf 对 varint 采用 tag value。对 string 采用的是 tag length value 编码，有一个明确的长度参数，前缀相同，但是长度不一样，就没法字典序了，所以 floyd 对 zset 有一些严重依赖字典序。</p><p dir="auto"><a target="_blank" rel="noopener noreferrer" href="https://private-user-images.githubusercontent.com/7959374/273497305-f8543e67-03a3-4260-8d1f-e9b8104b15a3.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTEiLCJleHAiOjE3MDE0Mzc0OTcsIm5iZiI6MTcwMTQzNzE5NywicGF0aCI6Ii83OTU5Mzc0LzI3MzQ5NzMwNS1mODU0M2U2Ny0wM2EzLTQyNjAtOGQxZi1lOWI4MTA0YjE1YTMucG5nP1gtQW16LUFsZ29yaXRobT1BV1M0LUhNQUMtU0hBMjU2JlgtQW16LUNyZWRlbnRpYWw9QUtJQUlXTkpZQVg0Q1NWRUg1M0ElMkYyMDIzMTIwMSUyRnVzLWVhc3QtMSUyRnMzJTJGYXdzNF9yZXF1ZXN0JlgtQW16LURhdGU9MjAyMzEyMDFUMTMyNjM3WiZYLUFtei1FeHBpcmVzPTMwMCZYLUFtei1TaWduYXR1cmU9MGFhNWRmNDE3OTEyZWU5M2U5MTExZjA2YWQwYWJjNGY0NTUzZTU0Mjk4MDJhZGJjNTY4OTEzMDdhY2I3ZTAzZCZYLUFtei1TaWduZWRIZWFkZXJzPWhvc3QmYWN0b3JfaWQ9MCZrZXlfaWQ9MCZyZXBvX2lkPTAifQ.ibCIFPmnZ5QmPnlY9vTbxkaEQ2PKlBATcdAVIs-pkqo"><img src="https://private-user-images.githubusercontent.com/7959374/273497305-f8543e67-03a3-4260-8d1f-e9b8104b15a3.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTEiLCJleHAiOjE3MDE0Mzc0OTcsIm5iZiI6MTcwMTQzNzE5NywicGF0aCI6Ii83OTU5Mzc0LzI3MzQ5NzMwNS1mODU0M2U2Ny0wM2EzLTQyNjAtOGQxZi1lOWI4MTA0YjE1YTMucG5nP1gtQW16LUFsZ29yaXRobT1BV1M0LUhNQUMtU0hBMjU2JlgtQW16LUNyZWRlbnRpYWw9QUtJQUlXTkpZQVg0Q1NWRUg1M0ElMkYyMDIzMTIwMSUyRnVzLWVhc3QtMSUyRnMzJTJGYXdzNF9yZXF1ZXN0JlgtQW16LURhdGU9MjAyMzEyMDFUMTMyNjM3WiZYLUFtei1FeHBpcmVzPTMwMCZYLUFtei1TaWduYXR1cmU9MGFhNWRmNDE3OTEyZWU5M2U5MTExZjA2YWQwYWJjNGY0NTUzZTU0Mjk4MDJhZGJjNTY4OTEzMDdhY2I3ZTAzZCZYLUFtei1TaWduZWRIZWFkZXJzPWhvc3QmYWN0b3JfaWQ9MCZrZXlfaWQ9MCZyZXBvX2lkPTAifQ.ibCIFPmnZ5QmPnlY9vTbxkaEQ2PKlBATcdAVIs-pkqo" alt="image" style="max-width: 100%;"></a></p><p dir="auto"><a target="_blank" rel="noopener noreferrer" href="https://private-user-images.githubusercontent.com/7959374/273497315-3e45d0ee-b0df-48fe-a757-a05a5867f4f9.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTEiLCJleHAiOjE3MDE0Mzc0OTcsIm5iZiI6MTcwMTQzNzE5NywicGF0aCI6Ii83OTU5Mzc0LzI3MzQ5NzMxNS0zZTQ1ZDBlZS1iMGRmLTQ4ZmUtYTc1Ny1hMDVhNTg2N2Y0ZjkucG5nP1gtQW16LUFsZ29yaXRobT1BV1M0LUhNQUMtU0hBMjU2JlgtQW16LUNyZWRlbnRpYWw9QUtJQUlXTkpZQVg0Q1NWRUg1M0ElMkYyMDIzMTIwMSUyRnVzLWVhc3QtMSUyRnMzJTJGYXdzNF9yZXF1ZXN0JlgtQW16LURhdGU9MjAyMzEyMDFUMTMyNjM3WiZYLUFtei1FeHBpcmVzPTMwMCZYLUFtei1TaWduYXR1cmU9NGEwMzU1ZDFmMDNiYjQ1NTJlZGU0OGYzNDUxMzc3NjQ5YTc1YzY1NDg5MjFkNDJjZTNmZTAyZTIyZTVjZDM1OCZYLUFtei1TaWduZWRIZWFkZXJzPWhvc3QmYWN0b3JfaWQ9MCZrZXlfaWQ9MCZyZXBvX2lkPTAifQ.NRzTx56_6mO_5ASDIck1n1WIcIqAeoKHDGpJamu572E"><img src="https://private-user-images.githubusercontent.com/7959374/273497315-3e45d0ee-b0df-48fe-a757-a05a5867f4f9.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTEiLCJleHAiOjE3MDE0Mzc0OTcsIm5iZiI6MTcwMTQzNzE5NywicGF0aCI6Ii83OTU5Mzc0LzI3MzQ5NzMxNS0zZTQ1ZDBlZS1iMGRmLTQ4ZmUtYTc1Ny1hMDVhNTg2N2Y0ZjkucG5nP1gtQW16LUFsZ29yaXRobT1BV1M0LUhNQUMtU0hBMjU2JlgtQW16LUNyZWRlbnRpYWw9QUtJQUlXTkpZQVg0Q1NWRUg1M0ElMkYyMDIzMTIwMSUyRnVzLWVhc3QtMSUyRnMzJTJGYXdzNF9yZXF1ZXN0JlgtQW16LURhdGU9MjAyMzEyMDFUMTMyNjM3WiZYLUFtei1FeHBpcmVzPTMwMCZYLUFtei1TaWduYXR1cmU9NGEwMzU1ZDFmMDNiYjQ1NTJlZGU0OGYzNDUxMzc3NjQ5YTc1YzY1NDg5MjFkNDJjZTNmZTAyZTIyZTVjZDM1OCZYLUFtei1TaWduZWRIZWFkZXJzPWhvc3QmYWN0b3JfaWQ9MCZrZXlfaWQ9MCZyZXBvX2lkPTAifQ.NRzTx56_6mO_5ASDIck1n1WIcIqAeoKHDGpJamu572E" alt="image" style="max-width: 100%;"></a></p><p dir="auto">即使用 pb 描述 zset 的 score --&gt; data ，因为 comparator 是我们自己定制的，这好像也没啥问题。</p><p dir="auto">【关于性能】<br>pb 描述可扩展性没问题，但是读次数累计后，确实会有解析耗费 CPU 的问题。酱紫，明天我再跟你商量下，我们自己定制下一种二进制形式的 tlv 吧，给每个字段分配一个 id【可能我觉得一个字节就够了，使用 7 个 bit，就算不够，将来可以按照 varint 解释】。blackwidow 解析数据时也要耗费cpu，先看看 pb 确实有不能解决的问题没有再说。</p><p dir="auto">我想其实如果 redis 缓存能把大部分数据兜住的话，pb数据解析耗费cpu这件事就不算什么大事了。因为，第一，只有穿透到磁盘读才会发生解析；第二，pb 把整型数据压缩后还会加速读，譬如没有了 key size，整型 varint 压缩，这个数据量也是很可观的。</p><p dir="auto">我想其实如果 redis 缓存能把大部分数据兜住的话，pb数据解析耗费cpu这件事就不算什么大事了。因为，第一，只有穿透到磁盘读才会发生解析；第二，pb 把整型数据压缩后还会加速读，譬如没有了 key size，整型 varint 压缩，这个数据量也是很可观的。</p><p dir="auto">【关于 RocksDB SST】<br>pb 对 string 的组织是 tag + length + string value，length 在前面会导致字典顺序乱序，破坏 RocksDB SST 文件 data block 对具有共同前缀的 string 的压缩性。</p></td></tr></tbody></table>

Beta Was this translation helpful? [Give feedback.](https://github.com/OpenAtomFoundation/pika/discussions/2052#)

All reactions

[![@AlexStocks](https://avatars.githubusercontent.com/u/7959374?s=60&v=4)](https://github.com/AlexStocks)

Comment options

Quote reply

#### 

[AlexStocks](https://github.com/AlexStocks) [Oct 9, 2023](https://github.com/OpenAtomFoundation/pika/discussions/2052#discussioncomment-7226615)

Maintainer Author

\-

<table class="d-block" role="presentation" data-paste-markdown-skip=""><tbody class="d-block js-translation-source" data-target-translation-id="7226615" data-target-translation-type="comment"><tr class="d-block"><td class="d-block color-fg-default comment-body markdown-body js-comment-body px-3 pt-0 pb-2"><p dir="auto">举个例子，abc 和 abcd，如果是原始 二进制编码，RocksDB SST 就会对 abcd 压缩</p><p dir="auto">如果改成 二进制，abc 经过 pb 描述大概是 3abc，abcd pb 描述则是 4abcd，因为长度在前面</p><p dir="auto">3abc 和 4abcd 这就没有共同前缀了，没法压缩。</p></td></tr></tbody></table>

Beta Was this translation helpful? [Give feedback.](https://github.com/OpenAtomFoundation/pika/discussions/2052#)

All reactions

Comment options

Quote reply

### 

[![](https://avatars.githubusercontent.com/u/7959374?s=64&v=4)

AlexStocks

](https://github.com/AlexStocks)[Sep 28, 2023](https://github.com/OpenAtomFoundation/pika/discussions/2052#discussioncomment-7133652)

Maintainer Author

\-

<table class="d-block" role="presentation" data-paste-markdown-skip=""><tbody class="d-block js-translation-source" data-target-translation-id="7133652" data-target-translation-type="comment"><tr class="d-block"><td class="d-block color-fg-default comment-body markdown-body js-comment-body"><p dir="auto">张智清：数据类型通过增加前缀进行区分，如：'kv'：表示 string 类型。'li'：表示 list 类型，'se': 表示 set 类型等等，可能导致多种类型共用同一个 key 名称，这个在 Blackwidow 的问题在 Floyd 中依旧存在</p></td></tr></tbody></table>

Beta Was this translation helpful? [Give feedback.](https://github.com/OpenAtomFoundation/pika/discussions/2052#)

1 You must be logged in to vote

All reactions

3 replies

[![@AlexStocks](https://avatars.githubusercontent.com/u/7959374?s=60&v=4)](https://github.com/AlexStocks)

Comment options

Quote reply

#### 

[AlexStocks](https://github.com/AlexStocks) [Sep 28, 2023](https://github.com/OpenAtomFoundation/pika/discussions/2052#discussioncomment-7133678)

Maintainer Author

\-

<table class="d-block" role="presentation" data-paste-markdown-skip=""><tbody class="d-block js-translation-source" data-target-translation-id="7133678" data-target-translation-type="comment"><tr class="d-block"><td class="d-block color-fg-default comment-body markdown-body js-comment-body px-3 pt-0 pb-2"><p dir="auto">谦祥、一哥等表示该问题并不是很严重</p></td></tr></tbody></table>

Beta Was this translation helpful? [Give feedback.](https://github.com/OpenAtomFoundation/pika/discussions/2052#)

All reactions

[![@AlexStocks](https://avatars.githubusercontent.com/u/7959374?s=60&v=4)](https://github.com/AlexStocks)

Comment options

Quote reply

#### 

[AlexStocks](https://github.com/AlexStocks) [Sep 28, 2023](https://github.com/OpenAtomFoundation/pika/discussions/2052#discussioncomment-7133700)

Maintainer Author

\-

<table class="d-block" role="presentation" data-paste-markdown-skip=""><tbody class="d-block js-translation-source" data-target-translation-id="7133700" data-target-translation-type="comment"><tr class="d-block"><td class="d-block color-fg-default comment-body markdown-body js-comment-body px-3 pt-0 pb-2"><p dir="auto">智清：info expire 等命令针对同一个 key，那到底是那种类型起作用？</p></td></tr></tbody></table>

Beta Was this translation helpful? [Give feedback.](https://github.com/OpenAtomFoundation/pika/discussions/2052#)

All reactions

[![@AlexStocks](https://avatars.githubusercontent.com/u/7959374?s=60&v=4)](https://github.com/AlexStocks)

Comment options

Quote reply

#### 

[AlexStocks](https://github.com/AlexStocks) [Sep 28, 2023](https://github.com/OpenAtomFoundation/pika/discussions/2052#discussioncomment-7133707)

Maintainer Author

\-

<table class="d-block" role="presentation" data-paste-markdown-skip=""><tbody class="d-block js-translation-source" data-target-translation-id="7133707" data-target-translation-type="comment"><tr class="d-block"><td class="d-block color-fg-default comment-body markdown-body js-comment-body px-3 pt-0 pb-2"><p dir="auto">一哥：在 storage.cc 中，expire 对同名称 key 所有类型都起作用</p></td></tr></tbody></table>

Beta Was this translation helpful? [Give feedback.](https://github.com/OpenAtomFoundation/pika/discussions/2052#)

All reactions

Comment options

Quote reply

### 

[![](https://avatars.githubusercontent.com/u/7959374?s=64&v=4)

AlexStocks

](https://github.com/AlexStocks)[Sep 28, 2023](https://github.com/OpenAtomFoundation/pika/discussions/2052#discussioncomment-7133892)

Maintainer Author

\-

<table class="d-block" role="presentation" data-paste-markdown-skip=""><tbody class="d-block js-translation-source" data-target-translation-id="7133892" data-target-translation-type="comment"><tr class="d-block"><td class="d-block color-fg-default comment-body markdown-body js-comment-body"><p dir="auto">一哥：兼容 Redis 协议，只能在整个数据类型上设置过期时间，所以还是需要保留 meta value。RedRocks 把复合数据类型聚合成一个 value，可能导致热点 key。</p></td></tr></tbody></table>

Beta Was this translation helpful? [Give feedback.](https://github.com/OpenAtomFoundation/pika/discussions/2052#)

1 You must be logged in to vote

All reactions

2 replies

[![@AlexStocks](https://avatars.githubusercontent.com/u/7959374?s=60&v=4)](https://github.com/AlexStocks)

Comment options

Quote reply

edited

#### 

[AlexStocks](https://github.com/AlexStocks) [Sep 28, 2023](https://github.com/OpenAtomFoundation/pika/discussions/2052#discussioncomment-7133903)

Maintainer Author

\-

<table class="d-block" role="presentation" data-paste-markdown-skip=""><tbody class="d-block js-translation-source" data-target-translation-id="7133903" data-target-translation-type="comment"><tr class="d-block"><td class="d-block color-fg-default comment-body markdown-body js-comment-body px-3 pt-0 pb-2"><p dir="auto">智清：能否通过 key value 分离，譬如 hashtable 的二级 key(field) 很少，可以一下子节省很多内存。当前的实现，对 hashtable field 超时设置很不友好【需要 hashtable key + field 共同拼写出一个 key 设置一个 ttl】。改进后方便 hgetall、hmget 等原语。</p></td></tr></tbody></table>

Beta Was this translation helpful? [Give feedback.](https://github.com/OpenAtomFoundation/pika/discussions/2052#)

All reactions

[![@AlexStocks](https://avatars.githubusercontent.com/u/7959374?s=60&v=4)](https://github.com/AlexStocks)

Comment options

Quote reply

#### 

[AlexStocks](https://github.com/AlexStocks) [Oct 9, 2023](https://github.com/OpenAtomFoundation/pika/discussions/2052#discussioncomment-7226604)

Maintainer Author

\-

<table class="d-block" role="presentation" data-paste-markdown-skip=""><tbody class="d-block js-translation-source" data-target-translation-id="7226604" data-target-translation-type="comment"><tr class="d-block"><td class="d-block color-fg-default comment-body markdown-body js-comment-body px-3 pt-0 pb-2"><p dir="auto">改进：Floyd 对 string 使用一个 cf；list 占用 list-meta cf 和 list-data 两个 cf；hashtable 占用 hashtable-meta cf 和 hashtable-data 两个 cf；set 占用 set-meta cf 和 set-data 两个 cf；zset 占用 zset-meta cf 和 zset-data 与 score-data 三个 cf。</p><p dir="auto">即一个 slot 使用一个 Floyd，共占用 10 个 cf。</p></td></tr></tbody></table>