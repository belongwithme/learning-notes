---
title: "深入理解 G1 GC：已记忆集合（RSet）与收集集合（CSet）详解"
description: "GarbageFirst (G1) 垃圾回收器是 Java HotSpot 虚拟机中一种面向服务端应用的、"
sourceId: "147445862"
source: "https://blog.csdn.net/qq_45852626/article/details/147445862"
sourceSeries:
  - "JVM"
category: java-backend
tags:
  - "JVM"
status: draft
difficulty: intermediate
contentType: knowledge
sidebar:
  order: 147445862
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/147445862)（历史文章导入，当前状态为草稿）

## 深入理解 G1 GC：已 记忆 集合（RSet）与收集集合（CSet）详解

### 一、 引言：G1 GC 的基石

Garbage-First (G1) 垃圾回收器是 Java HotSpot 虚拟机中一种面向服务端应用的、
旨在实现
低暂停时间目标的垃圾回收器。与传统的 CMS 或 Parallel Scavenge 不同，G1 的一个核心创新在于它将 Java 堆划分为一系列大小相等的独立**区域（Region）**。每个 Region 可以扮演 Eden、Survivor 或 Old Generation 的角色。

这种基于 Region 的设计带来了巨大的灵活性，使得 G1 可以**增量地**进行垃圾回收，不必每次都回收整个年轻代或老年代。G1 的目标是在用户设定的暂停时间目标内（通过 `-XX:MaxGCPauseMillis`），优先回收那些\*\*垃圾最多（Garbage First）\*\*的 Region，从而获得最高的回收效率。

然而，这种按需回收部分 Region 的能力也带来了新的挑战：

1. **跨 Region 引用问题：** 当回收某个 Region A 时，我们必须知道是否有来自其他 Region B 的对象引用了 Region A 中的对象。如果存在这样的引用，那么 Region A 中的被引用对象就不能被回收。如何高效地查找这些跨 Region 的引用，而避免扫描整个堆？
2. **回收范围确定问题：** 在一次 GC 暂停（Stop-The-World, STW）中，G1 应该选择哪些 Region 进行回收，才能既满足暂停时间目标，又能最大化回收效率？

为了解决这两个核心问题，G1 引入了两个关键机制：

* **已记忆集合 (Remembered Set, RSet)：** 用于解决跨 Region 引用的跟踪问题。
* **收集集合 (Collection Set, CSet)：** 用于定义单次 GC 暂停期间需要回收的 Region 集合。

**阅读前提：** 假设已经了解 JVM 内存结构（堆、栈等）、基本的垃圾回收概念（可达性分析、分代假设），并对 G1 GC 的 Region 划分有初步认识。

### 二、 已记忆集合 (RSet)：跟踪跨区引用的“雷达”

#### 1. RSet 的目的与概念

想象一下，如果没有 RSet，当 G1 决定回收某个 Old Region A 时，它如何知道这个 Region A 里的对象是否被其他 Old Region B 里的对象引用着？最笨的方法是扫描所有其他的 Old Region，查找指向 A 的引用。但这显然违背了 G1 避免全堆扫描的设计初衷，会导致漫长的 STW。

**RSet 的核心目的：** 避免全堆扫描，能够快速、准确地识别出**哪些其他 Region 中的对象引用了当前 Region 中的对象**。

**RSet 的概念：** 每个 G1 Region 都有一个与之关联的 RSet。这个 RSet 记录了**其他 Region 指向该 Region 的引用信息**。更具体地说，RSet 存储的是**指向本 Region 的对象的引用所在的 Card 的索引**。

**理解难点与类比：**

