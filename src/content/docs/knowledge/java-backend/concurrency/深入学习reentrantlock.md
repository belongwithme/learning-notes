---
title: "深入学习ReentrantLock"
description: "在并发编程的世界里，\"锁\"是一个无法回避的核心概念。当多个线程需要访问共享资源时，如果没有适当的同步机制，就可能导致数据竞争、状态不一致等严重问题。"
sourceId: "147250524"
source: "https://blog.csdn.net/qq_45852626/article/details/147250524"
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
  order: 147250524
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/147250524)（历史文章导入，当前状态为草稿）

## 0. 前言：为什么需要 ReentrantLock？

在并发编程的世界里，"锁"是一个无法回避的核心概念。当多个线程需要访问共享资源时，如果没有适当的同步机制，就可能导致数据竞争、状态不一致等严重问题。  
 Java 提供了多种同步机制，其中最基础、最常用的就是 `synchronized` 关键字。

`synchronized` 凭借其简单易用、虚拟机层面优化的特点，在许多场景下都是不错的选择。然而，随着业务场景的日益复杂，`synchronized` 的局限性也逐渐显现：

* **功能相对单一：** 它无法实现公平锁、无法中断等待锁的线程、无法设置获取锁的超时时间、不支持多个条件变量。
* **灵活性不足：** 锁的获取和释放是隐式的，由 JVM 自动处理，开发者无法进行更精细的控制。
* **无法感知状态：** 无法判断锁是否被持有、哪个线程持有锁、线程重入了多少次等。

为了弥补 `synchronized` 的不足，Java 并发大师 Doug Lea 在 `java.util.concurrent` (JUC) 包中设计了 `Lock` 接口及其实现类，其中 `ReentrantLock` 就是最重要、最常用的实现之一。

`ReentrantLock`，顾名思义，是一个**可重入的互斥锁**。  
 它提供了与 `synchronized` 类似的独占访问控制，但赋予了我们更强大的能力和更灵活的控制权。

## 1. 基础概念与核心特性

我们首先需要理解 `ReentrantLock` 的基本概念和它所提供的核心能力。

### 1.1 什么是 ReentrantLock？

`ReentrantLock` 是 `java.util.concurrent.locks.Lock` 接口的一个具体实现。它实现了**独占**（同一时间只有一个线程能持有锁）和**可重入**（持有锁的线程可以再次获取该锁而不会死锁）的特性。

与 `synchronized` 不同，`ReentrantLock` 的锁获取和释放是**显式**的：

```
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

public class ReentrantLockDemo {
    private final Lock lock = new ReentrantLock(); // 创建 ReentrantLock 实例
    private int count = 0;

    public void increment() {
        lock.lock(); // 显式获取锁
        try {
            // 临界区：保护共享资源 count
            count++;
            System.out.println(Thread.currentThread().getName() + " incremented count to: " + count);
            // ... 其他业务逻辑 ...
        } finally {
            lock.unlock(); // 显式释放锁，必须在 finally 块中！
        }
    }

    public static void main(String[] args) {
        ReentrantLockDemo demo = new ReentrantLockDemo();

        Thread t1 = new Thread(() -> {
            for (int i = 0; i < 5; i++) {
                demo.increment();
            }
        }, "Thread-1");

        Thread t2 = new Thread(() -> {
            for (int i = 0; i < 5; i++) {
                demo.increment();
            }
        }, "Thread-2");

        t1.start();
        t2.start();
    }
}


```

**关键点：**

1. **创建实例：** 需要手动创建 `ReentrantLock` 对象。
2. **获取锁：** 调用 `lock()` 方法。如果锁已被其他线程持有，当前线程会被阻塞，直到获取到锁。
3. **释放锁：** 调用 `unlock()` 方法。**极其重要**的是，`unlock()` 操作必须放在 `finally` 块中。这是为了确保即使在临界区代码发生异常时，锁也能被正确释放，防止其他线程永远无法获取锁（即“锁泄露”）。

### 1.2 ReentrantLock vs. synchronized

`ReentrantLock` 常被拿来与 `synchronized` 比较。下表总结了它们的主要区别：

| 特性 | ReentrantLock | synchronized |
| --- | --- | --- |
| **实现机制** | 基于 AQS (AbstractQueuedSynchronizer)，API 层面 | 基于 JVM 内置实现 (monitorenter/monitorexit) |
| **锁操作** | 需要手动 `lock()` 和 `unlock()` (必须 `finally`) | 隐式，JVM 自动管理锁的获取和释放 |
| **可重入性** | 支持 | 支持 |
| **公平性** | 可选 (构造函数指定，默认非公平) | 非公平 |
| **锁获取中断** | 支持 (`lockInterruptibly()`) | 不支持 (等待锁时不可中断) |
| **尝试获取锁** | 支持 (`tryLock()`, `tryLock(time, unit)`) | 不支持 |
| **条件变量** | 支持 (`Condition`)，可关联多个 | 只与一个隐式条件关联 (`wait()`, `notify()`, `notifyAll()`) |
| **锁状态查询** | 支持 (如 `isLocked()`, `getHoldCount()`) | 不支持 |
| **性能 (JDK 6后)** | 与 `synchronized` 接近或略优 (取决于场景) | 经过优化，性能接近 `ReentrantLock` |
| **易用性** | 相对复杂，需要手动管理 | 简单易用 |

**总结来说：**

* **易用性：** `synchronized` 更简单，不易出错（忘记释放锁）。
* **功能性：** `ReentrantLock` 提供了更丰富、更灵活的功能，适用于更复杂的并发场景。
* **性能：** 在现代 JDK 版本中，性能差异通常不是选择的主要依据，除非在特定高并发、高竞争场景下进行压测。

**何时选择 ReentrantLock？** 当你需要以下 `synchronized` 不具备的功能时：

1. **可中断的锁等待：** `lockInterruptibly()`
2. **可超时的锁等待：** `tryLock(long timeout, TimeUnit unit)`
3. **非阻塞地尝试获取锁：** `tryLock()`
4. **公平锁机制：** `new ReentrantLock(true)`
5. **多个条件变量：** `newCondition()`

如果你的同步需求很简单，`synchronized` 往往是更便捷的选择。

### 1.3 核心特性详解

现在，我们来详细探讨 `ReentrantLock` 的几个核心特性。

#### 1.3.1 可重入性 (Reentrancy)

**什么是可重入性？**

可重入性意味着**同一个线程**可以**多次**获取**同一把锁**而不会导致**死锁**。换句话说，如果一个线程已经持有了某个锁，它再次请求这个锁时，可以直接成功获取，而不需要等待。

**为什么需要可重入性？**

想象一个场景：一个类有两个方法 `methodA` 和 `methodB`，它们都需要获取同一个锁。如果 `methodA` 在执行过程中调用了 `methodB`：

```
Lock lock = new ReentrantLock();

public void methodA() {
    lock.lock();
    try {
        System.out.println("Executing methodA");
        methodB(); // 调用另一个需要相同锁的方法
    } finally {
        lock.unlock();
    }
}

public void methodB() {
    lock.lock(); // 如果锁不可重入，这里会发生死锁
    try {
        System.out.println("Executing methodB");
        // ...
    } finally {
        lock.unlock();
    }
}


```

如果锁是不可重入的，当 `methodA` 持有锁并调用 `methodB` 时，`methodB` 尝试获取同一个锁，但发现锁已经被（`methodA`所在的）线程持有，于是 `methodB` 进入等待。而 `methodA` 也在等待 `methodB` 执行完成才能释放锁。这样，两个方法互相等待，形成了死锁。

可重入性完美地解决了这个问题。当 `methodA` 调用 `methodB` 时，由于是同一个线程再次请求锁，`methodB` 可以直接获取锁，继续执行。

**ReentrantLock 如何实现可重入？**

`ReentrantLock` 内部维护了两个关键信息：

1. **持有锁的线程 (owner thread):** 记录当前是哪个线程持有了锁。
2. **重入计数器 (hold count / state):** 记录当前线程获取（重入）了多少次锁。

* 当一个线程**首次**获取锁时，`ReentrantLock` 会记录下该线程，并将计数器设置为 1。
* 当**同一个线程**再次调用 `lock()` 时，`ReentrantLock` 发现请求锁的线程就是当前持有者，于是简单地**增加计数器**。
* 每次调用 `unlock()` 时，计数器会**减 1**。
* 只有当计数器**减到 0** 时，表示该线程完全释放了锁，此时 `ReentrantLock` 会清除持有线程信息，其他等待的线程才有机会获取锁。

我们可以通过 `getHoldCount()` 方法查询当前线程持有该锁的次数：

```
ReentrantLock lock = new ReentrantLock();

public void recursiveCall(int depth) {
    lock.lock();
    try {
        System.out.println("Depth: " + depth + ", Hold Count: " + ((ReentrantLock)lock).getHoldCount());
        if (depth < 3) {
            recursiveCall(depth + 1);
        }
         System.out.println("Returning from Depth: " + depth + ", Hold Count: " + ((ReentrantLock)lock).getHoldCount());
    } finally {
        lock.unlock();
    }
}

// 调用: new ReentrantLockDemo().recursiveCall(1);
// 输出会显示 Hold Count 随递归深度增加而增加，随返回而减少


```

#### 1.3.2 公平性选择 (Fairness Choice)

`ReentrantLock` 允许开发者在创建锁时选择**公平**模式或**非公平**模式。

* **公平锁 (Fair Lock):** 遵循**先来先服务 (FIFO)** 的原则。等待时间最长的线程将优先获得锁。这可以防止线程饥饿（某个线程一直获取不到锁）。
* **非公平锁 (Nonfair Lock):** **不保证** FIFO 顺序。当锁被释放时，任何等待的线程（包括刚到达的线程）都有机会尝试获取锁。新来的线程可能会“插队”成功，抢在等待队列头部的线程之前获取锁。这是 `ReentrantLock` 的**默认**模式。

**如何选择？**

通过 `ReentrantLock` 的构造函数来指定：

```
Lock fairLock = new ReentrantLock(true); // 创建一个公平锁
Lock nonfairLock = new ReentrantLock(); // 创建一个非公平锁 (默认)
// 或者显式指定 false: new ReentrantLock(false);


```

**公平锁 vs. 非公平锁：**

| 特性 | 公平锁 (Fair) | 非公平锁 (Nonfair) |
| --- | --- | --- |
| **获取顺序** | 严格按请求顺序 (FIFO) | 允许插队，不保证 FIFO |
| **线程饥饿** | 不会发生 | 可能发生 (极端情况下) |
| **性能/吞吐量** | 通常较低 (线程切换和唤醒开销较大) | 通常较高 (减少上下文切换) |
| **实现复杂度** | 略复杂 (获取锁前需检查等待队列) | 相对简单 (直接尝试获取锁) |
| **默认模式** | 否 | 是 |

**为什么默认是非公平锁？**

主要是出于**性能考虑**。非公平锁的吞吐量通常远高于公平锁。原因在于：

1. **减少上下文切换：** 当一个线程释放锁时，如果刚好有一个新线程请求锁，非公平锁允许这个新线程立即尝试获取，如果成功，就避免了唤醒等待队列头部的线程、以及该线程被唤醒后的上下文切换开销。而公平锁必须唤醒队列头部的线程。
2. **利用 CPU 缓存：** 刚释放锁的线程可能仍然保留在 CPU 缓存中，如果它紧接着又能获取到锁（非公平策略下可能发生），可以更好地利用缓存，提高效率。

**选择建议：**

* **大多数情况**下，使用**默认的非公平锁**即可，因为它通常能提供更好的整体性能。
* 只有当你**明确需要保证线程获取锁的公平性**，或者担心**线程饥饿**问题时，才考虑使用公平锁。但要注意公平锁带来的性能损耗。

