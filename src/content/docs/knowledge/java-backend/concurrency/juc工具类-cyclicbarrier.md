---
title: "JUC工具类-CyclicBarrier"
description: "在高并发程序设计中，实现多个线程之间的相互等待、协调推进是一项常见且具有挑战性的任务。"
sourceId: "147238412"
source: "https://blog.csdn.net/qq_45852626/article/details/147238412"
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
  order: 147238412
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/147238412)（历史文章导入，当前状态为草稿）

## 1. 引言

在高并发程序设计中，实现多个线程之间的相互等待、协调推进是一项常见且具有挑战性的任务。  
 Java 并发包提供了多种同步辅助类，如 CountDownLatch、Semaphore、Phaser 以及 CyclicBarrier，旨在解决不同类型的并发同步问题。  
 其中 **CyclicBarrier** 以其“集合点”思想和可循环使用的特性备受关注，可用于实现多阶段迭代、并行算法同步等场景。

## 2. 基础概念

在进入源码细节之前，我们先回顾一下 CyclicBarrier 的基本定义、核心功能以及与其他同步工具的对比，帮助构建整体概念框架。

### 2.1 CyclicBarrier 定义及主要功能

**CyclicBarrier** 是 Java 并发包中用于协调多个线程相互等待的同步辅助类，其主要作用为：

* **集合等待**：允许一定数量的线程在达到屏障时互相等待，直到所有线程到达指定点。
* **屏障触发**：当所有线程都达到屏障时，屏障“开启”，所有线程同时被唤醒继续执行。
* **触发动作**：可选的屏障动作（barrierAction），用于在所有线程到达后执行特定的逻辑，如合并计算结果或状态更新。
* **循环可重用**：在所有线程通过屏障后，自动重置计数器，支持多次使用。

简单地说，CyclicBarrier 就像“远足团队的集合点”，所有线程（团队成员）到达后，等待人员数量达到约定值后一起出发，而这一集合过程可以在整个任务中不断重复使用。

### 2.2 基本使用场景

典型的使用场景包括但不限于：

* **并行迭代算法**：每次迭代中，多个线程在各自计算后等待集合，再根据计算结果更新共享状态。
* **分阶段计算**：多阶段并行任务中，每个阶段结束后所有线程必须同步才能进入下一阶段。
* **多线程模拟**：模拟系统中各个组件之间需要在同一时间点共同前进的场景。
* **多线程测试**：进行压力测试和并发场景测试时，确保所有线程在同一时刻启动或结束任务，观察整个系统的行为。

### 2.3 与其他同步工具的比较

CyclicBarrier 与其他常用同步工具（如 CountDownLatch 和 Phaser）在设计上有明显差异：

* **CountDownLatch**：适用于一次性等待场景，计数器归零后不能重置；常用于主线程等待多个子线程完成任务。
* **Phaser**：功能上更为灵活，可动态调整参与者数量，适用于多阶段同步场景，提供阶段号信息。
* **Semaphore**：用于管理访问资源的许可数量，解决“访问限制”问题，而非纯粹的同步等待。

## 3. 内部原理解析

### 3.1 内部数据结构和状态变量

CyclicBarrier 内部维护了几个关键变量，这些变量是其实现机制的核心：

* **parties**：屏障允许参与等待的线程总数，初始化后不变。
* **count**：当前剩余需要达到屏障的线程数量；初始值等于 parties，每次调用 await() 时递减，直到减为 0。
* **barrierAction**：可选的 Runnable，当所有线程到达屏障时由最后一个线程执行，用于执行汇总或状态更新等任务。
* **Generation**：内部使用一个 Generation 对象表示当前屏障“代”，当所有线程到达后，通过创建新的 Generation 对象来区分不同周期的状态，保证前后周期的隔离。
* **ReentrantLock 和 Condition**：通过显式锁（ReentrantLock）和条件变量（Condition）实现线程等待和唤醒，保证状态修改操作的原子性。

这种设计巧妙地利用了基本的同步原语，既能实现精细的线程控制，又能支持循环重用的特性。

