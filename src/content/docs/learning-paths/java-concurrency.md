---
title: Java 并发编程学习路线
description: 从线程基础、内存模型到 AQS、并发容器、线程池与 Fork/Join，按前置关系串起站内全部 Java 并发笔记。
status: draft
sidebar:
  order: 2
---

## 路线说明

- **目标读者**：会写 Java，用过 `Thread` 或 `synchronized`，但说不清线程安全问题从哪来、JUC 各组件之间是什么关系的后端开发者。
- **前置知识**：Java 语法与面向对象、集合框架的基本用法、操作系统中进程与线程的基本概念。
- **完成后的预期能力**：能从可见性、原子性、有序性定位并发 Bug；能讲清 `synchronized`、CAS、AQS 三条实现路线；能为业务场景选择合适的锁、同步工具、并发容器和线程池参数。

路线共 10 个阶段，前一阶段是后一阶段的前置。每个阶段末尾的「自测」答不上来时，回到本阶段重读，不要急着往下走。标注为「补充」的文章与主读文章主题重叠，可按需跳过。

## 阶段 1：线程基础

先建立线程的直觉模型，再看 `Thread` 源码和状态流转，最后理解中断这种线程间协作方式。

1. [并发编程JUC深度学习（一）进程与线程（文字描述部分）](/knowledge/java-backend/concurrency/并发编程juc深度学习-一-进程与线程-文字描述部分/)：用类比理解进程、线程与为什么需要它们。
2. [并发编程JUC深度学习（二）进程与线程（源码描述部分）](/knowledge/java-backend/concurrency/并发编程juc深度学习-二-进程与线程-源码描述部分/)：阅读 `Thread` 的成员变量与构造方法。
3. [并发编程JUC深度学习（五）线程生命周期](/knowledge/java-backend/concurrency/并发编程juc深度学习-五-线程生命周期/)：Java 线程的 6 种状态及转换条件。
4. [线程中断如何理解](/knowledge/java-backend/concurrency/线程中断如何理解/)：中断是协作，不是强制终止。
5. [Java 线程中断机制详解](/knowledge/java-backend/concurrency/java-线程中断机制详解/)：`interrupt()`、`isInterrupted()`、`interrupted()` 与 `InterruptedException` 的正确处理。

**自测**：`BLOCKED` 和 `WAITING` 有什么区别？捕获 `InterruptedException` 后为什么通常要恢复中断状态？

## 阶段 2：共享问题与 synchronized

理解「临界区」和「竞态条件」，掌握最基础的互斥手段，以及 JVM 对 `synchronized` 的优化。

