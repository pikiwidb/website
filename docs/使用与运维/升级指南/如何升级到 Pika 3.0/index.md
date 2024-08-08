---
title: "如何升级到 Pika 3.0"
sidebar_position: 0
---

## 升级准备工作:  
pika在2.3.3版本时为了确保同步的可靠性,增加了server-id验证功能,因此pika2.3.3~pika2.3.6与pika2.3.3之前的版本无法互相同步  
* 如果你的pika版本小于2.3.3, 你需要准备pika2.3.6及pika3.0.16的bin文件，这里需要注意的是3.0.x需要准备3.0.16以后的版本（或者3.0.6版本），其他版本pika不再能与低版本（2.3.X）进行同步，因此在升级时建议使用最新的3.0.x版本pika来完成整个操作。下文以3.0.16为例。
* 如果你的pika版本>=2.3.3, 你需要准备pika3.0.16的bin文件
* 如果你的pika版本>=2.3.3那么请从下列步骤5开始, 否则请从步骤1开始
* 如果你的pika非集群模式(单点), 且无法停机升级, 请在操作前为该pika补充一个从库

## 升级步骤:
1. 为pika 从库的配置文件增加masterauth参数, 注意, 该参数的值需要与主库的requirepass参数配置相同, 否则会造成验证失败
2. 使用新的(建议使用2.3.6)pika bin目录覆盖低版本目录
3. 分别关闭pika主,从库并使用新的pika bin文件启动
4. 登录从库恢复主从关系(若你的从库配置文件中已经配置了slaveof参数, 那么可忽略该步骤), 并观察同步状态是否为up
5. 将3.0.16版本的pika部署到本服务器
6. 登录从库执行bgsave, 此时你可以在从库的dump目录中获取一份全新的备份, 确保其中的info文件在之后的步骤中不丢失, 例如你可以将其中的信息复制一份
7. 使用pika3.0.16 tools目录中的nemo_to_blackwidow工具将读取该备份中的数据并生成与pika3.0.16新引擎匹配的数据文件, 该工具的使用方法为:  
```
./nemo_to_blackwidow nemo_db_path(需要读取的备份文件目录配置) blackwidow_db_path(需要生成的新数据文件目录配置) -n(线程数量, 请根据服务器性能酌情配置, 避免消耗过多硬件资源)

例子: 低版本pika目录为pika-demo, 版本为3.0.16的pika目录为pika-new30:
./nemo_to_blackwidow /data/pika-demo/dump/backup-20180730 /data/pika-new30/new_db -n 6
```
8. 更新配置文件, 将转换好的目录(/data/pika-new30/new_db)配置为新pika的启动目录(配置文件中的db-path参数), 同时将identify-binlog-type参数配置为old, 确保3.0.16能够解析低版本pika的同步数据, 如果配置文件中存在slaveof信息请注释, 其余配置不变
9. 关闭本机从库(/data/pika-demo), 使用pika3.0.16的bin文件启动新的pika(/data/pika-new30/new_db)
10. 登录pika3.0.16, 并与主库建立同步关系, 此时请打开之前保存的备份目录中的info文件, 该文件的第4,5行分别为pika备份时同步的位置信息, 需要将该信息加入slaveof命令进行增量同步(在执行命令之前要确保主库对应的binlog文件还存在)
```
例子: info文件中的信息如下并假设主库ip为192.168.1.1端口为6666:
3s
192.168.1.2
6666
300
17055479
那么slaveof命令应为:
slaveof 192.168.1.1 6666 300 17055479
```
11. 观察同步状态是否为up, 确认同步正常后等待从库同步无延迟时该从库彻底升级完成, 此时可开始切主操作:
```
a.关闭从库的salve-read-only参数确保从库可写
b.程序端修改连接ip为从库地址, 将程序请求全部转向从库
c.在从库断开(slaveof no one)与主库的同步, 完成整个切主操作
```
12. 通过config set将identify-binlog-type配置为new并修改配置文件中该参数的值为new, 如果config set报错那么意味着你忽略了上个步骤中的c步骤
13. 此时整个升级已完成, 你获得了一个单点的pika3.0.16实例, 若需补充从库, 你可新建一个新的空的pika3.0.16或更新版本的pika实例并通同slaveof ip:port force命令来非常简单的实现主从集群的创建, 该命令能够完整同步数据后自动转换为增量同步

## 注意事项：
* 由于Pika3.0的引擎在数据存储格式上做了重新的设计，新引擎比老引擎更加节省空间，所以升级完毕后，发现Pika3.0的db要比原来小这是正常的现象
* 在数据量比较大的情况下，使用nemo_to_blackwidow工具将Nemo格式的db转换成blackwidow格式的db可能花费的时间比较久，在转换的过程中可能主库当时dump时对应的位置的binlog会被清除掉，导致最后无法进行增量同步，所以在升级之前要将原先的主库的binlog生命周期设置得长一些(修改expire-logs-days和expire-logs-nums配置项)
* 由于我们在pika3.0的版本对binlog格式做了修改，为了兼容老的版本，我们提供了identify-binlog-type选项，这个选项只有pika身份为从库的时候生效，当identify-binlog-type选项值为new的时候，表示将主库发送过来的binlog按照新版本格式进行解析(pika3.0+), 当identify-binlog-type选项值为old的时候, 表示将主库发送过来的binlog按照老版本格式进行解析(pika2.3.3 ~ pika2.3.6)
* Pika3.0对Binlog格式进行了更改，新版本的Binlog在记录更多数据的同时更加节省磁盘空间，所以在将pika2.3.6数据迁移到pika3.0过程当中判断主从同步是否无延迟时不要去对比主从各自的binlog_offset，而是看master上的Replication项slave对应的lag是否接近于0
