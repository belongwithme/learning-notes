---
title: Redis 学习路线
description: 从数据结构和线程模型，到持久化、高可用、缓存问题与分布式锁，按前置关系串起站内全部 Redis 笔记。
sidebar:
  order: 4
---

## 路线说明

- **目标读者**：用过 Redis 做缓存，会 `GET` / `SET`，但说不清它为什么快、宕机会丢多少数据、缓存出问题时该怎么兜底的后端开发者。
- **前置知识**：常见数据结构（哈希表、链表、跳表的概念），基本的网络 IO 模型，以及 [MySQL 学习路线](/learning-paths/mysql/) 里的事务概念会有帮助。
- **完成后的预期能力**：能根据数据量和访问模式选择数据类型；能说明 RDB、AOF 与主从、哨兵、集群各自解决什么问题；能为击穿、雪崩、穿透、大 key、热 key 设计应对方案，并正确实现分布式锁。

路线共 5 个阶段，前一阶段是后一阶段的前置。每个阶段末尾的「自测」先自己作答，再展开参考答案对照。每篇文章前的勾选框记录你读到哪里，只保存在当前浏览器。

## 阶段 1：上手与线程模型

1. [Redis 启动与命令行客户端](/knowledge/distributed-systems/redis-practice/redis简单操作-不定期更新-不包含理论知识/)：本地启动 Redis，用 `redis-cli` 跑通几条命令。
2. [Redis 线程模型](/knowledge/distributed-systems/redis-internals/redis-线程模型/)：单线程执行命令、IO 多路复用，以及 6.0 引入的多线程 IO。

**自测**：Redis 「单线程」指的是哪一部分？为什么单线程还能这么快？

<details>
<summary>参考答案</summary>

指执行命令的主流程是单线程的：接收请求、解析、读写数据、返回结果由一个线程完成。持久化、异步删除等由后台线程处理，6.0 以后网络读写也可以交给多个 IO 线程。

数据都在内存里，操作本身很快；用 IO 多路复用同时处理大量连接；单线程避免了加锁和线程切换。瓶颈通常在网络和内存，而不是 CPU。

</details>

## 阶段 2：数据结构

先看对外的五种对象，再往下看它们背后的底层编码。

1. [Redis 对象专辑](/knowledge/distributed-systems/redis-internals/redis-对象专辑/)：String、List、Hash、Set、ZSet 与它们的使用场景。
2. [链表与压缩列表](/knowledge/distributed-systems/redis-internals/redis数据结构总结-链表-and-压缩列表/)：压缩列表的紧凑布局与连锁更新问题。
3. [quickList](/knowledge/distributed-systems/redis-internals/redis数据结构总结-quicklist/)：用链表串起多个压缩列表。
4. [listPack](/knowledge/distributed-systems/redis-internals/redis数据结构总结-listpack/)：取代压缩列表、避免连锁更新。
5. [哈希表](/knowledge/distributed-systems/redis-internals/redis数据结构总结-哈希表/)：链式哈希与渐进式 rehash。
6. [整数集合](/knowledge/distributed-systems/redis-internals/redis数据结构总结-整数集合/)：小整数集合的紧凑存储与升级。
7. [跳表](/knowledge/distributed-systems/redis-internals/redis数据结构总结-跳表/)：ZSet 为什么用跳表而不是平衡树。
8. [有序集合 ZSet 深度解析](/knowledge/distributed-systems/redis-internals/redis-有序集合-zset-深度解析教程/)：补充，ZSet 的命令与实现全貌。
9. [列表结构实操](/knowledge/distributed-systems/redis-practice/redis-列表结构实操/)：补充，List 命令练习。

**自测**：渐进式 rehash 是怎么做的？ZSet 为什么同时用跳表和哈希表？

<details>
<summary>参考答案</summary>

哈希表扩容时同时保留新旧两张表，不一次性搬完，而是在每次增删改查时顺带把一个桶迁到新表（空闲时定时任务也会迁移一部分）。迁移期间查找先查旧表再查新表，新增只写新表。

跳表按分值有序，负责范围查询和排名；哈希表按成员存分值，让 `ZSCORE` 这类按成员查分值的操作是 O(1)。

</details>

## 阶段 3：持久化与高可用

