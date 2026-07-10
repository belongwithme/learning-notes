---
title: "JUC并发集合-ConcurrentSkipListMap"
description: "ConcurrentSkipListMap是Java并发包(java.util.concurrent)中提供的一个线程安全的有序映射表实现，基于跳表(Skip List)数据结构。它实现了ConcurrentNavigableMap接口，提供了丰富的有序操作和导航方法，同时保证了高并发环境下的..."
sourceId: "146808069"
source: "https://blog.csdn.net/qq_45852626/article/details/146808069"
sourceSeries:
  - "JUC集合"
category: java-backend
subcategory: concurrency
tags:
  - "JUC集合"
  - "JUC"
status: draft
difficulty: intermediate
contentType: knowledge
sidebar:
  order: 146808069
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/146808069)（历史文章导入，当前状态为草稿）

### 1. 基础概念

#### 1.1 什么是ConcurrentSkipListMap

ConcurrentSkipListMap是Java并发包(java.util.concurrent)中提供的一个线程安全的有序映射表实现，基于跳表(Skip List)数据结构。它实现了ConcurrentNavigableMap接口，提供了丰富的有序操作和导航方法，同时保证了高并发环境下的线程安全性。

ConcurrentSkipListMap的核心特点是结合了高效的并发访问能力和有序性，这在并发环境下是一个非常独特的组合。它通过无锁算法实现线程安全，避免了传统锁机制带来的性能瓶颈，特别适合读多写少且需要有序性的并发场景。

#### 1.2 ConcurrentSkipListMap与TreeMap、HashMap和ConcurrentHashMap的区别

为了更好地理解ConcurrentSkipListMap的特点，我们将其与Java中的其他几个常见Map实现进行对比：

| 特性 | ConcurrentSkipListMap | TreeMap | HashMap | ConcurrentHashMap |
| --- | --- | --- | --- | --- |
| 线程安全性 | 线程安全 | 非线程安全 | 非线程安全 | 线程安全 |
| 有序性 | 有序 | 有序 | 无序 | 无序 |
| 实现结构 | 跳表 | 红黑树 | 哈希表 | 哈希表 |
| 锁机制 | 无锁(CAS) | 需外部同步 | 需外部同步 | 分段锁/CAS |
| 时间复杂度 | O(log n) | O(log n) | O(1) | O(1) |
| 迭代器 | 弱一致性 | fail-fast | fail-fast | 弱一致性 |
| 适用场景 | 需要并发访问的有序Map | 单线程有序Map | 单线程无序Map | 需要并发访问的无序Map |

从上表可以看出，ConcurrentSkipListMap与其他Map实现有明显的区别，它是唯一一个同时提供线程安全和有序性的Map实现。

#### 1.3 何时选择ConcurrentSkipListMap

根据ConcurrentSkipListMap的特性，以下场景特别适合使用它：

1. **需要线程安全且有序的Map实现时**：如果应用需要在多线程环境下维护一个按键排序的映射，ConcurrentSkipListMap是理想选择。
2. **需要高效的范围查询操作时**：ConcurrentSkipListMap支持高效的范围操作，如subMap、headMap、tailMap等，这在需要按范围获取数据的场景中非常有用。
3. **需要按键的顺序进行并发迭代时**：ConcurrentSkipListMap的迭代器按键的顺序遍历元素，这在需要有序处理数据的并发场景中很有价值。
4. **需要线程安全但又不希望有锁带来的阻塞时**：ConcurrentSkipListMap的无锁设计避免了线程阻塞，提供了更好的并发性能。
5. **读操作明显多于写操作，且需要有序性的场景**：虽然ConcurrentSkipListMap的写操作比ConcurrentHashMap慢，但在读多写少且需要有序性的场景中，它是最佳选择。

具体应用场景包括：

* 实时排行榜系统
* 价格匹配系统
* 时间序列数据处理
* 任务调度系统
* 有序的缓存实现

#### 1.4 什么是跳表(Skip List)数据结构

跳表是一种基于有序链表的数据结构，通过在链表的基础上添加多层索引来加速查找。它的核心思想是以空间换时间，通过构建多层索引，使得查找、插入和删除操作的平均时间复杂度降低到O(log n)。

跳表的基本结构如下：

```
Level 3: -∞ -----------------------> +∞
Level 2: -∞ --------> 30 ---------> +∞
Level 1: -∞ --> 10 --> 30 --> 50 -> +∞
Level 0: -∞ -> 5 -> 10 -> 20 -> 30 -> 40 -> 50 -> +∞


```

在这个结构中：

