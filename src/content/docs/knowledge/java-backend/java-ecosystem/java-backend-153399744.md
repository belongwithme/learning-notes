---
title: "Enumeration 接口详解"
description: "Enumeration 是 Java 中最早的迭代器接口（JDK 1.0 引入），用于逐个遍历集合中的元素。"
sourceId: "153399744"
source: "https://blog.csdn.net/qq_45852626/article/details/153399744"
sourceSeries:
  - "Java源码"
category: java-backend
subcategory: java-ecosystem
tags:
  - "Java源码"
status: draft
difficulty: intermediate
contentType: knowledge
sidebar:
  order: 153399744
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/153399744)（历史文章导入，当前状态为草稿）

### 一、核心定义

```
package java.util;

public interface Enumeration<E> {
    boolean hasMoreElements();
    E nextElement();
}


```

---

### 二、接口作用

`Enumeration` 是 Java 中**最早的迭代器接口**（JDK 1.0 引入），用于**逐个遍历集合中的元素**。

**核心功能**：

* 提供一种统一的方式来遍历集合元素
* 只能向前遍历，不能后退
* 只读访问，不支持删除操作

---

### 三、核心方法详解

#### 1. hasMoreElements()

```
boolean hasMoreElements();


```

**作用**：检查枚举中是否还有更多元素

**返回值**：

* `true` - 至少还有一个元素可供访问
* `false` - 没有更多元素了

#### 2. nextElement()

```
E nextElement();


```

**作用**：返回枚举中的下一个元素

**返回值**：枚举中的下一个元素

**异常**：

* `NoSuchElementException` - 如果没有更多元素时调用

---

### 四、使用示例

#### 基础使用

```
// 创建一个 Vector (支持 Enumeration 的经典集合)
Vector<String> vector = new Vector<>();
vector.add("Apple");
vector.add("Banana");
vector.add("Cherry");

// 获取枚举
Enumeration<String> enumeration = vector.elements();

// 遍历元素
while (enumeration.hasMoreElements()) {
    String element = enumeration.nextElement();
    System.out.println(element);
}


```

**输出**：

```
Apple
Banana
Cherry


```

#### 与 ServiceLoader 的关联

在 `ServiceLoader` 中也用到了 `Enumeration`：

```
// ServiceLoader.java 中的 LazyIterator
private class LazyIterator implements Iterator<S> {
    Enumeration<URL> configs = null;  // 配置文件的 URL 枚举

    private boolean hasNextService() {
        if (configs == null) {
            String fullName = PREFIX + service.getName();
            // 获取所有 META-INF/services/xxx 配置文件的 URL
            configs = loader.getResources(fullName);  // 返回 Enumeration<URL>
        }

        while ((pending == null) || !pending.hasNext()) {
            if (!configs.hasMoreElements()) {  // ← 使用 hasMoreElements()
                return false;
            }
            pending = parse(service, configs.nextElement());  // ← 使用 nextElement()
        }
        return true;
    }
}


```

---

### 五、Enumeration vs Iterator

#### 对比表

| 特性 | Enumeration | Iterator |
| --- | --- | --- |
| **引入版本** | JDK 1.0 | JDK 1.2 |
| **方法名称** | `hasMoreElements()` `nextElement()` | `hasNext()` `next()` |
| **删除支持** | ❌ 不支持 | ✅ 支持 `remove()` |
| **命名风格** | 较长 | 较短 |
| **使用场景** | 遗留代码、特定 API | 现代集合框架 |
| **fail-fast** | ❌ 不支持 | ✅ 支持 |

#### 代码对比

```
// 使用 Enumeration (老式)
Enumeration<String> enumeration = vector.elements();
while (enumeration.hasMoreElements()) {
    String s = enumeration.nextElement();
    System.out.println(s);
}

// 使用 Iterator (现代)
Iterator<String> iterator = list.iterator();
while (iterator.hasNext()) {
    String s = iterator.next();
    System.out.println(s);
    // iterator.remove();  // 可以删除元素
}


```

---

### 六、哪些类使用 Enumeration？

#### 遗留集合类

```
// 1. Vector
Vector<String> vector = new Vector<>();
Enumeration<String> e1 = vector.elements();

// 2. Stack (继承自 Vector)
Stack<Integer> stack = new Stack<>();
Enumeration<Integer> e2 = stack.elements();

// 3. Hashtable
Hashtable<String, Integer> table = new Hashtable<>();
Enumeration<String> keys = table.keys();      // 键的枚举
Enumeration<Integer> values = table.elements(); // 值的枚举

// 4. Properties (继承自 Hashtable)
Properties props = System.getProperties();
Enumeration<Object> propNames = props.propertyNames();


```

#### ClassLoader 中的使用

```
// 获取所有匹配的资源 URL
ClassLoader cl = ClassLoader.getSystemClassLoader();
Enumeration<URL> resources = cl.getResources("META-INF/services/com.example.MyService");

while (resources.hasMoreElements()) {
    URL url = resources.nextElement();
    System.out.println("Found config: " + url);
}


```

---

### 七、实现自定义 Enumeration

