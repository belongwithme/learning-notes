---
title: "JVM 的启动器类解读 -- sun.misc.Launcher"
description: "在深入理解 Launcher 之前，我们需要先了解 Java 的类加载机制："
sourceId: "153633467"
source: "https://blog.csdn.net/qq_45852626/article/details/153633467"
sourceSeries:
  - "Java源码"
category: java-backend
tags:
  - "Java源码"
  - "JVM"
status: draft
difficulty: intermediate
contentType: knowledge
sidebar:
  order: 153633467
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/153633467)（历史文章导入，当前状态为草稿）

#### Launcher 类解读
## sun.misc.Launcher 类解读

### 前置知识铺垫

#### 什么是类加载器（ClassLoader）

在深入理解 `Launcher` 之前，我们需要先了解 Java 的类加载机制：

##### 类加载的过程

```
加载（Loading）
  ↓
链接（Linking）
  ├─ 验证（Verification）
  ├─ 准备（Preparation）
  └─ 解析（Resolution）
  ↓
初始化（Initialization）


```

##### 类加载器的职责

* 负责将 `.class` 字节码文件加载到 JVM 内存
* 将字节码转换为 `java.lang.Class` 对象
* 通过全限定类名来定位并加载类

---

#### 双亲委派模型（Parent Delegation Model）

这是理解 `Launcher` 的核心前置知识：

```
BootstrapClassLoader（启动类加载器）C++ 实现
         ↑ 父加载器
         |
ExtClassLoader（扩展类加载器）
         ↑ 父加载器
         |
AppClassLoader（应用程序类加载器）
         ↑ 父加载器
         |
自定义ClassLoader（用户自定义类加载器）


```

##### 双亲委派机制流程

```
1. 收到类加载请求
   ↓
2. 先委派给父加载器尝试加载
   ↓
3. 父加载器找不到？
   ├─ 是 → 自己尝试加载
   └─ 否 → 返回父加载器加载的类


```

##### 为什么需要双亲委派？

**保证 Java 核心类库的安全性**

```
// 假设你自己写了一个 java.lang.String 类
package java.lang;

public class String {
    // 恶意代码
    public void maliciousMethod() {
        // 危险操作
    }
}


```

由于双亲委派机制：

1. 你的应用要加载 `java.lang.String`
2. AppClassLoader 委派给 ExtClassLoader
3. ExtClassLoader 委派给 BootstrapClassLoader
4. BootstrapClassLoader 已经加载了 JDK 核心的 `String` 类
5. 返回 JDK 的 `String`，你的恶意类永远不会被加载

---

#### 三大核心类加载器

| 类加载器 | 实现语言 | 负责加载的路径 | 父加载器 |
| --- | --- | --- | --- |
| BootstrapClassLoader | C++ | `$JAVA_HOME/jre/lib` (如 rt.jar) | 无 |
| ExtClassLoader | Java | `$JAVA_HOME/jre/lib/ext` | BootstrapClassLoader |
| AppClassLoader | Java | CLASSPATH / java.class.path | ExtClassLoader |

---

#### JVM 启动流程（简化版）

```
1. 操作系统加载 JVM（C++ 编写）
   ↓
2. JVM 初始化 BootstrapClassLoader（C++ 实现）
   ↓
3. BootstrapClassLoader 加载核心类库（rt.jar）
   ↓
4. 创建 sun.misc.Launcher 实例 ← 我们今天的主角
   ↓
5. Launcher 创建 ExtClassLoader
   ↓
6. Launcher 创建 AppClassLoader
   ↓
7. 设置线程上下文类加载器为 AppClassLoader
   ↓
8. 使用 AppClassLoader 加载主类（main 方法所在的类）
   ↓
9. 执行 main 方法，程序开始运行


```

---

### Launcher 类的核心作用

#### 介绍

`sun.misc.Launcher` 是 **JVM 启动应用程序的入口类**，它的核心职责是：

1. **创建并初始化扩展类加载器（ExtClassLoader）**
2. **创建并初始化应用程序类加载器（AppClassLoader）**
3. **设置线程上下文类加载器**
4. **管理安全管理器（SecurityManager）**
5. **提供访问 Bootstrap ClassPath 的能力**

#### 核心设计模式

这个类里面我们可以学习到很多设计模式的使用,整体看下来感觉挺受用的.

```
public class Launcher {
    // 单例模式 - 全局唯一的 Launcher 实例
    private static Launcher launcher = new Launcher();

    // 工厂模式 - URLStreamHandlerFactory
    private static URLStreamHandlerFactory factory = new Factory();

    // 懒加载模式 - BootClassPathHolder 静态内部类
    private static class BootClassPathHolder {
        static final URLClassPath bcp;
        // ...
    }
}


```

---

### 核心源码详细解读

#### Launcher 的核心字段

```
public class Launcher {
    // URL 协议处理器工厂（如 http、https、file 等协议的处理）
    private static URLStreamHandlerFactory factory = new Factory();

    // 单例 - JVM 全局唯一的 Launcher 实例
    private static Launcher launcher = new Launcher();

    // 启动类路径（Bootstrap ClassPath）
    // 例如：/usr/lib/jvm/java-8/jre/lib/rt.jar
    private static String bootClassPath =
        System.getProperty("sun.boot.class.path");

    // 应用程序类加载器的引用
    private ClassLoader loader;

    // 获取全局唯一的 Launcher 实例
    public static Launcher getLauncher() {
        return launcher;
    }
}


```

