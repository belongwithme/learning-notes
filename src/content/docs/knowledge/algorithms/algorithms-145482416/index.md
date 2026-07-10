---
title: "图论- DFS/BFS遍历"
description: "这里主要是看我们需要用一个visited数组来记录遍历过的节点,因为图可能会有环的情况."
sourceId: "145482416"
source: "https://blog.csdn.net/qq_45852626/article/details/145482416"
sourceSeries: []
category: algorithms
tags:
  - "算法"
status: draft
difficulty: intermediate
contentType: knowledge
sidebar:
  order: 145482416
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/145482416)（历史文章导入，当前状态为草稿）

### 深度优先搜素(DFS)

#### Vertex模版 - 遍历所有节点

```
// 多叉树节点
class Node {
    int val;
    List<Node> children;
}

// 多叉树的遍历框架
void traverse(Node root) {
    // base case
    if (root == null) {
        return;
    }
    // 前序位置
    System.out.println("visit " + root.val);
    for (Node child : root.children) {
        traverse(child);
    }
    // 后序位置
}


// 图节点
class Vertex {
    int id;
    Vertex[] neighbors;
}

// 图的遍历框架
// 需要一个 visited 数组记录被遍历过的节点
// 避免走回头路陷入死循环
void traverse(Vertex s, boolean[] visited) {
    // base case
    if (s == null) {
        return;
    }
    if (visited[s.id]) {
        // 防止死循环
        return;
    }
    // 前序位置
    visited[s.id] = true;
    System.out.println("visit " + s.id);
    for (Vertex neighbor : s.neighbors) {
        traverse(neighbor, visited);
    }
    // 后序位置
}


```

**这里主要是看我们需要用一个visited数组来记录遍历过的节点,因为图可能会有环的情况.**

#### 为什么成环会导致死循环呢

举个最简单的成环场景，有一条 1 -> 2 的边，同时有一条 2 -> 1 的边，节点 1, 2 就形成了一个环：

```
1 <=> 2


```

如果我们不标记遍历过的节点，那么从 1 开始遍历，会走到 2，再走到 1，再走到 2，再走到 1，如此 1->2->1->2->… 无限递归循环下去。  
 如果有了 visited 数组，第一次遍历到 1 时，会标记 1 为已访问，出现 1->2->1 这种情况时，发现 1 已经被访问过，就会直接返回，从而终止递归，避免了死循环。

#### 临接矩阵和临接表版 - 遍历所有节点

虽然邻接表/邻接矩阵的底层存储方式不同，但提供了统一的 API,基础模版用我们上一章说的就可以.  
 至于这个遍历方法如下:

```
// 遍历图的所有节点
void traverse(Graph graph, int s, boolean[] visited) {
    // base case
    if (s < 0 || s >= graph.size()) {
        return;
    }
    if (visited[s]) {
        // 防止死循环
        return;
    }
    // 前序位置
    visited[s] = true;
    System.out.println("visit " + s);
    for (Edge e : graph.neighbors(s)) {
        traverse(graph, e.to, visited);
    }
    // 后序位置
}


```

那么它的时间复杂度是多少呢?  
 因为visited有剪枝的作用,函数会遍历一次图中所有的节点,并尝试遍历一次所有边,所以算法时间复杂度是O(E+V)  
 E是边的总数,V是节点的总数.

#### 遍历所有路径 - 临接矩阵和临接表版

对于树而言,遍历路径和遍历节点是没什么区别的,但是对于图而言,是不同的  
 对于树而言,只能是父节点指向子节点,所以从根root出发,到任意一个节点targetNode的路径都是唯一的.  
 换句话说,我遍历一遍树结构的所有节点,一定能找到root到targetNode 的唯一路径.

```
// 多叉树的遍历框架，寻找从根节点到目标节点的路径
List<Node> path = new LinkedList<>();
void traverse(Node root, Node targetNode) {
    // base case
    if (root == null) {
        return;
    }
    // 前序位置
    path.addLast(root);
    if (root.val == targetNode.val) {
        System.out.println("find path: " + path);
    }
    for (Node child : root.children) {
        traverse(child, targetNode);
    }
    // 后序位置
    path.removeLast();
}


```

但对于图而言,起点到目标节点的路径不止一条.  
 所以我们需要一个onPath数组,在进入节点的时候标记为正在访问,退出的时候撤销标记,这样才能遍历图中的所有路径,从而找到src到dest的所有路径.

**所以你看,图还是有点麻烦的,我们一般用visited处理节点,onPath处理路径.**

那么有没有情况会同时使用visited和onPath呢?  
 比方说判定成环的场景，在遍历所有路径的过程中，如果发现一个节点 s 被标记为 visited，那么说明从 s 这个起点出发的所有路径在之前都已经遍历过了。如果之前遍历的时候都没有找到环，我现在再去遍历一次，肯定也不会找到环，所以这里可以直接剪枝，不再继续遍历节点 s。

**visited 和 onPath 主要的作用就是处理成环的情况，避免死循环。**

