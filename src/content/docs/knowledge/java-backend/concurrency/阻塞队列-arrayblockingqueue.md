---
title: "阻塞队列-ArrayBlockingQueue"
description: "java.util.concurrent (JUC) 包提供了多种阻塞队列的实现，其中 ArrayBlockingQueue 以其有界、基于数组和线程安全的特性，在需要精确控制资源和流量的场景中扮演着重要角色。"
sourceId: "147398714"
source: "https://blog.csdn.net/qq_45852626/article/details/147398714"
sourceSeries:
  - "JUC"
category: java-backend
subcategory: concurrency
tags:
  - "JUC"
  - "算法"
status: draft
difficulty: intermediate
contentType: knowledge
sidebar:
  order: 147398714
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/147398714)（历史文章导入，当前状态为草稿）

## ArrayBlockingQueue 深度解析：从入门到原理

## 1. 前言

`java.util.concurrent` (JUC) 包提供了多种阻塞队列的实现，其中 `ArrayBlockingQueue` 以其**有界**、**基于数组**和**线程安全**的特性，在需要精确控制资源和流量的场景中扮演着重要角色。

## 2. 初识 ArrayBlockingQueue：是什么与为什么？

### 2.1 什么是 ArrayBlockingQueue？

`ArrayBlockingQueue` 是 `java.util.concurrent` 包提供的一个**有界阻塞队列**。顾名思义，它的内部实现基于**数组**结构，并且在创建时必须指定一个**固定的容量**，这个容量在队列创建后**不可改变**。

我们可以把它想象成一个固定长度的管道或者传送带：

* **固定长度 (有界):** 这个管道的长度在你创建它的时候就定死了，比如只能同时容纳 10 个物品。不能多也不能少，长度无法动态调整。
* **管道 (队列):** 物品（元素）从管道的一端放入（入队），从另一端取出（出队），遵循**先进先出 (FIFO)** 的原则，就像排队一样。
* **自动管理进出 (阻塞):**
  + 如果管道满了，想再往里放东西的生产者线程会被自动“卡住”（阻塞），直到管道里有空位。
  + 如果管道空了，想从里面取东西的消费者线程也会被自动“卡住”（阻塞），直到管道里有新的东西进来。
* **多人协作安全 (线程安全):** 可以有很多生产者同时往管道里放东西，也可以有很多消费者同时取东西，`ArrayBlockingQueue` 内部有机制确保这个过程不会出错（比如两个人不会拿到同一个东西，或者放东西时不会把数据搞乱）。

### 2.2 为什么需要 ArrayBlockingQueue？它的核心价值

`ArrayBlockingQueue` 的核心价值在于其**有界性**和**阻塞性**带来的天然**流控**和**背压 (Back Pressure)** 能力。

在经典的**生产者-消费者**模型中，生产者负责生产数据（或任务），消费者负责处理数据（或任务）。两者之间通常需要一个缓冲区来解耦。

* **解耦:** 生产者不需要直接调用消费者，消费者也不需要直接向生产者请求。它们都只与缓冲区（队列）交互。这降低了两者之间的依赖。
* **平衡速率:** 生产者的生产速率和消费者的处理速率往往不一致。队列作为缓冲区可以吸收短时间内的速率波动。

**`ArrayBlockingQueue` 在此模型中的优势：**

1. **流量控制/背压:** 这是 `ArrayBlockingQueue` 最重要的特性之一。由于容量固定，当生产速度持续快于消费速度时，队列会逐渐填满。一旦队列满了，`put` 操作会阻塞生产者线程。这就像给生产者踩了刹车，自然地限制了生产速率，防止过多的数据堆积导致内存耗尽或其他资源问题。这种由下游（队列满）向上游（生产者）传递的压力就称为“背压”。反之，如果队列为空，`take` 操作会阻塞消费者，避免消费者空转浪费 CPU。
2. **资源限制:** 在资源有限的系统中，使用有界队列可以明确地限制待处理任务或数据的数量，防止系统因负载过高而崩溃。你知道最多只会有 `capacity` 个元素在队列中等待，内存占用是可预测的。
3. **简单可预测:** 基于数组的实现相对简单，内存是连续分配的。其行为（阻塞、FIFO）也比较直观和可预测。

**简单来说，当你需要一个容量固定、能自动调节生产者和消费者速度、确保线程安全的 FIFO 缓冲区时，`ArrayBlockingQueue` 是一个非常好的选择。**

## 3. ArrayBlockingQueue 的核心特点详解

`ArrayBlockingQueue` 的行为和特性可以总结为以下几点：

1. **有界性 (Bounded):**

   * 必须在创建时指定容量 (`capacity`)。
   * 容量一旦设定，终生不变。无法动态扩容或缩容。
   * 队列最多只能持有 `capacity` 个元素。
2. **阻塞性 (Blocking):** 这是其作为“阻塞队列”的核心特征。

   * **入队阻塞:** 当队列已满时，尝试向队列中添加元素（如使用 `put()` 方法）的线程将被阻塞，直到队列中有空间被腾出（即有元素被消费者取出）。
   * **出队阻塞:** 当队列为空时，尝试从队列中获取元素（如使用 `take()` 方法）的线程将被阻塞，直到队列中有新的元素被加入（即有元素被生产者放入）。
   * **超时阻塞:** `offer(e, time, unit)` 和 `poll(time, unit)` 方法提供了带超时的阻塞。线程会等待指定的时间，如果在时间内条件满足（队列不满或不空），则操作成功；如果超时，则操作失败（返回 `false` 或 `null`），线程不再继续等待。
3. **线程安全 (Thread-Safe):**

   * `ArrayBlockingQueue` 的所有公共方法都是线程安全的。你可以在多个线程中并发地访问同一个 `ArrayBlockingQueue` 实例，而无需进行额外的外部同步。
   * 内部通过 `java.util.concurrent.locks.ReentrantLock` 实现互斥访问，确保对队列状态（元素数量、读写指针）和内部数组的操作是原子的，并且保证内存可见性。
4. **FIFO 顺序:**

   * 元素按照先进先出（First-In, First-Out）的顺序进行存储和检索。队头（Head）的元素是最先进入队列的，队尾（Tail）的元素是最后进入队列的。`take()`, `poll()`, `peek()` 等操作检索的是队头元素，而 `put()`, `offer()` 等操作将元素添加到队尾。
5. **公平性可选 (Optional Fairness):**

   * 可以在构造 `ArrayBlockingQueue` 时选择锁的公平策略。
   * **公平策略 (`fair = true`):** 等待时间最长的线程将优先获得锁和队列的访问权。这可以防止线程饥饿，保证每个等待的线程最终都能得到服务。实现上通常基于某种排队机制。
   * **非公平策略 (`fair = false`, 默认):** 锁的获取顺序是不确定的，新请求锁的线程可能“插队”到等待队列的前面。这可能导致某些线程长时间等待，但通常能提供更高的整体吞吐量，因为它减少了线程上下文切换和管理的开销。
   * **选择依据:** 如果业务场景对公平性有严格要求（例如，保证任务处理的顺序性与请求到达顺序一致），则选择公平模式。如果更看重整体性能和吞吐量，并且能接受一定程度的饥饿风险，则选择默认的非公平模式。