* **反向指针思想：** RSet 有点像一个“反向引用列表”。普通的对象引用是从 A 指向 B，而 Region A 的 RSet 记录的是“谁指向了我 A”。
* **粗粒度记录 (Card Table)：** RSet 并不是精确记录哪个对象的哪个字段指向了本 Region 的哪个对象。它通常是基于**卡表（Card Table）**的。卡表将堆内存划分为更小的单元（Card，通常 512 字节）。当 Region B 的一个对象引用了 Region A 的对象时，RSet A 只需要记录下 Region B 中发生引用的那个对象所在的**卡（Card）的标识**。
* **类比：** 想象每个 Region 是一个小区。每个小区门口的保安（RSet）有一个本子，记录着“XX 小区 XX 号楼的张三（来自其他 Region B 的 Card）经常来我们小区找李四（本 Region A 的对象）”。当要评估李四是否应该搬走（回收）时，保安只需要看本子，就知道张三还在找他，所以李四暂时不能搬。保安不需要知道张三找李四具体是哪个房间、为了什么事，只需要知道有这么个外部联系（Card 级别）就行了。

所以，当 G1 要回收 Region A 时，它只需要扫描 Region A 自己的 RSet，就能知道所有从外部指向 Region A 的引用入口（精确到 Card 级别）。然后从这些入口（Card 对应的内存区域）出发，结合 GC Roots，就能判断 Region A 内部哪些对象是真正存活的。

#### 2. RSet 的维护：写屏障与并发优化线程

RSet 既然记录了跨 Region 的引用信息，那么当应用程序修改对象引用时，RSet 就必须被**及时、准确地更新**。否则，如果一个跨 Region 引用被删除，而 RSet 没有更新，可能会导致不必要的对象存活；如果一个新的跨 Region 引用被建立，而 RSet 没有记录，则可能导致存活对象被错误回收（这是绝对不允许的）。

G1 通过以下机制来维护 RSet：

**(a) 写屏障 (Write Barrier) - 信息的源头**

* 当应用程序执行对象引用赋值操作（例如 `a.field = b;`）时，JVM 会插入一段额外的代码，称为**写屏障**。
* G1 使用的是**后写屏障 (Post-Write Barrier)**，它在引用赋值完成*之后*执行。
* 这个写屏障的主要职责是**检测这次赋值是否产生了跨 Region 引用**。即，对象 `a` 和对象 `b` 是否位于不同的 Region。
* **过滤：** 如果 `a` 和 `b` 在同一个 Region，或者根据某些优化规则（后面会讲），这个引用不需要记录，则写屏障直接结束。
* **记录 (非直接更新 RSet)：** 如果检测到是需要记录的跨 Region 引用（或潜在的跨 Region 引用），写屏障**不会立即去更新**目标 Region 的 RSet。直接更新 RSet 可能比较耗时，且需要处理并发问题。相反，写屏障会将这个“引用发生变化”的信息（通常是被修改对象 `a` 所在的 Card 标识）放入一个**线程本地的缓冲区**，称为**更新日志缓冲区 (Update Log Buffer)** 或 **脏卡片队列 (Dirty Card Queue)**。

**(b) 更新日志缓冲区 / 脏卡片队列 - 信息的暂存**

* 每个应用程序线程都有自己的更新日志缓冲区。
* 写屏障将需要记录的脏卡片信息快速存入这个本地缓冲区，这个过程非常轻量。
* 当线程本地的缓冲区满了之后，它会被提交到一个**全局的缓冲区列表 (Global Buffer List)** 中，等待后续处理。

**© 并发优化线程 (Concurrent Refinement Threads) - 信息的处理者**

* G1 启动了一组（或一个）专门的后台线程，称为**并发优化线程**。这些线程**与应用程序线程并发运行**。
* 它们的主要任务就是不断地从全局缓冲区列表中取出待处理的更新日志缓冲区（脏卡片队列）。
* 对于每个缓冲区中的脏卡片信息，并发优化线程会**真正地去更新**对应目标 Region 的 RSet 数据结构。即将“来源 Card”的信息添加到“目标 Region”的 RSet 中。
* **并发处理：** 这个 RSet 更新过程是并发执行的，不会阻塞应用程序线程（大部分情况下）。
* **线程数量：** 可以通过 `-XX:G1ConcRefinementThreads` 参数设置并发优化线程的数量（默认通常等于并行 GC 线程数 `-XX:ParallelGCThreads`）。

**(d) 处理反压 (Back-Pressure) - 应对极端情况**

