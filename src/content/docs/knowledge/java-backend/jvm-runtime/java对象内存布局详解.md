---
title: "Java对象内存布局详解"
description: "Java对象在内存中的布局由以下三部分组成："
sourceId: "147057384"
source: "https://blog.csdn.net/qq_45852626/article/details/147057384"
sourceSeries: []
category: java-backend
subcategory: jvm-runtime
tags:
  - "Java"
status: draft
difficulty: intermediate
contentType: knowledge
sidebar:
  order: 147057384
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/147057384)（历史文章导入，当前状态为草稿）

## 一、概述

Java对象在内存中的布局由以下三部分组成：

* 对象头（Header）
* 实例数据（Instance Data）
* 对齐填充（Padding）

这种内存布局是JVM管理对象和实现多线程同步的基础，理解它有助于编写高效的Java代码和解决性能问题。

## 二、对象头详解

对象头是Java对象内存结构中最复杂的部分，包含了两个主要部分：

### 1. Mark Word（标记字）

Mark Word是对象头的第一部分，用于存储对象的运行时数据，如：

* 哈希码（HashCode）
* GC分代年龄
* 锁状态标志
* 线程持有的锁
* 偏向线程ID
* 偏向时间戳

Mark Word的大小在32位JVM中是32位，在64位JVM中是64位。其内部结构会根据对象的状态变化而变化，是一种非常精巧的设计。

#### Mark Word在不同锁状态下的存储内容（64位JVM）：

| 锁状态 | 存储内容 | 标志位 |
| --- | --- | --- |
| 无锁态 | 对象HashCode、分代年龄 | 01 |
| 偏向锁 | 偏向线程ID、偏向时间戳、分代年龄 | 01 |
| 轻量级锁 | 指向栈中锁记录的指针 | 00 |
| 重量级锁 | 指向互斥量（monitor）的指针 | 10 |
| GC标记 | 空 | 11 |

### 2. 类型指针（Klass Pointer）

类型指针是对象头的第二部分，指向对象的类元数据，JVM通过这个指针确定对象是哪个类的实例。

* 在32位JVM上，类型指针占用4字节
* 在64位JVM上，如果开启指针压缩（-XX:+UseCompressedOops），类型指针占用4字节；否则占用8字节

### 3. 数组长度（仅数组对象有）

如果对象是数组，对象头中还会有一个额外的部分用于存储数组的长度，占用4字节。

## 三、实例数据

实例数据部分是对象真正存储有效信息的部分，包括从父类继承来的和本类定义的字段。

字段的分配顺序受到以下因素影响：

* JVM的实现
* 字段在类中定义的顺序
* 相同宽度的字段可能会被分配到一起，以优化内存使用

各种类型的字段占用的内存如下：

| 类型 | 占用空间（字节） |
| --- | --- |
| boolean | 1 |
| byte | 1 |
| short | 2 |
| char | 2 |
| int | 4 |
| float | 4 |
| long | 8 |
| double | 8 |
| reference | 4（32位JVM或开启指针压缩的64位JVM）或8（未开启指针压缩的64位JVM） |

## 四、对齐填充

JVM要求对象的起始地址必须是8字节的整数倍（64位系统）。对齐填充不是必须的，只是为了让对象的大小满足对齐要求。如果对象头加上实例数据的大小已经是8的整数倍，就不需要对齐填充。

## 五、对象在内存中的布局示例

以下是一个简单类对象在内存中的布局示例：

```
class Example {
    int a;
    boolean b;
    long c;
}


```

在64位JVM，开启指针压缩的情况下，这个对象的内存布局是：

* 对象头：12字节（Mark Word 8字节 + 类型指针 4字节）
* 实例数据：13字节（int 4字节 + boolean 1字节 + long 8字节）
* 对齐填充：3字节（为了让对象总大小达到8的整数倍）

总大小：28字节

## 六、锁与对象头的关系

Java的synchronized锁机制与对象头中的Mark Word密切相关。从JDK 6开始，HotSpot JVM实现了锁升级机制：

### 1. 偏向锁

偏向锁是为了减少同一线程获取锁的代价。第一次获取锁时，会在Mark Word中记录线程ID，后续该线程再获取锁，只需要检查线程ID是否一致，而不需要任何同步操作。

### 2. 轻量级锁

当有线程竞争时，偏向锁会升级为轻量级锁。轻量级锁通过CAS操作尝试获取锁，如果成功，则将Mark Word复制到线程栈帧中的Lock Record中，并将对象头的Mark Word更新为指向该Lock Record的指针。

### 3. 重量级锁

如果CAS操作失败，或者已经存在多个线程竞争锁，轻量级锁会升级为重量级锁。重量级锁通过操作系统的互斥量（Mutex）来实现，会导致线程阻塞和唤醒。

## 七、对象布局工具

可以使用JOL（Java Object Layout）工具查看对象在内存中的实际布局：

```
import org.openjdk.jol.info.ClassLayout;

public class ObjectLayoutExample {
    public static void main(String[] args) {
        Object obj = new Object();
        System.out.println(ClassLayout.parseInstance(obj).toPrintable());
        
        synchronized(obj) {
            System.out.println(ClassLayout.parseInstance(obj).toPrintable());
        }
    }
}


```

## 八、对象内存布局对性能的影响

1. **内存占用**：了解对象布局有助于优化内存使用，尤其是在大量创建小对象时
2. **缓存行效应**：对象字段的排列会影响CPU缓存的使用效率
3. **锁优化**：理解锁升级机制有助于编写更高效的并发代码

## 九、总结

Java对象内存布局是JVM内部实现的关键部分，它直接影响了Java程序的内存使用效率和并发性能。通过理解对象头（特别是Mark Word）的结构和变化，我们可以更好地理解Java的锁机制和synchronized关键字的工作原理，从而编写更高效的Java程序。
