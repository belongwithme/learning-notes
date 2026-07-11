---
title: "3-Spring - @Import 机制详解"
description: "@Import注解用于导入一个或多个组件类，通常是@Configuration配置类。它提供了类似于"
sourceId: "153630729"
source: "https://blog.csdn.net/qq_45852626/article/details/153630729"
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
  order: 153630729
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/153630729)（历史文章导入，当前状态为草稿）

## @Import注解简介

`@Import`注解用于导入一个或多个组件类，通常是`@Configuration`配置类。它提供了类似于
Spring
 XML中`<import/>`元素的功能。

**位置:** `spring-context/src/main/java/org/springframework/context/annotation/Import.java:56`

```
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface Import {
    Class<?>[] value();  // 可以导入的类型
}


```

---

##@Import支持的三种导入类型

根据源码 `Import.java:59-60`，`@Import`可以导入以下类型：

1. **普通的@Configuration配置类或组件类** - 直接导入配置类
2. **ImportSelector接口实现类** - 动态选择要导入的配置类
3. **ImportBeanDefinitionRegistrar接口实现类** - 直接注册BeanDefinition

---

## 核心接口详解

### 1. 普通配置类导入

这是最简单直接的方式，直接导入配置类。

**代码示例：**

```
// 步骤1：定义配置类
@Configuration
public class DatabaseConfig {

    @Bean
    public DataSource dataSource() {
        HikariDataSource dataSource = new HikariDataSource();
        dataSource.setJdbcUrl("jdbc:mysql://localhost:3306/mydb");
        dataSource.setUsername("root");
        dataSource.setPassword("password");
        System.out.println("创建 DataSource Bean");
        return dataSource;
    }
}

@Configuration
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        System.out.println("创建 CacheManager Bean");
        return new ConcurrentMapCacheManager("users", "products");
    }
}

// 步骤2：使用 @Import 直接导入配置类
@Configuration
@Import({DatabaseConfig.class, CacheConfig.class})  // 导入多个配置类
public class AppConfig {

    @Bean
    public UserService userService() {
        return new UserService();
    }
}

// 测试代码
@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        ApplicationContext context = SpringApplication.run(Application.class, args);

        // 可以获取到 DatabaseConfig 和 CacheConfig 中定义的 Bean
        DataSource dataSource = context.getBean(DataSource.class);
        CacheManager cacheManager = context.getBean(CacheManager.class);

        System.out.println("DataSource: " + dataSource);
        System.out.println("CacheManager: " + cacheManager);
    }
}


```

**运行结果：**

```
创建 DataSource Bean
创建 CacheManager Bean
DataSource: HikariDataSource (...)
CacheManager: ConcurrentMapCacheManager (...)


```

---

### 2. ImportSelector接口

**位置:** ImportSelector.java:61

```
public interface ImportSelector {
    // 返回要导入的类名数组
    String[] selectImports(AnnotationMetadata importingClassMetadata);

    // 返回排除过滤器（可选）
    @Nullable
    default Predicate<String> getExclusionFilter() {
        return null;
    }
}


```

**特点：**

* 可以根据导入类的注解元数据动态决定导入哪些类
* 支持实现Aware接口（EnvironmentAware、BeanFactoryAware等）
* 处理时机：通常在配置类解析时立即处理
* **最大优势：** 可以根据条件动态选择导入哪些配置

**完整代码示例：**