```
public class CustomEnumeration<E> implements Enumeration<E> {
    private E[] elements;
    private int index = 0;

    public CustomEnumeration(E[] elements) {
        this.elements = elements;
    }

    @Override
    public boolean hasMoreElements() {
        return index < elements.length;
    }

    @Override
    public E nextElement() {
        if (!hasMoreElements()) {
            throw new NoSuchElementException();
        }
        return elements[index++];
    }
}

// 使用
String[] fruits = {"Apple", "Banana", "Cherry"};
Enumeration<String> enumeration = new CustomEnumeration<>(fruits);

while (enumeration.hasMoreElements()) {
    System.out.println(enumeration.nextElement());
}


```

---

### 八、Enumeration 转换为现代集合

#### 转换为 List

```
// 方法 1: 使用 Collections.list()
Vector<String> vector = new Vector<>(Arrays.asList("A", "B", "C"));
Enumeration<String> enumeration = vector.elements();
List<String> list = Collections.list(enumeration);

// 方法 2: 手动转换
List<String> list2 = new ArrayList<>();
while (enumeration.hasMoreElements()) {
    list2.add(enumeration.nextElement());
}

// 方法 3: Java 9+ Stream API
Enumeration<String> enum3 = vector.elements();
List<String> list3 = Collections.list(enum3).stream()
    .collect(Collectors.toList());


```

---

### 九、为什么还在使用 Enumeration？

虽然 `Iterator` 更现代化，但 `Enumeration` 仍在使用，原因包括：

#### 1. 向后兼容性

```
// 许多遗留 API 仍返回 Enumeration
ClassLoader.getResources(String name)  // 返回 Enumeration<URL>
NetworkInterface.getNetworkInterfaces() // 返回 Enumeration<NetworkInterface>


```

#### 2. 性能考虑

```
// Enumeration 更轻量，只有两个方法
// Iterator 有三个方法（hasNext, next, remove），略重


```

#### 3. 明确的只读语义

```
// Enumeration 不支持删除，表明这是只读遍历
// 防止误用，更安全


```

---

### 十、常见陷阱

#### 陷阱 1: 重复调用 nextElement()

```
// ❌ 错误：没有检查就调用
Enumeration<String> e = vector.elements();
e.nextElement();
e.nextElement();
e.nextElement();
e.nextElement();  // 可能抛出 NoSuchElementException!

// ✅ 正确：始终先检查
while (e.hasMoreElements()) {
    String element = e.nextElement();
}


```

#### 陷阱 2: 并发修改

```
// ❌ 错误：遍历时修改
Vector<String> vector = new Vector<>(Arrays.asList("A", "B", "C"));
Enumeration<String> e = vector.elements();
while (e.hasMoreElements()) {
    String s = e.nextElement();
    vector.remove(s);  // 可能导致不可预期的行为
}

// ✅ 正确：使用 Iterator 或单独收集要删除的元素
Iterator<String> it = vector.iterator();
while (it.hasNext()) {
    it.next();
    it.remove();  // Iterator 支持安全删除
}


```

#### 陷阱 3: Enumeration 不能重置

```
// ❌ 错误：Enumeration 无法重置
Enumeration<String> e = vector.elements();
while (e.hasMoreElements()) {
    System.out.println(e.nextElement());
}
// 无法再次遍历！

// ✅ 正确：需要重新获取
Enumeration<String> e2 = vector.elements();
while (e2.hasMoreElements()) {
    System.out.println(e2.nextElement());
}


```

---

### 十一、实际应用场景

#### 场景 1: 读取资源文件

```
// 在 ServiceLoader 中查找所有服务配置文件
ClassLoader loader = Thread.currentThread().getContextClassLoader();
String resourceName = "META-INF/services/" + MyService.class.getName();
Enumeration<URL> configs = loader.getResources(resourceName);

while (configs.hasMoreElements()) {
    URL configUrl = configs.nextElement();
    // 解析每个配置文件
    parseConfigFile(configUrl);
}


```

#### 场景 2: 遍历网络接口

```
import java.net.NetworkInterface;

Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
while (interfaces.hasMoreElements()) {
    NetworkInterface ni = interfaces.nextElement();
    System.out.println("Interface: " + ni.getName());

    Enumeration<InetAddress> addresses = ni.getInetAddresses();
    while (addresses.hasMoreElements()) {
        InetAddress addr = addresses.nextElement();
        System.out.println("  Address: " + addr.getHostAddress());
    }
}


```

#### 场景 3: 读取系统属性

```
Properties props = System.getProperties();
Enumeration<?> propNames = props.propertyNames();

while (propNames.hasMoreElements()) {
    String key = (String) propNames.nextElement();
    String value = props.getProperty(key);
    System.out.println(key + " = " + value);
}


```

---

### 十二、在 ServiceLoader 中的作用

#### ClassLoader.getResources() 返回 Enumeration

```
// ClassLoader.java
public Enumeration<URL> getResources(String name) throws IOException {
    // 返回所有匹配资源的 URL 枚举
}


```

#### ServiceLoader 如何使用

