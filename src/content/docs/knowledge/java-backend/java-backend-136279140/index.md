---
title: "Java基础-内部类"
description: "Java不仅可以定义变量和方法,还可以定义类."
sourceId: "136279140"
source: "https://blog.csdn.net/qq_45852626/article/details/136279140"
sourceSeries:
  - "Java基础"
category: java-backend
tags:
  - "Java基础"
  - "Java"
status: draft
difficulty: beginner
contentType: knowledge
sidebar:
  order: 136279140
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/136279140)（历史文章导入，当前状态为草稿）

```
```

### 引言

Java不仅可以定义变量和方法,还可以定义类.  
 内部类允许你把一些逻辑相关的类组织在一起,并可以控制内部中类的可见性.  
 这么看来,内部类就像是代码一种隐藏机制:将类放在其他类的内部,从而隐藏名字和组织代码的模式.  
 根据定义方式的不同,分为四种类型: 静态内部类, 成员内部类,局部内部类,匿名内部类

#### 内部类的共性

* 依然是一个独立的类,在编辑之后内部类会被编辑成独立的.class文件,但是前面会添加外部类的类名和$符号
* 声明为静态的,就不能随便访问外部类的成员变量了,此时内部类只能访问外部类的静态成员变量或方法
* 外部类不能直接访问内部类的成员,但可以通过内部类对象来访问

内部类是外部类的一个成员,因此内部类可以自由访问外部类的成员变量,无论是否为private.  
 因为某个外围类对象创建内部类对象时,此内部类会捕获一个隐式引用,它引用了实例化内部对象的外围类对象,通过这个指针,可以访问外围类对象的全部状态.

**实现原理**  
 反编译内部类字节码,分析主要通过以下几步做到的:

1. 编译器为内部类添加一个成员变量,它的类型和外部类的类型相同,这个成员变量就是指向外部类对象的引用
2. 编译器为内部类的构造方法添加一个参数,参数类型是外部类类型,在构造方法内部使用这个参数为1中添加的成员变量赋值
3. 在调用内部类的构造函数初始化内部类对象时,会默认传入外部类的引用

下面我们举个例子来看一下:

```
public class Outter {
    private Inner inner = null;
    public Outter() {
         
    }
     
    public Inner getInnerInstance() {
        if(inner == null)
            inner = new Inner();
        return inner;
    }
      
    protected class Inner {
        public Inner() {
             
        }
    }
}


```

![在这里插入图片描述](./assets/d8d2d597b524536ff1a59fc0.png)  
 反编译Outter$Inner.class文件得到下面信息:

```
E:\Workspace\Test\bin\com\cxh\test2>javap -v Outter$Inner
Compiled from "Outter.java"
public class com.cxh.test2.Outter$Inner extends java.lang.Object
  SourceFile: "Outter.java"
  InnerClass:
   #24= #1 of #22; //Inner=class com/cxh/test2/Outter$Inner of class com/cxh/tes
t2/Outter
  minor version: 0
  major version: 50
  Constant pool:
const #1 = class        #2;     //  com/cxh/test2/Outter$Inner
const #2 = Asciz        com/cxh/test2/Outter$Inner;
const #3 = class        #4;     //  java/lang/Object
const #4 = Asciz        java/lang/Object;
const #5 = Asciz        this$0;
const #6 = Asciz        Lcom/cxh/test2/Outter;;
const #7 = Asciz        <init>;
const #8 = Asciz        (Lcom/cxh/test2/Outter;)V;
const #9 = Asciz        Code;
const #10 = Field       #1.#11; //  com/cxh/test2/Outter$Inner.this$0:Lcom/cxh/t
est2/Outter;
const #11 = NameAndType #5:#6;//  this$0:Lcom/cxh/test2/Outter;
const #12 = Method      #3.#13; //  java/lang/Object."<init>":()V
const #13 = NameAndType #7:#14;//  "<init>":()V
const #14 = Asciz       ()V;
const #15 = Asciz       LineNumberTable;
const #16 = Asciz       LocalVariableTable;
const #17 = Asciz       this;
const #18 = Asciz       Lcom/cxh/test2/Outter$Inner;;
const #19 = Asciz       SourceFile;
const #20 = Asciz       Outter.java;
const #21 = Asciz       InnerClasses;
const #22 = class       #23;    //  com/cxh/test2/Outter
const #23 = Asciz       com/cxh/test2/Outter;
const #24 = Asciz       Inner;
 
{
/////////////////////////////////////////////////看中间的代码
final com.cxh.test2.Outter this$0;   //注意这一行代码!!!
/////////////////////////////////////////看中间的代码
public com.cxh.test2.Outter$Inner(com.cxh.test2.Outter);
  Code:
   Stack=2, Locals=2, Args_size=2
   0:   aload_0
   1:   aload_1
   2:   putfield        #10; //Field this$0:Lcom/cxh/test2/Outter;
   5:   aload_0
   6:   invokespecial   #12; //Method java/lang/Object."<init>":()V
   9:   return
  LineNumberTable:
   line 16: 0
   line 18: 9
 
  LocalVariableTable:
   Start  Length  Slot  Name   Signature
   0      10      0    this       Lcom/cxh/test2/Outter$Inner;
}


```

