---
title: "JUC工具类-Exchanger"
description: "Exchanger 是 java.util.concurrent 包中的一个同步工具类，用于两个线程之间的数据交换。它提供了一个同步点，当两个线程都到达该点时，它们就可以交换数据。"
sourceId: "147238691"
source: "https://blog.csdn.net/qq_45852626/article/details/147238691"
sourceSeries:
  - "JUC"
category: java-backend
subcategory: concurrency
tags:
  - "JUC"
status: draft
difficulty: intermediate
contentType: knowledge
sidebar:
  order: 147238691
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/147238691)（历史文章导入，当前状态为草稿）

## 一、Exchanger 基础概念

### 1.1 什么是 Exchanger？

`Exchanger<V>` 是 `java.util.concurrent` 包中的一个同步工具类，用于**两个线程之间的数据交换**。它提供了一个同步点，当两个线程都到达该点时，它们就可以交换数据。  
 核心作用如下：

* 实现两个线程间的**双向数据传递**
* 构建**双缓冲结构**，实现数据处理与生成分离
* 替代共享队列，实现直接交换数据的**生产者-消费者模式**
* 在**遗传算法**中用于染色体交换
* 在**管道处理架构**中用于模块之间的数据传递

### 1.2 核心方法介绍

`Exchanger` 提供了两个重载方法：

```
public V exchange(V x) throws InterruptedException
public V exchange(V x, long timeout, TimeUnit unit) throws InterruptedException, TimeoutException


```

#### 方法 1：exchange(V x)

* 阻塞直到另一个线程也调用 `exchange()`
* 两线程交换各自的数据
* 如果被中断，抛出 `InterruptedException`

#### 方法 2：exchange(V x, long timeout, TimeUnit unit)

* 与上述方法类似，但设置了超时时间
* 如果在 `timeout` 时间内没有匹配线程，抛出 `TimeoutException`

#### 两者区别：

| 维度 | exchange(V x) | exchange(V x, timeout, unit) |
| --- | --- | --- |
| 阻塞模式 | 无限阻塞 | 阻塞直到超时 |
| 异常 | InterruptedException | InterruptedException + TimeoutException |
| 应用场景 | 保证必须交换 | 尝试交换但有限等待时间 |

### 1.3 与其他并发工具类的对比

| 工具类 | 功能 | 是否支持数据交换 | 多线程支持 | 应用场景 |
| --- | --- | --- | --- | --- |
| CountDownLatch | 等待计数为0再继续执行 | 否 | 是 | 多线程等待多个事件 |
| CyclicBarrier | 多线程等待至某个屏障点再统一执行 | 否 | 是 | 多线程同步启动、阶段协调 |
| **Exchanger** | **两个线程配对后交换数据** | **是** | **仅两线程** | **两个线程一对一协作的场景** |

Exchanger 是少数支持双向数据交换的同步工具，适用于两线程之间的高频协作。

## 二、Exchanger 原理机制详解

### 2.1 数据交换机制

Exchanger 的设计理念可抽象为：**一个线程写入数据并等待，另一个线程读取数据并返回自身数据**。  
 其核心组件包括：

* **Node 节点**：每个参与线程都有一个 Node 节点，存放数据、线程状态等信息。
* **槽位 Slot**：共享内存空间，用于匹配两个线程。
* **CAS + 自旋 + 阻塞机制**：用于高效等待与线程协调。

#### 交换流程如下：

1. 线程 A 到达交换点：构造 Node 节点并尝试通过 CAS 占据槽位（slot）
2. 如果槽位为空，则等待另一个线程到来（先自旋，后阻塞）
3. 线程 B 到达发现槽位非空，读取 A 的 Node，并设置 `match` 字段
4. B 唤醒线程 A，完成数据交换
5. 槽位状态被重置，准备下一次交换  
    这一过程的同步是**非阻塞的 CAS 操作 + 自旋 + LockSupport.park/unpark** 共同完成的。

### 2.2 槽位（Slot）概念