* **问题：** 如果应用程序产生脏卡片的速度过快，超出了并发优化线程的处理能力，导致全局缓冲区列表不断积压怎么办？
* **分层调度阈值：** G1 设计了几个阈值来应对这种情况：
  + `-XX:G1ConcRefinementGreenZone`
  + `-XX:G1ConcRefinementYellowZone`
  + `-XX:G1ConcRefinementRedZone`
* **机制：** 当待处理的缓冲区数量超过 GreenZone 时，并发优化线程会更积极地工作。超过 YellowZone 时，G1 可能会尝试激活更多的并发优化线程（如果配置允许）或者让应用程序线程在执行写屏障时**顺便帮助处理**一小部分 RSet 更新任务（增加写屏障的开销）。如果达到了 RedZone，情况就比较严重了，G1 可能会强制应用程序线程**暂停下来（Self-Pause）**，全力帮助处理积压的 RSet 更新，直到缓冲区数量下降到安全水平。
* **目标：** 必须避免进入 RedZone 甚至让 Mutator 线程大规模参与 RSet 更新的情况，因为这会显著影响应用程序的性能。需要合理配置并发优化线程数或调整相关阈值。

**理解难点：为何需要如此复杂的异步更新机制？**

直接在写屏障里更新 RSet 看似简单，但有几个缺点：

1. **性能开销：** 更新 RSet 涉及查找目标 Region、修改 RSet 数据结构（可能有锁或复杂的原子操作），这比简单地将 Card ID 写入本地缓冲区要慢得多。将其放入写屏障会明显拖慢应用程序的执行速度。
2. **并发控制复杂：** 多个应用程序线程可能同时更新同一个目标 Region 的 RSet，需要精细且高效的并发控制，实现复杂且可能引入新的瓶颈。

通过**异步处理**，G1 将 RSet 更新的重担交给了后台的并发优化线程：

* **写屏障保持轻量：** 应用程序线程的写屏障操作非常快。
* **后台并发处理：** RSet 的实际更新可以充分利用多核 CPU，与应用程序并发执行。
* **最终一致性：** RSet 的更新相对于引用变化会有一点点延迟，但 G1 的其他机制（如 SATB 快照）会确保在 GC 关键节点（如 Remark 阶段）时，所有必要的 RSet 更新都已完成或被考虑到，保证 GC 的正确性。

#### 3. RSet 优化：并非所有引用都需要记录

为了进一步减少 RSet 的大小和维护开销，G1 实施了一些优化策略，并非所有跨 Region 引用都需要记录在 RSet 中：

* **本分区引用：** 如果引用源对象和目标对象在同一个 Region 内，这显然不是跨 Region 引用，无需记录。
* **年轻代指向年轻代的引用：** G1 的 Young GC 总是会回收**所有**的年轻代 Region（Eden + Survivor）。因此，即使存在 Survivor Region 指向 Eden Region，或者 Survivor 指向另一个 Survivor 的引用，在确定年轻代对象的存活性时，我们总是会完整扫描所有年轻代 Region 的 GC Roots 和 RSet（指向年轻代的外部引用）。所以，年轻代内部互相指向的引用信息对于 Young GC 来说是冗余的，不需要记录在 RSet 中。
* **总结：** 一个 Region 的 RSet 主要记录的是**来自其他 Old Region** 指向该 Region 的引用信息。因此，通常只有 Old Region 才需要维护一个可能包含大量条目的 RSet。年轻代 Region 的 RSet 通常比较小或为空（只记录来自 Old Region 的引用）。这些拥有非空 RSet 的 Region 被称为“拥有 RSet 分区 (Regions with RSet)”。

#### 4. RSet 的内部结构 (简述)

RSet 的具体实现比较复杂，可能有多种形式，例如：

* **稀疏表 (Sparse Table):** 使用 Hash 表结构存储 Card ID。
* **细粒度位图 (Fine-Grained Bit Map):** 如果来源 Region 数量不多，可以用位图表示。
* **粗粒度位图 (Coarse-Grained Bit Map):** 对 Card ID 进行分组，用位图表示哪些组包含指向本 Region 的 Card。

选择哪种结构取决于 RSet 的大小和密度，G1 会根据实际情况动态调整。

### 三、 收集集合 (CSet)：定义单次回收的边界

