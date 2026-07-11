---
title: "深入理解Condition接口"
description: "在多线程编程中，线程间的协作至关重要。我们经常遇到这样的场景：一个线程需要等待某个条件满足后才能继续执行，而这个条件的改变依赖于其他线程的操作。"
sourceId: "147251627"
source: "https://blog.csdn.net/qq_45852626/article/details/147251627"
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
  order: 147251627
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/147251627)（历史文章导入，当前状态为草稿）

## 1. 前言：为什么需要Condition？

在多线程编程中，线程间的协作至关重要。我们经常遇到这样的场景：一个线程需要等待某个条件满足后才能继续执行，而这个条件的改变依赖于其他线程的操作。  
 例如，在经典的“生产者-消费者”模式中，当缓冲区为空时，消费者线程需要暂停等待，直到生产者线程放入数据；当缓冲区满时，生产者线程需要暂停等待，直到消费者线程取出数据。

Java 的 `Object` 类提供了 `wait()`, `notify()`, 和 `notifyAll()` 方法，它们与 `synchronized` 关键字配合，构成了 Java 内置的线程等待-通知机制。这套机制在很多情况下是有效的，但它也存在一些局限性：

1. **单一等待队列**：一个 `synchronized` 锁对象只能关联一个等待队列。这意味着所有在该锁上等待的线程，无论它们等待的具体条件是什么，都会被放在同一个队列中。
2. **无法精确唤醒**：`notify()` 方法只能随机唤醒等待队列中的一个线程，而 `notifyAll()` 会唤醒所有等待的线程。开发者无法精确地只唤醒等待特定条件的线程。这可能导致不必要的唤醒和竞争，影响效率（“惊群效应”）。
3. **与`synchronized`强绑定**：`wait/notify` 机制必须与 `synchronized` 关键字一起使用，无法与更灵活的 `java.util.concurrent.locks.Lock` 接口配合。

为了克服这些限制，Java 并发包（JUC）引入了 `Condition` 接口。`Condition` 将线程的等待队列（等待集合）从锁对象中分离出来，允许一个 `Lock` 对象关联多个独立的 `Condition` 对象。这使得我们可以为不同的等待条件创建不同的等待队列，从而实现更精确、更灵活、更高效的线程间协作。

**可以把 `Condition` 想象成一个更加智能和专门化的“等待室”**。`synchronized` 只有一个大的、通用的等待室，所有等待者都在里面。而 `Lock` 配合 `Condition`，则允许你根据不同的等待原因设立多个专门的等待室，你可以只通知某个特定等待室里的线程：“你们等待的条件满足了，可以出来了！”

## 2. Condition 接口的核心概念

`java.util.concurrent.locks.Condition` 是一个接口，它定义了线程等待和通知的基本操作。它的核心思想是**将对象监视器方法（`wait`, `notify`, `notifyAll`）分解成不同的对象，与任意 `Lock` 实现组合使用**。

一个 `Condition` 实例本质上是**绑定到一个 `Lock` 上的**。要获取一个 `Condition` 实例，你需要先有一个 `Lock` 对象（通常是 `ReentrantLock`），然后调用该 `Lock` 对象的 `newCondition()` 方法。

```
Lock lock = new ReentrantLock();
Condition condition = lock.newCondition(); // Condition 必须依附于 Lock 创建


```

这种设计强调了 `Condition` 和 `Lock` 之间密不可分的关系：

* **安全性保证**：所有 `Condition` 的核心方法（如 `await()`, `signal()`）**必须在当前线程持有与该 `Condition` 相关联的 `Lock` 的情况下调用**。这确保了对共享状态（即那个“条件”）的检查和修改是原子性的，避免了竞态条件。如果你在未持有锁的情况下调用这些方法，会抛出 `IllegalMonitorStateException`，这与 `Object.wait/notify` 的行为一致。
* **状态管理分离**：`Lock` 负责管理对共享资源的互斥访问（同一时间只有一个线程能进入临界区），而 `Condition` 负责管理线程在特定条件下的等待和唤醒。这种职责分离使得并发控制逻辑更清晰。

**核心方法概览：**

* `await()`: 使当前线程进入等待状态，直到被其他线程 `signal` 或 `signalAll`，或者线程被中断。在等待期间，当前线程会**释放**与该 `Condition` 关联的 `Lock`。当线程被唤醒并准备恢复执行时，它必须**重新获取**这个 `Lock`。
* `signal()`: 唤醒**一个**在该 `Condition` 上等待的线程。具体唤醒哪个线程是不确定的（通常是等待时间最长的那个，但 JUC 规范不保证这一点）。被唤醒的线程需要重新竞争获取 `Lock` 才能从 `await()` 方法返回。
* `signalAll()`: 唤醒**所有**在该 `Condition` 上等待的线程。每个被唤醒的线程都需要重新竞争获取 `Lock`。

此外，`Condition` 还提供了一些 `await` 的变体，提供了更丰富的功能：

* `awaitUninterruptibly()`: 与 `await()` 类似，但线程在等待时**不会响应中断**。
* `awaitNanos(long nanosTimeout)`: 带超时的等待，最多等待指定的纳秒数。如果超时、被 `signal` 或中断，都会返回。可以通过返回值判断是哪种情况。
* `await(long time, TimeUnit unit)`: `awaitNanos` 的更通用版本，可以指定时间单位。
* `awaitUntil(Date deadline)`: 等待直到一个绝对的时间点。

我们将在后续章节详细探讨这些方法。

## 3. Condition 与 Lock 的关系：钥匙与等待室

前面提到，`Condition` 必须与 `Lock` 配合使用。我们可以用一个更形象的比喻来理解它们的关系：**`Lock` 就像是进入一个房间的钥匙，而 `Condition` 则是房间内设立的特定等待区域**。

