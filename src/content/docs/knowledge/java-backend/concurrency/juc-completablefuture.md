---
title: "JUC- CompletableFuture"
description: "Java 从早期就提供了 Thread 和 Runnable 来支持并发，后来引入了 ExecutorService 和 Future 来简化线程管理和获取异步结果。然而，Future 接口本身存在一些局限性，例如 get() 方法的阻塞性、缺乏方便的回调机制以及组合多个任务能力的不足。"
sourceId: "147267695"
source: "https://blog.csdn.net/qq_45852626/article/details/147267695"
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
  order: 147267695
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/147267695)（历史文章导入，当前状态为草稿）

## 引言

Java 从早期就提供了 `Thread` 和 `Runnable` 来支持并发，后来引入了 `ExecutorService` 和 `Future` 来简化线程管理和获取异步结果。然而，`Future` 接口本身存在一些局限性，例如 `get()` 方法的阻塞性、缺乏方便的回调机制以及组合多个任务能力的不足。

为了解决这些痛点，Java 8 引入了 `CompletableFuture`，它不仅实现了 `Future` 接口，还实现了 `CompletionStage` 接口，带来了函数式编程、流式API、非阻塞操作以及强大的任务编排能力。  
 `CompletableFuture` 极大地简化了异步编程的复杂性，让开发者能够以更声明式、更流畅的方式构建复杂的异步工作流。

## 一、基础概念与核心原理

### 1.1 CompletableFuture 是什么？与 Future 的对比

`CompletableFuture<T>` 是 Java 8 提供的一个类，用于简化异步编程。它代表一个可能尚未完成的异步计算的结果。你可以把它看作是 `Future` 的一个功能极其丰富的增强版。

**Future 的局限性回顾：**

1. **阻塞获取结果:** `Future.get()` 方法会阻塞当前线程，直到异步任务完成并返回结果。如果任务耗时很长，这将严重影响程序的响应性和吞吐量。
2. **轮询检查状态:** 需要通过 `isDone()` 方法不断轮询来判断任务是否完成，代码冗余且效率低下。
3. **缺乏回调机制:** `Future` 本身不直接支持在任务完成后自动执行后续操作（回调）。开发者需要自己实现逻辑来处理结果。
4. **组合能力弱:** 难以将多个 `Future` 的结果组合起来进行处理。
5. **异常处理繁琐:** 必须在调用 `get()` 时通过 `try-catch` 块来捕获异步任务中抛出的异常。

**CompletableFuture 的优势：**

`CompletableFuture` 克服了 `Future` 的所有缺点，并提供了更多强大的功能：

1. **非阻塞:** 可以通过回调机制（如 `thenApply`, `thenAccept`）在任务完成后执行后续操作，而无需阻塞等待。
2. **函数式编程:** 大量使用 Lambda 表达式和函数式接口，代码更简洁、易读。
3. **流式 API (CompletionStage):** 提供了丰富的 API (如 `thenApply`, `thenCompose`, `thenCombine`, `allOf`, `anyOf` 等) 用于链式调用和任务编排，可以清晰地描述复杂的异步工作流。
4. **显式完成控制:** 可以通过 `complete(T value)` 或 `completeExceptionally(Throwable ex)` 方法手动完成一个 `CompletableFuture`，这在某些场景下非常有用。
5. **完善的异常处理:** 提供了 `exceptionally`, `handle`, `whenComplete` 等方法来优雅地处理异步执行过程中的异常。

**核心理念理解：**

可以把 `Future` 想象成一个“提货单”。你提交任务（下单），拿到提货单（Future），但想知道货到了没（`isDone()`）或者取货（`get()`），要么不停去仓库问，要么在仓库门口死等。这种方式比较被动。

`CompletableFuture` 则更像一个智能化的“订单处理系统”。你提交订单后，系统不仅会处理，你还可以预先设定好一系列后续步骤：订单处理完后（任务完成），自动进行包装（`thenApply` 转换结果），然后发货（`thenAccept` 消费结果），或者根据订单类型启动另一个生产任务（`thenCompose` 链式异步）。整个过程是“事件驱动”的，任务完成后会自动“推送”结果到下一步，无需你主动、阻塞式地去拉取。

这种从“拉模式”（Pull，主动获取）到“推模式”（Push，被动接收通知并处理）的转变，是 `CompletableFuture` 相对于 `Future` 的核心进步。

### 1.2 核心原理：事件驱动与回调

`CompletableFuture` 的异步和回调能力主要基于以下原理：

1. **内部状态管理:**

   * 每个 `CompletableFuture` 对象内部维护着任务的执行状态（如：未完成 `NEW`、正常完成 `NORMAL`、异常完成 `EXCEPTIONAL`、已取消 `CANCELLED`）以及最终的结果（正常完成时的值 `T`）或异常（异常完成时的 `Throwable`）。
   * 状态的核心载体通常是一个 `volatile` 修饰的 `result` 字段。`volatile` 保证了该字段在多线程间的可见性。
   * 状态的转换（从未完成到完成/异常）是关键操作。为了保证线程安全，这个转换过程通常不使用传统的 `synchronized` 重量级锁，而是依赖 **CAS (Compare-And-Swap)** 原子操作。
2. **回调链 (Completion Stack/List):**

   * 当你调用 `thenApply`, `thenAccept`, `thenCompose` 等方法注册回调逻辑时，这些回调操作（通常被封装成一个内部的 `Completion` 对象）并不会立即执行。
   * 它们会被添加到一个与当前 `CompletableFuture` 实例关联的数据结构中。这个结构在逻辑上像一个栈（后注册的回调可能先被触发执行，但具体调度依赖实现和线程模型），通常实现为一个 **无锁链表 (Treiber Stack)**。这个链表的头节点由一个 `volatile` 修饰的 `stack` 字段指向。
   * 同样，回调的添加（入栈）过程也使用 CAS 操作来保证线程安全。
3. **完成触发 (Completion Triggering):**

   * 当一个 `CompletableFuture` 的状态从未完成变为完成（无论是正常 `complete(T)` 还是异常 `completeExceptionally(Throwable)`）时，这个“完成事件”会触发一个核心的后续处理逻辑（例如内部的 `postComplete()` 方法）。
   * 这个状态转变通常是通过 CAS 原子地更新 `result` 字段来完成的。只有第一个成功更新 `result` 的线程才能触发后续的回调执行。
4. **回调执行:**

   * `postComplete()` 方法会遍历当前 `CompletableFuture` 实例的 `Completion` 链表（栈）。
   * 对于链表中的每一个 `Completion` 对象，系统会根据注册时的方法类型（同步 vs 异步）以及当前的完成状态，决定在哪个线程中执行这个回调任务。
     + **同步回调 (如 `thenApply`):** 可能在完成当前 Future 的线程中执行，也可能在调用 `thenApply` 的线程中执行（如果 Future 已完成）。
     + **异步回调 (如 `thenApplyAsync`):** 会将回调任务提交给指定的 `Executor`（线程池）执行。
   * 一个回调执行完成后，如果它本身也产生了一个新的 `CompletableFuture`（例如 `thenCompose` 的场景），那么这个新 Future 的完成又会触发它自己的回调链，如此递归下去。

**源码理解:**

```
// CompletableFuture 内部简化概念
private volatile Object result; // 存储结果或异常 (用 volatile 保证可见性)
private volatile Completion stack; // 指向回调链栈顶 (用 volatile 保证可见性)

// 尝试将结果原子性地设置进去，只有从未完成状态才能成功
// 这是 complete(T value) 和 completeExceptionally(Throwable ex) 的核心
boolean completeValue(T value) {
    // 使用 CAS 原子操作尝试将 result 从 null (或其他未完成标记) 更新为 value
    // 如果 casResult 成功，表示本线程是第一个完成该 Future 的线程
    // casResult 是对 Unsafe.compareAndSwapObject 或 VarHandle.compareAndSet 的封装
    if (casResult(null, value)) {
        // CAS 成功！状态从未完成变为正常完成
        // 触发后续回调的处理
        postComplete(); // 遍历 stack，执行回调
        return true;
    }
    // CAS 失败，说明 Future 已经被其他线程完成了
    return false;
}

// 添加回调到栈顶
// 这是 thenApply, thenAccept 等方法注册回调的核心
void pushCompletion(Completion c) {
    // 使用 CAS 原子操作尝试将 c 设置为新的栈顶，并将 c 的 next 指向旧的栈顶
    // casStack 是对 Unsafe.compareAndSwapObject 或 VarHandle.compareAndSet 的封装
    do {
        // 读取当前的栈顶 (volatile read)
        c.next = stack;
    } while (!casStack(c.next, c)); // CAS 尝试更新栈顶，失败则重试
}

// 完成后处理回调（简化概念）
void postComplete() {
    CompletableFuture<?> f = this;
    Completion h;
    // 使用 CAS 原子地将 stack 置为 null，获取整个回调链
    while ((h = f.stack) != null || (f != this && (h = (f = this).stack) != null)) {
        CompletableFuture<?> d; Completion t;
        // 尝试 CAS 将栈顶指针更新为下一个节点
        if (f.casStack(h, t = h.next)) {
            if (t != null) {
                // 如果栈中还有其他回调，尝试帮助执行（可选，提高并发度）
                if (f != this) {
                    pushStack(t); // 将剩余的链表放回原 Future
                } else {
                    h.next = null; // detach
                }
            }
            // 触发当前回调 h 的执行 (在合适的线程中)
            // h.tryFire 会根据类型（SYNC, ASYNC）和状态决定如何执行
            d = h.tryFire(SYNC); // 尝试同步执行
            if (d != null) { // 如果 tryFire 返回了依赖的 Future d
                f = d; // 下一轮循环处理 d 的回调链
            } else {
                f = this; // 回到处理当前 Future 的回调
            }
        }
    }
}

// --- 注释说明 ---
// 1. CAS (Compare-And-Swap): 这是无锁并发的核心。它尝试原子地更新一个变量的值：
//    比较变量当前内存值是否等于预期值，如果是，则将其更新为新值，返回 true；否则不更新，返回 false。
//    `casResult` 和 `casStack` 就是利用 CAS 来安全地更新 `result` 和 `stack` 字段。
// 2. volatile: 保证 `result` 和 `stack` 字段的修改对所有线程立即可见，防止读到旧数据。
// 3. 无锁栈 (Treiber Stack): `pushCompletion` 和 `postComplete` 中对 `stack` 的操作，
//    利用 CAS 实现了一个线程安全的、非阻塞的栈。添加回调和取出回调链都是无锁操作。
// 4. postComplete 触发: 当 `completeValue` (或 `completeExceptionally`) 成功通过 CAS 更新 `result` 后，
//    调用 `postComplete`。它会原子地取出整个回调链 (`stack`)，然后遍历并触发每个回调 (`h.tryFire`)。
// 5. tryFire 调度: `tryFire` 内部会判断回调类型（同步/异步），决定是在当前线程执行，
//    还是提交到线程池执行。这是实现不同执行策略的关键。


```

**理解辅助：**

整个机制就像一个“发布-订阅”系统。  
 `CompletableFuture` 是事件源（发布者），`thenApply` 等方法是订阅操作，注册的 `Completion` 对象是订阅者。  
 当 `CompletableFuture` 状态改变（事件发生）时，它会通知所有订阅者去执行它们预设的动作。  
 而 CAS 和 `volatile` 保证了在多线程环境下，状态更新和订阅者列表的维护都是安全且高效的（避免了重量级锁的开销）。异步执行的能力则来自于将回调任务提交给 `Executor`。

### 1.3 线程调度：默认与自定义

