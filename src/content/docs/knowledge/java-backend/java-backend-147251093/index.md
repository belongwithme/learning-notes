---
title: "Java Lock 深度解析"
description: "在 Java 并发编程里，synchronized 关键字是我们最早接触也最常用的同步机制。它简单易用，能解决大部分场景下的线程安全问题。然而，随着业务场景的复杂化和对性能、灵活性的更高要求，synchronized 的局限性也逐渐显现。此时，java.util.concurrent.lock..."
sourceId: "147251093"
source: "https://blog.csdn.net/qq_45852626/article/details/147251093"
sourceSeries:
  - "JUC"
category: java-backend
tags:
  - "JUC"
  - "Java"
status: draft
difficulty: advanced
contentType: knowledge
sidebar:
  order: 147251093
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/147251093)（历史文章导入，当前状态为草稿）

### 前言

在 Java 并发编程里，`synchronized` 关键字是我们最早接触也最常用的同步机制。它简单易用，能解决大部分场景下的线程安全问题。然而，随着业务场景的复杂化和对性能、灵活性的更高要求，`synchronized` 的局限性也逐渐显现。此时，`java.util.concurrent.locks` 包下的 `Lock` 接口及其实现类应运而生，提供了更强大、更灵活的锁机制。

**前置知识：**

* 了解 Java 线程基本概念（创建、状态、生命周期）。
* 了解 `synchronized` 关键字的基本用法和原理。
* 了解 `volatile` 关键字和 Java 内存模型（JMM）的基本概念。
* 了解 `CAS (Compare-and-Swap)` 原子操作的基本概念。

### 第一章：初识 Lock 接口

#### 1.1 什么是 Lock 接口？

想象一下，你家里有一个很重要的房间（共享资源），同一时间只允许一个人（线程）进入。为了管理进入权限，你设立了一个门卫。

* **`synchronized`**：就像一个“自动门卫”。有人想进去，门卫检查房间是否有人。没人，就放行并自动锁门；有人，就在门口等着。出来时，门自动打开。一切都是自动的，你无法干预太多。
* **`Lock` 接口**：则提供了一个更“智能”、更“手动”的门卫。你可以明确地告诉门卫什么时候“锁门”（`lock()`），什么时候“开门”（`unlock()`）。这位门卫还掌握了更多高级技能，比如：
  + **尝试获取**：尝试去锁门，如果门已经被别人锁了，可以选择不等，立刻返回（`tryLock()`）。
  + **限时等待**：尝试去锁门，可以设定一个等待时间，超时还没拿到锁就放弃（`tryLock(long time, TimeUnit unit)`）。
  + **可中断等待**：在等待锁的过程中，如果别的线程“打断”（`interrupt()`）了你，你可以选择不继续等了，直接响应中断（`lockInterruptibly()`）。
  + **公平策略**：可以让等待的线程按先来后到的顺序排队获取锁（公平锁）。

简单来说，`Lock` 是 `java.util.concurrent.locks` 包下的一个接口，它定义了一套比 `synchronized` 更灵活、功能更丰富的锁操作规范。它允许开发者更精细地控制锁的获取和释放，并提供了许多 `synchronized` 不具备的高级特性。

**`Lock` 接口的核心方法：**

```
public interface Lock {
    // 获取锁。如果锁不可用，则当前线程将被禁用以进行线程调度，并处于休眠状态，
    // 直到获取锁。
    void lock();

    // 获取锁，除非当前线程被中断。
    // 如果锁可用，则获取锁并立即返回。
    // 如果锁不可用，则当前线程将被禁用以进行线程调度，并处于休眠状态，
    // 直到发生以下两种情况之一：
    // 1. 锁由当前线程获取；或者
    // 2. 其他某个线程中断当前线程。
    // 如果当前线程在进入此方法时设置了其中断状态；或者在等待锁定时被中断，
    // 则会抛出 InterruptedException，并清除当前线程的中断状态。
    void lockInterruptibly() throws InterruptedException;

    // 仅在调用时锁为空闲状态才获取该锁。
    // 如果锁可用，则获取锁并立即返回值 true。
    // 如果锁不可用，则此方法将立即返回值 false。
    // 通常用于尝试获取但非必须获取锁的场景。
    boolean tryLock();

    // 如果在给定的等待时间内锁是空闲的，并且当前线程未被中断，则获取锁。
    // 如果锁可用，则此方法立即返回值 true。
    // 如果锁不可用，则出于线程调度目的，禁用当前线程，并使其处于休眠状态，
    // 直到发生以下三种情况之一：
    // 1. 锁由当前线程获取；或者
    // 2. 其他某个线程中断当前线程；或者
    // 3. 指定的等待时间已过。
    // 如果获取了锁，则返回值 true。
    // 如果当前线程：
    //  - 在进入此方法时已经设置了其中断状态；或者
    //  - 在获取锁时被中断，
    // 则抛出 InterruptedException，并且清除当前线程的已中断状态。
    // 如果超出了指定的等待时间，则返回值 false。
    // 如果时间小于等于 0，则此方法将完全不等待。
    boolean tryLock(long time, TimeUnit unit) throws InterruptedException;

    // 释放锁。
    // 通常需要在 finally 块中调用，以确保即使发生异常也能释放锁。
    void unlock();

    // 返回绑定到此 Lock 实例的新 Condition 实例。
    // 在获取锁之前，在此条件上调用 await() 或 signal() 等方法将导致 IllegalMonitorStateException。
    Condition newCondition();
}


```

**重点理解：** `Lock` 是一个接口，它只定义规范，具体的实现由其子类完成（如 `ReentrantLock`）。使用 `Lock` 时，**必须手动释放锁**，这通常在 `finally` 块中完成，否则可能导致死锁。

```
Lock lock = new ReentrantLock();
lock.lock(); // 获取锁
try {
    // 访问受保护的资源
    // ... 业务逻辑 ...
} finally {
    lock.unlock(); // 必须在 finally 块中释放锁
}


```

#### 1.2 Lock 的核心原理：AQS (AbstractQueuedSynchronizer)

`Lock` 接口之所以能提供如此丰富的功能，其背后离不开一个强大的基础框架——`AbstractQueuedSynchronizer`（简称 AQS）。你可以将 AQS 理解为一个**同步状态管理器**和**线程排队控制器**。几乎所有 `java.util.concurrent` 包下的同步组件（`Lock`, `Semaphore`, `CountDownLatch`, `ReentrantReadWriteLock` 等）都是基于 AQS 构建的。

**AQS 的核心思想：**

1. **状态（State）管理**：AQS 内部维护一个核心的 `int` 类型的变量 `state`。这个变量用来表示同步状态。

   * 对于独占锁（如 `ReentrantLock`），`state` 通常表示锁是否被持有。`0` 表示未被持有，`1` 表示被某个线程持有。如果是可重入锁，`state` 还可以大于 `1`，表示同一个线程多次获取锁的次数。
   * 对于共享锁（如 `Semaphore`, `CountDownLatch`），`state` 则表示可用的许可证数量或需要等待的计数。
   * AQS 使用 `volatile` 修饰 `state` 保证其在多线程间的可见性，并提供基于 CAS (Compare-and-Swap) 的原子方法来修改 `state`（`getState()`, `setState()`, `compareAndSetState()`）。
2. **线程排队（Queue）**：当一个线程尝试获取同步状态（例如，获取锁）失败时，AQS 会将该线程以及其等待状态等信息封装成一个节点（`Node`），并将其加入到一个**虚拟的 CLH (Craig, Landin, and Hagersten) 双向队列**中。这个队列是先进先出（FIFO）的。

   * 当持有锁的线程释放同步状态时，AQS 会唤醒队列中的下一个等待节点对应的线程，使其有机会再次尝试获取同步状态。
3. **独占（Exclusive）与共享（Shared）模式**：AQS 支持两种同步模式：

   * **独占模式**：同一时刻只允许一个线程获取同步状态（如 `ReentrantLock`）。
   * **共享模式**：同一时刻允许多个线程获取同步状态（如 `Semaphore`, `CountDownLatch`, `ReentrantReadWriteLock` 的读锁）。
4. **模板方法设计模式**：AQS 本身是一个抽象类。它定义了获取和释放同步状态的顶层逻辑（如排队、阻塞、唤醒），但**具体的同步状态获取和释放的判断逻辑**则交给子类去实现。子类需要重写 AQS 提供的一些 `protected` 方法，如：

   * `tryAcquire(int arg)`：独占模式下，尝试获取资源。成功返回 `true`，失败返回 `false`。
   * `tryRelease(int arg)`：独占模式下，尝试释放资源。成功返回 `true`，失败返回 `false`。
   * `tryAcquireShared(int arg)`：共享模式下，尝试获取资源。返回负数表示失败；`0` 表示成功，但没有剩余可用资源；正数表示成功，且有剩余资源。
   * `tryReleaseShared(int arg)`：共享模式下，尝试释放资源。成功返回 `true`，失败返回 `false`。
   * `isHeldExclusively()`：判断当前线程是否持有独占资源。

**AQS 如何支撑 Lock？**

以 `ReentrantLock` 为例：

* `ReentrantLock` 内部包含一个继承自 AQS 的同步器（`Sync` 类，它又有 `FairSync` 和 `NonfairSync` 两个子类）。
* `lock()` 方法内部会调用同步器的 `acquire()` 方法。
* `acquire()` 是 AQS 提供的模板方法，它会调用子类（`FairSync` 或 `NonfairSync`）实现的 `tryAcquire()` 方法来尝试获取锁（修改 `state`）。
* 如果 `tryAcquire()` 成功，`lock()` 方法返回。
* 如果 `tryAcquire()` 失败，`acquire()` 方法会将当前线程加入到 AQS 的等待队列中，并挂起线程（通常通过 `LockSupport.park()`）。
* `unlock()` 方法内部会调用同步器的 `release()` 方法。
* `release()` 也是 AQS 的模板方法，它会调用子类实现的 `tryRelease()` 方法来尝试释放锁（修改 `state`）。
* 如果 `tryRelease()` 成功，并且队列中有等待的线程，`release()` 方法会唤醒队列头部的线程（通过 `LockSupport.unpark()`），让它再次尝试获取锁。

**简单理解 AQS：**

把它想象成一个高级的“排队叫号系统”：

* **`state`**：柜台服务窗口的状态（0=空闲，1=服务中）。
* **`tryAcquire` / `tryRelease`**：客户（线程）尝试去窗口办理业务 / 办理完离开窗口。
* **CLH 队列**：等待区的椅子，客户按顺序坐下等待。
* **`park` / `unpark`**：客户在椅子上睡觉 / 被叫号叫醒去办理业务。

