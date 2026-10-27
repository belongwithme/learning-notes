---
title: MySQL 学习路线
description: 从存储结构、索引、SQL 执行到事务、锁和日志，按前置关系串起站内全部 MySQL 笔记。
sidebar:
  order: 3
---

## 路线说明

- **目标读者**：写过 CRUD、会建表加索引，但说不清索引为什么失效、事务隔离靠什么实现、数据库崩溃后数据怎么恢复的后端开发者。
- **前置知识**：基本 SQL（增删改查、`JOIN`、`GROUP BY`），B+ 树的大致形状，操作系统里内存与磁盘的速度差异。
- **完成后的预期能力**：能用 `EXPLAIN` 判断一条 SQL 走了什么索引、为什么慢；能讲清 MVCC 和锁如何配合实现隔离级别；能说明 redo log、undo log、binlog 各自的职责和两阶段提交的意义。

路线共 6 个阶段，前一阶段是后一阶段的前置。每个阶段末尾的「自测」先自己作答，再展开参考答案对照。每篇文章前的勾选框记录你读到哪里，只保存在当前浏览器。

## 阶段 1：一条 SQL 的旅程

先有全局图：一条 SQL 从客户端进来，经过哪些组件，最后在存储引擎里读写数据。

1. [SQL 的执行顺序和 MySQL 的执行流程](/knowledge/database/query-optimization/深度整理总结mysql-sql的执行顺序和mysql的执行流程/)：连接器、解析器、优化器、执行器与存储引擎的分工，以及 SQL 子句的逻辑执行顺序。
2. [MySQL 的存储引擎对比（InnoDB 和 MyISAM）](/knowledge/database/storage-modeling/mysql的存储引擎对比-innodb和myisam/)：为什么后面所有内容都以 InnoDB 为准。

**自测**：`WHERE` 和 `HAVING` 谁先执行？为什么 InnoDB 支持崩溃恢复而 MyISAM 不支持？

<details>
<summary>参考答案</summary>

逻辑顺序是 `FROM` → `WHERE` → `GROUP BY` → `HAVING` → `SELECT` → `ORDER BY` → `LIMIT`，所以 `WHERE` 先过滤行，`HAVING` 过滤分组后的结果，`HAVING` 里才能用聚合函数。

InnoDB 有 redo log，事务提交时只要 redo log 落盘，崩溃后就能重放恢复；MyISAM 没有事务日志，也不支持事务。

</details>

## 阶段 2：数据怎么存

索引和锁都建立在页和行的结构之上，先把存储格式弄清楚。

1. [数据页（索引页）的结构](/knowledge/database/storage-modeling/深度整理总结mysql-数据页-索引页-的结构/)：页是 InnoDB 读写磁盘的最小单位。
2. [行记录存储](/knowledge/database/storage-modeling/深度整理总结mysql-行记录存储/)：行格式、变长字段与 NULL 值列表、行溢出。
3. [MySQL 数据存储：索引组织表](/knowledge/database/storage-modeling/mysql数据存储-索引组织表/)：数据按主键顺序存在聚簇索引的叶子节点里。
4. [Buffer Pool 工作原理](/knowledge/database/storage-modeling/深度整理总结mysql-buffer-pool工作原理/)：页在内存里的缓存，LRU 的冷热分区与脏页刷盘。
5. [数据库表设计](/knowledge/database/storage-modeling/数据库表设计/)：补充，把存储知识落到建表规范上。

**自测**：为什么 InnoDB 建议使用自增主键？Buffer Pool 的 LRU 为什么要分成 young 区和 old 区？

<details>
<summary>参考答案</summary>

数据按主键顺序存在聚簇索引里。自增主键每次都追加到最后一页，页写满就开新页；随机主键会插到中间，导致页分裂和数据移动，还会让页变得稀疏。

全表扫描或预读会一次带进大量只用一次的页。新页先放进 old 区，只有在 old 区停留超过一定时间后再被访问才移到 young 区，这样一次性的大扫描不会把真正的热点页挤出去。

</details>

## 阶段 3：索引

索引是查询优化的核心，也是面试最常问的部分。

1. [索引工作原理](/knowledge/database/indexes/深度整理总结mysql-索引工作原理/)：B+ 树、聚簇索引与二级索引、回表。
2. [组合索引工作原理](/knowledge/database/indexes/深度整理总结mysql-组合索引工作原理/)：最左前缀、索引覆盖与索引下推。
3. [索引失效场景](/knowledge/database/indexes/深度整理总结mysql-索引失效场景/)：函数、隐式类型转换、左模糊匹配、`OR` 等让优化器放弃索引的情况。
4. [索引正确使用姿势](/knowledge/database/indexes/深度整理总结mysql-索引正确使用姿势/)：什么时候建索引、建在哪些列上。

**自测**：联合索引 `(a, b, c)` 上，`WHERE a = 1 AND c = 3` 能用到哪些列？为什么 `WHERE phone = 13800000000`（`phone` 是 `varchar`）会让索引失效？

<details>
<summary>参考答案</summary>

只能用 `a` 定位，`c` 因为中间缺了 `b` 不能用于定位；MySQL 5.6 以后可以借助索引下推，在索引里先用 `c = 3` 过滤，减少回表次数。

字符串列和数字比较时，MySQL 会把字符串转成数字，相当于对索引列套了一个函数，无法再按 B+ 树的顺序查找。

</details>

## 阶段 4：SQL 执行与优化

会看执行计划，再理解几种常见语句在引擎里是怎么执行的。

