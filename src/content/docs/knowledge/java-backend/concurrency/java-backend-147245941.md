---
title: "JUC线程池-FutureTask"
description: "在现代软件开发中，尤其是后端服务开发，高并发和高性能是永恒的追求。为了充分利用多核处理器的能力，提升应用的响应速度和吞吐量，异步编程和"
sourceId: "147245941"
source: "https://blog.csdn.net/qq_45852626/article/details/147245941"
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
  order: 147245941
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/147245941)（历史文章导入，当前状态为草稿）

### 引言

在现代软件开发中，尤其是后端服务开发，高并发和高性能是永恒的追求。为了充分利用多核处理器的能力，提升应用的响应速度和吞吐量，异步编程和
多线程 
技术变得不可或缺。然而，传统的线程编程模型往往伴随着复杂性，例如线程管理、线程间通信、结果获取以及异常处理等问题。

想象一下，当主线程需要执行一个非常耗时的计算任务（比如复杂的数据库查询、网络请求或大
数据分析
）时，如果直接同步执行，主线程将被阻塞，导致整个应用程序失去响应，用户体验急剧下降。为了解决这个问题，我们通常会将耗时任务交给子线程去异步执行。但新的问题随之而来：

1. **如何获取子线程的计算结果？** 主线程需要在未来的某个时刻拿到子线程的返回值。
2. **如何知道子线程任务何时完成？** 主线程可能需要等待子线程结束后再进行后续操作。
3. **子线程执行出错怎么办？** 主线程需要能捕获并处理子线程中的异常。
4. **如果主线程不想等了，如何取消子线程的任务？** 需要一种机制来中断或取消正在执行的异步任务。

在 Java 5 之前，开发者需要手动编写大量的 `synchronized`, `wait()`, `notify()`, `volatile` 等代码来处理这些复杂的线程同步和通信问题，代码不仅冗长、易错，而且缺乏统一的标准。

为了简化异步编程，Java 5 在 `java.util.concurrent` (JUC) 包中引入了一系列强大的并发工具，`FutureTask` 就是其中一颗璀璨的明珠。它巧妙地将**待执行的任务** (Runnable) 和**未来可获取的结果** (Future) 结合起来，提供了一种标准、高效且易于使用的异步任务处理机制。

### 一、 基础概念：为什么需要 FutureTask？

#### 1.1 异步计算的痛点

在没有 `FutureTask` 的年代，实现一个简单的异步计算并获取结果，需要开发者手动处理很多底层细节。让我们来看一个例子：主线程需要启动一个子线程执行一个耗时 3 秒的计算（返回整数 42），并在计算完成后获取结果。

**传统实现 (不使用 FutureTask):**

```
public class WithoutFutureTaskExample {
    // volatile 保证可见性，用于存储计算结果
    private static volatile Integer result = null;
    // volatile 保证可见性，用于标记任务是否完成
    private static volatile boolean isDone = false;
    // 用于线程间等待/通知的对象锁
    private static final Object lock = new Object();
    // volatile 保证可见性，用于存储可能的异常
    private static volatile Exception exception = null;

    public static void main(String[] args) {
        // 创建并启动计算线程
        Thread calculationThread = new Thread(() -> {
            try {
                System.out.println("子线程[" + Thread.currentThread().getName() + "] 开始复杂计算...");
                // 模拟耗时计算
                Thread.sleep(3000);
                int calculationResult = 42; // 计算结果

                // 计算完成，设置结果并通知等待的主线程
                synchronized (lock) {
                    result = calculationResult;
                    isDone = true;
                    lock.notifyAll(); // 唤醒可能在等待的线程
                }
                System.out.println("子线程[" + Thread.currentThread().getName() + "] 计算完成.");
            } catch (Exception e) {
                // 发生异常，存储异常信息并通知
                System.err.println("子线程[" + Thread.currentThread().getName() + "] 计算出错: " + e.getMessage());
                synchronized (lock) {
                    exception = e;
                    isDone = true;
                    lock.notifyAll(); // 同样需要唤醒
                }
            }
        }, "CalculationThread");

        calculationThread.start(); // 启动子线程

        // 主线程可以继续执行其他非依赖计算结果的任务
        System.out.println("主线程：计算已异步开始，我先做点别的事情...");
        try {
            Thread.sleep(1000); // 模拟主线程做其他事
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt(); // 恢复中断状态
            System.err.println("主线程在做其他事时被中断");
        }
        System.out.println("主线程：其他事情做完了，现在需要计算结果。");

        // 获取计算结果
        try {
            synchronized (lock) {
                // 如果任务还没完成，则等待
                while (!isDone) {
                    System.out.println("主线程：结果还没出来，等待中...");
                    // lock.wait(); // 无限期等待，可能永远等不到
                    lock.wait(5000); // 设置超时等待，例如最多等5秒
                    if (!isDone) {
                        // 如果等待超时后任务仍未完成
                        System.err.println("主线程：等待超时！可能子线程卡住了或执行太慢。");
                        // 尝试中断计算线程（如果任务能响应中断）
                        calculationThread.interrupt();
                        throw new RuntimeException("计算超时");
                    }
                }

                // 任务已完成，检查是否有异常
                if (exception != null) {
                    System.err.println("主线程：子线程计算过程中发生了异常。");
                    throw new RuntimeException("计算过程中发生异常", exception);
                }

                // 正常获取结果
                System.out.println("主线程：成功获取计算结果: " + result);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt(); // 恢复中断状态
            System.err.println("主线程在等待结果时被中断");
            // 这里也可能需要考虑取消任务
        } catch (RuntimeException e) {
            System.err.println("主线程处理结果时遇到运行时异常: " + e.getMessage());
        }
    }
}


```

**代码分析与痛点：**

1. **状态管理复杂**：需要至少两个 `volatile` 变量 (`result`, `isDone`) 来传递结果和标记完成状态，还需要一个 `volatile` 变量 (`exception`) 处理异常。`volatile` 保证了可见性，但不能保证原子性，如果状态更复杂，管理起来会更困难。
2. **手动同步**：需要显式使用 `synchronized` 块和 `wait()` / `notifyAll()` 来实现线程间的等待和通知，容易出错（例如忘记唤醒、虚假唤醒处理、锁对象选择不当）。
3. **异常处理繁琐**：子线程的异常需要手动捕获，并通过共享变量传递给主线程，主线程在获取结果时需要检查这个异常变量。
4. **缺乏超时机制**：`wait()` 默认无限期等待，容易导致主线程永久阻塞。虽然 `wait(timeout)` 可以实现超时，但需要手动计算时间和处理超时逻辑。
5. **取消困难**：上述代码中加入了简单的超时和 `interrupt()` 尝试，但任务是否能真正被取消，取决于任务代码本身是否响应中断。没有标准化的取消接口。
6. **代码冗余**：为了实现一个简单的异步获取结果，编写了大量模板化的同步和状态管理代码。

这些痛点使得
并发编程 
门槛较高，代码难以维护。

真让哥们天天敲这些真的会疯掉了(崩溃脸).

#### 1.2 FutureTask 的优雅解决方案

`FutureTask` 的出现，正是为了解决上述痛点，提供一套标准、简洁、健壮的异步任务处理方案。  
 它将任务的执行逻辑 (`Callable` 或 `Runnable`) 封装起来，并提供了一系列方法来控制任务的生命周期（执行、取消）和获取结果（阻塞、超时、非阻塞）。

**使用 FutureTask 的简洁实现:**

```
import java.util.concurrent.*;

public class WithFutureTaskExample {
    public static void main(String[] args) {
        // 1. 定义计算任务 (使用 Callable<V> 接口，可以返回结果 V)
        Callable<Integer> calculator = () -> {
            System.out.println("子线程[" + Thread.currentThread().getName() + "] 开始复杂计算...");
            // 模拟耗时计算
            Thread.sleep(3000);
            // int i = 1 / 0; // 模拟计算异常
            System.out.println("子线程[" + Thread.currentThread().getName() + "] 计算完成.");
            return 42; // 返回计算结果
        };

        // 2. 创建 FutureTask，传入 Callable 任务
        // FutureTask 同时实现了 Runnable 和 Future 接口
        FutureTask<Integer> futureTask = new FutureTask<>(calculator);

        // 3. 启动执行 FutureTask 的线程
        // 因为 FutureTask 实现了 Runnable，所以可以直接交给 Thread 执行
        Thread calculationThread = new Thread(futureTask, "CalculationThread");
        calculationThread.start();

        // 主线程可以继续执行其他非依赖计算结果的任务
        System.out.println("主线程：计算已异步开始，我先做点别的事情...");
        try {
            Thread.sleep(1000); // 模拟主线程做其他事
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            System.err.println("主线程在做其他事时被中断");
        }
        System.out.println("主线程：其他事情做完了，现在需要计算结果。");

        // 4. 获取计算结果
        try {
            System.out.println("主线程：尝试获取计算结果...");
            // futureTask.get(); // 阻塞式获取，会一直等到任务完成
            // 使用带超时的 get 方法，避免无限等待
            Integer result = futureTask.get(5, TimeUnit.SECONDS); // 最多等待5秒
            System.out.println("主线程：成功获取计算结果: " + result);
        } catch (InterruptedException e) {
            // 当前线程（主线程）在等待结果期间被中断
            Thread.currentThread().interrupt();
            System.err.println("主线程在等待结果时被中断");
            // 可以选择取消任务
            futureTask.cancel(true); // 参数 true 表示如果任务正在运行，也尝试中断它
        } catch (ExecutionException e) {
            // 任务执行过程中抛出了异常
            System.err.println("主线程：计算任务执行出错！");
            Throwable cause = e.getCause(); // 获取原始异常
            System.err.println("原始异常: " + cause);
        } catch (TimeoutException e) {
            // 在指定时间内没有获取到结果
            System.err.println("主线程：获取结果超时！");
            // 超时后通常需要取消任务
            boolean cancelled = futureTask.cancel(true); // 尝试取消任务，true表示中断正在运行的线程
            System.out.println("主线程：尝试取消任务..." + (cancelled ? "成功" : "失败"));
        } catch (CancellationException e) {
            // 任务在调用 get() 之前已经被取消了
             System.err.println("主线程：任务已被取消，无法获取结果。");
        }

        // 检查任务最终状态
        if (futureTask.isDone()) {
            System.out.println("主线程：任务最终已完成。");
            if (futureTask.isCancelled()) {
                System.out.println("主线程：任务最终状态为：已取消。");
            } else {
                // 如果没取消，可以尝试非阻塞获取结果（如果之前get失败了）
                try {
                    // 注意：如果任务是异常完成，这里调用get()仍会抛ExecutionException
                    // 如果正常完成但之前get超时了，这里能立即拿到结果
                     if(!futureTask.isCancelled()){ //再次确认未取消
                         System.out.println("主线程：尝试再次非阻塞获取结果: " + futureTask.get(0, TimeUnit.SECONDS));
                     }
                } catch (Exception e) {
                     System.out.println("主线程：再次获取结果时出错或任务异常: " + e.getMessage());
                }
            }
        }
    }
}


```

