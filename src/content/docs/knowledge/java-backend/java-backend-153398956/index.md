---
title: "Java SPI 完整加载流程详解-JAR 包到类实例化"
description: "SPI还是Spring SPI或者xxx SPI都有很大的帮助,最近想深究了一下,看了看源码的部分,觉得挺有帮助."
sourceId: "153398956"
source: "https://blog.csdn.net/qq_45852626/article/details/153398956"
sourceSeries:
  - "Java源码"
category: java-backend
tags:
  - "Java源码"
  - "Java"
status: draft
difficulty: intermediate
contentType: knowledge
sidebar:
  order: 153398956
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/153398956)（历史文章导入，当前状态为草稿）

## 前言

如果可以理解SPI,无论是学习
Java 
 SPI还是Spring SPI或者xxx SPI都有很大的帮助,最近想深究了一下,看了看源码的部分,觉得挺有帮助.  
 项目就整了一个很简单了,能跑就行,代码什么的不用纠结,用AI随便生成一个就能跑.  
 本篇文章不太适合纯新手阅读,最好有读源码的经验,不然可能会比较懵.

### 一、项目结构示例

#### 假设我们有这样的项目结构：

```
my-app/
├── app.jar (应用程序)
│   └── com/example/App.class
│
├── service-api.jar (服务接口)
│   └── com/example/spi/MyService.class
│
├── provider1.jar (服务提供者1)
│   ├── META-INF/services/
│   │   └── com.example.spi.MyService
│   │       内容: com.example.spi.impl.Provider1
│   └── com/example/spi/impl/Provider1.class
│
└── provider2.jar (服务提供者2)
    ├── META-INF/services/
    │   └── com.example.spi.MyService
    │       内容: com.example.spi.impl.Provider2
    └── com/example/spi/impl/Provider2.class


```

#### 代码示例

##### 1. 服务接口 (service-api.jar)

```
package com.example.spi;

public interface MyService {
    void execute();
}


```

##### 2. 服务提供者1 (provider1.jar)

```
package com.example.spi.impl;

public class Provider1 implements MyService {
    public Provider1() { }  // 必须有无参构造器

    @Override
    public void execute() {
        System.out.println("Provider1 执行");
    }
}


```

配置文件 `provider1.jar/META-INF/services/com.example.spi.MyService`:

```
com.example.spi.impl.Provider1


```

##### 3. 服务提供者2 (provider2.jar)

```
package com.example.spi.impl;

public class Provider2 implements MyService {
    public Provider2() { }

    @Override
    public void execute() {
        System.out.println("Provider2 执行");
    }
}


```

配置文件 `provider2.jar/META-INF/services/com.example.spi.MyService`:

```
com.example.spi.impl.Provider2


```

##### 4. 应用程序 (app.jar)

```
package com.example;

import com.example.spi.MyService;
import java.util.ServiceLoader;

public class App {
    public static void main(String[] args) {
        // 使用 SPI 加载所有服务提供者
        ServiceLoader<MyService> loader = ServiceLoader.load(MyService.class);

        for (MyService service : loader) {
            service.execute();
        }
    }
}


```

---

### 二、完整的加载流程（源码级别）

#### 第1步：调用 ServiceLoader.load()

```
// 应用程序代码
ServiceLoader<MyService> loader = ServiceLoader.load(MyService.class);


```

**内部执行**：

```
// ServiceLoader.java:211-214
public static <S> ServiceLoader<S> load(Class<S> service) {
    // 获取线程上下文类加载器（通常是 AppClassLoader）
    ClassLoader cl = Thread.currentThread().getContextClassLoader();
    return ServiceLoader.load(service, cl);
}

// ServiceLoader.java:203-207
public static <S> ServiceLoader<S> load(Class<S> service, ClassLoader loader) {
    return new ServiceLoader<>(service, loader);
}


```

#### 第2步：ServiceLoader 构造方法

```
// ServiceLoader.java:122-180
private ServiceLoader(Class<S> svc, ClassLoader cl) {
    service = Objects.requireNonNull(svc, "Service interface cannot be null");
    // service = MyService.class

    loader = (cl == null) ? ClassLoader.getSystemClassLoader() : cl;
    // loader = AppClassLoader (负责加载 classpath 上的所有 JAR 包)

    acc = (System.getSecurityManager() != null) ? AccessController.getContext() : null;

    reload();  // 初始化延迟加载迭代器
}

public void reload() {
    providers.clear();
    lookupIterator = new LazyIterator(service, loader);
    // 创建延迟迭代器，但此时还没有查找配置文件
}


```

