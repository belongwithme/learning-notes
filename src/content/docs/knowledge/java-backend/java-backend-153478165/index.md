---
title: "refresh() 方法流程梳理图"
description: "希望这些图能帮你更清晰地理解 refresh() 方法!"
sourceId: "153478165"
source: "https://blog.csdn.net/qq_45852626/article/details/153478165"
sourceSeries:
  - "Spring核心模块解析"
category: java-backend
tags:
  - "Spring核心模块解析"
status: draft
difficulty: intermediate
contentType: knowledge
sidebar:
  order: 153478165
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/153478165)（历史文章导入，当前状态为草稿）

@[TOC](refresh() 方法流程图)

### 一、refresh() 方法整体流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                    Spring容器启动 - refresh()                     │
└─────────────────────────────────────────────────────────────────┘

  启动阶段                              核心阶段                    完成阶段
┌──────────┐                      ┌──────────────┐              ┌──────────┐
│          │                      │              │              │          │
│  准备    │ ──────────────────> │   处理配置   │ ──────────> │  创建Bean │
│  环境    │                      │   和扩展     │              │  和初始化 │
│          │                      │              │              │          │
└──────────┘                      └──────────────┘              └──────────┘
    │                                   │                            │
    ├─ 1. prepareRefresh()              ├─ 5. invokeBeanFactory      ├─ 11. finishBeanFactory
    │    记录时间,设置状态               │     PostProcessors        │      Initialization
    │                                   │     🔥扫描@Component       │      🔥创建所有Bean
    ├─ 2. obtainFreshBeanFactory()     │                            │
    │    加载BeanDefinition            ├─ 6. registerBeanPost       ├─ 12. finishRefresh()
    │                                   │     Processors             │      发布完成事件
    ├─ 3. prepareBeanFactory()         │     注册Bean后置处理器      │
    │    配置类加载器等                  │                            │
    │                                   ├─ 7. initMessageSource()    │
    ├─ 4. postProcessBeanFactory()     │    国际化支持               │
    │    Web容器扩展点                   │                            │
    │                                   ├─ 8. initApplicationEvent   │
    │                                   │     Multicaster            │
    │                                   │    事件广播器               │
    │                                   │                            │
    │                                   ├─ 9. onRefresh()            │
    │                                   │    Web容器启动Tomcat        │
    │                                   │                            │
    │                                   └─ 10. registerListeners()   │
    │                                        注册事件监听器            │
    │                                                                │
    └────────────────────────────────────────────────────────────────┘

    ⏱️  耗时: 很快                 ⏱️  耗时: 快                 ⏱️  耗时: 最慢(创建对象)


