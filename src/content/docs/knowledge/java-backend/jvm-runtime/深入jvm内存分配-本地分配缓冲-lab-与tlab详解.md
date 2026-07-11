---
title: "深入JVM内存分配-本地分配缓冲（LAB）与TLAB详解"
description: "在 Java 程序中，对象的创建是一个极其频繁的操作。每一次 new 关键字的背后，都是 JVM 在堆内存中寻找合适空间并完成对象初始化的过程。在并发环境下，多个应用程序线程同时请求分配内存，这会带来一个显而易见的挑战：内存分配的线程安全问题。"
sourceId: "147445092"
source: "https://blog.csdn.net/qq_45852626/article/details/147445092"
sourceSeries:
  - "JVM"
category: java-backend
subcategory: jvm-runtime
tags:
  - "JVM"
status: draft
difficulty: intermediate
contentType: knowledge
sidebar:
  order: 147445092
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/147445092)（历史文章导入，当前状态为草稿）

## 一、 引言：为何需要本地分配缓冲？

在 Java 程序中，对象的创建是一个极其频繁的操作。每一次 `new` 关键字的背后，都是 JVM 在堆内存中寻找合适空间并完成对象初始化的过程。在并发环境下，多个应用程序线程同时请求分配内存，这会带来一个显而易见的挑战：**内存分配的线程安全问题**。

想象一个简单的场景：多个线程都想在堆的 Eden 区分配一个小对象。如果没有特殊的处理机制，它们可能会同时看中同一块空闲内存。为了避免冲突，JVM 必须引入同步机制（例如加锁）来保证任何时刻只有一个线程能成功分配这块内存。在高并发系统中，这种锁竞争会成为严重的性能瓶颈，极大地降低应用程序的吞吐量。

为了解决这个问题，JVM 的设计者们引入了一种高效的内存分配优化技术——**本地分配缓冲（Local Allocation Buffer, LAB）**。其核心思想是为每个线程预先分配一小块私有的内存区域，用于满足该线程的小对象分配需求。这样，线程在自己的“领地”上分配内存时，就不再需要与其他线程竞争，从而避免了昂贵的同步开销。

LAB 主要有以下几种形式：

1. **TLAB (Thread-Local Allocation Buffer):** 线程本地分配缓冲区，供**应用程序线程**（执行 Java 代码的线程）使用，主要用于在 **Eden 区**分配新对象。**这是本文重点讨论的对象。**
2. **GCLAB (GC-Local Allocation Buffer):** 垃圾回收器本地分配缓冲区，供**GC 线程**使用，用于在垃圾回收过程中（如对象复制阶段）存放**存活对象**。
3. **PLAB (Promotion-Local Allocation Buffer):** 晋升本地分配缓冲区，也是供**GC 线程**使用，专门用于存放从年轻代\*\*晋升（Promotion）\*\*到老年代的对象。可以看作是 GCLAB 的一种特殊应用场景。

尽管 GCLAB 和 PLAB 对 GC 效率至关重要，但与应用程序开发者关系最紧密、对应用程序性能影响最直接的是 TLAB。因此，本教程将深入探讨 TLAB 的原理、机制、相关源码以及配置。

**阅读前提：** 假设读者已具备 Java 基础、了解 JVM 内存结构（堆、栈、方法区、Eden、Survivor、老年代等）和基本的垃圾回收概念。

## 二、 直面挑战：并发环境下的堆内存分配

在引入 TLAB 之前，我们先来详细分析一下多线程环境下直接在堆上分配内存会遇到哪些问题。

假设 JVM 使用的是最简单的\*\*指针碰撞（Pointer Bump）\*\*分配方式：用一个指针 `top` 指向 Eden 区下一个可用的内存地址。分配内存时，只需检查剩余空间是否足够，如果足够，就将 `top` 指针向后移动对象大小的距离，并将对象数据写入 `[原来的 top, 新的 top)` 这个区间。

```
   Eden 区:
   +---------------------------------------------+
   | 已分配区域 | 空闲区域                      |
   +---------------------------------------------+
                 ^
                 |
                top 指针 (下一个可用地址)

   分配一个大小为 size 的对象:
   1. 检查 top + size 是否超出 Eden 区边界
   2. 如果未超出:
      a. 记录分配的起始地址 old_top = top
      b. 更新 top = top + size
      c. 返回 old_top 作为对象地址
   3. 如果超出: 可能触发 GC 或报错


```