AQS 提供了一套标准的流程框架，而具体的锁（如 `ReentrantLock`）只需要根据自己的特性（是否可重入、是否公平）来实现 `tryAcquire` 和 `tryRelease` 的逻辑即可。这极大地简化了同步组件的开发。我们将在后续章节深入探讨 AQS 的细节。

---

### 第二章：Lock 与 synchronized 的深度对比

`Lock` 接口和 `synchronized` 关键字是 Java 中实现线程同步的两种主要方式。虽然它们的目标相同——保证共享资源在并发访问时的线程安全，但在使用方式、功能特性和底层实现上存在显著差异。

| 特性 | `synchronized` 关键字 | `Lock` 接口 (以 `ReentrantLock` 为例) |
| --- | --- | --- |
| **本质** | Java 关键字，JVM 层面实现 | Java 接口，JDK 层面基于 AQS 实现 |
| **使用方式** | 隐式获取和释放锁（代码块结束或异常时自动释放） | 显式调用 `lock()` 和 `unlock()` 方法，**必须手动释放** |
| **锁获取** | 阻塞式，无法中断，无法设置超时 | 多种方式：阻塞 (`lock()`)、可中断 (`lockInterruptibly()`)、尝试非阻塞 (`tryLock()`)、超时 (`tryLock(time, unit)`) |
| **公平性** | 仅支持非公平锁 | 可选公平锁 (`new ReentrantLock(true)`) 或非公平锁 (默认) |
| **性能** | JDK 1.6 后优化显著，性能接近 `Lock` | 理论上在高竞争下更灵活，可结合具体场景优化性能 |
| **条件变量** | 只能与一个隐式条件关联 (`wait()`, `notify()`, `notifyAll()`) | 可绑定多个 `Condition` 对象，实现更精细的等待/通知 |
| **锁状态** | 无法判断锁的状态 | 可以通过 `isLocked()`, `isHeldByCurrentThread()` 等方法判断 |
| **灵活性** | 功能相对固定 | 功能丰富，更灵活，适用于复杂同步场景 |
| **死锁** | 编译器或 JVM 层面较难检查 | 忘记 `unlock()` 极易导致死锁，需要开发者保证 |

下面我们详细展开对比：

#### 2.1 使用方式与锁的释放

* **`synchronized`**：使用非常简单，只需在方法或代码块前加上 `synchronized` 关键字。JVM 会自动在进入同步代码块时获取锁，在退出同步代码块（正常结束或抛出异常）时自动释放锁。开发者无需关心锁的释放问题。

  ```
  public synchronized void synchronizedMethod() {
      // 业务逻辑
  }

  public void someMethod() {
      Object lockObject = new Object();
      synchronized (lockObject) {
          // 业务逻辑
      } // 锁在此处自动释放
  }


  + 1
  + 2
  + 3
  + 4
  + 5
  + 6
  + 7
  + 8
  + 9
  + 10
  ```
* **`Lock`**：需要手动实例化 `Lock` 对象（通常是 `ReentrantLock`），并在需要同步的代码块前后显式调用 `lock()` 和 `unlock()` 方法。**关键在于 `unlock()` 必须被调用**，否则其他线程将永远无法获取该锁。因此，`unlock()` 通常放在 `finally` 块中，确保即使 `try` 块中发生异常，锁也能被释放。

  ```
  Lock lock = new ReentrantLock();
  // ...
  public void lockMethod() {
      lock.lock(); // 显式获取锁
      try {
          // 业务逻辑
      } finally {
          lock.unlock(); // 必须在 finally 中显式释放锁
      }
  }


  + 1
  + 2
  + 3
  + 4
  + 5
  + 6
  + 7
  + 8
  + 9
  + 10
  ```

  **易错点：** 新手使用 `Lock` 时最容易犯的错误就是忘记在 `finally` 中调用 `unlock()`，这会导致严重的后果。

#### 2.2 锁获取的灵活性

* **`synchronized`**：当一个线程尝试获取 `synchronized` 锁而被阻塞时，它只能一直等待，直到持有锁的线程释放锁。这个等待过程是**不可中断**的，也**不能设置超时**。如果持有锁的线程因为某种原因一直不释放锁（例如死锁），等待的线程会无限期地阻塞下去。
* **`Lock`**：提供了更灵活的锁获取方式：

  + **`tryLock()`**：尝试获取锁，如果锁当前可用，则获取成功并返回 `true`；如果锁已被其他线程持有，则立即返回 `false`，不会阻塞。这使得线程可以根据是否能立即获取锁来决定下一步的操作，避免无谓的等待。

    ```
    if (lock.tryLock()) { // 尝试非阻塞获取锁
        try {
            // 获取锁成功，执行业务逻辑
        } finally {
            lock.unlock();
        }
    } else {
        // 未能获取锁，可以执行其他逻辑或稍后重试
        System.out.println("未能获取锁，稍后重试...");
    }


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
    ```
  + **`tryLock(long time, TimeUnit unit)`**：带超时的尝试获取锁。线程会尝试在指定的时间内获取锁。如果在超时时间内获取成功，返回 `true`；如果在超时时间到达时仍未获取成功，返回 `false`。等待过程中如果线程被中断，会抛出 `InterruptedException`。这对于需要避免无限等待的场景非常有用。

    ```
    try {
        if (lock.tryLock(1, TimeUnit.SECONDS)) { // 尝试在1秒内获取锁
            try {
                // 获取锁成功
            } finally {
                lock.unlock();
            }
        } else {
            // 超时未能获取锁
            System.out.println("等待超时，未能获取锁。");
        }
    } catch (InterruptedException e) {
        // 等待过程中被中断
        Thread.currentThread().interrupt(); // 重新设置中断状态
        System.out.println("等待锁时被中断。");
    }


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
    - 15
    - 16
    ```
  + **`lockInterruptibly()`**：可中断地获取锁。与 `lock()` 类似，如果锁不可用，线程会阻塞等待。但与 `lock()` 不同的是，如果在等待过程中，该线程被其他线程调用了 `interrupt()` 方法，那么该线程会**响应中断**，抛出 `InterruptedException` 并停止等待锁。这使得我们可以设计能够响应取消操作的同步逻辑。

    ```
    try {
        lock.lockInterruptibly(); // 可中断地获取锁
        try {
            // 获取锁成功
        } finally {
            lock.unlock();
        }
    } catch (InterruptedException e) {
        // 在等待锁时被中断
        Thread.currentThread().interrupt();
        System.out.println("获取锁的操作被中断。");
        // 可以进行中断处理，比如取消任务
    }


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
    ```

#### 2.3 公平性

* **`synchronized`**：是非公平锁。当锁被释放时，JVM 会从等待队列中（大致可以理解为）随机选择一个线程来获取锁，而不是严格按照线程请求锁的顺序。这种方式可能会导致某些线程长时间得不到执行机会（线程饥饿）。
* **`Lock`**（以 `ReentrantLock` 为例）：可以选择是公平锁还是非公平锁。

  + **非公平锁（默认）**：`new ReentrantLock()` 或 `new ReentrantLock(false)`。当锁被释放时，如果恰好有一个新的线程尝试获取锁，它**有可能**在等待队列中的线程被唤醒之前就“插队”获取到锁。这种方式吞吐量通常较高，因为减少了线程挂起和唤醒的开销。
  + **公平锁**：`new ReentrantLock(true)`。严格按照线程请求锁的 FIFO 顺序来分配锁。当锁被释放时，只有等待队列头部的线程才能获取锁。新来的线程如果发现锁已被占用或者队列不为空，会自觉排到队尾。公平锁能防止线程饥饿，但通常会带来额外的性能开销（上下文切换更频繁）。

  ```
  // 创建一个公平锁
  Lock fairLock = new ReentrantLock(true);
  // 创建一个非公平锁 (默认)
  Lock nonFairLock = new ReentrantLock();


  + 1
  + 2
  + 3
  + 4
  ```

  **选择建议：** 大部分情况下，非公平锁的性能优于公平锁。只有在确实需要保证线程获取锁的顺序性，或者担心发生线程饥饿的场景下，才考虑使用公平锁。

#### 2.4 性能

在早期的 JDK 版本中（如 JDK 1.5），`ReentrantLock` 的性能通常优于 `synchronized`。但从 JDK 1.6 开始，JVM 对 `synchronized` 进行了大量的优化，引入了偏向锁、轻量级锁、自旋锁等机制，使得 `synchronized` 在低竞争或无竞争情况下的性能甚至可能超过 `ReentrantLock`。

在高竞争、高并发的场景下：

* `ReentrantLock` 配合 `tryLock` 等特性可以提供更灵活的控制，可能通过避免不必要的阻塞来优化性能。
* `ReentrantLock` 的公平锁实现虽然保证了公平性，但其性能通常低于非公平锁和 `synchronized`。
* `synchronized` 的优化是 JVM 自动完成的，开发者无法干预。`Lock` 的性能则更依赖于开发者的正确使用。

**结论：** 在现代 JDK 版本中，两者性能差距不大。选择 `Lock` 还是 `synchronized` 更多地应基于功能需求而非性能考量。优先考虑使用 `synchronized`，因为它更简单、不易出错。只有当需要 `synchronized` 不具备的高级功能（如可中断、超时、公平性、条件变量）时，才选用 `Lock`。

#### 2.5 条件变量 (Condition)

* **`synchronized`**：与 `Object` 类内置的 `wait()`, `notify()`, `notifyAll()` 方法配合使用，实现线程间的等待/通知机制。一个锁对象（`synchronized` 锁定的对象监视器 Monitor）只能关联一个隐式的条件队列。
* **`Lock`**：通过 `Condition` 接口提供更强大的等待/通知机制。一个 `Lock` 对象可以通过 `newCondition()` 方法创建**多个** `Condition` 对象。每个 `Condition` 对象都维护着一个独立的等待队列。

  + `Condition` 提供了 `await()`（对应 `wait()`）、`signal()`（对应 `notify()`）、`signalAll()`（对应 `notifyAll()`）方法。
  + 此外，`Condition` 还提供了可中断的等待 (`awaitInterruptibly()`)、带超时的等待 (`awaitNanos()`, `awaitUntil()`) 等更丰富的功能。

  **优势：** 使用多个 `Condition` 可以将不同条件的等待线程分组管理，实现更精确的唤醒。例如，在经典的“生产者-消费者”模型中，可以使用一个 `Condition` 管理“缓冲区满”时等待的生产者线程，另一个 `Condition` 管理“缓冲区空”时等待的消费者线程。当消费者消费后，只需唤醒等待“缓冲区满”的生产者 (`producerCondition.signal()`)，而不需要唤醒其他可能在等待的消费者。而 `synchronized` 的 `notify()` 只能随机唤醒一个等待线程（可能是生产者也可能是消费者），`notifyAll()` 则会唤醒所有等待线程，造成不必要的竞争和上下文切换（惊群效应）。

  ```
  Lock lock = new ReentrantLock();
  Condition producerCondition = lock.newCondition(); // 生产者等待条件
  Condition consumerCondition = lock.newCondition(); // 消费者等待条件

  // 生产者
  lock.lock();
  try {
      while (isFull()) { // 缓冲区满
          producerCondition.await(); // 生产者等待
      }
      // 生产...
      consumerCondition.signal(); // 唤醒一个消费者
  } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
  } finally {
      lock.unlock();
  }

  // 消费者
  lock.lock();
  try {
      while (isEmpty()) { // 缓冲区空
          consumerCondition.await(); // 消费者等待
      }
      // 消费...
      producerCondition.signal(); // 唤醒一个生产者
  } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
  } finally {
      lock.unlock();
  }


  + 1
  + 2
  + 3
  + 4
  + 5
  + 6
  + 7
  + 8
  + 9
  + 10
  + 11
  + 12
  + 13
  + 14
  + 15
  + 16
  + 17
  + 18
  + 19
  + 20
  + 21
  + 22
  + 23
  + 24
  + 25
  + 26
  + 27
  + 28
  + 29
  + 30
  + 31
  ```

