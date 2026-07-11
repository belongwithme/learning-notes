---
title: "6 - Java SPI,Spring SPI 新旧版本流程图对比学习"
description: "✗ 配置文件路径固定(METAINF/services/)"
sourceId: "153680172"
source: "https://blog.csdn.net/qq_45852626/article/details/153680172"
sourceSeries:
  - "Spring核心模块解析"
category: java-backend
subcategory: spring
tags:
  - "Spring核心模块解析"
  - "Java"
  - "Spring"
status: draft
difficulty: intermediate
contentType: knowledge
sidebar:
  order: 153680172
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/153680172)（历史文章导入，当前状态为草稿）

## 一、Java 标准 SPI 机制流程图

```
  ┌─────────────────────────────────────────────────────────────────┐
  │                    Java 标准 SPI 加载流程                          │
  └─────────────────────────────────────────────────────────────────┘

  1. 服务提供方(Provider)准备阶段
     ┌──────────────────────────────────────────────┐
     │ 1) 定义服务接口                                 │
     │    public interface DatabaseDriver {          │
     │        void connect();                        │
     │    }                                          │
     │                                               │
     │ 2) 实现服务接口                                 │
     │    public class MySQLDriver                   │
     │           implements DatabaseDriver {         │
     │        public void connect() {...}            │
     │    }                                          │
     │                                               │
     │ 3) 配置SPI文件                                 │
     │    路径: META-INF/services/                   │
     │          com.example.DatabaseDriver          │
     │    内容: com.example.MySQLDriver              │
     │          com.example.PostgreSQLDriver         │
     └──────────────────────────────────────────────┘
                          ↓
  2. 服务消费方(Consumer)使用阶段
     ┌──────────────────────────────────────────────┐
     │ ServiceLoader<DatabaseDriver> loader =       │
     │   ServiceLoader.load(DatabaseDriver.class);  │
     └──────────────────────────────────────────────┘
                          ↓
  3. ServiceLoader 内部加载流程
     ┌──────────────────────────────────────────────┐
     │ ① 获取类加载器                                 │
     │    ClassLoader cl = Thread.currentThread()   │
     │       .getContextClassLoader();              │
     │                                               │
     │ ② 构造配置文件路径                             │
     │    String fullName = "META-INF/services/"    │
     │       + service.getName();                   │
     │    // META-INF/services/                     │
     │    //   com.example.DatabaseDriver           │
     │                                               │
     │ ③ 扫描所有jar包的配置文件                       │
     │    Enumeration<URL> configs =                │
     │       cl.getResources(fullName);             │
     │                                               │
     │ ④ 解析配置文件,逐行读取实现类全限定名           │
     │    BufferedReader reader = new              │
     │       BufferedReader(...);                   │
     │    String line = reader.readLine();          │
     │    // com.example.MySQLDriver                │
     │                                               │
     │ ⑤ 懒加载:迭代时反射实例化                       │
     │    for (DatabaseDriver driver : loader) {    │
     │        Class<?> clazz =                      │
     │           Class.forName(className, false, cl)│
     │        Object instance = clazz.newInstance() │
     │        return (DatabaseDriver) instance;     │
     │    }                                          │
     └──────────────────────────────────────────────┘
                          ↓
  4. 使用服务实现
     ┌──────────────────────────────────────────────┐
     │ for (DatabaseDriver driver : loader) {       │
     │     driver.connect();                        │
     │ }                                             │
     └──────────────────────────────────────────────┘


```

【特点总结】  
 ✓ JDK原生支持,无需额外依赖  
 ✓ 懒加载,按需实例化  
 ✓ 支持多个实现类自动发现  
 ✗ 不支持依赖注入  
 ✗ 配置文件路径固定(META-INF/services/)  
 ✗ 只能通过无参构造函数实例化

---

## 二、Spring Boot 2.7 之前 SPI 机制(SpringFactoriesLoader)

