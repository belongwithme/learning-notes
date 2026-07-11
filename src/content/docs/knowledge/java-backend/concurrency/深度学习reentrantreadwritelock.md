---
title: "深度学习ReentrantReadWriteLock"
description: "在并发编程中，保护共享资源是核心问题之一。"
sourceId: "147251482"
source: "https://blog.csdn.net/qq_45852626/article/details/147251482"
sourceSeries:
  - "JUC"
category: java-backend
subcategory: concurrency
tags:
  - "JUC"
status: draft
difficulty: advanced
contentType: knowledge
sidebar:
  order: 147251482
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/147251482)（历史文章导入，当前状态为草稿）

## 1. 基础概念：为什么需要 ReentrantReadWriteLock？

在并发编程中，保护共享资源是核心问题之一。  
 我们最常用的工具是互斥锁，例如 `synchronized` 关键字或 `ReentrantLock`。  
 它们遵循一个简单的原则：**同一时刻，只允许一个线程访问被保护的资源**。

这在很多情况下是有效的，但考虑以下场景：

* 一个共享的配置对象，它很少被修改，但会被大量线程频繁读取。
* 一个内存缓存，读取操作远多于写入或更新操作。
* 一个在线文档，多人可以同时阅读，但编辑时需要独占。

在这些“**读多写少**”的场景下，使用互斥锁会带来性能瓶颈。因为即使是无害的、不会修改数据的读操作，也必须排队等待，无法并发执行。这显然是对资源的浪费。

**思考：** 如果有 100 个线程都只是想读取同一个数据，理想情况下它们应该能够同时进行，而不是一个接一个地排队。

`ReentrantReadWriteLock` 就是为了解决这个问题而设计的。它是一种更细粒度的锁机制，提供了两种类型的锁：

1. **读锁 (Read Lock)**：**共享锁**。多个线程可以同时持有读锁，只要没有线程持有写锁。
2. **写锁 (Write Lock)**：**独占锁**（也叫互斥锁）。当一个线程持有写锁时，其他任何线程（无论是想获取读锁还是写锁）都必须等待。写锁保证了写入操作的原子性和可见性。

**核心思想：读写分离**

* **读读共享**：多个读者可以同时访问资源，极大地提高了并发度。
* **写写互斥**：同一时间只允许一个写者修改资源，保证数据一致性。
* **读写互斥**：当有写者持有写锁时，读者必须等待；反之，当有读者持有读锁时，写者也必须等待（*注意：这里有一个细节，持有写锁的线程可以继续获取读锁，我们稍后会详细讨论“锁降级”*）。

通过这种读写分离的设计，`ReentrantReadWriteLock` 在读多写少的场景下能够显著提升系统的吞吐量和性能，同时确保数据的一致性。

---

## 2. 核心特性详解

`ReentrantReadWriteLock` 不仅仅是简单的读写分离，它还具备许多强大的特性。

### 2.1 读写分离 (Read-Write Separation)

这是最核心的特性，我们上面已经介绍过。关键在于理解“共享”和“独占”的概念：

* **获取读锁 (`readLock().lock()`)**：
  + 如果当前没有线程持有写锁，并且没有写线程在等待（非公平模式下，或公平模式下队列前面没有写线程），则当前线程成功获取读锁。
  + 允许多个线程同时获取读锁。
  + 如果当前有线程持有写锁，则获取读锁的线程会被阻塞。
* **获取写锁 (`writeLock().lock()`)**：
  + 如果当前没有任何线程持有读锁或写锁，则当前线程成功获取写锁。
  + 如果当前有任何线程持有读锁，则获取写锁的线程会被阻塞。
  + 如果当前有其他线程持有写锁，则获取写锁的线程会被阻塞。

### 2.2 可重入性 (Reentrancy)

和 `ReentrantLock` 一样，`ReentrantReadWriteLock` 也是**可重入**的。这意味着：

* **读锁可重入**：持有读锁的线程可以再次成功获取读锁，而不会被自己阻塞。每次获取都需要对应一次释放。内部会维护一个计数器来记录线程重入的次数。
* **写锁可重入**：持有写锁的线程可以再次成功获取写锁，而不会被自己阻塞。同样，内部会维护写锁的重入计数。
* **写锁可以重入读锁**：持有写锁的线程**可以**成功获取读锁。这是实现“锁降级”的基础。我们将在后面详细讨论。
* **读锁不能重入（升级为）写锁**：持有读锁的线程**不能**直接获取写锁。尝试这样做通常会导致死锁或失败。思考一下为什么：当你持有读锁时，可能还有其他线程也持有读锁。如果你此时尝试获取写锁，你需要等待所有其他读锁释放，而其他读锁持有者可能也在尝试升级，导致相互等待。

**示例：**

```
import java.util.concurrent.locks.*;

public class ReentrancyDemo {
    private final ReentrantReadWriteLock rwLock = new ReentrantReadWriteLock();
    private final Lock readLock = rwLock.readLock();
    private final Lock writeLock = rwLock.writeLock();
    private int value = 0;

    // 读锁重入示例
    public int readValue() {
        readLock.lock(); // 第一次获取读锁
        try {
            System.out.println(Thread.currentThread().getName() + " 获取了读锁，准备再次获取");
            readLock.lock(); // 第二次获取读锁 (成功)
            try {
                System.out.println(Thread.currentThread().getName() + " 再次获取了读锁");
                return value;
            } finally {
                System.out.println(Thread.currentThread().getName() + " 释放内层读锁");
                readLock.unlock(); // 释放第二次获取的读锁
            }
        } finally {
            System.out.println(Thread.currentThread().getName() + " 释放外层读锁");
            readLock.unlock(); // 释放第一次获取的读锁
        }
    }

    // 写锁重入示例
    public void increment() {
        writeLock.lock(); // 第一次获取写锁
        try {
            System.out.println(Thread.currentThread().getName() + " 获取了写锁，准备再次获取");
            writeLock.lock(); // 第二次获取写锁 (成功)
            try {
                System.out.println(Thread.currentThread().getName() + " 再次获取了写锁");
                value++;
            } finally {
                System.out.println(Thread.currentThread().getName() + " 释放内层写锁");
                writeLock.unlock(); // 释放第二次获取的写锁
            }
        } finally {
            System.out.println(Thread.currentThread().getName() + " 释放外层写锁");
            writeLock.unlock(); // 释放第一次获取的写锁
        }
    }

    // 写锁重入读锁示例 (锁降级的一部分)
    public void writeAndRead() {
        writeLock.lock(); // 获取写锁
        try {
            System.out.println(Thread.currentThread().getName() + " 获取了写锁");
            value = 100; // 修改数据

            readLock.lock(); // 在持有写锁的情况下，获取读锁 (成功)
            try {
                System.out.println(Thread.currentThread().getName() + " 在持有写锁时获取了读锁, value = " + value);
                // ... 可以进行一些读操作 ...
            } finally {
                System.out.println(Thread.currentThread().getName() + " 释放读锁 (在写锁内部)");
                readLock.unlock(); // 释放读锁
            }

        } finally {
            System.out.println(Thread.currentThread().getName() + " 释放写锁");
            writeLock.unlock(); // 释放写锁
        }
    }

    public static void main(String[] args) {
        ReentrancyDemo demo = new ReentrancyDemo();

        new Thread(demo::readValue, "Reader-1").start();
        new Thread(demo::increment, "Writer-1").start();
        new Thread(demo::writeAndRead, "Writer-Reader").start();
    }
}


```

### 2.3 公平性选择 (Fairness)

`ReentrantReadWriteLock` 允许你在创建时选择**公平模式**或**非公平模式**（默认）：

```
// 非公平模式 (默认)
ReadWriteLock nonFairLock = new ReentrantReadWriteLock();
ReadWriteLock nonFairLockExplicit = new ReentrantReadWriteLock(false);

// 公平模式
ReadWriteLock fairLock = new ReentrantReadWriteLock(true);


```

这里的“公平”指的是线程获取锁的顺序。

* **公平锁 (Fair)**：
  + 线程获取锁的顺序严格按照它们发出请求的顺序（FIFO - 先来先服务）。无论是读线程还是写线程，都进入同一个等待队列排队。
  + **优点**：保证了公平性，可以防止线程“饥饿”（某个线程长时间得不到执行机会）。
  + **缺点**：通常吞吐量较低。因为即使锁是可用的，如果队列前面有等待者，新来的线程也必须排队，导致上下文切换和额外的开销。