**此时的状态**：

* `service` = `MyService.class`
* `loader` = `AppClassLoader`
* `providers` = 空的 LinkedHashMap
* `lookupIterator` = 新创建的 LazyIterator

---

#### 第3步：开始遍历（触发延迟加载）

```
// 应用程序代码
for (MyService service : loader) {
    service.execute();
}


```

这会调用：

```
// ServiceLoader.java:177-200 (iterator方法)
public Iterator<S> iterator() {
    return new Iterator<S>() {
        Iterator<Map.Entry<String,S>> knownProviders = providers.entrySet().iterator();

        public boolean hasNext() {
            if (knownProviders.hasNext())  // 检查缓存
                return true;
            return lookupIterator.hasNext();  // ← 触发延迟加载
        }

        public S next() {
            if (knownProviders.hasNext())
                return knownProviders.next().getValue();
            return lookupIterator.next();  // ← 触发延迟加载
        }
    };
}


```

---

#### 第4步：LazyIterator.hasNext() - 查找配置文件

**这是关键！** 这里是从 JAR 包中查找配置文件的地方：

```
// ServiceLoader.java:271-294 (LazyIterator.hasNextService)
private boolean hasNextService() {
    if (nextName != null) {
        return true;
    }

    // ========== 关键点1: 查找配置文件 ==========
    if (configs == null) {
        try {
            // 构造配置文件的完整路径
            String fullName = PREFIX + service.getName();
            // fullName = "META-INF/services/com.example.spi.MyService"

            if (loader == null)
                configs = ClassLoader.getSystemResources(fullName);
            else
                // ★★★ 关键调用：从所有 JAR 包中查找配置文件 ★★★
                configs = loader.getResources(fullName);
                // 返回 Enumeration<URL>，包含所有匹配的配置文件 URL
        } catch (IOException x) {
            fail(service, "Error locating configuration files", x);
        }
    }

    // ========== 关键点2: 解析配置文件 ==========
    while ((pending == null) || !pending.hasNext()) {
        if (!configs.hasMoreElements()) {
            return false;  // 没有更多配置文件了
        }

        // 获取下一个配置文件的 URL
        URL configUrl = configs.nextElement();
        // configUrl 示例:
        // jar:file:/path/to/provider1.jar!/META-INF/services/com.example.spi.MyService
        // jar:file:/path/to/provider2.jar!/META-INF/services/com.example.spi.MyService

        // ★★★ 解析配置文件，读取类名 ★★★
        pending = parse(service, configUrl);
        // pending 是包含类全限定名的迭代器
    }

    nextName = pending.next();
    // nextName = "com.example.spi.impl.Provider1" (第一次)
    // nextName = "com.example.spi.impl.Provider2" (第二次)

    return true;
}


```

---

#### 第5步：ClassLoader.getResources() - 扫描 JAR 包

**这是你问题的核心答案！**

```
// 调用链
configs = loader.getResources("META-INF/services/com.example.spi.MyService");


```

##### ClassLoader.getResources() 的工作原理：

```
// ClassLoader.java:1017-1028
public Enumeration<URL> getResources(String name) throws IOException {
    @SuppressWarnings("unchecked")
    Enumeration<URL>[] tmp = (Enumeration<URL>[]) new Enumeration<?>[2];

    // 1. 先查找父类加载器的资源
    if (parent != null) {
        tmp[0] = parent.getResources(name);
    } else {
        tmp[0] = getBootstrapResources(name);
    }

    // 2. 再查找当前类加载器的资源
    tmp[1] = findResources(name);

    // 3. 合并所有结果
    return new CompoundEnumeration<>(tmp);
}


```

##### AppClassLoader 如何查找资源：

AppClassLoader 继承自 URLClassLoader，它的 `findResources()` 方法会：

1. **遍历 classpath 上的所有路径**（包括所有 JAR 包）
2. **检查每个 JAR 包中是否存在指定路径的文件**
3. **返回所有匹配文件的 URL**

**伪代码说明**：