**个人理解小结:**

想象一个严格的单车道收费站 (`ArrayBlockingQueue`)，车道长度固定 (`capacity`)。

* **有界:** 车道只能停固定数量的车。
* **阻塞:**
  + 车道满了 (`put` 阻塞)，后面的车就得在入口外等着。
  + 车道空了 (`take` 阻塞)，想出收费站的车（如果有的话，虽然这里比喻不太恰当，但对应的是消费者）也得等着有车进来。
  + 可以设置等待超时 (`offer`/`poll` 超时)，等一定时间还没空位/没车就放弃。
* **线程安全:** 收费站只有一个收费员 (`ReentrantLock`) 控制抬杆，保证同一时间只有一辆车能通过（进或出），不会乱套。
* **FIFO:** 先到车道的车先出收费站。
* **公平性:**
  + 公平 (`fair=true`): 入口外等待的车严格按到达顺序排队进入车道。
  + 非公平 (`fair=false`): 后来的车如果运气好，可能比先来的车更早抢到空位进入车道。

## 4. ArrayBlockingQueue vs. LinkedBlockingQueue：如何选择？

`LinkedBlockingQueue` 是 `BlockingQueue` 接口的另一个常用实现。了解它与 `ArrayBlockingQueue` 的区别，有助于我们在合适的场景做出正确的选择。

| 特性 | ArrayBlockingQueue | LinkedBlockingQueue |
| --- | --- | --- |
| **内部结构** | 基于**数组 (Array)** | 基于**链表 (Linked List)** |
| **容量** | **有界 (Bounded)**，必须在创建时指定 | **可选有界/无界**。默认无界 (`Integer.MAX_VALUE`)，也可指定容量 |
| **锁机制** | **单个 ReentrantLock** (控制 put 和 take) | **两个 ReentrantLock** (`putLock`, `takeLock`) |
| **公平性** | **可选** (构造时指定 `fair` 参数) | **不支持** (天生非公平) |
| **并发性能** | **中/低** (单锁导致生产者消费者竞争) | **高** (双锁分离，生产者消费者可并行) |
| **内存占用** | **固定** (创建时分配整个数组) | **动态** (按需创建节点，有额外节点对象开销) |

**详细对比与个人理解:**

1. **结构与容量:**

   * `ArrayBlockingQueue` 像一个固定大小的停车场，车位总数 (`capacity`) 从一开始就定好了，不能变。优点是管理简单，内存占用可预测。缺点是死板，不能动态调整。
   * `LinkedBlockingQueue` 更像一个可以无限延伸（默认）或者指定长度的单行道。默认情况下，只要内存够，车（元素/节点）可以一直往后排。这提供了更大的灵活性，但也隐藏着风险：如果生产者一直生产，消费者跟不上，可能导致内存溢出（OOM）。当然，你也可以在创建 `LinkedBlockingQueue` 时给它指定一个最大长度，让它变成有界的。
2. **锁机制与性能:** 这是两者性能差异的关键。

   * `ArrayBlockingQueue` 使用**一把锁** (`ReentrantLock`) 来保护整个队列。无论是生产者放东西 (`put`) 还是消费者取东西 (`take`)，都必须先获得这把唯一的锁。在高并发下，生产者和消费者会激烈争抢这把锁，就像很多人抢一个卫生间，容易成为性能瓶颈。
   * `LinkedBlockingQueue` 非常聪明地使用了**两把锁**：一把 `putLock` 控制元素的添加（队尾操作），一把 `takeLock` 控制元素的移除（队头操作）。生产者只需要获取 `putLock`，消费者只需要获取 `takeLock`。只要队列既不空也不满，生产者和消费者就可以**并行**地工作，互不干扰（或者干扰大大减少），大大提高了并发吞吐量。这就像有两个独立的入口和出口管理员，效率更高。
3. **公平性:**

   * `ArrayBlockingQueue` 允许你选择是否需要公平地对待等待线程。
   * `LinkedBlockingQueue` 的双锁设计使其难以实现全局的公平性（如何协调两个锁上的等待队列？），因此它只支持非公平模式。

**如何选择？**

* **选择 `ArrayBlockingQueue` 的场景:**
  + 需要严格控制内存使用和队列大小，行为可预测。
  + 对队列容量有明确的上限要求，且不希望动态改变。
  + 生产者和消费者的并发度不是非常高，单锁竞争不构成主要瓶颈。
  + 需要公平性策略的场景（虽然公平性会牺牲一部分性能）。
* **选择 `LinkedBlockingQueue` 的场景:**
  + 追求高并发、高吞吐量，希望生产者和消费者能最大程度地并行工作。
  + 队列容量难以预估，或希望队列能“尽可能大”（但要警惕无界队列的 OOM 风险！）。
  + 可以接受非公平策略（通常也是追求性能的选择）。
  + 当你需要一个有界队列且希望获得比 `ArrayBlockingQueue` 更高的吞吐量时，可以创建一个指定容量的 `LinkedBlockingQueue`。

**总结:** `LinkedBlockingQueue` 通常在高并发场景下提供更好的吞吐量（因为锁分离），而 `ArrayBlockingQueue` 则在需要严格有界和可选公平性时更具优势，且其
内存 
模型更简单。

## 5. ArrayBlockingQueue 快速上手：构造与基本操作

### 5.1 构造 ArrayBlockingQueue

`ArrayBlockingQueue` 提供了三个公共构造函数：

1. **`public ArrayBlockingQueue(int capacity)`**

   * **作用:** 创建一个具有指定 `capacity`（容量）的 `ArrayBlockingQueue`。
   * **特点:** 使用**非公平**的访问策略（这是默认行为）。
   * **示例:**

     ```
     BlockingQueue<String> queue = new ArrayBlockingQueue<>(10); // 容量为10，非公平


     + 1
     ```
2. **`public ArrayBlockingQueue(int capacity, boolean fair)`**

   * **作用:** 创建一个具有指定 `capacity`（容量）的 `ArrayBlockingQueue`，并允许指定访问策略（公平或非公平）。
   * **参数 `fair`:**
     + `true`: 队列按照 FIFO 的顺序授予等待线程访问权（**公平**策略）。
     + `false`: 访问顺序不确定（**非公平**策略）。
   * **示例:**

     ```
     BlockingQueue<Integer> fairQueue = new ArrayBlockingQueue<>(100, true); // 容量为100，公平
     BlockingQueue<Integer> nonFairQueue = new ArrayBlockingQueue<>(50, false); // 容量为50，非公平


     + 1
     + 2
     ```
3. **`public ArrayBlockingQueue(int capacity, boolean fair, Collection<? extends E> c)`**

   * **作用:** 创建一个具有指定 `capacity`、指定访问策略的 `ArrayBlockingQueue`，并使用给定集合 `c` 中的元素进行初始化。
   * **参数 `c`:** 包含初始元素的集合。队列的初始大小 (`count`) 就是集合 `c` 的大小。集合中的元素会按照其迭代器返回的顺序添加到队列中。
   * **注意:**
     + 指定的 `capacity` 必须大于或等于集合 `c` 的大小，否则会抛出 `IllegalArgumentException`。
     + 集合 `c` 及其元素不能为 `null`，否则会抛出 `NullPointerException`。
   * **示例:**

     ```
     List<String> initialElements = Arrays.asList("Apple", "Banana", "Cherry");
     // 容量必须 >= 3
     BlockingQueue<String> initializedQueue = new ArrayBlockingQueue<>(10, false, initialElements);
     // initializedQueue 现在包含 "Apple", "Banana", "Cherry"，容量为 10
     System.out.println(initializedQueue.size()); // 输出 3


     + 1
     + 2
     + 3
     + 4
     + 5
     ```