我们将在后续的源码分析章节更深入地探讨公平与非公平的实现差异。

#### 1.3.3 可中断获取锁 (Interruptible Lock Acquisition)

`synchronized` 在等待锁时是**不可中断**的。如果一个线程因为等待 `synchronized` 锁而被阻塞，那么除非它获得锁，否则无法响应中断请求 (`Thread.interrupt()`)。这在某些场景下可能导致问题，例如一个长时间等待锁的操作无法被外部取消。

`ReentrantLock` 提供了 `lockInterruptibly()` 方法来解决这个问题。

* `lock()`: 获取锁，**不响应中断**。即使在等待锁的过程中线程被中断，`lock()` 方法也不会抛出 `InterruptedException`，它会继续等待直到获取锁。
* `lockInterruptibly()`: 获取锁，但**响应中断**。如果在调用 `lockInterruptibly()` 等待锁的过程中，当前线程被中断 (`interrupt()` 方法被调用)，那么该方法会**立即**抛出 `InterruptedException`，停止等待锁。

```
Lock lock = new ReentrantLock();

Thread t = new Thread(() -> {
    System.out.println(Thread.currentThread().getName() + " trying to acquire lock...");
    try {
        lock.lockInterruptibly(); // 使用可中断的方式获取锁
        try {
            System.out.println(Thread.currentThread().getName() + " acquired lock.");
            // ... 临界区 ...
            Thread.sleep(5000); // 模拟长时间持有锁
        } finally {
            lock.unlock();
            System.out.println(Thread.currentThread().getName() + " released lock.");
        }
    } catch (InterruptedException e) {
        System.out.println(Thread.currentThread().getName() + " was interrupted while waiting for lock.");
        Thread.currentThread().interrupt(); // 重新设置中断状态
    }
});

// 主线程先获取锁
lock.lock();
try {
    System.out.println("Main thread acquired lock.");
    t.start(); // 启动子线程，它将等待锁

    Thread.sleep(1000); // 让子线程运行一会并开始等待

    System.out.println("Interrupting worker thread...");
    t.interrupt(); // 中断子线程

} catch (InterruptedException e) {
   Thread.currentThread().interrupt();
} finally {
    lock.unlock();
    System.out.println("Main thread released lock.");
}


```

**输出可能如下：**

```
Main thread acquired lock.
Thread-0 trying to acquire lock...
Interrupting worker thread...
Thread-0 was interrupted while waiting for lock.
Main thread released lock.


```

**使用场景：**

* 需要**取消**长时间等待锁的操作。
* 构建更**健壮**的并发系统，能够响应外部中断信号。
* 实现**优雅停机**逻辑，允许等待资源的线程被中断并退出。

#### 1.3.4 超时获取锁 (Timed Lock Acquisition)

有时候，我们不希望线程无限期地等待锁，而是希望在**指定的时间内**尝试获取。如果超时仍未获取到锁，就放弃等待，执行其他逻辑（例如，返回错误、重试、记录日志等）。`synchronized` 无法做到这一点。

`ReentrantLock` 提供了 `tryLock()` 的重载方法来实现此功能：

* `boolean tryLock()`: **非阻塞**地尝试获取锁。如果锁当前可用，则获取锁并返回 `true`；如果锁已被其他线程持有，则**立即**返回 `false`，不会等待。
* `boolean tryLock(long timeout, TimeUnit unit)`: 在**指定的时间内**尝试获取锁，**响应中断**。
  + 如果成功获取锁，返回 `true`。
  + 如果在等待期间，锁被获取，返回 `true`。
  + 如果在等待期间，**超时**仍未获取锁，返回 `false`。
  + 如果在等待期间，线程被**中断**，抛出 `InterruptedException`。

```
Lock lock = new ReentrantLock();
ExecutorService executor = Executors.newFixedThreadPool(2);

Runnable task = () -> {
    System.out.println(Thread.currentThread().getName() + " trying to acquire lock...");
    boolean acquired = false;
    try {
        // 尝试在 2 秒内获取锁
        acquired = lock.tryLock(2, TimeUnit.SECONDS);
        if (acquired) {
            try {
                System.out.println(Thread.currentThread().getName() + " acquired lock.");
                Thread.sleep(5000); // 持有锁一段时间
            } finally {
                lock.unlock();
                System.out.println(Thread.currentThread().getName() + " released lock.");
            }
        } else {
            System.out.println(Thread.currentThread().getName() + " failed to acquire lock within timeout.");
            // 执行替代逻辑...
        }
    } catch (InterruptedException e) {
        System.out.println(Thread.currentThread().getName() + " interrupted while trying to acquire lock.");
        Thread.currentThread().interrupt();
    }
};

// 第一个任务先获取锁
executor.submit(() -> {
    lock.lock();
    try {
        System.out.println(Thread.currentThread().getName() + " acquired lock initially.");
        Thread.sleep(10000); // 持有锁 10 秒
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
    } finally {
        lock.unlock();
        System.out.println(Thread.currentThread().getName() + " released lock initially.");
    }
});

// 稍微延迟后启动第二个任务，它将尝试超时获取
try { Thread.sleep(100); } catch (InterruptedException ignore) {}
executor.submit(task);

executor.shutdown();


```

**输出可能如下：**

```
pool-1-thread-1 acquired lock initially.
pool-1-thread-2 trying to acquire lock...
pool-1-thread-2 failed to acquire lock within timeout. // 因为 Thread-1 持有锁超过了 2 秒
(等待一段时间后)
pool-1-thread-1 released lock initially.


```

**使用场景：**

* 需要避免线程**无限期等待**锁，提高系统响应性。
* 实现带有**超时机制**的操作。
* 在获取锁失败时，能够执行**备选方案**或进行**重试**。
* 与 `tryLock()` 结合，实现**轮询**或**探测**锁状态的逻辑。

#### 1.3.5 条件变量 (Condition)

`synchronized` 块与 `Object` 类中的 `wait()`, `notify()`, `notifyAll()` 方法配合，可以实现线程间的等待/通知机制。一个 `synchronized` 块只能与**一个**隐式的条件队列关联。

`ReentrantLock` 提供了 `Condition` 接口，提供了更强大、更灵活的线程协作能力。一个 `ReentrantLock` 可以关联**多个** `Condition` 对象。

**核心方法：**

* `Condition newCondition()`: `ReentrantLock` 的实例方法，用于创建一个与该锁绑定的 `Condition` 对象。
* `await()`: 使当前线程**等待**，并**释放**当前持有的 `ReentrantLock`。线程会进入该 `Condition` 的等待队列，直到被 `signal()` 或 `signalAll()` 唤醒，或者被中断。被唤醒后，线程需要**重新竞争**获取 `ReentrantLock`，成功后才能从 `await()` 返回。
* `awaitUninterruptibly()`: 与 `await()` 类似，但不响应中断。
* `awaitNanos(long nanosTimeout)` / `await(long time, TimeUnit unit)`: 带超时的等待。如果在指定时间内没有被唤醒，会自动返回 `false`。
* `awaitUntil(Date deadline)`: 等待直到指定的截止时间。
* `signal()`: 唤醒**一个**在该 `Condition` 上等待的线程。选择哪个线程是不确定的（通常是等待时间最长的）。被唤醒的线程会从等待队列移动到同步队列，尝试重新获取锁。**注意：** 调用 `signal()` 的线程**必须**持有与该 `Condition` 关联的 `ReentrantLock`。`signal()` 本身**不会**释放锁。
* `signalAll()`: 唤醒**所有**在该 `Condition` 上等待的线程。所有被唤醒的线程都会进入同步队列竞争锁。

**与 `Object.wait/notify` 的比较：**

| 特性 | ReentrantLock + Condition | synchronized + Object.wait/notify |
| --- | --- | --- |
| **关联锁** | 显式绑定到特定 `Lock` 实例 | 隐式绑定到对象监视器锁 |
| **条件数量** | 一个 `Lock` 可关联多个 `Condition` | 一个锁只有一个隐式条件队列 |
| **等待方法** | `await()`, `awaitNanos()`, `awaitUntil()` 等 | `wait()`, `wait(timeout)`, `wait(timeout, nanos)` |
| **通知方法** | `signal()`, `signalAll()` | `notify()`, `notifyAll()` |
| **中断响应** | `await()` 响应中断 | `wait()` 响应中断 |
| **灵活性** | 更高，可实现更精细的线程协作 | 相对较低 |

**典型应用：生产者-消费者模式**

`Condition` 最经典的应用场景就是实现更精确的生产者-消费者模式。假设我们有一个有界缓冲区，生产者向缓冲区放数据，消费者从缓冲区取数据。

* 当缓冲区**满**时，生产者需要等待（等待“不满”的条件）。
* 当缓冲区**空**时，消费者需要等待（等待“不空”的条件）。

使用 `ReentrantLock` 和两个 `Condition` 可以完美实现：

```
import java.util.LinkedList;
import java.util.Queue;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

class BoundedBuffer<T> {
    private final Lock lock = new ReentrantLock();
    // 条件：缓冲区不满 (生产者等待)
    private final Condition notFull = lock.newCondition();
    // 条件：缓冲区不空 (消费者等待)
    private final Condition notEmpty = lock.newCondition();

    private final Queue<T> buffer;
    private final int capacity;

    public BoundedBuffer(int capacity) {
        this.capacity = capacity;
        this.buffer = new LinkedList<>();
    }

    // 生产者方法
    public void put(T item) throws InterruptedException {
        lock.lock();
        try {
            // while 循环判断条件，防止虚假唤醒 (spurious wakeup)
            while (buffer.size() == capacity) {
                System.out.println("Buffer is full, producer waiting...");
                notFull.await(); // 缓冲区满了，生产者等待 (释放锁)
            }
            buffer.offer(item);
            System.out.println("Producer put: " + item + ", Buffer size: " + buffer.size());
            notEmpty.signal(); // 通知可能在等待的消费者，缓冲区不空了
        } finally {
            lock.unlock();
        }
    }

    // 消费者方法
    public T take() throws InterruptedException {
        lock.lock();
        try {
            while (buffer.isEmpty()) {
                System.out.println("Buffer is empty, consumer waiting...");
                notEmpty.await(); // 缓冲区空了，消费者等待 (释放锁)
            }
            T item = buffer.poll();
            System.out.println("Consumer taken: " + item + ", Buffer size: " + buffer.size());
            notFull.signal(); // 通知可能在等待的生产者，缓冲区不满了
            return item;
        } finally {
            lock.unlock();
        }
    }
}

// --- 使用示例 ---
public class ProducerConsumerDemo {
    public static void main(String[] args) {
        BoundedBuffer<Integer> buffer = new BoundedBuffer<>(5);

        // 生产者线程
        Thread producer = new Thread(() -> {
            try {
                for (int i = 0; i < 10; i++) {
                    buffer.put(i);
                    Thread.sleep((long) (Math.random() * 100)); // 模拟生产耗时
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        });

        // 消费者线程
        Thread consumer = new Thread(() -> {
            try {
                for (int i = 0; i < 10; i++) {
                    buffer.take();
                    Thread.sleep((long) (Math.random() * 500)); // 模拟消费耗时
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        });

        producer.start();
        consumer.start();
    }
}


```

**关键点：**