我们将在后续章节详细介绍 `Condition` 的使用和原理。

#### 2.6 小结

`Lock` 接口提供了比 `synchronized` 更强大、更灵活的锁机制，但使用也更复杂，需要开发者手动管理锁的释放。选择哪种同步方式取决于具体的应用场景和需求：

* **优先选择 `synchronized`**：代码简单，不易出错，JVM 自动优化。适用于大多数常见的同步场景。
* **在需要以下特性时选择 `Lock`**：
  + 尝试非阻塞地获取锁 (`tryLock`)。
  + 能被中断地获取锁 (`lockInterruptibly`)。
  + 在指定时间内超时获取锁 (`tryLock(time, unit)`)。
  + 需要公平锁机制。
  + 需要使用多个条件变量 (`Condition`) 实现精确等待/通知。

---

### 第三章：深入 ReentrantLock

`ReentrantLock`（可重入锁）是 `Lock` 接口最常用、最经典的实现类。它提供了与 `synchronized` 类似的互斥和内存可见性保证，但功能更强大、更灵活。

#### 3.1 什么是“可重入”？

“可重入”指的是：**同一个线程**可以**多次**获取**同一个锁**而不会被自己阻塞。

想象一下 `synchronized`：

```
public class Widget {
    public synchronized void doSomething() {
        System.out.println("Widget.doSomething() called");
        // 在同步方法内部调用另一个同步方法
        doAnotherThing();
    }

    public synchronized void doAnotherThing() {
        System.out.println("Widget.doAnotherThing() called");
    }
}


```

当一个线程调用 `widget.doSomething()` 时，它首先获取了 `widget` 对象的锁。然后，在 `doSomething()` 内部，它又调用了 `widget.doAnotherThing()`。由于 `doAnotherThing()` 也是 `synchronized` 方法，它也需要获取 `widget` 对象的锁。如果锁不是可重入的，那么线程在尝试获取第二个锁时就会被自己阻塞，导致死锁。

幸运的是，`synchronized` 和 `ReentrantLock` 都是**可重入**的。它们内部会维护一个**持有锁的线程标识**和一个**计数器**。

* 当一个线程第一次获取锁时，计数器变为 1，并记录下持有锁的线程。
* 当同一个线程再次尝试获取这个锁时（重入），发现持有锁的线程就是自己，于是直接将计数器加 1，而不需要等待。
* 每次调用 `unlock()` 时，计数器减 1。
* 只有当计数器减到 0 时，锁才真正被释放，其他等待的线程才有机会获取锁。

`ReentrantLock` 的可重入性是由 AQS 的 `state` 字段和 `exclusiveOwnerThread` 字段（记录当前持有锁的线程）共同实现的。

#### 3.2 `ReentrantLock` 的使用

基本用法与 `Lock` 接口定义一致：

```
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

public class ReentrantLockExample {
    private final Lock lock = new ReentrantLock(); // 默认创建非公平锁
    private int count = 0;

    public void increment() {
        lock.lock(); // 获取锁
        try {
            count++;
            System.out.println(Thread.currentThread().getName() + " incremented count to: " + count);
            // 模拟一些耗时操作
            Thread.sleep(10);
            // 演示可重入性
            anotherIncrement();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            lock.unlock(); // 释放锁
            System.out.println(Thread.currentThread().getName() + " released lock (outer). Count: " + count + ", HoldCount: " + ((ReentrantLock)lock).getHoldCount());
        }
    }

     public void anotherIncrement() {
         lock.lock(); // 再次获取锁（重入）
         try {
             count++;
             System.out.println(Thread.currentThread().getName() + " incremented count again to: " + count + " in anotherIncrement. HoldCount: " + ((ReentrantLock)lock).getHoldCount());
         } finally {
             lock.unlock(); // 释放锁（内层）
              System.out.println(Thread.currentThread().getName() + " released lock (inner). Count: " + count + ", HoldCount: " + ((ReentrantLock)lock).getHoldCount());
         }
     }


    public int getCount() {
        lock.lock();
        try {
            return count;
        } finally {
            lock.unlock();
        }
    }

    public static void main(String[] args) throws InterruptedException {
        ReentrantLockExample example = new ReentrantLockExample();
        Runnable task = () -> {
            for (int i = 0; i < 2; i++) {
                example.increment();
            }
        };

        Thread t1 = new Thread(task, "Thread-1");
        Thread t2 = new Thread(task, "Thread-2");

        t1.start();
        t2.start();

        t1.join();
        t2.join();

        System.out.println("Final count: " + example.getCount());
        // 可以看到 getHoldCount() 在锁完全释放后变为 0
         System.out.println("Final HoldCount for main thread: " + ((ReentrantLock)example.lock).getHoldCount());
    }
}


```

在上面的例子中，`increment()` 方法内部调用了 `anotherIncrement()`。当线程执行到 `anotherIncrement()` 内部的 `lock.lock()` 时，由于该线程已经持有了 `lock`，它可以成功再次获取锁（重入），`ReentrantLock` 内部的持有计数（可以通过 `getHoldCount()` 查看）会增加。每次调用 `unlock()` 都会使计数减一，只有当计数减到 0 时，锁才会被真正释放。

#### 3.3 公平锁 vs 非公平锁

`ReentrantLock` 提供了两种模式：公平锁和非公平锁，通过构造函数指定：

* `ReentrantLock()` 或 `ReentrantLock(false)`：创建**非公平锁**（默认）。
* `ReentrantLock(true)`：创建**公平锁**。

**它们的区别主要体现在线程获取锁的行为上：**

* **非公平锁 (NonfairSync)**：

  + 当一个线程调用 `lock()` 时，它会**首先尝试**通过 CAS 操作直接获取锁（修改 `state` 从 0 到 1）。
  + 如果尝试成功（锁正好空闲），它就直接获得了锁，**无需排队**。
  + 如果尝试失败（锁已被占用，或者 CAS 失败），它才会进入 AQS 的排队逻辑（把自己加入等待队列并挂起）。
  + 当锁被释放时，会唤醒队列头部的线程。但此时如果恰好有新的线程进来尝试获取锁，这个新线程**有可能**比刚被唤醒的队列头部线程更早地通过 CAS 获取到锁（插队成功）。
  + **优点**：吞吐量通常更高。因为减少了线程挂起和唤醒的次数。如果持有锁的线程执行时间很短，新来的线程可能不需要进入队列就能快速获取锁并执行。
  + **缺点**：可能导致线程饥饿。某些线程可能运气不好，一直抢不过插队的线程，导致长时间无法获取锁。
* **公平锁 (FairSync)**：

  + 当一个线程调用 `lock()` 时，它**首先检查** AQS 等待队列中是否有其他线程正在等待。
  + 如果队列为空，并且锁是空闲的，它才会尝试获取锁。
  + 如果队列不为空，或者锁已被占用，它**必须**进入 AQS 的排队逻辑，排在队尾。
  + 当锁被释放时，只有队列头部的线程会被唤醒并获取锁。
  + **优点**：保证了线程获取锁的公平性，严格按照 FIFO 顺序，避免了线程饥饿。
  + **缺点**：吞吐量通常低于非公平锁。因为即使锁是空闲的，只要队列里有等待者，新来的线程也必须排队，导致了更多的线程上下文切换。

**源码简单对比 (`lock()` 方法的入口)：**

```
// java.util.concurrent.locks.ReentrantLock.NonfairSync
final void lock() {
    // 非公平锁：第一步就尝试 CAS 获取锁
    if (compareAndSetState(0, 1)) // 尝试将 state 从 0 改为 1
        setExclusiveOwnerThread(Thread.currentThread()); // 成功则设置当前线程为独占所有者
    else
        acquire(1); // 如果 CAS 失败（锁已被占或竞争失败），则进入 AQS 的标准获取流程
}

// java.util.concurrent.locks.ReentrantLock.FairSync
final void lock() {
    acquire(1); // 公平锁：直接进入 AQS 的标准获取流程，acquire 内部会检查公平性策略
}


```

**`acquire(1)` 内部的 `tryAcquire()` 实现差异：**

```
// java.util.concurrent.locks.ReentrantLock.NonfairSync
protected final boolean tryAcquire(int acquires) {
    // 非公平锁的 tryAcquire，由 acquire(1) 调用
    // 这个方法体现了“非公平”和“可重入”
    return nonfairTryAcquire(acquires);
}

// java.util.concurrent.locks.ReentrantLock#nonfairTryAcquire
final boolean nonfairTryAcquire(int acquires) {
    final Thread current = Thread.currentThread();
    int c = getState(); // 获取当前 state 值
    if (c == 0) { // 如果 state 为 0 (锁空闲)
        // 再次尝试 CAS 获取锁，即使队列中有等待者，也可能插队成功
        if (compareAndSetState(0, acquires)) {
            setExclusiveOwnerThread(current); // 成功，设置所有者
            return true;
        }
    }
    // 如果 state 不为 0，检查是否是当前线程持有（可重入）
    else if (current == getExclusiveOwnerThread()) {
        int nextc = c + acquires; // 增加重入计数
        if (nextc < 0) // overflow
            throw new Error("Maximum lock count exceeded");
        setState(nextc); // 更新 state
        return true; // 重入成功
    }
    return false; // 获取失败 (锁被其他线程持有)
}

// java.util.concurrent.locks.ReentrantLock.FairSync
protected final boolean tryAcquire(int acquires) {
    final Thread current = Thread.currentThread();
    int c = getState();
    if (c == 0) { // 锁空闲
        // 公平锁的关键：!hasQueuedPredecessors()
        // 检查同步队列中是否有等待时间更长的线程
        if (!hasQueuedPredecessors() && // 如果没有前驱节点在等待
            compareAndSetState(0, acquires)) { // 尝试 CAS 获取
            setExclusiveOwnerThread(current); // 成功，设置所有者
            return true;
        }
    }
    // 可重入逻辑与非公平锁相同
    else if (current == getExclusiveOwnerThread()) {
        int nextc = c + acquires;
        if (nextc < 0)
            throw new Error("Maximum lock count exceeded");
        setState(nextc);
        return true;
    }
    return false; // 获取失败
}


```

