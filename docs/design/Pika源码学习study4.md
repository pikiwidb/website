---
title: Pika源码学习--pika和rocksdb的对接
author: --
date: '2023-12-02'
---
在《Pika源码学习--pika的命令执行框架》中我们了解了一个命令的执行流程，也知道了pika使用的是Blackwidow引擎，现在我们来看看pika是怎么和rocksdb对接的，Blackwidow具体怎么处理命令。  
1.Pika和rocksdb对接  
在Partition构造的时候，创建了一个BlackWidow，当前BlackWidow支持5种redis的数据结构，分别是String结构， Hash结构，List结构，Set结构和ZSet结构。一个BlackWidow分别为这5种数据结构打开了一个rocksdb，分别是 strings\_db\_，hashes\_db\_，sets\_db\_，zsets\_db\_，lists\_db\_，在BlackWidow::Open的时候打开了这个5个rocksdb：  
![](https://img2020.cnblogs.com/blog/1993880/202005/1993880-20200505181121293-188997744.png)  
在上面命令下来的时候，BlackWidow就会根据命令使用具体类型的db来操作  
![](https://img2020.cnblogs.com/blog/1993880/202005/1993880-20200505181127816-1391592651.png)

2.Redis命令与rocksdb kv的转换  
因为rocksdb只支持kv的操作，那么redis的几种数据结构是怎么转换成rocksdb的kv的呢？官方有资料详细介绍了这个，我们根据官方资料学习即可（pika blackwidow引擎数据存储格式）[https://github.com/Qihoo360/pika/wiki/pika-blackwidow引擎数据存储格式](https://github.com/Qihoo360/pika/wiki/pika-blackwidow%E5%BC%95%E6%93%8E%E6%95%B0%E6%8D%AE%E5%AD%98%E5%82%A8%E6%A0%BC%E5%BC%8F)  
这里引用官方的一个图，pika的每个分区是打开了5个rocksdb，一些数据结构的对接需要分开保存元数据和数据，元数据和数据分开存储是用了rocksdb的Column Family  
![](https://img2020.cnblogs.com/blog/1993880/202005/1993880-20200505181142360-1886025896.png)