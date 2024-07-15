---
title: Pika 的简介与同 Redis 的比较
---

## Pika 简介

Pika 是一款高性能的 Key-Value 数据库，对采用 Redis 协议展开通信的软件保持着良好的兼容性，绝大多数依托 Redis 展开工作的服务，可以在不修订代码的情况下，就平滑迁移到 Pika 上面来。

除了协议上的兼容外，Pika 在功能上也如 Redis 一样，可以展开主从备份，在这基础上支持了大容量的数据存储，有效地解决原 Redis 的容量瓶颈问题。

## 与 Redis 的比较

+ **Pika 数据存储容量更大**  
  Pika 没有 Redis 的内存限制，它的最大使用空间与磁盘空间大小相同。
+ **Pika 加载与备份的速度更快**  
  Pika 的写入机制与重启机制更加精简，同时备份速度在测试情况中同 Linux 复制文件的指令基本相同，这就使得数据库在遇到问题重启，以及主从模式的同步时，所需时间更少，可靠性更高。
+ **Redis 存放数据的性能更强**
  Pika 相较于可以全内存读写的 Redis 而言，增加了使用文件存放数据的环节，因此在存放性能上会低于 Redis。   
  使用 SSD 磁盘，在硬件上改善性能可以缓解这一性能差距。

## 适用场景

+ **Pika 适合于大数据量或者要求高可用的场景**   
  在大数据量场景（以50GB为分界线），以及要求高可用（不允许断电丢失）的场景，应当选择 Pika 而不是 Redis。
+ **Redis 在小数据量场景表现更佳**   
  在实际应用中，Pika 的性能约为 Redis 的 50%，所以在小数据量场景下，使用 Redis 是更好的选择。

## 实例：与 Redis 的性能对比实验

### 配置

- CPU: 24 Cores, Intel® Xeon® CPU E5-2630 v2 @ 2.60GHz
- MEM: 165157944 kB
- OS: CentOS release 6.2 (Final)
- NETWORK CARD: Intel Corporation I350 Gigabit Network Connection

### 测试过程

在 Pika 中先写入 150G 大小的数据，写入 Hash key 50 个，field 1 千万级别。  
Redis 写入 5G 大小的数据。 

Pika：18 个线程  
Redis：单线程 

![](https://camo.githubusercontent.com/29012b564d31839e38ec694350d334940c085bc17f32a1934cc08cd398ada455/687474703a2f2f7777342e73696e61696d672e636e2f6c617267652f633263643433303767773166366f757763617a617a6a323066753063766161732e6a7067)

### Pika vs SSDB ([Detail](https://github.com/Qihoo360/pika/wiki/pika-vs-ssdb))

![](https://camo.githubusercontent.com/96ced41fb766c5bff0bdcc905b8a33bd7ed173e497bc0a8de0456bde6704ccef/687474703a2f2f696d6775722e636f6d2f72474d5a6d70442e706e67)
![](https://camo.githubusercontent.com/89334870bbb553f9dcaa59ff7b05e231cbac32d602a94b9103f630997adcb5b0/687474703a2f2f696d6775722e636f6d2f676e774d446f662e706e67)

### Pika vs Redis

![](https://camo.githubusercontent.com/d02d78e0804b9d3069343141117395ab950cf9bf90905ec6d2ca6bc7d290da1c/687474703a2f2f696d6775722e636f6d2f6b39395679464e2e706e67)

### 结论

在单线程下面，Pika 性能不如 Redis，但是因为 Pika 本身是多线程架构，所以采行多线程的情况下，Pika 可以在一定的场景拥有更好的性能表现。

## 如何从 Redis 迁移到 Pika

### 开发需要做的

得益于 Pika 同 Redis 的兼容性，开发者不需要改动代码。

### DBA 需要做的

1. 将 Redis 的数据迁移到 Pika 上
2. 展开实时同步工作，确保 Redis 与 Pika 的数据保持一致
3. 切换 LVS 后端 ip，使得 Pike 的服务支撑可以代替 Redis，由此完成迁移