### 5.2 核心操作方法

`ArrayBlockingQueue` 实现了 `BlockingQueue` 接口，提供了多种添加和移除元素的方法，它们在队列满或空时的行为不同：

| 操作类型 | 抛出异常 | 特殊值 (null/false) | 阻塞 | 超时阻塞 |
| --- | --- | --- | --- | --- |
| **插入** | `add(e)` | `offer(e)` | `put(e)` | `offer(e, time, unit)` |
| **移除** | `remove()` | `poll()` | `take()` | `poll(time, unit)` |
| **检查** | `element()` | `peek()` | (不适用) | (不适用) |

**说明:**

1. **抛出异常 (Throws Exception):**

   * `add(e)`: 如果队列已满，无法添加元素，则抛出 `IllegalStateException("Queue full")`。基于 `offer()` 实现。
   * `remove()`: 如果队列为空，无法移除元素，则抛出 `NoSuchElementException`。基于 `poll()` 实现。
   * `element()`: 如果队列为空，无法获取队头元素，则抛出 `NoSuchElementException`。基于 `peek()` 实现。
   * *这类方法通常不推荐在并发场景下直接用于阻塞控制，因为需要外部处理异常。*
2. **特殊值 (Special Value):**

   * `offer(e)`: 尝试将元素 `e` 插入队列。如果队列已满，立即返回 `false`，表示失败；如果成功插入，返回 `true`。**非阻塞**。
   * `poll()`: 尝试移除并返回队头元素。如果队列为空，立即返回 `null`。**非阻塞**。
   * `peek()`: 返回队头元素，但不移除。如果队列为空，立即返回 `null`。**非阻塞**。
   * *这类方法适用于不希望线程阻塞的场景，需要检查返回值来判断操作是否成功。*
3. **阻塞 (Blocks):**

   * `put(e)`: 将元素 `e` 插入队列。如果队列已满，**线程将阻塞**，直到队列有空间可用。**可中断** (响应 `Thread.interrupt()`)。
   * `take()`: 移除并返回队头元素。如果队列为空，**线程将阻塞**，直到队列中有元素可用。**可中断**。
   * *这是实现生产者-消费者模式中最常用的方法，利用阻塞特性进行流量控制。*
4. **超时阻塞 (Times Out):**

   * `offer(e, time, unit)`: 尝试将元素 `e` 插入队列。如果队列已满，线程将**阻塞等待**指定的时间 (`time` 和 `unit` 定义时长)。如果在等待时间内队列出现空间，则插入元素并返回 `true`；如果在超时前未插入成功（队列一直满或被中断），则返回 `false`。
   * `poll(time, unit)`: 尝试移除并返回队头元素。如果队列为空，线程将**阻塞等待**指定的时间。如果在等待时间内队列出现元素，则移除并返回该元素；如果在超时前未获取到元素（队列一直空或被中断），则返回 `null`。
   * *这类方法提供了更灵活的阻塞策略，避免无限期等待。*

**示例:**

```
import java.util.concurrent.*;

public class ArrayBlockingQueueExample {
    public static void main(String[] args) throws InterruptedException {
        BlockingQueue<Integer> queue = new ArrayBlockingQueue<>(2); // 容量为 2

        // 1. offer (非阻塞添加)
        System.out.println("offer(1): " + queue.offer(1)); // true
        System.out.println("offer(2): " + queue.offer(2)); // true
        System.out.println("Queue: " + queue); // [1, 2]
        System.out.println("offer(3): " + queue.offer(3)); // false (队列已满)
        System.out.println("Queue: " + queue); // [1, 2]

        // 2. poll (非阻塞移除)
        System.out.println("poll(): " + queue.poll());     // 1
        System.out.println("Queue: " + queue); // [2]
        System.out.println("poll(): " + queue.poll());     // 2
        System.out.println("Queue: " + queue); // []
        System.out.println("poll(): " + queue.poll());     // null (队列为空)

        System.out.println("--------------------");

        // 3. put (阻塞添加) - 需要在另一个线程中演示阻塞效果
        // 这里简单演示添加
        queue.put(10);
        queue.put(20);
        System.out.println("Queue after puts: " + queue); // [10, 20]
        // 如果再执行 queue.put(30); 当前线程会阻塞

        // 4. take (阻塞移除)
        System.out.println("take(): " + queue.take());     // 10
        System.out.println("take(): " + queue.take());     // 20
        System.out.println("Queue after takes: " + queue); // []
        // 如果再执行 queue.take(); 当前线程会阻塞

        System.out.println("--------------------");

        // 5. offer 带超时
        System.out.println("offer(100, 1, TimeUnit.SECONDS): " + queue.offer(100, 1, TimeUnit.SECONDS)); // true
        System.out.println("offer(200, 1, TimeUnit.SECONDS): " + queue.offer(200, 1, TimeUnit.SECONDS)); // true
        System.out.println("Queue: " + queue); // [100, 200]
        long startTime = System.nanoTime();
        System.out.println("offer(300, 1, TimeUnit.SECONDS): " + queue.offer(300, 1, TimeUnit.SECONDS)); // false (等待1秒后返回)
        long duration = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startTime);
        System.out.println("offer(300) took approx: " + duration + " ms"); // 约 1000 ms

        // 6. poll 带超时
        System.out.println("poll(1, TimeUnit.SECONDS): " + queue.poll(1, TimeUnit.SECONDS)); // 100
        System.out.println("poll(1, TimeUnit.SECONDS): " + queue.poll(1, TimeUnit.SECONDS)); // 200
        System.out.println("Queue: " + queue); // []
        startTime = System.nanoTime();
        System.out.println("poll(1, TimeUnit.SECONDS): " + queue.poll(1, TimeUnit.SECONDS)); // null (等待1秒后返回)
        duration = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startTime);
        System.out.println("poll() took approx: " + duration + " ms"); // 约 1000 ms
    }
}


```

## 6. 深入内部：ArrayBlockingQueue 的实现原理

现在，让我们揭开 `ArrayBlockingQueue` 的神秘面纱，探究其内部是如何实现阻塞、线程安全以及处理队列满/空等情况的。

### 6.1 核心组件：锁与条件变量

`ArrayBlockingQueue` 的并发控制核心依赖于 `java.util.concurrent.locks` 包下的两个关键组件：

1. **`ReentrantLock lock`:** 一个可重入的互斥锁。

   * **作用:** 保护对队列内部状态（`items` 数组、`count`、`putIndex`、`takeIndex`）的所有访问。任何想要读取或修改这些状态的线程，都必须先获得这个 `lock`。
   * **机制:** 它保证了在任何时刻，最多只有一个线程能够持有锁并执行临界区代码（访问共享状态的代码）。其他尝试获取锁的线程会被阻塞，直到锁被释放。
   * **公平性:** 在构造 `ArrayBlockingQueue` 时传入的 `fair` 参数，就是用来初始化这个 `ReentrantLock` 是公平锁 (`new ReentrantLock(true)`) 还是非公平锁 (`new ReentrantLock(false)`)。