```
// 步骤1：定义需要被导入的配置类
@Configuration
public class RedisConfig {

    @Bean
    public RedisTemplate<String, Object> redisTemplate() {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        System.out.println("RedisConfig 被导入，创建 RedisTemplate Bean");
        // 配置redis连接等
        return template;
    }
}

@Configuration
public class KafkaConfig {

    @Bean
    public KafkaTemplate<String, Object> kafkaTemplate() {
        System.out.println("KafkaConfig 被导入，创建 KafkaTemplate Bean");
        return new KafkaTemplate<>(new DefaultKafkaProducerFactory<>(new HashMap<>()));
    }
}

@Configuration
public class RabbitMQConfig {

    @Bean
    public RabbitTemplate rabbitTemplate() {
        System.out.println("RabbitMQConfig 被导入，创建 RabbitTemplate Bean");
        return new RabbitTemplate();
    }
}

// 步骤2：实现 ImportSelector，动态选择导入哪些配置类
public class MessageQueueSelector implements ImportSelector, EnvironmentAware {

    private Environment environment;

    @Override
    public void setEnvironment(Environment environment) {
        this.environment = environment;
        System.out.println("注入了 Environment，可以读取配置文件");
    }

    @Override
    public String[] selectImports(AnnotationMetadata importingClassMetadata) {
        // importingClassMetadata 包含了使用@Import注解的类的元数据

        // 方式1：获取自定义注解的属性值
        Map<String, Object> attributes = importingClassMetadata
            .getAnnotationAttributes(EnableMessageQueue.class.getName());

        if (attributes != null) {
            String type = (String) attributes.get("type");
            System.out.println("从注解获取配置：type = " + type);

            // 根据注解属性动态返回配置类
            if ("redis".equalsIgnoreCase(type)) {
                return new String[]{"com.example.config.RedisConfig"};
            } else if ("kafka".equalsIgnoreCase(type)) {
                return new String[]{"com.example.config.KafkaConfig"};
            } else if ("rabbitmq".equalsIgnoreCase(type)) {
                return new String[]{"com.example.config.RabbitMQConfig"};
            }
        }

        // 方式2：从配置文件读取属性
        String mqType = environment.getProperty("message.queue.type", "redis");
        System.out.println("从配置文件获取：message.queue.type = " + mqType);

        switch (mqType.toLowerCase()) {
            case "kafka":
                return new String[]{"com.example.config.KafkaConfig"};
            case "rabbitmq":
                return new String[]{"com.example.config.RabbitMQConfig"};
            case "redis":
            default:
                return new String[]{"com.example.config.RedisConfig"};
        }
    }
}

// 步骤3：定义启用注解
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Import(MessageQueueSelector.class)  // 使用 @Import 导入 ImportSelector
public @interface EnableMessageQueue {
    String type() default "redis";  // 默认使用 redis
}

// 步骤4：在主配置类上使用自定义注解
@Configuration
@EnableMessageQueue(type = "kafka")  // 将会导入 KafkaConfig
public class AppConfig {

    @Bean
    public MyService myService() {
        return new MyService();
    }
}

// 或者通过配置文件控制（application.properties）
// message.queue.type=rabbitmq


```

**运行结果：**

```
注入了 Environment，可以读取配置文件
从注解获取配置：type = kafka
KafkaConfig 被导入，创建 KafkaTemplate Bean


```

**Spring 实际使用示例:** `@EnableAsync`

```
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Import(AsyncConfigurationSelector.class)
public @interface EnableAsync {
    boolean proxyTargetClass() default false;
    AdviceMode mode() default AdviceMode.PROXY;  // 可以选择代理模式
    int order() default Ordered.LOWEST_PRECEDENCE;
}

// AsyncConfigurationSelector 根据 mode 属性选择不同的配置类
public class AsyncConfigurationSelector extends AdviceModeImportSelector<EnableAsync> {

    @Override
    public String[] selectImports(AdviceMode adviceMode) {
        switch (adviceMode) {
            case PROXY:
                // 使用 JDK 代理或 CGLIB 代理
                return new String[]{ProxyAsyncConfiguration.class.getName()};
            case ASPECTJ:
                // 使用 AspectJ 编译时织入
                return new String[]{ASYNC_EXECUTION_ASPECT_CONFIGURATION_CLASS_NAME};
            default:
                return null;
        }
    }
}


```

---

### 3. DeferredImportSelector接口（延迟导入）

**位置:** DeferredImportSelector.java:38