* **非公平锁 (Non-Fair)**：
  + 允许线程“插队”。当一个线程请求锁时，如果锁恰好可用（没有其他线程持有写锁，对于读锁；没有其他线程持有读锁或写锁，对于写锁），它会尝试直接获取锁，而不管队列中是否有其他线程在等待。
  + **优点**：通常具有更高的吞吐量。因为它减少了线程挂起和唤醒的开销，如果锁刚好可用，线程可以直接获取并执行。
  + **缺点**：可能导致“饥饿”。如果读操作非常频繁，写线程可能一直被新来的读线程插队，长时间无法获取写锁。同样，某个读线程也可能一直被其他线程插队。

**写线程优先策略 (Write Preference / Reader Starvation)**

值得注意的是，即使在**非公平模式**下，`ReentrantReadWriteLock` 也体现出一种**对写锁的轻微偏好**，以尝试缓解写线程饥饿问题。具体来说：

* **非公平模式下，当一个线程尝试获取读锁时**：如果等待队列的**头部**是一个**正在等待写锁**的线程，那么这个尝试获取读锁的线程**不会**成功获取（即使当前锁是可用的），而是会被阻塞加入队列。这给了等待中的写线程一个优先的机会。
* **非公平模式下，当一个线程尝试获取写锁时**：如果锁可用，它会尝试直接获取，无论队列头部是读线程还是写线程。

这种设计试图在吞吐量和写线程饥饿之间找到一个平衡。但在极端的读密集场景下，非公平锁仍然可能导致写线程饥饿。

**公平模式下**：没有这种偏好，严格按照 FIFO。如果队列头是等待读的线程，则等待读的线程（可以有多个）先获取；如果队列头是等待写的线程，则该写线程先获取。

我们将在源码分析部分更深入地探讨 `readerShouldBlock()` 和 `writerShouldBlock()` 这两个方法的实现。

### 2.4 锁降级 (Lock Downgrading)

这是一个非常重要且独特的特性。

**锁降级**：指线程在持有**写锁**的情况下，**再**去获取**读锁**，然后**释放写锁**的过程。

**为什么需要锁降级？**

想象一个场景：你需要更新一个共享数据结构，更新完之后，你需要基于更新后的状态进行一些只读的操作（可能比较耗时），并且希望在进行这些只读操作时，允许其他线程也能读取这个最新的状态。

如果不使用锁降级，你有两种选择：

1. **一直持有写锁**：获取写锁 -> 更新数据 -> 执行只读操作 -> 释放写锁。
   * 缺点：在执行只读操作期间，写锁一直被占用，其他所有线程（读和写）都无法访问，并发性差。
2. **释放写锁后再获取读锁**：获取写锁 -> 更新数据 -> 释放写锁 -> 获取读锁 -> 执行只读操作 -> 释放读锁。
   * 缺点：在释放写锁和重新获取读锁之间存在一个**间隙**。在这个间隙中，其他写线程可能介入修改了数据，导致你接下来读取到的数据不是你刚刚写入的那个状态，破坏了数据的一致性或你操作的原子性。

**锁降级完美地解决了这个问题：**

```
writeLock.lock(); // 1. 获取写锁
try {
    // 2. 更新共享数据
    updateData();

    readLock.lock(); // 3. 在持有写锁的情况下，获取读锁 (成功)
    // 此时，当前线程同时持有写锁和读锁

} finally {
    // 4. 释放写锁
    // 必须在 finally 块中释放，即使获取读锁失败也要释放写锁
    writeLock.unlock();
}

// 此时，当前线程只持有读锁
try {
    // 5. 基于更新后的数据执行只读操作
    // 其他线程现在也可以获取读锁，并发读取最新数据
    readDataBasedOnUpdate();

} finally {
    // 6. 释放读锁
    readLock.unlock();
}


```

**锁降级的关键步骤和意义：**

1. **先获取写锁**：保证独占访问，安全地修改数据。
2. **再获取读锁**：在持有写锁时获取读锁是允许的。这一步是为了确保后续读取的是自己刚刚写入的数据，并且防止其他写者介入。
3. **然后释放写锁**：这是“降级”的关键。释放写锁后，当前线程仍然持有读锁。此时，其他等待读锁的线程可以开始获取读锁并访问数据了，提高了并发性。写锁的释放使得独占状态转变为共享状态。
4. **最后释放读锁**：完成所有操作后，释放读锁。

**为什么不支持锁升级 (Lock Upgrading)?**

锁升级是指线程先持有读锁，然后尝试获取写锁。`ReentrantReadWriteLock` **不支持**锁升级，原因如下：

* **死锁风险**：假设线程 A 和线程 B 都持有读锁，然后都尝试升级为写锁。A 需要等待 B 释放读锁才能获取写锁，B 也需要等待 A 释放读锁才能获取写锁，形成循环等待，导致死锁。
* **语义模糊**：当一个线程持有读锁时，可能还有其他多个线程也持有读锁。此时该线程请求写锁，是应该立即获得（这会破坏写锁的独占性），还是等待所有其他读锁释放？后者难以高效实现且易出错。
* **实现复杂性**：支持升级会大大增加锁实现的复杂度和开销。

如果你确实需要先读后写，标准的做法是：**先释放读锁，再去尝试获取写锁**。但要注意，这期间数据可能被其他线程修改。

```
Data data;
readLock.lock();
try {
    data = readSomeData();
    if (needsUpdate(data)) {
        // 需要升级，但不能直接升级
    } else {
        return; // 不需要更新，直接返回
    }
} finally {
    readLock.unlock(); // 必须先释放读锁
}

// 读锁已释放，现在尝试获取写锁
writeLock.lock();
try {
    // ！！！再次检查条件！！！
    // 因为在你释放读锁到获取写锁期间，其他线程可能已经修改了数据
    Data currentData = readSomeDataAgain(); // 可能需要重新读取或用之前的 data 验证
    if (needsUpdate(currentData)) { // 或者 if (isStateStillValid(data))
        updateData(currentData);
    }
} finally {
    writeLock.unlock();
}


```

看到锁升级的复杂性了吗？通常需要“双重检查”逻辑，这也是为什么锁降级这种单向转换更有用、更安全。

### 2.5 锁获取中断 (Interruptible Lock Acquisition)

和 `ReentrantLock` 一样，`ReentrantReadWriteLock` 的读锁和写锁都支持可中断的锁获取方式：

* `lock()`: 获取锁，如果锁不可用，则当前线程被禁用以进行线程调度，并且处于休眠状态，直到获得锁。**不可中断**。
* `lockInterruptibly()`: 获取锁，如果锁可用则立即返回。如果锁不可用，则当前线程将休眠，直到发生两件事情之一：锁被当前线程获取；或者其他某个线程中断了当前线程 (`Thread.interrupt()`)。如果被中断，该方法会抛出 `InterruptedException`。**可中断**。
* `tryLock()`: **非阻塞**获取锁。尝试立即获取锁。如果成功，则返回 `true`。如果锁不可用（被其他线程持有），则立即返回 `false`。**不等待，不可中断**。
* `tryLock(long timeout, TimeUnit unit)`: **带超时的阻塞**获取锁。尝试在给定的超时时间内获取锁。如果在超时时间内成功获取锁，则返回 `true`。如果在超时时间内锁仍不可用，或者线程在等待期间被中断，则返回 `false`（如果是被中断，`Thread.interrupted()` 会返回 `true`）。**可中断**。

**使用场景：**

* 当你希望你的线程在等待锁的时候能够响应中断信号时（例如，实现取消操作），应该使用 `lockInterruptibly()` 或带超时的 `tryLock()`。
* 当你希望尝试获取锁，如果获取不到就执行其他逻辑（或者稍后重试）时，可以使用 `tryLock()`。
* 如果你确定线程必须获取到锁才能继续，并且不关心等待期间的中断，可以使用 `lock()`。

**示例：**