```

### 二、BeanDefinition → Bean实例 转化过程

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Bean的诞生过程                                │
└─────────────────────────────────────────────────────────────────────┘

1️⃣ 读取配置阶段 (步骤2)
┌──────────────┐
│  XML/注解配置  │
│              │
│ @Component   │
│ @Service     │
│ <bean>       │
└──────┬───────┘
       │ 解析
       ↓
┌──────────────────┐
│  BeanDefinition  │  ← 这是"设计图纸",包含:
│  ┌────────────┐  │     • 类名: UserService
│  │beanClass   │  │     • 作用域: singleton
│  │scope       │  │     • 属性值: {...}
│  │properties  │  │     • 是否懒加载: false
│  │lazyInit    │  │
│  └────────────┘  │
└────────┬─────────┘
         │
         │ 存储到 BeanDefinitionRegistry
         ↓
    ┌─────────────────────┐
    │  BeanFactory容器     │
    │  ┌────────────────┐ │
    │  │ "userService"  │ │ ← 这时还只是配置信息
    │  │ "orderService" │ │    Bean对象还没创建!
    │  │ "productDAO"   │ │
    │  └────────────────┘ │
    └──────────┬──────────┘
               │
               │
2️⃣ 修改配置阶段 (步骤5)
               │
               ↓
    ┌─────────────────────────────┐
    │  BeanFactoryPostProcessor   │ ← 可以修改BeanDefinition
    │  ┌────────────────────────┐ │
    │  │ 替换${占位符}            │ │
    │  │ 扫描@Configuration       │ │
    │  │ 添加新的BeanDefinition   │ │
    │  └────────────────────────┘ │
    └──────────┬──────────────────┘
               │
               │
3️⃣ 创建Bean阶段 (步骤11) 🔥🔥🔥
               │
               ↓
    ┌──────────────────────┐
    │ 实例化Bean对象         │
    │ new UserService()    │
    └──────┬───────────────┘
           │
           ↓
    ┌──────────────────────┐
    │ 填充属性 (依赖注入)    │
    │ @Autowired注入        │
    └──────┬───────────────┘
           │
           ↓
    ┌──────────────────────────┐
    │ Aware接口回调             │
    │ setBeanName()            │
    │ setBeanFactory()         │
    └──────┬───────────────────┘
           │
           ↓
    ┌──────────────────────────┐
    │ 前置处理                  │
    │ postProcessBefore        │
    │ Initialization()         │
    └──────┬───────────────────┘
           │
           ↓
    ┌──────────────────────────┐
    │ 初始化方法                │
    │ @PostConstruct           │
    │ afterPropertiesSet()     │
    │ init-method              │
    └──────┬───────────────────┘
           │
           ↓
    ┌──────────────────────────┐
    │ 后置处理 🔥               │
    │ postProcessAfter         │
    │ Initialization()         │
    │ (AOP代理在这里生成!)      │
    └──────┬───────────────────┘
           │
           ↓
    ┌──────────────────────┐
    │  完整的Bean对象        │
    │  ┌────────────────┐  │
    │  │ UserService    │  │ ← 可以使用了!
    │  │ (可能是代理对象) │  │
    │  └────────────────┘  │
    └──────────────────────┘


```

### 三、两个重要PostProcessor的执行时机对比

```
┌────────────────────────────────────────────────────────────────┐
│               PostProcessor 执行时机对比图                       │
└────────────────────────────────────────────────────────────────┘

时间线 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━>

┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│ 步骤2       │       │ 步骤5       │       │ 步骤11      │
│ 加载配置     │       │ 处理配置     │       │ 创建Bean     │
└─────────────┘       └─────────────┘       └─────────────┘
      │                     │                      │
      │                     │                      │
      ↓                     ↓                      ↓
 BeanDefinition      BeanFactory            Bean Instance
   已加载               PostProcessor           开始创建
                         执行 🔥
                         │
                    ┌────┴────┐
                    │         │
              修改配置信息    扫描注解
              ${} → 实际值    @Component
                             @Configuration
                                  │
                                  │
                                  └──────────────────┐
                                                    │
                                                    ↓
                                          ┌──────────────────┐
                                          │ BeanPostProcessor│
                                          │      执行 🔥      │
                                          └────────┬─────────┘
                                                   │
                                    ┌──────────────┼──────────────┐
                                    │              │              │
                                    ↓              ↓              ↓
                              初始化前处理      初始化后处理    处理每个Bean
                              @Autowired       生成AOP代理      (循环执行)
                              注入依赖         @Async代理

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

关键区别:

BeanFactoryPostProcessor               BeanPostProcessor
        ↓                                     ↓
• 执行时机:Bean实例化之前               • 执行时机:Bean实例化过程中
• 作用对象:BeanDefinition              • 作用对象:Bean实例
• 执行次数:只执行一次                  • 执行次数:每个Bean都执行
• 典型应用:扫描@Component              • 典型应用:生成AOP代理
           替换占位符                           @Autowired注入


```

### 四、refresh()方法中的数据流转图

