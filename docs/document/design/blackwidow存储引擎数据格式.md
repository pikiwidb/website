---
title: blackwidow存储引擎数据格式
# author: --
# date: '2023-12-02'
---

Blackwidow 本质上是基于 rocksdb 的封装，使本身只支持 kv 存储的 rocksdb 能够支持多种数据结构, 目前 Blackwidow 支持五种数据结构的存储：String 结构(实际上就是存储 key, value), Hash 结构，List 结构，Set 结构和 ZSet 结构， 因为 Rocksdb 的存储方式只有 kv 一种， 所以上述五种数据结构最终都要落盘到 Rocksdb 的 kv 存储方式上，下面我们展示 Blackwidow 和 rocksdb 的关系并且说明我们是如何用 kv 来模拟多数据结构的。 ![](https://camo.githubusercontent.com/331c73e57e3c93ce0eb4661c0fbca74e1881b79af43e0237807c650c760a4fab/68747470733a2f2f692e696d6775722e636f6d2f6e71656c6975762e706e67)

## 1. String 结构的存储

String 本质上就是 Key, Value, 我们知道 Rocksdb 本身就是支持 kv 存储的， 我们为了实现 Redis 中的 expire 功能，所以在 value 后面添加了 4 Bytes 用于存储 timestamp, 作为最后 Rocksdb 落盘的 kv 格式，下面是具体的实现方式:

![](https://camo.githubusercontent.com/24ea0bc73f9b3ca36e92e18415dae3f8d0da2be3f8760b745e8cd33f1b28e216/68747470733a2f2f692e696d6775722e636f6d2f4b6e41373037612e706e67)

如果我们没有对该 String 对象设置超时时间，则 timestamp 存储的值就是默认值 0， 否则就是该对象过期时间的时间戳， 每次我们获取一个 String 对象的时候， 首先会解析 Value 部分的后四字节， 获取到 timestamp 做出判断之后再返回结果。

## 2. Hash 结构的存储

blackwidow 中的 hash 表由两部分构成，元数据(meta_key, meta_value), 和普通数据(data_key, data_value), 元数据中存储的主要是 hash 表的一些信息， 比如说当前 hash 表的域的数量以及当前 hash 表的版本号和过期时间(用做秒删功能), 而普通数据主要就是指的同一个 hash 表中一一对应的 field 和 value，作为具体最后 Rocksdb 落盘的 kv 格式，下面是具体的实现方式:

1.  每个 hash 表的 meta_key 和 meta_value 的落盘方式: ![](https://camo.githubusercontent.com/b77cc4f678067be6a8b1198baa566b10cc2c938a4635f4ec6234d9d38d5c2e65/68747470733a2f2f692e696d6775722e636f6d2f594c50343872672e706e67)

meta_key 实际上就是 hash 表的 key, 而 meta_value 由三个部分构成: 4Bytes 的 Hash size(用于存储当前 hash 表的大小) + 4Bytes 的 Version(用于秒删功能) + 4Bytes 的 Timestamp(用于记录我们给这个 Hash 表设置的超时时间的时间戳， 默认为 0)

2.  hash 表中 data_key 和 data_value 的落盘方式: ![](https://camo.githubusercontent.com/cafbc8c87956df45017a94963c3a0f539ca9c0a14f8eacfbeb2cc007740ed2f4/68747470733a2f2f692e696d6775722e636f6d2f706869427371642e706e67)

data_key 由四个部分构成: 4Bytes 的 Key size(用于记录后面追加的 key 的长度，便与解析) + key 的内容 + 4Bytes 的 Version + Field 的内容， 而 data_value 就是 hash 表某个 field 对应的 value。

3.  如果我们需要查找一个 hash 表中的某一个 field 对应的 value, 我们首先会获取到 meta_value 解析出其中的 timestamp 判断这个 hash 表是否过期， 如果没有过期， 我们可以拿到其中的 version, 然后我们使用 key, version，和 field 拼出 data_key, 进而找到对应的 data_value（如果存在的话)

## 3. List 结构的存储

blackwidow 中的 list 由两部分构成，元数据(meta_key, meta_value), 和普通数据(data_key, data_value), 元数据中存储的主要是 list 链表的一些信息， 比如说当前 list 链表结点的的数量以及当前 list 链表的版本号和过期时间(用做秒删功能), 还有当前 list 链表的左右边界(由于 nemo 实现的链表结构被吐槽 lrange 效率低下，所以这次 blackwidow 我们底层用数组来模拟链表，这样 lrange 速度会大大提升，因为结点存储都是有序的), 普通数据实际上就是指的 list 中每一个结点中的数据，作为具体最后 Rocksdb 落盘的 kv 格式，下面是具体的实现方式

1.  每个 list 链表的 meta_key 和 meta_value 的落盘方式: ![](https://camo.githubusercontent.com/6ab6eedc64e22d524e216867772a3a3f0a7f1909d7b3b939bb6b46d150df42a3/68747470733a2f2f692e696d6775722e636f6d2f303833536a49632e706e67)

meta_key 实际上就是 list 链表的 key, 而 meta_value 由五个部分构成: 8Bytes 的 List size(用于存储当前链表中总共有多少个结点) + 4Bytes 的 Version(用于秒删功能) + 4Bytes 的 Timestamp(用于记录我们给这个 List 链表设置的超时时间的时间戳， 默认为 0) + 8Bytes 的 Left Index（数组的左边界) + 8Bytes 的 Right Index(数组的右边界)

2.  list 链表中 data_key 和 data_value 的落盘方式: ![](https://camo.githubusercontent.com/e39c47b452e1eb53b098644a81d284f162d309231dcc0980f49fc33079c95e96/68747470733a2f2f692e696d6775722e636f6d2f4642426e366b642e706e67)

data_key 由四个部分构成: 4Bytes 的 Key size(用于记录后面追加的 key 的长度，便与解析) + key 的内容 + 4Bytes 的 Version + 8Bytes 的 Index(这个记录的就是当前结点的在这个 list 链表中的索引)， 而 data_value 就是 list 链表该 node 中存储的值

## 4. Set 结构的存储

blackwidow 中的 set 由两部分构成，元数据(meta_key, meta_value), 和普通数据(data_key, data_value), 元数据中存储的主要是 set 集合的一些信息， 比如说当前 set 集合 member 的数量以及当前 set 集合的版本号和过期时间(用做秒删功能), 普通数据实际上就是指的 set 集合中的 member，作为具体最后 Rocksdb 落盘的 kv 格式，下面是具体的实现方式：

1.  每个 set 集合的 meta_key 和 meta_value 的落盘方式: ![](https://camo.githubusercontent.com/2ba8bc8d101143aa1df9e148de7914718dee68ae5aad709dfd145014432fc9fe/68747470733a2f2f692e696d6775722e636f6d2f6251655676536a2e706e67)

meta_key 实际上就是 set 集合的 key, 而 meta_value 由三个部分构成: 4Bytes 的 Set size(用于存储当前 Set 集合的大小) + 4Bytes 的 Version(用于秒删功能) + 4Bytes 的 Timestamp(用于记录我们给这个 set 集合设置的超时时间的时间戳， 默认为 0)

2.  set 集合中 data_key 和 data_value 的落盘方式: ![](https://camo.githubusercontent.com/f51fea5da2f158cb3307736964e651b9ce346fa93ea43abaafe5568d92f64b80/68747470733a2f2f692e696d6775722e636f6d2f6432637471506f2e706e67)

data_key 由四个部分构成: 4Bytes 的 Key size(用于记录后面追加的 key 的长度，便与解析) + key 的内容 + 4Bytes 的 Version + member 的内容， 由于 set 集合只需要存储 member, 所以 data_value 实际上就是空串

## 5. ZSet 结构的存储

blackwidow 中的 zset 由两部部分构成，元数据(meta_key, meta_value), 和普通数据(data_key, data_value), 元数据中存储的主要是 zset 集合的一些信息， 比如说当前 zset 集合 member 的数量以及当前 zset 集合的版本号和过期时间(用做秒删功能), 而普通数据就是指的 zset 中每个 member 以及对应的 score, 由于 zset 这种数据结构比较特殊，需要按照 memer 进行排序，也需要按照 score 进行排序， 所以我们对于每一个 zset 我们会按照不同的格式存储两份普通数据, 在这里我们称为 member to score 和 score to member，作为具体最后 Rocksdb 落盘的 kv 格式，下面是具体的实现方式：

1.  每个 zset 集合的 meta_key 和 meta_value 的落盘方式: ![](https://camo.githubusercontent.com/ef672f1a699febc2c0a941b4b1044e52e88829a491e66770b9e04d44b1da01d6/68747470733a2f2f692e696d6775722e636f6d2f52685a384b4d772e706e67)

meta_key 实际上就是 zset 集合的 key, 而 meta_value 由三个部分构成: 4Bytes 的 ZSet size(用于存储当前 zSet 集合的大小) + 4Bytes 的 Version(用于秒删功能) + 4Bytes 的 Timestamp(用于记录我们给这个 Zset 集合设置的超时时间的时间戳， 默认为 0)

2.  每个 zset 集合的 data_key 和 data_value 的落盘方式(member to score): ![](https://camo.githubusercontent.com/72f31e9af4e24f9cc224eec299904e514543a28360f6632b86ee48303cdea1f0/68747470733a2f2f692e696d6775722e636f6d2f4338354261355a2e706e67)

member to socre 的 data_key 由四个部分构成：4Bytes 的 Key size(用于记录后面追加的 key 的长度，便与解析) + key 的内容 + 4Bytes 的 Version + member 的内容， data_value 中存储的其 member 对应的 score 的值，大小为 8 个字节，由于 rocksdb 默认是按照字典序进行排列的，所以同一个 zset 中不同的 member 就是按照 member 的字典序来排列的(同一个 zset 的 key size, key, 以及 version，也就是前缀都是一致的，不同的只有末端的 member).

3.  每个 zset 集合的 data_key 和 data_value 的落盘方式(score to member): ![](https://camo.githubusercontent.com/e6722072aa2fc2043c9b0a4e40fcca103e7244dcb28a7f6f949459b7f1b01eec/68747470733a2f2f692e696d6775722e636f6d2f5156395848456b2e706e67)

score to member 的 data_key 由五个部分构成：4Bytes 的 Key size(用于记录后面追加的 key 的长度，便与解析) + key 的内容 + 4Bytes 的 Version + 8Bytes 的 Score + member 的内容， 由于 score 和 member 都已经放在 data_key 中进行存储了所以 data_value 就是一个空串，无需存储其他内容了，对于 score to member 中的 data_key 我们自己实现了 rocksdb 的 comparator，同一个 zset 中 score to member 的 data_key 会首先按照 score 来排序， 在 score 相同的情况下再按照 member 来排序

## Blackwidow 相对于 Nemo 有哪些优势

1.  Blackwidow 采用了 rocksdb 的 column families 的新特性，将元数据和实际数据分开存放(对应于上面的 meta 数据和 data 数据), 这种存储方式相对于 Nemo 将 meta, data 混在一起存放更加合理， 并且可以提升查找效率(比如 info keyspace 的效率会大大提升)
2.  Blackwidow 中参数传递大量采用 Slice 而 Nemo 中采用的是 std::string, 所以 Nemo 会有很多没有必要的 string 对象的构造函数以及析构函数的调用，造成额外的资源消耗，而 Blackwidow 则不会有这个问题
3.  Blackwidow 对 kv 模拟多数据结构的存储格式上做了重新设计(具体可以参考 Nemo 引擎数据存储格式和本篇文章)，使之前在 Nemo 上出现的一些无法解决的性能问题得以解决，所以 Blackwidow 的多数据结构在某些场景下性能远远优于 Nemo
4.  原来 Nemo 对多数据结构的 Key 的长度最大只能支持到 256 Bytes，而 Blackwidow 经过重新设计，放开了多数据结构 Key 长度的这个限制
5.  Blackwidow 相对于 Nemo 更加节省空间，Nemo 由于需要 nemo-rocksdb 的支持，所以不管在 meta 还是 data 数据部分都追加了 version 和 timestamp 这些信息，并且为了区分 meta_key 和 data_key, 在最前面加入 s 和 S(拿 Set 数据结构打比方)，Blackwidow 在这方面做了优化，使同样的数据量下 Blackwidow 所占用的空间比 Nemo 要小(举个例子，Blackwidow 中 List 结构中的一个 Node 就比 Nemo 中的一个 Node 节省了 16 Bytes 的空间)
6.  Blackwidow 在锁的实现上参照了 RocksDB 事务里锁的实现方法，而弃用了之前 Nemo 的行锁，所以在多线程对同一把锁有抢占的情况下性能会有所提升