在单线程环境下，指针碰撞非常高效。但在多线程环境下：

* **线程安全问题：** 线程 A 检查 `top` 可用，准备移动指针。但在它移动之前，线程 B 也检查 `top` 可用，并抢先移动了指针。这时线程 A 再移动指针，就会覆盖掉线程 B 分配的内存区域，导致数据错乱。
* **解决方案：加锁同步：** 为了保证原子性，必须在检查和移动 `top` 指针的整个操作期间加锁。例如，使用 CAS（Compare-and-Swap）或者互斥锁。
* **性能瓶颈：** 锁本身就有开销。在高并发场景下，大量线程争抢同一把锁，会导致大量线程阻塞等待，分配效率急剧下降，成为系统的性能瓶颈。

虽然 JVM 也可以采用\*\*空闲列表（Free List）\*\*等其他分配方式，但它们同样需要在并发环境下解决线程安全和效率问题，通常也需要同步机制。

因此，无论采用哪种具体的分配策略，直接在共享的堆内存区域（如 Eden 区）进行高并发的对象分配，都会面临严重的性能挑战。

## 三、 TLAB：线程独享的内存分配“快车道”

TLAB 的出现就是为了解决上述并发分配的性能瓶颈。它的核心思想非常直观：**给每个线程分配一小块专属的内存区域（缓冲区），线程优先在自己的缓冲区里分配对象。**

**TLAB 的工作流程：**

1. **TLAB 启用：** JVM 启动时，如果开启了 TLAB（默认是开启的，可通过 `-XX:+UseTLAB` 控制），会为每个新创建的应用程序线程分配一个 TLAB。
2. **TLAB 位置：** TLAB 是从 **Eden 区**划分出来的。可以想象成 Eden 区被切分成了很多小块，大部分被分配给了各个线程作为 TLAB，可能还剩下一小部分作为共享的分配区域（用于 TLAB 耗尽时的分配或大对象分配）。
3. **对象分配：**
   * 当线程需要分配一个**小对象**时，它首先尝试在**自己的 TLAB** 中进行分配。
   * TLAB 内部通常也使用**指针碰撞**的方式进行分配。因为 TLAB 是线程独享的，所以在 TLAB 内部进行指针碰撞**完全不需要任何同步**，速度极快。
   * 线程持有一个指向 TLAB 当前可用内存顶部的指针（通常称为 `top`）和一个指向 TLAB 结束位置的指针（通常称为 `end`）。分配时，只需比较 `top + object_size` 是否小于等于 `end`，如果是，则移动 `top` 指针即可。
4. **TLAB 耗尽（Refill）：**
   * 如果 TLAB 剩余空间不足以容纳要分配的对象，或者 TLAB 完全用完，线程就需要**申请一个新的 TLAB**。
   * 申请新 TLAB 的过程**需要同步**，因为它涉及到从共享的 Eden 区获取一块新的内存。但相比于每次分配小对象都进行同步，申请 TLAB 的频率要低得多（只有当 TLAB 用完时才需要）。这大大减少了锁竞争的次数。
   * JVM 会根据一定的策略计算新 TLAB 的大小，并更新线程的 TLAB 信息（新的 `start`, `top`, `end` 指针）。
5. **TLAB 分配失败（大对象）：**
   * 如果要分配的对象**太大**，超过了 TLAB 的容量（甚至可能超过了单个 TLAB 的最大允许大小），那么这个对象就**不会在 TLAB 中分配**。
   * JVM 会尝试直接在 **Eden 区的共享部分**（如果还有空间）进行分配。这个过程可能需要加锁。
   * 如果 Eden 区也放不下，或者对象本身就是超大对象（例如巨大的数组），则可能直接在**老年代**分配（这取决于具体的 GC 策略）。
6. **TLAB 退休（Retirement）：**
   * 当一个 TLAB 被用尽并申请了新的 TLAB，或者线程退出时，旧的 TLAB 就“退休”了。
   * 退休时，TLAB 中可能还剩下一些**无法利用的、非常小的碎片空间**。