1. **获取钥匙 (Acquire Lock)**：线程首先需要通过调用 `lock.lock()` 方法获取到 `Lock` 这把“钥匙”，才能进入受保护的“房间”（临界区）。
2. **检查条件 (Check Condition)**：进入房间后，线程检查它所关心的条件是否满足。
3. **进入等待室 (Call `await()`)**：如果条件不满足，线程就不能继续执行。此时，它调用 `condition.await()` 方法，这相当于进入了与该 `Condition` 关联的那个特定“等待室”。**重要的是，在进入等待室的同时，线程会暂时交出它持有的 `Lock` 钥匙**。这允许其他线程能够获取钥匙进入房间，并可能改变那个条件。
4. **在等待室等待 (Wait in Condition Queue)**：线程在等待室里安静地等待。
5. **发出信号 (Call `signal()`/`signalAll()`)**：另一个持有钥匙（持有 `Lock`）的线程进入房间，执行了某些操作，使得之前那个线程等待的条件满足了。这个线程随后调用 `condition.signal()` 或 `condition.signalAll()`，这相当于对着那个特定的等待室喊话：“条件满足了，你们可以出来了！”
6. **离开等待室，重新排队拿钥匙 (Move to Sync Queue)**：收到信号的等待线程被唤醒。但它并不能立刻执行，因为它之前交出了钥匙。它需要离开等待室，重新去门口排队（进入 `Lock` 的同步队列），尝试再次获取 `Lock` 钥匙。
7. **拿到钥匙，继续执行 (Re-acquire Lock and Return from `await()`)**：当该线程成功重新获取到 `Lock` 钥匙后，它才能真正从 `await()` 方法中返回，继续执行它之前未完成的任务。

**为什么必须先获取 `Lock` 才能调用 `Condition` 的方法？**

这是为了保证**状态检查和状态改变的原子性**。假设不持有锁就能调用 `await()`：

* 线程 A 检查条件 `X` 不满足。
* 在线程 A 调用 `await()` 进入等待之前，线程 B 修改了状态，使得条件 `X` 满足了，并调用了 `signal()`。
* 线程 A 此时才调用 `await()` 进入等待。

结果是，线程 A 错过了线程 B 的信号，可能会永远等待下去（Lost Wakeup 问题）。持有锁可以确保从检查条件到进入等待状态是一个原子操作，不会被其他线程的操作打断。同样，`signal()` 也需要在锁的保护下进行，以确保它能看到其他线程对共享状态的最新修改。

## 4. Condition vs. Object.wait/notify：青出于蓝

`Condition` 和 `Object` 的 `wait/notify` 机制都是为了解决线程间的协作问题，但 `Condition` 提供了更强大和灵活的功能。它们的联系和区别如下：

| 特性 | `Object.wait/notify/notifyAll` | `Condition.await/signal/signalAll` | 说明 |
| --- | --- | --- | --- |
| **关联锁** | 必须与 `synchronized` 关键字/代码块配合使用 | 必须与 `java.util.concurrent.locks.Lock` 实现配合使用 | `Condition` 是 `Lock` 的一部分，`wait/notify` 是 `Object` 的一部分。 |
| **等待队列** | 每个锁对象只有一个隐式的等待队列 | 每个 `Lock` 对象可以关联**多个** `Condition` 对象，每个 `Condition` 有自己的等待队列 | 这是 `Condition` 最核心的优势，允许更精细的条件管理。 |
| **唤醒机制** | `notify()`: 随机唤醒一个 `notifyAll()`: 唤醒所有 | `signal()`: 唤醒一个（通常FIFO） `signalAll()`: 唤醒所有 | `Condition` 可以实现精确唤醒等待特定条件的线程。 |
| **中断响应** | 等待中的线程可以被中断（抛出`InterruptedException`） | `await()` 可响应中断，`awaitUninterruptibly()` 不响应中断 | `Condition` 提供了更灵活的中断处理选项。 |
| **超时等待** | `wait(long timeout)` / `wait(long timeout, int nanos)` | `awaitNanos(long)` / `await(long, TimeUnit)` / `awaitUntil(Date)` | `Condition` 提供了更丰富、更易用的超时等待API。 |
| **公平性** | 取决于 `synchronized` 的实现（通常非公平） | 可以配合 `ReentrantLock(true)` 实现公平锁下的公平等待 | `Condition` 可以与公平锁配合，提供一定程度的公平性保证。 |
| **使用方式** | 内置于 Java 语言层面 | 作为 JUC 库的一部分提供 | `Condition` 需要显式创建和使用。 |

**`Condition` 的主要优势：**

1. **精确唤醒 (Targeted Notification)**：这是最大的优势。你可以为不同的条件创建不同的 `Condition` 对象。例如，在生产者-消费者场景中，可以创建 `notEmpty` 和 `notFull` 两个 `Condition`。生产者在缓冲区满时等待 `notFull`，消费者在缓冲区空时等待 `notEmpty`。生产者放入数据后只需 `signal` `notEmpty`，消费者取出数据后只需 `signal` `notFull`。这避免了 `notifyAll` 带来的不必要的唤醒，提高了效率。
2. **更丰富的 API**：提供了不可中断等待、更灵活的超时等待等功能。
3. **与 `Lock` 接口集成**：可以利用 `Lock` 接口提供的 `tryLock()`, `lockInterruptibly()` 等高级锁特性。

**`Condition` 的潜在劣势（或注意事项）：**

1. **使用稍复杂**：需要显式创建 `Lock` 和 `Condition` 对象，并且必须在 `try...finally` 块中手动释放 `Lock`，否则可能导致死锁。`synchronized` 则能自动释放锁。
2. **代码相对冗长**：相比 `synchronized` 的简洁语法，使用 `Lock` 和 `Condition` 的代码量通常会多一些。