```
ReadWriteLock lock = new ReentrantReadWriteLock();
Lock readLock = lock.readLock();

// ... 在某个线程中 ...
try {
    // 尝试获取读锁，最多等待 1 秒
    if (readLock.tryLock(1, TimeUnit.SECONDS)) {
        try {
            // 成功获取锁
            System.out.println("成功获取读锁");
            // ... 执行读操作 ...
            Thread.sleep(2000); // 模拟操作
        } finally {
            readLock.unlock();
            System.out.println("释放读锁");
        }
    } else {
        // 超时未获取到锁
        System.out.println("获取读锁超时");
    }
} catch (InterruptedException e) {
    // 在等待锁期间被中断
    System.out.println("等待读锁时被中断");
    Thread.currentThread().interrupt(); // 重新设置中断状态
}


```

### 2.6 条件变量 (Condition Support)

`ReentrantReadWriteLock` 的 **写锁** (`WriteLock`) 支持条件变量 (`Condition`)，其行为与 `ReentrantLock` 的 `Condition` 完全相同。你可以通过 `writeLock().newCondition()` 来创建。

**但是，读锁 (`ReadLock`) 不支持条件变量！** 调用 `readLock().newCondition()` 会抛出 `UnsupportedOperationException`。

**为什么读锁不支持 Condition？**

`Condition` 通常用于线程间的协作：一个线程在某个条件下 (`await()`) 等待，直到另一个线程满足了该条件并发出信号 (`signal()` 或 `signalAll()`)。这隐含了一个前提：发出信号的线程需要独占地修改状态，以满足等待线程的条件。

而读锁是共享的。如果允许在读锁上 `await()`，那么当一个持有读锁的线程 `await()` 时，它应该释放读锁吗？如果不释放，其他写线程永远无法获取锁来改变条件。如果释放了，它在被唤醒时如何安全地恢复读锁状态（可能其他线程在此期间获取了写锁）？

如果允许在读锁上 `signal()`，哪个等待的线程应该被唤醒？由于读锁是共享的，`signal` 的语义会变得非常复杂和模糊。

因此，为了简化设计和避免语义混乱，`Condition` 只与具有独占性的写锁关联。如果你需要在读操作中等待某个条件，通常需要重新设计你的并发策略，或者在获取写锁后进行条件判断和等待。

**示例 (使用写锁的 Condition)：**

```
import java.util.concurrent.locks.*;

public class ConditionDemo {
    private final ReentrantReadWriteLock rwLock = new ReentrantReadWriteLock();
    private final Lock writeLock = rwLock.writeLock();
    private final Condition condition = writeLock.newCondition(); // 从写锁创建 Condition
    private boolean dataReady = false;

    public void producer() {
        writeLock.lock();
        try {
            System.out.println("生产者获取写锁，准备生产数据...");
            Thread.sleep(1000); // 模拟生产
            dataReady = true;
            System.out.println("数据已生产，发出信号");
            condition.signalAll(); // 通知所有等待的消费者
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            writeLock.unlock();
            System.out.println("生产者释放写锁");
        }
    }

    public void consumer() {
        writeLock.lock(); // 消费者也需要获取写锁来安全地检查和等待条件
        try {
            while (!dataReady) {
                System.out.println("消费者获取写锁，发现数据未就绪，开始等待...");
                try {
                    condition.await(); // 等待条件满足，会自动释放写锁，被唤醒时会自动重新获取
                    System.out.println("消费者被唤醒，重新获取写锁");
                } catch (InterruptedException e) {
                    System.out.println("消费者等待时被中断");
                    Thread.currentThread().interrupt();
                    return; // 被中断则退出
                }
            }
            // 条件满足
            System.out.println("消费者发现数据已就绪，开始消费...");
            dataReady = false; // 消费掉
        } finally {
            writeLock.unlock();
            System.out.println("消费者释放写锁");
        }
    }

    public static void main(String[] args) throws InterruptedException {
        ConditionDemo demo = new ConditionDemo();

        Thread c1 = new Thread(demo::consumer, "Consumer-1");
        Thread c2 = new Thread(demo::consumer, "Consumer-2");
        Thread p1 = new Thread(demo::producer, "Producer-1");

        c1.start();
        c2.start();
        Thread.sleep(100); // 确保消费者先开始等待
        p1.start();

        c1.join();
        c2.join();
        p1.join();
    }
}


```

注意：即使消费者主要是“检查”条件，它也需要获取**写锁**来调用 `await()` 和安全地修改 `dataReady` 状态。

### 2.7 监控与查询方法

`ReentrantReadWriteLock` 提供了一些方法来查询锁的当前状态，这对于调试和监控非常有用：

* `isFair()`: 返回此锁是否设置为公平模式。
* `getOwner()`: （仅在 `ReentrantLock` 中有，`ReentrantReadWriteLock` 没有直接的 `getOwner`，因为所有者可能是多个读线程或一个写线程）。
* `getReadLockCount()`: **查询当前持有读锁的总数量（不是线程数，是获取读锁的总次数）**。这个方法反映的是 `state` 的高 16 位。注意：这个计数包括了所有线程持有的读锁以及重入的次数。例如，如果线程 A 持有读锁并重入了 2 次（总共获取 3 次），线程 B 持有读锁 1 次，则此方法返回 4。
* `isWriteLocked()`: 查询写锁当前是否被任何线程持有。
* `isWriteLockedByCurrentThread()`: 查询写锁是否被**当前**线程持有。
* `getWriteHoldCount()`: 查询**当前**线程持有写锁的重入次数。如果当前线程不持有写锁，则返回 0。
* `getReadHoldCount()`: 查询**当前**线程持有读锁的重入次数。如果当前线程不持有读锁，则返回 0。这个方法比较特殊，它依赖于内部的 `ThreadLocal` 来跟踪每个线程的读锁计数。
* `hasQueuedThreads()`: 查询是否有任何线程正在等待获取此锁（读锁或写锁）。
* `getQueueLength()`: 返回正在等待获取此锁的线程数的估计值。
* `hasQueuedThread(Thread thread)`: 查询指定线程是否正在等待获取此锁。
* `getQueuedWriterThreads()`: 返回正在等待获取写锁的线程集合的估计值。
* `getQueuedReaderThreads()`: 返回正在等待获取读锁的线程集合的估计值。

**使用这些方法时要注意：**

1. 这些方法返回的是瞬时状态，可能在你获取到结果后立即就发生变化。
2. 它们主要用于调试、监控和测试，不应用于程序的同步控制逻辑。例如，**不要**写 `if (!lock.isWriteLocked()) { lock.writeLock().lock(); ... }` 这样的代码，这存在竞态条件，不是原子操作。

---

## 3. 与 ReentrantLock 的比较

现在我们更清晰地对比一下 `ReentrantReadWriteLock` 和 `ReentrantLock`：

| 特性 | ReentrantLock | ReentrantReadWriteLock | 说明 |
| --- | --- | --- | --- |
| **锁类型** | 互斥锁 (Exclusive Lock) | 读写锁 (ReadWrite Lock) | RRWL 区分读写操作 |
| **并发性** | 任何时候只有一个线程能持有锁 | 允许多个读线程同时持有锁，或一个写线程持有锁 | RRWL 在读多写少场景下并发性更高 |
| **适用场景** | 写操作频繁或读写均衡，或锁竞争不激烈 | 读操作远多于写操作，且读操作耗时相对较长 | 选择错误的锁可能导致性能下降 |
| **API复杂度** | 较简单，只有一种锁 (`lock`, `unlock` 等) | 较复杂，需要管理读锁 (`readLock`) 和写锁 (`writeLock`) | 需要分别获取和释放对应的锁 |
| **可重入性** | 支持 | 读锁、写锁均支持，写锁可重入读锁 | 都支持同一线程重复获取自己已持有的锁 |
| **公平性** | 支持公平/非公平模式 | 支持公平/非公平模式 | 非公平模式吞吐量通常更高，但可能饥饿；公平模式反之 |
| **锁获取中断** | 支持 (`lockInterruptibly`, `tryLock`) | 读锁、写锁均支持 (`lockInterruptibly`, `tryLock`) | 都提供灵活的锁获取方式 |
| **条件变量** | 支持 (`newCondition`) | **只有写锁支持** (`writeLock().newCondition()`) | 读锁不支持 `Condition` |
| **锁升级/降级** | 不适用 | **支持锁降级**，不支持锁升级 | 锁降级是 RRWL 的重要特性，用于保证写后读的原子性和并发性 |
| **内部实现 (AQS)** | 使用 AQS 的 `state` 表示重入次数 | 使用 AQS 的 `state` **高16位表示读锁数，低16位表示写锁重入数** | RRWL 的状态表示更复杂，是其实现读写分离的核心 |
| **性能开销** | 相对较低 | 相对较高（状态管理、读锁计数更复杂） | 在写密集或低并发场景，RRWL 的额外开销可能使其比 RL 慢 |

