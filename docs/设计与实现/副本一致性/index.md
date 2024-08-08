---
title: "副本一致性"
sidebar_position: 6
---

## 目前线程模型

非一致性场景

1，客户端请求加锁写入 db 和 binlog 文件

2，将结果返回客户端

3，通过发送 BinlogSync 请求向从库同步

4，从库返回 BinlogSyncAck 报告同步状况

![](https://camo.githubusercontent.com/176a1e24eb8376f4a8e9021ac8b552d8f4c58e913ef6234c19e42d08a940fb37/68747470733a2f2f73312e617831782e636f6d2f323032302f30332f32372f47505666426a2e706e67)

一致性场景

1，客户端请求先写入 binlog 文件

2，通过发送 BinlogSync 请求向从库同步

3，从库返回 BinlogSyncAck 报告同步状况

4，将相应的请求写入 db

5，将结果返回客户端

![](https://camo.githubusercontent.com/af1f39adb0c4225c2774dff237b5e0f67df605df8e718caf0cb3beaa2a3ee2e3/68747470733a2f2f73312e617831782e636f6d2f323032302f30332f32372f475056494e712e706e67)

## Binlog Header 变动

```
/*
* *****************Type First Binlog Item Format******************
* |<Type>|<CreateTime>|<Term Id>|<Logic Id>|<File Num>|<Offset>|<Content Length>|<Content>|
* |  2   |      4     |    4    |     8    |    4     |   8    |       4        |   ...   |
* |----------------------------------------- 34 Bytes ------------------------------------|
*/
```

其中 TermId, 和 Logic id 是沿用[Raft](https://raft.github.io/raft.pdf)论文中 term 和 log index 的概念。具体的详见论文。

其中 File Num 和 offset 是本条 binlog 在文件中的偏移量。

Pika 的 Binlog 存在的意义是为了保证主从能够增量同步，而 Raft Log 存在的意义是为了保证 Leader 和 Follower 的数据够一致。某种意义上说这两个"Log"的概念是一样的，所以在实现上，将 binlog 和 Raft Log 复用成一条 log，目前的 binlog header 中 Term Id 和 Logic Id 属于 Raft Log（简称日志）的信息，而 File Num 和 Offset 属于 Binlog 的信息。

## 一致性协议的三阶段

日志恢复和复制基本按照 Raft 论文当中所做操作，这里不做过多解释。实现上，这里分为三个阶段。分别是日志的复制，日志的恢复，日志的协商。

熟悉 Raft 协议的读者可能会发现，这里的三个阶段跟 Raft 日志复制不是完全一样。在 Pika 的实现当中，基于 pika 现有的代码结构，我们把 Leader 和 Follower 同步点位回退的逻辑单独提取出来，形成了 Pika Trsysync 的状态。任何日志的复制出错，pika 会终止当前的日志复制（BinlogSync）状态，转而将状态机转化成 Trysync 的状态，进而 Leader 和 Follower 会进入日志的协商逻辑。协商成功之后会转入日志复制的逻辑。

![](https://camo.githubusercontent.com/6be0f7496a5ea6cde8f6a7adfbb33b1734c757774e8933b085a78087992c13ac/68747470733a2f2f73312e617831782e636f6d2f323032302f30332f32372f4750566c37522e706e67)

## 日志复制

日志的逻辑结构如下，上面部分是 Leader 可能的 log 点位，下部分是 Follower 可能的 log 点位。

![](https://camo.githubusercontent.com/a6697bf289c4d88e342498320e5e1a34057d5e8f8264d11deee696753489175b/68747470733a2f2f73312e617831782e636f6d2f323032302f30332f32372f4750564833542e706e67)

1，日志的复制的逻辑可以参考 Raft 协议的逻辑，这里举例说说明客户端从请求到返回，日志经过了怎样的流程。

Leader Status:

Committed Index : 10

Applied Index：8

Last Index: 15

Follower Status:

Committed Index : 7

Applied Index：5

LastIndex: 12

2，当 Leader 发送 13-15 的日志到 Follower 的时候，Follower 的状态会做如下更新：

Follower Status:

Committed Index : 10

Applied Index：5

LastIndex: 15

这时候日志 6-10 都是可以被应用到状态机的。但是对于日志 11-15 来说只能等到下一次收到 Leader Committed Index 大于 15 的时候这些日志才能够被更新，这时候如果客户端没有继续写入，Follower 的 Committed index 可以依靠 ping 消息（携带了 Leader 的 committed index）进行更新。

3，当 Leader 接收到 Follower 的 ack 信息的时候，Leader 状态会做如下更新：

Leader Status:

Committed Index : 15

Applied Index: 8

Last Index: 15

此时日志 9-15 都是可以被应用到状态机，这里是写 db，当日志 9 写入 db 之后，就会返回客户端，相应的 Applied Index 更新为 9。这时候日志 9 就可以返回客户端。

对于从来说，整体的日志复制的逻辑还是按照 Raft 论文当中进行的。唯一不同的是论文中日志回退的一部分逻辑放到了日志协商阶段进行。

## 日志恢复：

重启 pika 的时候，根据持久话的一致性信息（applied index 等）回复出之前的一致性状态。

## 日志协商：

这个阶段 Follower 节点主动发起 Trysync 流程，携带 Last Index，向 Leader 发送协商同步点位请求。协商过程如下：

Follower 携带 last_index 发动到 Leader， Leader 通过 Follower 的 last_index 位置判断是否自己能够找到 last_index 对应的自己的相应的 log，如果找到 log 并且两个 log 一致，Leader 返回 okay 协商结束。如果没有找到，或者 log 不一致，Leader 向 Follower 发送 hints，hints 是 Leader 本地的最新的日志。Follower 通过 hints，回退本地日志，更新自己的 last_index，重新向主协商。最终 Leader Follower 达成一致，结束 TrySync 流程，进行日志复制流程。

![](https://camo.githubusercontent.com/57d198f5c7bd858af0981cdd6d55d0924a790099b451354dd2b2f45beaffc629/68747470733a2f2f73312e617831782e636f6d2f323032302f30332f32372f4750566267552e706e67)

Leader 日志协商的伪代码如下：

```c
Status LeaderNegotiate() {
  reject = true
  if (follower.last_index > last_index) {
    send[last_index - 100, last_index]
  } else if (follower.last_index < first_index) {
    need dbsync
  }
  if (follower.last_index not found) {
    need dbsync
  }
  if (follower.last_index found but term not equal) {
    send[found_index - 100, found_index]
  }
  reject = false
  return ok;
}
```

Follower 日志协商的伪代码日下：

```c
Status FollowerNegotiate() {
  if last_index > hints[hints.size() - 1] {
    TruncateTo(hints[hints.size() - 1]);
  }
  for (reverse loop hints) {
    if (hint.index exist && hint.term == term) {
      TruncateTo(hint.index)
      send trysync with log_index = hint.index
      return ok;
    }
  }
  // cant find any match
  TruncateTo(hints[0])
  send trysync with log_index = last_index
}
```

以上介绍了关于日志的具体三个阶段。整体的逻辑遵从与 Raft 论文的设计，在实现细节上根据 Pika 目前的代码结构进行了一些列的调整。

## 关于选主和成员变换

目前选主需要管理员手动介入，详见[副本一致性使用文档](https://github.com/Qihoo360/pika/wiki/%E5%89%AF%E6%9C%AC%E4%B8%80%E8%87%B4%E6%80%A7%E4%BD%BF%E7%94%A8%E6%96%87%E6%A1%A3) 。

成员变换的功能目前暂不支持。