**总结来说，`Condition` 是对传统 `wait/notify` 机制的增强和优化，特别适用于需要管理多个等待条件或者需要更精细控制线程协作的复杂并发场景。**

## 5. 核心方法详解与简化源码分析

`Condition` 的实现通常依赖于 AQS (AbstractQueuedSynchronizer)。`ReentrantLock` 内部就有一个基于 AQS 的实现，并且 `ReentrantLock.newCondition()` 返回的是 AQS 的内部类 `ConditionObject` 的实例。我们将以 `ConditionObject` 为例，分析核心方法的原理。

**请注意：** 下面的源码片段是**简化和概念化**的，旨在说明核心逻辑，省略了许多错误处理、边界情况和优化细节。真实的 AQS 源码相当复杂。

### 5.1 `await()` 方法

`await()` 的作用是让当前线程等待，并释放持有的锁。

```
// 简化版 ConditionObject.await() 伪代码与注释
public final void await() throws InterruptedException {
    // 1. 检查中断状态，如果中断了，直接抛出异常
    if (Thread.interrupted())
        throw new InterruptedException();

    // 2. 创建一个新的 Node，代表当前线程，并将其加入到 Condition 自己的等待队列 (condition queue) 的末尾
    //    Node.CONDITION 标记这个节点当前在条件队列中
    Node node = addConditionWaiter();

    // 3. 完全释放当前线程持有的与 Condition 关联的 Lock
    //    这个 state 代表锁的重入次数或持有状态，fullyRelease 会将其完全释放（置零）
    //    返回值 savedState 保存了释放前的状态，以便唤醒后恢复
    int savedState = fullyRelease(node); // 关键步骤：释放锁！

    int interruptMode = 0;
    // 4. 循环检查：当前节点是否已经从条件队列转移到了同步队列 (sync queue)
    //    isOnSyncQueue 判断节点是否已被 signal() 移动到了准备获取锁的队列
    //    如果还没转移，就调用 LockSupport.park() 让当前线程阻塞挂起
    while (!isOnSyncQueue(node)) {
        LockSupport.park(this); // 阻塞当前线程

        // 5. 线程被唤醒后，检查是否因为中断而唤醒
        //    checkInterruptWhileWaiting 会处理中断逻辑，并返回中断模式
        if ((interruptMode = checkInterruptWhileWaiting(node)) != 0)
            break; // 如果是因为中断被唤醒，则跳出循环
    }

    // 6. 线程被唤醒（无论是 signal 还是中断），尝试重新获取之前释放的 Lock
    //    acquireQueued 会让线程进入同步队列排队，直到成功获取锁
    //    第二个参数 savedState 用于恢复之前释放锁时的重入次数
    //    如果获取锁的过程中没有被中断，并且之前等待时被中断了(interruptMode != THROW_IE)
    //    则在获取锁成功后，重新设置线程的中断状态
    if (acquireQueued(node, savedState) && interruptMode != THROW_IE)
        interruptMode = REINTERRUPT; // 标记需要在返回前重新中断

    // 7. 清理条件队列中可能存在的已取消节点 (cancelWaiter)
    if (node.nextWaiter != null)
        unlinkCancelledWaiters();

    // 8. 如果等待过程中或获取锁过程中发生过中断，根据中断模式处理
    //    如果是 THROW_IE，则抛出 InterruptedException
    //    如果是 REINTERRUPT，则重新中断当前线程
    if (interruptMode != 0)
        reportInterruptAfterWait(interruptMode);
}

// --- 辅助方法简化说明 ---

// addConditionWaiter(): 创建代表当前线程的 Node，状态为 CONDITION，加入到条件队列尾部。
// fullyRelease(node): 完全释放当前线程持有的锁，返回释放前的状态。内部会调用 AQS 的 release 方法。
// isOnSyncQueue(node): 检查节点是否已被转移到 AQS 的同步队列。
// LockSupport.park(this): 阻塞当前线程。
// checkInterruptWhileWaiting(node): 检查线程是否在 park 期间被中断，如果是，尝试将节点标记为取消并返回中断类型。
// acquireQueued(node, savedState): 让节点进入 AQS 同步队列排队，尝试获取锁，并恢复锁状态。
// unlinkCancelledWaiters(): 从条件队列中移除已取消的节点。
// reportInterruptAfterWait(interruptMode): 根据中断模式抛出异常或重新设置中断标志。


```

**`await()` 的核心流程总结：**

1. **入队**：将代表当前线程的节点加入到 `Condition` 自己的**条件队列**。
2. **释放锁**：**完全释放**当前线程持有的 `Lock`（即使是重入锁也会完全释放），并保存释放前的状态（如重入次数）。这是为了让其他线程有机会获取锁并改变条件。
3. **阻塞**：调用 `LockSupport.park()` 使当前线程进入**等待状态 (WAITING 或 TIMED\_WAITING)**，直到被 `signal`、中断或超时。
4. **唤醒与转移**：当被 `signal` 时，节点会被从条件队列**转移**到 `Lock` 的**同步队列**。
5. **重新获取锁**：线程从 `park` 返回后，会进入同步队列竞争 `Lock`。只有当它成功**重新获取**到 `Lock`（并恢复到之前的锁状态）之后，`await()` 方法才能返回。
6. **中断处理**：如果在等待过程中或重新获取锁的过程中线程被中断，`await()` 会在重新获取锁之后，根据情况抛出 `InterruptedException` 或重新设置线程的中断状态。

**理解难点：**