```
public interface DeferredImportSelector extends ImportSelector {

    // 返回分组（可选）
    @Nullable
    default Class<? extends Group> getImportGroup() {
        return null;
    }

    interface Group {
        void process(AnnotationMetadata metadata, DeferredImportSelector selector);
        Iterable<Entry> selectImports();
    }
}


```

**特点：**

* `ImportSelector`的变体，在**所有@Configuration类处理完成后才执行**
* 特别适合处理带`@Conditional`条件的导入
* 支持分组处理和排序
* **Spring Boot自动配置的核心机制**

**完整代码示例：**

```
// 步骤1：定义配置类
@Configuration
public class MongoDBConfig {

    @Bean
    @ConditionalOnMissingBean
    public MongoTemplate mongoTemplate() {
        System.out.println("创建 MongoTemplate Bean");
        return new MongoTemplate(null, "testdb");
    }
}

@Configuration
public class MySQLConfig {

    @Bean
    @ConditionalOnMissingBean(DataSource.class)
    public DataSource dataSource() {
        System.out.println("创建 MySQL DataSource Bean");
        return new HikariDataSource();
    }
}

// 步骤2：实现 DeferredImportSelector
public class DatabaseDeferredImportSelector implements DeferredImportSelector {

    @Override
    public String[] selectImports(AnnotationMetadata importingClassMetadata) {
        System.out.println("DeferredImportSelector 执行：此时所有配置类都已处理完毕");

        // 可以安全地根据容器中已有的Bean来决定是否导入新配置
        return new String[]{
            "com.example.config.MongoDBConfig",
            "com.example.config.MySQLConfig"
        };
    }
}

// 步骤3：使用注解
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Import(DatabaseDeferredImportSelector.class)
public @interface EnableAutoDatabase {
}

@Configuration
@EnableAutoDatabase
public class AppConfig {

    // 如果这里已经定义了 DataSource，MySQLConfig 就不会再创建
    @Bean
    public DataSource customDataSource() {
        System.out.println("用户自定义 DataSource");
        return new HikariDataSource();
    }
}


```

**运行结果：**

```
用户自定义 DataSource
DeferredImportSelector 执行：此时所有配置类都已处理完毕
创建 MongoTemplate Bean
// 注意：MySQL DataSource 不会创建，因为 @ConditionalOnMissingBean 检测到已存在


```

**Spring Boot 自动配置原理：**

```
// Spring Boot 的 @EnableAutoConfiguration 注解
@Import(AutoConfigurationImportSelector.class)
public @interface EnableAutoConfiguration {
    // ...
}

// AutoConfigurationImportSelector 是 DeferredImportSelector 的实现
public class AutoConfigurationImportSelector implements DeferredImportSelector {

    @Override
    public String[] selectImports(AnnotationMetadata annotationMetadata) {
        // 从 META-INF/spring.factories 读取所有自动配置类
        List<String> configurations = getCandidateConfigurations(annotationMetadata, attributes);

        // 去重、排除、过滤
        configurations = removeDuplicates(configurations);
        configurations = filter(configurations);

        return configurations.toArray(new String[0]);
    }
}


```

---

### 4. ImportBeanDefinitionRegistrar接口

**位置:** ImportBeanDefinitionRegistrar.java:61

```
public interface ImportBeanDefinitionRegistrar {

    // 注册BeanDefinition
    default void registerBeanDefinitions(
        AnnotationMetadata importingClassMetadata,
        BeanDefinitionRegistry registry,
        BeanNameGenerator importBeanNameGenerator) {

        registerBeanDefinitions(importingClassMetadata, registry);
    }

    // 兼容旧版本的方法
    default void registerBeanDefinitions(
        AnnotationMetadata importingClassMetadata,
        BeanDefinitionRegistry registry) {
    }
}


```

**特点：**

* 在BeanDefinition级别操作，**最灵活、最底层**
* 可以直接向容器注册BeanDefinition
* 适合需要精确控制Bean注册的场景
* 可以动态生成BeanDefinition