RSet 解决了“如何找到指向特定 Region 的引用”的问题，使得 G1 可以独立评估每个 Region 的存活性。但 G1 并不会在一次 GC 中回收所有可回收的 Region。为了满足用户设定的暂停时间目标，G1 必须精心选择一部分 Region 来构成单次 STW 回收的集合。这个集合就是**收集集合 (Collection Set, CSet)**。

**CSet 的核心定义：** 在**一次 GC 暂停 (STW)** 期间，G1 将要回收（Evacuate）的**所有 Region 的集合**。

**CSet 的工作机制：**

1. **确定 CSet：** 在每次 GC 暂停开始时，G1 会根据本次 GC 的类型（Young GC 或 Mixed GC）以及一些启发式规则来确定 CSet 包含哪些 Region。
2. **处理 CSet：** 在 STW 期间，G1 只会处理 CSet 中的 Region：
   * 扫描 CSet 内 Region 的 RSet，结合 GC Roots，找出 CSet 内的存活对象。
   * 将 CSet 内的存活对象\*\*复制（Evacuate）\*\*到新的、空闲的 Region 中（可能是 Survivor Region 或 Old Region）。
   * 更新对象的年龄（用于判断晋升）。
   * 处理 CSet 内的 RSet 引用更新（因为对象移动了位置）。
3. **释放 CSet：** STW 结束后，原 CSet 中的所有 Region 都被认为是空闲的，可以被后续的对象分配或 GC 复制所使用。

#### 1. CSet 的构成：年轻代 vs. 混合收集

CSet 的具体内容取决于触发的是哪种
类 
型的 GC：

**(a) 年轻代收集 (Young Collection) 的 CSet**

* **触发时机：** 当应用程序试图在 Eden 区分配对象，但 Eden 区已满时触发。
* **CSet 内容：** **包含当前所有的 Eden Region 和 Survivor Region**。G1 的 Young GC 总是会回收整个年轻代。
* **目的：** 快速回收年轻代中的大量垃圾对象，为新对象腾出空间，并将存活时间足够长的对象晋升。

**(b) 混合收集 (Mixed Collection) 的 CSet**

* **触发时机：** 当 Old Region 占整个堆的比例达到**IHOP 阈值** (`-XX:InitiatingHeapOccupancyPercent`，默认 45%) 时，G1 会启动一个**混合收集周期 (Mixed GC Cycle)**。这个周期包含并发标记阶段和多次 Mixed GC 暂停。
* **CSet 内容：** **包含当前所有的 Eden Region 和 Survivor Region (与 Young GC 相同) + 一部分被选中的 Old Region**。
* **目的：** 在回收年轻代的同时，选择性地回收一部分垃圾比例较高的 Old Region，以控制 Old Region 的增长，避免耗时长的 Full GC。

#### 2. Old Region 如何被选入 Mixed CSet？

混合收集中，选择哪些 Old Region 加入 CSet 是 G1 实现“Garbage First”和控制暂停时间的关键。这个选择过程基于**并发标记**的结果和一系列启发式规则：

1. **并发标记 (Concurrent Marking)：** 在 Mixed GC Cycle 开始时（达到 IHOP 阈值后），G1 会启动一个并发标记过程（类似于 CMS），它会：
   * 找出堆中所有存活的对象。
   * 计算出每个 Old Region 中**存活对象的数量（Liveness）**以及**可以回收的空间大小（Garbage Ratio）**。这为后续 CSet 选择提供了依据。