2. **`Condition notEmpty`:** 一个与 `lock` 绑定的条件变量。

   * **作用:** 用于管理因**队列为空**而等待的消费者线程。
   * **机制:** 当一个消费者线程尝试 `take()` 但发现队列为空时，它会在 `notEmpty` 条件上调用 `await()`。这个 `await()` 操作会原子地：
     1. 释放当前线程持有的 `lock`。
     2. 将当前线程置于 `notEmpty` 条件的等待队列中，并进入休眠状态。
   * **唤醒:** 当一个生产者线程成功 `put()` 一个元素（使队列从空变为非空）后，它会调用 `notEmpty.signal()`。这个 `signal()` 操作会从 `notEmpty` 的等待队列中唤醒**一个**正在等待的消费者线程。被唤醒的线程会尝试重新获取 `lock`，获取成功后从 `await()` 的地方继续执行（通常是再次检查队列是否为空）。
3. **`Condition notFull`:** 另一个与 `lock` 绑定的条件变量。

   * **作用:** 用于管理因**队列已满**而等待的生产者线程。
   * **机制:** 当一个生产者线程尝试 `put()` 但发现队列已满时，它会在 `notFull` 条件上调用 `await()`。这个 `await()` 同样会原子地释放 `lock` 并将线程置于 `notFull` 条件的等待队列中休眠。
   * **唤醒:** 当一个消费者线程成功 `take()` 一个元素（使队列从满变为非满）后，它会调用 `notFull.signal()`。这个 `signal()` 操作会从 `notFull` 的等待队列中唤醒**一个**正在等待的生产者线程。被唤醒的线程会尝试重新获取 `lock`，成功后继续执行（再次检查队列是否已满）。

**个人理解 - 锁与条件的协作:**

想象 `ArrayBlockingQueue` 是一个房间（临界区），里面有固定数量的箱子 (`items` 数组)。

* `ReentrantLock lock`: 是这个房间唯一的门锁。任何人想进房间操作箱子，必须先拿到钥匙 (`lock.lock()`)。一次只有一个人能持有钥匙。用完后必须归还钥匙 (`lock.unlock()`)。
* `Condition notEmpty`: 是房间里的一个“等待区”（告示牌：“箱子空了，请在此等候”）。想拿箱子（`take`）的人拿到钥匙进房间，发现没箱子可用，就把钥匙暂时还给门卫，去 `notEmpty` 等待区睡觉 (`notEmpty.await()`)。
* `Condition notFull`: 是房间里的另一个“等待区”（告示牌：“箱子满了，请在此等候”）。想放箱子（`put`）的人拿到钥匙进房间，发现没空位放，也把钥匙暂时还给门卫，去 `notFull` 等待区睡觉 (`notFull.await()`)。

**唤醒机制:**

* 当有人成功放入一个箱子后（房间从空变为不空），他会去 `notEmpty` 等待区喊一嗓子 (`notEmpty.signal()`)：“有箱子了！”，叫醒一个在等箱子的人。
* 当有人成功取走一个箱子后（房间从满变为不满），他会去 `notFull` 等待区喊一嗓子 (`notFull.signal()`)：“有空位了！”，叫醒一个在等空位的人。

被叫醒的人会再次尝试去拿门锁钥匙，拿到后才能继续操作。这种 `Lock + Condition` 的模式是 JUC 中实现精细化线程协作的经典方式，相比于 `synchronized + wait/notify/notifyAll`，它提供了更强的灵活性（可以有多个条件队列）和控制力。

### 6.2 如何实现阻塞功能？

正是基于上述的 `ReentrantLock` 和 `Condition` 机制，`ArrayBlockingQueue` 实现了其阻塞功能。

**以 `put(E e)` 为例：**

1. 生产者线程调用 `put(e)`。
2. 线程尝试获取 `lock`。如果锁已被其他线程持有，则当前线程阻塞，直到获取到锁。
3. 获取锁后，检查队列是否已满 (`count == items.length`)。
4. **如果队列已满:**
   * 调用 `notFull.await()`。
   * 当前线程释放 `lock`。
   * 当前线程进入 `notFull` 条件的等待队列，状态变为 `WAITING` 或 `TIMED_WAITING` (如果使用带超时的 `await` 版本)。线程挂起，不消耗 CPU。
5. **如果队列未满:**
   * 执行入队操作（将元素 `e` 放入 `items` 数组，更新 `putIndex` 和 `count`）。
   * 调用 `notEmpty.signal()` 唤醒一个可能在 `notEmpty` 上等待的消费者线程。
   * 释放 `lock` (`finally` 块中执行 `lock.unlock()`)。

**以 `take()` 为例：**

1. 消费者线程调用 `take()`。
2. 线程尝试获取 `lock`，可能阻塞。
3. 获取锁后，检查队列是否为空 (`count == 0`)。
4. **如果队列为空:**
   * 调用 `notEmpty.await()`。
   * 当前线程释放 `lock`。
   * 当前线程进入 `notEmpty` 条件的等待队列，挂起。
5. **如果队列不为空:**
   * 执行出队操作（从 `items` 数组获取元素，更新 `takeIndex` 和 `count`，将原位置设为 `null`）。
   * 调用 `notFull.signal()` 唤醒一个可能在 `notFull` 上等待的生产者线程。
   * 释放 `lock`。
   * 返回获取到的元素。

**关键点：**

* **条件检查在循环中:** 源码中检查条件（`count == items.length` 或 `count == 0`）通常是在 `while` 循环中进行的。这是为了防止**虚假唤醒 (Spurious Wakeup)**。有时线程可能在没有被 `signal()` 的情况下被唤醒，或者在被唤醒后到重新获取锁之间，条件又变回不满足状态。`while` 循环确保线程被唤醒后，必须重新检查条件，只有条件真正满足时才继续执行。
* **`await()` 原子地释放锁:** 这是 `Condition` 的关键。如果在检查条件后、进入等待前不释放锁，那么其他线程就无法进入临界区来改变队列状态（比如添加元素让队列不再为空），就会导致死锁。
* **`signal()` 唤醒对方:** 生产者操作满足了消费者等待的条件（队列非空），消费者操作满足了生产者等待的条件（队列非满），通过 `signal()` 精确唤醒对方等待队列中的一个线程，避免了 `notifyAll()` 可能带来的“惊群效应”（唤醒所有线程，但只有一个能继续，其他白白唤醒）。

### 6.3 如何保证线程安全？

`ArrayBlockingQueue` 的线程安全主要通过以下几点保证：

1. **互斥访问 (Mutual Exclusion):**

   * 核心武器是 `ReentrantLock`。所有对共享状态（`items`, `count`, `putIndex`, `takeIndex`）的访问（读或写）都必须在获取 `lock` 之后、释放 `lock` 之前进行。
   * 这确保了同一时间只有一个线程能修改这些共享变量，防止了多个线程同时修改导致的数据不一致（如 `count` 计算错误，`putIndex` 或 `takeIndex` 指向错误位置，或者在数组读写时发生竞态条件）。