* **锁的完全释放与恢复**：即使一个线程多次重入获取了锁（`getHoldCount() > 1`），调用 `await()` 也会将锁完全释放（`holdCount` 变为 0）。当线程被唤醒并重新获取锁后，它的 `holdCount` 会恢复到调用 `await()` 之前的状态。这是通过 `fullyRelease` 保存状态和 `acquireQueued` 恢复状态实现的。
* **队列转移**：线程不是直接从 `await()` 中醒来就执行，而是先从条件队列转移到同步队列，然后像其他尝试获取锁的线程一样排队。

### 5.2 `signal()` 方法

`signal()` 的作用是唤醒一个在条件队列中等待的线程。

```
// 简化版 ConditionObject.signal() 伪代码与注释
public final void signal() {
    // 1. 检查当前线程是否持有与 Condition 关联的 Lock，否则抛出 IllegalMonitorStateException
    if (!isHeldExclusively())
        throw new IllegalMonitorStateException();

    // 2. 获取条件队列的头节点 (firstWaiter)
    Node first = firstWaiter;
    if (first != null) {
        // 3. 如果头节点存在，执行唤醒操作
        doSignal(first);
    }
}

// --- 核心唤醒逻辑 doSignal ---
// (在 signalAll 中也会调用 doSignalAll，原理类似)
private void doSignal(Node first) {
    do {
        // 4. 将头节点从条件队列中断开 (firstWaiter 指向下一个节点)
        if ((firstWaiter = first.nextWaiter) == null)
            lastWaiter = null; // 如果队列空了，尾节点也置 null
        first.nextWaiter = null; // 断开原头节点的 next 指针

        // 5. 调用 AQS 的 transferForSignal 方法，将节点从条件队列转移到同步队列
        //    这个方法会把节点的 waitStatus 从 CONDITION 改为 0 或 SIGNAL，
        //    然后使用 CAS 将其加入到 AQS 同步队列的尾部。
        //    如果转移成功，则调用 LockSupport.unpark() 唤醒该节点对应的线程
    } while (!transferForSignal(first) && (first = firstWaiter) != null);
    // 6. transferForSignal 可能因为节点状态变化（如被取消）而失败，
    //    如果失败且条件队列中还有节点，则继续尝试唤醒下一个节点。
}

// --- 辅助方法简化说明 ---

// isHeldExclusively(): 检查当前线程是否持有锁，内部调用 AQS 的 isHeldExclusively()。
// transferForSignal(node): 尝试将节点从条件队列转移到同步队列。
//    - 修改节点状态 (waitStatus)。
//    - 将节点加入同步队列尾部 (CAS 操作)。
//    - 如果成功加入，则 unpark 节点对应的线程。
//    - 如果节点在转移前被取消，则返回 false。


```

**`signal()` 的核心流程总结：**

1. **检查锁**：确保当前线程持有 `Lock`。
2. **获取头节点**：找到条件队列中的第一个等待节点（通常是等待时间最长的）。
3. **转移节点**：调用 AQS 的内部方法 (`transferForSignal`) 将该节点从**条件队列**移动到 `Lock` 的**同步队列**。这个过程是原子的，并且会改变节点的状态。
4. **唤醒线程**：如果节点成功转移到同步队列，`transferForSignal` 内部会调用 `LockSupport.unpark()` 来唤醒该节点对应的线程。
5. **后续竞争**：被唤醒的线程并不会立即执行，而是进入同步队列参与 `Lock` 的竞争。只有成功获取 `Lock` 后，它才能从之前的 `await()` 调用中返回。

**理解难点：**

* **为什么是转移而不是直接唤醒执行？** 这种设计确保了并发控制的正确性。被唤醒的线程必须重新获取锁，才能保证它在访问共享资源时状态的一致性。如果直接执行，可能会在没有锁保护的情况下访问共享数据。
* **`signal()` 只保证发出信号**：`signal()` 方法执行完毕，仅仅是将一个等待线程从条件队列转移到了同步队列，并唤醒了它。它**不保证**这个被唤醒的线程能立即获得锁，也不保证它获得锁时，它等待的条件仍然是满足的（这就是为什么 `await` 需要在 `while` 循环中检查条件）。

### 5.3 `signalAll()` 方法

`signalAll()` 与 `signal()` 非常相似，区别在于它会唤醒**所有**在条件队列中等待的线程。

```
// 简化版 ConditionObject.signalAll() 伪代码与注释
public final void signalAll() {
    // 1. 检查当前线程是否持有 Lock
    if (!isHeldExclusively())
        throw new IllegalMonitorStateException();

    // 2. 获取条件队列的头节点
    Node first = firstWaiter;
    if (first != null) {
        // 3. 执行唤醒所有节点的操作
        doSignalAll(first);
    }
}

// --- 核心唤醒逻辑 doSignalAll ---
private void doSignalAll(Node first) {
    // 4. 将条件队列的头尾节点都置空，相当于逻辑上清空队列
    lastWaiter = firstWaiter = null;
    do {
        // 5. 获取当前节点的下一个节点
        Node next = first.nextWaiter;
        // 6. 断开当前节点的 next 指针
        first.nextWaiter = null;
        // 7. 调用 transferForSignal 将当前节点转移到同步队列并尝试唤醒
        transferForSignal(first);
        // 8. 处理下一个节点
        first = next;
    } while (first != null); // 循环处理原条件队列中的所有节点
}


```

**`signalAll()` 的核心流程总结：**

1. **检查锁**：同 `signal()`。
2. **遍历队列**：获取条件队列的头节点。
3. **清空队列引用**：将 `firstWaiter` 和 `lastWaiter` 设为 `null`，逻辑上断开所有节点。
4. **逐个转移和唤醒**：遍历原始条件队列中的**每一个**节点，对每个节点执行 `transferForSignal` 操作，将其转移到同步队列并尝试唤醒对应的线程。

