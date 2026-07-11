---
title: "Kafka专辑: 日志存储模型"
description: "磁盘 I/O：顺序写（极快，接近内存） vs 随机写（慢，磁头寻道）。"
sourceId: "156488012"
source: "https://blog.csdn.net/qq_45852626/article/details/156488012"
sourceSeries:
  - "Kafka"
category: distributed-systems
subcategory: kafka
tags:
  - "Kafka"
status: draft
difficulty: intermediate
contentType: knowledge
sidebar:
  order: 156488012
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/156488012)（历史文章导入，当前状态为草稿）

### 前置知识

* **磁盘 I/O**：顺序写（极快，接近内存） vs 随机写（慢，磁头寻道）。
* **OS 页缓存（Page Cache）**：操作系统利用空闲内存缓存磁盘数据，减少磁盘 I/O。
* **索引原理**：稀疏索引与二分查找算法。

---

### 分区日志的核心结构：只追加、分段、索引

Kafka 的 Partition（分区）在物理磁盘上对应一个目录，目录下包含多个 **Segment（段）**。

#### 文件构成

每个 Segment 由以下核心文件组成，**文件名即为该段第一条消息的 Offset（Base Offset）**：

* **`.log` (Log Segment)**：实际存储消息数据。内部存储的是 **RecordBatch（消息批次）**，而非单条消息，有利于批量压缩和网络传输。
* **`.index` (Offset Index)**：偏移量索引文件（Offset 物理位置）。
* **`.timeindex` (Time Index)**：时间戳索引文件（Timestamp Offset）。

此外还有关键的检查点文件：

* `recovery-point-offset-checkpoint`：记录 Broker 重启后恢复数据的起始点，避免全量扫描。

#### 为什么要分段（Segment）？

* **生命周期管理**：便于删除过期数据。直接删除整个旧文件比在在一个大文件中修剪头部要高效得多。
* **索引性能**：将大索引切分为小的索引文件，便于加载到内存（mmap）。

Partition 目录: topic-0


文件名=BaseOffset


文件名=BaseOffset


当前写入


Segment 0


00...000.log


00...000.index


Segment 1000


00...1000.log


00...1000.index


Active Segment


00...2000.log


逻辑日志流

---

### 写入路径：顺序写 + 延迟刷盘

当 Producer 发送消息到 Leader 分区时：

1. **顺序追加**：消息被追加到 **Active Segment** 的 `.log` 文件末尾。
2. **页缓存（Page Cache）**：关键点！Kafka **不**直接调用 `fsync` 同步刷盘，而是写入操作系统的 Page Cache 即视为写入成功。
3. **稀疏索引**：每写入一定量的数据（默认 4KB），在 `.index` 文件中追加一条索引项。
4. **滚动（Roll）**：当 Active Segment 满足条件（大小 `log.segment.bytes` 或 时间 `log.segment.ms`）时，关闭当前段，创建新的 Active Segment。

> **性能揭秘**：为什么写入快？
>
> * **顺序 I/O**：避免磁头乱跳。
> * **Memory First**：利用 Page Cache，写入速度几乎等同于写内存。
> * **风险**：如果服务器掉电，Page Cache 中未刷盘的数据会丢失（通过多副本机制 ISR 来保障可靠性，而非强行刷盘）。

---

### 读取路径：索引定位 + 零拷贝

当 Consumer 请求读取 offset = `368` 的数据时：

1. **定位 Segment**：在内存中的段列表（SkipList）中快速定位。

* 找到 BaseOffset 为 0 的段（涵盖 0~999）。

2. **查询 Index（稀疏索引）**：

* 读取 `00...000.index` 文件（通过 **mmap** 内存映射）。
* 使用 **二分查找** 找到 `offset <= 368` 的最大索引项（例如记录的是 360 -> position 1024）。

3. **定位 Log**：

* 拿着物理位置 `1024` 去 `.log` 文件中。
* 从 position 1024 开始顺序扫描，直到找到 offset 368。

4. **零拷贝（Zero-Copy）发送**：

* Kafka 调用 `sendfile()` 系统调用。
* 数据直接从 **OS Page Cache** 复制到 **网卡缓冲区**。
* **不经过 Kafka 应用层内存**，极大降低了 CPU 消耗。

找到最近点: Offset=360, Pos=1024


顺序扫描


4. Zero-Copy


Read Offset=368


1. 定位 Segment: 00...000


2. 二分查找 .index


3. 定位 .log 物理位置


找到 Offset=368


网卡发送

---

### 数据清理策略

Kafka 的数据不会永久保留，主要通过两种策略清理。

#### Retention（删除型，cleanup.policy=delete）

默认策略，关注“保留多久”或“保留多大”。

* `log.retention.ms`：时间阈值（如 7 天）。
* `log.retention.bytes`：大小阈值。
* **机制**：后台线程检查每个 **Segment** 的最后修改时间或总大小。一旦整个段过期，就标记为删除。

#### Compaction（压缩型，cleanup.policy=compact）

适用于 KV 结构的数据（如配置更新、状态表）。目标是：**对于相同的 Key，只保留最新的 Value**。

* **Log Head**：已清理部分，Key 唯一。
* **Log Tail**：新写入部分，可能有重复 Key。
* **Cleaner 线程**：后台不断将 Tail 部分的重复 Key 消除，合并到 Head 中。
* **墓碑（Tombstone）**：写入 `Value=null` 的消息，表示该 Key 被删除。

---

### HW 与 LEO：可见性与一致性

这两个指针决定了 Consumer 能读到哪里，以及副本间如何同步。

| 指针 | 全称 | 含义 | 作用 |
| --- | --- | --- | --- |
| **LEO** | Log End Offset | 日志末端下一位 | 标识该副本自己写到了哪里（包括未提交数据）。 |
| **HW** | High Watermark | 高水位 | **ISR 集合中所有副本**都已同步的最小 LEO。 |

* **可见性**：消费者只能拉取到 **HW** 之前的消息。
* **安全性**：HW 之前的数据被认为是“已提交（Committed）”的，即便 Leader 挂了也不会丢失。

---

### 总结：Kafka 为什么快？

如果你在面试中被问到这个问题，请用这 4 个关键词回答：

```
1. **顺序写（Sequential Write）**：将磁盘利用率最大化。
2. **页缓存（Page Cache）**：依赖 OS 缓存，写入即内存，读取优先命中内存。
3. **零拷贝（Zero-Copy）**：利用 `sendfile` 减少 CPU 拷贝和上下文切换。
4. **分段与稀疏索引**：快速定位数据，且索引占用内存极小。


```