**代码对比与优势：**

1. **简洁性**：代码量大大减少，开发者无需关心底层的 `volatile`, `synchronized`, `wait/notify`。
2. **标准化**：提供了统一的 `Future` 接口来管理异步任务和获取结果。
3. **强大的功能**：内置了阻塞获取 (`get()`)、超时获取 (`get(timeout, unit)`)、任务取消 (`cancel()`)、状态查询 (`isDone()`, `isCancelled()`) 等核心功能。
4. **完善的异常处理**：子线程的异常被自动捕获并封装在 `ExecutionException` 中，在主线程调用 `get()` 时抛出，便于统一处理。
5. **灵活性**：`FutureTask` 实现了 `Runnable` 接口，可以直接交给 `Thread` 或 `ExecutorService` (线程池) 执行。

`FutureTask` 的核心作用可以总结为：

* **异步计算的结果“凭证”**：它像一个“提货单”，你提交了任务（下单），然后得到这个凭证。你可以稍后拿着凭证去“提货”（获取结果）。
* **任务与结果的解耦**：将任务的执行过程和结果的获取过程分离开，主线程提交任务后可以继续做其他事情，提高了程序的并发性和响应性。
* **并发任务的生命周期管理**：提供了标准化的方法来控制任务的开始、结束、取消，并查询任务状态。

#### 1.3 核心接口：Runnable 和 Future

`FutureTask` 的强大功能源于它巧妙地实现了两个核心接口：`Runnable` 和 `Future<V>`。实际上，它实现的是 `RunnableFuture<V>` 接口，而 `RunnableFuture<V>` 同时继承了 `Runnable` 和 `Future<V>`。

```
// RunnableFuture 接口定义
public interface RunnableFuture<V> extends Runnable, Future<V> {
    /**
     * Sets this Future to the result of its computation
     * unless it has been cancelled.
     */
    void run(); // 继承自 Runnable，但 Javadoc 添加了额外说明
}


```

这个设计非常精妙，它意味着 `FutureTask` 对象本身：

1. **是一个可执行的任务 (实现了 `Runnable`)**：

   * 拥有 `run()` 方法，包含了任务的具体执行逻辑。
   * 可以被 `new Thread(futureTask).start()` 直接执行。
   * 可以被 `ExecutorService.submit(futureTask)` 或 `ExecutorService.execute(futureTask)` 提交给线程池执行。
2. **是一个未来结果的持有者 (实现了 `Future<V>`)**：

   * 提供了获取异步计算结果 (`get()`, `get(timeout, unit)`) 的方法。
   * 提供了管理任务生命周期 (`cancel()`, `isDone()`, `isCancelled()`) 的方法。

**`Runnable` 接口：**

```
@FunctionalInterface
public interface Runnable {
    public abstract void run();
}


```

`Runnable` 接口非常简单，只有一个 `run()` 方法。实现此接口的对象表示一个可以被线程执行的任务。`FutureTask` 实现 `run()` 方法，在其内部执行 `Callable` 的 `call()` 方法、设置结果或异常、并管理状态转换。

**`Future<V>` 接口：**

```
public interface Future<V> {
    // 尝试取消任务的执行。
    // mayInterruptIfRunning 为 true 表示如果任务已开始执行，应中断执行线程。
    // 返回 false 如果任务已完成、已被取消或由于其他原因无法取消；否则返回 true。
    boolean cancel(boolean mayInterruptIfRunning);

    // 判断任务是否已被取消。
    // 只有在 cancel 方法成功调用后，且任务在 cancel 前未完成，才返回 true。
    boolean isCancelled();

    // 判断任务是否已完成。
    // 完成可能是：正常结束、抛出异常、被取消。总之，任务结束了。
    boolean isDone();

    // 获取计算结果。
    // 如果任务尚未完成，此方法会阻塞当前线程，直到任务完成。
    // 如果任务被取消，抛出 CancellationException。
    // 如果任务执行过程中抛出异常，抛出 ExecutionException (其 cause 为原始异常)。
    V get() throws InterruptedException, ExecutionException;

    // 获取计算结果，但带有超时限制。
    // 如果在指定的超时时间内任务未完成，抛出 TimeoutException。
    // 其他行为与 get() 类似（阻塞、抛出 CancellationException 或 ExecutionException）。
    V get(long timeout, TimeUnit unit)
        throws InterruptedException, ExecutionException, TimeoutException;
}


```

`Future<V>` 接口定义了与异步计算交互的标准方法。`V` 是泛型参数，代表计算结果的
类 
型。

通过同时实现这两个接口，`FutureTask` 成为了连接任务执行和结果获取的桥梁，极大地简化了 Java 异步编程。

### 二、 内部实现：深入 FutureTask 的原理

理解 `FutureTask` 的内部工作原理对于更高效、更安全地使用它至关重要。其内部实现涉及到精巧的状态管理、原子操作和线程同步机制。

#### 2.1 核心状态变量：`state`

`FutureTask` 的所有行为都围绕着一个核心的状态变量 `state` 来进行协调。这是一个 `volatile int` 类型的变量，`volatile` 关键字确保了该变量在多线程环境下的**可见性**，即一个线程修改了 `state`，其他线程能立刻看到最新的值。

```
// FutureTask 内部状态定义 (基于 JDK 8 源码注释，数值可能因版本略有差异，但含义一致)
private volatile int state;
private static final int NEW          = 0; // 初始状态：任务刚创建，尚未执行
private static final int COMPLETING   = 1; // 瞬时状态：任务已执行完毕，正在设置最终结果(outcome)
private static final int NORMAL       = 2; // 终止状态：任务正常执行完成，结果已设置
private static final int EXCEPTIONAL  = 3; // 终止状态：任务执行过程中抛出异常，异常已设置
private static final int CANCELLED    = 4; // 终止状态：任务在执行前被取消
private static final int INTERRUPTING = 5; // 瞬时状态：任务正在被中断 (cancel(true) 被调用且任务已开始)
private static final int INTERRUPTED  = 6; // 终止状态：任务被成功中断


```

**状态解释：**

* **`NEW` (0):** 这是 `FutureTask` 的初始状态。当你创建一个 `FutureTask` 对象时，它就处于这个状态。表示任务的计算逻辑还未开始执行。
* **`COMPLETING` (1):** 这是一个非常短暂的中间状态。当任务的 `call()` 方法执行完毕（无论是正常返回还是抛出异常），`FutureTask` 会尝试将状态从 `NEW` 变为 `COMPLETING`。这个状态表示“结果正在写入 `outcome` 字段，请稍后”。设置完成后，状态会立刻变为 `NORMAL` 或 `EXCEPTIONAL`。引入这个中间状态是为了处理结果设置过程中的并发问题。
* **`NORMAL` (2):** 任务成功执行完毕，并且计算结果已经安全地存入了 `outcome` 字段。这是一个最终状态。
* **`EXCEPTIONAL` (3):** 任务在执行 `call()` 方法时抛出了异常。这个异常对象已经被安全地存入了 `outcome` 字段。这也是一个最终状态。
* **`CANCELLED` (4):** 任务在开始执行之前，就被调用了 `cancel(false)` 方法成功取消。这也是一个最终状态。
* **`INTERRUPTING` (5):** 当任务正在运行时，调用了 `cancel(true)` 方法。`FutureTask` 会先将状态设置为 `INTERRUPTING`，然后尝试中断正在执行任务的线程 (`runner` 线程)。这是一个中间状态。
* **`INTERRUPTED` (6):** `cancel(true)` 成功中断了正在执行任务的线程后，状态会从 `INTERRUPTING` 变为 `INTERRUPTED`。这也是一个最终状态。

**理解状态转换的重要性：**

`FutureTask` 的核心逻辑，如 `run()`, `get()`, `cancel()` 等方法，都依赖于对 `state` 的检查和原子更新。状态的转换是单向的，一旦任务进入了某个终止状态（`NORMAL`, `EXCEPTIONAL`, `CANCELLED`, `INTERRUPTED`），它的状态就永远不会再改变。这保证了任务结果的确定性和一致性。