---

#### 构造函数 - 核心初始化流程

这是整个类加载体系的初始化入口：

```
public Launcher() {
    // ===========================================
    // 步骤1：创建扩展类加载器（ExtClassLoader）
    // ===========================================
    ClassLoader extcl;
    try {
        // 调用静态工厂方法创建扩展类加载器
        extcl = ExtClassLoader.getExtClassLoader();
    } catch (IOException e) {
        throw new InternalError(
            "Could not create extension class loader", e);
    }

    // ===========================================
    // 步骤2：创建应用程序类加载器（AppClassLoader）
    // 注意：extcl 作为参数传入，成为 AppClassLoader 的父加载器
    // ===========================================
    try {
        // 传入 extcl 作为父加载器
        loader = AppClassLoader.getAppClassLoader(extcl);
    } catch (IOException e) {
        throw new InternalError(
            "Could not create application class loader", e);
    }

    // ===========================================
    // 步骤3：设置主线程的上下文类加载器
    // ===========================================
    // 这一步非常关键！为 SPI 机制埋下伏笔
    // 后续 ServiceLoader 会通过这个上下文类加载器加载服务实现类
    Thread.currentThread().setContextClassLoader(loader);

    // ===========================================
    // 步骤4：安装安全管理器（如果需要）
    // ===========================================
    String s = System.getProperty("java.security.manager");
    if (s != null) {
        SecurityManager sm = null;
        if ("".equals(s) || "default".equals(s)) {
            // 使用默认的安全管理器
            sm = new java.lang.SecurityManager();
        } else {
            // 使用自定义的安全管理器类
            try {
                // 使用 AppClassLoader 加载自定义 SecurityManager
                sm = (SecurityManager)loader.loadClass(s).newInstance();
            } catch (IllegalAccessException e) {
            } catch (InstantiationException e) {
            } catch (ClassNotFoundException e) {
            } catch (ClassCastException e) {
            }
        }
        if (sm != null) {
            System.setSecurityManager(sm);
        } else {
            throw new InternalError(
                "Could not create SecurityManager: " + s);
        }
    }
}


```

##### 关键点解析

这里需要注意两点!!!

1. **为什么先创建 ExtClassLoader？**

   * 因为 AppClassLoader 需要 ExtClassLoader 作为父加载器
   * 这样才能实现双亲委派模型
2. **为什么要设置线程上下文类加载器？**

   ```
   Thread.currentThread().setContextClassLoader(loader);


   ```

   这是为了解决 **双亲委派模型的局限性**：

   * 问题场景：BootstrapClassLoader 加载的 JDBC 接口（`java.sql.Driver`）
   * 需要加载：AppClassLoader 路径下的驱动实现类（如 `com.mysql.cj.jdbc.Driver`）
   * 矛盾：父类加载器无法访问子类加载器加载的类
   * 解决方案：通过线程上下文类加载器（AppClassLoader）实现反向类加载

---

#### ExtClassLoader - 扩展类加载器

##### 类定义和继承关系

```
static class ExtClassLoader extends URLClassLoader {

    static {
        // 注册为支持并行加载的类加载器
        // 这样多个线程可以同时使用此加载器加载不同的类
        ClassLoader.registerAsParallelCapable();
    }

    // ...
}


```

##### 创建 ExtClassLoader

```
public static ExtClassLoader getExtClassLoader() throws IOException {
    // 1. 获取扩展目录列表
    final File[] dirs = getExtDirs();

    try {
        // 2. 在特权块中创建 ExtClassLoader
        return AccessController.doPrivileged(
            new PrivilegedExceptionAction<ExtClassLoader>() {
                public ExtClassLoader run() throws IOException {
                    int len = dirs.length;
                    // 为每个扩展目录注册元数据索引（优化类查找速度）
                    for (int i = 0; i < len; i++) {
                        MetaIndex.registerDirectory(dirs[i]);
                    }
                    // 创建 ExtClassLoader 实例
                    return new ExtClassLoader(dirs);
                }
            });
    } catch (java.security.PrivilegedActionException e) {
        throw (IOException) e.getException();
    }
}


```

##### 获取扩展目录

```
private static File[] getExtDirs() {
    // 从系统属性获取扩展目录路径
    // 例如：/usr/lib/jvm/java-8/jre/lib/ext
    String s = System.getProperty("java.ext.dirs");
    File[] dirs;
    if (s != null) {
        // 使用平台相关的路径分隔符分割多个目录
        // Windows: ';'   Unix/Linux: ':'
        StringTokenizer st =
            new StringTokenizer(s, File.pathSeparator);
        int count = st.countTokens();
        dirs = new File[count];
        for (int i = 0; i < count; i++) {
            dirs[i] = new File(st.nextToken());
        }
    } else {
        dirs = new File[0];
    }
    return dirs;
}


```

##### 构造器 - 注意父加载器为 null

