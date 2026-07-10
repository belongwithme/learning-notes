---
title: "JUC-锁体系"
description: "Java并发锁机制可以理解为一个分层的知识体系："
sourceId: "146222694"
source: "https://blog.csdn.net/qq_45852626/article/details/146222694"
sourceSeries:
  - "JUC"
category: java-backend
tags:
  - "JUC"
  - "SQL"
status: draft
difficulty: intermediate
contentType: knowledge
sidebar:
  order: 146222694
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/146222694)（历史文章导入，当前状态为草稿）

## 整体架构

Java并发锁机制可以理解为一个分层的知识体系：

1. 底层基础设施：LockSupport（线程阻塞/唤醒的基础工具）
2. 核心框架：AQS（AbstractQueuedSynchronizer，队列同步器）
3. 接口规范：Lock接口（定义锁的标准行为）
4. 具体实现：ReentrantLock、ReentrantReadWriteLock等
5. 辅助机制：Condition（条件变量，实现线程等待/通知）  
    这就像是一座大楼的结构：LockSupport是地基，AQS是框架，Lock是设计标准，具体锁实现是不同的房间，Condition是房间内的功能设施。

## 各组件关系与作用

### LockSupport - 地基

LockSupport就像是线程的"停车场"，提供了最基本的线程阻塞和唤醒功能：  
 park()：让线程停下来（阻塞）  
 unpark(Thread t)：让指定线程继续运行  
 特点：

* 不需要获取锁就能操作
* 可以精确控制要唤醒哪个线程
* 支持先唤醒后阻塞的操作顺序

### AQS - 框架

AQS是整个并发包的核心框架，就像是一个"排队系统"：  
 维护一个state变量表示同步状态  
 管理线程等待队列，决定哪些线程应该阻塞，哪些可以运行  
 提供独占模式和共享模式两种工作方式  
 AQS通过模板方法模式，让子类只需实现少量方法就能定义自己的同步器。它就像是一个"半成品工厂"，提供了制造各种锁的通用部件。

### Lock接口 - 设计标准

Lock接口定义了锁应该具有的标准行为，比synchronized更加灵活：  
 lock()：获取锁  
 unlock()：释放锁  
 tryLock()：尝试获取锁但不阻塞  
 newCondition()：创建条件变量  
 Lock接口就像是一份"产品规范"，告诉我们一个锁应该提供哪些功能。

### 具体锁实现 - 房间

#### ReentrantLock - 标准房间

ReentrantLock是Lock接口最常用的实现，提供了可重入的互斥锁：

* 同一时刻只允许一个线程获取锁
* 支持公平锁和非公平锁
* 允许同一线程多次获取锁（可重入）  
   提供了丰富的获取锁的方式（可中断、超时等）

#### ReentrantReadWriteLock - 特殊房间

ReentrantReadWriteLock提供了读写分离的锁机制：

* 读锁：共享锁，多个线程可以同时获取
* 写锁：独占锁，获取后会阻塞所有其他线程  
   适合"读多写少"的场景，提高并发性能

### Condition - 房间内设施

Condition提供了线程等待/通知的机制，类似于Object的wait/notify：  
 await()：释放锁并等待条件满足  
 signal()：唤醒一个等待的线程  
 signalAll()：唤醒所有等待的线程  
 Condition必须与Lock配合使用，一个Lock可以创建多个Condition，实现更精细的线程控制。

## 工作流程举例

以ReentrantLock为例，当我们使用它时，背后发生了什么：  
 创建ReentrantLock时，内部会创建一个基于AQS的同步器  
 调用lock()时，尝试通过CAS设置AQS的state变量  
 如果获取锁失败，AQS会创建一个节点加入等待队列，并通过LockSupport.park()阻塞当前线程  
 调用unlock()时，AQS会更新state状态，并通过LockSupport.unpark()唤醒队列中的下一个线程  
 如果使用Condition，调用await()会释放锁并将线程加入条件队列；调用signal()会将线程从条件队列转移到同步队列