**完整代码示例：**

```
// 步骤1：定义一个普通类（不需要任何注解）
public class CustomService {
    private String name;
    private String version;

    public CustomService(String name, String version) {
        this.name = name;
        this.version = version;
    }

    public void printInfo() {
        System.out.println("CustomService - Name: " + name + ", Version: " + version);
    }
}

// 步骤2：实现 ImportBeanDefinitionRegistrar
public class CustomServiceRegistrar implements ImportBeanDefinitionRegistrar {

    @Override
    public void registerBeanDefinitions(
            AnnotationMetadata importingClassMetadata,
            BeanDefinitionRegistry registry) {

        System.out.println("开始注册自定义 BeanDefinition");

        // 获取注解属性
        Map<String, Object> attributes = importingClassMetadata
            .getAnnotationAttributes(EnableCustomService.class.getName());

        String serviceName = (String) attributes.get("name");
        String version = (String) attributes.get("version");
        int count = (int) attributes.get("count");

        // 动态注册多个Bean
        for (int i = 0; i < count; i++) {
            // 创建 BeanDefinition
            BeanDefinitionBuilder builder = BeanDefinitionBuilder
                .genericBeanDefinition(CustomService.class);

            // 设置构造函数参数
            builder.addConstructorArgValue(serviceName + "-" + i);
            builder.addConstructorArgValue(version);

            // 设置作用域
            builder.setScope(BeanDefinition.SCOPE_SINGLETON);

            // 注册到容器
            String beanName = "customService" + i;
            registry.registerBeanDefinition(beanName, builder.getBeanDefinition());

            System.out.println("注册 Bean: " + beanName);
        }

        // 还可以检查容器中是否已存在某个Bean
        if (!registry.containsBeanDefinition("specialService")) {
            BeanDefinitionBuilder builder = BeanDefinitionBuilder
                .genericBeanDefinition(CustomService.class);
            builder.addConstructorArgValue("special");
            builder.addConstructorArgValue("1.0.0");

            registry.registerBeanDefinition("specialService", builder.getBeanDefinition());
            System.out.println("注册特殊 Bean: specialService");
        }
    }
}

// 步骤3：定义启用注解
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Import(CustomServiceRegistrar.class)
public @interface EnableCustomService {
    String name() default "myService";
    String version() default "1.0.0";
    int count() default 3;  // 注册几个Bean实例
}

// 步骤4：使用注解
@Configuration
@EnableCustomService(name = "userService", version = "2.0.0", count = 3)
public class AppConfig {
}

// 测试代码
@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        ApplicationContext context = SpringApplication.run(Application.class, args);

        // 获取动态注册的Bean
        CustomService service0 = context.getBean("customService0", CustomService.class);
        CustomService service1 = context.getBean("customService1", CustomService.class);
        CustomService service2 = context.getBean("customService2", CustomService.class);
        CustomService special = context.getBean("specialService", CustomService.class);

        service0.printInfo();  // 输出: CustomService - Name: userService-0, Version: 2.0.0
        service1.printInfo();  // 输出: CustomService - Name: userService-1, Version: 2.0.0
        service2.printInfo();  // 输出: CustomService - Name: userService-2, Version: 2.0.0
        special.printInfo();   // 输出: CustomService - Name: special, Version: 1.0.0
    }
}


```

**运行结果：**

```
开始注册自定义 BeanDefinition
注册 Bean: customService0
注册 Bean: customService1
注册 Bean: customService2
注册特殊 Bean: specialService
CustomService - Name: userService-0, Version: 2.0.0
CustomService - Name: userService-1, Version: 2.0.0
CustomService - Name: userService-2, Version: 2.0.0
CustomService - Name: special, Version: 1.0.0


```

**MyBatis 的 @MapperScan 实现原理：**

