---
title: "JVM-类加载机制"
description: "对于Java开发者来说，我们每天都在编写 .java 文件，然后通过编译器将其编译成 .class 文件。那么，这些 .class 文件是如何被加载到Java虚拟机（JVM）中，并最终变成我们可以在程序中使用的对象和方法的呢？这个过程就是 类加载（Class Loading）。"
sourceId: "147471419"
source: "https://blog.csdn.net/qq_45852626/article/details/147471419"
sourceSeries:
  - "JVM"
category: java-backend
subcategory: jvm-runtime
tags:
  - "JVM"
status: draft
difficulty: advanced
contentType: source-analysis
sidebar:
  order: 147471419
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/147471419)（历史文章导入，当前状态为草稿）

### 前言：为什么需要了解类加载？

对于Java开发者来说，我们每天都在编写 `.java` 文件，然后通过编译器将其编译成 `.class` 文件。那么，这些 `.class` 文件是如何被加载到Java虚拟机（JVM）中，并最终变成我们可以在程序中使用的对象和方法的呢？这个过程就是 **类加载（Class Loading）**。

理解类加载机制，不仅仅是满足技术好奇心，更是解决实际问题的关键。你是否遇到过 `ClassNotFoundException` 或 `NoClassDefFoundError` 异常？是否好奇为什么 Tomcat 等Web容器可以隔离不同应用的类库？是否想了解热部署、模块化等高级特性是如何实现的？这些问题的答案，都深藏在类加载机制之中。

### 什么是类加载？生命周期概览

**类加载** 是指 Java 虚拟机（JVM）将描述类的数据从 `.class` 文件（或其他来源）加载到内存，并对数据进行校验、转换、解析和初始化，最终形成可以被虚拟机直接使用的 Java 类型（`java.lang.Class` 对象）的过程。

一个类型（类或接口）从被加载到虚拟机内存中开始，到卸载出内存为止，它的整个生命周期可以划分为以下 **七个阶段**：

1. **加载 (Loading)**
2. **验证 (Verification)**
3. **准备 (Preparation)**
4. **解析 (Resolution)**
5. **初始化 (Initialization)**
6. **使用 (Using)**
7. **卸载 (Unloading)**

其中，**验证、准备、解析** 三个阶段通常被统称为 **连接 (Linking)** 阶段。

这个过程并不是严格按照这个顺序按部就班地执行，比如解析阶段有时可以在初始化阶段之后再开始，这是为了支持 Java 语言的动态绑定（也称为晚期绑定或运行时绑定）。但大体上，类的加载、连接、初始化这几个主要步骤的开始顺序是确定的。

接下来的章节，我们将详细探讨加载、连接（验证、准备、解析）、初始化这五个核心阶段。

---

### 类加载过程详解

#### 3.1 加载 (Loading)

“加载”是整个类加载过程的第一个阶段。在这个阶段，JVM 需要完成以下三件事情：

1. **通过一个类的全限定名来获取定义此类的二进制字节流。**

   * **理解帮助**：全限定名就像一个类的身份证号，例如 `java.lang.String`。JVM 需要根据这个名字找到对应的 `.class` 文件。这个字节流并不一定来自本地文件系统中的 `.class` 文件，它可以来自多种渠道，例如：
     + 从 ZIP 包（如 JAR、WAR）中读取。
     + 从网络中获取（例如 Applet）。
     + 运行时计算生成（例如动态代理技术）。
     + 由其他文件生成（例如 JSP 文件编译成的 Class）。
     + 从数据库中读取。
     + …等等。
   * 这种开放性是 Java 强大灵活性的体现，许多技术（如热部署、代码加密）都依赖于此。
2. **将这个字节流所代表的静态存储结构转化为方法区的运行时数据结构。**

   * **理解帮助**：`.class` 文件中存储的是类的静态描述信息，比如类的字段、方法、常量池等。JVM 需要将这些静态信息解析出来，并按照 JVM 规范的要求，在内存的方法区（Metaspace 或 PermGen）中组织成特定的数据结构，供后续阶段使用。
3. **在内存中生成一个代表这个类的 `java.lang.Class` 对象，作为方法区这个类的各种数据的访问入口。**

   * **理解帮助**：我们平时通过 `MyClass.class` 或者 `obj.getClass()` 获取到的就是这个 `Class` 对象。它像是一个接口，让我们可以通过它访问到 JVM 方法区中关于这个类的所有信息（字段、方法、构造器等）。这个 `Class` 对象通常存储在 Java 堆（Heap）中，但 HotSpot VM 将其放到了方法区。

**注意**：加载阶段和连接阶段的部分动作（如一部分字节码文件格式验证）是交叉进行的，加载阶段尚未完成，连接阶段可能已经开始。但这并不影响我们概念上对这两个阶段的划分。

#### 3.2 连接 (Linking)

连接阶段是将加载到内存的类数据组装起来，使其成为 JVM 可以运行的状态。它又细分为验证、准备和解析三个子阶段。

##### 3.2.1 验证 (Verification)

验证是连接阶段的第一步，其目的是确保 Class 文件的字节流中包含的信息符合《Java虚拟机规范》的全部约束要求，保证这些信息被当作代码运行后不会危害虚拟机自身的安全。

**理解帮助**：想象一下，如果任何人都可以随意编写字节码并让 JVM 加载运行，那将是极其危险的。验证阶段就像是 JVM 的一道安全防线，对加载进来的字节码进行严格的检查。这个过程大致会进行下面四个阶段的检验：

1. **文件格式验证**：

   * 检查字节流是否以魔数 `0xCAFEBABE` 开头。
   * 主、次版本号是否在当前 JVM 处理范围之内。
   * 常量池的常量中是否有不被支持的常量类型。
   * 指向常量的各种索引值中是否有指向不存在的常量或不符合类型的常量。
   * …等等。
   * **目的**：确保字节流能正确地解析并存储于方法区之内，格式上符合描述一个 Java 类型信息的要求。这阶段是基于**二进制字节流**进行的。
2. **元数据验证**：

   * 对字节码描述的信息进行语义分析，以保证其描述的信息符合 Java 语言规范的要求。
   * 这个类是否有父类（除了 `java.lang.Object` 之外，所有的类都应当有父类）。
   * 这个类的父类是否继承了不允许被继承的类（被 `final` 修饰的类）。
   * 如果这个类不是抽象类，是否实现了其父类或接口之中要求实现的所有方法。
   * 类中的字段、方法是否与父类产生矛盾（例如覆盖了父类的 `final` 字段，或者出现不符合规则的方法重载）。
   * …等等。
   * **目的**：对类的元数据信息进行语义校验，保证不存在不符合 Java 语言规范的元数据信息。
3. **字节码验证**：

   * 这是整个验证过程中最复杂的一个阶段，主要目的是通过数据流分析和控制流分析，确定程序语义是合法的、符合逻辑的。
   * 保证任意时刻操作数栈的数据类型与指令代码序列都能配合工作，例如不会出现类似“在操作栈放置了一个 `int` 类型的数据，使用时却按 `long` 类型来加载入本地变量表中”这样的情况。
   * 保证任何跳转指令都不会跳转到方法体以外的字节码指令上。
   * 保证方法体中的类型转换总是有效的，例如可以把一个子类对象赋值给父类数据类型，这是安全的，但是把父类对象赋值给子类数据类型，甚至把对象赋值给与它毫无继承关系、完全不相干的一个数据类型，则是危险和不合法的。
   * …等等。
   * **目的**：确保类的方法体（字节码）在运行时不会做出危害虚拟机安全的行为。Java 6 之后引入的 StackMapTable 技术，使得字节码验证的实现变得更加高效。
4. **符号引用验证**：

   * 发生在 JVM 将符号引用转化为直接引用的时候，这个转化动作将在连接的第三阶段——解析阶段中发生。
   * 验证符号引用中通过字符串描述的全限定名是否能找到对应的类。
   * 在指定类中是否存在符合方法的字段描述符及简单名称所描述的方法和字段。
   * 符号引用中的类、字段、方法的可访问性（`private`、`protected`、`public`、`package`）是否可被当前类访问。
   * …等等。
   * **目的**：确保解析行为能正常执行，如果无法通过符号引用验证，将会抛出一个 `java.lang.IncompatibleClassChangeError` 的子类异常，如 `IllegalAccessError`、`NoSuchFieldError`、`NoSuchMethodError` 等。

验证阶段对于虚拟机的安全至关重要，但不是必须的（因为大部分验证在编译期间已经完成）。如果代码来源可靠，可以通过 `-Xverify:none` 参数关闭大部分的类验证措施，以缩短虚拟机类加载的时间。

##### 3.2.2 准备 (Preparation)

准备阶段是 **正式为类中定义的变量（即静态变量，被 `static` 修饰的变量）分配内存并设置类变量初始值** 的阶段。

**理解帮助**：

