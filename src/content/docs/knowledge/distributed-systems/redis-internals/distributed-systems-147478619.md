---
title: "Redis 有序集合 ZSet 深度解析教程"
description: "有序集合（Sorted Set，简称 ZSet）是一种非常强大且常用的数据结构。它既像集合（Set）一样保证成员（member）的唯一性，又允许为每个成员关联一个分数（score），并能根据分数对成员进行高效排序。"
sourceId: "147478619"
source: "https://blog.csdn.net/qq_45852626/article/details/147478619"
sourceSeries:
  - "Redis"
category: distributed-systems
subcategory: redis-internals
tags:
  - "Redis"
status: draft
difficulty: advanced
contentType: knowledge
sidebar:
  order: 147478619
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/147478619)（历史文章导入，当前状态为草稿）

#### Redis-ZSet
### 引言

有序集合（Sorted Set，简称 ZSet）是一种非常强大且常用的数据结构。它既像集合（Set）一样保证成员（member）的唯一性，又允许为每个成员关联一个分数（score），并能根据分数对成员进行高效排序。

### 一、 ZSet 核心概念与特性

#### 1.1 什么是 ZSet？

ZSet 是 Redis 提供的一种**有序集合**数据结构。你可以把它想象成一个集合，但这个集合里的每个元素（我们称之为**成员 member**）都额外绑定了一个浮点数
类 
型的**分数 score**。ZSet 最重要的特性就是它会**根据 score 对 member 进行排序**。

**核心特性总结：**

1. **成员唯一性 (Member Uniqueness):** 和普通的 Set 一样，ZSet 中的 member 是唯一的，不允许重复。如果你尝试添加一个已经存在的 member，只会更新它的 score。
2. **分数关联 (Score Association):** 每个 member 都必须关联一个 score。这个 score 是一个浮点数，可以是正数、负数、零，甚至是 `+inf` (正无穷) 或 `-inf` (负无穷)。**score 可以重复**，即不同的 member 可以有相同的 score。
3. **有序性 (Ordered):** ZSet 内部的元素是根据 score **从小到大**排序的。如果 score 相同，则按照 member 的**字典序 (lexicographical order)** 进行排序（具体取决于 Redis 版本和配置，但通常是这样）。
4. **高效操作:** ZSet 提供了一系列高效的操作，比如添加/删除成员、更新分数、根据分数范围获取成员、根据成员获取排名/分数等。

#### 1.2 ZSet 与 Set、List 的本质区别

为了更好地理解 ZSet，我们将其与 Redis 中另外两种常用的集合类型 Set 和 List 进行比较：

| 特性 | ZSet (有序集合) | Set (集合) | List (列表) |
| --- | --- | --- | --- |
| **存储内容** | 唯一的 member + 关联的 score | 唯一的 member | member (可重复) |
| **有序性** | **根据 score 排序** (score 相同按字典序) | **无序** | **按插入顺序排序** |
| **成员唯一** | 是 | 是 | 否 |
| **核心优势** | 高效的排序、范围查找、排名计算 | 快速判断成员是否存在、去重 | 按顺序存取、模拟栈/队列 |
| **典型命令** | `ZADD`, `ZRANGE`, `ZRANK`, `ZRANGEBYSCORE` | `SADD`, `SISMEMBER`, `SMEMBERS` | `LPUSH`, `RPOP`, `LRANGE` |

**总结来说：**

* 如果你只需要存储唯一的值，不关心顺序，用 `Set`。
* 如果你需要按照元素添加的顺序存储，并且允许重复，用 `List`。
* 如果你需要存储唯一的元素，并且希望能够根据某个权重（分数）进行排序和范围查找，那么 `ZSet` 是不二之选。

---

### 二、 ZSet 典型应用场景

ZSet 的有序性和高效范围查询能力使其在众多业务场景中大放异彩。以下是一些常见的应用示例：

#### 2.1 排行榜 (Leaderboards)

这是 ZSet 最经典的应用场景之一。例如：

* 游戏积分排行榜：member 是玩家 ID，score 是玩家积分。
* 用户贡献排行榜：member 是用户 ID，score 是贡献值（如发帖数、获赞数）。
* 商品销量排行榜：member 是商品 ID，score 是销量或销售额。

**如何实现：**

1. **添加/更新用户积分：** 使用 `ZADD` 命令。如果用户已存在，则更新其分数；如果不存在，则添加。

   ```
   # 添加或更新玩家 Alice 的积分为 1500
   ZADD game:leaderboard 1500 Alice
   # 添加或更新玩家 Bob 的积分为 2000
   ZADD game:leaderboard 2000 Bob
   # 使用 NX 选项，仅当 Bob 不存在时才添加 (这里不会成功，因为 Bob 已存在)
   ZADD game:leaderboard NX 2100 Bob
   # 使用 XX 选项，仅当 Alice 存在时才更新 (会成功)
   ZADD game:leaderboard XX 1600 Alice
   # 使用 INCR 选项，给 Alice 增加 100 分 (变为 1700)
   ZADD game:leaderboard INCR 100 Alice


   ```
2. **获取排名前 N 的用户：** 使用 `ZREVRANGE` (按分数从高到低排序)。

   ```
   # 获取积分榜前 3 名的玩家及其分数
   ZREVRANGE game:leaderboard 0 2 WITHSCORES
   # 输出可能类似：1) "Bob" 2) "2000" 3) "Alice" 4) "1700"


   ```
3. **获取用户排名：** 使用 `ZREVRANK` (从高到低排名，0 是第一名) 或 `ZRANK` (从低到高排名)。

   ```
   # 获取 Alice 的排名 (从高到低)
   ZREVRANK game:leaderboard Alice
   # 输出可能类似：1 (表示第二名，因为 Bob 是 0)


   ```
4. **获取用户分数：** 使用 `ZSCORE`。

   ```
   # 获取 Bob 的分数
   ZSCORE game:leaderboard Bob
   # 输出: "2000"


   ```
