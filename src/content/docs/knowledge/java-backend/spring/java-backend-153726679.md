---
title: "Spring Bean创建流程"
description: "深入解析Spring IoC容器Bean创建的核心机制"
sourceId: "153726679"
source: "https://blog.csdn.net/qq_45852626/article/details/153726679"
sourceSeries:
  - "Spring核心模块解析"
category: java-backend
subcategory: spring
tags:
  - "Spring核心模块解析"
  - "Spring"
status: draft
difficulty: intermediate
contentType: knowledge
sidebar:
  order: 153726679
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/153726679)（历史文章导入，当前状态为草稿）

> **深入解析Spring IoC容器Bean创建的核心机制**  
>  本教程从前置知识到源码细节，全面解析Spring如何管理和创建Bean实例

---

#### 
### 一、前置知识

#### 1.1 核心概念

在深入Bean创建流程之前,需要理解以下核心概念:

##### 1.1.1 BeanFactory vs ApplicationContext

```
ApplicationContext (应用上下文)
    ├─ 继承自 BeanFactory
    ├─ 提供更多企业级功能
    │   ├─ 国际化支持 (MessageSource)
    │   ├─ 事件发布机制 (ApplicationEventPublisher)
    │   ├─ 资源加载 (ResourcePatternResolver)
    │   └─ 环境抽象 (Environment)
    │
    └─ BeanFactory (Bean工厂)
        └─ 核心容器,负责Bean的创建和管理


```

**核心实现类关系:**

```
BeanFactory (接口)
    ↑
HierarchicalBeanFactory (支持父子容器)
    ↑
ConfigurableBeanFactory (可配置)
    ↑
AbstractBeanFactory (抽象实现,包含doGetBean核心逻辑)
    ↑
AbstractAutowireCapableBeanFactory (支持自动装配,包含createBean逻辑)
    ↑
DefaultListableBeanFactory (默认实现,最常用)


```

##### 1.1.2 BeanDefinition

**BeanDefinition** 是Spring对Bean的描述信息,类似于"菜谱"或"设计图":

```
public interface BeanDefinition {
    // Bean的class类型
    String getBeanClassName();

    // Bean的作用域: singleton, prototype, request, session等
    String getScope();

    // Bean的依赖关系
    String[] getDependsOn();

    // 是否懒加载
    boolean isLazyInit();

    // 构造方法参数值
    ConstructorArgumentValues getConstructorArgumentValues();

    // 属性值
    MutablePropertyValues getPropertyValues();

    // 初始化方法名
    String getInitMethodName();

    // 销毁方法名
    String getDestroyMethodName();
}


```

**BeanDefinition的来源:**

* XML配置: `<bean id="user" class="com.example.User"/>`
* 注解配置: `@Component`, `@Service`, `@Controller`
* Java配置: `@Configuration` + `@Bean`
* 编程式注册: `BeanDefinitionRegistry.registerBeanDefinition()`

##### 1.1.3 Bean的作用域(Scope)

| 作用域 | 说明 | 生命周期 |
| --- | --- | --- |
| **singleton** | 单例模式(默认) | 容器启动创建,容器销毁时销毁 |
| **prototype** | 原型模式 | 每次getBean()都创建新实例 |
| **request** | Web请求范围 | 每个HTTP请求创建一个实例 |
| **session** | Web会话范围 | 每个HTTP Session创建一个实例 |
| **application** | ServletContext范围 | 整个Web应用一个实例 |
| **自定义** | 实现Scope接口 | 由自定义逻辑控制 |

##### 1.1.4 FactoryBean

`FactoryBean` 是一个特殊的Bean,它不是普通的Bean实例,而是**生产Bean的工厂**:

```
public interface FactoryBean<T> {
    // 返回此工厂创建的对象实例
    T getObject() throws Exception;

    // 返回此工厂创建的对象类型
    Class<?> getObjectType();

    // 此工厂创建的对象是否为单例
    boolean isSingleton();
}


```

**使用场景示例:**

```
@Component
public class SqlSessionFactoryBean implements FactoryBean<SqlSessionFactory> {

    @Override
    public SqlSessionFactory getObject() throws Exception {
        // 复杂的创建逻辑
        return new SqlSessionFactoryBuilder().build(inputStream);
    }

    @Override
    public Class<?> getObjectType() {
        return SqlSessionFactory.class;
    }

    @Override
    public boolean isSingleton() {
        return true;
    }
}


```

**重要区别:**

* `getBean("sqlSessionFactoryBean")` → 返回 `SqlSessionFactory` 实例(工厂生产的对象)
* `getBean("&sqlSessionFactoryBean")` → 返回 `SqlSessionFactoryBean` 实例(工厂本身)

#### 1.2 BeanPostProcessor机制

**BeanPostProcessor** 是Spring的扩展点,可以在Bean初始化前后进行自定义处理:

```
public interface BeanPostProcessor {
    // Bean初始化之前调用
    Object postProcessBeforeInitialization(Object bean, String beanName);

    // Bean初始化之后调用
    Object postProcessAfterInitialization(Object bean, String beanName);
}


```

**常见的BeanPostProcessor:**

| 实现类 | 作用 |
| --- | --- |
| `AutowiredAnnotationBeanPostProcessor` | 处理@Autowired、@Value注解 |
| `CommonAnnotationBeanPostProcessor` | 处理@Resource、@PostConstruct、@PreDestroy |
| `AnnotationAwareAspectJAutoProxyCreator` | 处理AOP代理 |
| `ApplicationContextAwareProcessor` | 处理Aware接口回调 |

#### 1.3 Bean的生命周期概览

```
1. 实例化 (Instantiation)
   └─ 通过构造方法创建对象

2. 属性填充 (Populate Properties)
   └─ 依赖注入(@Autowired、@Resource等)

3. Aware接口回调
   ├─ BeanNameAware.setBeanName()
   ├─ BeanClassLoaderAware.setBeanClassLoader()
   └─ BeanFactoryAware.setBeanFactory()

4. BeanPostProcessor前置处理
   └─ postProcessBeforeInitialization()

5. 初始化 (Initialization)
   ├─ @PostConstruct方法
   ├─ InitializingBean.afterPropertiesSet()
   └─ 自定义init-method

6. BeanPostProcessor后置处理
   └─ postProcessAfterInitialization()  ← AOP代理在这里生成

7. Bean就绪,可以使用

8. 销毁 (Destruction)
   ├─ @PreDestroy方法
   ├─ DisposableBean.destroy()
   └─ 自定义destroy-method


```

---

### 二、Spring容器架构概览

#### 2.1 类层次结构

```
                    ┌──────────────┐
                    │ BeanFactory  │ (顶层接口)
                    └──────┬───────┘
                           │
        ┌──────────────────┴──────────────────┐
        │                                     │
┌───────▼────────┐              ┌─────────────▼──────────┐
│ SingletonBean  │              │  HierarchicalBean      │
│ Registry       │              │  Factory               │
└───────┬────────┘              └─────────────┬──────────┘
        │                                     │
        │                       ┌─────────────▼──────────┐
        │                       │ ConfigurableBean       │
        │                       │ Factory                │
        │                       └─────────────┬──────────┘
        │                                     │
┌───────▼──────────────────────────────────┬─▼──────────┐
│ DefaultSingletonBeanRegistry             │            │
│ - singletonObjects (一级缓存)             │            │
│ - earlySingletonObjects (二级缓存)        │            │
│ - singletonFactories (三级缓存)           │            │
└───────┬──────────────────────────────────┘            │
        │                                                │
┌───────▼────────────────────────────────────────────┐  │
│ AbstractBeanFactory                                 │  │
│ - doGetBean() ← 核心方法                            │  │
│ - getBean() 系列重载方法                            │  │
└───────┬─────────────────────────────────────────────┘  │
        │                                                │
┌───────▼────────────────────────────────────────────┐  │
│ AbstractAutowireCapableBeanFactory                  │  │
│ - createBean() ← 创建Bean的核心方法                 │  │
│ - doCreateBean() ← 真正的创建逻辑                   │  │
│ - populateBean() ← 属性填充                         │  │
│ - initializeBean() ← 初始化                         │  │
└───────┬─────────────────────────────────────────────┘  │
        │                                                │
┌───────▼────────────────────────────────────────────┐  │
│ DefaultListableBeanFactory                          │  │
│ - beanDefinitionMap (存储所有BeanDefinition)        │  │
│ - 实现了BeanDefinitionRegistry                      │  │
└─────────────────────────────────────────────────────┘  │
                                                         │
                    ┌────────────────────────────────────┘
                    │
        ┌───────────▼──────────┐
        │ ApplicationContext   │ (应用上下文)
        └───────────┬──────────┘
                    │
        ┌───────────▼──────────────────────┐
        │ AbstractApplicationContext       │
        │ - refresh() ← 容器启动入口       │
        └──────────────────────────────────┘


```