**总结选择依据：**

* **读操作频率远大于写操作？** -> 优先考虑 `ReentrantReadWriteLock`。
* **写操作频繁或读写均衡？** -> `ReentrantLock` 通常更简单、开销更低。
* **需要多个 `Condition` 变量配合复杂逻辑？** -> 如果这些条件都与写操作相关，`ReentrantReadWriteLock` 的写锁可用；如果条件与读操作相关或需要更灵活的条件，`ReentrantLock` 可能更合适。
* **需要锁降级特性？** -> 必须使用 `ReentrantReadWriteLock`。
* **代码追求简单，且性能不是极端瓶颈？** -> `ReentrantLock` 更易用。

---

## 4. 实现原理与源码深度解析 (基于 AQS)

`ReentrantReadWriteLock` 的精妙之处在于其内部实现，它完全基于 `java.util.concurrent.locks.AbstractQueuedSynchronizer` (AQS) 框架。理解 AQS 是理解 `ReentrantReadWriteLock` 源码的关键。

**AQS 核心思想回顾：**

1. **`state` 变量**：一个 `volatile int` 类型的变量，表示同步状态。其含义由子类定义。所有锁获取/释放操作都围绕着对 `state` 的原子性修改（通常使用 CAS - Compare-And-Swap）。
2. **FIFO 等待队列**：一个双向链表，用于管理因获取锁失败而被阻塞的线程。当锁被释放时，通常会唤醒队列头部的线程。
3. **`acquire`/`release` 方法**：AQS 提供了模板方法，如 `acquire(int arg)`、`acquireShared(int arg)`、`release(int arg)`、`releaseShared(int arg)`。这些方法负责线程阻塞、排队、唤醒等通用逻辑。
4. **`tryAcquire`/`tryRelease` 方法**：需要子类去实现的核心方法，定义了获取/释放锁的具体逻辑（如何检查和修改 `state`）。
   * `tryAcquire(int arg)`: 尝试以**独占模式**获取锁。
   * `tryRelease(int arg)`: 尝试以**独占模式**释放锁。
   * `tryAcquireShared(int arg)`: 尝试以**共享模式**获取锁。
   * `tryReleaseShared(int arg)`: 尝试以**共享模式**释放锁。

`ReentrantReadWriteLock` 内部定义了一个名为 `Sync` 的静态内部类，它继承自 `AQS`。`Sync` 有两个子类：`NonfairSync` 和 `FairSync`，分别对应非公平和公平模式。`ReadLock` 和 `WriteLock` 这两个外部可见的锁类，都持有对其关联的 `Sync` 对象的引用，并将锁操作委托给 `Sync` 对象。

```
// ReentrantReadWriteLock 结构简化示意
public class ReentrantReadWriteLock implements ReadWriteLock, java.io.Serializable {
    private final ReentrantReadWriteLock.ReadLock readerLock; // 读锁实例
    private final ReentrantReadWriteLock.WriteLock writerLock; // 写锁实例
    final Sync sync; // 核心同步器，AQS 的子类

    // 构造函数，根据 fair 参数创建 FairSync 或 NonfairSync
    public ReentrantReadWriteLock(boolean fair) {
        sync = fair ? new FairSync() : new NonfairSync();
        readerLock = new ReadLock(this);
        writerLock = new WriteLock(this);
    }

    // 读锁实现
    public static class ReadLock implements Lock, java.io.Serializable {
        private final Sync sync;
        // lock() 方法内部会调用 sync.acquireShared(1);
        // unlock() 方法内部会调用 sync.releaseShared(1);
        // ... 其他方法委托给 sync
    }

    // 写锁实现
    public static class WriteLock implements Lock, java.io.Serializable {
        private final Sync sync;
        // lock() 方法内部会调用 sync.acquire(1);
        // unlock() 方法内部会调用 sync.release(1);
        // newCondition() 方法内部会创建 ConditionObject
        // ... 其他方法委托给 sync
    }

    // 抽象的同步器基类
    abstract static class Sync extends AbstractQueuedSynchronizer {
        // 核心：状态表示、tryAcquire, tryRelease, tryAcquireShared, tryReleaseShared 的实现
    }

    // 非公平实现
    static final class NonfairSync extends Sync {
        // 实现非公平特有的 shouldBlock 方法
    }

    // 公平实现
    static final class FairSync extends Sync {
        // 实现公平特有的 shouldBlock 方法
    }
}


```

### 4.1 核心设计：`state` 的拆分

`ReentrantReadWriteLock` 最巧妙的设计就是如何用 AQS 的**单个 `int` 类型 `state` 变量**同时表示读锁和写锁的状态。它将 32 位的 `state` 分成了两部分：

* **高 16 位 (bits 16-31)**：表示**读锁**的持有计数 (Shared Count)。记录了当前有多少次读锁获取（包括重入）。
* **低 16 位 (bits 0-15)**：表示**写锁**的**重入计数** (Exclusive Count)。记录了持有写锁的线程重入的次数。如果大于 0，表示写锁被某个线程持有。

```
   31                           16 15                            0
  +-------------------------------+-------------------------------+
  |        Read Lock Count        |       Write Lock Count        |
  |      (共享锁持有次数)         |      (独占锁重入次数)         |
  +-------------------------------+-------------------------------+


```

**为什么低 16 位只表示写锁的*重入*次数，而不是持有状态？**

因为写锁是独占的，同一时间最多只有一个线程持有写锁。所以我们不需要一个计数来表示“有多少个线程持有写锁”（这个数只能是 0 或 1）。我们只需要知道：

1. 写锁**是否**被持有（低 16 位是否 > 0）。
2. 如果被持有，是哪个线程持有的（AQS 的 `exclusiveOwnerThread` 变量记录）。
3. 持有写锁的线程重入了多少次（低 16 位的值）。

**相关的位运算辅助方法：**

```
// 在 Sync 类中定义
static final int SHARED_SHIFT   = 16; // 位移量
static final int SHARED_UNIT    = (1 << SHARED_SHIFT); // 代表读锁增加1的单位 (65536)
static final int MAX_COUNT      = (1 << SHARED_SHIFT) - 1; // 读锁或写锁的最大计数值 (65535)
static final int EXCLUSIVE_MASK = (1 << SHARED_SHIFT) - 1; // 用于提取写锁计数的掩码 (0x0000FFFF)

/** 返回读锁计数 (高16位) */
static int sharedCount(int c)    { return c >>> SHARED_SHIFT; }
/** 返回写锁计数 (低16位) */
static int exclusiveCount(int c) { return c & EXCLUSIVE_MASK; }


```

* `sharedCount(c)`：将 `state` 无符号右移 16 位，得到高 16 位的值，即读锁计数。
* `exclusiveCount(c)`：将 `state` 与 `0x0000FFFF` 进行按位与操作，屏蔽掉高 16 位，得到低 16 位的值，即写锁重入计数。

**状态含义示例：**

* `state = 0`：表示锁空闲，既没有线程持有读锁，也没有线程持有写锁。
* `state = 0x00010000` (即 `SHARED_UNIT`)：表示有一个线程持有读锁 1 次。`sharedCount=1`, `exclusiveCount=0`。
* `state = 0x00030000` (即 `3 * SHARED_UNIT`)：表示读锁被获取了 3 次（可能是 3 个不同线程各获取 1 次，或一个线程获取 1 次，另一个线程获取 2 次，等等）。`sharedCount=3`, `exclusiveCount=0`。
* `state = 0x00000001`：表示某个线程持有了写锁，并且重入次数为 1。`sharedCount=0`, `exclusiveCount=1`。
* `state = 0x00000003`：表示持有写锁的线程重入了 3 次。`sharedCount=0`, `exclusiveCount=3`。
* `state = 0x00010001`：**重要！** 这种情况表示持有**写锁**的线程（`exclusiveCount=1`）同时**也持有**了**读锁**（`sharedCount=1`）。这就是**锁降级**发生时的状态。

