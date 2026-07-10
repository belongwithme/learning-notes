---
title: "DTO 与 DO 转换的三种主流方案深度解析"
description: "日常开发中，多数人都会遵循分层架构的最佳实践，不同层之间的数据流转离不开对象的转换。"
sourceId: "150551730"
source: "https://blog.csdn.net/qq_45852626/article/details/150551730"
sourceSeries: []
category: java-backend
tags:
  - "Java 后端"
status: draft
difficulty: advanced
contentType: knowledge
sidebar:
  order: 150551730
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/150551730)（历史文章导入，当前状态为草稿）

## 前言

日常开发中，多数人都会遵循分层架构的最佳实践，不同层之间的数据流转离不开对象的转换。  
 最常见的场景之一便是将前端传入的 `DTO (Data Transfer Object)` 转换为数据库持久化操作的 `DO (Domain Object)`。  
 在我实习的时候负责过优惠券模块的开发,这里我就拿一个常见的业务场景为例子: **“新增优惠券模板”**

本文将深入探讨并比较实现这一转换过程的三种主流方式：

* 手动 get/set
* MapStruct
* 基于反射的工具（如 Hutool、Dozer）

看完文章后你会获得:

1. 根据不同场景选择最优方案
2. 提供给你的官方文档的链接
3. 官方文档中核心内容的解释.

### 业务背景介绍

`Controller` 层接收到的是 `CouponTemplateReqDTO`，而在 `Service` 层经过业务逻辑处理后，最终需要将数据持久化到数据库，这时就需要将其转换为 `CouponTemplateDO` 实体。

数据存储 (Data Storage)


应用服务器 (Application Server)


用户端 (Client)


1. 发送HTTP请求 (携带JSON)


2. 封装为 CouponTemplateReqDTO


3. 业务处理后, 转换为 CouponTemplateDO


4. 将DO持久化


数据库


Controller 层


Service 层


DAO/Mapper 层


浏览器/App

流程图说明:

* 客户端 -> `Controller` 层:  
   用户通过浏览器或 `App` 发起一个 `HTTP` 请求（例如，提交一个表单），请求体中通常包含 `JSON`格式的数据。
* Controller 层 -> Service 层:  
   `Controller` 接收到请求后，框架（如 `Spring MVC`）会自动将 JSON 数据封装成 `CouponTemplateReqDTO` 对象。`Controller` 随后调用 `Service` 层的方法，并将这个 `DTO` 对象作为参数传递过去。
* `Service` 层 -> `DAO` 层:  
   `Service` 层是业务逻辑的核心。在执行完必要的业务校验和处理后，它会创建一个 `CouponTemplateDO` 对象，并将 `DTO` 中的数据复制到 `DO` 中。这个 转换 的步骤是本文讨论的重点。然后，`Service` 层调用 `DAO` 层的方法，传入这个准备好持久化的 `DO` 对象。
* `DAO` 层 -> 数据库:  
   `DAO (Data Access Object)` 层负责与数据库直接交互。它接收到 `Service` 层传来的 `DO` 对象，并将其通过 `SQL` 语句（例如，`INSERT`）保存到数据库的对应表中。

### 手动get/set

这是最原始、最直接的方式。通过 new 一个目标对象，然后将源对象的属性通过 get() 方法取出，再通过 set() 方法赋给目标对象。

```
public CouponTemplateDO convertToCouponTemplateDO(CouponTemplateReqDTO reqDTO) {
    if (reqDTO == null) {
        return null;
    }

    CouponTemplateDO couponTemplateDO = new CouponTemplateDO();

    // 逐个字段进行赋值
    couponTemplateDO.setName(reqDTO.getName());
    couponTemplateDO.setDescription(reqDTO.getDescription());
    couponTemplateDO.setType(reqDTO.getType());
    couponTemplateDO.setDiscountValue(reqDTO.getDiscountValue());
    couponTemplateDO.setAvailability(reqDTO.getAvailability());
    // ... 其他字段

    return couponTemplateDO;
}


```

优缺点分析  
 优点：

