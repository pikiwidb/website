---
title: Pub Sub使用
author: --
date: '2023-12-02'
---
# Pika Pub/Sub文档

可用版本： >= 2.3.0

注意: 暂不支持键空间通知功能

## [Pika 发布订阅命令](https://github.com/OpenAtomFoundation/pika/wiki/Pub-Sub%E4%BD%BF%E7%94%A8#pika-%E5%8F%91%E5%B8%83%E8%AE%A2%E9%98%85%E5%91%BD%E4%BB%A4)

##### [以下为Pub/Sub发布订阅命令, 与Redis完全兼容](https://github.com/OpenAtomFoundation/pika/wiki/Pub-Sub%E4%BD%BF%E7%94%A8#%E4%BB%A5%E4%B8%8B%E4%B8%BApubsub%E5%8F%91%E5%B8%83%E8%AE%A2%E9%98%85%E5%91%BD%E4%BB%A4-%E4%B8%8Eredis%E5%AE%8C%E5%85%A8%E5%85%BC%E5%AE%B9)

- PUBSUB subcommand \[argument \[argument ...\]\]
- PUBLISH channel message
- SUBSCRIBE channel \[channel ...\]
- PSUBSCRIBE pattern \[pattern ...\]
- UNSUBSCRIBE \[channel \[channel ...\]\]
- PUNSUBSCRIBE \[pattern \[pattern ...\]\]

#### 具体使用方法参考Redis的[Pub/Sub文档](http://redisdoc.com/topic/pubsub.html)