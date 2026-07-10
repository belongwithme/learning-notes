---
title: "JDK9中StackWalker类解读和实战"
description: "启动流程中最初会执行SpringApplication的初始化方法,如下:"
sourceId: "153469705"
source: "https://blog.csdn.net/qq_45852626/article/details/153469705"
sourceSeries:
  - "Java源码"
category: java-backend
subcategory: jvm-runtime
tags:
  - "Java源码"
status: draft
difficulty: intermediate
contentType: knowledge
sidebar:
  order: 153469705
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/153469705)（历史文章导入，当前状态为草稿）

### 初始在SpringApplication的初始化方法里面

启动流程中最初会执行SpringApplication的初始化方法,如下:

```
public SpringApplication(@Nullable ResourceLoader resourceLoader, Class<?>... primarySources) {
		//  - 保存资源加载器
		//  - 断言主配置类不能为空
		//  - 将主配置类转换为 LinkedHashSet 保存（去重且保持顺序）
		this.resourceLoader = resourceLoader;
		Assert.notNull(primarySources, "'primarySources' must not be null");
		this.primarySources = new LinkedHashSet<>(Arrays.asList(primarySources));
		/**推断 Web 应用类
		 *   - SERVLET: 传统的 Servlet Web 应用（检测到 Spring MVC）
		 *   - REACTIVE: 响应式 Web 应用（检测到 Spring WebFlux）
		 *   - NONE: 非 Web 应用
		 */
		this.properties.setWebApplicationType(WebApplicationType.deduceFromClasspath());
		/**
		 * 加载启动注册表初始化器
		 * - 通过 Spring Factories 机制从 META-INF/spring.factories 文件中加载所有
		 *   BootstrapRegistryInitializer 实现
		 *   - 用于在启动早期阶段注册自定义组件
		 */
		this.bootstrapRegistryInitializers = new ArrayList<>(
				getSpringFactoriesInstances(BootstrapRegistryInitializer.class));
		/**
		 * 设置应用上下文初始化器.
		 * 这是 Spring Boot SPI (Service Provider Interface) 机制的核心方法.
		 * 用于从 META-INF/spring.factories文件中加载指定类型的所有实现类,并实例化它们。
		 *   - 加载所有 ApplicationContextInitializer 实现
		 *   - 用于在 ApplicationContext 刷新之前对其进行初始化配置
		 */
		setInitializers((Collection) getSpringFactoriesInstances(ApplicationContextInitializer.class));
		/**
		 *  设置应用监听器
		 *  - 加载所有 ApplicationListener 实现
		 *  - 用于监听应用启动过程中的各种事件（如启动、准备、失败等）
		 */
		setListeners((Collection) getSpringFactoriesInstances(ApplicationListener.class));
		//推断主应用类
		this.mainApplicationClass = deduceMainApplicationClass();
	}


```

最后一个deduceMainApplicationClass方法进去后就能碰到今天的主角.

### deduceMainApplicationClass源码

```
	private @Nullable Class<?> deduceMainApplicationClass() {

		return StackWalker.getInstance(StackWalker.Option.RETAIN_CLASS_REFERENCE)
			.walk(this::findMainClass)
			.orElse(null);
	}


```

### 为什么要分析这段代码

刚接触的时候有点蒙,因为不认识这个StackWalker,后面探究下来感觉还挺有意思的,然后分析堆栈这块我感觉对JVM更了解了一点.

### StackWalker

#### 概述

`StackWalker` 是 Java 9 引入的用于遍历线程调用栈的现代化 API,用于替代传统的 `Thread.getStackTrace()` 和 `Throwable.getStackTrace()` 方法。

#### 为什么需要 StackWalker?

**传统方法的问题:**

* `Thread.getStackTrace()` 会创建完整的栈快照,包含所有栈帧信息,性能开销大
* 无法过滤栈帧,必须获取全部信息
* 无法延迟计算,即使只需要部分信息也要创建完整快照

**StackWalker 的优势:**

* **惰性求值**: 按需遍历栈帧,不需要立即创建完整快照
* **可配置**: 可以选择需要的信息(类引用、反射帧、隐藏帧等)
* **高性能**: 只处理需要的栈帧,减少内存和 CPU 开销
* **Stream API**: 支持函数式编程,可以使用 filter、map、limit 等操作

#### 核心概念

##### StackFrame 接口

`StackFrame` 代表调用栈中的一个栈帧,提供以下信息:

```
public interface StackFrame {
    String getClassName();           // 类名
    String getMethodName();          // 方法名
    Class<?> getDeclaringClass();    // 声明类(需要 RETAIN_CLASS_REFERENCE)
    MethodType getMethodType();      // 方法类型
    String getDescriptor();          // 方法描述符
    int getByteCodeIndex();          // 字节码索引
    String getFileName();            // 文件名
    int getLineNumber();             // 行号
    boolean isNativeMethod();        // 是否本地方法
    StackTraceElement toStackTraceElement(); // 转换为 StackTraceElement
}


```

##### Option 枚举

配置 `StackWalker` 的行为选项:

| 选项 | 说明 |
| --- | --- |
| `RETAIN_CLASS_REFERENCE` | 保留 Class 对象引用,允许调用 `getDeclaringClass()` 和 `getCallerClass()` |
| `SHOW_REFLECT_FRAMES` | 显示反射调用的栈帧(默认隐藏) |
| `SHOW_HIDDEN_FRAMES` | 显示 JVM 实现细节的隐藏栈帧 |

**注意**: 使用 `RETAIN_CLASS_REFERENCE` 需要 `RuntimePermission("getStackWalkerWithClassReference")` 权限。

#### 核心API

##### 创建 StackWalker 实例

```
// 1. 默认实例(无特殊选项)
StackWalker walker = StackWalker.getInstance();

// 2. 指定单个选项
StackWalker walker = StackWalker.getInstance(StackWalker.Option.RETAIN_CLASS_REFERENCE);

// 3. 指定多个选项
StackWalker walker = StackWalker.getInstance(
    Set.of(StackWalker.Option.RETAIN_CLASS_REFERENCE,
           StackWalker.Option.SHOW_REFLECT_FRAMES)
);

// 4. 指定选项 + 预估深度(性能优化)
StackWalker walker = StackWalker.getInstance(
    Set.of(StackWalker.Option.RETAIN_CLASS_REFERENCE),
    10  // 预估栈深度
);


```

##### 遍历栈帧

###### walk() 方法

核心方法,接受一个 `Function<Stream<StackFrame>, T>`,返回处理结果:

```
public <T> T walk(Function<? super Stream<StackFrame>, ? extends T> function)


```

**特点:**

* Stream 在方法返回时自动关闭
* 必须在 function 内部完成所有 Stream 操作
* 不能返回 Stream 对象(会抛出异常)

###### forEach() 方法

简化的遍历方法:

```
public void forEach(Consumer<? super StackFrame> action)


```

###### getCallerClass() 方法

获取调用者的调用者的 Class 对象:

```
public Class<?> getCallerClass()


```

**要求:**

* 必须配置 `RETAIN_CLASS_REFERENCE` 选项
* 自动过滤反射帧、MethodHandle 和隐藏帧
* 如果是栈底调用会抛出 `IllegalCallerException`

#### 使用示例

##### 一. 获取当前调用栈信息

```
public class Example01_BasicUsage {
    public static void main(String[] args) {
        level1();
    }

    static void level1() {
        level2();
    }

    static void level2() {
        level3();
    }

    static void level3() {
        // 打印完整调用栈
        StackWalker.getInstance()
            .forEach(frame -> System.out.println(frame.toStackTraceElement()));
    }
}


```

**输出:**

```
Example01_BasicUsage.level3(Example01_BasicUsage.java:15)
Example01_BasicUsage.level2(Example01_BasicUsage.java:11)
Example01_BasicUsage.level1(Example01_BasicUsage.java:7)
Example01_BasicUsage.main(Example01_BasicUsage.java:3)


```

##### 二. 获取调用者类名(常见于框架中)

```
public class Example02_GetCallerClass {
    private static final StackWalker walker =
        StackWalker.getInstance(StackWalker.Option.RETAIN_CLASS_REFERENCE);

    public static void main(String[] args) {
        new ServiceA().doWork();
        new ServiceB().doWork();
    }

    static class Logger {
        public static void log(String message) {
            // 获取调用 log 方法的类
            Class<?> caller = walker.getCallerClass();
            System.out.println("[" + caller.getSimpleName() + "] " + message);
        }
    }

    static class ServiceA {
        void doWork() {
            Logger.log("ServiceA is working");
        }
    }

    static class ServiceB {
        void doWork() {
            Logger.log("ServiceB is working");
        }
    }
}


```

**输出:**