#### 2.2 三大核心组件

| 组件 | 职责 | 核心方法 |
| --- | --- | --- |
| **DefaultSingletonBeanRegistry** | 单例Bean的缓存和管理 | getSingleton(), addSingleton() |
| **AbstractBeanFactory** | Bean的获取和基础管理 | doGetBean(), getBean() |
| **AbstractAutowireCapableBeanFactory** | Bean的创建和自动装配 | createBean(), doCreateBean() |

---

### 三、doGetBean核心流程详解

#### 3.1 方法签名与参数

**位置:** `AbstractBeanFactory.java:242-448`

```
protected <T> T doGetBean(
    String name,                // Bean名称(可能是别名或带&前缀的FactoryBean名称)
    @Nullable Class<T> requiredType,  // 期望的Bean类型
    @Nullable Object[] args,    // 构造方法参数(仅首次创建时有效)
    boolean typeCheckOnly       // 是否仅做类型检查(不标记为已创建)
) throws BeansException


```

#### 3.2 上游调用关系

```
用户代码
    ↓
ApplicationContext.getBean()
    ↓
AbstractApplicationContext.getBean()
    ↓
AbstractBeanFactory.getBean() 重载方法
    ├─ getBean(String name) → doGetBean(name, null, null, false)
    ├─ getBean(String name, Class<T> type) → doGetBean(name, type, null, false)
    ├─ getBean(String name, Object... args) → doGetBean(name, null, args, false)
    └─ getBean(String name, Class<T> type, Object... args) → doGetBean(name, type, args, false)
    ↓
doGetBean() ← 核心方法


```

#### 3.3 完整流程图

```
┌─────────────────────────────────────────────────────────┐
│ START: doGetBean(name, requiredType, args, typeCheckOnly) │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ [步骤1] 转换BeanName (transformedBeanName)              │
│  - 处理别名: userAlias → user                           │
│  - 处理FactoryBean前缀: &myFactory → myFactory          │
│  - 返回规范化的beanName                                 │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ [步骤2] 尝试从单例缓存获取 (getSingleton)               │
│  三级缓存检查:                                          │
│  ① singletonObjects (一级缓存) - 完整Bean               │
│  ② earlySingletonObjects (二级缓存) - 早期Bean          │
│  ③ singletonFactories (三级缓存) - Bean工厂             │
└─────────────────────┬───────────────────────────────────┘
                      ↓
              ┌───────┴────────┐
              │ 缓存命中?       │
              └───┬────────┬───┘
                  │        │
            YES   │        │   NO
                  ↓        ↓
    ┌─────────────────┐   │
    │ [步骤3A] 快速路径│   │
    │ getObjectFor    │   │
    │ BeanInstance    │   │
    │  - 普通Bean     │   │
    │    直接返回     │   │
    │  - FactoryBean  │   │
    │    调用getObject│   │
    └────────┬────────┘   │
             ↓             ↓
           返回      ┌──────────────────┐
                     │ [步骤4] Prototype │
                     │ 循环依赖检查      │
                     │ 是? → 抛异常      │
                     └─────────┬────────┘
                               ↓
                     ┌──────────────────┐
                     │ [步骤5] 检查父容器│
                     │ 有父容器 &&      │
                     │ 当前容器无定义?  │
                     └───┬──────────┬───┘
                         │          │
                    YES  │          │  NO
                         ↓          ↓
              ┌────────────────┐   │
              │ 委托父容器查找 │   │
              │ parent.getBean │   │
              └────────┬───────┘   │
                       ↓            ↓
                     返回    ┌──────────────────┐
                             │ [步骤6] 标记Bean │
                             │ 为已创建          │
                             │ markBeanAsCreated │
                             └─────────┬────────┘
                                       ↓
                             ┌──────────────────┐
                             │ [步骤7] 合并Bean  │
                             │ Definition        │
                             │ getMergedLocal... │
                             └─────────┬────────┘
                                       ↓
                             ┌──────────────────┐
                             │ [步骤8] 处理     │
                             │ depends-on依赖   │
                             │  - 检查循环依赖  │
                             │  - 递归getBean() │
                             └─────────┬────────┘
                                       ↓
                             ┌──────────────────┐
                             │ [步骤9] 根据Scope│
                             │ 创建Bean         │
                             └───┬──────────────┘
                                 │
                  ┌──────────────┼──────────────┐
                  ↓              ↓              ↓
         ┌────────────┐  ┌────────────┐  ┌────────────┐
         │ Singleton  │  │ Prototype  │  │自定义Scope │
         │ getSingleton│  │ 直接create │  │ scope.get  │
         │ (lambda)   │  │ Bean()     │  │ (lambda)   │
         │   ↓        │  │            │  │            │
         │ createBean │  │            │  │            │
         └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
               │               │               │
               └───────────────┼───────────────┘
                               ↓
                     ┌──────────────────┐
                     │ [步骤10] Factory  │
                     │ Bean处理          │
                     │ getObjectFor      │
                     │ BeanInstance      │
                     └─────────┬────────┘
                               ↓
                     ┌──────────────────┐
                     │ [步骤11] 类型检查│
                     │ requiredType匹配?│
                     │ 不匹配→类型转换  │
                     └─────────┬────────┘
                               ↓
                     ┌──────────────────┐
                     │ RETURN: Bean实例 │
                     └──────────────────┘


```

#### 3.4 关键步骤源码解析

##### 步骤1: BeanName转换

**源码位置:** `AbstractBeanFactory.java:247`

```
String beanName = transformedBeanName(name);


```

**转换逻辑:**

```
protected String transformedBeanName(String name) {
    // 1. 去除FactoryBean前缀(&)
    String beanName = BeanFactoryUtils.transformedBeanName(name);

    // 2. 解析别名
    String canonicalName = canonicalName(beanName);

    return canonicalName;
}


```

**示例:**

* `"&myFactory"` → `"myFactory"`
* `"userServiceAlias"` → `"userService"` (假设userServiceAlias是别名)

##### 步骤2: 单例缓存查询

**源码位置:** `AbstractBeanFactory.java:252`

```
Object sharedInstance = getSingleton(beanName);


```

**getSingleton实现:** `DefaultSingletonBeanRegistry.java`

```
@Nullable
protected Object getSingleton(String beanName, boolean allowEarlyReference) {
    // 1. 从一级缓存获取完整Bean
    Object singletonObject = this.singletonObjects.get(beanName);

    if (singletonObject == null && isSingletonCurrentlyInCreation(beanName)) {
        // 2. 从二级缓存获取早期Bean
        singletonObject = this.earlySingletonObjects.get(beanName);

        if (singletonObject == null && allowEarlyReference) {
            synchronized (this.singletonObjects) {
                // 双重检查锁定
                singletonObject = this.singletonObjects.get(beanName);
                if (singletonObject == null) {
                    singletonObject = this.earlySingletonObjects.get(beanName);
                    if (singletonObject == null) {
                        // 3. 从三级缓存获取Bean工厂
                        ObjectFactory<?> singletonFactory =
                            this.singletonFactories.get(beanName);
                        if (singletonFactory != null) {
                            // 调用工厂方法创建Bean
                            singletonObject = singletonFactory.getObject();
                            // 放入二级缓存
                            this.earlySingletonObjects.put(beanName, singletonObject);
                            // 从三级缓存移除
                            this.singletonFactories.remove(beanName);
                        }
                    }
                }
            }
        }
    }
    return singletonObject;
}


```

**三级缓存总结:**

| 缓存 | 变量名 | 存储内容 | 作用 |
| --- | --- | --- | --- |
| 一级 | singletonObjects | 完整的单例Bean | 常规单例池 |
| 二级 | earlySingletonObjects | 早期暴露的Bean(已实例化,未填充属性) | 解决循环依赖 |
| 三级 | singletonFactories | ObjectFactory(Bean工厂) | 延迟创建,支持AOP代理 |

##### 步骤3: Prototype循环依赖检查

**源码位置:** `AbstractBeanFactory.java:282-284`

