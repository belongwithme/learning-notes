---
title: "4-Spring SPI机制解读"
description: "虽然Java SPI机制很强大,但在实际应用中存在一些限制:"
sourceId: "153635511"
source: "https://blog.csdn.net/qq_45852626/article/details/153635511"
sourceSeries:
  - "Spring核心模块解析"
category: java-backend
tags:
  - "Spring核心模块解析"
  - "Spring"
status: draft
difficulty: advanced
contentType: source-analysis
sidebar:
  order: 153635511
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/153635511)（历史文章导入，当前状态为草稿）

### Spring为什么要自己实现SPI

#### Java SPI的不足

虽然Java SPI机制很强大,但在实际应用中存在一些限制:

**1. 无法按需加载**

```
// Java SPI: 必须遍历所有实现才能获取特定实现
ServiceLoader<MyService> loader = ServiceLoader.load(MyService.class);
for (MyService service : loader) {
    if (service instanceof SpecificImpl) {
        // 找到了!但是其他所有实现也被实例化了
        break;
    }
}


```

**2. 配置文件分散**

```
每个接口一个配置文件:
META-INF/services/
    ├── com.example.service.UserService
    ├── com.example.service.OrderService
    ├── com.example.service.PaymentService
    └── com.example.service.LogService

难以统一管理和查看


```

**3. 无法批量获取类名**

```
// Java SPI: 只能获取实例,无法只获取类名
ServiceLoader<Driver> loader = ServiceLoader.load(Driver.class);
// 没有直接的API获取所有类名列表


```

**4. 不支持分组/分类**

```
// 无法区分不同用途的实现
// 例如: 测试环境用的实现 vs 生产环境用的实现


```

#### Spring SPI的改进

Spring设计了自己的SPI机制,主要改进:

| 特性 | Java SPI | Spring SPI |
| --- | --- | --- |
| **配置文件** | 每个接口一个文件 | 统一在spring.factories |
| **文件格式** | 纯文本(每行一个类名) | Properties格式(key=value) |
| **加载方式** | 只能获取实例 | 可以只获取类名,按需实例化 |
| **批量操作** | ❌ | ✅ 支持批量获取 |
| **条件过滤** | ❌ | ✅ 支持条件注解过滤 |
| **缓存策略** | 简单缓存 | 多级缓存 |

**核心优势示意:**

```
Java SPI流程:
加载配置 → 遍历实例化 → 全部创建 → 选择需要的
(性能差,资源浪费)

Spring SPI流程:
加载配置 → 获取类名列表 → 条件过滤 → 按需实例化
(性能好,资源节约)


```

### SpringFactoriesLoader核心 类

#### 类的基本信息

**位置:** `org.springframework.core.io.support.SpringFactoriesLoader`

**作用:** 加载并实例化`META-INF/spring.factories`文件中配置的工厂类

**类签名:**

```
public final class SpringFactoriesLoader {
    // 工具类,私有构造器
    private SpringFactoriesLoader() {
    }
}


```

#### 核心常量和字段

```
public final class SpringFactoriesLoader {

    /**
     * 📌 配置文件位置
     */
    public static final String FACTORIES_RESOURCE_LOCATION = "META-INF/spring.factories";

    /**
     * 📌 缓存: ClassLoader -> (接口名 -> 实现类名列表)
     * 使用ConcurrentReferenceHashMap实现弱引用,避免内存泄漏
     */
    private static final Map<ClassLoader, MultiValueMap<String, String>> cache =
        new ConcurrentReferenceHashMap<>();
}


```

**缓存结构说明:**

```
cache (ConcurrentReferenceHashMap)
└── ClassLoader1 (AppClassLoader)
    └── MultiValueMap
        ├── "org.springframework.boot.autoconfigure.EnableAutoConfiguration"
        │   ├── "com.example.AutoConfig1"
        │   ├── "com.example.AutoConfig2"
        │   └── "com.example.AutoConfig3"
        │
        ├── "org.springframework.context.ApplicationListener"
        │   ├── "com.example.Listener1"
        │   └── "com.example.Listener2"
        │
        └── "org.springframework.boot.env.PropertySourceLoader"
            ├── "com.example.PropertiesLoader"
            └── "com.example.YamlLoader"


```