* **分配内存**：仅仅是为静态变量分配内存空间，实例变量（非 `static` 的）是在对象实例化时随着对象一起分配在 Java 堆中的。
* **设置初始值**：这里的初始值指的是数据类型的 **零值** (Zero Value)，而不是我们在 Java 代码中显式赋予的值。
  + `int`: 0
  + `long`: 0L
  + `short`: (short) 0
  + `char`: ‘\u0000’
  + `byte`: (byte) 0
  + `boolean`: false
  + `float`: 0.0f
  + `double`: 0.0d
  + `reference` (引用类型): null

**示例**：

```
public class MyClass {
    public static int value = 123; // 准备阶段后 value 的值是 0，而不是 123
    public static final int CONST_VALUE = 456; // 特殊情况！
    public static String text = "hello"; // 准备阶段后 text 的值是 null
    public static final String CONST_TEXT = "world"; // 特殊情况！
}


```

在准备阶段：

* 变量 `value` 会被分配内存，并初始化为 `0`。赋值 `123` 的动作是在 **初始化阶段** 执行的。
* 变量 `text` 会被分配内存，并初始化为 `null`。赋值 `"hello"` 的动作也是在 **初始化阶段** 执行的。

**特殊情况：`static final` 常量**

如果类字段的字段属性表中存在 `ConstantValue` 属性（即同时被 `static` 和 `final` 修饰，并且是基本类型或 `String` 类型），那么在准备阶段，变量就会被初始化为 `ConstantValue` 属性所指定的值。

所以在上面的例子中：

* `CONST_VALUE` 在准备阶段就会被直接赋值为 `456`。
* `CONST_TEXT` 在准备阶段就会被直接赋值为 `"world"`。

这是因为这些常量的值在编译时就已经确定，并存储在 `.class` 文件的常量池中。

##### 3.2.3 解析 (Resolution)

解析阶段是 **Java 虚拟机将常量池内的符号引用替换为直接引用** 的过程。

**理解帮助**：

* **符号引用 (Symbolic References)**：以一组符号来描述所引用的目标。符号可以是任何形式的字面量，只要使用时能无歧义地定位到目标即可。符号引用与虚拟机实现的内存布局无关，引用的目标并不一定是已经加载到虚拟机内存当中的内容。

  + 例如，`.class` 文件中用 `CONSTANT_Class_info`、`CONSTANT_Fieldref_info`、`CONSTANT_Methodref_info` 等常量来描述类、字段、方法。这些都是符号引用。
* **直接引用 (Direct References)**：可以直接指向目标的指针、相对偏移量或者是一个能间接定位到目标的句柄。直接引用是和虚拟机实现的内存布局直接相关的，同一个符号引用在不同虚拟机实例上翻译出来的直接引用一般不会相同。如果有了直接引用，那引用的目标必定已经在虚拟机的内存中存在。

解析动作主要针对 **类或接口、字段、类方法、接口方法、方法类型、方法句柄和调用点限定符** 这 7 类符号引用进行。

解析阶段的发生时机并不固定，JVM 规范并未规定解析阶段发生的具体时间，只要求了在执行 `ane-warray`、`checkcast`、`getfield`、`getstatic`、`instanceof`、`invokedynamic`、`invokeinterface`、`invokespecial`、`invokestatic`、`invokevirtual`、`ldc`、`ldc_w`、`ldc2_w`、`multianewarray`、`new`、`putfield`、`putstatic` 这 17 个用于操作符号引用的字节码指令**之前**，先对它们所使用的符号引用进行解析。

所以，虚拟机实现可以根据需要来判断，是在类被加载器加载时就对常量池中的符号引用进行解析（**饿汉式/静态解析**），还是等到一个符号引用将要被使用前才去解析它（**懒汉式/动态解析**）。

对同一个符号引用进行多次解析请求是很常见的事情，除了 `invokedynamic` 指令以外，虚拟机实现可以对第一次解析的结果进行缓存（在运行时常量池中记录直接引用，并把常量标识为已解析状态），从而避免解析操作的重复执行。

#### 3.3 初始化 (Initialization)

初始化阶段是类加载过程的最后一步，之前的所有阶段，除了在加载阶段用户应用程序可以通过自定义类加载器参与之外，其余动作完全由虚拟机主导和控制。直到初始化阶段，Java 虚拟机才真正开始执行类中编写的 Java 程序代码（或者说是字节码）。

**理解帮助**：

在准备阶段，变量已经赋过一次系统要求的初始零值，而在初始化阶段，则会根据程序员通过程序编码制定的主观计划去 **初始化类变量和其他资源**。

简单来说，初始化阶段就是执行 **类构造器 `<clinit>()` 方法** 的过程。

##### 3.3.1 `<clinit>()` 方法

`<clinit>()` 方法并不是程序员在 Java 代码中直接编写的，它是 **Javac 编译器的自动生成物**。它是由编译器自动收集类中的所有 **类变量的赋值动作** 和 **静态语句块（`static{}` 块）** 中的语句合并产生的。

**合并规则**：

* 编译器收集的顺序是由语句在源文件中出现的顺序决定的。
* 静态语句块中只能访问到定义在静态语句块之前的变量，定义在它之后的变量，在前面的静态语句块可以赋值，但是不能访问。

**示例**：

```
public class InitOrder {
    static {
        i = 0;  // 给变量 i 赋值可以正常编译通过
        // System.out.print(i); // 这句编译器会提示“非法向前引用” (Illegal forward reference)
    }
    static int i = 1;

    static {
        System.out.println(i); // 这里可以访问和打印 i，输出 1
    }

    public static void main(String[] args) {
        // ...
    }
}


```

编译后生成的 `<clinit>()` 方法大致如下（伪代码）：

```
<clinit>() {
  i = 0;
  i = 1; // 静态变量赋值语句
  System.out.println(i); // 静态块语句
  return;
}


```

**`<clinit>()` 方法的特点**：

1. **不需要显式调用父类构造器**：`<clinit>()` 方法与类的构造函数（即在虚拟机视角中的实例构造器 `<init>()` 方法）不同，它不需要显式调用父类的 `<clinit>()` 方法。Java 虚拟机会保证在子类的 `<clinit>()` 方法执行前，父类的 `<clinit>()` 方法已经执行完毕。因此，在虚拟机中第一个被执行的 `<clinit>()` 方法的类型肯定是 `java.lang.Object`。
2. **父类 `<clinit>()` 优先执行**：由于父类的 `<clinit>()` 方法先执行，也就意味着父类中定义的静态语句块要优先于子类的变量赋值操作。
3. **非必需**：如果一个类中没有静态语句块，也没有对类变量的赋值操作，那么编译器可以不为这个类生成 `<clinit>()` 方法。
4. **接口的 `<clinit>()`**：接口中不能使用静态语句块，但仍然有变量初始化的赋值操作，因此接口与类一样都会生成 `<clinit>()` 方法。但接口与类不同的是，执行接口的 `<clinit>()` 方法不需要先执行父接口的 `<clinit>()` 方法，因为只有当父接口中定义的变量被使用时，父接口才会被初始化。此外，接口的实现类在初始化时也一样不会执行接口的 `<clinit>()` 方法。
5. **线程安全**：Java 虚拟机必须保证一个类的 `<clinit>()` 方法在多线程环境中被正确地加锁同步。如果多个线程同时去初始化一个类，那么只会有其中一个线程去执行这个类的 `<clinit>()` 方法，其他线程都需要阻塞等待，直到活动线程执行完毕 `<clinit>()` 方法。

##### 3.3.2 初始化触发时机

Java 虚拟机规范严格规定了 **有且只有** 六种情况必须立即对类进行“初始化”（而加载、验证、准备自然需要在此之前开始），这六种场景被称为对一个类型的 **主动引用** (Active Reference)：

1. **遇到 `new`、`getstatic`、`putstatic` 或 `invokestatic` 这四条字节码指令时**：

   * 使用 `new` 关键字实例化对象的时候。
   * 读取或设置一个类型的静态字段（被 `final` 修饰、已在编译期把结果放入常量池的静态字段除外）的时候。
   * 调用一个类型的静态方法的时候。
2. **使用 `java.lang.reflect` 包的方法对类型进行反射调用的时候**：如果类型没有进行过初始化，则需要先触发其初始化。例如 `Class.forName("com.example.MyClass")`。
3. **当初始化类的时候，如果发现其父类还没有进行过初始化，则需要先触发其父类的初始化**。
4. **当虚拟机启动时，用户需要指定一个要执行的主类（包含 `main()` 方法的那个类），虚拟机会先初始化这个主类**。
5. **当使用 JDK 7 新加入的动态语言支持时，如果一个 `java.lang.invoke.MethodHandle` 实例最后的解析结果为 `REF_getStatic`、`REF_putStatic`、`REF_invokeStatic`、`REF_newInvokeSpecial` 四种类型的方法句柄，并且这个方法句柄对应的类没有进行过初始化，则需要先触发其初始化**。
6. **当一个接口定义了 JDK 8 新加入的默认方法（被 `default` 关键字修饰的接口方法）时，如果有这个接口的实现类发生了初始化，那该接口要在其之前被初始化**。

