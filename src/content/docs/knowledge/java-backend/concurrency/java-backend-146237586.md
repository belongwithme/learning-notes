---
title: "线程中断如何理解"
description: "线程中断是一种协作机制，不是强制终止线程的方式。它是一种线程间的通信方式，用于告诉目标线程\"你需要停止当前工作了\"。"
sourceId: "146237586"
source: "https://blog.csdn.net/qq_45852626/article/details/146237586"
sourceSeries: []
category: java-backend
subcategory: concurrency
tags:
  - "JUC"
status: draft
difficulty: intermediate
contentType: knowledge
sidebar:
  order: 146237586
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/146237586)（历史文章导入，当前状态为草稿）

### 什么是线程中断？

线程中断是一种协作机制，不是强制终止线程的方式。它是一种线程间的通信方式，用于告诉目标线程"你需要停止当前工作了"。

### 为什么会发生中断

1. 礼貌地停止线程

   * 不是强制关闭（不礼貌）
   * 而是通知它"该停下来了"（礼貌）
2. 可以做清理工作

   * 比如保存文件
   * 关闭连接
   * 释放资源
3. 线程中断通常发生在以下几种场景:

   * 人为调用中断
   * 超时中断
   * 取消操作

* 关闭线程池

### 中断的处理方式

* 显式处理中断

```
try {
    Thread.sleep(1000);  // 可中断方法
} catch (InterruptedException e) {
    // 1. 恢复中断状态
    Thread.currentThread().interrupt();
    // 2. 处理中断逻辑
    return;  // 或其他处理
}


```

* 传播中断

```
public void myMethod() throws InterruptedException {
    // 直接抛出中断异常，让调用者处理
    Thread.sleep(1000);
}


```

* 忽略中断

```
while (true) {
    try {
        Thread.sleep(1000);
    } catch (InterruptedException e) {
        // 忽略中断，继续执行
        continue;
    }
}


```

### 哪些方式可以让线程中断

1. 使用interrupt()方法（最常用）

```
public class InterruptExample {
    public static void main(String[] args) {
        Thread thread = new Thread(() -> {
            while (!Thread.currentThread().isInterrupted()) {
                System.out.println("线程运行中...");
            }
        });
        
        thread.start();
        // 调用interrupt()中断线程
        thread.interrupt();
    }
}


```

2. 使用超时机制

```
public class TimeoutExample {
    public static void main(String[] args) {
        // 1. 使用Thread.join()的超时版本
        Thread thread = new Thread(() -> {
            while (!Thread.currentThread().isInterrupted()) {
                // 执行任务
            }
        });
        thread.start();
        try {
            // 等待线程最多2秒
            thread.join(2000);
            if (thread.isAlive()) {
                thread.interrupt();
            }
        } catch (InterruptedException e) {
            thread.interrupt();
        }

        // 2. 使用Lock的超时等待
        Lock lock = new ReentrantLock();
        try {
            // 尝试在2秒内获取锁，如果超时则中断
            if (!lock.tryLock(2, TimeUnit.SECONDS)) {
                Thread.currentThread().interrupt();
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}


```

3. 使用Future的取消任务

```
import java.util.concurrent.*;

public class FutureExample {
    public static void main(String[] args) {
        ExecutorService executor = Executors.newSingleThreadExecutor();
        
        Future<?> future = executor.submit(() -> {
            while (!Thread.currentThread().isInterrupted()) {
                System.out.println("任务执行中...");
            }
        });
        
        // 取消任务，参数true表示允许中断正在运行的任务
        future.cancel(true);
        
        executor.shutdown();
    }
}


```

## 生活中 类 比

想象你正在看电影，这时候发生了以下情况：

1. 朋友拍你肩膀（中断信号）

* 你可以选择：
  + 暂停电影去理会朋友（响应中断）
  + 继续看电影（忽略中断）
  + 告诉朋友"等这部分看完"（延迟处理中断）

2. 手机闹钟响了（中断异常）

* 你必须做出选择：
  + 关掉闹钟继续看（处理中断后继续）
  + 停止看电影去做其他事（处理中断并退出）

### 最简单的理解

```
// 想象一个正在工作的员工
class Worker implements Runnable {
    public void run() {
        while (!Thread.currentThread().isInterrupted()) {  // 检查有没有人叫我
            System.out.println("我正在工作...");
            try {
                Thread.sleep(1000);  // 工作中
            } catch (InterruptedException e) {
                System.out.println("有人让我停下来休息！");
                break;  // 好吧，我去休息
            }
        }
    }
}

// 老板
public class Boss {
    public static void main(String[] args) throws InterruptedException {
        Thread worker = new Thread(new Worker());
        worker.start();  // 员工开始工作
        
        Thread.sleep(5000);  // 5秒后
        worker.interrupt();   // 老板：该休息了！
    }
}


```
