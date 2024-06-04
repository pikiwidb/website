---
title: Redis 与 Pika scan 性能对比
# author: --
# date: '2023-12-02'
---
Redis 是后端常用的键值数据库。Pika 是 360 出品的一款与 Redis 协议几乎兼容的数据库。与 Redis 不同的是，Pika 基于硬盘，使用 RocksDB 作为引擎，从容量上来说，比基于内存的 Redis 大了不少，而且在性能上也能满足一般需求。

我们知道，在 Redis 中，`keys *` 这个操作仅限于在本地调试使用，千万不能用于线上，因为这会 遍历整个数据库，可能引起数据库长时间无响应，甚至崩溃。在线上服务器，如果想要查找某个模式 的键，可以使用 scan 命令。比如说要查找 `user:` 前缀的所有键，可以使用 `scan 0 user:*` 命令。然而如果服务器上的键非常多的话，虽然不会卡死服务器了，但是这个过程依然会很漫长。

Redis 是使用 hash table 实现的，所以 scan 命令其实也是遍历所有键，拿到每个键再做过滤，而 不能直接读取符合对应 pattern 的键。我们使用下面的代码来验证一下 redis scan 的性能。

```
from redis import Redis
from uuid import uuid4
import time

def gen(r):
    for i in range(10000000):
        r.set(str(uuid4()), 1)
    r.set("user:1", "bar")

def scan(r):
    start = time.time()
    for key in r.scan_iter("user:*"):
        print("user=%s" % r.get(key).decode())
        duration = time.time() - start
        print("duration for finding user is %.3f" % duration)
    duration = time.time() - start
    print("duration for full scan is %.3f" % duration)

if __name__ == "__main__":
    import sys
    port = int(sys.argv[1])
    r = Redis(port=port)
    gen(r)
    scan(r)
```

首先插入一千万个随机数据，然后从中查找我们的目标数据。结果如下：

```
-> % python3 rb.py 6379
user=bar
duration for finding user is 80.145
duration for full scan is 180.936
```

和我们的预期基本是相符的，也就是说 Redis 是首先遍历然后再做过滤的。

接下来我们对 Pika 做相同的实验，Pika 默认使用 9221 端口，我们只需要把端口换一下就好了：

```
-> % python3 rb.py 9221
user=bar
duration for finding user is 0.002
duration for full scan is 0.003
```

结果是令人震惊的！Pika 几乎在瞬间就完成了遍历。原因在于 Pika 使用了 RocksDB，而 RocksDB 支持 Range 操作。RocksDB 中的数据都是有序的，所以查找起来就不需要 O(n) 了，只需要二分查找， 也就是 O(logN) 即可。