```
┌────────────────────────────────────────────────────────────────────┐
│                        数据流转全景图                                │
└────────────────────────────────────────────────────────────────────┘

输入                    中间产物                        最终产出
 │                         │                              │
 │                         │                              │
┌┴──────────────┐    ┌────┴──────────────┐    ┌─────────┴─────────┐
│               │    │                   │    │                   │
│  配置文件      │    │  BeanDefinition   │    │  Bean实例对象      │
│               │    │    Registry       │    │                   │
│ applicationContext  │                   │    │  ┌──────────────┐ │
│   .xml        │───>│  ┌──────────────┐ │───>│  │ UserService  │ │
│               │    │  │"userService" │ │    │  │  (单例)      │ │
│ @Configuration│    │  │  → BeanDef   │ │    │  └──────────────┘ │
│ @Component    │    │  ├──────────────┤ │    │                   │
│ @Service      │    │  │"orderService"│ │    │  ┌──────────────┐ │
│               │    │  │  → BeanDef   │ │    │  │ OrderService │ │
└───────────────┘    │  ├──────────────┤ │    │  │  (单例)      │ │
                     │  │"productDAO"  │ │    │  └──────────────┘ │
                     │  │  → BeanDef   │ │    │                   │
                     │  └──────────────┘ │    │  ┌──────────────┐ │
                     │                   │    │  │ ProductDAO   │ │
                     └───────────────────┘    │  │  (单例)      │ │
                                              │  └──────────────┘ │
                          ↑                   │                   │
                          │                   └───────────────────┘
                          │                             ↓
                    修改/增强                       应用程序使用
                          │                        context.getBean()
                  ┌───────┴────────┐                   @Autowired
                  │                │
           BeanFactory        Bean
           PostProcessor      PostProcessor
                  │                │
            修改配置信息        增强Bean实例
            添加新配置          生成代理对象


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

关键转换点:

步骤2: 配置 → BeanDefinition
步骤5: BeanDefinition → 增强的BeanDefinition  (通过BeanFactoryPostProcessor)
步骤11: BeanDefinition → Bean实例             (通过反射+依赖注入)
       Bean实例 → 增强的Bean实例                (通过BeanPostProcessor)


```

### 五、实际案例:一个@Service Bean的完整生命周期

```
┌────────────────────────────────────────────────────────────────┐
│          UserService 从代码到对象的完整旅程                       │
└────────────────────────────────────────────────────────────────┘

📝 源代码:
┌────────────────────────────┐
│ @Service                   │
│ public class UserService { │
│   @Autowired               │
│   private UserDAO userDAO; │
│                            │
│   @PostConstruct           │
│   public void init() {...} │
│ }                          │
└────────────────────────────┘
            │
            │ (步骤5) 扫描阶段
            ↓
┌─────────────────────────────────┐
│ ConfigurationClassPostProcessor │ ← BeanFactoryPostProcessor
│ 发现 @Service 注解               │
└────────────┬────────────────────┘
             │
             ↓ 生成
┌────────────────────────────────┐
│ BeanDefinition                 │
│ ┌────────────────────────────┐ │
│ │ beanName: userService      │ │
│ │ beanClass: UserService.class│ │
│ │ scope: singleton           │ │
│ │ lazyInit: false            │ │
│ └────────────────────────────┘ │
└────────────┬───────────────────┘
             │
             │ 存入容器,等待实例化
             ↓
        [等待步骤11]
             │
             │ (步骤11) 开始创建
             ↓
┌─────────────────────────────────┐
│ 1. 实例化                        │
│    new UserService()            │ ← 反射创建对象
│    (此时userDAO还是null)         │
└────────────┬────────────────────┘
             │
             ↓
┌─────────────────────────────────┐
│ 2. 属性注入                      │
│    AutowiredAnnotation          │ ← BeanPostProcessor
│    BeanPostProcessor            │    处理@Autowired
│    发现 @Autowired              │
│    注入 userDAO                 │
└────────────┬────────────────────┘
             │
             ↓
┌─────────────────────────────────┐
│ 3. Aware接口回调                 │
│    setBeanName("userService")   │
│    setBeanFactory(...)          │
│    setApplicationContext(...)   │
└────────────┬────────────────────┘
             │
             ↓
┌─────────────────────────────────┐
│ 4. 初始化前置处理                │
│    @PostConstruct注解处理器      │ ← BeanPostProcessor
│    执行 init() 方法              │
└────────────┬────────────────────┘
             │
             ↓
┌─────────────────────────────────┐
│ 5. 初始化后置处理                │
│    如果有@Transactional         │ ← BeanPostProcessor
│    生成AOP代理对象               │    (可能替换原对象)
│    UserService$$Proxy           │
└────────────┬────────────────────┘
             │
             ↓
┌─────────────────────────────────┐
│ 6. 放入单例池                    │
│    singletonObjects.put(        │
│      "userService",             │
│      userServiceProxy           │
│    )                            │
└────────────┬────────────────────┘
             │
             ↓
    ✅ 完成!可以被注入到其他Bean了


```