```
// URLClassLoader 的内部逻辑（简化版）
protected Enumeration<URL> findResources(String name) {
    List<URL> results = new ArrayList<>();

    // classpath 包含所有的 JAR 包路径
    for (URL jarUrl : classpath) {
        // 打开 JAR 文件
        JarFile jarFile = new JarFile(jarUrl);

        // 查找指定的条目
        JarEntry entry = jarFile.getEntry(name);
        // name = "META-INF/services/com.example.spi.MyService"

        if (entry != null) {
            // 构造完整的 URL
            URL resourceUrl = new URL("jar:" + jarUrl + "!/" + name);
            // 示例: jar:file:/path/to/provider1.jar!/META-INF/services/com.example.spi.MyService
            results.add(resourceUrl);
        }
    }

    return Collections.enumeration(results);
}


```

**实际返回的 Enumeration**：

```
URL 1: jar:file:/path/to/provider1.jar!/META-INF/services/com.example.spi.MyService
URL 2: jar:file:/path/to/provider2.jar!/META-INF/services/com.example.spi.MyService


```

---

#### 第6步：parse() - 读取配置文件内容

```
// ServiceLoader.java:231-253
private Iterator<String> parse(Class<?> service, URL u) {
    InputStream in = null;
    BufferedReader r = null;
    ArrayList<String> names = new ArrayList<>();

    try {
        // ★★★ 关键：打开 URL 流，读取配置文件内容 ★★★
        in = u.openStream();
        // 这会从 JAR 包中提取文件内容

        r = new BufferedReader(new InputStreamReader(in, "utf-8"));
        int lc = 1;

        // 逐行解析
        while ((lc = parseLine(service, u, r, lc, names)) >= 0);
        // names 现在包含: ["com.example.spi.impl.Provider1"]

    } catch (IOException x) {
        fail(service, "Error reading configuration file", x);
    } finally {
        // 关闭流
        if (r != null) r.close();
        if (in != null) in.close();
    }

    return names.iterator();
}


```

##### URL.openStream() 如何从 JAR 包读取文件：

```
// 当 URL 是 jar:file:/path/to/provider1.jar!/META-INF/services/com.example.spi.MyService 时
InputStream in = url.openStream();

// 内部流程：
// 1. 解析 JAR URL
// 2. 打开 JAR 文件（ZIP 格式）
// 3. 定位到 "META-INF/services/com.example.spi.MyService" 条目
// 4. 解压该条目
// 5. 返回输入流


```

---

#### 第7步：parseLine() - 解析每一行

```
// ServiceLoader.java:202-229
private int parseLine(Class<?> service, URL u, BufferedReader r, int lc,
                      List<String> names) {
    String ln = r.readLine();
    if (ln == null) {
        return -1;  // 文件结束
    }

    // 处理注释
    int ci = ln.indexOf('#');
    if (ci >= 0) ln = ln.substring(0, ci);

    // 去除空白
    ln = ln.trim();
    // ln = "com.example.spi.impl.Provider1"

    int n = ln.length();
    if (n != 0) {
        // 验证格式（不能有空格或制表符）
        if ((ln.indexOf(' ') >= 0) || (ln.indexOf('\t') >= 0))
            fail(service, u, lc, "Illegal configuration-file syntax");

        // 验证类名格式
        int cp = ln.codePointAt(0);
        if (!Character.isJavaIdentifierStart(cp))
            fail(service, u, lc, "Illegal provider-class name: " + ln);

        for (int i = Character.charCount(cp); i < n; i += Character.charCount(cp)) {
            cp = ln.codePointAt(i);
            if (!Character.isJavaIdentifierPart(cp) && (cp != '.'))
                fail(service, u, lc, "Illegal provider-class name: " + ln);
        }

        // 添加到列表（避免重复）
        if (!providers.containsKey(ln) && !names.contains(ln))
            names.add(ln);
    }

    return lc + 1;
}


```

---

#### 第8步：LazyIterator.next() - 加载并实例化 类