```
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
@Import(MapperScannerRegistrar.class)
public @interface MapperScan {
    String[] basePackages();  // 扫描的包路径
}

public class MapperScannerRegistrar implements ImportBeanDefinitionRegistrar {

    @Override
    public void registerBeanDefinitions(AnnotationMetadata importingClassMetadata,
                                       BeanDefinitionRegistry registry) {
        // 获取 @MapperScan 的 basePackages 属性
        AnnotationAttributes attributes = AnnotationAttributes
            .fromMap(importingClassMetadata.getAnnotationAttributes(MapperScan.class.getName()));

        String[] basePackages = attributes.getStringArray("basePackages");

        // 创建 ClassPathMapperScanner 扫描指定包下的接口
        ClassPathMapperScanner scanner = new ClassPathMapperScanner(registry);
        scanner.scan(basePackages);  // 动态注册所有 Mapper 接口的代理对象
    }
}


```

---

## @Import处理流程

核心处理逻辑在 **ConfigurationClassParser.processImports()** 方法中  
 （ConfigurationClassParser.java:553-616）：

```
private void processImports(ConfigurationClass configClass,
                           SourceClass currentSourceClass,
                           Collection<SourceClass> importCandidates,
                           Predicate<String> exclusionFilter,
                           boolean checkForCircularImports) {

    // 1. 检查循环导入
    if (checkForCircularImports && isChainedImportOnStack(configClass)) {
        this.problemReporter.error(
            new CircularImportProblem(configClass, this.importStack)
        );
        return;
    }

    // 2. 将当前配置类压入导入栈（用于检测循环依赖）
    this.importStack.push(configClass);

    try {
        for (SourceClass candidate : importCandidates) {
            // 3. 判断候选类型并分别处理

            // 情况1：ImportSelector 接口
            if (candidate.isAssignable(ImportSelector.class)) {
                Class<?> candidateClass = candidate.loadClass();
                ImportSelector selector = ParserStrategyUtils
                    .instantiateClass(candidateClass, ImportSelector.class);

                // 调用 Aware 接口方法
                invokeAwareMethods(selector);

                // 判断是否为 DeferredImportSelector
                if (selector instanceof DeferredImportSelector) {
                    // 延迟处理：添加到延迟处理器中
                    this.deferredImportSelectorHandler.handle(
                        configClass, (DeferredImportSelector) selector
                    );
                } else {
                    // 立即处理：调用 selectImports 获取要导入的类
                    String[] importClassNames = selector.selectImports(
                        currentSourceClass.getMetadata()
                    );

                    // 递归调用 processImports 处理返回的类
                    Collection<SourceClass> importSourceClasses =
                        asSourceClasses(importClassNames, exclusionFilter);
                    processImports(configClass, currentSourceClass,
                                  importSourceClasses, exclusionFilter, false);
                }
            }
            // 情况2：ImportBeanDefinitionRegistrar 接口
            else if (candidate.isAssignable(ImportBeanDefinitionRegistrar.class)) {
                Class<?> candidateClass = candidate.loadClass();
                ImportBeanDefinitionRegistrar registrar = ParserStrategyUtils
                    .instantiateClass(candidateClass, ImportBeanDefinitionRegistrar.class);

                // 调用 Aware 接口方法
                invokeAwareMethods(registrar);

                // 将 registrar 添加到配置类中，稍后统一调用
                configClass.addImportBeanDefinitionRegistrar(
                    registrar, currentSourceClass.getMetadata()
                );
            }
            // 情况3：普通配置类
            else {
                // 当作配置类处理：递归解析该类
                this.importStack.registerImport(
                    currentSourceClass.getMetadata(),
                    candidate.getMetadata().getClassName()
                );
                processConfigurationClass(
                    candidate.asConfigClass(configClass), exclusionFilter
                );
            }
        }
    } finally {
        // 4. 处理完成后从导入栈中弹出
        this.importStack.pop();
    }
}


```

**处理流程图：**

