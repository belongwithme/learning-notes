---
title: "JUC工具类-Semaphore"
description: "你正在管理一个停车场，这个停车场只有 10 个停车位。同一时间，可能有几十辆甚至上百辆车想要进入停车场。"
sourceId: "147242254"
source: "https://blog.csdn.net/qq_45852626/article/details/147242254"
sourceSeries:
  - "JUC"
category: java-backend
tags:
  - "JUC"
status: draft
difficulty: intermediate
contentType: knowledge
sidebar:
  order: 147242254
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/147242254)（历史文章导入，当前状态为草稿）

### 0. 前言：为什么需要 Semaphore？

你正在管理一个停车场，这个停车场只有 10 个停车位。同一时间，可能有几十辆甚至上百辆车想要进入停车场。  
 作为管理员，你不能让所有的车都挤进来，因为车位是有限的。  
 你需要一个机制来控制：最多只允许 10 辆车同时停放。当有车离开时，你才能允许下一辆车进入。

在开发中，我们经常遇到类似的情况。系统中的某些资源是有限的，比如：

* **数据库连接**：数据库通常有最大连接数限制。
* **文件句柄**：操作系统允许一个进程打开的文件数量是有限的。
* **网络带宽**：同时处理的网络请求过多可能会耗尽带宽。
* **昂贵的计算资源**：某些计算任务非常耗时耗力，我们可能需要限制同时执行的任务数量。

如果不对这些有限资源的访问进行控制，大量并发请求可能会瞬间耗尽资源，导致系统响应缓慢甚至崩溃。我们需要一种“流量控制阀”或者“资源管理员”来确保系统稳定运行。

Java 并发包（`java.util.concurrent`，简称 JUC）为我们提供了丰富的并发工具，其中 `Semaphore`（信号量）正是解决这类问题的利器。它就像我们前面提到的停车场管理员，可以精确地控制同时访问特定资源的线程数量。

**你将学到：**

* Semaphore 的核心概念和工作原理。
* Semaphore 与其他 JUC 同步工具（如 `ReentrantLock`, `CountDownLatch`）的区别。
* 公平与非公平 Semaphore 的差异和选择。
* Semaphore 在资源池、限流等场景的实际应用。
* Semaphore 核心源码分析（基于 AQS）。
* Semaphore 的进阶用法和注意事项（死锁、性能）。
* 如何设计基于 Semaphore 的连接池。
* Semaphore 在分布式环境下的局限性。

### 1. 基础概念

#### 1.1 什么是 Semaphore？它在 JUC 包中的作用是什么？

`Semaphore` 是 `java.util.concurrent` 包下的一个同步辅助类，可以翻译为“信号量”。  
 它的核心作用是 **控制同时访问特定资源的线程数量**。

你可以把 Semaphore 想象成一个持有固定数量“许可证”（Permits）的实体。

* **获取许可证 (`acquire()`)**: 线程想要访问受限资源，必须先向 Semaphore 申请一个许可证。
  + 如果 Semaphore 有可用的许可证，线程就能成功获取，并且 Semaphore 持有的许可证数量减一。然后线程可以继续执行其访问资源的操作。
  + 如果 Semaphore 没有可用的许可证，那么申请许可证的线程就会被 **阻塞**，进入等待状态，直到有其他线程释放了许可证。
* **释放许可证 (`release()`)**: 当线程访问完资源后，必须调用 `release()` 方法将许可证归还给 Semaphore。Semaphore 持有的许可证数量会加一。如果有其他线程正在等待许可证，那么这个释放操作可能会唤醒一个等待中的线程。

通过这种“获取-释放”的机制，Semaphore 确保了在任何时刻，最多只有 N 个线程（N 等于 Semaphore 初始化时的许可证数量）能够同时访问被它保护的资源。

**核心作用总结：**

Semaphore 在 JUC 中扮演着 **并发流量控制器** 的角色。它主要用于：

1. **限制并发数**：确保访问某个共享资源的线程不超过设定的阈值。
2. **资源池管理**：管理有限的资源，如数据库连接池、线程池等。

---

**💡 通俗理解（个人理解版）**

在我看来，Semaphore 就像一个 **带有计数器的门禁系统**。这个门禁系统被设置了一个最大容量（比如 5）。

* 每个想通过门禁的人（线程）都需要刷卡（`acquire()`）。
* 如果当前通过门禁的人数还没达到 5，刷卡成功，计数器加 1，人可以通过。
* 如果当前已经有 5 个人在里面了，后面想刷卡的人就得在门口排队等着（阻塞）。
* 当里面有人出来时，他需要再次刷卡（`release()`），计数器减 1。这时，门禁系统会通知排在最前面的人（唤醒等待线程），让他可以刷卡进入。

这个门禁系统（Semaphore）并不关心进去的人具体是谁，也不关心他们在里面做什么，它只关心 **当前有多少个人在里面**，确保这个数量不超过设定的最大容量 5。  
 这对于管理那些数量有限但可以被多个线程同时使用的资源（比如多个数据库连接、多个处理线程）非常有用。  
 现代系统往往有各种性能瓶颈点，比如数据库连接数、文件句柄数等都是有限的。  
 Semaphore 恰好能够优雅地解决这类问题，它允许我们精确控制并发量，避免系统因资源耗尽而崩溃。

---

#### 1.2 Semaphore 与 ReentrantLock、CountDownLatch 有什么区别？

JUC 包提供了多种同步工具，有人可能会混淆 Semaphore、ReentrantLock 和 CountDownLatch。它们确实都能实现线程间的同步，但侧重点和应用场景完全不同。

| 特性 | Semaphore | ReentrantLock | CountDownLatch |
| --- | --- | --- | --- |
| **核心功能** | 控制并发线程的数量 | 实现线程间的互斥访问（独占锁） | 等待 N 个线程完成某项操作 |
| **访问模式** | 允许多个线程同时访问（数量受限） | 同一时间只允许一个线程访问（独占） | 一次性屏障，用于线程协作 |
| **许可证/锁** | 管理多个许可证 (Permits) | 管理一个锁 | 管理一个计数器，减到 0 时触发 |
| **可重用性** | 可重复使用 (acquire/release循环) | 可重复使用 (lock/unlock循环) | 不可重用 (计数器减到0后失效) |
| **典型场景** | 资源池、限流、并发任务数控制 | 保护临界区、保证数据一致性 | 启动多个线程执行任务，主线程等待结果 |

**详细对比：**

1. **Semaphore vs ReentrantLock**:

   * **目标不同**: `ReentrantLock` 是一个 **互斥锁 (Exclusive Lock)**，它的目标是确保 **同一时刻只有一个线程** 能访问被保护的代码块或资源。它强调的是“互斥性”。而 `Semaphore` 允许多个线程 **同时** 访问资源，但会限制这个“同时”的数量。它强调的是“并发量控制”。
   * **锁 vs 许可证**: `ReentrantLock` 只有一个锁，要么被某个线程持有，要么未被持有。`Semaphore` 管理一组许可证，可以有多个线程同时持有许可证（只要总数不超过限制）。
   * **场景**: 如果你需要保护一个共享变量，一次只允许一个线程修改它，用 `ReentrantLock`。如果你有一个资源池（比如数据库连接），允许多个线程同时使用连接，但要限制总连接数，用 `Semaphore`。
2. **Semaphore vs CountDownLatch**:

   * **目标不同**: `CountDownLatch` 像一个 **倒计时门闩**。它让一个或多个线程等待，直到其他 N 个线程完成各自的操作后才能继续执行。它的核心是“等待多个事件完成”。`Semaphore` 的核心是“限制并发访问数量”。
   * **可重用性**: `CountDownLatch` 的计数器只能被减一次，减到 0 后就不能重置或重复使用了（是一次性的）。而 `Semaphore` 的许可证可以被反复获取和释放。
   * **场景**: 如果你需要等多个初始化任务完成后再启动主服务，用 `CountDownLatch`。如果你需要限制同时下载文件的线程数，用 `Semaphore`。

---

**💡 通俗理解（个人理解版）**

这三个工具就像交通管制中的不同设施：

* \*\*`ReentrantLock` 就像一个 **收费站的单一ETC通道**。一次只能过一辆车，保证了通道内资源（比如收费系统）的独占使用，防止混乱。适用于需要严格独占访问的场景。
* \*\*`CountDownLatch` 就像 **运动会的起跑发令枪**。裁判（主线程）需要等待所有选手（子线程）都到达起跑线并准备就绪（执行 `countDown()`），然后才能发令（`await()` 结束，主线程继续），让大家一起开始比赛。适用于需要等待多个前提条件达成后再继续的场景。
* \*\*`Semaphore` 则像是 **一个有多条车道的收费停车场入口**。它允许一定数量的车（比如 5 辆）同时进入停车场（访问资源），但超过这个数量的车就得排队等待。它控制的是进入停车场的“流量”，而不是具体的车道。适用于需要限制并发数量但允许多个线程同时进行的场景。

选择哪个工具取决于你的具体需求：是要独占访问，还是要等待多个事件，还是要控制并发数量？

---

#### 1.3 信号量的核心特性是什么？公平模式和非公平模式有何区别？

**Semaphore 的核心特性：**

1. **计数器（Permits）**: Semaphore 内部维护一个计数器，表示当前可用的许可证数量。
2. **并发控制**: 通过 `acquire()` 控制能够继续执行的线程数不超过许可证总数。
3. **阻塞与唤醒**: 当许可证数量为 0 时，尝试 `acquire()` 的线程会被阻塞；当有线程 `release()` 许可证时，会唤醒等待队列中的线程。
4. **可获取/释放多个许可**: `acquire(int n)` 和 `release(int n)` 允许一次性获取或释放多个许可证。
5. **可中断获取**: `acquireInterruptibly()` 允许在等待许可证的过程中响应中断。
6. **尝试获取**: `tryAcquire()` 和 `tryAcquire(long timeout, TimeUnit unit)` 提供非阻塞或带超时的获取尝试，避免无限等待。
7. **公平性选择**: 可以在构造时选择公平模式或非公平模式。

**公平模式 vs 非公平模式：**

这是 Semaphore 一个非常重要的特性，直接影响线程获取许可证的行为和系统性能。

* **公平模式 (Fair Mode)**:

  + **行为**: 遵循 **先来先服务 (FIFO, First-In-First-Out)** 原则。当一个线程尝试获取许可证时，如果当前没有可用的许可证，或者 **即使有可用许可证，但等待队列中已经有其他线程在等待**，那么该线程也会被加入等待队列的末尾。只有当它是队列头部并且有可用许可证时，才能获取成功。
  + **创建**: `new Semaphore(int permits, boolean fair)` 构造函数的第二个参数 `fair` 设置为 `true`。
  + **优点**: 保证了等待时间最长的线程会优先获得许可证，避免了“线程饥饿”（某些线程一直获取不到许可证）现象。
  + **缺点**: 为了维护 FIFO 顺序，需要进行更多的检查和可能的上下文切换，通常 **性能较低**。