**注意**：这六种场景以外，所有引用类型的方式都不会触发初始化，称为 **被动引用** (Passive Reference)。常见的被动引用例子：

* **通过子类引用父类的静态字段，不会导致子类初始化**。只会触发父类的初始化。

  ```
  class Parent {
      static int value = 10;
      static { System.out.println("Parent init!"); }
  }
  class Child extends Parent {
      static { System.out.println("Child init!"); }
  }
  public class Test {
      public static void main(String[] args) {
          System.out.println(Child.value); // 只会输出 "Parent init!" 和 10，不会输出 "Child init!"
      }
  }


  + 1
  + 2
  + 3
  + 4
  + 5
  + 6
  + 7
  + 8
  + 9
  + 10
  + 11
  + 12
  ```
* **通过数组定义来引用类，不会触发此类的初始化**。数组类本身不通过类加载器创建，它是由 Java 虚拟机直接在内存中动态构造出来的。

  ```
  public class Test {
      public static void main(String[] args) {
          Parent[] parents = new Parent[10]; // 不会输出 "Parent init!"
      }
  }


  + 1
  + 2
  + 3
  + 4
  + 5
  ```
* **常量在编译阶段会存入调用类的常量池中，本质上没有直接引用到定义常量的类，因此不会触发定义常量的类的初始化**。

  ```
  class ConstClass {
      static final String HELLO = "hello world";
      static { System.out.println("ConstClass init!"); }
  }
  public class Test {
      public static void main(String[] args) {
          System.out.println(ConstClass.HELLO); // 不会输出 "ConstClass init!"
      }
  }


  + 1
  + 2
  + 3
  + 4
  + 5
  + 6
  + 7
  + 8
  + 9
  ```

  这里 `HELLO` 在编译后，`Test` 类的常量池中会直接持有 `"hello world"` 的引用，与 `ConstClass` 没有关系了。

##### 3.3.3 初始化过程中的线程安全

类的初始化阶段是线程安全的。JVM 内部会保证一个类的 `<clinit>()` 方法在多线程环境下被正确地加锁、同步。

**理解帮助**：

想象一下，如果有多个线程同时尝试初始化同一个类（例如，同时调用该类的静态方法），如果没有同步机制，可能会导致 `<clinit>()` 方法被执行多次，或者出现状态不一致的问题。

JVM 的实现方式通常是这样的：

1. 当一个线程尝试初始化一个类时，它会先获取该类的初始化锁。
2. 如果锁未被持有，该线程获得锁，并开始执行 `<clinit>()` 方法。
3. 如果锁已被其他线程持有，该线程将阻塞，直到持有锁的线程执行完 `<clinit>()` 方法并释放锁。
4. 如果一个线程在执行 `<clinit>()` 方法时，发现该类已经被自己初始化过（递归初始化），则直接返回，不会引起死锁。

**重要**：如果在一个类的 `<clinit>()` 方法中有耗时很长的操作，就可能造成多个进程阻塞，在实际应用中这种阻塞往往是很隐蔽的。

---

### 类加载器 (Class Loader)

前面我们讨论了类加载的过程，那么这个过程具体是由谁来完成的呢？答案是 **类加载器 (Class Loader)**。

类加载器是 Java 虚拟机实现的一个重要模块，它的主要作用就是实现类加载过程中的第一个步骤：“通过一个类的全限定名来获取描述此类的二进制字节流”。

#### 4.1 类加载器的种类与职责

对于任意一个类，都必须由 **加载它的类加载器** 和 **这个类本身** 一起共同确立其在 Java 虚拟机中的唯一性。比较两个类是否“相等”，只有在这两个类是由同一个类加载器加载的前提下才有意义，否则，即使这两个类来源于同一个 Class 文件，被同一个 Java 虚拟机加载，只要加载它们的类加载器不同，那这两个类就必定不相等。

从 Java 虚拟机的角度来看，只存在两种不同的类加载器：

1. **启动类加载器 (Bootstrap ClassLoader)**：这个类加载器使用 C++ 语言实现，是虚拟机自身的一部分。
2. **其他所有的类加载器**：这些类加载器都由 Java 语言实现，独立存在于虚拟机外部，并且全都继承自抽象类 `java.lang.ClassLoader`。

从我们 Java 开发人员的角度来看，类加载器就应当划分得更细致一些。自 JDK 1.2 以来，Java 一直保持着三层类加载器、双亲委派的类加载架构（JDK 9 后有所调整）。

##### 4.1.1 启动类加载器 (Bootstrap ClassLoader)

* **职责**：负责加载存放在 `<JAVA_HOME>\lib` 目录，或者被 `-Xbootclasspath` 参数所指定的路径中存放的，而且是 Java 虚拟机能够识别的（按照文件名识别，如 `rt.jar`、`tools.jar`，名字不符合的类库即使放在 lib 目录下也不会被加载）核心类库。例如 `java.lang.*`, `java.util.*` 等。
* **实现**：通常由 C++ 实现，是 JVM 的一部分。
* **获取方式**：开发者无法直接获取到启动类加载器的引用，它在 Java 代码中通常用 `null` 来表示。尝试调用 `String.class.getClassLoader()` 会返回 `null`。
* **特殊地位**：它是所有其他类加载器的“顶层”，但不一定是父加载器（后面双亲委派会讲）。

##### 4.1.2 扩展类加载器 (Extension ClassLoader / Platform ClassLoader)

* **职责**：负责加载 `<JAVA_HOME>\lib\ext` 目录中，或者被 `java.ext.dirs` 系统变量所指定的路径中所有的类库。
* **实现**：由 Java 语言实现，是 `sun.misc.Launcher$ExtClassLoader`（JDK 8 及之前）或 `jdk.internal.loader.ClassLoaders$PlatformClassLoader`（JDK 9 及之后）的实例。
* **获取方式**：开发者可以直接使用扩展类加载器来加载类。可以通过 `ClassLoader.getSystemClassLoader().getParent()` 来获取（但 JDK 9 后可能不完全准确，因为模型有变）。
* **JDK 9+ 变化**：随着模块化的引入，扩展机制被移除，扩展类加载器被 **平台类加载器 (Platform ClassLoader)** 取代，负责加载一些平台相关的模块。

##### 4.1.3 应用程序类加载器 (Application ClassLoader)

* **职责**：负责加载用户类路径（ClassPath）上所有的类库。我们自己编写的 Java 代码，以及项目依赖的第三方 JAR 包，通常都是由它加载的。
* **实现**：由 Java 语言实现，是 `sun.misc.Launcher$AppClassLoader`（JDK 8 及之前）或 `jdk.internal.loader.ClassLoaders$AppClassLoader`（JDK 9 及之后）的实例。
* **获取方式**：是 ClassLoader 类中 `getSystemClassLoader()` 方法的返回值，所以也称为“**系统类加载器 (System ClassLoader)**”。它是程序中默认的类加载器。
* **关系**：它的父加载器通常是扩展类加载器（JDK 8）或平台类加载器（JDK 9+）。

##### 4.1.4 用户自定义类加载器 (User-Defined ClassLoader)

* **职责**：在程序运行期间，由用户根据自身需求定义的类加载器。例如，实现类的隔离（Tomcat）、热部署、代码加密解密等。
* **实现**：继承自 `java.lang.ClassLoader` 类，重写 `findClass()` 或 `loadClass()` 方法。
* **关系**：其父加载器通常是应用程序类加载器。

这种层次关系，以及类加载器之间的协作模式，就是著名的 **双亲委派模型 (Parents Delegation Model)**。

#### 4.2 类与类加载器的关系：命名空间与唯一性

前面提到，在 JVM 中，一个类的唯一性是由 **类加载器 + 类的全限定名** 共同确定的。

**理解帮助**：

* 每个类加载器都拥有一个独立的 **类命名空间 (Namespace)**。
* 对于同一个类加载器实例，其命名空间内不允许出现同名的类（加载同一个 `.class` 文件两次会失败或返回同一个 `Class` 对象）。
* 对于不同的类加载器实例，它们可以加载同名的类（例如，从同一个 `.class` 文件加载）。但在 JVM 看来，这两个 `Class` 对象是完全不同的、不兼容的类型。

**示例**：尝试用不同的类加载器加载同一个类，然后进行类型转换或比较。