**使用 `signal()` 还是 `signalAll()`？**

* 如果确定只有一个线程需要被唤醒，或者唤醒任意一个等待线程都能正确处理，那么使用 `signal()` 更高效，因为它只唤醒一个线程，减少了不必要的竞争和上下文切换。
* 如果多个线程都在等待同一个条件，并且当条件满足时，所有等待的线程都应该被唤醒去尝试执行（例如，多个消费者等待数据到达），那么应该使用 `signalAll()`。
* **注意**：即使你认为只有一个线程在等待，如果无法严格保证这一点，或者条件满足后可能需要唤醒不同类型的等待者，使用 `signalAll()` 通常更安全，尽管可能效率稍低。错误地使用 `signal()` 可能导致某些线程永远无法被唤醒。

## 6. AQS 在 Condition 实现中的角色

AbstractQueuedSynchronizer (AQS) 是 JUC 中许多同步工具（如 `ReentrantLock`, `Semaphore`, `CountDownLatch`）的基础框架。`ConditionObject` 作为 AQS 的内部类，紧密依赖 AQS 提供的机制来实现 `Condition` 的功能。

AQS 在 `Condition` 实现中扮演了以下关键角色：

1. **统一的线程排队模型**：AQS 内部维护了一个核心的**同步队列 (Sync Queue)**。这是一个 FIFO 的双向队列，用于管理那些未能获取到锁（AQS 的 `state`）而需要排队的线程。所有 `Lock` 的获取和释放操作都围绕这个同步队列进行。
2. **条件队列 (Condition Queue) 的管理**：`ConditionObject` 自己管理一个独立的**条件队列**。这是一个**单向链表**，用于存放调用了该 `Condition` 实例的 `await()` 方法而被阻塞的线程。这个队列独立于 AQS 的同步队列。
3. **节点状态 (Node)**：AQS 定义了 `Node` 类作为队列中的基本单元，每个 `Node` 代表一个等待的线程。`Node` 中包含线程引用、状态 (`waitStatus`)、前驱和后继指针等信息。`ConditionObject` 使用 `Node` 来构建条件队列，并通过 `Node.CONDITION` 状态来标识节点位于条件队列中。
4. **原子状态管理**：AQS 提供了一个受保护的 `int` 类型变量 `state`，以及原子更新这个状态的方法（如 `compareAndSetState`, `getState`, `setState`）。`Lock` 的实现（如 `ReentrantLock`）使用 `state` 来表示锁的持有状态（0 表示未被持有，正数表示持有者线程的重入次数）。`Condition` 的操作（如 `await` 释放锁，`signal` 检查锁）都需要间接依赖和修改这个 `state`。
5. **线程阻塞与唤醒原语**：AQS 使用 `LockSupport.park()` 和 `LockSupport.unpark(Thread thread)` 作为底层的线程阻塞和唤醒机制。`await()` 在释放锁后调用 `park()` 使线程休眠，`signal()` 在将节点转移到同步队列后调用 `unpark()` 唤醒线程。
6. **队列间的转移机制**：这是 AQS 支持 `Condition` 的关键。AQS 提供了将节点从条件队列安全地转移到同步队列的内部逻辑（如 `transferForSignal` 方法）。这个转移确保了线程在被唤醒后能够参与到锁的竞争中。

**简单来说，AQS 提供了实现 `Condition` 所需的底层基础设施：线程排队、状态管理、阻塞/唤醒。`ConditionObject` 则利用这些基础设施，实现了条件等待队列的管理以及与 `Lock` 同步队列之间的交互逻辑。**

**条件队列 vs. 同步队列：**

| 特性 | 同步队列 (Sync Queue in AQS) | 条件队列 (Condition Queue in ConditionObject) |
| --- | --- | --- |
| **结构** | 双向链表 (CLH 变体) | 单向链表 |
| **节点状态** | `SIGNAL`, `CANCELLED`, `PROPAGATE`, 0 | `CONDITION` |
| **目的** | 管理等待获取 **Lock** 的线程 | 管理调用 `await()` 等待**条件满足**的线程 |
| **入队时机** | 线程尝试获取 `Lock` 失败时 | 线程调用 `await()` 时 |
| **出队/转移** | 线程成功获取 `Lock` 后出队 | 线程被 `signal`/`signalAll` 后**转移**到同步队列 |
| **与锁关系** | 直接关联 `Lock` 的获取与释放 | 间接关联 `Lock`（`await`释放，唤醒后需重获） |

理解这两个队列以及它们之间的转换，是掌握 `Condition` 工作原理的关键。一个线程的典型流程可能是：

尝试获取 Lock -> 失败 -> **进入同步队列** -> 成功获取 Lock -> 检查条件 -> 条件不满足 -> 调用 `await` -> **进入条件队列** (同时释放 Lock) -> 被 `signal` -> **从条件队列转移到同步队列** -> 重新竞争 Lock -> 成功获取 Lock -> 从 `await` 返回 -> 继续执行。

## 7. 处理虚假唤醒 (Spurious Wakeup)

一个需要特别注意的问题是**虚假唤醒 (Spurious Wakeup)**。它是指线程在没有被其他线程显式调用 `signal()` 或 `signalAll()`，也没有被中断的情况下，意外地从 `await()` 方法中唤醒。

这是底层操作系统或 JVM 实现线程调度时可能出现的一种现象，虽然罕见，但确实可能发生。Java 规范明确允许虚假唤醒的存在，因此我们的代码**必须**能够正确处理它。

**如何处理？**

处理虚假唤醒的**唯一正确方法**是：**始终在循环中检查等待条件**。