---

#### SpringFactoriesLoader源码完整解析

##### 核心方法1: loadFactoryNames()

**作用:** 加载指定接口的所有实现类名(不实例化)

**源码分析:**

```
/**
 * 加载指定工厂接口的所有实现类名
 *
 * @param factoryType 工厂接口Class
 * @param classLoader 类加载器(null则使用默认)
 * @return 实现类名列表
 */
public static List<String> loadFactoryNames(Class<?> factoryType,
                                           @Nullable ClassLoader classLoader) {
    // 📌 步骤1: 获取接口全限定名作为key
    String factoryTypeName = factoryType.getName();

    // 📌 步骤2: 加载所有spring.factories,返回Map
    // 📌 步骤3: 从Map中获取指定接口的实现类列表
    return loadSpringFactories(classLoader)
        .getOrDefault(factoryTypeName, Collections.emptyList());
}


```

**调用示例:**

```
// 获取所有自动配置类的类名
List<String> configNames = SpringFactoriesLoader.loadFactoryNames(
    EnableAutoConfiguration.class,
    getClass().getClassLoader()
);

// 输出示例:
// [
//   "org.springframework.boot.autoconfigure.aop.AopAutoConfiguration",
//   "org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration",
//   ...
// ]


```

---

##### 核心方法2: loadFactories()

**作用:** 加载并实例化指定接口的所有实现类

**源码分析:**

```
/**
 * 加载并实例化指定工厂接口的所有实现类
 *
 * @param factoryType 工厂接口Class
 * @param classLoader 类加载器
 * @return 实例列表
 */
public static <T> List<T> loadFactories(Class<T> factoryType,
                                       @Nullable ClassLoader classLoader) {
    Assert.notNull(factoryType, "'factoryType' must not be null");

    // 📌 步骤1: 获取类加载器
    ClassLoader classLoaderToUse = classLoader;
    if (classLoaderToUse == null) {
        classLoaderToUse = SpringFactoriesLoader.class.getClassLoader();
    }

    // 📌 步骤2: 加载所有实现类名
    List<String> factoryImplementationNames =
        loadFactoryNames(factoryType, classLoaderToUse);

    if (logger.isTraceEnabled()) {
        logger.trace("Loaded [" + factoryType.getName() + "] names: " +
                    factoryImplementationNames);
    }

    // 📌 步骤3: 实例化
    List<T> result = new ArrayList<>(factoryImplementationNames.size());
    for (String factoryImplementationName : factoryImplementationNames) {
        // ⚠️ 调用 instantiateFactory 实例化每个类
        result.add(instantiateFactory(factoryImplementationName,
                                     factoryType,
                                     classLoaderToUse));
    }

    // 📌 步骤4: 排序(基于@Order注解或Ordered接口)
    AnnotationAwareOrderComparator.sort(result);

    return result;
}


```

**实例化方法:**

```
/**
 * 实例化单个工厂类
 */
@SuppressWarnings("unchecked")
private static <T> T instantiateFactory(String factoryImplementationName,
                                       Class<T> factoryType,
                                       ClassLoader classLoader) {
    try {
        // 📌 步骤1: 加载类
        Class<?> factoryImplementationClass =
            ClassUtils.forName(factoryImplementationName, classLoader);

        // 📌 步骤2: 验证类型
        if (!factoryType.isAssignableFrom(factoryImplementationClass)) {
            throw new IllegalArgumentException(
                "Class [" + factoryImplementationName +
                "] is not assignable to factory type [" + factoryType.getName() + "]");
        }

        // 📌 步骤3: 实例化(调用无参构造器)
        return (T) ReflectionUtils.accessibleConstructor(factoryImplementationClass)
            .newInstance();

    } catch (Throwable ex) {
        throw new IllegalArgumentException(
            "Unable to instantiate factory class [" +
            factoryImplementationName + "] for factory type [" +
            factoryType.getName() + "]", ex);
    }
}


```

---

##### 核心方法3: loadSpringFactories() - 最重要!