1. [并发编程JUC深度学习(三）共享模型之管程](/knowledge/java-backend/concurrency/并发编程juc深度学习-三-共享模型之管程/)：共享问题、`synchronized` 用法与变量线程安全分析。
2. [并发编程JUC深度学习(四）共享模型之管程进阶学习](/knowledge/java-backend/concurrency/并发编程juc深度学习-四-共享模型之管程进阶学习/)：轻量级锁、锁膨胀、自旋与偏向锁。

**自测**：局部变量引用的对象在什么情况下会变得线程不安全？轻量级锁在什么时候膨胀为重量级锁？

## 阶段 3：Java 内存模型

并发 Bug 的三个根源与 JMM 给出的解决方案，是后面所有内容的理论基础。

1. [并发编程JUC深度学习(六）内存模型_1](/knowledge/java-backend/concurrency/并发编程juc深度学习-六-内存模型-1/)：缓存导致可见性、线程切换导致原子性、编译优化导致有序性问题。
2. [并发编程JUC深度学习(六）内存模型_2](/knowledge/java-backend/concurrency/并发编程juc深度学习-六-内存模型-2/)：`volatile`、Happens-Before 规则与 `final`。

**自测**：`volatile` 能保证 `count++` 的线程安全吗？为什么？双重检查单例中 `volatile` 防止的是什么？

## 阶段 4：无锁与 CAS

`synchronized` 之外的第二条路线：乐观锁。CAS 也是 AQS、原子类和大部分并发容器的底层原语。

1. [并发编程JUC深度学习(七）无锁（乐观锁）](/knowledge/java-backend/concurrency/并发编程juc深度学习-七-无锁-乐观锁/)：版本号机制、CAS 与原子类家族。

**自测**：ABA 问题是什么，`AtomicStampedReference` 如何解决？CAS 自旋在什么场景下反而比加锁更慢？

## 阶段 5：Lock 体系与 AQS

本路线的核心阶段。先看全景图，再自底向上：`LockSupport` → AQS → `Lock` 接口 → 具体锁 → `Condition`。

1. [JUC-锁体系](/knowledge/java-backend/concurrency/juc-锁体系/)：先读这篇全景图，弄清各组件的层次关系。
2. [LockSupport 深度解析](/knowledge/java-backend/concurrency/locksupport-深度解析/)：`park` / `unpark` 与许可证机制，AQS 阻塞线程的地基。
3. [并发编程JUC深度学习(八）AbstractQueuedSynchronizer源码级解析](/knowledge/java-backend/concurrency/并发编程juc深度学习-八-abstractqueuedsynchronizer源码级解析/)：`state`、CLH 队列与独占/共享获取流程。
4. [Java Lock 深度解析](/knowledge/java-backend/concurrency/java-lock-深度解析/)：`Lock` 接口设计及其与 `synchronized` 的对比。
5. [深入学习ReentrantLock](/knowledge/java-backend/concurrency/深入学习reentrantlock/)：可重入、公平与非公平锁的完整讲解。
6. [并发编程JUC深度学习(九）ReentrantLock源码解析](/knowledge/java-backend/concurrency/并发编程juc深度学习-九-reentrantlock源码解析/)：补充，偏源码视角的短篇。
7. [深入理解Condition接口](/knowledge/java-backend/concurrency/深入理解condition接口/)：`await` / `signal` 与等待队列。
8. [JUC-Condition](/knowledge/java-backend/concurrency/juc-condition/)：补充，问答形式梳理条件队列与同步队列的区别。
9. [深度学习ReentrantReadWriteLock](/knowledge/java-backend/concurrency/深度学习reentrantreadwritelock/)：读写分离、锁降级与 `state` 高低位拆分。

**自测**：非公平锁「不公平」在哪一步？`await()` 被唤醒后，线程要经过哪两个队列才能继续执行？为什么读写锁不支持锁升级？

## 阶段 6：同步工具与线程隔离

基于 AQS 或 `Lock` + `Condition` 构建的协作工具。重点比较它们各自解决什么协作问题。

1. [JUC工具类-CountDownLatch](/knowledge/java-backend/concurrency/juc工具类-countdownlatch/)：一个或多个线程等待其他线程完成。
2. [JUC工具类-CyclicBarrier](/knowledge/java-backend/concurrency/juc工具类-cyclicbarrier/)：一组线程互相等待，可循环使用。
3. [JUC工具类-Semaphore](/knowledge/java-backend/concurrency/juc工具类-semaphore/)：限制同时访问资源的线程数。
4. [并发编程JUC深度学习(十）Semaphore源码解析](/knowledge/java-backend/concurrency/并发编程juc深度学习-十-semaphore源码解析/)：补充，AQS 共享模式的源码视角。
5. [JUC工具类-Phaser](/knowledge/java-backend/concurrency/juc工具类-phaser/)：可动态注册、多阶段的同步屏障。
6. [JUC工具类-Exchanger](/knowledge/java-backend/concurrency/juc工具类-exchanger/)：两个线程之间交换数据。
7. [JUC工具类-ThreadLocal](/knowledge/java-backend/concurrency/juc工具类-threadlocal/)：换个思路，用线程隔离代替同步，以及 `ThreadLocalMap` 的内存泄漏问题。

**自测**：`CountDownLatch` 和 `CyclicBarrier` 的底层实现有什么不同？线程池场景下使用 `ThreadLocal` 要注意什么？

## 阶段 7：并发容器与阻塞队列

先分清普通容器、同步容器与并发容器，再按 List → Map → Queue 的顺序阅读。

1. [并发容器（一）：普通容器&&同步容器&&并发容器](/knowledge/java-backend/concurrency/并发容器-一-普通容器-and-同步容器-and-并发容器/)：建立分类框架。
2. [JUC集合-CopyOnWriteArrayList](/knowledge/java-backend/concurrency/juc集合-copyonwritearraylist/)：写时复制与弱一致性迭代器。
3. [JUC并发集合-ConcurrentHashMap](/knowledge/java-backend/concurrency/juc并发集合-concurrenthashmap/)：JDK 1.7 与 1.8 的实现对比，CAS + `synchronized`。
4. [并发容器（二）：Concurrent类下的ConcurrentHashMap源码级解析](/knowledge/java-backend/concurrency/并发容器-二-concurrent类下的concurrenthashmap源码级解析/)：补充，初始化、`put` 与扩容源码。
5. [JUC并发集合-ConcurrentSkipListMap](/knowledge/java-backend/concurrency/juc并发集合-concurrentskiplistmap/)：基于跳表的有序并发 Map。
6. [JUC并发集合-ConcurrentLinkedQueue](/knowledge/java-backend/concurrency/juc并发集合-concurrentlinkedqueue/)：无锁非阻塞队列。
7. [阻塞队列-BlockingQueue](/knowledge/java-backend/concurrency/阻塞队列-blockingqueue/)：阻塞队列接口与各实现类对比，生产者-消费者模型。
8. [阻塞队列-ArrayBlockingQueue](/knowledge/java-backend/concurrency/阻塞队列-arrayblockingqueue/)：有界数组队列的单锁 + 双 `Condition` 实现。

**自测**：`ConcurrentHashMap` 1.8 为什么放弃分段锁？`ArrayBlockingQueue` 和 `LinkedBlockingQueue` 的锁设计有何不同？

## 阶段 8：线程池与异步编程

把前面的阻塞队列、AQS、CAS 组合起来，就是线程池。再往上是异步结果与任务编排。

1. [JUC线程池-ThreadPoolExecutor](/knowledge/java-backend/concurrency/juc线程池-threadpoolexecutor/)：核心参数、任务提交流程、拒绝策略与参数调优。
2. [JUC线程池-FutureTask](/knowledge/java-backend/concurrency/juc线程池-futuretask/)：异步结果的状态机实现。
3. [JUC线程池-ScheduledThreadPoolExecutor](/knowledge/java-backend/concurrency/juc线程池-scheduledthreadpoolexecutor/)：延迟与周期任务，`DelayedWorkQueue`。
4. [JUC- CompletableFuture](/knowledge/java-backend/concurrency/juc-completablefuture/)：回调、组合多个异步任务与异常处理。

**自测**：核心线程数满了以后，新任务是先进队列还是先创建非核心线程？`CompletableFuture` 默认使用哪个线程池，生产环境为什么要自定义？

## 阶段 9：Fork/Join 并行计算

面向可递归拆分任务的另一种线程池模型：分治与工作窃取。

1. [JUC并发集合-Java Fork/Join](/knowledge/java-backend/concurrency/juc并发集合-java-fork-join/)：框架全景，篇幅较长，可先读基础概念与核心组件。
2. [Fork/Join - ForkJoinTask](/knowledge/java-backend/concurrency/fork-join-forkjointask/)：`fork` / `join` 与 `RecursiveTask`、`RecursiveAction`。
3. [JUC线程池- ForkJoinPool](/knowledge/java-backend/concurrency/juc线程池-forkjoinpool/)：工作窃取与双端队列。

**自测**：工作窃取为什么从队列另一端偷任务？什么样的任务不适合交给 `ForkJoinPool`？

## 阶段 10：工程实践与复习

把并发知识放回真实系统，最后用面试题检验整体掌握程度。

1. [缓存并发更新的挑战](/knowledge/java-backend/concurrency/缓存并发更新的挑战/)：多进程场景下的丢失更新、写偏斜与缓存一致性方案。
2. [并发编程-基础八股](/knowledge/java-backend/concurrency/并发编程-基础八股/)：作为总复习清单，逐题检查能否用前面阶段的知识作答。

**自测**：单机的 `synchronized` 为什么解决不了多实例部署下的缓存并发更新？