1. **两个 Condition：** `notFull` 和 `notEmpty` 分别对应两种等待条件。
2. **必须持有锁：** 调用 `await()`, `signal()` 之前必须先 `lock.lock()`。
3. **`await()` 释放锁：** 调用 `await()` 会自动释放当前线程持有的 `lock`，允许其他线程（比如另一个生产者或消费者）获取锁并修改缓冲区状态。
4. **`signal()` 不释放锁：** 调用 `signal()` 只是将一个等待线程从条件队列移动到同步队列，它本身不会释放锁。锁的释放在 `finally` 块的 `unlock()`。
5. **`while` 循环判断：** 使用 `while (condition)` 而不是 `if (condition)` 来调用 `await()` 是**非常重要**的。这是为了防止**虚假唤醒** (spurious wakeup)——线程可能在没有被 `signal()` 的情况下从 `await()` 返回。通过 `while` 循环，线程被唤醒后会**再次检查**条件是否满足，如果不满足则继续 `await()`。
6. **精确通知：** 生产者调用 `notEmpty.signal()` 只唤醒等待“不空”条件的消费者；消费者调用 `notFull.signal()` 只唤醒等待“不满”条件的生产者。这比 `notifyAll()` 唤醒所有线程（包括同类线程）更高效。

`Condition` 机制是 `ReentrantLock` 相对于 `synchronized` 的一大优势，使得实现复杂的线程同步和协作逻辑成为可能。

#### 1.3.6 锁状态查询

`ReentrantLock` 提供了一些方法来查询锁的当前状态，这对于调试、监控和构建更复杂的同步工具很有用。`synchronized` 则完全无法获取这些信息。

* `boolean isLocked()`: 查询锁**当前**是否被**任何**线程持有。注意，这只是一个瞬时状态，可能在你获取到结果后就发生变化。
* `boolean isHeldByCurrentThread()`: 查询锁是否被**当前**线程持有。
* `int getHoldCount()`: 查询**当前**线程持有此锁的**次数**（重入计数）。如果当前线程未持有锁，返回 0。
* `boolean hasQueuedThreads()`: 查询是否有**任何**线程正在等待获取此锁。
* `int getQueueLength()`: 返回正在等待获取此锁的线程数的**估计值**。这个值是估计的，因为线程数量可能在查询过程中动态变化。
* `boolean hasQueuedThread(Thread thread)`: 查询指定线程是否正在等待获取此锁。
* `boolean isFair()`: 查询此锁是否设置为公平模式。
* `protected Thread getOwner()`: 返回当前持有锁的线程，如果锁未被持有则返回 `null`。（注意是 `protected` 方法，通常在子类或测试中使用）。
* `protected Collection<Thread> getQueuedThreads()`: 返回一个包含正在等待获取此锁的线程的集合。（`protected` 方法）。

**示例：**

```
ReentrantLock lock = new ReentrantLock(true); // 公平锁

System.out.println("Is Fair? " + lock.isFair()); // true
System.out.println("Is Locked? " + lock.isLocked()); // false
System.out.println("Hold Count by current thread: " + lock.getHoldCount()); // 0

lock.lock();
try {
    System.out.println("\n--- After lock() ---");
    System.out.println("Is Locked? " + lock.isLocked()); // true
    System.out.println("Is Held by current thread? " + lock.isHeldByCurrentThread()); // true
    System.out.println("Hold Count by current thread: " + lock.getHoldCount()); // 1

    lock.lock(); // 重入
    try {
        System.out.println("\n--- After re-entering ---");
        System.out.println("Hold Count by current thread: " + lock.getHoldCount()); // 2
    } finally {
        lock.unlock();
    }
     System.out.println("\n--- After one unlock() ---");
     System.out.println("Hold Count by current thread: " + lock.getHoldCount()); // 1

} finally {
    lock.unlock();
}

System.out.println("\n--- After final unlock() ---");
System.out.println("Is Locked? " + lock.isLocked()); // false
System.out.println("Hold Count by current thread: " + lock.getHoldCount()); // 0


```

**用途：**

* **调试：** 快速判断锁的状态和持有者。
* **监控：** 收集锁竞争情况（如队列长度）用于系统监控和性能分析。
* **断言：** 在代码中加入断言，确保锁的状态符合预期。
* **构建高级同步器：** 基于这些状态信息可以构建更复杂的并发控制逻辑。

但要注意，这些查询方法获取的是**瞬时状态**，在高并发环境下，获取到的状态可能在你使用它之前就已经改变了。因此，不应过度依赖这些状态查询来进行核心的同步控制逻辑，它们更多用于辅助目的。

## 2. 深入理解实现原理：AQS 的基石

要真正理解 `ReentrantLock` 的工作方式，尤其是公平锁/非公平锁、可中断/超时获取、条件变量等特性的实现，就必须深入了解其背后的核心框架——**AbstractQueuedSynchronizer (AQS)**。

`ReentrantLock` 本身的代码相对简洁，它的大部分核心同步逻辑都委托给了其内部类 `Sync`，而 `Sync` 类继承自 AQS。可以说，AQS 是 JUC 中众多同步器（如 `ReentrantLock`, `Semaphore`, `CountDownLatch`, `ReentrantReadWriteLock`, `FutureTask` 等）的**基础骨架**。

### 2.1 AQS 概述

AQS (AbstractQueuedSynchronizer) 是一个用于构建锁和相关同步器的**抽象框架**。它本身不是一个具体的同步器，而是提供了一套通用的机制来管理：

1. **同步状态 (Synchronization State):** 一个表示同步器当前状态的 `int` 值 (`state`)。这个 `state` 的具体含义由使用 AQS 的子类来定义。例如，在 `ReentrantLock` 中，`state` 表示锁的重入次数（0 表示未锁定，>0 表示被某个线程持有，值代表重入次数）。在 `Semaphore` 中，`state` 表示剩余的许可数量。
2. **线程阻塞与唤醒 (Blocking/Unblocking Threads):** 当线程尝试获取同步状态失败时，AQS 负责将其加入到一个**等待队列**中，并将其**挂起**（阻塞）。当同步状态被释放时，AQS 负责从队列中**唤醒**一个或多个等待的线程。
3. **等待队列管理 (Queue Management):** AQS 内部维护一个**FIFO**（先进先出）的**双向链表**结构的等待队列（通常称为 CLH 队列的变种）。这个队列用来存放所有请求同步状态失败而被阻塞的线程。

**AQS 的设计模式：模板方法模式**

AQS 巧妙地运用了**模板方法模式**。它定义了同步器实现的核心流程（如获取同步状态、释放同步状态、线程入队、线程出队、阻塞、唤醒），并将其中**与具体同步逻辑相关**的部分定义为**抽象方法**或**可覆盖的方法**，交由子类去实现。

**子类需要实现的关键方法（受保护的）：**

* `tryAcquire(int arg)`: **独占模式**下尝试获取同步状态。子类需要实现具体的获取逻辑（例如，CAS 修改 `state`）。如果获取成功，返回 `true`；否则返回 `false`。
* `tryRelease(int arg)`: **独占模式**下尝试释放同步状态。子类需要实现具体的释放逻辑。如果释放成功（通常意味着 `state` 变为某个表示可获取的状态），返回 `true`；否则返回 `false`。
* `tryAcquireShared(int arg)`: **共享模式**下尝试获取同步状态。返回值表示获取的结果：负数表示失败；0 表示成功但后续共享获取可能失败；正数表示成功且后续共享获取可能成功。
* `tryReleaseShared(int arg)`: **共享模式**下尝试释放同步状态。如果释放后允许后续等待的共享获取操作成功，返回 `true`。
* `isHeldExclusively()`: 判断当前线程是否**独占**地持有同步状态。这个方法主要用于 `Condition` 的实现。

**AQS 提供的核心方法（公有的，供外部调用者使用）：**

这些方法构成了同步器的公共 API 的基础。它们内部会调用上面子类实现的 `tryXXX` 方法。

* `acquire(int arg)`: **独占模式**获取同步状态。如果 `tryAcquire` 失败，则将线程加入等待队列并阻塞，直到成功获取。**忽略中断**。
* `acquireInterruptibly(int arg)`: **独占模式**获取同步状态，但**响应中断**。等待过程中如果被中断，抛出 `InterruptedException`。
* `tryAcquireNanos(int arg, long nanosTimeout)`: **独占模式**尝试在指定时间内获取同步状态，**响应中断**。
* `release(int arg)`: **独占模式**释放同步状态。调用 `tryRelease`，如果成功，则尝试唤醒等待队列中的后继线程。
* `acquireShared(int arg)`: **共享模式**获取同步状态。忽略中断。
* `acquireSharedInterruptibly(int arg)`: **共享模式**获取同步状态，响应中断。
* `tryAcquireSharedNanos(int arg, long nanosTimeout)`: **共享模式**尝试在指定时间内获取同步状态，响应中断。
* `releaseShared(int arg)`: **共享模式**释放同步状态。

**ReentrantLock 与 AQS 的关系：**

* `ReentrantLock` 内部有一个抽象类 `Sync` 继承了 `AQS`。
* `Sync` 有两个具体子类：`NonfairSync` (非公平锁) 和 `FairSync` (公平锁)。
* `ReentrantLock` 的构造函数决定了使用 `NonfairSync` 还是 `FairSync` 实例。
* `ReentrantLock` 的 `lock()`, `unlock()`, `tryLock()`, `lockInterruptibly()` 等方法，最终都**委托**给了内部 `sync` 对象的 `acquire()`, `release()`, `tryAcquire()` 等 AQS 方法。
* `NonfairSync` 和 `FairSync` 实现了 AQS 的 `tryAcquire()` 方法，定义了各自的公平/非公平获取逻辑。它们都使用 AQS 的 `state` 来表示锁的重入次数，使用 `setExclusiveOwnerThread()` 记录持有锁的线程。
* `ReentrantLock` 的 `newCondition()` 方法返回的是 `AQS` 的内部类 `ConditionObject` 的实例，`Condition` 的实现也完全依赖于 AQS 提供的机制。

### 2.2 AQS 的核心组件：State 和 CLH 队列

#### 2.2.1 同步状态 (State)

```
// AbstractQueuedSynchronizer.java
private volatile int state; // 使用 volatile 保证可见性

protected final int getState() {
    return state;
}

protected final void setState(int newState) {
    state = newState;
}

// 原子性更新 state 的关键方法 (基于 CAS)
protected final boolean compareAndSetState(int expect, int update) {
    // 调用 Unsafe 类的原子操作方法
    return unsafe.compareAndSwapInt(this, stateOffset, expect, update);
}


```

* `state` 是一个 `volatile` 的 `int` 变量，保证了其在多线程间的可见性。
* AQS 提供了 `getState()`, `setState()` 和 `compareAndSetState()` (CAS) 方法来安全地读取和修改 `state`。
* **CAS (Compare-and-Swap):** 是一种**乐观锁**机制，它尝试原子地更新一个值：比较内存中的值 (`stateOffset` 对应的内存地址的值) 是否等于预期值 (`expect`)，如果等于，则将其更新为新值 (`update`)，并返回 `true`；否则不更新，返回 `false`。这是实现无锁或低锁竞争下高效原子操作的基础。几乎所有的 AQS 状态修改都依赖 CAS。

#### 2.2.2 等待队列 (CLH Queue Variant)

当线程尝试获取锁（例如调用 `acquire(1)`）但失败时（例如 `tryAcquire(1)` 返回 `false`），AQS 会将该线程包装成一个 `Node` 对象，并将其加入到一个**FIFO 双向链表**结构的等待队列中。

**Node 结构：**

