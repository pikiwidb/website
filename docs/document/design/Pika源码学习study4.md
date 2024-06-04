---
title: Pika源码学习--pika和rocksdb的对接
# author: --
# date: '2023-12-02'
---

在《Pika 源码学习--pika 的命令执行框架》中我们了解了一个命令的执行流程，也知道了 pika 使用的是 Blackwidow 引擎，现在我们来看看 pika 是怎么和 rocksdb 对接的，Blackwidow 具体怎么处理命令。  
1.Pika 和 rocksdb 对接  
在 Partition 构造的时候，创建了一个 BlackWidow，当前 BlackWidow 支持 5 种 redis 的数据结构，分别是 String 结构， Hash 结构，List 结构，Set 结构和 ZSet 结构。一个 BlackWidow 分别为这 5 种数据结构打开了一个 rocksdb，分别是 strings_db\_，hashes_db\_，sets_db\_，zsets_db\_，lists_db\_，在 BlackWidow::Open 的时候打开了这个 5 个 rocksdb：  
![](https://img2020.cnblogs.com/blog/1993880/202005/1993880-20200505181121293-188997744.png)  
在上面命令下来的时候，BlackWidow 就会根据命令使用具体类型的 db 来操作  
![](https://img2020.cnblogs.com/blog/1993880/202005/1993880-20200505181127816-1391592651.png)

2.Redis 命令与 rocksdb kv 的转换  
因为 rocksdb 只支持 kv 的操作，那么 redis 的几种数据结构是怎么转换成 rocksdb 的 kv 的呢？官方有资料详细介绍了这个，我们根据官方资料学习即可（pika blackwidow 引擎数据存储格式）[https://github.com/Qihoo360/pika/wiki/pika-blackwidow 引擎数据存储格式](https://github.com/Qihoo360/pika/wiki/pika-blackwidow%E5%BC%95%E6%93%8E%E6%95%B0%E6%8D%AE%E5%AD%98%E5%82%A8%E6%A0%BC%E5%BC%8F)  
这里引用官方的一个图，pika 的每个分区是打开了 5 个 rocksdb，一些数据结构的对接需要分开保存元数据和数据，元数据和数据分开存储是用了 rocksdb 的 Column Family  
![](https://img2020.cnblogs.com/blog/1993880/202005/1993880-20200505181142360-1886025896.png)