`CompletableFuture` 中的任务（包括初始任务和后续的回调任务）究竟在哪个线程中执行，取决于你调用的是哪种类型的方法：

1. **不带 `Async` 后缀的方法 (如 `thenApply`, `thenAccept`, `thenRun`)**:

   * **行为:** 这类方法的执行线程不是固定的，遵循“谁触发，谁执行（或调用者执行）”的原则。
     + **情况一：前置任务已经完成。** 当你调用 `thenApply` 时，如果它依赖的那个 `CompletableFuture` 已经处于完成状态，那么 `thenApply` 里的回调逻辑会 **立即在当前调用线程中执行**。
     + **情况二：前置任务尚未完成。** 当你调用 `thenApply` 时，如果前置任务还在运行（比如在某个线程池的线程 T1 中），那么这个回调逻辑会被“挂起”。当线程 T1 完成了前置任务后，**它会“顺便”继续执行这个 `thenApply` 的回调逻辑**。
   * **风险:** 这种“顺便执行”的机制需要特别小心！如果完成前置任务的线程是一个关键线程（比如 UI 线程、Netty 的 IO 线程），或者你的回调逻辑本身是一个耗时操作（比如进行了阻塞 IO、复杂计算），那么这种同步执行就会阻塞这个关键线程，可能导致 UI 卡顿、IO 吞吐量下降甚至死锁。
   * **建议:** **只有当回调逻辑非常轻量级、执行速度极快且绝不阻塞时，才应该使用不带 `Async` 后缀的方法。**
2. **带 `Async` 后缀的方法 (如 `thenApplyAsync`, `thenRunAsync`, `thenAcceptAsync`)**:

   * **行为:** 这类方法会将回调任务 **提交给一个指定的 `Executor` (线程池) 来异步执行**。这会与完成前置任务的线程以及调用 `thenApplyAsync` 的线程解耦。
   * **默认线程池:** 如果你不指定 `Executor` 参数（例如 `thenApplyAsync(fn)`），`CompletableFuture` **默认使用 `ForkJoinPool.commonPool()`**。
     + `ForkJoinPool` 是 Java 7 引入的一个线程池，特别适合 CPU 密集型的计算任务。它采用了 **工作窃取 (Work-Stealing)** 算法，可以有效利用多核 CPU，提高并行计算效率。
     + `commonPool()` 是一个 JVM 全局共享的静态线程池。其默认大小通常是 `Runtime.getRuntime().availableProcessors() - 1`（但至少为 1）。
     + **注意:** 如果 JVM 可用处理器数为 1，`commonPool()` 的行为会退化，可能会为每个任务创建一个新线程，行为类似于 `newCachedThreadPool`，但这依赖于具体 JDK 实现细节。
     + **风险:** 正因为 `commonPool()` 是全局共享的，如果你的应用程序中（包括其他库或框架）有大量任务（特别是 IO 密集型或长时间阻塞的任务）不加区分地都提交给 `commonPool()`，就可能导致其线程资源被耗尽或全部阻塞，进而影响所有依赖 `commonPool()` 的异步任务（包括并行流 `parallelStream()` 等）的执行，造成全局性能问题。
   * **自定义线程池:** 你可以通过传递一个 `Executor` 实例作为第二个参数（例如 `thenApplyAsync(fn, myExecutor)`）来 **指定使用自定义的线程池**。
     + **为什么需要自定义？**
       - **任务隔离:** 不同类型的任务（如 CPU 密集型 vs IO 密集型）对线程池的需求不同。IO 密集型任务大部分时间在等待，需要较多的线程来提高并发度；CPU 密集型任务需要接近 CPU 核心数的线程数以避免过多上下文切换。使用独立的线程池可以避免相互干扰。
       - **资源控制:** 可以为不同业务或不同优先级的任务配置不同的线程池，进行资源限制和隔离。
       - **避免 `commonPool()` 污染:** 防止自己的耗时任务阻塞全局共享的 `commonPool()`。
     + **如何自定义？** 创建一个 `ThreadPoolExecutor` 或其他 `Executor` 实例，根据任务特性合理配置核心线程数、最大线程数、队列类型、拒绝策略等参数，然后将其传入 `Async` 方法即可。

**理解辅助：**

选择哪个线程执行，关键看你是否想要解耦。

* 不带 `Async`：追求低延迟，省去线程切换开销，但有阻塞关键线程的风险。适合极简、非阻塞的回调。
* 带 `Async`：追求隔离和安全，将任务交给专门的线程池处理，避免互相影响。
  + 用默认 `commonPool()`：方便，适合 CPU 密集型任务，但要小心别把它“玩坏了”。
  + 用自定义 `Executor`：最佳实践，尤其是对于 IO 密集型或需要资源隔离的任务，可以精细化控制。

在高并发和复杂应用中，**强烈建议为不同类型的异步任务创建和使用自定义的线程池**。

---

## 二、创建与使用 CompletableFuture

### 2.1 常用创建方式

`CompletableFuture` 类提供了一系列静态工厂方法来创建实例：

1. **`runAsync(Runnable runnable)` / `runAsync(Runnable runnable, Executor executor)`**

   * **作用:** 用于执行一个 **没有返回值** 的异步任务 (`Runnable`)。
   * **线程池:** 默认使用 `ForkJoinPool.commonPool()`，可传入自定义 `Executor` 指定线程池。
   * **返回:** `CompletableFuture<Void>`。因为 `Runnable` 不返回值，所以泛型类型是 `Void`。
   * **场景:** 当你只想异步执行一个操作，不关心其结果时，例如异步记录日志、发送通知（发出去即可）。
   * **示例:**

     ```
     // 使用默认 commonPool
     CompletableFuture<Void> future1 = CompletableFuture.runAsync(() -> {
         System.out.println("异步任务正在执行 (无返回值)... Thread: " + Thread.currentThread().getName());
         // 模拟耗时操作
         try { Thread.sleep(1000); } catch (InterruptedException e) {}
     });

     // 使用自定义线程池
     ExecutorService myExecutor = Executors.newFixedThreadPool(2);
     CompletableFuture<Void> future2 = CompletableFuture.runAsync(() -> {
         System.out.println("使用自定义线程池执行异步任务 (无返回值)... Thread: " + Thread.currentThread().getName());
     }, myExecutor);

     // 等待任务完成 (仅为演示，实际中通常使用回调)
     future1.join();
     future2.join();
     myExecutor.shutdown(); // 关闭自定义线程池


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
     ```
2. **`supplyAsync(Supplier<U> supplier)` / `supplyAsync(Supplier<U> supplier, Executor executor)`**

   * **作用:** 用于执行一个 **有返回值** 的异步任务 (`Supplier<U>`)。`Supplier` 是一个函数式接口，代表一个生产者，其 `get()` 方法返回结果 `U`。
   * **线程池:** 默认使用 `ForkJoinPool.commonPool()`，可传入自定义 `Executor` 指定线程池。
   * **返回:** `CompletableFuture<U>`，泛型类型 `U` 就是 `Supplier` 返回值的类型。
   * **场景:** 这是 **最常用** 的创建方式。当你需要异步执行一个操作并获取其结果时，例如异步查询数据库、调用远程 API。
   * **示例:**

     ```
     // 使用默认 commonPool
     CompletableFuture<String> future1 = CompletableFuture.supplyAsync(() -> {
         System.out.println("异步任务正在执行 (有返回值)... Thread: " + Thread.currentThread().getName());
         // 模拟耗时操作
         try { Thread.sleep(1000); } catch (InterruptedException e) {}
         return "异步任务结果";
     });

     // 使用自定义线程池
     ExecutorService myExecutor = Executors.newFixedThreadPool(2);
     CompletableFuture<Integer> future2 = CompletableFuture.supplyAsync(() -> {
         System.out.println("使用自定义线程池执行异步任务 (有返回值)... Thread: " + Thread.currentThread().getName());
         return 123;
     }, myExecutor);

     // 获取结果 (仅为演示，实际中通常使用回调)
     String result1 = future1.join(); // join() 会阻塞等待结果，如果异常则抛出未受检异常
     Integer result2 = future2.get(); // get() 会阻塞等待结果，如果异常则抛出受检异常 ExecutionException
     System.out.println("结果1: " + result1);
     System.out.println("结果2: " + result2);
     myExecutor.shutdown();


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
     ```
3. **`completedFuture(U value)`**

   * **作用:** 创建一个 **已经完成** 并且拥有给定值的 `CompletableFuture`。
   * **返回:** `CompletableFuture<U>`。
   * **场景:**
     + 当需要构建一个异步调用链，但链条的起点是一个已知的、确定的值时。
     + 在测试中模拟一个已经完成的异步操作。
     + 将一个普通值包装成 `CompletableFuture` 以适配需要 `CompletionStage` 的 API。
   * **示例:**

     ```
     CompletableFuture<String> future = CompletableFuture.completedFuture("这是一个已知结果");
     System.out.println("Future 是否完成? " + future.isDone()); // 输出 true
     System.out.println("结果: " + future.join()); // 不会阻塞，立即返回


     + 1
     + 2
     + 3
     ```
4. **`failedFuture(Throwable ex)` (Java 9+)**

   * **作用:** 创建一个 **已经以给定异常完成** 的 `CompletableFuture`。
   * **返回:** `CompletableFuture<T>` (泛型类型通常由上下文推断或指定为 `Object`)。
   * **场景:**
     + 在测试异常处理流程时，快速创建一个失败状态的 Future。
     + 构建一个需要立即失败的异步链。
   * **示例:**

     ```
     // Java 9+
     // CompletableFuture<Object> future = CompletableFuture.failedFuture(new RuntimeException("模拟任务失败"));
     // System.out.println("Future 是否完成? " + future.isDone()); // 输出 true
     // System.out.println("Future 是否异常完成? " + future.isCompletedExceptionally()); // 输出 true
     // try {
     //     future.join();
     // } catch (CompletionException e) {
     //     System.out.println("捕获到异常: " + e.getCause()); // 输出 RuntimeException
     // }


     + 1
     + 2
     + 3
     + 4
     + 5
     + 6
     + 7
     + 8
     + 9
     ```

**创建方式选择小结：**

* 要 **启动新的异步任务**？
  + 需要返回值 -> `supplyAsync`
  + 不需要返回值 -> `runAsync`
  + **关键：** 考虑是否传入自定义 `Executor` 来隔离线程池。
* 要 **基于已知状态开始**？
  + 基于已知的值 -> `completedFuture`
  + 基于已知的错误 -> `failedFuture` (Java 9+)

`supplyAsync` 和 `runAsync` 是真正开启异步世界的入口，而 `completedFuture` 和 `failedFuture` 提供了构建和测试 `CompletableFuture` 链的便利性。

### 2.2 核心回调方法详解

`CompletableFuture` 的强大之处在于其丰富的回调方法（都定义在 `CompletionStage` 接口中），允许你像搭积木一样构建异步处理流程。这些方法通常以 `then` 开头，表示“当前任务完成后，接着做…”

以下是最核心的几组回调方法：

**1. 处理结果并转换 (T -> U): `thenApply` / `thenApplyAsync`**

* **`thenApply(Function<? super T, ? extends U> fn)`**
* **`thenApplyAsync(Function<? super T, ? extends U> fn)`**
* **`thenApplyAsync(Function<? super T, ? extends U> fn, Executor executor)`**
* **作用:** 接收一个 `Function` 函数式接口。该函数会 **接收上一步的结果 `T`** 作为输入，对其进行 **转换或处理**，并 **返回一个新的结果 `U`**。
* **返回:** 一个新的 `CompletableFuture<U>`，代表转换后的结果。
* **线程:** `thenApply` 的执行线程如 1.3 节所述（可能同步执行）；`thenApplyAsync` 则在指定（或默认）的线程池中异步执行。
* **场景:** 当你需要基于上一步的异步结果进行进一步的计算、转换或处理，并且需要得到这个处理后的新结果时。例如：异步获取用户 ID 后，接着同步/异步查询用户详细信息。
* **示例:**