```
// AbstractQueuedSynchronizer.java
static final class Node {
    // --- 模式标记 ---
    // 标记节点当前在共享模式下等待
    static final Node SHARED = new Node();
    // 标记节点当前在独占模式下等待
    static final Node EXCLUSIVE = null;

    // --- 等待状态 (waitStatus) ---
    // 标记线程已被取消（例如超时或中断）
    static final int CANCELLED =  1;
    // 标记后继线程需要被唤醒 (unpark)
    static final int SIGNAL    = -1;
    // 标记线程正在等待 Condition
    static final int CONDITION = -2;
    // 标记下一次共享式同步状态获取将会无条件传播（仅用于共享模式）
    static final int PROPAGATE = -3;
    // 初始状态 或 0

    volatile int waitStatus; // 节点的状态，volatile

    // --- 链表指针 ---
    volatile Node prev;     // 前驱节点
    volatile Node next;     // 后继节点

    // --- 节点关联的线程 ---
    volatile Thread thread; // 等待获取同步状态的线程

    // --- Condition 相关 ---
    Node nextWaiter; // 指向 Condition 队列中的下一个等待节点

    // ... 其他方法 ...
}


```

**队列结构：**

```
// AbstractQueuedSynchronizer.java
private transient volatile Node head; // 队列头节点 (哑节点，不包含实际线程)
private transient volatile Node tail; // 队列尾节点


```

* **头节点 (head):** 是一个**哑节点 (dummy node)**，它本身不关联任何等待线程。`head` 指向的节点通常是**当前持有锁**的线程（或者刚刚释放锁的线程）对应的节点（但 `head.thread` 可能为 `null`）。
* **尾节点 (tail):** 指向队列中最后一个等待的节点。
* **入队 (addWaiter):** 新的等待线程会被包装成 `Node`，通过 CAS 操作原子地添加到队尾。
* **出队:** 当 `head` 指向的节点（代表当前持有锁的线程）释放锁时，它会唤醒其**后继节点** (`head.next`)。被唤醒的节点会尝试获取锁，如果成功，它会将自己设为**新的 `head`** (原来的 `head` 出队)。
* **`waitStatus` 的作用:** `waitStatus` 是控制线程阻塞和唤醒的关键。
  + `SIGNAL (-1)`: 表示**后继节点**需要被唤醒。当前节点在释放锁或被取消时，如果看到前驱节点的 `waitStatus` 是 `SIGNAL`，它就知道需要 `unpark` 后继节点。一个节点只有在它的前驱节点 `waitStatus` 为 `SIGNAL` 时，它才能安全地 `park` (阻塞自己)。
  + `CANCELLED (1)`: 表示该节点对应的线程因为超时或中断而放弃等待。处于 `CANCELLED` 状态的节点会被**跳过**，并最终从队列中移除。
  + `CONDITION (-2)`: 表示该节点不在同步队列中，而是在**条件队列 (Condition queue)** 中等待。
  + `PROPAGATE (-3)`: 用于共享模式下，表示释放操作需要向后传播。
  + `0`: 初始状态。

**CLH 队列的优点：**

* **无锁入队：** 通过 CAS 实现线程安全的节点入队，避免了使用锁来保护队列本身。
* **公平性基础：** FIFO 结构天然支持公平性。线程被唤醒的顺序大致与其请求锁的顺序一致。
* **自旋优化：** 线程在入队后，通常会进行短暂的**自旋** (spin)，再次尝试获取锁，只有在自旋若干次后仍然失败，才会真正地 `park` (阻塞)，这可以减少不必要的上下文切换。

**理解帮助：想象一个排队场景**

可以将 AQS 的等待队列想象成一个真实世界中的排队队伍（比如银行窗口）：

1. **`state`:** 就像是窗口是否空闲的标志。`state=0` 表示窗口空闲，`state>0` 表示有人正在办理业务。
2. **`tryAcquire`:** 尝试去窗口办理业务。如果窗口空闲 (`state=0`)，直接占用 (`CAS` 修改 `state` 为 1)，成功。如果窗口有人 (`state>0`)，或者你是同一个人又来加办业务（重入，`CAS` 增加 `state`），也可能成功。否则失败。
3. **`Node`:** 代表一个正在排队等待的人。
4. **CLH 队列 (`head`, `tail`):** 就是排队的队伍本身。`head` 指向正在办理业务的那个人（或者刚办完离开），`tail` 指向队尾。
5. **入队 (`addWaiter`):** 新来的人（线程）发现窗口有人，就走到队尾 (`tail`) 排队。
6. **`waitStatus = SIGNAL`:** 排在你前面的人 (`prev`) 告诉你：“等我办完了叫你 (`unpark`)”。这样你就可以放心玩手机了 (`park`)。
7. **`waitStatus = CANCELLED`:** 队伍里有个人等不及走了，留下个“已取消”的牌子。后面的人看到直接无视他。
8. **出队 (`release` 唤醒后继):** 窗口的人办完业务 (`unlock` / `release`)，叫 (`unpark`) 队伍里的下一个人 (`head.next`)。这个人醒来，尝试去窗口 (`tryAcquire`)，成功后，他就成了新的 `head`。

这个比喻虽然不完全精确，但有助于理解 AQS 队列的基本工作流程。

### 2.3 `ReentrantLock` 如何使用 AQS？

现在我们来看看 `ReentrantLock` 是如何利用 AQS 实现其核心功能的。

#### 2.3.1 `Sync`, `NonfairSync`, `FairSync`

```
// ReentrantLock.java
public class ReentrantLock implements Lock, java.io.Serializable {
    // 内部的同步器实现，继承自 AQS
    private final Sync sync;

    // 抽象基类 Sync
    abstract static class Sync extends AbstractQueuedSynchronizer {
        // 抽象方法，由 NonfairSync 和 FairSync 实现具体的 lock 逻辑
        abstract void lock();

        // 非公平的 tryAcquire 实现 (NonfairSync 会直接调用)
        final boolean nonfairTryAcquire(int acquires) {
            final Thread current = Thread.currentThread();
            int c = getState(); // 获取当前 state (重入次数)
            if (c == 0) { // 锁未被持有
                // 直接尝试 CAS 获取锁，不检查等待队列 (非公平的关键)
                if (compareAndSetState(0, acquires)) {
                    setExclusiveOwnerThread(current); // 设置当前线程为持有者
                    return true; // 获取成功
                }
            }
            // 如果锁已被持有，检查是否是当前线程 (可重入性)
            else if (current == getExclusiveOwnerThread()) {
                int nextc = c + acquires; // 增加重入计数
                if (nextc < 0) // 溢出检查
                    throw new Error("Maximum lock count exceeded");
                setState(nextc); // 设置新的 state
                return true; // 重入获取成功
            }
            return false; // 获取失败 (锁被其他线程持有)
        }

        // 释放锁的逻辑 (公平和非公平通用)
        protected final boolean tryRelease(int releases) {
            int c = getState() - releases; // 减少重入计数
            // 检查释放者是否是当前持有者
            if (Thread.currentThread() != getExclusiveOwnerThread())
                throw new IllegalMonitorStateException();
            boolean free = false;
            if (c == 0) { // 如果计数减到 0
                free = true; // 标记锁已被完全释放
                setExclusiveOwnerThread(null); // 清除持有者
            }
            setState(c); // 设置新的 state
            return free; // 返回是否完全释放
        }

        // 判断当前线程是否持有锁
        protected final boolean isHeldExclusively() {
            return getExclusiveOwnerThread() == Thread.currentThread();
        }

        // ... 其他辅助方法，如 Condition 相关 ...
    }

    // 非公平锁实现
    static final class NonfairSync extends Sync {
        // 实现 lock 方法，直接调用 AQS 的 acquire
        final void lock() {
            // 尝试 CAS 获取一次，如果成功就直接返回 (非公平体现)
            if (compareAndSetState(0, 1))
                setExclusiveOwnerThread(Thread.currentThread());
            else
                // 如果 CAS 失败，则走 AQS 标准的获取流程 (可能入队阻塞)
                acquire(1);
        }

        // 非公平锁的 tryAcquire 直接调用父类 Sync 的 nonfairTryAcquire
        protected final boolean tryAcquire(int acquires) {
            return nonfairTryAcquire(acquires);
        }
    }

    // 公平锁实现
    static final class FairSync extends Sync {
        // 公平锁的 lock 方法，直接调用 AQS 标准获取流程
        final void lock() {
            acquire(1);
        }

        // 公平锁的 tryAcquire 实现
        protected final boolean tryAcquire(int acquires) {
            final Thread current = Thread.currentThread();
            int c = getState();
            if (c == 0) { // 锁未被持有
                // **关键区别**：先检查等待队列中是否有节点在自己前面
                // !hasQueuedPredecessors() 如果返回 true (表示没有前驱等待节点)
                // 才尝试 CAS 获取锁
                if (!hasQueuedPredecessors() &&
                    compareAndSetState(0, acquires)) {
                    setExclusiveOwnerThread(current);
                    return true;
                }
            }
            // 重入逻辑 (与非公平锁相同)
            else if (current == getExclusiveOwnerThread()) {
                int nextc = c + acquires;
                if (nextc < 0)
                    throw new Error("Maximum lock count exceeded");
                setState(nextc);
                return true;
            }
            return false; // 获取失败
        }
    }

    // 构造函数
    public ReentrantLock() { // 默认非公平
        sync = new NonfairSync();
    }

    public ReentrantLock(boolean fair) { // 可选公平
        sync = fair ? new FairSync() : new NonfairSync();
    }

    // Lock 接口方法的实现 (委托给 sync 对象)
    public void lock() {
        sync.lock(); // 调用 NonfairSync 或 FairSync 的 lock
    }

    public void lockInterruptibly() throws InterruptedException {
        sync.acquireInterruptibly(1); // 调用 AQS 的 acquireInterruptibly
    }

    public boolean tryLock() {
        return sync.nonfairTryAcquire(1); // 非公平尝试 (即使是公平锁，tryLock 也是非公平的)
    }

    public boolean tryLock(long timeout, TimeUnit unit) throws InterruptedException {
        return sync.tryAcquireNanos(1, unit.toNanos(timeout)); // 调用 AQS 的 tryAcquireNanos
    }

    public void unlock() {
        sync.release(1); // 调用 AQS 的 release
    }

    public Condition newCondition() {
        return sync.newCondition(); // 调用 AQS 的 newCondition (返回 ConditionObject)
    }
    // ... 其他 Lock 接口方法 ...
}


```

**源码解读要点：**

1. **委托模式：** `ReentrantLock` 本身不处理复杂的同步逻辑，而是将其委托给内部的 `sync` 对象（`NonfairSync` 或 `FairSync`）。
2. **继承 AQS：** `Sync` 类继承了 `AQS`，复用了 AQS 提供的状态管理 (`state`)、队列管理、线程阻塞/唤醒机制。
3. **`state` 的含义：** 在 `ReentrantLock` 中，`state` 被用来表示**锁的重入次数**。`state == 0` 表示锁未被任何线程持有。`state > 0` 表示锁被某个线程持有，其值等于该线程重入的次数。
4. **`tryAcquire` 的实现：**
   * **非公平锁 (`NonfairSync.tryAcquire` -> `Sync.nonfairTryAcquire`)**:
     + 如果 `state == 0`，**立即**尝试 CAS 将 `state` 从 0 改为 1。不关心队列中是否有其他线程在等待（插队）。
     + 如果 `state > 0` 且当前线程是持有者，增加 `state` (重入)。
     + 否则返回 `false`。
   * **公平锁 (`FairSync.tryAcquire`)**:
     + 如果 `state == 0`，**先调用 `hasQueuedPredecessors()` 检查**自己前面是否**没有**等待的线程。只有在没有前驱节点的情况下，才尝试 CAS 获取锁。这保证了 FIFO 的公平性。
     + 如果 `state > 0` 且当前线程是持有者，增加 `state` (重入)。
     + 否则返回 `false`。