5. **获取指定分数范围内的用户：** 使用 `ZRANGEBYSCORE` 或 `ZREVRANGEBYSCORE`。

   ```
   # 获取分数在 1500 到 1800 之间的玩家 (包含边界)
   ZRANGEBYSCORE game:leaderboard 1500 1800 WITHSCORES
   # 输出可能类似：1) "Alice" 2) "1700"


   ```

#### 2.2 带权重的任务队列 / 延迟队列

有时我们需要处理一些带有优先级的任务，或者需要在未来的某个特定时间点执行的任务。ZSet 可以很好地模拟这种场景。

* **member:** 任务的唯一标识符 (如任务 ID)。
* **score:**
  + **优先级:** 分数越小（或越大，取决于业务定义）表示优先级越高。
  + **执行时间:** 分数存储任务应该被执行的 Unix 时间戳。

**如何实现：**

1. **添加任务：**

   ```
   # 添加一个优先级为 10 (数值越小优先级越高) 的任务 task:1
   ZADD priority_queue 10 task:1
   # 添加一个需要在未来时间戳 1678886400 执行的任务 task:2
   ZADD delayed_queue 1678886400 task:2


   ```
2. **获取优先级最高的任务：** 使用 `ZRANGE` (取出分数最低的) 或 `ZREVRANGE` (取出分数最高的)。通常我们会结合 `LIMIT` 取出若干个。

   ```
   # 取出优先级最高的 1 个任务 (分数最低)
   ZRANGE priority_queue 0 0
   # 输出: 1) "task:1"


   ```
3. **获取到期需要执行的任务：** 使用 `ZRANGEBYSCORE` 获取所有 score 小于等于当前时间戳的任务。

   ```
   # 假设当前时间戳是 1678886405
   # 取出所有 score 在 -inf 到 1678886405 之间的任务
   ZRANGEBYSCORE delayed_queue -inf 1678886405 WITHSCORES
   # 输出可能类似: 1) "task:2" 2) "1678886400"


   ```
4. **处理并移除任务：** 获取到任务后，需要使用 `ZREM` 将其从队列中移除，防止重复处理。这是一个**关键步骤**，为了保证原子性（获取并删除），通常会结合 Lua 脚本来实现。

   ```
   -- Lua 脚本示例：原子地获取并删除优先级最高的任务
   local key = KEYS[1]
   local tasks = redis.call('ZRANGE', key, 0, 0) -- 获取分数最低的任务
   if #tasks > 0 then
       redis.call('ZREM', key, tasks[1]) -- 如果存在则删除
       return tasks[1] -- 返回任务 ID
   else
       return nil -- 没有任务
   end


   ```

   或者使用 Redis 5.0+ 提供的阻塞弹出命令 `BZPOPMIN` 或 `BZPOPMAX`，它们能原子地完成“获取并删除”操作，并且在队列为空时阻塞等待。

   ```
   # 阻塞等待，直到获取并删除 delayed_queue 中分数最低的任务，超时时间 60 秒
   BZPOPMIN delayed_queue 60
   # 输出类似: 1) "delayed_queue" 2) "task:2" 3) "1678886400.0"


   ```

#### 2.3 时间轴 (Timeline)

在社交应用中，用户的 F`eed` 流（时间轴）通常需要展示关注的人发布的最新内容。

* **member:** 内容的唯一 ID (如帖子 ID)。
* **score:** 内容的发布时间戳。

**如何实现：**

1. **发布内容时添加到关注者的 Timeline ZSet：**

   ```
   # 用户 UserA 发布了帖子 PostX (时间戳 1678887000)
   # 将 PostX 添加到关注者 Follower1 和 Follower2 的 Timeline ZSet
   ZADD timeline:Follower1 1678887000 PostX
   ZADD timeline:Follower2 1678887000 PostX


   ```
2. **用户拉取最新内容：** 使用 `ZREVRANGE` 按时间戳倒序获取最新的 N 条内容 ID。

   ```
   # Follower1 拉取最新的 10 条内容 ID
   ZREVRANGE timeline:Follower1 0 9


   ```

   拿到内容 ID 后，再根据 ID 去获取内容的具体信息（通常存储在 Hash 或 String 中）。

#### 2.4 范围查找

根据某个数值范围进行查找，例如：

* 查找价格在 100 到 200 元之间的商品。
* 查找年龄在 18 到 25 岁之间的用户。
* 查找距离某个点特定范围内的地点（结合 GeoHash）。

**如何实现：**

使用 `ZRANGEBYSCORE` 或 `ZREVRANGEBYSCORE`。

```
# 假设有一个 ZSet 存储商品价格: member 是商品 ID, score 是价格
ZADD product_prices 150 product:1 99.9 product:2 210 product:3 180 product:4

# 查找价格在 100 到 200 (包含边界) 之间的商品
ZRANGEBYSCORE product_prices 100 200 WITHSCORES
# 输出: 1) "product:1" 2) "150" 3) "product:4" 4) "180"

# 查找价格在 (100, 200] 之间的商品 (不包含 100)
ZRANGEBYSCORE product_prices (100 200 WITHSCORES


```

---

### 三、 ZSet 底层实现

为了实现高效的排序和查找，Redis ZSet 的底层实现会根据存储数据的规模动态选择不同的编码方式。主要有两种：`ziplist` 和 `skiplist` + `dict`。

#### 3.1 ziplist (压缩列表)

**触发条件：**

当 ZSet 同时满足以下两个条件时，会优先采用 `ziplist` 编码：

1. ZSet 中元素的数量小于 `zset_max_ziplist_entries` 配置的值（默认 128）。
2. ZSet 中每个元素（member 和 score）的字节长度都小于 `zset_max_ziplist_value` 配置的值（默认 64）。

**结构与原理：**

ziplist 是一种设计非常紧凑的**连续内存**数据结构，旨在尽可能地节省内存。它不像普通的数组那样每个元素占用固定大小的空间，而是根据实际内容动态调整每个节点的长度。

一个 ziplist 的大致结构如下：