```
CompletableFuture<Integer> initialFuture = CompletableFuture.supplyAsync(() -> {
    System.out.println("步骤1: 获取初始数字... Thread: " + Thread.currentThread().getName());
    return 10;
});

// 同步转换 (可能在步骤1的线程或调用线程执行)
CompletableFuture<String> transformedFutureSync = initialFuture.thenApply(result -> {
    System.out.println("步骤2 (thenApply): 将数字转为字符串... Thread: " + Thread.currentThread().getName());
    return "结果是: " + result;
});

// 异步转换 (使用默认 commonPool)
CompletableFuture<String> transformedFutureAsync = initialFuture.thenApplyAsync(result -> {
    System.out.println("步骤3 (thenApplyAsync): 将数字乘以2转为字符串... Thread: " + Thread.currentThread().getName());
    return "乘以2的结果是: " + (result * 2);
});

// 异步转换 (使用自定义线程池)
ExecutorService myExecutor = Executors.newSingleThreadExecutor();
CompletableFuture<String> transformedFutureCustom = initialFuture.thenApplyAsync(result -> {
    System.out.println("步骤4 (thenApplyAsync + custom): 将数字加100转为字符串... Thread: " + Thread.currentThread().getName());
    return "加100的结果是: " + (result + 100);
}, myExecutor);

System.out.println(transformedFutureSync.join());
System.out.println(transformedFutureAsync.join());
System.out.println(transformedFutureCustom.join());

myExecutor.shutdown();


```

**2. 消费结果 (T -> Void): `thenAccept` / `thenAcceptAsync`**

* **`thenAccept(Consumer<? super T> action)`**
* **`thenAcceptAsync(Consumer<? super T> action)`**
* **`thenAcceptAsync(Consumer<? super T> action, Executor executor)`**
* **作用:** 接收一个 `Consumer` 函数式接口。该函数会 **接收上一步的结果 `T`** 作为输入，对其进行 **消费（执行某个操作）**，但 **不返回任何结果** (`void`)。
* **返回:** `CompletableFuture<Void>`。
* **线程:** `thenAccept` 同步执行；`thenAcceptAsync` 异步执行。
* **场景:** 当你只需要对上一步的结果执行某个动作（比如打印日志、更新数据库、发送通知），并且后续流程不再需要这个结果时。
* **示例:**

```
CompletableFuture<String> nameFuture = CompletableFuture.supplyAsync(() -> "Alice");

// 同步消费
CompletableFuture<Void> acceptFutureSync = nameFuture.thenAccept(name -> {
    System.out.println("接收到名字 (thenAccept): " + name + ", Thread: " + Thread.currentThread().getName());
});

// 异步消费
CompletableFuture<Void> acceptFutureAsync = nameFuture.thenAcceptAsync(name -> {
    System.out.println("异步接收到名字 (thenAcceptAsync): " + name + ", Thread: " + Thread.currentThread().getName());
});

acceptFutureSync.join();
acceptFutureAsync.join();


```

**3. 执行动作 (Void -> Void): `thenRun` / `thenRunAsync`**

* **`thenRun(Runnable action)`**
* **`thenRunAsync(Runnable action)`**
* **`thenRunAsync(Runnable action, Executor executor)`**
* **作用:** 接收一个 `Runnable` 函数式接口。在上一步任务完成后，执行 `Runnable` 中的操作。它 **不接收上一步的结果**，也 **不返回任何结果**。
* **返回:** `CompletableFuture<Void>`。
* **线程:** `thenRun` 同步执行；`thenRunAsync` 异步执行。
* **场景:** 当你只需要在上一步完成后触发一个与结果无关的动作时。例如：文件下载完成后，打印一条“下载完成”的日志。
* **示例:**

```
CompletableFuture<Void> downloadFuture = CompletableFuture.runAsync(() -> {
    System.out.println("开始下载... Thread: " + Thread.currentThread().getName());
    try { Thread.sleep(500); } catch (InterruptedException e) {}
});

// 下载完成后同步执行
CompletableFuture<Void> runFutureSync = downloadFuture.thenRun(() -> {
    System.out.println("下载完成 (thenRun)! Thread: " + Thread.currentThread().getName());
});

// 下载完成后异步执行
CompletableFuture<Void> runFutureAsync = downloadFuture.thenRunAsync(() -> {
    System.out.println("异步通知：下载完成 (thenRunAsync)! Thread: " + Thread.currentThread().getName());
});

runFutureSync.join();
runFutureAsync.join();


```

**4. 链式异步 (T -> CompletableFuture): `thenCompose` / `thenComposeAsync`**

* **`thenCompose(Function<? super T, ? extends CompletionStage<U>> fn)`**
* **`thenComposeAsync(Function<? super T, ? extends CompletionStage<U>> fn)`**
* **`thenComposeAsync(Function<? super T, ? extends CompletionStage<U>> fn, Executor executor)`**
* **作用:** 这是处理 **依赖性异步调用** 的 **关键** 方法。它接收一个 `Function`，该函数接收上一步的结果 `T`，并 **返回一个新的 `CompletionStage<U>` (通常就是 `CompletableFuture<U>`)**。
* **行为:** `thenCompose` 会等待上一步和 `Function` 返回的 `CompletableFuture` 都完成后，将后者的结果 `U` 作为最终结果。它起到了 **扁平化 (flatMap)** 的作用，避免了出现 `CompletableFuture<CompletableFuture<U>>` 这样的嵌套结构。
* **返回:** `CompletableFuture<U>`。
* **线程:** `thenCompose` 的 `Function` 本身的执行线程遵循同步规则，但它返回的 `CompletableFuture` 的执行则由其自身决定。`thenComposeAsync` 会在指定线程池中执行 `Function` 来获取下一个 `CompletableFuture`。
* **场景:** 当你的下一步操作本身也是一个异步操作，并且这个操作依赖于上一步的结果时。例如：异步获取用户ID后，需要拿着这个ID再去异步调用另一个服务查询用户订单。
* **对比 `thenApply`:** 如果你在 `thenApply` 的 `Function` 中返回了一个 `CompletableFuture`，那么 `thenApply` 的结果将是 `CompletableFuture<CompletableFuture<U>>`。而 `thenCompose` 会自动“解包”，直接得到 `CompletableFuture<U>`。
* **示例:**

```
// 模拟异步获取用户ID
CompletableFuture<Integer> getUserIdFuture = CompletableFuture.supplyAsync(() -> {
    System.out.println("步骤1: 获取用户ID... Thread: " + Thread.currentThread().getName());
    return 1001;
});

// 模拟异步根据用户ID获取用户名 (这是一个返回 Future 的函数)
Function<Integer, CompletableFuture<String>> getUserNameByIdAsync = userId ->
    CompletableFuture.supplyAsync(() -> {
        System.out.println("步骤2: 根据ID " + userId + " 获取用户名... Thread: " + Thread.currentThread().getName());
        try { Thread.sleep(500); } catch (InterruptedException e) {}
        return "User_" + userId;
    });

// 使用 thenCompose 连接两个异步操作
CompletableFuture<String> userNameFuture = getUserIdFuture.thenCompose(userId -> {
    System.out.println("thenCompose 的 Function 执行... Thread: " + Thread.currentThread().getName());
    // Function 返回的是一个新的 CompletableFuture
    return getUserNameByIdAsync.apply(userId);
});

// 如果用 thenApply 会发生什么？
CompletableFuture<CompletableFuture<String>> nestedFuture = getUserIdFuture.thenApply(userId -> {
    System.out.println("thenApply 的 Function 执行... Thread: " + Thread.currentThread().getName());
    // Function 返回的是一个新的 CompletableFuture
    return getUserNameByIdAsync.apply(userId);
});

System.out.println("使用 thenCompose 获取最终用户名: " + userNameFuture.join());

// 使用 thenApply 获取到的是嵌套的 Future
CompletableFuture<String> innerFuture = nestedFuture.join();
System.out.println("使用 thenApply 获取嵌套的 Future，再 join: " + innerFuture.join());

// 也可以使用 thenComposeAsync
ExecutorService myExecutorCompose = Executors.newCachedThreadPool();
CompletableFuture<String> userNameFutureAsync = getUserIdFuture.thenComposeAsync(userId -> {
     System.out.println("thenComposeAsync 的 Function 执行... Thread: " + Thread.currentThread().getName());
     return getUserNameByIdAsync.apply(userId);
}, myExecutorCompose);

System.out.println("使用 thenComposeAsync 获取最终用户名: " + userNameFutureAsync.join());
myExecutorCompose.shutdown();


```

**回调方法选择小结：**

问自己几个问题：

1. **下一步操作需要上一步的结果吗？**
   * 是 -> `thenApply` / `thenAccept` / `thenCompose`
   * 否 -> `thenRun`
2. **下一步操作需要返回结果给后续步骤吗？**
   * 是 -> `thenApply` / `thenCompose`
   * 否 -> `thenAccept` / `thenRun`
3. **下一步操作本身是异步的（返回 `CompletableFuture`）吗？**
   * 是 -> `thenCompose` (避免嵌套)
   * 否 -> `thenApply` / `thenAccept`
4. **下一步操作耗时或可能阻塞吗？或者需要与当前执行流程解耦吗？**
   * 是 -> 使用带 `Async` 后缀的版本 (`thenXxxAsync`)，并考虑提供自定义 `Executor`。
   * 否 -> 可以考虑使用不带 `Async` 的版本（但要非常小心）。

### 2.3 组合多个 CompletableFuture

除了链式调用，`CompletableFuture` 还提供了组合 **两个** 异步任务结果的方法。

**1. 合并两个结果 ((T, U) -> V): `thenCombine` / `thenCombineAsync`**

* **`thenCombine(CompletionStage<? extends U> other, BiFunction<? super T,? super U,? extends V> fn)`**
* **`thenCombineAsync(...)` / `thenCombineAsync(..., Executor executor)`**
* **作用:** 等待 **当前 `CompletableFuture` (结果 T)** 和 **另一个 `other` `CompletableFuture` (结果 U)** 都完成后，将两个结果 `T` 和 `U` 传给 `BiFunction` 函数 `fn`，计算出一个新的结果 `V`。
* **返回:** `CompletableFuture<V>`。
* **线程:** `fn` 的执行线程遵循 `thenCombine` (同步) 或 `thenCombineAsync` (异步) 的规则。
* **场景:** 当你需要等待两个 **独立不相关** 的异步任务都完成，然后使用它们各自的结果来执行下一步操作时。例如：异步查询用户基本信息和用户权限信息，两者都完成后，合并成一个包含完整信息的用户 DTO。
* **示例:**

