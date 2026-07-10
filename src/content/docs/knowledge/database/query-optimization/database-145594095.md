---
title: "深度整理总结MySQL——Expalin指南(二)"
description: "本章接着上一章Expalin指南(一)续写."
sourceId: "145594095"
source: "https://blog.csdn.net/qq_45852626/article/details/145594095"
sourceSeries:
  - "MySQL"
category: database
subcategory: query-optimization
tags:
  - "MySQL"
  - "SQL"
status: draft
difficulty: advanced
contentType: knowledge
sidebar:
  order: 145594095
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/145594095)（历史文章导入，当前状态为草稿）

### 前言

本章接着上一章Expalin指南(一)续写.

### Extra

extra列是用来说明一些额外信息的，我们可以通过这些额外信息来更准确的理解MySQL到底将如何执行给定的查询语句。

#### no tables used

当查询语句的没有FROM子句时将会提示该额外信息.

#### Impossible where

查询语句的WHERE子句永远为FALSE时将会提示该额外信息.

#### No matching min/max row

当查询列表处有MIN或者MAX聚集函数，但是并没有符合WHERE子句中的搜索条件的记录时，将会提示该额外信息

#### Using index

当我们的查询列表以及搜索条件中只包含属于某个索引的列，也就是在可以使用索引覆盖的情况下，在Extra列将会提示该额外信息

#### Using index condition

有些搜索条件中虽然出现了索引列，但却不能使用到索引

#### Using where

当我们使用全表扫描来执行对某个表的查询，并且该语句的WHERE子句中有针对该表的搜索条件时，在Extra列中会提示上述额外信.

当使用索引访问来执行对某个表的查询，并且该语句的WHERE子句中有除了该索引包含的列之外的其他搜索条件时，在Extra列中也会提示上述额外信息。

#### Using join buffer (Block Nested Loop)

在连接查询执行过程中，当被驱动表不能有效的利用索引加快访问速度，MySQL一般会为其分配一块名叫join buffer的内存块来加快查询速度，也就是我们所讲的基于块的嵌套循环算法.

#### Not exists

当我们使用左（外）连接时，如果WHERE子句中包含要求被驱动表的某个列等于NULL值的搜索条件，而且那个列又是不允许存储NULL值的，那么在该表的执行计划的Extra列就会提示Not exists额外信息  
 注意:  
 右（外）连接可以被转换为左（外）连接，所以就不提右（外）连接的情况了

#### Using intersect(…)、Using union(…)和Using sort\_union(…)

* Using intersect(…)  
   使用Intersect索引合并的方式执行查询，括号中的…表示需要进行索引合并的索引名称.
* Using union(…)  
   说明准备使用Union索引合并的方式执行查询.
* Using sort\_union(…)  
   准备使用Sort-Union索引合并的方式执行查询.

#### Zero limit

LIMIT子句的参数为0时，表示压根儿不打算从表中读出任何记录，将会提示该额外信息

#### Using filesort

排序操作无法使用到索引，只能在内存中（记录较少的时候）或者磁盘中（记录较多的时候）进行排序.  
 这种在内存中或者磁盘上进行排序的方式统称为文件排序（英文名：filesort）.  
 如果某个查询需要使用文件排序的方式执行查询，就会在执行计划的Extra列中显示Using filesort提示.

#### Using temporary

在许多查询的执行过程中，MySQL可能会借助临时表来完成一些功能，比如去重、排序之类的，比如我们在执行许多包含DISTINCT、GROUP BY、UNION等子句的查询过程中，如果不能有效利用索引来完成查询，MySQL很有可能寻求通过建立内部的临时表来执行查询。

### Json格式执行计划

我们上面介绍的EXPLAIN语句输出中缺少了一个衡量执行计划好坏的重要属性 —— **成本**。  
 不过我们有一种方式查询某个执行计划花费的成本的方式——在EXPLAIN单词和真正的查询语句中间加上FORMAT=JSON。  
 举个例子来说：