5. **`lock()` 的实现：**
   * **非公平锁 (`NonfairSync.lock`)**: 先尝试**乐观地**进行一次 CAS 获取 (`compareAndSetState(0, 1)`)。如果成功，就直接返回了，避免了调用 `acquire(1)` 的开销（这是非公平锁性能通常更高的一个原因）。如果这次 CAS 失败（说明锁已被持有或存在竞争），再调用 `acquire(1)` 走标准的 AQS 获取流程（可能入队阻塞）。
   * **公平锁 (`FairSync.lock`)**: **直接**调用 `acquire(1)`，严格按照 AQS 的流程来（先 `tryAcquire`，失败则入队等待），保证了公平性。
6. **`tryRelease` 的实现：** 公平锁和非公平锁的释放逻辑是**相同**的，都在 `Sync` 类中实现。
   * 检查当前线程是否是持有者。
   * 将 `state` 减 1。
   * 如果 `state` 变为 0，表示锁已完全释放，清除持有者信息 (`setExclusiveOwnerThread(null)`)，并返回 `true`。AQS 的 `release()` 方法在 `tryRelease` 返回 `true` 时会负责唤醒等待队列中的后继节点。
7. **`tryLock()` 的非公平性：** 值得注意的是，即使你创建的是**公平锁** (`new ReentrantLock(true)`), 调用 `tryLock()` 方法（无参数版本）仍然是**非公平**的 (`sync.nonfairTryAcquire(1)`)。这是因为 `tryLock` 的语义是“尝试一次，不行就拉倒”，如果它还需要检查队列，就违背了这种“快速尝试”的意图。而带超时的 `tryLock(timeout, unit)` (`sync.tryAcquireNanos`) 内部会考虑公平性设置。
8. **其他方法：** `lockInterruptibly()`, `tryLock(timeout, unit)`, `unlock()`, `newCondition()` 等都直接调用了 AQS 提供的对应模板方法或功能。

#### 2.3.2 `acquire(1)` 源码分析 (独占模式获取流程)

`acquire(int arg)` 是 AQS 中独占模式获取同步状态的核心方法。`ReentrantLock` 的 `lock()` (公平锁) 和 `lock()` (非公平锁 CAS 失败后) 都会调用它。

```
// AbstractQueuedSynchronizer.java
public final void acquire(int arg) {
    // 1. 尝试获取锁 (调用子类实现的 tryAcquire)
    //    如果成功，直接返回
    // 2. 如果 tryAcquire 失败，则调用 addWaiter 将当前线程包装成 Node 加入等待队列
    // 3. 调用 acquireQueued 让节点在队列中自旋、阻塞并等待被唤醒，最终获取锁
    //    acquireQueued 返回 true 表示等待过程中被中断过
    if (!tryAcquire(arg) && // 尝试获取，失败则进入 && 后面的逻辑
        acquireQueued(addWaiter(Node.EXCLUSIVE), arg)) // 入队并开始排队等待
        // 如果等待过程中被中断过，则自我中断一下
        selfInterrupt();
}

// 将当前线程加入等待队列尾部
private Node addWaiter(Node mode) {
    // 创建一个代表当前线程的 Node，模式为独占 (EXCLUSIVE) 或共享 (SHARED)
    Node node = new Node(Thread.currentThread(), mode);
    // 快速尝试：假设尾节点 (tail) 已存在，直接 CAS 将新节点设置为新的尾节点
    Node pred = tail;
    if (pred != null) {
        node.prev = pred; // 新节点的前驱指向原来的尾节点
        if (compareAndSetTail(pred, node)) { // CAS 设置新尾节点
            pred.next = node; // 原来的尾节点的后继指向新节点 (连接完成)
            return node; // 快速入队成功
        }
    }
    // 如果尾节点为 null (队列为空) 或 CAS 失败 (并发竞争)
    // 则进入 enq 方法进行完整的、自旋 + CAS 的入队操作
    enq(node);
    return node;
}

// 通过自旋 + CAS 保证节点安全入队
private Node enq(final Node node) {
    for (;;) { // 无限循环 (自旋)
        Node t = tail;
        if (t == null) { // 队列为空？
            // 初始化队列：创建一个哑节点作为头节点，并 CAS 设置 head
            if (compareAndSetHead(new Node()))
                // 头节点设置成功后，将尾节点也指向这个哑节点
                // 此时 head 和 tail 指向同一个哑节点
                tail = head;
        } else {
            // 队列不为空，执行正常的尾部添加逻辑 (同 addWaiter 中的快速尝试)
            node.prev = t;
            if (compareAndSetTail(t, node)) {
                t.next = node;
                return t; // 返回原来的尾节点 (即新节点的前驱)
            }
        }
        // 如果 CAS 失败 (说明 tail 被其他线程修改了)，循环会继续，重新读取 tail 再试
    }
}

// 在队列中等待获取锁的核心逻辑
final boolean acquireQueued(final Node node, int arg) {
    boolean failed = true; // 标记是否成功获取锁 (try-finally)
    try {
        boolean interrupted = false; // 标记等待过程中是否被中断
        for (;;) { // 自旋
            final Node p = node.predecessor(); // 获取当前节点的前驱节点
            // **关键检查**：如果前驱节点是头节点 (head)
            // 并且尝试获取锁成功 (调用子类 tryAcquire)
            if (p == head && tryAcquire(arg)) {
                // 获取锁成功！
                setHead(node); // 将当前节点设置为新的头节点 (哑节点)
                p.next = null; // 帮助 GC，断开旧头节点的 next 指针
                failed = false; // 标记成功
                return interrupted; // 返回中断状态
            }
            // 如果获取锁失败 (前驱不是 head 或 tryAcquire 失败)
            // 则判断是否应该阻塞当前线程 (park)
            if (shouldParkAfterFailedAcquire(p, node) && // 检查前驱状态，确保可以安全 park
                parkAndCheckInterrupt()) // park 线程并检查中断状态
                // 如果 park 后发现被中断了，设置标记
                interrupted = true;

            // 如果 shouldParkAfterFailedAcquire 返回 false，说明前驱节点状态不适合 park
            // (例如前驱节点是 CANCELLED)，循环会继续，重新获取前驱再判断
            // 如果 parkAndCheckInterrupt 返回 true，说明被中断唤醒，循环也会继续
            // 但 interrupted 标记已设，最终 acquire 会调用 selfInterrupt()
        }
    } finally {
        // 如果获取锁失败 (例如抛了异常) 且退出了循环
        if (failed)
            cancelAcquire(node); // 取消当前节点的等待
    }
}

// 判断获取失败后是否应该 park
private static boolean shouldParkAfterFailedAcquire(Node pred, Node node) {
    int ws = pred.waitStatus; // 获取前驱节点的状态
    if (ws == Node.SIGNAL)
        // 如果前驱是 SIGNAL (-1)，表示前驱保证在释放锁时会唤醒我
        // 所以当前线程可以安全地 park
        return true;
    if (ws > 0) { // ws == CANCELLED (1)
        // 如果前驱节点是 CANCELLED 状态，说明它已经放弃了
        // 需要向前遍历，跳过所有 CANCELLED 的节点，找到一个有效的前驱
        // 并将当前节点的 prev 指向那个有效前驱
        do {
            node.prev = pred = pred.prev;
        } while (pred.waitStatus > 0);
        pred.next = node; // 重新连接链表
    } else {
        // 如果前驱状态是 0 或 PROPAGATE (-3)
        // 说明前驱节点还没有设置好 SIGNAL 状态
        // 我们需要通过 CAS 将前驱节点的 waitStatus 设置为 SIGNAL
        // 这样下次循环到这里时，就能满足 ws == Node.SIGNAL 的条件
        compareAndSetWaitStatus(pred, ws, Node.SIGNAL);
    }
    // 返回 false 表示当前还不应该 park，需要再循环一次检查
    return false;
}

// 阻塞当前线程并检查中断状态
private final boolean parkAndCheckInterrupt() {
    // 使用 LockSupport.park 阻塞当前线程
    // park 方法在以下情况会返回：
    // 1. 其他线程调用了 unpark(currentThread)
    // 2. 其他线程调用了 currentThread.interrupt()
    // 3. 发生虚假唤醒 (极少见)
    LockSupport.park(this);
    // 返回当前线程的中断状态，并清除中断状态
    return Thread.interrupted();
}

// 如果 acquireQueued 返回 true (表示被中断过)，则调用此方法重新设置中断状态
private static void selfInterrupt() {
    Thread.currentThread().interrupt();
}


```

**`acquire(1)` 流程总结：**

1. **尝试获取：** 调用 `tryAcquire(1)` (公平或非公平逻辑)。
   * 成功：`acquire` 方法直接返回。
   * 失败：继续下一步。
2. **入队：** 调用 `addWaiter(Node.EXCLUSIVE)` 将当前线程包装成独占模式的 `Node` 加入等待队列尾部。
   * `addWaiter` 会先尝试一次快速 CAS 添加到队尾。
   * 如果失败或队列为空，则调用 `enq()` 通过自旋 + CAS 的方式保证节点一定能安全入队（并可能初始化队列）。
3. **排队等待 (`acquireQueued`)：** 节点进入此方法开始排队。
   * **自旋检查：** 在一个无限循环中：
     + 获取当前节点的前驱 `p`。
     + **核心判断：** 如果 `p` 是头节点 (`head`)，**并且**再次调用 `tryAcquire(1)` 成功（因为头节点可能刚刚释放锁），则：
       - 获取锁成功！
       - 将当前节点设为新的 `head`。
       - 断开旧 `head` 的链接。
       - 方法返回（告知 `acquire` 是否在等待中被中断过）。
     + **判断是否阻塞：** 如果上面的核心判断失败（要么前驱不是 `head`，要么 `tryAcquire` 仍然失败），则调用 `shouldParkAfterFailedAcquire(p, node)`：
       - 检查前驱 `p` 的 `waitStatus`。
       - 如果 `p` 是 `CANCELLED`，向前跳过所有 `CANCELLED` 节点，找到有效前驱并重新连接。返回 `false` (需要再次循环)。
       - 如果 `p` 是 `SIGNAL`，说明可以安全阻塞。返回 `true`。
       - 如果 `p` 是 `0` 或 `PROPAGATE`，尝试用 CAS 将 `p` 的状态改为 `SIGNAL`。返回 `false` (需要再次循环确认状态已变为 `SIGNAL`)。
     + **阻塞：** 如果 `shouldParkAfterFailedAcquire` 返回 `true`，则调用 `parkAndCheckInterrupt()`：
       - 使用 `LockSupport.park(this)` 阻塞当前线程。
       - 线程被唤醒后（通过 `unpark` 或中断），`parkAndCheckInterrupt` 返回线程的中断状态（`true` 或 `false`）。
       - 如果被中断唤醒，设置 `interrupted` 标记为 `true`。
   * **循环继续：** 无论是因为获取失败、需要跳过 `CANCELLED` 节点、需要设置 `SIGNAL` 状态，还是因为被唤醒，循环都会继续，回到第一步重新检查前驱是否 `head` 并尝试 `tryAcquire`。
4. **中断处理：** 如果 `acquireQueued` 返回 `true`（表示等待过程中被中断过），`acquire` 方法最后会调用 `selfInterrupt()` 来重新设置当前线程的中断状态，以便上层调用者能够知道发生过中断。

这个流程结合了**自旋**（减少初始等待的上下文切换）、**CAS**（无锁更新状态和队列）、**队列管理**（FIFO 保证顺序）和**线程阻塞/唤醒**（`park`/`unpark`），是 AQS 实现高效同步的核心。

#### 2.3.3 `release(1)` 源码分析 (独占模式释放流程)

