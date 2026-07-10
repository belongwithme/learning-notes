---
title: "Spring-AOP(理论,实战)"
description: "典型的面向对象编程（OOP）中，模块化的基本单位是类（Class）。"
sourceId: "154611263"
source: "https://blog.csdn.net/qq_45852626/article/details/154611263"
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
  order: 154611263
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/154611263)（历史文章导入，当前状态为草稿）

## Spring-AOP 理论和实战

### 被污染的业务逻辑

**典型的面向对象编程（OOP）中，模块化的基本单位是类（Class）。**

然而，OOP 在处理某些特定问题时会遇到**结构性困难**。  
 想象一个标准的业务类，例如 UserService。其核心职责是处理用户相关的业务，如注册、登录等。

registerUser 方法除了核心的业务逻辑（例如，在数据库中创建一条用户记录）之外，还被迫承担许多非业务职责：

* 日志记录： 在方法开始时记录入参，在结束时记录结果。
* 安全检查： 在执行前检查当前用户是否有权限执行此操作。
* 事务管理： 在方法开始时开启事务，在方法结束时提交，如果发生错误则回滚。

这种编码方式导致业务逻辑被非业务功能“污染”了。  
 **这些非业务功能——例如日志、安全、事务——被称为横切关注点 (Cross-Cutting Concerns) 。**  
 它们是那些需要影响系统中多个模块，但又无法被干净地封装在单个模块中的功能 。

横切关注点会导致两个核心问题：

**代码散布 (Scattering)：** 同样的一段日志代码，会被复制并“散布”到 UserService, OrderService, ProductService 的每一个方法中 。这造成了大量的代码重复 。

**代码纠缠 (Tangling)：** 核心业务逻辑（注册用户）与非业务逻辑（日志、安全）“纠缠”在一起，严重违反了单一职责原则 (Single Responsibility Principle) ，使得代码难以阅读、测试和维护 。

AOP (Aspect-Oriented Programming, 面向切面编程) 的诞生，其**首要目的就是为了解决 OOP 范式在处理横切关注点时遇到的这一结构性难题** 。

**AOP 的目标是重组代码，将横切关注点从业务逻辑中剥离出来，让业务类“保持纯净”，只关注核心业务 。**

### 模块化关注点

AOP 是一种编程范式，它允许我们将“横切关注点”进行分离和模块化 。

**在 OOP 中，模块化的单元是“类”；而在 AOP 中，模块化的新单元是“切面 (Aspect)” 。**  
 为了更直观地理解，可以参考以下类比:  
 CSS 类比 ：

* **业务代码 (Business Logic)：** HTML 文档，负责定义内容的结构。
* **切面 (Aspect)：** CSS 样式表，负责定义内容的表现。CSS 允许使用“选择器 (Selector)”将样式（关注点）与内容（业务）分离开来，实现批量修改和维护。

### 语法词汇

#### 连接点 (Join Point)

程序执行过程中的一个点 。这可以是一个方法的执行、一个方法的调用、一个字段的访问，甚至是异常的处理 。

在 Spring AOP 的实现中，**连接点只支持“方法执行 (Method Execution)”** 。这是 Spring AOP 与完整 AspectJ 规范的第一个重大区别。

#### 切点 (Pointcut)

一个“查询表达式”，用于匹配一组连接点 ,切点负责定位。它回答了“在哪里 (Where)”执行的问题 。

#### 通知 (Advice)

切面在特定连接点（被切点匹配的连接点）上所采取的行动 (Action) 。  
 通知负责实现。  
 它回答了“做什么 (What)”和“什么时候 (When)”执行的问题 。

#### 切面 (Aspect)

横切关注点的模块化实现 。  
 **切面是一个容器。它将“切点 (Where)”和“通知 (What)”封装在一个单元（一个 Java 类）中 。**

#### 织入 (Weaving)

将切面（Aspect）链接到目标对象（Target Object）上，并创建出最终的“代理对象 (AOP Proxy)”的过程 。

织入时机： 这是 AOP 的一个高级概念，但至关重要。织入可以发生在：

* 编译时 (Compile-time)： 在 .java 编译成 .class 时，切面逻辑就被织入字节码。这是 AspectJ 的主要方式 。
* 加载时 (Load-time)： 在 .class 文件被 JVM 加载时进行织入 。
* 运行时 (Runtime)： 在应用程序运行时，动态地为目标对象创建代理。这是 Spring AOP 使用的方式 。