**TLAB 的优势：**

* **显著提升分配性能：** 通过在线程本地无锁分配，极大地提高了小对象的分配速度。
* **减少锁竞争：** 将大部分分配操作从需要全局锁的共享区域转移到了无锁的本地缓冲区，显著降低了线程间的同步开销。
* **提高 CPU 缓存命中率：** 线程倾向于在自己的 TLAB（一块连续内存）上操作，更容易利用 CPU 缓存。

**形象比喻：**

想象一个大仓库（Eden 区），有很多工人（线程）需要领取小零件（分配小对象）。

* **没有 TLAB：** 所有工人都去同一个零件箱（共享 Eden 区）领取，大家挤在一起，互相等待，效率低下（锁竞争）。
* **有了 TLAB：** 管理员（JVM）给每个工人（线程）发了一个私人的小工具箱（TLAB）。工人需要小零件时，先在自己的工具箱里拿，速度飞快，互不干扰。只有当工具箱空了，工人才需要去仓库管理员那里排队领一个新的工具箱（TLAB Refill，需要同步但频率低）。如果工人需要一个非常大的零件（大对象），他的小工具箱放不下，还是得直接去仓库申请（直接在 Eden 或老年代分配，可能需要同步）。

## 四、 TLAB 分配机制深入剖析

现在我们更深入地探讨 TLAB 分配过程中的一些关键细节。

### 1. 指针碰撞（Pointer Bump）

这是 TLAB 内部最常用的分配方式。每个线程的 TLAB 由三个核心指针（或变量）维护：

* `start`: 指向 TLAB 内存区域的起始地址。
* `top`: 指向 TLAB 中**下一个可用**内存的地址。新对象将从这里开始分配。
* `end`: 指向 TLAB 内存区域的结束地址（通常是开区间或闭区间的末尾）。

分配 `size` 大小的对象（假设已对齐）：

```
if (top + size <= end) {
    // 空间足够
    HeapWord* obj_address = top; // 记录对象起始地址
    top = top + size;            // 移动 top 指针 (核心操作)
    // 初始化对象头等...
    return obj_address;
} else {
    // TLAB 空间不足，需要 Refill 或直接分配
    return allocate_in_eden_or_elsewhere(size);
}


```

这个过程非常简单，主要是地址比较和指针移动，CPU 执行效率极高。

### 2. TLAB Refill（重新填充）

当 `top + size > end` 时，表示当前 TLAB 空间不足。线程需要执行 TLAB Refill 操作，向 JVM 申请一块新的内存作为新的 TLAB。

* **触发时机：** 当前 TLAB 无法满足本次分配请求。
* **同步：** Refill 操作需要访问共享的 Eden 区，因此**必须进行同步**，以确保线程安全。JVM 通常会使用 CAS 或锁来保证只有一个线程能成功分配到某块 Eden 内存。
* **新 TLAB 大小：** 新 TLAB 的大小不是固定的。JVM 会根据**动态策略**来调整：
  + **初始大小：** 可能有一个默认的初始 TLAB 大小。
  + **动态调整：** JVM 会监控每个线程的分配速率。如果一个线程很快就用完了 TLAB，下次可能会给它分配一个更大的 TLAB；反之，如果一个 TLAB 用了很久才用完，或者退休时浪费了很多空间，下次可能会分配一个较小的 TLAB。目标是在减少 Refill 次数（增大 TLAB）和减少空间浪费（减小 TLAB）之间取得平衡。相关 JVM 参数如 `-XX:TLABSize` (固定大小或初始大小) 和 `-XX:+ResizeTLAB` (是否允许动态调整)。
* **更新指针：** Refill 成功后，线程的 `start`, `top`, `end` 指针会被更新为指向新的 TLAB 区域。 `top` 通常会初始化为新的 `start`。

### 3. TLAB 浪费与填充对象 (Filler Object)

当一个 TLAB 因为耗尽而被替换，或者线程退出时，这个 TLAB 就完成了它的使命。此时，从 `top` 指针到 `end` 指针之间可能还**剩余一小块内存**，这块内存太小，无法满足下一次可能的最小对象分配，或者线程已经不再需要它了。这部分未使用的空间就是所谓的 **TLAB 浪费（Waste）**。