`release(int arg)` 是 AQS 中独占模式释放同步状态的核心方法。`ReentrantLock` 的 `unlock()` 会调用它。

```
// AbstractQueuedSynchronizer.java
public final boolean release(int arg) {
    // 1. 尝试释放锁 (调用子类实现的 tryRelease)
    if (tryRelease(arg)) { // tryRelease 返回 true 表示锁已被完全释放
        // 2. 如果锁已完全释放，获取头节点 h
        Node h = head;
        // 3. 如果头节点不为 null 且其 waitStatus 不是 0
        //    (通常意味着 waitStatus 是 SIGNAL，表示后继节点需要被唤醒)
        if (h != null && h.waitStatus != 0)
            // 唤醒头节点的后继节点
            unparkSuccessor(h);
        // 返回 true (因为 tryRelease 返回 true)
        return true;
    }
    // 如果 tryRelease 返回 false (表示锁未完全释放，只是重入次数减少)
    // 则不需要唤醒后继节点，直接返回 false
    return false;
}

// 唤醒后继节点的逻辑
private void unparkSuccessor(Node node) { // node 一般是头节点 head
    // 获取当前节点 (head) 的 waitStatus
    int ws = node.waitStatus;
    if (ws < 0) // 如果状态是负数 (通常是 SIGNAL)
        // 尝试 CAS 将其设置为 0 (表示我即将唤醒后继，你不用再标记 SIGNAL 了)
        compareAndSetWaitStatus(node, ws, 0);

    // 获取当前节点 (head) 的后继节点 s
    Node s = node.next;
    // 如果后继节点为 null 或者其状态为 CANCELLED
    if (s == null || s.waitStatus > 0) {
        s = null; // 清空 s，准备从队尾向前查找
        // 从队尾 (tail) 开始向前遍历，找到距离 head 最近的、非 CANCELLED 的节点
        // 这是因为 next 指针可能因为 CAS 竞争而暂时断开或指向错误位置
        // 但 prev 指针是相对稳定的 (在入队时就设置好了)
        for (Node t = tail; t != null && t != node; t = t.prev)
            if (t.waitStatus <= 0) // 找到一个有效的等待节点 (非 CANCELLED)
                s = t; // 将 s 指向这个有效节点
    }
    // 如果找到了一个有效的后继节点 s (无论是直接的 node.next 还是从后往前找到的)
    if (s != null)
        // 使用 LockSupport.unpark 唤醒该节点对应的线程
        LockSupport.unpark(s.thread);
}


```

**`release(1)` 流程总结：**

1. **尝试释放：** 调用 `tryRelease(1)` (由 `ReentrantLock.Sync` 实现)。
   * 如果 `tryRelease` 返回 `false` (锁未完全释放，只是重入计数减少)，`release` 方法直接返回 `false`。
   * 如果 `tryRelease` 返回 `true` (锁已被当前线程完全释放，`state` 变为 0)，继续下一步。
2. **检查头节点状态：** 获取当前的头节点 `head`。如果 `head` 不为 `null` 并且其 `waitStatus` 不是 0 (通常意味着是 `SIGNAL`，表示后面有线程在等待被唤醒)。
3. **唤醒后继 (`unparkSuccessor`)：**
   * 尝试将 `head` 的 `waitStatus` CAS 设置为 0。
   * 找到 `head` 的**有效**后继节点 `s`：
     + 先看 `head.next` 是否有效（非 `null` 且非 `CANCELLED`）。
     + 如果 `head.next` 无效，则**从 `tail` 向前遍历**，找到离 `head` 最近的有效等待节点。这种向后查找是为了处理并发入队时 `next` 指针可能暂时不一致的情况。
   * 如果找到了有效的后继节点 `s`，调用 `LockSupport.unpark(s.thread)` 唤醒该节点对应的线程。
4. **返回：** `release` 方法返回 `true`。

**关键点：**

* 只有在锁被**完全释放** (`tryRelease` 返回 `true`) 时，才会尝试唤醒后继线程。
* 唤醒操作 (`unparkSuccessor`) 具有**鲁棒性**，即使 `next` 指针暂时有问题，也能通过从 `tail` 反向查找来找到需要唤醒的线程。
* 被 `unpark` 唤醒的线程，会在其 `acquireQueued` 的 `parkAndCheckInterrupt` 方法处返回，然后继续 `acquireQueued` 的自旋，再次检查自己是否是 `head` 的后继并且能 `tryAcquire` 成功。

### 2.4 Condition 实现原理 (`ConditionObject`)

`ReentrantLock` 的 `newCondition()` 方法返回的是 `AQS` 的一个内部类 `ConditionObject` 的实例。`ConditionObject` 巧妙地利用了 AQS 的机制来实现 `await` 和 `signal`。

**核心思想：两个队列**

* **同步队列 (Sync Queue):** 就是我们前面讨论的 AQS 维护的那个 CLH 等待队列，用于管理**等待获取锁**的线程。
* **条件队列 (Condition Queue):** 每个 `ConditionObject` 实例内部维护一个**独立的、单向链表**结构的队列，用于管理调用该 `Condition` 对象的 `await()` 方法而被**阻塞**的线程。

**`await()` 源码分析：**

```
// AbstractQueuedSynchronizer.java -> ConditionObject
public final void await() throws InterruptedException {
    // 1. 检查中断状态，如果已中断，直接抛异常
    if (Thread.interrupted())
        throw new InterruptedException();
    // 2. 将当前线程包装成 Node 加入到 Condition 队列的尾部
    Node node = addConditionWaiter();
    // 3. 完全释放当前线程持有的 Lock (调用 AQS 的 fullyRelease)
    //    返回值是释放前的 state (重入次数)
    int savedState = fullyRelease(node);
    int interruptMode = 0; // 标记中断模式
    // 4. 循环检查：当前节点是否已经被转移到了 Sync Queue
    //    isOnSyncQueue 返回 false 表示仍在 Condition Queue 中
    while (!isOnSyncQueue(node)) {
        // 5. 如果仍在 Condition Queue，则 park 阻塞当前线程
        LockSupport.park(this);
        // 6. park 返回后 (被 signal 或中断唤醒)，检查是否因为中断而退出等待
        if ((interruptMode = checkInterruptWhileWaiting(node)) != 0)
            // 如果是中断导致退出，跳出 while 循环
            break;
        // 如果不是中断 (是 signal 唤醒)，继续循环，再次检查 isOnSyncQueue
        // 因为 signal 只是将节点转移到 Sync Queue，还需要等待获取锁
    }
    // 7. 节点已被转移到 Sync Queue (或者因中断跳出循环)
    //    调用 acquireQueued 尝试重新获取之前释放的 Lock (状态为 savedState)
    //    如果 acquireQueued 返回 true (表示获取锁过程中被中断) 且之前不是因中断退出等待
    if (acquireQueued(node, savedState) && interruptMode != THROW_IE)
        interruptMode = REINTERRUPT; // 标记需要重新中断
    // 8. 清理 Condition 队列中可能存在的已取消节点 (nextWaiter)
    if (node.nextWaiter != null)
        unlinkCancelledWaiters();
    // 9. 如果在等待或重新获取锁的过程中发生过中断，进行处理
    if (interruptMode != 0)
        reportInterruptAfterWait(interruptMode);
}

// 将当前线程加入 Condition 队列
private Node addConditionWaiter() {
    Node t = lastWaiter; // 获取队尾节点
    // 清理队尾可能存在的已取消节点
    if (t != null && t.waitStatus != Node.CONDITION) {
        unlinkCancelledWaiters();
        t = lastWaiter;
    }
    // 创建新节点，状态为 CONDITION
    Node node = new Node(Thread.currentThread(), Node.CONDITION);
    if (t == null) // 队列为空
        firstWaiter = node; // 设置为头节点
    else
        t.nextWaiter = node; // 连接到队尾
    lastWaiter = node; // 更新队尾指针
    return node;
}

// 完全释放锁 (支持重入)
final int fullyRelease(Node node) {
    boolean failed = true;
    try {
        int savedState = getState(); // 获取当前 state (重入次数)
        // 调用 release(savedState) 释放所有重入层级的锁
        if (release(savedState)) {
            failed = false;
            return savedState; // 返回释放前的 state
        } else {
            // 如果 release 失败 (理论上不应发生，因为 await 前必须持有锁)
            throw new IllegalMonitorStateException();
        }
    } finally {
        if (failed)
            // 如果释放过程中发生异常，将节点状态设为 CANCELLED
            node.waitStatus = Node.CANCELLED;
    }
}

// 检查节点是否已被转移到 Sync Queue
final boolean isOnSyncQueue(Node node) {
    // 如果节点状态是 CONDITION 或者 prev 指针为 null，说明还在 Condition Queue
    if (node.waitStatus == Node.CONDITION || node.prev == null)
        return false;
    // 如果节点有 next 指针 (Sync Queue 是双向链表)，说明可能已被转移
    if (node.next != null)
        return true;
    // 最后手段：从 Sync Queue 的尾部向前查找该节点 (兜底检查)
    return findNodeFromTail(node);
}

// 清理 Condition 队列中状态不是 CONDITION 的节点 (通常是 CANCELLED)
private void unlinkCancelledWaiters() {
    // ... (遍历 Condition 队列，移除状态非 CONDITION 的节点) ...
}

// 检查 park 后是否是因为中断，并处理节点转移失败的情况
private int checkInterruptWhileWaiting(Node node) {
    // Thread.interrupted() 会检查并清除中断状态
    return Thread.interrupted() ?
           (transferAfterCancelledWait(node) ? THROW_IE : REINTERRUPT) : // 如果中断了，根据转移结果决定抛异常还是重设中断
           0; // 没有中断
}

// 当 await 因中断而取消时，尝试将节点转移到 Sync Queue
// (因为即使中断了，也需要重新获取锁才能安全退出)
final boolean transferAfterCancelledWait(Node node) {
    // CAS 将节点状态从 CONDITION 改为 0，如果成功，则将其加入 Sync Queue
    if (compareAndSetWaitStatus(node, Node.CONDITION, 0)) {
        enq(node); // 加入 Sync Queue (注意，此时节点仍在 Condition Queue 的链表结构中)
        return true;
    }
    // CAS 失败，说明节点状态已被改变 (可能被 signal 转移了)
    // 循环等待，直到节点被转移到 Sync Queue
    while (!isOnSyncQueue(node))
        Thread.yield(); // 让出 CPU
    return false;
}


```

**`await()` 流程总结：**

1. **检查中断：** 确保调用 `await()` 时线程未被中断。
2. **加入条件队列：** 创建一个状态为 `CONDITION` 的 `Node`，并将其添加到当前 `ConditionObject` 维护的**条件队列** (`firstWaiter`, `lastWaiter`) 的尾部。
3. **完全释放锁：** 调用 `fullyRelease()` 方法，该方法内部使用 `release(savedState)` 释放当前线程持有的**所有重入层级**的 `ReentrantLock`。保存释放前的 `state` (重入次数)。
4. **阻塞等待：**
   * 在一个 `while` 循环中检查 `isOnSyncQueue(node)`。只要节点还在条件队列中（没被 `signal` 转移），就调用 `LockSupport.park(this)` 阻塞当前线程。
   * 线程被唤醒后（可能是 `signal` 或中断），调用 `checkInterruptWhileWaiting(node)` 检查是否是中断唤醒。
   * 如果**不是中断**唤醒（即被 `signal` 唤醒），循环继续，再次检查 `isOnSyncQueue`。这是因为 `signal` 仅仅是将节点从条件队列转移到同步队列，线程还需要在同步队列中排队并重新竞争锁。
   * 如果**是中断**唤醒，`checkInterruptWhileWaiting` 会尝试将节点 CAS 设置状态为 0 并调用 `enq(node)` 加入同步队列（因为即使中断也要获取锁才能安全地清理和退出）。根据转移是否成功，决定是标记 `THROW_IE` (抛 `InterruptedException`) 还是 `REINTERRUPT` (仅重设中断状态)。然后跳出 `while` 循环。