Spring AOP 选择在运行时织入，这意味着它不需要特殊的编译器，但它依赖于“动态代理”技术,这是 Spring AOP 易用性和局限性的根本来源.

#### 概念识别

**场景：**  
 假设有一个 CalculatorService.java 类，它有两个 public 方法：add(int a, int b) 和 subtract(int a, int b)。它还有一个 private 方法 helper()。

**问题：**

1. **[连接点]** 在 Spring AOP 的语境下，这个类中有多少个潜在的“连接点”？  
    答案： 2 个。Spring AOP 只支持方法执行作为连接点 ，并且默认只代理 public 方法。因此，add 和 subtract 是连接点，而 private 的 helper 方法不是。
2. [切点] 如果希望匹配 CalculatorService 中所有的 public 方法，这个“切点”的意图是什么？  
    答案： 一个匹配 add 和 subtract 方法执行的查询或规则 。
3. [通知] 如果希望在这些方法执行之前打印 “Calculation starts…”，需要什么类型的“通知”？  
    答案： @Before 通知
4. [切面] 应该创建哪个 Java 类来封装这个“切点”和这个“通知”？  
    答案： 一个“切面”类，例如 LoggingAspect 。

### 核心术语

#### 2.1 核心术语

```
┌──────────────────────────────────────────────────────────┐
│                    AOP 核心概念图                          │
└──────────────────────────────────────────────────────────┘

        目标对象 (Target Object)
        ┌─────────────────────────┐
        │   UserService           │
        │  ┌─────────────────┐    │
        │  │ addUser()       │◄───┼─── JoinPoint (连接点)
        │  ├─────────────────┤    │    所有可以被增强的方法
        │  │ deleteUser()    │◄───┼─── JoinPoint
        │  ├─────────────────┤    │
        │  │ updateUser()    │◄───┼─── JoinPoint
        │  └─────────────────┘    │
        └─────────────────────────┘
                   ▲
                   │
                   │ 被代理
                   │
        ┌──────────┴──────────┐
        │                     │
    代理对象 (Proxy)      切面 (Aspect)
    ┌─────────────┐      ┌──────────────────┐
    │UserService$ │      │  LogAspect       │
    │Proxy        │◄─────┤                  │
    │             │      │ @Around          │
    └─────────────┘      │ logMethod()      │
                         └──────────────────┘
                                ▲
                                │
                    ┌───────────┴───────────┐
                    │                       │
              Pointcut (切点)          Advice (通知)
              决定在哪里增强            决定增强的逻辑


```

##### 详细说明:

| 术语 | 英文 | 说明 | 示例 |
| --- | --- | --- | --- |
| **切面** | Aspect | 横切关注点的模块化,一个类 | `@Aspect` 注解的类 |
| **连接点** | JoinPoint | 程序执行的某个点(方法执行、异常抛出等) | 所有public方法 |
| **切点** | Pointcut | 匹配连接点的表达式,决定在哪增强 | `execution(* com.example..*(..))` |
| **通知** | Advice | 在切点执行的动作(前、后、环绕等) | `@Before`, `@After`, `@Around` |
| **目标对象** | Target Object | 被代理的原始对象 | UserService实例 |
| **代理** | Proxy | AOP创建的增强对象 | UserService$Proxy |
| **织入** | Weaving | 将切面应用到目标对象的过程 | Spring运行时织入 |

### 五种通知类型

```
@Aspect
@Component
public class AdviceExample {

    // 1. 前置通知:方法执行前
    @Before("execution(* com.example.service.*.*(..))")
    public void before(JoinPoint jp) {
        System.out.println("方法执行前");
    }

    // 2. 后置通知:方法正常返回后
    @AfterReturning(value = "execution(* com.example.service.*.*(..))",
                    returning = "result")
    public void afterReturning(JoinPoint jp, Object result) {
        System.out.println("方法正常返回,结果: " + result);
    }

    // 3. 异常通知:方法抛出异常后
    @AfterThrowing(value = "execution(* com.example.service.*.*(..))",
                   throwing = "ex")
    public void afterThrowing(JoinPoint jp, Exception ex) {
        System.out.println("方法抛出异常: " + ex.getMessage());
    }

    // 4. 最终通知:方法执行后(无论正常或异常)
    @After("execution(* com.example.service.*.*(..))")
    public void after(JoinPoint jp) {
        System.out.println("方法执行完毕(finally)");
    }

    // 5. 环绕通知:完全控制方法执行
    @Around("execution(* com.example.service.*.*(..))")
    public Object around(ProceedingJoinPoint pjp) throws Throwable {
        System.out.println("方法执行前");
        Object result = pjp.proceed(); // 执行目标方法
        System.out.println("方法执行后");
        return result;
    }
}


```

