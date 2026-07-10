---
title: "JUC集合-CopyOnWriteArrayList"
description: "在多线程编程成为常态的今天，如何安全、高效地处理共享数据是每个 Java 仔必须面对的课题。"
sourceId: "147248147"
source: "https://blog.csdn.net/qq_45852626/article/details/147248147"
sourceSeries:
  - "JUC集合"
category: java-backend
tags:
  - "JUC集合"
  - "JUC"
status: draft
difficulty: intermediate
contentType: knowledge
sidebar:
  order: 147248147
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/147248147)（历史文章导入，当前状态为草稿）

### 1. 引言：并发环境中的 List 缺点

**在多线程编程成为常态的今天，如何安全、高效地处理共享数据是每个 Java 仔必须面对的课题。**

`ArrayList` 作为 Java 集合框架中最常用的列表实现，以其高效的随机访问和动态扩容特性深受喜爱。然而，这份喜爱在并发环境下面变成了失望。

**`ArrayList` 的并发困境**

`ArrayList` 在设计上并未考虑线程安全。当多个线程同时对一个 `ArrayList` 实例进行结构性修改（添加、删除元素）或在迭代过程中进行修改时，极易引发以下问题：

1. **数据不一致**：一个线程的修改可能覆盖另一个线程的修改，或者导致读取到脏数据。
2. **`ConcurrentModificationException`**：当一个线程正在迭代 `ArrayList` 时，另一个线程修改了它（结构性修改），迭代器会快速失败（fail-fast），抛出此异常。
3. **数组越界等运行时异常**：并发修改可能导致内部状态混乱（如 `size` 和实际元素数量不匹配），进而引发更严重的运行时错误。

**早期解决方案及其局限**

为了解决 `ArrayList` 的并发问题，Java 提供了几种早期的解决方案：

1. **`Vector`**：作为 `ArrayList` 的线程安全版本，`Vector` 通过在几乎所有公开方法（包括读方法如 `get`、`size`）上添加 `synchronized` 关键字来实现线程安全。这种“一刀切”的同步方式虽然保证了安全，但也带来了巨大的性能瓶颈。在高并发场景下，所有线程（无论是读还是写）都需要竞争同一把锁，导致吞吐量急剧下降，读操作的性能也大打折扣。
2. **`Collections.synchronizedList(new ArrayList<>())`**：这是一个包装器方法，它接收一个 `ArrayList` 并返回一个线程安全的 `List`。其内部实现与 `Vector` 类似，也是通过在每个方法外部包裹 `synchronized` 代码块（使用 `mutex` 对象作为锁）来实现同步。因此，它同样存在与 `Vector` 类似的性能问题：锁粒度过大，读写互相阻塞。

这些早期方案虽然解决了线程安全问题，但性能损失显著，尤其是在读操作远多于写操作的场景下，它们的效率令人难以接受。开发者迫切需要一种更精细化、性能更好的并发列表实现。

**`CopyOnWriteArrayList` 的诞生**

正是在这样的背景下，`java.util.concurrent` (JUC) 包应运而生，带来了众多高效的并发工具类，`CopyOnWriteArrayList` 便是其中之一。它巧妙地运用了 **写时复制（Copy-On-Write, COW）** 的思想，为“读多写少”的并发场景提供了一种全新的、高性能的解决方案。

`CopyOnWriteArrayList` 的核心理念可以概括为：**读写分离，牺牲写性能和内存换取极致的读性能和无锁读取**。它允许并发的读操作完全无锁进行，而写操作则通过复制整个底层数组的方式来保证线程安全和数据一致性。

### 2. 核心思想：写时复制（Copy-On-Write）机制

要理解 `CopyOnWriteArrayList`，首先必须掌握其核心机制——**写时复制（Copy-On-Write, COW）**。  
 这是一种在计算机科学中广泛应用的优化策略(真的很广泛!!!)，尤其在处理并发读写和资源共享时非常有效。

**COW 的基本概念**

写时复制的核心思想可以通俗地理解为：**能共享就共享，要修改先复制**。

想象一下，有一份公共的在线文档（原始版本），许多人可以同时阅读它。

* **共享读取**：只要大家只是阅读，他们看到的都是同一份、唯一的原始文档。系统无需为每个人都准备一份副本，节省了资源。
* **修改时复制**：当某个人（比如 Alice）想要修改这份文档时，系统不会让她直接在原始文档上修改（因为这会影响到其他正在阅读的人）。相反，系统会先为 Alice 完整地复制一份原始文档，生成一个属于 Alice 的私有副本。
* **私有修改**：Alice 在她的私有副本上进行任意修改，这些修改对其他阅读原始文档的人是完全不可见的。
* **发布新版本**：当 Alice 完成修改并“保存”时，系统会将这份修改后的副本“发布”，替换掉原来的公共文档。之后新来阅读的人就会看到 Alice 修改后的新版本。而那些在替换发生前就已经开始阅读的人，他们看到的仍然是旧版本，直到他们重新“打开”文档。

这个过程的关键在于：

1. **读操作总是访问一个稳定、不变的版本**（要么是旧版本，要么是新版本），永远不会看到修改过程中的“中间状态”。
2. **写操作在一个隔离的副本上进行**，不会干扰到并发的读操作。
3. **版本的切换（引用的更新）通常是一个原子操作**，保证了切换的瞬时性和一致性。

**COW 的优缺点**

* **优点**：
  + **无锁读取**：读操作不需要任何同步机制（如锁），因为它们访问的数据是不可变的，从而极大地提高了并发读性能。
  + **数据一致性**：保证读取者总是看到一个一致的数据快照。
  + **简化并发控制**：相比复杂的读写锁等机制，COW 的逻辑相对简单。
* **缺点**：
  + **写操作开销大**：每次写操作都需要复制整个数据结构，如果数据量很大，时间和空间开销会非常显著。
  + **内存消耗增加**：在写操作期间，内存中会同时存在新旧两份数据，增加了内存占用。频繁写操作会产生大量临时对象，可能加剧 GC 压力。
  + **数据最终一致性**：读操作可能读取到的是旧的数据（快照），无法保证实时性。这是一种“最终一致性”或“弱一致性”。