* **非公平模式 (Non-Fair Mode)**:

  + **行为**: **不保证** FIFO 顺序。当一个线程尝试获取许可证时，它会 **首先尝试直接获取**，不管等待队列中是否已有其他线程。只有当它尝试失败（比如许可证刚好被其他线程获取，或者数量不足）时，才会被加入等待队列。当许可证被释放时，系统 **允许** 新来的线程“插队”，直接抢占这个刚被释放的许可证，即使队列中有线程正在等待。
  + **创建**: 默认构造函数 `new Semaphore(int permits)` 或 `fair` 参数为 `false`。
  + **优点**: 减少了线程挂起和唤醒的开销，因为线程有机会直接获取许可证而无需进入等待队列。通常 **吞吐量更高**，性能更好。
  + **缺点**: 可能导致等待队列中的线程等待更长时间，甚至出现 **线程饥饿**。

**如何选择？**

* **默认推荐非公平模式**: 因为其性能通常更好，适用于大多数追求高吞吐量的场景。
* **使用公平模式**: 如果你的业务场景 **严格要求** 请求按顺序处理，或者需要 **避免线程饥饿** 问题，那么应该选择公平模式，不过会牺牲一些性能。

---

**💡 通俗理解（个人理解版）**

想象一下在银行排队办理业务：

* **公平模式**：就像银行取号排队。严格按照取的号码顺序叫号，先来的人先办理。即使 5 号窗口刚空出来，如果你是 10 号，但前面 9 号还在等着，你也必须等 9 号办完才能去 5 号窗口。这很公平，但如果 9 号反应慢或者系统调度需要时间，5 号窗口可能会空闲一小会儿，效率不是最高。
* **非公平模式**：就像没取号系统，大家都在窗口前等着。某个窗口一空出来，谁离得最近、反应最快（或者说运气好，刚好在那一刻尝试），谁就可能抢先一步去办理，即使旁边有人已经等了很久。这样窗口基本不会空闲，整体办理速度（吞吐量）可能更快，但对排在后面或反应慢的人不太公平，可能要等很久。

关于公平性，我认为这是一个典型的 **性能与公平性的权衡** 问题：

* 非公平模式（默认）下系统吞吐量更高，因为它减少了线程排队和上下文切换的开销。新来的线程可能直接获取许可就走了，都不需要进入等待队列。
* 但在某些要求请求按序处理的业务场景中，比如订单处理系统，你可能不希望后来的订单插队先处理。这时公平模式就能避免某些线程长时间等待的"饥饿"现象。

除非有特别强的理由需要保证顺序或公平性，否则 **优先使用默认的非公平模式**。在高并发系统中，非公平模式的性能优势往往更加明显。

**使用 Semaphore 的两个关键提醒：**

1. **正确设置初始许可证数量 (permits)**: 这个值需要根据你的资源限制和性能需求仔细权衡。太小会限制并发度，影响吞吐量；太大则可能失去保护作用，导致资源耗尽。
2. **务必在 `finally` 块中释放许可证 (`release()`)**: 这是极其重要的一点！如果在获取许可证后、释放许可证前的代码块中发生异常，而没有在 `finally` 中确保 `release()` 被调用，那么这个许可证就 **永久丢失** 了（称为“许可证泄漏”）。这会导致可用的许可证越来越少，最终可能导致所有线程都阻塞。

```
Semaphore semaphore = new Semaphore(3);
Connection connection = null;
try {
    semaphore.acquire(); // 获取许可
    System.out.println(Thread.currentThread().getName() + " 获取数据库连接...");
    // connection = ... 从池中获取连接 ...
    // 使用 connection 进行数据库操作
    // ...
    // 模拟操作中可能发生异常
    if (System.currentTimeMillis() % 2 == 0) {
        // throw new RuntimeException("模拟数据库操作异常");
    }
    System.out.println(Thread.currentThread().getName() + " 操作完成，准备释放连接...");

} catch (InterruptedException e) {
    Thread.currentThread().interrupt(); // 重新设置中断状态
    System.err.println(Thread.currentThread().getName() + " 在等待许可时被中断");
} catch (Exception e) {
    System.err.println(Thread.currentThread().getName() + " 发生异常: " + e.getMessage());
    // 处理业务异常
} finally {
    // 无论是否发生异常，只要成功获取了许可，就必须释放
    // 注意：这里仅作演示，实际连接池释放连接和释放许可应绑定
    if (connection != null) {
        // ... 关闭或归还 connection 到池中 ...
    }
    System.out.println(Thread.currentThread().getName() + " 释放信号量许可...");
    semaphore.release(); // 确保释放许可
}


```

这个 `finally` 块是保证 Semaphore 可用性的生命线。

---

### 2. 实际应用

#### 2.1 你能描述一个使用 Semaphore 解决的实际问题吗? (数据库连接池示例)

最经典、也最常见的 Semaphore 应用场景之一就是 **资源池管理**，特别是 **数据库连接池**。

**问题背景：**

现代 Web 应用通常需要与数据库交互。建立数据库连接是一个相对耗时的操作（涉及网络通信、认证等）。为了提高性能，应用程序通常会维护一个“数据库连接池”。应用启动时，预先创建一定数量的数据库连接放入池中。当需要访问数据库时，线程直接从池中获取一个可用连接，用完后再归还到池中，而不是每次都创建新连接。

但是，数据库服务器能够处理的并发连接数是有限的（例如，MySQL 默认最大连接数可能是 151）。如果应用程序创建的连接数超过数据库的处理能力，或者瞬时有大量线程同时请求连接，可能会导致：

1. 应用程序端无连接可用，请求处理阻塞或失败。
2. 数据库服务器负载过高，响应缓慢，甚至崩溃。

**解决方案：使用 Semaphore 控制并发连接数**

我们可以使用 `Semaphore` 来限制 **同时** 从连接池中获取连接的线程数量，使其不超过数据库允许的最大并发连接数或一个我们设定的合理阈值。

**实现思路：**

1. **初始化 Semaphore**: 创建一个 `Semaphore` 实例，其许可证数量 (permits) 设置为连接池允许的最大并发使用数（比如 10）。这个值应该小于等于数据库的最大连接数。

   ```
   int maxConcurrentUsers = 10; // 允许同时最多10个线程使用连接
   Semaphore connectionPermits = new Semaphore(maxConcurrentUsers, true); // 使用公平模式


   ```

   这里我们选择了公平模式，希望等待连接的线程能按顺序获取。
2. **获取连接 (`getConnection`)**: 线程在从连接池获取连接之前，必须先调用 `connectionPermits.acquire()` 获取一个许可证。

   ```
   public Connection getConnection() throws InterruptedException {
       connectionPermits.acquire(); // 获取许可，如果没许可会阻塞
       System.out.println(Thread.currentThread().getName() + " 成功获取信号量许可，准备获取连接...");
       Connection conn = null;
       try {
           // 从底层连接池获取一个连接 (假设 pool 是实际存储连接的集合)
           conn = pool.poll(); // 假设从队列取
           if (conn == null) {
               // 理论上 acquire 成功后，池中应该有连接，但要考虑健壮性
               // 或者这里应该是创建连接的逻辑，如果池是动态的话
               System.err.println("警告：获取许可后，连接池为空？");
               // 简单处理：释放许可后抛异常或返回 null
               connectionPermits.release();
               return null;
           }
           System.out.println(Thread.currentThread().getName() + " 成功获取数据库连接: " + conn);
           return conn;
       } catch (Exception e) {
           // 如果在获取连接过程中（acquire之后，返回之前）发生异常
           // 需要释放掉已经获取的许可！
           connectionPermits.release();
           System.err.println(Thread.currentThread().getName() + " 获取连接时异常，已释放许可");
           throw e; // 或进行其他异常处理
       }
   }


   ```
3. **释放连接 (`releaseConnection`)**: 线程使用完数据库连接后，在将连接归还给池的同时，必须调用 `connectionPermits.release()` 释放许可证。

   ```
   public void releaseConnection(Connection conn) {
       if (conn != null) {
           System.out.println(Thread.currentThread().getName() + " 准备归还数据库连接: " + conn);
           // 将连接放回底层连接池
           pool.offer(conn); // 假设放回队列
           System.out.println(Thread.currentThread().getName() + " 连接已归还，准备释放信号量许可...");
           connectionPermits.release(); // 释放许可
       }
   }


   ```

**效果：**

通过这种方式，`Semaphore` 保证了在任何时刻，最多只有 `maxConcurrentUsers` 个线程能够持有数据库连接。即使有 100 个线程同时请求连接，`Semaphore` 也会阻塞掉第 11 个及之后的线程，直到有线程释放连接和许可证。这有效防止了应用程序耗尽数据库连接资源，保护了数据库服务器的稳定性。

**简化版连接池示例代码:**