```
<zlbytes> <zltail> <zllen> <entry1> <entry2> ... <entryN> <zlend>


```

* `zlbytes`: (4 字节) 记录整个 ziplist 占用的总字节数。
* `zltail`: (4 字节) 记录到最后一个 entry 的偏移量，用于快速定位表尾。
* `zllen`: (2 字节) 记录 ziplist 中的 entry 数量。当数量超过 65535 时，该字段固定为 65535，需要遍历才能确定实际数量。
* `entryX`: 实际存储数据的节点。每个 entry 包含前一个 entry 的长度信息（用于反向遍历）和当前 entry 的编码及内容。member 和 score 在 ziplist 中是**紧邻存储**的两个 entry。
* `zlend`: (1 字节) 特殊标记，值为 `0xFF`，表示 ziplist 的末尾。

**entry 的结构（重点）：**

```
<prevrawlen> <encoding> <content>


```

* `prevrawlen`: 记录**前一个 entry** 的总长度。这个字段的长度本身是可变的（1字节或5字节），用于支持从后向前遍历 ziplist。
* `encoding`: 记录当前 `content` 的编码方式（字符串还是整数）以及长度。
* `content`: 实际存储的数据（member 或 score）。score 会被存储为字符串形式。

**ziplist 如何存储 ZSet 元素：**

在 ziplist 中，一个 ZSet 元素由两个相邻的 entry 表示：第一个 entry 存储 member，第二个 entry 存储 score。它们是成对出现的。

**源码片段 (`ziplist.c` 附近，概念性展示，非精确代码):**

```
// 概念性展示 ziplist entry 结构
typedef struct zlentry {
    unsigned int prevrawlensize; // 存储前一个节点长度所需的字节数 (1 或 5)
    unsigned int prevrawlen;     // 前一个节点的长度
    unsigned int lensize;        // 存储当前节点 content 长度或类型所需的字节数
    unsigned int len;            // 当前节点 content 的长度
    unsigned int headersize;     // 当前节点头部 (prevrawlen + encoding) 的总大小
    unsigned char encoding;      // 编码类型
    unsigned char *p;            // 指向当前节点数据的指针 (content)
} zlentry;

// 在 ziplist 中查找元素大致需要遍历比较
// 插入或删除可能引起连锁更新


```

**优点：**

* **内存效率高:** 连续存储，没有指针开销（相比链表），节点长度可变，非常节省内存。

**缺点：**

* **查找效率较低:** 查找特定 member 或 score 需要遍历 ziplist，时间复杂度为 O(N)，N 是元素数量。范围查找效率也不高。
* **连锁更新 (Cascade Update):** 这是 ziplist 最大的问题。当插入或删除一个 entry 时，如果导致后续 entry 的 `prevrawlen` 字段长度发生变化（比如从 1 字节变成 5 字节），就可能需要调整后续所有 entry 的位置，引发连锁反应，导致操作的时间复杂度在最坏情况下变为 O(N^2)。更新操作也可能触发。

#### 3.2 skiplist (跳跃表) + dict (哈希表)

**触发条件：**

当 ZSet 不再满足 `ziplist` 的编码条件时（即元素数量超过 `zset_max_ziplist_entries` 或任一元素的长度超过 `zset_max_ziplist_value`），Redis 会自动将其编码转换为 `skiplist` + `dict`。**注意：这个转换是单向的，一旦变成 skiplist，即使后来元素减少，也不会自动转回 ziplist。**

**结构与原理：**

这种编码方式结合了跳跃表 (skiplist) 和哈希表 (dict) 的优点：

* **dict (哈希表):** 用于存储从 `member` 到 `score` 的映射。这使得通过 member 快速查找其对应的 score (如 `ZSCORE` 命令) 的平均时间复杂度达到 **O(1)**。
* **skiplist (跳跃表):** 用于存储所有 ZSet 元素，并按照 `score` 进行排序。跳跃表是一种通过**多层有序链表**实现高效查找、插入、删除的数据结构，其操作的平均时间复杂度为 **O(log N)**，最坏情况下为 O(N)。它特别擅长进行范围查找（如 `ZRANGE`, `ZRANGEBYSCORE`）。

**为什么需要两者结合？**

* 如果只用 `dict`，无法高效地按 score 排序和范围查找。
* 如果只用 `skiplist`，虽然也能通过 member 找到 score（遍历 skiplist），但平均时间复杂度是 O(log N)，不如 `dict` 的 O(1) 高效。`ZSCORE` 是常用操作，效率很重要。

两者结合，可以在 O(1) 时间内通过 member 获取 score，同时在 O(log N) 时间内完成基于 score 的排序、排名和范围查找。

**skiplist (跳跃表) 详解 (重点和难点)：**

跳跃表是一种概率性数据结构，它在有序链表的基础上增加了额外的“快速通道”（前向指针），从而实现类似二分查找的效率。

**结构：**

一个跳跃表包含：

* `header`: 头节点，不存储实际数据，但包含指向各层链表头部的指针。
* `tail`: 指向跳跃表尾节点的指针。
* `length`: 跳跃表中节点的数量。
* `level`: 跳跃表中当前最高的层数。

每个跳跃表节点 (`zskiplistNode`) 包含：

* `member (ele)`: ZSet 的成员。
* `score`: ZSet 的分数。
* `backward`: 指向**前一个**节点的指针（用于反向遍历，如 `ZREVRANGE`）。
* `level[]`: 一个柔性数组（flexible array member），存储该节点在**每一层**的**前向指针 (forward)** 和**跨度 (span)**。
  + `forward`: 指向该层链表中下一个节点的指针。
  + `span`: 表示当前节点的 `forward` 指针指向的节点与当前节点之间**跨越了多少个节点**。span 对于快速计算排名 (`ZRANK`) 至关重要。

**图解 skiplist：**