**理解难点：为何需要处理浪费的空间？直接留空不行吗？**

直接留空会给后续的**垃圾回收**带来麻烦。GC 在扫描堆内存时，需要能够准确地识别哪些是对象，哪些是空闲空间。如果在 TLAB 的末尾留下一段大小不一的、未初始化的空白区域，GC 扫描到这里时就难以判断这块区域的状态。

为了解决这个问题，JVM 通常会在 TLAB 退休时，将这块剩余的、无法利用的小空间用一个特殊的\*\*“填充对象（Dummy/Filler Object）”\*\*填满。

* **填充对象的类型：** 通常是一个极小的、无实际意义的对象，例如一个特殊类型的数组（如 `int[0]` 或 `byte[]`，长度根据剩余空间计算得出），或者一个特殊的 `oop` (Ordinary Object Pointer) 标记。
* **填充的目的：** 确保 TLAB 内从 `start` 到原始 `end`（或实际使用的 `top`）之间的所有内存都包含有效的对象（要么是用户分配的对象，要么是最后的填充对象）。这样，GC 扫描时就能方便地、连续地处理整个 TLAB 区域，知道哪里是对象的结束，简化了 GC 的实现。
* **浪费的计算：** 这部分被填充对象占用的空间，以及因为对齐等原因损失的空间，共同构成了 TLAB 的浪费。JVM 会统计这些浪费，并可能作为动态调整 TLAB 大小的依据之一。

所以，填充对象不是为了别的，主要是为了**方便 GC 进行统一处理**，保持堆内存布局的规整性。

### 4. 大对象分配

TLAB 主要服务于小对象的快速分配。如果一个对象太大，不适合放入 TLAB（比如超过 TLAB 剩余空间，或者超过 `-XX:TLABWasteTargetPercent` 计算出的阈值，或者本身就是Humongous Object），JVM 会选择不同的分配路径：

1. **尝试在 Eden 区直接分配：** JVM 会尝试在 Eden 区的共享部分（即未被划分为 TLAB 的区域）进行分配。这个过程需要加锁同步。
2. **直接在老年代分配：** 如果 Eden 区放不下，或者对象本身的大小达到了进入老年代的标准（由具体 GC 策略决定，如 G1 中的 Humongous Object），对象可能会被直接分配到老年代。

因此，大对象的分配通常比小对象要慢，因为它无法享受 TLAB 带来的无锁分配优化，并且可能需要更复杂的同步或直接进入老年代。

## 五、 JVM 参数调优 TLAB

JVM 提供了一些参数来控制 TLAB 的行为，了解它们有助于进行性能分析和调优：

* **`-XX:+UseTLAB`**: (默认开启) 是否启用 TLAB。在现代 JVM 和多核 CPU 环境下，几乎没有理由关闭它。关闭它 (`-XX:-UseTLAB`) 会导致所有对象都在堆上进行同步分配，性能会急剧下降。
* **`-XX:TLABSize=<size>`**: 设置 TLAB 的大小。可以指定一个固定的大小（单位：字节，支持 K, M, G 后缀）。如果设置为 0，JVM 会根据 `-XX:TLABWasteTargetPercent` 和 `-XX:MinTLABSize` 等参数自动计算初始大小。设置一个合适的固定大小可以减少动态调整的开销，但可能不适用于所有线程的分配模式。
* **`-XX:+ResizeTLAB`**: (默认开启) 是否允许 JVM 动态调整 TLAB 的大小。开启后，JVM 会根据线程的分配行为动态调整 TLAB 大小，试图在减少 Refill 次数和减少浪费之间找到平衡。
* **`-XX:TLABWasteTargetPercent=<percent>`**: (默认 1%) TLAB 允许浪费的空间占 TLAB 总大小的最大百分比。这个参数会影响 TLAB Refill 的决策。如果剩余空间小于这个百分比计算出的大小，即使还能放下一个小对象，也可能触发 Refill，以避免浪费过多空间。它也间接影响动态 TLAB 的大小调整。
* **`-XX:MinTLABSize=<size>`**: (默认约 2K) 最小允许的 TLAB 大小。防止 TLAB 缩得太小，导致 Refill 过于频繁。
* **`-XX:TLABRefillWasteFraction=<fraction>`**: (默认 64) 控制 TLAB Refill 时能容忍的最大浪费比例。粗略地说，如果请求分配的对象大小 `sz`，而 TLAB 剩余空间 `rem` 小于 `TLABSize / TLABRefillWasteFraction`，即使 `rem >= sz`，也可能会触发 Refill，认为剩余空间太小，不如重新申请。这个参数影响 Refill 的“吝啬”程度。
* **`-XX:+PrintTLAB`**: (诊断参数) 打印 TLAB 相关的信息，如每个线程 TLAB 的分配、Refill、浪费等情况。可以配合 `-XX:+PrintGCDetails` 使用，用于分析 TLAB 的使用效率和潜在问题。
* **`-XX:TLABAllocationWeight=<weight>`**: (不常用) 用于动态调整 TLAB 大小时，给当前线程分配速率赋予的权重。