### 3.2 同步机制分析：ReentrantLock 与 Condition

在实现线程同步时，CyclicBarrier 采用了基于 ReentrantLock 和 Condition 条件变量的设计：

* **ReentrantLock** 确保了对共享状态（如 count、generation）的修改过程是原子操作，避免了竞态条件。
* **Condition** 提供了一种等待通知机制。线程调用 await() 后进入 Condition 的等待队列，直至满足唤醒条件（例如最后一个线程到达或屏障重置），从而保证所有线程都能在合适时刻恢复运行。

这种设计不仅安全高效，而且相比于使用 synchronized 关键字，更易控制和调试。

### 3.3 循环特性（Cyclic）实现详解

CyclicBarrier 能够被循环利用，也就是当所有线程到达屏障后，屏障自动重置，这一特性是通过下面两个步骤实现的：

1. **重置计数器**：当最后一个线程到达时，将内部计数器（count）重置为初始值 parties，为下一轮等待做好准备。
2. **更新 Generation**：通过创建新的 Generation 对象，将旧周期与新周期明显分隔开，防止前一周期的状态影响下一周期的执行。

这种“换代”机制非常重要，能够有效隔离各个同步周期，避免状态混淆。与 CountDownLatch 只能使用一次不同，CyclicBarrier 的这种循环复用能力特别适用于迭代同步的并行计算任务。

### 3.4 错误与异常处理机制

在并发编程中，异常处理尤为重要。CyclicBarrier 中主要涉及以下异常情况：

* **BrokenBarrierException**：如果在等待期间，屏障因中断或超时而破坏，所有等待线程都会收到此异常。
* **InterruptedException**：若线程在等待期间被中断，会破坏屏障，并抛出 InterruptedException。
* **TimeoutException**（带超时版本）：如果在指定时间内没有达到屏障，线程会抛出 TimeoutException，并触发屏障破坏机制。

通过合理的异常处理，CyclicBarrier 能够保证即便在部分线程异常的情况下，整体状态依然能保持一致。

## 4. 源码分析与关键方法讲解

### 4.1 构造函数的实现与状态初始化

CyclicBarrier 提供了两个构造函数：

```
public CyclicBarrier(int parties) {
    this(parties, null);
}

public CyclicBarrier(int parties, Runnable barrierAction) {
    if (parties <= 0)
        throw new IllegalArgumentException();
    this.parties = parties;
    this.count = parties;
    this.barrierAction = barrierAction;
    // 隐式初始化部分：
    // 1. 使用 new ReentrantLock() 创建独占锁
    // 2. 使用 lock.newCondition() 创建条件变量
    // 3. 初始化 generation = new Generation()
    // 这些步骤确保了屏障初始状态的一致性
}


```

#### 分析

* **参数验证**：在第二个构造函数中，首先检查传入线程数量是否大于 0，防止无效配置。
* **状态变量初始化**：将 parties 和 count 均设置为传入的线程数量；若传入了 barrierAction，则保存该动作；同时隐含地创建了用于同步控制的 ReentrantLock 和 Condition，并通过创建新的 Generation 对象开始第一个同步周期。
* **设计理念**：没有创建或启动任何线程，而只是设置好同步所需的基础设施，体现了“按需创建”和“惰性设计”的思想。

这种“轻量级初始化”的设计确保了 CyclicBarrier 在首次使用前状态一致，并且能够在后续循环中高效工作。

### 4.2 await() 方法解析

await() 方法是 CyclicBarrier 的核心操作，负责让当前线程等待其他线程到达屏障，并在所有线程到齐后继续执行。

#### 4.2.1 await() 简单包装

最简单的 await() 实现为：

```
public int await() throws InterruptedException, BrokenBarrierException {
    try {
        return dowait(false, 0L);
    } catch (TimeoutException toe) {
        throw new Error(toe); // 此处不会发生超时异常
    }
}


```

该方法实际上只是对核心方法 dowait() 的一次包装，当不需要处理超时的情况时，直接调用 dowait(false, 0L) 即可。

