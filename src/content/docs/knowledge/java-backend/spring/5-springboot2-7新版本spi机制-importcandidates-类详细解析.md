---
title: "5 - SpringBoot2.7新版本SPI机制-ImportCandidates 类详细解析"
description: "ImportCandidates 是 Spring Boot 2.7+ 版本引入的自动配置类加载器,用于替代旧版 SpringFactoriesLoader 的部分功能。"
sourceId: "153470947"
source: "https://blog.csdn.net/qq_45852626/article/details/153470947"
sourceSeries:
  - "Spring核心模块解析"
category: java-backend
subcategory: spring
tags:
  - "Spring核心模块解析"
  - "Spring"
status: draft
difficulty: advanced
contentType: source-analysis
sidebar:
  order: 153470947
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/153470947)（历史文章导入，当前状态为草稿）

### 介绍

`ImportCandidates` 是 **Spring Boot 2.7+ 版本引入的自动配置类加载器**,用于替代旧版 `SpringFactoriesLoader` 的部分功能。

**主要职责:**

1. 从 `META-INF/spring/` 目录读取配置文件
2. 解析配置文件中的自动配置类全限定名
3. 支持注释过滤(#开头)和空行处理
4. 提供配置类候选列表供 Spring 容器导入

**文件位置:** `core/spring-boot/src/main/java/org/springframework/boot/context/annotation/ImportCandidates.java`

---

### 一、为什么会出现这个类?

#### 背景原因

##### 1. 旧机制的问题 (Spring Boot 2.7 之前)

```
配置路径: META-INF/spring.factories
格式: org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
      com.example.MyAutoConfig1,\
      com.example.MyAutoConfig2


```

**旧机制的缺陷:**

* 文件格式复杂,需要使用反斜杠续行
* 所有配置混在一个文件中,难以维护
* 不同 jar 包的配置会合并,容易冲突
* 不利于模块化管理

##### 2. 新机制的优势 (Spring Boot 2.7+)

```
配置路径: META-INF/spring/注解全限定名.imports
格式: 每行一个类名,简单清晰
      com.example.MyAutoConfig1
      com.example.MyAutoConfig2
      # 支持注释


```

**新机制的优点:**

* 文件格式简单,每行一个类名
* 按注解分类,文件职责单一
* 支持注释,便于文档说明
* 更好的模块化和可维护性

---

### 二、上下游关系图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Spring Boot 启动流程                        │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  @SpringBootApplication                                         │
│    └─ @EnableAutoConfiguration ◄────────────────────┐           │
│                                                      │           │
└──────────────────────────────────────────────────────┼───────────┘
                                  │                    │
                                  ▼                    │
┌─────────────────────────────────────────────────────┼───────────┐
│  AutoConfigurationImportSelector (上游调用者)        │           │
│    ├─ selectImports()                               │           │
│    └─ getAutoConfigurationEntry()                   │           │
│         └─ getCandidateConfigurations() ────────────┘           │
│              (AutoConfigurationImportSelector.java:200-210)     │
└──────────────────────────────────────────────────────┬───────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  ImportCandidates.load() ◄────────────────────────────────┐     │
│    (ImportCandidates.java:82)                             │     │
│    1. 构建配置文件路径                                      │     │
│       META-INF/spring/注解类名.imports                     │     │
│    2. 扫描类路径下所有匹配文件                              │     │
│    3. 读取并解析每个文件                                    │     │
│    4. 返回所有配置类名列表                                  │     │
└──────────────────────────────────────────────────────┬──────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  实际配置文件 (下游数据源)                                       │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ META-INF/spring/                                       │    │
│  │   org.springframework.boot.autoconfigure.             │    │
│  │       AutoConfiguration.imports                        │    │
│  │                                                         │    │
│  │ 内容示例:                                               │    │
│  │ org.springframework.boot.autoconfigure.admin...       │    │
│  │ org.springframework.boot.autoconfigure.aop...         │    │
│  │ # 数据库相关配置                                        │    │
│  │ org.springframework.boot.jdbc.autoconfigure...        │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  后续处理流程                                                     │
│    1. 过滤排除项 (exclusions)                                    │
│    2. 条件匹配 (@Conditional)                                   │
│    3. 排序 (AutoConfigurationSorter)                            │
│    4. 注册到 Spring 容器                                         │
└─────────────────────────────────────────────────────────────────┘


```

---

### 三、核心代码分析

#### 1. 调用入口 (上游)

**文件:** `AutoConfigurationImportSelector.java:200-210`

```
protected List<String> getCandidateConfigurations(
    AnnotationMetadata metadata,
    @Nullable AnnotationAttributes attributes) {

    // 核心调用: 加载自动配置候选类
    ImportCandidates importCandidates = ImportCandidates.load(
        this.autoConfigurationAnnotation,  // AutoConfiguration.class
        getBeanClassLoader()
    );

    List<String> configurations = importCandidates.getCandidates();

    // 断言: 确保至少有一个配置类
    Assert.state(!CollectionUtils.isEmpty(configurations),
        "No auto configuration classes found in META-INF/spring/"
        + this.autoConfigurationAnnotation.getName() + ".imports");

    return configurations;
}


```

#### 2. 加载逻辑 (ImportCandidates 核心方法)

**文件:** `ImportCandidates.java:82-93`

```
public static ImportCandidates load(Class<?> annotation, @Nullable ClassLoader classLoader) {
    // 1. 确定类加载器
    ClassLoader classLoaderToUse = decideClassloader(classLoader);

    // 2. 构建配置文件路径
    // 例如: META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
    String location = String.format(LOCATION, annotation.getName());

    // 3. 扫描类路径下所有匹配的文件
    Enumeration<URL> urls = findUrlsInClasspath(classLoaderToUse, location);

    // 4. 读取每个文件的内容
    List<String> importCandidates = new ArrayList<>();
    while (urls.hasMoreElements()) {
        URL url = urls.nextElement();
        importCandidates.addAll(readCandidateConfigurations(url));
    }

    return new ImportCandidates(importCandidates);
}


```

#### 3. 文件解析逻辑

**文件:** `ImportCandidates.java:111-129`

```
private static List<String> readCandidateConfigurations(URL url) {
    try (BufferedReader reader = new BufferedReader(
        new InputStreamReader(new UrlResource(url).getInputStream(), StandardCharsets.UTF_8))) {

        List<String> candidates = new ArrayList<>();
        String line;

        while ((line = reader.readLine()) != null) {
            line = stripComment(line);  // 移除 # 注释
            line = line.trim();

            if (line.isEmpty()) {       // 跳过空行
                continue;
            }

            candidates.add(line);       // 添加配置类名
        }

        return candidates;
    }
    catch (IOException ex) {
        throw new IllegalArgumentException("Unable to load configurations from location [" + url + "]", ex);
    }
}


```

#### 4. 注释处理

**文件:** `ImportCandidates.java:131-137`

```
private static String stripComment(String line) {
    int commentStart = line.indexOf(COMMENT_START);
    if (commentStart == -1) {
        return line;
    }
    return line.substring(0, commentStart);
}


```

---

### 四、实际配置文件示例

#### 1. 核心配置文件

**文件:** `core/spring-boot-autoconfigure/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`

```
# Admin 管理
org.springframework.boot.autoconfigure.admin.SpringApplicationAdminJmxAutoConfiguration

# AOP 支持
org.springframework.boot.autoconfigure.aop.AopAutoConfiguration

# 应用可用性
org.springframework.boot.autoconfigure.availability.ApplicationAvailabilityAutoConfiguration

# 配置属性
org.springframework.boot.autoconfigure.context.ConfigurationPropertiesAutoConfiguration
org.springframework.boot.autoconfigure.context.LifecycleAutoConfiguration
org.springframework.boot.autoconfigure.context.MessageSourceAutoConfiguration
org.springframework.boot.autoconfigure.context.PropertyPlaceholderAutoConfiguration

# 其他核心配置
org.springframework.boot.autoconfigure.info.ProjectInfoAutoConfiguration
org.springframework.boot.autoconfigure.jmx.JmxAutoConfiguration
org.springframework.boot.autoconfigure.ssl.SslAutoConfiguration
org.springframework.boot.autoconfigure.task.TaskExecutionAutoConfiguration
org.springframework.boot.autoconfigure.task.TaskSchedulingAutoConfiguration


```

#### 2. 模块化配置示例

**文件:** `module/spring-boot-jdbc/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`

```
org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration
org.springframework.boot.jdbc.autoconfigure.DataSourceInitializationAutoConfiguration
org.springframework.boot.jdbc.autoconfigure.DataSourceTransactionManagerAutoConfiguration
org.springframework.boot.jdbc.autoconfigure.JdbcClientAutoConfiguration
org.springframework.boot.jdbc.autoconfigure.JdbcTemplateAutoConfiguration
org.springframework.boot.jdbc.autoconfigure.JndiDataSourceAutoConfiguration
org.springframework.boot.jdbc.autoconfigure.XADataSourceAutoConfiguration
org.springframework.boot.jdbc.autoconfigure.health.DataSourceHealthContributorAutoConfiguration
org.springframework.boot.jdbc.autoconfigure.metrics.DataSourcePoolMetricsAutoConfiguration


```

---

### 五、新旧机制对比

| 对比项 | 旧机制 (spring.factories) | 新机制 (.imports) |
| --- | --- | --- |
| **配置路径** | `META-INF/spring.factories` | `META-INF/spring/注解名.imports` |
| **文件格式** | Properties 格式,需要续行符 `\` | 纯文本,每行一个类名 |
| **注释支持** | ❌ 不支持 | ✅ 支持 # 注释 |
| **模块化** | ❌ 所有配置混在一起 | ✅ 按注解分类管理 |
| **可维护性** | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **可读性** | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **兼容性** | Spring Boot < 2.7 | Spring Boot >= 2.7 |

#### 旧格式示例 (spring.factories)

```
# Auto Configure
org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
com.example.project.config.DatabaseAutoConfiguration,\
com.example.project.config.CacheAutoConfiguration,\
com.example.project.config.SecurityAutoConfiguration

# Application Listeners
org.springframework.context.ApplicationListener=\
com.example.project.listener.StartupListener,\
com.example.project.listener.ShutdownListener


```

#### 新格式示例 (.imports)

**文件1:** `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`

```
com.example.project.config.DatabaseAutoConfiguration
com.example.project.config.CacheAutoConfiguration
# 安全配置
com.example.project.config.SecurityAutoConfiguration


```

**文件2:** `META-INF/spring/org.springframework.context.ApplicationListener.imports`

```
# 启动监听器
com.example.project.listener.StartupListener
# 关闭监听器
com.example.project.listener.ShutdownListener


```

---

### 六、工作流程时序图

```
用户应用启动
    │
    ├─→ @SpringBootApplication
    │       │
    │       └─→ @EnableAutoConfiguration
    │               │
    │               └─→ @Import(AutoConfigurationImportSelector.class)
    │                       │
    │                       ├─→ selectImports()
    │                       │       │
    │                       │       └─→ getAutoConfigurationEntry()
    │                       │               │
    │                       │               └─→ getCandidateConfigurations()
    │                       │                       │
    │                       │                       └─→ ImportCandidates.load()
    │                       │                               │
    │                       │                               ├─→ 构建路径: META-INF/spring/...
    │                       │                               ├─→ 扫描所有 jar 包
    │                       │                               ├─→ 读取配置文件
    │                       │                               │   (readCandidateConfigurations)
    │                       │                               │       │
    │                       │                               │       ├─→ 逐行读取
    │                       │                               │       ├─→ 移除注释 (stripComment)
    │                       │                               │       ├─→ 去除空行
    │                       │                               │       └─→ 收集类名
    │                       │                               │
    │                       │                               └─→ 返回类名列表
    │                       │
    │                       ├─→ 应用过滤条件 (@Conditional)
    │                       ├─→ 排除指定配置 (exclude)
    │                       ├─→ 排序配置类 (AutoConfigurationSorter)
    │                       └─→ 注册到 Spring 容器
    │
    └─→ 应用启动完成


```

---

### 七、关键设计特点

#### 1. 不可变设计

```
private ImportCandidates(List<String> candidates) {
    Assert.notNull(candidates, "'candidates' must not be null");
    // 使用不可变列表,防止外部修改
    this.candidates = Collections.unmodifiableList(candidates);
}


```

#### 2. 迭代器支持

```
public final class ImportCandidates implements Iterable<String> {

    @Override
    public Iterator<String> iterator() {
        return this.candidates.iterator();
    }

    // 使用示例
    ImportCandidates candidates = ImportCandidates.load(...);
    for (String className : candidates) {
        // 处理每个配置类
    }
}


```

#### 3. 异常处理

```
// 文件路径查找失败
private static Enumeration<URL> findUrlsInClasspath(ClassLoader classLoader, String location) {
    try {
        return classLoader.getResources(location);
    }
    catch (IOException ex) {
        throw new IllegalArgumentException(
            "Failed to load configurations from location [" + location + "]", ex);
    }
}

// 文件内容读取失败
private static List<String> readCandidateConfigurations(URL url) {
    try (BufferedReader reader = ...) {
        // ... 读取逻辑
    }
    catch (IOException ex) {
        throw new IllegalArgumentException(
            "Unable to load configurations from location [" + url + "]", ex);
    }
}


```

#### 4. 静态工厂方法

```
// 使用静态工厂方法而非公共构造函数
public static ImportCandidates load(Class<?> annotation, @Nullable ClassLoader classLoader) {
    // ... 加载逻辑
    return new ImportCandidates(importCandidates);
}

// 私有构造函数
private ImportCandidates(List<String> candidates) {
    // ...
}


```

---

### 八、完整的自动配置加载流程

#### 阶段1: 配置文件扫描

```
1. Spring Boot 启动
   └─→ 扫描 classpath 下所有 jar 包
       └─→ 查找 META-INF/spring/*.imports 文件
           └─→ 可能找到多个同名文件(来自不同 jar)


```

#### 阶段2: 配置类收集

```
2. ImportCandidates.load() 调用
   ├─→ 读取所有匹配的 .imports 文件
   ├─→ 解析每个文件内容
   │   ├─→ 逐行读取
   │   ├─→ 移除 # 注释
   │   ├─→ 过滤空行
   │   └─→ 收集类名
   └─→ 合并所有配置类列表


```

#### 阶段3: 配置类过滤

```
3. AutoConfigurationImportSelector 处理
   ├─→ 移除重复项 (removeDuplicates)
   ├─→ 获取排除列表 (getExclusions)
   │   ├─→ @EnableAutoConfiguration(exclude=...)
   │   ├─→ @EnableAutoConfiguration(excludeName=...)
   │   └─→ spring.autoconfigure.exclude 属性
   ├─→ 应用排除规则 (configurations.removeAll(exclusions))
   └─→ 条件过滤 (@Conditional)
       ├─→ @ConditionalOnClass
       ├─→ @ConditionalOnBean
       ├─→ @ConditionalOnProperty
       └─→ 其他条件注解


```

#### 阶段4: 配置类排序与注册

```
4. 最终处理
   ├─→ 排序 (AutoConfigurationSorter)
   │   ├─→ @AutoConfigureBefore
   │   ├─→ @AutoConfigureAfter
   │   └─→ @AutoConfigureOrder
   ├─→ 触发事件 (fireAutoConfigurationImportEvents)
   └─→ 注册到 Spring 容器


```

---

### 九、常见使用场景

#### 1. 自定义自动配置

**步骤1: 创建自动配置类**

```
package com.example.myproject.autoconfigure;

@AutoConfiguration
@ConditionalOnClass(MyService.class)
public class MyServiceAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public MyService myService() {
        return new MyServiceImpl();
    }
}


```

**步骤2: 创建配置文件**

创建文件: `src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`

```
# 我的自定义服务自动配置
com.example.myproject.autoconfigure.MyServiceAutoConfiguration


```

**步骤3: 打包为 jar**

其他项目引入该 jar 后,`MyServiceAutoConfiguration` 会自动生效。

#### 2. 测试自动配置

```
package com.example.myproject.autoconfigure;

@AutoConfiguration
public class TestAutoConfiguration {

    @Bean
    public TestBean testBean() {
        return new TestBean();
    }
}


```

创建测试配置文件: `src/test/resources/META-INF/spring/org.springframework.boot.test.autoconfigure.MyTest.imports`

```
com.example.myproject.autoconfigure.TestAutoConfiguration


```

---

### 十、迁移指南 (从 spring.factories 到 .imports)

#### 迁移前 (旧方式)

**文件:** `META-INF/spring.factories`

```
org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
com.example.config.DatabaseConfig,\
com.example.config.CacheConfig,\
com.example.config.SecurityConfig

org.springframework.boot.env.EnvironmentPostProcessor=\
com.example.processor.CustomEnvironmentPostProcessor


```

#### 迁移后 (新方式)

**文件1:** `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`

```
com.example.config.DatabaseConfig
com.example.config.CacheConfig
com.example.config.SecurityConfig


```

**文件2:** `META-INF/spring/org.springframework.boot.env.EnvironmentPostProcessor.imports`

```
com.example.processor.CustomEnvironmentPostProcessor


```

#### 迁移注意事项

1. ✅ **保持向后兼容**: Spring Boot 2.7+ 同时支持两种方式
2. ✅ **逐步迁移**: 可以先保留 spring.factories,新配置使用 .imports
3. ✅ **按类型拆分**: 将不同类型的配置拆分到不同的 .imports 文件
4. ⚠️ **文件名规则**: 文件名必须是注解的完全限定名 + `.imports`
5. ⚠️ **编码格式**: 使用 UTF-8 编码
6. ⚠️ **换行符**: 使用系统默认换行符即可

---

### 十一、调试技巧

#### 1. 查看加载的配置类

```
@SpringBootApplication
public class Application {

    public static void main(String[] args) {
        // 启用 debug 模式
        SpringApplication app = new SpringApplication(Application.class);
        app.setLogStartupInfo(true);
        app.run(args);
    }
}


```

在 `application.properties` 中添加:

```
# 启用自动配置报告
debug=true


```

#### 2. 断点调试

在以下位置设置断点:

* `ImportCandidates.load()` - 查看加载过程
* `ImportCandidates.readCandidateConfigurations()` - 查看文件解析
* `AutoConfigurationImportSelector.getCandidateConfigurations()` - 查看配置获取
* `AutoConfigurationImportSelector.getAutoConfigurationEntry()` - 查看过滤过程

#### 3. 日志输出

添加日志配置:

```
logging.level.org.springframework.boot.autoconfigure=DEBUG
logging.level.org.springframework.boot.context.annotation=TRACE


```