2. **原子性 (Atomicity):**

   * 加锁使得一系列操作（如“检查容量 -> 放入元素 -> 更新 `putIndex` -> 增加 `count`”）组合成一个原子单元。这个单元要么完整执行不被打断，要么不执行，不会出现执行到一半被其他线程干扰的情况。
3. **内存可见性 (Memory Visibility):**

   * `ReentrantLock` 的 `lock()` 和 `unlock()` 操作具有 JMM (Java Memory Model) 中的 `happens-before` 关系。
   * 当一个线程 T1 调用 `unlock()` 释放锁时，它在此之前对共享变量的所有修改，对于后续成功获取**同一个锁**的线程 T2 来说，都是可见的。
   * 这意味着，当生产者线程释放锁后，它对 `items` 数组、`count`、`putIndex` 的修改，能被随后获取锁的消费者线程正确地看到。反之亦然。这保证了线程之间状态的正确同步，避免读到脏数据。
4. **状态依赖管理 (State Dependence):**

   * 通过 `Condition` (`notEmpty`, `notFull`) 来管理线程对队列状态的依赖。线程不再需要自己忙等待（不停地循环检查条件，浪费 CPU），而是可以在条件不满足时高效地挂起 (`await()`)，并在条件可能满足时由其他线程精确唤醒 (`signal()`)。
5. **安全的发布与初始化:**

   * `items` 数组、`lock`、`notEmpty`、`notFull` 都是 `final` 的（对于 `lock` 和 `Condition` 是 effectively final），并且在构造函数中正确初始化。这有助于确保对象状态在构造完成并发布给其他线程时是一致和可见的。

**个人理解总结:**

`ArrayBlockingQueue` 的线程安全策略可以概括为“一把大锁保平安，条件变量管等待”。

* **大门上锁 (`ReentrantLock`):** 进出房间（访问队列内部）必须拿钥匙，保证同一时间只有一人在里面，不会乱。
* **屋内协调 (`Condition`):** 房间里没东西拿或没地方放时，不去瞎转悠（忙等），而是去指定的等待区（`notEmpty`/`notFull`）睡觉，等别人弄好了叫醒你。
* **信息通畅 (Happens-before):** 拿钥匙和还钥匙这两个动作本身带有“信息广播”效果，保证前一个人走之前做的修改，下一个人进来时能看到。

这种方式简单直接，保证了强一致性，但在极高并发下，单锁可能成为瓶颈，这也是 `LinkedBlockingQueue` 采用双锁的原因。

### 6.4 如何处理队列满和队列空的情况？

处理队列满 (`count == items.length`) 和队列空 (`count == 0`) 的逻辑是阻塞机制的核心应用：

1. **处理队列满:**

   * **`put(e)`:**
     1. 获取 `lock`。
     2. `while (count == items.length)` 循环检查。
     3. 如果满，调用 `notFull.await()` 阻塞，释放锁并等待。
     4. 被唤醒后，重新获取锁，回到步骤 2 继续检查。
     5. 如果不满，执行入队 `enqueue(e)`，然后 `notEmpty.signal()` 唤醒消费者。
     6. 释放 `lock`。
   * **`offer(e)`:**
     1. 获取 `lock`。
     2. 检查 `if (count == items.length)`。
     3. 如果满，直接返回 `false`。
     4. 如果不满，执行入队 `enqueue(e)`，`notEmpty.signal()`，返回 `true`。
     5. 释放 `lock`。
   * **`offer(e, timeout, unit)`:**
     1. 获取 `lock` (可中断)。
     2. `while (count == items.length)` 循环检查。
     3. 如果满，调用 `notFull.awaitNanos(nanosTimeout)` 等待指定时间。
     4. 如果 `awaitNanos` 返回时超时（返回值 <= 0），表示等待超时且队列仍然满，跳出循环，最终返回 `false`。
     5. 如果被唤醒或未超时，回到步骤 2 继续检查。
     6. 如果不满，执行入队 `enqueue(e)`，`notEmpty.signal()`，返回 `true`。
     7. 释放 `lock`。
2. **处理队列空:**

   * **`take()`:**
     1. 获取 `lock`。
     2. `while (count == 0)` 循环检查。
     3. 如果空，调用 `notEmpty.await()` 阻塞，释放锁并等待。
     4. 被唤醒后，重新获取锁，回到步骤 2 继续检查。
     5. 如果不空，执行出队 `dequeue()`，然后 `notFull.signal()` 唤醒生产者。
     6. 释放 `lock`。
     7. 返回出队元素。
   * **`poll()`:**
     1. 获取 `lock`。
     2. 检查 `if (count == 0)`。
     3. 如果空，直接返回 `null`。
     4. 如果不空，执行出队 `dequeue()`，`notFull.signal()`，返回元素。
     5. 释放 `lock`。
   * **`poll(timeout, unit)`:**
     1. 获取 `lock` (可中断)。
     2. `while (count == 0)` 循环检查。
     3. 如果空，调用 `notEmpty.awaitNanos(nanosTimeout)` 等待指定时间。
     4. 如果 `awaitNanos` 返回时超时，表示等待超时且队列仍然空，跳出循环，最终返回 `null`。
     5. 如果被唤醒或未超时，回到步骤 2 继续检查。
     6. 如果不空，执行出队 `dequeue()`，`notFull.signal()`，返回元素。
     7. 释放 `lock`。

总结来说，对于满/空状态的处理，`ArrayBlockingQueue` 利用 `lock` 进行互斥检查，利用 `Condition` 实现线程的条件等待与唤醒，并根据方法的不同（阻塞、非阻塞、超时）采取不同的策略（无限等待、立即返回、限时等待）。

### 6.5 公平性是什么意思？如何实现的？

前面提到，`ArrayBlockingQueue` 的公平性指的是线程获取**锁 (`ReentrantLock`)** 的顺序。

* **公平模式 (Fair):** 当多个线程都在等待获取锁时（比如都在 `lock.lock()` 或 `lock.lockInterruptibly()` 处阻塞），锁会倾向于授予那个**已经等待了最长时间**的线程。这就像排队买票，先来的先买。它保证了**先来先服务 (FIFO)** 的锁获取顺序，可以有效**防止线程饥饿**（即某个线程一直抢不到锁）。
* **非公平模式 (Non-Fair, 默认):** 当锁被释放时，任何一个正在尝试获取锁的线程（无论是刚到达的，还是已经在等待队列中等了很久的）都有机会获得锁。特别是，刚到达的线程可能会尝试一次“插队”（通常通过 CAS 尝试直接获取锁），如果成功，它就跳过了在等待队列中排队的线程。这可能导致等待队列中的线程等待更长时间，甚至饿死。但是，非公平模式通常具有**更高的吞吐量**，因为它减少了线程挂起和唤醒的次数（如果能直接抢到锁，就不用进入等待队列再被唤醒了），上下文切换开销较小。

**实现方式:**

`ArrayBlockingQueue` 自身的代码并不直接处理公平性逻辑。它将这个任务**委托**给了内部持有的 `ReentrantLock`。

在 `ArrayBlockingQueue` 的构造函数中：