```
import java.io.*;
import java.lang.reflect.Method;

// 自定义一个简单的类加载器
class MyClassLoader extends ClassLoader {
    private String rootDir;

    public MyClassLoader(String rootDir) {
        this.rootDir = rootDir;
    }

    @Override
    protected Class<?> findClass(String name) throws ClassNotFoundException {
        String filePath = rootDir + File.separator + name.replace('.', File.separatorChar) + ".class";
        try (InputStream is = new FileInputStream(filePath);
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {

            byte[] buffer = new byte[1024];
            int len;
            while ((len = is.read(buffer)) != -1) {
                baos.write(buffer, 0, len);
            }
            byte[] classBytes = baos.toByteArray();
            // 调用 defineClass 将字节数组转为 Class 对象
            return defineClass(name, classBytes, 0, classBytes.length);
        } catch (IOException e) {
            throw new ClassNotFoundException("Failed to load class: " + name, e);
        }
    }
}

// 假设在 D:/temp/ 目录下有一个 MySample.class 文件
// 内容为:
// package com.example;
// public class MySample {
//     public void sayHello() { System.out.println("Hello from " + this.getClass().getClassLoader()); }
// }

public class ClassIdentityTest {
    public static void main(String[] args) throws Exception {
        MyClassLoader loader1 = new MyClassLoader("D:/temp");
        MyClassLoader loader2 = new MyClassLoader("D:/temp");

        // 使用 loader1 加载 MySample 类
        Class<?> clazz1 = loader1.loadClass("com.example.MySample");
        Object obj1 = clazz1.getDeclaredConstructor().newInstance();

        // 使用 loader2 加载 MySample 类
        Class<?> clazz2 = loader2.loadClass("com.example.MySample");
        Object obj2 = clazz2.getDeclaredConstructor().newInstance();

        System.out.println("clazz1: " + clazz1);
        System.out.println("clazz1 Loader: " + clazz1.getClassLoader());
        System.out.println("obj1 instanceof com.example.MySample (loaded by loader1)? " + (obj1 instanceof com.example.MySample)); // 这里会编译报错，因为 com.example.MySample 是由 AppClassLoader 加载的，无法直接比较

        System.out.println("\nclazz2: " + clazz2);
        System.out.println("clazz2 Loader: " + clazz2.getClassLoader());

        System.out.println("\nclazz1 == clazz2 ? " + (clazz1 == clazz2)); // 输出 false

        // 尝试调用方法
        Method method1 = clazz1.getMethod("sayHello");
        method1.invoke(obj1);

        Method method2 = clazz2.getMethod("sayHello");
        method2.invoke(obj2);

        // 尝试类型转换 (会失败)
        try {
             com.example.MySample castedObj = (com.example.MySample) obj1; // 这里会抛 ClassCastException，因为 obj1 的类加载器是 loader1，而 (com.example.MySample) 期望的类加载器是 AppClassLoader
        } catch(ClassCastException e) {
             System.out.println("\nCaught ClassCastException as expected when casting obj1.");
        }
         try {
             // 即使目标类型是用同一个加载器加载的，但如果变量类型是另一个加载器加载的类，也会失败
             Object temp = clazz1.cast(obj2); // 尝试将 loader2 加载的对象转换为 loader1 加载的类类型
         } catch(ClassCastException e) {
             System.out.println("Caught ClassCastException as expected when casting obj2 to clazz1 type.");
         }
    }
}


```

这个例子清晰地展示了：

1. 即使 `clazz1` 和 `clazz2` 来自同一个 `.class` 文件，但因为由不同的 `MyClassLoader` 实例加载，它们是不同的 `Class` 对象 (`clazz1 == clazz2` 为 false)。
2. 它们各自的类加载器是 `loader1` 和 `loader2` 实例。
3. 尝试将由 `loader1` 加载的对象 `obj1` 强制转换为由应用程序类加载器（默认加载 `ClassIdentityTest` 的加载器）加载的 `com.example.MySample` 类型时，会抛出 `ClassCastException`。同样，在 `loader1` 和 `loader2` 加载的类型之间进行转换也会失败。

这种命名空间的隔离性是实现热部署、多版本类库共存、容器类隔离（如 Tomcat 为每个 Web 应用创建独立的类加载器）等功能的基础。

---

### 双亲委派模型 (Parents Delegation Model)

双亲委派模型是 Java 类加载器在 JDK 1.2 之后引入的一种推荐的类加载机制，它并非一个强制性的约束模型，而是 Java 设计者推荐给开发者的一种类加载器实现方式。

#### 5.1 模型详解

**工作过程**：

1. 当一个类加载器收到类加载请求时，它首先不会自己去尝试加载这个类。
2. 它会把这个请求 **委派** 给 **父类加载器** 去完成。
3. 每一层次的类加载器都是如此，因此所有的加载请求最终都应该传送到最顶层的 **启动类加载器 (Bootstrap ClassLoader)** 中。
4. 只有当 **父加载器反馈自己无法完成这个加载请求**（它的搜索范围中没有找到所需的类）时，**子加载器** 才会尝试自己去完成加载。

**理解帮助**：

这就像一个公司的层级汇报制度。一个员工（子加载器）接到一个任务（类加载请求），他不会马上自己做，而是先问他的直接上级（父加载器）能不能做。上级也一样，先问自己的上级。任务一直传递到最高层老板（启动类加载器）。老板说我做不了（或做完了），任务才一级级往下退，直到某个层级的负责人说“我能做”（在自己的负责范围内找到了类），他就把任务完成了。如果一直退回到最初的员工，他发现上级都做不了，最后才轮到他自己尝试去做。

#### 5.2 核心源码解读：`ClassLoader.loadClass()`

双亲委派模型的核心逻辑实现在 `java.lang.ClassLoader` 的 `loadClass(String name, boolean resolve)` 方法中。以下是 JDK 8 中该方法的一个简化版本（去除了部分权限检查和非关键逻辑），并添加了中文注释：

```
protected Class<?> loadClass(String name, boolean resolve) throws ClassNotFoundException {
    // 同步块，确保类加载的线程安全
    synchronized (getClassLoadingLock(name)) {
        // 步骤 1: 检查请求的类是否已经被加载过
        // findLoadedClass(name) 会在当前类加载器的缓存中查找类
        Class<?> c = findLoadedClass(name);

        // 如果缓存中找到了，直接返回已加载的 Class 对象
        if (c == null) {
            long t0 = System.nanoTime();
            try {
                // 步骤 2: 尝试委派给父类加载器加载
                // getParent() 获取当前类加载器的父加载器
                if (parent != null) {
                    // 调用父加载器的 loadClass 方法，递归向上委派
                    c = parent.loadClass(name, false);
                } else {
                    // 如果父加载器为 null，说明父加载器是启动类加载器 (Bootstrap ClassLoader)
                    // 尝试使用启动类加载器加载
                    // findBootstrapClassOrNull 是一个本地方法或内部实现，用于调用 Bootstrap ClassLoader
                    c = findBootstrapClassOrNull(name);
                }
            } catch (ClassNotFoundException e) {
                // 异常捕捉：如果父加载器（包括启动类加载器）抛出 ClassNotFoundException
                // 说明父加载器无法完成加载请求。
                // 注意：这里只是捕捉异常，不做处理，会继续执行后续步骤。
            }

            // 步骤 3: 如果父加载器无法加载 (c 仍然为 null)
            if (c == null) {
                // 父类加载器加载失败，轮到当前类加载器自己尝试加载
                long t1 = System.nanoTime();
                // 调用 findClass(name) 方法，这个方法通常由子类重写，实现具体的类加载逻辑
                // 例如，从文件系统、网络等地方获取字节码并定义类
                c = findClass(name);

                // 记录类加载相关的数据，用于性能统计等 (非核心逻辑)
                // ... record stats ...
            }
        }

        // 步骤 4: 解析阶段 (根据 resolve 参数决定)
        // 如果 resolve 参数为 true，则在加载完成后立即进行链接阶段的解析操作
        if (resolve) {
            resolveClass(c);
        }

        // 返回加载并（可能）解析后的 Class 对象
        return c;
    }
}

// 子类通常需要重写 findClass 方法来实现自己的加载逻辑
protected Class<?> findClass(String name) throws ClassNotFoundException {
    // 默认实现是抛出 ClassNotFoundException
    // 子类需要在这里实现：
    // 1. 根据 name 找到对应的 .class 字节码 (例如从文件、网络读取)
    // 2. 调用 defineClass() 方法将字节码转换成 Class 对象
    throw new ClassNotFoundException(name);
}


```

**源码解读要点**：

1. **检查缓存**：先调用 `findLoadedClass(name)` 检查当前加载器是否已经加载过这个类。如果加载过，直接返回缓存中的 `Class` 对象，避免重复加载。
2. **委派父加载器**：如果缓存未命中，获取父加载器 (`parent`)。
   * 如果父加载器存在 (`parent != null`)，调用 `parent.loadClass(name, false)`，将请求委派给父加载器。注意这里的 `resolve` 参数传 `false`，表示父加载器加载时不需要立即解析。
   * 如果父加载器不存在 (`parent == null`)，意味着父加载器是启动类加载器，尝试调用 `findBootstrapClassOrNull(name)`（这是一个内部方法）让启动类加载器加载。