```
public ExtClassLoader(File[] dirs) throws IOException {
    // 【重点】第二个参数 parent = null
    // 这意味着 ExtClassLoader 的父加载器是 null
    // 但在双亲委派时，会委派给 BootstrapClassLoader（C++ 实现，Java 中表示为 null）
    super(getExtURLs(dirs), null, factory);

    // 初始化查找缓存（优化性能）
    SharedSecrets.getJavaNetAccess().
        getURLClassPath(this).initLookupCache(this);
}


```

##### 将目录转换为 URL 数组

```
private static URL[] getExtURLs(File[] dirs) throws IOException {
    Vector<URL> urls = new Vector<URL>();
    for (int i = 0; i < dirs.length; i++) {
        // 列出扩展目录中的所有文件
        String[] files = dirs[i].list();
        if (files != null) {
            for (int j = 0; j < files.length; j++) {
                // 跳过 meta-index 文件
                if (!files[j].equals("meta-index")) {
                    File f = new File(dirs[i], files[j]);
                    // 将 jar 文件路径转换为 URL
                    urls.add(getFileURL(f));
                }
            }
        }
    }
    URL[] ua = new URL[urls.size()];
    urls.copyInto(ua);
    return ua;
}


```

##### 查找本地库

```
public String findLibrary(String name) {
    // 将库名转换为平台相关的名称
    // 例如：Windows -> xxx.dll, Linux -> libxxx.so
    name = System.mapLibraryName(name);
    URL[] urls = super.getURLs();
    File prevDir = null;

    for (int i = 0; i < urls.length; i++) {
        // 获取扩展目录
        File dir = new File(urls[i].getPath()).getParentFile();
        if (dir != null && !dir.equals(prevDir)) {
            // 1. 先查找架构相关的子目录（如 amd64、x86）
            String arch = VM.getSavedProperty("os.arch");
            if (arch != null) {
                File file = new File(new File(dir, arch), name);
                if (file.exists()) {
                    return file.getAbsolutePath();
                }
            }
            // 2. 再查找扩展目录本身
            File file = new File(dir, name);
            if (file.exists()) {
                return file.getAbsolutePath();
            }
        }
        prevDir = dir;
    }
    return null;
}


```

---

#### AppClassLoader - 应用程序类加载器

##### 类定义

```
static class AppClassLoader extends URLClassLoader {

    static {
        // 支持并行类加载
        ClassLoader.registerAsParallelCapable();
    }

    // URLClassPath 用于高效查找类文件
    final URLClassPath ucp;

    // ...
}


```

##### 创建 AppClassLoader

```
public static ClassLoader getAppClassLoader(final ClassLoader extcl)
    throws IOException {

    // 1. 从系统属性获取 CLASSPATH
    // 例如：/home/user/app.jar:/home/user/lib/*
    final String s = System.getProperty("java.class.path");
    final File[] path = (s == null) ? new File[0] : getClassPath(s);

    // 2. 在特权块中创建 AppClassLoader
    return AccessController.doPrivileged(
        new PrivilegedAction<AppClassLoader>() {
            public AppClassLoader run() {
                URL[] urls =
                    (s == null) ? new URL[0] : pathToURLs(path);
                // 【重点】extcl 作为父加载器传入
                return new AppClassLoader(urls, extcl);
            }
        });
}


```

##### 构造器

```
AppClassLoader(URL[] urls, ClassLoader parent) {
    // 【重点】parent 参数 = ExtClassLoader
    // 这样就建立了双亲委派的层次结构
    super(urls, parent, factory);

    // 获取并初始化 URLClassPath（用于高效查找类）
    ucp = SharedSecrets.getJavaNetAccess().getURLClassPath(this);
    ucp.initLookupCache(this);
}


```

##### 重写 loadClass - 性能优化

这是一个非常巧妙的性能优化：

```
public Class<?> loadClass(String name, boolean resolve)
    throws ClassNotFoundException {

    // 1. 安全检查（如果有 SecurityManager）
    int i = name.lastIndexOf('.');
    if (i != -1) {
        SecurityManager sm = System.getSecurityManager();
        if (sm != null) {
            // 检查包访问权限
            sm.checkPackageAccess(name.substring(0, i));
        }
    }

    // 2. 【核心优化】使用缓存判断类是否已知不存在
    if (ucp.knownToNotExist(name)) {
        // 这个类在父加载器和本地 URLClassPath 中都不存在
        // 检查是否已经被动态定义过
        Class<?> c = findLoadedClass(name);
        if (c != null) {
            if (resolve) {
                resolveClass(c);
            }
            return c;
        }
        // 直接抛出异常，避免走完整的双亲委派流程
        throw new ClassNotFoundException(name);
    }

    // 3. 正常走双亲委派流程
    return (super.loadClass(name, resolve));
}


```

**性能优化的原理：**

```
正常流程（没有优化）：
ClassNotFoundException
  ↓
委派给 ExtClassLoader
  ↓
委派给 BootstrapClassLoader
  ↓
BootstrapClassLoader 查找失败
  ↓
ExtClassLoader 查找失败
  ↓
AppClassLoader 查找失败
  ↓
抛出 ClassNotFoundException

优化后的流程：
查询 knownToNotExist 缓存
  ↓
命中缓存，已知不存在
  ↓
直接抛出 ClassNotFoundException
（跳过所有父加载器的查找过程）


```