槽位是 Exchanger 中最核心的结构之一：

* 是两个线程交换数据的媒介
* 实质是一个 `AtomicReference<Node>` 对象
* 线程通过 CAS 操作尝试占据这个槽位

#### 槽位的多重角色：

* 交换中介：存储线程 Node
* 同步点：保证两个线程同步对接
* 状态记录器：通过 Node 中的 `match` 字段标记是否成功交换

### 2.3 超过两个线程会怎样？

Exchanger 本质上是**两个线程一对一配对**的工具。  
 当超过两个线程调用 `exchange()` 方法时：

* 系统只会让两个线程完成交换
* 其余线程只能等待，造成性能瓶颈或饥饿

#### 解决策略：

1. **多个 Exchanger 实例 + 线程分组**
2. **通过哈希/线程 ID 显式分流线程**
3. **替代工具**：如 `BlockingQueue`、`CyclicBarrier` 等
4. **设置超时 + 退避机制**，避免线程永久等待

## 三、Exchanger 多核支持机制 —— Arena 模型

当并发线程较多时，单一槽位（slot）已经不足以支撑高频交换操作，因此 `Exchanger` 提供了**Arena 模式**以支持在多核 CPU 下的扩展能力。

### 3.1 什么是 Arena？

`Arena` 是一个由多个槽位组成的数组结构，允许多个线程**并行配对交换**。每个线程将被分配到 Arena 的一个槽位层级（level）进行配对。

Arena 是 Exchanger 中为了提高多线程并发效率而引入的一种“分层配对”机制。

### 3.2 Arena 工作原理

* 当并发线程较少时，Exchanger 使用单槽位（`slot`）进行交换
* 当检测到冲突频繁、线程较多时，会**升级为 Arena 模式**
* 线程根据哈希（如 threadId）选择一个 level
* 每个 level 有独立的槽位，避免线程冲突
* 线程通过自旋、阻塞等待在各自 level 内匹配配对线程

### 3.3 Arena 数据结构

```
private static final int ASHIFT = 7;  // 每个槽位占据空间
private static final int MMASK  = 0xff;
private static final int SEQ    = 0x100;
@sun.misc.Contended
static final class Node {
    volatile Object item;
    volatile Object match;
    volatile Thread parked;
    int index; // Arena 层级索引
    int bound;
    int collides;
    int hash;
    Node() { }
}


```

* `bound`: 当前 Arena 可用的最大层级
* `index`: 当前线程被分配的 Arena 索引
* `collides`: 冲突次数，用于触发 bound 的扩张
* `parked`: 当前线程封装，用于 park/unpark 控制

Arena 模式的加入大幅提升了 Exchanger 在多线程场景下的扩展性。

## 四、源码深度剖析（JDK 17）

下面我们结合 JDK 17 的源码对 `Exchanger` 内部逻辑进行逐步拆解分析。

### 4.1 核心类结构

```
public class Exchanger<V> {
    private static final int FULL = Integer.MAX_VALUE;

    private static final int NCPU = Runtime.getRuntime().availableProcessors();

    private static final int CAPACITY = 32;

    private final Participant participant;

    private volatile Node[] arena;
    private volatile Node slot;
}


```

* `slot`：用于两个线程直接交换的单槽位
* `arena`：高并发场景下使用的分布式槽位数组
* `participant`：线程局部数据，记录线程在交换过程中的状态

### 4.2 关键方法：`exchange(V item, long timeout, TimeUnit unit)`

```
public V exchange(V item, long timeout, TimeUnit unit)
    throws InterruptedException, TimeoutException {

    Object result = arena == null
        ? slotExchange(item, timed, ns)
        : arenaExchange(item, timed, ns);

    if (result == null) throw new TimeoutException();
    if (result == Thread.interrupted()) throw new InterruptedException();
    return (V) result;
}


```

该方法根据当前是否处于 Arena 模式，选择使用 `slotExchange` 还是 `arenaExchange`。

### 4.3 单槽位实现（slotExchange）

