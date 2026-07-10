---
title: "导出重复问题记录-bugs专辑"
description: "业务场景：导出报表（接口 Reportinfo/createReport，reporttype=9999），列表查询接口为 queryAnomalyStationPage。"
sourceId: "157477388"
source: "https://blog.csdn.net/qq_45852626/article/details/157477388"
sourceSeries:
  - "mysql-bugs"
category: retrospectives
tags:
  - "mysql-bugs"
  - "问题复盘"
status: draft
difficulty: intermediate
contentType: retrospective
sidebar:
  order: 157477388
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/157477388)（历史文章导入，当前状态为草稿）

### 一、问题记录

#### 1) 背景与现象

* 业务场景：导出报表（接口 `Reportinfo/createReport`，reporttype=9999），列表查询接口为 `queryAnomalyStationPage`。
* 现象：
  + 首页分页查询没有重复。
  + 按小单编号查单条导出也无重复。
  + 按“合作机构名称”筛选批量导出时出现少量重复行。
  + 导出行数与列表总数一致，但去重后总数对不上。

#### 2) 影响

* 导出结果包含重复行，导致实际有效数据缺失。
* 用户感知为“总数对得上但数据有重复”，影响数据可信度。

#### 3) 问题定位

导出流程采用分页拉取数据，但 SQL 仅按 `create_time` 排序。  
`create_time` 不是唯一字段，同一时间戳可能存在多条记录。  
当排序键不唯一时，数据库对这些记录的返回顺序不稳定，分页边界会发生抖动，进而导致：

* 某一页的尾部记录在下一页再次出现（重复）。
* 对应的另一条记录被挤到上一页或被漏掉（遗漏）。
* 总行数仍然与 count 对齐，但数据内容不一致。

#### 4) 解决思路

为分页排序添加唯一性，保证顺序稳定。例如：

* `order by create_time desc, id desc`（在时间相同的情况下用主键做稳定排序）。

**注意：**  
如果直接修改通用分页 SQL，会影响所有依赖该查询的接口排序行为。  
若需要局部修复，可新增导出专用查询或在导出路径中追加稳定排序。

#### 5) 验证方式

* 使用相同筛选条件重复导出两次，对比是否出现重复行。
* 对比导出结果去重后的数量与分页查询总数是否一致。

### 二、知识教程（相关知识点）

#### 1) 分页一致性问题

**问题本质：** 使用 offset/limit 分页时，如果排序字段不是唯一键，数据库返回顺序不确定。  
**结果：** 跨页请求会出现重复或遗漏。

#### 2) 解决策略对比

1. **稳定排序（最小改动）**

   * 做法：`order by create_time desc, id desc`
   * 优点：改动小，直接修复导出重复问题
   * 缺点：会影响所有使用该查询的排序结果
2. **Keyset Pagination（游标分页）**

   * 做法：用 `where (create_time, id) < (?, ?)` 取下一页
   * 优点：性能好，顺序稳定
   * 缺点：实现成本稍高，需要前后端配合
3. **一致性快照**

   * 做法：在同一事务里查询 count 和分页数据，或者固定一个时间点快照
   * 优点：强一致
   * 缺点：实现复杂，可能有性能成本

#### 3) 为什么“总数对得上，但去重后对不上”

分页查询每一页的数量合计仍然等于 count，  
但因为顺序不稳定，部分记录被重复，另一些记录被遗漏。  
因此去重后会小于总数。