**这是整个Spring SPI机制的核心方法!**

**完整源码解析:**

```
/**
 * 加载所有spring.factories文件
 *
 * @param classLoader 类加载器
 * @return Map<接口名, List<实现类名>>
 */
private static Map<String, List<String>> loadSpringFactories(
        @Nullable ClassLoader classLoader) {

    // ⚠️ 关键点1: 缓存检查
    MultiValueMap<String, String> result = cache.get(classLoader);
    if (result != null) {
        return result;  // 缓存命中,直接返回
    }

    try {
        // ⚠️ 关键点2: 加载所有spring.factories文件
        Enumeration<URL> urls = (classLoader != null ?
                classLoader.getResources(FACTORIES_RESOURCE_LOCATION) :
                ClassLoader.getSystemResources(FACTORIES_RESOURCE_LOCATION));

        // 使用LinkedMultiValueMap保持顺序
        result = new LinkedMultiValueMap<>();

        // ⚠️ 关键点3: 遍历所有配置文件
        while (urls.hasMoreElements()) {
            URL url = urls.nextElement();

            // ⚠️ 关键点4: 将URL包装为Resource
            UrlResource resource = new UrlResource(url);

            // ⚠️ 关键点5: 加载Properties
            Properties properties = PropertiesLoaderUtils.loadProperties(resource);

            // ⚠️ 关键点6: 解析每个key-value
            for (Map.Entry<?, ?> entry : properties.entrySet()) {
                // key: 接口全限定名
                String factoryTypeName = ((String) entry.getKey()).trim();

                // value: 逗号分隔的实现类名列表
                for (String factoryImplementationName :
                     StringUtils.commaDelimitedListToStringArray((String) entry.getValue())) {
                    // 添加到结果Map中
                    result.add(factoryTypeName, factoryImplementationName.trim());
                }
            }
        }

        // ⚠️ 关键点7: 放入缓存
        cache.put(classLoader, result);
        return result;

    } catch (IOException ex) {
        throw new IllegalArgumentException(
            "Unable to load factories from location [" +
            FACTORIES_RESOURCE_LOCATION + "]", ex);
    }
}


```

**逐步分解:**

**步骤1: 缓存检查**

```
MultiValueMap<String, String> result = cache.get(classLoader);
if (result != null) {
    return result;  // 命中缓存
}


```

**为什么用MultiValueMap?**

* 一个key(接口)对应多个value(实现类)
* 自动处理重复添加

**步骤2-3: 扫描所有jar包的spring.factories**

```
Enumeration<URL> urls = classLoader.getResources("META-INF/spring.factories");

while (urls.hasMoreElements()) {
    URL url = urls.nextElement();
    // 例如: jar:file:/path/spring-boot-autoconfigure-2.7.0.jar!/META-INF/spring.factories
}


```

**可能扫描到的文件:**

```
jar:file:/xxx/spring-boot-2.7.0.jar!/META-INF/spring.factories
jar:file:/xxx/spring-boot-autoconfigure-2.7.0.jar!/META-INF/spring.factories
jar:file:/xxx/spring-beans-5.3.20.jar!/META-INF/spring.factories
jar:file:/xxx/spring-context-5.3.20.jar!/META-INF/spring.factories
jar:file:/xxx/mybatis-spring-boot-starter-2.2.0.jar!/META-INF/spring.factories
...


```

**步骤4-5: 加载Properties**

```
UrlResource resource = new UrlResource(url);
Properties properties = PropertiesLoaderUtils.loadProperties(resource);

// properties内容示例:
// org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
// com.example.Config1,\
// com.example.Config2


```

**步骤6: 解析key-value并存入MultiValueMap**

```
for (Map.Entry<?, ?> entry : properties.entrySet()) {
    String factoryTypeName = entry.getKey();  // 接口名

    // 分割逗号分隔的实现类
    String[] factoryNames = StringUtils.commaDelimitedListToStringArray(
        entry.getValue());

    for (String factoryName : factoryNames) {
        result.add(factoryTypeName, factoryName.trim());
    }
}


```

**结果示例:**