**调优建议：**

* 通常情况下，**保持默认设置** (`+UseTLAB`, `+ResizeTLAB`) 是比较好的选择，JVM 的动态调整机制已经比较成熟。
* **不建议轻易关闭 TLAB**。
* 如果通过 `-XX:+PrintTLAB` 和性能分析工具发现 TLAB Refill 非常频繁，或者 TLAB 浪费比例过高，可以**尝试调整** `TLABSize` (如果禁用了 Resize) 或影响动态调整的参数（如 `TLABWasteTargetPercent`, `MinTLABSize`, `TLABRefillWasteFraction`），但这需要基于实际的应用负载和性能监控数据进行，盲目调整可能适得其反。例如，增大 `MinTLABSize` 或减小 `TLABRefillWasteFraction` 可能减少 Refill 次数，但可能增加浪费。

## 六、 源码探索：TLAB 分配的核心逻辑

为了更深入地理解 TLAB，我们来看一下 OpenJDK HotSpot 虚拟机（以 Java 8 或 11 附近版本为例，具体实现可能随版本演进）中与 TLAB 分配相关的部分 C++ 源码片段，并附上中文注释。

**注意：** 这只是示意性的代码片段，真实源码结构更复杂，并可能因 GC 实现（如 Parallel Scavenge, G1, ZGC）而有所不同。

### 场景 1: 尝试在 TLAB 中分配 (快速路径)

这部分逻辑通常发生在 `CollectedHeap::allocate_new_tlab` 之后获取到 TLAB，或者在尝试分配小对象的核心路径上。线程对象 (`Thread`) 中通常会持有 `ThreadLocalAllocBuffer` 的实例。

```
// 位于某个分配函数内部，尝试在当前线程的 TLAB 中分配
// size: 需要分配的对象大小（通常已经过对齐处理）
// thread: 当前线程对象

ThreadLocalAllocBuffer& tlab = thread->tlab(); // 获取当前线程的 TLAB 对象

// 关键的指针碰撞分配逻辑
HeapWord* obj = tlab.allocate(size); // 尝试在 TLAB 中分配

if (obj != NULL) {
  // 分配成功！ (快速路径)
  // obj 指向分配到的内存地址
  // 在这里可以进行对象的初始化等操作...
  return obj; // 返回分配到的对象指针
} else {
  // TLAB 分配失败 (通常是空间不足)
  // 需要进入慢速分配路径 (TLAB Refill 或直接在 Eden 分配)
  return allocate_slow_path(thread, size);
}

// --- ThreadLocalAllocBuffer::allocate 方法的大致实现 ---
// in threadLocalAllocBuffer.hpp / .cpp

inline HeapWord* ThreadLocalAllocBuffer::allocate(size_t size) {
  // 获取 TLAB 的关键指针
  HeapWord* top_ptr = top();         // 当前可用内存顶部
  HeapWord* end_ptr = end();         // TLAB 结束地址

  // **核心：指针碰撞检查**
  if (pointer_delta(end_ptr, top_ptr) >= size) { // 比较剩余空间是否 >= 请求大小
    // 空间足够！
    HeapWord* obj_buf = top_ptr;     // 记录分配的起始地址
    // **核心：移动 top 指针**
    set_top(top_ptr + size);         // 更新 top 指针，完成分配

    // assert(top() <= end(), "TLAB overflow"); // 断言检查，防止 top 超越 end

    return obj_buf; // 返回分配到的内存地址
  } else {
    // 空间不足
    return NULL; // 返回 NULL，通知上层分配失败
  }
}


```