```
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.LinkedList;
import java.util.Queue;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

class SimpleDbConnectionPool {
    private final Queue<Connection> pool = new LinkedList<>();
    private final int poolSize;
    private final Semaphore semaphore;
    private final String dbUrl;
    private final String dbUser;
    private final String dbPassword;

    public SimpleDbConnectionPool(int poolSize, String url, String user, String password) throws SQLException {
        this.poolSize = poolSize;
        this.semaphore = new Semaphore(poolSize, true); // 公平模式
        this.dbUrl = url;
        this.dbUser = user;
        this.dbPassword = password;

        // 初始化连接池
        for (int i = 0; i < poolSize; i++) {
            pool.offer(createConnection());
        }
        System.out.println("数据库连接池初始化完成，大小：" + poolSize);
    }

    private Connection createConnection() throws SQLException {
        return DriverManager.getConnection(dbUrl, dbUser, dbPassword);
    }

    public Connection getConnection(long timeoutMillis) throws InterruptedException, SQLException {
        // 尝试获取信号量许可，带超时
        if (semaphore.tryAcquire(timeoutMillis, TimeUnit.MILLISECONDS)) {
            System.out.println(Thread.currentThread().getName() + " 获取信号量许可成功.");
            Connection conn = null;
            try {
                // 从池中获取连接
                // 注意：这里需要同步保护 pool 的访问，因为 LinkedList 非线程安全
                // 更好的做法是用 ConcurrentLinkedQueue
                synchronized (pool) {
                    conn = pool.poll();
                }

                // 如果池暂时为空（可能在高并发下发生，即使 acquire 成功），尝试创建新连接？
                // 或者认为 acquire 成功就一定有连接（如果初始满且归还正确）
                if (conn == null) {
                     // 这种情况理论上不应发生，除非初始化失败或有bug
                     System.err.println(Thread.currentThread().getName() + " 获取许可后但连接池为空!");
                     semaphore.release(); // 释放许可
                     throw new SQLException("无法从池中获取连接");
                }

                 // 校验连接是否有效 (可选)
                if (!conn.isValid(1)) {
                     System.out.println(Thread.currentThread().getName() + " 获取到一个无效连接，尝试关闭并重新创建...");
                     try { conn.close(); } catch (SQLException ignored) {}
                     conn = createConnection();
                     // 注意：这里可能需要替换掉池中那个无效连接，或者同步逻辑更复杂
                }

                System.out.println(Thread.currentThread().getName() + " 获取数据库连接成功: " + conn);
                return conn;

            } catch (Exception e) {
                // 获取连接或创建连接时异常，必须释放许可
                semaphore.release();
                System.err.println(Thread.currentThread().getName() + " 获取/创建连接异常，已释放许可: " + e.getMessage());
                if (e instanceof SQLException) throw (SQLException) e;
                if (e instanceof InterruptedException) throw (InterruptedException) e;
                throw new RuntimeException(e);
            }
        } else {
            // 超时未能获取许可
            System.out.println(Thread.currentThread().getName() + " 获取信号量许可超时 (" + timeoutMillis + "ms)");
            return null; // 或抛出超时异常
        }
    }

    public void releaseConnection(Connection conn) {
        if (conn != null) {
            System.out.println(Thread.currentThread().getName() + " 准备归还连接: " + conn);
            boolean offerSuccess = false;
            // 归还连接到池
            synchronized (pool) {
               offerSuccess = pool.offer(conn);
            }
            if (offerSuccess) {
               System.out.println(Thread.currentThread().getName() + " 连接归还成功，准备释放信号量许可.");
               semaphore.release(); // 释放许可
            } else {
               // 如果归还失败（比如队列满了？理论上不应该），如何处理？
               // 可能需要关闭这个连接，并且不释放许可？或者记录错误？
               System.err.println(Thread.currentThread().getName() + " 归还连接失败!");
               try { conn.close(); } catch (SQLException ignored) {}
               // 此时不应该 release semaphore，因为这个连接实际上没有回到可用状态
            }
        }
    }

    public int getAvailablePermits() {
        return semaphore.availablePermits();
    }

    public static void main(String[] args) {
        try {
            // 需要替换为你的数据库信息和驱动
            // Class.forName("com.mysql.cj.jdbc.Driver");
            SimpleDbConnectionPool connectionPool = new SimpleDbConnectionPool(
                    3, "jdbc:mysql://localhost:3306/testdb", "user", "password");

            // 模拟多个线程并发获取连接
            for (int i = 0; i < 7; i++) {
                new Thread(() -> {
                    Connection c = null;
                    try {
                        System.out.println(Thread.currentThread().getName() + " 尝试获取连接...");
                        c = connectionPool.getConnection(2000); // 等待最多2秒
                        if (c != null) {
                            System.out.println(Thread.currentThread().getName() + " 获取连接成功，开始使用...");
                            Thread.sleep((long) (Math.random() * 1000)); // 模拟使用连接
                            System.out.println(Thread.currentThread().getName() + " 使用完毕.");
                        } else {
                            System.out.println(Thread.currentThread().getName() + " 未能获取到连接.");
                        }
                    } catch (InterruptedException | SQLException | RuntimeException e) {
                        System.err.println(Thread.currentThread().getName() + " 发生错误: " + e.getMessage());
                    } catch (Exception e) {
                        System.err.println(Thread.currentThread().getName() + " 发生未知错误: " + e.getMessage());
                    }
                    finally {
                        if (c != null) {
                            connectionPool.releaseConnection(c);
                        }
                    }
                }, "线程-" + i).start();
            }

        } catch (/*ClassNotFoundException |*/ SQLException e) {
            System.err.println("初始化连接池失败: " + e.getMessage());
        }
    }
}


```

**注意**: 上述代码是一个非常简化的示例，仅用于说明 Semaphore 的用法。生产级的数据库连接池（如 HikariCP, Druid）实现要复杂得多，需要处理连接校验、空闲超时、泄漏检测、动态调整等各种问题。但其核心的并发访问控制机制，很多都借鉴了 Semaphore 的思想或直接使用了 Semaphore（或类似的同步原语）。

---

#### 2.2 什么场景下 Semaphore 比其他同步工具更适合？

Semaphore 在以下场景中特别适合，并且通常比 `ReentrantLock` 或 `CountDownLatch` 更能发挥其优势：

1. **资源池控制 (Resource Pool Management)**:

   * **场景**: 管理一组有限的、可复用的资源，如数据库连接池、线程池（限制同时执行的任务数）、对象池（比如昂贵的网络连接对象、编解码器对象）等。
   * **原因**: 这类场景的核心需求是“允许多个线程并发使用资源，但要限制总数”。`ReentrantLock` 只能实现完全互斥（一次一个），过于严格；`CountDownLatch` 用于等待事件完成，功能不符。Semaphore 的计数特性完美契合。
2. **并发访问控制 (Concurrency Access Control)**:

   * **场景**: 限制对系统中某个特定部分（如图形界面的某个渲染区域、某个计算密集型服务）的同时访问线程数，以防止性能下降或资源过度消耗。
   * **原因**: 你不希望完全禁止并发（用 `ReentrantLock`），而是想设定一个“并发度上限”。Semaphore 可以轻松实现这一点。
3. **流量整形与限流 (Traffic Shaping & Rate Limiting)**:

   * **场景**: 控制单位时间内允许处理的请求数量，例如限制某个 API 的 QPS (Queries Per Second)，防止突发流量冲垮后端服务。
   * **原因**: Semaphore 可以直接限制“同时处理”的请求数量。虽然实现精确的 *基于时间* 的限流（如每秒 N 个）通常需要结合定时器或其他机制，但 Semaphore 是构建限流器的基础组件之一。它可以限制瞬时并发量。
4. **多资源并发访问 (Multiple Identical Resource Access)**:

   * **场景**: 系统中有 N 个完全相同的资源（比如 N 个打印机、N 个处理单元），允许多个线程同时使用这些资源，每个线程使用一个。
   * **原因**: Semaphore 的许可证数量可以直接对应资源的数量。每个线程获取一个许可证就相当于分配到了一个资源的使用权。

**总结**: 这些场景的共同特点是 **需要“有限的并发”而非“完全互斥”**。当你的需求不是“一次只允许一个”而是“一次最多允许 N 个”时，Semaphore 通常是更自然、更合适的选择。

---

#### 2.3 如何使用 Semaphore 实现限流功能？

使用 Semaphore 实现一个简单的 **并发数限流器** 非常直接。其核心思想是：用 Semaphore 的许可证数量代表“同时处理请求的许可数量”。

**实现步骤:**

1. **创建 Semaphore**: 初始化一个 Semaphore，其许可证数量 `permits` 就是你希望允许的最大并发请求数。

   ```
   int maxConcurrentRequests = 100; // 最多允许100个请求同时处理
   Semaphore rateLimiter = new Semaphore(maxConcurrentRequests);


   ```
2. **请求处理前获取许可**: 在处理每个到来的请求之前，尝试获取一个许可证。这里通常使用 `tryAcquire()` 而不是 `acquire()`，因为对于限流场景，如果无法立即获取许可（表示系统已达到并发上限），我们通常希望 **快速失败** 或 **拒绝服务**，而不是让请求线程无限期阻塞。

   ```
   public boolean handleRequest(Request request) {
       // 尝试非阻塞地获取许可
       if (rateLimiter.tryAcquire()) {
           System.out.println("获取许可成功，处理请求: " + request.getId());
           try {
               // 在这里执行实际的请求处理逻辑
               process(request);
               return true; // 处理成功
           } finally {
               // 处理完成后，无论成功还是异常，务必释放许可
               rateLimiter.release();
               System.out.println("请求处理完毕，释放许可: " + request.getId());
           }
       } else {
           // 未能获取许可，表示并发已达上限
           System.out.println("限流：无法获取许可，拒绝请求: " + request.getId());
           // 可以返回错误码、特定响应，或者直接丢弃请求
           return false; // 处理失败（被限流）
       }
   }

   private void process(Request request) {
       // 模拟请求处理耗时
       try {
           System.out.println("正在处理请求: " + request.getId() + "...");
           Thread.sleep(50 + (long)(Math.random() * 100));
       } catch (InterruptedException e) {
           Thread.currentThread().interrupt();
       }
   }

   // 模拟 Request 类
   static class Request {
       private static int counter = 0;
       private final int id;
       public Request() { this.id = ++counter; }
       public int getId() { return id; }
   }

   public static void main(String[] args) {
       SimpleRateLimiter limiter = new SimpleRateLimiter(3); // 最多允许3个并发

       // 模拟大量并发请求
       for (int i = 0; i < 10; i++) {
           final int reqNum = i;
           new Thread(() -> {
               Request req = new Request();
               System.out.println("线程 " + reqNum + " 发起请求 " + req.getId());
               boolean success = limiter.handleRequest(req);
               System.out.println("线程 " + reqNum + " 请求 " + req.getId() + " 处理结果: " + (success ? "成功" : "被限流"));
           }).start();
       }
   }


   ```

**改进与考虑:**

* **带超时的尝试 (`tryAcquire(timeout, unit)`)**: 如果你不希望立即拒绝，而是给请求一个短暂的等待机会，可以使用带超时的 `tryAcquire`。
* **公平性**: 对于限流场景，通常使用非公平模式以获得更好的性能。如果请求有优先级或需要保证大致的到达顺序，可以考虑公平模式。
* **与时间结合的限流**: 上述方法限制的是 **瞬时并发数**。如果想实现更精确的 **基于时间的限流**（如每秒最多 N 个请求），Semaphore 本身不够。通常需要结合 `ScheduledExecutorService` 定期补充许可证（模拟令牌桶），或者使用 Guava 的 `RateLimiter` 等专门的库。但 Semaphore 可以作为实现这些复杂限流策略的基础。

**总结**:  
 使用 `Semaphore` 的 `tryAcquire()` 和 `release()` 可以快速实现一个简单的并发数限流器，有效防止系统因瞬时请求过多而过载，是保护系统稳定性的常用手段。

---

### 3. 源码分析：深入 Semaphore 的内部机制

#### 3.1 Semaphore 内部实现原理是什么？(基于 AQS)

`Semaphore` 的内部实现 **高度依赖** Java 并发包的基石——`AbstractQueuedSynchronizer` (AQS)。如果你对 AQS 不太熟悉，可以简单理解为：

**AQS (AbstractQueuedSynchronizer):**

* 它是一个用于构建锁和同步器的 **基础框架**。
* 核心思想是：如果共享资源空闲，则设置当前线程为有效工作线程，并将共享资源设置为锁定状态；如果共享资源被占用，就需要一套线程阻塞等待以及被唤醒时锁分配的机制。
* 内部维护一个 **`state` 变量 (int类型)**，表示同步状态。子类可以通过 `getState()`, `setState()`, `compareAndSetState()` 来原子地操作这个状态值。
* 内部维护一个 **FIFO 的等待队列 (CLH 队列变种)**，用于存放因获取同步状态失败而被阻塞的线程。
* AQS 提供了两种同步模式：
  + **独占模式 (Exclusive Mode)**: 资源同一时刻只能被一个线程持有，如 `ReentrantLock`。
  + **共享模式 (Shared Mode)**: 资源可以被多个线程同时持有，如 `Semaphore`, `CountDownLatch`, `ReentrantReadWriteLock` 的读锁。

**Semaphore 如何使用 AQS？**

`Semaphore` 将 AQS 的 `state` 变量巧妙地用作了 **可用许可证的数量**。