```
result = {
    "org.springframework.boot.autoconfigure.EnableAutoConfiguration": [
        "org.springframework.boot.autoconfigure.admin.SpringApplicationAdminJmxAutoConfiguration",
        "org.springframework.boot.autoconfigure.aop.AopAutoConfiguration",
        "org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration",
        // ... 130+ 个
    ],
    "org.springframework.context.ApplicationListener": [
        "org.springframework.boot.ClearCachesApplicationListener",
        "org.springframework.boot.builder.ParentContextCloserApplicationListener",
        // ...
    ],
    "org.springframework.boot.env.PropertySourceLoader": [
        "org.springframework.boot.env.PropertiesPropertySourceLoader",
        "org.springframework.boot.env.YamlPropertySourceLoader"
    ]
}


```

---

### spring.factories配置文件详解

#### 文件位置和格式

**位置:** `META-INF/spring.factories`

**格式:** 标准的Properties格式

**示例 - spring-boot-autoconfigure包中的spring.factories:**

```
# Auto Configure
org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
org.springframework.boot.autoconfigure.admin.SpringApplicationAdminJmxAutoConfiguration,\
org.springframework.boot.autoconfigure.aop.AopAutoConfiguration,\
org.springframework.boot.autoconfigure.amqp.RabbitAutoConfiguration,\
org.springframework.boot.autoconfigure.batch.BatchAutoConfiguration,\
org.springframework.boot.autoconfigure.cache.CacheAutoConfiguration,\
org.springframework.boot.autoconfigure.cassandra.CassandraAutoConfiguration,\
org.springframework.boot.autoconfigure.context.ConfigurationPropertiesAutoConfiguration,\
org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration

# Application Listeners
org.springframework.context.ApplicationListener=\
org.springframework.boot.ClearCachesApplicationListener,\
org.springframework.boot.builder.ParentContextCloserApplicationListener,\
org.springframework.boot.context.FileEncodingApplicationListener,\
org.springframework.boot.context.config.AnsiOutputApplicationListener,\
org.springframework.boot.context.config.DelegatingApplicationListener

# Environment Post Processors
org.springframework.boot.env.EnvironmentPostProcessor=\
org.springframework.boot.cloud.CloudFoundryVcapEnvironmentPostProcessor,\
org.springframework.boot.env.SpringApplicationJsonEnvironmentPostProcessor,\
org.springframework.boot.env.SystemEnvironmentPropertySourceEnvironmentPostProcessor

# Failure Analyzers
org.springframework.boot.diagnostics.FailureAnalyzer=\
org.springframework.boot.diagnostics.analyzer.BeanCurrentlyInCreationFailureAnalyzer,\
org.springframework.boot.diagnostics.analyzer.BeanDefinitionOverrideFailureAnalyzer,\
org.springframework.boot.diagnostics.analyzer.BeanNotOfRequiredTypeFailureAnalyzer

# Property Source Loaders
org.springframework.boot.env.PropertySourceLoader=\
org.springframework.boot.env.PropertiesPropertySourceLoader,\
org.springframework.boot.env.YamlPropertySourceLoader


```

#### 格式规则

**1. Key-Value结构**

```
# key: 接口或注解的全限定名
# value: 实现类的全限定名,多个用逗号分隔
接口全限定名=实现类1,实现类2,实现类3


```

**2. 续行符**

```
# 使用反斜杠 \ 续行
org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
com.example.Config1,\
com.example.Config2,\
com.example.Config3


```

**3. 注释**

```
# 井号开头的行是注释
# Auto Configure
org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
com.example.Config1


```

**4. 空白处理**

```
# 首尾空白会被自动trim
org.springframework.context.ApplicationListener=\
  com.example.Listener1  ,  \
  com.example.Listener2

# 等价于:
org.springframework.context.ApplicationListener=\
com.example.Listener1,\
com.example.Listener2


```

---

### 完整执行流程图