**执行顺序:**

```
正常流程:
@Around 前置
  └─> @Before
        └─> 目标方法执行
              └─> @AfterReturning
                    └─> @After
                          └─> @Around 后置

异常流程:
@Around 前置
  └─> @Before
        └─> 目标方法执行 (抛出异常)
              └─> @AfterThrowing
                    └─> @After


```

### 切点表达式-excution语法

```
execution(modifiers? return-type declaring-type? method-name(params) throws?)

         ┌─────────┬────────┬─────────────┬──────────┬────────┬─────────┐
         │modifiers│ return │ declaring   │  method  │ params │ throws  │
         │  可选   │  type  │   type 可选 │   name   │        │  可选   │
         └─────────┴────────┴─────────────┴──────────┴────────┴─────────┘
            权限      返回值      类路径         方法名      参数      异常


```

举例来说:

```
// 1. 匹配所有public方法
execution(public * *(..))

// 2. 匹配所有set开头的方法
execution(* set*(..))

// 3. 匹配UserService中的所有方法
execution(* com.example.service.UserService.*(..))

// 4. 匹配service包及子包下的所有方法
execution(* com.example.service..*.*(..))

// 5. 匹配第一个参数为String的方法
execution(* *(String, ..))

// 6. 匹配返回值为User的方法
execution(com.example.entity.User *(..))


```

| 符号 | 说明 | 示例 |
| --- | --- | --- |
| `*` | 匹配任意字符 | `*Service` 匹配UserService |
| `..` | 包:匹配当前包及子包 参数:匹配0个或多个参数 | `com.example..`   `*(..)` |
| `+` | 匹配指定类及其子类 | `UserService+` |

还有组合表达式:

```
// 与:&&
@Pointcut("execution(* com.example..*(..)) && args(String)")

// 或:||
@Pointcut("execution(* save*(..)) || execution(* update*(..))")

// 非:!
@Pointcut("execution(* com.example..*(..)) && !execution(* com.example.util..*(..))")


```

### 实战:请求日志记录

```
@Slf4j
@Aspect
@Component
@Order(2)  // 执行顺序,数字越小优先级越高
public class RequestLogAspect {

    private final UserProvider userProvider;
    private final LogService logService;

    @Autowired
    public RequestLogAspect(UserProvider userProvider, LogService logService) {
        this.userProvider = userProvider;
        this.logService = logService;
    }

    // 切点定义:拦截所有controller和websocket方法,排除UtilsController
    @Pointcut("(execution(* com.leadyo.plm.*.controller.*.*(..)) " +
              "|| execution(* com.leadyo.plm.message.websocket.WebSocket.*(..)))" +
              "&&!execution(* com.leadyo.plm.controller.UtilsController.*(..)) ")
    public void requestLog() {
    }

    @Around("requestLog()")
    public Object doAroundService(ProceedingJoinPoint pjp) throws Throwable {
        // 1. 记录开始时间
        long startTime = System.currentTimeMillis();

        // 2. 执行目标方法
        Object obj = pjp.proceed();

        // 3. 计算耗时
        long costTime = System.currentTimeMillis() - startTime;

        // 4. 保存日志
        printLog(costTime);

        return obj;
    }

    private void printLog(long costTime) {
        // 获取当前用户信息
        UserInfo userInfo = userProvider.get();

        if(StringUtil.isEmpty(userInfo.getUserId())){
            return;
        }

        // 构建日志实体
        LogEntity entity = new LogEntity();
        entity.setId(RandomUtil.uuId());
        entity.setCategory(LogSortEnum.Operate.getCode());
        entity.setUserId(userInfo.getUserId());
        entity.setUserName(userInfo.getUserName() + "/" + userInfo.getUserAccount());
        entity.setRequestDuration((int)costTime);  // 请求耗时
        entity.setRequestUrl(ServletUtil.getRequest().getServletPath());
        entity.setRequestMethod(ServletUtil.getRequest().getMethod());
        entity.setIpAddress(IpUtil.getIpAddress());
        entity.setCreatorTime(new Date());
        entity.setPlatForm(ServletUtil.getUserAgent());

        // 保存到数据库
        logService.save(entity);
    }
}


```