```
[ServiceA] ServiceA is working
[ServiceB] ServiceB is working


```

##### 三: 使用 Stream API 过滤和限制栈帧

```
import java.util.List;
import java.util.stream.Collectors;

public class Example03_StreamAPI {
    public static void main(String[] args) {
        new MyApplication().start();
    }

    static class MyApplication {
        void start() {
            process();
        }

        void process() {
            handleRequest();
        }

        void handleRequest() {
            // 场景: 跳过框架内部调用,获取前 3 个业务方法
            List<String> businessMethods = StackWalker.getInstance().walk(stream ->
                stream
                    .filter(f -> !f.getClassName().startsWith("java."))
                    .filter(f -> !f.getClassName().startsWith("sun."))
                    .limit(3)
                    .map(f -> f.getClassName() + "." + f.getMethodName())
                    .collect(Collectors.toList())
            );

            System.out.println("Business call chain:");
            businessMethods.forEach(System.out::println);
        }
    }
}


```

**输出:**

```
Business call chain:
Example03_StreamAPI$MyApplication.handleRequest
Example03_StreamAPI$MyApplication.process
Example03_StreamAPI$MyApplication.start


```

#### 与传统 API 的对比

| 特性 | Thread.getStackTrace() | StackWalker |
| --- | --- | --- |
| 引入版本 | Java 1.5 | Java 9 |
| 性能 | 低(创建完整快照) | 高(惰性求值) |
| 灵活性 | 低(只能获取全部) | 高(Stream API) |
| 类引用 | 不支持 | 支持(需配置) |
| 过滤能力 | 需手动遍历 | Stream 操作 |
| 安全性 | 低 | 高(权限控制) |

```
// 传统方式
StackTraceElement[] elements = Thread.currentThread().getStackTrace();
for (StackTraceElement element : elements) {
    if (element.getClassName().startsWith("com.myapp")) {
        // 处理...
        break;
    }
}

// StackWalker 方式
StackWalker.getInstance().walk(stream ->
    stream
        .filter(f -> f.getClassName().startsWith("com.myapp"))
        .findFirst()
);


```

#### 在SpringBoot中有很多实际应用

受限篇幅问题,不一一举例了,如果你去看SpringBoot的启动流程,肯定会遇到它的,到时候能认出来就不会蒙了.  
 我后面就拿在启动流程中SpringApplication构造方法中的一个方法deduceMainApplicationClass()去举例详细说明

1. **条件注解处理** (`@ConditionalOnClass`):

   * 检查特定类是否在调用栈中
   * 判断配置类的加载顺序
2. **日志增强**:

   * 自动记录调用来源
   * 添加调用链追踪信息
3. **安全检查**:

   * 验证敏感操作的调用来源
   * 实现方法级别的权限控制
4. **自动配置**:

   * 根据调用栈确定配置优先级
   * 解决配置冲突

#### 实战-deduceMainApplicationClass中StackWalker分析解读

##### deduceMainApplicationClass源码

```
private @Nullable Class<?> deduceMainApplicationClass() {
//Option.RETAIN_CLASS_REFERENCE 选项表示保留每个栈帧中的 Class 引用 
/**
 为什么需要这个选项？
  - 默认情况下，为了性能考虑，StackWalker 不会保留 Class 对象引用
  - 加上这个选项后，可以通过 getDeclaringClass() 获取到实际的 Class 对象   
 */
    return StackWalker.getInstance(StackWalker.Option.RETAIN_CLASS_REFERENCE)
    //将调用栈转换为 Stream<StackFrame> 流，传递给 findMainClass 方法处理 
        .walk(this::findMainClass)
        .orElse(null);
}

private Optional<Class<?>> findMainClass(Stream<StackFrame> stack) {
    return stack.filter((frame) -> Objects.equals(frame.getMethodName(), "main"))
        .findFirst()
        .map(StackWalker.StackFrame::getDeclaringClass);
}


```

##### findMainClass执行流程

###### 过滤 main 方法

```
.filter((frame) -> Objects.equals(frame.getMethodName(), "main"))


```

* 筛选出方法名为 `"main"` 的栈帧
* 使用 `Objects.equals()` 而非 `==` 避免空指针异常
* 返回 `Stream<StackFrame>`，包含所有 main 方法的栈帧

###### 获取第一个匹配项

```
.findFirst()


```