**COW 在 `CopyOnWriteArrayList` 中的体现**

`CopyOnWriteArrayList` 正是 COW 思想在 Java 列表实现中的具体应用：

1. **数据存储**：内部使用一个 `Object[]` 数组来存储元素。这个数组引用被 `volatile` 修饰，确保其可见性。
2. **读操作 (`get`, `iterator` 等)**：直接访问当前的 `volatile` 数组引用，无需加锁。由于数组内容在获取引用后不会改变，读取是线程安全的。
3. **写操作 (`add`, `remove`, `set` 等)**：
   * 首先获取一个全局的 `ReentrantLock` 独占锁，确保同一时间只有一个线程能执行写操作。
   * 获取当前的数组 `array`。
   * 创建一个 **新的数组** `newArray`，其大小根据操作类型确定（增加、删除或不变）。
   * 将 `array` 中的相关元素 **复制** 到 `newArray` 中。
   * 在 `newArray` 上执行添加、删除或修改操作。
   * 将 `CopyOnWriteArrayList` 内部的 `array` 引用 **原子地指向** `newArray`。
   * 释放锁。

通过这个过程，`CopyOnWriteArrayList` 完美地实现了读写分离：读操作畅通无阻，写操作虽然需要复制和加锁，但保证了线程安全和数据一致性（对于写操作完成后的新读取而言）。这种设计使得它成为处理“读多写少”并发场景的理想选择。

### 3. 深入内部：`CopyOnWriteArrayList` 实现原理与源码剖析

现在，让我们深入 `CopyOnWriteArrayList` 的内部，结合源码（基于 JDK 8，但核心机制在后续版本中保持一致）来理解其具体实现细节。

#### 3.1 核心成员变量

```
/**
 * 底层存储元素的数组。被 volatile 修饰，保证其引用在多线程间的可见性。
 * 这是实现无锁读的关键。任何线程读取 array 时，都能看到最新被写入的数组引用。
 */
private transient volatile Object[] array;

/**
 * 控制并发写操作的独占锁。
 * 使用 ReentrantLock 而非 synchronized，提供了更灵活的锁操作（如尝试获取锁、可中断获取等），
 * 并且在 JUC 包内部保持风格统一。
 * 写操作（add, remove, set 等）开始时必须获取此锁，结束时释放。
 */
final transient ReentrantLock lock = new ReentrantLock();


```

* `array`: 这是 `CopyOnWriteArrayList` 存储数据的核心。`volatile` 关键字至关重要，它确保了当一个线程修改了 `array` 的引用（指向一个新的数组副本）后，其他线程能够 **立即** 看到这个更新。没有 `volatile`，读线程可能长时间持有旧的数组引用，导致数据可见性问题。
* `lock`: 这是一个 `ReentrantLock` 实例，用于保证 **写操作之间的互斥**。任何想要修改列表（`add`, `remove`, `set` 等）的线程，都必须先成功获取这把锁。这防止了多个线程同时复制和修改数组，从而避免了数据竞争和状态混乱。注意，**读操作完全不涉及这把锁**。

#### 3.2 构造函数

`CopyOnWriteArrayList` 提供了几个构造函数：

1. **无参构造函数**: 创建一个空的列表。

   ```
   /**
    * 创建一个空的列表。
    * 内部数组初始化为一个长度为 0 的 Object 数组。
    */
   public CopyOnWriteArrayList() {
       // setArray 方法会设置 this.array = new Object[0]
       setArray(new Object[0]);
   }


   ```

   `setArray` 是一个简单的辅助方法：

   ```
    /**
     * 设置内部数组引用。
     * @param a 新的数组
     */
    final void setArray(Object[] a) {
        array = a;
    }


   ```
2. **从集合构造**: 从一个现有的集合创建列表，包含该集合的所有元素。

   ```
   /**
    * 创建一个包含指定集合元素的列表，元素顺序由集合的迭代器确定。
    * @param c 包含元素的集合
    * @throws NullPointerException 如果指定集合为 null
    */
   public CopyOnWriteArrayList(Collection<? extends E> c) {
       Object[] elements;
       // 如果传入的集合本身就是 CopyOnWriteArrayList 类型，则直接获取其内部数组
       if (c.getClass() == CopyOnWriteArrayList.class)
           elements = ((CopyOnWriteArrayList<?>)c).getArray();
       else {
           // 否则，将集合转换为 Object 数组
           elements = c.toArray();
           // 如果 toArray 返回的不是 Object[] 类型 (例如，返回了 String[])，
           // 则需要使用 Arrays.copyOf 确保内部数组类型是 Object[]
           if (elements.getClass() != Object[].class)
               elements = Arrays.copyOf(elements, elements.length, Object[].class);
       }
       // 设置内部数组
       setArray(elements);
   }


   ```

   这个构造函数做了一些优化：如果传入的 `c` 本身就是 `CopyOnWriteArrayList`，可以直接共享（或获取快照）其内部数组，避免不必要的转换。否则，调用 `c.toArray()` 获取数组，并进行类型检查和必要的拷贝，确保内部 `array` 字段始终是 `Object[]` 类型。
3. **从数组构造**: 从一个现有数组创建列表。

   ```
   /**
    * 创建一个包含指定数组副本的列表。
    * @param toCopyIn 要复制其元素的数组
    * @throws NullPointerException 如果指定数组为 null
    */
   public CopyOnWriteArrayList(E[] toCopyIn) {
       // 使用 Arrays.copyOf 创建数组的副本，并确保类型是 Object[]
       // 这是为了防止外部修改传入的 toCopyIn 数组影响到 CopyOnWriteArrayList 内部状态
       setArray(Arrays.copyOf(toCopyIn, toCopyIn.length, Object[].class));
   }


   ```

   这里关键是使用了 `Arrays.copyOf`，创建了传入数组的一个 **副本**。这保证了 `CopyOnWriteArrayList` 内部数组的独立性，后续对原始 `toCopyIn` 数组的修改不会影响列表内容。