1. [Explain 指南（一）](/knowledge/database/query-optimization/深度整理总结mysql-explain指南-一/)：`type`、`key`、`rows`、`Extra` 等字段的含义。
2. [Explain 指南（二）](/knowledge/database/query-optimization/深度整理总结mysql-expalin指南-二/)：用执行计划分析具体案例。
3. [CBO 工作原理](/knowledge/database/query-optimization/深度整理总结mysql-cbo工作原理/)：优化器如何估算 IO 和 CPU 成本来选择索引。
4. [Order By 的工作原理](/knowledge/database/query-optimization/深度整理总结mysql-order-by的工作原理/)：sort buffer、全字段排序与 rowid 排序。
5. [Group By 的工作原理](/knowledge/database/query-optimization/深度整理总结mysql-group-by的工作原理/)：临时表与排序，以及如何用索引避免它们。
6. [Join 的工作原理](/knowledge/database/query-optimization/深度整理总结mysql-join的工作原理/)：驱动表、被驱动表与 join buffer。
7. [子查询的工作原理](/knowledge/database/query-optimization/深度整理总结mysql-子查询的工作原理/)：物化与半连接。
8. [Count 的工作原理](/knowledge/database/query-optimization/深度整理总结mysql-count的工作原理/)：补充，`count(*)`、`count(1)` 与 `count(字段)` 的区别。

**自测**：`Extra` 里出现 `Using filesort` 和 `Using temporary` 分别说明什么？两表 `JOIN` 时为什么要用小表驱动大表？

<details>
<summary>参考答案</summary>

`Using filesort` 表示结果不能直接按索引顺序取出，需要额外排序；`Using temporary` 表示用到了临时表，常见于 `GROUP BY`、`DISTINCT` 或排序字段与分组字段不一致。两者通常都可以通过合适的索引消除。

被驱动表的关联字段有索引时，扫描次数大约是驱动表行数乘以一次索引查找的成本，驱动表越小，查找次数越少；没有索引时，小表放进 join buffer 也能减少对大表的扫描轮数。

</details>

## 阶段 5：事务与锁

隔离级别是目标，MVCC 和锁是两种实现手段。

1. [事务简介](/knowledge/database/transactions-locks/深度整理总结mysql-事务简介/)：ACID、并发事务带来的脏读、不可重复读与幻读。
2. [事务隔离级别实现原理](/knowledge/database/transactions-locks/深度整理总结mysql-事务隔离级别实现原理/)：Read View、undo 版本链与 MVCC。
3. [锁类型](/knowledge/database/transactions-locks/深度整理总结mysql-锁类型/)：全局锁、表锁、意向锁、行锁、间隙锁与临键锁。
4. [MySQL 加锁工作原理](/knowledge/database/transactions-locks/深度整理总结mysql-mysql加锁工作原理/)：不同语句和索引情况下到底锁住了什么。
5. [临键锁的加锁与退化机制](/knowledge/database/transactions-locks/临键锁的加锁与退化机制/)：临键锁什么时候退化为记录锁或间隙锁。
6. [可重复读隔离是否完全解决幻读](/knowledge/database/transactions-locks/深度整理总结mysql-可重复读隔离是否完全解决幻读/)：快照读与当前读混用时的例外。

**自测**：可重复读和读已提交在生成 Read View 的时机上有什么不同？`UPDATE ... WHERE` 的条件列没有索引会发生什么？

<details>
<summary>参考答案</summary>

读已提交在每条语句执行前都生成新的 Read View，所以能看到其他事务已提交的修改；可重复读只在事务里第一次快照读时生成一次，之后一直复用。

找不到索引就只能全表扫描，扫描过的每一行都会加临键锁，相当于锁住整张表，其他事务的插入和更新都会被阻塞，直到本事务结束。

</details>

## 阶段 6：日志与高可用

最后看 InnoDB 如何保证崩溃不丢数据，以及 binlog 如何支撑主从复制。

1. [undoLog 日志工作原理](/knowledge/database/logs-replication/深度整理总结mysql-undolog日志工作原理/)：回滚与 MVCC 的版本链。
2. [redoLog 日志工作原理](/knowledge/database/logs-replication/深度整理总结mysql-redolog日志工作原理/)：WAL、redo log buffer 与刷盘策略。
3. [binLog 日志工作原理](/knowledge/database/logs-replication/深度整理总结mysql-bin-log日志工作原理/)：Server 层的逻辑日志与三种格式。
4. [二阶段提交工作原理](/knowledge/database/logs-replication/深度整理总结mysql-二阶段提交工作原理/)：redo log 与 binlog 为什么要两阶段提交。
5. [MySQL 高并发：主从架构](/knowledge/database/logs-replication/mysql高并发-主从架构/)：基于 binlog 的主从复制。
6. [读写分离架构下的一致性挑战](/knowledge/distributed-systems/consistency/读写分离架构下的一致性挑战/)：补充，主从延迟带来的读不到最新数据。

**自测**：redo log 和 binlog 都记录了修改，为什么两个都需要？如果没有两阶段提交，崩溃会造成什么后果？

<details>
<summary>参考答案</summary>

redo log 是 InnoDB 的物理日志，循环写，只用于崩溃恢复；binlog 是 Server 层的逻辑日志，追加写、保留完整历史，用于主从复制和按时间点恢复。两者职责不同，彼此替代不了。

如果先写 redo log 再写 binlog，中间崩溃，主库恢复出了这条修改，从库却收不到；反过来则从库多出一条主库没有的修改。两阶段提交让两份日志要么都生效、要么都不生效，主从数据才一致。

</details>