**`hasQueuedPredecessors()`** 是公平锁实现的核心，它会检查当前线程节点之前是否还有其他等待节点。如果有，即使锁空闲，当前线程也不能获取，必须排队。

**选择建议：**

* 除非有明确的公平性需求（例如，防止饥饿是首要目标），否则**优先使用默认的非公平锁**，以获得更好的性能。
* 公平锁会显著降低吞吐量，仅在必要时使用。

#### 3.4 `ReentrantLock` 的核心源码解读（简化）

理解 `ReentrantLock` 的工作原理，离不开对其底层 AQS (`AbstractQueuedSynchronizer`) 使用的理解。我们来看一下最核心的 `lock()` 和 `unlock()` 流程（以非公平锁为例）。

**`lock()` 流程 (NonfairSync):**

1. **尝试 CAS 获取锁**: 调用 `compareAndSetState(0, 1)`。

   * **成功**: 表示锁原本是空闲的，当前线程成功获取锁。设置当前线程为独占所有者 (`setExclusiveOwnerThread`)，`lock()` 方法结束。
   * **失败**: 表示锁已被其他线程持有，或者在 CAS 瞬间被其他线程抢先了。进入步骤 2。
2. **调用 `acquire(1)` (AQS 模板方法)**: 这是 AQS 提供的标准获取独占资源的流程。

   * **调用 `tryAcquire(1)` (子类实现)**:
     + 再次检查 `state` 是否为 0。如果是，再次尝试 CAS 获取（非公平性体现）。成功则返回 `true`。
     + 如果 `state` 不为 0，检查当前持有锁的线程是否是自己。如果是，增加 `state` 计数（可重入性），返回 `true`。
     + 如果锁被其他线程持有，返回 `false`。
   * **如果 `tryAcquire(1)` 返回 `true`**: 表示获取锁成功（可能是首次获取，也可能是重入），`acquire(1)` 方法结束，`lock()` 方法结束。
   * **如果 `tryAcquire(1)` 返回 `false`**: 表示确实无法获取锁。进入步骤 3。
3. **调用 `addWaiter(Node.EXCLUSIVE)` (AQS 方法)**:

   * 创建一个代表当前线程的节点 (`Node`)，模式为独占模式 (`EXCLUSIVE`)。
   * 将这个新节点**加入到 AQS 等待队列的尾部**（通过 CAS 操作保证线程安全）。
4. **调用 `acquireQueued(Node node, int arg)` (AQS 方法)**: 这是 AQS 中**处理排队和阻塞**的核心逻辑。

   * 在一个**自旋循环**中执行以下操作：
     + **检查前驱节点**: 获取当前节点在队列中的前一个节点 (`p = node.predecessor()`)。
     + **如果前驱是头节点 (Head Node)**: 这意味着当前节点是队列中的第一个实际等待者（头节点是虚拟的）。此时，**再次尝试调用 `tryAcquire(1)`**。
       - **成功**: 表示轮到自己获取锁了。将当前节点设置为新的头节点 (`setHead(node)`)，并将旧头节点从队列中断开。`acquireQueued` 方法返回 `false`（表示非中断返回），循环结束，`acquire(1)` 结束，`lock()` 结束。
       - **失败**: （理论上，如果前驱是头且锁已释放，`tryAcquire` 应该成功，但可能有并发或其他情况）。继续下一步。
     + **检查是否需要挂起**: 调用 `shouldParkAfterFailedAcquire(Node pred, Node node)` 判断当前线程是否应该被挂起。
       - 这个方法会检查前驱节点的状态 (`waitStatus`)。如果前驱节点状态是 `SIGNAL`，表示前驱节点承诺在释放锁时会唤醒当前节点，那么当前线程可以安全地挂起。返回 `true`。
       - 如果前驱节点状态是 `CANCELLED`，表示前驱节点已经放弃等待，需要向前遍历跳过这些取消的节点。返回 `false`，继续循环。
       - 否则（通常是 0 或 `PROPAGATE`），尝试将前驱节点的状态设置为 `SIGNAL`（通过 CAS），表示“请在我释放锁时唤醒我后面的节点”。返回 `false`，继续循环。
     + **如果 `shouldParkAfterFailedAcquire` 返回 `true`**: 调用 `parkAndCheckInterrupt()`。
       - **挂起线程**: 使用 `LockSupport.park(this)` 将当前线程挂起，等待被唤醒。
       - **检查中断**: 线程被唤醒后（通常是被前驱节点的 `unlock` 操作唤醒，或者被中断唤醒），检查当前线程的中断状态。如果被中断，`acquireQueued` 方法返回 `true`。
   * 循环会一直持续，直到当前线程成功获取锁 (`tryAcquire` 成功) 并成为新的头节点。

**简化版 `acquireQueued` 伪代码:**

```
final boolean acquireQueued(final Node node, int arg) {
    boolean interrupted = false;
    try {
        for (;;) { // 无限循环，直到成功获取锁或被中断
            final Node p = node.predecessor(); // 获取前驱节点
            // 如果前驱是头节点，并且尝试获取锁成功
            if (p == head && tryAcquire(arg)) {
                setHead(node); // 将当前节点设为头节点
                p.next = null; // help GC 旧头节点
                // 不需要设置 interrupted 标志，因为已经成功获取锁
                return interrupted; // 返回获取过程中是否曾被中断
            }
            // 如果获取锁失败，判断是否应该挂起
            if (shouldParkAfterFailedAcquire(p, node) &&
                parkAndCheckInterrupt()) // 如果需要挂起，则挂起并检查中断状态
                interrupted = true; // 如果 park 返回 true，说明被中断唤醒
        }
    } catch (Throwable t) {
        cancelAcquire(node); // 出现异常，取消获取
        if (interrupted)
            Thread.currentThread().interrupt(); // 恢复中断状态
        throw t;
    }
}


```

**`unlock()` 流程:**

1. **调用 `release(1)` (AQS 模板方法)**: 这是 AQS 提供的标准释放独占资源的流程。

   * **调用 `tryRelease(1)` (子类实现)**:
     + 检查当前线程是否是持有锁的线程。如果不是，抛出 `IllegalMonitorStateException`。
     + 如果是，将 `state` 减 1（对应 `acquires` 参数，这里是 1）。
     + **判断锁是否完全释放**: 检查 `state` 是否变为 0。
       - **是 (`state == 0`)**: 表示锁已被完全释放（重入次数为 0）。将独占所有者线程设为 `null` (`setExclusiveOwnerThread(null)`)。`tryRelease` 返回 `true`。
       - **否 (`state > 0`)**: 表示锁仍被当前线程持有（只是重入次数减少），`tryRelease` 返回 `false`。
   * **如果 `tryRelease(1)` 返回 `true`**: 表示锁已被成功释放。进入步骤 2。
   * **如果 `tryRelease(1)` 返回 `false`**: 表示锁仍被当前线程持有（重入状态），`release(1)` 方法结束，`unlock()` 结束。
2. **唤醒后继节点**:

   * 获取 AQS 队列的头节点 (`h = head`)。
   * 如果头节点不为 `null` 且其等待状态 (`waitStatus`) **不是 0**（通常是 `SIGNAL`，表示后面有节点需要被唤醒，或者是 `PROPAGATE` 等），则调用 `unparkSuccessor(h)`。
3. **`unparkSuccessor(Node node)` (AQS 方法)**:

   * 获取头节点的下一个节点 (`s = node.next`)。
   * 如果下一个节点是 `null` 或者其状态是 `CANCELLED`，则从队列尾部向前查找第一个未被取消的节点作为需要唤醒的节点。
   * 如果找到了需要唤醒的节点 (`s`)，则调用 `LockSupport.unpark(s.thread)` **唤醒该节点对应的线程**。这个被唤醒的线程会在其 `parkAndCheckInterrupt()` 方法处返回，然后继续 `acquireQueued` 的循环，尝试获取锁。

**简化版 `release` 伪代码:**

```
public final boolean release(int arg) {
    // 尝试释放锁（调用子类的 tryRelease）
    if (tryRelease(arg)) { // 如果 tryRelease 返回 true，说明锁已完全释放
        Node h = head; // 获取头节点
        // 如果头节点存在，并且它的 waitStatus 不是 0 (说明需要唤醒后继)
        if (h != null && h.waitStatus != 0)
            unparkSuccessor(h); // 唤醒队列中的下一个等待线程
        return true;
    }
    return false; // tryRelease 返回 false，锁未完全释放（重入）
}

// java.util.concurrent.locks.ReentrantLock.Sync#tryRelease
protected final boolean tryRelease(int releases) {
    int c = getState() - releases; // 计算释放后的 state
    if (Thread.currentThread() != getExclusiveOwnerThread()) // 检查是否是持有者
        throw new IllegalMonitorStateException();
    boolean free = false;
    if (c == 0) { // 如果 state 变为 0
        free = true; // 标记为已释放
        setExclusiveOwnerThread(null); // 清除所有者
    }
    setState(c); // 更新 state
    return free; // 返回是否已完全释放
}


```

**核心理解：**

* `lock()` 的核心是 `acquire()`，它通过 `tryAcquire()` 尝试获取，失败则通过 `addWaiter()` 入队，再通过 `acquireQueued()` 进行排队、挂起 (`park`) 和被唤醒后的再次尝试。
* `unlock()` 的核心是 `release()`，它通过 `tryRelease()` 释放锁（减 `state`），如果锁完全释放 (`state` 变为 0)，则通过 `unparkSuccessor()` 唤醒队列中的下一个等待线程 (`unpark`)。
* 公平性主要体现在 `tryAcquire()` 的实现上，公平锁会检查 `hasQueuedPredecessors()`。
* 可重入性体现在 `tryAcquire()` 和 `tryRelease()` 中对 `state` 的计数以及对 `exclusiveOwnerThread` 的判断。

---

### 第四章：读写锁 ReadWriteLock 与 ReentrantReadWriteLock

在某些场景下，我们对共享资源的操作可以区分为“读操作”和“写操作”。这些场景通常具有以下特点：