所有构造函数的核心目的都是初始化内部的 `array` 字段，为后续操作准备好初始数据（或空数组）。

#### 3.3 读操作 (`get`, `size` 等)

读操作是 `CopyOnWriteArrayList` 的性能优势所在。它们非常简单直接，**完全不需要加锁**。

```
/**
 * 获取当前内部数组的引用。
 * 由于 array 是 volatile 的，此方法总能获取到最新的数组引用。
 * @return 当前的内部数组
 */
final Object[] getArray() {
    return array;
}

/**
 * 返回列表中指定位置的元素。
 * @param index 要返回元素的索引
 * @return 列表中指定位置的元素
 * @throws IndexOutOfBoundsException 如果索引越界 (index < 0 || index >= size())
 */
@SuppressWarnings("unchecked")
public E get(int index) {
    // 1. 直接调用 getArray() 获取最新的数组引用 (无锁)
    // 2. 调用 elementAt (一个静态辅助方法) 从该数组获取元素
    return (E) elementAt(getArray(), index);
}

// 静态辅助方法，用于从数组获取指定索引的元素
static <E> E elementAt(Object[] a, int index) {
    return (E) a[index];
}

/**
 * 返回列表中的元素数量。
 * @return 列表中的元素数量
 */
public int size() {
    // 直接返回当前数组的长度 (无锁)
    return getArray().length;
}

/**
 * 判断列表是否为空。
 * @return 如果列表不包含任何元素，则返回 true
 */
public boolean isEmpty() {
    // 判断当前数组长度是否为 0 (无锁)
    return size() == 0;
}

// 其他读操作如 contains(), indexOf(), lastIndexOf() 等实现类似，
// 都是先获取当前数组引用，然后直接在数组上操作，全程无锁。


```

**理解帮助：为何读操作无需加锁？**

1. **数组引用的可见性**：`volatile` 关键字保证了 `array` 引用的改变对所有线程立即可见。当写线程更新 `array` 指向新副本后，读线程通过 `getArray()` 总能拿到最新的那个引用（或者是在更新发生前的那个旧引用，这取决于读取发生的精确时间点，但总是其中一个完整的引用）。
2. **数组内容的不变性**：一旦读线程获取了某个 `array` 引用，这个引用指向的数组 **内容本身是不会再被修改的**。写操作只会创建新数组并更新引用，而不会动旧数组的内容。因此，读线程可以安全地在这个（可能是旧的）数组快照上进行操作，无需担心数据在读取过程中被其他线程篡改。
3. **原子性**：数组引用的读取和写入本身是原子操作（对于引用类型）。读线程要么读到旧引用，要么读到新引用，不会读到一个“部分更新”的、无效的引用地址。

这三点结合起来，保证了 `CopyOnWriteArrayList` 的读操作即使在并发环境下也是线程安全的，且性能极高。

#### 3.4 写操作 (`add`, `remove`, `set` 等)

写操作是 `CopyOnWriteArrayList` 中成本较高但保证线程安全的关键部分。它们都遵循类似的模式：**加锁 -> 获取当前数组 -> 创建新数组 -> 复制元素 -> 在新数组上修改 -> 更新数组引用 -> 解锁**。

##### 3.4.1 `add(E e)` - 添加元素到末尾

```
/**
 * 将指定元素追加到列表的末尾。
 * @param e 要追加到列表的元素
 * @return true (根据 Collection.add 规范)
 */
public boolean add(E e) {
    // 获取写锁，保证同一时刻只有一个线程能执行添加操作
    final ReentrantLock lock = this.lock;
    lock.lock(); // 如果锁已被其他线程持有，当前线程会阻塞等待
    try {
        // 1. 获取当前内部数组的引用
        Object[] elements = getArray();
        int len = elements.length; // 获取当前长度

        // 2. 创建一个新数组，长度比原数组大 1
        // Arrays.copyOf 会负责复制原数组的所有元素到新数组
        Object[] newElements = Arrays.copyOf(elements, len + 1);

        // 3. 将新元素 e 放置在新数组的最后一个位置
        newElements[len] = e;

        // 4. 将内部数组引用 array 指向这个全新的数组
        // 由于 array 是 volatile 的，这个更新对其他线程立即可见
        setArray(newElements);

        // 添加操作总是成功的（除非内存溢出），返回 true
        return true;
    } finally {
        // 5. 无论操作成功与否（即使 try 块中抛出异常），
        // 都必须在 finally 块中释放锁，防止死锁
        lock.unlock();
    }
}


```

**源码解读与理解帮助：**

* **`lock.lock()`**: 这是写操作的第一步，也是保证线程安全的关键。如果锁已被持有，当前线程将阻塞，直到锁被释放。这确保了后续的数组复制和引用更新过程不会被其他写线程干扰。
* **`getArray()`**: 获取当前 `volatile` 的数组引用。
* **`Arrays.copyOf(elements, len + 1)`**: 这是 COW 的核心体现。它创建了一个全新的数组 `newElements`，长度增加了 1，并且将 `elements`（旧数组）的所有内容原封不动地复制到了 `newElements` 的前面部分。这是一个 **O(n)** 的操作，其中 n 是列表当前的元素数量。**这是 `CopyOnWriteArrayList` 写操作性能开销的主要来源**。
* **`newElements[len] = e`**: 在新数组的末尾添加新元素。
* **`setArray(newElements)`**: 将 `CopyOnWriteArrayList` 内部的 `array` 引用指向这个刚创建并修改好的 `newElements`。这是一个原子性的引用赋值操作。由于 `array` 是 `volatile` 的，一旦这个赋值完成，其他线程通过 `getArray()` 就能看到这个新数组了。旧的 `elements` 数组如果没有其他引用指向它，将在后续的垃圾回收中被清理。
* **`finally { lock.unlock() }`**: 保证锁一定会被释放，即使在 `try` 块中发生异常（例如 `OutOfMemoryError`）。这是规范的锁使用模式。

