---
title: Redis到pika迁移工具
author: --
date: '2023-12-02'
---
## 名称：

aof\_to\_pika

## 位置：

pika bin目录下

## 目的：

方便Redis数据到Pika的迁移

## 背景：

Pika兼容Redis协议，所以任何使用于Redis的迁移工具同样也适用于Pika，Redis-cli本身提供了一个pipe参数来完成Redis到Redis的数据迁移。该工具的实现方式为读取待迁移Redis的aof文件并批量发送到目的Redis。Berry借鉴这种方式，并增加了如下改进：

- 迁移过程中，不断读取aof新增内容
- 错误输出
- 线程并行方式代替串行方式，提高迁移效率

## 实现：

### reader线程

1. tail -f 的方式读取指定aof文件中的内容
2. 根据设定的单次发送长度拼装成块，依次来减少网络通信
3. 将要发送的块压入队列

### sender线程

1. 从队列中读取一个发送块
2. 发送到目的服务器
3. 处理reply信息并做统计

## 使用：

```
Parameters:
-i: aof file
-h: the target host
-p: the target port
-a: the target auth
-v: show more information
Example: ./aof_to_pika -i ./appendonly.aof -h [pika_ip] -p [pika_port] -a abc -v
```