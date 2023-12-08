---
title: floyd存储方案
author: --
date: '2023-11-10'
---
# pika存储结构

## 整体架构

新的存储架构中，pika实例存储引擎包括内存缓存redis和硬盘持久存储RocksDB。每个pika实例由一个redis和多个RocksDB实例构成。

pika当前是将不同的数据类型放在不同的RocksDB实例中，线上使用过程中发现，同一个业务服务使用的数据类型一般集中在一两个数据类型中，无法发挥多RocksDB实例的优势。因此，pika新版本中计划不再按照数据类型区分RocksDB实例，而是通过column-family区分。单个pika节点的RocksDB实例个数根据物理机硬件配置决定，每个RocksDB实例使用独立的compaction线程池和flush线程池，初次之外每个RocksDB实例使用一个后台线程，该后台线程用来发起manual compaction以及对RocksDB中存储的数据进行定期的统计和巡检。

每个节点在启动时获取到当前节点持有的分片（目前不支持，需要进行代码开发），将分片排序并等分为RocksDB实例个数，保证每个分片持有的RocksDB实例个数近似相同。

## 数据格式

为了兼容redis协议，即为同一个数据类型的数据设置统一的过期时间值，复合数据类型中的meta信息还是需要保留，否则ttl/expire接口操作性能耗时增加。增加meta信息导致的数据写入过程中产生的查询开销，计划通过增加内存cache的方式进行缓解，即读meta时也是优先读内存缓存cache，读不到再查硬盘。不同的数据类型混合使用RocksDB实例，通过column family中进行区分。

数据存储格式与之前的blackwidow基本相同，只是key，value增加一些字段。

对于key来讲，前缀增加8字节的reserve保留字段以及4字节的slotID，后缀增加16字节的保留字段。

对于value来讲，在value最后统一增加：16字节的保留字段，8字节的数据的写入时间cdate，8字节的数据过期时间。

**string结构**

```c
key格式
| reserve1 | db_id | slot_id | key | reserve2 | 
|      8B      |   2B    |    2B     |       |      16B     |

value格式
| value | reserve | cdate | timestamp | 
|           |     16B   |     8B  |        8B       |

```

**hash结构**

meta数据格式

```c
key格式
| reserve1 | db_id | slot_id | key | reserve2 | 
|        8B    |    2B  |      2B   |        |      16B     |

value格式
| hash_size | version |  reserve  | cdate | timestamp | 
|        4B      |     8B     |      16B    |     8B  |        8B       |

```

data数据格式

```c
key格式
| reserve1 | db_id | slot_id | key size | key | version | field | reserve2 |
|       8B    |    2B   |     2B    |       4B    |        |       8B   |         |      16B     |

value格式
| hash value | reserved | cdate |
|                    |       16B   |   8B  | 
```

**List结构**

meta数据格式

```c
key格式
| reserve1 |  db_id | slot_id | key | reserve2 |
|       8B     |    2B   |      2B   |        |     16B     |

value格式
| list_size | version | left index | right index | reserve |  cdate | timestamp | 
|     4B    |       8B    |       8B      |         8B       |   16B     |    8B    |        8B        |
```

data数据格式

```c
key格式
| reserve1 | db_id | slot_id | key size | key | version | index | reserve2 | 
|       8B    |    2B    |     2B   |       4B    |        |       8B   |   8B   |      16B     |

value格式
| value | reserve | cdate |
|           |     16B   |    8B  | 
```

**set结构**

meta数据格式

```c
key格式
| reserve1 | db_id | slot_id | key | Reserved2 |
|        8B    |    2B   |      2B  |        |    16B    |

value格式
| set_size | version | reserve | cdate | timestamp | 
|     4B      |     8B     |    16B     |   8B   |        8B        |

```

data数据格式

```c
key格式
| reserve1 | db_id | slot_id | key size | key | Version | member |  reserve2 |
|      8B     |    2B   |      2B   |       4B    |        |    8B      |                 |       16B    |  

value格式
| reserve | cdate |
|    16B  |   8B  | 
```

**zset结构**

meta数据格式

```c
key格式
| reserve1 | db_id | slot_id | key | reserve2 |
|       8B    |     2B   |      2B  |        |     16B      |  

value格式
| zset_size | version | reserved | cdate | timestamp | 
|     4B    |    8B   |    16B   |   8B  |     8B    |

```