* **读多写少**：读取操作的频率远高于写入操作。
* **读读不互斥**：多个线程同时读取共享资源是安全的，不会产生冲突。
* **读写互斥 / 写写互斥**：当一个线程在写入时，其他线程（无论是读还是写）都不能访问；当多个线程尝试写入时，也必须互斥。

如果这种场景下仍然使用普通的互斥锁（如 `ReentrantLock` 或 `synchronized`），即使是多个线程进行无冲突的读操作，也必须串行执行，这会大大降低并发性能。

为了解决这个问题，Java 提供了 `ReadWriteLock`（读写锁）接口。

#### 4.1 `ReadWriteLock` 接口

`ReadWriteLock` 接口定义了获取“读锁”和“写锁”的方法：

```
public interface ReadWriteLock {
    // 返回用于读取操作的锁。
    Lock readLock();

    // 返回用于写入操作的锁。
    Lock writeLock();
}


```

它本身并不实现具体的锁逻辑，而是提供了一对关联的锁：一个读锁 (`readLock()`) 和一个写锁 (`writeLock()`)。这两个锁协同工作，实现以下规则：

* **读锁（共享锁）**：多个线程可以同时持有读锁。只要没有线程持有写锁，任何线程都可以成功获取读锁。
* **写锁（独占锁）**：同一时刻只允许一个线程持有写锁。当一个线程持有写锁时，其他任何线程（无论是想获取读锁还是写锁）都必须等待。

**核心思想：** 允许多个读线程并发访问，提高读操作的吞吐量，同时保证写操作的独占性以及读写操作之间的数据一致性。

#### 4.2 `ReentrantReadWriteLock` 实现

`ReentrantReadWriteLock` 是 `ReadWriteLock` 接口最常用的实现类。它具有以下特性：

* **实现了 `ReadWriteLock`**：提供了 `readLock()` 和 `writeLock()` 方法返回内部的读锁和写锁实例。
* **可重入性**：读锁和写锁都是可重入的。

  + 持有读锁的线程可以再次获取读锁。
  + 持有写锁的线程可以再次获取写锁。
  + 持有写锁的线程**可以**获取读锁（锁降级）。
* **锁降级**：持有写锁的线程可以**在不释放写锁的情况下**，继续获取读锁。这在某些需要保证写后数据对当前线程立即可见的场景下有用（先获取写锁，修改数据，然后获取读锁，最后释放写锁，这样可以确保在释放写锁前，其他线程无法修改数据，而当前线程可以安全地读取刚写入的数据）。
* **锁升级（不支持）**：持有读锁的线程**不能**直接获取写锁。如果需要从读操作切换到写操作，必须先释放读锁，然后再尝试获取写锁。这是为了防止死锁，因为多个持有读锁的线程可能同时尝试升级为写锁，导致相互等待。
* **公平性**：与 `ReentrantLock` 类似，可以创建公平或非公平的 `ReentrantReadWriteLock`。

  + `new ReentrantReadWriteLock()` 或 `new ReentrantReadWriteLock(false)`：非公平（默认）。
  + `new ReentrantReadWriteLock(true)`：公平。公平性策略同时应用于读锁和写锁的获取。在公平模式下，如果队列头部是等待写锁的线程，那么后续的读锁请求会被阻塞，即使当前没有线程持有写锁（写优先策略的一种体现，防止写线程饥饿）。
* **基于 AQS 实现**：`ReentrantReadWriteLock` 内部同样使用 AQS (`AbstractQueuedSynchronizer`) 作为基础。但它对 AQS 的 `state` 字段进行了巧妙的设计，用**同一个 `int` 类型的 `state` 同时表示读锁和写锁的状态**。

  + `state` 的高 16 位表示**读锁**的持有数量（共享锁计数）。
  + `state` 的低 16 位表示**写锁**的重入次数（独占锁计数）。

  ```
  // ReentrantReadWriteLock.Sync (AQS implementation)
  static final int SHARED_SHIFT   = 16;
  static final int SHARED_UNIT    = (1 << SHARED_SHIFT); // 读锁单位 (65536)
  static final int MAX_COUNT      = (1 << SHARED_SHIFT) - 1; // 最大读/写计数 (65535)
  static final int EXCLUSIVE_MASK = (1 << SHARED_SHIFT) - 1; // 低16位掩码 (用于取写锁计数)

  // 获取读锁计数 c >>> 16
  static int sharedCount(int c)    { return c >>> SHARED_SHIFT; }
  // 获取写锁计数 c & EXCLUSIVE_MASK
  static int exclusiveCount(int c) { return c & EXCLUSIVE_MASK; }


  + 1
  + 2
  + 3
  + 4
  + 5
  + 6
  + 7
  + 8
  + 9
  + 10
  ```

  这种设计使得 AQS 可以通过位运算来管理两种不同类型的锁状态。

#### 4.3 `ReentrantReadWriteLock` 的使用示例

假设我们有一个缓存类，读取操作很频繁，写入（更新缓存）操作相对较少。

```
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;

public class Cache<K, V> {
    private final Map<K, V> map = new HashMap<>();
    // 创建一个非公平的读写锁
    private final ReadWriteLock rwLock = new ReentrantReadWriteLock();
    // 获取读锁实例
    private final Lock rLock = rwLock.readLock();
    // 获取写锁实例
    private final Lock wLock = rwLock.writeLock();

    // 读操作：使用读锁
    public V get(K key) {
        rLock.lock(); // 获取读锁 (多个线程可以同时获取)
        System.out.println(Thread.currentThread().getName() + " acquired read lock.");
        try {
            // 模拟读取耗时
            Thread.sleep(50);
            return map.get(key);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return null;
        } finally {
            System.out.println(Thread.currentThread().getName() + " releasing read lock.");
            rLock.unlock(); // 释放读锁
        }
    }

    // 写操作：使用写锁
    public V put(K key, V value) {
        wLock.lock(); // 获取写锁 (独占)
        System.out.println(Thread.currentThread().getName() + " acquired write lock.");
        try {
            // 模拟写入耗时
            Thread.sleep(100);
            return map.put(key, value);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return null;
        } finally {
            System.out.println(Thread.currentThread().getName() + " releasing write lock.");
            wLock.unlock(); // 释放写锁
        }
    }

    // 清空操作：也需要写锁
    public void clear() {
        wLock.lock();
        System.out.println(Thread.currentThread().getName() + " acquired write lock for clear.");
        try {
             Thread.sleep(150);
            map.clear();
        } catch (InterruptedException e) {
             Thread.currentThread().interrupt();
        } finally {
             System.out.println(Thread.currentThread().getName() + " releasing write lock for clear.");
            wLock.unlock();
        }
    }

    public static void main(String[] args) {
        Cache<String, String> cache = new Cache<>();

        // 启动多个读线程
        for (int i = 0; i < 5; i++) {
            final int index = i;
            new Thread(() -> {
                cache.put("key" + index, "value" + index); // 先写入一些数据
                System.out.println("Reader-" + index + " read: " + cache.get("key" + index));
            }, "Reader-" + index).start();
        }

        // 启动一个写线程
        new Thread(() -> {
            cache.put("key_new", "value_new");
        }, "Writer-1").start();

         // 启动另一个读线程，尝试读取新写入的数据
         new Thread(() -> {
             try {
                 Thread.sleep(300); // 等待写线程可能执行
             } catch (InterruptedException e) {
                 Thread.currentThread().interrupt();
             }
             System.out.println("Reader-Late read: " + cache.get("key_new"));
         }, "Reader-Late").start();

         // 启动另一个写线程执行清空
         new Thread(() -> {
             try {
                 Thread.sleep(500); // 等待前面的操作
             } catch (InterruptedException e) {
                  Thread.currentThread().interrupt();
             }
             cache.clear();
             System.out.println("Cache cleared.");
              System.out.println("Reader-AfterClear read key0: " + cache.get("key0"));
         }, "Writer-Clear").start();
    }
}


```

运行上面的示例，你会观察到：

1. 多个 `Reader` 线程可以并发地执行 `get` 操作（并发获取读锁）。
2. 当 `Writer-1` 线程执行 `put` 操作时，它会获取写锁。在此期间，其他尝试获取读锁（如 `Reader-Late`）或写锁（如 `Writer-Clear`）的线程都会被阻塞。
3. 当 `Writer-1` 释放写锁后，等待的读线程或写线程才能继续执行。
4. `Writer-Clear` 获取写锁执行 `clear` 时，也会阻塞其他所有读写线程。

#### 4.4 读写锁的核心源码解读（简化）

`ReentrantReadWriteLock` 的读锁和写锁共享同一个 AQS 实例 (`Sync`)。

**获取读锁 (`ReadLock.lock()`)**

1. 调用 AQS 的 `acquireShared(1)` 方法。
2. `acquireShared(1)` 会调用子类实现的 `tryAcquireShared(1)`。
   * `tryAcquireShared()` (非公平模式简化逻辑):
     + 检查是否有其他线程持有**写锁** (通过检查 `exclusiveCount(getState()) != 0`)。如果有，直接返回 -1 (失败)。
     + 检查是否需要阻塞（根据公平性策略和是否超过最大读锁数量）。如果需要阻塞，返回 -1 (失败)。
     + 如果可以获取读锁，使用 CAS **原子地增加** `state` 的高 16 位（读计数）。`newState = oldState + SHARED_UNIT`。
     + 如果 CAS 成功，返回 1 (成功)。
     + 如果 CAS 失败（并发冲突），则进行自旋重试。
   * 如果 `tryAcquireShared()` 返回值 >= 0，表示获取读锁成功，`acquireShared` 方法结束。
   * 如果 `tryAcquireShared()` 返回值 < 0，表示获取读锁失败，则调用 `doAcquireShared(1)` 进入 AQS 的共享模式等待队列，逻辑与独占模式的 `acquireQueued` 类似，但处理的是共享节点的唤醒（可能唤醒多个等待读的线程）。

**释放读锁 (`ReadLock.unlock()`)**

1. 调用 AQS 的 `releaseShared(1)` 方法。
2. `releaseShared(1)` 会调用子类实现的 `tryReleaseShared(1)`。
   * `tryReleaseShared()`:
     + 在一个循环中，使用 CAS **原子地减少** `state` 的高 16 位（读计数）。 `newState = oldState - SHARED_UNIT`。
     + 如果 CAS 成功：
       - 检查新的读计数是否为 0 (`sharedCount(newState) == 0`)。如果是，表示最后一个读锁已释放，返回 `true`（表示可能需要唤醒等待写锁的线程）。
       - 如果新的读计数不为 0，返回 `false`。
     + 如果 CAS 失败，继续循环重试。
   * 如果 `tryReleaseShared()` 返回 `true`，`releaseShared` 会调用 `doReleaseShared()` 尝试唤醒等待队列中的后继节点（可能是等待写锁的，也可能是等待读锁的）。

**获取写锁 (`WriteLock.lock()`)**