```
// ServiceLoader.java:296-321 (LazyIterator.nextService)
private S nextService() {
    if (!hasNextService())
        throw new NoSuchElementException();

    String cn = nextName;
    // cn = "com.example.spi.impl.Provider1"
    nextName = null;

    Class<?> c = null;
    try {
        // ★★★ 关键点3: 使用 ClassLoader 加载类 ★★★
        c = Class.forName(cn, false, loader);
        // 参数说明:
        // - cn: 类的全限定名
        // - false: 不初始化类（不执行静态代码块）
        // - loader: AppClassLoader

        // Class.forName 会：
        // 1. 在 classpath 的所有 JAR 包中查找 com/example/spi/impl/Provider1.class
        // 2. 从 provider1.jar 中读取字节码
        // 3. 加载到 JVM

    } catch (ClassNotFoundException x) {
        fail(service, "Provider " + cn + " not found");
    }

    // ========== 关键点4: 类型检查 ==========
    if (!service.isAssignableFrom(c)) {
        fail(service, "Provider " + cn  + " not a subtype");
        // 确保 Provider1 implements MyService
    }

    try {
        // ★★★ 关键点5: 反射实例化 ★★★
        S p = service.cast(c.newInstance());
        // 等价于: MyService p = (MyService) new Provider1();

        // ========== 关键点6: 缓存实例 ==========
        providers.put(cn, p);
        // providers = {"com.example.spi.impl.Provider1" -> Provider1实例}

        return p;
    } catch (Throwable x) {
        fail(service, "Provider " + cn + " could not be instantiated", x);
    }

    throw new Error();  // 不会执行到这里
}


```

---

### 三、完整的调用链可视化

```
应用程序
  └─> ServiceLoader.load(MyService.class)
       └─> new ServiceLoader(MyService.class, AppClassLoader)
            └─> reload()
                 └─> new LazyIterator(MyService.class, AppClassLoader)

  └─> for (MyService s : loader)  ← 触发延迟加载
       └─> iterator().hasNext()
            └─> lookupIterator.hasNext()
                 └─> hasNextService()
                      │
                      ├─> loader.getResources("META-INF/services/com.example.spi.MyService")
                      │    │
                      │    ├─> URLClassLoader.findResources()
                      │    │    │
                      │    │    ├─> 扫描 provider1.jar
                      │    │    │    └─> 找到: jar:file:/.../provider1.jar!/META-INF/services/...
                      │    │    │
                      │    │    └─> 扫描 provider2.jar
                      │    │         └─> 找到: jar:file:/.../provider2.jar!/META-INF/services/...
                      │    │
                      │    └─> 返回 Enumeration<URL> (2个URL)
                      │
                      ├─> parse(configUrl1)
                      │    └─> url.openStream()  ← 从 JAR 包读取文件
                      │         └─> BufferedReader.readLine()
                      │              └─> "com.example.spi.impl.Provider1"
                      │
                      └─> pending.next()
                           └─> nextName = "com.example.spi.impl.Provider1"

       └─> iterator().next()
            └─> lookupIterator.next()
                 └─> nextService()
                      │
                      ├─> Class.forName("com.example.spi.impl.Provider1", false, AppClassLoader)
                      │    └─> 从 provider1.jar 加载 Provider1.class
                      │
                      ├─> service.isAssignableFrom(Provider1.class)  ← 类型检查
                      │
                      ├─> Provider1.class.newInstance()  ← 反射实例化
                      │    └─> new Provider1()
                      │
                      └─> providers.put("com.example.spi.impl.Provider1", instance)  ← 缓存
                           └─> 返回 instance


```

---

### 四、关键技术点详解

#### 1. ClassLoader.getResources() 如何扫描 JAR 包

```
// AppClassLoader 的 classpath 包含所有 JAR 包:
// classpath = [
//   file:/path/to/app.jar,
//   file:/path/to/service-api.jar,
//   file:/path/to/provider1.jar,
//   file:/path/to/provider2.jar
// ]

configs = loader.getResources("META-INF/services/com.example.spi.MyService");

// 内部流程:
// 1. 遍历 classpath
// 2. 对于每个 JAR 文件:
//    - 打开 JAR (ZIP 格式)
//    - 查找条目 "META-INF/services/com.example.spi.MyService"
//    - 如果找到，添加 URL: jar:file:/path/to/xxx.jar!/META-INF/services/...
// 3. 返回所有找到的 URL


```

#### 2. URL.openStream() 如何读取 JAR 包内的文件