```
          header                                                     tail
level 3:   head ->-------------------------------------------------> NULL
level 2:   head ->------------------------> node E -----------------> NULL
level 1:   head ->--------> node B ------> node E ->-----> node G --> NULL
level 0:   head --> node A -> node B -> node C -> node E -> node F -> node G -> NULL
(score)            (10)      (20)      (30)      (50)      (60)      (70)

(span)
level 3:            span=7
level 2:            span=4                   span=3
level 1:            span=2        span=2               span=2
level 0:            span=1        span=1     span=1    span=1     span=1     span=1


```

* 第 0 层包含所有节点，是一个标准的有序链表。
* 更高层级的链表是第 0 层的“快速通道”，它们只包含部分节点。
* 一个节点会出现在多少层（除了第 0 层）是**随机决定**的，但层数越高的概率越低（通常是 P=1/4 或 1/2）。这种随机性保证了跳跃表在插入、删除、查找操作上的平均时间复杂度为 O(log N)。
* `span` 表示从当前节点沿着该层的 `forward` 指针跳到下一个节点，中间跳过了多少个底层节点。例如，在 level 2，header 的 `forward` 指向 node E，`span` 为 4，表示从 header 到 node E 之间有 4 个节点 (A, B, C, E)。

**查找过程 (例如查找 score=50 的节点 E):**

1. 从最高层 (level 3) 的 header 开始。`forward` 指向 NULL，比 50 大。
2. 下降到 level 2。header 的 `forward` 指向 node E (score 50)。找到目标。

**查找过程 (例如查找 score=65 的节点，它不存在):**

1. 从最高层 (level 3) 的 header 开始。`forward` 指向 NULL，比 65 大。
2. 下降到 level 2。header 的 `forward` 指向 node E (50)，比 65 小。沿着 level 2 的 `forward` 到达 node E。node E 在 level 2 的 `forward` 指向 NULL，比 65 大。
3. 下降到 level 1。node E 的 `forward` 指向 node G (70)，比 65 大。
4. 下降到 level 0。node E 的 `forward` 指向 node F (60)，比 65 小。沿着 level 0 的 `forward` 到达 node F。node F 的 `forward` 指向 node G (70)，比 65 大。
5. 此时，我们位于 node F，并且下一节点 score (70) 大于目标 (65)。查找结束，目标不存在。插入位置应该在 F 和 G 之间。

**计算排名 (`ZRANK`，例如计算 node E 的排名):**

1. 从最高层开始查找，累加跨过的 `span` 值。
2. Level 3: header -> NULL。不前进。rank=0。
3. Level 2: header -> node E。前进了，累加 header 在 level 2 的 `span` (假设为 4)。rank = 4。找到目标。
4. 排名是 rank - 1 (因为排名从 0 开始)，所以 node E 的排名是 3。

**源码片段 (`server.h`, `t_zset.c` 附近，结构定义和关键操作)：**

```
/* server.h */
#define ZSKIPLIST_MAXLEVEL 32 /* 跳跃表最大层数 */
#define ZSKIPLIST_P 0.25      /* 用于计算随机层数的概率 */

/* 跳跃表节点 */
typedef struct zskiplistNode {
    sds ele; // 成员 (member)
    double score; // 分数
    struct zskiplistNode *backward; // 后向指针
    // 层级数组，包含前向指针和跨度
    struct zskiplistLevel {
        struct zskiplistNode *forward; // 前向指针
        unsigned long span; // 跨度
    } level[]; // 柔性数组
} zskiplistNode;

/* 跳跃表 */
typedef struct zskiplist {
    struct zskiplistNode *header, *tail; // 头尾节点指针
    unsigned long length; // 节点数量
    int level; // 当前最大层数
} zskiplist;

/* ZSet 结构 */
typedef struct zset {
    dict *dict; // 哈希表，member -> score
    zskiplist *zsl; // 跳跃表，按 score 排序
} zset;

/* t_zset.c - zslInsert: 插入新节点到跳跃表 */
zskiplistNode *zslInsert(zskiplist *zsl, double score, sds ele) {
    zskiplistNode *update[ZSKIPLIST_MAXLEVEL]; // 记录每层查找路径上需要更新 forward 指针的节点
    unsigned int rank[ZSKIPLIST_MAXLEVEL]; // 记录每层查找到的位置的排名 (用于计算 span)
    zskiplistNode *x;
    int i, level;

    // 1. 查找插入位置，并记录路径 (update 数组) 和排名 (rank 数组)
    x = zsl->header;
    for (i = zsl->level-1; i >= 0; i--) {
        rank[i] = (i == zsl->level-1) ? 0 : rank[i+1]; // 初始化排名
        // 在当前层向右查找，直到找到第一个 score 更大或 ele 字典序更大的节点
        while (x->level[i].forward &&
                (x->level[i].forward->score < score ||
                    (x->level[i].forward->score == score &&
                     sdscmp(x->level[i].forward->ele,ele) < 0))) // 如果分数相同，比较成员字典序
        {
            rank[i] += x->level[i].span; // 累加跨度到排名
            x = x->level[i].forward; // 前进
        }
        update[i] = x; // 记录该层需要更新 forward 指针的节点
    }

    // 2. 计算新节点的随机层数
    level = zslRandomLevel(); // 根据概率 P 计算一个随机层数

    // 3. 如果新层数高于当前跳跃表最大层数，初始化 update 和 rank 数组中新层的数据
    if (level > zsl->level) {
        for (i = zsl->level; i < level; i++) {
            rank[i] = 0;
            update[i] = zsl->header;
            update[i]->level[i].span = zsl->length; // 新层的 header span 为当前总长度
        }
        zsl->level = level; // 更新跳跃表最大层数
    }

    // 4. 创建新节点
    x = zslCreateNode(level,score,ele); // 分配内存并初始化新节点

    // 5. 更新每一层的 forward 指针和 span
    for (i = 0; i < level; i++) {
        // 将新节点插入到 update[i] 和原 update[i]->level[i].forward 之间
        x->level[i].forward = update[i]->level[i].forward;
        update[i]->level[i].forward = x;

        // 更新 span 值
        // 新节点的 span = 原 update[i] 的 span - (新节点之前经过的节点数 rank[0] - update[i] 之前的节点数 rank[i])
        x->level[i].span = update[i]->level[i].span - (rank[0] - rank[i]);
        // update[i] 的 span = (新节点之前经过的节点数 rank[0] - update[i] 之前的节点数 rank[i]) + 1 (新节点本身)
        update[i]->level[i].span = (rank[0] - rank[i]) + 1;
    }

    // 6. 如果新节点的层数低于原跳跃表最大层数，更新未涉及层级的 span (加 1，因为多了一个节点)
    for (i = level; i < zsl->level; i++) {
        update[i]->level[i].span++;
    }

    // 7. 更新新节点的 backward 指针
    x->backward = (update[0] == zsl->header) ? NULL : update[0];
    if (x->level[0].forward)
        x->level[0].forward->backward = x; // 更新后继节点的 backward 指针
    else
        zsl->tail = x; // 如果新节点是最后一个节点，更新 tail 指针

    // 8. 更新跳跃表长度
    zsl->length++;
    return x;
}


```