```
  ┌─────────────────────────────────────────────────────────────────┐
  │           Spring Boot 2.7 之前的 SPI 加载流程                      │
  │                  (SpringFactoriesLoader)                        │
  └─────────────────────────────────────────────────────────────────┘

  1. 配置准备阶段
     ┌──────────────────────────────────────────────┐
     │ 路径: META-INF/spring.factories               │
     │                                               │
     │ 格式(Key-Value,支持多值):                      │
     │ ┌─────────────────────────────────────────┐  │
     │ │# Auto Configure                         │  │
     │ │org.springframework.boot.autoconfigure.\│  │
     │ │  EnableAutoConfiguration=\             │  │
     │ │com.example.MyAutoConfig1,\             │  │
     │ │com.example.MyAutoConfig2               │  │
     │ │                                         │  │
     │ │# Application Listeners                 │  │
     │ │org.springframework.context.\           │  │
     │ │  ApplicationListener=\                 │  │
     │ │com.example.MyListener1,\               │  │
     │ │com.example.MyListener2                 │  │
     │ └─────────────────────────────────────────┘  │
     └──────────────────────────────────────────────┘
                          ↓
  2. SpringFactoriesLoader 加载流程
     ┌──────────────────────────────────────────────┐
     │ // 入口方法                                    │
     │ SpringFactoriesLoader.loadFactoryNames(      │
     │     EnableAutoConfiguration.class,           │
     │     classLoader                              │
     │ )                                             │
     └──────────────────────────────────────────────┘
                          ↓
     ┌──────────────────────────────────────────────┐
     │ ① 构造配置文件路径                             │
     │    String FACTORIES_RESOURCE_LOCATION =      │
     │      "META-INF/spring.factories";            │
     │                                               │
     │ ② 扫描所有jar包的spring.factories文件          │
     │    Enumeration<URL> urls = classLoader       │
     │      .getResources(FACTORIES_RESOURCE_       │
     │         LOCATION);                            │
     │                                               │
     │ ③ 解析Properties格式                          │
     │    while (urls.hasMoreElements()) {          │
     │      URL url = urls.nextElement();           │
     │      Properties props = PropertiesLoader     │
     │        Utils.loadProperties(url);            │
     │    }                                          │
     │    // 示例解析结果:                            │
     │    // Key: o.s.b.a.EnableAutoConfiguration   │
     │    // Value: c.e.Config1,c.e.Config2         │
     │                                               │
     │ ④ 合并所有jar包的配置                          │
     │    Map<String, List<String>> result =        │
     │      new LinkedMultiValueMap<>();            │
     │    // 将所有jar的同一个Key的Value合并          │
     │                                               │
     │ ⑤ 根据Key获取实现类列表                        │
     │    List<String> classNames =                 │
     │      result.get(factoryType.getName());      │
     │                                               │
     │ ⑥ 去重、排序返回                               │
     │    return new ArrayList<>(                   │
     │      new LinkedHashSet<>(classNames)         │
     │    );                                         │
     └──────────────────────────────────────────────┘
                          ↓
  3. Spring Boot 启动时使用
     ┌──────────────────────────────────────────────┐
     │ @SpringBootApplication                       │
     │ @EnableAutoConfiguration  ← 自动配置注解       │
     │ public class Application {                   │
     │   public static void main(String[] args) {   │
     │     SpringApplication.run(                   │
     │       Application.class, args);              │
     │   }                                           │
     │ }                                             │
     └──────────────────────────────────────────────┘
                          ↓
     ┌──────────────────────────────────────────────┐
     │ 自动配置流程:                                  │
     │                                               │
     │ ① SpringApplication.run() 启动                │
     │    ↓                                          │
     │ ② 处理 @EnableAutoConfiguration               │
     │    ↓                                          │
     │ ③ AutoConfigurationImportSelector             │
     │    .selectImports() 被调用                    │
     │    ↓                                          │
     │ ④ 调用 SpringFactoriesLoader                  │
     │    List<String> configs =                    │
     │      SpringFactoriesLoader.loadFactoryNames( │
     │        EnableAutoConfiguration.class, cl);   │
     │    ↓                                          │
     │ ⑤ 获得所有自动配置类列表                        │
     │    [DataSourceAutoConfiguration,             │
     │     RedisAutoConfiguration,                  │
     │     WebMvcAutoConfiguration, ...]            │
     │    ↓                                          │
     │ ⑥ 条件过滤(@ConditionalOnClass等)             │
     │    ↓                                          │
     │ ⑦ 注册到Spring容器                             │
     └──────────────────────────────────────────────┘


```

