---
title: 数据迁移 QA
author: --
date: '2023-11-10'
---
# 数据迁移 QA #1983


<table class="d-block" role="presentation" data-paste-markdown-skip=""><tbody class="d-block js-translation-source" data-target-translation-id="5623547" data-target-translation-type="discussion"><tr class="d-block"><td class="d-block color-fg-default comment-body markdown-body js-comment-body"><ul dir="auto"><li><p dir="auto">Q：如何从 3.3.6 迁移数据到 3.5？</p></li><li><p dir="auto">A：假设有 3.3.6 实例 A，可进行如下操作：<br>* 1 在任意环境再启动一个新的 3.3.6 实例 B，通过运维操作让 B 变成 A 的 slave；<br>* 2 等 B 数据全量同步完毕，通过运维手段封禁 A 的写请求；<br>* 3 杀掉 B 进程；<br>* 4 在 B 进程环境把 3.3.6 Pika 二进制文件升级到 3.5 Pika，同时把 配置文件也升级到 3.5 版本的配置文件，启动该 3.5 版本的 Pika；<br>* 5 把上次的读写请求 redirect 引导到 3.5 版本的 B，对写请求解封。</p><p dir="auto">原因：主从3.3.6 通过rsync 实现全量同步，通过推模式实现增量同步。3.5.1 不使用 rsync 了，我们自己实现了全新的全量同步机制。增量同步从 master 到 slave 的推模式改为了 slave 到 master 的拉模式。</p></li></ul></td></tr></tbody></table>