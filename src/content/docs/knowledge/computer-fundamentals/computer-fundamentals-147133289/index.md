---
title: "HTTP 协议-应用层"
description: "HTTP（HyperText Transfer Protocol）是互联网的核心应用层协议，主要用于浏览器与服务器之间的数据传输。HTTP 协议建立在 TCP/IP 协议之上，采用请求响应模式实现通信。"
sourceId: "147133289"
source: "https://blog.csdn.net/qq_45852626/article/details/147133289"
sourceSeries: []
category: computer-fundamentals
tags:
  - "TCP/IP"
status: draft
difficulty: intermediate
contentType: knowledge
sidebar:
  order: 147133289
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/147133289)（历史文章导入，当前状态为草稿）

## 一、HTTP 协议基础

### 1.1 HTTP 简介

**HTTP**（HyperText Transfer Protocol）是互联网的核心应用层协议，主要用于浏览器与服务器之间的数据传输。HTTP 协议建立在 TCP/IP 协议之上，采用请求-响应模式实现通信。

> **示例**：当你在浏览器中输入 `https://www.example.com` 并按下回车时，浏览器会向服务器发送一个 HTTP 请求，并接收服务器返回的网页内容。

### 1.2 HTTP 的核心特性

* **无状态性（Stateless）**  
   每个请求都是独立的，服务器不会自动保存请求之间的状态。虽然这使得服务器扩展性更高，但实际开发中常借助 Cookie、Session 或 JWT 等手段实现“伪有状态”。
* **明文传输**  
   HTTP 协议采用明文方式传递数据，便于调试，但在安全性要求高的场景中需使用 HTTPS 进行加密。
* **无连接（短连接）**  
   HTTP/1.0 默认每个请求使用一次 TCP 连接；而 HTTP/1.1 引入长连接（keep-alive）以复用 TCP 连接，提升效率。
* **可扩展性强**  
   通过自定义 Header，HTTP 能灵活支持缓存控制、认证、内容协商等功能。
* **跨平台与跨语言**  
   无论后端使用 Java、Python、Go 还是其他语言，都能够很好地支持 HTTP 协议。

---

## 二、HTTP 报文结构

HTTP 报文由请求报文和响应报文构成，均遵循固定的文本或二进制格式（HTTP/2 及以上版本）。

### 2.1 请求报文

请求报文结构通常包含以下部分：

1. **请求行**：包括请求方法、请求 URL 和 HTTP 版本  
    例如：`GET /index.html HTTP/1.1`
2. **请求头部**：一组键值对，描述客户端环境、内容格式等  
    例如：`User-Agent: Java-HttpClient`
3. **空行**：标识头部与请求体之间的分隔
4. **请求体**（可选）：POST、PUT 请求中传递的数据，如 JSON、表单数据等

#### 示例：GET 请求

```
GET /api/users HTTP/1.1
Host: example.com
User-Agent: Java-HttpClient
Accept: application/json


```

#### 示例：POST 请求

```
POST /api/login HTTP/1.1
Host: example.com
Content-Type: application/json
Content-Length: 50

{"username": "jack", "password": "123456"}


```

### 2.2 响应报文

响应报文由下列部分构成：

1. **状态行**：包括 HTTP 版本、状态码及简短描述  
    如：`HTTP/1.1 200 OK`
2. **响应头部**：传输服务器信息、数据类型、缓存控制等  
    例如：`Content-Type: application/json`
3. **空行**：分隔响应头与响应体
4. **响应体**：返回的具体数据，可以是 HTML、JSON 或文件内容

#### 示例

```
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 27

{"status": "success"}


```

### 2.3 分隔规则

* 每行终止符为 `\r\n`
* 请求或响应头部与正文间由两个连续的 `\r\n` 分隔

> **提示**：HTTP/2 开始采用二进制帧，虽然逻辑结构不变，但不再使用纯文本格式，从而提升传输效率。

---

## 三、HTTP 方法详解

HTTP 方法表达客户端对资源的操作意图，常用方法及特点如下：

| 方法 | 说明 | 幂等性 | 安全性 |
| --- | --- | --- | --- |
| GET | 读取资源 | 幂等、安全 | 是 |
| POST | 提交数据、创建资源 | 非幂等 | 否 |
| PUT | 完全替换/更新资源 | 幂等 | 否 |
| PATCH | 局部更新资源 | 非幂等 | 否 |
| DELETE | 删除资源 | 幂等 | 否 |
| HEAD | 获取头信息（不返回内容） | 幂等、安全 | 是 |
| OPTIONS | 获取服务器支持的方法 | 安全 | 是 |

> **注意**：理论上 GET 方法应为安全（无副作用）且幂等，但开发时若错误地在 GET 中包含数据修改逻辑，则会违背这一原则。

### 3.1 Java 示例

#### GET 请求示例