**优点：**

* **高效的查找、插入、删除:** 平均时间复杂度为 O(log N)。
* **高效的范围查询:** 按 score 范围查找非常快。
* **高效的排名计算:** 利用 `span` 可以在 O(log N) 内计算排名。

**缺点：**

* **内存开销相对较大:** 相较于 ziplist，需要存储额外的指针 (`forward`, `backward`) 和 `span` 信息，内存占用更多。

#### 3.3 编码转换

* **ziplist -> skiplist:** 当 ZSet 不再满足 ziplist 的两个条件（元素数量或大小超限）时，Redis 会自动执行转换。这个过程需要创建新的 `dict` 和 `skiplist`，并将 `ziplist` 中的所有元素逐一添加到新的数据结构中。这是一个一次性的、相对耗时的操作，会消耗额外的 CPU 和内存。但转换完成后，后续操作将受益于 `skiplist` 的高效率。
* **skiplist -> ziplist:** Redis **不会**自动执行此转换。即使 ZSet 的元素数量和大小降回 `ziplist` 的阈值以下，它仍然会保持 `skiplist` 编码。

你可以使用 `OBJECT ENCODING key` 命令查看一个 ZSet 当前使用的底层编码。

---

### 四、 ZSet 常用命令详解

下面我们详细介绍 ZSet 的常用命令，包括其功能、参数、返回值、时间复杂度和示例。时间复杂度会根据底层编码（ziplist 或 skiplist）有所不同。

**复杂度说明：**

* N: ZSet 中的元素数量。
* M: 被操作的元素数量。
* LogN: 通常指 log base 2 of N。

#### 4.1 添加与更新

* **`ZADD key [NX|XX] [CH] [INCR] score member [score member ...]`**

  + **功能:** 向有序集合添加一个或多个成员，或者更新已存在成员的分数。
  + **参数:**
    - `NX`: 仅当成员不存在时才添加。不更新已存在的成员。
    - `XX`: 仅当成员存在时才更新。不添加新成员。
    - `CH`: (Changed) 返回值从“新添加成员的数量”变为“被修改成员的总数”（包括添加和更新）。
    - `INCR`: 将命令模式从“添加/更新”变为“增加分数”。此时只能指定一对 `score member`，`score` 表示要增加的值（可以是负数）。如果 member 不存在，则添加它，score 为指定的增量值。
  + **返回值:** 默认情况下，返回新添加到集合中的成员数量（不包括分数被更新的成员）。如果使用了 `CH` 选项，返回被修改（添加或更新）的成员总数。如果使用了 `INCR` 选项，返回成员的新分数（字符串形式）。
  + **复杂度:**
    - 添加单个元素：O(log N) (skiplist) / 平均 O(log N)，最坏 O(N^2) 因连锁更新 (ziplist)
    - 添加多个元素：O(M \* log N) (skiplist) / 平均 O(M \* log N)，最坏 O(N\*M) 或 O(N^2) (ziplist)
  + **示例:** (见应用场景部分)
* **`ZINCRBY key increment member`**

  + **功能:** 为有序集合中指定成员的分数增加 `increment`。如果成员不存在，则添加它，分数等于 `increment`。相当于 `ZADD key INCR increment member`。
  + **参数:**
    - `increment`: 要增加的分数值（浮点数）。
    - `member`: 要操作的成员。
  + **返回值:** 成员的新分数（字符串形式）。
  + **复杂度:** O(log N) (skiplist) / 平均 O(log N)，最坏 O(N^2) (ziplist)
  + **示例:**

    ```
    ZADD scores 10 user1
    ZINCRBY scores 5 user1  # user1 的分数变为 15
    # 返回: "15"
    ZINCRBY scores 3 user_new # user_new 不存在，添加，分数为 3
    # 返回: "3"


    - 1
    - 2
    - 3
    - 4
    - 5
    ```

#### 4.2 删除

* **`ZREM key member [member ...]`**

  + **功能:** 移除有序集合中的一个或多个成员。忽略不存在的成员。
  + **返回值:** 被成功移除的成员数量。
  + **复杂度:**
    - 移除单个元素：O(log N) (skiplist) / 平均 O(log N)，最坏 O(N^2) (ziplist)
    - 移除多个元素：O(M \* log N) (skiplist) / 平均 O(M \* log N)，最坏 O(N\*M) 或 O(N^2) (ziplist)
  + **示例:**

    ```
    ZADD myzset 1 one 2 two 3 three
    ZREM myzset one four # 移除 one 和 four (four 不存在)
    # 返回: 1


    - 1
    - 2
    - 3
    ```