**状态转换路径图 (简化版):**

```
          +-----------------+      +-----------------+      +-----------------+
 NEW ----->|  cancel(false)  |----->|   CANCELLED     |----->|     (Done)      |
  |        +-----------------+      +-----------------+      +-----------------+
  |
  | run() starts
  | sets runner thread
  V
(Running implicitly, state still NEW)
  |
  | call() finishes normally
  V
COMPLETING --> NORMAL -------> (Done)
  |
  | call() throws exception
  V
COMPLETING --> EXCEPTIONAL ----> (Done)
  |
  | cancel(true) called while running
  V
INTERRUPTING --> INTERRUPTED ---> (Done)


```

*(注意：实际的 `run()` 方法执行期间 `state` 仍是 `NEW`，直到 `call()` 结束后才尝试变为 `COMPLETING` 或 `cancel()` 介入变为 `CANCELLED`/`INTERRUPTING`)*

#### 2.2 线程安全基石：`volatile` 与 CAS

`FutureTask` 需要在多线程环境中安全地运行：主线程可能调用 `get()` 或 `cancel()`，而工作线程正在执行 `run()`。它是如何保证线程安全的呢？主要依靠以下机制：

1. **`volatile` 保证可见性**：

   * `state`: 任务状态的变化对所有线程立即可见。
   * `runner` (类型 `volatile Thread`): 存储正在执行 `run()` 方法的线程。`volatile` 确保当一个线程成功设置 `runner` 后，其他尝试执行 `run()` 的线程能立刻看到 `runner` 不再是 `null`，从而避免任务被重复执行。
   * `waiters` (类型 `volatile WaitNode`): 指向等待结果的线程组成的链表的头节点。`volatile` 确保对等待链表的修改（添加新等待者、移除等待者）能被其他线程及时观察到。
   * `outcome` (类型 `volatile Object`): 存储计算结果或异常。虽然结果设置主要依赖 CAS 控制状态转换，但 `volatile` 提供了额外的内存屏障，确保结果对读取线程的可见性。
2. **CAS (Compare-And-Swap) 原子操作**：  
    CAS 是一种非阻塞的原子操作，通常由 CPU 指令直接支持。它的思想是：“我认为内存地址 `V` 的值应该是 `A`，如果是的话，就把它更新为 `B`，否则什么都不做并告诉我更新失败了。” 这个比较和交换的过程是原子的，不会被其他线程打断。

   `FutureTask` 大量使用 CAS 来原子性地更新 `state` 变量，这是其无锁设计的核心。例如：

   * **执行任务 (`run()` 方法开始时):**

     ```
     // 尝试将 runner 字段从 null 设置为当前线程
     // 如果 casRunner 成功，表示当前线程获得了执行权
     if (state == NEW && UNSAFE.compareAndSwapObject(this, runnerOffset, null, Thread.currentThread())) {
         // ... 开始执行任务 ...
     }


     + 1
     + 2
     + 3
     + 4
     + 5
     ```

     这确保了只有一个线程能成功设置 `runner` 并执行任务体。
   * **设置正常结果 (`set(V v)`):**

     ```
     // 尝试将 state 从 NEW 原子地更新为 COMPLETING
     if (UNSAFE.compareAndSwapInt(this, stateOffset, NEW, COMPLETING)) {
         outcome = v; // 只有 CAS 成功的线程才能设置结果
         // 设置最终状态 NORMAL (使用 putOrderedInt 优化写屏障)
         UNSAFE.putOrderedInt(this, stateOffset, NORMAL);
         finishCompletion(); // 唤醒等待者
     }


     + 1
     + 2
     + 3
     + 4
     + 5
     + 6
     + 7
     ```

     这保证了即使多个线程意外地（虽然设计上不应该）尝试设置结果，也只有一个能成功将状态从 `NEW` 改为 `COMPLETING`，从而保证结果只被设置一次。
   * **设置异常结果 (`setException(Throwable t)`):**

     ```
     // 尝试将 state 从 NEW 原子地更新为 COMPLETING
     if (UNSAFE.compareAndSwapInt(this, stateOffset, NEW, COMPLETING)) {
         outcome = t; // 存储异常对象
         UNSAFE.putOrderedInt(this, stateOffset, EXCEPTIONAL); // 设置最终状态 EXCEPTIONAL
         finishCompletion(); // 唤醒等待者
     }


     + 1
     + 2
     + 3
     + 4
     + 5
     + 6
     ```

     原理同 `set()`。
   * **取消任务 (`cancel(boolean mayInterruptIfRunning)`):**

     ```
     // 只能取消 NEW 状态的任务
     if (state != NEW) return false;

     if (mayInterruptIfRunning) {
         // 尝试将 state 从 NEW 原子更新为 INTERRUPTING
         if (UNSAFE.compareAndSwapInt(this, stateOffset, NEW, INTERRUPTING)) {
             try {
                 Thread t = runner; // 获取正在执行的线程
                 if (t != null)
                     t.interrupt(); // 中断它
             } finally {
                 // 设置最终状态 INTERRUPTED
                 UNSAFE.putOrderedInt(this, stateOffset, INTERRUPTED);
             }
             finishCompletion(); // 唤醒等待者
             return true;
         }
     } else {
         // 尝试将 state 从 NEW 原子更新为 CANCELLED
         if (UNSAFE.compareAndSwapInt(this, stateOffset, NEW, CANCELLED)) {
              finishCompletion(); // 唤醒等待者
              return true;
         }
     }
     return false; // CAS 失败，说明状态已改变，取消失败


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
     ```

     CAS 确保了取消操作的原子性，避免了与 `run()` 方法或其他 `cancel()` 调用发生竞态条件。

   **为什么用 CAS 而不是 `synchronized`？**  
    `synchronized` 是悲观锁，它假设总会发生并发冲突，所以在访问共享资源前先加锁，阻塞其他线程。在高并发场景下，线程阻塞和唤醒的开销可能很大。  
    CAS 是乐观锁的思想，它假设冲突是小概率事件，先尝试更新，如果失败了（说明有冲突），再重试或采取其他策略。在很多并发场景下，CAS 比 `synchronized` 具有更好的性能，因为它避免了线程上下文切换的开销。`FutureTask` 的设计者选择了基于 CAS 的无锁（或称轻量级锁）方案来实现核心状态管理，以追求更高的执行效率。

#### 2.3 等待/通知机制：`WaitNode` 与 `LockSupport`

当主线程调用 `futureTask.get()` 而任务尚未完成时，主线程需要阻塞等待。`FutureTask` 没有使用传统的 `Object.wait()` / `notify()` / `notifyAll()`，而是采用了一种类似于 `AbstractQueuedSynchronizer` (AQS) 的机制，基于 `LockSupport.park()` 和 `LockSupport.unpark()` 实现。

1. **`WaitNode` 等待节点**:  
    这是一个简单的内部静态类，用于封装等待结果的线程。

   ```
   static final class WaitNode {
       volatile Thread thread; // 等待的线程实例
       volatile WaitNode next; // 指向链表中的下一个等待节点
       WaitNode() { thread = Thread.currentThread(); } // 构造时记录当前线程
   }


   ```

   所有调用 `get()` (或其他阻塞方法如 `get(timeout, unit)`) 但任务未完成的线程，会被包装成一个 `WaitNode` 对象。
2. **`waiters` 等待链表**:  
    `FutureTask` 内部维护一个 `volatile WaitNode waiters` 字段，它指向一个单向链表的头节点。这个链表被称为 Treiber stack（一种无锁栈结构），用于存储所有等待任务完成的线程节点。

   * **入队 (添加等待者)**: 当一个线程调用 `get()` 发现任务未完成，它会创建一个新的 `WaitNode`，然后使用 CAS 操作将其原子性地添加到 `waiters` 链表的头部。
   * **出队 (唤醒等待者)**: 当任务完成时（状态变为 `NORMAL`, `EXCEPTIONAL`, `CANCELLED`, 或 `INTERRUPTED`），执行 `finishCompletion()` 方法。该方法会遍历 `waiters` 链表，并使用 `LockSupport.unpark(node.thread)` 逐个唤醒所有等待的线程。
3. **`LockSupport.park()` / `unpark()`**:

   * `LockSupport.park()`: 使当前线程阻塞，放弃 CPU，进入等待状态。它不需要持有任何锁。
   * `LockSupport.unpark(Thread thread)`: 唤醒指定的线程 `thread`。如果该线程之前没有调用 `park()`，那么这次 `unpark()` 调用会被“记住”，下次该线程调用 `park()` 时会立即返回，不会阻塞。这解决了 `wait/notify` 可能出现的信号丢失问题。

**`get()` 方法的阻塞流程 (简化版):**