1. 调用 AQS 的 `acquire(1)` 方法（与 `ReentrantLock` 类似）。
2. `acquire(1)` 会调用子类实现的 `tryAcquire(1)`。
   * `tryAcquire()` (非公平模式简化逻辑):
     + 获取当前 `state` (`c = getState()`)。计算读锁计数 (`w = exclusiveCount(c)`) 和写锁计数 (`r = sharedCount(c)`)。
     + **检查是否有读锁**: 如果 `r != 0` (有线程持有读锁)，或者 `w != 0` (其他线程持有写锁) 且持有者不是当前线程，返回 `false` (失败)。
     + 检查是否超过最大写锁计数。
     + 尝试使用 CAS **原子地增加** `state` 的低 16 位（写计数）。`newState = oldState + 1` (假设 `acquires` 是 1)。
     + 如果 CAS 成功，设置当前线程为独占所有者，返回 `true`。
     + 如果 CAS 失败，重试或返回 `false`。
     + （包含可重入逻辑：如果当前线程已持有写锁，则直接增加写计数）。
   * 如果 `tryAcquire(1)` 返回 `true`，获取写锁成功。
   * 如果 `tryAcquire(1)` 返回 `false`，进入 AQS 的独占模式等待队列 (`addWaiter`, `acquireQueued`)。

**释放写锁 (`WriteLock.unlock()`)**

1. 调用 AQS 的 `release(1)` 方法（与 `ReentrantLock` 类似）。
2. `release(1)` 会调用子类实现的 `tryRelease(1)`。
   * `tryRelease()`:
     + 检查当前线程是否是写锁持有者，不是则抛异常。
     + 将 `state` 的低 16 位（写计数）减 1。
     + 检查新的写计数是否为 0。
       - 是：清除独占所有者，返回 `true` (锁已完全释放)。
       - 否：返回 `false` (仍处于重入状态)。
   * 如果 `tryRelease(1)` 返回 `true`，`release` 方法会调用 `unparkSuccessor()` 唤醒等待队列中的下一个节点（可能是读线程或写线程）。

**关键点：**

* 读锁是共享的，通过 AQS 的 `acquireShared`/`releaseShared` 实现，主要操作 `state` 的高 16 位。
* 写锁是独占的，通过 AQS 的 `acquire`/`release` 实现，主要操作 `state` 的低 16 位。
* `tryAcquireShared` (获取读锁) 会检查是否有写锁 (`exclusiveCount != 0`)。
* `tryAcquire` (获取写锁) 会检查是否有读锁 (`sharedCount != 0`) 以及是否有其他线程持有写锁。
* 释放最后一个读锁或释放写锁时，都需要唤醒等待队列中的后继者。

#### 4.5 何时使用读写锁？

`ReentrantReadWriteLock` 适用于**读操作远多于写操作**，并且**读操作耗时较长**（相比锁的开销）的场景。如果读操作非常快，或者写操作非常频繁，使用读写锁带来的额外开销（管理读写状态、更复杂的 AQS 逻辑）可能抵消其并发优势，甚至性能不如简单的 `ReentrantLock` 或 `synchronized`。

**总结：** `ReentrantReadWriteLock` 通过分离读锁和写锁，允许多线程并发读取，提高了读密集型应用的性能，但实现更复杂，需谨慎评估适用场景。

---

### 第五章：条件变量 Condition

在并发编程中，除了保证共享资源的互斥访问外，我们经常还需要实现线程之间的**协作**，比如一个线程需要等待某个条件满足后才能继续执行，而这个条件的满足需要由另一个线程来触发。这就是**等待/通知（Wait/Notify）机制**。

`synchronized` 使用 `Object` 监视器上的 `wait()`, `notify()`, `notifyAll()` 方法来实现等待/通知。而 `Lock` 接口则通过 `Condition` 接口提供了更强大、更灵活的替代方案。

#### 5.1 `Condition` 接口

`Condition` 接口从 `Lock` 中分离出来，用于描述与锁相关的条件。一个 `Lock` 对象可以创建**一个或多个** `Condition` 实例。每个 `Condition` 实例内部维护着一个**独立的等待队列**，用于存放等待该特定条件的线程。

**`Condition` 接口的核心方法：**

```
public interface Condition {
    // 使当前线程等待，直到被唤醒 (signal/signalAll) 或被中断。
    // 调用此方法前，当前线程必须持有与此 Condition 相关联的 Lock。
    // 调用时，会自动释放持有的 Lock，并将线程放入该 Condition 的等待队列。
    // 当线程被唤醒或中断后，它必须重新获取 Lock 才能从此方法返回。
    void await() throws InterruptedException;

    // 使当前线程等待，直到被唤醒 (signal/signalAll)，不响应中断。
    // 如果在等待时被中断，它不会抛出 InterruptedException，但会在返回时保留中断状态。
    void awaitUninterruptibly();

    // 使当前线程等待，直到被唤醒、被中断或指定的等待时间耗尽。
    // 返回值表示剩余的等待时间（纳秒）。如果超时返回，则返回值小于等于 0。
    long awaitNanos(long nanosTimeout) throws InterruptedException;

    // 使当前线程等待，直到被唤醒、被中断或指定的等待时间耗尽。
    // 如果在超时前被唤醒或中断，返回 true；如果因超时返回，返回 false。
    boolean await(long time, TimeUnit unit) throws InterruptedException;

    // 使当前线程等待，直到被唤醒、被中断或到达指定的截止时间。
    // 如果在截止时间前被唤醒或中断，返回 true；如果因到达截止时间返回，返回 false。
    boolean awaitUntil(Date deadline) throws InterruptedException;

    // 唤醒在此 Condition 的等待队列中的一个线程。
    // 选择哪个线程被唤醒是不确定的（通常是等待时间最长的）。
    // 调用此方法前，当前线程必须持有与此 Condition 相关联的 Lock。
    void signal();

    // 唤醒在此 Condition 的等待队列中的所有线程。
    // 调用此方法前，当前线程必须持有与此 Condition 相关联的 Lock。
    void signalAll();
}


```

**关键规则：**

1. **`Condition` 必须依附于 `Lock`**：`Condition` 对象必须通过 `Lock` 实例的 `newCondition()` 方法创建。
2. **必须先获取锁**：调用 `Condition` 的任何 `await` 或 `signal` 方法之前，当前线程**必须**持有与该 `Condition` 相关联的 `Lock`。否则会抛出 `IllegalMonitorStateException` (与 `wait/notify` 类似)。
3. **`await()` 自动释放锁**：当线程调用 `await()` (及其变种) 时，它会**自动释放**当前持有的 `Lock`，然后进入该 `Condition` 的等待队列并挂起。
4. **唤醒后需重新获取锁**：当线程被 `signal()` / `signalAll()` 唤醒，或者因中断、超时而结束等待时，它**不能**立即从 `await()` 返回，而是需要**重新参与竞争获取 `Lock`**。只有当它成功**重新获取**到 `Lock` 之后，`await()` 方法才能真正返回。

#### 5.2 使用 `Condition` 实现生产者-消费者模型

`Condition` 最经典的用途是解决生产者-消费者问题，特别是当需要区分不同等待条件时。下面是一个使用 `ReentrantLock` 和两个 `Condition` 实现的有界阻塞队列的例子：

```
import java.util.LinkedList;
import java.util.Queue;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

public class BoundedBuffer<T> {
    private final Queue<T> queue;
    private final int capacity;
    private final Lock lock = new ReentrantLock();
    // 条件：队列不为满 (用于生产者等待)
    private final Condition notFull = lock.newCondition();
    // 条件：队列不为空 (用于消费者等待)
    private final Condition notEmpty = lock.newCondition();

    public BoundedBuffer(int capacity) {
        if (capacity <= 0) throw new IllegalArgumentException();
        this.capacity = capacity;
        this.queue = new LinkedList<>();
    }

    // 生产者方法
    public void put(T item) throws InterruptedException {
        lock.lock(); // 获取锁
        try {
            // 使用 while 循环检查条件（防止虚假唤醒）
            while (queue.size() == capacity) {
                System.out.println(Thread.currentThread().getName() + " - Buffer is full, waiting...");
                notFull.await(); // 队列已满，生产者在此 Condition 上等待，并释放 lock
                // 唤醒后，重新获取了 lock，再次检查条件
            }
            queue.offer(item); // 向队列添加元素
            System.out.println(Thread.currentThread().getName() + " - Produced: " + item + ", Queue size: " + queue.size());
            // 唤醒可能在等待队列非空的消费者线程
            notEmpty.signal(); // 只唤醒一个等待的消费者即可
        } finally {
            lock.unlock(); // 释放锁
        }
    }

    // 消费者方法
    public T take() throws InterruptedException {
        lock.lock(); // 获取锁
        try {
            // 使用 while 循环检查条件
            while (queue.isEmpty()) {
                System.out.println(Thread.currentThread().getName() + " - Buffer is empty, waiting...");
                notEmpty.await(); // 队列为空，消费者在此 Condition 上等待，并释放 lock
                // 唤醒后，重新获取了 lock，再次检查条件
            }
            T item = queue.poll(); // 从队列取出元素
            System.out.println(Thread.currentThread().getName() + " - Consumed: " + item + ", Queue size: " + queue.size());
            // 唤醒可能在等待队列非满的生产者线程
            notFull.signal(); // 只唤醒一个等待的生产者即可
            return item;
        } finally {
            lock.unlock(); // 释放锁
        }
    }

    public static void main(String[] args) {
        BoundedBuffer<Integer> buffer = new BoundedBuffer<>(5); // 容量为 5

        // 生产者线程
        Runnable producerTask = () -> {
            try {
                for (int i = 0; i < 10; i++) {
                    buffer.put(i);
                    Thread.sleep((long) (Math.random() * 100)); // 模拟生产耗时
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        };

        // 消费者线程
        Runnable consumerTask = () -> {
            try {
                for (int i = 0; i < 10; i++) {
                    Integer item = buffer.take();
                    Thread.sleep((long) (Math.random() * 500)); // 模拟消费耗时
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        };

        Thread p1 = new Thread(producerTask, "Producer-1");
        Thread p2 = new Thread(producerTask, "Producer-2");
        Thread c1 = new Thread(consumerTask, "Consumer-1");
        Thread c2 = new Thread(consumerTask, "Consumer-2");

        p1.start();
        p2.start();
        c1.start();
        c2.start();
    }
}


```

**代码解读：**

