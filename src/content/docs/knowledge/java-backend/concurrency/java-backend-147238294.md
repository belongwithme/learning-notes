---
title: "JUC工具类-CountDownLatch"
description: "则是并发控制的重要武器。CountDownLatch 是 java.util.concurrent 包中最经典的同步器之一，它通过一个计数器让线程间实现灵活的协作机制。"
sourceId: "147238294"
source: "https://blog.csdn.net/qq_45852626/article/details/147238294"
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
  order: 147238294
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/147238294)（历史文章导入，当前状态为草稿）

### 一、引言

并发编程 
是Java开发中的一大难点，而同步工具
类 
则是并发控制的重要武器。`CountDownLatch` 是 `java.util.concurrent` 包中最经典的同步器之一，它通过一个计数器让线程间实现灵活的协作机制。

> 📌 本文目标：全面、系统、深入理解 CountDownLatch 的使用与实现原理，掌握高质量并发编程技术。

### 二、CountDownLatch 基础概念

#### 2.1 什么是 CountDownLatch？

`CountDownLatch` 是一个用于线程同步的工具类，允许一个或多个线程等待其他线程完成操作。它包含一个计数器，初始值通过构造函数设定。当其他线程调用 `countDown()` 方法后，计数器减一；当计数器值为 0 时，所有调用 `await()` 被阻塞的线程被唤醒。

#### 2.2 核心作用

* 实现线程间的启动顺序控制（如模拟发令枪场景）
* 线程任务结束等待机制（如主线程等子线程执行完）
* 阶段性任务同步（如并行计算中的阶段协作）
* 替代繁琐的 `Thread.join()`

#### 2.3 核心方法详解

```
public class CountDownLatchDemo {
    public static void main(String[] args) throws InterruptedException {
        CountDownLatch latch = new CountDownLatch(3); // 初始化计数器为3

        for (int i = 0; i < 3; i++) {
            new Thread(() -> {
                System.out.println(Thread.currentThread().getName() + " 执行完毕");
                latch.countDown(); // 每个线程完成后计数器-1
            }).start();
        }

        latch.await(); // 主线程阻塞，直到计数器为0
        System.out.println("所有任务完成，主线程继续执行");
    }
}


```

##### 方法列表

| 方法 | 功能 |
| --- | --- |
| `CountDownLatch(int count)` | 构造器，初始化计数器 |
| `void await()` | 当前线程阻塞直到计数器为0 |
| `boolean await(long timeout, TimeUnit unit)` | 等待计数器为0，带超时 |
| `void countDown()` | 计数器减1，如果减到0则唤醒所有等待线程 |
| `long getCount()` | 获取当前计数器值 |

#### 2.4 使用建议与陷阱

* `countDown()` 可以在任何线程中调用，不一定是调用 `await()` 的线程。
* `await()` 可以响应中断，使用时要做好异常捕获。
* 不可重复使用，使用后需重新构造实例。

### 三、CountDownLatch vs CyclicBarrier 对比分析

| 维度 | CountDownLatch | CyclicBarrier |
| --- | --- | --- |
| 可重用性 | 不可重用（一次性） | 可重用（支持多次循环） |
| 等待机制 | 一个或多个线程等待其他线程完成 | 多个线程相互等待 |
| 使用场景 | 主线程等子线程、线程等待事件发生 | 多线程协同前进、多阶段任务 |
| 回调机制 | 无 | 有 Runnable 可执行任务 |

> 🔍 小贴士：CyclicBarrier 适用于有“阶段”概念的并发流程，而 CountDownLatch 更像“一次性触发器”。

### 四、底层实现原理剖析

#### 4.1 基于 AQS 的共享锁实现

CountDownLatch 的核心实现依赖 AQS（AbstractQueuedSynchronizer）框架，是一种基于状态位的同步器。

```
private static final class Sync extends AbstractQueuedSynchronizer {
    Sync(int count) {
        setState(count);
    }

    protected int tryAcquireShared(int acquires) {
        return (getState() == 0) ? 1 : -1;
    }

    protected boolean tryReleaseShared(int releases) {
        for (;;) {
            int c = getState();
            if (c == 0)
                return false;
            int nextc = c - 1;
            if (compareAndSetState(c, nextc))
                return nextc == 0;
        }
    }

    int getCount() {
        return getState();
    }
}


```

#### 4.2 await 和 countDown 源码 注释