```
public V get() throws InterruptedException, ExecutionException {
    int s = state;
    // 1. 如果任务未完成 (状态 <= COMPLETING)
    if (s <= COMPLETING) {
        // 2. 调用 awaitDone() 进行等待
        s = awaitDone(false, 0L); // false 表示不带超时
    }
    // 3. 任务已完成，根据最终状态返回结果或抛出异常
    return report(s);
}

private int awaitDone(boolean timed, long nanos) throws InterruptedException {
    final long deadline = timed ? System.nanoTime() + nanos : 0L; // 计算截止时间
    WaitNode q = null; // 当前线程的等待节点
    boolean queued = false; // 是否已入队

    for (;;) { // 无限循环，直到任务完成或中断/超时
        // 检查中断状态
        if (Thread.interrupted()) {
            removeWaiter(q); // 从等待队列移除自己
            throw new InterruptedException();
        }

        int s = state;
        // a. 如果任务已完成，直接返回状态
        if (s > COMPLETING) {
            if (q != null) q.thread = null; // 帮助 GC
            return s;
        }
        // b. 如果任务正在设置结果 (瞬时状态)，让出 CPU 等待一会
        else if (s == COMPLETING) {
            Thread.yield();
        }
        // c. 如果当前线程的 WaitNode 还未创建
        else if (q == null) {
            q = new WaitNode(); // 创建节点
        }
        // d. 如果当前线程还未加入等待队列
        else if (!queued) {
            // 使用 CAS 将节点加入 waiters 链表头部
            queued = UNSAFE.compareAndSwapObject(this, waitersOffset, q.next = waiters, q);
        }
        // e. 如果设置了超时
        else if (timed) {
            nanos = deadline - System.nanoTime();
            // 超时，移除节点并返回当前状态 (get方法会据此抛TimeoutException)
            if (nanos <= 0L) {
                removeWaiter(q);
                return state;
            }
            // 未超时，带时限地阻塞当前线程
            LockSupport.parkNanos(this, nanos);
        }
        // f. 无超时，无限期阻塞当前线程
        else {
            LockSupport.park(this);
        }
    }
}

// 任务完成时调用的方法
private void finishCompletion() {
    // 遍历 waiters 链表，唤醒所有等待线程
    for (WaitNode q; (q = waiters) != null;) {
        // 使用 CAS 将 waiters 设置为 null，断开链表
        if (UNSAFE.compareAndSwapObject(this, waitersOffset, q, null)) {
            for (;;) { // 循环处理旧链表中的节点
                Thread t = q.thread;
                if (t != null) {
                    q.thread = null;
                    LockSupport.unpark(t); // 唤醒等待线程
                }
                WaitNode next = q.next;
                if (next == null) break; // 到达链表末尾
                q.next = null; // help GC
                q = next;
            }
            break; // 已处理完旧链表，退出外层循环
        }
    }
    // 执行其他清理工作 (如调用 done() 钩子方法)
    done();
    // 将 callable 设为 null，帮助 GC
    callable = null;
}

// 从等待队列移除节点 (主要在中断或超时时调用)
private void removeWaiter(WaitNode node) {
    if (node != null) {
        node.thread = null; // 清除线程引用
        // (源码中还有一段复杂的 CAS 链表遍历删除逻辑，此处简化)
        // 目的是将 node 从 waiters 链表中安全移除
    }
}


```

**优点：**

* **性能**：`LockSupport.park/unpark` 比 `Object.wait/notify` 更底层，通常开销更小。
* **无锁竞争**：等待队列的维护主要通过 CAS 操作，避免了获取 `synchronized` 锁的竞争。
* **避免信号丢失**：`unpark` 可以先于 `park` 调用。

这种基于 `volatile` + CAS + `LockSupport` 的无锁/轻量级锁设计，是 JUC 包中许多并发工具（如 AQS、`ConcurrentHashMap` 部分实现）的典型模式，体现了 Java 并发编程的高级技巧。

#### 2.4 任务取消处理 (`cancel`)

`cancel(boolean mayInterruptIfRunning)` 方法的逻辑在 CAS 部分已经有所提及，这里再总结一下关键点：

1. **状态检查**：只有 `state` 为 `NEW` 的任务才能被取消。如果任务已经开始执行（`runner` 非 `null` 但 `state` 仍为 `NEW`）、已完成或已被取消，`cancel` 调用会失败并返回 `false`。
2. **原子状态更新**：使用 CAS 将 `state` 从 `NEW` 原子地更新到目标状态 (`CANCELLED` 或 `INTERRUPTING`)。这是确保取消操作与 `run()` 方法并发安全的关键。
3. **中断决策 (`mayInterruptIfRunning`)**:
   * **`false`**: 不尝试中断正在执行的线程。直接将状态设为 `CANCELLED`。适用于那些不希望或无法安全中断的任务。即使任务代码继续运行，`get()` 方法也会抛出 `CancellationException`。
   * **`true`**: 尝试中断正在执行任务的线程。先将状态设为 `INTERRUPTING`，然后获取 `runner` 线程并调用 `t.interrupt()`。最后将状态设为 `INTERRUPTED`。这要求任务代码能够正确响应中断请求（例如，检查 `Thread.currentThread().isInterrupted()` 或捕获 `InterruptedException`）。
4. **唤醒等待者**：无论取消是否成功中断线程，只要状态成功变为终止状态（`CANCELLED` 或 `INTERRUPTED`），都会调用 `finishCompletion()` 来唤醒所有因调用 `get()` 而阻塞的线程。这些被唤醒的线程随后会发现任务已被取消，并抛出 `CancellationException`。

**如何让任务响应中断？**  
 如果希望 `cancel(true)` 能真正停止任务，任务代码（`Callable` 或 `Runnable` 的实现）需要：

* 在耗时操作（如循环、`sleep`, `wait`, `join`, IO 操作）前后检查中断状态: `if (Thread.currentThread().isInterrupted()) { throw new InterruptedException("Task cancelled"); }`
* 或者，直接捕获由阻塞方法（如 `Thread.sleep()`, `Object.wait()`, `BlockingQueue.take()`）抛出的 `InterruptedException`，并进行清理和退出。

```
Callable<String> interruptibleTask = () -> {
    try {
        for (int i = 0; i < 1000; i++) {
            // 检查点 1: 在循环开始时检查中断状态
            if (Thread.currentThread().isInterrupted()) {
                System.out.println("任务在循环开始时检测到中断，退出...");
                throw new InterruptedException();
            }

            System.out.println("Processing step " + i);
            // 模拟耗时工作
            // 检查点 2: sleep 会响应中断并抛出 InterruptedException
            Thread.sleep(10);

            // 检查点 3: 在循环结束时再次检查 (可选，取决于业务)
            if (Thread.currentThread().isInterrupted()) {
                 System.out.println("任务在循环结束时检测到中断，退出...");
                throw new InterruptedException();
            }
        }
        return "Task Completed Successfully";
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt(); // 重新设置中断状态是个好习惯
        System.out.println("任务捕获到 InterruptedException，正在清理...");
        // 执行必要的清理操作
        return "Task Cancelled/Interrupted"; // 或者抛出异常
    }
};


```

#### 2.5 结果与异常的存储 (`outcome`)

`FutureTask` 使用一个 `volatile Object outcome` 字段来存储任务的最终结果或执行过程中抛出的异常。

* **正常完成**: `set(V v)` 方法被调用（在 `run()` 方法内部），`outcome` 被设置为计算结果 `v`，`state` 变为 `NORMAL`。
* **异常完成**: `setException(Throwable t)` 方法被调用（在 `run()` 方法内部捕获到异常时），`outcome` 被设置为抛出的异常 `t`，`state` 变为 `EXCEPTIONAL`。
* **取消**: `outcome` 字段通常保持为 `null`（或其初始值）。`get()` 方法通过检查 `state` 是否为 `CANCELLED` 或 `INTERRUPTED` 来抛出 `CancellationException`。

`get()` 方法中的 `report(int s)` 方法负责根据最终的 `state` 来处理 `outcome`：

```
// 根据最终状态 s 返回结果或抛出异常
private V report(int s) throws ExecutionException {
    Object x = outcome;
    if (s == NORMAL) // 正常完成
        return (V)x; // 返回结果
    if (s >= CANCELLED) // 被取消 (CANCELLED 或 INTERRUPTED)
        throw new CancellationException();
    // 异常完成 (EXCEPTIONAL)
    throw new ExecutionException((Throwable)x); // 将存储的异常包装成 ExecutionException 抛出
}


```

这种设计确保了无论是正常结果还是异常，都只会被设置一次，并且 `get()` 方法能根据任务的最终状态给出正确的响应。

#### 2.6 确保任务只执行一次 (`run()`)

`run()` 方法是 `FutureTask` 的执行入口。它必须确保即使被多个线程调用，内部的 `Callable` 或 `Runnable` 任务也只会被执行一次。

```
public void run() {
    // 1. 状态检查：如果 state 不是 NEW，或者 runner CAS 设置失败，说明任务已执行或已被其他线程抢先，直接返回。
    if (state != NEW ||
        !UNSAFE.compareAndSwapObject(this, runnerOffset,
                                     null, Thread.currentThread()))
        return;

    try {
        Callable<V> c = callable; // 获取用户传入的任务
        if (c != null && state == NEW) { // 再次检查 state
            V result;
            boolean ran; // 标记任务是否实际运行了
            try {
                // 2. 执行核心任务
                result = c.call();
                ran = true;
            } catch (Throwable ex) {
                // 3. 捕获任务执行中的所有异常
                result = null; // 结果置为 null
                ran = false; // 标记为未成功运行 (虽然执行了但抛异常)
                setException(ex); // 设置异常结果
            }
            // 4. 如果任务成功运行 (没抛异常)
            if (ran)
                set(result); // 设置正常结果
        }
    } finally {
        // 5. 清理 runner 字段，无论成功、异常还是被取消(在set/setException/cancel内部会调用finishCompletion)
        // runner must be non-null until state is settled to
        // prevent concurrent calls to run()
        runner = null; // 将 runner 设回 null
        // state must be re-read after nulling runner to prevent
        // leaked interrupts
        int s = state;
        // 6. 如果任务被中断了 (INTERRUPTING 状态)，处理中断状态转换
        if (s >= INTERRUPTING)
            handlePossibleCancellationInterrupt(s); // 确保状态变为 INTERRUPTED
    }
}

// (handlePossibleCancellationInterrupt 逻辑相对简单，主要是确保 INTERRUPTING 状态最终变为 INTERRUPTED)


```