```
@Import 注解
    ↓
ConfigurationClassParser 解析
    ↓
processImports() 方法
    ↓
判断导入类型
    ├─→ ImportSelector？
    │       ├─→ DeferredImportSelector？ → 延迟处理（加入队列）
    │       └─→ 普通 ImportSelector → 立即执行 selectImports() → 递归处理返回的类
    │
    ├─→ ImportBeanDefinitionRegistrar？ → 保存到配置类，稍后注册 BeanDefinition
    │
    └─→ 普通配置类？ → 当作 @Configuration 递归解析


```

---

## 处理时序

### 完整的配置类解析顺序

**位置:** `ConfigurationClassParser.parse() - ConfigurationClassParser.java:170`

```
1. 解析 @PropertySource 注解
   ↓
2. 解析 @ComponentScan 注解（扫描并注册组件）
   ↓
3. 解析 @Import 注解 ← 我们关注的重点
   ├─ 普通 ImportSelector：立即执行
   └─ DeferredImportSelector：加入延迟队列
   ↓
4. 解析 @ImportResource 注解（导入 XML 配置）
   ↓
5. 解析 @Bean 方法
   ↓
6. 处理接口的默认方法
   ↓
7. 处理父类（递归）
   ↓
8. 最后：执行所有 DeferredImportSelector（parse():193）


```

**代码示例展示执行顺序：**

```
// 定义各种 Selector 来观察执行顺序
public class FirstImportSelector implements ImportSelector {
    @Override
    public String[] selectImports(AnnotationMetadata metadata) {
        System.out.println("1. FirstImportSelector 执行（立即执行）");
        return new String[]{};
    }
}

public class SecondImportSelector implements ImportSelector {
    @Override
    public String[] selectImports(AnnotationMetadata metadata) {
        System.out.println("2. SecondImportSelector 执行（立即执行）");
        return new String[]{};
    }
}

public class FirstDeferredSelector implements DeferredImportSelector {
    @Override
    public String[] selectImports(AnnotationMetadata metadata) {
        System.out.println("5. FirstDeferredSelector 执行（延迟执行）");
        return new String[]{};
    }
}

public class SecondDeferredSelector implements DeferredImportSelector {
    @Override
    public String[] selectImports(AnnotationMetadata metadata) {
        System.out.println("6. SecondDeferredSelector 执行（延迟执行）");
        return new String[]{};
    }
}

@Configuration
@Import({
    FirstImportSelector.class,
    SecondImportSelector.class,
    FirstDeferredSelector.class,
    SecondDeferredSelector.class
})
public class AppConfig {

    public AppConfig() {
        System.out.println("3. AppConfig 构造函数执行");
    }

    @Bean
    public String myBean() {
        System.out.println("4. @Bean 方法执行");
        return "test";
    }
}


```

**运行结果：**

```
1. FirstImportSelector 执行（立即执行）
2. SecondImportSelector 执行（立即执行）
3. AppConfig 构造函数执行
4. @Bean 方法执行
5. FirstDeferredSelector 执行（延迟执行）
6. SecondDeferredSelector 执行（延迟执行）


```

### 循环导入检测

Spring 通过 **ImportStack** 跟踪导入链，防止循环依赖：

```
// 示例：循环导入会被检测
@Configuration
@Import(ConfigB.class)
public class ConfigA {
}

@Configuration
@Import(ConfigA.class)  // 循环导入！
public class ConfigB {
}

// Spring 会抛出异常：
// IllegalStateException: Configuration class 'ConfigA' imports itself


```

---

## 典型应用场景

### 1. 条件化配置

根据不同环境或条件导入不同配置类。

```
public class EnvironmentImportSelector implements ImportSelector {

    @Override
    public String[] selectImports(AnnotationMetadata metadata) {
        String env = System.getProperty("spring.profiles.active", "dev");

        switch (env) {
            case "prod":
                return new String[]{"com.example.config.ProdConfig"};
            case "test":
                return new String[]{"com.example.config.TestConfig"};
            default:
                return new String[]{"com.example.config.DevConfig"};
        }
    }
}


```