```
if (isPrototypeCurrentlyInCreation(beanName)) {
    throw new BeanCurrentlyInCreationException(beanName);
}


```

**原因:** Prototype作用域的Bean每次都创建新实例,无法使用缓存解决循环依赖。

**示例:**

```
@Component
@Scope("prototype")
class A {
    @Autowired
    private B b;  // A依赖B
}

@Component
@Scope("prototype")
class B {
    @Autowired
    private A a;  // B依赖A → 抛出异常!
}


```

##### 步骤4: 父容器委托

**源码位置:** `AbstractBeanFactory.java:290-315`

```
BeanFactory parentBeanFactory = getParentBeanFactory();

if (parentBeanFactory != null && !containsBeanDefinition(beanName)) {
    // 恢复原始名称(可能包含&前缀)
    String nameToLookup = originalBeanName(name);

    // 根据父容器类型选择调用方式
    if (parentBeanFactory instanceof AbstractBeanFactory) {
        return ((AbstractBeanFactory) parentBeanFactory)
            .doGetBean(nameToLookup, requiredType, args, typeCheckOnly);
    }
    else if (args != null) {
        return (T) parentBeanFactory.getBean(nameToLookup, args);
    }
    else if (requiredType != null) {
        return parentBeanFactory.getBean(nameToLookup, requiredType);
    }
    else {
        return (T) parentBeanFactory.getBean(nameToLookup);
    }
}


```

**查找顺序:** 子容器 → 父容器 → 父父容器 → …

##### 步骤5: depends-on依赖处理

**源码位置:** `AbstractBeanFactory.java:325-352`

```
String[] dependsOn = mbd.getDependsOn();
if (dependsOn != null) {
    for (String dep : dependsOn) {
        // 检查循环依赖
        if (isDependent(beanName, dep)) {
            throw new BeanCreationException(
                "Circular depends-on relationship between '" +
                beanName + "' and '" + dep + "'");
        }

        // 注册依赖关系
        registerDependentBean(dep, beanName);

        try {
            // 递归初始化依赖Bean
            getBean(dep);
        } catch (NoSuchBeanDefinitionException ex) {
            throw new BeanCreationException(
                "'" + beanName + "' depends on missing bean '" + dep + "'");
        }
    }
}


```

**depends-on示例:**

```
<!-- beanB必须在beanA之前初始化 -->
<bean id="beanA" class="com.example.A" depends-on="beanB"/>
<bean id="beanB" class="com.example.B"/>


```

##### 步骤6: 根据Scope创建Bean

###### 6.1 Singleton创建

**源码位置:** `AbstractBeanFactory.java:356-374`

```
if (mbd.isSingleton()) {
    sharedInstance = getSingleton(beanName, () -> {
        try {
            return createBean(beanName, mbd, args);
        } catch (BeansException ex) {
            // 创建失败,清理缓存
            destroySingleton(beanName);
            throw ex;
        }
    });

    bean = getObjectForBeanInstance(sharedInstance, name, beanName, mbd);
}


```

**getSingleton(beanName, ObjectFactory)实现:**

```
public Object getSingleton(String beanName, ObjectFactory<?> singletonFactory) {
    synchronized (this.singletonObjects) {
        // 再次检查缓存(双重检查锁定)
        Object singletonObject = this.singletonObjects.get(beanName);
        if (singletonObject == null) {
            // 标记为正在创建
            beforeSingletonCreation(beanName);

            try {
                // 调用ObjectFactory创建Bean
                singletonObject = singletonFactory.getObject();
            } finally {
                // 移除创建中标记
                afterSingletonCreation(beanName);
            }

            // 放入一级缓存
            addSingleton(beanName, singletonObject);
        }
        return singletonObject;
    }
}


```

###### 6.2 Prototype创建

**源码位置:** `AbstractBeanFactory.java:375-390`

```
else if (mbd.isPrototype()) {
    Object prototypeInstance = null;
    try {
        // 标记为正在创建
        beforePrototypeCreation(beanName);
        // 直接创建新实例
        prototypeInstance = createBean(beanName, mbd, args);
    } finally {
        // 移除创建中标记
        afterPrototypeCreation(beanName);
    }

    bean = getObjectForBeanInstance(prototypeInstance, name, beanName, mbd);
}


```

**特点:** 每次getBean()都创建新实例,不缓存。

###### 6.3 自定义Scope创建

**源码位置:** `AbstractBeanFactory.java:393-421`

```
else {
    String scopeName = mbd.getScope();
    Scope scope = this.scopes.get(scopeName);

    if (scope == null) {
        throw new IllegalStateException(
            "No Scope registered for scope name '" + scopeName + "'");
    }

    try {
        Object scopedInstance = scope.get(beanName, () -> {
            beforePrototypeCreation(beanName);
            try {
                return createBean(beanName, mbd, args);
            } finally {
                afterPrototypeCreation(beanName);
            }
        });

        bean = getObjectForBeanInstance(scopedInstance, name, beanName, mbd);
    } catch (IllegalStateException ex) {
        throw new BeanCreationException(beanName,
            "Scope '" + scopeName + "' is not active for the current thread");
    }
}


```

**常见自定义Scope:**

* `RequestScope` (Web请求范围)
* `SessionScope` (Web会话范围)
* `ApplicationScope` (ServletContext范围)

#### 3.5 下游调用关系

```
doGetBean()
    ├─→ transformedBeanName() - BeanName转换
    ├─→ getSingleton(beanName) - 从缓存获取
    ├─→ getObjectForBeanInstance() - 处理FactoryBean
    ├─→ isPrototypeCurrentlyInCreation() - Prototype循环依赖检查
    ├─→ getParentBeanFactory() - 获取父容器
    ├─→ containsBeanDefinition() - 检查是否有Bean定义
    ├─→ markBeanAsCreated() - 标记为已创建
    ├─→ getMergedLocalBeanDefinition() - 合并BeanDefinition
    ├─→ isDependent() - 检查depends-on循环依赖
    ├─→ registerDependentBean() - 注册依赖关系
    ├─→ getBean(dep) - 递归获取依赖Bean
    ├─→ getSingleton(beanName, ObjectFactory) - 创建单例
    ├─→ createBean() - **【核心】创建Bean实例**
    ├─→ beforePrototypeCreation() - Prototype前置处理
    ├─→ afterPrototypeCreation() - Prototype后置处理
    └─→ getTypeConverter() - 类型转换


```

---

### 四、createBean创建细节

#### 4.1 createBean方法概览

**位置:** `AbstractAutowireCapableBeanFactory.java:485-565`

```
@Override
protected Object createBean(String beanName, RootBeanDefinition mbd,
                           @Nullable Object[] args) throws BeanCreationException {

    RootBeanDefinition mbdToUse = mbd;

    // 1. 解析Bean的Class类型
    Class<?> resolvedClass = resolveBeanClass(mbd, beanName);
    if (resolvedClass != null && !mbd.hasBeanClass() &&
        mbd.getBeanClassName() != null) {
        mbdToUse = new RootBeanDefinition(mbd);
        mbdToUse.setBeanClass(resolvedClass);
    }

    // 2. 准备方法覆盖(lookup-method, replaced-method)
    try {
        mbdToUse.prepareMethodOverrides();
    } catch (BeanDefinitionValidationException ex) {
        throw new BeanDefinitionStoreException("Validation of method overrides failed");
    }

    try {
        // 3. 【重要】给BeanPostProcessor一个机会返回代理对象
        // InstantiationAwareBeanPostProcessor.postProcessBeforeInstantiation()
        Object bean = resolveBeforeInstantiation(beanName, mbdToUse);
        if (bean != null) {
            return bean;  // 如果返回了代理对象,直接返回,不再执行后续创建流程
        }
    } catch (Throwable ex) {
        throw new BeanCreationException("BeanPostProcessor before instantiation failed");
    }

    try {
        // 4. 【核心】真正创建Bean实例
        Object beanInstance = doCreateBean(beanName, mbdToUse, args);
        return beanInstance;
    } catch (BeanCreationException | ImplicitlyAppearedSingletonException ex) {
        throw ex;
    } catch (Throwable ex) {
        throw new BeanCreationException("Unexpected exception during bean creation");
    }
}


```

#### 4.2 doCreateBean核心流程

**位置:** `AbstractAutowireCapableBeanFactory.java:566-750`