* **`ZREMRANGEBYRANK key start stop`**

  + **功能:** 移除有序集合中指定排名范围内的所有成员。排名按分数从小到大计算，0 是第一个，-1 是最后一个。
  + **参数:**
    - `start`, `stop`: 排名范围（包含边界）。
  + **返回值:** 被移除成员的数量。
  + **复杂度:** O(log N + M) (skiplist) / O(N) (ziplist)，M 是被移除的数量。
  + **示例:**

    ```
    ZADD myzset 1 a 2 b 3 c 4 d 5 e
    # 移除排名 0 到 1 的成员 (a, b)
    ZREMRANGEBYRANK myzset 0 1
    # 返回: 2
    # 剩余: c, d, e
    # 移除排名最后 2 位的成员 (d, e)
    ZREMRANGEBYRANK myzset -2 -1
    # 返回: 2
    # 剩余: c


    - 1
    - 2
    - 3
    - 4
    - 5
    - 6
    - 7
    - 8
    - 9
    ```
* **`ZREMRANGEBYSCORE key min max`**

  + **功能:** 移除有序集合中指定分数范围内的所有成员。
  + **参数:**
    - `min`, `max`: 分数范围。默认包含边界。可以使用 `(` 开头表示不包含最小值/最大值，如 `(10 20` 表示 > 10 且 <= 20。可以使用 `-inf` 和 `+inf` 表示负无穷和正无穷。
  + **返回值:** 被移除成员的数量。
  + **复杂度:** O(log N + M) (skiplist) / O(N) (ziplist)，M 是被移除的数量。
  + **示例:**

    ```
    ZADD myzset 10 a 20 b 30 c 40 d 50 e
    # 移除分数在 [20, 40] 之间的成员 (b, c, d)
    ZREMRANGEBYSCORE myzset 20 40
    # 返回: 3
    # 剩余: a, e
    # 移除分数 > 45 的成员 (e)
    ZREMRANGEBYSCORE myzset (45 +inf
    # 返回: 1
    # 剩余: a


    - 1
    - 2
    - 3
    - 4
    - 5
    - 6
    - 7
    - 8
    - 9
    ```

#### 4.3 查询

* **`ZCARD key`**

  + **功能:** 获取有序集合的成员数量（基数）。
  + **返回值:** 成员数量。
  + **复杂度:** O(1)。无论哪种编码，长度信息都是直接可用的。
  + **示例:**

    ```
    ZADD myzset 1 a 2 b
    ZCARD myzset
    # 返回: 2


    - 1
    - 2
    - 3
    ```
* **`ZSCORE key member`**

  + **功能:** 获取指定成员的分数。
  + **返回值:** 成员的分数（字符串形式）。如果成员不存在，返回 `nil`。
  + **复杂度:** O(1) (skiplist，通过 dict) / O(N) (ziplist，需要遍历)。
  + **示例:**

    ```
    ZADD myzset 1 a
    ZSCORE myzset a
    # 返回: "1"
    ZSCORE myzset non_exist
    # 返回: nil


    - 1
    - 2
    - 3
    - 4
    - 5
    ```
* **`ZRANK key member`**

  + **功能:** 获取指定成员的排名（按分数**从小到大**排序）。排名从 0 开始。
  + **返回值:** 成员的排名（整数）。如果成员不存在，返回 `nil`。
  + **复杂度:** O(log N) (skiplist，利用 span) / O(N) (ziplist，需要遍历)。
  + **示例:**

    ```
    ZADD myzset 10 a 20 b 30 c
    ZRANK myzset b
    # 返回: 1 (因为 a 是 0, b 是 1)


    - 1
    - 2
    - 3
    ```
* **`ZREVRANK key member`**

  + **功能:** 获取指定成员的排名（按分数**从高到低**排序）。排名从 0 开始。
  + **返回值:** 成员的排名（整数）。如果成员不存在，返回 `nil`。
  + **复杂度:** O(log N) (skiplist) / O(N) (ziplist)。
  + **示例:**

    ```
    ZADD myzset 10 a 20 b 30 c
    ZREVRANK myzset b
    # 返回: 1 (因为 c 是 0, b 是 1)


    - 1
    - 2
    - 3
    ```
* **`ZCOUNT key min max`**

  + **功能:** 获取有序集合中，分数在指定范围内的成员数量。
  + **参数:**
    - `min`, `max`: 分数范围，语法同 `ZREMRANGEBYSCORE`。
  + **返回值:** 指定分数范围内的成员数量。
  + **复杂度:** O(log N) (skiplist，定位到范围起点即可) / O(N) (ziplist)。
  + **示例:**

    ```
    ZADD myzset 10 a 20 b 30 c 40 d 50 e
    ZCOUNT myzset 20 40
    # 返回: 3 (b, c, d)
    ZCOUNT myzset (20 +inf
    # 返回: 3 (c, d, e)


    - 1
    - 2
    - 3
    - 4
    - 5
    ```
* **`ZRANGE key start stop [WITHSCORES]`**

  + **功能:** 获取有序集合中指定排名范围内的成员（按分数**从小到大**排序）。
  + **参数:**
    - `start`, `stop`: 排名范围（包含边界），0 是第一个，-1 是最后一个，-2 是倒数第二个，以此类推。
    - `WITHSCORES`: 可选，同时返回成员的分数。
  + **返回值:** 成员列表。如果使用 `WITHSCORES`，则返回 `[member1, score1, member2, score2, ...]` 格式的列表。
  + **复杂度:** O(log N + M) (skiplist) / O(N) (ziplist)，M 是返回的数量。
  + **示例:**

    ```
    ZADD myzset 10 a 20 b 30 c 40 d
    # 获取排名 0 到 1 的成员 (a, b)
    ZRANGE myzset 0 1
    # 返回: 1) "a" 2) "b"
    # 获取排名 1 到 -1 (最后一个) 的成员及其分数 (b, c, d)
    ZRANGE myzset 1 -1 WITHSCORES
    # 返回: 1) "b" 2) "20" 3) "c" 4) "30" 5) "d" 6) "40"


    - 1
    - 2
    - 3
    - 4
    - 5
    - 6
    - 7
    ```