## 如何选择使用

简单场景：使用synchronized（JVM内置，使用简单）  
 需要高级特性：使用ReentrantLock（可中断、超时、公平性等）  
 读多写少场景：使用ReentrantReadWriteLock（提高读操作并发性）  
 需要精细控制线程：使用Lock+多个Condition（实现复杂的线程协作）

## 个人理解

在我看来，Java并发锁机制是一个层次分明的体系，从底层到高层形成了一个完整的并发控制解决方案。

### 底层基础：LockSupport

LockSupport是整个并发体系的基石，它提供了线程的基本阻塞和唤醒操作。我认为它最精妙的设计在于许可机制 - 每个线程关联一个许可，park消费许可，unpark提供许可。这种设计允许先unpark后park的操作顺序，避免了传统wait/notify中可能出现的信号丢失问题。  
 LockSupport使用底层的Unsafe类直接操作线程状态，比wait/notify更加灵活，不需要获取监视器锁就能操作，这为构建高级同步工具提供了基础。

### 核心框架：AQS

AbstractQueuedSynchronizer是我认为Java并发包中最精妙的设计。它通过一个volatile的int类型state变量和一个FIFO的等待队列，实现了各种同步器的基础框架。  
 AQS的核心思想是"状态管理+等待队列"，它采用模板方法设计模式，将复杂的线程排队、阻塞和唤醒等操作封装起来，子类只需要实现少量方法定义自己的同步语义。这种设计实现了框架与具体实现的完美分离，大大简化了并发工具的开发。  
 AQS支持独占模式和共享模式，这使得它能够适应各种同步需求，从互斥锁到信号量，从读写锁到倒计时器，都能基于AQS实现。

### 接口规范：Lock

Lock接口定义了锁的标准行为，相比synchronized提供了更丰富的功能。我认为Lock接口最大的价值在于它将锁的获取与释放操作显式化，并提供了更多的控制选项，如非阻塞尝试(tryLock)、可中断获取、超时获取等。  
 Lock接口还定义了newCondition方法，将锁与条件变量关联起来，这为实现复杂的线程协作提供了可能。

### 具体实现：ReentrantLock和ReentrantReadWriteLock

ReentrantLock是Lock接口的标准实现，它支持可重入性、公平性选择和锁获取的多种方式。内部通过继承AQS实现，state表示锁的重入次数。  
 ReentrantReadWriteLock则更进一步，通过读写分离的设计提高了并发性能。它巧妙地将AQS的state变量拆分为高16位表示读锁计数，低16位表示写锁重入次数，实现了一个state变量管理两种锁的状态。这种设计在读多写少的场景下能显著提高性能。

### 条件变量：Condition

Condition接口提供了类似Object的wait/notify的线程等待/通知机制，但更加灵活。它允许一个Lock创建多个条件变量，实现更精细的线程控制。  
 Condition的实现（ConditionObject）是AQS的内部类，它维护了一个单独的条件等待队列。当线程调用await时，会从同步队列转移到条件队列；当调用signal时，又会从条件队列转移回同步队列。这种双队列设计使得线程能够在不同的等待状态之间转换。

### 整体理解

我认为Java并发锁机制的精髓在于它的分层设计和关注点分离。LockSupport提供基础设施，AQS提供框架，Lock定义接口，具体锁实现提供不同的同步语义，Condition提供线程协作机制。  
 这种设计既保证了高度的代码复用，又提供了极大的灵活性。通过组合这些组件，我们可以实现从简单的互斥锁到复杂的读写分离、从基本的线程同步到精细的条件等待，满足各种并发场景的需求。  
 在实际应用中，我会根据具体场景选择合适的工具：  
 简单场景用synchronized，需要高级特性时用ReentrantLock，读多写少场景用ReentrantReadWriteLock，需要精细控制线程时用Lock+多个Condition。  
 这种灵活选择的能力，正是对Java并发锁机制深入理解的体现。