```
protected Object doCreateBean(String beanName, RootBeanDefinition mbd,
                              @Nullable Object[] args) throws BeanCreationException {

    // ========== 阶段一: 实例化Bean ==========
    BeanWrapper instanceWrapper = null;
    if (mbd.isSingleton()) {
        // 从factoryBean实例缓存中移除(如果是单例)
        instanceWrapper = this.factoryBeanInstanceCache.remove(beanName);
    }

    if (instanceWrapper == null) {
        // 【核心】创建Bean实例
        // 三种创建方式:
        // 1. 工厂方法创建 (factory-method)
        // 2. 构造方法自动注入
        // 3. 默认无参构造方法
        instanceWrapper = createBeanInstance(beanName, mbd, args);
    }

    Object bean = instanceWrapper.getWrappedInstance();
    Class<?> beanType = instanceWrapper.getWrappedClass();

    // ========== 阶段二: 合并BeanDefinition后置处理 ==========
    synchronized (mbd.postProcessingLock) {
        if (!mbd.postProcessed) {
            try {
                // 【重要】MergedBeanDefinitionPostProcessor处理
                // 这里会扫描@Autowired、@Value、@Resource等注解
                applyMergedBeanDefinitionPostProcessors(mbd, beanType, beanName);
            } catch (Throwable ex) {
                throw new BeanCreationException("Post-processing of merged bean definition failed");
            }
            mbd.postProcessed = true;
        }
    }

    // ========== 阶段三: 早期暴露(解决循环依赖) ==========
    // 判断是否需要早期暴露:
    // 1. 单例Bean
    // 2. 允许循环引用
    // 3. 当前Bean正在创建中
    boolean earlySingletonExposure = (mbd.isSingleton() &&
                                      this.allowCircularReferences &&
                                      isSingletonCurrentlyInCreation(beanName));

    if (earlySingletonExposure) {
        // 【核心】将Bean工厂放入三级缓存
        addSingletonFactory(beanName, () -> getEarlyBeanReference(beanName, mbd, bean));
    }

    // ========== 阶段四: 属性填充 ==========
    Object exposedObject = bean;
    try {
        // 【核心】填充Bean的属性(依赖注入)
        // 处理@Autowired、@Resource、@Value等
        populateBean(beanName, mbd, instanceWrapper);

        // ========== 阶段五: 初始化Bean ==========
        // 【核心】执行初始化逻辑
        // 1. Aware接口回调
        // 2. BeanPostProcessor前置处理
        // 3. 初始化方法(InitializingBean、init-method)
        // 4. BeanPostProcessor后置处理(AOP代理在这里)
        exposedObject = initializeBean(beanName, exposedObject, mbd);
    } catch (Throwable ex) {
        throw new BeanCreationException("Initialization of bean failed");
    }

    // ========== 阶段六: 循环依赖检查 ==========
    if (earlySingletonExposure) {
        Object earlySingletonReference = getSingleton(beanName, false);
        if (earlySingletonReference != null) {
            if (exposedObject == bean) {
                // 如果初始化后的Bean没有变化(没有被代理),使用早期引用
                exposedObject = earlySingletonReference;
            } else if (!this.allowRawInjectionDespiteWrapping && hasDependentBean(beanName)) {
                // 如果Bean被代理了,并且有其他Bean依赖它
                // 检查依赖的Bean是否注入的是早期引用
                String[] dependentBeans = getDependentBeans(beanName);
                Set<String> actualDependentBeans = new LinkedHashSet<>(dependentBeans.length);
                for (String dependentBean : dependentBeans) {
                    if (!removeSingletonIfCreatedForTypeCheckOnly(dependentBean)) {
                        actualDependentBeans.add(dependentBean);
                    }
                }
                if (!actualDependentBeans.isEmpty()) {
                    throw new BeanCurrentlyInCreationException(
                        "Bean with name '" + beanName + "' has been injected into other beans [" +
                        StringUtils.collectionToCommaDelimitedString(actualDependentBeans) +
                        "] in its raw version as part of a circular reference, but has eventually been " +
                        "wrapped. This means that said other beans do not use the final version of the " +
                        "bean. This is often the result of over-eager type matching - consider using " +
                        "'getBeanNamesForType' with 'allowEagerInit' flag turned off, for example.");
                }
            }
        }
    }

    // ========== 阶段七: 注册销毁回调 ==========
    try {
        registerDisposableBeanIfNecessary(beanName, bean, mbd);
    } catch (BeanDefinitionValidationException ex) {
        throw new BeanCreationException("Invalid destruction signature");
    }

    return exposedObject;
}


```

#### 4.3 关键子方法详解

##### 4.3.1 createBeanInstance - 实例化

```
protected BeanWrapper createBeanInstance(String beanName, RootBeanDefinition mbd,
                                        @Nullable Object[] args) {
    Class<?> beanClass = resolveBeanClass(mbd, beanName);

    // 1. 使用工厂方法创建
    if (mbd.getFactoryMethodName() != null) {
        return instantiateUsingFactoryMethod(beanName, mbd, args);
    }

    // 2. 构造方法已解析过,直接使用
    boolean resolved = false;
    boolean autowireNecessary = false;
    if (args == null) {
        synchronized (mbd.constructorArgumentLock) {
            if (mbd.resolvedConstructorOrFactoryMethod != null) {
                resolved = true;
                autowireNecessary = mbd.constructorArgumentsResolved;
            }
        }
    }
    if (resolved) {
        if (autowireNecessary) {
            return autowireConstructor(beanName, mbd, null, null);
        } else {
            return instantiateBean(beanName, mbd);
        }
    }

    // 3. 确定构造方法(SmartInstantiationAwareBeanPostProcessor)
    Constructor<?>[] ctors = determineConstructorsFromBeanPostProcessors(beanClass, beanName);
    if (ctors != null || mbd.getResolvedAutowireMode() == AUTOWIRE_CONSTRUCTOR ||
        mbd.hasConstructorArgumentValues() || !ObjectUtils.isEmpty(args)) {
        // 使用构造方法自动注入
        return autowireConstructor(beanName, mbd, ctors, args);
    }

    // 4. 使用默认无参构造方法
    return instantiateBean(beanName, mbd);
}


```

##### 4.3.2 populateBean - 属性填充

```
protected void populateBean(String beanName, RootBeanDefinition mbd,
                           @Nullable BeanWrapper bw) {
    if (bw == null) {
        if (mbd.hasPropertyValues()) {
            throw new BeanCreationException("Cannot apply property values to null instance");
        } else {
            return;
        }
    }

    // 1. InstantiationAwareBeanPostProcessor前置处理
    if (!mbd.isSynthetic() && hasInstantiationAwareBeanPostProcessors()) {
        for (BeanPostProcessor bp : getBeanPostProcessors()) {
            if (bp instanceof InstantiationAwareBeanPostProcessor) {
                InstantiationAwareBeanPostProcessor ibp =
                    (InstantiationAwareBeanPostProcessor) bp;
                // 如果返回false,跳过属性填充
                if (!ibp.postProcessAfterInstantiation(bw.getWrappedInstance(), beanName)) {
                    return;
                }
            }
        }
    }

    PropertyValues pvs = (mbd.hasPropertyValues() ? mbd.getPropertyValues() : null);

    // 2. 根据自动装配模式填充属性
    int resolvedAutowireMode = mbd.getResolvedAutowireMode();
    if (resolvedAutowireMode == AUTOWIRE_BY_NAME ||
        resolvedAutowireMode == AUTOWIRE_BY_TYPE) {
        MutablePropertyValues newPvs = new MutablePropertyValues(pvs);

        if (resolvedAutowireMode == AUTOWIRE_BY_NAME) {
            autowireByName(beanName, mbd, bw, newPvs);
        }

        if (resolvedAutowireMode == AUTOWIRE_BY_TYPE) {
            autowireByType(beanName, mbd, bw, newPvs);
        }

        pvs = newPvs;
    }

    // 3. InstantiationAwareBeanPostProcessor处理属性
    // 【重要】这里处理@Autowired、@Resource、@Value等注解
    if (hasInstantiationAwareBeanPostProcessors()) {
        for (BeanPostProcessor bp : getBeanPostProcessors()) {
            if (bp instanceof InstantiationAwareBeanPostProcessor) {
                InstantiationAwareBeanPostProcessor ibp =
                    (InstantiationAwareBeanPostProcessor) bp;
                // AutowiredAnnotationBeanPostProcessor在这里注入依赖
                PropertyValues pvsToUse = ibp.postProcessProperties(pvs, bw.getWrappedInstance(), beanName);
                if (pvsToUse == null) {
                    return;
                }
                pvs = pvsToUse;
            }
        }
    }

    // 4. 应用属性值
    if (pvs != null) {
        applyPropertyValues(beanName, mbd, bw, pvs);
    }
}


```