##### 权限管理

```
protected PermissionCollection getPermissions(CodeSource codesource) {
    PermissionCollection perms = super.getPermissions(codesource);
    // 允许从 classpath 加载的所有类调用 System.exit()
    perms.add(new RuntimePermission("exitVM"));
    return perms;
}


```

##### 运行时添加类路径（Instrumentation）

```
private void appendToClassPathForInstrumentation(String path) {
    assert(Thread.holdsLock(this));

    // 将新路径添加到类路径
    // 如果路径已存在，addURL 是空操作
    // 这个方法供 java.lang.instrument.Instrumentation 使用
    super.addURL(getFileURL(new File(path)));
}


```

---

#### BootClassPathHolder - 启动类路径持有者

这是一个 **懒加载** 的静态内部类：

```
private static class BootClassPathHolder {
    static final URLClassPath bcp;

    static {
        URL[] urls;
        if (bootClassPath != null) {
            // 在特权块中处理 bootClassPath
            urls = AccessController.doPrivileged(
                new PrivilegedAction<URL[]>() {
                    public URL[] run() {
                        File[] classPath = getClassPath(bootClassPath);
                        int len = classPath.length;
                        Set<File> seenDirs = new HashSet<File>();

                        for (int i = 0; i < len; i++) {
                            File curEntry = classPath[i];
                            // 对于 jar 文件，注册其父目录
                            if (!curEntry.isDirectory()) {
                                curEntry = curEntry.getParentFile();
                            }
                            if (curEntry != null && seenDirs.add(curEntry)) {
                                // 注册目录以优化查找
                                MetaIndex.registerDirectory(curEntry);
                            }
                        }
                        return pathToURLs(classPath);
                    }
                }
            );
        } else {
            urls = new URL[0];
        }
        // 创建 URLClassPath 包装器
        bcp = new URLClassPath(urls, factory);
        bcp.initLookupCache(null);
    }
}

// 公共访问方法
public static URLClassPath getBootstrapClassPath() {
    // 第一次调用时才会初始化 BootClassPathHolder
    return BootClassPathHolder.bcp;
}


```

**懒加载的好处：**

* 只有在需要访问 BootstrapClassPath 时才初始化
* 避免不必要的资源消耗
* 线程安全（静态初始化块由 JVM 保证线程安全）

---

#### 工具方法

##### 路径转 URL 数组

```
private static URL[] pathToURLs(File[] path) {
    URL[] urls = new URL[path.length];
    for (int i = 0; i < path.length; i++) {
        urls[i] = getFileURL(path[i]);
    }
    return urls;
}


```

##### 解析类路径字符串

```
private static File[] getClassPath(String cp) {
    File[] path;
    if (cp != null) {
        int count = 0, maxCount = 1;
        int pos = 0, lastPos = 0;

        // 第一遍：统计路径分隔符的数量
        while ((pos = cp.indexOf(File.pathSeparator, lastPos)) != -1) {
            maxCount++;
            lastPos = pos + 1;
        }

        path = new File[maxCount];
        lastPos = pos = 0;

        // 第二遍：分割路径
        while ((pos = cp.indexOf(File.pathSeparator, lastPos)) != -1) {
            if (pos - lastPos > 0) {
                path[count++] = new File(cp.substring(lastPos, pos));
            } else {
                // 空路径组件转换为 "."（当前目录）
                path[count++] = new File(".");
            }
            lastPos = pos + 1;
        }

        // 处理最后一个路径组件
        if (lastPos < cp.length()) {
            path[count++] = new File(cp.substring(lastPos));
        } else {
            path[count++] = new File(".");
        }

        // 裁剪数组到实际大小
        if (count != maxCount) {
            File[] tmp = new File[count];
            System.arraycopy(path, 0, tmp, 0, count);
            path = tmp;
        }
    } else {
        path = new File[0];
    }
    return path;
}


```

##### 文件转 URL

```
static URL getFileURL(File file) {
    try {
        // 转换为规范路径（解析 . 和 .. 等）
        file = file.getCanonicalFile();
    } catch (IOException e) {}

    try {
        // 使用 ParseUtil 将文件路径编码为 URL
        // 例如：/home/user/app.jar -> file:/home/user/app.jar
        return ParseUtil.fileToEncodedURL(file);
    } catch (MalformedURLException e) {
        throw new InternalError(e);
    }
}


```

---

#### Factory - URL 协议处理器工厂

```
private static class Factory implements URLStreamHandlerFactory {
    private static String PREFIX = "sun.net.www.protocol";

    public URLStreamHandler createURLStreamHandler(String protocol) {
        // 根据协议名称构造处理器类名
        // 例如：http -> sun.net.www.protocol.http.Handler
        String name = PREFIX + "." + protocol + ".Handler";
        try {
            Class<?> c = Class.forName(name);
            return (URLStreamHandler)c.newInstance();
        } catch (ReflectiveOperationException e) {
            throw new InternalError("could not load " + protocol +
                                    " system protocol handler", e);
        }
    }
}


```