#### 4.2.2 dowait() 核心逻辑详解

dowait() 方法是整个等待与唤醒机制的核心，其源码如下：

```
private int dowait(boolean timed, long nanos)
    throws InterruptedException, BrokenBarrierException, TimeoutException {
    final ReentrantLock lock = this.lock;
    lock.lock(); // 获取锁，保证后续操作的原子性
    try {
        final Generation g = generation;
        
        // 1. 屏障状态检查
        if (g.broken)
            throw new BrokenBarrierException();
            
        // 2. 检查线程中断状态
        if (Thread.interrupted()) {
            breakBarrier();
            throw new InterruptedException();
        }
        
        // 3. 计数递减，获取当前到达屏障线程的索引
        int index = --count;
        if (index == 0) {  // 当前线程为最后一个到达屏障的线程
            boolean ranAction = false;
            try {
                final Runnable command = barrierAction;
                if (command != null)
                    command.run(); // 执行屏障动作
                ranAction = true;
                nextGeneration(); // 进入下一代（重置屏障）
                return 0;
            } finally {
                if (!ranAction)
                    breakBarrier();  // 若屏障动作抛异常，则破坏屏障
            }
        }
        
        // 4. 当前线程不是最后一个到达，需要等待其他线程
        for (;;) {
            try {
                if (!timed)
                    trip.await(); // 无超时阻塞等待
                else if (nanos > 0L)
                    nanos = trip.awaitNanos(nanos); // 有超时限制的等待方式
            } catch (InterruptedException ie) {
                // 当线程在等待过程中被中断
                if (g == generation && !g.broken) {
                    breakBarrier();
                    throw ie;
                } else {
                    Thread.currentThread().interrupt();
                }
            }
            
            // 5. 检查屏障状态是否被破坏
            if (g.broken)
                throw new BrokenBarrierException();
                
            // 6. 当进入下一个同步周期后，返回线程到达屏障的索引
            if (g != generation)
                return index;
                
            // 7. 超时检测：若超时则破坏屏障并抛出异常
            if (timed && nanos <= 0L) {
                breakBarrier();
                throw new TimeoutException();
            }
        }
    } finally {
        lock.unlock();
    }
}


```

##### 详细解释

1. **获取锁**  
    为了保证所有操作的原子性，首先获取了 `lock`，从而防止在对状态变量（如 count 和 generation）进行修改时出现竞态问题。
2. **状态检查与中断处理**

   * 检查当前 Generation 是否已经处于损坏状态。如果被破坏，立即抛出 `BrokenBarrierException`。
   * 判断当前线程是否已经中断，如果是则调用 `breakBarrier()` 将屏障置为破坏状态，并抛出 `InterruptedException`。
3. **计数器递减与索引返回**  
    每个线程调用时都会将计数器 `count` 减 1，并将减后的值作为其“索引”返回。最后一个到达的线程（当 index == 0）负责：

   * 执行屏障动作（若有配置 `barrierAction`），并对其执行异常捕获。
   * 调用 `nextGeneration()` 来重置状态，使得屏障可以被重复使用。
   * 唤醒所有等待线程，所有等待线程在下一代检测中将发现 generation 已发生变更，从而退出等待循环。