```
URL url = new URL("jar:file:/path/to/provider1.jar!/META-INF/services/com.example.spi.MyService");
InputStream in = url.openStream();

// 内部流程:
// 1. 识别 URL 协议为 "jar"
// 2. 解析出 JAR 文件路径: /path/to/provider1.jar
// 3. 解析出条目路径: META-INF/services/com.example.spi.MyService
// 4. 使用 JarFile 打开 JAR 文件
// 5. 获取指定条目的输入流
// 6. 返回可以读取文件内容的 InputStream


```

#### 3. Class.forName() 如何从 JAR 包加载类

```
Class<?> c = Class.forName("com.example.spi.impl.Provider1", false, loader);

// 内部流程:
// 1. ClassLoader 查找类文件:
//    - 将类名转换为路径: com/example/spi/impl/Provider1.class
//    - 在 classpath 的所有 JAR 包中查找该路径
//    - 找到: provider1.jar!/com/example/spi/impl/Provider1.class
//
// 2. 读取字节码:
//    - 打开 JAR 文件
//    - 提取 Provider1.class 的字节码
//
// 3. 加载到 JVM:
//    - defineClass(字节码) → 创建 Class 对象
//    - 链接（验证、准备、解析）
//    - 返回 Class<?> 对象


```

---

### 五、实际执行流程示例

#### 启动命令

```
java -cp app.jar:service-api.jar:provider1.jar:provider2.jar com.example.App


```

#### 执行步骤

1. **JVM 启动，创建 AppClassLoader**

   * classpath = [app.jar, service-api.jar, provider1.jar, provider2.jar]
2. **加载并执行 App.main()**

   ```
   ServiceLoader<MyService> loader = ServiceLoader.load(MyService.class);


   ```

   * 创建 ServiceLoader 实例
   * service = MyService.class
   * loader = AppClassLoader
3. **开始遍历**

   ```
   for (MyService s : loader) {


   ```
4. **第一次迭代**

   * `hasNext()` → `hasNextService()`
   * `getResources("META-INF/services/com.example.spi.MyService")`

     + 返回 2 个 URL:
       - `jar:file:/.../provider1.jar!/META-INF/services/com.example.spi.MyService`
       - `jar:file:/.../provider2.jar!/META-INF/services/com.example.spi.MyService`
   * 打开第一个 URL，读取内容: `com.example.spi.impl.Provider1`
   * `Class.forName("com.example.spi.impl.Provider1")`

     + 从 provider1.jar 加载 Provider1.class
   * `new Provider1()` → 返回实例
   * 输出: “Provider1 执行”
5. **第二次迭代**

   * 读取第二个配置文件
   * 内容: `com.example.spi.impl.Provider2`
   * `Class.forName("com.example.spi.impl.Provider2")`
     + 从 provider2.jar 加载 Provider2.class
   * `new Provider2()` → 返回实例
   * 输出: “Provider2 执行”
6. **结束**

   * 没有更多配置文件
   * `hasNext()` 返回 false

---

### 六、总结：SPI 如何加载 JAR 包中的类

#### 核心机制

1. **配置发现**: `ClassLoader.getResources()`

   * 扫描 classpath 上所有 JAR 包
   * 查找 `META-INF/services/服务接口全限定名` 文件
   * 返回所有匹配文件的 URL 列表
2. **配置解析**: `URL.openStream()` + `BufferedReader`

   * 打开 JAR 包内的配置文件
   * 逐行读取实现类的全限定名
   * 验证类名格式
3. **类加载**: `Class.forName(类名, false, ClassLoader)`

   * 使用 ClassLoader 在 JAR 包中查找 .class 文件
   * 读取字节码并加载到 JVM
   * 进行类型检查
4. **实例化**: `Class.newInstance()`

   * 反射调用无参构造器
   * 创建服务实例
5. **缓存**: `providers.put(类名, 实例)`

   * 避免重复加载
   * 保持实例化顺序

#### 关键点

* **JAR 包就是 ZIP 文件**，可以像访问文件系统一样访问其中的内容
* **ClassLoader 知道 classpath 上的所有 JAR 包**
* **getResources() 会遍历所有 JAR 包查找指定路径的文件**
* **URL 协议 `jar:file:...!/...` 可以直接读取 JAR 包内的文件**
* **Class.forName() 会在所有 JAR 包中查找并加载类**

现在你应该完全理解 SPI 如何从 JAR 包中加载配置和类了！