1. **继承结构**: `Semaphore` 内部定义了一个抽象静态内部类 `Sync`，它继承自 `AQS`。`Sync` 又有两个具体的子类：`NonfairSync` 和 `FairSync`，分别实现了非公平和公平的获取逻辑。

   ```
   Semaphore
       -> Sync (abstract static class Sync extends AbstractQueuedSynchronizer)
           -> NonfairSync (static final class NonfairSync extends Sync)
           -> FairSync (static final class FairSync extends Sync)


   ```
2. **状态 (State)**: `Semaphore` 初始化时传入的 `permits` 数量，会被用来设置 AQS 的 `state` 初始值。

   ```
   // Semaphore 构造函数 (非公平)
   public Semaphore(int permits) {
       // 创建一个 NonfairSync 实例，并将 permits 值传递给 Sync 的构造函数
       // Sync 的构造函数会调用 AQS 的 setState(permits) 来初始化 state
       sync = new NonfairSync(permits);
   }

   // Semaphore 构造函数 (可选择公平性)
   public Semaphore(int permits, boolean fair) {
       sync = fair ? new FairSync(permits) : new NonfairSync(permits);
   }

   // Sync 构造函数 (内部调用)
   Sync(int permits) {
       setState(permits); // 使用 AQS 的方法设置初始许可证数量
   }


   ```
3. **共享模式**: `Semaphore` 使用的是 AQS 的 **共享模式**。因为许可证可以被多个线程同时持有。它主要重写了 AQS 的以下共享模式相关的方法：

   * `tryAcquireShared(int acquires)`: 尝试获取指定数量 (`acquires`) 的许可证（原子地减少 `state`）。成功则返回非负值，失败则返回负值。
   * `tryReleaseShared(int releases)`: 尝试释放指定数量 (`releases`) 的许可证（原子地增加 `state`）。成功则返回 `true`，并可能需要唤醒等待队列中的线程。

**总结**: Semaphore 本质上是 **对 AQS 共享模式的一种特定应用和封装**。它利用 AQS 提供的状态管理 (`state`) 和线程排队/唤醒机制，实现了许可证的获取 (`acquire`) 和释放 (`release`) 逻辑。开发人员在使用 Semaphore API 时，无需关心底层复杂的 AQS 实现细节，但理解这个依赖关系有助于把握 Semaphore 的核心原理。

---

**💡 通俗理解（个人理解版）**

你可以把 AQS 想象成一个 **高度可定制的“同步器流水线工厂”**。这个工厂提供了一些标准化的部件和流程：

* 一个 **计数器 (`state`)**，可以原子地增减。
* 一个 **排队区域 (FIFO队列)**，供暂时无法通过流水线的“产品”（线程）等待。
* 一套 **调度逻辑**，决定何时让等待的产品重新尝试进入流水线。

`Semaphore` 的设计师来到这个工厂，说：“我要造一个信号量！”

* **定制需求**: “我的信号量需要控制许可证数量。”
* **工厂方案**: “没问题，你可以用我们的 `state` 计数器来代表可用许可证数量。”
* **定制需求**: “当许可证够用时，线程应该能获取；不够时，应该去排队等待。”
* **工厂方案**: “好的，你只需要定义清楚‘许可证够不够’的判断逻辑（实现 `tryAcquireShared`），我们会自动处理排队和唤醒。”
* **定制需求**: “线程用完后需要释放许可证。”
* **工厂方案**: “行，你定义好‘释放许可证’的操作逻辑（实现 `tryReleaseShared`），我们会处理计数器增加和通知排队者。”
* **定制需求**: “我还想要公平和非公平两种模式。”
* **工厂方案**: “可以，你在定义‘许可证够不够’的逻辑时（`tryAcquireShared`），公平模式下多加一个检查，看看前面有没有人在排队就行了。非公平模式就不加这个检查。”

于是，`Semaphore`（以及其内部的 `Sync`, `FairSync`, `NonfairSync`）就基于 AQS 这个强大的框架被构建出来了。AQS 负责了大部分底层的、复杂的同步状态管理和线程调度工作，而 `Semaphore` 只需要专注于实现与“许可证”相关的核心逻辑。这种分层设计使得 `Semaphore` 的实现相对简洁，也让 JUC 包能够更容易地构建出各种不同的同步器。

---

#### 3.2 `acquire()` 和 `release()` 方法的底层实现逻辑？

了解了 Semaphore 基于 AQS 的原理后，我们来看看核心方法 `acquire()` 和 `release()` 的内部调用流程和关键源码。

**`acquire()` 方法 (以非公平模式 `NonfairSync` 为例):**

当你调用 `semaphore.acquire()` 时，实际执行流程如下：

1. **`Semaphore.acquire()`**: 调用内部 `sync` 对象的 `acquireSharedInterruptibly(1)` 方法。传入参数 `1` 表示尝试获取 1 个许可证。选择 `Interruptibly` 后缀表示该方法在等待过程中可以响应线程中断。

   ```
   public void acquire() throws InterruptedException {
       // 调用 AQS 的模板方法，参数 1 表示获取 1 个许可
       sync.acquireSharedInterruptibly(1);
   }


   ```
2. **`AQS.acquireSharedInterruptibly(int arg)`**: 这是 AQS 提供的一个模板方法。它做了两件事：

   * 首先，调用子类实现的 `tryAcquireShared(arg)` 方法，尝试获取许可证。
   * 如果 `tryAcquireShared()` 返回值 `< 0`（表示获取失败），则调用 `doAcquireSharedInterruptibly(arg)` 将当前线程加入等待队列并挂起，直到被唤醒或中断。

   ```
   // AQS.acquireSharedInterruptibly 简化逻辑
   public final void acquireSharedInterruptibly(int arg) throws InterruptedException {
       if (Thread.interrupted()) // 检查中断状态
           throw new InterruptedException();
       // 关键：调用子类（NonfairSync 或 FairSync）实现的 tryAcquireShared
       if (tryAcquireShared(arg) < 0)
           // 如果获取失败，则进入 AQS 的排队和阻塞逻辑
           doAcquireSharedInterruptibly(arg);
   }


   ```
3. **`NonfairSync.tryAcquireShared(int acquires)`**: 这是非公平模式下尝试获取许可证的核心逻辑。

   ```
   // NonfairSync.tryAcquireShared (在 Semaphore 内部)
   protected int tryAcquireShared(int acquires) {
       // 调用父类 Sync 中的非公平获取方法
       return nonfairTryAcquireShared(acquires);
   }

   // Sync.nonfairTryAcquireShared (实际逻辑)
   final int nonfairTryAcquireShared(int acquires) {
       for (;;) { // 无限循环，采用 CAS 自旋尝试
           int available = getState(); // 1. 获取当前可用的许可证数量 (AQS state)
           int remaining = available - acquires; // 2. 计算获取后剩余的数量
           // 3. 判断:
           //    a) remaining < 0: 许可证不足，获取失败。直接返回负值。
           //    b) compareAndSetState(available, remaining): 尝试原子地将 state 从 available 更新为 remaining。
           //       如果 CAS 成功，说明当前线程成功抢占到了许可证，返回非负值 (remaining >= 0)，获取成功。
           //       如果 CAS 失败，说明在读取 available 和尝试更新之间，state 被其他线程修改了（并发冲突），循环继续，重新尝试。
           if (remaining < 0 || compareAndSetState(available, remaining))
               return remaining; // 返回剩余数量 (>=0 表示成功，<0 表示失败)
       }
   }


   ```

   **代码解读**:

   * 这是一个典型的 **CAS (Compare-And-Swap) 无锁自旋** 实现。线程不断地读取当前状态，计算新状态，然后尝试原子更新。
   * 如果许可证足够 (`remaining >= 0`) 并且 CAS 更新成功，则表示获取成功，返回剩余许可证数量（或 0）。
   * 如果许可证不足 (`remaining < 0`)，直接返回负数，表示获取失败。
   * 如果 CAS 失败（通常因为其他线程也在同时 `acquire` 或 `release`），则循环继续，重新尝试。
   * 这个方法 **体现了非公平性**: 它直接尝试修改 `state`，没有检查等待队列中是否有其他线程。
4. **`AQS.doAcquireSharedInterruptibly(int arg)`**: 如果 `tryAcquireShared` 返回负值，AQS 就会调用这个方法（或其他类似方法）来处理失败情况：

   * 将当前线程包装成一个节点 (Node)。
   * 将该节点加入到 AQS 的等待队列尾部。
   * 使用 `LockSupport.park()` 等机制将当前线程 **挂起（阻塞）**。
   * 线程会一直阻塞，直到被其他线程调用 `release()` 后唤醒，或者被中断。被唤醒后，线程会再次尝试调用 `tryAcquireShared` 获取许可。

**`release()` 方法 (适用于公平和非公平模式):**

当你调用 `semaphore.release()` 时，执行流程如下：

1. **`Semaphore.release()`**: 调用内部 `sync` 对象的 `releaseShared(1)` 方法。参数 `1` 表示释放 1 个许可证。

   ```
   public void release() {
       // 调用 AQS 的模板方法，参数 1 表示释放 1 个许可
       sync.releaseShared(1);
   }


   ```
2. **`AQS.releaseShared(int arg)`**: 这也是 AQS 的一个模板方法。

   * 调用子类实现的 `tryReleaseShared(arg)` 方法，尝试释放许可证。
   * 如果 `tryReleaseShared()` 返回 `true`（表示释放成功，并且可能导致状态变化允许其他线程获取），则调用 `doReleaseShared()` 唤醒等待队列中的后继线程。

   ```
   // AQS.releaseShared 简化逻辑
   public final boolean releaseShared(int arg) {
       // 关键：调用子类（Sync）实现的 tryReleaseShared
       if (tryReleaseShared(arg)) {
           // 如果释放成功，则执行唤醒操作
           doReleaseShared();
           return true;
       }
       return false;
   }


   ```
3. **`Sync.tryReleaseShared(int releases)`**: 这是 `Semaphore` 中释放许可证的核心逻辑，由父类 `Sync` 实现，对公平和非公平模式都适用。

   ```
   // Sync.tryReleaseShared (在 Semaphore 内部)
   protected final boolean tryReleaseShared(int releases) {
       for (;;) { // 无限循环，CAS 自旋
           int current = getState(); // 1. 获取当前许可证数量
           int next = current + releases; // 2. 计算释放后的数量
           // 3. 处理潜在的溢出问题
           // 如果 next < current，说明整型溢出了 (许可证数量加得太多)
           // 这是一个非预期的错误状态
           if (next < current) // Overflow
               throw new Error("Maximum permit count exceeded");
           // 4. 尝试原子地将 state 从 current 更新为 next
           // 如果 CAS 成功，说明许可证已成功释放，返回 true
           // 如果 CAS 失败，说明 state 被其他线程修改，循环继续，重新尝试
           if (compareAndSetState(current, next))
               return true;
       }
   }


   ```

   **代码解读**:

   * 同样使用 **CAS 自旋** 来原子地增加 `state` 的值。
   * 包含了一个溢出检查，防止许可证数量超过 `Integer.MAX_VALUE`。
   * `release()` 操作通常 **很少失败**。CAS 失败只表示有并发的 `release` 或 `acquire` 操作，重试即可。它不像 `acquire` 那样会因为“资源不足”而返回失败。
   * `tryReleaseShared` 返回 `true` 表示状态已被成功修改。