**理解帮助：**

* `HeapWord*` 是 HotSpot VM 中表示堆内存地址的基本类型。
* `pointer_delta` 用于计算两个指针之间的距离（以 `HeapWord` 为单位）。
* `allocate` 方法的核心就是比较剩余空间和移动 `top` 指针，非常轻量级。
* 这个 `allocate` 函数本身是**无锁**的，因为它操作的是线程本地的 `top` 和 `end` 指针。

### 场景 2: TLAB 分配失败后的慢速路径与 Refill

当 `tlab.allocate(size)` 返回 `NULL` 时，表示 TLAB 空间不足，需要进入慢速路径。慢速路径会尝试分配一个新的 TLAB（Refill），如果 Refill 成功，则在新 TLAB 上再次尝试分配；如果 Refill 失败或对象太大，则尝试直接在 Eden 区分配。

```
// 伪代码示意 TLAB 分配失败后的处理流程
HeapWord* allocate_slow_path(Thread* thread, size_t size) {
  HeapWord* result = NULL;
  size_t new_tlab_size = 0; // 用于计算新 TLAB 的大小

  // 1. 尝试 Refill TLAB
  //    a. 首先，"退休" 当前的 TLAB (如果里面还有剩余空间，用 filler object 填充)
  thread->tlab().retire(); // 注意：retire 内部可能需要填充浪费空间

  //    b. 计算新 TLAB 的大小 (基于动态策略)
  new_tlab_size = calculate_new_tlab_size(thread); // 根据历史分配率等计算

  //    c. 尝试从 Eden 区分配一块内存作为新的 TLAB
  //       这个过程需要同步 (例如，通过 CollectedHeap::allocate_new_tlab)
  result = CollectedHeap::allocate_new_tlab(thread, new_tlab_size);

  if (result != NULL) {
    // Refill 成功！获得了新的 TLAB (result 指向新 TLAB 的起始)
    // 设置线程的 TLAB 指针 (start, top, end)
    thread->tlab().fill(result, new_tlab_size); // 用新分配的内存填充 TLAB 结构

    // **再次尝试在新的 TLAB 中分配** (使用之前的 allocate 逻辑)
    result = thread->tlab().allocate(size);
    if (result != NULL) {
      // 在新 TLAB 中分配成功！
      return result;
    } else {
      // 即使在新的 TLAB 中也分配失败 (可能是请求的 size 太大，超过了新 TLAB)
      // Fallthrough to direct Eden allocation
    }
  }

  // 2. Refill 失败 或 对象太大无法在 TLAB 分配，尝试直接在 Eden 分配
  //    这个过程需要加锁 (e.g., EdenMutex) 或使用 CAS
  result = CollectedHeap::allocate_in_eden(thread, size); // 尝试在共享 Eden 区分配

  if (result != NULL) {
    // Eden 直接分配成功
    return result;
  } else {
    // Eden 也分配失败 (空间不足)
    // 可能需要触发 GC
    return handle_allocation_failure(thread, size); // 触发 GC 或抛出 OOM
  }
}

// --- ThreadLocalAllocBuffer::retire 方法的大致作用 ---
// in threadLocalAllocBuffer.hpp / .cpp

void ThreadLocalAllocBuffer::retire() {
  if (waste() > 0) { // 如果 TLAB 中还有剩余空间 (top < end)
    // **用填充对象 (filler object) 填满剩余空间**
    CollectedHeap::fill_with_dummy_object(top(), waste());
    // 更新统计信息等...
  }
  // 重置 TLAB 状态 (start, top, end 都设为 NULL 或 0)
  reset();
}


```

**理解帮助：**