```
// 错误的方式：使用 if 检查条件
lock.lock();
try {
    if (!conditionMet) { // 如果发生虚假唤醒，线程醒来后不会再次检查条件！
        condition.await();
    }
    // 执行后续操作... (可能在条件实际不满足时执行了！)
} finally {
    lock.unlock();
}

// 正确的方式：使用 while 循环检查条件
lock.lock();
try {
    while (!conditionMet) { // 即使被虚假唤醒，也会重新检查条件
        condition.await();  // 如果条件仍不满足，则继续等待
    }
    // 条件确实满足，执行后续操作...
} finally {
    lock.unlock();
}


```

**为什么 `while` 循环有效？**

当线程从 `await()` 返回时（无论是正常唤醒、中断还是虚假唤醒），`while` 循环会**重新评估**等待条件 (`!conditionMet`)。

* 如果是正常唤醒，并且条件确实满足了，`!conditionMet` 为 `false`，循环结束，线程继续执行。
* 如果是虚假唤醒，或者被唤醒后条件又变回不满足状态（可能被其他线程修改了），`!conditionMet` 仍然为 `true`，线程会再次调用 `await()` 继续等待。

**永远不要假设线程从 `await()` 返回时，它等待的条件一定是满足的。必须重新检查！** 这是使用 `Condition`（以及 `Object.wait`）时一条非常重要的原则。

## 8. 高级 `await` 方法

除了基本的 `await()`，`Condition` 还提供了几个变体，以应对不同的等待需求。

### 8.1 `awaitUninterruptibly()`

此方法使线程进入等待状态，但**不响应中断**。如果在等待过程中，其他线程调用了该等待线程的 `interrupt()` 方法，`awaitUninterruptibly()` **不会**抛出 `InterruptedException`，线程会继续等待，直到被 `signal` 或 `signalAll`。

```
lock.lock();
try {
    while (!conditionMet) {
        condition.awaitUninterruptibly(); // 不响应中断的等待
    }
    // 执行后续操作...
} finally {
    lock.unlock();
}


```

**特点：**

* 忽略中断请求，不抛出 `InterruptedException`。
* 如果在等待时被中断，线程的中断状态**会被保留**。这意味着，当 `awaitUninterruptibly()` 返回后，可以通过 `Thread.currentThread().isInterrupted()` 检查到线程曾被中断过。

**使用场景：**

当线程的等待操作必须完成，不能因为外部的中断请求而提前终止时使用。例如，在一些关键的资源清理或状态同步逻辑中，如果中断可能导致系统状态不一致，可以考虑使用不可中断等待。但请谨慎使用，因为它可能导致线程长时间无法响应中断，影响系统的响应性。

### 8.2 `await(long time, TimeUnit unit)` 和 `awaitNanos(long nanosTimeout)`

这两个方法提供了**带超时的等待**。线程会等待条件满足，但最多只等待指定的时间。

```
// 使用 await(long time, TimeUnit unit)
long timeout = 5; // 等待 5 秒
TimeUnit unit = TimeUnit.SECONDS;
boolean conditionSatisfiedBeforeTimeout = false;

lock.lock();
try {
    long remainingNanos = unit.toNanos(timeout); // 转换为纳秒
    while (!conditionMet) {
        if (remainingNanos <= 0L) { // 超时检查
            break; // 时间到了，退出等待循环
        }
        // awaitNanos 返回剩余等待时间，用于下一次循环或判断
        remainingNanos = condition.awaitNanos(remainingNanos);
    }
    // 循环结束后，再次检查条件是否真的满足了
    if (conditionMet) {
        conditionSatisfiedBeforeTimeout = true;
        // 执行条件满足时的操作...
    } else {
        // 超时了，条件仍未满足
        // 执行超时处理逻辑...
    }
} finally {
    lock.unlock();
}

// await(time, unit) 内部通常也是调用 awaitNanos
// 它返回一个 boolean 值：
// - true: 如果在超时前被 signal 唤醒
// - false: 如果因为超时而返回
boolean ok = condition.await(timeout, unit);
// 注意：即使返回 true，仍需在 while 循环中检查条件，因为可能是虚假唤醒或 signal 后条件又变了


```

**特点：**

* `awaitNanos(nanos)`: 参数是纳秒，返回值是剩余的等待时间（纳秒）。如果返回值小于等于 0，表示超时。
* `await(time, unit)`: 更方便的接口，可以指定时间单位。返回 `true` 表示在超时前被唤醒，`false` 表示超时。
* 两者都**响应中断**，如果等待期间被中断，会抛出 `InterruptedException`。
* **返回值的重要性**：
  + 对于 `awaitNanos`，返回的剩余时间对于在循环中精确控制超时非常重要。
  + 对于 `await(time, unit)`，返回的 `boolean` 值可以用来区分是正常唤醒还是超时返回。**但是**，即使返回 `true`，也不能保证条件一定满足（可能被 `signal` 后，在你重新获取锁之前条件又变了，或者虚假唤醒），所以**仍然必须在 `while` 循环中重新检查条件**。

**使用场景：**

* 需要避免线程无限期等待的情况。
* 实现具有超时限制的操作，如尝试在一定时间内获取资源、等待任务完成等。
* 作为实现定时检查或轮询的一种方式（虽然可能有更优的定时任务方案）。

### 8.3 `awaitUntil(Date deadline)`

此方法允许线程等待直到一个**绝对的时间点 (deadline)**。