4. **`AQS.doReleaseShared()`**: 当 `tryReleaseShared` 返回 `true` 后，AQS 会调用此方法。它的主要作用是：

   * 检查 AQS 等待队列的头部节点。
   * 如果头部节点的状态表明它可以被唤醒（在共享模式下通常是这样），则使用 `LockSupport.unpark()` **唤醒** 队列中的下一个（或多个，取决于传播机制）等待线程。
   * 被唤醒的线程会从之前的阻塞点（`doAcquireSharedInterruptibly` 内部）继续执行，再次尝试调用 `tryAcquireShared` 来获取刚刚被释放的许可证。

**总结**: `acquire()` 和 `release()` 的核心在于通过 **CAS 操作** 原子地修改 AQS 的 `state` (许可证数量)，并利用 AQS 提供的 **线程排队和唤醒机制** 来处理许可证不足时的阻塞和许可证释放后的通知。非公平模式下的 `acquire` 会尝试直接抢占，而公平模式则会先检查队列。`release` 操作相对简单，主要是增加 `state` 并触发 AQS 的唤醒流程。

---

**💡 源码个人理解版**

看 `acquire()` 和 `release()` 的源码，特别是 `NonfairSync.tryAcquireShared` 和 `Sync.tryReleaseShared` 中的 CAS 自旋循环，还是能学到不少好东西的：

* **无锁操作**: 通过 CAS 避免了使用传统互斥锁（如 `synchronized` 或 `ReentrantLock`）来保护 `state` 变量。在高并发场景下，这意味着更少的锁竞争、更少的线程上下文切换，从而可能带来更高的性能。线程们像是在“乐观地”尝试修改状态，只有在冲突时才重试，而不是一开始就排队等待锁。
* **AQS 的威力**: Semaphore 自身的核心逻辑（加减计数器）其实非常简单，复杂的部分（线程排队、阻塞、唤醒、中断处理、公平性保证等）都由 AQS 框架优雅地处理了。这体现了良好的框架设计：将通用同步机制与具体业务逻辑分离。
* **非公平的“插队”本质**: 非公平模式的 `tryAcquireShared` 直接执行 CAS 循环，根本不看队列。这就是它性能可能更好但也可能导致饥饿的原因——它给了新来的线程一个立即成功的机会。

理解了这层源码，更清楚地知道，为什么非公平模式快（因为它省去了排队检查和可能的阻塞唤醒开销），为什么必须在 `finally` 中 `release`（因为 AQS 的 `state` 必须正确维护），以及为什么 `acquire` 可能阻塞而 `release` 通常不会（因为 `acquire` 受限于 `state` 的值，而 `release` 只是增加它）。

---

#### 3.3 非公平模式下，线程获取许可证的顺序是如何确定的？

在非公平模式下，线程获取许可证的顺序是 **不确定的**，并且 **允许“插队” (Barging)**。

具体行为如下：

1. **新线程尝试抢占**: 当一个新线程调用 `acquire()` 时，它会首先执行 `NonfairSync.tryAcquireShared()`。如前源码所示，这个方法会立即尝试通过 CAS 修改 `state` 来获取许可证。
2. **抢占成功**: 如果此时刚好有足够的许可证，并且 CAS 操作成功，那么这个新线程 **直接获取许可证成功** 并继续执行，**完全无视** AQS 等待队列中可能已经存在的、等待了很久的其他线程。
3. **抢占失败/许可证不足**: 如果 CAS 操作失败（比如被其他线程抢先了），或者当前许可证数量不足 (`remaining < 0`)，那么这个新线程才会调用 `AQS.doAcquireSharedInterruptibly()` 进入 AQS 的等待队列，排在队尾并阻塞。
4. **唤醒时的竞争**: 当某个线程调用 `release()` 释放许可证时，AQS 的 `doReleaseShared()` 会唤醒等待队列头部的线程。但是，请注意，被唤醒的线程 **仍然需要** 再次调用 `tryAcquireShared()` 来尝试获取许可证。在这个被唤醒的线程尝试获取的 **同时**，可能又有一个 **新的线程** 到达并调用 `acquire()`，这个新线程同样会 **直接尝试 CAS 抢占**。因此，即使队列头部的线程被唤醒了，它也 **不保证** 一定能获取到刚刚被释放的许可证，它可能会被一个新来的线程再次“插队”抢走。

**与公平模式的关键区别：**

公平模式 (`FairSync`) 的 `tryAcquireShared` 方法在尝试 CAS 之前，会 **额外** 调用 `hasQueuedPredecessors()` 方法。

```
// FairSync.tryAcquireShared (在 Semaphore 内部)
protected int tryAcquireShared(int acquires) {
    for (;;) {
        // *** 公平模式的关键 ***
        // 如果等待队列中有其他线程在排队，则当前线程不允许获取，必须去排队
        if (hasQueuedPredecessors())
            return -1; // 返回失败，强制进入 AQS 排队逻辑

        // （后面的逻辑与 nonfairTryAcquireShared 类似：getState, CAS）
        int available = getState();
        int remaining = available - acquires;
        if (remaining < 0 || compareAndSetState(available, remaining))
            return remaining;
    }
}


```

`hasQueuedPredecessors()` 会检查 AQS 等待队列中是否存在有效的（非取消的）前驱节点。如果存在，表示有其他线程比当前线程更早开始等待，那么即使现在有足够的许可证，公平模式也会让当前线程获取失败（返回 -1），迫使其进入等待队列排队，从而保证了 FIFO 的顺序。

**总结**: 非公平模式为了性能，牺牲了公平性。它允许新来的线程“插队”，也允许刚被唤醒的线程再次被插队。这导致获取许可证的顺序变得不确定，依赖于线程调度、CAS 竞争结果等因素，但也因此减少了线程阻塞和上下文切换的概率，提高了整体吞吐量。理解这一点对于预测和调试非公平 Semaphore 的行为至关重要。

---

**💡 个人理解版：公平 vs 非公平的源码对比**

通过对比 `FairSync` 和 `NonfairSync` 的 `tryAcquireShared` 实现，我清晰地看到了公平与非公平的本质区别就源于那一行 `if (hasQueuedPredecessors()) return -1;`。

* **非公平**: 像个莽撞的家伙，上来就抢 (`CAS` 循环)。抢到了就走，抢不到或者没货了才去排队。
* **公平**: 像个守规矩的人，先看看前面有没有人排队 (`hasQueuedPredecessors()`)。有人排队？老老实实去队尾等着。没人排队？才尝试去拿 (`CAS` 循环)。

这个小小的检查，带来了行为上的巨大差异：

* **非公平快在哪里？** 省去了检查队列的开销，更重要的是，如果运气好（刚好有许可，且 CAS 成功），线程根本不需要进入 AQS 队列，也就省去了节点创建、入队、可能的阻塞和唤醒等一系列相对昂贵的操作。
* **公平性如何保证？** 强制检查队列，确保了只有队列头的线程（或者队列为空时的新线程）才有机会去尝试获取许可。

所以，选择公平还是非公平，真的是在 **“插队带来的效率”** 和 **“排队保证的秩序”** 之间做选择。

---

### 4. 进阶问题：Semaphore 的深度应用与挑战

#### 4.1 Semaphore 如何与其他并发工具结合使用？

Semaphore 本身功能强大，但与其他 JUC 工具结合使用，可以构建出更复杂、更灵活的并发控制策略。

1. **Semaphore + CountDownLatch: 控制并发任务的启动与完成**

   * **场景**: 你需要启动 N 个子任务并行执行，但希望 **同时运行的子任务不超过 M 个 (M < N)**，并且主线程需要 **等待所有 N 个任务都完成后** 再继续。
   * **结合方式**:
     + 使用 `Semaphore(M)` 来限制并发执行的任务数量。每个子任务启动前 `acquire()`，结束后 `release()`。
     + 使用 `CountDownLatch(N)` 来等待所有任务完成。每个子任务完成后调用 `latch.countDown()`，主线程调用 `latch.await()` 等待。
   * **代码示例**:

     ```
     import java.util.concurrent.CountDownLatch;
     import java.util.concurrent.ExecutorService;
     import java.util.concurrent.Executors;
     import java.util.concurrent.Semaphore;

     public class SemaphoreCountDownLatchDemo {

         public static void main(String[] args) throws InterruptedException {
             int totalTasks = 10; // 总任务数
             int concurrentLimit = 3; // 最大并发数

             Semaphore semaphore = new Semaphore(concurrentLimit); // 控制并发
             CountDownLatch latch = new CountDownLatch(totalTasks); // 等待完成
             ExecutorService executor = Executors.newCachedThreadPool(); // 线程池

             System.out.println("开始执行任务...");

             for (int i = 0; i < totalTasks; i++) {
                 final int taskId = i;
                 executor.submit(() -> {
                     try {
                         semaphore.acquire(); // 获取执行许可
                         System.out.println("任务 " + taskId + " 开始执行 @" + System.currentTimeMillis() + " by " + Thread.currentThread().getName());
                         // 模拟任务执行
                         Thread.sleep(1000 + (long)(Math.random() * 1000));
                         System.out.println("任务 " + taskId + " 执行完毕 @" + System.currentTimeMillis());
                     } catch (InterruptedException e) {
                         Thread.currentThread().interrupt();
                         System.err.println("任务 " + taskId + " 被中断");
                     } finally {
                         semaphore.release(); // 释放许可
                         latch.countDown(); // 通知任务完成
                         System.out.println("任务 " + taskId + " 释放许可并通知完成, 剩余任务: " + latch.getCount());
                     }
                 });
             }

             System.out.println("所有任务已提交，主线程等待所有任务完成...");
             latch.await(); // 主线程阻塞，直到 latch 计数为 0
             System.out.println("所有任务执行完毕！");
             executor.shutdown();
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
     + 32
     + 33
     + 34
     + 35
     + 36
     + 37
     + 38
     + 39
     + 40
     + 41
     + 42
     + 43
     ```

     在这个例子中，Semaphore 保证了最多只有 3 个任务同时在“执行”状态，而 CountDownLatch 确保了主线程能等到所有 10 个任务都结束。