##### 3.4.2 `add(int index, E element)` - 在指定位置插入元素

```
/**
 * 在列表的指定位置插入指定元素。
 * 将当前位于该位置的元素（如果有）以及所有后续元素向右移动（索引加 1）。
 * @param index 要插入指定元素的索引
 * @param element 要插入的元素
 * @throws IndexOutOfBoundsException 如果索引越界 (index < 0 || index > size())
 */
public void add(int index, E element) {
    // 获取写锁
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        // 获取当前数组和长度
        Object[] elements = getArray();
        int len = elements.length;

        // 检查索引是否有效 (0 <= index <= len)
        if (index > len || index < 0)
            throw new IndexOutOfBoundsException("Index: "+index+", Size: "+len);

        // 声明新数组变量
        Object[] newElements;
        // 计算需要移动的元素数量
        int numMoved = len - index;

        // 如果需要移动的元素数量为 0 (即在末尾添加)
        if (numMoved == 0)
            // 直接创建长度+1的新数组，复制所有旧元素
            newElements = Arrays.copyOf(elements, len + 1);
        else {
            // 如果在中间或开头插入
            // 创建长度+1的新数组
            newElements = new Object[len + 1];
            // 复制插入点之前的部分 (0 到 index-1)
            System.arraycopy(elements, 0, newElements, 0, index);
            // 复制插入点之后的部分 (index 到 len-1)，移动到新数组的 index+1 位置开始
            System.arraycopy(elements, index, newElements, index + 1, numMoved);
        }
        // 在新数组的指定位置放入新元素
        newElements[index] = element;
        // 更新内部数组引用
        setArray(newElements);
    } finally {
        // 释放锁
        lock.unlock();
    }
}


```

**源码解读与理解帮助：**

* 这个方法比 `add(E e)` 稍微复杂，因为它涉及到元素的移动。
* 同样需要先获取锁。
* 索引检查是必要的。注意，允许 `index == len`，这相当于在末尾添加。
* 创建新数组 `newElements` 的长度也是 `len + 1`。
* 关键在于如何复制元素：
  + 如果 `numMoved == 0`（在末尾添加），直接用 `Arrays.copyOf` 最方便。
  + 如果 `numMoved > 0`（在中间或开头插入），需要分两步复制：
    1. 使用 `System.arraycopy` 将原数组 `index` **之前** 的元素复制到 `newElements` 的相同位置。
    2. 使用 `System.arraycopy` 将原数组从 `index` **开始** 的元素复制到 `newElements` 的 `index + 1` **之后** 的位置，为新元素腾出 `index` 位置。`System.arraycopy` 通常比循环复制更高效，因为它可能是基于本地方法实现的。
* 最后在新数组的 `index` 位置放入 `element`，更新引用，释放锁。
* **性能开销**：同样是 **O(n)**，因为涉及整个数组的复制（无论是用 `Arrays.copyOf` 还是 `System.arraycopy`）。

##### 3.4.3 `remove(int index)` - 删除指定位置的元素

```
/**
 * 移除列表中指定位置的元素。
 * 将所有后续元素向左移动（索引减 1）。
 * @param index 要移除元素的索引
 * @return 从列表中移除的元素
 * @throws IndexOutOfBoundsException 如果索引越界 (index < 0 || index >= size())
 */
@SuppressWarnings("unchecked")
public E remove(int index) {
    // 获取写锁
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        // 获取当前数组和长度
        Object[] elements = getArray();
        int len = elements.length;
        // 获取要删除的元素 (用于返回)
        E oldValue = elementAt(elements, index); // 会检查索引是否越界

        // 计算需要移动的元素数量
        int numMoved = len - index - 1;

        // 如果需要移动的元素数量为 0 (即删除最后一个元素)
        if (numMoved == 0)
            // 创建一个长度减 1 的新数组，只复制前 len-1 个元素
            setArray(Arrays.copyOf(elements, len - 1));
        else {
            // 如果删除的是中间或开头的元素
            // 创建一个长度减 1 的新数组
            Object[] newElements = new Object[len - 1];
            // 复制删除点之前的部分 (0 到 index-1)
            System.arraycopy(elements, 0, newElements, 0, index);
            // 复制删除点之后的部分 (index+1 到 len-1)，移动到新数组的 index 位置开始
            System.arraycopy(elements, index + 1, newElements, index, numMoved);
            // 更新内部数组引用
            setArray(newElements);
        }
        // 返回被删除的元素
        return oldValue;
    } finally {
        // 释放锁
        lock.unlock();
    }
}


```

**源码解读与理解帮助：**

* 与 `add(int index, E element)` 非常类似，但这次是创建长度为 `len - 1` 的新数组。
* 先获取要删除的元素 `oldValue`，因为方法需要返回它。`elementAt` 内部会进行索引检查。
* 同样根据 `numMoved` 判断是删除末尾元素还是中间/开头元素。
* 如果是删除末尾，`Arrays.copyOf(elements, len - 1)` 最简单，它只复制旧数组的前 `len - 1` 个元素到新数组。
* 如果是删除中间/开头，需要用 `System.arraycopy` 分两步复制：
  1. 复制 `index` **之前** 的元素。
  2. 复制 `index + 1` **之后** 的元素到新数组的 `index` 位置开始，跳过了原 `index` 位置的元素。
* 更新引用，释放锁，返回 `oldValue`。
* **性能开销**：依然是 **O(n)**，因为涉及数组复制。

##### 3.4.4 `set(int index, E element)` - 替换指定位置的元素