这种设计使得仅通过 CAS 操作修改 `state` 这一个变量，就能原子性地更新读锁或写锁的状态。但它也限制了读锁和写锁的最大持有/重入次数不能超过 65535 (`MAX_COUNT`)。对于绝大多数应用来说，这个限制是远远足够的。

### 4.2 写锁获取：`tryAcquire(int acquires)` 源码解析

当调用 `writeLock().lock()` 时，内部会调用 AQS 的 `acquire(1)` 方法。`acquire` 是模板方法，它会调用子类实现的 `tryAcquire(1)`。我们来看 `Sync#tryAcquire` 的实现（这里展示的是非公平锁的逻辑核心，公平锁的逻辑类似，只是多了 `hasQueuedPredecessors` 的检查）：

```
// java.util.concurrent.locks.ReentrantReadWriteLock.Sync#tryAcquire
protected final boolean tryAcquire(int acquires) {
    /*
     * Walkthrough:
     * 1. 获取当前线程和当前锁状态 state (c)。
     * 2. 获取写锁计数 (w = exclusiveCount(c))。
     * 3. 如果 c != 0 (锁已被持有，读或写)：
     *    a. 如果 w == 0 (说明是读锁被持有) 或者 持有写锁的线程不是当前线程，则获取失败，返回 false。
     *    b. 如果 w != 0 且持有者是当前线程 (说明是写锁重入)：
     *       i. 检查重入次数是否超限 (w + acquires > MAX_COUNT)。超限则抛异常。
     *       ii. 增加 state 的值 (低16位)，直接设置，因为当前线程已持有独占锁，无需 CAS。
     *       iii. 返回 true。
     * 4. 如果 c == 0 (锁空闲)：
     *    a. 检查是否应该阻塞 (writerShouldBlock() - 公平锁检查，非公平锁通常返回 false)
     *       或者 CAS 设置 state 失败 (说明被其他线程抢先了)。
     *       如果是，则获取失败，返回 false。
     *    b. 如果 CAS 成功：
     *       i. 设置当前线程为独占锁持有者 (setExclusiveOwnerThread(current))。
     *       ii. 返回 true。
     */
    Thread current = Thread.currentThread();
    int c = getState(); // 获取当前 state 值
    int w = exclusiveCount(c); // 提取写锁计数 (低16位)

    if (c != 0) { // 锁已被持有 (读锁或写锁)
        // 情况 1: 读锁被持有 (w == 0)
        // 情况 2: 写锁被持有，但持有者不是当前线程
        if (w == 0 || current != getExclusiveOwnerThread())
            return false; // 获取失败

        // 情况 3: 写锁被当前线程持有，这是重入
        if (w + exclusiveCount(acquires) > MAX_COUNT) // acquires 通常是 1
            throw new Error("Maximum lock count exceeded"); // 检查重入次数是否超限
        // 直接增加 state 的值，因为当前线程已持有独占锁，线程安全
        setState(c + acquires);
        return true; // 重入成功
    }

    // 锁是空闲的 (c == 0)
    // writerShouldBlock() 在 NonfairSync 中通常返回 false, 在 FairSync 中检查队列
    // compareAndSetState(0, acquires) 尝试用 CAS 将 state 从 0 设置为 acquires (通常是 1)
    if (writerShouldBlock() ||
        !compareAndSetState(c, c + acquires)) // CAS 尝试获取锁
        return false; // 如果应该阻塞，或者 CAS 失败，则获取失败

    // CAS 成功，获取写锁成功
    setExclusiveOwnerThread(current); // 记录当前线程为独占锁持有者
    return true;
}


```

**关键点：**

* **状态检查 (`c != 0`)**：首先判断锁是否已被占用。
* **区分读锁和写锁持有 (`w == 0 || current != getExclusiveOwnerThread()`)**：如果 `c!=0` 但 `w==0`，说明是读锁被持有，写锁不能获取。如果 `w!=0` 但持有者不是当前线程，写锁也不能获取。
* **写锁重入 (`w != 0 && current == getExclusiveOwnerThread()`)**：如果写锁被当前线程持有，直接增加 `state` 的低 16 位即可，无需 CAS，因为此时没有其他线程能修改 `state`。
* **空锁获取 (`c == 0`)**：必须使用 CAS (`compareAndSetState`) 来原子性地将 `state` 从 0 修改为 1（或 `acquires`），以防止多个线程同时尝试获取空闲的写锁。
* **公平性 (`writerShouldBlock()`)**：这个方法是区分公平与非公平的关键。
  + `NonfairSync.writerShouldBlock()`: 总是返回 `false`，允许插队。
  + `FairSync.writerShouldBlock()`: 返回 `hasQueuedPredecessors()`，检查等待队列中是否有比当前线程更早的等待者。

### 4.3 写锁释放：`tryRelease(int releases)` 源码解析

当调用 `writeLock().unlock()` 时，内部调用 AQS 的 `release(1)`，它会调用 `tryRelease(1)`。

```
// java.util.concurrent.locks.ReentrantReadWriteLock.Sync#tryRelease
protected final boolean tryRelease(int releases) {
    // 检查调用 unlock 的线程是否是当前持有写锁的线程
    if (!isHeldExclusively())
        throw new IllegalMonitorStateException(); // 如果不是，抛异常

    int nextc = getState() - releases; // 计算释放后的 state 值 (只减少低16位)

    // 检查写锁计数是否变为 0 (完全释放)
    boolean free = exclusiveCount(nextc) == 0;
    if (free)
        setExclusiveOwnerThread(null); // 如果完全释放，清除独占线程标记

    // 直接设置 state，因为当前线程正持有独占锁，线程安全
    setState(nextc);

    // 返回是否完全释放。AQS 的 release 方法会根据这个返回值决定是否唤醒等待队列中的下一个线程
    return free;
}


```

**关键点：**

* **持有者检查 (`isHeldExclusively()`)**：确保只有持有写锁的线程才能调用 `unlock`。`isHeldExclusively()` 内部检查 `getExclusiveOwnerThread() == Thread.currentThread()`。
* **状态更新 (`setState(nextc)`)**：直接减少 `state` 的低 16 位。因为当前线程持有写锁，这个操作是线程安全的。
* **完全释放 (`exclusiveCount(nextc) == 0`)**：当写锁重入计数减到 0 时，表示锁被完全释放。此时需要将 `exclusiveOwnerThread` 设为 `null`。
* **返回值 (`free`)**：告诉 AQS 的 `release` 方法，写锁是否已完全可用。如果是 `true`，`release` 方法会去唤醒等待队列中的后继节点（可能是等待读锁或写锁的线程）。

### 4.4 读锁获取：`tryAcquireShared(int unused)` 源码解析

调用 `readLock().lock()` 时，内部调用 `acquireShared(1)`，它会调用 `tryAcquireShared(1)`。读锁的获取逻辑比写锁复杂，因为它需要处理共享、重入、锁降级以及与写锁的互斥。