2. **Semaphore + 线程池 (ExecutorService): 创建资源受限的工作线程池**

   * **场景**: 你有一个线程池用于处理任务，但这些任务需要访问某种有限资源（比如同时只能有 5 个任务可以访问某个外部 API）。你希望限制 **线程池中同时访问该资源的线程数量**，而不是限制线程池本身的大小。
   * **结合方式**:
     + 创建一个 `Semaphore`，许可证数量等于有限资源的数量（比如 5）。
     + 在提交给线程池的任务 (`Runnable` 或 `Callable`) 内部，在访问受限资源之前 `acquire()` 信号量，访问结束后 `release()`。
   * **代码示例**:

     ```
     import java.util.concurrent.ExecutorService;
     import java.util.concurrent.Executors;
     import java.util.concurrent.Semaphore;
     import java.util.concurrent.TimeUnit;

     public class SemaphoreThreadPoolDemo {

         private static final Semaphore apiAccessPermits = new Semaphore(5); // 最多允许5个并发访问API

         public static void main(String[] args) throws InterruptedException {
             ExecutorService executor = Executors.newFixedThreadPool(10); // 线程池有10个线程

             System.out.println("提交20个需要访问API的任务到线程池...");

             for (int i = 0; i < 20; i++) {
                 final int taskId = i;
                 executor.submit(() -> {
                     boolean acquired = false;
                     try {
                         System.out.println("任务 " + taskId + ": 尝试获取API访问许可 by " + Thread.currentThread().getName());
                         // 可以使用 tryAcquire 避免无限等待
                         acquired = apiAccessPermits.tryAcquire(1, TimeUnit.MINUTES);

                         if (acquired) {
                             System.out.println("任务 " + taskId + ": 获取许可成功，开始访问API...");
                             // 模拟访问API的耗时操作
                             Thread.sleep(500 + (long)(Math.random() * 500));
                             System.out.println("任务 " + taskId + ": API访问结束.");
                         } else {
                             System.out.println("任务 " + taskId + ": 获取API访问许可超时.");
                         }
                     } catch (InterruptedException e) {
                         Thread.currentThread().interrupt();
                         System.err.println("任务 " + taskId + " 在等待或访问API时被中断");
                     } finally {
                         if (acquired) {
                             apiAccessPermits.release(); // 访问结束后释放许可
                             System.out.println("任务 " + taskId + ": 释放API访问许可.");
                         }
                     }
                 });
             }

             executor.shutdown();
             executor.awaitTermination(1, TimeUnit.HOURS); // 等待所有任务完成
             System.out.println("所有任务处理完毕。");
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
     + 32
     + 33
     + 34
     + 35
     + 36
     + 37
     + 38
     + 39
     + 40
     + 41
     + 42
     + 43
     + 44
     + 45
     + 46
     + 47
     + 48
     ```

     即使线程池有 10 个线程，Semaphore 也确保了在任何时刻，最多只有 5 个线程在执行访问 API 的那段代码。
3. **Semaphore + ReentrantLock: 控制并发度与保护共享状态**

   * **场景**: 你有一个服务，允许多个线程并发执行某个操作（比如数据处理），但这些线程需要访问和修改一个共享的数据结构（比如一个缓存或计数器），这个共享数据结构本身需要互斥访问来保证一致性。
   * **结合方式**:
     + 使用 `Semaphore` 控制 **同时执行该操作的线程总数**。
     + 在操作内部，当需要访问 **共享数据结构** 时，使用 `ReentrantLock` 对该数据结构进行加锁保护。
   * **代码示例**:

     ```
     import java.util.HashMap;
     import java.util.Map;
     import java.util.concurrent.ExecutorService;
     import java.util.concurrent.Executors;
     import java.util.concurrent.Semaphore;
     import java.util.concurrent.TimeUnit;
     import java.util.concurrent.locks.Lock;
     import java.util.concurrent.locks.ReentrantLock;

     public class SemaphoreLockDemo {

         private static final Semaphore concurrentHandlers = new Semaphore(3); // 最多3个并发处理
         private static final Lock cacheLock = new ReentrantLock(); // 保护缓存的锁
         private static final Map<String, Integer> sharedCache = new HashMap<>(); // 共享缓存

         public static void handle(String key) {
             boolean acquired = false;
             try {
                 System.out.println(Thread.currentThread().getName() + ": 尝试获取处理许可 for key " + key);
                 acquired = concurrentHandlers.tryAcquire(10, TimeUnit.SECONDS);

                 if (acquired) {
                     System.out.println(Thread.currentThread().getName() + ": 获取许可成功，开始处理 " + key);
                     // 模拟一些不需要访问共享缓存的处理
                     Thread.sleep(100);

                     // 需要访问共享缓存，加锁
                     cacheLock.lock();
                     try {
                         System.out.println(Thread.currentThread().getName() + ": 获取缓存锁，更新缓存 for " + key);
                         sharedCache.put(key, sharedCache.getOrDefault(key, 0) + 1);
                         Thread.sleep(50); // 模拟缓存操作
                     } finally {
                         cacheLock.unlock(); // 确保释放锁
                         System.out.println(Thread.currentThread().getName() + ": 释放缓存锁 for " + key);
                     }

                     // 模拟后续处理
                     Thread.sleep(100);
                     System.out.println(Thread.currentThread().getName() + ": 处理完成 " + key);

                 } else {
                     System.out.println(Thread.currentThread().getName() + ": 获取处理许可超时 for key " + key);
                 }

             } catch (InterruptedException e) {
                 Thread.currentThread().interrupt();
             } finally {
                 if (acquired) {
                     concurrentHandlers.release(); // 释放处理许可
                     System.out.println(Thread.currentThread().getName() + ": 释放处理许可 for key " + key);
                 }
             }
         }

         public static void main(String[] args) throws InterruptedException {
             ExecutorService executor = Executors.newCachedThreadPool();
             for (int i = 0; i < 10; i++) {
                 final String key = "key" + (i % 3); // 模拟处理不同的 key
                 executor.submit(() -> handle(key));
             }
             executor.shutdown();
             executor.awaitTermination(1, TimeUnit.MINUTES);
             System.out.println("最终缓存状态: " + sharedCache);
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
     + 32
     + 33
     + 34
     + 35
     + 36
     + 37
     + 38
     + 39
     + 40
     + 41
     + 42
     + 43
     + 44
     + 45
     + 46
     + 47
     + 48
     + 49
     + 50
     + 51
     + 52
     + 53
     + 54
     + 55
     + 56
     + 57
     + 58
     + 59
     + 60
     + 61
     + 62
     + 63
     + 64
     + 65
     + 66
     ```

     这里，Semaphore 控制了同时调用 `handle` 方法的线程数，而 ReentrantLock 则在 `handle` 方法内部保护了对 `sharedCache` 的并发访问。
4. **Semaphore + BlockingQueue: 控制生产者/消费者的速率或资源**

   * **场景**: 在生产者-消费者模式中，你可能想限制生产者的生产速率（如果生产过快会导致队列无限增长），或者限制消费者的数量（如果消费者需要访问有限资源）。
   * **结合方式**:
     + **限制生产者**: 创建一个 `Semaphore`，许可证数量代表“允许生产的额度”。生产者在生产数据放入队列前 `acquire()`，放入后不 `release()`。另外需要一个机制（比如定时器或其他消费者信号）来 `release()` 许可证，补充生产额度。
     + **限制消费者**: 创建一个 `Semaphore`，许可证数量代表“允许并发处理的消费者数量”。消费者线程在从队列取出数据并开始处理前 `acquire()`，处理完成后 `release()`。

---

#### 4.2 使用 Semaphore 时可能遇到的死锁情况及如何避免？

虽然 Semaphore 本身是用于解决并发问题的，但如果不当使用，它也可能 **参与形成死锁**，或者导致类似死锁的效果（**许可证泄漏**）。

**常见的死锁或类死锁情况：**

1. **资源分配死锁 (与多个 Semaphore 或 Lock 结合时)**:

   * **场景**: 线程 A 获取了 Semaphore S1 的许可，然后尝试获取 Semaphore S2 的许可；同时，线程 B 获取了 Semaphore S2 的许可，然后尝试获取 Semaphore S1 的许可。
   * **原因**: 形成了经典的 **循环等待 (Circular Wait)** 条件。A 等待 B 释放 S2，B 等待 A 释放 S1，双方都无法继续执行。
   * **示例**:

     ```
     Semaphore s1 = new Semaphore(1);
     Semaphore s2 = new Semaphore(1);

     // 线程 A
     new Thread(() -> {
         try {
             s1.acquire();
             System.out.println("Thread A acquired s1");
             Thread.sleep(100); // 给线程 B 获取 s2 的机会
             System.out.println("Thread A trying to acquire s2...");
             s2.acquire(); // 可能阻塞在这里
             System.out.println("Thread A acquired s2");
             // ... do work ...
             s2.release();
             s1.release();
         } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
     }).start();

     // 线程 B
     new Thread(() -> {
         try {
             s2.acquire();
             System.out.println("Thread B acquired s2");
             Thread.sleep(100); // 给线程 A 获取 s1 的机会
             System.out.println("Thread B trying to acquire s1...");
             s1.acquire(); // 可能阻塞在这里
             System.out.println("Thread B acquired s1");
             // ... do work ...
             s1.release();
             s2.release();
         } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
     }).start();


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
     + 32
     ```
2. **许可证泄漏 (Permit Leak)**:

   * **场景**: 线程成功 `acquire()` 了一个许可证，但在执行后续操作时发生了异常，并且 `finally` 块 **没有** 正确地调用 `release()`。
   * **原因**: 这个被获取的许可证 **永远不会被归还**。如果这种情况频繁发生，Semaphore 的可用许可证数量会逐渐减少，最终降为 0。之后所有尝试 `acquire()` 的线程都会被永久阻塞，表现类似于死锁（所有相关线程都无法继续执行）。
   * **危害**: 这是非常隐蔽且危险的问题，因为它不会立即显现，而是随着系统运行时间变长，可用许可逐渐耗尽，最终导致系统“卡死”。
3. **嵌套获取死锁 (Nested Acquisition Deadlock)**:

   * **场景**: 一个线程已经持有了一个或多个 Semaphore 许可证，在持有期间，它又尝试 `acquire()` **同一个** Semaphore 的更多许可证，并且请求的数量超过了当前剩余的可用许可证。
   * **原因**: 线程自己阻塞了自己。它需要更多许可证才能继续，但它持有的许可证又无法释放（因为阻塞了），导致无法满足自己的需求。如果 Semaphore 的总许可数有限，这很容易发生。
   * **示例**:

     ```
     Semaphore s = new Semaphore(2); // 总共只有 2 个许可

     new Thread(() -> {
         try {
             System.out.println("Thread trying to acquire 1 permit...");
             s.acquire(1); // 获取成功，剩余 1 个许可
             System.out.println("Thread acquired 1 permit. Available: " + s.availablePermits());
             // ... do some work ...

             System.out.println("Thread trying to acquire 2 more permits...");
             // 此时需要 2 个，但只剩 1 个可用，线程会阻塞在这里
             // 它永远无法获取到第 2 个许可，因为它自己还占着第 1 个没释放
             s.acquire(2);
             System.out.println("Thread acquired 2 more permits."); // 这行永远不会执行

             // s.release(2); // 无法到达
             // s.release(1); // 无法到达
         } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
     }).start();


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
     ```

**如何避免死锁和许可证泄漏？**

1. **保证释放 (最重要的！)**:

   * **始终将 `release()` 调用放在 `finally` 块中**。这是防止许可证泄漏的最根本方法。确保无论 `try` 块中发生什么（正常结束或异常），只要成功 `acquire()` 了许可证，就一定会被 `release()`。

   ```
   semaphore.acquire();
   try {
       // ... 受保护的操作 ...
   } finally {
       semaphore.release(); // 保证释放
   }


   ```