2. **候选 Old Region：** 经过并发标记后，那些被标记为“有垃圾可回收”的 Old Region 就成为了加入 CSet 的**候选者**。
3. **筛选与优先级排序：** G1 会根据以下条件从候选者中选择 Old Region 加入本次 Mixed GC 的 CSet：
   * **活跃度阈值过滤 (`-XX:G1MixedGCLiveThresholdPercent`, 默认 85%)：** 如果一个 Old Region 的存活对象比例过高（例如超过 85%），回收它需要复制大量存活对象，耗时长且收益低。G1 会**跳过**这些 Region，不将它们加入 CSet。
   * **回收收益排序：** 对于通过活跃度阈值检查的候选 Region，G1 会根据它们的\*\*可回收空间比例（Garbage Ratio）\*\*进行排序，优先选择那些垃圾最多、回收收益最高的 Region。这就是“Garbage First”的核心体现。
   * **暂停时间目标约束：** G1 会根据用户设定的暂停时间目标 (`-XX:MaxGCPauseMillis`) 和之前 GC 的统计数据，预测本次回收能处理多少个 Old Region 而不超时。它会从排序好的高收益 Region 中选取一部分，直到预测的暂停时间接近目标值。
   * **CSet 大小上限 (`-XX:G1OldCSetRegionThresholdPercent`, 默认 10%)：** 为了避免单次 Mixed GC 回收过多的 Old Region 导致暂停时间过长或 RSet 更新压力过大，G1 限制了单次 Mixed GC 中可以包含的 Old Region 数量，不能超过堆总大小的一定百分比。

通过这些步骤，G1 精心挑选出一组 Old Region 加入到本次 Mixed GC 的 CSet 中，力求在满足暂停时间目标的前提下，最大化垃圾回收量。

#### 3. 理解 CSet 与 GC 周期的关系

* **CSet 定义的是单次 STW 暂停的工作范围。**
* **Young GC Pause：** CSet 只包含 Young Region，是一次独立的、短暂的 STW。
* **Mixed GC Cycle：** 是一个更长的过程，包含：
  + 初始标记 (Initial Mark, STW, piggybacked on a Young GC)
  + 并发标记 (Concurrent Marking, 并发)
  + 最终标记 (Remark, STW)
  + 清理 (Cleanup, STW + 并发)
  + **多次 Mixed GC Pause (STW):** **每一次** Mixed GC 暂停都会确定一个 CSet (All Young + Selected Old)。一个 Mixed GC Cycle 可能包含多次这样的 Mixed GC Pause。
* **Mixed GC Cycle 控制：**
  + `-XX:G1MixedGCCountTarget` (默认 8): 一个 Mixed GC Cycle 中，预期执行多少次 Mixed GC Pause 来处理 Old Region。G1 会将候选的 Old Region 分摊到这么多次 Pause 中。
  + `-XX:G1HeapWastePercent` (默认 5%): 当 G1 发现经过一轮 Mixed GC 后，堆上可回收的垃圾比例低于这个值时，即使还没达到 `G1MixedGCCountTarget` 的次数，也可能提前结束 Mixed GC Cycle，认为再进行 Mixed GC 的收益不大了。

### 四、 GC 周期详解：RSet 与 CSet 的协作

现在我们将 RSet 和 CSet 放在 G1 的实际 GC 周期中，看看它们如何协同工作。

#### 1. 年轻代收集 (Young Collection)

1. **触发：** Eden 区满。
2. **STW 开始。**
3. **确定 CSet：** CSet = 所有 Eden Region + 所有 Survivor Region。
4. **根扫描：** 扫描 GC Roots (线程栈、静态变量等)。
5. **处理 CSet：**
   * **扫描 RSet：** 对于 CSet 中的每个 Region R，扫描 R 的 RSet，找出所有指向 R 的外部引用（主要来自 Old Region）。将这些引用源（Card 对应的 Old Region 对象）加入扫描栈。
   * **可达性分析：** 从 GC Roots 和 RSet 找到的入口开始，遍历 CSet 内部的对象引用图，标记所有存活对象。
   * **复制/Evacuate：**
     + 将 CSet 中 Eden 区和 From Survivor 区的存活对象复制到 To Survivor 区（如果 To 区放得下且对象年龄未到阈值）或 Old 区（如果 To 区放不下或对象年龄达到阈值）。
     + **使用 PLAB/GCLAB：** GC 线程使用自己的 PLAB (晋升到 Old) 或 GCLAB (复制到 Survivor) 来快速分配空间放置这些对象，避免同步。
     + **更新对象年龄：** 复制到 To Survivor 区的对象年龄加 1。
   * **计算晋升阈值：** 根据 To Survivor 区的大小、期望占用率 (`-XX:TargetSurvivorRatio`) 和对象的年龄分布，动态计算本次 GC 的晋升年龄阈值 (`-XX:MaxTenuringThreshold` 是上限)。
   * **处理引用：** 更新被移动对象的引用（例如，如果 Old Region A 中的对象之前引用 Eden 中的对象 X，现在 X 被移动到 Survivor 区 S，需要更新 A 中对应 Card 的 RSet 信息，指向 S）。 RSet 的更新也可能利用 GCLAB/PLAB 中的信息或专门的日志。