### 广度优先搜索(BFS)

和多叉树层序遍历差不多,就是多加了visited避免重复遍历节点.  
 理论上 BFS 遍历也需要区分遍历所有「节点」和遍历所有「路径」，但是实际上 BFS 算法一般只用来寻找那条最短路径，不会用来求所有路径。  
 **那么如果只求最短路径的话，只需要遍历「节点」就可以了，因为按照 BFS 算法一层一层向四周扩散的逻辑，第一次遇到目标节点，必然就是最短路径。**  
 图结构的 BFS 算法框架也有三种不同的写法，下面我会对比着多叉树的层序遍历写一下图结构的三种 BFS 算法框架。

#### 不记录遍历步数的

```
// 多叉树的层序遍历
void levelOrderTraverse(Node root) {
    if (root == null) {
        return;
    }
    Queue<Node> q = new LinkedList<>();
    q.offer(root);
    while (!q.isEmpty()) {
        Node cur = q.poll();
        // 访问 cur 节点
        System.out.println(cur.val);

        // 把 cur 的所有子节点加入队列
        for (Node child : cur.children) {
            q.offer(child);
        }
    }
}

// 图结构的 BFS 遍历，从节点 s 开始进行 BFS
void bfs(Graph graph, int s) {
    boolean[] visited = new boolean[graph.size()];
    Queue<Integer> q = new LinkedList<>();
    q.offer(s);
    visited[s] = true;

    while (!q.isEmpty()) {
        int cur = q.poll();
        System.out.println("visit " + cur);
        for (Edge e : graph.neighbors(cur)) {
            if (!visited[e.to]) {
                q.offer(e.to);
                visited[e.to] = true;
            }
        }
    }
}


```

#### 需要记录遍历步数的

```
// 多叉树的层序遍历
void levelOrderTraverse(Node root) {
    if (root == null) {
        return;
    }
    Queue<Node> q = new LinkedList<>();
    q.offer(root);
    // 记录当前遍历到的层数（根节点视为第 1 层）
    int depth = 1;

    while (!q.isEmpty()) {
        int sz = q.size();
        for (int i = 0; i < sz; i++) {
            Node cur = q.poll();
            // 访问 cur 节点，同时知道它所在的层数
            System.out.println("depth = " + depth + ", val = " + cur.val);

            for (Node child : cur.children) {
                q.offer(child);
            }
        }
        depth++;
    }
}

// 从 s 开始 BFS 遍历图的所有节点，且记录遍历的步数
void bfs(Graph graph, int s) {
    boolean[] visited = new boolean[graph.size()];
    Queue<Integer> q = new LinkedList<>();
    q.offer(s);
    visited[s] = true;
    // 记录从 s 开始走到当前节点的步数
    int step = 0;
    while (!q.isEmpty()) {
        int sz = q.size();
        for (int i = 0; i < sz; i++) {
            int cur = q.poll();
            System.out.println("visit " + cur + " at step " + step);
            for (Edge e : graph.neighbors(cur)) {
                if (!visited[e.to]) {
                    q.offer(e.to);
                    visited[e.to] = true;
                }
            }
        }
        step++;
    }
}


```

#### 需要适配不同权重边的

```
// 多叉树的层序遍历
// 每个节点自行维护 State 类，记录深度等信息
class State {
    Node node;
    int depth;

    public State(Node node, int depth) {
        this.node = node;
        this.depth = depth;
    }
}

void levelOrderTraverse(Node root) {
    if (root == null) {
        return;
    }
    Queue<State> q = new LinkedList<>();
    // 记录当前遍历到的层数（根节点视为第 1 层）
    q.offer(new State(root, 1));

    while (!q.isEmpty()) {
        State state = q.poll();
        Node cur = state.node;
        int depth = state.depth;
        // 访问 cur 节点，同时知道它所在的层数
        System.out.println("depth = " + depth + ", val = " + cur.val);

        for (Node child : cur.children) {
            q.offer(new State(child, depth + 1));
        }
    }
}


// 图结构的 BFS 遍历，从节点 s 开始进行 BFS，且记录路径的权重和
// 每个节点自行维护 State 类，记录从 s 走来的权重和
class State {
    // 当前节点 ID
    int node;
    // 从起点 s 到当前节点的权重和
    int weight;

    public State(int node, int weight) {
        this.node = node;
        this.weight = weight;
    }
}


void bfs(Graph graph, int s) {
    boolean[] visited = new boolean[graph.size()];
    Queue<State> q = new LinkedList<>();

    q.offer(new State(s, 0));
    visited[s] = true;

    while (!q.isEmpty()) {
        State state = q.poll();
        int cur = state.node;
        int weight = state.weight;
        System.out.println("visit " + cur + " with path weight " + weight);
        for (Edge e : graph.neighbors(cur)) {
            if (!visited[e.to]) {
                q.offer(new State(e.to, weight + e.weight));
                visited[e.to] = true;
            }
        }
    }
}


```