5. **重新获取锁：** 当 `while` 循环结束时（因为 `isOnSyncQueue` 返回 `true` 或因中断跳出），说明节点已经被转移到了**同步队列**。此时调用 `acquireQueued(node, savedState)`，让线程在同步队列中排队，尝试重新获取之前释放的锁（并且要恢复到原来的重入次数 `savedState`）。
6. **清理和中断处理：**
   * 调用 `unlinkCancelledWaiters()` 清理条件队列中可能残留的、因为 `await` 超时或中断而被取消的节点。
   * 根据 `interruptMode` 的标记，决定是否需要抛出 `InterruptedException` 或调用 `selfInterrupt()`。

**`signal()` 源码分析：**

```
// AbstractQueuedSynchronizer.java -> ConditionObject
public final void signal() {
    // 1. 检查当前线程是否持有 Lock，否则抛异常
    if (!isHeldExclusively())
        throw new IllegalMonitorStateException();
    // 2. 获取 Condition 队列的第一个等待节点
    Node first = firstWaiter;
    if (first != null)
        // 3. 如果有等待节点，执行唤醒操作
        doSignal(first);
}

// 实际执行唤醒操作
private void doSignal(Node first) { // first 是 Condition 队列的头节点
    do {
        // 将 firstWaiter 指向下一个节点 (相当于 first 出队)
        if ( (firstWaiter = first.nextWaiter) == null)
            lastWaiter = null; // 如果没有下一个节点了，尾指针也设为 null
        first.nextWaiter = null; // 断开 first 的 nextWaiter 指针
    // 调用 transferForSignal 将节点从 Condition 队列转移到 Sync Queue
    // 如果转移失败 (例如节点状态不对)，则继续循环处理下一个节点
    } while (!transferForSignal(first) && // 尝试转移，失败则继续
             (first = firstWaiter) != null); // 获取下一个节点，如果还有的话
}

// 将节点从 Condition 队列转移到 Sync Queue
// 返回 true 表示成功转移，false 表示节点已被取消或转移中遇到问题
final boolean transferForSignal(Node node) {
    // 1. 尝试 CAS 将节点状态从 CONDITION 改为 0
    //    如果失败，说明节点状态已不是 CONDITION (可能被中断取消了)，转移失败
    if (!compareAndSetWaitStatus(node, Node.CONDITION, 0))
        return false;

    // 2. CAS 成功，调用 enq(node) 将节点加入 Sync Queue 的尾部
    //    p 是加入 Sync Queue 后，node 的前驱节点
    Node p = enq(node);
    int ws = p.waitStatus; // 获取前驱节点的状态
    // 3. 如果前驱节点状态是 CANCELLED，或者 CAS 设置前驱状态为 SIGNAL 失败
    //    (这暗示前驱节点可能刚刚释放锁或者被取消了)
    //    直接唤醒当前节点 node 的线程
    //    这是为了防止信号丢失：如果前驱很快释放了锁但没能成功设置 SIGNAL，
    //    或者前驱自己被取消了，那么 node 就可能永远等不到前驱的 unpark。
    //    所以这里需要主动 unpark 一下 node。
    if (ws > 0 || !compareAndSetWaitStatus(p, ws, Node.SIGNAL))
        LockSupport.unpark(node.thread); // 直接唤醒目标线程
    return true; // 转移成功
}

// signalAll() 的实现类似，只是 doSignalAll 会遍历整个 Condition 队列
// 对每个节点都调用 transferForSignal
private void doSignalAll(Node first) {
    lastWaiter = firstWaiter = null; // 清空 Condition 队列指针
    do {
        Node next = first.nextWaiter; // 获取下一个节点
        first.nextWaiter = null; // 断开当前节点的链接
        transferForSignal(first); // 尝试转移当前节点
        first = next; // 处理下一个
    } while (first != null);
}


```

**`signal()` 流程总结：**

1. **检查锁持有：** 确保调用 `signal()` 的线程正持有 `ReentrantLock`。
2. **获取首个等待者：** 从条件队列 (`firstWaiter`) 中获取第一个等待的节点 `first`。
3. **执行转移 (`doSignal`)：**
   * 将 `firstWaiter` 指向下一个节点，相当于 `first` 从条件队列头部出队。
   * 调用 `transferForSignal(first)` 尝试将 `first` 节点转移到同步队列。
4. **转移节点 (`transferForSignal`)：**
   * **CAS 修改状态：** 尝试原子地将节点 `node` 的 `waitStatus` 从 `CONDITION` 改为 `0`。如果失败（说明节点可能已被取消），返回 `false`。
   * **加入同步队列：** 如果 CAS 成功，调用 `enq(node)` 将该节点加入到 AQS 的**同步队列**尾部。
   * **保证唤醒 (重要)：** 获取 `node` 在同步队列中的前驱节点 `p`。检查 `p` 的状态 `ws`。如果 `p` 已被取消 (`ws > 0`) 或者尝试将 `p` 的状态设置为 `SIGNAL` 失败（可能 `p` 正在释放锁或也被取消了），就直接调用 `LockSupport.unpark(node.thread)` 来唤醒 `node` 对应的线程。这一步是为了防止 `node` 因为其前驱 `p` 的状态问题而永远无法被正常唤醒（信号丢失）。
   * 返回 `true` 表示转移成功。
5. **循环处理 (doSignal)：** 如果 `transferForSignal` 返回 `false`（转移失败，节点可能已被取消），`doSignal` 会继续尝试处理条件队列中的下一个节点，直到成功转移一个节点或队列为空。

**总结 Condition 机制：**

`ConditionObject` 通过维护一个独立的条件队列，并利用 AQS 的 `park`/`unpark`、同步队列以及原子状态更新，实现了 `await`/`signal` 功能。

* `await()`: 节点入条件队列 -> 释放锁 -> park -> (被唤醒) -> 节点入同步队列 -> 重新获取锁。
* `signal()`: 节点从条件队列出队 -> CAS 修改状态 -> 节点入同步队列 -> (可能直接) unpark 线程。

这种设计将**等待特定条件**的线程（在条件队列）和**等待锁本身**的线程（在同步队列）分离开来，并通过节点在两个队列之间的转移来协调它们的行为，实现了比 `Object.wait/notify` 更灵活、更强大的线程协作能力。

## 3. 使用场景与最佳实践

理解了 `ReentrantLock` 的核心特性和实现原理后，我们来看看在哪些场景下应该优先考虑使用它，以及如何正确、高效地使用它。

### 3.1 何时选择 ReentrantLock 而不是 synchronized？

正如前面多次提到的，选择 `ReentrantLock` 还是 `synchronized` 主要取决于你是否需要 `synchronized` 无法提供的**高级特性**。以下是一些典型的场景：

1. **需要可中断的锁获取 (`lockInterruptibly`)**:

   * **场景:** 执行一个可能耗时较长的操作（如复杂的计算、远程调用），并且希望允许用户或其他线程能够**取消**这个操作。如果操作在等待锁时被阻塞，使用 `lockInterruptibly` 可以让它响应中断请求，及时退出等待并释放资源。
   * **示例:** 一个图形界面的后台任务，用户点击了“取消”按钮，主线程可以中断后台任务线程，如果后台任务正在等待锁，它可以捕获 `InterruptedException` 并停止。
2. **需要可超时的锁获取 (`tryLock(timeout, unit)`)**:

   * **场景:** 在一个高并发或资源竞争激烈的系统中，不希望线程因为等待一个可能被长时间持有的锁而无限期阻塞，影响系统的整体可用性和响应性。设置一个超时时间，如果在规定时间内无法获取锁，就执行备选逻辑（如返回错误、记录日志、稍后重试、降级处理）。
   * **示例:** 一个处理用户请求的服务，如果在 500 毫秒内无法获取到某个资源锁，就直接返回“系统繁忙，请稍后再试”的提示，而不是让用户请求一直挂起。
3. **需要非阻塞地尝试获取锁 (`tryLock()`)**:

   * **场景:** 你想检查某个资源当前是否可用（锁是否被持有），如果可用就立即使用，如果不可用就执行其他逻辑，完全不阻塞。
   * **示例:** 一个资源池管理器，尝试获取一个空闲连接的锁，如果 `tryLock()` 成功，则分配连接；如果失败，则尝试获取另一个连接的锁，或者创建一个新连接（如果允许）。
4. **需要实现公平锁**:

   * **场景:** 对线程获取锁的顺序有严格要求，必须保证先请求的线程先获得锁，以避免某些线程长时间“饥饿”。
   * **示例:** 一个打印任务队列，希望严格按照提交顺序来处理打印任务，防止后面的任务因为某种原因（如优先级）一直抢占打印机资源。但要注意公平锁带来的性能开销。
5. **需要使用多个条件变量 (`Condition`)**:

   * **场景:** 线程间的协作逻辑比较复杂，需要根据不同的条件进行等待和唤醒。一个锁需要管理多个独立的等待集合。
   * **示例:** 前面演示的生产者-消费者模式，使用 `notFull` 和 `notEmpty` 两个 `Condition`，可以精确地只唤醒需要被唤醒的线程（生产者唤醒消费者，消费者唤醒生产者），避免了 `synchronized + notifyAll` 可能带来的不必要唤醒（唤醒了同类线程）。再比如，一个复杂的任务调度系统，可能需要“任务就绪”、“资源可用”、“依赖完成”等多个等待条件。
6. **需要查询锁的状态信息**:

   * **场景:** 用于调试、监控、性能分析或构建更复杂的同步工具时，需要了解锁的持有者、重入次数、等待队列长度等信息。
   * **示例:** 在性能监控系统中，定期查询关键 `ReentrantLock` 的 `getQueueLength()` 来判断锁竞争的激烈程度。在测试代码中，使用 `isHeldByCurrentThread()` 和 `getHoldCount()` 来断言锁的状态是否符合预期。

**总结：** 如果你的同步需求很简单，只需要基本的互斥和可重入性，`synchronized` 通常更简洁、不易出错。但凡你需要上述任何一项高级功能，`ReentrantLock` 就是更好的选择。不要仅仅因为觉得 `ReentrantLock` “更高级”或“性能可能更好”而去使用它，功能的匹配度才是首要考虑因素。

### 3.2 正确使用 ReentrantLock 的关键实践

使用 `ReentrantLock` 相比 `synchronized` 需要开发者承担更多的责任，尤其是锁的释放。以下是一些关键的最佳实践，可以帮助你避免常见陷阱：

#### 3.2.1 永远在 `finally` 块中释放锁

这是使用 `ReentrantLock` **最最最重要**的一条规则！由于 `unlock()` 需要手动调用，必须确保无论临界区代码是正常执行完毕还是中途抛出异常，`unlock()` 都**一定**会被执行。否则，锁将永远不会被释放，导致其他线程无限期等待，形成事实上的“死锁”（更准确地说是“锁泄露”）。

**标准范式：**

```
Lock lock = new ReentrantLock();
// ...

public void criticalSection() {
    lock.lock(); // 获取锁
    try {
        // -------------------
        // 这里是你的临界区代码
        // 访问共享资源
        // 可能抛出异常
        // -------------------
    } finally {
        lock.unlock(); // 保证锁在 finally 块中被释放
    }
}


```

**错误示例（忘记 `finally`）：**