```
// 使用 HttpURLConnection 实现 GET 请求
HttpURLConnection conn = (HttpURLConnection) new URL("https://api.example.com/user?id=123").openConnection();
conn.setRequestMethod("GET");
// 读取响应...


```

#### POST 请求示例

```
// 使用 HttpURLConnection 实现 POST 请求
HttpURLConnection conn = (HttpURLConnection) new URL("https://api.example.com/login").openConnection();
conn.setRequestMethod("POST");
conn.setDoOutput(true); // 允许写入数据
conn.setRequestProperty("Content-Type", "application/json");

// 写入请求体数据
OutputStream os = conn.getOutputStream();
os.write("{\"username\":\"jack\",\"password\":\"123456\"}".getBytes());
os.close();

// 读取响应...


```

---

## 四、HTTP 状态码解析

状态码用于描述服务器处理请求的结果，分为五类：

### 4.1 状态码分类

* **1xx（信息类）**

  + `100 Continue`：初步请求成功，客户端继续发送请求体
* **2xx（成功类）**

  + `200 OK`：请求成功 - `201 Created`：新资源创建成功 - `204 No Content`：请求成功但无内容返回
* **3xx（重定向类）**

  + `301 Moved Permanently`：永久重定向 - `302 Found`：临时重定向 - `307 Temporary Redirect` / `308 Permanent Redirect`：保持原请求方法的重定向
* **4xx（客户端错误）**

  + `400 Bad Request`：请求参数错误 - `401 Unauthorized`：未认证 - `403 Forbidden`：禁止访问 - `404 Not Found`：资源不存在
* **5xx（服务器错误）**

  + `500 Internal Server Error`：服务器内部错误 - `502 Bad Gateway`：网关错误（如反向代理无法获取后端响应） - `503 Service Unavailable`：服务不可用 - `504 Gateway Timeout`：服务器响应超时

### 4.2 常见问题场景

#### 502 Bad Gateway

* 后端服务异常或挂掉
* 代理配置错误（如 HTTP 与 HTTPS 混用）
* 后端返回非法数据格式

#### 504 Gateway Timeout

* 后端处理数据耗时过长
* 代理服务器超时设置不匹配
* 数据库或其他依赖资源响应延迟

---

## 五、HTTP 连接与会话管理

### 5.1 长连接 vs 短连接

* **短连接**（HTTP/1.0）：每次请求均建立新连接，建连成本较高。
* **长连接**（HTTP/1.1+）：通过 `Connection: keep-alive` 复用同一个 TCP 连接，减少握手和慢启动开销。

#### Java 中启用长连接示例

```
conn.setRequestProperty("Connection", "keep-alive");


```

### 5.2 会话状态管理

尽管 HTTP 是无状态协议，但实际应用中需要保持用户状态，常用策略包括：

* **Cookie + Session**  
   服务器生成一个唯一标识（sessionId），存入 Cookie，并在服务端保存与之对应的用户状态。

  ```
  Cookie cookie = new Cookie("sessionId", "xyz123");
  cookie.setHttpOnly(true);
  cookie.setMaxAge(3600); // 一小时后过期
  response.addCookie(cookie);


  + 1
  + 2
  + 3
  + 4
  ```
* **JWT（JSON Web Token）**  
   将用户状态信息封装在令牌中，自包含并通过签名校验，无需集中存储，适合分布式系统。
* **Sticky Session**  
   让负载均衡器固定用户请求到同一台服务器，缺点在于容错性较差。

---

## 六、HTTP 各版本对比

### 6.1 HTTP/1.0 vs HTTP/1.1

* **HTTP/1.0**：默认短连接，每次请求均建立新连接。简单但效率低。
* **HTTP/1.1**：默认采用长连接，通过 `Host` 头支持虚拟主机，增加了分块传输和断点续传支持。

### 6.2 HTTP/1.1 vs HTTP/2

* HTTP/2 使用二进制协议代替文本协议，支持多路复用、头部压缩（HPACK）和服务端推送，提升性能和效率。

### 6.3 HTTP/2 vs HTTP/3

* **HTTP/3** 基于 QUIC 协议（使用 UDP），大幅减少队头阻塞问题，并支持 0-RTT 握手，进一步提升连接建立速度和移动网络稳定性。

| 特性 | HTTP/1.1 | HTTP/2 | HTTP/3 |
| --- | --- | --- | --- |
| 连接类型 | 长连接（TCP） | 长连接，多路复用（TCP） | 多路复用（UDP, QUIC） |
| 报文格式 | 文本 | 二进制帧 | 二进制帧 |
| 头部压缩 | 无 | HPACK | QPACK |
| 队头阻塞 | 存在 | 解决应用层队头阻塞 | 完全消除 |
| 握手延时 | 3 次 TCP 握手 | 3 次 TCP 握手 + TLS 握手 | 1 RTT（或 0 RTT） |

> **提示**：各版本的选择需结合实际应用场景，目前主流 Web 应用大多已采用 HTTP/1.1，HTTP/2 和 HTTP/3 在高并发、大流量环境中更为有效。