**关键保证：**

* **入口检查**: `if (state != NEW || !UNSAFE.compareAndSwapObject(... runner ...))` 这行代码是核心。
  + `state != NEW`: 如果任务已不再是初始状态（可能已完成或被取消），直接返回。
  + `!UNSAFE.compareAndSwapObject(...)`: 使用 CAS 原子地尝试将 `runner` 从 `null` 设置为当前线程。如果失败，说明其他线程已经抢先设置了 `runner`（即任务已经在执行或即将执行），当前线程直接返回。
* **`runner` 字段**: 只有成功设置 `runner` 的线程才能继续执行 `c.call()`。
* **`finally` 块**: 确保 `runner` 最终会被设回 `null`，即使任务执行抛出异常。同时处理了中断状态的最终确认。

通过这种 CAS + `volatile runner` 的机制，`FutureTask` 完美地实现了任务的“执行一次”语义。

### 三、 使用场景与实践

掌握了 `FutureTask` 的内部原理后，我们来看看它在实际开发中的典型应用场景。

#### 3.1 在线程池中使用 FutureTask

`FutureTask` 与 `ExecutorService` (线程池) 是天作之合。将 `FutureTask` 提交给线程池执行是最常见的用法。

**优势：**

* **资源复用**：线程池管理线程生命周期，避免频繁创建和销毁线程的开销。
* **并发控制**：可以控制同时执行的任务数量，防止系统资源耗尽。
* **解耦**：任务的提交者不需要关心任务由哪个线程执行，只需与返回的 `Future` (即 `FutureTask` 本身) 交互。

**示例：**

```
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;

public class FutureTaskInThreadPool {

    public static void main(String[] args) {
        // 创建一个固定大小的线程池
        ExecutorService executor = Executors.newFixedThreadPool(3); // 最多同时执行3个任务

        List<FutureTask<String>> taskList = new ArrayList<>();

        System.out.println("提交 10 个任务到线程池...");

        // 创建并提交 10 个 FutureTask
        for (int i = 0; i < 10; i++) {
            final int taskId = i;
            Callable<String> task = () -> {
                System.out.println("任务 " + taskId + " 开始执行 by " + Thread.currentThread().getName());
                // 模拟耗时操作
                TimeUnit.SECONDS.sleep(2);
                System.out.println("任务 " + taskId + " 执行完毕 by " + Thread.currentThread().getName());
                return "任务 " + taskId + " 的结果";
            };

            FutureTask<String> futureTask = new FutureTask<>(task);
            taskList.add(futureTask);

            // 提交 FutureTask 到线程池
            // executor.execute(futureTask); // execute 方法没有返回值
            executor.submit(futureTask); // submit 方法会返回传入的 FutureTask，更常用
        }

        System.out.println("所有任务已提交，主线程开始获取结果...");

        // 遍历 FutureTask 列表，获取结果
        for (int i = 0; i < taskList.size(); i++) {
            FutureTask<String> futureTask = taskList.get(i);
            try {
                // get() 方法会阻塞，直到该任务完成
                String result = futureTask.get(); // 按提交顺序获取结果
                System.out.println("主线程获取到结果: " + result);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                System.err.println("主线程在等待任务 " + i + " 时被中断");
                futureTask.cancel(true);
            } catch (ExecutionException e) {
                System.err.println("任务 " + i + " 执行失败: " + e.getCause());
            } catch (CancellationException e) {
                System.err.println("任务 " + i + " 被取消");
            }
        }

        System.out.println("所有结果获取完毕（或任务异常/取消）。");

        // 关闭线程池
        executor.shutdown(); // 不再接受新任务，等待已提交任务执行完成
        try {
            // 等待线程池终止，设置超时
            if (!executor.awaitTermination(60, TimeUnit.SECONDS)) {
                System.err.println("线程池未在60秒内关闭，强制关闭...");
                executor.shutdownNow(); // 尝试中断正在执行的任务
            }
        } catch (InterruptedException e) {
            executor.shutdownNow();
            Thread.currentThread().interrupt();
        }

        System.out.println("程序结束。");
    }
}


```

**注意点：**

* `executor.submit(futureTask)` 是推荐的提交方式，它明确返回了你传入的 `FutureTask` 对象。虽然 `executor.execute(futureTask)` 也能执行，但 `execute` 的设计初衷是用于提交不需要返回值的 `Runnable`。
* 获取结果的顺序：上面的例子是按照任务提交的顺序调用 `get()`。这意味着如果第一个任务执行很慢，即使后面的任务已经完成了，主线程也需要等待第一个任务完成后才能继续获取后面的结果。

#### 3.2 处理需要返回结果的异步计算

这是 `FutureTask` 最核心的应用场景：执行一个耗时操作，并在稍后获取其结果，期间主线程可以做其他事情。

```
import java.util.concurrent.*;

public class AsyncCalculationExample {

    // 模拟一个耗时的网络请求或数据库查询
    private static String fetchDataFromRemote(String query) throws InterruptedException {
        System.out.println("[" + Thread.currentThread().getName() + "] 开始查询: " + query);
        TimeUnit.SECONDS.sleep(3); // 模拟网络延迟
        System.out.println("[" + Thread.currentThread().getName() + "] 查询完成: " + query);
        return "Data for " + query;
    }

    // 模拟其他需要在主线程执行的工作
    private static void doOtherWork() throws InterruptedException {
        System.out.println("[" + Thread.currentThread().getName() + "] 主线程开始做其他工作...");
        TimeUnit.SECONDS.sleep(1);
        System.out.println("[" + Thread.currentThread().getName() + "] 主线程其他工作完成.");
    }

    public static void main(String[] args) {
        ExecutorService executor = Executors.newSingleThreadExecutor(); // 使用单线程线程池

        // 1. 创建 Callable 任务
        Callable<String> remoteCall = () -> fetchDataFromRemote("User Profile");

        // 2. 封装成 FutureTask
        FutureTask<String> futureTask = new FutureTask<>(remoteCall);

        // 3. 提交任务到线程池执行
        executor.submit(futureTask);
        System.out.println("[" + Thread.currentThread().getName() + "] 异步查询已提交.");

        // 4. 主线程执行其他任务
        try {
            doOtherWork();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            System.err.println("主线程在做其他工作时被中断");
            futureTask.cancel(true); // 如果主线程中断，可能也需要取消后台任务
        }

        // 5. 在需要结果时获取结果
        System.out.println("[" + Thread.currentThread().getName() + "] 现在需要查询结果...");
        try {
            // 使用带超时的 get 获取结果，比如最多等 5 秒
            String result = futureTask.get(5, TimeUnit.SECONDS);
            System.out.println("[" + Thread.currentThread().getName() + "] 成功获取结果: " + result);
            // 基于结果进行后续处理...
            processResult(result);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            System.err.println("主线程在等待结果时被中断");
            futureTask.cancel(true);
        } catch (ExecutionException e) {
            System.err.println("远程查询任务执行失败: " + e.getCause());
        } catch (TimeoutException e) {
            System.err.println("获取远程查询结果超时！");
            futureTask.cancel(true);
        } catch (CancellationException e) {
            System.err.println("远程查询任务已被取消。");
        } finally {
            // 关闭线程池
            executor.shutdown();
        }
    }

    private static void processResult(String data) {
        System.out.println("[" + Thread.currentThread().getName() + "] 正在处理结果: " + data.toUpperCase());
    }
}


```

这个例子展示了典型的异步处理流程：提交任务 -> 做其他事 -> 获取结果 -> 处理结果/异常。

#### 3.3 利用 `ExecutorCompletionService` 获取先完成的任务

当提交了大量任务到线程池，并且希望**哪个任务先完成就先处理哪个**时，`FutureTask` 结合 `ExecutorCompletionService` 非常有用。`ExecutorCompletionService` 内部维护一个完成队列，任务完成后其对应的 `Future` 会被放入队列中。

```
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.concurrent.*;

public class CompletionServiceExample {

    public static void main(String[] args) {
        ExecutorService executor = Executors.newFixedThreadPool(5);
        // 创建 ExecutorCompletionService，传入线程池
        CompletionService<String> completionService = new ExecutorCompletionService<>(executor);

        List<Future<String>> futures = new ArrayList<>(); // 用于跟踪所有提交的 Future
        Random random = new Random();

        System.out.println("提交 10 个耗时不同的任务...");

        for (int i = 0; i < 10; i++) {
            final int taskId = i;
            final int sleepTime = random.nextInt(5) + 1; // 随机睡眠 1-5 秒

            Callable<String> task = () -> {
                System.out.println("任务 " + taskId + " 开始执行 (耗时 " + sleepTime + "s) by " + Thread.currentThread().getName());
                TimeUnit.SECONDS.sleep(sleepTime);
                System.out.println("任务 " + taskId + " 执行完毕 by " + Thread.currentThread().getName());
                // if (taskId == 3) throw new RuntimeException("任务3模拟出错"); // 模拟某个任务出错
                return "任务 " + taskId + " 的结果 (耗时 " + sleepTime + "s)";
            };

            // 提交 Callable 到 CompletionService
            // CompletionService 会自动将其包装成 FutureTask (或类似的内部实现)
            Future<String> future = completionService.submit(task);
            futures.add(future);
        }

        System.out.println("所有任务已提交，开始按完成顺序处理结果...");

        // 按完成顺序获取结果
        for (int i = 0; i < 10; i++) { // 总共有 10 个任务
            try {
                // completionService.take() 会阻塞，直到有任务完成
                // 返回的是已完成任务的 Future 对象
                Future<String> completedFuture = completionService.take();
                String result = completedFuture.get(); // 获取结果 (此时 get() 会立即返回，因为任务已完成)
                System.out.println("处理完成的结果: " + result);
                // 从跟踪列表中移除（可选）
                futures.remove(completedFuture);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                System.err.println("主线程在等待任务完成时被中断");
                // 中断时，取消所有剩余未完成的任务
                cancelRemainingTasks(futures);
                break; // 退出循环
            } catch (ExecutionException e) {
                System.err.println("一个任务执行失败: " + e.getCause());
                // 即使一个任务失败，我们通常也希望继续处理其他已完成的任务
            } catch (CancellationException e){
                 System.err.println("一个任务在获取结果前被取消了");
            }
        }

         // 如果循环正常结束，检查是否还有未处理的 future (理论上不应该有)
        if (!futures.isEmpty()) {
            System.err.println("警告：处理循环结束后仍有 " + futures.size() + " 个 Future 未被处理！");
            cancelRemainingTasks(futures);
        }

        System.out.println("所有结果处理完毕（或中断/异常）。");

        // 关闭线程池
        executor.shutdown();
        // ... (省略关闭线程池的等待逻辑) ...
        System.out.println("程序结束。");
    }

    private static void cancelRemainingTasks(List<Future<String>> futures) {
         System.out.println("尝试取消剩余 " + futures.size() + " 个任务...");
         for (Future<String> f : futures) {
             f.cancel(true); // 尝试中断正在执行的任务
         }
    }
}


```