* **`ZREVRANGE key start stop [WITHSCORES]`**

  + **功能:** 获取有序集合中指定排名范围内的成员（按分数**从高到低**排序）。
  + **参数:** 同 `ZRANGE`。
  + **返回值:** 同 `ZRANGE`。
  + **复杂度:** O(log N + M) (skiplist) / O(N) (ziplist)。
  + **示例:**

    ```
    ZADD myzset 10 a 20 b 30 c 40 d
    # 获取排名 0 到 1 的成员 (按分数从高到低，即 d, c)
    ZREVRANGE myzset 0 1
    # 返回: 1) "d" 2) "c"
    # 获取所有成员及其分数 (按分数从高到低)
    ZREVRANGE myzset 0 -1 WITHSCORES
    # 返回: 1) "d" 2) "40" 3) "c" 4) "30" 5) "b" 6) "20" 7) "a" 8) "10"


    - 1
    - 2
    - 3
    - 4
    - 5
    - 6
    - 7
    ```
* **`ZRANGEBYSCORE key min max [WITHSCORES] [LIMIT offset count]`**

  + **功能:** 获取有序集合中，分数在指定范围内的成员（按分数**从小到大**排序）。
  + **参数:**
    - `min`, `max`: 分数范围，语法同 `ZREMRANGEBYSCORE`。
    - `WITHSCORES`: 可选，同时返回成员的分数。
    - `LIMIT offset count`: 可选，用于分页。从符合条件的成员中，跳过 `offset` 个，取出 `count` 个。
  + **返回值:** 成员列表（可能包含分数）。
  + **复杂度:** O(log N + M) (skiplist) / O(N) (ziplist)，M 是返回的数量（在 LIMIT 前计算）。
  + **示例:**

    ```
    ZADD myzset 10 a 20 b 30 c 40 d 50 e
    # 获取分数在 [20, 40] 之间的成员及其分数 (b, c, d)
    ZRANGEBYSCORE myzset 20 40 WITHSCORES
    # 返回: 1) "b" 2) "20" 3) "c" 4) "30" 5) "d" 6) "40"
    # 获取分数 > 25 的成员，跳过 1 个，取 2 个 (d, e)
    ZRANGEBYSCORE myzset (25 +inf WITHSCORES LIMIT 1 2
    # 返回: 1) "d" 2) "40" 3) "e" 4) "50"


    - 1
    - 2
    - 3
    - 4
    - 5
    - 6
    - 7
    ```
* **`ZREVRANGEBYSCORE key max min [WITHSCORES] [LIMIT offset count]`**

  + **功能:** 获取有序集合中，分数在指定范围内的成员（按分数**从高到低**排序）。注意 `max` 和 `min` 的顺序。
  + **参数:** 同 `ZRANGEBYSCORE`，但 `max` 在前，`min` 在后。
  + **返回值:** 成员列表（可能包含分数）。
  + **复杂度:** O(log N + M) (skiplist) / O(N) (ziplist)。
  + **示例:**

    ```
    ZADD myzset 10 a 20 b 30 c 40 d 50 e
    # 获取分数在 [40, 20] 之间的成员及其分数 (按分数从高到低，即 d, c, b)
    ZREVRANGEBYSCORE myzset 40 20 WITHSCORES
    # 返回: 1) "d" 2) "40" 3) "c" 4) "30" 5) "b" 6) "20"
    # 获取分数 <= 35 的成员，按分数从高到低，取前 2 个 (c, b)
    ZREVRANGEBYSCORE myzset 35 -inf WITHSCORES LIMIT 0 2
    # 返回: 1) "c" 2) "30" 3) "b" 4) "20"


    - 1
    - 2
    - 3
    - 4
    - 5
    - 6
    - 7
    ```
* **`ZPOPMIN key [count]`** (Redis 5.0+)

  + **功能:** 移除并返回有序集合中分数**最低**的一个或多个成员。
  + **参数:**
    - `count`: 可选，指定要移除并返回的成员数量，默认为 1。
  + **返回值:** 被移除的成员及其分数列表 `[member1, score1, member2, score2, ...]`。如果集合为空，返回空列表。
  + **复杂度:** O(log N \* M)，M 是 `count` 值。
  + **示例:**

    ```
    ZADD myzset 10 a 20 b 30 c
    ZPOPMIN myzset 2 # 移除并返回 a 和 b
    # 返回: 1) "a" 2) "10" 3) "b" 4) "20"
    # 集合剩余: c


    - 1
    - 2
    - 3
    - 4
    ```
* **`ZPOPMAX key [count]`** (Redis 5.0+)

  + **功能:** 移除并返回有序集合中分数**最高**的一个或多个成员。
  + **参数:** 同 `ZPOPMIN`。
  + **返回值:** 同 `ZPOPMIN`。
  + **复杂度:** O(log N \* M)。
  + **示例:**

    ```
    ZADD myzset 10 a 20 b 30 c
    ZPOPMAX myzset 1 # 移除并返回 c
    # 返回: 1) "c" 2) "30"
    # 集合剩余: a, b


    - 1
    - 2
    - 3
    - 4
    ```
* **`BZPOPMIN key [key ...] timeout`** (Redis 5.0+)

  + **功能:** `ZPOPMIN` 的阻塞版本。如果所有指定的 ZSet 都为空，连接将阻塞 `timeout` 秒，直到有元素可弹出或超时。`timeout` 为 0 表示无限期阻塞。它会从第一个非空 ZSet 中弹出元素。
  + **返回值:** 一个包含 3 个元素的列表：弹出元素的来源 ZSet 的键名、被弹出的成员、成员的分数。如果超时，返回 `nil`。
  + **复杂度:** O(log N)。
  + **示例:** (用于实现可靠的任务队列)

    ```
    # 阻塞等待从 queue1 或 queue2 中弹出分数最低的元素，最多等 10 秒
    BZPOPMIN queue1 queue2 10


    - 1
    - 2
    ```
* **`BZPOPMAX key [key ...] timeout`** (Redis 5.0+)

  + **功能:** `ZPOPMAX` 的阻塞版本。
  + **返回值:** 同 `BZPOPMIN`。
  + **复杂度:** O(log N)。