```
/**
 * 使用指定元素替换列表中指定位置的元素。
 * @param index 要替换元素的索引
 * @param element 要存储在指定位置的元素
 * @return 先前位于指定位置的元素
 * @throws IndexOutOfBoundsException 如果索引越界 (index < 0 || index >= size())
 */
public E set(int index, E element) {
    // 获取写锁
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        // 获取当前数组
        Object[] elements = getArray();
        // 获取旧值 (用于返回)，同时检查索引
        E oldValue = elementAt(elements, index);

        // 如果旧值和新值相同 (根据 equals 判断)，则无需做任何事，直接返回旧值
        // 这是一种优化，避免不必要的数组复制
        if (oldValue != element && (oldValue == null || !oldValue.equals(element))) {
            // 如果值不同，才需要复制和修改
            int len = elements.length;
            // 创建一个和原数组一样大的新数组，并复制所有元素
            Object[] newElements = Arrays.copyOf(elements, len);
            // 在新数组的指定位置设置新元素
            newElements[index] = element;
            // 更新内部数组引用
            setArray(newElements);
        }
        // 返回旧值
        return oldValue;
    } finally {
        // 释放锁
        lock.unlock();
    }
}


```

**源码解读与理解帮助：**

* `set` 操作相对简单，因为它不改变列表的大小。
* 先获取锁，获取旧值并检查索引。
* **优化**：如果新旧值相同 (`oldValue != element && (oldValue == null || !oldValue.equals(element))` 这个条件不满足时)，则根本不需要创建新数组，直接返回 `oldValue`。这对于 `set` 操作来说是一个重要的性能优化，如果设置的值没变，开销几乎为零（除了加锁解锁和一次 `get`）。
* 如果值确实改变了，才执行 COW 流程：
  + 创建 **等大小** 的新数组 `newElements`，并用 `Arrays.copyOf` 复制所有元素。
  + 在新数组的 `index` 位置设置新值 `element`。
  + 更新引用 `setArray(newElements)`。
* 释放锁，返回 `oldValue`。
* **性能开销**：如果值改变，是 **O(n)**（因为 `Arrays.copyOf`）。如果值不变，接近 **O(1)**。

**总结写操作的关键点：**

1. **必须加锁**：使用 `ReentrantLock` 保证写操作互斥。
2. **写时复制**：不修改原数组，总是创建新数组。
3. **数组复制成本高**：所有写操作（除了值不变的 `set`）的时间复杂度都是 O(n)。
4. **原子更新引用**：`volatile` 保证引用更新的可见性。
5. **`finally` 释放锁**：保证锁总能被释放。

#### 3.5 迭代器 (`iterator`, `listIterator`)

`CopyOnWriteArrayList` 的迭代器是其另一个显著特点，它提供了 **弱一致性 (Weak Consistency)** 或称为 **快照 (Snapshot) 迭代器**。

```
/**
 * 返回在此列表中的元素上进行迭代的迭代器。
 * 返回的迭代器提供列表状态的“快照”。不需要同步，并且 *不会* 抛出 ConcurrentModificationException。
 * 迭代器不支持 remove、set 或 add 操作。
 *
 * @return 在此列表中的元素上进行迭代的迭代器
 */
public Iterator<E> iterator() {
    // 创建 COWIterator 实例，传入当前的数组快照和起始索引 0
    return new COWIterator<E>(getArray(), 0);
}

/**
 * 返回此列表元素的列表迭代器。
 * 返回的列表迭代器提供列表状态的“快照”。不需要同步，并且 *不会* 抛出 ConcurrentModificationException。
 * 迭代器不支持 remove、set 或 add 操作。
 *
 * @return 此列表元素的列表迭代器
 */
public ListIterator<E> listIterator() {
    // 创建 COWIterator 实例，传入当前的数组快照和起始索引 0
    return new COWIterator<E>(getArray(), 0);
}

/**
 * 返回列表中元素的列表迭代器（从列表的指定位置开始）。
 * 返回的列表迭代器提供列表状态的“快照”。不需要同步，并且 *不会* 抛出 ConcurrentModificationException。
 * 迭代器不支持 remove、set 或 add 操作。
 *
 * @param index 开始迭代的第一个元素的索引
 * @return 列表中元素的列表迭代器（从列表的指定位置开始）
 * @throws IndexOutOfBoundsException 如果索引越界 (index < 0 || index > size())
 */
public ListIterator<E> listIterator(int index) {
    // 获取当前数组
    Object[] elements = getArray();
    int len = elements.length;
    // 检查起始索引
    if (index < 0 || index > len)
        throw new IndexOutOfBoundsException("Index: "+index);
    // 创建 COWIterator 实例，传入当前的数组快照和指定的起始索引
    return new COWIterator<E>(elements, index);
}

// 内部静态迭代器类
static final class COWIterator<E> implements ListIterator<E> {
    /**
     * 保存创建迭代器时列表数组的快照引用。
     * 迭代器后续的所有操作都基于这个快照进行，与列表后续的修改无关。
     */
    private final Object[] snapshot;
    /**
     * 迭代器当前的游标（下一个要返回的元素的索引）。
     */
    private int cursor;

    /**
     * 构造函数。
     * @param elements 创建迭代器时获取的数组快照
     * @param initialCursor 迭代器的起始位置
     */
    COWIterator(Object[] elements, int initialCursor) {
        cursor = initialCursor;
        snapshot = elements; // 将传入的数组引用保存到 final 字段中
    }

    public boolean hasNext() {
        // 判断游标是否小于快照数组的长度
        return cursor < snapshot.length;
    }

    public boolean hasPrevious() {
        // 判断游标是否大于 0
        return cursor > 0;
    }

    @SuppressWarnings("unchecked")
    public E next() {
        // 检查是否还有下一个元素
        if (! hasNext())
            throw new NoSuchElementException();
        // 从快照数组中获取当前游标位置的元素，并将游标后移
        return (E) snapshot[cursor++];
    }

    @SuppressWarnings("unchecked")
    public E previous() {
        // 检查是否还有上一个元素
        if (! hasPrevious())
            throw new NoSuchElementException();
        // 将游标前移，并从快照数组中获取新游标位置的元素
        return (E) snapshot[--cursor];
    }

    public int nextIndex() {
        // 返回当前游标位置
        return cursor;
    }

    public int previousIndex() {
        // 返回前一个元素的索引
        return cursor - 1;
    }

    /**
     * 不支持移除操作。
     */
    public void remove() {
        throw new UnsupportedOperationException();
    }

    /**
     * 不支持设置操作。
     */
    public void set(E e) {
        throw new UnsupportedOperationException();
    }

    /**
     * 不支持添加操作。
     */
    public void add(E e) {
        throw new UnsupportedOperationException();
    }
}


```

