---
title: Pika Memory Usage
# author: --
# date: '2023-12-02'
---
### Pika内存占用

1. rocksdb 内存占用
2. pika 内存占用(tcmalloc 占用)

#### 1\. rocksdb 内存占用

命令行命令 info data

used\_memory\_human = db\_memtable\_usage + db\_tablereader\_usage

相应配置及对应影响参数

write-buffer-size => db\_memtable\_usage

max-write-buffer-size => db\_memtable\_usage

max-cache-files => db\_tablereader\_usage

对应rocksdb配置解释

[https://github.com/facebook/rocksdb/wiki/Setup-Options-and-Basic-Tuning](https://github.com/facebook/rocksdb/wiki/Setup-Options-and-Basic-Tuning)

[https://github.com/facebook/rocksdb/wiki/Memory-usage-in-RocksDB](https://github.com/facebook/rocksdb/wiki/Memory-usage-in-RocksDB)

#### 2\. pika 内存占用

如果使用tcmalloc，绝大多数情况下是tcmalloc暂时占用内存。

命令行命令：tcmalloc stats

命令行命令：tcmalloc free 释放tcmalloc 占用内存