* 返回第一个匹配的栈帧（`Optional<StackFrame>`）
* 为什么取第一个？
  + 调用栈是从内向外的（栈顶到栈底）
  + 最先遇到的 main 方法就是**最近的调用者**
  + 这通常就是应用的入口类

###### 提取类信息

```
.map(StackWalker.StackFrame::getDeclaringClass)


```

* 从栈帧中提取声明该方法的 Class 对象
* `getDeclaringClass()` 返回声明该方法的类
* 最终返回 `Optional<Class<?>>`

##### getInstance处理结果

```
.orElse(null)


```

含义

* 如果找到了 main 方法，返回对应的 Class
* 如果没找到（例如在测试环境中），返回 `null`

**为什么可以返回 null？**

* `mainApplicationClass` 是可选的，不影响 Spring Boot 启动
* 主要用于日志输出、Banner 打印等辅助功能
* 在测试环境中通常没有 main 方法，返回 null 是预期行为

##### 调用栈示例

###### 示例代码

```
package com.example.demo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class DemoApplication {

    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }
}


```

###### 调用栈结构

当执行到 `deduceMainApplicationClass()` 时，调用栈可能是这样的：

```
┌─────────────────────────────────────────────────────────────┐
│ Thread: main                                                │
├─────────────────────────────────────────────────────────────┤
│ 栈顶 (最近的调用)                                            │
│                                                              │
│ [0] SpringApplication.deduceMainApplicationClass()          │
│     ↑ 当前方法                                              │
│                                                              │
│ [1] SpringApplication.<init>(ResourceLoader, Class<?>...)   │
│     ↑ 构造函数调用了 deduceMainApplicationClass()          │
│                                                              │
│ [2] SpringApplication.<init>(Class<?>...)                   │
│     ↑ 重载构造函数                                          │
│                                                              │
│ [3] SpringApplication.run(Class<?>, String[])               │
│     ↑ 静态 run 方法                                         │
│                                                              │
│ [4] DemoApplication.main(String[])  ⭐                       │
│     ↑ 这就是我们要找的！包含 main 方法的类                  │
│                                                              │
│ [5] ...JVM 启动相关的栈帧...                                 │
│                                                              │
│ 栈底 (最早的调用)                                            │
└─────────────────────────────────────────────────────────────┘


```

##### 执行过程详解

###### 步骤 1：过滤 main 方法

```
stack.filter((frame) -> Objects.equals(frame.getMethodName(), "main"))


```

过滤后保留的栈帧：

```
[4] DemoApplication.main(String[])
[可能还有其他的 main 方法栈帧]


```

###### 步骤 2：获取第一个

```
.findFirst()


```

结果：

```
Optional<StackFrame> = Optional[DemoApplication.main(String[])]


```

###### 步骤 3：提取类

```
.map(StackWalker.StackFrame::getDeclaringClass)


```

结果：

```
Optional<Class<?>> = Optional[class com.example.demo.DemoApplication]


```

###### 步骤 4：获取值或默认值

```
.orElse(null)


```

最终返回：

```
Class<?> = com.example.demo.DemoApplication


```

##### 完整流程图

```
deduceMainApplicationClass() 被调用
    ↓
创建 StackWalker 实例
    ├─ 配置选项: RETAIN_CLASS_REFERENCE
    └─ 允许获取 Class 对象引用
    ↓
获取当前线程的调用栈
    │
    ├─ [0] SpringApplication.deduceMainApplicationClass()
    ├─ [1] SpringApplication.<init>(ResourceLoader, Class<?>...)
    ├─ [2] SpringApplication.<init>(Class<?>...)
    ├─ [3] SpringApplication.run(Class<?>, String[])
    ├─ [4] DemoApplication.main(String[])  ← 目标！
    ├─ [5] ...JVM 启动栈帧...
    └─ [N] ...
    ↓
转换为 Stream<StackFrame>
    ↓
过滤：只保留方法名 = "main" 的栈帧
    ↓
    [4] DemoApplication.main(String[])
    [可能还有其他 main 方法]
    ↓
findFirst() - 获取第一个匹配项
    ↓
Optional<StackFrame> = Optional[DemoApplication.main(...)]
    ↓
提取声明该方法的 Class
    ↓
Optional<Class<?>> = Optional[DemoApplication.class]
    ↓
orElse(null) - 如果存在则返回，否则返回 null
    ↓
返回: DemoApplication.class


```

### 结尾

后面没看明白可以多看看JVM的内存模型,尤其是栈帧结构,有帮助的.