1. [RDB](/knowledge/distributed-systems/redis-reliability/redis-rdb/)：内存快照、`bgsave` 与写时复制。
2. [AOF](/knowledge/distributed-systems/redis-reliability/redis-aof/)：命令日志、三种刷盘策略与 AOF 重写。
3. [主从架构](/knowledge/distributed-systems/redis-reliability/redis-主从架构/)：读写分离与主从拓扑。
4. [主从复制如何实现](/knowledge/distributed-systems/redis-reliability/redis-主从复制如何实现/)：全量同步、增量同步与复制积压缓冲区。
5. [哨兵](/knowledge/distributed-systems/redis-reliability/redis-哨兵/)：主观下线、客观下线与自动故障转移。
6. [切片集群](/knowledge/distributed-systems/redis-reliability/redis-切片集群/)：哈希槽与数据分片。

**自测**：`appendfsync everysec` 最多会丢多少数据？主从断线重连后，什么情况下只需要增量同步？

<details>
<summary>参考答案</summary>

大约 1 秒的写入：后台线程每秒执行一次 `fsync`，宕机时还在内核缓冲区里、没来得及刷盘的命令会丢失。

从库带着上次的复制偏移量重连，如果主库的复制积压缓冲区里还保留着这个偏移量之后的数据，就只发送缺失的部分；缓冲区已被覆盖则要全量同步。所以积压缓冲区要按断线时长和写入速度设大一些。

</details>

## 阶段 4：缓存实践与性能

1. [缓存过期和内存淘汰](/knowledge/distributed-systems/redis-practice/redis-缓存过期和内存淘汰/)：惰性删除加定期删除，以及八种淘汰策略。
2. [缓存并发问题：击穿、雪崩与穿透](/knowledge/distributed-systems/redis-practice/redis-缓存并发问题深度解析-击穿-雪崩与穿透防治指南/)：三种问题的成因与防治。
3. [缓存一致性问题](/knowledge/distributed-systems/consistency/缓存一致性问题/)：先更新数据库再删缓存，以及延迟双删。
4. [大 key](/knowledge/distributed-systems/redis-practice/redis-大key/)：如何发现与拆分。
5. [热 key](/knowledge/distributed-systems/redis-practice/redis-热key/)：本地缓存与多副本分散。
6. [事务](/knowledge/distributed-systems/redis-practice/redis-事务/)：`MULTI` / `EXEC` 不支持回滚，以及 Lua 脚本。
7. [用 Redis 实现购物车](/knowledge/distributed-systems/redis-practice/购物车功能设计与实现/)：补充，用 Hash 建模的小例子。

**自测**：击穿和雪崩的区别是什么，各用什么办法应对？为什么推荐「先更新数据库，再删除缓存」而不是更新缓存？

<details>
<summary>参考答案</summary>

击穿是某一个热点 key 过期的瞬间，大量请求同时打到数据库，常用互斥锁重建缓存或热点 key 不设过期；雪崩是大量 key 同时过期或 Redis 整体不可用，常用过期时间加随机值、多级缓存、限流降级和集群高可用。

两个并发写更新缓存的顺序可能和更新数据库的顺序不一致，留下脏数据；而且很多缓存值需要计算，写了也不一定有人读。删除缓存让下一次读请求从数据库重新加载。先删缓存再更新数据库，则可能在两步之间被读请求把旧值写回缓存。

</details>

## 阶段 5：秒杀与分布式锁

1. [秒杀场景](/knowledge/distributed-systems/redis-practice/redis-秒杀场景/)：库存预扣、Lua 原子操作与削峰。
2. [Redis 分布式锁](/knowledge/distributed-systems/consistency/redis-分布式锁/)：`SET NX PX`、安全释放、看门狗续期与 Redisson。
3. [并发更新导致的数据覆盖以及解决方案](/knowledge/distributed-systems/consistency/并发更新导致的数据覆盖以及解决方案/)：补充，锁之外的乐观锁和条件更新。

**自测**：释放锁时为什么要先比较 value 再删除，而且要用 Lua 脚本？锁过期了业务还没执行完怎么办？

<details>
<summary>参考答案</summary>

value 是加锁时生成的唯一标识。如果不比较，A 的锁过期后被 B 拿到，A 执行完会把 B 的锁删掉。比较和删除是两条命令，中间可能被打断，用 Lua 脚本才能保证原子执行。

用看门狗续期：持锁的客户端后台定时检查，业务还没结束就延长过期时间（Redisson 默认 30 秒锁，每 10 秒续一次）。客户端宕机后续期停止，锁仍会按时过期，不会死锁。

</details>