`final com.cxh.test2.Outter this$0;`  
 这是一个指向外部类对象的指针.  
 也就是说,编译器会默认成员内部类添加了一个指向外部类对象的引用

那这个引用如何赋初值呢?  
 下面接着看一下内部类的构造器  
 `public com.cxh.test2.Outter$Inner(com.cxh.test2.Outter);`  
 虽然我们定义的内部类的构造器说无参构造器,但是编译器还是默认添加一个参数,该参数类型为指向外部类对象的一个引用.  
 所以成员内部类中的`Outter this&0`指针便指向类外部类对象,因此可以在成员内部类中随意访问外部类的成员.  
 从这里也间接说明了成员内部类是依赖外部类的,如果没有创建外部类的对象,则无法对`Outter this&0`引用进行初始化赋值,也就无法创建成员内部类的对象了.

#### 成员内部类

成员内部类像是外部类的一个成员,它定义在另一个类的内部  
 成员内部类分为两种:

1. 静态成员内部类: 使用static修饰类
2. 非静态成员内部类: 不实用static修饰类,在没说明是静态成员内部类时,默认成员内部类指的是非静态成员内部类

##### 静态内部类

定义在类内部的静态类,就是静态内部类.  
 静态内部类不需要依赖外部类,这点和静态成员属性类似,并且它不能使用外部类的非Static成员变量和方法.  
 因为没有外部类对象的情况下,我们可以创建出静态内部类对象,这时候如果允许访问外部类的非Static成员就会产生矛盾,因为外部类的非Static成员必须依附于具体的对象.

```
public class Out {
 private static int a;
 private int b;
 public static class Inner {
 public void print() {
 System.out.println(a);
 }
 }
}


```

访问作用域: 可以访问外部类所有的静态变量和方法,即使是private也一样可以访问  
 与类不同点: 和一般类一致,可以定义静态变量,方法,构造方法等  
 使用的方法: 外部类.静态内部类。如:`Out.Inner inner = new Out.Inner();inner.print();`

##### 非静态内部类

最普通的内部类,定义位于另一类的内部,如下面形式

```
class Circle {
    double radius = 0;
     
    public Circle(double radius) {
        this.radius = radius;
    }
     
    class Draw {     //内部类
        public void drawSahpe() {
            System.out.println("drawshape");
        }
    }
}


```

类Draw像是Circle的一个成员,Circle称为外部类.  
 成员内部类可以无条件访问外部类的所有成员属性和成员方法(包括private成员和静态成员)  
 但是外部类访问内部类成员,首先要创建一个成员内部类的对象,再通过指向这个对象的引用来访问

* 内部类访问外部类