* **`ZSCAN key cursor [MATCH pattern] [COUNT count]`**

  + **功能:** 迭代有序集合中的元素（成员和分数）。用于遍历大型 ZSet 而不阻塞服务器。
  + **参数:**
    - `cursor`: 游标，第一次迭代从 0 开始，后续迭代使用上次返回的游标。
    - `MATCH pattern`: 可选，只返回匹配给定模式的成员。
    - `COUNT count`: 可选，提示每次迭代返回的元素数量（不保证精确）。
  + **返回值:** 一个包含两个元素的列表：第一个是下一次迭代使用的 `cursor`（如果返回 “0” 表示迭代完成），第二个是本次迭代返回的元素列表 `[member1, score1, member2, score2, ...]`。
  + **复杂度:** 每次调用 O(M)，M 是 `COUNT` 值。完整遍历需要 O(N)。
  + **示例:**

    ```
    # 第一次迭代
    ZSCAN myzset 0 MATCH user:* COUNT 10
    # 返回: 1) "17"  (下次的 cursor)
    #      2) 1) "user:1" 2) "100" 3) "user:3" 4) "150" ... (最多 10 对)

    # 后续迭代
    ZSCAN myzset 17 MATCH user:* COUNT 10


    - 1
    - 2
    - 3
    - 4
    - 5
    - 6
    - 7
    ```

#### 4.4 集合运算 (交集与并集)

* **`ZINTERSTORE destination numkeys key [key ...] [WEIGHTS weight [weight ...]] [AGGREGATE SUM|MIN|MAX]`**

  + **功能:** 计算一个或多个有序集合的**交集**，并将结果存储在 `destination` 键中。对于交集中的成员，其分数可以按指定方式聚合。
  + **参数:**
    - `destination`: 存储结果的键名。如果已存在，会被覆盖。
    - `numkeys`: 要计算交集的 ZSet 数量。
    - `key [key ...]`: 要计算交集的 ZSet 的键名。
    - `WEIGHTS weight [weight ...]`: 可选，为每个输入 ZSet 指定一个权重因子，计算交集成员分数时会先乘以权重。默认权重为 1。
    - `AGGREGATE SUM|MIN|MAX`: 可选，指定如何聚合交集成员的分数。`SUM` (默认): 各 ZSet 中分数之和 (乘以权重后)。`MIN`: 取最小值。`MAX`: 取最大值。
  + **返回值:** 存储在 `destination` 中的结果集合的成员数量。
  + **复杂度:** O(N*K*LogM) 最坏情况，N 是最小输入 ZSet 的大小，K 是输入 ZSet 的数量，M 是结果 ZSet 的大小。通常取决于最小 ZSet 的大小。
  + **示例:**

    ```
    ZADD zset1 1 one 2 two
    ZADD zset2 1 one 2 two 3 three
    # 计算 zset1 和 zset2 的交集，分数相加，存入 zset_inter
    ZINTERSTORE zset_inter 2 zset1 zset2 WEIGHTS 1 1 AGGREGATE SUM
    # 返回: 2 (交集有 one, two)
    ZRANGE zset_inter 0 -1 WITHSCORES
    # 返回: 1) "one" 2) "2" (1*1 + 1*1) 3) "two" 4) "4" (2*1 + 2*1)

    ZADD zset3 5 one 1 two 10 four
    # 计算 zset1 和 zset3 交集，zset1 权重 2，zset3 权重 3，取最大分数
    ZINTERSTORE zset_inter2 2 zset1 zset3 WEIGHTS 2 3 AGGREGATE MAX
    # 返回: 2 (交集有 one, two)
    ZRANGE zset_inter2 0 -1 WITHSCORES
    # 返回: 1) "one" 2) "15" (max(1*2, 5*3)) 2) "two" 4) "4" (max(2*2, 1*3))


    - 1
    - 2
    - 3
    - 4
    - 5
    - 6
    - 7
    - 8
    - 9
    - 10
    - 11
    - 12
    - 13
    - 14
    ```
* **`ZUNIONSTORE destination numkeys key [key ...] [WEIGHTS weight [weight ...]] [AGGREGATE SUM|MIN|MAX]`**

  + **功能:** 计算一个或多个有序集合的**并集**，并将结果存储在 `destination` 键中。
  + **参数:** 同 `ZINTERSTORE`。
  + **返回值:** 存储在 `destination` 中的结果集合的成员数量。
  + **复杂度:** O(N*LogN + M*LogM)，N 是所有输入 ZSet 成员总数，M 是结果 ZSet 大小。通常取决于所有输入 ZSet 的总大小。
  + **示例:**

    ```
    ZADD zset1 1 one 2 two
    ZADD zset2 1 one 2 two 3 three
    # 计算 zset1 和 zset2 的并集，分数相加，存入 zset_union
    ZUNIONSTORE zset_union 2 zset1 zset2 AGGREGATE SUM
    # 返回: 3 (并集有 one, two, three)
    ZRANGE zset_union 0 -1 WITHSCORES
    # 返回: 1) "one" 2) "2" (1+1) 3) "three" 4) "3" 5) "two" 6) "4" (2+2)


    - 1
    - 2
    - 3
    - 4
    - 5
    - 6
    - 7
    ```

---

### 五、 总结

Redis ZSet 是一种功能强大的有序集合数据结构，它通过将唯一的成员与浮点数分数相关联，并根据分数进行排序，为许多业务场景提供了高效的解决方案。

* **核心优势:** 成员唯一、按 score 排序、高效的排名计算和范围查找。
* **应用广泛:** 排行榜、延迟队列、时间轴、地理位置搜索（底层）、范围查询等。
* **底层实现:** 根据数据规模动态选择 `ziplist`（节省内存，小规模数据）或 `skiplist` + `dict`（查询效率高，大规模数据）。`skiplist` 通过多层链表和 `span` 实现了 O(log N) 的高效操作。
* **命令丰富:** 提供了 `ZADD`, `ZREM`, `ZRANGE`, `ZRANK`, `ZRANGEBYSCORE` 等一系列覆盖增删改查、范围查询、集合运算的命令。
