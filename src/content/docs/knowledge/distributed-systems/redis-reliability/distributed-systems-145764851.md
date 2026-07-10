---
title: "Redis- 持久化"
description: "Redis是跑在内存里的,那程序重启或者服务崩溃,数据就会丢失,如果业务场景希望重启之后数据还在,就需要持久化,即把数据保持到可永久保存的"
sourceId: "145764851"
source: "https://blog.csdn.net/qq_45852626/article/details/145764851"
sourceSeries:
  - "Redis"
category: distributed-systems
subcategory: redis-reliability
tags:
  - "Redis"
status: draft
difficulty: intermediate
contentType: knowledge
sidebar:
  order: 145764851
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/145764851)（历史文章导入，当前状态为草稿）

### 持久化是什么

Redis是跑在内存里的,那程序重启或者服务崩溃,数据就会丢失,如果业务场景希望重启之后数据还在,就需要持久化,即把数据保持到可永久保存的
存储 
设备中.

### 持久化方式

Redis提供两种方式来持久化:

1. RDB(Redis Database Backup),记录Redis某个时刻的全部数据,这种方式本质就是数据快照,直接保存二进制数据到磁盘,后续通过加载RDB文件恢复数据.
2. AOF(Append Only File),记录执行的每条命令,重启之后通过重放命令来恢复数据,AOF本质是记录操作日志,后续通过日志重放恢复数据.  
    RDB是快照恢复,AOF日志恢复,这是两者本质区别,我们甚至都不同去学习他们具体的实现,也能推测出他们如有下差别:

* 体积方面: 相同数据量下,RDB体积更小,因为RDB是记录的二进制紧凑型数据.
* 恢复速度: RDB是数据快照,可以直接加载,而AOF文件恢复,相当于重放情况,RDB显然会更快.
* 数据完整性: AOF记录了每条日志,RDB是间隔一段时间记录一次,用AOF恢复数据通常会更完整.

#### AOF和RDB如何选择

这个要看适合的业务场景:

* 缓存数据不是一个海量访问,可以不开持久化.
* 如果对数据很重视,则可以同时开启RDB和AOF,同时开启下RDB只是个备份,实际上用AOF来加载,这里用AOF而不用RDB去恢复数据的原因是:你开启了AOF,表明要强一点的一致性.那就不会用RDB加载,因为RDB可能会少很多数据.
* 如果可以接受丢几分钟级别的数据,建议只开RDB.

### 总结

Redis虽然是内存数据库,很多时候也希望重启或崩溃后能自动恢复数据的,这时候就需要持久化机制.  
 下面我们会学RDB和AOF的细节.