【特点总结】  
 ✓ 统一配置文件 spring.factories  
 ✓ 支持多个实现类,自动合并  
 ✓ 与Spring容器深度集成  
 ✓ 支持条件装配(@Conditional)  
 ✗ 配置格式复杂(需要反斜杠续行)  
 ✗ 所有配置混在一个文件,维护困难  
 ✗ 不支持注释

---

## 三、Spring Boot 2.7+ SPI 机制(ImportCandidates)

```
  ┌─────────────────────────────────────────────────────────────────┐
  │           Spring Boot 2.7+ 新型 SPI 加载流程                       │
  │                    (ImportCandidates)                           │
  └─────────────────────────────────────────────────────────────────┘

  1. 配置准备阶段
     ┌──────────────────────────────────────────────┐
     │ 新路径: META-INF/spring/                      │
     │        <注解全限定名>.imports                   │
     │                                               │
     │ 示例文件名:                                    │
     │ org.springframework.boot.autoconfigure.      │
     │   AutoConfiguration.imports                  │
     │                                               │
     │ 格式(每行一个类,简洁清晰):                      │
     │ ┌─────────────────────────────────────────┐  │
     │ │# 这是注释,会被忽略                        │  │
     │ │org.springframework.boot.autoconfigure.  │  │
     │ │  admin.SpringApplicationAdminJmx        │  │
     │ │  AutoConfiguration                      │  │
     │ │org.springframework.boot.autoconfigure.  │  │
     │ │  aop.AopAutoConfiguration               │  │
     │ │org.springframework.boot.autoconfigure.  │  │
     │ │  context.MessageSourceAutoConfiguration │  │
     │ │                                         │  │
     │ │# 空行会被忽略                             │  │
     │ │org.springframework.boot.autoconfigure.  │  │
     │ │  jmx.JmxAutoConfiguration               │  │
     │ └─────────────────────────────────────────┘  │
     └──────────────────────────────────────────────┘
                          ↓
  2. ImportCandidates 加载流程(来源代码分析)
     ┌──────────────────────────────────────────────┐
     │ // 入口方法                                    │
     │ ImportCandidates.load(                       │
     │     AutoConfiguration.class,  // 注解类       │
     │     classLoader                              │
     │ )                                             │
     └──────────────────────────────────────────────┘
                          ↓
     ┌──────────────────────────────────────────────┐
     │ ① 确定类加载器                                 │
     │    ClassLoader cl = (classLoader != null)    │
     │      ? classLoader                           │
     │      : ImportCandidates.class.getClassLoader│
     │         ();                                   │
     │                                               │
     │ ② 构建配置文件路径                             │
     │    String LOCATION =                         │
     │      "META-INF/spring/%s.imports";           │
     │    String location = String.format(          │
     │      LOCATION,                               │
     │      annotation.getName()  // 注解全限定名     │
     │    );                                         │
     │    // 结果: META-INF/spring/                 │
     │    //   org.springframework.boot.           │
     │    //   autoconfigure.AutoConfiguration.     │
     │    //   imports                               │
     │                                               │
     │ ③ 扫描类路径所有匹配文件                        │
     │    Enumeration<URL> urls =                   │
     │      classLoader.getResources(location);     │
     │    // 遍历所有jar包找到该文件                  │
     │                                               │
     │ ④ 读取并解析每个文件                           │
     │    List<String> candidates = new ArrayList<>│
     │    while (urls.hasMoreElements()) {          │
     │      URL url = urls.nextElement();           │
     │      BufferedReader reader = new            │
     │        BufferedReader(new InputStreamReader( │
     │          url.openStream(), UTF_8));          │
     │                                               │
     │      String line;                            │
     │      while ((line = reader.readLine())       │
     │              != null) {                      │
     │        // 移除 # 注释                         │
     │        int idx = line.indexOf('#');          │
     │        if (idx >= 0) {                       │
     │          line = line.substring(0, idx);      │
     │        }                                      │
     │        line = line.trim();                   │
     │        // 跳过空行                            │
     │        if (!line.isEmpty()) {                │
     │          candidates.add(line);               │
     │        }                                      │
     │      }                                        │
     │    }                                          │
     │                                               │
     │ ⑤ 返回不可变列表                               │
     │    return new ImportCandidates(              │
     │      Collections.unmodifiableList(           │
     │        candidates)                           │
     │    );                                         │
     └──────────────────────────────────────────────┘
                          ↓
  3. Spring Boot 启动时使用
     ┌──────────────────────────────────────────────┐
     │ @SpringBootApplication                       │
     │ public class Application {                   │
     │   public static void main(String[] args) {   │
     │     SpringApplication.run(                   │
     │       Application.class, args);              │
     │   }                                           │
     │ }                                             │
     └──────────────────────────────────────────────┘
                          ↓
     ┌──────────────────────────────────────────────┐
     │ 自动配置流程(2.7+新流程):                       │
     │                                               │
     │ ① SpringApplication.run() 启动                │
     │    ↓                                          │
     │ ② 处理 @AutoConfiguration 相关注解             │
     │    (@EnableAutoConfiguration已废弃)           │
     │    ↓                                          │
     │ ③ AutoConfigurationImportSelector             │
     │    .selectImports() 被调用                    │
     │    ↓                                          │
     │ ④ 调用 ImportCandidates (新方式)              │
     │    ImportCandidates candidates =             │
     │      ImportCandidates.load(                  │
     │        AutoConfiguration.class,              │
     │        classLoader);                         │
     │    ↓                                          │
     │ ⑤ 获取配置类列表                               │
     │    List<String> configs =                    │
     │      candidates.getCandidates();             │
     │    ↓                                          │
     │ ⑥ 条件过滤(@ConditionalOnClass等)             │
     │    ↓                                          │
     │ ⑦ 注册到Spring容器                             │
     └──────────────────────────────────────────────┘


```

