---
title: Redis请求实时copy到pika工具
author: --
date: '2023-12-02'
---
## 名称：

redis-copy

## 位置：

pika bin目录下

## 说明：

实时将redis上的所有请求同步发送给pika，可以非常方便的检查你当前基于Redis的业务是否能够完美迁移至pika

## 目的：

1. 方便比较redis及pika
2. 降低pika的试用门槛

## 特点：

1. 实时转发
2. 二进制安全
3. 不兼容请求输出

## 实现：

1. 利用redis客户端的“Monitor”命令获得实时执行的命令
2. 解析获得的字符串命令，以二进制安全的方式解析并拼装
3. 使用hiredis与redis及pika进行交互

## 使用：

```
DESCRIPTION:
- Redis monitor copy tool: monitor redis server indicated by src_host, src_port, src_auth and send to des server
Parameters:
-s: source server
-d: destination server
-v: show more information
-h: help
Example:
- ./redis-copy -s abc@127.0.0.1:6379 -d cba@xxx.xxx.xxx.xxx:6379 -v
```