```
private Object slotExchange(Object item, boolean timed, long nanos) {
    Node p = participant.get();
    p.item = item;

    if (slot == null && U.compareAndSwapObject(this, SLOT, null, p)) {
        // CAS 成功，占据 slot，等待另一个线程
        // 自旋若干次，后 park()
    } else {
        // 发现槽位非空，读取对方数据，唤醒线程并返回
    }
}


```

* 第一个线程通过 CAS 占据 slot 并自旋等待配对
* 第二个线程到达后读取前者的数据，进行配对并唤醒

### 4.4 Arena 模式实现（arenaExchange）

```
private Object arenaExchange(Object item, boolean timed, long nanos) {
    Node p = participant.get();
    int i = p.index;

    for (;;) {
        Node q = arena[i];
        if (q != null) {
            // 匹配成功
        } else if (arena[i] == null &&
                   U.compareAndSwapObject(arena, i, null, p)) {
            // 插入成功，等待配对
        }
        // 自旋/冲突处理/超时等逻辑
    }
}


```

* 每个线程根据 index 定位到 Arena 的一个槽位
* 使用 CAS 占据该位置，如果匹配到另一个线程则交换
* Arena 会自动扩张和收缩，以适配线程并发压力

## 五、实战案例：构建双缓冲数据交换系统

### 场景描述

假设你需要构建一个生产-消费模型，其中生产者和消费者**一对一直接交换数据**，中间无需缓冲区。

`Exchanger` 正好适用这种场景。

### 示例代码

```
public class ExchangerExample {
    static Exchanger<String> exchanger = new Exchanger<>();

    public static void main(String[] args) {
        ExecutorService executor = Executors.newFixedThreadPool(2);

        executor.execute(() -> {
            try {
                String data = "生产的数据";
                System.out.println("生产者准备交换: " + data);
                String result = exchanger.exchange(data);
                System.out.println("生产者获得: " + result);
            } catch (Exception e) {
                e.printStackTrace();
            }
        });

        executor.execute(() -> {
            try {
                String data = "消费者响应";
                System.out.println("消费者准备交换: " + data);
                String result = exchanger.exchange(data);
                System.out.println("消费者获得: " + result);
            } catch (Exception e) {
                e.printStackTrace();
            }
        });

        executor.shutdown();
    }
}


```

### 输出结果示例

```
生产者准备交换: 生产的数据
消费者准备交换: 消费者响应
生产者获得: 消费者响应
消费者获得: 生产的数据


```

通过 `Exchanger`，双方线程实现了完全同步的、双向数据传输，避免使用队列结构。

---

## 六、使用误区与性能建议

### 6.1 常见误区

* **错误地使用多个线程共享一个 Exchanger**：它只适合**成对线程**，不支持三方或多线程直接交换
* **错误地认为交换是立即完成的**：交换是阻塞的，必须配对线程也在调用 `exchange`
* **使用无超时时间造成死等**：线程未配对将永久阻塞，建议使用带超时的方法

### 6.2 性能优化建议

* 使用 `exchange(x, timeout, unit)` 增加健壮性
* 在线程池或并发任务中，**成对设计任务结构**，避免竞争
* 高并发时使用 `arena`，性能可提升数量级
* 谨慎使用 `Exchanger` 构建生产者消费者模型，如需求为**多生产者/多消费者**更建议用 `BlockingQueue`

---

## 七、总结与回顾

`Exchanger` 是 Java 并发包中一个较为小众但极具特色的工具类：

| 特性 | 说明 |
| --- | --- |
| 核心机制 | 两个线程在同步点交换数据 |
| 底层实现 | CAS + 自旋 + park/unpark + Arena 扩展支持 |
| 最佳应用场景 | 两线程间的配对协作、双缓冲机制、遗传算法染色体交换 |
| 常见问题 | 超时处理、线程配对失败、滥用导致性能下降 |

Exchanger 是构建高性能线程协作机制的一大利器，尤其适合 “我给你一个东西，你也得给我一个” 的对等协作场景。
