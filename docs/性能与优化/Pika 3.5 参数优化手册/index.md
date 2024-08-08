---
title: Pika 3.5 参数优化手册
sidebar_position: 3
---
# Pika 3.5 参数优化手册 #1970

[AlexStocks](https://github.com/AlexStocks) started this conversation in [General](https://github.com/OpenAtomFoundation/pika/discussions/categories/general)

[Pika 3.5 参数优化手册](https://github.com/OpenAtomFoundation/pika/discussions/1970#top) #1970

 [![@AlexStocks](https://avatars.githubusercontent.com/u/7959374?s=40&v=4) AlexStocks](https://github.com/AlexStocks) 

Sep 11, 2023 · 1 comment

[Return to top](https://github.com/OpenAtomFoundation/pika/discussions/1970#top)

Discussion options

Quote reply

edited

## 

[![](https://avatars.githubusercontent.com/u/7959374?s=64&v=4)

AlexStocks

](https://github.com/AlexStocks)[Sep 11, 2023](https://github.com/OpenAtomFoundation/pika/discussions/1970#discussion-5614484)

Maintainer

\-

<table class="d-block" role="presentation" data-paste-markdown-skip=""><tbody class="d-block js-translation-source" data-target-translation-id="5614484" data-target-translation-type="discussion"><tr class="d-block"><td class="d-block color-fg-default comment-body markdown-body js-comment-body"><ul dir="auto"><li>1 不要使用压缩，snappy::internaluncompress 占用较高；</li><li>2 关闭 binlog；</li><li>3 调高 write-buffer-size；</li><li>4 Cluster 模式下把 slot 数目调整为 128，不要使用 1024；</li><li>5 调大 compaction 线程数目；</li><li>6 缓存使用场景下，可以动态关闭 WAL；</li></ul></td></tr></tbody></table>

Beta Was this translation helpful? [Give feedback.](https://github.com/OpenAtomFoundation/pika/discussions/1970#)

1 You must be logged in to vote

All reactions

## Replies: 1 comment

- [Oldest](https://github.com/OpenAtomFoundation/pika/discussions/1970?sort=old)
- [Newest](https://github.com/OpenAtomFoundation/pika/discussions/1970?sort=new)
- [Top](https://github.com/OpenAtomFoundation/pika/discussions/1970?sort=top)

Comment options

Quote reply

edited by Mixficsol

### 

[![](https://avatars.githubusercontent.com/u/7959374?s=64&v=4)

AlexStocks

](https://github.com/AlexStocks)[Oct 23, 2023](https://github.com/OpenAtomFoundation/pika/discussions/1970#discussioncomment-7357996)

Maintainer Author

\-

<table class="d-block" role="presentation" data-paste-markdown-skip=""><tbody class="d-block js-translation-source" data-target-translation-id="7357996" data-target-translation-type="comment"><tr class="d-block"><td class="d-block color-fg-default comment-body markdown-body js-comment-body"><p dir="auto">from <a class="issue-link js-issue-link" data-error-text="Failed to load title" data-id="1908090783" data-permission-text="Title is private" data-url="https://github.com/OpenAtomFoundation/pika/issues/2008" data-hovercard-type="issue" data-hovercard-url="/OpenAtomFoundation/pika/issues/2008/hovercard?comment_id=1775012080&amp;comment_type=issue_comment" href="https://github.com/OpenAtomFoundation/pika/issues/2008#issuecomment-1775012080">#2008 (comment)</a>:</p><p dir="auto">based on v3.5.1， you can optimize some parameters as follows.</p><p dir="auto">1 Adjust <code class="notranslate">max-background-flushes</code> and <code class="notranslate">max-background-compaction</code> to 4 to increase the number of threads for compaction and flushdb. Adjust max-background-jobs to 8.<br/>2 Adjust the <code class="notranslate">block-cache</code> to be 60% of the memory allocated to the Pika instance.<br/>3 Uncomment <code class="notranslate">share-block-cache</code> and set it to yes.<br/> Adjust <code class="notranslate">thread-num</code> to 80% of the CPU cores of the Pika instance.<br/>5 Adjust <code class="notranslate">thread-pool-size</code> to CPU cores * 1.5.<br/>6 Set <code class="notranslate">rate-limiter-bandwidth</code> to 2000Mib/s for gigabit Ethernet and 10000Mib/s for 10-gigabit Ethernet<p dir="auto">in Chinese:</p><ol dir="auto"><li><code class="notranslate">max-background-flushes</code> 和 <code class="notranslate">max-backgroud-compaction</code>可以调整到 4，提高 compaction 和 flushdb 的线程数， <code class="notranslate">max-backgroumd-jobs</code>调整到 8</li><li><code class="notranslate">block-cache</code>的大小可以调整为分给 Pika 实例内存的 60%</li><li><code class="notranslate">share-block-cache</code>解除注释，改为yes</li><li><code class="notranslate">thread-num</code>调整为 Pika 实例的 CPU 核数的 80%</li><li><code class="notranslate">thread-pool-size</code>调整为 CPU 核数 * 1.5</li><li><code class="notranslate">rate-limiter-bandwidth</code>：千兆网卡2000Mib/s 万兆网卡：10000Mib/s</li></ol></p></td></tr></tbody></table>