```
┌─────────────────────────────────────────────────────────┐
│  SpringFactoriesLoader.loadFactoryNames(                │
│      EnableAutoConfiguration.class,                     │
│      classLoader)                                       │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  1. 获取接口全限定名                                       │
│     factoryTypeName = "org.springframework.boot.       │
│         autoconfigure.EnableAutoConfiguration"          │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  2. 调用 loadSpringFactories(classLoader)               │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  3. 检查缓存 cache.get(classLoader)                      │
│     ├─ 命中 → 直接返回                                    │
│     └─ 未命中 → 继续加载                                  │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  4. 扫描所有jar包                                         │
│     classLoader.getResources(                           │
│         "META-INF/spring.factories")                    │
│     返回所有spring.factories文件的URL                     │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  5. 遍历每个spring.factories文件                         │
│     while (urls.hasMoreElements())                      │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  6. 加载Properties                                       │
│     PropertiesLoaderUtils.loadProperties(resource)      │
│     读取key=value内容                                     │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  7. 解析每个entry                                         │
│     for (entry : properties.entrySet())                 │
│         key = 接口名                                      │
│         values = 逗号分隔的实现类列表                      │
│         存入MultiValueMap                                │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  8. 合并所有文件的结果                                     │
│     result = {                                          │
│       "接口1": [实现1, 实现2, ...],                       │
│       "接口2": [实现3, 实现4, ...],                       │
│       ...                                               │
│     }                                                   │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  9. 放入缓存                                              │
│     cache.put(classLoader, result)                      │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  10. 返回指定接口的实现类列表                              │
│      result.get(factoryTypeName)                        │
└─────────────────────────────────────────────────────────┘


```

---

### 上下游流程关系图

#### 上游调用者(谁在用它)

下面我指举例了一些比较常见的,还有其他上游路径没有展示~

##### SpringBoot启动流程核心入口

流程如下:

SpringApplication构造器  
 ↓  
 setInitializers()  
 ↓  
 getSpringFactoriesInstances(ApplicationContextInitializer.class)  
 ↓  
 SpringFactoriesLoader.loadFactoryNames()

代码路径: `SpringApplication.java`

```
public SpringApplication(ResourceLoader resourceLoader, Class<?>... primarySources) {
    // ...
    
    // 上游调用1: 加载ApplicationContextInitializer
    setInitializers((Collection) getSpringFactoriesInstances(
        ApplicationContextInitializer.class));
    
    // 上游调用2: 加载ApplicationListener
    setListeners((Collection) getSpringFactoriesInstances(
        ApplicationListener.class));
}

private <T> Collection<T> getSpringFactoriesInstances(Class<T> type) {
    // 直接调用SpringFactoriesLoader
    return SpringFactoriesLoader.loadFactories(type, classLoader);
}


```

##### 自动配置核心流程

流程如下:

@EnableAutoConfiguration  
 ↓  
 AutoConfigurationImportSelector  
 ↓  
 getCandidateConfigurations()  
 ↓  
 SpringFactoriesLoader.loadFactoryNames(EnableAutoConfiguration.class)

代码路径: `AutoConfigurationImportSelector.java`

```
protected List<String> getCandidateConfigurations(AnnotationMetadata metadata,
                                                  AnnotationAttributes attributes) {
    // 核心调用: 加载所有自动配置类
    List<String> configurations = SpringFactoriesLoader.loadFactoryNames(
        getSpringFactoriesLoaderFactoryClass(), // EnableAutoConfiguration.class
        getBeanClassLoader());
    
    Assert.notEmpty(configurations, 
        "No auto configuration classes found in META-INF/spring.factories");
    return configurations;
}


```

#### 下游被加载内容(它加载了什么)

##### EnableAutoConfiguration - 自动配置类(最重要!)

spring.factories配置示例:

```
org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration,\
org.springframework.boot.autoconfigure.data.jdbc.JdbcTemplateAutoConfiguration,\
org.springframework.boot.autoconfigure.web.servlet.WebMvcAutoConfiguration,\
org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,\
org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration
# ... 130+ 个自动配置类


```

这些自动配置类会:

* 根据条件注解决定是否生效
* 自动创建Bean
* 配置默认属性

##### ApplicationContextInitializer - 容器初始化器