**支持的协议示例：**

* `http` → `sun.net.www.protocol.http.Handler`
* `https` → `sun.net.www.protocol.https.Handler`
* `file` → `sun.net.www.protocol.file.Handler`
* `jar` → `sun.net.www.protocol.jar.Handler`
* `ftp` → `sun.net.www.protocol.ftp.Handler`

---

#### PathPermissions - 路径权限管理

这个类用于管理类加载器的文件访问权限：

```
class PathPermissions extends PermissionCollection {
    private File path[];          // 路径数组
    private Permissions perms;    // 权限集合
    URL codeBase;                 // 代码源

    PathPermissions(File path[]) {
        this.path = path;
        this.perms = null;        // 延迟初始化
        this.codeBase = null;
    }

    private synchronized void init() {
        if (perms != null)
            return;  // 已经初始化过

        perms = new Permissions();

        // 1. 添加创建类加载器的权限
        perms.add(SecurityConstants.CREATE_CLASSLOADER_PERMISSION);

        // 2. 添加读取所有 "java.*" 系统属性的权限
        perms.add(new java.util.PropertyPermission("java.*",
            SecurityConstants.PROPERTY_READ_ACTION));

        // 3. 为每个路径添加文件读取权限
        AccessController.doPrivileged(new PrivilegedAction<Void>() {
            public Void run() {
                for (int i = 0; i < path.length; i++) {
                    File f = path[i];
                    String path;
                    try {
                        path = f.getCanonicalPath();
                    } catch (IOException ioe) {
                        path = f.getAbsolutePath();
                    }

                    if (i == 0) {
                        codeBase = Launcher.getFileURL(new File(path));
                    }

                    if (f.isDirectory()) {
                        // 目录：授予递归读取权限（-）
                        if (path.endsWith(File.separator)) {
                            perms.add(new FilePermission(path + "-",
                                SecurityConstants.FILE_READ_ACTION));
                        } else {
                            perms.add(new FilePermission(
                                path + File.separator + "-",
                                SecurityConstants.FILE_READ_ACTION));
                        }
                    } else {
                        // 文件：授予其所在目录的递归读取权限
                        int endIndex = path.lastIndexOf(File.separatorChar);
                        if (endIndex != -1) {
                            path = path.substring(0, endIndex + 1) + "-";
                            perms.add(new FilePermission(path,
                                SecurityConstants.FILE_READ_ACTION));
                        }
                    }
                }
                return null;
            }
        });
    }

    public boolean implies(java.security.Permission permission) {
        if (perms == null)
            init();  // 懒加载
        return perms.implies(permission);
    }
}


```

---

### 上下游关系图解

#### JVM 启动时的类加载器创建流程

```
┌─────────────────────────────────────────────────────────────┐
│ JVM 启动（C++ 层）                                            │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 创建 BootstrapClassLoader (C++ 实现)                         │
│ 负责加载：$JAVA_HOME/jre/lib/rt.jar 等核心类库              │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ BootstrapClassLoader 加载 sun.misc.Launcher 类               │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 执行 Launcher 的静态初始化                                   │
│   private static Launcher launcher = new Launcher();        │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ Launcher 构造函数执行                                        │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ├─────────────────────┐
                  ▼                     ▼
    ┌──────────────────────┐  ┌──────────────────────┐
    │ 步骤1: 创建           │  │ 步骤2: 创建          │
    │ ExtClassLoader       │  │ AppClassLoader       │
    │                      │  │                      │
    │ ↓ getExtClassLoader()│  │ ↓ getAppClassLoader()│
    │ ↓ getExtDirs()       │  │ ↓ getClassPath()     │
    │ ↓ 读取 java.ext.dirs │  │ ↓ 读取 java.class.path│
    │ ↓ new ExtClassLoader │  │ ↓ new AppClassLoader │
    │   parent = null      │  │   parent = extcl     │
    └──────────────────────┘  └──────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 步骤3: 设置线程上下文类加载器                                │
│   Thread.currentThread().setContextClassLoader(loader);     │
│   (loader = AppClassLoader)                                 │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 步骤4: 安装 SecurityManager（可选）                          │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 使用 AppClassLoader 加载用户主类                             │
│   loader.loadClass("com.example.Main")                      │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 执行主类的 main 方法                                         │
│   Main.main(String[] args)                                  │
└─────────────────────────────────────────────────────────────┘


```

---

#### 类加载器的层次结构