##### 4.3.3 initializeBean - 初始化

```
protected Object initializeBean(String beanName, Object bean,
                               @Nullable RootBeanDefinition mbd) {
    // 1. Aware接口回调
    invokeAwareMethods(beanName, bean);

    // 2. BeanPostProcessor前置处理
    Object wrappedBean = bean;
    if (mbd == null || !mbd.isSynthetic()) {
        wrappedBean = applyBeanPostProcessorsBeforeInitialization(wrappedBean, beanName);
    }

    // 3. 调用初始化方法
    try {
        invokeInitMethods(beanName, wrappedBean, mbd);
    } catch (Throwable ex) {
        throw new BeanCreationException("Invocation of init method failed");
    }

    // 4. BeanPostProcessor后置处理
    // 【重要】AOP代理在这里生成
    if (mbd == null || !mbd.isSynthetic()) {
        wrappedBean = applyBeanPostProcessorsAfterInitialization(wrappedBean, beanName);
    }

    return wrappedBean;
}

// Aware接口回调
private void invokeAwareMethods(String beanName, Object bean) {
    if (bean instanceof Aware) {
        if (bean instanceof BeanNameAware) {
            ((BeanNameAware) bean).setBeanName(beanName);
        }
        if (bean instanceof BeanClassLoaderAware) {
            ((BeanClassLoaderAware) bean).setBeanClassLoader(getBeanClassLoader());
        }
        if (bean instanceof BeanFactoryAware) {
            ((BeanFactoryAware) bean).setBeanFactory(this);
        }
    }
}

// 初始化方法调用
protected void invokeInitMethods(String beanName, Object bean,
                                @Nullable RootBeanDefinition mbd) throws Throwable {
    // 1. 调用InitializingBean.afterPropertiesSet()
    boolean isInitializingBean = (bean instanceof InitializingBean);
    if (isInitializingBean &&
        (mbd == null || !mbd.isExternallyManagedInitMethod("afterPropertiesSet"))) {
        ((InitializingBean) bean).afterPropertiesSet();
    }

    // 2. 调用自定义init-method
    if (mbd != null && bean.getClass() != NullBean.class) {
        String initMethodName = mbd.getInitMethodName();
        if (StringUtils.hasLength(initMethodName) &&
            !(isInitializingBean && "afterPropertiesSet".equals(initMethodName)) &&
            !mbd.isExternallyManagedInitMethod(initMethodName)) {
            invokeCustomInitMethod(beanName, bean, mbd);
        }
    }
}


```

#### 4.4 Bean创建完整时序图

```
客户端                AbstractBeanFactory    AbstractAutowireCapableBeanFactory    DefaultSingletonBeanRegistry
  |                           |                           |                                  |
  |--getBean("user")-------->|                           |                                  |
  |                           |                           |                                  |
  |                    doGetBean("user")                  |                                  |
  |                           |                           |                                  |
  |                           |--getSingleton("user")-----|--------------------------------->|
  |                           |<--null(缓存未命中)--------|----------------------------------|
  |                           |                           |                                  |
  |                           |--getSingleton("user",-----|--------------------------------->|
  |                           |   ObjectFactory)---------→|                                  |
  |                           |                           |                                  |
  |                           |   createBean("user")----->|                                  |
  |                           |                           |                                  |
  |                           |                           | resolveBeforeInstantiation()     |
  |                           |                           |   (BeanPostProcessor前置)        |
  |                           |                           |                                  |
  |                           |                           | doCreateBean()                   |
  |                           |                           |   ↓                              |
  |                           |                           | 1. createBeanInstance()          |
  |                           |                           |    (实例化)                      |
  |                           |                           |   ↓                              |
  |                           |                           | 2. applyMergedBeanDefinition     |
  |                           |                           |    PostProcessors()              |
  |                           |                           |    (扫描@Autowired等)            |
  |                           |                           |   ↓                              |
  |                           |                           | 3. addSingletonFactory()-------->|
  |                           |                           |    (放入三级缓存)                |
  |                           |                           |   ↓                              |
  |                           |                           | 4. populateBean()                |
  |                           |                           |    (属性填充/依赖注入)           |
  |                           |                           |   ↓                              |
  |                           |                           | 5. initializeBean()              |
  |                           |                           |    ├─ invokeAwareMethods()       |
  |                           |                           |    ├─ BeanPostProcessor前置      |
  |                           |                           |    ├─ invokeInitMethods()        |
  |                           |                           |    └─ BeanPostProcessor后置      |
  |                           |                           |       (AOP代理生成)              |
  |                           |                           |   ↓                              |
  |                           |                           | 6. 循环依赖检查                  |
  |                           |                           |   ↓                              |
  |                           |                           | 7. registerDisposableBean()      |
  |                           |                           |   ↓                              |
  |                           |                           |<--User实例-----------------------|
  |                           |                           |                                  |
  |                           |                           |  addSingleton("user", user)----->|
  |                           |                           |                     (放入一级缓存)|
  |                           |                           |                                  |
  |                           |<--User实例----------------|                                  |
  |                           |                           |                                  |
  |<--User实例----------------|                           |                                  |
  |                           |                           |                                  |


```

---

### 五、三级缓存与循环依赖

#### 5.1 三级缓存的定义

**位置:** `DefaultSingletonBeanRegistry.java:77-84`

```
public class DefaultSingletonBeanRegistry {

    /** 一级缓存: 存放完全初始化好的单例Bean */
    private final Map<String, Object> singletonObjects =
        new ConcurrentHashMap<>(256);

    /** 三级缓存: 存放Bean工厂,用于创建早期Bean */
    private final Map<String, ObjectFactory<?>> singletonFactories =
        new HashMap<>(16);

    /** 二级缓存: 存放早期暴露的Bean(已实例化,未填充属性) */
    private final Map<String, Object> earlySingletonObjects =
        new ConcurrentHashMap<>(16);

    /** 正在创建中的Bean名称集合 */
    private final Set<String> singletonsCurrentlyInCreation =
        Collections.newSetFromMap(new ConcurrentHashMap<>(16));
}


```

#### 5.2 三级缓存的作用

| 缓存级别 | 变量名 | 数据类型 | 存储内容 | 何时放入 | 何时移除 |
| --- | --- | --- | --- | --- | --- |
| **一级** | singletonObjects | Map<String, Object> | 完整的单例Bean | Bean完全创建后 | 容器销毁 |
| **二级** | earlySingletonObjects | Map<String, Object> | 早期Bean(半成品) | 从三级缓存获取后 | 放入一级缓存时 |
| **三级** | singletonFactories | Map<String, ObjectFactory> | Bean工厂(Lambda) | 实例化后,属性填充前 | 从三级缓存获取后 |

#### 5.3 循环依赖的类型

##### 5.3.1 构造方法循环依赖 (❌ 无法解决)

```
@Component
public class A {
    private B b;

    @Autowired
    public A(B b) {  // 构造方法注入
        this.b = b;
    }
}

@Component
public class B {
    private A a;

    @Autowired
    public B(A a) {  // 构造方法注入
        this.a = a;
    }
}


```

**原因:** 构造方法执行时Bean还没有实例化,无法提前暴露到缓存中。

**异常信息:**

```
BeanCurrentlyInCreationException:
Error creating bean with name 'a': Requested bean is currently in creation:
Is there an unresolvable circular reference?


```

##### 5.3.2 Setter方法循环依赖 (✅ 可以解决)

```
@Component
public class A {
    @Autowired
    private B b;  // Setter注入(字段注入)
}

@Component
public class B {
    @Autowired
    private A a;  // Setter注入(字段注入)
}


```

**解决过程:**