```
public ArrayBlockingQueue(int capacity, boolean fair) {
    if (capacity <= 0)
        throw new IllegalArgumentException();
    this.items = new Object[capacity];
    // 关键在这里：根据 fair 参数创建对应类型的 ReentrantLock
    lock = new ReentrantLock(fair);
    // 基于这个 lock 创建 Condition 对象
    notEmpty = lock.newCondition();
    notFull =  lock.newCondition();
}


```

* 如果 `fair` 参数为 `true`，`lock = new ReentrantLock(true)` 会创建一个**公平锁**。`ReentrantLock` 的公平版本内部维护了一个基于 CLH 队列变种的等待队列，严格按照线程请求锁的顺序来授权。
* 如果 `fair` 参数为 `false`（或者使用只有一个 `capacity` 参数的构造函数，其内部调用 `this(capacity, false)`），`lock = new ReentrantLock(false)` 会创建一个**非公平锁**。非公平锁在线程尝试获取锁时，会先尝试一次 CAS (Compare-and-Swap) 操作，如果能直接成功获取锁（比如锁刚好可用，或者允许重入），就避免了进入等待队列的开销。

**总结与选择建议:**

* 公平性是针对**锁的获取**而言的，不是针对队列元素的处理顺序（队列本身总是 FIFO 的）。
* 公平模式保证了锁获取的 FIFO，防止饥饿，但牺牲了性能。
* 非公平模式性能通常更好，但可能导致饥饿。
* **选择:** 大多数场景下，**默认的非公平模式**因其较高的吞吐量是首选。只有当你明确需要保证线程获取锁的顺序性，或者在测试中发现存在严重的线程饥饿问题时，才考虑使用公平模式。

## 7. 源码剖析：`put()` 和 `take()` 的实现细节

理解了核心原理后，让我们深入 `ArrayBlockingQueue` 的源码（基于 
OpenJDK 
 8 / 11 常见版本，核心逻辑相似），重点分析 `put()` 和 `take()` 这两个最能体现其阻塞特性的方法。

**核心成员变量回顾:**

```
/** 存储元素的数组 */
final Object[] items;

/** 下一次 take, poll, peek, remove 的索引 */
int takeIndex;

/** 下一次 put, offer, add 的索引 */
int putIndex;

/** 队列中的元素数量 */
int count;

/** 主锁 */
final ReentrantLock lock;

/** 等待 '队列非空' 的条件 */
private final Condition notEmpty;

/** 等待 '队列非满' 的条件 */
private final Condition notFull;


```

### 7.1 `put(E e)` 方法源码分析

```
/**
 * 将指定元素插入此队列的尾部，如果队列已满，则等待空间可用。
 *
 * @param e 要添加的元素
 * @throws InterruptedException 如果在等待时被中断
 * @throws NullPointerException 如果指定元素为 null
 */
public void put(E e) throws InterruptedException {
    // 1. 检查元素是否为 null。不允许 null 元素。
    checkNotNull(e);
    // 2. 获取全局可重入锁。注意：这里使用的是 lockInterruptibly()，
    //    意味着在等待锁的过程中，如果线程被中断 (Thread.interrupt())，
    //    会抛出 InterruptedException，而不是继续等待或获取锁。
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();
    try {
        // 3. 循环检查队列是否已满。
        //    必须使用 while 循环而不是 if，以防止虚假唤醒。
        //    即使线程从 await() 返回，也必须重新检查条件。
        while (count == items.length) {
            // 3.1 如果队列已满，调用 notFull.await()。
            //     此操作会原子地：
            //     a. 将当前线程加入 notFull 条件的等待队列。
            //     b. 完全释放当前线程持有的 lock (即使是重入获取的也会完全释放)。
            //     c. 阻塞当前线程，直到：
            //        - 其他线程调用了 notFull.signal() 或 notFull.signalAll()
            //        - 其他线程中断了当前线程 (Thread.interrupt())
            //        - 发生“虚假唤醒”
            //     d. 当线程被唤醒（无论何种原因），它会重新尝试获取 lock。
            //        只有成功获取 lock 后，await() 方法才会返回。
            //        如果在重新获取锁的过程中被中断，await() 会抛出 InterruptedException。
            notFull.await();
        }
        // 4. 如果执行到这里，说明队列未满，可以执行入队操作。
        //    调用内部的 enqueue 方法完成实际的入队逻辑。
        enqueue(e);
        // 5. 注意：enqueue 方法内部会增加 count 的值。
        //    入队成功后，队列状态可能从空变为非空，因此需要唤醒可能在等待的消费者。
        //    （enqueue 方法内部没有包含 notEmpty.signal()，所以在这里调用）
        //    注：实际 JDK 源码中，signal 是在 enqueue 方法调用之后、unlock 之前。
        //    这里是为了逻辑清晰分开说明。
    } finally {
        // 6. 释放锁。必须在 finally 块中执行，确保即使在 await() 或 enqueue()
        //    过程中发生异常（虽然 enqueue 通常不会，但 await 可能抛中断异常），
        //    锁也一定会被释放，防止死锁。
        lock.unlock();
    }
    // 注意：JDK 源码中，signal 实际上是在 try 块内，enqueue(e) 之后调用的。
    // 将 signal 放在 finally 块之前，可以稍微优化性能（减少一次锁的竞争？待确认）。
    // 但逻辑上放在 try 块内或 finally 块之前都可以保证功能正确性。
    // OpenJDK 8 的 ArrayBlockingQueue put 方法中 signal 在 enqueue 之后，unlock 之前。
    // try { while(...) {...} enqueue(e); notEmpty.signal(); } finally { lock.unlock(); }
}

/**
 * 入队辅助方法。必须在持有锁时调用。
 */
private void enqueue(E x) {
    // assert lock.getHoldCount() == 1; // 断言当前线程持有锁
    // assert items[putIndex] == null; // 断言将要放入的位置是空的
    final Object[] items = this.items;
    // 将元素放入 putIndex 指向的位置
    items[putIndex] = x;
    // putIndex 后移一位。如果到达数组末尾，则回绕到 0，实现循环数组。
    if (++putIndex == items.length)
        putIndex = 0;
    // 增加元素计数
    count++;
    // 唤醒一个等待队列非空的线程（消费者）
    // 注意：原版 JDK 代码中 signal 是在调用 enqueue 之后进行的。
    // 但为了逻辑清晰，放在这里展示“入队后唤醒对方”的意图。
    // 实际调用位置是在 put/offer 方法的主体逻辑中。
    // notEmpty.signal(); // 这行在 JDK 源码的 enqueue 中是没有的
}

/** 检查对象是否为 null */
private static void checkNotNull(Object v) {
    if (v == null)
        throw new NullPointerException();
}


```

**`put()` 方法核心流程总结:**

1. **检查非空:** 确保插入的元素不是 `null`。
2. **获取可中断锁:** 使用 `lock.lockInterruptibly()` 获取锁，允许在等待锁时响应中断。
3. **循环检查队满:** 在 `try` 块内，使用 `while (count == items.length)` 循环检查队列是否已满。
4. **等待队不满:** 如果队列已满，调用 `notFull.await()` 原子地释放锁并进入等待状态。
5. **入队:** 如果队列未满（跳出 `while` 循环），调用 `enqueue(e)` 将元素放入数组、更新 `putIndex`、增加 `count`。
6. **唤醒消费者:** （实际在 `put` 方法的 `try` 块内，`enqueue` 调用之后）调用 `notEmpty.signal()` 唤醒一个可能在等待的消费者线程。
7. **释放锁:** 在 `finally` 块中调用 `lock.unlock()` 确保锁总是被释放。