```
Date deadline = ...; // 设置一个未来的时间点
boolean conditionSatisfiedBeforeDeadline = false;

lock.lock();
try {
    while (!conditionMet) {
        // awaitUntil 返回 true 如果在截止时间前被唤醒, false 如果到达截止时间
        if (!condition.awaitUntil(deadline)) {
             // 到达截止时间，条件仍未满足
             break; // 退出等待
        }
        // 如果 awaitUntil 返回 true，表示被唤醒了，继续循环检查条件
    }
     if (conditionMet) {
        conditionSatisfiedBeforeDeadline = true;
        // 执行条件满足时的操作...
    } else {
        // 截止时间到了，条件仍未满足
        // 执行超时处理逻辑...
    }
} finally {
    lock.unlock();
}


```

**特点：**

* 参数是一个 `Date` 对象，代表绝对的截止时间。
* 如果当前时间已经超过 `deadline`，调用会立即返回 `false`。
* 返回值 `true` 表示在截止时间前被 `signal` 唤醒，`false` 表示到达截止时间。
* **响应中断**，会抛出 `InterruptedException`。
* 同样，即使返回 `true`，也**必须在 `while` 循环中重新检查条件**。

**使用场景：**

* 需要确保操作在某个特定的时间点之前完成等待。
* 协调多个需要在同一时间点触发或检查状态的线程。
* 在基于时间的调度系统中实现等待逻辑。

**总结：** 这些 `await` 的变体提供了对等待过程更精细的控制，开发者应根据具体的业务需求（是否需要响应中断、是相对超时还是绝对时间点）来选择合适的方法。但无论使用哪个方法，**在 `while` 循环中检查条件**都是必须遵守的规则。

## 9. 应用实例：生产者-消费者模式

生产者-消费者模式是并发编程中最经典的场景之一，也是 `Condition` 发挥优势的典型例子。我们来实现一个使用 `ReentrantLock` 和两个 `Condition` 的有界阻塞队列。

```
import java.util.LinkedList;
import java.util.Queue;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

public class BoundedBuffer<T> {

    private final Queue<T> buffer; // 缓冲区，使用 LinkedList 作为队列
    private final int capacity;    // 缓冲区容量
    private final Lock lock;       // 互斥锁，保护缓冲区的访问
    private final Condition notFull;  // 条件：缓冲区未满 (生产者等待)
    private final Condition notEmpty; // 条件：缓冲区非空 (消费者等待)

    public BoundedBuffer(int capacity) {
        if (capacity <= 0) throw new IllegalArgumentException();
        this.capacity = capacity;
        this.buffer = new LinkedList<>();
        this.lock = new ReentrantLock(); // 创建锁
        this.notFull = lock.newCondition(); // 创建 'notFull' 条件
        this.notEmpty = lock.newCondition(); // 创建 'notEmpty' 条件
    }

    /**
     * 生产者方法：向缓冲区放入数据
     * @param item 要放入的数据
     * @throws InterruptedException 如果线程在等待时被中断
     */
    public void put(T item) throws InterruptedException {
        lock.lock(); // 获取锁
        try {
            // 1. 使用 while 循环检查条件：缓冲区是否已满？
            while (buffer.size() == capacity) {
                System.out.println("生产者 " + Thread.currentThread().getName() + ": 缓冲区已满，等待...");
                notFull.await(); // 如果满了，生产者在 'notFull' 条件上等待
                                 // await() 会释放锁，允许消费者获取锁并取出数据
            }

            // 2. 条件满足（缓冲区未满），执行操作：放入数据
            buffer.offer(item);
            System.out.println("生产者 " + Thread.currentThread().getName() + ": 放入数据 " + item + "，当前大小: " + buffer.size());

            // 3. 通知可能在等待的消费者：缓冲区现在非空了
            notEmpty.signal(); // 唤醒一个在 'notEmpty' 上等待的消费者线程
                               // 注意：这里用 signal() 而不是 signalAll()，因为放入一个元素最多只需唤醒一个消费者

        } finally {
            lock.unlock(); // 释放锁
        }
    }

    /**
     * 消费者方法：从缓冲区取出数据
     * @return 取出的数据
     * @throws InterruptedException 如果线程在等待时被中断
     */
    public T take() throws InterruptedException {
        lock.lock(); // 获取锁
        try {
            // 1. 使用 while 循环检查条件：缓冲区是否为空？
            while (buffer.isEmpty()) {
                System.out.println("消费者 " + Thread.currentThread().getName() + ": 缓冲区为空，等待...");
                notEmpty.await(); // 如果空了，消费者在 'notEmpty' 条件上等待
                                  // await() 会释放锁，允许生产者获取锁并放入数据
            }

            // 2. 条件满足（缓冲区非空），执行操作：取出数据
            T item = buffer.poll();
            System.out.println("消费者 " + Thread.currentThread().getName() + ": 取出数据 " + item + "，当前大小: " + buffer.size());

            // 3. 通知可能在等待的生产者：缓冲区现在有空位了
            notFull.signal(); // 唤醒一个在 'notFull' 上等待的生产者线程
                              // 同样，取出元素最多只需唤醒一个生产者

            return item;

        } finally {
            lock.unlock(); // 释放锁
        }
    }

    // 简单测试
    public static void main(String[] args) {
        BoundedBuffer<Integer> buffer = new BoundedBuffer<>(5); // 容量为 5

        // 创建生产者线程
        Thread producer1 = new Thread(() -> {
            try {
                for (int i = 0; i < 10; i++) {
                    buffer.put(i);
                    Thread.sleep((long) (Math.random() * 100)); // 模拟生产耗时
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }, "Producer-1");

        Thread producer2 = new Thread(() -> {
            try {
                for (int i = 10; i < 20; i++) {
                    buffer.put(i);
                    Thread.sleep((long) (Math.random() * 150));
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }, "Producer-2");

        // 创建消费者线程
        Thread consumer1 = new Thread(() -> {
            try {
                for (int i = 0; i < 8; i++) {
                    buffer.take();
                    Thread.sleep((long) (Math.random() * 200)); // 模拟消费耗时
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }, "Consumer-1");

         Thread consumer2 = new Thread(() -> {
            try {
                for (int i = 0; i < 12; i++) {
                    buffer.take();
                    Thread.sleep((long) (Math.random() * 250));
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }, "Consumer-2");

        producer1.start();
        producer2.start();
        consumer1.start();
        consumer2.start();
    }
}


```