**源码解读与理解帮助：为什么不会抛出 `ConcurrentModificationException`？**

1. **快照机制 (`snapshot`)**：迭代器 `COWIterator` 在创建时，通过 `getArray()` 获取了 `CopyOnWriteArrayList` **当时** 的内部数组引用，并将其保存在 `final` 字段 `snapshot` 中。之后迭代器的所有操作（`next`, `previous`, `hasNext` 等）都是 **直接** 作用于这个 `snapshot` 数组，完全与 `CopyOnWriteArrayList` 后续的状态变化 **隔离** 开了。
2. **写操作不影响快照**：当其他线程对 `CopyOnWriteArrayList` 进行写操作（`add`, `remove`, `set`）时，它们会创建 **新的** 数组，并更新 `CopyOnWriteArrayList` 的 `array` 引用。这个过程 **不会** 修改迭代器持有的那个旧的 `snapshot` 数组的内容。
3. **无修改检查 (`modCount`)**：传统的 `ArrayList` 迭代器会维护一个 `expectedModCount`，与 `ArrayList` 的 `modCount`（修改次数计数器）比较。如果迭代过程中 `modCount` 发生变化，迭代器就会抛出 `ConcurrentModificationException`。`CopyOnWriteArrayList` 的迭代器完全没有这种检查机制，因为它操作的是一个不可变的快照，无需担心并发修改。

**弱一致性意味着什么？**

迭代器遍历的是创建它那一刻的数据快照。如果在迭代过程中，列表被其他线程修改了：

* **添加了新元素**：迭代器 **不会** 看到这些新添加的元素。
* **删除了元素**：迭代器 **仍然会** 看到这些已被删除的元素（因为它们存在于快照中）。
* **修改了元素**：迭代器 **不会** 看到元素的修改，它看到的是修改前的值。

这种行为被称为 **弱一致性** 或 **快照一致性**。它保证了迭代的安全性和无异常抛出，但牺牲了数据的实时性。开发者需要明确，通过 `CopyOnWriteArrayList` 迭代器看到的数据可能不是列表最新的状态。

**迭代器的限制**

`COWIterator` 的 `remove()`, `set(E e)`, `add(E e)` 方法都直接抛出 `UnsupportedOperationException`。这是因为修改操作会违反 COW 的原则（修改应该创建新副本），并且在快照上进行修改也没有意义（不会反映到原始列表中）。如果你需要在迭代时修改列表，`CopyOnWriteArrayList` 的迭代器无法满足需求。

#### 3.6 线程安全机制总结

`CopyOnWriteArrayList` 的线程安全主要依赖以下几个机制的协同工作：

1. **不变性 (Immutability)**：通过写时复制，确保任何时刻通过 `getArray()` 获取到的数组，其内容在被读取期间是不可变的。读操作访问的是一个稳定的数据结构。
2. **`volatile` 关键字**：保证了 `array` 数组引用的 **可见性**。当一个写线程完成了新数组的创建并将 `array` 指向它之后，其他线程能立即看到这个更新，从而在后续的读操作中获取到新的数组快照。它建立了写线程更新引用与读线程读取引用之间的 happens-before 关系。
3. **`ReentrantLock` 互斥锁**：保证了 **写操作之间的原子性和互斥性**。任何写操作（复制、修改、更新引用）都必须在持有锁的情况下完成，防止了多个写线程并发修改导致的数据不一致或状态混乱。读操作完全不参与锁竞争。
4. **读写分离**：读操作无锁且直接访问（可能是旧的）快照，写操作加锁并在副本上进行。两者操作的数据在物理上（或逻辑上，通过不同引用）是分离的，互不干扰。

这些机制共同确保了 `CopyOnWriteArrayList` 在并发环境下的线程安全，同时为读操作提供了极高的性能。

### 4. 性能深度剖析

理解 `CopyOnWriteArrayList` 的性能特点对于正确使用它至关重要。它的性能表现呈现出明显的两面性。

#### 4.1 优势：读操作和迭代性能

* **读操作 (`get`, `size`, `isEmpty`, `contains` 等)**：
  + **时间复杂度：O(1)** （对于 `get`, `size`, `isEmpty`）或 **O(n)** （对于 `contains`, `indexOf` 等需要遍历的操作）。
  + **并发性能：极高**。由于读操作完全无锁，多个线程可以同时并发读取，几乎没有竞争开销（除了可能的 CPU 缓存同步开销，但这远小于锁竞争）。性能接近于非线程安全的 `ArrayList`，并且远超 `Vector` 和 `Collections.synchronizedList`。线程数量增加时，读吞吐量几乎可以线性扩展。
* **迭代操作 (`iterator`, `listIterator`)**：
  + **创建迭代器：O(1)** （仅获取数组引用）。
  + **遍历：O(n)**。
  + **并发性能：极高且安全**。迭代器操作的是快照，不受并发写操作的影响，不会抛出 `ConcurrentModificationException`。多个线程可以同时安全地迭代列表的不同快照或相同快照。

**核心优势来源：无锁读取 + 数据不变性。**

#### 4.2 劣势：写操作性能和内存消耗

* **写操作 (`add`, `remove`, `set` (值改变时))**：
  + **时间复杂度：O(n)**。每次写操作都需要复制整个底层数组，成本与列表当前大小成正比。
  + **并发性能：较差**。所有写操作都需要竞争同一个 `ReentrantLock`。在高并发写入场景下，线程会因争抢锁而阻塞，导致写吞吐量低下，无法随线程数扩展。锁的存在使得写操作基本上是串行执行的。