```
CompletableFuture<String> getUserNameFuture = CompletableFuture.supplyAsync(() -> {
    try { Thread.sleep(300); } catch (InterruptedException e) {}
    return "Alice";
});
CompletableFuture<Integer> getUserAgeFuture = CompletableFuture.supplyAsync(() -> {
    try { Thread.sleep(500); } catch (InterruptedException e) {}
    return 30;
});

// 等待姓名和年龄都获取到后，合并成一句话
CompletableFuture<String> combinedFuture = getUserNameFuture.thenCombine(
    getUserAgeFuture, // 第二个 Future
    (name, age) -> { // BiFunction，接收两个结果
        System.out.println("thenCombine 的 BiFunction 执行... Thread: " + Thread.currentThread().getName());
        return name + " is " + age + " years old.";
    }
);

System.out.println("合并结果: " + combinedFuture.join());

// 也可以异步执行合并逻辑
ExecutorService combineExecutor = Executors.newFixedThreadPool(1);
CompletableFuture<String> combinedFutureAsync = getUserNameFuture.thenCombineAsync(
    getUserAgeFuture,
    (name, age) -> {
        System.out.println("thenCombineAsync 的 BiFunction 执行... Thread: " + Thread.currentThread().getName());
        return "Async: " + name + " is " + age + " years old.";
    },
    combineExecutor
);
System.out.println("异步合并结果: " + combinedFutureAsync.join());
combineExecutor.shutdown();


```

**2. 消费两个结果 ((T, U) -> Void): `thenAcceptBoth` / `thenAcceptBothAsync`**

* **`thenAcceptBoth(CompletionStage<? extends U> other, BiConsumer<? super T, ? super U> action)`**
* **`thenAcceptBothAsync(...)` / `thenAcceptBothAsync(..., Executor executor)`**
* **作用:** 类似 `thenCombine`，等待两个 `CompletableFuture` 都完成，但它接收一个 `BiConsumer`，只 **消费** 两个结果 `T` 和 `U`，**不返回** 新的结果。
* **返回:** `CompletableFuture<Void>`。
* **场景:** 当你需要等待两个独立异步任务完成，然后基于它们的结果执行一个动作，但不需要产生新值时。例如：订单创建成功并且支付成功后，发送一个通知。
* **示例:**

```
CompletableFuture<String> task1 = CompletableFuture.supplyAsync(() -> "任务1结果");
CompletableFuture<String> task2 = CompletableFuture.supplyAsync(() -> "任务2结果");

CompletableFuture<Void> acceptBothFuture = task1.thenAcceptBoth(task2, (result1, result2) -> {
    System.out.println("thenAcceptBoth 的 BiConsumer 执行... Thread: " + Thread.currentThread().getName());
    System.out.println("接收到: " + result1 + " 和 " + result2);
});

acceptBothFuture.join();


```

**3. 两者完成后执行动作 (Void -> Void): `runAfterBoth` / `runAfterBothAsync`**

* **`runAfterBoth(CompletionStage<?> other, Runnable action)`**
* **`runAfterBothAsync(...)` / `runAfterBothAsync(..., Executor executor)`**
* **作用:** 等待两个 `CompletableFuture` 都完成后，执行一个 `Runnable` 动作。它 **不关心** 这两个 `CompletableFuture` 的结果。
* **返回:** `CompletableFuture<Void>`。
* **场景:** 当你需要等待两个独立的异步任务都结束（无论成功或失败，只要完成即可），然后触发一个与它们结果无关的动作。例如：两个初始化任务都完成后，标记系统状态为“就绪”。
* **示例:**

```
CompletableFuture<Void> initTask1 = CompletableFuture.runAsync(() -> System.out.println("初始化任务1完成"));
CompletableFuture<Void> initTask2 = CompletableFuture.runAsync(() -> System.out.println("初始化任务2完成"));

CompletableFuture<Void> runAfterBothFuture = initTask1.runAfterBoth(initTask2, () -> {
    System.out.println("runAfterBoth 的 Runnable 执行... Thread: " + Thread.currentThread().getName());
    System.out.println("两个初始化任务都已完成！");
});

runAfterBothFuture.join();


```

**组合两个 Future 的方法小结：**

* 需要合并两个结果产生新结果？ -> `thenCombine` / `thenCombineAsync`
* 需要消费两个结果执行动作？ -> `thenAcceptBoth` / `thenAcceptBothAsync`
* 只需要等两个都完成再执行动作（不关心结果）？ -> `runAfterBoth` / `runAfterBothAsync`

### 2.4 并行与聚合：`allOf` 与 `anyOf`

当需要处理 **两个以上** 的 `CompletableFuture` 时，可以使用 `allOf` 和 `anyOf` 这两个静态方法。

**1. 等待所有任务完成: `allOf(CompletableFuture<?>... cfs)`**

* **作用:** 创建一个新的 `CompletableFuture`，它会在 **所有** 传入的 `CompletableFuture` 都 **完成**（无论是正常完成还是异常完成）之后才完成。
* **返回:** `CompletableFuture<Void>`。
* **关键注意点:**
  + 返回的是 `CompletableFuture<Void>`！它本身 **不提供** 任何聚合后的结果。它只告诉你：“你传入的所有 Future 都已经搞定了”。
  + 如果想获取所有原始 Future 的结果，你需要在 `allOf` 返回的 Future 上调用 `thenApply` 或 `thenRun` 等回调方法，然后在回调里面 **手动** 从原始的 Future 列表中获取各自的结果。因为此时可以保证所有原始 Future 都已完成，所以在回调中调用它们的 `join()` 方法是安全的，不会阻塞。
  + **异常处理:** 如果 **任何一个** 传入的 `CompletableFuture` 异常完成，那么 `allOf` 返回的 `CompletableFuture` 会 **立即** 以这个异常（通常是第一个遇到的异常）完成。后续聚合结果的回调（如 `thenApply`）将不会执行。你需要在 `allOf` 返回的 Future 上直接处理异常（例如使用 `exceptionally` 或 `handle`）。
* **场景:** 当你需要并行执行多个独立的异步任务，并且必须等待 **所有** 任务都结束后，才能进行下一步处理（通常是聚合它们的结果）。例如：同时向多个不同的服务发起请求，等所有响应都回来后，汇总数据。
* **示例:**

```
CompletableFuture<String> f1 = CompletableFuture.supplyAsync(() -> {
    try { Thread.sleep(300); } catch (InterruptedException e) {}
    System.out.println("f1 完成");
    return "Result F1";
});
CompletableFuture<Integer> f2 = CompletableFuture.supplyAsync(() -> {
    try { Thread.sleep(500); } catch (InterruptedException e) {}
    System.out.println("f2 完成");
    return 123;
});
CompletableFuture<Boolean> f3 = CompletableFuture.supplyAsync(() -> {
    try { Thread.sleep(100); } catch (InterruptedException e) {}
    System.out.println("f3 完成");
    // 模拟一个失败的任务
    // throw new RuntimeException("f3 failed!");
    return true;
});

// 等待 f1, f2, f3 全部完成
CompletableFuture<Void> allDoneFuture = CompletableFuture.allOf(f1, f2, f3);

// 聚合所有结果 (在 allDoneFuture 完成后执行)
CompletableFuture<List<Object>> allResultsFuture = allDoneFuture.thenApply(v -> {
    // allOf 完成后，可以安全地 join() 获取结果
    System.out.println("所有任务完成，开始聚合结果...");
    return Stream.of(f1, f2, f3)
            .map(CompletableFuture::join) // 安全调用 join()
            .collect(Collectors.toList());
});

// 处理可能发生的异常 (如果在聚合前，allOf 就失败了)
CompletableFuture<List<Object>> finalFuture = allResultsFuture.exceptionally(ex -> {
    System.err.println("聚合过程中发生异常 (或 allOf 失败): " + ex.getCause());
    return List.of(); // 返回一个空列表或其他默认值
});


// 获取最终结果
List<Object> results = finalFuture.join();
System.out.println("聚合后的结果: " + results);

// 如果 f3 抛出异常，输出会是:
// f3 完成
// f1 完成
// f2 完成
// 聚合过程中发生异常 (或 allOf 失败): java.lang.RuntimeException: f3 failed!
// 聚合后的结果: []


```

**2. 等待任一任务完成: `anyOf(CompletableFuture<?>... cfs)`**

* **作用:** 创建一个新的 `CompletableFuture`，它会在 **任何一个** 传入的 `CompletableFuture` **完成** 时就 **立即完成**。
* **返回:** `CompletableFuture<Object>`。该 Future 的结果就是 **第一个** 完成的那个 Future 的结果。
* **关键注意点:**
  + 返回的是 `CompletableFuture<Object>`。因为无法预知哪个 Future 先完成，以及它的具体类型是什么，所以只能返回最泛化的 `Object`。你需要 **手动进行类型转换**，这可能导致 `ClassCastException`。
  + 你只得到了第一个完成的结果，无法直接知道是哪个 Future 先完成的（除非结果本身带有标识信息）。
  + 其他 **未完成** 的 Future **会继续在后台执行**！`anyOf` 不会自动取消它们。如果这些任务消耗资源，你需要考虑额外的取消机制。
  + **异常处理:** 如果第一个完成的 Future 是 **异常完成**，那么 `anyOf` 返回的 `CompletableFuture` 也会立即以这个异常完成。
* **场景:** 当你需要并行执行多个任务，但只要 **其中任意一个** 返回结果就足够进行下一步处理时。例如：向多个镜像服务器请求同一个资源，使用最快返回的那个。
* **示例:**

```
CompletableFuture<String> taskA = CompletableFuture.supplyAsync(() -> {
    try { Thread.sleep(500); } catch (InterruptedException e) {}
    System.out.println("Task A 完成");
    return "Result from Task A";
});
CompletableFuture<String> taskB = CompletableFuture.supplyAsync(() -> {
    try { Thread.sleep(200); } catch (InterruptedException e) {}
    System.out.println("Task B 完成");
    return "Result from Task B";
});
CompletableFuture<String> taskC = CompletableFuture.supplyAsync(() -> {
    try { Thread.sleep(800); } catch (InterruptedException e) {}
    System.out.println("Task C 完成");
    // 模拟异常
    // throw new RuntimeException("Task C failed first!");
    return "Result from Task C";
});

// 等待任意一个任务完成
CompletableFuture<Object> anyDoneFuture = CompletableFuture.anyOf(taskA, taskB, taskC);

// 获取第一个完成的结果
CompletableFuture<String> firstResultFuture = anyDoneFuture.thenApply(result -> {
    System.out.println("anyOf 完成，获取到第一个结果.");
    // 需要强制类型转换
    return (String) result;
}).exceptionally(ex -> {
    System.err.println("anyOf 异常完成: " + ex.getCause());
    return "Default Result on Error";
});

System.out.println("第一个完成的结果是: " + firstResultFuture.join());

// 注意：即使 anyOf 完成了，taskA 和 taskC 可能仍在后台运行!
// 需要等待它们结束以观察输出或显式取消。
taskA.join();
taskC.join(); // 如果taskC抛异常，这里也会抛异常

// 如果 taskC 先异常完成，输出可能是：
// Task C 完成
// anyOf 异常完成: java.lang.RuntimeException: Task C failed first!
// 第一个完成的结果是: Default Result on Error
// Task B 完成
// Task A 完成


```

**`allOf` vs `anyOf` 小结：**

* `allOf`: 等 **全部** 完成，返回 `Void`，需要手动聚合结果，任一失败则整体失败。
* `anyOf`: 等 **任一** 完成，返回 `Object` (第一个结果)，需要类型转换，第一个失败则整体失败，其他任务继续跑。

### 2.5 异常处理机制

异步链中的任何一步都可能抛出异常。`CompletableFuture` 提供了多种机制来捕获和处理这些异常，让你的异步流程更健壮。

**1. 异常恢复 (提供替代结果): `exceptionally(Function<Throwable, ? extends T> fn)`**