```
org.springframework.context.ApplicationContextInitializer=\
org.springframework.boot.context.ConfigurationWarningsApplicationContextInitializer,\
org.springframework.boot.context.ContextIdApplicationContextInitializer,\
org.springframework.boot.context.config.DelegatingApplicationContextInitializer


```

作用时机: 在容器刷新(refresh)之前执行

##### ApplicationListener - 应用监听器

```
org.springframework.context.ApplicationListener=\
org.springframework.boot.ClearCachesApplicationListener,\
org.springframework.boot.builder.ParentContextCloserApplicationListener,\
org.springframework.boot.context.FileEncodingApplicationListener,\
org.springframework.boot.context.logging.LoggingApplicationListener


```

作用: 监听Spring Boot启动过程中的各种事件

还有其他下游,不一一显示了,遇见应该也能认出来的.

#### 完整上下游调用链路图

```
┌────────────────────────────────────────────────────────────────┐
│                     Spring Boot 启动入口                          │
│                  SpringApplication.run()                        │
└───────────────────────────┬────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│                   上游调用者层                                     │
└────────────────────────────────────────────────────────────────┘
                            
    ┌───────────────────────┼───────────────────────┐
    ↓                       ↓                       ↓
┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐
│SpringApplication│    │AutoConfiguration │    │FailureAnalyzers │
│  构造器        │    │ ImportSelector   │    │                 │
└──────┬──────┘    └────────┬─────────┘    └────────┬────────┘
       │                    │                        │
       ↓                    ↓                        ↓
   加载初始化器            加载自动配置类          加载失败分析器
   和监听器

                            ↓
┌────────────────────────────────────────────────────────────────┐
│                     核心SPI加载层                                 │
│               SpringFactoriesLoader                             │
│                                                                  │
│  核心方法:                                                        │
│  • loadFactoryNames()  - 获取类名                                │
│  • loadFactories()     - 获取实例                                │
│  • loadSpringFactories() - 加载配置                              │
└───────────────────────┬────────────────────────────────────────┘
                        ↓
            扫描所有jar包的spring.factories
                        ↓
┌────────────────────────────────────────────────────────────────┐
│                   spring.factories 配置文件                       │
└────────────────────────────────────────────────────────────────┘
    
    ├─ spring-boot.jar!/META-INF/spring.factories
    ├─ spring-boot-autoconfigure.jar!/META-INF/spring.factories
    ├─ mybatis-spring-boot-starter.jar!/META-INF/spring.factories
    └─ 自定义jar!/META-INF/spring.factories

                        ↓
┌────────────────────────────────────────────────────────────────┐
│                   下游被加载内容层                                 │
└────────────────────────────────────────────────────────────────┘

┌──────────────────────┐  ┌──────────────────────┐  ┌─────────────────┐
│ 自动配置类             │  │ 容器初始化器           │  │ 事件监听器       │
│ EnableAutoConfiguration│  │ApplicationContext    │  │Application      │
│                       │  │Initializer           │  │Listener         │
├──────────────────────┤  ├──────────────────────┤  ├─────────────────┤
│• RedisAutoConfig     │  │• ConfigWarnings      │  │• Logging        │
│• WebMvcAutoConfig    │  │• ContextId           │  │• FileEncoding   │
│• DataSourceAutoConfig│  │• Delegating          │  │• ClearCaches    │
│• JpaAutoConfig       │  │                      │  │                 │
│  (130+ 个)           │  │                      │  │                 │
└──────────────────────┘  └──────────────────────┘  └─────────────────┘

┌──────────────────────┐  ┌──────────────────────┐  ┌─────────────────┐
│ 环境后置处理器         │  │ 配置文件加载器         │  │ 失败分析器       │
│EnvironmentPost       │  │PropertySource        │  │Failure          │
│Processor             │  │Loader                │  │Analyzer         │
├──────────────────────┤  ├──────────────────────┤  ├─────────────────┤
│• CloudFoundryVcap    │  │• PropertiesLoader    │  │• BeanCreation   │
│• JsonEnvironment     │  │• YamlLoader          │  │• BeanNotFound   │
│• SystemEnvironment   │  │                      │  │• CircularRef    │
└──────────────────────┘  └──────────────────────┘  └─────────────────┘

                        ↓
┌────────────────────────────────────────────────────────────────┐
│                   最终结果层                                      │
└────────────────────────────────────────────────────────────────┘

    • 容器初始化完成
    • 自动配置生效
    • Bean创建完成
    • 应用启动成功


```