```
// java.util.concurrent.locks.ReentrantReadWriteLock.Sync#tryAcquireShared
protected final int tryAcquireShared(int unused) { // unused 参数通常是 1，但在这里没用到
    /*
     * Walkthrough:
     * 1. 获取当前线程。
     * 2. 获取当前 state (c)。
     * 3. 检查是否有写锁被持有，且持有者不是当前线程 (exclusiveCount(c) != 0 && getExclusiveOwnerThread() != current)。
     *    如果是，说明写锁被其他线程持有，当前线程不能获取读锁，返回 -1 (获取失败)。
     *    注意：如果写锁被当前线程持有 (锁降级场景)，这里是允许通过的！
     * 4. 获取当前读锁计数 (r = sharedCount(c))。
     * 5. (非公平锁) 检查是否应该阻塞 (readerShouldBlock())。
     *    (公平锁) 检查队列，以及非公平锁的写优先策略。
     *    检查读锁计数是否超限 (r < MAX_COUNT)。
     *    尝试使用 CAS 增加读锁计数 (compareAndSetState(c, c + SHARED_UNIT))。
     * 6. 如果上述检查通过且 CAS 成功：
     *    a. 更新当前线程的读锁持有计数 (复杂逻辑，涉及 firstReader/cachedHoldCounter/ThreadLocal)。
     *    b. 返回 1 (获取成功)。
     * 7. 如果 CAS 失败或者之前的检查不通过 (例如需要阻塞)：
     *    a. 调用 fullTryAcquireShared(current) 处理复杂情况（自旋重试 CAS，或处理重入）。
     *    b. fullTryAcquireShared 的返回值：1 (成功), -1 (失败), 0 (成功但无法传播给其他等待者)。
     */
    Thread current = Thread.currentThread();
    int c = getState();

    // 关键检查：如果写锁被其他线程持有，则获取读锁失败
    if (exclusiveCount(c) != 0 && // 写锁计数 > 0
        getExclusiveOwnerThread() != current) // 且持有者不是当前线程
        return -1; // 返回 -1 表示获取失败

    int r = sharedCount(c); // 获取当前读锁计数 (高16位)

    // readerShouldBlock() 在非公平模式下会检查队列头是否是等待写锁的线程
    // 在公平模式下会检查队列是否有前驱节点
    if (!readerShouldBlock() && // 检查是否应该阻塞
        r < MAX_COUNT &&         // 检查读锁计数是否超限
        compareAndSetState(c, c + SHARED_UNIT)) { // CAS 尝试增加读锁计数 (将 state 的高16位加1)

        // CAS 成功，获取读锁成功 (可能是首次获取，也可能是重入)
        if (r == 0) { // 第一次获取读锁 (之前读计数为0)
            // 优化：记录第一个读线程及其计数，避免使用 ThreadLocal
            firstReader = current;
            firstReaderHoldCount = 1;
        } else if (firstReader == current) { // 第一个读线程重入
            firstReaderHoldCount++;
        } else { // 其他线程获取读锁，或非 firstReader 重入
            // 使用 ThreadLocal<HoldCounter> 来记录每个线程的读锁重入次数
            HoldCounter rh = cachedHoldCounter; // 缓存上次访问的 HoldCounter，提高性能
            if (rh == null || rh.tid != getThreadId(current)) // 缓存未命中或不是当前线程的
                // 从 ThreadLocal 中获取当前线程的 HoldCounter
                cachedHoldCounter = rh = readHolds.get();
            else if (rh.count == 0)
                // 如果缓存命中但计数为0 (可能上次 unlock 后未移除)，则重新 set 一下
                readHolds.set(rh);
            rh.count++; // 增加当前线程的读锁持有计数
        }
        return 1; // 返回 1 表示获取成功，并且可以传播（允许其他等待的读线程也尝试获取）
    }
    // 如果 CAS 失败，或者 readerShouldBlock() 返回 true，或者计数超限
    // 则进入 fullTryAcquireShared 进行更复杂的处理（包含自旋 CAS 和重入逻辑）
    return fullTryAcquireShared(current);
}


```

**关键点与难点：**

* **与写锁互斥 (`exclusiveCount(c) != 0 && getExclusiveOwnerThread() != current`)**：这是实现读写互斥的关键。但它特别允许了持有写锁的**当前**线程继续获取读锁，这是锁降级能够实现的基础。
* **读锁计数增加 (`compareAndSetState(c, c + SHARED_UNIT)`)**：通过 CAS 原子性地给 `state` 加上 `SHARED_UNIT` (65536)，即只增加高 16 位的值。
* **公平性与写优先 (`readerShouldBlock()`)**:
  + `NonfairSync.readerShouldBlock()`: 检查 `apparentlyFirstQueuedIsExclusive()`，即等待队列的第一个节点是否是想获取**写锁**的线程。如果是，则返回 `true`，当前读请求需要阻塞（写优先策略）。
  + `FairSync.readerShouldBlock()`: 检查 `hasQueuedPredecessors()`，即等待队列中是否有更早的等待者（读或写）。如果是，则返回 `true`。
* **读锁重入计数管理 (难点!)**:
  + 为了支持读锁的可重入性，需要知道**每个**线程到底获取了多少次读锁。
  + 直接在 `state` 的高 16 位只能记录**总**的读锁获取次数，无法区分线程。
  + **`ThreadLocal<HoldCounter> readHolds`**: 这是核心解决方案。每个线程通过 `ThreadLocal` 维护一个自己的 `HoldCounter` 对象，`HoldCounter` 里记录了该线程的读锁重入次数 (`count`)。
  + **`firstReader` 和 `firstReaderHoldCount`**: 这是一个优化。如果只有一个线程持有读锁（很常见），就直接用这两个变量记录，避免 `ThreadLocal` 的开销。
  + **`cachedHoldCounter`**: 这是对 `ThreadLocal` 访问的进一步优化。缓存了上一个访问 `readHolds` 的线程的 `HoldCounter`。如果下一个访问的还是同一个线程，可以直接使用缓存，避免 `readHolds.get()` 的开销。
  + 这个复杂的设计是为了在保证功能正确的同时，尽可能提高读锁获取/释放的性能，因为读操作通常非常频繁。
* **`fullTryAcquireShared(Thread current)`**: 处理 `tryAcquireShared` 中 CAS 失败或需要阻塞的情况。它内部会有一个自旋 (for loop)，不断尝试 CAS 更新 `state`，并处理读锁重入（如果发现当前线程已经持有读锁，则只增加 `ThreadLocal` 中的计数，不修改 `state`）。

**返回值：**

* `tryAcquireShared` 和 `fullTryAcquireShared` 的返回值遵循 AQS 共享模式的规定：
  + **负数 (`-1`)**: 获取失败。
  + **零 (`0`)**: 获取成功，但后续的共享获取者（等待队列中的其他读线程）不能继续获取（这种情况在 `ReentrantReadWriteLock` 中不常见，但在如 `Semaphore` 中可能出现）。
  + **正数 (`1`)**: 获取成功，并且允许后续的共享获取者继续尝试获取。这使得等待队列中连续的读线程可以被快速唤醒并获取读锁。

### 4.5 读锁释放：`tryReleaseShared(int unused)` 源码解析

调用 `readLock().unlock()` 时，内部调用 `releaseShared(1)`，它会调用 `tryReleaseShared(1)`。

```
// java.util.concurrent.locks.ReentrantReadWriteLock.Sync#tryReleaseShared
protected final boolean tryReleaseShared(int unused) {
    Thread current = Thread.currentThread();

    // 处理 firstReader 优化的情况
    if (firstReader == current) {
        // assert firstReaderHoldCount > 0;
        if (firstReaderHoldCount == 1)
            firstReader = null; // 完全释放
        else
            firstReaderHoldCount--; // 减少计数
    } else { // 处理非 firstReader 或 firstReader 已为 null 的情况
        // 获取当前线程的 HoldCounter 缓存或从 ThreadLocal 获取
        HoldCounter rh = cachedHoldCounter;
        if (rh == null || rh.tid != getThreadId(current))
            rh = readHolds.get();
        int count = rh.count;
        if (count <= 1) { // 如果计数小于等于1，说明是最后一次释放
            readHolds.remove(); // 从 ThreadLocal 中移除
            if (count <= 0) // 如果计数已经<=0了（不该发生但做个检查），抛异常
                throw unmatchedUnlockException();
        }
        // 减少当前线程的读锁持有计数
        --rh.count;
    }

    // 使用自旋 + CAS 来减少 state 的高 16 位 (读锁总数)
    for (;;) {
        int c = getState();
        int nextc = c - SHARED_UNIT; // 计算减去一个读锁计数后的 state
        if (compareAndSetState(c, nextc)) // CAS 更新 state
            // 如果 CAS 成功：
            // 检查读锁计数是否变为 0 (nextc == 0)。
            // 如果变为 0，说明最后一个读锁被释放了，此时可能需要唤醒等待队列中的写线程。
            // 返回 true，告诉 AQS 的 releaseShared 方法可以去唤醒后继节点了。
            return nextc == 0;
    }
}


```

**关键点：**