3. **捕获异常**：如果在委派过程中，父加载器或启动类加载器抛出了 `ClassNotFoundException`，说明它们无法加载该类。这个异常会被捕获，但不会立即抛出，程序流程会继续。
4. **自己加载**：如果经过步骤 2 后，`c` 仍然是 `null`（即所有父加载器都无法加载），则调用当前类加载器的 `findClass(name)` 方法。这个方法是留给子类去实现的，负责查找类的字节码并调用 `defineClass` 将其转换为 `Class` 对象。如果 `findClass` 也找不到类，它应该抛出 `ClassNotFoundException`。
5. **解析**：如果 `resolve` 参数为 `true`，则在类加载成功后调用 `resolveClass(c)` 进行链接的解析阶段。
6. **同步**：整个 `loadClass` 方法被 `synchronized` 包裹，使用 `getClassLoadingLock(name)` 获取与类名相关的锁，保证多线程环境下同一个类只会被加载一次。

这个实现清晰地体现了“向上委派，失败后向下尝试”的双亲委派流程。

#### 5.3 双亲委派模型的优势

1. **保证 Java 核心库的类型安全**：

   * 例如，无论哪个类加载器加载 `java.lang.Object`，最终都会委派给启动类加载器加载。这确保了 Java 程序中使用的 `Object` 类始终是同一个类，防止了核心 API 库被随意篡改。试想一下，如果用户可以自己写一个 `java.lang.Object` 类并成功加载，那整个 Java 体系都会崩溃。
   * 这种机制保护了 Java 核心类库不被应用程序或第三方代码覆盖或替换。
2. **避免类的重复加载**：

   * 当父加载器已经加载了该类时，子加载器就不会再加载一次。这保证了内存中一份字节码只会被加载一次，节省了内存开销。
3. **保证类的唯一性**：

   * 结合类加载器的命名空间，双亲委派模型确保了同一个类在同一个类加载器及其子加载器中具有唯一性，使得 `instanceof`、类型转换等操作能够正确进行。
4. **清晰的类加载器层次结构**：

   * 提供了一个清晰、可预测的类加载委托链，便于管理和排查问题。

---

### 打破双亲委派模型

虽然双亲委派模型是 Java 推荐的类加载方式，并且能解决很多问题，但它并非万能钥匙。在某些特定场景下，双亲委派模型反而会成为障碍，需要被“打破”。

#### 6.1 为何要打破？实际场景分析

双亲委派模型有一个基本的设计缺陷：**父加载器无法访问子加载器加载的类**。

这个模型的核心思想是向上委派，请求总是从下往上传递。但是，如果 **基础类（由父加载器加载）需要回调用户代码（由子加载器加载）**，该怎么办呢？

典型的例子就是 **SPI (Service Provider Interface)** 机制：

* Java 核心库（如 `rt.jar`，由启动类加载器加载）中定义了标准的接口（例如 `java.sql.Driver`）。
* 这些接口的具体实现则由第三方厂商提供（例如 MySQL、Oracle 的 JDBC 驱动包），通常放在应用程序的 ClassPath 下（由应用程序类加载器加载）。
* 核心库的代码（如 `java.sql.DriverManager`）需要去加载并使用这些第三方厂商提供的实现类。

按照双亲委派模型，`DriverManager`（由启动类加载器加载）无法“看到”并加载 `com.mysql.jdbc.Driver`（由应用程序类加载器加载），因为它不能向下委派。

为了解决这类问题，Java 设计者引入了一些机制来“打破”或绕过双亲委派模型。

其他需要打破双亲委派模型的场景：

* **Web 容器（如 Tomcat）**：
  + 每个 Web 应用（WAR 包）都有自己独立的类库，需要进行隔离。Tomcat 为每个应用创建了一个独立的 `WebAppClassLoader`。
  + 这些应用可能依赖不同版本的同一个库，需要隔离。
  + Web 应用需要能加载自己的类，而不是优先委派给父加载器（例如 Servlet API，每个应用可能需要使用容器提供的版本，而不是 JRE 自带的旧版本，或者应用自己打包了新版本）。Tomcat 的 `WebAppClassLoader` 就重写了 `loadClass` 方法，优先加载 Web 应用目录下的类，加载不到再向上委派。
  + 同时，不同应用之间可能需要共享某些库（如放在 Tomcat `lib` 目录下的），这又需要一定的委派机制。
* **热部署、热替换**：
  + 在不停止应用的情况下更新类的代码。通常需要创建新的类加载器来加载新版本的类，并替换掉旧版本。这需要精细地控制类加载过程，可能需要打破默认的委派链。例如 OSGi 框架就拥有复杂的网状类加载器结构。
* **代码加密保护**：
  + 为了保护代码不被反编译，可以将 `.class` 文件加密，然后通过自定义类加载器在加载时进行解密。这种自定义加载器需要在 `findClass` 中实现解密逻辑，并调用 `defineClass`。

#### 6.2 如何打破？

主要有两种方式可以打破双亲委派模型：

##### 6.2.1 重写 `loadClass()` 方法

最直接但也最“暴力”的方式就是继承 `java.lang.ClassLoader`，然后 **重写 `loadClass(String name, boolean resolve)` 方法**。

通过重写 `loadClass`，我们可以完全控制类的加载流程，不再遵循默认的向上委派逻辑。例如，可以实现先尝试自己加载，失败后再委派给父加载器，或者完全不委派。

**示例（Tomcat 的 `WebAppClassLoader` 简化逻辑）**：

```
// 伪代码，仅示意 Tomcat 的部分逻辑
public class WebAppClassLoader extends ClassLoader {
    // ... 省略其他代码 ...

    @Override
    public Class<?> loadClass(String name, boolean resolve) throws ClassNotFoundException {
        synchronized (getClassLoadingLock(name)) {
            Class<?> clazz = null;

            // 1. 先检查本地缓存
            clazz = findLoadedClass(name);
            if (clazz != null) {
                if (resolve) resolveClass(clazz);
                return clazz;
            }

            // 2. 检查 JVM 系统类（不能被 WebApp 覆盖的）
            //    例如 java.*, javax.* 等包中的类，必须委派给父加载器
            if (isSystemClass(name)) {
                try {
                    clazz = getParent().loadClass(name, resolve);
                    if (clazz != null) return clazz;
                } catch (ClassNotFoundException e) { /*忽略*/ }
            }

            // 3. 尝试在 Web 应用自身的目录下加载 (优先加载自己的类)
            try {
                clazz = findClass(name); // 调用自己的 findClass
                if (clazz != null) {
                    if (resolve) resolveClass(clazz);
                    return clazz;
                }
            } catch (ClassNotFoundException e) { /*忽略*/ }

            // 4. 如果自己加载不到，再尝试委派给父加载器加载 (兜底)
            //    这与标准双亲委派顺序相反
            try {
                clazz = getParent().loadClass(name, resolve);
                 if (clazz != null) return clazz;
            } catch (ClassNotFoundException e) { /*忽略*/ }

            // 5. 如果都找不到，抛出异常
            throw new ClassNotFoundException(name);
        }
    }

    @Override
    protected Class<?> findClass(String name) throws ClassNotFoundException {
        // 在 Web 应用的 /WEB-INF/classes 和 /WEB-INF/lib/*.jar 中查找类的字节码
        // ... 实现查找逻辑 ...
        byte[] classBytes = findClassBytes(name);
        if (classBytes == null) {
            throw new ClassNotFoundException(name);
        }
        return defineClass(name, classBytes, 0, classBytes.length);
    }

    // ... 其他辅助方法，如 isSystemClass(), findClassBytes() ...
}


```

**注意**：重写 `loadClass` 方法需要非常小心，因为它改变了类加载的核心行为。除非明确需要改变委派顺序（如 Tomcat），否则 **强烈建议只重写 `findClass` 方法**，以保持双亲委派模型的基本结构。

##### 6.2.2 线程上下文类加载器 (Thread Context ClassLoader)

这是一种更优雅、更常用的打破双亲委派模型的方式。

Java 在 `java.lang.Thread` 类中提供了一个 `contextClassLoader` 字段，可以通过 `Thread.currentThread().getContextClassLoader()` 获取，并通过 `Thread.currentThread().setContextClassLoader(ClassLoader cl)` 来设置。

**工作原理**：

1. 父类加载器加载的类（例如 Java 核心库中的类）在需要加载或使用子类加载器才能看到的类（例如 SPI 的实现类）时。
2. 父类加载器加载的类会 **获取当前线程的上下文类加载器**。
3. 然后使用这个 **上下文类加载器** 去加载所需的类。

**理解帮助**：

线程上下文类加载器就像一个“信使”。高层代码（父加载器加载的类）想让低层代码（子加载器加载的类）帮忙做事（加载类），但不能直接指挥。于是，高层代码通过当前线程这个“信使”，告诉它：“你去用那个能看到目标类的加载器（通常是应用程序类加载器）来加载它”。

默认情况下，线程的上下文类加载器是从父线程继承来的。对于程序启动时的初始线程，其上下文类加载器通常是 **应用程序类加载器 (Application ClassLoader)**。

**SPI 机制就是利用线程上下文类加载器来打破双亲委派的典型例子。**

#### 6.3 案例：SPI 机制