```
┌────────────────────────────────────────────────────────────────┐
│                   BootstrapClassLoader                         │
│                   (C++ 实现, Java 中表示为 null)                │
│                                                                │
│  负责加载：                                                    │
│    • $JAVA_HOME/jre/lib/rt.jar                                │
│    • $JAVA_HOME/jre/lib/resources.jar                         │
│    • $JAVA_HOME/jre/lib/charsets.jar                          │
│    • 核心 Java 类库（java.*, javax.*, sun.* 等）              │
└────────────────────────┬───────────────────────────────────────┘
                         │ 父加载器
                         ▼
┌────────────────────────────────────────────────────────────────┐
│                   ExtClassLoader                               │
│         (sun.misc.Launcher$ExtClassLoader)                     │
│                   extends URLClassLoader                       │
│                                                                │
│  负责加载：                                                    │
│    • $JAVA_HOME/jre/lib/ext/*.jar                             │
│    • java.ext.dirs 系统属性指定的目录                          │
│  示例：                                                        │
│    • /usr/lib/jvm/java-8/jre/lib/ext/cldrdata.jar            │
│    • /usr/lib/jvm/java-8/jre/lib/ext/sunec.jar               │
└────────────────────────┬───────────────────────────────────────┘
                         │ 父加载器
                         ▼
┌────────────────────────────────────────────────────────────────┐
│                   AppClassLoader                               │
│         (sun.misc.Launcher$AppClassLoader)                     │
│                   extends URLClassLoader                       │
│                                                                │
│  负责加载：                                                    │
│    • CLASSPATH 环境变量指定的路径                              │
│    • java.class.path 系统属性指定的路径                        │
│    • -cp / -classpath 命令行参数指定的路径                     │
│  示例：                                                        │
│    • /home/user/myapp.jar                                     │
│    • /home/user/lib/*                                         │
│    • /home/user/classes/                                      │
└────────────────────────┬───────────────────────────────────────┘
                         │ 父加载器
                         ▼
┌────────────────────────────────────────────────────────────────┐
│               自定义 ClassLoader                               │
│         (用户自定义, extends ClassLoader)                       │
│                                                                │
│  用途：                                                        │
│    • 加载网络资源                                              │
│    • 字节码加密/解密                                           │
│    • 热部署                                                    │
│    • OSGi 模块化                                               │
└────────────────────────────────────────────────────────────────┘


```

---

#### 双亲委派模型的类加载流程

```
用户调用：Class.forName("com.example.MyClass")
│
▼
┌─────────────────────────────────────────────────────────────┐
│ AppClassLoader.loadClass("com.example.MyClass")             │
│                                                             │
│ 1. 检查类是否已加载 (findLoadedClass)                       │
│    └─> 已加载？返回缓存的 Class 对象                        │
│                                                             │
│ 2. 委派给父加载器                                           │
│    └─> parent.loadClass("com.example.MyClass")             │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ ExtClassLoader.loadClass("com.example.MyClass")             │
│                                                             │
│ 1. 检查类是否已加载 (findLoadedClass)                       │
│    └─> 已加载？返回缓存的 Class 对象                        │
│                                                             │
│ 2. 委派给父加载器                                           │
│    └─> parent.loadClass("com.example.MyClass")             │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ BootstrapClassLoader.loadClass("com.example.MyClass")       │
│                                                             │
│ 在 $JAVA_HOME/jre/lib/ 中查找                               │
│ └─> 找不到 com.example.MyClass                             │
│ └─> 返回 null                                               │
└─────────────────────────┬───────────────────────────────────┘
                          │ 父加载器找不到
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 回到 ExtClassLoader                                         │
│                                                             │
│ 3. 父加载器加载失败，自己尝试加载                           │
│    └─> findClass("com.example.MyClass")                    │
│    └─> 在 $JAVA_HOME/jre/lib/ext/ 中查找                   │
│    └─> 找不到 com.example.MyClass                          │
│    └─> 抛出 ClassNotFoundException                         │
└─────────────────────────┬───────────────────────────────────┘
                          │ 自己也找不到
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 回到 AppClassLoader                                         │
│                                                             │
│ 3. 父加载器加载失败，自己尝试加载                           │
│    └─> findClass("com.example.MyClass")                    │
│    └─> 在 CLASSPATH 中查找                                 │
│    └─> 找到 /home/user/classes/com/example/MyClass.class   │
│    └─> 读取字节码并调用 defineClass                        │
│    └─> 返回 Class<MyClass> 对象 ✓                          │
└─────────────────────────────────────────────────────────────┘


```

---

#### Launcher 与其他关键类的协作关系