### 7.2 `take()` 方法源码分析

```
/**
 * 检索并移除此队列的头部元素，如果队列为空，则等待元素可用。
 *
 * @return 队列的头部元素
 * @throws InterruptedException 如果在等待时被中断
 */
public E take() throws InterruptedException {
    // 1. 获取全局可重入锁，同样响应中断。
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();
    try {
        // 2. 循环检查队列是否为空。
        //    同样使用 while 防止虚假唤醒。
        while (count == 0) {
            // 2.1 如果队列为空，调用 notEmpty.await()。
            //     原子地释放锁，并将当前线程加入 notEmpty 条件的等待队列，
            //     阻塞直到被 signal(), signalAll(), 中断, 或虚假唤醒。
            //     被唤醒后重新竞争锁，成功后 await() 返回。
            notEmpty.await();
        }
        // 3. 如果执行到这里，说明队列非空，可以执行出队操作。
        //    调用内部的 dequeue 方法完成实际的出队逻辑。
        E x = dequeue();
        // 4. 注意：dequeue 方法内部会减少 count 的值。
        //    出队成功后，队列状态可能从满变为非满，因此需要唤醒可能在等待的生产者。
        //    （dequeue 方法内部没有包含 notFull.signal()，所以在 take 方法中调用）
        //    注：实际 JDK 源码中，signal 是在 dequeue 方法调用之后、unlock 之前。
        return x; // 返回获取到的元素
    } finally {
        // 5. 释放锁。
        lock.unlock();
    }
    // 注意：与 put 类似，signal 实际上是在 try 块内，dequeue() 之后调用的。
    // OpenJDK 8 的 ArrayBlockingQueue take 方法中 signal 在 dequeue 之后，unlock 之前。
    // try { while(...) {...} E x = dequeue(); notFull.signal(); return x; } finally { lock.unlock(); }
}

/**
 * 出队辅助方法。必须在持有锁时调用。
 */
private E dequeue() {
    // assert lock.getHoldCount() == 1;
    // assert items[takeIndex] != null; // 断言将要取出的位置非空
    final Object[] items = this.items;
    @SuppressWarnings("unchecked") // 类型转换是安全的，因为入队时已保证类型
    // 获取 takeIndex 指向的元素
    E x = (E) items[takeIndex];
    // 将原位置设为 null，帮助垃圾回收 (GC)
    items[takeIndex] = null;
    // takeIndex 后移一位。如果到达数组末尾，则回绕到 0。
    if (++takeIndex == items.length)
        takeIndex = 0;
    // 减少元素计数
    count--;
    // 唤醒一个等待队列非满的线程（生产者）
    // 注意：原版 JDK 代码中 signal 是在调用 dequeue 之后进行的。
    // 放在这里是为了逻辑清晰。
    // notFull.signal(); // 这行在 JDK 源码的 dequeue 中是没有的
    return x;
}


```

**`take()` 方法核心流程总结:**

1. **获取可中断锁:** 使用 `lock.lockInterruptibly()` 获取锁。
2. **循环检查队空:** 在 `try` 块内，使用 `while (count == 0)` 循环检查队列是否为空。
3. **等待队不空:** 如果队列为空，调用 `notEmpty.await()` 原子地释放锁并进入等待状态。
4. **出队:** 如果队列非空（跳出 `while` 循环），调用 `dequeue()` 获取元素、将原位置设为 `null`、更新 `takeIndex`、减少 `count`。
5. **唤醒生产者:** （实际在 `take` 方法的 `try` 块内，`dequeue` 调用之后）调用 `notFull.signal()` 唤醒一个可能在等待的生产者线程。
6. **释放锁:** 在 `finally` 块中调用 `lock.unlock()`。
7. **返回元素:** 返回通过 `dequeue()` 获取的元素。

**源码关键点总结:**

* **锁的可中断性:** `lockInterruptibly()` 使得阻塞在获取锁或 `await()` 过程中的线程能够响应中断，这是实现优雅关闭或取消任务的重要机制。
* **`while` 循环检查条件:** 应对虚假唤醒，确保操作的条件真正满足。
* **`await()` 的原子性:** 保证释放锁和进入等待状态是一个原子操作，避免死锁。
* **`signal()` 精确唤醒:** 只唤醒对方等待队列中的一个线程（如果是公平锁，通常是等待最久的），效率高于 `signalAll()`。
* **`finally` 块释放锁:** 保证锁的最终释放，健壮性的关键。
* **循环数组:** 通过 `putIndex` 和 `takeIndex` 到达数组末尾时回绕到 0，有效地利用了固定大小的数组空间。
* **置 `null` 助 GC:** `dequeue()` 中将取出的元素位置设为 `null`，有助于垃圾回收器及时回收不再使用的对象引用，避免内存泄漏（尤其是在元素对象较大或生命周期较长时）。

通过对 `put()` 和 `take()` 源码的分析，我们可以清晰地看到 `ReentrantLock` 和 `Condition` 是如何协同工作，共同构成了 `ArrayBlockingQueue` 线程安全、阻塞的核心机制。

## 8. 实战应用：构建生产者-消费者模型

`ArrayBlockingQueue` 最典型的应用场景就是作为生产者-消费者模型中的共享缓冲区。下面我们构建一个简单的示例来演示如何使用它。

**场景:** 模拟一个简单的任务处理系统。生产者不断地创建任务（简单起见，用字符串表示），放入 `ArrayBlockingQueue`；消费者从队列中取出任务并处理（简单起见，打印出来）。