我们再来看 SPI (Service Provider Interface) 如何利用线程上下文类加载器工作：

以 JDBC 为例：

1. **`java.sql.DriverManager`** (核心库类，由启动类加载器加载)
2. **`com.mysql.cj.jdbc.Driver`** (MySQL 驱动实现类，通常在 ClassPath 下，由应用程序类加载器加载)

`DriverManager` 类中有一个静态代码块，它在类初始化时会尝试加载所有注册的 JDBC 驱动。其核心方法是 `ServiceLoader.load(Driver.class)`。

`ServiceLoader.load()` 方法内部的简化逻辑：

```
public static <S> ServiceLoader<S> load(Class<S> service) {
    // 关键点：获取当前线程的上下文类加载器
    ClassLoader cl = Thread.currentThread().getContextClassLoader();
    // 使用上下文类加载器去加载服务提供者
    return ServiceLoader.load(service, cl);
}

public static <S> ServiceLoader<S> load(Class<S> service, ClassLoader loader) {
    // ...
    // 在 loader 的类路径下查找 META-INF/services/java.sql.Driver 文件
    // 读取文件内容（例如 com.mysql.cj.jdbc.Driver）
    // 使用 loader (即上下文类加载器) 去加载 com.mysql.cj.jdbc.Driver 类
    // ...
}


```

流程梳理：

1. `DriverManager` 初始化时调用 `ServiceLoader.load(Driver.class)`。
2. `ServiceLoader.load()` 获取当前线程的上下文类加载器（通常是 AppClassLoader）。
3. `ServiceLoader` 使用 AppClassLoader 去查找 `META-INF/services/java.sql.Driver` 配置文件，并读取实现类的全限定名（如 `com.mysql.cj.jdbc.Driver`）。
4. `ServiceLoader` 最终调用 `Class.forName("com.mysql.cj.jdbc.Driver", false, cl)`，这里的 `cl` 就是 AppClassLoader。
5. AppClassLoader 成功加载位于 ClassPath 下的 MySQL 驱动类。

这样，启动类加载器加载的 `DriverManager` 就成功地加载并使用了应用程序类加载器加载的 `Driver` 实现类，巧妙地绕过了双亲委派模型的限制。

JNDI、JAXP (XML 解析)、JCE (加解密) 等许多 Java 基础服务都广泛使用了 SPI 和线程上下文类加载器。

---

### 自定义类加载器

除了 JVM 自带的和 Java 核心库提供的类加载器，我们还可以根据需要创建自己的类加载器。

#### 7.1 为何需要自定义？

自定义类加载器的主要应用场景包括：

1. **实现类的隔离**：

   * 最典型的就是 Web 容器（如 Tomcat）。每个 Web 应用部署时，Tomcat 都会为其创建一个独立的类加载器实例 (`WebAppClassLoader`)。这样，即使两个应用依赖了同一个库的不同版本，也不会相互干扰。应用 A 使用 `log4j-1.2.jar`，应用 B 使用 `log4j-2.0.jar`，它们可以共存在同一个 Tomcat 实例中，因为它们由不同的类加载器加载，处于不同的命名空间。
   * 一些插件化框架、模块化系统（如 OSGi）也利用自定义类加载器来实现模块间的隔离和依赖管理。
2. **热部署与热替换**：

   * 当需要更新应用中的某个类而不想重启整个应用时，可以通过创建一个新的自定义类加载器来加载新版本的类，并替换掉旧类加载器加载的旧版本类。这需要配合类的卸载（当加载该类的类加载器被回收时，类才会被卸载）。
   * 一些开发工具和框架利用此特性实现快速的代码更新和调试。
3. **加载非标准来源的类**：

   * 从网络下载类的字节码进行加载。
   * 从数据库或其他存储中读取类的字节码。
   * 动态生成类的字节码（如 AOP 框架 CGLIB、动态代理）并加载。
4. **代码加密与保护**：

   * 可以将编译后的 `.class` 文件进行加密处理，防止反编译。
   * 在运行时，通过自定义类加载器先读取加密的字节流，然后在 `findClass` 方法中进行解密，最后调用 `defineClass` 将解密后的字节码转换成 `Class` 对象。

#### 7.2 如何实现？

实现一个自定义类加载器通常遵循以下步骤：

1. **继承 `java.lang.ClassLoader` 类**。
2. **（可选）设置父加载器**：
   * 可以通过调用 `super(ClassLoader parent)` 构造函数来指定父加载器。
   * 如果不指定，默认父加载器是应用程序类加载器 (`ClassLoader.getSystemClassLoader()`)。
3. **重写 `findClass(String name)` 方法**：
   * 这是实现自定义加载逻辑的核心。
   * 在该方法中，根据传入的类名 `name`，找到或生成对应的字节码 `byte[] classBytes`。
   * 调用 `defineClass(String name, byte[] b, int off, int len)` 方法将字节码数组转换为 `Class` 对象。
   * 如果找不到类，应该抛出 `ClassNotFoundException`。
4. **（可选）重写 `loadClass(String name, boolean resolve)` 方法**：
   * 只有当你需要改变默认的双亲委派加载顺序时，才需要重写此方法。如无特殊必要，**不推荐**重写 `loadClass`，只需重写 `findClass` 即可保持双亲委派。

**示例：一个从指定目录加载类的简单自定义加载器**

```
import java.io.*;

public class FileSystemClassLoader extends ClassLoader {

    private String rootDir;

    // 构造函数，传入类文件所在的根目录
    public FileSystemClassLoader(String rootDir) {
        // 如果不指定父加载器，默认使用 AppClassLoader
        this.rootDir = rootDir;
    }

    // 构造函数，允许指定父加载器
    public FileSystemClassLoader(String rootDir, ClassLoader parent) {
        super(parent); // 调用父类构造函数设置父加载器
        this.rootDir = rootDir;
    }

    /**
     * 重写 findClass 方法，实现从文件系统加载类的逻辑
     * @param name 类的全限定名 (例如 com.example.MyClass)
     * @return 加载后的 Class 对象
     * @throws ClassNotFoundException 如果找不到类文件
     */
    @Override
    protected Class<?> findClass(String name) throws ClassNotFoundException {
        // 1. 将全限定名转换为文件路径 (com.example.MyClass -> com/example/MyClass.class)
        String filePath = rootDir + File.separator + name.replace('.', File.separatorChar) + ".class";
        File classFile = new File(filePath);

        if (!classFile.exists()) {
            // 如果文件不存在，抛出异常，loadClass 方法会继续尝试父加载器（如果之前没找到）
            throw new ClassNotFoundException("Class file not found: " + filePath);
        }

        // 2. 读取类文件的字节码
        try (InputStream is = new FileInputStream(classFile);
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {

            byte[] buffer = new byte[4096]; // 缓冲区大小
            int bytesRead;
            while ((bytesRead = is.read(buffer)) != -1) {
                baos.write(buffer, 0, bytesRead);
            }
            byte[] classBytes = baos.toByteArray(); // 获取完整的字节码数组

            // 3. 调用 defineClass 将字节码转换为 Class 对象
            // defineClass 是 ClassLoader 提供的受保护方法，用于将字节数组定义成 Class 实例
            // 第一个参数是类名，第二个是字节数组，第三个是起始偏移，第四个是长度
            Class<?> clazz = defineClass(name, classBytes, 0, classBytes.length);

            if (clazz == null) {
                // defineClass 可能会因为格式错误等原因失败并返回 null
                throw new ClassNotFoundException("Failed to define class from bytes: " + name);
            }
            System.out.println("Custom loader [" + this + "] found and defined class: " + name);
            return clazz; // 返回加载成功的 Class 对象

        } catch (IOException e) {
            // 处理 IO 异常
            throw new ClassNotFoundException("Failed to load class bytes: " + name, e);
        } catch (ClassFormatError e) {
            // 处理类格式错误
             throw new ClassNotFoundException("Class format error for: " + name, e);
        }
    }

    // main 方法用于测试
    public static void main(String[] args) throws Exception {
        // 假设 D:/myclasses/ 目录下有 com/example/Hello.class
        // Hello.class 内容:
        // package com.example;
        // public class Hello {
        //     public void greet() { System.out.println("Hello from " + this.getClass().getClassLoader()); }
        // }

        FileSystemClassLoader loader = new FileSystemClassLoader("D:/myclasses");
        System.out.println("Custom loader parent: " + loader.getParent()); // 输出 AppClassLoader

        // 使用自定义加载器加载类
        Class<?> helloClass = loader.loadClass("com.example.Hello");

        // 创建实例并调用方法
        Object helloInstance = helloClass.getDeclaredConstructor().newInstance();
        helloClass.getMethod("greet").invoke(helloInstance); // 输出 Hello from FileSystemClassLoader@...

        System.out.println("\nTrying to load java.lang.String with custom loader:");
        // 尝试加载核心类库的类，会委派给父加载器
        Class<?> stringClass = loader.loadClass("java.lang.String");
        System.out.println("String class loader: " + stringClass.getClassLoader()); // 输出 null (Bootstrap ClassLoader)
    }
}


```