```
┌────────────────────────────────────────────────────────────┐
│                    JVM (C++ 层)                            │
└────────┬───────────────────────────────────────────────────┘
         │ 调用
         ▼
┌────────────────────────────────────────────────────────────┐
│              sun.misc.Launcher                             │
│                                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │  private static Launcher launcher = new Launcher()│    │
│  └──────────────────────────────────────────────────┘    │
│                                                            │
│  创建    ┌──────────────────────┐                         │
│  ─────>  │  ExtClassLoader      │                         │
│          │  parent = null       │                         │
│          └──────────┬───────────┘                         │
│                     │                                      │
│  创建               │ 作为父加载器                         │
│  ─────>  ┌──────────▼───────────┐                         │
│          │  AppClassLoader      │                         │
│          │  parent = extcl      │                         │
│          └──────────────────────┘                         │
└────────────────────┬───────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────┐
│           Thread (主线程)                                  │
│                                                            │
│  contextClassLoader = AppClassLoader                      │
│  (通过 Thread.currentThread().setContextClassLoader 设置) │
└────────────────────┬───────────────────────────────────────┘
                     │
                     │ 被使用
                     ▼
┌────────────────────────────────────────────────────────────┐
│           ServiceLoader (SPI 机制)                         │
│                                                            │
│  public static <S> ServiceLoader<S> load(Class<S> service)│
│  {                                                         │
│      // 获取线程上下文类加载器（AppClassLoader）          │
│      ClassLoader cl =                                     │
│          Thread.currentThread().getContextClassLoader(); │
│      return ServiceLoader.load(service, cl);              │
│  }                                                         │
└────────────────────────────────────────────────────────────┘
                     │
                     │ 实现双亲委派模型的"破坏"
                     ▼
┌────────────────────────────────────────────────────────────┐
│           DriverManager (JDBC)                             │
│                                                            │
│  static {                                                 │
│      // 在静态初始化块中使用 SPI 加载驱动                  │
│      ServiceLoader<Driver> loadedDrivers =                │
│          ServiceLoader.load(Driver.class);                │
│      // ...                                               │
│  }                                                         │
│                                                            │
│  场景说明：                                                │
│  • DriverManager 在 rt.jar 中，由 BootstrapClassLoader 加载│
│  • MySQL 驱动在 CLASSPATH 中，由 AppClassLoader 加载      │
│  • 通过线程上下文类加载器，父加载器可以访问子加载器资源    │
└────────────────────────────────────────────────────────────┘


```

---

#### 类加载过程中的关键方法调用链

```
JVM 启动
  │
  ├─> (C++) 创建 BootstrapClassLoader
  │
  ├─> (C++) 加载 sun.misc.Launcher 类
  │     └─> BootstrapClassLoader.loadClass("sun.misc.Launcher")
  │
  ├─> (Java) 执行 Launcher 静态初始化
  │     └─> private static Launcher launcher = new Launcher();
  │           │
  │           ├─> ExtClassLoader.getExtClassLoader()
  │           │     │
  │           │     ├─> getExtDirs()
  │           │     │     └─> System.getProperty("java.ext.dirs")
  │           │     │
  │           │     ├─> new ExtClassLoader(dirs)
  │           │     │     └─> super(getExtURLs(dirs), null, factory)
  │           │     │           └─> URLClassLoader 构造器
  │           │     │
  │           │     └─> 返回 ExtClassLoader 实例
  │           │
  │           ├─> AppClassLoader.getAppClassLoader(extcl)
  │           │     │
  │           │     ├─> System.getProperty("java.class.path")
  │           │     │
  │           │     ├─> getClassPath(s)
  │           │     │     └─> 解析 CLASSPATH 字符串
  │           │     │
  │           │     ├─> new AppClassLoader(urls, extcl)
  │           │     │     └─> super(urls, parent, factory)
  │           │     │           └─> URLClassLoader 构造器
  │           │     │
  │           │     └─> 返回 AppClassLoader 实例
  │           │
  │           ├─> Thread.currentThread().setContextClassLoader(loader)
  │           │     └─> 设置线程上下文类加载器为 AppClassLoader
  │           │
  │           └─> 安装 SecurityManager（可选）
  │
  ├─> (C++) 使用 AppClassLoader 加载主类
  │     └─> AppClassLoader.loadClass("com.example.Main")
  │           │
  │           ├─> 检查类是否已加载
  │           │     └─> findLoadedClass("com.example.Main")
  │           │
  │           ├─> 委派给父加载器（双亲委派）
  │           │     └─> parent.loadClass("com.example.Main")
  │           │           └─> ExtClassLoader.loadClass(...)
  │           │                 └─> parent.loadClass(...)
  │           │                       └─> BootstrapClassLoader 查找失败
  │           │                             └─> 返回 null
  │           │
  │           ├─> 父加载器加载失败，自己尝试加载
  │           │     └─> findClass("com.example.Main")
  │           │           │
  │           │           ├─> URLClassLoader.findClass(...)
  │           │           │     │
  │           │           │     ├─> ucp.getResource(...)
  │           │           │     │     └─> 在 CLASSPATH 中查找 .class 文件
  │           │           │     │
  │           │           │     └─> defineClass(...)
  │           │           │           └─> 将字节码转换为 Class 对象
  │           │           │
  │           │           └─> 返回 Class<Main> 对象
  │           │
  │           └─> 返回 Class<Main> 对象
  │
  └─> (C++) 调用主类的 main 方法
        └─> Main.main(String[] args)
              └─> 用户程序开始运行


```

---

### 核心知识点总结

#### Launcher 的五大职责

| 职责 | 说明 | 代码位置 |
| --- | --- | --- |
| **创建 ExtClassLoader** | 负责加载扩展目录的 jar 包 | `Launcher:72` |
| **创建 AppClassLoader** | 负责加载 CLASSPATH 的类 | `Launcher:81` |
| **设置上下文类加载器** | 为 SPI 机制提供支持 | `Launcher:88` |
| **管理安全管理器** | 可选的安全检查机制 | `Launcher:91-111` |
| **提供 Bootstrap ClassPath** | 通过 BootClassPathHolder 提供访问 | `Launcher:418` |

---

#### 三大类加载器对比

