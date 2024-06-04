---
title: Pika 新存储结构
# author: --
# date: '2023-12-02'
---

Pika 有给存储结构取名代号的传统，譬如第一代取名 Nemo，第二代取名 Blackwidow， 当前版本我们决定取名 Floyd，没有什么特殊意义，一个代号而已。

目前 Pika 的数据层级架构是：DB -> Slot -> Blackwidow。下面文档中提到的 分片，就是 Slot。

当前，一个 DB 下只有一个 Slot，一个 Slot 下使用一个 Blackwidow。Blackwidow 支持的数据类型 String/List/Set/Zset/Hashtable，每种数据类型使用一个 RocksDB 实例，所以一个 Slot 下共有五个 Blackwidow。

## 考虑点

| Item | Proirity | Description |
| :-- | :-- | :-- |
| 使用 protobuf V3 协议取代二进制 | P0 | 基于以后扩展性考量，兼具性能 |
| 每个类型用一个 column family，统一放在一个 RocksDB 中 | P0 | Blackwidow 中每个数据类型使用一个 RocksDB，造成了不同数据类型可以取名相同的问题 |
| 多 RocksDB 实例 | P0 | 上面一个 RocksDB 中可以通过 column family 实现不同数据类型的逻辑隔离，但是为了性能考虑，还会继续保持多 RocksDB 实例，目前考量是每个 slot 一个 RocksDB 实例。方便数据以 slot 粒度进行迁移。 |
| 复杂数据结构重构 hash zset | P0 | 如 Blackwidow 中的 hashtable 的读写性能不够好，特别是 hmset 和 hmget |
| 出现慢查询的 key 执行 compact Range | P1 | 该技术点出自 [#2040](https://github.com/OpenAtomFoundation/pika/issues/2040) |
| 删除过时 sst 文件 | P1 | 该技术点出自 [#2053](https://github.com/OpenAtomFoundation/pika/issues/2053) |

## 整体架构
--------

新的存储架构中，Pika 实例存储引擎包括内存缓存和硬盘持久存储 RocksDB。每个 Pika 实例由一个内存缓存和多个 RocksDB 实例构成，每个数据分片对应一个 RocksDB 实例。同一个Pika实例的多个 RocksDB 实例共享同一个 compaction 和 flush 线程池。

每个数据分片对应一个 RocksDB 实例的好处是：

1.  Pika serverless 架构中，计算节点扩缩容时，S3 上的存量数据不需要修改，新的计算节点从 S3 上拉取对应分片的元数据和 sst 文件即可。
2.  非 serverless 架构中，slot 迁移可以用类似主从复制的方式直接迁移 sst 文件，加快数据迁移速度。
3.  分片迁移完成之后，由于整个分片的数据存储在同一个 RocksDB 实例中，因此可以将整个 RocksDB 的数据直接删掉。不需要额外通过 RocksDB 的 compaction 来清理无效数据。
4.  key 长度减少，不再需要分片前缀。

## 数据格式

为了方便后续的数据格式兼容问题，4.0 的数据存储时考虑使用 protobuf 序列化之后再存如 RocksDB 。但序列化之后存入 RocksDB ，需要考虑序列化/反序列化导致的 CPU 性能开销。待测试验证。

目前 blackwidow 中不同的数据类型存储在不同的 RocksDB 实例中，业务的实际使用场景中，可能会更集中在某一个数据类型中，因此相当于是单个 RocksDB 实例在承担Pika节点上所有的流量。因此考虑不再按照数据类型区分 RocksDB 实例。为了防止数据冲突，目前想到有两种解决方法：

1.  不同的数据类型放在同一个 RocksDB 实例的不同column family中。
2.  数据类型通过增加前缀进行区分，如：'kv'：表示string类型。'li'：表示list类型，'se':表示set类型等等。

为了兼容 Redis 协议，即为同一个数据类型的数据设置统一的过期时间值，复合数据类型中的meta信息还是需要保留，否则 ttl/expire 接口操作性能耗时增加。增加meta信息导导致的数据写入过程中产生的查询开销，计划通过增加内存 cache 的方式进行缓解，即读 meta 时也是优先读内存缓存 cache，读不到再查硬盘。

## 性能优化

### dealslowkey

参考新浪微博的经验，当Pika上层代码发现一个慢查询key时，发起一次manual compaction，compaction的范围即对应的key前缀对应的数据范围。性能待验证。

### 新技术探索

主要是包括了 RocksDB 的异步IO，协程，remote compaction等新技术的测试和落地