* **内存消耗**：
  + **写操作期间内存翻倍**：在执行写操作（如 `add`）时，内存中会同时存在旧数组和新创建的数组，直到旧数组不再被任何读线程或迭代器引用后才会被 GC 回收。对于非常大的列表，这可能导致显著的瞬时内存峰值。
  + **频繁写操作导致 GC 压力增大**：每次写操作都会创建一个新数组并丢弃旧数组（如果不再被引用）。如果写操作非常频繁，会产生大量短生命周期的大对象，增加垃圾回收的频率和暂停时间 (STW, Stop-The-World)，可能影响应用的整体响应性。
  + **迭代器持有快照**：每个活跃的迭代器都会持有创建它时那个数组快照的引用。如果一个迭代过程很长，即使列表本身已经被多次修改，这个旧的、可能很大的数组快照也无法被回收，可能导致内存泄漏（逻辑上的，非典型内存泄漏）。

**核心劣势来源：数组复制 O(n) 开销 + 写操作锁竞争 + 额外内存占用。**

#### 4.3 与其他列表实现的性能对比

| 特性 | `CopyOnWriteArrayList` | `ArrayList` (非同步) | `Vector` | `Collections.synchronizedList` | `ConcurrentLinkedQueue` (非 List) |
| --- | --- | --- | --- | --- | --- |
| **线程安全** | 是 | 否 | 是 | 是 | 是 |
| **读性能 (并发)** | 极高 (无锁) | N/A (不安全) | 低 (锁竞争) | 低 (锁竞争) | 高 (无锁 CAS) |
| **写性能 (并发)** | 低 (O(n)复制 + 锁) | N/A (不安全) | 低 (锁竞争, 均摊 O(1)) | 低 (锁竞争, 均摊 O(1)) | 高 (无锁 CAS, O(1)) |
| **迭代器** | 快照 (弱一致) | Fail-fast | Fail-fast | Fail-fast | 快照 (弱一致) |
| **迭代时并发修改** | 安全 (不抛异常) | 抛 CME | 抛 CME | 抛 CME | 安全 (不抛异常) |
| **内存消耗** | 高 (写时复制) | 低 | 中 (扩容) | 中 (扩容) | 中 (节点对象开销) |
| **主要适用场景** | 读远多于写 | 单线程或外部同步 | 遗留代码 / 简单同步需求 | 包装现有 List | 高并发队列 / 生产者消费者 |

**理解帮助：何时选择 `CopyOnWriteArrayList`？**

结合性能分析，`CopyOnWriteArrayList` 的最佳应用场景是：

1. **读操作频率远大于写操作频率**：这是最重要的前提。例如，配置信息、监听器列表、路由表等，这些数据通常初始化后很少改变，但会被频繁读取。
2. **列表大小相对可控**：由于写操作的 O(n) 复制成本，如果列表非常大（如百万级元素），即使写操作不频繁，单次写操作的耗时和内存开销也可能变得无法接受。
3. **可以接受数据的弱一致性**：读取操作看到的数据可能是之前的快照，不保证实时性。如果业务逻辑要求强一致性（读取必须看到最新的修改），则 `CopyOnWriteArrayList` 可能不适用。
4. **迭代安全性要求高**：如果需要在迭代过程中保证不被打断（不抛 `ConcurrentModificationException`），即使列表被其他线程修改，COW 迭代器是很好的选择。

**何时避免使用 `CopyOnWriteArrayList`？**

1. **写操作频繁或与读操作频率相当**：此时 O(n) 的复制成本和写锁竞争会成为性能瓶颈。考虑使用 `ConcurrentHashMap` (如果 key 适用) 或带有 `ReadWriteLock` 保护的 `ArrayList` 等其他方案。
2. **列表非常大**：内存消耗和单次写操作耗时过高。
3. **需要强一致性读取**。
4. **内存极度敏感的应用**：需要严格控制内存占用和 GC 行为。

### 5. 实际应用场景与最佳实践

理论结合实际，我们来看看 `CopyOnWriteArrayList` 在哪些具体的场景中能够发挥优势，以及使用时需要注意的最佳实践。

#### 5.1 典型应用场景

1. **事件监听器 (Listener) 管理**：

   * **场景特点**：监听器的注册 (`add`) 和注销 (`remove`) 操作相对较少，而事件触发时需要遍历所有监听器并调用其处理方法 (`iterator` + `get`) 的操作非常频繁。
   * **为何适用**：完美契合“读多写少”模型。事件触发时可以无锁、安全、高效地遍历当时的监听器列表快照。即使在遍历过程中有新的监听器注册或注销，也不会影响当前的事件分发（不会抛 CME），也符合逻辑（本次事件只通知注册时的监听器）。
   * **示例**：Swing/AWT 的事件处理，各种框架中的回调机制。
2. **配置信息缓存**：

   * **场景特点**：系统启动时加载配置，运行时可能偶尔需要动态更新配置，但绝大多数时间是各个业务线程读取配置项。
   * **为何适用**：配置读取操作远多于更新操作。使用 `CopyOnWriteArrayList` 存储配置列表（如果配置是列表形式），可以保证高并发读取性能。更新配置时虽然有开销，但通常可以接受（因为不频繁）。读取线程总能拿到一个一致的配置快照。
3. **路由表或规则引擎**：

   * **场景特点**：路由信息或业务规则通常比较稳定，更新不频繁，但请求处理时需要频繁查询匹配。
   * **为何适用**：读多写少。高并发查询路由或规则时性能好。更新操作虽然慢，但影响可控。
4. **需要保证迭代绝对安全的场景**：

   * **场景特点**：某些后台任务需要定期遍历一个共享列表进行处理，且处理逻辑不能被 `ConcurrentModificationException` 中断，即使在遍历时列表可能被修改。
   * **为何适用**：快照迭代器保证了迭代过程的稳定性。

#### 5.2 使用最佳实践与注意事项