```
mysql> EXPLAIN FORMAT=JSON SELECT * FROM s1 INNER JOIN s2 ON s1.key1 = s2.key2 WHERE s1.common_field = 'a'\G
*************************** 1. row ***************************

EXPLAIN: {
  "query_block": {
    "select_id": 1,     # 整个查询语句只有1个SELECT关键字，该关键字对应的id号为1
    "cost_info": {
      "query_cost": "3197.16"   # 整个查询的执行成本预计为3197.16
    },
    "nested_loop": [    # 几个表之间采用嵌套循环连接算法执行
    
    # 以下是参与嵌套循环连接算法的各个表的信息
      {
        "table": {
          "table_name": "s1",   # s1表是驱动表
          "access_type": "ALL",     # 访问方法为ALL，意味着使用全表扫描访问
          "possible_keys": [    # 可能使用的索引
            "idx_key1"
          ],
          "rows_examined_per_scan": 9688,   # 查询一次s1表大致需要扫描9688条记录
          "rows_produced_per_join": 968,    # 驱动表s1的扇出是968
          "filtered": "10.00",  # condition filtering代表的百分比
          "cost_info": {
            "read_cost": "1840.84",     # 稍后解释
            "eval_cost": "193.76",      # 稍后解释
            "prefix_cost": "2034.60",   # 单次查询s1表总共的成本
            "data_read_per_join": "1M"  # 读取的数据量
          },
          "used_columns": [     # 执行查询中涉及到的列
            "id",
            "key1",
            "key2",
            "key3",
            "key_part1",
            "key_part2",
            "key_part3",
            "common_field"
          ],
          
          # 对s1表访问时针对单表查询的条件
          "attached_condition": "((`xiaohaizi`.`s1`.`common_field` = 'a') and (`xiaohaizi`.`s1`.`key1` is not null))"
        }
      },
      {
        "table": {
          "table_name": "s2",   # s2表是被驱动表
          "access_type": "ref",     # 访问方法为ref，意味着使用索引等值匹配的方式访问
          "possible_keys": [    # 可能使用的索引
            "idx_key2"
          ],
          "key": "idx_key2",    # 实际使用的索引
          "used_key_parts": [   # 使用到的索引列
            "key2"
          ],
          "key_length": "5",    # key_len
          "ref": [      # 与key2列进行等值匹配的对象
            "xiaohaizi.s1.key1"
          ],
          "rows_examined_per_scan": 1,  # 查询一次s2表大致需要扫描1条记录
          "rows_produced_per_join": 968,    # 被驱动表s2的扇出是968（由于后边没有多余的表进行连接，所以这个值也没什么用）
          "filtered": "100.00",     # condition filtering代表的百分比
          
          # s2表使用索引进行查询的搜索条件
          "index_condition": "(`xiaohaizi`.`s1`.`key1` = `xiaohaizi`.`s2`.`key2`)",
          "cost_info": {
            "read_cost": "968.80",      # 稍后解释
            "eval_cost": "193.76",      # 稍后解释
            "prefix_cost": "3197.16",   # 单次查询s1、多次查询s2表总共的成本
            "data_read_per_join": "1M"  # 读取的数据量
          },
          "used_columns": [     # 执行查询中涉及到的列
            "id",
            "key1",
            "key2",
            "key3",
            "key_part1",
            "key_part2",
            "key_part3",
            "common_field"
          ]
        }
      }
    ]
  }
}
1 row in set, 2 warnings (0.00 sec)


```

#### cost\_info

拿上面例子来说明:

```
"cost_info": {
    "read_cost": "1840.84",
    "eval_cost": "193.76",
    "prefix_cost": "2034.60",
    "data_read_per_join": "1M"
}


```

##### read\_cost

两部分组成:

* IO成本
* 检测rows × (1 - filter)条记录的CPU成本

##### eval\_cost

检测 rows × filter条记录的成本。

##### prefix\_cost

read\_cost + eval\_cost

##### data\_read\_per\_join

此次查询中需要读取的数据量

由于s2表是被驱动表，所以可能被读取多次，这里的read\_cost和eval\_cost是访问多次s2表后累加起来的值，大家主要关注里边儿的prefix\_cost的值代表的是整个连接查询预计的成本，也就是单次查询s1表和多次查询s2表后的成本的和，也就是：`968.80 + 193.76 + 2034.60 = 3197.16`
