---
title: 如何升级到Pika3.0
# author: --
# date: '2023-12-02'
---

## 升级准备工作:

pika 在 2.3.3 版本时为了确保同步的可靠性,增加了 server-id 验证功能,因此 pika2.3.3~pika2.3.6 与 pika2.3.3 之前的版本无法互相同步

- 如果你的 pika 版本<2.3.3, 你需要准备 pika2.3.6 及 pika3.0.16 的 bin 文件，这里需要注意的是 3.0.x 需要准备 3.0.16 以后的版本（或者 3.0.6 版本），其他版本 pika 不再能与低版本（2.3.X）进行同步，因此在升级时建议使用最新的 3.0.x 版本 pika 来完成整个操作。下文以 3.0.16 为例。
- 如果你的 pika 版本>=2.3.3, 你需要准备 pika3.0.16 的 bin 文件
- 如果你的 pika 版本>=2.3.3 那么请从下列步骤 5 开始, 否则请从步骤 1 开始
- 如果你的 pika 非集群模式(单点), 且无法停机升级, 请在操作前为该 pika 补充一个从库

## 升级步骤:

1. 为 pika 从库的配置文件增加 masterauth 参数, 注意, 该参数的值需要与主库的 requirepass 参数配置相同, 否则会造成验证失败
2. 使用新的(建议使用 2.3.6)pika bin 目录覆盖低版本目录
3. 分别关闭 pika 主,从库并使用新的 pika bin 文件启动
4. 登录从库恢复主从关系(若你的从库配置文件中已经配置了 slaveof 参数, 那么可忽略该步骤), 并观察同步状态是否为 up
5. 将 3.0.16 版本的 pika 部署到本服务器
6. 登录从库执行 bgsave, 此时你可以在从库的 dump 目录中获取一份全新的备份, 确保其中的 info 文件在之后的步骤中不丢失, 例如你可以将其中的信息复制一份
7. 使用 pika3.0.16 tools 目录中的 nemo_to_blackwidow 工具将读取该备份中的数据并生成与 pika3.0.16 新引擎匹配的数据文件, 该工具的使用方法为:

```
./nemo_to_blackwidow nemo_db_path(需要读取的备份文件目录配置) blackwidow_db_path(需要生成的新数据文件目录配置) -n(线程数量, 请根据服务器性能酌情配置, 避免消耗过多硬件资源)

例子: 低版本pika目录为pika-demo, 版本为3.0.16的pika目录为pika-new30:
./nemo_to_blackwidow /data/pika-demo/dump/backup-20180730 /data/pika-new30/new_db -n 6
```

8. 更新配置文件, 将转换好的目录(/data/pika-new30/new_db)配置为新 pika 的启动目录(配置文件中的 db-path 参数), 同时将 identify-binlog-type 参数配置为 old, 确保 3.0.16 能够解析低版本 pika 的同步数据, 如果配置文件中存在 slaveof 信息请注释, 其余配置不变
9. 关闭本机从库(/data/pika-demo), 使用 pika3.0.16 的 bin 文件启动新的 pika(/data/pika-new30/new_db)
10. 登录 pika3.0.16, 并与主库建立同步关系, 此时请打开之前保存的备份目录中的 info 文件, 该文件的第 4,5 行分别为 pika 备份时同步的位置信息, 需要将该信息加入 slaveof 命令进行增量同步(在执行命令之前要确保主库对应的 binlog 文件还存在)

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

11. 观察同步状态是否为 up, 确认同步正常后等待从库同步无延迟时该从库彻底升级完成, 此时可开始切主操作:

```
a.关闭从库的salve-read-only参数确保从库可写
b.程序端修改连接ip为从库地址, 将程序请求全部转向从库
c.在从库断开(slaveof no one)与主库的同步, 完成整个切主操作
```

12. 通过 config set 将 identify-binlog-type 配置为 new 并修改配置文件中该参数的值为 new, 如果 config set 报错那么意味着你忽略了上个步骤中的 c 步骤
13. 此时整个升级已完成, 你获得了一个单点的 pika3.0.16 实例, 若需补充从库, 你可新建一个新的空的 pika3.0.16 或更新版本的 pika 实例并通同 slaveof ip:port force 命令来非常简单的实现主从集群的创建, 该命令能够完整同步数据后自动转换为增量同步

## 注意事项：

- 由于 Pika3.0 的引擎在数据存储格式上做了重新的设计，新引擎比老引擎更加节省空间，所以升级完毕后，发现 Pika3.0 的 db 要比原来小这是正常的现象
- 在数据量比较大的情况下，使用 nemo_to_blackwidow 工具将 Nemo 格式的 db 转换成 blackwidow 格式的 db 可能花费的时间比较久，在转换的过程中可能主库当时 dump 时对应的位置的 binlog 会被清除掉，导致最后无法进行增量同步，所以在升级之前要将原先的主库的 binlog 生命周期设置得长一些(修改 expire-logs-days 和 expire-logs-nums 配置项)
- 由于我们在 pika3.0 的版本对 binlog 格式做了修改，为了兼容老的版本，我们提供了 identify-binlog-type 选项，这个选项只有 pika 身份为从库的时候生效，当 identify-binlog-type 选项值为 new 的时候，表示将主库发送过来的 binlog 按照新版本格式进行解析(pika3.0+), 当 identify-binlog-type 选项值为 old 的时候, 表示将主库发送过来的 binlog 按照老版本格式进行解析(pika2.3.3 ~ pika2.3.6)
- Pika3.0 对 Binlog 格式进行了更改，新版本的 Binlog 在记录更多数据的同时更加节省磁盘空间，所以在将 pika2.3.6 数据迁移到 pika3.0 过程当中判断主从同步是否无延迟时不要去对比主从各自的 binlog_offset，而是看 master 上的 Replication 项 slave 对应的 lag 是否接近于 0