`ExecutorCompletionService` 简化了处理异构耗时任务结果的场景，使得程序能更快地响应已完成的任务。

#### 3.4 实现简单的 缓存

`FutureTask` 可以用来构建一个简单的“计算一次，后续复用”的缓存机制。当多个线程请求同一个计算结果时，只有一个线程实际执行计算，其他线程等待该计算完成并复用结果。

```
import java.util.concurrent.*;

public class SimpleCache<K, V> {

    private final ConcurrentMap<K, Future<V>> cache = new ConcurrentHashMap<>();

    public V compute(K key, Callable<V> computation) throws InterruptedException, ExecutionException {
        while (true) {
            Future<V> f = cache.get(key);
            if (f == null) {
                // 缓存中没有，创建 FutureTask
                FutureTask<V> ft = new FutureTask<>(computation);
                // 尝试放入缓存，putIfAbsent 是原子操作
                f = cache.putIfAbsent(key, ft);
                if (f == null) {
                    // 成功放入，当前线程负责执行计算
                    f = ft;
                    System.out.println("Key [" + key + "] 不在缓存中，由线程 [" + Thread.currentThread().getName() + "] 执行计算...");
                    ft.run(); // 直接在当前线程运行 (也可以提交到线程池)
                }
                // 如果 f != null，说明几乎同时有另一个线程放入了 FutureTask，我们用那个
            }

            try {
                // 获取结果，如果计算未完成会阻塞
                System.out.println("线程 [" + Thread.currentThread().getName() + "] 尝试获取 Key [" + key + "] 的结果...");
                return f.get();
            } catch (CancellationException e) {
                // 如果计算被取消了，从缓存移除，让下次请求重新计算
                System.err.println("计算 Key [" + key + "] 被取消，从缓存移除。");
                cache.remove(key, f); // 仅当 key 对应的 value 是 f 时才移除
                // 循环会继续，下次尝试重新计算
            } catch (ExecutionException e) {
                // 计算出错，也从缓存移除 (取决于策略，有时可能缓存错误结果)
                 System.err.println("计算 Key [" + key + "] 出错: " + e.getCause() + "，从缓存移除。");
                 cache.remove(key, f);
                throw e; // 将异常抛出给调用者
            }
            // 如果 get 正常返回，则退出循环并返回结果
            // 如果捕获了 CancellationException，循环会继续
        }
    }

    public static void main(String[] args) {
        SimpleCache<String, String> cache = new SimpleCache<>();
        ExecutorService executor = Executors.newFixedThreadPool(5);

        Callable<String> computation = () -> {
            System.out.println("--- 开始执行耗时计算 for key 'data' by " + Thread.currentThread().getName() + " ---");
            TimeUnit.SECONDS.sleep(3);
            System.out.println("--- 耗时计算 for key 'data' 完成 by " + Thread.currentThread().getName() + " ---");
            return "Computed Data";
        };

        // 模拟多个线程同时请求同一个 key
        for (int i = 0; i < 5; i++) {
            executor.submit(() -> {
                try {
                    String result = cache.compute("data", computation);
                    System.out.println("线程 [" + Thread.currentThread().getName() + "] 获取到结果: " + result);
                } catch (Exception e) {
                    System.err.println("线程 [" + Thread.currentThread().getName() + "] 获取结果时出错: " + e.getMessage());
                }
            });
        }

        executor.shutdown();
    }
}


```

这个简单的缓存利用了 `ConcurrentHashMap` 的原子操作 `putIfAbsent` 和 `FutureTask` 的执行一次性语义，确保了对于同一个 `key`，`computation` 只会被执行一次。

### 四、 FutureTask 与 CompletableFuture

Java 8 引入了 `CompletableFuture`，它提供了比 `FutureTask` 更强大、更灵活的异步编程能力。理解它们的区别有助于选择合适的工具。

| 特性 | FutureTask | CompletableFuture |
| --- | --- | --- |
| **核心模型** | 阻塞式 (`get()` 会阻塞) | 回调式、非阻塞 (主要通过 `thenApply`, `thenAccept` 等) |
| **任务组合** | 不支持 | 支持 (串行 `thenApply`, 并行 `thenCombine`, `allOf`, `anyOf`) |
| **结果转换** | 不支持 | 支持 (`thenApply`, `thenCompose`) |
| **异常处理** | `get()` 抛 `ExecutionException` | 专门方法 (`exceptionally`, `handle`) |
| **回调注册** | 不直接支持 (有 `done()` 钩子，但功能有限) | 核心特性 (`thenRun`, `thenAccept`, `thenApply` 等) |
| **触发完成** | 只能通过 `run()` 执行任务来完成 | 可手动完成 (`complete`, `completeExceptionally`) |
| **默认线程池** | 需要显式提供执行者 (`Thread` 或 `Executor`) | 可使用默认 `ForkJoinPool.commonPool()` 或指定 `Executor` |
| **API 风格** | 传统接口方法 | 流式 API，链式调用 |
| **适用场景** | 简单异步计算、与老代码集成、精确控制执行线程 | 复杂异步工作流、多任务协作、需要非阻塞处理、响应式编程 |

**简单来说：**

* **`FutureTask`** 是一个具体的类，它将 `Runnable`/`Callable` 和 `Future` 结合起来，提供了一个基本的异步任务单元。它的交互方式主要是阻塞式的 `get()`。
* **`CompletableFuture`** 是一个更高级的抽象，它代表一个可能尚未完成的异步操作的结果。它提供了丰富的 API 来组合、转换、处理这些异步操作及其结果，并且鼓励使用非阻塞的回调方式。

**什么时候用 `FutureTask`？**

* 当你需要一个简单的、实现了 `Runnable` 和 `Future` 的对象，可以方便地提交给 `ExecutorService`。
* 当你的异步逻辑比较简单，不需要复杂的任务组合或链式处理。
* 当需要与只接受 `Runnable` 或 `Future` 的旧 API 集成时。
* 当你需要精确控制任务在哪个线程或 `Executor` 上执行时（虽然 `CompletableFuture` 也可以指定 `Executor`）。

**什么时候用 `CompletableFuture`？**

* 当你有多个异步任务，它们之间有依赖关系（一个任务的结果是另一个任务的输入）。
* 当你需要对异步结果进行转换、合并或处理。
* 当你希望避免阻塞，使用回调函数在任务完成时自动执行后续逻辑。
* 当你需要构建复杂的异步数据流或响应式系统。
* 当你希望利用默认的 `ForkJoinPool` 进行计算密集型任务的并行处理。

**示例：用 `CompletableFuture` 替代等待多个 `FutureTask`**

假设你需要执行两个异步任务，并在它们都完成后合并结果。

**使用 `FutureTask` (需要手动等待和获取):**

```
ExecutorService executor = Executors.newFixedThreadPool(2);
FutureTask<String> task1 = new FutureTask<>(() -> { TimeUnit.SECONDS.sleep(2); return "Result 1"; });
FutureTask<Integer> task2 = new FutureTask<>(() -> { TimeUnit.SECONDS.sleep(3); return 100; });

executor.submit(task1);
executor.submit(task2);

try {
    String result1 = task1.get(); // 阻塞等待 task1
    Integer result2 = task2.get(); // 阻塞等待 task2
    System.out.println("Combined: " + result1 + ", " + result2);
} catch (Exception e) { e.printStackTrace(); }
executor.shutdown();


```

**使用 `CompletableFuture` (非阻塞组合):**