| 特性 | BootstrapClassLoader | ExtClassLoader | AppClassLoader |
| --- | --- | --- | --- |
| **实现语言** | C++ | Java | Java |
| **父加载器** | 无 | null (实际指向 Bootstrap) | ExtClassLoader |
| **加载路径** | `$JAVA_HOME/jre/lib` | `$JAVA_HOME/jre/lib/ext` | CLASSPATH |
| **系统属性** | `sun.boot.class.path` | `java.ext.dirs` | `java.class.path` |
| **典型加载类** | `java.lang.String` | `javax.crypto.*` | 用户应用类 |
| **Java 表示** | null | Launcher$ExtClassLoader | Launcher$AppClassLoader |

---

#### 5.3 关键设计模式

1. **单例模式**

   ```
   private static Launcher launcher = new Launcher();


   ```
2. **工厂模式**

   ```
   private static URLStreamHandlerFactory factory = new Factory();


   ```
3. **懒加载模式**

   ```
   private static class BootClassPathHolder {
       static final URLClassPath bcp;
       // 只在第一次调用时初始化
   }


   ```
4. **双亲委派模式**

   ```
   // URLClassLoader.loadClass 的默认实现
   protected Class<?> loadClass(String name, boolean resolve) {
       // 1. 检查缓存
       Class<?> c = findLoadedClass(name);
       if (c == null) {
           // 2. 委派给父加载器
           if (parent != null) {
               c = parent.loadClass(name, false);
           }
           // 3. 父加载器加载失败，自己尝试
           if (c == null) {
               c = findClass(name);
           }
       }
       return c;
   }


   ```

---

#### 线程上下文类加载器的作用

**问题场景：**

```
BootstrapClassLoader (加载 java.sql.Driver 接口)
         ↓ 需要加载
AppClassLoader (加载 com.mysql.cj.jdbc.Driver 实现类)


```

**矛盾：** 父类加载器无法访问子类加载器加载的类（违反双亲委派）

**解决方案：** 线程上下文类加载器

```
// Launcher.java:88
Thread.currentThread().setContextClassLoader(loader);

// ServiceLoader.java:460
ClassLoader cl = Thread.currentThread().getContextClassLoader();


```

这样，BootstrapClassLoader 加载的 `DriverManager` 类就可以通过线程上下文类加载器（AppClassLoader）来加载 JDBC 驱动实现类。

---

#### 性能优化技巧

##### knownToNotExist 缓存

```
// AppClassLoader.java:317
if (ucp.knownToNotExist(name)) {
    // 跳过双亲委派流程，直接抛出异常
    throw new ClassNotFoundException(name);
}


```

**优化效果：**

* 避免重复的父加载器查找
* 减少文件系统 I/O 操作
* 对于已知不存在的类，立即失败

##### MetaIndex 目录索引

```
// ExtClassLoader.java:148
MetaIndex.registerDirectory(dirs[i]);


```

**优化效果：**

* 预先建立目录索引
* 快速判断类是否存在于某个 jar 包
* 避免不必要的 jar 文件扫描

##### 并行类加载

```
static {
    ClassLoader.registerAsParallelCapable();
}


```

**优化效果：**

* 允许多线程同时加载不同的类
* 提高多核 CPU 利用率
* 减少类加载时的锁竞争

---

### 实际应用场景

#### JDBC 驱动加载（SPI 机制）

```
// DriverManager.java (由 BootstrapClassLoader 加载)
static {
    loadInitialDrivers();
}

private static void loadInitialDrivers() {
    // 使用 SPI 加载驱动
    // 这里会用到线程上下文类加载器（AppClassLoader）
    ServiceLoader<Driver> loadedDrivers = ServiceLoader.load(Driver.class);
    for (Driver driver : loadedDrivers) {
        // 加载 com.mysql.cj.jdbc.Driver 等实现类
    }
}


```

**调用链：**

```
BootstrapClassLoader (加载 DriverManager)
  └─> ServiceLoader.load(Driver.class)
        └─> Thread.currentThread().getContextClassLoader()
              └─> 返回 AppClassLoader
                    └─> 加载 MySQL Driver (在 CLASSPATH 中)


```

---

#### Tomcat 类加载器（自定义类加载器）

Tomcat 为每个 Web 应用创建独立的类加载器：

```
BootstrapClassLoader
  ↑
ExtClassLoader
  ↑
AppClassLoader
  ↑
Common ClassLoader (Tomcat 公共类)
  ↑
WebApp ClassLoader1 (应用1) | WebApp ClassLoader2 (应用2)


```

**打破双亲委派的原因：**

* 每个 Web 应用隔离（可以有不同版本的库）
* 热部署（重新加载某个应用而不影响其他应用）

---

### 总结

`sun.misc.Launcher` 是 Java 类加载体系的**核心**，它的主要价值在于：

#### 核心价值

1. **建立类加载器层次结构**

   * 创建 ExtClassLoader 和 AppClassLoader
   * 实现双亲委派模型
2. **为 SPI 机制提供支持**

   * 设置线程上下文类加载器
   * 允许父类加载器访问子类加载器资源
3. **优化类加载性能**

   * MetaIndex 索引机制
   * knownToNotExist 缓存
   * 并行类加载支持
4. **安全机制**

   * SecurityManager 管理
   * 权限控制（PathPermissions）
