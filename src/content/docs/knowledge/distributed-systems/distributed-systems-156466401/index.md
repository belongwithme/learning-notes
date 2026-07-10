---
title: "Kafka专辑- 整体架构"
description: "Kafka 的架构设计核心目标只有两个：极高的吞吐量（High Throughput）和 极高的可靠性（High Availability）。"
sourceId: "156466401"
source: "https://blog.csdn.net/qq_45852626/article/details/156466401"
sourceSeries:
  - "Kafka"
category: distributed-systems
tags:
  - "Kafka"
status: draft
difficulty: intermediate
contentType: knowledge
sidebar:
  order: 156466401
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/156466401)（历史文章导入，当前状态为草稿）

## 前言

Kafka 的架构设计核心目标只有两个：**极高的吞吐量**（High Throughput）和 **极高的可靠性**（High Availability）。

为了实现这两个目标，它引入了以下核心概念：

### 1. 逻辑层：Topic 与 Partition (核心中的核心)

#### 1.1 Topic (主题) —— 快递目的地

* **概念**：Topic 是一个逻辑概念，用于给消息分类。
* **类比**：在分拣中心，Topic 就是\*\*“目的地标签”\*\*。比如，“北京”是一个 Topic，“上海”是另一个 Topic。商家发货时，必须指定这个包裹属于哪个 Topic。
* **Java 视角**：这就好比数据库里的“表名”。

#### 1.2 Partition (分区) —— 并行分拣车道

* **概念**：**Partition 是 Kafka 扩容和高吞吐的物理基础**。一个 Topic 可以被拆分成多个 Partition（分区 0, 分区 1, 分区 2…）。
* **类比**：

  + 如果发往“北京”的包裹实在太多了，一条传送带（单线程）根本处理不过来。
  + 于是，分拣中心为“北京”这个 Topic 开了 **3 条并行传送带**（Partition 0, Partition 1, Partition 2）。
  + 包裹会被均匀地（或者按规则）扔到这 3 条传送带上。
* **关键点**：

  + **物理存储**：在服务器磁盘上，每个 Partition 对应一个独立目录，目录下由多个 segment 和 index 文件组成。
  + **有序性**：**Kafka 只能保证一个 Partition 内部的消息是有序的，不能保证整个 Topic 有序。**（这点面试必问！就像你也只能保证同一条传送带上的包裹是排队的，隔壁传送带的快慢你管不着）。注意：生产端重试且未启用幂等，或 in-flight 请求过多时，同一分区也可能出现乱序。

**示意图：Topic/Partition 与分区路由（Mermaid）**

Topic: orders


Producer


Partitioner


Partition 0


Partition 1


Partition 2

**示意图：Log/Segment/Compaction（Mermaid）**

Partition Log


segment-000.log\nindex/timeindex


segment-001.log\nindex/timeindex


segment-002.log\nactive segment


Retention\n(delete by time/size)


Compaction\n(keep latest by key)

---

### 2. 物理层：Broker 与 Replica

#### 2.1 Broker (代理/节点) —— 仓库大楼

* **概念**：一台 Kafka 服务器就是一个 Broker。一个 Kafka 集群通常由多台 Broker 组成。
* **类比**：这就好比分拣中心的**仓库大楼**。
* Partition（传送带）是建在 Broker（大楼）里面的。
* 为了不把鸡蛋放在同一个篮子里，属于同一个 Topic 的 3 条传送带，通常会被分散建设在 3 栋不同的楼里（不同的 Broker）。
* **补充**：集群里会有一个 Broker 担任 Controller（控制器），负责分区/副本元数据和选举决策。

#### 2.2 Replica (副本) —— 备用仓库

* **概念**：为了防止服务器挂了导致数据丢失，Kafka 引入了副本机制。每个 Partition 都有一个 **Leader** (主) 和多个 **Follower** (从)。
* **类比**：

  + **Leader**：主传送带。负责对外收发包裹。
  + **Follower**：影子传送带。它不对外工作，唯一的任务就是**盯着 Leader**，Leader 上来一个包裹，它就立马在自己这里也抄写一份。