#### 7.3 核心源码解读：`ClassLoader.findClass()`

`findClass(String name)` 方法在 `java.lang.ClassLoader` 中的默认实现非常简单：

```
protected Class<?> findClass(String name) throws ClassNotFoundException {
    // 直接抛出异常，强制子类必须重写此方法来实现自己的查找逻辑
    throw new ClassNotFoundException(name);
}


```

这个方法的设计意图就是让子类去填充具体的类查找和定义逻辑。当我们自定义类加载器时，主要的工作就是在这个方法里完成：

1. **定位字节码**：根据类名 `name`，从特定的来源（文件系统、网络、数据库、内存等）查找对应的类的二进制字节流。
2. **读取字节码**：将找到的字节流读入一个 `byte[]` 数组。
3. **调用 `defineClass`**：使用 `defineClass(String name, byte[] b, int off, int len)` 将字节码数组转换为 `java.lang.Class` 对象。`defineClass` 是一个 `native` 方法（或最终调用 `native` 方法），它负责在 JVM 内部完成字节码的验证、解析（部分）以及在方法区创建对应的运行时数据结构和 `Class` 对象。

#### 7.4 实现要点与注意事项

在实现自定义类加载器时，需要注意以下几点：

1. **遵循双亲委派（除非必要）**：尽量只重写 `findClass` 而不是 `loadClass`，以保持 Java 类加载体系的稳定性和一致性。
2. **命名空间隔离**：要清楚每个类加载器实例都有独立的命名空间。这既是优点（隔离性），也可能导致问题（不同加载器加载的同名类无法互相转换，`ClassCastException`）。
3. **类的卸载与内存泄漏**：类只有在其对应的类加载器可以被垃圾回收时，才会被卸载。如果自定义类加载器及其加载的 `Class` 对象被长期引用（例如，存储在静态集合中），即使代码不再使用，类也无法卸载，可能导致方法区（元空间）内存泄漏。特别是在热部署场景下，需要小心管理类加载器的生命周期。
4. **线程安全**：`loadClass` 方法内部默认是线程安全的（通过 `synchronized (getClassLoadingLock(name))` 实现）。但如果你重写了 `loadClass`，或者在 `findClass` 中有复杂的状态操作，需要自行确保线程安全。`defineClass` 方法本身也是线程安全的。
5. **性能考虑**：类加载，尤其是字节码的查找和读取，可能是耗时操作。考虑实现缓存机制（`findLoadedClass` 就是一种缓存），避免重复查找和定义同一个类。
6. **资源加载**：除了加载类，类加载器还负责加载资源（如配置文件、图片等），通过 `getResource(String name)` 和 `getResources(String name)` 方法。自定义类加载器时，通常也需要重写 `findResource(String name)` 和 `findResources(String name)` 方法，以确保能从自定义的来源加载资源文件，并且委派逻辑与类加载保持一致。
7. **安全性**：`defineClass` 方法会进行一些基本的安全检查，但如果加载的字节码来源不可信，自定义加载器本身可能成为安全漏洞的入口。在需要高安全性的场景下，可能需要配合 Java 的安全管理器 (`SecurityManager`) 和权限 (`Permission`) 机制，重写 `getPermissions(CodeSource codesource)` 方法来为加载的代码授予合适的权限。

---

### 运行时常量池、方法区与类加载

类加载过程与 JVM 的内存区域，特别是 **方法区 (Method Area)** 和 **运行时常量池 (Runtime Constant Pool)** 密切相关。

**关系梳理**：

1. **方法区 (Method Area)**：

   * 是 JVM 规范中定义的一块逻辑内存区域，用于存储已被虚拟机加载的 **类型信息、常量、静态变量、即时编译器编译后的代码缓存** 等数据。
   * 它在 JVM 启动时被创建，是 **线程共享** 的。
   * **类型信息**：包括类的完整有效名称、父类完整有效名称、类的修饰符（`public`, `abstract`, `final`等）、直接接口的有序列表、字段信息（名称、类型、修饰符）、方法信息（名称、返回类型、参数数量和类型、修饰符、方法字节码）等。
   * **实现演变**：在 HotSpot 虚拟机中，方法区的实现在不同 JDK 版本中有所变化：
     + JDK 7 及之前：称为 **永久代 (Permanent Generation, PermGen)**，使用 JVM 堆的一部分来实现。容易因加载过多类而导致 `OutOfMemoryError: PermGen space`。
     + JDK 8 及之后：称为 **元空间 (Metaspace)**，使用 **本地内存 (Native Memory)** 来实现。默认情况下，元空间的大小仅受本地内存限制，减少了 OOM 的风险，但仍需关注类的卸载。
   * **类加载与方法区**：在 **加载 (Loading)** 阶段，JVM 将 `.class` 文件中的静态结构信息解析后，存放到方法区中，形成运行时的内部表示。
2. **运行时常量池 (Runtime Constant Pool)**：

   * 是 **方法区的一部分**。
   * 是每一个类或接口的 `.class` 文件中 `constant_pool` 表的 **运行时表示**。
   * `.class` 文件常量池 (Class File Constant Pool) 存放编译器生成的各种 **字面量 (Literals)** 和 **符号引用 (Symbolic References)**。
     + **字面量**：如文本字符串、声明为 `final` 的常量值等。
     + **符号引用**：如类和接口的全限定名、字段的名称和描述符、方法的名称和描述符。
   * **类加载与运行时常量池**：
     + 在 **加载 (Loading)** 阶段，类的 `.class` 文件常量池的内容会被存放到方法区的运行时常量池中。
     + 在 **连接 (Linking)** 的 **解析 (Resolution)** 阶段，JVM 会将运行时常量池中的一部分 **符号引用** 替换为 **直接引用**（指向内存中实际地址的指针或偏移量）。
   * **动态性**：运行时常量池相对于 Class 文件常量池的一个重要特征是具备 **动态性**。Java 语言并不要求常量一定只有编译期才能产生，运行期间也可以将新的常量放入池中。这种特性被利用得比较多的便是 `String` 类的 `intern()` 方法。当调用 `intern()` 方法时，如果字符串常量池中已经包含一个等于此 `String` 对象的字符串，则返回池中的那个字符串的引用；否则，会将此 `String` 对象添加到池中，并返回此 `String` 对象的引用。

**总结**：类加载过程是将静态的 `.class` 文件信息转化为 JVM 运行时内存结构的过程。加载阶段将类的元数据和常量池信息读入方法区，形成运行时常量池；连接的解析阶段则将常量池中的符号引用解析为直接引用，使得代码可以真正执行。理解它们的关系有助于我们认识到类数据在 JVM 内部是如何存储和管理的。

---

### 常见问题与排查

在 Java 开发中，与类加载相关的问题非常常见，理解类加载机制是解决这些问题的关键。

#### 9.1 `ClassNotFoundException` vs `NoClassDefFoundError`

这两个都是常见的类加载相关错误，但原因和发生阶段不同：

* **`ClassNotFoundException`** (异常 - Exception)：

  + **发生时机**：通常发生在 **类加载阶段**。
  + **原因**：当应用程序试图通过 **反射**（如 `Class.forName()`）、**类加载器**（如 `ClassLoader.loadClass()`、`ClassLoader.findSystemClass()`）等方式 **动态加载** 一个类时，在当前的 ClassPath 或指定的加载路径中 **找不到** 对应的 `.class` 文件。
  + **场景**：
    - 类名写错。
    - 依赖的 JAR 包未添加到 ClassPath 或部署路径中。
    - 类加载器无法在指定的搜索路径下找到类文件。
  + **特点**：是一个受查异常 (Checked Exception)，需要显式捕获或声明抛出。
* **`NoClassDefFoundError`** (错误 - Error)：

  + **发生时机**：通常发生在 **第一次主动使用** 该类的时候（例如创建实例、调用静态方法、访问静态字段等），即发生在 **初始化阶段之前或期间**，但也可能发生在 **链接阶段**。
  + **原因**：JVM 在编译时能够找到这个类，但是在 **运行时**，当需要加载这个类时，虽然找到了对应的 `.class` 文件，但在 **链接** 或 **初始化** 过程中失败了。
  + **场景**：
    - **类文件在编译时存在，但在运行时丢失**：例如，某个 JAR 包在编译时包含该类，但运行时该 JAR 包被移除或替换为不包含该类的版本。
    - **类的初始化失败**：类的静态初始化块 (`static {}`) 或静态变量赋值时抛出了未捕获的异常。一旦初始化失败，后续任何尝试使用该类的操作都会直接抛出 `NoClassDefFoundError`。
    - **类的链接失败**：例如，验证阶段失败（字节码损坏或不合规）、准备阶段失败（内存不足无法为静态变量分配空间）、解析阶段失败（找不到依赖的符号引用，如依赖的类或方法不存在）。
    - **依赖冲突**：ClassPath 中存在同一个类的多个不兼容版本，导致链接时出现问题（例如，方法签名不匹配）。
  + **特点**：是一个错误 (Error)，通常表示发生了严重的、难以恢复的问题，应用程序一般不应该尝试捕获它。