### 六、重点关注的两个核心步骤详细图

```
┌────────────────────────────────────────────────────────────────┐
│  步骤5: invokeBeanFactoryPostProcessors (扫描注解)              │
└────────────────────────────────────────────────────────────────┘

                            开始
                             │
                             ↓
        ┌────────────────────────────────────┐
        │ ConfigurationClassPostProcessor    │ 🔥最重要的处理器
        │ (implements BeanFactoryPostProcessor)│
        └────────────┬───────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ↓            ↓            ↓
   扫描@Component  处理@Import  处理@Bean方法
        │            │            │
        │            │            │
        ↓            ↓            ↓
   @Service      导入的配置类    @Configuration中
   @Repository                  的@Bean方法
   @Controller
        │            │            │
        └────────────┼────────────┘
                     │
                     ↓
            生成 BeanDefinition
                     │
                     ↓
            注册到 BeanFactory
                     │
                     ↓
                   完成

结果: 所有需要创建的Bean配置信息都已准备好!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌────────────────────────────────────────────────────────────────┐
│  步骤11: finishBeanFactoryInitialization (创建Bean)            │
└────────────────────────────────────────────────────────────────┘

                            开始
                             │
                             ↓
                    获取所有BeanDefinition
                             │
                             ↓
                    按依赖关系排序
                             │
                             ↓
        ┌────────────────────────────────┐
        │  循环处理每个BeanDefinition      │
        │  for(BeanDefinition bd : bds)  │
        └────────────┬───────────────────┘
                     │
                     ↓
              ┌──────────────┐
              │ 已创建? ────────> 是 ──> 跳过(单例池已有)
              └──┬───────────┘
                 │ 否
                 ↓
           调用 getBean(name)
                 │
                 ↓
           调用 doCreateBean()
                 │
      ┌──────────┼──────────┐
      │          │          │
      ↓          ↓          ↓
   实例化    属性注入    初始化
  反射创建   @Autowired  各种回调
             │          BeanPostProcessor
             │              │
             └──────┬───────┘
                    │
                    ↓
            返回完整的Bean实例
                    │
                    ↓
            放入单例池(缓存)
                    │
                    ↓
              下一个Bean ──┐
                    ↑      │
                    └──────┘
                    │
                   全部完成

结果: 所有非懒加载的单例Bean都已创建并可用!


```

### 🎯核心内容简记

```
┌────────────────────────────────────┐
│    记住这个简化版本就够了!           │
└────────────────────────────────────┘

refresh() = 三大阶段

    准备阶段              核心阶段              创建阶段
       ↓                    ↓                    ↓
   加载配置            扫描+处理配置           创建所有Bean
(obtainFreshBean)  (invokeBeanFactory    (finishBeanFactory
     Factory)          PostProcessors)       Initialization)
       ↓                    ↓                    ↓
  BeanDefinition      更多BeanDefinition        Bean实例
   已加载到容器         注册到容器              放入单例池

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

两个核心扩展点:

  BeanFactoryPostProcessor         BeanPostProcessor
          ↓                               ↓
    修改配置信息                      增强Bean实例
    (步骤5执行)                      (步骤11中执行)


```

---

希望这些图能帮你更清晰地理解 `refresh()` 方法!