2. **使用带超时的获取 (`tryAcquire`)**:

   * 对于可能发生资源分配死锁的场景，避免使用无限期等待的 `acquire()`。改用 `tryAcquire(long timeout, TimeUnit unit)`。
   * 如果获取超时，线程可以选择放弃操作、记录日志、重试或者执行备用逻辑，而不是无限阻塞，从而打破死锁的可能性。
3. **顺序获取资源**:

   * 如果要获取多个 Semaphore（或 Lock）的许可，**规定一个固定的全局获取顺序**，并确保所有线程都严格遵守这个顺序。例如，总是先获取 S1，再获取 S2。这样可以破坏循环等待条件。
4. **避免不必要的嵌套获取**:

   * 仔细检查代码逻辑，看是否真的需要在持有许可证的情况下再次获取同一个 Semaphore 的许可。如果可以重构逻辑，在第一次 `release` 之后再进行第二次 `acquire`，通常更安全。
   * 如果确实需要嵌套获取，确保你 **一次性获取足够的许可证**，或者确保外层获取的许可证数量足够多，能够覆盖内层的所有需求。或者使用 `tryAcquire` 来处理内层获取失败的情况。
5. **死锁检测工具**:

   * 在开发和测试阶段，可以使用 JVM 提供的工具（如 `jstack`）或 JProfiler 等性能分析工具来检测是否存在死锁。

**总结**: 死锁和许可证泄漏是使用 Semaphore 时需要警惕的问题。通过养成良好的编码习惯（`finally` 块释放）、使用超时机制、规定资源获取顺序以及避免危险的嵌套获取，可以有效地防止这些问题的发生。

---

#### 4.3 Semaphore 在实际项目中的性能表现如何？有没有遇到过性能瓶颈？

Semaphore 的性能通常被认为是 **相当不错** 的，尤其是在 **非公平模式** 下。因为它基于 AQS，而 AQS 的设计本身就考虑了高性能（例如，使用 CAS 操作减少锁竞争，高效的线程排队和唤醒机制）。

**性能表现：**

* **非公平模式**: 吞吐量通常较高。因为它允许线程“插队”，减少了线程进入等待队列和被唤醒的开销。适用于大多数追求整体效率的场景。
* **公平模式**: 吞吐量通常低于非公平模式。因为每次获取都需要检查队列，并且严格的 FIFO 顺序可能导致更多的线程上下文切换。适用于对公平性有强要求的场景。
* **低竞争下**: 当并发度不高，或许可证数量充足时，`acquire` 操作通常非常快（主要是 CAS 操作的成本）。
* **高竞争下**: 当大量线程争抢少量许可证时，性能会下降。这主要是因为：
  + **CAS 竞争加剧**: 多个线程同时尝试 `compareAndSetState`，失败的线程需要自旋重试，消耗 CPU。
  + **AQS 队列操作开销**: 大量线程入队、出队、阻塞、唤醒，这些操作本身有开销。
  + **上下文切换**: 线程阻塞和唤醒涉及操作系统层面的线程上下文切换，成本较高。

**可能遇到的性能瓶颈及原因：**

1. **极高的并发争抢 (High Contention)**:

   * **现象**: 系统吞吐量上不去，CPU 使用率（特别是在内核态）可能升高，线程分析显示大量线程在 `Semaphore.acquire()` 或相关 AQS 方法处阻塞或自旋。
   * **原因**: 如上所述，过多线程争抢过少许可，导致 CAS 失败率高、AQS 队列长、上下文切换频繁。
2. **过于频繁的获取和释放 (Frequent Acquire/Release)**:

   * **现象**: 即使竞争不激烈，但如果代码在一个紧密循环中极其频繁地调用 `acquire()` 和 `release()`，累积的 CAS 操作和 AQS 内部逻辑（即使很简单）也可能成为瓶颈。
   * **原因**: 每次调用都有固定的开销，频率过高会放大这个开销。
3. **公平模式下的开销**:

   * **现象**: 在相同负载下，公平模式比非公平模式慢。
   * **原因**: `hasQueuedPredecessors()` 的检查以及更严格的排队唤醒机制引入了额外开销。
4. **伪共享 (False Sharing)**:

   * **现象**: 在某些特定的多核 CPU 架构和高竞争场景下，AQS 内部的状态（如 `state` 变量、队列节点信息）可能与其他不相关的数据位于同一个缓存行 (Cache Line)。一个 CPU 核心修改 Semaphore 状态可能导致其他核心上缓存了该行的状态失效，即使其他核心关心的不是 Semaphore 的状态，也需要重新加载缓存，影响性能。
   * **原因**: 这是底层硬件缓存一致性协议带来的问题，虽然 AQS 内部有做一些优化尝试（如 `@sun.misc.Contended` 注解），但在极端情况下仍可能发生。

**优化和解决方案：**

1. **优先使用非公平模式**: 除非业务强需求公平性，否则默认使用非公平模式以获得更好的性能。
2. **调整许可证数量**: 确保 `permits` 数量设置合理。过少会人为制造瓶颈，过多则失去保护意义。可能需要根据实际负载进行压测和调优。
3. **批量操作**: 如果业务逻辑允许，尽量使用 `acquire(int n)` 和 `release(int n)` 进行批量获取和释放，减少调用次数和 CAS 竞争。
4. **减少锁粒度/持有时间**: 虽然 Semaphore 本身不是锁，但它保护的资源或代码段的执行时间也应尽量短。持有许可证的时间越长，其他线程等待的可能性和时间就越长。
5. **使用 `tryAcquire()`**: 对于可以容忍失败或有备用方案的场景，使用非阻塞或带超时的 `tryAcquire` 替代 `acquire`，可以避免线程长时间阻塞，提高系统响应性，并可能减少队列长度。
6. **更高级的并发工具**: 对于特定场景，可能有更优化的工具。例如，对于需要极高性能、极低延迟的限流场景，可能会考虑 Disruptor 框架或专门的硬件加速方案。对于读多写少的场景，`ReentrantReadWriteLock` 可能比用 Semaphore(1) 实现的互斥锁更好。
7. **监控和分析**: 使用 JMX 监控 `Semaphore` 的队列长度 (`getQueueLength()`)、可用许可 (`availablePermits()`)，结合线程 dump (`jstack`) 和性能分析工具 (JProfiler, Arthas) 来定位具体的性能瓶颈点。

**总结**: Semaphore 在大多数情况下性能良好，但高竞争和不当使用可能导致瓶颈。理解其性能特点，合理选择公平性，优化使用方式，并结合监控工具进行分析，是确保其在项目中发挥最佳效果的关键。

---

### 5. 思考题

#### 5.1 如何设计一个基于 Semaphore 的连接池？

我们在前面已经给出了一个简化的示例。现在，让我们更系统地思考一下设计一个稍微完善一点的、基于 Semaphore 的数据库连接池需要考虑哪些要素：

**设计要点：**

1. **核心组件**:

   * **Semaphore**: 用于控制并发获取连接的数量。`permits` 应该设置为连接池的最大活跃连接数。选择公平模式可能更合适，避免某些请求饿死。
   * **连接存储**: 需要一个线程安全的数据结构来存储空闲的连接。`ConcurrentLinkedQueue` 是一个不错的选择，它是非阻塞且线程安全的。也可以用 `BlockingQueue`（如 `LinkedBlockingQueue`），但要注意其阻塞特性可能与 Semaphore 的等待产生交互影响。
   * **配置参数**: 最大连接数 (`maxPoolSize`)、最小空闲连接数 (`minIdle`)、连接超时时间 (`connectionTimeout`)、空闲连接超时时间 (`idleTimeout`)、连接有效性检查查询 (`validationQuery`) 等。
2. **获取连接 (`getConnection`) 逻辑**:

   * **获取许可**: 调用 `semaphore.tryAcquire(connectionTimeout, TimeUnit.MILLISECONDS)`。如果超时，则获取失败，抛出异常或返回 null。
   * **获取连接实体**:
     + 从连接存储（如 `ConcurrentLinkedQueue`）中 `poll()` 一个连接。
     + **如果获取到连接**:
       - **校验连接有效性**: 执行 `connection.isValid(validationTimeout)` 或执行一个简单的 `validationQuery`。
       - 如果连接无效，关闭该连接，并 **递归或循环** 尝试获取下一个（注意处理重试次数，防止无限循环）。获取到有效连接后返回。
       - 如果连接有效，直接返回。
     + **如果未获取到连接 (池空)**: 这种情况理论上不应在 `acquire` 成功后立即发生（除非池大小动态变化或有bug），但需要考虑。可以尝试动态创建新连接（如果当前总连接数未达上限），或者认为这是一个错误状态（因为 `acquire` 成功了），此时 **必须释放刚刚获取的许可**，然后抛出异常。
   * **异常处理**: 在整个获取过程中，如果发生任何异常（如 `SQLException`, `InterruptedException`），并且已经成功 `acquire` 了许可，**必须在 `finally` 块中 `release` 这个许可**，然后重新抛出异常。
3. **释放连接 (`releaseConnection`) 逻辑**:

   * **检查连接状态**: 确保归还的连接非 null，并且可能需要检查是否处于事务中（如果需要自动回滚/提交）。
   * **清理连接状态**: 重置连接的事务状态、清除警告等。
   * **归还到池**: 将连接 `offer()` 回连接存储（如 `ConcurrentLinkedQueue`）。
   * **释放许可**: 调用 `semaphore.release()`。**注意**: 应该在连接成功放回存储 *之后* 再释放许可。如果放回失败（比如队列满了？），则不应释放许可，并可能需要关闭这个无法归还的连接。
4. **后台任务 (可选但推荐)**:

   * **空闲连接管理**: 定期检查连接存储中的空闲连接。关闭超过 `idleTimeout` 未使用的连接（同时需要考虑维护 `minIdle` 数量）。
   * **连接补充**: 如果当前总连接数低于 `minIdle`，可以尝试创建新连接补充到池中（但总数不能超过 `maxPoolSize`）。
   * **连接保活**: 定期对空闲连接执行有效性检查，保持连接活跃。
5. **线程安全**: 除了 Semaphore 控制并发获取外，对连接存储本身的访问（`poll`, `offer`）以及对连接池状态变量（如当前连接数）的维护都需要保证线程安全。使用 `ConcurrentLinkedQueue` 可以简化存储的线程安全问题。状态变量可以使用 `AtomicInteger` 等原子类。

**简化代码骨架 (仅示意)**:

```
import java.sql.Connection;
import java.sql.SQLException;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

class MyConnectionPool {
    private final ConcurrentLinkedQueue<ConnectionWrapper> idleConnections;
    private final Semaphore semaphore;
    private final int maxSize;
    private final long connectionTimeoutMs;
    // ... 其他配置 ...
    private final AtomicInteger totalConnections = new AtomicInteger(0); // 当前总连接数

    // 内部类包装 Connection，可以附加状态如 lastAccessTime
    private static class ConnectionWrapper {
        Connection connection;
        long lastAccessTime;
        // ...
    }

    public MyConnectionPool(int maxSize, long timeoutMs /*...*/) {
        this.maxSize = maxSize;
        this.semaphore = new Semaphore(maxSize, true); // 公平模式
        this.idleConnections = new ConcurrentLinkedQueue<>();
        this.connectionTimeoutMs = timeoutMs;
        // 初始化最小空闲连接...
    }

    public Connection getConnection() throws SQLException, InterruptedException {
        // 1. 获取许可
        if (!semaphore.tryAcquire(connectionTimeoutMs, TimeUnit.MILLISECONDS)) {
            throw new SQLException("Timeout waiting for connection permit.");
        }

        ConnectionWrapper wrapper = null;
        Connection conn = null;
        boolean acquiredPermit = true; // 标记已获取许可

        try {
            // 2. 从空闲队列获取
            while ((wrapper = idleConnections.poll()) != null) {
                conn = wrapper.connection;
                if (isValid(conn)) { // 假设 isValid 是校验方法
                    wrapper.lastAccessTime = System.currentTimeMillis();
                    System.out.println(Thread.currentThread().getName() + " got connection from pool.");
                    return conn; // 获取成功
                } else {
                    // 无效连接，关闭并尝试下一个
                    closeQuietly(conn);
                    totalConnections.decrementAndGet(); // 总连接数减少
                }
            }

            // 3. 如果空闲队列为空，尝试创建新连接（如果未达上限）
            if (totalConnections.get() < maxSize) {
                if (totalConnections.incrementAndGet() <= maxSize) { // 双重检查避免超限
                    System.out.println(Thread.currentThread().getName() + " creating new connection.");
                    conn = createNewConnection(); // 假设是创建方法
                    if (conn != null) {
                       // 创建成功，不需要包装，直接返回
                       return conn;
                    } else {
                       totalConnections.decrementAndGet(); // 创建失败，计数回滚
                       // 创建失败也算获取失败的一种，需要释放许可后抛异常
                       throw new SQLException("Failed to create new connection.");
                    }
                } else {
                    // increment 后发现超限了，回滚
                    totalConnections.decrementAndGet();
                }
            }

             // 如果达到上限且池空（理论上acquire成功后不应立即如此，除非并发竞争激烈或有延迟）
             // 等待一小会儿再试？或者直接认为失败？
             // 简单处理：认为获取失败
            throw new SQLException("Connection pool exhausted and cannot create more.");


        } catch (Exception e) {
            // 任何异常，如果已获取许可，必须释放
            if (acquiredPermit) {
                semaphore.release();
            }
            if (e instanceof SQLException) throw (SQLException) e;
            if (e instanceof InterruptedException) throw (InterruptedException) e;
            throw new RuntimeException(e);
        }
        // 注意：上面的逻辑可能需要更精细的处理，例如获取失败时的许可释放
        // 返回前不需要释放许可，因为调用者会负责 releaseConnection
    }

    public void releaseConnection(Connection conn) {
        if (conn == null) return;

        // 清理、包装等...
        ConnectionWrapper wrapper = new ConnectionWrapper();
        wrapper.connection = conn;
        wrapper.lastAccessTime = System.currentTimeMillis();

        // 归还到池
        if (idleConnections.offer(wrapper)) {
            System.out.println(Thread.currentThread().getName() + " released connection to pool.");
            semaphore.release(); // 归还成功后释放许可
        } else {
            // 归还失败？队列满了？或者其他原因？
            // 不释放许可，关闭连接
            System.err.println(Thread.currentThread().getName() + " failed to release connection to pool. Closing.");
            closeQuietly(conn);
            totalConnections.decrementAndGet();
        }
    }

    // 辅助方法：isValid, createNewConnection, closeQuietly ...
    private boolean isValid(Connection conn) { /* ... */ return true;}
    private Connection createNewConnection() throws SQLException { /* ... */ return null;}
    private void closeQuietly(Connection conn) { /* ... */}

}


```

这只是一个更详细的骨架，真实的连接池还需要考虑很多细节和边界情况。但核心思想是利用 Semaphore 控制并发访问，并配合线程安全的队列来管理连接实体。

---

#### 5.2 分布式环境下，Semaphore 有什么局限性？如何解决？

**局限性：**

`java.util.concurrent.Semaphore` 是一个 **纯粹的 JVM 内存级别** 的同步工具。它的所有状态（许可证数量 `state`、等待队列）都存储在 **单个 JVM 进程的内存** 中。

这意味着：

* **无法跨 JVM 工作**: 它不能用于协调部署在 **不同机器** 或 **同一机器上不同 Java 进程** 中的线程。每个 JVM 实例都有自己独立的 Semaphore，它们之间互不影响。
* **单点故障**: 如果运行 Semaphore 的那个 JVM 进程崩溃了，那么这个 Semaphore 的状态就丢失了，无法进行协调。

**简单来说，`java.util.concurrent.Semaphore` 不是分布式的。**

**分布式场景下的需求：**

在微服务架构或分布式系统中，我们经常遇到需要在 **多个服务实例之间** 控制对共享资源的访问数量的场景，例如：

* 控制调用某个**下游有限容量服务**（比如第三方 API）的总并发数。
* 限制访问某个**共享存储**（如分布式缓存、数据库表）的全局并发写入/读取操作。
* 实现全局的**分布式限流**。

**解决方案：分布式信号量 (Distributed Semaphore)**

为了解决 `java.util.concurrent.Semaphore` 的局限性，我们需要使用 **分布式信号量** 的实现。分布式信号量将信号量的状态存储在所有服务实例都能访问的 **外部共享存储** 中，并提供原子性的 `acquire` 和 `release` 操作。

常见的实现方式依赖于以下技术：

1. **基于 Redis 实现**:

   * **思路**: 利用 Redis 的原子操作（如 `SETNX`, Lua 脚本, `INCR`/`DECR` 配合 list/zset 做等待队列）来模拟信号量的计数和排队。
   * **优点**: Redis 性能高，延迟低，很多系统已经在使用 Redis，集成方便。
   * **实现库**: 很多 Redis 客户端库提供了分布式锁和信号量的实现，例如 **Redisson** 库就提供了 `RSemaphore` 接口，其 API 与 JUC 的 `Semaphore` 非常相似，但其状态是存储在 Redis 中的。
   * **示例 (使用 Redisson)**:

     ```
     // 配置 Redisson 客户端 (连接到 Redis 服务器)
     Config config = new Config();
     config.useSingleServer().setAddress("redis://127.0.0.1:6379");
     RedissonClient redisson = Redisson.create(config);

     // 获取分布式信号量实例
     RSemaphore semaphore = redisson.getSemaphore("myDistributedSemaphore");

     // 设置总许可数量 (只需要初始化一次)
     // semaphore.trySetPermits(10);

     try {
         // 尝试获取一个许可，可以带超时
         if (semaphore.tryAcquire(1, 10, TimeUnit.SECONDS)) {
             try {
                 System.out.println("成功获取分布式信号量许可，执行分布式任务...");
                 // ... 执行需要跨 JVM 控制并发的操作 ...
             } finally {
                 semaphore.release(); // 释放分布式信号量许可
                 System.out.println("分布式任务完成，释放许可。");
             }
         } else {
             System.out.println("获取分布式信号量许可超时。");
         }
     } catch (InterruptedException e) {
         Thread.currentThread().interrupt();
     } finally {
         // redisson.shutdown(); // 关闭 Redisson 客户端
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
     ```
2. **基于 ZooKeeper 实现**:

   * **思路**: 利用 ZooKeeper 的特性：
     + 创建一个持久节点作为信号量的根节点。
     + 每个请求 `acquire` 的线程在根节点下创建一个 **顺序 (Sequential) + 临时 (Ephemeral)** 的子节点。
     + 通过 `getChildren()` 获取所有子节点并排序，判断自己的序号是否在前 N (N 为许可证数量) 位。如果是，则获取成功。
     + 如果不是，则 `watch` 前一个序号的节点。当前一个节点被删除（表示释放）时，收到通知，重新检查自己的序号。
     + 临时节点的特性保证了如果客户端崩溃，其创建的节点会自动删除，相当于自动释放了许可。
   * **优点**: ZooKeeper 提供强一致性保证，适合需要高可靠性的场景。临时节点能很好地处理客户端崩溃的情况。
   * **缺点**: ZooKeeper 性能相对 Redis 较低，写操作压力大时可能成为瓶颈。“惊群效应” (Herd Effect) 可能需要额外处理（比如只 watch 前一个节点）。
   * **实现库**: Apache Curator 框架提供了 `InterProcessSemaphoreV2` 类，封装了基于 ZooKeeper 实现分布式信号量的复杂逻辑。
3. **基于数据库实现**:

   * **思路**: 使用数据库表来存储信号量的状态和等待队列。利用数据库事务和行级锁来实现原子性的 `acquire` 和 `release`。
   * **优点**: 如果系统已经依赖数据库，无需引入新组件。
   * **缺点**: 性能通常最低，数据库可能成为瓶颈。实现原子操作和排队逻辑相对复杂。

**总结**: `java.util.concurrent.Semaphore` 无法直接用于分布式环境。当需要跨 JVM 控制并发时，必须使用 **分布式信号量**。基于 Redis (如 Redisson) 和 ZooKeeper (如 Curator) 是目前主流且成熟的解决方案，各有优劣，需要根据具体场景（性能要求、一致性要求、系统现有技术栈）进行选择。

---

### 6. 总结

让我们回顾一下关键点：

* **核心价值**: Semaphore 是 JUC 中强大的 **并发流量控制器**，用于限制同时访问特定资源的线程数量，是管理有限资源、实现限流、控制并发度的利器。
* **工作机制**: 通过内部 **计数器 (permits)** 和 `acquire()` / `release()` 方法，结合 **AQS 框架** 提供的原子状态更新 (CAS) 和线程排队/唤醒机制来实现同步。
* **公平与非公平**: 非公平模式（默认）性能更高，但可能导致线程饥饿；公平模式保证 FIFO，但性能较低。选择取决于业务需求。
* **关键用法**: 资源池（如数据库连接池）管理、并发任务数控制、简单限流。
* **源码核心**: 基于 AQS 的 **共享模式**，`state` 代表许可证数量，`tryAcquireShared` 和 `tryReleaseShared` 是核心逻辑实现。
* **注意事项**: **必须在 `finally` 块中 `release()`** 防止许可证泄漏；警惕与其他锁结合或嵌套使用时可能引发的死锁；关注高竞争下的性能表现。
* **分布式局限**: JUC 的 Semaphore 仅限 **单 JVM**，跨 JVM 需使用 **分布式信号量**（如基于 Redis 或 ZooKeeper 的实现）。

Semaphore 体现了并发编程中的一种重要思想：**不是完全禁止并发，而是对并发进行有效的管理和控制**。它允许我们在系统的吞吐量和稳定性之间找到一个平衡点。

掌握 Semaphore，不仅意味着你学会了一个具体的 JUC 工具类，更重要的是，你理解了并发控制的一种核心策略，并对 AQS 的工作原理有了更深的体会。

希望这篇万字长文能让你理解和使用 Semaphore .

码字不易,且看且珍惜bro.

Happy coding!