### 2. 模块化 集成 - 自定义 @EnableXxx 注解

模仿 Spring 的 `@EnableAsync`、`@EnableCaching` 等注解。

```
// 启用短信服务模块
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Import(SmsConfiguration.class)
public @interface EnableSmsService {
    SmsProvider provider() default SmsProvider.ALIYUN;
}

// 短信配置类
@Configuration
public class SmsConfiguration {

    @Bean
    public SmsService smsService() {
        return new SmsServiceImpl();
    }
}

// 使用
@SpringBootApplication
@EnableSmsService(provider = SmsProvider.TENCENT)
public class Application {
}


```

### 3. Spring Boot 自动配置

Spring Boot 的核心机制。

```
// spring.factories 文件内容：
org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
com.example.autoconfigure.RedisAutoConfiguration,\
com.example.autoconfigure.KafkaAutoConfiguration

// 自动配置类
@Configuration
@ConditionalOnClass(RedisTemplate.class)  // 只有存在 RedisTemplate 类时才生效
@EnableConfigurationProperties(RedisProperties.class)
public class RedisAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean  // 用户没有自定义时才创建
    public RedisTemplate<Object, Object> redisTemplate() {
        return new RedisTemplate<>();
    }
}


```

### 4. 动态 Bean 注册 - MyBatis Mapper 扫描

```
@Configuration
@MapperScan("com.example.mapper")  // 扫描 Mapper 接口
public class MyBatisConfig {
    // MapperScannerRegistrar 会动态为每个接口创建代理对象并注册为Bean
}


```

---

## 三种方式的对比

| 特性 | 普通配置类 | ImportSelector | ImportBeanDefinitionRegistrar |
| --- | --- | --- | --- |
| **复杂度** | ⭐ 简单 | ⭐⭐ 中等 | ⭐⭐⭐ 复杂 |
| **灵活性** | 低 | 中 | 高 |
| **使用场景** | 固定的配置导入 | 动态选择配置类 | 动态注册Bean定义 |
| **是否需要编写类** | 直接导入现有类 | 需要实现接口 | 需要实现接口 |
| **是否可以条件判断** | 否 | 是 | 是 |
| **操作级别** | 类级别 | 类级别 | BeanDefinition级别 |
| **典型应用** | 简单配置导入 | @EnableAsync / 条件配置 | @MapperScan / 动态代理注册 |

**选择建议：**

* 如果只是导入固定的配置类 → 使用**普通配置类**
* 如果需要根据条件选择导入哪些配置类 → 使用 **ImportSelector**
* 如果需要精确控制 Bean 的注册过程 → 使用 **ImportBeanDefinitionRegistrar**

---

## 关键要点总结

1. **@Import 是 Spring 模块化配置的核心机制**

   * 提供了比 XML 更灵活的配置导入方式
   * 支持编程式的动态配置
2. **支持三种导入方式，灵活性递增**

   * 普通类：直接导入
   * ImportSelector：动态选择
   * ImportBeanDefinitionRegistrar：精确控制
3. **内置循环导入检测保证配置安全**

   * 使用 ImportStack 追踪导入链
   * 自动检测并报告循环依赖
4. **DeferredImportSelector 为条件配置提供了完美解决方案**

   * 延迟到所有配置类处理完成后执行
   * Spring Boot 自动配置的基础
5. **整个机制基于 ASM 避免了反射和类的提前加载**

   * 使用字节码技术读取类信息
   * 不会触发类的初始化
6. **@Enable* 注解的通用模式*\*

   ```
   @Target(ElementType.TYPE)
   @Retention(RetentionPolicy.RUNTIME)
   @Import(XXXSelector.class)  // 或 XXXConfiguration.class
   public @interface EnableXXX {
       // 配置属性
   }


   ```