##### `await()` 实现逻辑

```
public void await() throws InterruptedException {
    sync.acquireSharedInterruptibly(1);
}


```

* 实际调用的是 `AQS.acquireSharedInterruptibly(int arg)`
* 如果计数器 `state == 0`，则直接返回，否则将线程加入等待队列。

##### `countDown()` 实现逻辑

```
public void countDown() {
    sync.releaseShared(1);
}


```

* 每次执行 `countDown()`，内部计数器（state）减1。
* 若减到0，会触发 AQS 的 `doReleaseShared()`，唤醒所有等待线程。

#### 4.3 LockSupport 与线程挂起唤醒机制

CountDownLatch 内部调用 LockSupport 的 `park()` / `unpark()` 实现挂起和唤醒：

* `await()` 线程加入等待队列，调用 `park()` 阻塞
* `countDown()` 调用后，触发 `unpark()` 唤醒队列中的线程

> ✏️ 理解关键：CountDownLatch 本质是一个共享锁，等待条件是 state == 0，而不是互斥。

### 五、线程安全性分析

#### 5.1 线程安全保障机制

| 手段 | 说明 |
| --- | --- |
| volatile | 确保 `state` 状态多线程可见 |
| CAS | 原子更新状态值，防止并发丢失 |
| AQS 队列 | 保证线程唤醒顺序、公平性 |
| LockSupport | 实现低开销的挂起与唤醒 |

> ✅ CountDownLatch 是典型的“无锁同步”模型，利用 CAS 保证并发原子性。

#### 5.2 为什么计数器不能重置？

* 设计理念：CountDownLatch 代表“一次性”的同步事件
* 避免复杂竞态条件与线程状态混乱
* 如果需要重用，请使用 `CyclicBarrier`

### 六、实战场景

#### 6.1 启动多个线程并等待全部完成

```
CountDownLatch latch = new CountDownLatch(5);
for (int i = 0; i < 5; i++) {
    new Thread(() -> {
        // 任务执行
        latch.countDown();
    }).start();
}
latch.await();


```

#### 6.2 多线程同时开始执行

```
CountDownLatch startSignal = new CountDownLatch(1);
for (int i = 0; i < 10; i++) {
    new Thread(() -> {
        startSignal.await();
        // 同步开始执行任务
    }).start();
}
// 所有线程准备好后
startSignal.countDown();


```

#### 6.3 阶段性任务协同

```
// 第一阶段完成后开启第二阶段
CountDownLatch phase1 = new CountDownLatch(3);
CountDownLatch phase2 = new CountDownLatch(3);

for (int i = 0; i < 3; i++) {
    new Thread(() -> {
        // 第一阶段
        phase1.countDown();
    }).start();
}
phase1.await();

for (int i = 0; i < 3; i++) {
    new Thread(() -> {
        // 第二阶段
        phase2.countDown();
    }).start();
}
phase2.await();


```

#### 6.4 并行数据加载

```
CountDownLatch latch = new CountDownLatch(3);
ExecutorService executor = Executors.newFixedThreadPool(3);
Map<String, Object> resultMap = new ConcurrentHashMap<>();

executor.execute(() -> {
    resultMap.put("A", loadA());
    latch.countDown();
});
executor.execute(() -> {
    resultMap.put("B", loadB());
    latch.countDown();
});
executor.execute(() -> {
    resultMap.put("C", loadC());
    latch.countDown();
});

latch.await();
// 使用 resultMap 中的数据


```

### 七、分布式场景下的应用与限制

#### 7.1 典型应用

* 本地任务协调（单节点服务内部）
* 多线程测试并发控制
* 多个异步任务完成后再聚合结果

#### 7.2 局限性

| 局限 | 说明 |
| --- | --- |
| JVM 内使用 | 不能跨节点，只在同一个进程内生效 |
| 无容错机制 | 某线程死锁会永久阻塞 await |
| 不可重用 | 每次使用需重新构造 CountDownLatch |

> 🚨 建议：分布式环境中配合 Redis、Zookeeper、消息队列使用实现跨 JVM 同步。

### 九、结语

CountDownLatch 虽然看似简单，但其背后的原理体现了 Java 并发编程的设计精髓。通过本篇内容，相信你不仅掌握了它的使用方式，更理解了它为何如此设计、如何保证线程安全、以及如何灵活应用。
