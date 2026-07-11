---
title: "Java 堆排序（Heap Sort）详解教程"
description: "堆是一种完全二叉树（complete binary tree），分为："
sourceId: "153801123"
source: "https://blog.csdn.net/qq_45852626/article/details/153801123"
sourceSeries:
  - "数据结构和算法"
category: algorithms
subcategory: algorithm-patterns
tags:
  - "数据结构和算法"
  - "Java"
  - "算法"
status: draft
difficulty: intermediate
contentType: knowledge
sidebar:
  order: 153801123
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/153801123)（历史文章导入，当前状态为草稿）

### 一、什么是堆（Heap）？

堆是一种**完全二叉树（complete binary tree）**，分为：

* **大顶堆（max heap）**：每个节点的值 ≥ 子节点。
* **小顶堆（min heap）**：每个节点的值 ≤ 子节点。

在堆排序中，我们使用 **大顶堆** 来进行 **升序排序**。

---

### 二、堆的数组存储结构

堆通常不用链表存储，而是直接放在数组里。  
 节点下标关系如下（假设数组下标从 0 开始）：

| 节点 | 公式 | 说明 |
| --- | --- | --- |
| 父节点 | i | 当前节点索引 |
| 左子节点 | 2\*i + 1 |  |
| 右子节点 | 2\*i + 2 |  |

#### 示例：数组 [4, 6, 8, 5, 9]

树形结构如下：

```
           4(0)
        /        \
     6(1)         8(2)
   /     \
 5(3)    9(4)


```

---

### 三、堆排序核心思路

#### 核心思想一句话：

> 不断取出堆顶（最大值），放到数组末尾，然后重建大顶堆。

也就是：

1. 先把数组调整成「大顶堆」；
2. 交换堆顶元素（最大值）与数组末尾；
3. 堆大小减 1，重新调整为大顶堆；
4. 重复直到数组有序。

---

### 四、为什么从 `n/2 - 1` 开始建堆？

这个是很多人疑惑的地方👇

#### 数学解释：

对于数组长度 `n`：

* 叶子节点的下标范围是 `[n/2, n-1]`。
* 因为在堆的结构中：

  ```
  左孩子 = 2*i + 1


  + 1
  ```

  所以只要 `2*i + 1 < n`，`i` 就是一个非叶子节点。

推导：

```
2*i + 1 < n
→ i < (n - 1)/2
→ i_max = floor((n - 1)/2)


```

因此：

> 最后一个非叶子节点的下标 = n/2 - 1。

#### 举例验证：

数组长度 n = 5  
 → 最后一个非叶子节点 = 5/2 - 1 = 1  
 （节点索引 1：左=3, 右=4 ✅）

#### 直觉理解：

> 因为从 n/2 开始的节点，它们都已经是叶子，没有孩子要调整。

所以建堆时：

```
for (int i = n/2 - 1; i >= 0; i--) {
    heapify(arr, n, i);
}


```

从下往上建堆，子树先调整好，父节点才能正确“下沉”。  
 这就回答了你的另一个疑问👇

---

### 五、为什么不能从根节点（0）开始建堆？

因为如果你从上往下建：

* 根节点下沉时会依赖子节点的堆结构；
* 但此时子节点可能还没被调整好。

比如：

```
      4
    /   \
   9     8


```

当根节点 4 尝试下沉时，无法正确判断应该下沉到哪里，因为左右子树还没整理成堆。

> 所以必须从最后一个非叶子节点开始，自底向上堆化。

---

### 六、堆化（heapify）的本质

堆化的作用是：

> 让以当前节点 `i` 为根的子树满足大顶堆性质。

#### 伪代码逻辑：

```
void heapify(int[] arr, int n, int i) {
    int largest = i;        // 假设当前节点最大
    int left = 2*i + 1;     // 左孩子
    int right = 2*i + 2;    // 右孩子

    // 左孩子比当前节点大
    if (left < n && arr[left] > arr[largest])
        largest = left;

    // 右孩子比当前最大的大
    if (right < n && arr[right] > arr[largest])
        largest = right;

    // 如果最大值不是自己，交换并递归堆化
    if (largest != i) {
        swap(arr, i, largest);
        heapify(arr, n, largest);
    }
}


```

> ⚙️ 注意：heapify 是递归的。  
>  它会让当前节点「下沉」到正确位置，直到子树满足大顶堆。

---

### 七、完整堆排序代码

```
public class HeapSort {
    public static void heapSort(int[] arr) {
        int n = arr.length;

        // 1️⃣ 构建初始大顶堆
        for (int i = n / 2 - 1; i >= 0; i--) {
            heapify(arr, n, i);
        }

        // 2️⃣ 依次取出堆顶（最大值），放到数组末尾
        for (int i = n - 1; i > 0; i--) {
            swap(arr, 0, i);        // 最大值移到末尾
            heapify(arr, i, 0);     // 重新堆化剩余部分
        }
    }

    private static void heapify(int[] arr, int n, int i) {
        int largest = i;
        int left = 2 * i + 1;
        int right = 2 * i + 2;

        if (left < n && arr[left] > arr[largest])
            largest = left;

        if (right < n && arr[right] > arr[largest])
            largest = right;

        if (largest != i) {
            swap(arr, i, largest);
            heapify(arr, n, largest);
        }
    }

    private static void swap(int[] arr, int i, int j) {
        int temp = arr[i];
        arr[i] = arr[j];
        arr[j] = temp;
    }

    // 测试
    public static void main(String[] args) {
        int[] arr = {4, 6, 8, 5, 9};
        heapSort(arr);
        System.out.println(Arrays.toString(arr)); // [4, 5, 6, 8, 9]
    }
}


```

---

### 八、为什么要“依次取出堆顶并重建堆”？

因为堆顶元素是整个堆中最大的。

1. 把堆顶和末尾元素交换 → 最大元素放到数组末尾；
2. 缩小堆的范围（排除最后一个最大值）；
3. 重建堆（保持剩下的部分仍然是大顶堆）。

> 如此反复，每次都确定一个新的“最大值”，放到正确位置，最终数组有序。

---

### 九、时间复杂度分析

| 阶段 | 操作 | 复杂度 |
| --- | --- | --- |
| 建堆 | 从底向上 heapify | O(n) |
| 排序 | 取堆顶 + 重建堆 n 次 | O(n log n) |
| 总体 |  | **O(n log n)** |

空间复杂度：O(1)，属于原地排序。

---

### 十、完整流程图

```
输入数组 → [4,6,8,5,9]
↓
建堆
↓
[9,6,8,5,4]
↓
交换堆顶与末尾 → [4,6,8,5,9]
↓
重建堆 → [8,6,4,5,9]
↓
重复…
↓
最终有序：[4,5,6,8,9]


```

---

### 十一、总结

| 步骤 | 说明 | 核心 |
| --- | --- | --- |
| 1 | 从 `n/2 - 1` 开始建堆 | 因为这是最后一个非叶子节点 |
| 2 | 从下往上建堆 | 确保子树先堆化 |
| 3 | 每次交换堆顶和末尾 | 把当前最大元素放对位置 |
| 4 | 重建堆 | 保证剩余部分仍是大顶堆 |
| 5 | 重复 n 次 | 数组排序完成 |