```
1. 创建A
   ├─ 实例化A (new A())
   ├─ 放入三级缓存: singletonFactories.put("a", () -> getEarlyBeanReference(a))
   └─ 填充属性: 需要注入B

2. 创建B (递归调用getBean("b"))
   ├─ 实例化B (new B())
   ├─ 放入三级缓存: singletonFactories.put("b", () -> getEarlyBeanReference(b))
   └─ 填充属性: 需要注入A

3. 再次获取A (递归调用getBean("a"))
   ├─ 一级缓存未命中
   ├─ 二级缓存未命中
   ├─ 三级缓存命中! 调用ObjectFactory.getObject()
   ├─ 将早期A放入二级缓存
   ├─ 从三级缓存移除
   └─ 返回早期A给B

4. B完成属性填充
   ├─ B完成初始化
   ├─ 放入一级缓存
   └─ 返回B给A

5. A完成属性填充
   ├─ A完成初始化
   ├─ 放入一级缓存
   └─ 从二级缓存移除


```

##### 5.3.3 Prototype循环依赖 (❌ 无法解决)

```
@Component
@Scope("prototype")
public class A {
    @Autowired
    private B b;
}

@Component
@Scope("prototype")
public class B {
    @Autowired
    private A a;
}


```

**原因:** Prototype Bean每次都创建新实例,不使用缓存,无法解决循环依赖。

#### 5.4 为什么需要三级缓存?

**核心问题:** 为什么不能只用两级缓存?

**答案:** 为了支持AOP代理!

##### 场景分析:

假设A和B循环依赖,且A需要被AOP代理:

**只有两级缓存的情况:**

```
1. 创建A
   ├─ 实例化A (原始对象)
   ├─ 将原始A放入二级缓存
   └─ 填充属性: 需要B

2. 创建B
   ├─ 实例化B
   ├─ 填充属性: 需要A
   └─ 从二级缓存获取A (拿到的是原始对象,不是代理对象!)

3. B完成创建,注入的是原始A

4. A继续创建
   ├─ 初始化阶段: BeanPostProcessor后置处理
   └─ 生成A的代理对象 (但B已经注入了原始A!)

❌ 问题: B注入的是原始A,而容器中最终是代理A,不一致!


```

**有三级缓存的情况:**

```
1. 创建A
   ├─ 实例化A (原始对象)
   ├─ 将ObjectFactory放入三级缓存:
   │  singletonFactories.put("a", () -> getEarlyBeanReference(a))
   │
   │  getEarlyBeanReference()方法内部:
   │  ├─ 遍历所有SmartInstantiationAwareBeanPostProcessor
   │  └─ 调用getEarlyBeanReference(),提前生成代理对象
   │
   └─ 填充属性: 需要B

2. 创建B
   ├─ 实例化B
   ├─ 填充属性: 需要A
   └─ 从三级缓存获取ObjectFactory,调用getObject()
       ├─ 执行getEarlyBeanReference(),生成A的代理对象
       ├─ 将代理A放入二级缓存
       └─ 返回代理A给B

3. B完成创建,注入的是代理A ✓

4. A继续创建
   ├─ 初始化阶段: 发现已经生成过代理对象
   └─ 直接返回二级缓存中的代理A

✅ 正确: B和容器中都是代理A,保持一致!


```

**核心代码:** `getEarlyBeanReference`

```
protected Object getEarlyBeanReference(String beanName, RootBeanDefinition mbd, Object bean) {
    Object exposedObject = bean;
    if (!mbd.isSynthetic() && hasInstantiationAwareBeanPostProcessors()) {
        for (BeanPostProcessor bp : getBeanPostProcessors()) {
            if (bp instanceof SmartInstantiationAwareBeanPostProcessor) {
                SmartInstantiationAwareBeanPostProcessor ibp =
                    (SmartInstantiationAwareBeanPostProcessor) bp;
                // 【核心】提前生成代理对象
                // AbstractAutoProxyCreator会在这里创建AOP代理
                exposedObject = ibp.getEarlyBeanReference(exposedObject, beanName);
            }
        }
    }
    return exposedObject;
}


```

#### 5.5 循环依赖解决流程图

```
                       开始创建Bean A
                            ↓
              ┌─────────────────────────┐
              │ 1. 实例化A (new A())    │
              └────────────┬────────────┘
                           ↓
              ┌─────────────────────────────────────────┐
              │ 2. 放入三级缓存                         │
              │ singletonFactories.put("a",             │
              │   () -> getEarlyBeanReference(a))       │
              │                                         │
              │ singletonsCurrentlyInCreation.add("a")  │
              └────────────┬────────────────────────────┘
                           ↓
              ┌─────────────────────────┐
              │ 3. 属性填充: 需要注入B  │
              └────────────┬────────────┘
                           ↓
                  递归调用getBean("b")
                           ↓
              ┌─────────────────────────┐
              │ 4. 实例化B (new B())    │
              └────────────┬────────────┘
                           ↓
              ┌─────────────────────────────────────────┐
              │ 5. 放入三级缓存                         │
              │ singletonFactories.put("b",             │
              │   () -> getEarlyBeanReference(b))       │
              │                                         │
              │ singletonsCurrentlyInCreation.add("b")  │
              └────────────┬────────────────────────────┘
                           ↓
              ┌─────────────────────────┐
              │ 6. 属性填充: 需要注入A  │
              └────────────┬────────────┘
                           ↓
                  递归调用getBean("a")
                           ↓
              ┌──────────────────────────────────┐
              │ 7. getSingleton("a")              │
              │  ├─ 一级缓存: null                │
              │  ├─ 二级缓存: null                │
              │  └─ 三级缓存: 命中! ✓             │
              │                                   │
              │ 8. 调用ObjectFactory.getObject()  │
              │    ├─ 执行getEarlyBeanReference() │
              │    │  (如果需要AOP,生成代理对象)  │
              │    ├─ 放入二级缓存                │
              │    └─ 从三级缓存移除              │
              └────────────┬─────────────────────┘
                           ↓
              ┌─────────────────────────┐
              │ 9. 返回早期A给B         │
              └────────────┬────────────┘
                           ↓
              ┌─────────────────────────┐
              │ 10. B完成属性填充       │
              │     a字段注入成功 ✓     │
              └────────────┬────────────┘
                           ↓
              ┌─────────────────────────┐
              │ 11. B完成初始化         │
              │  ├─ Aware接口回调       │
              │  ├─ BeanPostProcessor   │
              │  └─ init-method          │
              └────────────┬────────────┘
                           ↓
              ┌─────────────────────────────────┐
              │ 12. B放入一级缓存               │
              │ singletonObjects.put("b", b)    │
              │                                 │
              │ singletonsCurrentlyInCreation   │
              │   .remove("b")                  │
              └────────────┬────────────────────┘
                           ↓
              ┌─────────────────────────┐
              │ 13. 返回B给A            │
              └────────────┬────────────┘
                           ↓
              ┌─────────────────────────┐
              │ 14. A完成属性填充       │
              │     b字段注入成功 ✓     │
              └────────────┬────────────┘
                           ↓
              ┌─────────────────────────┐
              │ 15. A完成初始化         │
              │  (发现已生成代理对象,   │
              │   使用二级缓存中的对象) │
              └────────────┬────────────┘
                           ↓
              ┌─────────────────────────────────┐
              │ 16. A放入一级缓存               │
              │ singletonObjects.put("a", a)    │
              │                                 │
              │ 清理二级、三级缓存:              │
              │ earlySingletonObjects.remove("a")│
              │ singletonFactories.remove("a")   │
              │                                 │
              │ singletonsCurrentlyInCreation   │
              │   .remove("a")                  │
              └────────────┬────────────────────┘
                           ↓
                    循环依赖解决成功!


```

---

### 六、父子容器机制

#### 6.1 父子容器概念

在Spring中,容器可以有层级关系,一个容器可以设置另一个容器作为父容器:

```
        父容器 (Parent BeanFactory)
              ↑
              │ 引用
              │
        子容器 (Child BeanFactory)


```

**特性:**

* 子容器可以访问父容器的Bean
* 父容器**不能**访问子容器的Bean
* 子容器的Bean可以覆盖父容器的同名Bean(就近原则)

#### 6.2 经典应用场景: Spring MVC

```
┌─────────────────────────────────────┐
│   Spring MVC容器 (子容器)            │
│   DispatcherServlet创建             │
│                                     │
│   管理的Bean:                       │
│   ├─ @Controller                    │
│   ├─ @RestController                │
│   ├─ HandlerMapping                 │
│   ├─ HandlerAdapter                 │
│   ├─ ViewResolver                   │
│   └─ ...                            │
│                                     │
│   特点: 只能访问自己+父容器的Bean    │
└──────────────┬──────────────────────┘
               │ setParent()
               │
               ↓
┌─────────────────────────────────────┐
│   Spring Root容器 (父容器)           │
│   ContextLoaderListener创建         │
│                                     │
│   管理的Bean:                       │
│   ├─ @Service                       │
│   ├─ @Repository                    │
│   ├─ @Component                     │
│   ├─ DataSource                     │
│   ├─ TransactionManager             │
│   └─ ...                            │
│                                     │
│   特点: 只能访问自己的Bean          │
└─────────────────────────────────────┘


```