6. **STW 结束。**
7. **CSet Region 清空：** 原 Eden 和 From Survivor Region 变为空闲 Region。To Survivor 成为新的 From Survivor。

#### 2. 混合收集周期 (Mixed GC Cycle)

这是一个更复杂的过程，RSet 和 CSet 在其中扮演关键角色：

1. **触发：** Old Region 占用率 > `IHOP` 阈值。
2. **(可选) Young GC 捎带初始标记 (Initial Mark, STW):** 触发一次 Young GC，并在这次 STW 中完成初始标记（标记 GC Roots 直接可达的对象）。这次 Young GC 的 CSet 只包含 Young Region。
3. **并发标记 (Concurrent Marking, 并发):**
   * G1 启动并发标记线程，从初始标记的对象出发，遍历整个堆的对象引用图，查找所有存活对象。
   * **依赖 RSet (间接)：** 虽然并发标记的主要目的是全局存活性分析，但 RSet 提供的跨 Region 引用信息对标记过程的高效进行是必要的补充。
   * **记录存活信息：** 标记过程会计算每个 Region 的存活字节数。
   * **写屏障 SATB (Snapshot-At-The-Beginning)：** 在并发标记期间，应用程序可能修改引用。G1 使用 SATB 写屏障来保证标记的正确性：当一个**白色**对象（未被标记）的引用被一个**灰色或黑色**对象（已被标记或在标记栈中）删除时，SATB 会将这个白色对象记录下来（放入 Log Buffer），确保它不会被错误回收。**SATB 与 RSet 的写屏障是不同的，但会协同工作。**
4. **最终标记 (Remark, STW):**
   * 短暂暂停应用程序。
   * 处理并发标记期间 SATB 记录下来的 Log Buffer，以及其他一些需要同步处理的引用（如 JNI Weak Refs），确保所有存活对象都被正确标记。
   * **依赖 RSet 更新完成：** 此时，并发优化线程应该已经处理完了大部分（或全部）脏卡片队列，使得 RSet 状态相对准确。
5. **清理 (Cleanup, STW + 并发):**
   * **STW 部分：**
     + **识别完全空闲 Region：** 统计哪些 Region 在并发标记后发现完全没有存活对象（全是垃圾），这些 Region 可以被**立即回收**，无需复制。
     + **整理 RSet：** 可能进行一些 RSet 的整理和优化。
     + **确定候选 Old Region：** 基于并发标记结果，筛选出所有包含垃圾的 Old Region，按回收收益排序，形成 Mixed GC 的候选列表。
   * **并发部分：** 清理 RSet 中指向已经被回收的 Region 的无效条目。
6. **混合收集阶段 (Mixed GC Pause, STW):**
   * **触发：** 清理阶段结束后，如果候选 Old Region 列表不为空，且未达到 `G1HeapWastePercent` 限制，则开始执行一次或多次 Mixed GC Pause。
   * **STW 开始。**
   * **确定 CSet：**
     + **包含所有 Young Region** (Eden + Survivor)。
     + **从候选 Old Region 列表中选择：** 根据活跃度阈值、回收收益排序、暂停时间目标、CSet 大小上限，选择一部分高收益的 Old Region 加入 CSet。
   * **处理 CSet (过程与 Young GC 非常类似)：**
     + 扫描 GC Roots。
     + 扫描 CSet 内 Region 的 RSet，找到外部引用入口。
     + 可达性分析，标记 CSet 内（包括 Young 和选中的 Old）的存活对象。
     + 复制/Evacuate 存活对象到新的 Survivor 或 Old Region（使用 PLAB/GCLAB）。
     + 更新对象年龄、计算晋升阈值。
     + 处理引用和 RSet 更新。
   * **STW 结束。**
   * **CSet Region 清空。**