```
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

// 任务类 (简单用 String)
// class Task { ... }

// 生产者
class Producer implements Runnable {
    private final BlockingQueue<String> queue;
    private final AtomicInteger taskId = new AtomicInteger(0);
    private volatile boolean running = true; // 控制生产者运行状态

    public Producer(BlockingQueue<String> queue) {
        this.queue = queue;
    }

    @Override
    public void run() {
        System.out.println("生产者 " + Thread.currentThread().getName() + " 启动...");
        try {
            while (running && !Thread.currentThread().isInterrupted()) {
                // 生产任务
                String task = "任务-" + taskId.incrementAndGet();
                System.out.println("生产者 " + Thread.currentThread().getName() + " 生产了: " + task);

                // 将任务放入队列，如果队列满，put 方法会阻塞
                queue.put(task); // 使用阻塞的 put

                // 模拟生产间隔
                Thread.sleep((long) (Math.random() * 100));
            }
        } catch (InterruptedException e) {
            // 捕获中断信号，优雅退出
            Thread.currentThread().interrupt(); // 重新设置中断状态
            System.out.println("生产者 " + Thread.currentThread().getName() + " 被中断，停止生产...");
        } finally {
            System.out.println("生产者 " + Thread.currentThread().getName() + " 结束.");
        }
    }

    public void stop() {
        running = false;
        // 不需要中断生产者线程，让它自然完成当前 put (如果阻塞) 或退出循环
    }
}

// 消费者
class Consumer implements Runnable {
    private final BlockingQueue<String> queue;
    private volatile boolean running = true; // 控制消费者运行状态

    public Consumer(BlockingQueue<String> queue) {
        this.queue = queue;
    }

    @Override
    public void run() {
        System.out.println("消费者 " + Thread.currentThread().getName() + " 启动...");
        try {
            while (running && !Thread.currentThread().isInterrupted()) {
                // 从队列获取任务，如果队列空，take 方法会阻塞
                String task = queue.take(); // 使用阻塞的 take

                System.out.println("消费者 " + Thread.currentThread().getName() + " 消费了: " + task);

                // 模拟消费耗时
                Thread.sleep((long) (Math.random() * 500));
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            System.out.println("消费者 " + Thread.currentThread().getName() + " 被中断，停止消费...");
        } finally {
             System.out.println("消费者 " + Thread.currentThread().getName() + " 结束.");
        }
    }

     public void stop() {
        running = false;
        // 注意：如果消费者阻塞在 take()，仅仅设置 running=false 无法立即停止。
        // 需要中断线程来唤醒 take()。
    }
}

// 主程序
public class ProducerConsumerDemo {
    public static void main(String[] args) throws InterruptedException {
        // 1. 创建 ArrayBlockingQueue，容量为 5，非公平
        BlockingQueue<String> taskQueue = new ArrayBlockingQueue<>(5);

        // 2. 创建生产者和消费者任务
        Producer producer1 = new Producer(taskQueue);
        Consumer consumer1 = new Consumer(taskQueue);
        Consumer consumer2 = new Consumer(taskQueue);

        // 3. 使用 ExecutorService 管理线程
        ExecutorService executor = Executors.newCachedThreadPool(); // 或者 newFixedThreadPool

        System.out.println("启动生产者和消费者...");
        executor.execute(producer1); // 启动1个生产者
        executor.execute(consumer1); // 启动2个消费者
        executor.execute(consumer2);

        // 4. 运行一段时间
        Thread.sleep(5000); // 运行 5 秒

        // 5. 优雅地停止生产者和消费者
        System.out.println("准备停止生产者和消费者...");
        producer1.stop(); // 停止生产者生产新任务

        // 等待一小段时间，让队列中剩余任务被消费
        Thread.sleep(2000);

        // 停止消费者
        // 注意：直接调用 consumer.stop() 可能不足以让阻塞在 take() 的消费者退出
        // 更好的方式是关闭 ExecutorService 并中断任务
        executor.shutdownNow(); // 尝试停止所有正在执行的任务，并中断它们

        // 等待线程池终止
        if (!executor.awaitTermination(5, TimeUnit.SECONDS)) {
            System.err.println("线程池未能在超时时间内完全终止.");
        }

        System.out.println("所有生产者和消费者已停止.");
        System.out.println("最终队列大小: " + taskQueue.size());
    }
}


```

**代码说明:**

1. **创建队列:** `new ArrayBlockingQueue<>(5)` 创建了一个容量为 5 的有界队列。
2. **生产者:**
   * `Producer` 类实现了 `Runnable`。
   * 在 `run` 方法的循环中生产任务 (`String`)。
   * 使用 `queue.put(task)` 将任务放入队列。**关键点：** 如果队列满了，这个调用会阻塞生产者线程，直到消费者取出任务腾出空间，从而实现了背压。
   * `running` 标志位和中断检查 (`!Thread.currentThread().isInterrupted()`) 用于优雅停止。
3. **消费者:**
   * `Consumer` 类也实现了 `Runnable`。
   * 在 `run` 方法的循环中消费任务。
   * 使用 `queue.take()` 从队列获取任务。**关键点：** 如果队列为空，这个调用会阻塞消费者线程，直到生产者放入新任务。
   * 同样有 `running` 标志位和中断检查。
4. **线程管理:** 使用 `ExecutorService` (这里用了 `CachedThreadPool`) 来管理生产者和消费者线程。这比手动创建和管理 `Thread` 对象更推荐。
5. **优雅停止:**
   * 首先调用 `producer.stop()` 设置标志位，让生产者不再生产新任务。
   * 等待一小段时间，允许消费者处理队列中可能剩余的任务。
   * 调用 `executor.shutdownNow()`。这个方法会：
     + 阻止新任务提交给 `executor`。
     + 尝试停止所有正在执行的任务，通过调用它们线程的 `interrupt()` 方法。
     + 返回等待执行的任务列表。
   * **重要：** `take()` 和 `put()` 都是响应中断的 (`throws InterruptedException`)。`executor.shutdownNow()` 发送的中断信号可以唤醒阻塞在 `take()` 或 `put()` 上的线程，使其抛出 `InterruptedException`，从而能够跳出循环并结束。
   * 使用 `executor.awaitTermination()` 等待线程池完全终止。

**运行观察:**

当你运行这个示例时，你会看到生产者和消费者交替打印信息。如果生产者速度快，队列会很快填满到 5 个，然后生产者在 `put()` 处阻塞，等待消费者消费。如果消费者速度快，队列会变空，消费者会在 `take()` 处阻塞，等待生产者生产。  
 `ArrayBlockingQueue` 在它们之间起到了缓冲和协调作用。

## 9. 总结与关键要点回顾

`ArrayBlockingQueue` 是 JUC 提供的一个实用的并发工具，尤其适用于需要固定容量缓冲区的生产者-消费者场景。

**核心知识点:**

* **定义:** 基于数组实现的、有界的、线程安全的 FIFO 阻塞队列。
* **特点:** 有界、阻塞、线程安全、FIFO、公平性可选。
* **有界性:** 容量在创建时指定且不可变，提供天然的资源限制和背压基础。
* **阻塞性:** 通过 `put()` (队满阻塞) 和 `take()` (队空阻塞) 实现生产者和消费者的自动协调。`offer()`/`poll()` 提供非阻塞和超时阻塞选项。
* **线程安全:** 内部使用 `ReentrantLock` 实现互斥访问，保证原子性和内存可见性。
* **内部机制:** 依赖 `ReentrantLock` 进行锁控制，依赖两个 `Condition` (`notEmpty`, `notFull`) 实现精确的线程等待与唤醒。
* **公平性:** 可通过构造函数选择，影响**锁的获取顺序**（非公平通常吞吐量更高）。
* **`put()`/`take()` 源码:** 展示了 `lock -> while(condition) -> await -> operate -> signal -> unlock` 的经典并发协作模式。
* **与 `LinkedBlockingQueue` 对比:** 主要区别在于内部结构（数组 vs 链表）、容量（固定 vs 可选/无界）、锁机制（单锁 vs 双锁）和性能（`LinkedBlockingQueue` 通常并发更高）。
* **应用:** 生产者-消费者模型的理想选择，用于解耦、缓冲、流量控制。

**何时选择 `ArrayBlockingQueue`？**

* 当你需要一个容量**严格固定**的队列。
* 当你需要利用其**有界性**来实现**反压**机制，控制上游生产速率。
* 当系统资源有限，需要明确限制待处理任务/数据的数量。
* 当需要**公平**的锁获取策略时。
* 当并发度不是极端高，单锁竞争可接受时。
