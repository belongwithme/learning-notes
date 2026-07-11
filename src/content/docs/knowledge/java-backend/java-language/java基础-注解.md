---
title: "Java基础-注解"
description: "注解的汉语意思: 用浅近的文字解释艰深的词句"
sourceId: "136016127"
source: "https://blog.csdn.net/qq_45852626/article/details/136016127"
sourceSeries:
  - "Java基础"
category: java-backend
subcategory: java-language
tags:
  - "Java基础"
  - "Java"
status: draft
difficulty: beginner
contentType: knowledge
sidebar:
  order: 136016127
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/136016127)（历史文章导入，当前状态为草稿）

## 注解是用来干什么的

注解的汉语意思: 用浅近的文字解释艰深的词句

注解是JDK1.5版本开始引入的一个特性,**用于对代码进行说明**,可以对包,类,接口,字段,方法参数,局部变量进行注解.

## 它有什么作用

主要作用是下面四个方面

* 生成文档  
   通过代码里标识的元数据生成javaDoc文档
* 编译检查  
   通过代码里标识的元数据让编译器在编译期间进行检查验证
* 编译时动态处理  
   编译时通过代码里标识的元数据动态处理,例如动态生成代码
* 运行时动态处理  
   运行时通过底阿妈里标识的元数据动态处理,例如使用反射注入实例

## 注解的常见分类

* Java自带的标准注解  
   用于标明重写某个方法,某个类或方法过时,表明要忽略的警告,用这些注解表明后编译器就会 进行检查
* 元注解  
   用于定义注解的注解
* 自定义注解  
   根据自己的需求定义注解,并可用元注解对自定义注解进行注解

## 内置注解

```
```

### @Override

表示当前的方法定义将覆盖父类中的方法

#### 注解定义

```
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.SOURCE)
public @interface Override {
}


```

这个注解可以用来修饰方法,并只在编译期有效,编译期后class文件就不存在了

### @Deprecated

表示代码被弃用,如果使用了被@Deprecated注解的代码编译器会发出警告

#### 注解定义

```
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(value={CONSTRUCTOR, FIELD, LOCAL_VARIABLE, METHOD, PACKAGE, PARAMETER, TYPE})
public @interface Deprecated {
}


```

1. 它会被文档化
2. 可以保留到运行时
3. 可以修饰构造方法,属性,局部变量,方法,包,参数,类型

### @SuppressWarnings

关闭编译器警告信息

#### 注解定义

```
@Target({TYPE, FIELD, METHOD, PARAMETER, CONSTRUCTOR, LOCAL_VARIABLE})
@Retention(RetentionPolicy.SOURCE)
public @interface SuppressWarnings {
    String[] value();
}


```

1. 可以修饰类型,属性,方法,参数,构造器,局部变量
2. 只能存活在源码
3. 取值为String[]  
    它可以取的值如下所示:

| 参数 | 作用 |
| --- | --- |
| all | 抑制所有警告 |
| deprecation | 抑制启用注释的警告 |
| finally | 抑制finally模块没有返回的警告 |
| null | 忽略对null的操作 |
| unused | 抑制没被使用过的代码的警告 |
| 等等 |  |

## 元注解

### @Target

描述注解的使用范围(即被修饰的注解可以在什么地方使用)

#### 注解定义

```
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.ANNOTATION_TYPE)
public @interface Target {
    /**
     * Returns an array of the kinds of elements an annotation interface
     * can be applied to.
     * @return an array of the kinds of elements an annotation interface
     * can be applied to
     */
    ElementType[] value();
}


```

1. 可被文档化
2. 可以保留到运行时
3. 只能在注解类上使用
4. value值在ElementType中

#### ElementType

```
public enum ElementType {
 
    TYPE, // 类、接口、枚举类
 
    FIELD, // 成员变量（包括：枚举常量）
 
    METHOD, // 成员方法
 
    PARAMETER, // 方法参数
 
    CONSTRUCTOR, // 构造方法
 
    LOCAL_VARIABLE, // 局部变量
 
    ANNOTATION_TYPE, // 注解类
 
    PACKAGE, // 可用于修饰：包
 
    TYPE_PARAMETER, // 类型参数，JDK 1.8 新增
 
    TYPE_USE // 使用类型的任何地方，JDK 1.8 新增
 
}


```

### @Retention&&@RetentionTarget

描述注解保留的时间范围(即被描述的注解在它所修饰的类中可以被保留到何时)

#### 注解定义

```
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.ANNOTATION_TYPE)
public @interface Retention {
    RetentionPolicy value();
}


```

1. 可被文档化
2. 可以保留到运行时
3. 只能在注解类上使用
4. value值在RetentionPolicy 中

#### RetentionPolicy

```
public enum RetentionPolicy {
    SOURCE,    // 源文件保留
    CLASS,       // 编译期保留，默认值
    RUNTIME   // 运行期保留，可通过反射去获取注解信息
}


```