```
ExecutorService executor = Executors.newFixedThreadPool(2);

CompletableFuture<String> future1 = CompletableFuture.supplyAsync(() -> {
    try { TimeUnit.SECONDS.sleep(2); } catch (InterruptedException e) { }
    return "Result 1";
}, executor);

CompletableFuture<Integer> future2 = CompletableFuture.supplyAsync(() -> {
    try { TimeUnit.SECONDS.sleep(3); } catch (InterruptedException e) { }
    // if(true) throw new RuntimeException("Simulated Error in task 2"); // 模拟异常
    return 100;
}, executor);

// 组合两个 Future，当它们都完成时执行回调
CompletableFuture<Void> combinedFuture = CompletableFuture.allOf(future1, future2);

combinedFuture.thenAccept(v -> { // allOf 完成后执行
    try {
        String result1 = future1.join(); // join() 非阻塞获取 (如果未完成会抛异常, 但此时 allOf 已保证完成)
        Integer result2 = future2.join();
        System.out.println("Combined: " + result1 + ", " + result2);
    } catch (CompletionException e) { // join 抛 CompletionException
         System.err.println("Error getting results after combined future: " + e.getCause());
    }
}).exceptionally(ex -> { // 处理 allOf 或 thenAccept 中的异常
    System.err.println("Error in combined operation: " + ex);
    return null;
});

System.out.println("Main thread continues immediately...");
// 等待 CompletableFuture 完成（仅为演示，实际应用中可能不需要主线程等待）
// combinedFuture.join(); // 或者在某个地方阻塞等待

// 需要等待异步任务完成才能关闭线程池，否则任务可能未执行完
executor.shutdown();
try { executor.awaitTermination(10, TimeUnit.SECONDS); } catch (InterruptedException e) {}
System.out.println("Main thread finished.");


```

`CompletableFuture` 的代码更具表达力，并且 `thenAccept` 回调的执行是异步的，不会阻塞主线程（除非显式调用 `join()` 或 `get()`）。

总的来说，`CompletableFuture` 是 Java 异步编程的未来趋势，但 `FutureTask` 作为一个基础且经典的并发工具，在很多场景下仍然非常有用且易于理解。

### 五、 源码分析：揭秘关键方法

通过分析 `FutureTask` 的核心方法源码（基于 
OpenJDK
 8，注释和部分代码可能简化以便理解），可以更深刻地理解其工作机制。

*(注意：以下源码分析中的 `UNSAFE` 相关操作是对 `sun.misc.Unsafe` 类方法的调用，用于执行底层的、非安全的内存操作，如 CAS 和 `volatile` 读写。直接使用 `Unsafe` 通常不被推荐，但在 JUC 包内部为了性能被广泛使用。)*

#### 5.1 `run()` 方法

```
public void run() {
    // 1. 状态与执行权检查
    // 如果 state 不是 NEW (任务已开始/完成/取消)
    // 或者 CAS 设置 runner 字段失败 (其他线程已抢先执行)
    // 则直接返回，保证任务只执行一次。
    if (state != NEW ||
        !UNSAFE.compareAndSwapObject(this, runnerOffset, // runnerOffset 是 runner 字段的内存偏移量
                                     null, Thread.currentThread())) // 尝试把 runner 从 null 原子更新为当前线程
        return;

    // CAS 成功，当前线程获得执行权
    try {
        Callable<V> c = callable; // 获取构造时传入的 Callable 对象
        // 再次检查 callable 是否为空且状态仍为 NEW
        if (c != null && state == NEW) {
            V result;     // 存储正常结果
            boolean ran; // 标记 Callable.call() 是否正常执行完毕
            try {
                // 2. 执行核心计算逻辑
                result = c.call(); // 调用用户定义的任务
                ran = true;       // 标记为正常执行
            } catch (Throwable ex) {
                // 3. 捕获所有异常 (包括 Error 和 Exception)
                result = null; // 结果设为 null
                ran = false;   // 标记为执行异常
                setException(ex); // 调用 setException 处理异常情况
            }
            // 4. 如果任务正常执行完毕
            if (ran)
                set(result); // 调用 set 处理正常结果
        }
    } finally {
        // 5. 清理 runner 字段
        // 必须在状态确定 (settled) 之前保持 runner 非空，防止 run() 被并发调用
        runner = null; // 将 runner 设回 null，允许其他线程进行状态检查

        // 6. 处理中断状态
        // 必须在 runner 设为 null 后重新读取 state，防止错过中断信号
        int s = state;
        if (s >= INTERRUPTING) // 如果状态是 INTERRUPTING 或 INTERRUPTED
            handlePossibleCancellationInterrupt(s); // 确保状态最终为 INTERRUPTED
    }
}


```

**核心逻辑：**

1. **入口的原子性检查**是防止任务重复执行的关键。
2. **执行 `Callable.call()`** 并捕获所有可能的 `Throwable`。
3. 根据 `call()` 的执行情况（正常返回或抛出异常），调用 `set()` 或 `setException()` 来设置最终结果和状态。
4. **`finally` 块**确保 `runner` 字段被清理，并处理可能的任务中断情况。

#### 5.2 `set(V v)` 和 `setException(Throwable t)`

这两个方法逻辑非常相似，负责在任务执行完成后设置最终状态和结果/异常。

```
/**
 * 设置任务的正常结果。
 */
protected void set(V v) {
    // 1. 原子状态转换
    // 尝试将 state 从 NEW 原子更新为 COMPLETING
    if (UNSAFE.compareAndSwapInt(this, stateOffset, NEW, COMPLETING)) {
        // CAS 成功，表示当前线程是第一个完成任务并设置结果的线程
        outcome = v; // 将计算结果存入 outcome 字段

        // 2. 设置最终状态
        // 使用 putOrderedInt 提供一个有序写操作，比 volatile 写开销小，但保证之前的写操作(outcome=v)对其他线程可见
        UNSAFE.putOrderedInt(this, stateOffset, NORMAL); // 将 state 设置为 NORMAL

        // 3. 唤醒等待者并清理
        finishCompletion();
    }
    // 如果 CAS 失败，说明 state 已不是 NEW (可能被取消或已被其他线程完成)，则什么都不做
}

/**
 * 设置任务的异常结果。
 */
protected void setException(Throwable t) {
    // 1. 原子状态转换
    // 尝试将 state 从 NEW 原子更新为 COMPLETING
    if (UNSAFE.compareAndSwapInt(this, stateOffset, NEW, COMPLETING)) {
        // CAS 成功
        outcome = t; // 将异常对象存入 outcome 字段
        UNSAFE.putOrderedInt(this, stateOffset, EXCEPTIONAL); // 将 state 设置为 EXCEPTIONAL
        // 2. 唤醒等待者并清理
        finishCompletion();
    }
}


```

**核心逻辑：**

1. **CAS `NEW -> COMPLETING`**：这是保证结果/异常只被设置一次的关键。只有一个线程能成功完成此 CAS。
2. **设置 `outcome`**: 存储结果或异常。
3. **设置最终状态 (`NORMAL` / `EXCEPTIONAL`)**: 使用 `putOrderedInt` 优化性能，同时保证内存可见性。
4. **调用 `finishCompletion()`**: 唤醒所有等待 `get()` 的线程。

#### 5.3 `get()` 和 `awaitDone()`

`get()` 方法负责获取结果，如果任务未完成则阻塞。核心的等待逻辑在 `awaitDone()` 中。

```
public V get() throws InterruptedException, ExecutionException {
    int s = state;
    // 1. 快速路径：如果任务已完成 (状态 > COMPLETING)，直接报告结果
    if (s <= COMPLETING) {
        // 2. 慢路径：任务未完成或正在完成，调用 awaitDone 等待
        s = awaitDone(false, 0L); // false 表示不带超时，0L 无意义
    }
    // 3. 根据最终状态 s，返回结果或抛出相应异常
    return report(s);
}

public V get(long timeout, TimeUnit unit)
        throws InterruptedException, ExecutionException, TimeoutException {
    if (unit == null) throw new NullPointerException();
    int s = state;
    // 1. 快速路径 + 超时检查
    if (s <= COMPLETING &&
        // 2. 调用 awaitDone 等待，传入超时参数
        (s = awaitDone(true, unit.toNanos(timeout))) <= COMPLETING) {
        // 3. 如果 awaitDone 返回时状态仍未完成 (说明超时了)
        throw new TimeoutException();
    }
    // 4. 根据最终状态报告结果或抛异常 (非 TimeoutException)
    return report(s);
}


/**
 * 等待任务完成的核心方法。
 * @param timed 是否带超时
 * @param nanos 超时时间 (纳秒)，如果 timed 为 false 则忽略
 * @return 任务完成时的状态
 */
private int awaitDone(boolean timed, long nanos) throws InterruptedException {
    // 计算截止时间戳 (如果 timed)
    final long deadline = timed ? System.nanoTime() + nanos : 0L;
    WaitNode q = null;     // 当前线程的等待节点
    boolean queued = false; // 标记当前线程是否已加入等待队列

    // 自旋等待，直到任务完成或中断/超时
    for (;;) {
        // 1. 检查当前线程中断状态
        if (Thread.interrupted()) {
            removeWaiter(q); // 从等待队列移除自己
            throw new InterruptedException(); // 抛出中断异常
        }

        // 2. 读取当前任务状态
        int s = state;
        // a. 如果任务已完成 (状态 > COMPLETING)
        if (s > COMPLETING) {
            if (q != null) q.thread = null; // 帮助 GC，清空节点中的线程引用
            return s; // 直接返回最终状态
        }
        // b. 如果任务正在完成中 (COMPLETING 是瞬时状态)
        else if (s == COMPLETING)
            // 让出 CPU 时间片，给完成任务的线程一点时间，避免忙等
            Thread.yield();
        // c. 如果当前线程的等待节点还未创建
        else if (q == null)
            q = new WaitNode(); // 创建一个包含当前线程的节点
        // d. 如果节点已创建但还未入队
        else if (!queued)
            // 使用 CAS 将新节点 q 原子地添加到 waiters 链表头部
            // q.next = waiters; queued = UNSAFE.compareAndSwapObject(this, waitersOffset, q.next, q);
             queued = UNSAFE.compareAndSwapObject(this, waitersOffset, q.next = waiters, q);
        // e. 如果设置了超时
        else if (timed) {
            nanos = deadline - System.nanoTime(); // 计算剩余时间
            // 如果已超时
            if (nanos <= 0L) {
                removeWaiter(q); // 从队列移除自己
                return state;   // 返回当前状态 (get 方法会检查并抛 TimeoutException)
            }
            // 未超时，阻塞当前线程指定纳秒
            LockSupport.parkNanos(this, nanos);
        }
        // f. 如果未设置超时，无限期阻塞当前线程
        else
            LockSupport.park(this); // 阻塞，等待 unpark 唤醒
    }
}


```