7. **重复步骤 6：** 如果候选 Old Region 列表尚未处理完，且未达到 `G1MixedGCCountTarget` 次数限制和 `G1HeapWastePercent` 比例限制，则继续执行下一次 Mixed GC Pause (步骤 6)。
8. **Mixed GC Cycle 结束：** 当所有候选 Old Region 都被处理，或达到次数/比例限制时，本轮 Mixed GC Cycle 结束。等待下一次达到 IHOP 阈值再启动新的周期。

**理解关键点：**

* RSet 是 G1 实现 Region 独立回收的基础，提供了必要的跨区引用信息。它的维护是一个涉及写屏障、缓冲区、并发线程的复杂但高效的过程。
* CSet 是 G1 控制单次 GC 暂停范围和时间的关键。它的内容和选择策略直接体现了 G1 的“Garbage First”思想和低暂停目标。
* Young GC 和 Mixed GC 在处理 CSet 的基本流程上相似（标记、复制、更新），主要区别在于 CSet 的构成（Mixed GC 包含 Old Region）和触发时机（Mixed GC 是周期性的，由 IHOP 触发）。

### 五、 源码片段探索 (概念性)

直接展示 HotSpot 中 G1 的 RSet 和 CSet 源码对于我们可能过于复杂和深入。这里提供一些概念性的 C++ 伪代码片段，帮助理解核心逻辑，并附上中文注释。(AI生成,我看不懂这块的源代码,只能借助AI生成几个场景了,不保证绝对正确,但是我看下来没什么问题= = )

**注意：** 这些是高度简化的示意代码，与真实源码有很大差异。

#### 概念 1: 写屏障记录脏卡片 (Post-Write Barrier)

```
// 伪代码：对象引用赋值 a.field = b 之后触发的 G1 后写屏障
void G1PostWriteBarrier(oop a, oop b) {
  // 1. 获取对象 a 所在的 Card 的标识 (card_ptr)
  CardValue* card_ptr = get_card_ptr(address_of(a));

  // 2. 检查是否已经是脏卡片 (避免重复处理)
  if (*card_ptr == DIRTY_CARD_VALUE) {
    return; // 已经是脏的，无需处理
  }

  // 3. [优化检查 - 实际更复杂] 检查是否需要记录
  //    a. 是否跨 Region？ (is_cross_region(a, b))
  //    b. 是否是从 Old 指向 Young (通常需要记录)
  //    c. 是否是从 Young 指向 Young (通常不需要记录)
  //    d. 是否是从 Old 指向 Old (通常需要记录)
  // if (!needs_rset_update(a, b)) {
  //    return; // 根据规则，此引用无需记录到 RSet
  // }

  // 4. 标记 Card 为脏
  *card_ptr = DIRTY_CARD_VALUE;

  // 5. 将脏卡片信息放入当前线程的 Update Log Buffer
  Thread* current_thread = Thread::current();
  if (!current_thread->dirty_card_queue().enqueue(card_ptr)) {
    // 如果本地队列满了，将其提交到全局队列
    submit_dirty_card_queue_to_global_list(current_thread);
    // 再次尝试入队 (通常会成功，因为队列已清空)
    current_thread->dirty_card_queue().enqueue(card_ptr);
  }
}


```

#### 概念 2: 并发优化线程处理脏卡片