* **高可用原理**：如果 Leader 所在的仓库大楼（Broker）突然着火了，由 Controller 负责从 Follower 中选出新的 Leader 继续工作。
* **补充**：在 KRaft 模式下，Controller 由元数据法定人数（quorum）维护；在 ZooKeeper 模式下，才由 ZooKeeper 参与选举与元数据管理。

**示意图：分区副本分布（Mermaid）**

Broker 3


Broker 2


Broker 1


P0 Leader


P1 Follower


P0 Follower


P1 Leader


P0 Follower


P1 Follower

#### 2.3 ISR / HW / LEO —— 可靠性边界

* **ISR**：与 Leader 保持同步的一组副本，影响提交条件。
* **LEO**：每个副本日志末端偏移（Log End Offset）。
* **HW**：高水位（High Watermark），代表已提交且对消费者可见的最大偏移。
* **提交语义**：acks=all + min.insync.replicas 控制“至少写入多少 ISR 才算成功”；HW 推进后消费者才可读。

**示意图：写入与提交路径（Mermaid）**

Follower 2


Follower 1


Leader


Producer


Follower 2


Follower 1


Leader


Producer


ISR 副本全部追上


HW 向前推进

Produce(batch)


Replicate


Replicate


Ack


Ack


Ack (acks=all)

---

### 3. 消费层：Consumer Group (消费者组)

这是 Kafka 最具区分度的设计之一，也是它与 RabbitMQ 在消费模型与回放能力上的典型差异点。

#### 3.1 Consumer Group (消费者组) —— 运输车队

* **概念**：多个消费者可以组成一个组，共同消费一个 Topic。
* **规则**：**一个 Partition 只能被同一个消费者组里的一个消费者消费。**
* **类比**：
  + 假设“北京”Topic 有 3 条传送带（3 个 Partition）。
  + 现在来了一个“顺丰车队”（Consumer Group A），车队里有 3 辆卡车（消费者）。
  + **分配**：卡车 1 负责传送带 0，卡车 2 负责传送带 1，卡车 3 负责传送带 2。大家各干各的，互不干扰，效率最大化。
  + **如果车队里有 4 辆车？** 第 4 辆车会闲置（因为没有多余的传送带给它用）。
  + **如果又来了一个“京东车队”（Consumer Group B）？** 它是完全独立的，它也会派车去这 3 条传送带上取货（Kafka 允许数据被不同的组重复消费，这也是它适合做日志分析的原因）。

**示意图：消费组分配（Mermaid）**

Consumer Group B


Consumer Group A


Topic: orders


Partition 0


Partition 1


Partition 2


Consumer 1


Consumer 2


Consumer 3


Consumer 4


Consumer 5

**示意图：Rebalance 与 Group Coordinator（Mermaid）**

GroupCoordinator


Consumer 2


Consumer 1


GroupCoordinator


Consumer 2


Consumer 1


成员变化或超时触发 Rebalance

JoinGroup


JoinGroup


SyncGroup (assignment)


SyncGroup (assignment)


Heartbeat


Heartbeat

#### 3.2 Offset (偏移量) —— 记账本

* **概念**：消费者读到哪里了，需要记下来，这个位置就是 Offset。
* **存储**：offset 以 group + topic + partition 为维度提交，默认写入内置 topic `__consumer_offsets`。提交位置不等于业务处理完成的位置。
* **类比**：卡车司机手里的**清单**。每装上一个包裹，就在清单上打个勾：“我上次搬到了第 100 号包裹，下次来从第 101 号开始搬”。

---

### 4. 全景架构总结 (Cheat Sheet)

**示意图：全景架构（Mermaid）**

Producer


Partitioner


Leader Partition


Follower Partition


Consumer


Controller


GroupCoordinator

把这些概念串起来，就是 Kafka 的日常运作流程：

1. **Producer (商家)**：我要发货给“订单 Topic”。
2. **Partitioner (分拣员)**：根据算法（比如 hash），决定把这个消息扔到 **Partition 0**。
3. **Broker (仓库)**：Leader Partition 收到消息，写入磁盘，并同步给 Follower。
4. **Consumer Group (车队)**：

* 检测到有新消息。
* 负责 Partition 0 的那个 **Consumer (卡车)** 把消息拉走处理。
* 处理完，更新 **Offset (账本)**，告诉 Kafka “我办完了”。