**核心逻辑：**

1. **循环检查状态**: 不断读取 `state`。
2. **处理中断**: 每次循环开始时检查中断状态，如果中断则移除等待节点并抛出 `InterruptedException`。
3. **快速返回**: 如果任务已完成，立即返回状态。
4. **让步**: 如果任务处于 `COMPLETING` 状态，`yield()` 让出 CPU。
5. **创建/入队 `WaitNode`**: 如果需要等待，创建 `WaitNode` 并使用 CAS 原子地加入 `waiters` 链表。
6. **阻塞**: 使用 `LockSupport.park()` (无限期) 或 `LockSupport.parkNanos()` (带超时) 阻塞当前线程。
7. **超时处理**: 如果带超时，计算剩余时间，超时则移除节点并返回。

#### 5.4 `finishCompletion()` 和 `removeWaiter()`

`finishCompletion()` 在任务状态变为最终态（`NORMAL`, `EXCEPTIONAL`, `CANCELLED`, `INTERRUPTED`）时被调用，负责唤醒所有等待者。`removeWaiter()` 则在等待者不再需要等待时（中断、超时）将其从队列移除。

```
/**
 * 任务完成后的收尾工作：唤醒等待者、调用 done() 钩子、清理 callable。
 */
private void finishCompletion() {
    // 1. 唤醒所有等待线程
    for (WaitNode q; (q = waiters) != null;) { // 读取头节点
        // 使用 CAS 将 waiters 原子地设为 null，相当于取下整个链表进行处理
        if (UNSAFE.compareAndSwapObject(this, waitersOffset, q, null)) {
            // CAS 成功，当前线程负责处理这个取下的链表
            for (;;) { // 遍历链表
                Thread t = q.thread;
                if (t != null) {
                    q.thread = null; // 清空节点中的线程引用
                    LockSupport.unpark(t); // 唤醒等待的线程 t
                }
                WaitNode next = q.next;
                if (next == null) // 到达链表末尾
                    break;
                q.next = null; // help GC
                q = next;     // 处理下一个节点
            }
            break; // 已处理完取下的链表，退出外层循环
        }
        // 如果 CAS 失败，说明有其他线程（通常是 removeWaiter）修改了 waiters，循环重试
    }

    // 2. 调用 done() 钩子方法 (子类可以覆盖此方法执行自定义逻辑)
    done();

    // 3. 清理 callable 引用，帮助 GC
    callable = null;
}

/**
 * 从等待队列中移除指定的节点。 (源码比较复杂，涉及CAS链表操作，此处简化描述)
 * 主要逻辑：
 * - 将 node.thread 设为 null。
 * - 从 waiters 链表头开始遍历，找到 node 的前驱节点 pred。
 * - 使用 CAS 将 pred.next 指向 node.next，从而将 node 从链表中移除。
 * - 需要处理并发移除和头节点移除等边界情况。
 */
private void removeWaiter(WaitNode node) {
    if (node != null) {
        node.thread = null; // 标记节点无效
        retry: // 标签，用于 continue retry
        for (;;) {          // Spin until CAS succeeds
            // 从头遍历链表查找 node 的前驱
            for (WaitNode pred = null, q = waiters, s; q != null; q = s) {
                s = q.next; // 下一个节点
                if (q.thread != null) // 如果当前节点 q 有效
                    pred = q;       // 更新前驱为 q
                else if (pred != null) { // 如果 q 无效 (thread == null) 且有前驱
                    pred.next = s;    // 尝试跳过无效节点 q
                    // 如果前驱 pred 也失效了，重试外层循环
                    if (pred.thread == null)
                        continue retry;
                }
                // 如果头节点就无效 (q==waiters 且 q.thread==null)
                else if (!UNSAFE.compareAndSwapObject(this, waitersOffset, q, s))
                    // 尝试用 CAS 更新头节点失败，重试外层循环
                    continue retry;
            }
            break; // 遍历完成，退出外层循环
        }
    }
}


```

**核心逻辑：**

* **`finishCompletion`**: 使用 CAS 原子地取下整个 `waiters` 链表，然后遍历链表并 `unpark` 每个节点中的线程。最后调用 `done()` 并清理 `callable`。
* **`removeWaiter`**: 在 `waiters` 链表中查找并安全地移除指定的 `WaitNode`，需要处理并发和链表操作的复杂性。

#### 5.5 `cancel(boolean mayInterruptIfRunning)`

```
public boolean cancel(boolean mayInterruptIfRunning) {
    // 1. 只能取消 NEW 状态的任务
    // 如果 state 不是 NEW，直接返回 false
    if (!(state == NEW &&
          // 2. 根据 mayInterruptIfRunning 尝试原子更新状态
          // a. 如果需要中断正在执行的线程
          (mayInterruptIfRunning ?
           // 尝试将 state 从 NEW 更新为 INTERRUPTING
           UNSAFE.compareAndSwapInt(this, stateOffset, NEW, INTERRUPTING) :
           // b. 如果不需要中断
           // 尝试将 state 从 NEW 更新为 CANCELLED
           UNSAFE.compareAndSwapInt(this, stateOffset, NEW, CANCELLED))))
        return false; // 状态不是 NEW 或 CAS 失败，都返回 false

    // CAS 成功，状态已变为 INTERRUPTING 或 CANCELLED
    try {
        // 3. 如果是需要中断的情况 (mayInterruptIfRunning is true)
        if (mayInterruptIfRunning) {
            try {
                Thread t = runner; // 获取正在执行任务的线程 (可能为 null)
                if (t != null)
                    t.interrupt(); // 中断该线程
            } finally { // 在 finally 中确保状态最终变为 INTERRUPTED
                // 将 state 设置为 INTERRUPTED
                UNSAFE.putOrderedInt(this, stateOffset, INTERRUPTED);
            }
        }
    } finally {
        // 4. 无论哪种取消方式，都需要唤醒等待者
        finishCompletion();
    }
    return true; // 取消操作成功启动
}


```

**核心逻辑：**

1. **检查 `state == NEW`**: 确保只取消未开始或刚开始的任务。
2. **原子更新 `state`**: 使用 CAS 将状态从 `NEW` 更新为 `INTERRUPTING` 或 `CANCELLED`。这是关键的原子操作。
3. **中断线程 (如果需要)**: 如果 `mayInterruptIfRunning` 为 `true` 且状态成功变为 `INTERRUPTING`，则获取 `runner` 线程并调用 `interrupt()`。之后将状态设为 `INTERRUPTED`。
4. **唤醒等待者**: 调用 `finishCompletion()` 唤醒所有 `get()` 的调用者，它们会收到 `CancellationException`。

通过以上源码分析，我们可以看到 `FutureTask` 内部实现的精妙之处：利用 `volatile` 保证可见性，利用 CAS 实现无锁或轻量级锁的状态管理和原子操作，利用 `LockSupport` 实现高效的线程阻塞与唤醒。这些技术的结合，使得 `FutureTask` 成为一个高效、可靠的异步编程基础组件。

### 六、 总结与展望

**核心要点回顾：**

1. **解决了什么问题**：解决了传统多线程编程中手动管理状态、同步、异常和结果获取的复杂性与易错性。
2. **核心机制**：基于 `volatile` 状态变量 (`state`)、CAS 原子操作和 `LockSupport` 的等待/通知机制，实现了高效的线程安全和异步协作。
3. **状态管理**：通过明确的状态（`NEW`, `COMPLETING`, `NORMAL`, `EXCEPTIONAL`, `CANCELLED`, `INTERRUPTING`, `INTERRUPTED`）及其单向转换，精确控制任务生命周期。
4. **关键 API**:
   * 构造器：接受 `Callable` 或 `Runnable` + `result`。
   * `run()`: 执行任务的核心入口，保证执行一次。
   * `get()` / `get(timeout, unit)`: 阻塞或带超时地获取结果，处理异常和取消。
   * `cancel(mayInterrupt)`: 尝试取消任务，可选择是否中断执行线程。
   * `isDone()` / `isCancelled()`: 查询任务状态。
5. **内部实现亮点**：无锁/轻量级锁设计，避免了 `synchronized` 的潜在性能瓶颈；Treiber stack 管理等待线程。
6. **应用场景**：线程池任务提交、简单异步计算、`ExecutorCompletionService` 结合、简单缓存实现等。
7. **与 `CompletableFuture` 对比**：`FutureTask` 更基础，交互以阻塞 `get()` 为主；`CompletableFuture` 更强大，支持非阻塞回调、任务组合与流式 API。

虽然 Java 8 引入的 `CompletableFuture` 在功能和灵活性上超越了 `FutureTask`，成为了现代 Java 异步编程的主流选择。但 `FutureTask` 作为一个设计精良、实现高效的基础并发工具，其内部蕴含的并发编程思想（如无锁设计、状态机）仍然值得我们深入学习和理解.