```
// 伪代码：并发优化线程 (Concurrent Refinement Thread) 的主循环
void ConcurrentRefinementThread::run() {
  while (should_continue_running()) {
    // 1. 从全局列表中获取一个待处理的脏卡片队列 (Buffer)
    DirtyCardQueue* buffer = G1GlobalDirtyCardQueueList::dequeue();

    if (buffer != NULL) {
      // 2. 处理该 Buffer 中的每一个脏卡片
      CardValue* card_ptr;
      while ((card_ptr = buffer->dequeue()) != NULL) {
        // a. 根据 Card 地址找到其所在的源 Region (Source Region)
        HeapRegion* source_region = heap->heap_region_containing(card_ptr);

        // b. 遍历这个 Card 覆盖的内存范围内的所有对象
        iterate_objects_in_card(card_ptr, [&](oop obj) {
          // c. 遍历该对象的引用字段
          iterate_reference_fields(obj, [&](oop target_obj) {
            if (target_obj != NULL) {
              // d. 获取目标对象所在的 Region (Target Region)
              HeapRegion* target_region = heap->heap_region_containing(target_obj);

              // e. 如果是跨 Region 引用，并且目标 Region 不是源 Region
              if (target_region != source_region) {
                // f. **更新目标 Region 的 RSet**
                //    将源 Card (card_ptr) 的信息添加到 target_region 的 RSet 中
                target_region->remembered_set()->add(card_ptr);
              }
            }
          });
        });
      }
      // 处理完 Buffer 后，回收 Buffer
      recycle_buffer(buffer);
    } else {
      // 全局列表为空，线程可以短暂休眠或等待
      wait_for_work();
    }
  }
}


```

#### 概念 3: Mixed GC 中选择 Old Region 加入 CSet (启发式)

```
// 伪代码：选择 Old Region 加入 Mixed CSet 的过程
void select_old_regions_for_mixed_cset(CollectionSet* cset, G1Policy* policy) {
  // 1. 获取并发标记后确定的候选 Old Region 列表 (已按回收收益排序)
  GrowableArray<HeapRegion*>& candidates = policy->candidate_old_regions();

  // 2. 初始化预测的暂停时间和已添加的 Old Region 数量
  double predicted_pause_time = policy->predict_young_gc_pause_time();
  int added_old_region_count = 0;
  size_t added_old_region_bytes = 0;

  // 3. 计算 CSet 中 Old Region 的数量和大小上限
  int max_old_regions_in_cset = calculate_max_old_regions(policy); // 基于 G1OldCSetRegionThresholdPercent
  size_t max_old_bytes_in_cset = calculate_max_old_bytes(policy);

  // 4. 遍历高收益的候选 Old Region
  for (int i = 0; i < candidates.length(); ++i) {
    HeapRegion* candidate = candidates.at(i);

    // a. 检查活跃度阈值
    if (candidate->live_ratio() > policy->g1_mixed_gc_live_threshold_percent() / 100.0) {
      continue; // 存活对象太多，跳过
    }

    // b. 预测加入这个 Region 会增加多少暂停时间
    double predicted_increment = policy->predict_region_evacuation_time(candidate);

    // c. 检查是否会超出暂停时间目标和 CSet 上限
    if (predicted_pause_time + predicted_increment <= policy->max_gc_pause_millis() &&
        added_old_region_count < max_old_regions_in_cset &&
        added_old_region_bytes + candidate->used() < max_old_bytes_in_cset)
    {
      // d. 将该 Region 加入 CSet
      cset->add(candidate);
      added_old_region_count++;
      added_old_region_bytes += candidate->used();
      predicted_pause_time += predicted_increment;
    } else {
      // 如果加入这个 Region 会超时或超限，停止选择
      break;
    }
  }
  // CSet 确定完毕
}


```

这些简化代码旨在展示 RSet 维护（写屏障->缓冲->并发处理）和 CSet 选择（基于收益、阈值和暂停目标）的核心思想。

### 六、 总结

已记忆集合 (RSet) 和收集集合 (CSet) 是 G1 GC 实现其低暂停时间、高吞吐量目标的两大支柱。

* **RSet** 通过记录跨 Region 引用信息（精确到 Card），使得 G1 在回收单个 Region 时无需扫描全堆，只需检查指向该 Region 的外部引用即可确定内部对象存活性。其高效的异步维护机制（写屏障+缓冲+并发优化线程）在保证 GC 正确性的同时，最大限度地减少了对应用程序性能的影响。
* **CSet** 定义了每次 GC 暂停（STW）需要处理的 Region 集合。通过精心选择 CSet 的内容（Young GC 回收全部年轻代，Mixed GC 回收全部年轻代加部分高收益的老年代 Region），G1 能够在满足用户设定的暂停时间目标内，优先回收垃圾最多的区域，实现“Garbage First”的策略。

Happy coding!