```
class Circle {
    private double radius = 0;
    public static int count =1;
    public Circle(double radius) {
        this.radius = radius;
    }
     
    class Draw {     //内部类
        public void drawSahpe() {
            System.out.println(radius);  //外部类的private成员
            System.out.println(count);   //外部类的静态成员
        }
    }
}


```

* 外部类访问内部类

```
class Circle {
    private double radius = 0;
 
    public Circle(double radius) {
        this.radius = radius;
        getDrawInstance().drawSahpe();   //必须先创建成员内部类的对象，再进行访问
    }
     
    private Draw getDrawInstance() {
        return new Draw();
    }
     
    class Draw {     //内部类
        public void drawSahpe() {
            System.out.println(radius);  //外部类的private成员
        }
    }
}


```

注意:  
 成员内部类和外部类同名的成员变量或者方法时,会发生隐藏现象,即默认情况下访问的是成员内部类的成员.  
 如果要访问外部类的同名成员,需要以下面的形式进行访问:  
 外部类.this.成员变量  
 外部类.this.成员方法

#### 局部内部类

定义在一个方法或者一个作用域里面的内,它和成员内部类的区别在于局部内部类的访问仅限于方法内或者该作用域内.

```
class People{
    public People() {
         
    }
}
 
class Man{
    public Man(){
         
    }
     
    public People getWoman(){
        class Woman extends People{   //局部内部类
            int age =0;
        }
        return new Woman();
    }
}


```

注意: 局部内部类就像是方法里面的一个局部变量一样,是不能有public,protected,private以及static修饰符的.

#### 匿名内部类

这个应该是我们编写代码时用的最多的,在编写事件监听的代码时使用匿名内部类不但方便,而且使代码更容易维护.  
 由于没有名字,所以它创建方式有点奇怪,创建格式如下:

```
new 父类构造器(参数列表)|实现接口(){
   //匿名内部类的类体部分
}


```

它是没有class关键字的,匿名内部类直接使用new来生成一个对象的引用.这个引用是隐式的.

```
public class AnonymousInnerClassExample {  
    public static void main(String[] args) {  
        // 创建一个订单处理系统实例  
        OrderProcessingSystem system = new OrderProcessingSystem();  
  
        // 创建一个订单实例  
        Order order = new Order("123", 100.0);  
  
        // 使用匿名内部类实现一个打印订单详情的处理器  
        system.process(order, new OrderProcessor() {  
            @Override  
            public void processOrder(Order order) {  
                System.out.println("Processing order: " + order);  
            }  
        });  
  
        // 使用另一个匿名内部类实现一个打折处理订单的逻辑  
        system.process(order, new OrderProcessor() {  
            @Override  
            public void processOrder(Order order) {  
                double discount = 0.1; // 假设打10%的折扣  
                double discountedAmount = order.getAmount() * (1 - discount);  
                System.out.println("Processing discounted order: " + order + " with discounted amount: " + discountedAmount);  
            }  
        });  
    }  
}


```

使用匿名内部类的好处显而易见

1. 比较简洁,只需要实现一个接口的简单任务,使用它可以避免创建额外命名类
2. 可以访问其外部类所有成员(包括私有成员),在某些场景下非常灵活

注意:

* 使用匿名内部类,我们必须是继承一个类或者实现一个接口(二者不可兼得),同时也只能继承一个类或者实现一个接口
* 匿名内部类中不能定义构造函数,且不能存在任何静态成员变量和静态方法
* 匿名内部类为局部内部类,所以局部内部类的限制对匿名内部类也生效
* 匿名内部类不能是抽象的,它必须要实现继承的类或者实现接口的所有抽象方法

##### 使用给匿名内部类传递形参为什么需要final

内部类在编译成功后,会产生一个class文件,该class文件与外部类并不是同一class文件,仅仅只保留对外部类的引用.  
 当外部类传入的参数需要被内部类调用时,从java程序的角度来看是直接被调用的.