1. **明确读写比例**：在使用前，务必评估或监控应用的实际读写比例。只有在读操作显著多于写操作时，`CopyOnWriteArrayList` 才能发挥优势。不要凭感觉选用。
2. **关注列表大小**：监控列表的最大预期大小。如果列表可能增长到非常大（例如，超过几万或几十万个元素，具体阈值取决于应用性能要求和硬件），谨慎使用，或者考虑分片、使用其他数据结构等策略。
3. **理解弱一致性**：确保业务逻辑能够容忍读取到稍微过时的数据。如果需要强一致性，不要使用 `CopyOnWriteArrayList`。例如，在一个需要精确统计在线用户数的场景中，用它存储在线用户列表可能就不合适，因为 `size()` 返回的可能不是实时的准确数量。
4. **避免在循环中频繁写入**：绝对不要在循环（尤其是次数不确定的循环）中频繁调用 `CopyOnWriteArrayList` 的写方法。例如，下面的代码是灾难性的：

   ```
   // 灾难性用法！不要这样做！
   CopyOnWriteArrayList<String> list = new CopyOnWriteArrayList<>();
   for (int i = 0; i < 100000; i++) {
       list.add("Item " + i); // 每次 add 都会复制整个数组！性能极差！
   }


   ```

   如果需要批量添加，应该先收集到另一个临时列表（如 `ArrayList`）中，然后使用 `addAll()` 方法一次性添加，或者使用接受集合的构造函数。`addAll()` 内部有优化，会计算好最终大小，只进行一次数组复制。

   ```
   // 正确的批量添加方式
   List<String> tempList = new ArrayList<>();
   for (int i = 0; i < 100000; i++) {
       tempList.add("Item " + i);
   }
   CopyOnWriteArrayList<String> list = new CopyOnWriteArrayList<>(tempList); // 或者 list.addAll(tempList);


   ```
5. **迭代器持有快照的内存影响**：如果创建了迭代器，并且迭代过程非常耗时（或者迭代器对象被长时间持有），它会阻止对应的旧数组快照被 GC。在内存敏感的应用中需要注意这一点。尽量缩短迭代时间，或者确保迭代器能被及时回收。
6. **考虑替代方案**：
   * 如果写操作也比较频繁，但仍需并发安全，可以考虑 `ConcurrentLinkedQueue`（如果队列语义适用，它是无锁的，性能好），或者使用 `ReadWriteLock` 保护的 `ArrayList`（允许多个读线程并发，但读写、写写互斥）。
   * 如果需要根据 key 快速查找，并且读多写少，`ConcurrentHashMap` 是一个非常好的选择。它的 `keySet()` 或 `values()` 视图也提供弱一致性的迭代器。

### 6. 潜在陷阱与常见误区

虽然 `CopyOnWriteArrayList` 是一个强大的工具，但如果理解不当或使用不慎，也可能掉入一些陷阱。

1. **误认为写操作也很快**：新手可能只关注到“并发 List”而忽略了 COW 的代价，在写密集的场景误用 `CopyOnWriteArrayList`，导致性能远低于预期。**核心误区：忘记了写操作是 O(n) 的复制开销。**
2. **内存溢出风险 (OutOfMemoryError)**：在列表极大且频繁写入的极端情况下，或者长时间持有旧快照迭代器的情况下，可能因内存占用过高而导致 OOM。需要监控内存使用情况。
3. **数据不一致的误解**：弱一致性不代表数据会损坏或错乱。它只是意味着读线程看到的数据可能是列表在过去某个时间点的状态。数据本身在其快照内是一致的。**核心误区：将弱一致性与数据损坏混淆。** 需要理解的是数据“过时”的可能性。
4. **对 `size()` 的实时性期望过高**：`size()` 方法返回的是某个快照数组的长度，它不一定反映调用时刻列表的精确大小（如果在调用 `size()` 的同时发生了写操作）。如果需要精确计数，可能需要其他机制（如 `AtomicLong` 配合写操作维护）。
5. **迭代器不支持修改的困惑**：习惯了 `ArrayList` 迭代器可以在迭代时 `remove()` 的开发者，可能会对 `CopyOnWriteArrayList` 迭代器抛出 `UnsupportedOperationException` 感到困惑。需要记住这是 COW 设计的固有结果。

### 7. 总结

`CopyOnWriteArrayList` 是 Java 并发包 (JUC) 提供的一个非常有特色的线程安全列表实现。它通过**写时复制 (Copy-On-Write)** 机制，巧妙地实现了**读写分离**：

* **读操作**：完全无锁，性能极高，接近原生 `ArrayList`，支持高并发读取。
* **写操作**：通过加锁和复制整个底层数组来保证线程安全，成本较高 (O(n))，写并发性能受锁限制。
* **迭代器**：提供基于快照的弱一致性迭代，安全可靠，不会抛出 `ConcurrentModificationException`，但不支持修改操作，且看到的数据可能不是最新的。

**核心优势**在于其卓越的**并发读取性能**和**迭代安全性**，使其成为\*\*“读多写少”\*\*场景下的理想选择，例如事件监听器管理、配置缓存等。

然而，它的**缺点**也同样明显：**写操作性能差**、**内存消耗相对较高**、**数据非实时一致**。因此，在写操作频繁、列表规模巨大、或需要强一致性的场景下，应避免使用 `CopyOnWriteArrayList`，考虑其他并发集合（如 `ConcurrentHashMap`, `ConcurrentLinkedQueue`）或同步机制（如 `ReadWriteLock` + `ArrayList`）。

掌握 `CopyOnWriteArrayList` 的关键在于深刻理解其 **COW 核心机制**、**性能特点（读快写慢）**、**内存模型（volatile + lock）**以及**迭代器的快照行为**。  
 只有这样，才能在实际开发中扬长避短，将其用在最合适的场景，编写出健壮、高效的并发程序。

希望这篇文章能够帮助你理解 `CopyOnWriteArrayList`.

Happy coding!
