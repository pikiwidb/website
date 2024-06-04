---
title: Pika介绍
# author: --
# date: '2023-12-02'
---

## Pika 简介

Pika 是 DBA 和基础架构组联合开发的类 Redis 存储系统，所以完全支持 Redis 协议，用户不需要修改任何代码，就可以将服务迁移至 Pika。Pika 是一个可持久化的大容量 Redis 存储服务，兼容 string、hash、list、zset、set 的绝大接口兼容详情，解决 Redis 由于存储数据量巨大而导致内存不够用的容量瓶颈，并且可以像 Redis 一样，通过 slaveof 命令进行主从备份，支持全同步和部分同步。同时 DBA 团队还提供了迁移工具， 所以用户不会感知这个迁移的过程，迁移是平滑的。

## 与 Redis 的比较

Pika 相对于 Redis，最大的不同就是 Pika 是持久化存储，数据存在磁盘上，而 Redis 是内存存储，由此不同也给 Pika 带来了相对于 Redis 的优势和劣势。

优势：

- 容量大：Pika 没有 Redis 的内存限制, 最大使用空间等于磁盘空间的大小
- 加载 db 速度快：Pika 在写入的时候, 数据是落盘的, 所以即使节点挂了, 不需要 rdb 或者 oplog，Pika 重启不用加载所有数据到内存就能恢复之前的数据, 不需要进行回放数据操作。
- 备份速度快：Pika 备份的速度大致等同于 cp 的速度（拷贝数据文件后还有一个快照的恢复过程，会花费一些时间），这样在对于百 G 大库的备份是快捷的，更快的备份速度更好的解决了主从的全同步问题

劣势：
由于 Pika 是基于内存和文件来存放数据, 所以性能肯定比 Redis 低一些, 但是我们一般使用 SSD 盘来存放数据, 尽可能跟上 Redis 的性能。

## 适用场景

从以上的对比可以看出, 如果你的业务场景的数据比较大，Redis 很难支撑， 比如大于 50G，或者你的数据很重要，不允许断电丢失，那么使用 Pika 就可以解决你的问题。 而在实际使用中，Pika 的性能大约是 Redis 的 50%。

## Pika 的特点

1.  容量大，支持百 G 数据量的存储
2.  兼容 Redis，不用修改代码即可平滑从 Redis 迁移到 Pika
3.  支持主从(slaveof)
4.  完善的运维命令

## 当前使用情况

目前 Pika 在线上部署并运行了 20 多个巨型（承载数据与 Redis 相比）集群 粗略的统计如下：当前每天承载的总请求量超过 100 亿，当前承载的数据总量约 3TB

## 与 Redis 的性能对比

### 配置

- CPU: 24 Cores, Intel® Xeon® CPU E5-2630 v2 @ 2.60GHz
- MEM: 165157944 kB
- OS: CentOS release 6.2 (Final)
- NETWORK CARD: Intel Corporation I350 Gigabit Network Connection

### 测试过程

在 Pika 中先写入 150G 大小的数据，写入 Hash key 50 个，field 1 千万级别。 Redis 写入 5G 大小的数据。 Pika：18 个线程 Redis：单线程 ![](https://camo.githubusercontent.com/29012b564d31839e38ec694350d334940c085bc17f32a1934cc08cd398ada455/687474703a2f2f7777342e73696e61696d672e636e2f6c617267652f633263643433303767773166366f757763617a617a6a323066753063766161732e6a7067)

### Pika vs SSDB ([Detail](https://github.com/Qihoo360/pika/wiki/pika-vs-ssdb))

![](https://camo.githubusercontent.com/96ced41fb766c5bff0bdcc905b8a33bd7ed173e497bc0a8de0456bde6704ccef/687474703a2f2f696d6775722e636f6d2f72474d5a6d70442e706e67)
![](https://camo.githubusercontent.com/89334870bbb553f9dcaa59ff7b05e231cbac32d602a94b9103f630997adcb5b0/687474703a2f2f696d6775722e636f6d2f676e774d446f662e706e67)

### Pika vs Redis

![](https://camo.githubusercontent.com/d02d78e0804b9d3069343141117395ab950cf9bf90905ec6d2ca6bc7d290da1c/687474703a2f2f696d6775722e636f6d2f6b39395679464e2e706e67)

### 结论

Pika 的单线程的性能肯定不如 Redis，Pika 是多线程的结构，因此在线程数比较多的情况下，某些数据结构的性能可以优于 Redis。

## 如何从 Redis 迁移到 Pika

### 开发需要做的

开发不需要做任何事，不用改代码、不用替换 driver（Pika 使用原生 redis 的 driver），什么都不用动，看 dba 干活就好

### DBA 需要做的

1.  DBA 迁移 Redis 数据到 Pika
2.  DBA 将 Redis 的数据实时同步到 Pika，确保 Redis 与 Pika 的数据始终一致
3.  DBA 切换 LVS 后端 ip，由 Pika 替换 Redis