```
public class OuterClass {
    public void display(final String name,String age){
        class InnerClass{
            void display(){
                System.out.println(name);
            }
        }
    }
}


```

代码上来看,好像name参数应该是被内部类直接调用,但是java编译之后的实际操作如下:

```
public class OuterClass$InnerClass {
    public InnerClass(String name,String age){
        this.InnerClass$name = name;
        this.InnerClass$age = age;
    }
    
    
    public void display(){
        System.out.println(this.InnerClass$name + "----" + this.InnerClass$age );
    }
}


```

所以,内部类并不是直接调用方法传递的参数,而是利用自身的构造器对传入的参数进行备份,自己内部方法调用的实际上是自己的属性而不是外部方法传递进来的参数.  
 那么内部类对属性的改变并不是影响到外部的形参,这肯定是不行的,为了保证参数的一致性,所以就规定使用final来避免形参的不改变.

##### 匿名内部类的初始化

一般都是利用构造器来完成某个实例的初始化工作的，但是匿名内部类是没有构造器的！那怎么来初始化匿名内部类呢？使用构造代码块！

```
public class OutClass {
    public InnerClass getInnerClass(final int age,final String name){
        return new InnerClass() {
            int age_ ;
            String name_;
            //构造代码块完成初始化工作
            {
                if(0 < age && age < 200){
                    age_ = age;
                    name_ = name;
                }
            }
            public String getName() {
                return name_;
            }
            
            public int getAge() {
                return age_;
            }
        };
    }
    
    public static void main(String[] args) {
        OutClass out = new OutClass();
        
        InnerClass inner_1 = out.getInnerClass(201, "chenssy");
        System.out.println(inner_1.getName());
        
        InnerClass inner_2 = out.getInnerClass(23, "chenssy");
        System.out.println(inner_2.getName());
    }
}


```

#### 内部类的使用场景和好处

为什么Java需要内部类呢?总结有下面四点:

* 每个内部类都能独立的继承一个接口的实现,无论外部类是否已经继承了某个(接口)实现,对于内部类都没有影响.  
   解释一下:  
   Java本身不支持类的多继承,但可以通过内部类来实现接口的多继承效果.我们可以在一个外部类中定义多个内部类,每个内部类都可以实现不同的接口,从而达到类类似多继承的效果.  
   举个简单的代码例子来说明这个概念:

```
// 定义一个接口A  
interface InterfaceA {  
    void methodA();  
}  
  
// 定义另一个接口B  
interface InterfaceB {  
    void methodB();  
}  
  
// 外部类  
class OuterClass {  
    // 外部类可以继承自一个类，这里我们假设它继承自Object（实际上所有类都隐式继承自Object）  
  
    // 内部类1，实现接口A  
    private class InnerClassA implements InterfaceA {  
        @Override  
        public void methodA() {  
            System.out.println("Implementing methodA from InterfaceA in InnerClassA");  
        }  
    }  
  
    // 内部类2，实现接口B  
    private class InnerClassB implements InterfaceB {  
        @Override  
        public void methodB() {  
            System.out.println("Implementing methodB from InterfaceB in InnerClassB");  
        }  
    }  
  
    // 可以提供获取内部类实例的方法  
    public InterfaceA getInnerClassA() {  
        return new InnerClassA();  
    }  
  
    public InterfaceB getInnerClassB() {  
        return new InnerClassB();  
    }  
}  
  
// 使用示例  
public class Main {  
    public static void main(String[] args) {  
        OuterClass outer = new OuterClass();  
          
        // 获取并调用内部类A的方法  
        InterfaceA innerA = outer.getInnerClassA();  
        innerA.methodA();  
          
        // 获取并调用内部类B的方法  
        InterfaceB innerB = outer.getInnerClassB();  
        innerB.methodB();  
    }  
}


```

2. 方便将存在一定逻辑关系的类组织在一起,又可以对外界隐藏
3. 方便编写事件驱动程序
4. 方便编写线程代码