1. 性能极致：没有任何额外的库开销，是所有方案中执行效率最高的。
2. 无依赖：无需引入任何第三方 jar 包，保持项目轻量。
3. 直观易懂：逻辑清晰，调试方便。

缺点：  
 4. 代码冗余繁琐：当对象字段数量众多时，`get/set` 代码会变得非常长，形成所谓的“胶水代码”，缺乏美感。  
 5. 可维护性差：如果后续`DTO 或 DO` 新增或修改了字段，开发者必须手动同步修改转换代码，非常容易遗漏，导致 `bug`。

### 编译期操作-MapStruct

`MapStruct` 是一个广受欢迎的 `Java` 注解处理器，它在 编译期 自动生成类型安全、高性能的对象映射代码。开发者只需定义一个接口，`MapStruct` 就会自动实现它。

官方网址：[mapstruct](https://mapstruct.org)

#### 官方文档核心内容(翻译后提炼总结)

##### MapStruct 是什么？

`MapStruct` 是一个 `Java Bean` 映射的代码生成器。它基于“约定优于配置”的原则，能极大地简化不同 `Java Bean` 类型之间的转换实现。

##### 为什么使用它？

* **自动化，省时省力**：在多层应用程序中（例如：实体类 `Entity` 和数据传输对象 `DTO` 之间），手动编写映射代码既繁琐又容易出错。`MapStruct` 可以自动完成这项工作。
* **高性能**：它在编译时生成普通的 `Java` 方法调用代码，而非在运行时使用反射，因此执行速度非常快。
* **类型安全且易于理解**：生成的代码是类型安全的，便于开发者在编译阶段就发现问题，并且代码逻辑清晰易懂。

##### 它是如何工作的？

MapStruct 作为一个注解处理器（`Annotation Processor`）集成在 `Java` 编译器中。你只需要通过注解来声明映射规则，它就会在编译项目时（无论是通过 `Maven、Gradle 还是 IDE`）自动生成具体的实现类。

##### 如何使用(核心步骤)

以下是一个简单的两分钟入门示例的核心流程：

一. 定义 `Mapper` 接口: 创建一个接口，并使用 `@Mapper` 注解将其标记为 `MapStruct` 的映射接口。

```
@Mapper
public interface CarMapper {
    // ...
}


```

二. 声明映射方法: 在接口中定义一个方法，该方法接受源对象（`Source`）作为参数，并返回目标对象（`Target`）。

```
// 将 Car 对象转换为 CarDto 对象
CarDto carToCarDto(Car car);


```

三. 处理不匹配的字段: 如果源对象和目标对象的字段名称不同，可以使用 `@Mapping` 注解来指定映射关系。

```
// 将源对象的 numberOfSeats 字段映射到目标对象的 seatCount 字段
@Mapping(source = "numberOfSeats", target = "seatCount")
CarDto carToCarDto(Car car);


```

四.获取 `Mapper` 实例: 通过 `Mappers.getMapper()` 方法获取 `Mapper` 接口的实例，通常的做法是在接口中定义一个静态的 `INSTANCE` 字段以便于全局访问。

```
CarMapper INSTANCE = Mappers.getMapper(CarMapper.class);


```

五. **调用方法进行映射**: 直接使用获取到的实例来执行对象映射。

```
CarDto dto = CarMapper.INSTANCE.carToCarDto(someCarObject);


```

**总结来说，MapStruct 通过简单的注解就能自动生成高性能、类型安全的 Bean 映射代码，将开发者从繁琐的手动编码中解放出来。**

#### 业务例子

第一步：定义转换器接口

```
import org.mapstruct.Mapper;
import org.mapstruct.factory.Mappers;

@Mapper
public interface CouponTemplateMapper {
    // 定义一个单例，方便调用
    CouponTemplateMapper INSTANCE = Mappers.getMapper(CouponTemplateMapper.class);

    // 定义 DTO 到 DO 的转换方法
    CouponTemplateDO toDataObject(CouponTemplateReqDTO reqDTO);

    // 如果字段名不同，可以使用 @Mapping 注解
    // @Mapping(source = "dtoFieldName", target = "doFieldName")
    // CouponTemplateDO toDataObjectWithDifferentFields(CouponTemplateReqDTO reqDTO);
}


```

第二步：在业务代码中使用

```
// 在 Service 层中调用
CouponTemplateDO couponTemplateDO = CouponTemplateMapper.INSTANCE.toDataObject(requestParam);


```

#### 底层原理

你可能会好奇 `MapStruct` 是如何工作的。当你编译项目时，`MapStruct` 会自动为你生成 `CouponTemplateMapper` 接口的实现类，其内容本质上就是我们手写的 `get/set` 代码.  
 **拿图说明一下(这张图的核心是展示 MapStruct 如何在 编译期 (Compile Time) 将开发者编写的接口自动转换成具体的实现类。)**

自动生成 (Generated Code)


Java 编译过程 (Compile Time)


开发者编写 (Development)


1. 输入到编译器


2. 处理注解并生成代码


**PersonMapperImpl.java** (实现类)
  
// ...
  
personDTO.setName(person.getName());
  
personDTO.setAge(person.getAge());
  
// ...


javac + MapStruct 注解处理器


**PersonMapper.java** (接口)
  
@Mapper
  
PersonDTO personToPersonDTO(Person person);

**流程图说明**

* **开发者编写接口**: 我们作为开发者，只需要定义一个 `PersonMapper` 接口，并使用 `@Mapper` 注解来标记它。我们在这个接口中声明需要的转换方法，但不需要写任何具体的实现代码。
* **编译期处理**: 当我们使用 `Maven 或 Gradle` 构建项目时，`Java 编译器 (javac)` 会启动。此时，`MapStruct` 作为一个注解处理器，会扫描到 `@Mapper` 注解，并根据接口中定义的方法，自动生成 一个名为 `PersonMapperImpl.java` 的实现类。
* **生成实现类**: 这个自动生成的实现类包含了所有必需的、高性能的 `get/set` 代码，其逻辑与我们手动编写的完全一样。因为这一切都发生在编译期，所以它对程序的 运行时性能没有任何影响。

---

**优缺点分析**  
 优点：

1. 性能等同 `get/set`：由于是编译期生成原生 `Java` 代码，其运行时性能与手动编写的 `get/set` 代码完全相同。
2. 代码简洁优雅：只需定义接口和方法签名，免去了繁琐的 `get/set` 代码编写。
3. 类型安全：在编译期进行类型检查，如果源和目标对象的字段类型不匹配，编译会报错，能及早发现问题。
4. 功能强大：支持字段名不一致的映射、自定义转换逻辑、集合映射等复杂场景。  
    缺点：
5. 需要引入依赖和配置：需要在 `pom.xml` 中添加 `mapstruct` 和 `mapstruct-processor` 的依赖。
6. 轻微增加学习成本：需要了解 `@Mapper、@Mapping` 等注解的用法。

### 运行时操作-Hutool/Dozer

这类工具库基于 `Java` 的 **反射机制**，在 运行时 动态地读取对象的属性并进行赋值。以 `Hutool 的 BeanUtil` 为例，它提供了极致的便利性。  
 **Hutool 官方网址**： [Hutool](https://hutool.cn)   
 **Dozer Github 地址**：[Dozer](https://github.com/DozerMapper/dozer)

这里一般用都会用Hutool,Dozer类似,Hutool中文文档写的很全面,想了解这块的直接去看里面关于属性注入的介绍即可.

#### 实现方式

使用 Hutool，对象转换真的只是一行代码的事。

```
import cn.hutool.core.bean.BeanUtil;

// 在 Service 层中调用
CouponTemplateDO couponTemplateDO = BeanUtil.toBean(requestParam, CouponTemplateDO.class);


```

这张图的核心是展示 Hutool、Dozer 这类工具如何在 运行时 (Runtime) 动态地进行对象属性复制。

输出 (Output)


运行时处理 (Runtime)


输入 (Inputs)


**新创建的目标对象 (Target Object)**
  
couponTemplateDO
  
{name: '优惠券A', type: 1, ...}


调用 BeanUtil.toBean(source, targetClass)


1. 反射: 创建目标对象实例 (new CouponTemplateDO())


2. 反射: 遍历源对象所有 'get' 方法或字段


3. 反射: 在目标对象中查找同名的 'set' 方法或字段并调用


**源对象 (Source Object)**
  
requestParam
  
{name: '优惠券A', type: 1, ...}


**目标对象的 Class**
  
CouponTemplateDO.class

**流程图说明**

1. **准备输入**: 我们需要提供两个东西：一个已经包含数据的 源对象 (比如 requestParam) 和一个我们希望转换成的 目标对象的 Class 定义 (比如 CouponTemplateDO.class)。
2. **调用工具方法**: 我们调用像 BeanUtil.toBean() 这样的静态方法。
3. **运行时内部操作**: 在程序 运行时，这个方法会执行以下操作：  
    3.1 **步骤1 (创建实例)**: 使用反射 API 根据传入的 Class 创建一个目标对象的空实例。  
    3.2 **步骤2 (遍历源)**: 使用反射 API “检查” 源对象，获取其所有的字段名和对应的值。
4. **步骤3 (匹配并赋值)**: 拿着从源对象获取的字段名，去新创建的目标对象中查找是否有同名的字段。如果找到，就通过反射调用该字段的 set 方法，将值赋过去。
5. **返回结果**: 所有匹配的字段都赋值完毕后，返回这个填充好数据的目标对象。

这个过程完全是动态的，非常灵活，但由于大量使用反射，其性能开销会比编译期生成代码的方式大得多。

**优缺点分析**  
 优点：

1. 使用极其方便：一行代码即可完成转换，极大提升开发效率，是“懒人福音”。
2. 灵活性高：对于字段的增减，无需修改转换代码，工具会自动匹配同名属性。  
    缺点：
3. 性能较差：反射是 Java 中一种性能开销较大的操作。与 get/set 或 MapStruct 相比，其性能可能有数量级的差距。对于高并发、性能敏感的核心业务，这可能成为瓶颈。
4. **“黑盒”操作**：转换过程是一个“黑盒”，**如果出现字段名拼写错误或类型不匹配的问题，只会在运行时抛出异常，编译器无法提前发现**。

### 方案对比

| 特性维度 | 手动 get/set | MapStruct | Hutool/Dozer (反射) |
| --- | --- | --- | --- |
| 性能 | ⭐⭐⭐⭐⭐ (极致) | ⭐⭐⭐⭐⭐ (极致) | ⭐⭐ (较差) |
| 代码简洁度 | ⭐ (繁琐) | ⭐⭐⭐⭐ (简洁) | ⭐⭐⭐⭐⭐ (极简) |
| 可维护性 | ⭐ (差) | ⭐⭐⭐⭐ (好) | ⭐⭐⭐ (一般) |
| 类型安全 | ⭐⭐⭐⭐⭐ (编译期) | ⭐⭐⭐⭐⭐ (编译期) | ⭐ (运行时) |
| 实现原理 | 原生 Java | 编译期代码生成 | 运行时反射 |

**选择建议**  
 **追求极致性能与零依赖：**  
 在一些底层框架或对性能要求极其严苛的场景，且对象结构简单、不常变动时，可以选择手动 get/set。  
 **大多数企业级应用（强烈推荐）：**  
 对于绝大多数 Spring Boot 项目，MapStruct 是近乎完美的解决方案。它兼顾了 get/set 的顶级性能和反射工具的便利性，同时提供了编译期类型安全保障，是团队协作和长期项目维护的“定心丸”。  
 **快速原型开发或内部工具：**  
 在开发非核心功能的管理后台、内部工具或快速验证业务逻辑的原型项目时，性能不是主要矛盾，开发效率是第一位的。此时，Hutool 或 Dozer 这样的反射工具是最佳选择。

### 总结

**没有银弹，只有最适合的场景。理解每种方案背后的原理和利弊**  
 我个人企业中开发比较喜欢用`MapStruct`.  
 但是写个人项目时比较喜欢用`Hutool`.