* 最底层(Level 0)包含所有元素，形成一个有序链表
* 上层是下层的子集，作为索引层，加速查找
* 元素被提升到上层的概率通常为1/2，这使得每层元素数量大约是下层的一半
* 查找时从最高层开始，利用索引快速跳过不需要比较的元素

跳表相比于红黑树等传统有序数据结构有以下优势：

1. **实现简单**：跳表的实现逻辑简单直观，代码量少，易于理解和维护。
2. **并发友好**：跳表的修改操作只影响局部链表，不需要树的旋转操作，更适合并发实现。
3. **更易于实现无锁算法**：跳表可以实现高效的无锁并发算法，如CAS操作，而红黑树的平衡操作使无锁实现极其复杂。
4. **范围查询效率高**：跳表天然支持高效的范围查询，直接在底层链表遍历即可，而红黑树需要中序遍历算法。
5. **内存局部性好**：跳表的数据访问模式可能具有更好的缓存友好性，提升实际性能。
6. **渐进式调整**：跳表插入后不需要全局重平衡，局部性好，而红黑树插入后可能需要从插入点到根的重平衡。

这些特性使得跳表成为实现并发有序容器的理想选择，这也是Java选择跳表作为ConcurrentSkipListMap底层实现的主要原因。

### 2. 内部实现原理

#### 2.1 跳表结构详解

ConcurrentSkipListMap基于跳表实现，其内部结构包含以下几个关键组件：

1. **节点类型**：

   * **Node**：基础节点，构成底层有序链表，包含key、value和next引用
   * **Index**：索引节点，构成上层快速路径，包含node引用和right、down引用
   * **HeadIndex**：头索引节点，是Index的特殊子类，维护索引层链接
   * **VarHandle**：JDK 9+使用VarHandle替代Unsafe进行CAS操作
2. **多层结构**：

   * 底层是包含所有元素的有序链表(level 1)
   * 上面有多层索引层(level 2, 3, …)，每层索引节点数约为下层的1/2
   * 最高层级通常为log₂n(n为元素个数)
   * 每个节点被提升到更高层的概率为1/2(默认)
3. **索引层次决定**：

   * 使用随机数决定新插入节点的层高
   * 使用快速路径(fast path)计算方法：计算随机数中连续0的个数
   * 层高受MAX\_LEVEL限制(默认64)

下面是跳表结构的简化示意图：

```
head ---> Index ---> Index ---> null
 |         |         |
 v         v         v
head ---> Index ---> Index ---> null
 |         |         |
 v         v         v
head ---> Node ----> Node ----> Node ----> null


```

在这个结构中：

* 最底层是Node链表，存储实际的键值对
* 上层是Index链表，作为索引加速查找
* 每个Index节点都有一个down引用指向下层对应位置的Index节点
* 每个Index节点都有一个right引用指向同层的下一个Index节点
* 最底层的Index节点通过node引用指向对应的Node节点

#### 2.2 并发控制机制

ConcurrentSkipListMap采用了无锁并发控制机制，主要包括以下几个方面：

1. **CAS(Compare-And-Swap)操作**：

   * 使用UNSAFE.compareAndSwapObject()/VarHandle.compareAndSet()原子更新引用
   * 主要用于节点链接、断开和值更新
   * 确保在多线程环境下对共享引用的安全更新
2. **版本标记**：

   * 使用节点引用的低位比特作为标记(marked bit)
   * 节点删除时先标记引用，再实际删除，防止并发问题
   * 这种两阶段删除确保了并发安全
3. **无阻塞设计**：

   * 所有操作均不使用阻塞锁
   * 冲突时使用重试而非阻塞等待
   * 确保系统整体进展，防止死锁和优先级倒置
4. **辅助删除**：

   * 线程在发现已标记为删除的节点时会帮助完成物理删除
   * 保证即使标记节点的线程失败，节点最终也会被删除
   * 分摊了删除工作，防止删除节点堆积
5. **寻找前驱节点**：

   * findPredecessor方法是核心操作，用于定位操作点
   * 从最高层开始，通过索引层快速接近目标位置
   * 处理并跳过已标记删除的节点
6. **弱一致性**：

   * 迭代器反映创建时的部分快照状态
   * 不抛出ConcurrentModificationException
   * size()方法可能不准确，返回估计值

这些机制共同作用，确保了ConcurrentSkipListMap在高并发环境下的安全性和高性能。

#### 2.3 无锁算法详解

ConcurrentSkipListMap采用了多种无锁并发策略来保证线程安全，下面详细解释这些策略：