```
// ServiceLoader.java 的 LazyIterator
private boolean hasNextService() {
    if (configs == null) {
        // 获取所有配置文件的 URL
        String fullName = PREFIX + service.getName();
        configs = loader.getResources(fullName);  // Enumeration<URL>
    }

    // 遍历所有配置文件
    while ((pending == null) || !pending.hasNext()) {
        if (!configs.hasMoreElements()) {
            return false;
        }
        // 解析下一个配置文件
        URL configUrl = configs.nextElement();
        pending = parse(service, configUrl);
    }

    return true;
}


```

**为什么这里用 Enumeration 而不是 Iterator？**

1. **历史原因** - `ClassLoader.getResources()` 是 JDK 1.2 添加的方法，当时 `Iterator` 刚引入，为了与 JDK 1.0 的 API 保持一致，使用了 `Enumeration`
2. **只读语义** - 资源 URL 列表是只读的，不需要删除操作
3. **向后兼容** - 修改返回类型会破坏现有代码

---

### 十三、Enumeration 的设计思想

#### 迭代器模式

```
public interface Enumeration<E> {
    // 查询操作
    boolean hasMoreElements();

    // 访问操作
    E nextElement();

    // 注意：没有 remove() 方法
    // 这是有意设计的，表明 Enumeration 是只读的
}


```

#### 与现代设计的对比

```
// Enumeration (JDK 1.0)
public interface Enumeration<E> {
    boolean hasMoreElements();
    E nextElement();
}

// Iterator (JDK 1.2)
public interface Iterator<E> {
    boolean hasNext();        // 更短的方法名
    E next();                 // 更短的方法名
    void remove();            // 支持删除
}

// Iterable (JDK 1.5)
public interface Iterable<E> {
    Iterator<E> iterator();   // 支持 for-each 循环
}


```

---

### 十四、总结

#### Enumeration 的特点

✅ **优点**：

* 简单轻量，只有两个方法
* 明确的只读语义
* 与遗留代码兼容

❌ **缺点**：

* 方法名较长（`hasMoreElements` vs `hasNext`）
* 不支持删除操作
* 不是 fail-fast 的
* 已被 `Iterator` 取代

#### 使用建议

1. **新代码** - 优先使用 `Iterator` 或增强 for 循环
2. **遗留代码** - 理解 `Enumeration` 的使用
3. **特定 API** - 某些 API 仍返回 `Enumeration`（如 `ClassLoader.getResources()`）
4. **只读遍历** - 如果需要明确的只读语义，`Enumeration` 是合适的选择

#### 关键点

* **Enumeration 是 Java 1.0 时代的迭代器**
* **主要用于 Vector、Hashtable 等遗留集合**
* **在 ClassLoader、NetworkInterface 等系统 API 中仍在使用**
* **理解它有助于阅读 Java 核心源码（如 ServiceLoader）**

#### 在 SPI 中的角色

```
ServiceLoader.load()
  └─> LazyIterator.hasNextService()
       └─> loader.getResources("META-INF/services/xxx")
            └─> 返回 Enumeration<URL>
                 ├─> jar:file:/path/to/provider1.jar!/META-INF/services/xxx
                 ├─> jar:file:/path/to/provider2.jar!/META-INF/services/xxx
                 └─> ...


```

`Enumeration` 在 SPI 机制中扮演着**传递配置文件 URL 列表**的角色，虽然是老接口，但在 Java 核心库中仍然发挥着重要作用。

---

### 附录：完整示例

#### 示例 1: 基础遍历

```
Vector<String> vector = new Vector<>();
vector.add("Java");
vector.add("Python");
vector.add("JavaScript");

Enumeration<String> e = vector.elements();
while (e.hasMoreElements()) {
    System.out.println(e.nextElement());
}


```

#### 示例 2: 遍历 Hashtable

```
Hashtable<String, Integer> table = new Hashtable<>();
table.put("Alice", 25);
table.put("Bob", 30);
table.put("Charlie", 35);

// 遍历键
Enumeration<String> keys = table.keys();
while (keys.hasMoreElements()) {
    String key = keys.nextElement();
    System.out.println(key + ": " + table.get(key));
}

// 遍历值
Enumeration<Integer> values = table.elements();
while (values.hasMoreElements()) {
    System.out.println(values.nextElement());
}


```

#### 示例 3: 在 ServiceLoader 场景中

```
ClassLoader loader = Thread.currentThread().getContextClassLoader();
Enumeration<URL> configs = loader.getResources("META-INF/services/com.example.MyService");

List<String> providers = new ArrayList<>();
while (configs.hasMoreElements()) {
    URL url = configs.nextElement();
    try (BufferedReader reader = new BufferedReader(
            new InputStreamReader(url.openStream(), "UTF-8"))) {
        String line;
        while ((line = reader.readLine()) != null) {
            line = line.trim();
            if (!line.isEmpty() && !line.startsWith("#")) {
                providers.add(line);
            }
        }
    }
}

System.out.println("Found providers: " + providers);


```

这个接口虽然古老，但理解 Java 类加载机制和遗留代码时仍然非常重要！