我们可以通过执行`javap -verbose RetentionTest`获取到`RetentionTest`的class字节码内容如下.

```
{
  public retention.RetentionTest();
    flags: ACC_PUBLIC
    Code:
      stack=1, locals=1, args_size=1
         0: aload_0
         1: invokespecial #1                  // Method java/lang/Object."<init>":()V
         4: return
      LineNumberTable:
        line 3: 0

  public void sourcePolicy();
    flags: ACC_PUBLIC
    Code:
      stack=0, locals=1, args_size=1
         0: return
      LineNumberTable:
        line 7: 0

  public void classPolicy();
    flags: ACC_PUBLIC
    Code:
      stack=0, locals=1, args_size=1
         0: return
      LineNumberTable:
        line 11: 0
    RuntimeInvisibleAnnotations:
      0: #11()

  public void runtimePolicy();
    flags: ACC_PUBLIC
    Code:
      stack=0, locals=1, args_size=1
         0: return
      LineNumberTable:
        line 15: 0
    RuntimeVisibleAnnotations:
      0: #14()
}


```

我们可以得到下面的两个结论:

1. 编译期没有记录下sourcePolicy()方法的注解信息
2. 编译期分别使用了`RuntimeInvisibleAnnotations`, `RuntimeVisibleAnnotations` 属性去记录了`classPolicy()`方法和`runtimePolicy()`方法的注解信息

### @Documented

描述使用javaDoc工具为类生成帮助文档时是否要保留其注解信息

#### 注解定义

```
@Documented
@Target({ElementType.TYPE,ElementType.METHOD})
public @interface TestDocAnnotation {
 
	public String value() default "default";
}


```

1. 可被生成文档
2. 使用范围是类,接口,枚举类,成员方法

### @Inherited

被他修饰的注解具有继承性.  
 如果某个类使用了被@Inherited修饰的注解,则其子类将自动具有该注释

#### 注解定义

```
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.ANNOTATION_TYPE)
public @interface Inherited {
}


```

1. 可被生成文档
2. 可被保留到运行时
3. 只能用于注解类

#### 用法

定义`@Inherited`注解

```
@Inherited
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE,ElementType.METHOD})
public @interface TestInheritedAnnotation {
    String [] values();
    int number();
}


```

使用这个注解

```
@TestInheritedAnnotation(values = {"value"}, number = 10)
public class Person {
}

class Student extends Person{
	@Test
    public void test(){
        Class clazz = Student.class;
        Annotation[] annotations = clazz.getAnnotations();
        for (Annotation annotation : annotations) {
            System.out.println(annotation.toString());
        }
    }
}


```

输出内容

```
xxxxxxx.TestInheritedAnnotation(values=[value], number=10)


```

即使Student类没有显示地被注解`@TestInheritedAnnotation`，但是它的父类Person被注解，而且`@TestInheritedAnnotation`被`@Inherited`注解，因此Student类自动有了该注解.

### Repeatable(重复注解)

允许在同一申明类型(类,属性,方法)多次使用同一注解

#### 注解定义

```
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.ANNOTATION_TYPE)
public @interface Repeatable {
    Class<? extends Annotation> value();
}


```

1. 可被生成文档
2. 可以保留至运行时
3. 只能作用域注解类

#### JDK8之前

JDK8之前有重复使用注解的解决方案,但是可读性不好  
 方案: 由另一个注解来存储重复注解,在使用的时候,用存储注解`Authorities`来扩展重复注解

```
public @interface Authority {
     String role();
}

public @interface Authorities {
    Authority[] value();
}

public class RepeatAnnotationUseOldVersion {

    @Authorities({@Authority(role="Admin"),@Authority(role="Manager")})
    public void doSomeThing(){
    }
}


```

#### JDK8之后

方案: 创建重复注解时,加上`@Repeatable`,指向存储注解`Authorities`,在使用的时候,可以直接重复使用Authority注解.

```
@Repeatable(Authorities.class)
public @interface Authority {
     String role();
}

public @interface Authorities {
    Authority[] value();
}

public class RepeatAnnotationUseNewVersion {
    @Authority(role="Admin")
    @Authority(role="Manager")
    public void doSomeThing(){ }
}


```

### Native

使用@Native注解修饰成员变量,表示这个变量可以被本地代码引用,常常被代码生成工具使用,了解即可.

## 注解与反射接口

我们如果想自定义注解,那么就必须先了解注解与反射接口的这部分内容.  
 反射包`java.lang.reflect`下的`AnnotatedElement`接口提供这些方法.  
 注意:只有注解被定义为`RUNTIME`后,该注解才能是运行时可见,当class文件被装载时,被保存在class文件中的`Annotation`才会被虚拟机读取.

`AnnotatedElement`接口是所有程序元素(Class,Method,Constructor)的父接口.