* **更新线程局部计数 (`firstReaderHoldCount` 或 `rh.count`)**：首先减少当前线程自己的读锁持有计数。这是必要的，因为 `state` 只记录总数。
* **移除 `ThreadLocal` (`readHolds.remove()`)**：当一个线程的读锁计数减到 0 时，必须从 `ThreadLocal` 中移除对应的 `HoldCounter`，以避免内存泄漏。
* **CAS 更新 `state` (`compareAndSetState(c, nextc)`)**: 使用无限循环 (`for (;;)`) 和 CAS 来原子性地将 `state` 减去 `SHARED_UNIT`。需要循环是因为在读取 `c` 和执行 CAS 之间，`state` 可能被其他获取或释放读锁的线程修改了。
* **返回值 (`nextc == 0`)**: 这是最重要的部分。当 `state` 减少后恰好变为 0 时，意味着最后一个读锁已经被释放。此时，等待队列中可能阻塞着等待写锁的线程，需要被唤醒。`releaseShared` 方法会利用这个 `true` 的返回值来触发唤醒逻辑。如果 `nextc` 不为 0（还有其他读锁），则返回 `false`，通常不需要唤醒（因为写线程仍然无法获取锁）。

### 4.6 公平性与非公平性实现差异 (`shouldBlock` 方法)

公平与非公平模式的主要区别体现在 `tryAcquire`、`tryAcquireShared` 中调用的 `writerShouldBlock()` 和 `readerShouldBlock()` 方法，以及 AQS 内部处理排队和唤醒的逻辑。

**NonfairSync:**

```
// 非公平同步器
static final class NonfairSync extends Sync {
    // 写者是否应该阻塞？非公平模式下，只要 CAS 成功就不阻塞
    final boolean writerShouldBlock() {
        return false; // Writer allows barging
    }
    // 读者是否应该阻塞？
    final boolean readerShouldBlock() {
        /* As described above, check queue first. */
        // 检查等待队列的头部是否是想获取独占(写)锁的线程
        // 如果是，则当前读线程应该阻塞，让写线程优先。
        return apparentlyFirstQueuedIsExclusive();
    }
}
// apparentlyFirstQueuedIsExclusive() 大致逻辑:
// 查看 AQS 队列的 head 节点的下一个有效节点 (第一个等待者)
// 判断该节点是否在请求独占模式 (即等待写锁)


```

* **写者 (`writerShouldBlock`)**: 总是返回 `false`，意味着写线程尝试获取锁时，只要锁可用，就直接尝试 CAS，无视队列中的等待者（允许插队）。
* **读者 (`readerShouldBlock`)**: 检查队列头部是否是等待**写锁**的线程。如果是，则当前读者需要阻塞，体现了对写锁的轻微偏好，防止写者过度饥饿。如果队列为空或头部是等待读锁的线程，则读者可以尝试插队。

**FairSync:**

```
// 公平同步器
static final class FairSync extends Sync {
    // 写者是否应该阻塞？公平模式下，检查队列是否有前驱节点
    final boolean writerShouldBlock() {
        return hasQueuedPredecessors(); // 检查队列中是否有等待者
    }
    // 读者是否应该阻塞？公平模式下，检查队列是否有前驱节点
    final boolean readerShouldBlock() {
        return hasQueuedPredecessors(); // 检查队列中是否有等待者
    }
}
// hasQueuedPredecessors() 大致逻辑:
// 查看 AQS 队列的 head 节点的下一个有效节点 (第一个等待者)
// 如果存在等待者，返回 true (需要排队)
// 如果不存在，返回 false (可以尝试获取锁)


```

* **写者 (`writerShouldBlock`)**: 调用 `hasQueuedPredecessors()`。如果队列中有任何线程在等待（无论是读还是写），当前写线程就必须排队，返回 `true`。
* **读者 (`readerShouldBlock`)**: 也调用 `hasQueuedPredecessors()`。如果队列中有任何线程在等待，当前读线程也必须排队，返回 `true`。

**总结：**

* 非公平锁允许读写线程在锁可用时插队（但读者会礼让等待中的写者），吞吐量高，可能饥饿。
* 公平锁严格按 FIFO 排队，无饥饿，吞吐量相对较低。

---

## 5. 使用场景与最佳实践

理解了内部原理后，我们再来看看如何在实际项目中正确、高效地使用 `ReentrantReadWriteLock`。

### 5.1 何时选择 ReentrantReadWriteLock？

再次强调，最适合的场景是“**读多写少**”：

1. **读操作频率远超写操作**：这是使用读写锁获得性能提升的基本前提。如果写操作很频繁，锁竞争和切换的开销可能抵消读并发带来的好处，甚至比 `ReentrantLock` 更慢。
2. **读操作耗时相对较长**：如果读操作非常快（例如只是读取一个 `volatile` 变量），那么锁本身的开销（CAS、线程阻塞唤醒、`ThreadLocal` 维护等）可能就超过了并发执行节省的时间。只有当读操作本身有一定耗时（如集合遍历、复杂计算、I/O 操作等），允许多个读操作并行执行的收益才会显现。
3. **需要保证数据一致性**：写操作必须是原子的，且写操作进行时不能有读操作干扰，读操作进行时不能有写操作干扰。
4. **可以接受一定的复杂性**：相比 `ReentrantLock`，读写锁的 API 更复杂，需要正确区分和使用读锁、写锁。

**具体应用示例：**

* **内存缓存 (In-Memory Cache)**：
  + `get(key)` 操作使用读锁。
  + `put(key, value)`, `remove(key)`, `clear()` 操作使用写锁。
  + `computeIfAbsent(key, mappingFunction)` 操作通常需要先用读锁尝试读取，失败后再获取写锁进行计算和写入（注意双重检查）。
* **配置管理**：系统的配置信息通常加载后很少变动，但会被多个组件频繁读取。
  + 读取配置使用读锁。
  + 更新配置（例如，动态刷新）使用写锁。
* **共享数据结构**：维护一个共享的数据结构（如列表、映射），读取操作（遍历、查找）远多于修改操作（添加、删除）。
  + 读取/遍历使用读锁。
  + 添加/删除/修改使用写锁。
* **数据库连接池**：获取连接池状态（如空闲连接数）可以用读锁，分配或回收连接（修改连接池状态）需要写锁（这只是一个简化示例，实际连接池实现可能更复杂）。

### 5.2 缓存实现示例 (深化)

我们来看一个稍微健壮一点的基于 `ReentrantReadWriteLock` 的缓存示例，重点关注 `computeIfAbsent` 的实现：