1. **CAS(Compare-And-Swap)操作**：  
    CAS是无锁算法的核心，它是一种原子操作，比较内存位置的当前值与预期值，只有当它们相同时才将该位置更新为新值。

   ```
   // 使用Unsafe类的CAS操作
   boolean casNext(Node<K,V> cmp, Node<K,V> val) {
       return UNSAFE.compareAndSwapObject(this, nextOffset, cmp, val);
   }

   // JDK 9+使用VarHandle
   private static final VarHandle NEXT;
   static {
       try {
           NEXT = MethodHandles.lookup().findVarHandle(Node.class, "next", Node.class);
       } catch (ReflectiveOperationException e) {
           throw new ExceptionInInitializerError(e);
       }
   }

   boolean casNext(Node<K,V> cmp, Node<K,V> val) {
       return NEXT.compareAndSet(this, cmp, val);
   }


   ```
2. **不可变键和无副作用比较器**：

   * Map的键一旦放入就不应被修改
   * 比较器应该是无状态的，不产生副作用
   * 这些约束简化了并发控制
3. **版本标记(Versioned References)**：  
    ConcurrentSkipListMap使用引用对象地址的最低位作为标记位，标记节点是否已被删除。

   ```
   // 标记节点已删除
   static <K,V> Node<K,V> markNode(Node<K,V> n) {
       return (n == null) ? null : new Node<K,V>(n.key, n.value, n, null);
   }

   // 检查节点是否已标记删除
   static <K,V> boolean isMarker(Node<K,V> n) {
       return (n != null && n.next == n);
   }


   ```
4. **读取-复制-写入模式**：  
    修改操作不直接修改现有结构，而是创建新节点，通过CAS操作将新节点链接到正确位置。

   ```
   // 添加新节点的简化示例
   Node<K,V> newNode = new Node<K,V>(key, value, null);
   for (;;) {
       Node<K,V> next = pred.next;
       if (next != null && next.key.compareTo(key) < 0) {
           pred = next;
           continue;
       }
       newNode.next = next;
       if (pred.casNext(next, newNode))
           break;
   }


   ```
5. **帮助机制(Helping)**：  
    线程在操作过程中遇到已标记删除但未物理删除的节点时，会主动帮助完成删除操作。

   ```
   // 帮助删除已标记节点的简化示例
   if (n != null && n.isMarked()) {
       pred.casNext(n, n.next);  // 尝试物理删除
       continue;  // 重试
   }


   ```
6. **延迟重组(Lagged Reconstruction)**：  
    插入节点时先加入底层链表，再逐层构建索引，分离了数据修改和索引更新，减少了原子操作范围。
7. **松弛不变量(Relaxed Invariants)**：

   * head不总是指向第一个节点
   * 索引层次不需要严格平衡
   * 减少了维护精确状态的开销
8. **非阻塞算法**：  
    所有操作都不使用阻塞锁或等待，冲突时通过重试而非阻塞等待解决，确保系统整体进展。
9. **内存屏障和Java内存模型**：

   * 利用Java内存模型的happens-before关系
   * 通过volatile变量和CAS操作建立内存屏障
   * 确保线程间的可见性和有序性

这些无锁策略共同作用，使ConcurrentSkipListMap能够在不使用传统锁的情况下保证线程安全，同时提供优异的并发性能。

### 3. 核心方法源码分析

#### 3.1 构造方法

ConcurrentSkipListMap提供了多个构造方法，以适应不同的初始化需求：

```
// 默认构造方法
public ConcurrentSkipListMap() {
    this.comparator = null;
    initialize();
}

// 指定比较器的构造方法
public ConcurrentSkipListMap(Comparator<? super K> comparator) {
    this.comparator = comparator;
    initialize();
}

// 从已有Map构造
public ConcurrentSkipListMap(Map<? extends K, ? extends V> m) {
    this.comparator = null;
    initialize();
    putAll(m);
}

// 从已有SortedMap构造，保留其比较器
public ConcurrentSkipListMap(SortedMap<K, ? extends V> m) {
    this.comparator = m.comparator();
    initialize();
    buildFromSorted(m);
}

// 初始化方法
private void initialize() {
    head = new HeadIndex<K,V>(new Node<K,V>(null, null, null),
                             null, null, 1);
}


```

**源码分析**：

1. 默认构造方法创建一个使用自然顺序的空映射
2. 可以指定自定义比较器，用于键的排序
3. 可以从现有Map或SortedMap构造，后者会保留原Map的比较器
4. initialize()方法创建初始的头节点和第一层索引
5. 初始结构非常简单，只有一个空的头节点和一层索引

#### 3.2 put操作

put方法是ConcurrentSkipListMap的核心写操作，它的实现体现了跳表的并发插入算法：