4. **等待循环**  
    对于不是最后到达的线程，则进入一个 for(;😉 循环，调用条件变量 `trip.await()` 进入等待状态。期间：

   * 若在等待过程中被中断，则进行相应处理：在屏障未重置前中断会破坏屏障，等待线程会收到异常。
   * 每次被唤醒后检查屏障状态，判断是否属于当前代或是否已经破坏。
   * 若超时（timed 参数为 true 且 nanos 小于等于 0），也会破坏屏障并抛出 TimeoutException。
5. **唤醒机制**  
    唤醒其他线程主要由两个方法实现：

   * **nextGeneration()**：当最后一个线程到达时调用，负责将所有等待线程唤醒并重置状态。
   * **breakBarrier()**：当出现异常或中断时调用，唤醒所有等待线程并将屏障置于损坏状态。

这一段代码综合考虑了各种边界情况（中断、超时、异常），保证了在多线程并发场景下的安全、可靠运行。

### 4.3 barrierAction 执行流程

CyclicBarrier 提供了一个可选的屏障动作 `barrierAction`，其在所有线程到达后由最后一个线程执行。执行逻辑如下：

```
// 在 dowait() 中，最后一个线程到达时执行 barrierAction：
if (index == 0) {  // 若为最后一个线程
    boolean ranAction = false;
    try {
        final Runnable command = barrierAction;
        if (command != null)
            command.run(); // 执行屏障动作
        ranAction = true;
        nextGeneration(); // 执行完后重置状态
        return 0;
    } finally {
        if (!ranAction)
            breakBarrier(); // 若执行 barrierAction 发生异常，则破坏屏障
    }
}


```

**关键点说明**：

* **执行时机**：最后一个线程到达后，立即执行 barrierAction，然后调用 nextGeneration() 重置状态。
* **异常处理**：如果屏障动作在执行过程中出现异常（即 ranAction 未置为 true），则调用 breakBarrier() 将整个屏障置为失效状态，所有等待线程均收到 BrokenBarrierException。
* **线程角色**：只有最后到达的线程负责执行 barrierAction，其余线程在等待过程中仍处于阻塞状态，直到重置完成后退出等待。

这种设计使得在多个线程到达屏障后可以集中处理一些“串行任务”，例如合并结果、计算全局状态、更新共享数据等，简化了并行编程中的额外同步逻辑。

### 4.4 自动重置机制（nextGeneration）的实现

CyclicBarrier 的循环特性得益于其自动重置机制。核心源码如下：

```
private void nextGeneration() {
    trip.signalAll();  // 1. 唤醒所有等待线程
    count = parties;   // 2. 将计数器重置为初始值
    generation = new Generation();  // 3. 进入新的同步周期（换代）
}


```

#### 分析

1. **唤醒等待线程**  
    调用 `trip.signalAll()` 使得所有因调用 await() 方法而等待的线程被唤醒。被唤醒线程在下一步会检测到当前 generation 已经改变，从而判断屏障已成功通过。
2. **计数器重置**  
    将内部计数器 `count` 设置为初始化值 `parties`，使得下一轮同步时等待线程数正确无误。
3. **更新 Generation**  
    通过创建新对象替换原有的 generation，实现同步周期的隔离。这种“换代”机制可以防止旧状态对新周期的影响，同时便于线程通过引用比较判断屏障是否重置成功。

这种实现方式不仅代码简洁，同时也在并发场景下确保了状态变更过程的原子性，避免了部分线程看到“半重置”的状态。

---

## 5. 对比分析：CyclicBarrier 与其他同步工具

在实际并发编程中，选择合适的同步工具至关重要。下面将对比 CyclicBarrier 与 CountDownLatch、Phaser、Semaphore 以及其他同步方式的异同和适用场景。

### 5.1 CountDownLatch

* **核心功能**：  
   CountDownLatch 用于等待一定数量的事件完成，常常用于主线程等待多个子线程完成任务。
* **特点**：
  + 一次性使用，当计数器降为 0 后不能重置。
  + 适合明确的“等待者”与“被等待者”场景。
* **使用场景**：
  + 主线程等待多个子线程初始化或处理结束后再执行后续逻辑。
  + 一次性任务完成同步，设计语义清晰。

### 5.2 Phaser

* **核心功能**：  
   Phaser 是一种更灵活的多阶段同步工具，可动态调整参与者数量，能够处理多阶段任务。
* **特点**：
  + 动态注册与注销参与者，灵活性强。
  + 支持获取当前阶段信息，并可在阶段完成时执行自定义动作。
* **使用场景**：
  + 多阶段并行任务，需要参与者数量动态变化的场景。
  + 层次化同步任务，其中某些子任务之间还需要进一步的同步。

### 5.3 Semaphore

* **核心功能**：  
   Semaphore 用于管理对有限资源的并发访问，通过许可的获取与释放控制并发数。
* **特点**：
  + 资源计数模型，允许多个线程同时访问但不超过许可数量。
  + 与 CyclicBarrier 的同步方式不同，并不强调“线程集合等待”而是控制并发度。
* **使用场景**：
  + 数据库连接池、限流器、并发访问限制等。
  + 实现有界阻塞队列，当任务数量超过一定限度时阻塞新任务。

### 5.4 CompletableFuture、Exchanger 与 AQS 自定义同步器

* **CompletableFuture**

  + 采用异步回调机制，适用于异步任务组合。
  + 通过 allOf、anyOf 等方法协调多个任务的完成状态，实现逻辑简单易读。
* **Exchanger**

  + 专门用于两个线程间的数据交换，在双缓冲等场景中非常有用。
  + 与 CyclicBarrier 的区别在于 Exchanger 专为成对的线程同步设计。
* **AQS 自定义同步器**

  + 当内置工具不能满足需求时，可以基于 AbstractQueuedSynchronizer 实现定制化同步器。
  + 灵活性极高，但需要对 AQS 内部机制有深入理解。

通过对比可以发现，各工具有各自专注的目标：

* **CyclicBarrier** 强调多线程对等等待、阶段同步和循环复用；
* **CountDownLatch** 适用于一次性等待；
* **Phaser** 提供了多阶段与动态调整参与者的灵活性；
* **Semaphore** 更侧重于资源许可的管理；
* **CompletableFuture** 则适合异步回调场景。

选择何种工具，应该遵循“最小复杂度原则”，即根据实际同步需求选择最贴切的工具。

---

## 6. 应用场景与最佳实践

CyclicBarrier 在多线程编程中有广泛的应用。以下将详细探讨典型应用场景，以及使用时的注意事项和最佳实践。

### 6.1 多阶段并行计算

**场景描述**：  
 在并行迭代算法中，每一轮迭代都需要等待各线程完成计算，并在屏障处同步，合并各线程结果，再进行下一轮计算。

**实现示例**：

```
public class ParallelCalculator {
    private final double[] data;
    private final CyclicBarrier barrier;

    public ParallelCalculator(double[] data, int numThreads) {
        this.data = data;
        // 在所有线程到达屏障后，计算全局统计数据
        barrier = new CyclicBarrier(numThreads, new Runnable() {
            @Override
            public void run() {
                // 汇总每个线程的计算结果，比如计算误差等
                // 此处可以调用汇总方法，例如 updateGlobalState();
                System.out.println("所有线程已到达屏障，执行全局合并操作");
            }
        });
    }

    public void startComputation() {
        int len = data.length;
        int chunkSize = len / barrier.getParties();
        for (int i = 0; i < barrier.getParties(); i++) {
            int start = i * chunkSize;
            int end = (i == barrier.getParties() - 1) ? len : start + chunkSize;
            new Thread(new CalculatorTask(start, end)).start();
        }
    }

    // 计算任务，每个线程计算数组中的一段数据
    class CalculatorTask implements Runnable {
        private final int start, end;
        public CalculatorTask(int start, int end) {
            this.start = start;
            this.end = end;
        }

        @Override
        public void run() {
            try {
                // 模拟每个线程做若干轮计算
                for (int round = 0; round < 5; round++) {
                    // 模拟计算: 更新局部数据，计算统计量等
                    for (int i = start; i < end; i++) {
                        data[i] = Math.sqrt(data[i]) * (round + 1);
                    }
                    System.out.println(Thread.currentThread().getName() + " 完成轮次 " + round);
                    // 等待其他线程完成当前轮计算
                    barrier.await();
                }
            } catch (InterruptedException | BrokenBarrierException e) {
                e.printStackTrace();
            }
        }
    }
}


```

**关键说明**：

* **分块计算**：将数据划分为多个块，由多个线程分别计算。
* **屏障动作**：在所有线程进入屏障时执行全局汇总操作。
* **循环等待**：每轮迭代结束后通过 CyclicBarrier 自动重置，为下一轮同步做好准备。

### 6.2 并行模拟与实时状态同步

**场景描述**：  
 在多线程模拟系统中，各个子模块（模拟对象）需要在同一时刻“醒来”同步状态。例如物理仿真、多Agent 模拟系统，每个 Agent 在每个时间步结束时等待其他 Agent 并同步状态。

**实现提示**：

* 使用 CyclicBarrier 同步各 Agent 的状态，确保所有 Agent 在同一时间进入下一步状态更新。
* 利用 barrierAction 更新系统的全局状态，比如调整环境参数，模拟下一时间步的初始状态。

### 6.3 高并发测试与启动/结束同步

**场景描述**：  
 在压力测试中，往往需要多个线程在同一时刻开始任务（比如同时发送请求），这时可以利用 CyclicBarrier 来协调线程统一启动。

**实现建议**：

* 启动前所有线程调用 await() 方法等待，在达到屏障后统一开始测试任务。
* 测试结束后也可以利用 CyclicBarrier 做统一的结束同步，便于测试结果的统一统计。

### 6.4 常见坑与解决方案

在实际使用 CyclicBarrier 时，常见问题及注意事项包括：

1. **屏障破坏（BrokenBarrierException）**

   * 发生原因：某线程中断、超时或屏障动作抛出异常。
   * 解决方案：在使用时尽量保证线程不轻易中断；设计合理的超时机制；在屏障动作中捕获并妥善处理可能的异常。
2. **超时问题**

   * 使用 await(long, TimeUnit) 需要传入合理的超时时间，防止由于某线程长时间阻塞导致整个同步失败。
   * 建议在超时前对各线程状态做监控，并考虑应用重试机制或者提前中断机制。
3. **线程安全性**

   * 保证所有涉及共享状态的操作（如数据汇总）在屏障动作中执行时线程安全。
   * 使用不变对象或额外同步机制确保数据一致性。
4. **调试复杂性**

   * 多线程同步过程中异常和中断情况较为隐蔽，建议在开发时增加详细日志，记录每个线程进入等待、退出等待、执行屏障动作等状态变化。

---

## 7. 常见问题及调试技巧

在使用 CyclicBarrier 时，若遇到问题可参考以下常见问题与调试技巧：

### 7.1 BrokenBarrierException 的常见原因

* **线程中断**：当某个线程在等待过程中被中断，其他线程将会收到 BrokenBarrierException。
* **超时**：若使用带超时的 await() 方法，部分线程超时未能在规定时间内到达，导致整个屏障破坏。
* **屏障动作异常**：在最后一个线程执行屏障动作时，如果发生异常，整个屏障将自动破坏。

**调试建议**：

* 检查是否存在非预期的线程中断；
* 调整超时设置，确保有足够时间供所有线程到达；
* 在 barrierAction 内部添加 try-catch 捕获异常，并记录详细堆栈信息。

### 7.2 超时、等待失效及安全退出策略

对于带超时的 await() 方法，需要注意：

* 设置合理的超时时间，避免因为网络延迟或复杂计算导致超时误触。
* 当超时异常触发后，应尽快中断或重置任务，防止线程无限等待。

调试建议：

* 在调用 await(timeout, unit) 前后加入日志，记录线程等待时长；
* 使用调试器单步跟踪等待线程的状态变化，分析具体超时点。

### 7.3 中断处理与线程安全问题

中断处理在多线程同步中非常重要：

* 如果线程在进入 await() 前后被中断，应尽快调用 breakBarrier()，通知其他线程退出等待。
* 保证所有共享数据在更新时线程安全，必要时采用额外锁定或同步代码块保护。

调试建议：

* 为每个线程的中断操作增加详细日志输出；
* 在开发过程中测试各种异常场景（如在等待时手动中断线程），确保系统能够正常恢复或安全退出。

---

## 8. 总结

* **核心概念**：  
   CyclicBarrier 作为一种对等等待工具，通过内部计数器和 Generation 对象实现多线程同步与循环重用，适合分阶段并行计算和多线程模拟等场景。
* **同步机制**：  
   使用 ReentrantLock 和 Condition 来保证状态修改的原子性，同时支持中断、超时和异常处理，确保了高并发环境下的安全性。
* **源码解析**：  
   详细分析了构造函数、 await() 方法、 barrierAction 的执行流程以及自动重置机制（nextGeneration）的实现，为深入理解代码设计和并发原理提供了参考。
* **对比与应用**：  
   与 CountDownLatch、Phaser、Semaphore 等工具相比，CyclicBarrier 提供了独特的线程集合等待机制；在实际应用中应结合具体需求选择合适的同步工具。

**建议**：

* 在使用 CyclicBarrier 前认真分析任务是否存在多阶段同步需求，并选择适当的工具。
* 编写详细的日志和单元测试，覆盖各种异常场景；
* 对屏障动作中可能抛出的异常做充分处理，保证系统在异常情况下一致性。

## 9. 附录

### 9.1 完整源码示例

下面是一个简化版的完整源码示例，帮助理解如何使用 CyclicBarrier 实现多阶段同步和数据汇总。

```
import java.util.concurrent.*;

public class CyclicBarrierExample {

    // 定义共享数据（模拟需要处理的数据）
    private final int[] results;
    // 定义 CyclicBarrier，构造函数中包含屏障动作
    private final CyclicBarrier barrier;

    public CyclicBarrierExample(int numThreads, int dataSize) {
        results = new int[dataSize];
        barrier = new CyclicBarrier(numThreads, new BarrierAction());
    }

    // 屏障动作：在所有线程到达屏障时执行（例如汇总部分计算结果）
    class BarrierAction implements Runnable {
        @Override
        public void run() {
            // 此处简单计算部分结果和，可以替换为更复杂的汇总逻辑
            int sum = 0;
            for (int value : results) {
                sum += value;
            }
            System.out.println("屏障触发，所有线程完成计算。当前部分结果之和为：" + sum);
        }
    }

    // 定义计算任务，每个线程负责处理数组的一部分数据
    class CalculatorTask implements Runnable {
        private final int start;
        private final int end;

        public CalculatorTask(int start, int end) {
            this.start = start;
            this.end = end;
        }

        @Override
        public void run() {
            try {
                // 模拟多轮计算任务
                for (int round = 0; round < 3; round++) {
                    for (int i = start; i < end; i++) {
                        // 模拟计算过程，赋予结果数组一个简单结果（如累加操作）
                        results[i] = (int) (Math.random() * 100);
                    }
                    System.out.println(Thread.currentThread().getName() + " 完成第 " + round + " 轮计算。");
                    // 等待其他线程完成本轮计算
                    barrier.await();
                }
            } catch (InterruptedException | BrokenBarrierException e) {
                System.err.println(Thread.currentThread().getName() + " 发生异常：" + e);
            }
        }
    }

    // 启动所有计算线程
    public void startCalculation(int numThreads) {
        int length = results.length;
        int chunk = length / numThreads;
        for (int i = 0; i < numThreads; i++) {
            int start = i * chunk;
            int end = (i == numThreads - 1) ? length : start + chunk;
            new Thread(new CalculatorTask(start, end), "计算线程-" + i).start();
        }
    }

    public static void main(String[] args) {
        // 实例化示例对象，设置参与线程数与数据数组大小
        CyclicBarrierExample example = new CyclicBarrierExample(4, 100);
        example.startCalculation(4);
    }
}


```

**说明**：

* 示例中定义了一个简单的屏障动作，用于在所有线程完成各自数据的计算后进行汇总。
* 每个线程执行若干轮计算，并在每轮结束后通过 `barrier.await()` 进行同步，确保下一轮计算前所有线程均完成了当前轮的任务。
* 完整代码中也涵盖了异常处理机制，确保在异常情况下能正确通知所有线程。

## 结语

最后，建议大家在实际开发中动手实践，通过阅读源码、调试和测试不断加深对 CyclicBarrier的理解，不断优化并发程序的设计。  
 Happy coding!