#### 时序调用关系

```
时间线 (Spring Boot启动过程)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

T1: new SpringApplication()
    │
    ├─→ SpringFactoriesLoader.loadFactories(ApplicationContextInitializer.class)
    │   └─→ 加载: ConfigurationWarnings, ContextId, Delegating...
    │
    └─→ SpringFactoriesLoader.loadFactories(ApplicationListener.class)
        └─→ 加载: LoggingListener, FileEncodingListener...

T2: prepareEnvironment()
    │
    └─→ EnvironmentPostProcessorApplicationListener
        └─→ SpringFactoriesLoader.loadFactories(EnvironmentPostProcessor.class)
            └─→ 加载: CloudFoundryVcap, JsonEnvironment...

T3: prepareContext()
    │
    └─→ 执行所有ApplicationContextInitializer

T4: refreshContext()
    │
    └─→ @EnableAutoConfiguration触发
        └─→ AutoConfigurationImportSelector.getCandidateConfigurations()
            └─→ SpringFactoriesLoader.loadFactoryNames(EnableAutoConfiguration.class)
                └─→ 加载: RedisAutoConfiguration, WebMvcAutoConfiguration...
                    │
                    ├─→ 条件判断(@ConditionalOnClass, @ConditionalOnBean...)
                    ├─→ 创建Bean
                    └─→ 配置属性

T5: 启动失败(如果有)
    │
    └─→ FailureAnalyzers
        └─→ SpringFactoriesLoader.loadFactories(FailureAnalyzer.class)
            └─→ 分析失败原因并输出友好错误信息


```

### Spring SPI vs Java SPI对比总结

#### 核心区别表

| 对比项 | Java SPI | Spring SPI |
| --- | --- | --- |
| **配置文件** | `META-INF/services/接口名` | `META-INF/spring.factories` |
| **文件数量** | 每个接口一个文件 | 统一一个文件 |
| **文件格式** | 纯文本(每行一个类名) | Properties(key=value) |
| **加载类** | `ServiceLoader` | `SpringFactoriesLoader` |
| **获取方式** | 只能获取实例 | 可获取类名或实例 |
| **缓存机制** | 简单HashMap | ConcurrentReferenceHashMap(弱引用) |
| **实例化时机** | 遍历时立即实例化 | 可延迟实例化 |
| **排序支持** | ❌ | ✅ 支持@Order排序 |
| **条件过滤** | ❌ | ✅ 配合@Conditional使用 |

#### 代码对比

**场景: 获取所有自动配置类**  
 **Java SPI方式:**

```
// 1. 必须实例化才能获取
ServiceLoader<AutoConfiguration> loader =
    ServiceLoader.load(AutoConfiguration.class);

List<String> classNames = new ArrayList<>();
for (AutoConfiguration config : loader) {
    // ❌ 问题: 为了获取类名,所有实现都被实例化了
    classNames.add(config.getClass().getName());
}

// 2. 无法直接获取类名列表
// 3. 无法按需实例化


```

**Spring SPI方式:**

```
// 1. 只获取类名,不实例化
List<String> classNames = SpringFactoriesLoader.loadFactoryNames(
    EnableAutoConfiguration.class,
    getClass().getClassLoader()
);

// 2. 可以进行条件过滤
List<String> filtered = classNames.stream()
    .filter(name -> name.contains("Redis"))
    .collect(Collectors.toList());

// 3. 按需实例化
for (String className : filtered) {
    Class<?> clazz = Class.forName(className);
    Object instance = clazz.newInstance();
}

// 或者直接获取实例(会自动排序)
List<AutoConfiguration> instances = SpringFactoriesLoader.loadFactories(
    AutoConfiguration.class,
    getClass().getClassLoader()
);


```

---