```
public V put(K key, V value) {
    if (value == null)
        throw new NullPointerException();
    return doPut(key, value, false);
}

private V doPut(K key, V value, boolean onlyIfAbsent) {
    Node<K,V> z;             // 新增节点
    if (key == null)
        throw new NullPointerException();
    Comparator<? super K> cmp = comparator;
    
    // 外层循环，处理重试
    outer: for (;;) {
        // 查找插入位置的前驱节点
        Node<K,V> b = findPredecessor(key, cmp);
        Node<K,V> n = b.next;
        
        // 内层循环，处理同一位置的冲突
        for (;;) {
            if (n != null) {
                Node<K,V> f = n.next;
                // 如果b不再是n的前驱，说明有并发修改，重试
                if (n != b.next)
                    continue outer;
                
                // 如果n已被标记删除，帮助删除并重试
                if (f != null && f.value == n)
                    continue outer;
                
                // 比较键，决定是继续查找还是更新现有节点
                int c = cpr(cmp, key, n.key);
                if (c > 0) {
                    b = n;
                    n = f;
                    continue;
                }
                
                // 找到相同的键，更新值
                if (c == 0) {
                    if (onlyIfAbsent || n.casValue(n.value, value))
                        return n.value;
                    continue outer; // CAS失败，重试
                }
            }
            
            // 准备插入新节点
            z = new Node<K,V>(key, value, n);
            if (!b.casNext(n, z))
                continue outer; // CAS失败，重试
            break;
        }
        
        // 成功插入节点后，随机决定是否需要增加索引层
        int rnd = ThreadLocalRandom.nextSecondarySeed();
        if ((rnd & 0x80000001) == 0) { // 大约有1/4的概率需要建索引
            int level = 1, max;
            while (((rnd >>>= 1) & 1) != 0)
                ++level;
                
            // 创建并链接索引节点
            Index<K,V> idx = null;
            HeadIndex<K,V> h = head;
            if (level <= (max = h.level)) {
                for (int i = 1; i <= level; ++i)
                    idx = new Index<K,V>(z, idx, null);
            }
            else { // 需要增加层级
                level = max + 1;
                Index<K,V>[] idxs = new Index[level+1];
                for (int i = 1; i <= level; ++i)
                    idxs[i] = idx = new Index<K,V>(z, idx, null);
                    
                // 尝试增加层级，可能会失败并重试
                for (;;) {
                    h = head;
                    int oldLevel = h.level;
                    if (level <= oldLevel)
                        break;
                    HeadIndex<K,V> newh = new HeadIndex<K,V>(h.node, h, null, level);
                    if (casHead(h, newh)) {
                        // 成功增加层级，设置新层的链接
                        h = newh;
                        idx = idxs[level];
                        for (int i = level; i > oldLevel; --i) {
                            Index<K,V> ni = idxs[i];
                            Index<K,V> pi = h;
                            // 设置每层的右侧链接
                            for (;;) {
                                Index<K,V> r = pi.right;
                                if (r != null && r.node.key != null &&
                                    cpr(cmp, r.node.key, key) < 0) {
                                    pi = r;
                                    continue;
                                }
                                ni.right = r;
                                if (pi.casRight(r, ni))
                                    break;
                            }
                        }
                        break;
                    }
                }
            }
            
            // 设置现有层级的索引链接
            for (int i = 1; i <= max && i <= level; ++i) {
                Index<K,V> ni = idxs[i];
                for (;;) {
                    Index<K,V> pi = findPredecessorIndex(key, i, cmp);
                    Index<K,V> r = pi.right;
                    if (r != null && r.node.key != null &&
                        cpr(cmp, r.node.key, key) < 0)
                        continue; // 右侧节点小于key，继续查找
                    ni.right = r;
                    if (pi.casRight(r, ni))
                        break; // 成功链接
                }
            }
        }
        return null; // 新增节点，返回null
    }
}


```

**源码分析**：

1. put操作首先调用doPut方法，该方法同时处理put和putIfAbsent操作
2. 查找过程从findPredecessor开始，该方法从最高索引层开始，逐层下降，最终定位到底层链表的合适位置
3. 在找到位置后，检查是否已存在相同键的节点：
   * 如果存在，则尝试更新值
   * 如果不存在，则创建新节点并插入
4. 插入新节点后，随机决定是否需要为该节点创建索引层
5. 如果需要创建索引，会根据随机数决定索引的层数，并将索引节点链接到对应层
6. 如果新索引的层数超过当前最高层，则增加整个跳表的高度
7. 整个过程不使用锁，而是通过CAS操作和重试机制保证线程安全

put操作的关键在于它的无锁设计和随机层级生成算法，这使得多个线程可以同时进行插入操作，大大提高了并发性能。

#### 3.3 get操作

get方法是ConcurrentSkipListMap的核心读操作，它利用跳表的多层索引结构快速定位元素：

