---
title: Pika多库版命令、参数变化参考
# author: --
# date: '2023-12-02'
---

:::warning
Pika 自版本 3.1.0 起开始支持多 db，为了兼容多 db 部分命令、配置参数发生了变化，具体变化如下：
:::

### 1.`info keyspace`命令：

**保留**：

`info keyspace [1|0]`:触发统计并展示、仅展示所有 db 的 key 信息

**新增：**

`info keyspace [1|0] db0`:触发统计并展示、仅展示 db0 的 key 信息

`info keyspace [1|0] db0,db2`:触发统计并展示、仅展示 db0 和 db2 的 key 信息

注意：db-name 仅允许使用`db[0-7]`来表示，多个 db-name 使用`逗号`隔开

## 2.`compact`命令：

**保留：**

`compact`:对所有 db 进行 compact

`compact [string/hash/set/zset/list/all]`:对所有 db 的某个数据结构、所有数据结构进行 compact

**新增：**

`compact db0 all`:仅对 db0 的所有数据结构进行 compact

`compact db0,db2 all`:对 db0 及 db2 的所有数据结构进行 compact

`compact db1 string`:仅对 db1 的 string 数据结构进行 compact

`compact db1,db3 hash`:对 db1 及 db3 的 hash 数据结构进行 compact

注意：db-name 仅允许使用`db[0-7]`来表示，多个 db-name 使用`逗号`隔开

## 3.`slaveof`命令:

**保留:**

`slaveof 192.168.1.1 6236 [force]`:为 pika 实例创建同步关系，影响所有 db，可通过 force 参数进行实例级全量同步

**删除:**

`slaveof 192.168.1.1 6236 1234 111222333`:全局创建同步关系时不再允许指定 write2file 文件号、write2file 文件偏移量

## 4.`bgsave`命令:

**保留:**

`bgsave`:对所有 db 进行快照式备份

**新增:**

`bgsave db0`:仅备份 db0

`bgsave db0,db3`:仅备份 db0 及 db3

注意：db-name 仅允许使用`db[0-7]`来表示，多个 db-name 使用`逗号`隔开

## 5.`purgelogsto`命令:

**保留:**

`purgelogsto write2file1000`:删除 db0 中的 write2file1000 以前的所有 write2file

**新增:**

`purgelogsto write2file1000 db1`:删除 db1 中的 write2file1000 以前的所有 write2file，每次仅允许操作一个 db

注意：db-name 仅允许使用`db[0-7]`来表示

## 6.`flushdb`命令:

**保留:**

`flushdb [string/hash/set/zset/list]`:删除某个 db 中的某个数据结构

**新增:**

`flushdb`:删除某个 db 中的所有数据结构

注意:与 redis 一致，在 pika 中执行 flushdb 前请先 select 到准确的 db，以防误删数据

## 7.`dbslaveof`命令:

`dbslaveof db[0 ~ 7]`: 同步某一个 db

`dbslaveof db[0 ~ 7] force`: 全量同步某一个 db

`dbslaveof db[0 ~ 7] no one`: 停止同步某一个 db

`dbslaveof db[0 ~ 7] filenum offset`: 指定偏移量同步某一个 db

注意:该命令需要在两个 Pika 实例已经建立了主从关系之后才能对单个 db 的同步状态进行控制