* **作用:** 提供一个异常处理器。**只有** 在当前 `CompletableFuture` **异常完成** 时，这个处理器才会被调用。
* **行为:** 接收一个 `Function`，输入参数是捕获到的 `Throwable` 异常，该函数需要 **返回一个替代结果 `T`**（类型必须与当前 `CompletableFuture` 的泛型类型 `T` 兼容）。这个替代结果将作为 `exceptionally` 方法返回的新 `CompletableFuture` 的 **正常结果**。如果当前 `CompletableFuture` 正常完成，`exceptionally` 的处理器 **不会** 被执行。
* **类似:** `try-catch` 块中的 `catch` 部分，用于捕获特定异常并提供一个默认值或恢复值，使得流程可以继续下去（或者以一个预设的“失败值”结束）。
* **返回:** `CompletableFuture<T>`。
* **示例:**

```
CompletableFuture<String> futureWithError = CompletableFuture.supplyAsync(() -> {
    if (Math.random() > 0.5) {
        throw new RuntimeException("模拟随机失败!");
    }
    return "成功获取数据";
});

CompletableFuture<String> recoveryFuture = futureWithError.exceptionally(ex -> {
    System.err.println("捕获到异常: " + ex.getMessage());
    // 返回一个默认值作为恢复
    return "默认数据";
});

System.out.println("最终结果 (可能来自成功或恢复): " + recoveryFuture.join());


```

**2. 统一处理 (无论成败): `handle(BiFunction<? super T, Throwable, ? extends U> fn)` / `handleAsync(...)`**

* **作用:** 提供一个 **统一的结果处理器**。**无论** 前面的 `CompletableFuture` 是 **正常完成** 还是 **异常完成**，`handle` 的处理器 **总是会被调用**。
* **行为:** 接收一个 `BiFunction`，它有两个输入参数：
  + `T result`: 如果前一步正常完成，这是结果；如果异常完成，则为 `null`。
  + `Throwable throwable`: 如果前一步异常完成，这是异常对象；如果正常完成，则为 `null`。
  + 你需要在这个 `BiFunction` 中根据 `result` 和 `throwable` 的状态，**计算并返回一个新的结果 `U`**。你可以根据情况转换成功的结果，或者处理异常并返回一个默认值/错误状态，甚至可以转换异常类型再抛出。
* **类似:** `try-catch-finally` 块的结合体，但它强制你必须产生一个后续的结果（或者显式抛出新异常）。
* **返回:** `CompletableFuture<U>`。
* **线程:** `handle` 同步执行；`handleAsync` 异步执行。
* **场景:** 当你需要无论成功还是失败，都进行某些处理（如记录日志），并且可能需要根据结果或异常状态生成一个统一的最终状态或结果时。它比 `exceptionally` 更通用，因为它总会执行。
* **示例:**

```
CompletableFuture<Integer> futureMaybeError = CompletableFuture.supplyAsync(() -> {
    if (Math.random() < 0.5) {
        throw new IllegalStateException("计算出错");
    }
    return 100;
});

// 使用 handle 统一处理成功和失败
CompletableFuture<String> statusFuture = futureMaybeError.handle((result, throwable) -> {
    System.out.println("Handle 执行... Thread: " + Thread.currentThread().getName());
    if (throwable != null) {
        // 异常情况
        System.err.println("在 handle 中处理异常: " + throwable.getMessage());
        return "状态: 失败 - " + throwable.getMessage();
    } else {
        // 正常情况
        System.out.println("在 handle 中处理正常结果: " + result);
        return "状态: 成功 - 结果是 " + result;
    }
});

System.out.println("最终状态: " + statusFuture.join());


```

**3. 完成时执行动作 (不改变结果): `whenComplete(BiConsumer<? super T, ? super Throwable> action)` / `whenCompleteAsync(...)`**

* **作用:** 提供一个 **完成时的回调动作**。**无论** 前面的 `CompletableFuture` 是 **正常完成** 还是 **异常完成**，`whenComplete` 的回调 **总是会被调用**。
* **行为:** 接收一个 `BiConsumer`，输入参数与 `handle` 类似 (`T result`, `Throwable throwable`)，其中一个总为 `null`。这个 `BiConsumer` 用于执行 **副作用操作**（如记录日志、资源清理、发送通知），但它 **不能修改结果**。`whenComplete` 方法返回的 `CompletableFuture` 会携带与上游完全 **相同** 的结果（如果是正常完成）或异常（如果是异常完成）。
* **类似:** `try-finally` 块中的 `finally` 部分，主要用于执行无论成功失败都要做的清理或记录操作，不影响最终抛出的异常或返回的结果。
* **返回:** `CompletableFuture<T>` (结果/异常与上游相同)。
* **线程:** `whenComplete` 同步执行；`whenCompleteAsync` 异步执行。
* **场景:** 当你只想在任务完成后（无论结果如何）执行一些附加操作，但不想改变传递给下游的结果或异常时。
* **示例:**

```
CompletableFuture<String> dataFuture = CompletableFuture.supplyAsync(() -> {
    System.out.println("正在获取数据...");
    if (Math.random() > 0.5) throw new RuntimeException("获取数据失败");
    return "原始数据";
});

CompletableFuture<String> loggedFuture = dataFuture.whenComplete((result, throwable) -> {
    System.out.println("whenComplete 执行... Thread: " + Thread.currentThread().getName());
    if (throwable != null) {
        System.out.println("任务异常完成: " + throwable.getMessage());
    } else {
        System.out.println("任务正常完成，结果: " + result);
    }
    // 注意：这里不能修改 result 或 throwable
});

// 尝试获取结果，如果 dataFuture 失败，loggedFuture 也会失败
try {
    String finalResult = loggedFuture.join();
    System.out.println("下游获取到的最终结果: " + finalResult);
} catch (CompletionException e) {
    System.err.println("下游捕获到异常: " + e.getCause());
}


```

**异常处理方法选择：**

* 只想在 **出错时** 提供一个 **替代值** 让流程继续？ -> `exceptionally`
* 想在 **任何情况下** 都介入，根据成功/失败状态 **计算出一个新的、统一的结果**？ -> `handle`
* 想在 **任何情况下** 都执行一个 **副作用**（如日志），但 **不改变** 传递下去的结果/异常？ -> `whenComplete`

**重要提示:** 在 `CompletableFuture` 链中，如果任何一个阶段抛出异常，而没有被后续的 `exceptionally` 或 `handle` 捕获和处理，那么这个异常会沿着链一直传递下去，导致后续的所有回调（除了 `whenComplete` 和 `handle`）都不会执行。最终，如果你对链末端的 `CompletableFuture` 调用 `join()` 或 `get()`，就会收到这个未处理的异常（包裹在 `CompletionException` 或 `ExecutionException` 中）。因此，**务必确保在适当的位置处理可能发生的异常**。

---

## 三、实战应用与注意事项

### 3.1 高并发场景下的优势与局限

`CompletableFuture` 在高并发场景下表现出色，但也存在一些需要注意的局限性。

**优势:**

1. **非阻塞性，提高吞吐量:** 这是 `CompletableFuture` 的核心优势。通过回调机制，线程在发起异步操作（尤其是 IO 操作）后可以立即返回去做其他事情，而不是阻塞等待结果。这极大地提高了线程的利用率，使得系统能够用更少的线程处理更多的并发请求，尤其是在 IO 密集型应用中（如大量数据库访问、外部 API 调用），吞吐量提升显著。
2. **强大的任务编排能力:** `CompletableFuture` 提供的链式 API (`thenApply`, `thenCompose` 等) 和组合 API (`thenCombine`, `allOf`, `anyOf`) 可以非常简洁、清晰地描述复杂的异步工作流。相比于使用传统 `Future` 配合 `CountDownLatch`、`CyclicBarrier` 或手动管理 Future 列表，代码更具可读性、可维护性，能够轻松应对复杂的业务逻辑依赖。
3. **简化异步化改造:** 可以相对容易地将传统的同步阻塞代码改造为异步非阻塞模式，提升系统整体的响应性和弹性。

**局限性:**

1. **`commonPool()` 滥用风险:** 如前所述，默认使用的 `ForkJoinPool.commonPool()` 是全局共享的。如果在高并发场景下，不加区分地将所有异步任务（特别是 IO 密集型或长时间阻塞的任务）都扔给 `commonPool()`，很容易耗尽其有限的线程资源（默认 CPU 核心数 - 1），导致线程池阻塞，进而影响 JVM 中所有依赖 `commonPool()` 的功能（包括其他 `CompletableFuture`、并行流 `parallelStream` 等），造成全局性能瓶颈甚至服务不可用。**在高并发应用中，为不同类型的任务配置和使用自定义线程池几乎是必须的。**
2. **调试复杂性:** 异步回调链使得程序的执行流程不再是线性的。当出现问题时，堆栈跟踪信息可能会跨越多个线程和回调阶段，变得难以理解和追踪。错误的根源可能隐藏在链条的深处，定位问题相对传统同步代码更具挑战性，可能需要借助专门的异步调试工具或日志增强。
3. **学习曲线:** 相对于简单的 `Future` 或直接使用 `ExecutorService`，`CompletableFuture` 的函数式接口、链式调用、多种回调方法的细微差别以及线程调度策略需要一定的学习成本才能熟练掌握。
4. **阻塞操作的“传染性”:** 如果在 `CompletableFuture` 的回调链中（尤其是在 `commonPool` 或 IO 密集型任务使用的线程池中）不小心执行了同步阻塞的代码（例如 `Thread.sleep`, `synchronized` 的重度竞争，调用了老的阻塞 IO 库），那么它依然会阻塞执行回调的那个线程。这会抵消非阻塞带来的优势，甚至在极端情况下（如线程池饥饿）引发死锁。编写 `CompletableFuture` 代码时需要保持“异步思维”，警惕阻塞操作。

**对比传统线程池 (ThreadPoolExecutor) 和 ForkJoinPool:**

* **vs ThreadPoolExecutor:**
  + **关注点:** `ThreadPoolExecutor` 更侧重于 **线程的复用和管理**（如何创建、销毁、拒绝任务），是一个通用的任务执行器。`CompletableFuture` 更侧重于 **任务的编排、依赖管理和结果处理**，定义的是异步工作流。
  + **交互方式:** 传统方式通常是 `submit()` 任务拿到 `Future`，然后通过阻塞的 `get()` 获取结果。`CompletableFuture` 推荐使用非阻塞的回调。
  + **关系:** `CompletableFuture` 通常需要一个 `Executor` (可以是 `ThreadPoolExecutor` 或 `ForkJoinPool`) 作为其任务执行的载体。`CompletableFuture` 是高层编排者，`Executor` 是底层执行者。
* **vs ForkJoinPool:**
  + **关系:** `CompletableFuture` **默认使用** `ForkJoinPool.commonPool()` 作为其异步操作的执行器。可以说 `CompletableFuture` 是 `ForkJoinPool` 的一个重要应用场景和上层封装。
  + **核心机制:** `ForkJoinPool` 的核心是 **分治 (Fork/Join)** 和 **工作窃取 (Work-Stealing)**，特别擅长处理可以递归分解的 **CPU 密集型计算任务**。`CompletableFuture` 利用了其工作窃取特性来提高默认异步任务的执行效率。
  + **易用性:** 直接使用 `ForkJoinPool` 通常需要手动编写 `RecursiveTask` 或 `RecursiveAction`，实现分治逻辑。`CompletableFuture` 则提供了更高层、更通用的异步编程接口，隐藏了底层的复杂性。

**理解辅助：**

可以形象地理解它们的关系：