```
public V get(Object key) {
    return doGet(key);
}

private V doGet(Object key) {
    if (key == null)
        throw new NullPointerException();
    Comparator<? super K> cmp = comparator;
    
    // 从最高层开始查找
    outer: for (;;) {
        // 获取当前最高层的头索引
        HeadIndex<K,V> h = head;
        Index<K,V> q = h;
        Index<K,V> r;
        
        // 从最高层开始，逐层向下查找
        for (;;) {
            // 在当前层向右查找
            while ((r = q.right) != null) {
                Node<K,V> n = r.node;
                K k = n.key;
                if (n.value == null) { // 节点已被删除
                    if (!q.unlink(r))
                        break; // 帮助删除失败，重新开始
                    continue;
                }
                
                // 比较键，决定是继续向右还是向下
                int c = cpr(cmp, key, k);
                if (c > 0) {
                    q = r; // 继续向右
                    continue;
                }
                else if (c == 0) {
                    return n.value; // 找到匹配的键，返回值
                }
                else // c < 0，当前位置的键大于目标键，停止向右
                    break;
            }
            
            // 到达当前层的尽头或找到大于目标键的位置
            // 如果有下一层，继续向下查找
            Index<K,V> d = q.down;
            if (d != null) {
                q = d;
                continue;
            }
            
            // 已到达最底层，开始在链表中查找
            break;
        }
        
        // 在底层链表中查找
        Node<K,V> b = q.node;
        Node<K,V> n = b.next;
        while (n != null) {
            K k = n.key;
            if (n.value == null) { // 节点已被删除
                n = n.next;
                continue;
            }
            
            // 比较键，决定是继续查找还是返回结果
            int c = cpr(cmp, key, k);
            if (c > 0) {
                b = n;
                n = n.next;
            }
            else if (c == 0) {
                return n.value; // 找到匹配的键，返回值
            }
            else // c < 0，未找到匹配的键
                break;
        }
        
        return null; // 未找到匹配的键，返回null
    }
}


```

**源码分析**：

1. get操作首先调用doGet方法
2. 从最高索引层开始，利用索引结构快速定位到目标位置附近
3. 在每一层中，向右查找直到找到大于或等于目标键的位置
4. 如果找到等于目标键的节点，直接返回其值
5. 否则，继续向下一层查找，直到到达底层链表
6. 在底层链表中线性查找目标键
7. 如果找到匹配的键，返回其值；否则返回null
8. 整个过程不需要加锁，是一个纯读操作

get操作充分利用了跳表的多层索引结构，使得查找操作的平均时间复杂度为O(log n)，这与红黑树等平衡树结构相当。由于不需要加锁，多个线程可以同时进行读操作，提供了极高的并发读取性能。

#### 3.4 remove操作

remove方法是ConcurrentSkipListMap的核心删除操作，它实现了无锁的并发删除算法：

```
public V remove(Object key) {
    return doRemove(key, null);
}

final V doRemove(Object key, Object value) {
    if (key == null)
        throw new NullPointerException();
    Comparator<? super K> cmp = comparator;
    
    // 外层循环，处理重试
    outer: for (;;) {
        // 查找要删除节点的前驱节点
        Node<K,V> b = findPredecessor(key, cmp);
        Node<K,V> n = b.next;
        
        // 内层循环，处理同一位置的冲突
        for (;;) {
            if (n == null)
                return null; // 未找到要删除的节点
                
            Node<K,V> f = n.next;
            // 如果b不再是n的前驱，说明有并发修改，重试
            if (n != b.next)
                continue outer;
                
            // 如果n已被标记删除，帮助删除并重试
            if (f != null && f.value == n)
                continue outer;
                
            // 比较键，决定是继续查找还是删除当前节点
            int c = cpr(cmp, key, n.key);
            if (c < 0)
                return null; // 未找到要删除的节点
            if (c > 0) {
                b = n;
                n = f;
                continue; // 继续查找
            }
            
            // 找到匹配的键，检查值是否也匹配（用于removeValue操作）
            if (value != null && !value.equals(n.value))
                return null;
                
            // 尝试将节点的值设为null，标记为已删除
            if (!n.casValue(n.value, null))
                continue outer; // CAS失败，重试
                
            // 尝试物理删除节点（更新前驱节点的next引用）
            if (!n.casNext(f, new Node<K,V>(n.key, null, f, n)))
                findNode(n.key); // 帮助完成删除
                
            // 物理删除成功，可能需要删除索引节点
            findPredecessor(key, cmp); // 清理索引
            
            // 如果没有其他线程在使用索引，可能需要降低跳表高度
            if (head.right == null && head.down != null) {
                HeadIndex<K,V> d = head.down;
                if (d.right == null && d.down != null)
                    casHead(head, d); // 尝试降低高度
            }
            
            return (V)n.value; // 返回被删除的值
        }
    }
}


```