**代码分析：**

1. **共享资源**：`buffer` (队列) 和 `capacity`。
2. **互斥锁**：`lock` (`ReentrantLock`) 确保同一时间只有一个线程能访问 `buffer`。
3. **两个条件变量**：
   * `notFull`：生产者关心这个条件。当 `buffer.size() == capacity` 时，生产者在此条件上 `await()`。
   * `notEmpty`：消费者关心这个条件。当 `buffer.isEmpty()` 时，消费者在此条件上 `await()`。
4. **`put` 方法**：
   * 获取锁。
   * **`while (buffer.size() == capacity)`**：循环检查缓冲区是否已满。这是处理虚假唤醒和确保条件确实满足的关键。
   * `notFull.await()`：如果满了，调用 `await` 等待，并释放锁。
   * 缓冲区未满时，`buffer.offer(item)` 放入数据。
   * **`notEmpty.signal()`**：放入数据后，缓冲区肯定不为空了，因此**精确地**唤醒一个可能在 `notEmpty` 上等待的消费者。
   * 释放锁。
5. **`take` 方法**：
   * 获取锁。
   * **`while (buffer.isEmpty())`**：循环检查缓冲区是否为空。
   * `notEmpty.await()`：如果空了，调用 `await` 等待，并释放锁。
   * 缓冲区非空时，`buffer.poll()` 取出数据。
   * **`notFull.signal()`**：取出数据后，缓冲区肯定有空位了，因此**精确地**唤醒一个可能在 `notFull` 上等待的生产者。
   * 释放锁。

**优势体现：**

* **精确唤醒**：生产者只唤醒消费者，消费者只唤醒生产者。如果使用 `synchronized` 和单一 `wait/notifyAll`，当生产者唤醒时，可能会唤醒另一个也在等待的生产者（如果缓冲区仍然是满的），反之亦然，造成不必要的上下文切换和条件检查。
* **清晰的逻辑**：将不同的等待条件分离到不同的 `Condition` 对象，使得代码意图更清晰。

这个例子完美展示了 `Condition` 如何通过与 `Lock` 结合并提供多个条件队列，来实现比传统 `wait/notify` 更高效、更精确的线程间协作。

## 10. 总结与最佳实践

`Condition` 接口是 Java 并发包提供的一个强大工具，用于实现复杂的线程间同步和协作。  
 它通过将条件等待队列与 `Lock` 分离，克服了传统 `Object.wait/notify` 机制的局限性，提供了更精细的控制能力。

**核心要点回顾：**

* `Condition` 必须与 `Lock` 配合使用，通过 `lock.newCondition()` 创建。
* `await()`, `signal()`, `signalAll()` 等方法必须在持有相应 `Lock` 的情况下调用。
* `await()` 会释放当前线程持有的 `Lock`，并在被唤醒后重新获取该 `Lock` 才能继续执行。
* `signal()` 唤醒一个等待线程，`signalAll()` 唤醒所有等待线程，被唤醒的线程需要重新竞争锁。
* AQS 是 `Condition` 实现的基础，提供了同步队列、条件队列管理、节点状态、线程阻塞/唤醒机制。
* **永远在 `while` 循环中调用 `await()` 并检查条件**，以正确处理虚假唤醒。
* `Condition` 提供了多种 `await` 变体（不可中断、超时、绝对时间点）以满足不同需求。
* 主要优势在于**精确唤醒**，通过多个 `Condition` 对象管理不同的等待条件，提高效率。

**使用 `Condition` 的最佳实践：**

1. **始终在 `try...finally` 块中释放 `Lock`**：

   ```
   lock.lock();
   try {
       // ... 临界区代码 ...
       while (!conditionMet) {
           condition.await();
       }
       // ...
   } finally {
       lock.unlock(); // 确保锁总是被释放
   }


   ```
2. **总是在 `while` 循环中检查条件并调用 `await`**：防止虚假唤醒和条件变化。
3. **优先使用 `signal()` 而不是 `signalAll()`**：如果唤醒一个线程就足够，`signal()` 更高效。只有在需要唤醒所有等待者时才使用 `signalAll()`。仔细分析你的场景，确定哪个更合适。
4. **明确条件谓词 (Condition Predicate)**：等待的条件 (`conditionMet` 在例子中) 应该是清晰定义的、受 `Lock` 保护的共享状态。确保条件的检查和修改都在锁的保护下进行。
5. **考虑公平性**：如果需要保证等待线程大致按照 FIFO 的顺序被唤醒，可以使用 `ReentrantLock(true)` 创建公平锁，与之关联的 `Condition` 也会体现一定的公平性（但不是绝对保证）。非公平锁性能通常更好。
6. **注意中断处理**：选择合适的 `await` 方法（响应中断的 `await`, `awaitNanos`, `awaitUntil` 或不响应中断的 `awaitUninterruptibly`），并在必要时处理 `InterruptedException` 或检查中断状态。
7. **替代方案**：对于标准的并发模式（如生产者-消费者），优先考虑使用 JUC 提供的更高级别的同步工具，如 `BlockingQueue`（`ArrayBlockingQueue`, `LinkedBlockingQueue` 等），它们内部已经封装好了 `Lock` 和 `Condition` 的复杂逻辑，使用更简单、更安全。只有在需要自定义、更复杂的协调逻辑时，才直接使用 `Lock` 和 `Condition`。