**简单区分**：`ClassNotFoundException` 是“找不到 .class 文件”，发生在加载阶段；`NoClassDefFoundError` 是“找到了 .class 文件，但加载（链接或初始化）失败了”，通常发生在第一次使用时。

#### 9.2 `LinkageError`

`LinkageError` 是一个更通用的错误，发生在链接阶段（验证、准备、解析），表示类与类之间的依赖关系出现了问题。`NoClassDefFoundError` 是 `LinkageError` 的一个常见子类。

其他 `LinkageError` 的子类包括：

* **`ClassCircularityError`**：类加载过程中检测到循环依赖（例如，类 A 继承 B，类 B 又继承 A）。
* **`IncompatibleClassChangeError`**：检测到不兼容的类更改。例如：
  + 一个类删除了某个字段或方法，但其他类仍然尝试访问它。
  + 一个方法的签名（参数类型、返回类型）改变了，但调用方仍然使用旧的签名。
  + 一个普通方法变成静态方法（反之亦然），或者访问权限降低（如 `public` 变 `private`）。
  + 通常发生在编译后，修改了某个类的接口或实现，但没有重新编译依赖它的其他类。
* **`VerifyError`**：验证阶段失败，字节码不符合 JVM 规范或存在安全风险。
* **`NoSuchFieldError` / `NoSuchMethodError`**：解析阶段，找不到引用的字段或方法。通常也是因为编译后类定义发生变化导致。

**解决 `LinkageError` 的思路**：

* **检查依赖版本**：最常见的原因是 ClassPath 中存在同一个库的多个不兼容版本。使用 Maven (`mvn dependency:tree`) 或 Gradle (`gradle dependencies`) 等工具分析依赖树，排除冲突的版本。
* **确保编译一致性**：确保所有相关的模块都使用了兼容的依赖版本，并且都已重新编译。执行项目的 clean 和 rebuild 操作。
* **检查类加载器隔离**：在复杂环境（如 OSGi、Web 容器）中，检查是否因为类加载器隔离导致了类型不兼容（例如，接口由父加载器加载，实现由子加载器加载，但版本不匹配）。

#### 9.3 内存溢出 (PermGen/Metaspace)

虽然 JDK 8 后使用元空间替换了永久代，减少了固定大小限制带来的 OOM，但如果类及其加载器无法被回收，仍然可能耗尽本地内存。

* **原因**：
  + **动态生成大量类**：像 CGLIB 这样的字节码生成库，如果使用不当（例如，每次都生成新的代理类而不是复用），会产生大量类定义。
  + **热部署频繁**：每次热部署通常会创建新的类加载器来加载新版本的类。如果旧的类加载器及其加载的类因为被其他地方（如线程、静态集合）引用而无法被 GC 回收，就会导致内存泄漏，元空间（或永久代）不断增长。
  + **加载了巨量的类**：大型应用程序本身可能就需要加载非常多的类。
* **排查与解决**：
  + **使用内存分析工具** (如 JVisualVM, MAT - Memory Analyzer Tool)：分析 Heap Dump 或监控 JVM 内存使用，查找是哪些类加载器和类占用了大量内存，以及它们为什么没有被回收（查找 GC Roots）。
  + **检查动态类生成**：审视代码中是否有滥用字节码生成库的情况。
  + **优化热部署策略**：确保热部署后，旧的类加载器和相关对象能够被正确地清理和回收。避免静态引用、线程引用等持有旧类加载器或其加载的对象。
  + **调整元空间大小** (JDK 8+)：虽然默认无限制，但可以通过 `-XX:MetaspaceSize`（初始大小）和 `-XX:MaxMetaspaceSize`（最大大小）进行调整。设置一个合理的最大值有助于防止耗尽系统内存。对于永久代 (JDK 7-)，通过 `-XX:PermSize` 和 `-XX:MaxPermSize` 调整。
  + **检查应用设计**：是否加载了不必要的类？是否可以延迟加载？

#### 9.4 依赖冲突

这是大型项目中非常常见的问题，本质上是类加载路径 (ClassPath) 中出现了同一个类的不同版本，或者相关联的库版本不兼容。

* **表现**：通常以 `NoSuchMethodError`、`NoSuchFieldError`、`AbstractMethodError`、`IllegalAccessError` 等 `LinkageError` 或其子类的形式出现。有时也可能表现为奇怪的行为或难以预料的异常。
* **原因**：
  + 直接依赖了同一个库的不同版本。
  + 间接依赖：项目依赖 A 和 B，A 依赖 C v1.0，B 依赖 C v2.0。最终 ClassPath 中可能只有一个 C 的版本（具体哪个取决于构建工具的依赖调解策略），导致依赖另一个版本的库出现问题。
* **排查与解决**：
  + **依赖分析**：使用 Maven (`mvn dependency:tree -Dverbose`) 或 Gradle (`gradle dependencies`) 详细查看项目的依赖树，找出冲突的库和版本。
  + **依赖排除 (Exclusion)**：在构建工具（`pom.xml` 或 `build.gradle`）中，明确排除掉不需要的、引起冲突的传递性依赖。
  + **依赖管理 (Dependency Management)**：在 Maven 的 `<dependencyManagement>` 或 Gradle 的 `constraints` 中统一管理项目及其子模块使用的核心依赖版本，强制使用特定版本。
  + **使用 Shade/Fat JAR (谨慎)**：将依赖打包进一个 JAR，并可能重命名包名来避免冲突。但这可能引入新的复杂性。
  + **类加载器隔离**：在容器环境或插件化系统中，利用类加载器隔离不同模块/应用的依赖。

#### 9.5 调试技巧：`-verbose:class`

这是一个非常有用的 JVM 参数，可以在排查类加载问题时提供大量信息。

当使用 `java -verbose:class ...` 启动应用时，JVM 会在控制台输出详细的类加载信息，包括：

* 哪个类被加载了。
* 该类是从哪个文件（JAR 包或目录）加载的。
* 哪个类加载器执行了加载动作。

**示例输出**：

```
[0.104s][info][class,load] java.lang.Object source: jrt:/java.base
[0.104s][info][class,load] java.io.Serializable source: jrt:/java.base
[0.104s][info][class,load] java.lang.Comparable source: jrt:/java.base
...
[0.201s][info][class,load] sun.launcher.LauncherHelper source: jrt:/java.base
[0.201s][info][class,load] java.lang.ClassLoaderHelper source: jrt:/java.base
[0.205s][info][class,load] com.example.MyApplication source: file:/D:/myapp/target/classes/
...
[0.210s][info][class,load] org.apache.commons.logging.LogFactory source: file:/C:/Users/user/.m2/repository/commons-logging/commons-logging/1.2/commons-logging-1.2.jar
[0.211s][info][class,load] org.apache.commons.logging.Log source: file:/C:/Users/user/.m2/repository/commons-logging/commons-logging/1.2/commons-logging-1.2.jar


```

通过分析 `-verbose:class` 的输出，你可以：

* 确认某个类是否被加载了。
* 确认类是从预期的 JAR 包或路径加载的，有助于发现 ClassPath 配置错误或依赖冲突（例如，看到同一个类被从不同的 JAR 加载）。
* 大致了解类的加载顺序。

---

### 总结

Java 类加载机制是 JVM 的核心组成部分，它负责将静态的 `.class` 文件转化为运行时可以使用的 `Class` 对象。  
 总结内容如下:

1. **类加载的生命周期**：加载、验证、准备、解析、初始化、使用、卸载。
2. **类加载的核心过程**：
   * **加载**：查找字节码，转换数据结构，创建 `Class` 对象。
   * **连接**（验证、准备、解析）：确保安全，分配内存设零值，符号引用转直接引用。
   * **初始化**：执行 `<clinit>()` 方法（静态变量赋值和静态块），具有严格的触发时机和线程安全保障。
3. **类加载器**：启动类加载器、扩展/平台类加载器、应用程序类加载器、自定义类加载器，以及它们构成的层次结构。
4. **类的唯一性**：由类加载器和全限定名共同决定，形成了命名空间隔离。
5. **双亲委派模型**：工作原理、`loadClass` 源码实现、优势（安全、避免重复加载）。
6. **打破双亲委派**：原因（SPI、容器隔离、热部署）、方式（重写 `loadClass`、线程上下文类加载器）。
7. **自定义类加载器**：用途（隔离、热部署、加密）、实现方式（继承 `ClassLoader`，重写 `findClass`）。
8. **与内存区域的关系**：类加载如何填充方法区和运行时常量池。
9. **常见问题排查**：`ClassNotFoundException` vs `NoClassDefFoundError`，`LinkageError`，内存溢出，依赖冲突，以及调试工具 `-verbose:class`。

Happy coding!