* `ThreadPoolExecutor`：像一个 **劳务派遣公司**。你给他任务（`Runnable`/`Callable`），他派遣工人（线程）去做，完成后告诉你结果（通过 `Future`）。工人数量和管理方式是核心。
* `ForkJoinPool`：像一个 **高效的专业施工队**。特别擅长把大工程拆分成小块（Fork），工人做完自己的活会主动去帮别人（Work-Stealing），适合需要大量计算的工程。
* `CompletableFuture`：像一个 **智能项目经理**。它负责 **规划整个项目流程**（链式 API），明确各步骤的依赖关系、并行性、错误处理方案。它不亲自干活，而是把具体的任务包（`Runnable`/`Supplier`）交给指定的 **施工队**（`Executor`，可以是劳务派遣公司，也可以是专业施工队）去执行。它的核心价值在于 **流程编排** 和 **状态管理**，让复杂的异步协作变得简单。

### 3.2 与框架集成

`CompletableFuture` 可以很好地与主流 Java 框架（如 
Spring
、Spring Boot、WebFlux 等）集成，以构建异步、响应式的应用。

**集成方式:**

1. **Spring/Spring Boot `@Async` 注解:**

   * 这是最常见、最便捷的集成方式。
   * 在 Spring Boot 应用中，首先在启动类上添加 `@EnableAsync` 注解。
   * 然后配置一个或多个 `TaskExecutor` Bean（通常使用 `ThreadPoolTaskExecutor`），用于执行异步方法。可以精细配置线程池参数。
   * 在需要异步执行的 Service 方法上添加 `@Async` 注解（可以指定使用的 `TaskExecutor` Bean 名称，如 `@Async("myTaskExecutor")`），并将方法的返回类型声明为 `CompletableFuture<T>`。
   * Spring 会自动将该方法的调用拦截，并将其提交到指定的线程池中执行，然后立即返回一个未完成的 `CompletableFuture`。

   ```
   // 配置类
   @Configuration
   @EnableAsync
   public class AsyncConfig {
       @Bean(name = "myTaskExecutor")
       public TaskExecutor myTaskExecutor() {
           ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
           executor.setCorePoolSize(5);
           executor.setMaxPoolSize(10);
           executor.setQueueCapacity(25);
           executor.setThreadNamePrefix("MyAsync-");
           executor.initialize();
           return executor;
       }
   }

   // Service 类
   @Service
   public class MyAsyncService {
       @Async("myTaskExecutor") // 指定使用配置的线程池
       public CompletableFuture<User> findUser(String userId) {
           System.out.println("异步查找用户... Thread: " + Thread.currentThread().getName());
           // 模拟耗时数据库查询
           try { Thread.sleep(1000); } catch (InterruptedException e) {}
           User user = new User(userId, "User_" + userId);
           // 可以直接返回 CompletableFuture.completedFuture，
           // 或者如果内部还有异步调用，可以用 thenCompose 等连接
           return CompletableFuture.completedFuture(user);
           // 如果方法本身抛出异常，返回的 Future 会是异常完成状态
       }
   }

   // Controller 或其他地方调用
   @Autowired
   private MyAsyncService asyncService;

   public void handleRequest() {
       CompletableFuture<User> userFuture = asyncService.findUser("123");
       userFuture.thenAccept(user -> System.out.println("获取到用户: " + user));
       // Controller 本身可以是非阻塞的（如 WebFlux）或阻塞等待结果
   }


   ```
2. **异步 Web 框架 (Spring WebFlux, Vert.x等):**

   * 在像 Spring WebFlux 这样的响应式 Web 框架中，Controller 的处理方法可以直接返回 `Mono<CompletableFuture<T>>` 或 `Mono<T>`（框架通常能适配 `CompletableFuture`，例如通过 `Mono.fromFuture()`）。
   * 这使得整个请求处理链路可以保持非阻塞，从接收请求到业务逻辑处理再到返回响应，线程资源不会被长时间占用，极大地提高了服务的并发能力和资源利用率。

   ```
   // WebFlux Controller 示例 (简化)
   @RestController
   public class UserController {
       @Autowired
       private MyAsyncService asyncService;

       @GetMapping("/users/{id}")
       public Mono<User> getUser(@PathVariable String id) {
           // 调用返回 CompletableFuture 的异步方法
           CompletableFuture<User> userFuture = asyncService.findUser(id);
           // 将 CompletableFuture 转换为 Mono
           return Mono.fromFuture(userFuture);
       }
   }


   ```
3. **手动集成:**

   * 在任何 Java 应用中（即使没有框架支持），你都可以直接使用 `CompletableFuture` 的静态方法创建和链式调用，并配合手动创建和管理的 `Executor` 实例来实现异步处理。

**存在的坑 (Potential Pitfalls) 与应对:**

1. **线程池配置不当 (极其重要!)**:

   * **坑:** 依赖默认的 `commonPool` 处理 IO 密集型任务；未根据任务类型（CPU vs IO）配置不同的线程池；线程池大小（核心数、最大数、队列容量）配置不合理；未使用有界队列导致内存溢出。
   * **应对:** **必须为不同类型的任务创建和配置独立的线程池！** 使用 `ThreadPoolTaskExecutor` (Spring) 或 `ThreadPoolExecutor`，仔细计算并配置参数。IO 密集型任务通常需要 `核心线程数 >= 并发任务数`，队列可以适当大些。CPU 密集型任务线程数接近 CPU 核心数，队列不宜过大。**监控线程池的活跃线程数、队列大小、任务拒绝次数** 是发现问题的关键。
2. **异常处理不完整:**

   * **坑:** 异步链中任何一步未处理的异常都可能导致整个流程中断，且异常信息可能丢失或难以追踪。在 Spring `@Async` 返回 `CompletableFuture` 时，未捕获的异常会被 `AsyncUncaughtExceptionHandler` 处理（如果配置了），否则可能就“石沉大海”。
   * **应对:** **必须在 `CompletableFuture` 链的适当位置使用 `exceptionally` 或 `handle` 来捕获和处理异常。** 明确异常处理策略：是记录日志后提供默认值恢复流程？还是转换成业务异常继续抛出，由上层统一处理？
3. **事务管理复杂化:**

   * **坑:** Spring 的声明式事务 (`@Transactional`) 默认是基于 `ThreadLocal` 传播的。当使用 `@Async` 或 `CompletableFuture` 的回调切换了线程后，原有的事务上下文会丢失，导致异步方法或回调中的数据库操作不在同一个事务中，或者根本没有事务。
   * **应对:**
     + 如果异步方法内部需要一个完整的独立事务，可以在异步方法上添加 `@Transactional`（通常需要 `Propagation.REQUIRES_NEW`）。
     + 如果需要在多个异步步骤之间维持事务，情况会变得非常复杂，可能需要：
       - 避免在异步链中分散数据库操作，将所有需要事务的操作放在一个同步的、带有 `@Transactional` 的方法中，然后异步调用这个方法。
       - 考虑使用编程式事务 (`TransactionTemplate`) 手动管理。
       - 对于跨服务的分布式事务，需要引入 Seata 等分布式事务解决方案。
       - 重新审视业务流程，看是否能避免跨异步步骤的事务需求。
4. **`ThreadLocal` 传递问题:**

   * **坑:** 很多框架或应用会使用 `ThreadLocal` 来传递上下文信息（如用户身份、请求追踪 ID (Trace ID)、日志上下文 MDC 等）。异步操作切换线程后，这些 `ThreadLocal` 值默认不会传递过去，导致在异步任务中无法获取这些上下文信息。
   * **应对:**
     + **手动传递:** 在提交异步任务前，从 `ThreadLocal` 中获取值，然后作为参数显式传递给异步方法或 Lambda 表达式。
     + **使用支持传递的库:**
       - **日志上下文 (MDC):** 配置 `TaskDecorator` (Spring) 或使用 `Slf4j` 的 `MDC.getCopyOfContextMap()` 和 `MDC.setContextMap()` 手动传递。
       - **追踪 ID (Trace ID):** 集成如 Spring Cloud Sleuth 或 SkyWalking 等分布式追踪系统，它们通常会自动处理跨线程的 Trace ID 传递。
       - **通用 `ThreadLocal` 传递:** 使用阿里巴巴开源的 `TransmittableThreadLocal` 库，它可以无缝地替代 `ThreadLocal` 并支持父子线程及线程池间的上下文传递。
5. **阻塞操作混用:**

   * **坑:** 在异步流程中（尤其是在 WebFlux 这类基于事件循环的框架中，或者在 `commonPool`、IO 密集型线程池中）不小心调用了阻塞 API（如老旧的同步 JDBC、同步 HTTP Client、`Thread.sleep()`、`CountDownLatch.await()`、另一个 `Future.get()` 等）。这会阻塞宝贵的线程资源，严重时可能阻塞 Netty 的 EventLoop 线程，导致整个服务失去响应。
   * **应对:**
     + **保持异步纯粹性:** 尽可能使用异步版本的库（如异步数据库驱动 R2DBC、异步 HTTP 客户端 WebClient）。
     + **隔离阻塞调用:** 如果必须调用阻塞代码，应将其 **包裹** 起来，并提交到一个 **专门用于执行阻塞任务的、隔离的线程池** 中执行（例如 Reactor 的 `Schedulers.boundedElastic()` 或自定义的、线程数可观的 `ThreadPoolExecutor`）。通过 `publishOn()` (Reactor) 或 `thenApplyAsync(fn, blockingExecutor)` 将阻塞操作切换到合适的线程池执行，完成后再切回原线程池（如果需要）。
     + **绝对禁止** 在 `CompletableFuture` 的回调链中直接调用另一个 `Future` 的阻塞 `get()` 或 `join()` 方法！应使用 `thenCompose` 或 `thenCombine` 来组合它们。

---

## 四、进阶主题

### 4.1 任务取消 (`cancel` 方法)

`CompletableFuture` 继承了 `Future` 接口的 `cancel(boolean mayInterruptIfRunning)` 方法，用于尝试取消任务的执行。但理解其工作方式和局限性非常重要。

**实现机制:**

1. **状态标记:** 调用 `cancel()` 方法首先会尝试通过 CAS 原子操作，将 `CompletableFuture` 内部的 `result` 字段设置为一个特殊的 `CANCELLED` 标记对象。
2. **取消条件:** 只有当 `CompletableFuture` **尚未完成** (即 `result` 仍是未完成状态) 时，这个 CAS 操作才能成功，取消才会生效。如果 Future 已经正常完成或异常完成，`cancel()` 调用会失败并返回 `false`。
3. **取消成功后的效果:**
   * `isCancelled()` 方法将返回 `true`。
   * `isDone()` 方法将返回 `true`。
   * 任何后续对 `get()` 或 `join()` 方法的调用将 **立即** 抛出 `CancellationException`。
   * 所有 **已注册但尚未执行** 的下游回调（通过 `thenApply`, `thenAccept` 等添加的 `Completion`）将 **不会被触发执行**。
4. **`mayInterruptIfRunning` 参数:**
   * 如果此参数为 `true`，并且任务 **已经开始执行但尚未完成**，`cancel(true)` 方法会 **尝试中断** 正在执行该任务的线程（通过调用该线程的 `Thread.interrupt()` 方法）。
   * 如果此参数为 `false`，或者任务尚未开始执行，`cancel(false)` **不会** 尝试中断线程。

**是否真的能中断线程执行？**

**不一定！** 这是最需要理解的关键点。

