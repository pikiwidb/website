---
title: "全同步"
sidebar_position: 3
---

## 背景
### 1.Pika Replicate
- pika支持master/slave的复制方式，通过slave端的slaveof命令激发
- salve端处理slaveof命令，将当前状态变为slave，改变连接状态
- slave的向master发送MetaSync请求，在同步之前确保自身db的拓扑结构和master一致
- slave下的每个partition单独的向master端对应的partition发起trysync请求，建立同步关系
### 2.Binlog
- pika同步依赖binlog
- binlog文件会自动或手动删除
- 当同步点对应的binlog文件不存在时，需要通过全同步进行数据同步
## 全同步
### 1. 简介
- 需要进行全同步时，master会将db文件dump后发送给slave
- 通过rsync的deamon模式实现db文件的传输
- 默认使用pika port+1000作为rysnc传输端口
### 2. 实现逻辑
1. 在pika实例启动的同时会启动Rsync服务
2. master发现某一个partition需要全同步时，判断是否有备份文件可用，如果没有先dump一份
3. master通过rsync向slave发送对应partition的dump的文件
4. slave的对应partition用收到的文件替换自己的db
5. slave的对应partition用最新的偏移量再次发起trysnc
6. 完成同步

Slave中某一个Partition建立同步:
![slave的partition](https://i.imgur.com/flnOyeZ.png)

Master处理同步请求：
![master执行过程](https://i.imgur.com/Beclo9c.png)
### 3. Slave连接状态
- No Connect：不尝试成为任何其他节点的slave
- ShouldMetaSync：向master请求db的拓扑信息，确保与自身一致
- TryConnect：为每个partition重置状态机，让其处于准备同步的状态
- Connecting：在所有partition没有建立同步关系之前一直是处于connecting的状态
- EstablishSucces: 所有partition建立同步关系成功
- Error：出现了异常