1. 创建了一个 `ReentrantLock` 和两个 `Condition`：`notFull` 和 `notEmpty`。
2. **`put` 方法（生产者）**：
   * 获取 `lock`。
   * 使用 `while (queue.size() == capacity)` 检查队列是否已满。**必须使用 `while` 而不是 `if`**，是为了处理“虚假唤醒”（线程可能在没有被 `signal` 的情况下被唤醒）。唤醒后必须重新检查条件。
   * 如果队列满，调用 `notFull.await()`。这会：
     + 原子地将当前线程加入 `notFull` 的等待队列。
     + 完全释放当前线程持有的 `lock`。
     + 挂起当前线程。
   * 当队列不满时（或者从 `await` 唤醒并重新检查条件通过后），向队列添加元素。
   * 调用 `notEmpty.signal()`。这会从 `notEmpty` 的等待队列中**唤醒一个**等待的消费者线程（如果有的话）。注意这里唤醒的是 `notEmpty` 上的等待者，而不是 `notFull` 上的。
   * 释放 `lock`。
3. **`take` 方法（消费者）**：
   * 获取 `lock`。
   * 使用 `while (queue.isEmpty())` 检查队列是否为空。
   * 如果队列空，调用 `notEmpty.await()`，将线程加入 `notEmpty` 等待队列，释放锁并挂起。
   * 当队列不空时，从队列取出元素。
   * 调用 `notFull.signal()`，从 `notFull` 的等待队列中唤醒一个等待的生产者线程。
   * 释放 `lock`。

**`Condition` 相对于 `synchronized` + `wait/notify` 的优势：**

* **精确唤醒**：可以为不同的等待条件创建不同的 `Condition` 对象，使用 `signal()` 只唤醒等待特定条件的线程，避免了 `synchronized` 中 `notify()` 可能唤醒错误类型线程或 `notifyAll()` 唤醒所有线程带来的“惊群效应”和不必要的竞争。
* **功能更丰富**：提供了可中断等待 (`awaitInterruptibly`)、超时等待 (`awaitNanos`, `awaitUntil`) 等更灵活的等待方式。

#### 5.3 `Condition` 的底层原理（基于 AQS）

`Condition` 的实现通常是作为 AQS 的内部类 `ConditionObject`。

* **等待队列**：每个 `ConditionObject` 实例内部维护一个**独立的 FIFO 等待队列**（与 AQS 的主同步队列不同），队列中的节点 (`Node`) 存储着等待在该 `Condition` 上的线程。这个队列与 AQS 的同步队列结构类似，但节点的 `waitStatus` 有特殊含义 (`CONDITION`)。
* **`await()` 过程：**

  1. **检查中断**: 检查当前线程中断状态。
  2. **加入 Condition 队列**: 调用 `addConditionWaiter()` 创建一个新节点（状态为 `CONDITION`），并将其加入到当前 `Condition` 对象的等待队列尾部。
  3. **完全释放 Lock**: 调用 AQS 的 `fullyRelease(Node node)` 方法，该方法会记录当前线程的锁重入次数，并将 AQS 的 `state` 设为 0，完全释放掉 `Lock`。这是关键一步，允许其他线程获取 `Lock` 并可能调用 `signal`。
  4. **循环等待**: 在一个循环中，不断检查当前节点是否还在 Condition 队列中 (`isOnSyncQueue(node)` 为 `false`)。如果还在，则调用 `LockSupport.park(this)` 挂起当前线程，等待被 `signal` 唤醒。
  5. **处理唤醒**: 当线程被唤醒（或中断/超时）后，循环会退出。此时需要将节点从 Condition 队列转移到 AQS 的主同步队列，并尝试重新获取 `Lock`。调用 AQS 的 `acquireQueued(node, savedState)` 方法（`savedState` 是之前记录的重入次数），进入 AQS 的标准获取流程（排队、等待、获取锁）。
  6. **处理中断/超时**: 如果在等待过程中或重新获取锁的过程中被中断，设置中断状态或抛出 `InterruptedException`。
  7. **返回**: 当成功重新获取 `Lock` (达到之前的重入次数) 后，`await()` 方法返回。
* **`signal()` 过程：**

  1. **检查锁持有**: 检查当前线程是否持有 `Lock`，不是则抛异常。
  2. **查找并唤醒**: 调用 `doSignal(first)` (first 是 Condition 队列的头节点)。该方法会从 Condition 队列的头部开始，找到第一个未被取消的等待节点。
  3. **转移节点**: 调用 `transferForSignal(node)` 将找到的节点从 Condition 队列**转移**到 AQS 的**主同步队列**尾部。转移过程中会修改节点的 `waitStatus` (通常改为 0 或 `SIGNAL`)，使其符合 AQS 主队列的要求。
  4. **唤醒线程**: 如果节点成功转移并且其状态允许（或被设置为允许）唤醒，则最终会通过 AQS 的 `release` 或类似机制中的 `unparkSuccessor` 逻辑，调用 `LockSupport.unpark(node.thread)` 唤醒该节点对应的线程。被唤醒的线程接下来会在其 `await` 方法的循环中尝试重新获取 `Lock`。

**核心机制：**

* `await` = 入 Condition 队 -> 释放 Lock -> park()
* `signal` = 出 Condition 队 -> 入 AQS 队 -> unpark() -> (被唤醒线程) 竞争 Lock

`Condition` 通过巧妙地利用 AQS 的框架，并维护独立的等待队列，实现了与 `Lock` 绑定的、灵活高效的线程等待/通知机制。

---

### 第六章：再探 AQS (AbstractQueuedSynchronizer)

前面我们多次提到 `Lock` 的核心原理是 AQS。为了更深入地理解 `Lock` 的行为，有必要对 AQS 的设计和工作流程有更清晰的认识。AQS 是 Java 并发包的基石，理解它有助于我们理解 `ReentrantLock`, `ReentrantReadWriteLock`, `Semaphore`, `CountDownLatch` 等众多同步工具的内部运作。

#### 6.1 AQS 的设计目标与核心组件

**设计目标：** 提供一个通用的、可扩展的同步基础框架，让开发者能够相对容易地构建出各种不同的同步器，而无需关心底层的线程排队、阻塞、唤醒等复杂细节。

**核心组件回顾：**

1. **`state` (int)**：使用 `volatile` 修饰的整型变量，表示同步状态。其含义由具体子类定义（锁是否被持有、剩余许可证数量等）。通过 CAS 操作进行原子更新。
2. **CLH 队列 (变体)**：一个虚拟的、FIFO 的双向链表队列，用于存放等待获取同步状态的线程节点 (`Node`)。

   * **头节点 (Head)**：指向队列的头部，是一个虚拟节点（哑节点），不代表任何线程。它的 `thread` 字段通常为 `null`。头节点的变化标志着锁的持有者发生了变化。
   * **尾节点 (Tail)**：指向队列的尾部，新加入的等待线程节点会被添加到这里。`head` 和 `tail` 的更新都通过 CAS 操作保证线程安全。
   * **节点 (Node)**：队列中的每个节点封装了等待的线程 (`thread`)、等待状态 (`waitStatus`)、前驱节点 (`prev`)、后继节点 (`next`) 以及指向下一个在 Condition 队列中等待的节点的指针 (`nextWaiter`，用于 `ConditionObject`)。
3. **`waitStatus` (int)**：节点的状态，用于线程间的协作和通信：

   * **`CANCELLED` (1)**：表示节点对应的线程因为超时或中断而取消了等待。处于此状态的节点会被忽略，并最终从队列中移除。
   * **`SIGNAL` (-1)**：表示**后继节点**（或即将成为后继节点的线程）需要被唤醒 (`unpark`)。当前节点在释放同步状态或被取消时，如果其 `waitStatus` 是 `SIGNAL`，它有责任唤醒它的后继节点。
   * **`CONDITION` (-2)**：表示节点当前在**条件队列** (`Condition` queue) 中等待，而不是在 AQS 的主同步队列中。当节点从条件队列转移到同步队列时，状态会被修改。
   * **`PROPAGATE` (-3)**：主要用于共享模式 (`ReadWriteLock` 的读锁, `Semaphore` 等)。表示 `releaseShared` 操作需要向后传播，即使当前节点可能不需要唤醒，也需要确保唤醒动作能传递给后续节点。
   * **`0` (初始状态)**：新创建的节点或刚从条件队列转移过来的节点的默认状态。
4. **独占模式 (Exclusive) vs 共享模式 (Shared)**：AQS 支持两种资源访问模式，体现在获取和释放同步状态的方法上。

   * 独占：`acquire`, `release`, `tryAcquire`, `tryRelease`
   * 共享：`acquireShared`, `releaseShared`, `tryAcquireShared`, `tryReleaseShared`
5. **模板方法模式**：AQS 定义了同步过程的骨架 (`acquire`, `release` 等)，而将具体的同步状态判断逻辑 (`tryAcquire`, `tryRelease` 等) 交给子类实现。

#### 6.2 AQS 工作流程：独占模式 (以 `ReentrantLock` 为例)

**获取锁 (`acquire`)**

acquireQueued 循环


成功


失败


是


成功


失败


否


需要 park


不需要 park


自旋循环


获取前驱 P


P 是 Head?


再次尝试 tryAcquire


检查是否需要 park


调用 LockSupport.parkT挂起


被 unpark 唤醒


线程 T 调用 lock


尝试 tryAcquire


获取锁成功, lock 返回


调用 addWaiter-Node.EXCLUSIVE


将 T 封装成 Node, CAS 加入队尾


调用 acquireQueuednode, 1


将当前 Node 设为 Head, 获取锁成功

1. **`tryAcquire`**: 尝试获取锁。成功则直接返回。
2. **`addWaiter`**: 如果 `tryAcquire` 失败，将当前线程包装成 `Node` 并通过 CAS 加入等待队列尾部。
3. **`acquireQueued`**: 进入核心排队逻辑。
   * **自旋检查**: 在循环中不断检查自己是否可以获取锁。
   * **检查前驱**: 只有当**前驱节点是头节点**时，才有资格尝试获取锁（保证 FIFO，虽然 `tryAcquire` 本身可能非公平）。
   * **再次 `tryAcquire`**: 如果前驱是头，再次尝试获取锁。成功则将自己设为新的头节点，退出循环。
   * **判断是否挂起 (`shouldParkAfterFailedAcquire`)**: 如果不满足获取锁的条件，判断是否应该挂起。主要是检查前驱节点的状态是否为 `SIGNAL`。如果不是，则尝试将前驱状态设为 `SIGNAL`，并继续自旋一次（给前驱一个设置状态的机会）。
   * **挂起 (`parkAndCheckInterrupt`)**: 如果前驱是 `SIGNAL` 状态，调用 `LockSupport.park()` 挂起当前线程，等待被前驱 `unpark`。
   * **唤醒后**: 线程被唤醒后，回到自旋检查的开始，继续尝试获取锁。

**释放锁 (`release`)**

unparkSuccessor 逻辑


成功-锁已完全释放


是


否


失败 锁未完全释放/重入


