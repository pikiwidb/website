---
title: PIKA 到 Redis 数据迁移方案
author: --
date: '2023-12-02'
---
# PIKA 到 Redis 数据迁移方案

最后更新时间：2023-05-23 10:54:21

[下载PDF](https://main.qcloudimg.com/raw/document/intl/product/pdf/tencent-cloud_239_31930_zh.pdf)

- [迁移原理](javascript:void(0); "迁移原理")
- [适用版本](javascript:void(0); "适用版本")
- [注意事项](javascript:void(0); "注意事项")
- [迁移步骤](javascript:void(0); "迁移步骤")

## 迁移原理

将 PIKA 中的数据在线迁移到 Redis，并支持全量和增量同步。使用 [pika-migrate](https://github.com/Qihoo360/pika/tree/v3_2_7_migrate "https://github.com/Qihoo360/pika/tree/v3_2_7_migrate") 工具，将工具虚拟为 PIKA 的从库，然后从主库获取到数据转发给 Redis，同时支持增量同步，实现在线热迁的功能。

1. [pika-migrate](https://github.com/Qihoo360/pika/tree/v3_2_7_migrate "https://github.com/Qihoo360/pika/tree/v3_2_7_migrate") 通过 dbsync 请求获取主库全量 DB 数据，以及当前 DB 数据所对应的 binlog 点位。

2. 获取到主库当前全量 DB 数据之后，扫描 DB，将 DB 中的数据打包转发给 Redis。

3. 通过之前获取的 binlog 的点位向主库进行增量同步, 在增量同步的过程中，将从主库获取到的 binlog 重组成 Redis 命令，转发给 Redis。

## 适用版本

适用 PIKA 3.2.0及以上版本，单机模式且只使用了单 DB。若 PIKA 版本低于3.2.0，需将内核版本升级至 3.2.0。具体信息，请参见 [升级 PIKA 内核版本至3.2.0](https://github.com/Qihoo360/pika/wiki/%E5%A6%82%E4%BD%95%E5%8D%87%E7%BA%A7%E5%88%B0Pika3.1%E6%88%963.2 "https://github.com/Qihoo360/pika/wiki/如何升级到Pika3.1或3.2")。

## 注意事项

PIKA 支持不同数据结构采用同名 Key，但是 Redis 不⽀持，所以在有同 Key 数据的场景下，以第⼀个迁移到 Redis 数据结构为准，其他同名 Key 的数据结构会丢失。

该工具只支持热迁移单机模式下，并且只采⽤单 DB 版本的 PIKA，如果是集群模式，或者是多 DB 场景，⼯具会报错并且退出。

为了避免由于主库 binlog 被清理导致该⼯具触发多次全量同步向 Redis 写入脏数据，工具自身做了保护，在第⼆次触发全量同步时会报错退出。