```
// 错误！！！非常危险！！！
public void unsafeMethod() {
    lock.lock();
    // 如果这里的代码抛出异常，unlock() 将不会被执行！
    int result = 10 / 0; // ArithmeticException
    lock.unlock(); // 永远走不到这里
}


```

#### 3.2.2 避免锁的嵌套和顺序问题（防止死锁）

当一个线程需要获取**多个** `ReentrantLock` 时，死锁的风险就会增加。死锁通常发生在两个或多个线程互相持有对方需要的锁，并等待对方释放锁的情况下。

**典型死锁场景：**

* 线程 A: `lock1.lock(); try { lock2.lock(); ... } finally { lock2.unlock(); lock1.unlock(); }`
* 线程 B: `lock2.lock(); try { lock1.lock(); ... } finally { lock1.unlock(); lock2.unlock(); }`

如果线程 A 获取了 `lock1`，同时线程 B 获取了 `lock2`，然后线程 A 尝试获取 `lock2`（被 B 持有而阻塞），线程 B 尝试获取 `lock1`（被 A 持有而阻塞），死锁发生。

**避免策略：**

1. **保证锁的获取顺序：** 所有需要获取多个锁的线程，都**严格按照相同的顺序**来获取这些锁。例如，规定所有线程都必须先获取 `lock1` 再获取 `lock2`。这可以通过：

   * **约定:** 在文档或注释中明确锁的获取顺序。
   * **排序:** 根据锁对象的某个固定属性（如 `hashCode()` 或 `System.identityHashCode()`）来决定获取顺序。

   ```
   // 假设 lock1.hashCode() < lock2.hashCode()
   Lock first = (System.identityHashCode(lock1) < System.identityHashCode(lock2)) ? lock1 : lock2;
   Lock second = (first == lock1) ? lock2 : lock1;

   first.lock();
   try {
       second.lock();
       try {
           // 临界区
       } finally {
           second.unlock();
       }
   } finally {
       first.unlock();
   }


   ```
2. **使用 `tryLock` 带超时的尝试：** 如果无法保证固定的获取顺序，或者希望在发生锁竞争时有退出机制，可以使用 `tryLock(timeout, unit)`。当尝试获取第二个锁超时失败时，**必须释放已经持有的第一个锁**，然后可以选择等待一段时间后重试，或者放弃操作。

   ```
   long timeout = 1; // 秒
   long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(timeout);

   while (System.nanoTime() < deadline) {
       if (lock1.tryLock()) {
           try {
               // 尝试获取第二个锁，也带超时
               if (lock2.tryLock(deadline - System.nanoTime(), TimeUnit.NANOSECONDS)) {
                   try {
                       // 成功获取两个锁
                       // ... 临界区 ...
                       return true; // 操作成功
                   } finally {
                       lock2.unlock();
                   }
               }
           } finally {
               lock1.unlock(); // 无论是否获取到 lock2，都要释放 lock1
           }
       }
       // 短暂休眠避免活锁 (Busy-waiting)
       Thread.sleep(10); // 或者更复杂的退避策略
   }
   return false; // 获取锁超时失败


   ```

   这种方式比固定顺序更复杂，但能更好地处理动态的锁竞争。
3. **减少锁的持有时间，避免锁嵌套：** 尽量只在**绝对必要**的代码段持有锁，缩短锁的持有时间。审视你的代码，是否真的需要在持有 `lock1` 的同时去获取 `lock2`？能否将操作分解，或者先释放 `lock1` 再去获取 `lock2`（如果业务逻辑允许）？

#### 3.2.3 锁的粒度要适当

* **不要锁过多代码：** 只锁定**真正需要保护的共享资源**的访问代码。如果在锁内部执行了不必要的、耗时的操作（如 I/O、网络请求、复杂的计算），会**严重降低并发性能**，因为其他线程必须等待这些耗时操作完成才能获取锁。
* **不要锁过少代码：** 确保所有对共享状态的读写操作都在同一个锁的保护下，以维持数据的一致性。

**示例（反模式：锁过多）：**

```
// 反模式：在锁内执行了耗时的 I/O 操作
lock.lock();
try {
    // 1. 读取共享配置 (需要锁)
    configValue = sharedConfig.get("key");

    // 2. 基于配置进行耗时计算 (可能不需要锁，取决于计算是否依赖共享状态变化)
    result = complexCalculation(configValue);

    // 3. 将结果写入文件 (非常耗时，绝对不应在锁内！)
    writeToFile("output.txt", result);

    // 4. 更新另一个共享状态 (需要锁)
    sharedStatus.update(result);
} finally {
    lock.unlock();
}


```

**改进：**

```
// 步骤 1: 读取共享配置
lock.lock();
try {
    configValue = sharedConfig.get("key");
} finally {
    lock.unlock();
}

// 步骤 2: 耗时计算 (在锁外执行)
result = complexCalculation(configValue);

// 步骤 3: 写入文件 (在锁外执行)
writeToFile("output.txt", result);

// 步骤 4: 更新共享状态
lock.lock();
try {
    sharedStatus.update(result);
} finally {
    lock.unlock();
}


```

通过减小锁的粒度，显著提高了并发性。

#### 3.2.4 小心使用 `Condition`

* **`await()` 必须在 `while` 循环中：** 再次强调，这是为了防止虚假唤醒。
* **`await()` / `signal()` / `signalAll()` 必须在持有锁时调用：** 否则会抛出 `IllegalMonitorStateException`。
* **区分 `signal()` 和 `signalAll()`:**
  + `signal()`: 只唤醒**一个**等待线程。适用于等待队列中的所有线程处理逻辑相同，唤醒任意一个都能继续工作的情况。效率更高，因为只唤醒一个线程。
  + `signalAll()`: 唤醒**所有**等待线程。适用于等待条件可能对多个线程都有意义，或者不同线程可能在等待稍微不同的子条件的情况。开销更大，因为所有被唤醒的线程都需要再次竞争锁（可能导致“惊群效应” Thundering Herd）。
  + **经验法则：** 如果不确定，使用 `signalAll()` 更安全（虽然可能效率稍低）。只有当你非常确定唤醒一个线程就足够时，才使用 `signal()`。在生产者-消费者模式中，如果只有一个生产者和一个消费者，`signal` 通常足够；但如果有多个生产者和多个消费者，`signalAll` 通常更合适，以确保所有等待的同类线程都有机会被唤醒并检查条件。

#### 3.2.5 考虑使用 `ReadWriteLock`

如果你的场景是**读多写少**，即对共享资源的读取操作远远多于修改操作，那么使用 `ReentrantLock`（这是一个**独占锁**，读和写都会互斥）可能会成为性能瓶颈。

在这种情况下，应该考虑使用 `java.util.concurrent.locks.ReadWriteLock` 接口及其实现 `ReentrantReadWriteLock`。

* `ReentrantReadWriteLock` 维护一对锁：一个**读锁 (read lock)** 和一个**写锁 (write lock)**。
* **允许多个线程同时持有读锁**（只要没有线程持有写锁）。
* **只允许一个线程持有写锁**（此时不能有任何线程持有读锁或写锁）。
* **读写互斥，写写互斥，读读不互斥。**

这使得在读操作频繁的场景下，并发性能可以得到极大提升。

```
ReadWriteLock rwLock = new ReentrantReadWriteLock();
Lock readLock = rwLock.readLock();
Lock writeLock = rwLock.writeLock();
Map<String, String> sharedMap = new HashMap<>();

// 读操作
public String get(String key) {
    readLock.lock(); // 获取读锁
    try {
        return sharedMap.get(key);
    } finally {
        readLock.unlock(); // 释放读锁
    }
}

// 写操作
public void put(String key, String value) {
    writeLock.lock(); // 获取写锁
    try {
        sharedMap.put(key, value);
    } finally {
        writeLock.unlock(); // 释放写锁
    }
}


```

`ReentrantReadWriteLock` 也支持公平/非公平策略，并且其读锁和写锁也都是可重入的。它是优化读密集型并发场景的利器。

### 3.3 性能考量

虽然现代 JVM 对 `synchronized` 做了大量优化（如锁消除、锁粗化、偏向锁、轻量级锁、自适应自旋等），使得其在很多场景下的性能与 `ReentrantLock` 不相上下，但在某些特定情况下，`ReentrantLock` 可能表现更好：

* **高竞争下的非公平锁：** 正如之前分析的，非公平 `ReentrantLock` 在锁竞争激烈时，通过允许“插队”和减少上下文切换，其吞吐量通常优于公平锁和 `synchronized`（`synchronized` 本质上是非公平的，但其实现机制可能不如 `ReentrantLock` 的 AQS 灵活）。
* **特定 CPU 架构：** AQS 底层的 CAS 操作在某些 CPU 架构上可能比 `synchronized` 的底层实现更高效。

然而，性能差异通常不是选择 `ReentrantLock` 的主要原因。除非你的应用遇到了明确的性能瓶颈，并且通过分析（如使用 JProfiler, VisualVM 等工具）定位到是 `synchronized` 锁竞争导致的，否则优先考虑代码的**可读性、可维护性和功能的满足度**。

**影响 `ReentrantLock` 性能的因素：**

* **公平性：** 公平锁通常比非公平锁性能低。
* **锁竞争程度：** 竞争越激烈，AQS 队列操作和线程阻塞/唤醒的开销越大。
* **锁粒度：** 锁持有时间越长，粒度越大，对并发性能影响越大。

进行性能调优时，应该基于**实际测量数据**，而不是凭感觉猜测。

## 4. 总结

`ReentrantLock` 作为 Java 并发包 (JUC) 中的核心同步组件，为开发者提供了比内置 `synchronized` 关键字更强大、更灵活的锁机制。  
 通过深入理解其核心特性——可重入性、公平性选择、可中断获取、超时获取、条件变量以及锁状态查询——我们可以在复杂的并发场景中实现更精细、更高效的线程同步和协作。

核心要点回顾：

1. **显式控制：** `ReentrantLock` 需要手动 `lock()` 和 `unlock()`，并且 `unlock()` 必须在 `finally` 块中执行以保证释放。
2. **AQS 基石：** `ReentrantLock` 的核心实现依赖于 AbstractQueuedSynchronizer (AQS) 框架，该框架通过 `volatile state` 和 CLH 等待队列提供了通用的同步管理机制。
3. **公平 vs 非公平：** 非公平锁（默认）通常具有更高的吞吐量，而公平锁保证 FIFO 获取顺序但性能较低。选择取决于具体需求。
4. **高级特性：** 可中断 (`lockInterruptibly`)、可超时 (`tryLock(timeout, unit)`)、非阻塞 (`tryLock`) 的锁获取方式提供了处理复杂情况的能力。
5. **Condition：** 强大的条件变量机制，允许一个锁关联多个等待条件，通过 `await()` 和 `signal()` / `signalAll()` 实现精确的线程等待与通知，是实现复杂协作模式（如生产者-消费者）的关键。
6. **最佳实践：** 强调 `finally` 释放锁、避免死锁（锁顺序、`tryLock`）、控制锁粒度、正确使用 `Condition` 以及在读多写少场景考虑 `ReadWriteLock`。

**学习 `ReentrantLock` 的意义：**

* **掌握更强大的工具：** 能够应对 `synchronized` 无法满足的复杂并发需求。
* **深入理解 JUC：** AQS 是 JUC 的核心，理解 `ReentrantLock` 的原理有助于理解 JUC 中其他同步器（如 `Semaphore`, `CountDownLatch` 等）的工作方式。
* **提升并发编程能力：** 迫使你更深入地思考锁的获取与释放、线程状态、死锁避免等并发编程的核心问题。