**源码分析**：

1. remove操作首先调用doRemove方法，该方法同时处理remove和removeValue操作
2. 查找过程从findPredecessor开始，定位到要删除节点的前驱节点
3. 找到要删除的节点后，执行两阶段删除：
   * 首先使用CAS操作将节点的值设为null，标记为逻辑删除
   * 然后尝试物理删除节点，更新前驱节点的next引用
4. 如果物理删除成功，还需要清理索引节点
5. 如果跳表的高度过高（顶层索引为空），可能需要降低跳表高度
6. 整个过程不使用锁，而是通过CAS操作和重试机制保证线程安全

remove操作的关键在于它的两阶段删除设计：先逻辑删除（标记节点），再物理删除（移除链接）。这种设计确保了在并发环境下的安全删除，即使有其他线程同时访问被删除的节点，也不会导致不一致状态。

#### 3.5 迭代器实现

ConcurrentSkipListMap的迭代器实现提供了弱一致性的保证，不会抛出ConcurrentModificationException：

```
public Set<K> keySet() {
    KeySet<K> ks = keySet;
    return (ks != null) ? ks : (keySet = new KeySet<K>(this));
}

public Collection<V> values() {
    Values<V> vs = values;
    return (vs != null) ? vs : (values = new Values<V>(this));
}

public Set<Map.Entry<K,V>> entrySet() {
    EntrySet<K,V> es = entrySet;
    return (es != null) ? es : (entrySet = new EntrySet<K,V>(this));
}

// KeySet迭代器
static final class KeyIterator<K,V> extends Iter<K,V> implements Iterator<K> {
    public K next() {
        Node<K,V> n = advance();
        return n.key;
    }
}

// Values迭代器
static final class ValueIterator<K,V> extends Iter<K,V> implements Iterator<V> {
    public V next() {
        Node<K,V> n = advance();
        return n.value;
    }
}

// EntrySet迭代器
static final class EntryIterator<K,V> extends Iter<K,V> implements Iterator<Map.Entry<K,V>> {
    public Map.Entry<K,V> next() {
        Node<K,V> n = advance();
        return new AbstractMap.SimpleImmutableEntry<K,V>(n.key, n.value);
    }
}

// 基础迭代器类
abstract static class Iter<K,V> {
    Node<K,V> next;       // 下一个要返回的节点
    Node<K,V> lastReturned; // 最后一个返回的节点
    V nextValue;          // 缓存的下一个值
    
    Iter(ConcurrentSkipListMap<K,V> map) {
        // 初始化，找到第一个有效节点
        Node<K,V> n = map.findFirst();
        next = n;
        nextValue = (n == null) ? null : n.value;
    }
    
    public final boolean hasNext() {
        return next != null;
    }
    
    // 获取下一个有效节点
    final Node<K,V> advance() {
        Node<K,V> n = next;
        if (n == null)
            throw new NoSuchElementException();
        lastReturned = n;
        
        // 查找下一个有效节点
        Node<K,V> f = n.next;
        for (;;) {
            if (f == null) {
                next = null;
                nextValue = null;
                break;
            }
            V v = f.value;
            if (v != null) { // 找到有效节点
                next = f;
                nextValue = v;
                break;
            }
            // 跳过已删除的节点
            f = f.next;
        }
        return n;
    }
    
    public final void remove() {
        Node<K,V> l = lastReturned;
        if (l == null)
            throw new IllegalStateException();
        map.remove(l.key);
        lastReturned = null;
    }
}


```

**源码分析**：

1. ConcurrentSkipListMap提供了三种视图：keySet、values和entrySet，每种视图都有对应的迭代器
2. 所有迭代器都继承自基础迭代器类Iter，共享核心逻辑
3. 迭代器在创建时会找到第一个有效节点作为起点
4. advance()方法负责查找下一个有效节点，跳过已删除的节点
5. 迭代器支持remove操作，但实际上是调用map的remove方法，而不是直接修改结构
6. 迭代器提供弱一致性保证，可能看不到迭代过程中的并发修改
7. 不会抛出ConcurrentModificationException，即使在迭代过程中有其他线程修改了map

ConcurrentSkipListMap的迭代器设计体现了并发集合的一个重要特性：弱一致性。这种设计在保证安全性的同时，提供了更好的并发性能，但使用者需要了解其语义，不能期望看到所有的最新修改。

### 4. 性能特性

#### 4.1 时间复杂度分析

ConcurrentSkipListMap的各操作时间复杂度如下：