* 慢速路径比快速路径复杂得多，涉及 TLAB 的退休、新大小计算、**同步的堆分配** (`allocate_new_tlab`, `allocate_in_eden`) 以及可能的 GC 触发。
* `CollectedHeap::allocate_new_tlab` 和 `CollectedHeap::allocate_in_eden` 是关键的**需要同步**的操作，它们负责从共享的 Eden 空间中安全地划分内存。这正是 TLAB 机制想要尽量避免频繁调用的地方。
* `retire()` 方法中的 `fill_with_dummy_object` 体现了填充 TLAB 浪费空间的需求，以方便 GC 处理。

通过阅读（简化的）源码，我们可以更具体地看到 TLAB 如何通过区分快速路径（无锁指针碰撞）和慢速路径（同步 Refill 或 Eden 分配）来优化对象分配的性能。

## 七、 GCLAB 与 PLAB 简介

虽然本文重点是 TLAB，但简单了解 GCLAB 和 PLAB 有助于我们理解 LAB 思想的一致性。

* **GCLAB (GC-Local Allocation Buffer):**

  + **背景：** 在使用**复制算法**（如 Parallel Scavenge 的 Minor GC, G1 的 Mixed GC）或**标记-复制**算法进行垃圾回收时，多个 GC 线程需要将存活的对象从源区域（如 Eden, Survivor From）复制到目标区域（如 Survivor To, Old Gen）。
  + **问题：** 如果所有 GC 线程都直接在目标区域的共享空间上分配内存来放置复制的对象，同样会遇到类似 TLAB 场景的**同步开销和锁竞争**问题。
  + **解决方案：** 为**每个 GC 线程**分配一个 GCLAB。GCLAB 是从**目标内存区域**（Survivor To 或 Old Gen）划分出来的。GC 线程在复制对象时，优先将对象复制到自己的 GCLAB 中，同样使用快速的指针碰撞。只有当 GCLAB 用完时，才需要同步申请新的 GCLAB。
  + **目的：** 加速并行 GC 的对象复制阶段，提高 GC 效率。
* **PLAB (Promotion-Local Allocation Buffer):**

  + **背景：** 对象晋升（Promotion）是对象复制的一种特殊情况，特指对象从年轻代（Eden/Survivor）被复制到老年代。
  + **机制：** PLAB 本质上就是 GCLAB 的一种，只不过它的内存是从**老年代**划分出来的，专门用于 GC 线程放置**晋升的对象**。
  + **目的：** 优化并行 GC 中对象晋升的效率，减少 GC 线程在老年代分配空间时的同步。

**总结：** GCLAB 和 PLAB 将 TLAB 的思想应用到了 GC 过程中，核心都是**通过为工作线程（这里是 GC 线程）提供本地缓冲区来避免在共享区域分配内存时的同步开销，从而提升并行处理的效率。**

## 八、 总结与关键要点

本地分配缓冲（LAB），特别是线程本地分配缓冲（TLAB），是现代 JVM 中一项至关重要的内存分配优化技术。它深刻地影响着 Java 应用程序的性能，尤其是在高并发场景下。

**关键要点回顾：**

1. **核心目的：** 解决多线程并发在堆上分配对象时的锁竞争问题，提高分配效率。
2. **TLAB 原理：** 为每个应用程序线程在 Eden 区预留一小块私有内存（TLAB），线程优先使用无锁的指针碰撞在 TLAB 内分配小对象。
3. **性能优势：** 大幅减少内存分配的同步开销，提升应用程序吞吐量。
4. **机制细节：**
   * **快速路径：** TLAB 内无锁指针碰撞。
   * **慢速路径：** TLAB 耗尽时进行同步的 Refill 操作，或对于大对象进行同步的 Eden/Old Gen 直接分配。
   * **动态调整：** TLAB 大小通常会根据线程分配行为动态调整。
   * **填充对象：** TLAB 退休时会用填充对象填满浪费空间，以方便 GC。
5. **相关参数：** `-XX:+UseTLAB` (总开关), `-XX:+ResizeTLAB` (动态调整), `-XX:TLABSize`, `-XX:TLABWasteTargetPercent` 等可用于监控和微调。
6. **GCLAB/PLAB：** 将 LAB 思想应用于 GC 线程，加速并行 GC 中的对象复制和晋升。