调用 unparkSuccessor


找到 H 的下一个有效等待节点 S


调用 LockSupport.unpark


线程 T 调用 unlock


尝试 tryRelease


获取 Head 节点 H


H != null 且 H.waitStatus != 0?


unlock 返回

1. **`tryRelease`**: 尝试释放锁（减少 `state`）。
   * 如果锁被完全释放 (`state` 变为 0，且 `tryRelease` 返回 `true`)，则继续。
   * 如果锁未完全释放（重入），则直接返回。
2. **检查头节点状态**: 获取头节点 `H`。如果 `H` 存在并且其 `waitStatus` 不为 0（通常是 `SIGNAL`，表示它承诺过要唤醒后继者），则需要唤醒后继节点。
3. **`unparkSuccessor`**: 唤醒后继节点。
   * 找到头节点的下一个**有效**（非 `CANCELLED`）的等待节点 `S`。查找过程会跳过已取消的节点。
   * 调用 `LockSupport.unpark(S.thread)` 唤醒该节点对应的线程。
4. **返回**: `unlock()` 方法结束。

#### 6.3 AQS 工作流程：共享模式 (以 `Semaphore.acquire` 为例)

共享模式与独占模式类似，但有关键区别：

* **`tryAcquireShared`**: 尝试获取共享资源（例如，减少 `Semaphore` 的许可证 `state`）。
  + 返回值：负数表示失败；0 表示成功但无剩余资源；正数表示成功且有剩余资源。
* **`doAcquireShared`**: 共享模式的排队逻辑。
  + 获取成功后，如果发现还有剩余资源 (`tryAcquireShared` 返回值 > 0) 或者需要向后传播 (`PROPAGATE` 状态)，**可能会唤醒后续的等待节点** (`setHeadAndPropagate`)。这是共享模式的关键，允许多个线程同时获取成功。
* **`releaseShared`**: 释放共享资源（例如，增加 `Semaphore` 的许可证 `state`）。
* **`doReleaseShared`**: 唤醒后继节点。它会无条件地尝试唤醒等待队列中的下一个节点，并可能需要确保唤醒状态向后传播 (`PROPAGATE`)，以唤醒所有可能满足条件的等待线程。

共享模式的“传播”特性使得一次 `releaseShared` 操作可能导致队列中多个等待线程被唤醒并成功获取资源。

#### 6.4 `LockSupport`: AQS 的底层支撑

AQS 中线程的挂起和唤醒，最终依赖于 `java.util.concurrent.locks.LockSupport` 工具类。`LockSupport` 提供了基本的线程阻塞和唤醒原语，它与 `Object` 的 `wait/notify` 不同：

* **基于“许可”(Permit)**：每个线程都有一个关联的许可，许可只有 0 和 1 两种状态。
  + `park()`：如果许可为 1，则将许可消耗（变为 0），方法立即返回；如果许可为 0，则阻塞当前线程，直到许可变为 1。
  + `unpark(Thread thread)`：将指定线程 `thread` 的许可设置为 1。如果线程当前因为 `park()` 而阻塞，它会被唤醒；如果线程当前未阻塞，那么下次它调用 `park()` 时会直接消耗许可并返回。
* **不要求持有锁**：`park/unpark` 可以在任何地方调用，不需要获取任何锁。
* **`unpark` 可以先于 `park`**：如果先调用 `unpark`，再调用 `park`，线程不会阻塞。而 `notify` 必须在 `wait` 之后调用（或者说，在 `wait` 之前调用 `notify` 是无效的）。
* **中断影响**：`park()` 会响应中断，但它**不会**抛出 `InterruptedException`。它只是默默地返回，并设置线程的中断状态。AQS 在 `parkAndCheckInterrupt` 中会检查这个中断状态。

AQS 正是利用 `LockSupport.park()` 来挂起等待队列中的线程，利用 `LockSupport.unpark()` 来唤醒它们。

#### 6.5 AQS 小结

AQS 是一个设计精巧、功能强大的同步基础框架。它通过 `state` 变量、CLH 等待队列、模板方法模式以及底层的 `CAS` 和 `LockSupport`，为上层同步工具（如 `Lock`, `Semaphore` 等）提供了一套标准化的线程管理和同步状态控制机制。理解 AQS 的原理，是深入掌握 Java 并发包的关键。

---

### 第七章：`LockSupport` vs `Lock`

有时初学者会混淆 `Lock` 接口和 `LockSupport` 工具类。虽然名字相似，且都与线程阻塞/唤醒有关，但它们的层级和用途完全不同。

| 对比点 | `Lock` 接口 (如 `ReentrantLock`) | `LockSupport` 工具类 |
| --- | --- | --- |
| **层级** | **高层**同步机制，面向应用开发者 | **底层**线程阻塞/唤醒原语，面向框架/工具开发者 |
| **核心用途** | 提供**互斥锁**功能，管理对共享资源的访问 | 提供线程**挂起 (`park`)** 和 **唤醒 (`unpark`)** 的能力 |
| **实现机制** | 基于 **AQS** 实现，管理 `state` 和线程队列 | 基于 **`Unsafe`** 类调用 **JVM 本地方法** 实现 |
| **锁概念** | **有**明确的锁获取 (`lock`) 和释放 (`unlock`) | **无**锁概念，直接操作线程的阻塞状态 |
| **状态管理** | AQS 管理 `state` 表示锁状态和重入计数 | 通过线程关联的 **Permit (许可)** 控制阻塞 |
| **使用场景** | 实现线程互斥、条件等待等应用级同步逻辑 | 作为 **AQS 等同步框架的底层支撑**，或用于构建自定义同步工具 |
| **唤醒时序** | `unlock` (释放锁) 通常是唤醒的前提 | `unpark` **可以先于** `park` 调用 |
| **与线程关系** | 锁对象与等待线程队列关联 | 直接操作指定线程的阻塞状态 |

**简单来说：**

* `Lock` 是你用来锁门（保护代码块）的**高级工具**。
* `LockSupport` 是 AQS (那个门卫系统) 用来让等待的线程**睡觉 (`park`)** 和**叫醒 (`unpark`)** 他们的**底层指令**。

应用开发者通常直接使用 `Lock` 接口及其实现类。而 `LockSupport` 主要由 JDK 内部的并发框架（如 AQS）使用，或者在开发非常底层的自定义同步组件时才可能直接接触。

**为什么 AQS 选择 `LockSupport` 而不是 `Object.wait/notify`？**

1. **`wait/notify` 必须与 `synchronized` 配合**：`wait/notify` 必须在 `synchronized` 块内调用，这意味着需要持有对象的监视器锁。而 AQS 需要更灵活的控制，它需要在释放 AQS 自身的锁（`state`）之后唤醒其他线程，或者在持有锁的情况下让线程等待 `Condition`。`LockSupport` 无此限制。
2. **`unpark` 可以先于 `park`**：这个特性对于 AQS 处理并发唤醒和挂起非常重要，可以避免因 `unpark` 和 `park` 时序问题导致的信号丢失。
3. **精确唤醒**：`unpark(thread)` 直接唤醒指定线程，比 `notify()`（随机唤醒一个）或 `notifyAll()`（唤醒全部）更精确、高效。

---

### 第八章：总结与最佳实践

**核心知识点回顾：**

* **`Lock` vs `synchronized`**：`Lock` 提供了更灵活、功能更丰富的锁机制（可中断、超时、公平性、`Condition`），但需要手动释放锁；`synchronized` 更简单、不易出错，适用于常规场景。
* **AQS (AbstractQueuedSynchronizer)**：是 `Lock` 等 JUC 同步器的基础框架，通过 `state` 变量、CLH 队列、模板方法模式和 `LockSupport` 实现线程同步管理。
* **`ReentrantLock`**：常用的可重入互斥锁，支持公平和非公平模式。理解其 `lock/unlock` 流程有助于掌握 AQS 的独占模式。
* **`ReadWriteLock` / `ReentrantReadWriteLock`**：读写锁，允许多个读线程并发，提高读密集场景性能。通过 AQS 的 `state` 高低位分别管理读写锁状态。适用于读多写少且读操作耗时较长的场景。
* **`Condition`**：与 `Lock` 配合使用的条件变量，提供比 `wait/notify` 更灵活的等待/通知机制，可创建多个条件队列实现精确唤醒。`await` 会释放锁并等待，`signal` 唤醒等待者。
* **`LockSupport`**：底层的线程挂起/唤醒工具，基于 Permit 机制，是 AQS 实现线程阻塞/唤醒的基础。

**最佳实践：**

1. **优先选择 `synchronized`**：对于简单的互斥同步需求，`synchronized` 更简洁、安全（自动释放锁），且现代 JVM 对其优化良好。只有在确实需要 `Lock` 提供的高级特性时才考虑使用 `Lock`。
2. **`finally` 中释放锁**：使用 `Lock` 时，**永远、必须**将 `unlock()` 调用放在 `finally` 块中，以确保锁在任何情况下都能被释放，防止死锁。

   ```
   lock.lock();
   try {
       // critical section
   } finally {
       lock.unlock(); // MUST be in finally
   }


   ```
3. **谨慎选择公平锁**：非公平锁通常具有更高的吞吐量。仅在确实需要保证获取锁的顺序性或防止饥饿时才使用公平锁 (`new ReentrantLock(true)` 或 `new ReentrantReadWriteLock(true)`), 并注意其可能带来的性能损耗。
4. **合理使用读写锁**：仅在**读多写少**且**读操作耗时相对较长**的场景下使用 `ReadWriteLock`。评估其引入的复杂性和开销是否值得。
5. **`Condition.await()` 使用 `while` 循环**：在使用 `Condition.await()` 等待条件满足时，应始终在 `while` 循环中检查条件，以防止“虚假唤醒”。

   ```
   lock.lock();
   try {
       while (!conditionMet()) { // Always use while
           condition.await();
       }
       // condition is now met, proceed
   } finally {
       lock.unlock();
   }


   ```
6. **避免锁的粒度过大**：尽量缩小锁保护的代码范围（临界区），只锁住必要的部分，以提高并发度。
7. **注意死锁**：使用多个锁时，要特别注意获取锁的顺序，避免循环等待导致死锁。考虑使用 `tryLock` 超时机制来尝试避免死锁。
8. **理解可重入性**：知道 `ReentrantLock` 和 `synchronized` 是可重入的，同一个线程可以多次获取同一个锁。
9. **考虑使用更高级的并发工具**：对于某些特定场景，`java.util.concurrent` 包提供了更高级、更易用的工具，如 `ConcurrentHashMap`（替代 `HashMap` + `Lock`）、`BlockingQueue`（内置了生产者-消费者逻辑）、`Atomic` 原子类（用于简单计数或状态更新）等。优先考虑使用这些现成的轮子。