**技术要点:**

1. **@Order(2)**: 控制切面执行顺序,数字越小优先级越高
2. **复杂切点表达式**: 使用`||`(或)和`&&`(且)、`!`(非)组合多个条件
3. **@Around**: 完全控制方法执行,可以获取方法耗时
4. **ServletUtil**: 获取HTTP请求信息(URL、Method、IP等)
5. **UserProvider**: 从上下文获取当前登录用户

**执行流程图:**

```
用户请求
   │
   ↓
Controller方法
   │
   ├─→ RequestLogAspect拦截
   │       │
   │       ├─ 记录开始时间
   │       │
   │       ├─ 执行目标方法 pjp.proceed()
   │       │       │
   │       │       └─→ 业务逻辑执行
   │       │
   │       ├─ 计算耗时
   │       │
   │       └─ 保存日志到数据库
   │               │
   │               ├─ 用户信息
   │               ├─ 请求URL
   │               ├─ 请求方法
   │               ├─ IP地址
   │               └─ 执行耗时
   │
   └─→ 返回响应


```

#### 实战疑问:为什么我看有些通知里面写的是"execution",有些则是写切点呢?

写法1: 直接在通知注解中写execution表达式

```
  @Around("execution(* com.example.service..*.*(..))")
  public Object doAround(ProceedingJoinPoint pjp) throws Throwable {
      // 切面逻辑
  }


```

适用场景: 切点表达式简单,且只使用一次

写法2: 先定义@Pointcut,然后在通知中引用

```
  @Pointcut("(execution(* com.leadyo.plm.*.controller.*.*(..)) " +
            "|| execution(* com.leadyo.plm.message.websocket.WebSocket.*(..)))" +
            "&&!execution(* com.leadyo.plm.controller.UtilsController.*(..)) ")
  public void requestLog() {
  }

  @Around("requestLog()")  // 引用切点方法名
  public Object doAroundService(ProceedingJoinPoint pjp) throws Throwable {
      // 切面逻辑
  }


```

适用场景:

1. 切点表达式复杂 - 包含多个条件(||、&&、!)
2. 切点需要复用 - 多个通知使用同一个切点
3. 便于维护 - 修改切点只需改一处

#### 实战疑问: doAroundService返回了一个object对象,这个返回给谁用?它不是通知方法吗?

**原因:**

* 环绕通知**完全控制**了方法的执行
* 它相当于"包裹"了目标方法
* 如果不返回,调用者将得不到结果!

**错误示例:**

```
// ❌ 错误:不返回结果
@Around("requestLog()")
public Object doAroundService(ProceedingJoinPoint pjp) throws Throwable {
    Object obj = pjp.proceed();
    // 忘记 return obj;
    return null;  // 或者没有return语句
}

// 调用端
String userName = userService.getUserName(1L);
// userName = null ← 拿不到真实结果!业务逻辑出错!


```

### 实战:缓存清理

```
@Slf4j
@Aspect
@Component
public class VisiualOpaAspect {

    @Autowired
    UserProvider userProvider;

    @Autowired
    private RedisUtil redisUtil;

    // 拦截可视化开发相关的Controller方法
    @Pointcut("(execution(* com.leadyo.plm.onlinedev.controller.VisualdevModelDataController.*(..))) " +
              "|| execution(* com.leadyo.plm.onlinedev.controller.VisualdevModelAppController.*(..)))" +
              "|| execution(* com.leadyo.plm.generater.controller.VisualdevGenController.*(..)))")
    public void visiualOpa() {
    }

    @After("visiualOpa()")
    public void doAroundService(){
        // 获取HTTP请求方法
        String method = ServletUtil.getRequest().getMethod().toLowerCase();

        // 只在数据修改操作时清理缓存
        if("put".equals(method) || "delete".equals(method) || "post".equals(method)){
            // 获取所有可视化相关的缓存Key
            Set<String> allKey = new HashSet<>(16);
            allKey.addAll(redisUtil.getAllVisiualKeys());

            // 批量删除缓存
            for(String key : allKey){
                redisUtil.remove(key);
            }
        }
    }
}


```

**技术要点:**

1. **@After**: 后置通知,方法执行后清理缓存
2. **缓存策略**: 只在PUT/POST/DELETE时清理,GET不清理
3. **批量操作**: 一次性清理所有相关缓存