---

## 七、HTTPS 安全协议详解

### 7.1 什么是 HTTPS？

**HTTPS**（HTTP Secure）是在 HTTP 协议上加入 SSL/TLS 加密层，用以保护数据传输的安全性。它保障数据在传输过程中不被窃听、篡改或伪造，并提供服务器身份验证机制。

### 7.2 HTTP 与 HTTPS 的区别

| 特性 | HTTP | HTTPS |
| --- | --- | --- |
| 默认端口 | 80 | 443 |
| 传输方式 | 明文传输 | 加密传输 |
| 安全性 | 易受中间人攻击 | 防止窃听、篡改 |
| 性能 | 略快 | 初次握手略慢（但后续数据传输快） |
| 证书 | 不需要证书 | 需要 CA 签发的 SSL/TLS 证书 |

### 7.3 HTTPS 的加密算法

HTTPS 采用混合加密算法，包括：

* **对称加密**  
   例：AES，用于数据加解密，性能高。
* **非对称加密**  
   例：RSA、ECDHE，用于密钥交换和身份认证。虽速度较慢，但确保安全性。
* **哈希算法**  
   例：SHA-256，用于校验数据完整性。

这种组合既保证了传输性能，又能提供强大的安全防护。

### 7.4 HTTPS 建立过程（TLS 握手简化版）

1. **客户端发起**：发送 Client Hello，包含支持的加密算法及随机数。
2. **服务端响应**：返回 Server Hello、数字证书以及协商的加密参数。
3. **证书验证**：客户端验证服务端证书合法性（通过内置 CA 公钥）。
4. **密钥交换**：客户端生成随机密钥，用服务端公钥加密后发送，服务端用私钥解密；或采用 ECDHE 等算法共同生成共享密钥。
5. **完成握手**：双方使用协商出的对称密钥开始安全数据传输。

### 7.5 HTTPS 加密机制示意

```
客户端                   服务端
  |   Client Hello（随机数、加密算法列表）   |
  |------------------------------------------->|
  |                Server Hello、证书        |
  |<-------------------------------------------|
  |  验证证书，通过后生成随机密钥，用公钥加密   |
  |   并发送 Client Key Exchange 消息         |
  |------------------------------------------->|
  |       服务端用私钥解密，生成共享对称密钥      |
  |   Finished（加密握手完成消息）             |
  |<-------------------------------------------|
  |          双方使用对称加密传输数据          |


```

### 7.6 证书验证原理

* **签发与校验**：证书由权威 CA 签发，内含服务器公钥与身份信息。客户端使用内置 CA 公钥验证证书真实性。
* **有效期与撤销检查**：证书包含有效期信息，必要时检查是否被吊销。
* **信任链验证**：通过信任链确保最终证书可信。

> Java 中可通过 `HttpsURLConnection` 与 `SSLContext` 自定义信任管理器处理证书验证。

---

## 八、HTTP 缓存机制

缓存是提升 Web 性能的重要手段，通过减少不必要的数据传输降低服务器压力。

### 8.1 缓存的作用

* **减少带宽消耗**：避免重复下载相同资源。
* **加速页面加载**：直接使用本地缓存内容。
* **减轻服务器压力**：降低服务器响应请求次数。

### 8.2 缓存类型

#### 强缓存

浏览器在一定时间内直接使用本地缓存，不发送请求给服务器。  
 设置方法如：

* `Cache-Control: max-age=3600`（缓存 1 小时）
* `Expires: Thu, 01 May 2025 08:00:00 GMT`

#### 协商缓存

浏览器发送请求后带上缓存验证信息，如 `If-Modified-Since` 或 `If-None-Match`；服务器判断资源是否修改：

* 未变更：返回 `304 Not Modified`，继续使用缓存。
* 已变更：返回最新内容。

### 8.3 Java 设置缓存示例

```
response.setHeader("Cache-Control", "max-age=3600");
response.setDateHeader("Expires", System.currentTimeMillis() + 3600000);


```

### 8.4 常见缓存策略

| 场景 | 推荐策略 |
| --- | --- |
| 静态资源（JS、CSS） | 强缓存 + 长过期时间 |
| 接口数据 | 协商缓存 + ETag/Last-Modified |
| 高频更新数据 | 不缓存或设置短缓存 |

---

## 九、源码实践：Node.js 发起 HTTP 请求示例

以下示例展示如何使用 Node.js 发起 HTTP 请求，供参考与对比。

```
const http = require('http');

function getRequest(options, callback) {
  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      callback(null, data);
    });
  });

  req.on('error', (e) => {
    callback(e);
  });

  req.end();
}

// 调用示例
getRequest({
  hostname: 'example.com',
  path: '/',
  method: 'GET'
}, (err, data) => {
  if (err) console.error(err);
  else console.log(data);
});


```

> **说明**：可参考 HttpURLConnection、Apache HttpClient 或 OkHttp 实现类似功能。
