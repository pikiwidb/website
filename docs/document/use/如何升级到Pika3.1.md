---
title: 如何升级到Pika3.1或3.2
# author: --
# date: '2023-12-02'
---
## 迁移工具介绍

### manifest生成工具

- 工具路径`./tools/manifest_generator`
- 工具作用：用来进行manifest的生成

### 增量同步工具

- 工具路径`./tools/pika_port`
- 工具作用：用来进行pika3.0与新pika3.1或pika3.2之间的数据同步

## 说明

1. 为了提高pika的单机性能，自Pika3.1开始，我们在Pika中实现了redis的多库模式，正是因为如此底层存储db以及log的目录发生了一些变化，如果老版本pika的db路径是`/data/pika9221/db`，那么单db数据都会存在这个目录下面，但是由于我们目前支持了多db，目录层级比原先多了一层，所以迁移的时候我们需要手动将原先单db的数据挪到`/data/pika9221/db/db0`当中
2. 为了提高多DB的同步效率，在新版本Pika中我们使用PB协议进行实例间通信，这意味着新版本的Pika不能直接与老版本的Pika直接建立主从，所以我们需要[pika\_port](https://github.com/OpenAtomFoundation/pika/wiki/https%3a%2f%2fgithub.com%2fQihoo360%2fpika%2fwiki%2fpika%e5%88%b0pika%e3%80%81redis%e8%bf%81%e7%a7%bb%e5%b7%a5%e5%85%b7)将老版本Pika的数据增量同步到新版本Pika上

## 升级步骤

1. 根据自己的场景配置新版本Pika的配置文件(databases项用于指定开启几个db)
2. 登录主库执行bgsave操作，然后将dump下来的数据拷贝到新版本pika配置文件中db-path目录的下一级目录db0中

```
例子：
    旧版本Pika dump的路径为：/data/pika_old/dump/20190517/
    新版本Pika db-path的路径为：/data/pika_new/db/
    那么我们执行： cp -r /data/pika_old/dump/20190517/ /data/pika_new/db/db0/
```

3. 使用manifest\_generator工具，在新版本pika配置log目录的下一级目录log\_db0中生成manifest文件，这样可以让新的pika产生和老的pika一样的binlog偏移量，需要指定db-path/db0目录和$log-path/log\_db0目录（相当于把老版的db和log合并到了新版的db0里面)

```
例子：
    新版本Pika db-path的路径为： /data/pika_new/db/
    新版本Pika log-path的路径为：/data/pika_new/log/
    那么我们执行： ./manifest_generator -d /data/pika_new/db/db0 -l /data/pika_new/log/log_db0
```

4. 用v3.1.0版本的的二进制和对应的配置文件启动Pika，使用info log查看db0的binlog偏移量(filenum和offset)
5. 使用Pika-port工具将旧版Pika的数据增量同步到新版本Pika上面来

```
例子：
    旧版本Pika的ip为：192.168.1.1，端口为：9221
    新版本Pika的ip为：192.168.1.2，端口为：9222
    执行pika_port工具机器的本地ip为：192.168.1.3, 打算使用的端口为：9223
    获取的filenum为：100，获取的offset为：999

  那么我们执行：./pika_port -t 192.168.1.3 -p 9223 -i 192.168.1.1 -o 9221 -m 192.168.1.2 -n 9222 -f 100 -s 999 -e
```

6. 在使用pika-port进行同步的过程中我们可以登录主库执行`info replication`打印出的数据里会发现新增了一条从库信息，他是pika\_port工具模仿slave行为与源库进行交互，同时可以通过lag查看他的延迟
    
7. 当我们与pika3.1或pika3.2进行增量同步的时候，可以对pika3.1或pika3.2进行从库添加操作，这样的话在从库都同步完成之后，我们在源库上查看lag如果为0 或者是很小的时候我们可以将整个集群进行替换，把原来的集群替换掉，把新集群上线
    

## 注意事项

1. 当我们在拷贝dump目录的时候，最好先mv改名字，然后在进行远程同步，这可以防止dump目录在拷贝的时候覆盖而造成数据不一致的结果
2. 在我们使用manifest\_generator工具的时候，他需要dump时候生成的info文件，所以在拷贝dump目录的时候，要保证info文件也移动到指定的目录底下
3. 使用manifest\_generator的时候 $log-path/db0 目录如果存在是会报错的，所以不要新建db0目录，脚本会自动创建
4. pika\_port增量同步工具需要依赖info文件里的ip port 和file offset进行同步。
5. pika\_port会模仿slave与源库交互，所以他会进行trysync，当他请求的点位在源库过期的时候，就会触发全同步，会自动的使用-r 这个参数记录的目录来存放rsync全量同步的数据，如果不想让他自动的进行全同步，可以使用-e参数，当进行全同步的时候会返回-1，但是这时候rsync还是再继续，需要kill 本地的rsync进程，源库才会终止全量同步
6. pika\_port进行增量同步是持续性的，不会断的，这个时候可以在源库上使用 info replication 查看slave的lag来确定延迟
7. pika\_port工具支持多线程应用，根据key hash，如果是同一个key会hash到一个线程上去回放，可以保证同一个key的顺序
8. 在数据量比较大的情况下，使用拷贝dump目录可能花费的时间比较久，导致主库当时dump时对应的位置的binlog会被清除掉（或者pika3.1(pika3.2)新增从库的时候也需要注意），导致最后无法进行增量同步，所以在升级之前要将原先的主库的binlog生命周期设置得长一些(修改expire-logs-days和expire-logs-nums配置项)
9. 如果我们不用manifest\_generator 生成manifest文件也是可以的，但是这个时候启动的pika3.1或pika3.2实例的点位是 0 0 ，如果后续在pika3.1或pika3.2后挂载从库的话，需要在从库上执行`slaveof IP PORT force`命令，否则的话从库可能会出现少数据的情况