member to score数据格式

```c
key格式
| reserve1 | db_id | slot_id | key size | key | version | Field | reserve2 |
|      8B      |    2B   |       2B  |     4B     |        |       8B   |          |      16B    |   

value格式
| score value | reserve | cdate |
|         8B        |    16B    |   8B  | 
```

score to member数据格式

```c
key格式
| reserve1 | db_id | slot_id |  key size | key | version | score | member |  reserve2 |
|       8B    |    2B   |    2B     |        4B    |        |      8B    |  8B     |                |       16B    |

value格式
| reserve | cdate |
|   16B   |   8B  | 
```

## 无效数据清理

无效数据包括: 1. 设置了过期时间且已经过期的数据. 2. 业务重复写导致的相同key的老版本数据。3. 已经迁出的分片的旧数据。由于全量数据保存在RocksDB中，因此无效数据的清理主要是通过自定义的compactionFIlter实现。

对于string类型数据，compactionFIlter只需要比对value中的ttl值即可决定。对于复杂数据类型，由于data数据是按照field单独存储而且没有设置过期时间，因此在compaction复杂数据类型的data数据时，需要获取meta信息，包括key的ttl以及version。为减少compaction中读RocksDB导致的额外磁盘IO开销，将复杂数据类型的元信息缓存在内存存储引擎中。

对于已经迁出的分片的旧数据，需要考虑存量的已经迁出的无效数据的清理，同时还要保证如果路由表再一次变更，迁出的分片重新迁回到当前节点之后，之前的无效数据不要被读到。因此，在分片迁移完成路由表发生变更之后，迁出点节点在本地磁盘文件中记录一个迁出的slot\_id，当前的sequence\_number，以及最新的RocksDB filenumber。在自定义的compactionFilter执行时，会去检测当前key是否属于该slot\_id，以及sequence\_number是否小于记录的sequence\_number，只有两个条件都满足，才认为这是数据是无效数据，才可以将数据清除掉。对于客户端的读请求和遍历请求，在读出数据之后也要比对是否属于无效数据。判断方式同理，也是比对记录的slot\_id, sequence\_number，以及RocksDB filenumber。

无效数据清理的触发规则分为两个，一个是RocksDB的auto compaction。另一个是pika发起的manual compaction。

为减少manual compaction对在线服务的影响，manual compaction的执行需要满足两个条件：1. 自定义触发时间段和触发间隔，如每隔两天执行一次，执行时间指定在凌晨低峰期。2. 限制每次执行compaction的数据量，防止manual compaction执行时间过长阻塞auto compaction。

## RocksDB使用优化

### blobdb使用优化

RocksDB支持了key-value分离的实现，即通过将大value存储到blob文件中，在sst文件中存储大value在blob文件的索引信息，从而减少写写放大，有效提升大value场景下的写入性能。pika依赖自定义的compactionFilter实现过期数据的处理，ttl存储在value中，因此在compaction过程中不可避免导致额外的blob文件IO。一种方法是修改sst文件中存储的blobindex，在blobindex的相同offset位置存储value的ttl值，这样compaction过程中对过期数据的清理的逻辑，就不需要查询blob文件，减少额外的磁盘IO。

## dealslowkey

参考新浪微博的经验，当pika上层代码发现一个慢查询key时，发起一次manual compaction，compaction的范围即对应的key前缀对应的数据范围。性能待验证。

### compact老的sst文件

参考新浪微博的经验，定期对最老的sst文件进行compaction可明显提升集群性能。看官方文档，貌似类似的功能RocksDB已经支持，链接如下：[https://github.com/facebook/rocksdb/wiki/Leveled-Compaction#ttl。计划使用RocksDB官方的实现。](https://github.com/facebook/rocksdb/wiki/Leveled-Compaction#ttl%E3%80%82%E8%AE%A1%E5%88%92%E4%BD%BF%E7%94%A8RocksDB%E5%AE%98%E6%96%B9%E7%9A%84%E5%AE%9E%E7%8E%B0%E3%80%82)

## 新技术探索

主要是包括了RocksDB的异步IO，协程，remote compaction等新技术的测试和落地。