| 操作 | 时间复杂度 | 说明 |
| --- | --- | --- |
| get(Object key) | O(log n) | 利用索引层加速查找 |
| containsKey(Object key) | O(log n) | 与get操作类似 |
| put(K key, V value) | O(log n) | 查找位置O(log n)，插入节点O(1)，创建索引O(log n) |
| remove(Object key) | O(log n) | 查找节点O(log n)，删除操作O(1) |
| firstKey()/lastKey() | O(1) | 直接访问头尾节点 |
| subMap/headMap/tailMap | O(1) | 创建视图是常数时间操作 |
| size() | O(n) | 需要遍历整个集合 |
| 迭代操作 | O(n) | 遍历n个元素需要线性时间 |

从时间复杂度来看，ConcurrentSkipListMap的主要操作都是O(log n)级别，这与红黑树等平衡树结构相当。但在实际应用中，跳表的常数因子通常较小，且缓存友好性更好，可能在实际性能上有优势。

#### 4.2 并发性能分析

ConcurrentSkipListMap的并发性能特点：

1. **读操作**：

   * 完全无锁，多线程可以同时读取
   * 读性能随线程数线性扩展
   * 不会被写操作阻塞
2. **写操作**：

   * 无锁设计，使用CAS操作保证线程安全
   * 多线程写入可能因CAS冲突而重试，但不会阻塞
   * 写性能在高并发下有一定下降，但仍优于传统锁实现
3. **范围操作**：

   * 范围视图创建是O(1)操作
   * 范围操作在并发环境下安全
   * 提供弱一致性保证
4. **迭代操作**：

   * 基于快照，不受集合修改影响
   * 多线程可以同时迭代，互不干扰
   * 不会抛出ConcurrentModificationException

总体来说，ConcurrentSkipListMap在并发环境下表现优异，特别是在读多写少的场景。它的无锁设计避免了传统锁带来的上下文切换和线程阻塞开销，提供了更好的可伸缩性。

#### 4.3 适用场景和不适用场景

**适用场景**：

1. **需要并发访问的有序数据存储**：如排行榜、价格队列等需要按键排序且多线程访问的场景
2. **需要范围查询的并发场景**：如时间区间数据、数值范围检索等需要按范围获取数据的场景
3. **需要最接近查找的并发应用**：如价格匹配系统，需要找到不超过某个价格的最大值(floor)或不低于某个价格的最小值(ceiling)
4. **优先级相关的多线程应用**：如任务调度系统，需要按优先级处理任务
5. **高并发的事件处理系统**：按时间戳排序处理事件
6. **读多写少的并发场景**：读操作远多于写操作的应用

**不适用场景**：

1. **随机访问为主的场景**：如果不需要有序性，ConcurrentHashMap的O(1)访问性能更优
2. **写入频繁的场景**：高并发写入可能导致大量CAS冲突和重试
3. **对内存敏感的应用**：跳表的索引结构会占用额外内存
4. **需要精确大小计数的场景**：size()方法需要O(n)时间，且在并发环境下可能不准确
5. **需要强一致性保证的场景**：ConcurrentSkipListMap提供的是弱一致性保证

### 5. 最佳实践

#### 5.1 常见使用模式

1. **实时排行榜系统**：

   ```
   private final ConcurrentSkipListMap<Score, User> rankingBoard = 
       new ConcurrentSkipListMap<>(Collections.reverseOrder());

   // 更新用户分数
   public void updateScore(User user, int newScore) {
       // 移除旧记录
       rankingBoard.values().removeIf(u -> u.equals(user));
       // 添加新记录
       rankingBoard.put(new Score(newScore), user);
   }

   // 获取前N名
   public List<User> getTopN(int n) {
       return rankingBoard.values().stream()
           .limit(n)
           .collect(Collectors.toList());
   }

   // 获取某分数区间的用户
   public List<User> getUsersInScoreRange(int minScore, int maxScore) {
       return rankingBoard.subMap(new Score(maxScore), true, new Score(minScore), true)
           .values()
           .stream()
           .collect(Collectors.toList());
   }


   ```