* `cancel(true)` 仅仅是 **尝试** 向正在执行任务的线程 **发送一个中断信号** (`Thread.interrupt()`)。
* 线程中断在 Java 中是一种 **协作机制**。仅仅设置线程的中断状态位本身并不能强制停止线程的执行。
* **任务代码必须主动响应中断**，才能真正停止。响应中断的方式通常包括：
  + 在循环或耗时操作中定期检查 `Thread.currentThread().isInterrupted()` 状态，如果为 `true` 则主动退出。
  + 捕获并处理 `InterruptedException`（例如由 `Thread.sleep()`, `Object.wait()`, `BlockingQueue.take()` 等方法抛出），在 `catch` 块中进行清理并可能重新设置中断状态 (`Thread.currentThread().interrupt()`) 或直接退出。
* **如果你的任务代码（提交给 `runAsync` 或 `supplyAsync` 的 `Runnable`/`Supplier`）没有编写任何处理中断的逻辑**（比如它在执行一个纯粹的、不检查中断状态的密集计算循环，或者调用了一个不响应中断的第三方库），那么即使调用了 `cancel(true)`，线程的中断状态被设置了，**任务逻辑也可能完全无视这个信号，继续执行直到自然结束**。

**`cancel` 的主要意义:**

`CompletableFuture` 的 `cancel` 主要作用在于：

1. **改变 Future 自身的状态:** 将其标记为 `CANCELLED`。
2. **阻止后续依赖任务的执行:** 切断回调链，避免下游任务继续等待或执行无效的计算。
3. **快速失败通知:** 让等待该 Future 结果的调用者（通过 `get`/`join`）能够立即收到 `CancellationException`，而不是无限期阻塞。

**理解辅助：**

把 `cancel` 想象成在高速公路上某个出口挂了个“前方施工，请绕行”的牌子。

* 这个牌子（`CANCELLED` 状态）能让后面想从这个口下的车（下游回调）不再过来。
* 它也能让在收费站等这个出口消息的车（调用 `get`/`join` 的线程）立刻知道此路不通（`CancellationException`）。
* 如果牌子上还加了个大喇叭喊话（`mayInterruptIfRunning=true` 调用 `interrupt()`），试图通知正在驶向这个出口的车（正在执行任务的线程）：“别过来了！”。
* 但如果那辆车（任务代码）的司机（线程执行逻辑）关着窗户、听着歌（不响应中断），那他可能还是会开到施工点才停下（任务自然结束）。

**总结:** `CompletableFuture` 的 `cancel` 是管理异步流程状态、阻止后续执行的有效手段。它会 **尝试** 发送中断信号，但能否 **真正停止** 正在运行的任务，**完全取决于任务代码本身是否配合处理了中断**。它不是一个强制终止开关。

### 4.2 内存 泄漏风险与避免

虽然 `CompletableFuture` 本身设计精良，但在使用不当时，仍然可能引发内存泄漏。主要的风险点在于 **未完成的 Future 持有对其回调链和上下文的引用**。

**风险点:**

1. **未完成的 Future 持有回调链:**
   * **原因:** 如果一个 `CompletableFuture` 因为某种原因（例如，它依赖的外部调用永不返回，或者开发者忘记手动调用 `complete`/`completeExceptionally`/`cancel`）**长时间处于未完成状态**，它会一直持有对其注册的回调链（通过 `thenApply`, `thenAccept` 等添加的 `Completion` 对象）的引用。
   * **影响:** 这些 `Completion` 对象（通常是 Lambda 表达式或方法引用）又可能 **捕获并持有** 对外部对象（例如 Service 实例、大的数据结构等）的引用。只要这个根 `CompletableFuture` 对象不被垃圾回收（因为它还在等待完成），那么整个由它引发的引用链（Future -> Completion -> 外部对象）都 **不会被回收**，即使这些外部对象在逻辑上已经不再需要。如果大量这样的 Future 实例累积，就会导致内存泄漏。
2. **Future 集合管理不当:**
   * **原因:** 将创建的 `CompletableFuture` 实例添加到某个全局或长生命周期的集合（如 `List`, `Map`) 中进行跟踪或管理，但在它们完成后 **未能及时从集合中移除**。
   * **影响:** 如果某些 Future 永远无法完成（同上），或者即使完成了也忘记移除，它们将 **永久驻留在集合中**，连同它们可能间接引用的对象一起，占用内存。
3. **循环依赖 (较少见):**
   * **原因:** 创建了 `CompletableFuture` 之间的循环依赖关系（例如，Future A 的完成依赖于 Future B，而 Future B 的完成又反过来依赖于 Future A），并且没有外部触发条件来打破这个循环。
   * **影响:** 可能导致它们互相等待，永远无法进入完成状态，因此也永远无法被垃圾回收。
4. **线程池队列无限积压:**
   * **原因:** 使用了 **无界队列** (如 `LinkedBlockingQueue` 的默认构造) 的线程池来执行 `CompletableFuture` 的异步任务，并且任务的提交速度远快于处理速度，或者任务因某种原因（如死锁、等待外部资源）长时间阻塞在线程池中无法完成。
   * **影响:** 导致任务对象（`Runnable`/`Supplier`）在队列中无限堆积。这些任务对象通常也持有对 `CompletableFuture` 实例以及它们捕获的上下文的引用，导致这些对象都无法被回收，最终可能引发 `OutOfMemoryError`。

**避免方法:**

1. **设置超时机制 (关键!):**

   * 对于任何可能长时间阻塞或无法保证完成的操作（特别是外部调用、等待资源等），**必须设置超时**。
   * **Java 9+:** 使用 `orTimeout(long timeout, TimeUnit unit)` 或 `completeOnTimeout(T value, long timeout, TimeUnit unit)` 方法。`orTimeout` 会在超时后让 Future 以 `TimeoutException` 异常完成；`completeOnTimeout` 会在超时后以给定的默认值正常完成。

   ```
   // Java 9+
   CompletableFuture<String> potentiallyLongTask = CompletableFuture.supplyAsync(() -> {
       // ... 可能耗时很久的操作 ...
       return "Data";
   });
   // 1秒后如果还没完成，就以 TimeoutException 异常结束
   CompletableFuture<String> futureWithTimeout = potentiallyLongTask.orTimeout(1, TimeUnit.SECONDS);
   // 1秒后如果还没完成，就用 "Default" 作为结果正常结束
   CompletableFuture<String> futureCompleteOnTimeout = potentiallyLongTask.completeOnTimeout("Default", 1, TimeUnit.SECONDS);


   ```

   * **Java 8:** 需要手动结合 `ScheduledExecutorService` 来实现超时。创建一个 `ScheduledExecutorService`，在指定延迟后调用目标 Future 的 `completeExceptionally(new TimeoutException())` 或 `complete(defaultValue)`。需要注意线程安全和确保只完成一次。

   ```
   // Java 8 手动实现超时 (简化示例)
   public static <T> CompletableFuture<T> within(CompletableFuture<T> future, long timeout, TimeUnit unit) {
       final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1, r -> {
           Thread t = new Thread(r);
           t.setDaemon(true); // 使用守护线程
           return t;
       });
       // 任务：在超时后尝试异常完成 Future
       Runnable timeoutTask = () -> future.completeExceptionally(new TimeoutException());
       // 安排超时任务
       ScheduledFuture<?> scheduledTimeout = scheduler.schedule(timeoutTask, timeout, unit);
       // 当 Future 完成时（无论成功、失败、取消），取消超时任务
       future.whenComplete((res, ex) -> {
           scheduledTimeout.cancel(false);
           scheduler.shutdown(); // 关闭调度器
       });
       return future;
   }


   ```
2. **确保最终完成:** 编码时要仔细考虑所有可能的执行路径，确保你创建的每一个 `CompletableFuture` 最终都会通过调用 `complete()`, `completeExceptionally()` 或 `cancel()` 进入完成状态。避免出现“孤儿” Future。
3. **及时清理集合:** 如果使用集合来管理 Future，务必在 Future 完成时（可以通过 `whenComplete` 回调）将其从集合中 **显式移除**。考虑使用 `WeakHashMap` 如果键（例如某个请求对象）不再被引用时，希望 Future 也能被回收，但这需要仔细设计。
4. **合理配置线程池:**

   * **优先使用有界队列** 的线程池（如 `ArrayBlockingQueue` 或指定容量的 `LinkedBlockingQueue`）。
   * 配置 **合理的拒绝策略** (`RejectedExecutionHandler`)，例如 `AbortPolicy` (抛异常)、`CallerRunsPolicy` (调用者线程执行) 或记录日志并丢弃，而不是让任务无限堆积。
   * **监控线程池的队列长度**，及时发现积压问题。
5. **打破循环依赖:** 仔细设计异步流程，避免出现 `CompletableFuture` 之间的相互依赖。
6. **谨慎捕获外部变量:** 在 Lambda 表达式或匿名内部类中，注意捕获的对象（尤其是那些生命周期可能很长的对象，如 Spring Bean、大的集合等）。确保只有必要的引用被持有，并且随着 `CompletableFuture` 的完成和回收，这些引用也能被释放。

**核心思想:** 防止 `CompletableFuture` 实例及其关联的回调、上下文长时间存活。要么确保它们能快速完成（通过超时），要么在不再需要时显式断开引用（从集合中移除）。同时，要控制好任务的入口（线程池队列），避免无限积压。

### 4.3 回调链调度与阻塞/死锁

理解 `CompletableFuture` 回调链的调度方式以及潜在的阻塞和死锁风险，对于编写健壮、高性能的异步代码至关重要。

**回调链调度回顾:**

* **非 `Async` 方法 (如 `thenApply`, `whenComplete`):**
  + **规则:** “谁触发，谁执行（或调用者执行）”。
  + **执行线程:** 如果前置任务已完成，由调用 `thenApply` 等方法的 **当前线程** 执行；如果前置任务未完成，由 **完成前置任务的那个线程** 执行。
* **`Async` 方法 (如 `thenApplyAsync`, `whenCompleteAsync`):**
  + **规则:** 提交给 `Executor` 执行。
  + **执行线程:** 由 **指定的 `Executor`**（默认为 `ForkJoinPool.commonPool()`）中的线程执行。

**阻塞风险:**

* **回调本身可能阻塞:** `CompletableFuture` 的回调函数（Lambda 表达式）中如果包含了阻塞代码（如同步 IO、`Thread.sleep()`、等待锁、调用另一个阻塞的 `Future.get()`），那么执行该回调的线程 **会被阻塞**。`CompletableFuture` 自身机制不阻塞，但你写的代码可以阻塞执行线程。
* **非 `Async` 回调阻塞的危险性:**
  + 如果阻塞发生在 **完成前置任务的线程** 上，而这个线程恰好是一个 **关键线程**（例如 `ForkJoinPool` 的工作线程、Netty 的 EventLoop 线程、UI 线程），那么这个阻塞会直接影响这些关键线程的可用性，导致：
    - `ForkJoinPool` 吞吐量下降，影响所有使用 `commonPool` 的任务。
    - Netty EventLoop 阻塞，导致服务器无法处理新的 IO 事件，连接被挂起。
    - UI 线程阻塞，导致界面卡死。
  + 这是 **非常危险** 的情况，应极力避免。
* **`Async` 回调的阻塞:**
  + 虽然 `Async` 回调将任务提交到了单独的线程池，看似隔离了风险，但如果 **线程池资源耗尽**（例如，线程池较小，而提交的任务都是长时间阻塞的），那么所有线程都会被阻塞任务占用。
  + 后续提交到这个线程池的回调任务将 **无法获得线程执行**，只能在队列中排队等待，宏观上表现为整个流程被阻塞。

**死锁风险:**

死锁通常发生在 **线程资源不足** 且 **任务之间存在循环等待** 的情况下。对于 `CompletableFuture`，最常见的死锁场景是 **线程池饥饿死锁 (Thread Pool Starvation Deadlock)**。