```
Class类
public final class Class<T> implements Serializable, GenericDeclaration, Type, AnnotatedElement, TypeDescriptor.OfField<Class<?>>, Constable {
xxxx
}
Method类
public final class Method extends Executable {
xxx
}
public abstract sealed class Executable extends AccessibleObject{
xxx
}
public class AccessibleObject implements AnnotatedElement {
xxx
}

Constructor类
public final class Constructor<T> extends Executable {
xxx
}
和上面Method的继承路径是是一样的,不赘述了.


```

### 相关接口

* `boolean isAnnotationPresent(Class<?extends Annotation> annotationClass)`  
   判断该元素上是否包含指定类型的注解,存在则返回true,否则返回false.  
   (此方法会忽略注解对应的注解容器)
* `<T extends Annotation> T getAnnotation(Class<T> annotationClass)`  
   返回该程序元素上存在的,制定类型的注解,如果该类型的注解不存在,则返回null
* `<Annotation[] getAnnotations()`  
   返回该程序元素上存在的所有注解,若没有注解,返回长度为0的数组
* `<T extends Annotation> T[] getAnnotationsByType(Class<T> annotationClass)`  
   返回该程序元素上存在的,指定类型的注解数据.若没有,返回长度为0的数组  
   该方法调用者可以随意修改返回数据,不会对其他调用者返回数组产生影响.  
   (会检测注解对应的重复注解容器)
* `<T extends Annotation> T getDeclaredAnnotation(Class<T> annotationClass`  
   返回直接存在此元素上的所有注解.  
   该方法忽略继承的注解,如果没有注解直接存在此元素上,返回null.
* `<T extends Annotation> T[] getDeclaredAnotationsByType(Class<T> annotationClass)`  
   返回直接存在此元素上所有指定类型注解,  
   该方法忽略继承的注解
* `Annotion[] getDeclaredAnnotations()`  
   返回直接存在于此元素上的所有注解机器注解对应的重复注解容器.  
   该方法忽略继承注解,如果没有注释直接存在于此元素上，则返回长度为零的一个数组。该方法的调用者可以随意修改返回的数组，而不会对其他调用者返回的数组产生任何影响。

## 自定义注解

理解注解与反射接口后,我们通过自定义注解来把知识点融合应用一下

* 定义注解

```
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface MyMethodAnnotation {

    public String title() default "";

    public String description() default "";

}


```

* 使用注解

```
public class TestMethodAnnotation {

    @Override
    @MyMethodAnnotation(title = "toStringMethod", description = "override toString method")
    public String toString() {
        return "Override toString method";
    }

    @Deprecated
    @MyMethodAnnotation(title = "old static method", description = "deprecated old static method")
    public static void oldMethod() {
        System.out.println("old method, don't use it.");
    }

    @SuppressWarnings({"unchecked", "deprecation"})
    @MyMethodAnnotation(title = "test method", description = "suppress warning static method")
    public static void genericsTest() throws FileNotFoundException {
        List l = new ArrayList();
        l.add("abc");
        oldMethod();
    }
}


```

* 用反射接口获取注解信息

```
public static void main(String[] args) {
    try {
        // 获取所有methods
        Method[] methods = TestMethodAnnotation.class.getClassLoader()
                .loadClass(("com.pdai.java.annotation.TestMethodAnnotation"))
                .getMethods();

        // 遍历
        for (Method method : methods) {
            // 方法上是否有MyMethodAnnotation注解
            if (method.isAnnotationPresent(MyMethodAnnotation.class)) {
                try {
                    // 获取并遍历方法上的所有注解
                    for (Annotation anno : method.getDeclaredAnnotations()) {
                        System.out.println("Annotation in Method '"
                                + method + "' : " + anno);
                    }

                    // 获取MyMethodAnnotation对象信息
                    MyMethodAnnotation methodAnno = method
                            .getAnnotation(MyMethodAnnotation.class);

                    System.out.println(methodAnno.title());

                } catch (Throwable ex) {
                    ex.printStackTrace();
                }
            }
        }
    } catch (SecurityException | ClassNotFoundException e) {
        e.printStackTrace();
    }
}


```

* 测试的输出

```
Annotation in Method 'public static void com.pdai.java.annotation.TestMethodAnnotation.oldMethod()' : @java.lang.Deprecated()
Annotation in Method 'public static void com.pdai.java.annotation.TestMethodAnnotation.oldMethod()' : @com.pdai.java.annotation.MyMethodAnnotation(title=old static method, description=deprecated old static method)
old static method
Annotation in Method 'public static void com.pdai.java.annotation.TestMethodAnnotation.genericsTest() throws java.io.FileNotFoundException' : @com.pdai.java.annotation.MyMethodAnnotation(title=test method, description=suppress warning static method)
test method
Annotation in Method 'public java.lang.String com.pdai.java.annotation.TestMethodAnnotation.toString()' : @com.pdai.java.annotation.MyMethodAnnotation(title=toStringMethod, description=override toString method)
toStringMethod


```

## 注解的本质(未完结)

这部分要扯到动态代理和注解的处理器,emmm比较麻烦.  
 后面发完动态处理后返回来填坑