【特点总结】  
 ✓ 配置格式简单(每行一个类名)  
 ✓ 支持注释(# 开头)  
 ✓ 按注解分类,职责单一  
 ✓ 更好的模块化和可维护性  
 ✓ 文件路径语义化  
 ✓ 向后兼容(2.7+仍支持spring.factories)

---

## 三种机制对比表

| 特性 | Java SPI | Spring Boot <2.7 | Spring Boot ≥2.7 |
| --- | --- | --- | --- |
| 配置路径 | META-INF/services/ | META-INF/spring.factories | META-INF/spring/\*.imports |
| 配置格式 | 每行一个类名 | Key=Value1,Value2,\ | 每行一个类名 |
| 注释支持 | ❌ | ❌ | ✅ (# 开头) |
| 文件组织 | 按接口分文件 | 单一文件 | 按注解分文件 |
| 续行符 | ❌ | ✅ (需要 | ❌ |
| 依赖注入 | ❌ | ✅ | ✅ |
| 条件装配 | ❌ | ✅ | ✅ |
| 加载方式 | ServiceLoader | SpringFactoriesLoader | ImportCandidates |
| 维护性 | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |

## 迁移示例

```
  旧方式 (Spring Boot 2.6):
  文件: META-INF/spring.factories
  内容:
  org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
  com.example.redis.RedisAutoConfiguration,\
  com.example.cache.CacheAutoConfiguration,\
  com.example.mq.RabbitAutoConfiguration

  新方式 (Spring Boot 2.7+):
  文件: META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
  内容:
  # Redis自动配置
  com.example.redis.RedisAutoConfiguration
  # 缓存自动配置
  com.example.cache.CacheAutoConfiguration
  # 消息队列自动配置
  com.example.mq.RabbitAutoConfiguration


```