#### 6.3 配置示例

##### web.xml

```
<?xml version="1.0" encoding="UTF-8"?>
<web-app xmlns="http://xmlns.jcp.org/xml/ns/javaee"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://xmlns.jcp.org/xml/ns/javaee
                             http://xmlns.jcp.org/xml/ns/javaee/web-app_4_0.xsd"
         version="4.0">

    <!-- ========== 1. 配置Spring Root容器 (父容器) ========== -->
    <context-param>
        <param-name>contextConfigLocation</param-name>
        <param-value>classpath:applicationContext.xml</param-value>
    </context-param>

    <!-- 监听器,在Web容器启动时创建Spring Root容器 -->
    <listener>
        <listener-class>org.springframework.web.context.ContextLoaderListener</listener-class>
    </listener>

    <!-- ========== 2. 配置Spring MVC容器 (子容器) ========== -->
    <servlet>
        <servlet-name>dispatcherServlet</servlet-name>
        <servlet-class>org.springframework.web.servlet.DispatcherServlet</servlet-class>

        <init-param>
            <param-name>contextConfigLocation</param-name>
            <param-value>classpath:spring-mvc.xml</param-value>
        </init-param>

        <!-- 容器启动时就加载DispatcherServlet -->
        <load-on-startup>1</load-on-startup>
    </servlet>

    <servlet-mapping>
        <servlet-name>dispatcherServlet</servlet-name>
        <url-pattern>/</url-pattern>
    </servlet-mapping>

</web-app>


```

##### applicationContext.xml (父容器配置)

```
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:context="http://www.springframework.org/schema/context"
       xsi:schemaLocation="http://www.springframework.org/schema/beans
                           http://www.springframework.org/schema/beans/spring-beans.xsd
                           http://www.springframework.org/schema/context
                           http://www.springframework.org/schema/context/spring-context.xsd">

    <!-- 扫描Service和DAO,排除Controller -->
    <context:component-scan base-package="com.example">
        <context:exclude-filter type="annotation"
                               expression="org.springframework.stereotype.Controller"/>
        <context:exclude-filter type="annotation"
                               expression="org.springframework.web.bind.annotation.RestController"/>
    </context:component-scan>

    <!-- 配置数据源 -->
    <bean id="dataSource" class="com.alibaba.druid.pool.DruidDataSource">
        <property name="url" value="jdbc:mysql://localhost:3306/mydb"/>
        <property name="username" value="root"/>
        <property name="password" value="123456"/>
    </bean>

    <!-- 配置事务管理器 -->
    <bean id="transactionManager"
          class="org.springframework.jdbc.datasource.DataSourceTransactionManager">
        <property name="dataSource" ref="dataSource"/>
    </bean>

</beans>


```

##### spring-mvc.xml (子容器配置)

```
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:context="http://www.springframework.org/schema/context"
       xmlns:mvc="http://www.springframework.org/schema/mvc"
       xsi:schemaLocation="http://www.springframework.org/schema/beans
                           http://www.springframework.org/schema/beans/spring-beans.xsd
                           http://www.springframework.org/schema/context
                           http://www.springframework.org/schema/context/spring-context.xsd
                           http://www.springframework.org/schema/mvc
                           http://www.springframework.org/schema/mvc/spring-mvc.xsd">

    <!-- 只扫描Controller -->
    <context:component-scan base-package="com.example.controller"/>

    <!-- 启用MVC注解驱动 -->
    <mvc:annotation-driven/>

    <!-- 配置视图解析器 -->
    <bean class="org.springframework.web.servlet.view.InternalResourceViewResolver">
        <property name="prefix" value="/WEB-INF/views/"/>
        <property name="suffix" value=".jsp"/>
    </bean>

</beans>


```

#### 6.4 Bean查找流程

假设有如下Bean定义:

```
// 父容器中
@Service
public class UserService {
    public String getUser() {
        return "User from Service";
    }
}

// 子容器中
@Controller
public class UserController {
    @Autowired
    private UserService userService;  // 需要注入父容器的Bean

    @RequestMapping("/user")
    public String user() {
        return userService.getUser();
    }
}


```

**查找流程:**

```
1. Spring MVC容器启动
   ├─ 扫描com.example.controller
   ├─ 发现UserController
   └─ 开始创建UserController实例

2. 属性填充阶段: 需要注入UserService
   ├─ 调用getBean("userService")
   └─ 进入doGetBean()

3. doGetBean("userService")执行
   ├─ 检查Spring MVC容器的缓存: null
   ├─ 检查Spring MVC容器的BeanDefinition:
   │  containsBeanDefinition("userService") = false
   └─ 发现当前容器没有定义

4. 检查父容器
   ├─ BeanFactory parentBeanFactory = getParentBeanFactory()
   ├─ parentBeanFactory != null? → true (Spring Root容器)
   └─ !containsBeanDefinition("userService")? → true

5. 委托父容器查找
   ├─ return parentBeanFactory.getBean("userService")
   └─ 在Spring Root容器中找到UserService ✓

6. 返回UserService实例给UserController
   └─ UserController的userService字段注入成功!


```

**源码位置:** `AbstractBeanFactory.java:290-315`

```
BeanFactory parentBeanFactory = getParentBeanFactory();

if (parentBeanFactory != null && !containsBeanDefinition(beanName)) {
    // 当前容器没有定义,委托父容器查找
    String nameToLookup = originalBeanName(name);

    if (parentBeanFactory instanceof AbstractBeanFactory) {
        return ((AbstractBeanFactory) parentBeanFactory)
            .doGetBean(nameToLookup, requiredType, args, typeCheckOnly);
    }
    else if (args != null) {
        return (T) parentBeanFactory.getBean(nameToLookup, args);
    }
    else if (requiredType != null) {
        return parentBeanFactory.getBean(nameToLookup, requiredType);
    }
    else {
        return (T) parentBeanFactory.getBean(nameToLookup);
    }
}


```

#### 6.5 父子容器的设计优势

##### 1. 职责分离

```
Web层 (Controller)  →  Spring MVC容器管理
业务层 (Service)    →  Spring Root容器管理
数据层 (Repository) →  Spring Root容器管理


```

##### 2. Bean隔离

```
父容器的Bean ❌ 无法访问子容器的Bean
子容器的Bean ✅ 可以访问父容器的Bean


```

**好处:** 防止Service层依赖Controller层,保证分层架构的合理性。

##### 3. 多模块共享

```
         Root容器 (公共Service、DAO)
              ↑
      ┌───────┴───────┐
      │               │
  MVC容器1         MVC容器2
 (前台Controller)  (后台Controller)


```

#### 6.6 编程式创建父子容器

```
public class ParentChildContainerDemo {

    public static void main(String[] args) {
        // 1. 创建父容器
        AnnotationConfigApplicationContext parentContext =
            new AnnotationConfigApplicationContext();
        parentContext.register(ParentConfig.class);
        parentContext.refresh();

        System.out.println("父容器中的Bean:");
        Arrays.stream(parentContext.getBeanDefinitionNames())
              .forEach(System.out::println);

        // 2. 创建子容器
        AnnotationConfigApplicationContext childContext =
            new AnnotationConfigApplicationContext();
        childContext.setParent(parentContext);  // 【核心】设置父容器
        childContext.register(ChildConfig.class);
        childContext.refresh();

        System.out.println("\n子容器中的Bean:");
        Arrays.stream(childContext.getBeanDefinitionNames())
              .forEach(System.out::println);

        // 3. 测试Bean查找
        System.out.println("\n=== 测试Bean查找 ===");

        // 子容器可以获取父容器的Bean
        UserService userService = childContext.getBean(UserService.class);
        System.out.println("子容器获取父容器的Bean: " + userService);

        // 子容器可以获取自己的Bean
        UserController controller = childContext.getBean(UserController.class);
        System.out.println("子容器获取自己的Bean: " + controller);

        try {
            // 父容器无法获取子容器的Bean
            parentContext.getBean(UserController.class);
        } catch (NoSuchBeanDefinitionException e) {
            System.out.println("父容器无法获取子容器的Bean: " +
                             e.getMessage());
        }

        // 4. 验证Bean注入
        System.out.println("\n=== 验证Bean注入 ===");
        System.out.println("Controller中注入的UserService: " +
                         controller.getUserService());
        System.out.println("注入成功: " +
                         (controller.getUserService() == userService));
    }
}

// 父容器配置
@Configuration
@ComponentScan(basePackages = "com.example.service")
class ParentConfig {

    @Bean
    public DataSource dataSource() {
        // 配置数据源
        return new EmbeddedDatabaseBuilder()
            .setType(EmbeddedDatabaseType.H2)
            .build();
    }
}

// 子容器配置
@Configuration
@ComponentScan(basePackages = "com.example.controller")
class ChildConfig {

    @Bean
    public ViewResolver viewResolver() {
        InternalResourceViewResolver resolver =
            new InternalResourceViewResolver();
        resolver.setPrefix("/WEB-INF/views/");
        resolver.setSuffix(".jsp");
        return resolver;
    }
}

// Service (父容器)
@Service
class UserService {
    public String getUser() {
        return "User from Service";
    }
}

// Controller (子容器)
@Controller
class UserController {
    @Autowired
    private UserService userService;

    public UserService getUserService() {
        return userService;
    }
}


```