2. **价格匹配系统**：

   ```
   private final ConcurrentSkipListMap<Price, Order> buyOrders = 
       new ConcurrentSkipListMap<>(Collections.reverseOrder()); // 买单按价格降序
   private final ConcurrentSkipListMap<Price, Order> sellOrders = 
       new ConcurrentSkipListMap<>(); // 卖单按价格升序

   // 添加买单
   public void addBuyOrder(Order order) {
       buyOrders.put(order.getPrice(), order);
       matchOrders();
   }

   // 添加卖单
   public void addSellOrder(Order order) {
       sellOrders.put(order.getPrice(), order);
       matchOrders();
   }

   // 撮合订单
   private void matchOrders() {
       while (!buyOrders.isEmpty() && !sellOrders.isEmpty()) {
           Price highestBuyPrice = buyOrders.firstKey();
           Price lowestSellPrice = sellOrders.firstKey();
           
           if (highestBuyPrice.compareTo(lowestSellPrice) >= 0) {
               // 可以撮合
               Order buyOrder = buyOrders.remove(highestBuyPrice);
               Order sellOrder = sellOrders.remove(lowestSellPrice);
               executeTransaction(buyOrder, sellOrder);
           } else {
               // 无法撮合
               break;
           }
       }
   }


   ```
3. **时间序列数据处理**：

   ```
   private final ConcurrentSkipListMap<Timestamp, Event> events = 
       new ConcurrentSkipListMap<>();

   // 添加事件
   public void addEvent(Timestamp time, Event event) {
       events.put(time, event);
   }

   // 获取某时间段的事件
   public List<Event> getEventsInTimeRange(Timestamp start, Timestamp end) {
       return new ArrayList<>(events.subMap(start, true, end, true).values());
   }

   // 获取最近N个事件
   public List<Event> getRecentEvents(int n) {
       return events.descendingMap().values().stream()
           .limit(n)
           .collect(Collectors.toList());
   }

   // 处理过期事件
   public void processExpiredEvents(Timestamp now) {
       Timestamp cutoff = new Timestamp(now.getTime() - expirationMillis);
       Map<Timestamp, Event> expiredEvents = events.headMap(cutoff);
       
       for (Event event : expiredEvents.values()) {
           processExpiredEvent(event);
       }
       
       expiredEvents.clear();
   }


   ```

#### 5.2 注意事项和陷阱

1. **键的不可变性**：

   * 确保用作键的对象是不可变的，或者至少在放入Map后不会修改其影响比较结果的属性
   * 如果键的比较结果发生变化，可能导致无法正确查找或删除元素
2. **比较器的一致性**：

   * 确保比较器的实现满足自反性、对称性和传递性
   * 比较器应该是无状态的，不产生副作用
   * 比较器的equals方法应该与compare方法一致
3. **弱一致性语义**：

   * 理解迭代器的弱一致性特性，它可能看不到迭代过程中的并发修改
   * 如果需要强一致性视图，可能需要额外的同步措施
4. **size()方法的性能**：

   * 避免频繁调用size()方法，特别是在大型集合上
   * size()方法需要O(n)时间，且在并发环境下可能不准确
   * 如果需要频繁获取大小，考虑使用单独的计数器
5. **内存使用**：

   * 注意跳表的索引结构会占用额外内存
   * 在内存受限环境中谨慎使用，或考虑调整初始容量
6. **范围操作的使用**：

   * 合理使用subMap、headMap、tailMap等范围视图
   * 注意范围视图是动态的，会反映底层Map的变化
   * 避免创建过多的范围视图，可能导致内存泄漏
7. **并发性能监控**：

   * 在生产环境中监控ConcurrentSkipListMap的性能
   * 如果发现性能问题，考虑调整并发参数或替换为其他数据结构

### 6. 总结

ConcurrentSkipListMap是一个基于跳表实现的线程安全有序映射表，它通过无锁算法保证了高并发环境下的安全访问，同时提供了丰富的有序操作和导航方法。

**核心特点**：

* 线程安全：支持高并发读写操作，无需显式加锁
* 有序性：键值对按照键的自然顺序或自定义比较器顺序排列
* 无锁实现：基于CAS等无锁算法保证线程安全
* 弱一致性：迭代器不会抛出ConcurrentModificationException，但可能看不到最新修改
* 非阻塞：操作不会阻塞线程，总是能够继续执行
* 范围操作支持：高效支持有序遍历、查找最接近的键、范围查找等操作

**设计思想**：

* 无锁并发控制：通过CAS等无锁算法避免传统锁的性能瓶颈
* 跳表数据结构：通过多层索引加速查找，平均时间复杂度为O(log n)
* 弱一致性模型：在一致性和性能之间做出权衡，提供更好的并发性能
* 帮助机制：线程在操作过程中帮助完成其他线程的未完成工作，提高整体效率

ConcurrentSkipListMap的设计体现了现代并发编程的重要思想：通过精心设计的数据结构和算法，可以在不使用传统锁的情况下实现高效的并发控制。它特别适合需要有序性和高并发访问的场景，如排行榜系统、价格匹配系统、时间序列数据处理等。

理解ConcurrentSkipListMap的工作原理和适用场景，可以帮助我们在合适的地方使用它，充分发挥其优势，同时避免其局限性带来的问题。