```
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import java.util.function.Function;

public class CacheWithReadWriteLock<K, V> {
    private final Map<K, V> cache = new HashMap<>();
    // 推荐使用接口类型声明引用
    private final ReadWriteLock rwLock = new ReentrantReadWriteLock();
    private final Lock readLock = rwLock.readLock();
    private final Lock writeLock = rwLock.writeLock();

    // 使用读锁获取缓存
    public V get(K key) {
        readLock.lock();
        try {
            return cache.get(key);
        } finally {
            readLock.unlock();
        }
    }

    // 使用写锁放入缓存
    public void put(K key, V value) {
        writeLock.lock();
        try {
            cache.put(key, value);
        } finally {
            writeLock.unlock();
        }
    }

    /**
     * 如果 key 对应的 value 存在，则返回；否则，使用 mappingFunction 计算 value，
     * 存入缓存并返回计算出的 value。
     * 这是一个线程安全的操作。
     */
    public V computeIfAbsent(K key, Function<K, V> mappingFunction) {
        V value;

        // 1. 尝试在读锁下读取
        readLock.lock();
        try {
            value = cache.get(key);
            if (value != null) {
                // 缓存命中，直接返回
                return value;
            }
        } finally {
            readLock.unlock(); // 释放读锁，准备尝试获取写锁
        }

        // 2. 缓存未命中，需要计算并写入，获取写锁
        writeLock.lock();
        try {
            // 3. ！！！再次检查！！！
            // 因为在释放读锁到获取写锁的间隙，可能有其他线程已经计算并写入了该 key
            value = cache.get(key);
            if (value == null) { // 确认仍然不存在
                // 计算 value (这可能是耗时操作)
                value = mappingFunction.apply(key);
                // 存入缓存
                cache.put(key, value);
            }
            // 返回找到的或新计算的值
            return value;
        } finally {
            writeLock.unlock(); // 释放写锁
        }
    }

    // 使用锁降级优化：假设 mappingFunction 很快，但后续处理很慢
    // 这个例子可能有点牵强，主要是为了演示锁降级
    public V computeAndProcess(K key, Function<K, V> mappingFunction, Function<V, V> processFunction) {
        V value;
        writeLock.lock(); // 1. 获取写锁
        try {
            value = cache.get(key);
            boolean needsProcessing = false;
            if (value == null) {
                value = mappingFunction.apply(key); // 计算
                cache.put(key, value); // 写入
                needsProcessing = true; // 新计算的值需要处理
            }

            // 2. 获取读锁 (准备降级)
            readLock.lock();
            try {
                // 3. 释放写锁 (完成降级)
                writeLock.unlock(); // 此时其他读线程可以进入

                // 4. 在读锁下执行后续处理 (可能是耗时操作)
                if (needsProcessing) {
                    value = processFunction.apply(value);
                }
                return value;

            } finally {
                // 5. 释放读锁
                readLock.unlock();
            }
        } catch(Exception e) {
            // 异常处理：如果持有写锁时发生异常，确保写锁被释放
            // 注意：如果异常发生在降级后、释放读锁前，则写锁已释放，只需处理读锁
            // 简单的处理方式是检查写锁是否仍被当前线程持有
            if (rwLock.isWriteLockedByCurrentThread()) {
                writeLock.unlock();
            }
            // 可能还需要处理读锁，但这取决于具体异常点和 finally 结构
            throw new RuntimeException(e); // 或其他异常处理
        }
        // 注意：上面 finally 的异常处理比较简单，复杂的降级场景需要仔细设计保证锁释放
    }


    // 其他操作
    public int size() {
        readLock.lock();
        try {
            return cache.size();
        } finally {
            readLock.unlock();
        }
    }

    public void clear() {
        writeLock.lock();
        try {
            cache.clear();
        } finally {
            writeLock.unlock();
        }
    }
}


```

**关于 `computeIfAbsent` 的说明：**

* **双重检查 (Double-Checked Locking)** 是必需的。因为在你释放读锁去获取写锁的过程中，其他线程可能已经完成了对同一个 key 的计算和写入。获取写锁后必须再次检查 `cache.get(key)`。
* **性能考量**：如果 `mappingFunction` 非常耗时，那么在写锁保护下执行它可能会阻塞其他写操作。但在这种模式下，只有一个线程会实际执行计算。
* **缓存穿透/雪崩问题**：这个简单实现没有处理缓存穿透（大量请求查询不存在的 key）或缓存雪崩（大量 key 同时失效）的问题。实际生产级的缓存需要更复杂的策略（如空值缓存、限流、预热、失效时间随机化等）。

### 5.3 常见陷阱与注意事项

1. **忘记释放锁 (Lock Leak)**：

   * **永远、永远、永远** 将 `unlock()` 调用放在 `finally` 块中。这是最常见的错误，会导致锁无法释放，最终使系统死锁或无响应。
   * 即使你认为你的代码块不会抛出异常，也要使用 `finally`。运行时异常（如 `NullPointerException`）可能在你意想不到的地方发生。

   ```
   // 正确示范
   lock.lock();
   try {
       // do work
   } finally {
       lock.unlock();
   }


   ```
2. **错误使用锁类型**：

   * 在只需要读操作的地方使用了写锁，会不必要地降低并发性。
   * 在需要修改数据的地方错误地使用了读锁，会导致数据不一致和线程安全问题（尽管 `ReentrantReadWriteLock` 的设计使得写操作必须获取写锁，但逻辑上可能出错，比如在读锁下修改了从缓存中取出的对象的可变状态）。
3. **锁降级顺序错误**：

   * 必须严格按照 **获取写锁 -> 获取读锁 -> 释放写锁 -> 释放读锁** 的顺序。
   * 如果在释放写锁之前没有获取读锁，就失去了降级的意义（无法保证读取的是最新值，且中间有间隙）。
   * 如果在获取读锁之前就释放了写锁，同样有间隙问题。
4. **尝试锁升级**：

   * 如前所述，持有读锁时尝试获取写锁是**不被支持的**，通常会导致死锁。正确的做法是先释放读锁，再尝试获取写锁（并进行双重检查）。
5. **在读锁上使用 `Condition`**：

   * 调用 `readLock().newCondition()` 会抛出 `UnsupportedOperationException`。条件等待和通知必须与写锁关联。
6. **性能问题**：

   * **写锁竞争激烈**：如果写操作非常频繁，`ReentrantReadWriteLock` 可能比 `ReentrantLock` 性能更差，因为其内部机制更复杂，写锁需要等待所有读锁释放。
   * **伪共享 (False Sharing)**：虽然 `ReentrantReadWriteLock` 内部的一些计数器（如 `HoldCounter`）可能涉及到线程局部存储或缓存，但在极端的 CPU 核心数和高并发读写场景下，需要关注 CPU 缓存行伪共享对性能的影响（这是一个更高级的性能调优话题）。
   * **公平性开销**：公平锁通常比非公平锁有更高的上下文切换开销和更低的吞吐量。仅在确实需要防止饥饿且能接受性能损失时才使用公平锁。
7. **写线程饥饿 (Writer Starvation)**：

   * 在**非公平模式**下，如果读操作极其密集且持续不断，写线程可能长时间获取不到写锁，导致饥饿。虽然非公平模式有对等待写者的偏好，但这不能完全杜绝饥饿。
   * 如果写线程饥饿是主要问题，应考虑使用**公平锁** (`new ReentrantReadWriteLock(true)`)。
8. **死锁 (Deadlock)**：

   * 除了尝试锁升级外，与其他锁交互时也可能发生死锁。例如，线程 A 持有 `lock1` 等待 `lock2`，线程 B 持有 `lock2` 等待 `lock1`。使用读写锁时，要特别注意锁的获取顺序。
   * 如果在持有读锁或写锁的情况下，调用了可能反过来需要获取同一个读写锁（以不同模式）的外部方法，要小心死锁风险。

### 5.4 监控与调试

当遇到性能问题或死锁时，`ReentrantReadWriteLock` 提供的监控方法很有用：

* `getReadLockCount()`: 查看当前有多少读锁被持有（总次数）。如果这个值异常高，可能说明读锁没有正确释放，或者读操作并发度很高。
* `getWriteHoldCount()`: 当前线程持有写锁的重入次数。
* `isWriteLocked()`: 写锁是否被持有。
* `getReadHoldCount()`: 当前线程持有读锁的次数。用于调试读锁重入或释放问题。
* `getQueueLength()`: 等待队列长度。如果长度持续很高，说明锁竞争激烈。
* `getQueuedWriterThreads()` / `getQueuedReaderThreads()`: 查看等待队列中具体是哪些线程在等待写锁或读锁。有助于分析饥饿或死锁问题。

结合线程 dump (使用 `jstack` 命令或 IDE 功能) 可以分析锁的持有情况和线程等待状态，是诊断并发问题的利器。线程 dump 会显示每个线程的堆栈跟踪，以及它正在等待哪个锁，或者持有哪些锁。

---

## 6. 总结

`ReentrantReadWriteLock` 是 Java 并发包中一个强大而精密的工具，它通过**读写分离**的核心思想，极大地优化了“读多写少”场景下的并发性能。

**关键要点回顾：**

* **读锁共享，写锁独占**：允许多个读者并发，保证写者独占。
* **基于 AQS 实现**：利用 `state` 的高 16 位存读锁计数，低 16 位存写锁重入计数。
* **可重入**：读锁和写锁都支持重入。
* **锁降级**：支持从写锁降级到读锁（获取写 -> 获取读 -> 释放写 -> 释放读），不支持锁升级。
* **公平/非公平可选**：影响性能和饥饿可能性。非公平模式默认，吞吐量高但可能饥饿；公平模式反之。非公平模式下对等待的写者有轻微偏好。
* **`Condition` 仅写锁支持**。
* **`finally` 中释放锁**：至关重要！
* **适用场景**：读操作远多于写操作，且读操作有一定耗时。

`ReentrantReadWriteLock` 相比 `ReentrantLock` 或 `synchronized` 提供了更细粒度的控制和更高的读并发潜力，但也带来了更高的复杂性。