**运行输出:**

```
父容器中的Bean:
parentConfig
userService
dataSource

子容器中的Bean:
childConfig
userController
viewResolver

=== 测试Bean查找 ===
子容器获取父容器的Bean: com.example.UserService@12345678
子容器获取自己的Bean: com.example.UserController@87654321
父容器无法获取子容器的Bean: No qualifying bean of type 'com.example.UserController' available

=== 验证Bean注入 ===
Controller中注入的UserService: com.example.UserService@12345678
注入成功: true


```

---

### 七、实战示例

#### 7.1 完整的循环依赖示例

```
// ========== 1. Bean定义 ==========

@Component
public class OrderService {

    @Autowired
    private UserService userService;

    public void createOrder(String userId) {
        System.out.println("创建订单,用户: " + userService.getUser(userId));
    }
}

@Component
public class UserService {

    @Autowired
    private OrderService orderService;

    public String getUser(String userId) {
        return "User-" + userId;
    }

    public void processOrder() {
        System.out.println("处理订单");
        orderService.createOrder("001");
    }
}

// ========== 2. 测试代码 ==========

public class CircularDependencyTest {

    public static void main(String[] args) {
        AnnotationConfigApplicationContext context =
            new AnnotationConfigApplicationContext();
        context.register(AppConfig.class);
        context.refresh();

        // 获取Bean
        OrderService orderService = context.getBean(OrderService.class);
        UserService userService = context.getBean(UserService.class);

        // 验证循环依赖解决
        System.out.println("OrderService中的UserService: " + orderService.userService);
        System.out.println("UserService中的OrderService: " + userService.orderService);
        System.out.println("循环依赖解决成功: " +
                         (orderService.userService.orderService == orderService));

        // 测试业务方法
        orderService.createOrder("001");
        userService.processOrder();
    }
}

@Configuration
@ComponentScan("com.example")
class AppConfig {
}


```

#### 7.2 FactoryBean示例

```
// ========== 1. 自定义FactoryBean ==========

@Component
public class ConnectionFactoryBean implements FactoryBean<Connection> {

    private String url = "jdbc:mysql://localhost:3306/mydb";
    private String username = "root";
    private String password = "123456";

    @Override
    public Connection getObject() throws Exception {
        // 复杂的创建逻辑
        Class.forName("com.mysql.cj.jdbc.Driver");
        return DriverManager.getConnection(url, username, password);
    }

    @Override
    public Class<?> getObjectType() {
        return Connection.class;
    }

    @Override
    public boolean isSingleton() {
        return true;  // 单例模式
    }
}

// ========== 2. 使用FactoryBean ==========

@Service
public class UserDao {

    @Autowired
    private Connection connection;  // 注入的是Connection,不是ConnectionFactoryBean!

    public void save(String user) throws SQLException {
        PreparedStatement ps = connection.prepareStatement(
            "INSERT INTO users(name) VALUES(?)");
        ps.setString(1, user);
        ps.executeUpdate();
    }
}

// ========== 3. 测试代码 ==========

public class FactoryBeanTest {

    public static void main(String[] args) {
        AnnotationConfigApplicationContext context =
            new AnnotationConfigApplicationContext(AppConfig.class);

        // 获取FactoryBean创建的对象
        Connection connection = context.getBean(Connection.class);
        System.out.println("Connection: " + connection);

        // 获取FactoryBean本身(加&前缀)
        ConnectionFactoryBean factory =
            context.getBean("&connectionFactoryBean", ConnectionFactoryBean.class);
        System.out.println("FactoryBean: " + factory);

        // 使用UserDao
        UserDao userDao = context.getBean(UserDao.class);
        try {
            userDao.save("Alice");
            System.out.println("保存成功!");
        } catch (SQLException e) {
            e.printStackTrace();
        }
    }
}


```

#### 7.3 自定义Scope示例

```
// ========== 1. 自定义Scope实现 ==========

public class ThreadScope implements Scope {

    private static final ThreadLocal<Map<String, Object>> THREAD_SCOPE =
        ThreadLocal.withInitial(HashMap::new);

    @Override
    public Object get(String name, ObjectFactory<?> objectFactory) {
        Map<String, Object> scope = THREAD_SCOPE.get();
        Object bean = scope.get(name);

        if (bean == null) {
            bean = objectFactory.getObject();
            scope.put(name, bean);
        }

        return bean;
    }

    @Override
    public Object remove(String name) {
        Map<String, Object> scope = THREAD_SCOPE.get();
        return scope.remove(name);
    }

    @Override
    public void registerDestructionCallback(String name, Runnable callback) {
        // 注册销毁回调
    }

    @Override
    public Object resolveContextualObject(String key) {
        return null;
    }

    @Override
    public String getConversationId() {
        return Thread.currentThread().getName();
    }

    public static void clear() {
        THREAD_SCOPE.remove();
    }
}

// ========== 2. 注册自定义Scope ==========

@Configuration
public class ScopeConfig {

    @Bean
    public static CustomScopeConfigurer customScopeConfigurer() {
        CustomScopeConfigurer configurer = new CustomScopeConfigurer();
        configurer.addScope("thread", new ThreadScope());
        return configurer;
    }
}

// ========== 3. 使用自定义Scope ==========

@Component
@Scope("thread")
public class ThreadScopedBean {

    private String threadName;

    public ThreadScopedBean() {
        this.threadName = Thread.currentThread().getName();
        System.out.println("创建ThreadScopedBean in " + threadName);
    }

    public String getThreadName() {
        return threadName;
    }
}

// ========== 4. 测试代码 ==========

public class CustomScopeTest {

    public static void main(String[] args) throws InterruptedException {
        AnnotationConfigApplicationContext context =
            new AnnotationConfigApplicationContext(ScopeConfig.class);
        context.scan("com.example");
        context.refresh();

        // 主线程获取Bean
        ThreadScopedBean bean1 = context.getBean(ThreadScopedBean.class);
        ThreadScopedBean bean2 = context.getBean(ThreadScopedBean.class);
        System.out.println("主线程: bean1 == bean2? " + (bean1 == bean2));

        // 子线程获取Bean
        Thread thread = new Thread(() -> {
            ThreadScopedBean bean3 = context.getBean(ThreadScopedBean.class);
            ThreadScopedBean bean4 = context.getBean(ThreadScopedBean.class);
            System.out.println("子线程: bean3 == bean4? " + (bean3 == bean4));
            System.out.println("主线程bean1 == 子线程bean3? " + (bean1 == bean3));

            ThreadScope.clear();  // 清理线程变量
        }, "Worker-Thread");

        thread.start();
        thread.join();
    }
}

/**
 * 输出:
 * 创建ThreadScopedBean in main
 * 主线程: bean1 == bean2? true
 * 创建ThreadScopedBean in Worker-Thread
 * 子线程: bean3 == bean4? true
 * 主线程bean1 == 子线程bean3? false
 */


```

---

### 参考资料

* Spring官方文档: https://docs.spring.io/spring-framework/docs/current/reference/html/
* Spring源码: https://github.com/spring-projects/spring-framework
* 《Spring源码深度解析》- 郝佳

本教程基于Spring Framework 5.x源码分析整理。