* **场景描述:**

  1. 你使用一个 **固定大小** 的线程池 (例如 `Executors.newFixedThreadPool(N)` 或配置了较小 `maximumPoolSize` 的 `ThreadPoolExecutor`) 来执行 `CompletableFuture` 的异步回调（通过 `thenXxxAsync(..., executor)`）。
  2. 一个任务 A 被提交到这个线程池执行 (`executor.execute(taskA)` 或 `supplyAsync(..., executor)`）。
  3. 任务 A 的某个回调（例如通过 `thenComposeAsync(taskBSupplier, executor)`）依赖于另一个任务 B 的结果，并且任务 B **也需要提交到同一个线程池 `executor` 中执行**。
  4. **关键点:** 如果此时线程池 `executor` 中的 **所有 N 个线程** 都已经被任务 A 及其类似的任务（它们都在执行回调，等待其他任务的结果）**占满**。
  5. 那么任务 B 就 **永远无法获得线程来执行**，因为它需要从 `executor` 获取线程，但 `executor` 已经没有空闲线程了。
  6. 任务 A 也就 **永远等不到任务 B 的结果**，无法释放它占用的线程。
  7. **死锁形成:** 任务 A 等待任务 B，任务 B 等待线程池资源，而线程池资源被任务 A 占用。
* **`commonPool` 的死锁风险:**

  + 虽然 `ForkJoinPool` 使用工作窃取可以缓解部分问题，但如果大量任务（特别是包含阻塞操作的任务）不加区分地提交到 `commonPool`，并且这些任务之间存在依赖关系，同样可能耗尽其少量线程（默认 CPU 核数 - 1），导致依赖 `commonPool` 执行的任务（包括 `CompletableFuture` 的默认异步回调、并行流等）互相等待而死锁。
* **同步回调阻塞关键线程导致的死锁:**

  + 如果一个 **非 `Async`** 回调阻塞了某个关键线程（如 EventLoop 线程），而这个阻塞操作又依赖于另一个需要该关键线程才能完成的任务（例如，等待另一个需要在同一个 EventLoop 上处理的网络响应），也可能形成死锁。

**避免阻塞和死锁的方法:**

1. **优先使用 `Async` 回调:** 对于任何可能耗时或包含阻塞操作的回调逻辑，**总是使用带 `Async` 后缀的方法** (`thenApplyAsync`, `thenComposeAsync` 等)，并为其 **配合合适的线程池**。这是避免阻塞关键线程和解耦任务依赖的基础。
2. **隔离线程池 (核心原则!):**

   * **为不同类型的任务使用不同的、大小配置合理的线程池。** 这是防止线程池饥饿死锁的 **最有效** 方法。
   * 例如，可以创建一个用于 CPU 密集型计算的线程池（大小接近 CPU 核心数），再创建一个用于 IO 密集型任务的线程池（大小可以更大，根据预期的并发 IO 数估算）。
   * **绝对避免** 在同一个 **固定大小** 的线程池中产生任务间的循环依赖等待（任务 A 的回调等待任务 B，任务 B 又提交到同一个池子）。如果存在依赖，应考虑将任务 B 提交到 **不同的** 线程池执行。
3. **禁止在回调中执行长时间阻塞操作:**

   * **异步化:** 将阻塞操作本身封装成返回 `CompletableFuture` 的异步方法。
   * **隔离到专用阻塞线程池:** 如果无法异步化，将该阻塞操作提交到一个 **专门用于执行阻塞任务** 的线程池中（这个线程池可以配置得非常大，或者使用 `Executors.newCachedThreadPool()`，但要注意资源消耗和潜在的线程过多问题）。然后使用 `thenApplyAsync(blockingCode, blockingExecutor)` 来执行它。
4. **极度谨慎使用非 `Async` 回调:** 再次强调，只有当你 **百分之百确定** 回调代码极其轻量、执行速度飞快（纳秒或微秒级）且 **绝对不会** 发生任何形式的阻塞（包括等待锁、IO等）时，才应该考虑使用非 `Async` 回调以追求极致性能。在绝大多数业务场景中，为了安全和健壮性，**优先选择 `Async`**。
5. **合理设置线程池大小与队列:**

   * 根据应用的并发模型和任务特性仔细计算线程池大小。Little’s Law 可以作为参考：`线程数 = 每秒到达任务数 * 平均任务处理时间`。IO 密集型任务通常需要更多线程 (`线程数 = CPU核心数 * (1 + 平均等待时间 / 平均计算时间)`)。
   * **使用有界队列** 防止任务无限积压，配合合理的拒绝策略。
6. **避免在回调链中调用 `get()` 或 `join()`:** 这是导致阻塞和死锁的常见原因。如果需要组合两个 Future 的结果，**必须** 使用 `thenCompose`, `thenCombine` 或 `allOf` 等非阻塞的组合 API。

**总结:** 回调调度机制灵活但也暗藏风险。要编写健壮、无阻塞、无死锁的 `CompletableFuture` 代码，核心在于 **识别并隔离阻塞点**，**优先并正确地使用 `Async` 回调**，以及 **精细化地设计、隔离和管理你的线程池资源**。

### 4.4 底层并发机制简介

`CompletableFuture` 的高性能和线程安全，并非偶然，它巧妙地运用了 Java 底层的多种并发原语和机制，特别是避免了重量级锁的使用。

1. **CAS (Compare-And-Swap):**

   * **核心机制:** `CompletableFuture` 内部状态的转换（如从未完成到完成/异常）以及回调链（`Completion` 栈）的维护，**大量依赖 CAS 原子操作**。
   * **实现:** 通常通过 `sun.misc.Unsafe` 类（JDK 8）或 Java 9+ 的 `java.lang.invoke.VarHandle` 类提供的底层原子操作实现。
   * **作用:**
     + **原子更新状态:** `casResult` (或类似操作) 用于原子性地更新内部 `result` 字段。这确保了即使多个线程同时尝试 `complete` 或 `completeExceptionally`，也 **只有一个** 线程能成功，从而保证了 Future 状态转换的原子性和唯一性，避免了数据竞争，且无需使用 `synchronized` 或 `Lock`。
     + **无锁数据结构:** `casStack` (或类似操作) 用于无锁地维护回调链（通常是 Treiber Stack）。添加回调 (`pushCompletion`) 和处理回调时获取链表 (`postComplete` 中对 `stack` 的操作) 都通过 CAS 实现，避免了对链表进行加锁，提高了并发性能。
   * **优势:** CAS 是一种 **乐观** 的并发控制策略。它假设冲突不经常发生，先尝试操作，如果失败（说明有冲突）再重试。相比于 **悲观** 的锁机制（无论有无冲突都先加锁），CAS 在低到中等竞争强度下通常具有更高的性能，且能避免死锁等问题。
2. **`volatile` 关键字:**

   * **应用:** `CompletableFuture` 内部的关键共享变量，如存储最终结果或异常的 `result` 字段，以及指向回调链栈顶的 `stack` 字段，都被声明为 `volatile`。
   * **作用:** `volatile` 主要提供了 **内存可见性** 保证。当一个线程修改了 `volatile` 变量的值后，这个修改对其他线程是 **立即可见** 的，确保其他线程读取该变量时能看到最新的值。这防止了因 CPU 缓存、指令重排等导致的数据不一致问题。
   * **与 CAS 配合:** `volatile` 保证了读操作能看到最新值，CAS 则基于这个最新值进行原子性的比较和更新。两者结合是实现高效无锁并发的基础。
3. **Completion 栈/链表 (Treiber Stack):**

   * **数据结构:** 内部使用一个逻辑上的栈结构来存储注册的回调 `Completion` 对象。这个栈通常实现为一个 **无锁单向链表**（经典的 Treiber Stack 算法）。
   * **线程安全:** 回调的压栈（添加新回调）和可能的出栈（`postComplete` 中获取整个链表）操作都需要线程安全。`CompletableFuture` 通过精巧的 **CAS 操作** 来原子地更新栈顶指针 (`stack` 字段)，实现了这个栈的 **无锁 (Lock-Free)** 操作。这意味着多个线程可以同时尝试添加回调或处理回调，而不会因为争抢锁而阻塞，从而提高了并发度。
4. **Executor (线程池):**

   * **角色:** `CompletableFuture` **自身不直接管理线程** 的生命周期。对于需要异步执行的操作（如 `supplyAsync`、带 `Async` 后缀的回调），它 **委托** 给一个 `Executor` 来执行。
   * **依赖:** `CompletableFuture` 依赖 `Executor`（默认为 `ForkJoinPool.commonPool()`，或用户指定的线程池）提供执行任务所需的线程。
   * **内部机制:** 线程池（如 `ThreadPoolExecutor`, `ForkJoinPool`）内部则使用了 **自己的并发机制**（如 AQS 框架、`Lock`、`Condition`、阻塞队列等）来管理线程、任务排队和调度。`CompletableFuture` 的异步执行能力实际上是建立在这些底层线程池机制之上的。
5. **显式锁 (极少使用):**

   * **设计哲学:** `CompletableFuture` 的设计尽量 **避免使用显式锁**（如 `synchronized` 或 `java.util.concurrent.locks.Lock`），以追求更高的并发性能和避免锁带来的潜在问题（如死锁、性能瓶颈）。
   * **例外:** 特定的 `Completion` 子类中，为了处理一些复杂的边界条件或同步逻辑，可能会极其短暂地使用内部锁。但这并非其主要的并发控制手段，核心仍然是 CAS 和 `volatile`。

**总结:** `CompletableFuture` 的高性能和可靠性，是建立在对底层并发原语（尤其是 CAS 和 `volatile`）的精妙运用之上的，通过无锁
数据结构
和状态转换，最大限度地减少了锁竞争，并依赖外部 `Executor` 来实现真正的异步执行。理解这些底层机制有助于更好地认识其性能特点和潜在限制。

---

## 总结

**核心要点回顾:**

* **解决了 `Future` 的痛点:** 提供了非阻塞获取结果、链式调用、组合、异常处理等。
* **核心原理:** 基于事件驱动、CAS 原子更新状态、`volatile` 保证可见性、无锁回调链（Completion Stack）和 `Executor` 委托执行。
* **线程调度:** 区分同步回调（不带 `Async`，需谨慎使用）和异步回调（带 `Async`，推荐使用），理解默认 `commonPool` 的风险，掌握自定义 `Executor` 的重要性。
* **常用 API:**
  + 创建: `runAsync`, `supplyAsync`, `completedFuture`, `failedFuture`。
  + 回调: `thenApply` (转换), `thenAccept` (消费), `thenRun` (执行动作), `thenCompose` (链式异步)。
  + 组合: `thenCombine` (合并结果), `thenAcceptBoth` (消费两者), `runAfterBoth` (两者完成后)。
  + 并行聚合: `allOf` (等待所有), `anyOf` (等待任一)。
  + 异常处理: `exceptionally` (恢复), `handle` (统一处理), `whenComplete` (副作用)。
* **实战注意事项:**
  + **线程池隔离是关键！** 避免 `commonPool` 滥用，为不同任务类型配置独立线程池。
  + **异常处理必须到位！** 使用 `exceptionally` 或 `handle` 避免异常丢失。
  + **注意事务和 `ThreadLocal` 的跨线程问题**，并采取相应措施。
  + **警惕在异步回调中引入阻塞操作！** 保持异步代码的纯粹性或隔离阻塞调用。
* **进阶主题:** 理解 `cancel` 的协作机制、内存泄漏风险（超时是关键）、阻塞与死锁（线程池饥饿）的避免方法，以及底层 CAS 等并发原语的应用。

```


```
