---
title: "计算机网络-TCP协议详解"
description: "传输控制协议（Transmission Control Protocol，TCP）是互联网协议族中最核心的协议之一，由Vint Cerf和Bob Kahn在1974年设计并于1981年在RFC 793中正式定义。TCP是一种面向连接的、可靠的、基于字节流的传输层通信协议，为应用程序提供了可靠的..."
sourceId: "147141866"
source: "https://blog.csdn.net/qq_45852626/article/details/147141866"
sourceSeries:
  - "计算机网络"
category: computer-fundamentals
tags:
  - "计算机网络"
  - "TCP/IP"
status: draft
difficulty: intermediate
contentType: knowledge
sidebar:
  order: 147141866
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/147141866)（历史文章导入，当前状态为草稿）

## 2. TCP协议详解

### 2.1 TCP协议概述

传输控制协议（Transmission Control Protocol，TCP）是互联网协议族中最核心的协议之一，由Vint Cerf和Bob Kahn在1974年设计并于1981年在RFC 793中正式定义。TCP是一种面向连接的、可靠的、基于字节流的传输层通信协议，为应用程序提供了可靠的数据传输服务，确保数据能够无错、按序地从源主机传输到目标主机。

#### 2.1.1 TCP的历史背景

TCP的诞生源于美国国防部高级研究计划局（DARPA）对可靠军事通信网络的需求。在早期的ARPANET中，网络通信主要依赖于网络控制协议（NCP），但随着网络规模的扩大和异构网络的出现，需要一种更加健壮和灵活的协议来处理复杂的网络环境。

1973年，Vint Cerf和Bob Kahn开始设计一种能够在不同网络之间传输数据的协议，这就是TCP/IP的前身。最初，TCP和IP是一个统一的协议，后来为了模块化和灵活性，在1978年被分离为两个独立的协议。

1981年，TCP协议在RFC 793中被正式定义，并逐渐成为互联网的核心协议。随着互联网的发展，TCP也经历了多次改进和优化，如拥塞控制算法的引入（1988年）、选择性确认（SACK）的支持（1996年）等。

#### 2.1.2 TCP的设计目标

TCP的设计目标主要包括：

1. **可靠传输**：确保数据能够无错、完整地从源主机传输到目标主机，即使底层网络不可靠。
2. **有序交付**：确保数据按照发送顺序交付给接收方，即使底层网络可能导致数据包乱序到达。
3. **流量控制**：防止发送方发送数据的速率超过接收方处理能力，避免接收方缓冲区溢出。
4. **拥塞控制**：防止过多数据注入到网络中，导致网络拥塞和性能下降。
5. **面向连接**：在数据传输前建立连接，确保双方都准备好进行通信，并在传输完成后正常关闭连接。
6. **全双工通信**：支持数据在两个方向上同时传输，提高通信效率。
7. **可靠性与效率的平衡**：在提供可靠传输的同时，尽量减少额外开销，提高网络利用率。

#### 2.1.3 TCP的基本特性

TCP具有以下基本特性：

1. **面向连接**：TCP在传输数据前需要先建立连接（三次握手），传输完成后需要释放连接（四次挥手）。
2. **可靠传输**：TCP通过确认、重传、校验和等机制确保数据的可靠传输。
3. **面向字节流**：TCP将应用层交付的数据视为无结构的字节流，不保留应用层的消息边界。
4. **流量控制**：TCP使用滑动窗口机制进行流量控制，防止发送方发送速率过快导致接收方缓冲区溢出。
5. **拥塞控制**：TCP通过慢启动、拥塞避免、快速重传和快速恢复等算法进行拥塞控制，适应网络状况。
6. **全双工通信**：TCP连接的两端都可以同时发送和接收数据。
7. **面向报文段**：TCP将字节流分割成报文段进行传输，每个报文段都有序列号，用于重组和确认。

#### 2.1.4 TCP与其他传输协议的比较

与其他传输协议相比，TCP有其独特的优势和局限性：

**与UDP的比较**：

* TCP提供可靠传输，UDP不保证可靠性
* TCP面向连接，UDP无连接
* TCP有流量控制和拥塞控制，UDP没有
* TCP开销较大，UDP开销小
* TCP适用于对可靠性要求高的应用，UDP适用于对实时性要求高的应用

**与SCTP的比较**：

* SCTP支持多流和多宿主，TCP不支持
* SCTP提供消息边界保护，TCP是纯字节流
* SCTP有内置的心跳机制，TCP需要通过keepalive选项实现
* SCTP防止SYN洪泛攻击，TCP较易受此类攻击

**与QUIC的比较**：

* QUIC基于UDP构建，减少了连接建立的延迟
* QUIC支持连接迁移，TCP不支持
* QUIC在应用层实现拥塞控制，可以更灵活地定制
* QUIC集成了TLS加密，提供更好的安全性
* QUIC解决了TCP的队头阻塞问题

#### 2.1.5 TCP的应用场景

TCP广泛应用于各种需要可靠数据传输的场景，主要包括：

1. **Web浏览**：HTTP/HTTPS协议通常基于TCP，确保网页内容的完整传输。
2. **电子邮件**：SMTP、POP3、IMAP等电子邮件协议使用TCP，确保邮件内容不丢失。
3. **文件传输**：FTP、SFTP等文件传输协议使用TCP，确保文件的完整性。
4. **远程登录**：SSH、Telnet等远程登录协议使用TCP，确保命令和响应的可靠传输。
5. **数据库访问**：大多数数据库客户端与服务器之间的通信使用TCP，确保数据的一致性。
6. **流媒体传输**：某些流媒体应用使用TCP，特别是在带宽充足且对可靠性要求高的场景。
7. **即时通讯**：许多即时通讯应用使用TCP，确保消息的可靠传递。

TCP的这些特性和应用场景使其成为互联网的基石，支撑着各种各样的网络应用和服务。

### 2.2 TCP头部结构

TCP头部是TCP协议的核心组成部分，包含了控制信息和元数据，用于实现TCP的各种功能。理解TCP头部结构对于深入理解TCP协议的工作原理至关重要。

#### 2.2.1 TCP头部格式

TCP头部的标准长度为20字节（不包含选项），最大可达60字节（包含选项）。下面是TCP头部的详细结构：

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|          源端口号              |         目的端口号             |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                        序列号 (Sequence Number)                |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                    确认号 (Acknowledgment Number)              |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|  数据偏移 |  保留  |U|A|P|R|S|F|        窗口大小 (Window)       |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|           校验和 (Checksum)    |       紧急指针 (Urgent Pointer)|
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                    选项 (Options) [可变长度]                   |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                              数据                              |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+


```

在Linux内核中，TCP头部结构定义如下：

```
// file: include/uapi/linux/tcp.h
struct tcphdr {
    __u16   source;     // 源端口
    __u16   dest;       // 目的端口
    __u32   seq;        // 序列号
    __u32   ack_seq;    // 确认号
    __u16   doff:4,     // 数据偏移（头部长度）
            res1:4,     // 保留
            cwr:1,      // 拥塞窗口减少标志
            ece:1,      // ECN回显标志
            urg:1,      // 紧急标志
            ack:1,      // 确认标志
            psh:1,      // 推送标志
            rst:1,      // 复位标志
            syn:1,      // 同步标志
            fin:1;      // 结束标志
    __u16   window;     // 窗口大小
    __sum16 check;      // 校验和
    __u16   urg_ptr;    // 紧急指针
};


```

#### 2.2.2 TCP头部字段详解

下面详细解释TCP头部的各个字段：

##### 源端口号和目的端口号（各16位）

* **源端口号**：发送方的端口号，用于标识发送数据的应用程序。
* **目的端口号**：接收方的端口号，用于标识接收数据的应用程序。

这两个字段共同构成了传输层的寻址机制，使得数据能够准确地交付给正确的应用程序。

##### 序列号（32位）

序列号用于标识从TCP发送端向TCP接收端发送的数据字节流的第一个字节的编号。在建立连接时，通过SYN包交换随机的初始序列号（ISN）。

序列号的主要作用是：

* 确保数据按顺序交付
* 检测丢失的数据
* 去除重复的数据
* 支持TCP的可靠传输机制

##### 确认号（32位）

确认号表示接收方期望从发送方收到的下一个字节的序列号。换句话说，确认号等于已成功接收的数据的最高序列号加1。

确认号的主要作用是：

* 告知发送方已成功接收的数据
* 触发发送方重传丢失的数据
* 支持TCP的可靠传输机制

##### 数据偏移（4位）

数据偏移字段指示TCP头部的长度，以32位（4字节）为单位。由于TCP头部可能包含可变长度的选项，因此需要这个字段来指示数据的起始位置。

数据偏移的最小值为5（表示20字节的标准头部），最大值为15（表示60字节的头部，包含40字节的选项）。

##### 保留字段（4位）

这些位保留供将来使用，目前应该设置为0。

##### 控制位（6位）

TCP头部包含6个标志位，用于控制TCP连接的状态和行为：

* **URG（Urgent）**：表示紧急指针字段有效，用于标识紧急数据。
* **ACK（Acknowledgment）**：表示确认号字段有效，几乎在所有已建立连接的数据包中都会设置。
* **PSH（Push）**：表示应该立即将数据推送给应用程序，而不是等待缓冲区填满。
* **RST（Reset）**：表示应该立即重置连接，通常用于处理异常情况。
* **SYN（Synchronize）**：表示请求建立连接，用于三次握手的第一步和第二步。
* **FIN（Finish）**：表示发送方已经没有数据要发送了，用于四次挥手。

此外，还有两个与显式拥塞通知（ECN）相关的标志位：

* **CWR（Congestion Window Reduced）**：表示发送方已经收到了设置了ECE标志的TCP段，并已经响应了拥塞通知。
* **ECE（ECN-Echo）**：在建立连接时表示支持ECN；在已建立连接时表示网络中存在拥塞。

##### 窗口大小（16位）

窗口大小字段指示发送方当前可以接收的数据量，以字节为单位。它是TCP流量控制的关键机制，用于防止发送方发送过多数据导致接收方缓冲区溢出。

由于16位字段的限制，标准窗口大小最大为65535字节。为了支持更大的窗口，TCP引入了窗口缩放选项，允许将窗口大小乘以一个缩放因子（最大为14），从而支持最大约1GB的窗口。

##### 校验和（16位）

校验和字段用于检测TCP头部和数据在传输过程中是否被损坏。它是对TCP头部、数据以及一个伪头部（包含源IP地址、目的IP地址、协议号和TCP长度）进行计算得出的。

校验和的计算方法是：将所有16位字进行反码求和，然后取反码。接收方使用相同的算法计算校验和，如果结果为0，则认为数据完整；否则，认为数据已损坏，将丢弃该段。

##### 紧急指针（16位）

当URG标志位设置时，紧急指针字段有效，它指示紧急数据的末尾相对于当前序列号的偏移量。紧急数据应该优先处理，不受流量控制的限制。

紧急指针机制在现代网络中使用较少，但它提供了一种在正常数据流之外传输紧急信息的方法。

##### 选项（可变长度）

TCP头部可以包含多种选项，用于扩展TCP的功能。常见的选项包括：

* **最大段大小（MSS）**：指示发送方愿意接收的最大段大小，通常在SYN包中设置。
* **窗口缩放**：允许将窗口大小乘以一个缩放因子，支持更大的窗口。
* **选择性确认（SACK）**：允许接收方确认非连续的数据块，提高重传效率。
* **时间戳**：用于计算更准确的往返时间（RTT）和防止序列号回绕问题。
* **TCP快速打开（TFO）**：允许在三次握手期间发送数据，减少连接建立的延迟。

选项的格式通常为：选项类型（1字节）、选项长度（1字节，对于某些选项可能省略）和选项数据（可变长度）。

#### 2.2.3 TCP头部在Linux内核中的实现

在Linux内核中，TCP头部的处理涉及多个函数和数据结构。以下是一些关键的实现细节：

##### TCP头部的构建

当发送TCP段时，内核需要构建TCP头部。这通常在`tcp_transmit_skb`函数中完成：

```
// 简化版的TCP头部构建过程
static int tcp_transmit_skb(struct sock *sk, struct sk_buff *skb, int clone_it,
                           gfp_t gfp_mask)
{
    // ...
    th = tcp_hdr(skb);
    th->source = inet->inet_sport;
    th->dest = inet->inet_dport;
    th->seq = htonl(tcb->seq);
    th->ack_seq = htonl(tp->rcv_nxt);
    *(((__u16 *)th) + 6) = htons(((tp->tcp_header_len >> 2) << 12) |
                                 tcb->tcp_flags);
    // ...
    // 设置窗口大小
    if (likely(!tp->rx_opt.wscale_ok)) {
        th->window = htons(min(tp->rcv_wnd, 65535U));
    } else {
        th->window = htons(min(tp->rcv_wnd >> tp->rx_opt.rcv_wscale, 65535U));
    }
    // ...
    // 计算校验和
    if (likely(skb->ip_summed == CHECKSUM_PARTIAL)) {
        th->check = ~tcp_v4_check(skb->len, saddr, daddr, 0);
        skb->csum_start = skb_transport_header(skb) - skb->head;
        skb->csum_offset = offsetof(struct tcphdr, check);
    } else {
        th->check = tcp_v4_check(skb->len, saddr, daddr,
                                csum_partial(th, thlen, skb->csum));
    }
    // ...
}


```

##### TCP头部的解析

当接收TCP段时，内核需要解析TCP头部。这通常在`tcp_v4_rcv`或类似函数中完成：

```
// 简化版的TCP头部解析过程
int tcp_v4_rcv(struct sk_buff *skb)
{
    // ...
    th = tcp_hdr(skb);
    
    // 检查校验和
    if (!pskb_may_pull(skb, sizeof(struct tcphdr)) ||
        (skb_checksum_complete(skb))) {
        goto discard_it;
    }
    
    // 解析TCP头部字段
    source = th->source;
    dest = th->dest;
    seq = ntohl(th->seq);
    ack_seq = ntohl(th->ack_seq);
    // ...
    
    // 根据TCP状态和头部字段进行处理
    // ...
}


```

##### TCP选项的处理

TCP选项的处理相对复杂，通常在`tcp_parse_options`函数中完成：

```
// 简化版的TCP选项解析过程
void tcp_parse_options(struct sk_buff *skb, struct tcp_options_received *opt_rx,
                      int estab, struct tcp_fastopen_cookie *foc)
{
    // ...
    ptr = (unsigned char *)(th + 1);
    
    while (ptr < end) {
        switch (*ptr) {
        case TCPOPT_EOL:
            // 选项列表结束
            return;
        case TCPOPT_NOP:
            // 无操作，用于填充
            ptr++;
            continue;
        case TCPOPT_MSS:
            // 最大段大小选项
            // ...
            break;
        case TCPOPT_WINDOW:
            // 窗口缩放选项
            // ...
            break;
        case TCPOPT_TIMESTAMP:
            // 时间戳选项
            // ...
            break;
        case TCPOPT_SACK_PERM:
            // 选择性确认许可选项
            // ...
            break;
        // 其他选项的处理
        // ...
        }
        // 移动到下一个选项
        ptr += optlen;
    }
}


```

#### 2.2.4 TCP头部的实际应用

理解TCP头部结构对于网络编程、协议分析和故障排除都非常重要。以下是一些实际应用场景：

##### 网络编程

在使用套接字API进行网络编程时，虽然TCP头部的细节通常由操作系统处理，但了解TCP头部结构有助于理解TCP的行为和优化应用程序的网络性能。例如：

* 设置适当的套接字选项（如TCP\_NODELAY、TCP\_CORK等）
* 理解和处理TCP连接的建立和关闭
* 优化应用层协议的设计，考虑TCP的特性

##### 协议分析

使用Wireshark等网络分析工具时，了解TCP头部结构有助于解读捕获的数据包，分析网络通信过程：

* 跟踪TCP连接的建立和关闭
* 分析TCP的流量控制和拥塞控制行为
* 诊断网络性能问题，如重传、延迟等

##### 故障排除

在排查网络问题时，了解TCP头部结构有助于定位和解决问题：

* 识别连接建立失败的原因（如SYN包丢失）
* 分析数据传输中断的原因（如RST包）
* 诊断性能下降的原因（如窗口大小减小、频繁重传等）

TCP头部结构看似简单，但其设计精巧，每个字段都有其特定的用途，共同支撑了TCP的各种功能。深入理解TCP头部结构是掌握TCP协议的基础。

### 2.3 TCP三次握手

TCP三次握手（Three-Way Handshake）是TCP连接建立过程中的关键机制，它确保了通信双方都具备发送和接收数据的能力，并协商了初始序列号等连接参数。三次握手的过程精确而高效，是TCP可靠连接的基础。

#### 2.3.1 三次握手的基本过程

TCP三次握手的基本过程如下：

1. **第一次握手（SYN）**：客户端发送一个SYN（同步）包，其中包含随机生成的初始序列号（ISN\_c），并将连接状态设置为SYN\_SENT。
2. **第二次握手（SYN+ACK）**：服务器收到SYN包后，回复一个SYN+ACK（同步+确认）包，其中包含服务器生成的初始序列号（ISN\_s）和对客户端序列号的确认（ACK=ISN\_c+1），并将连接状态设置为SYN\_RCVD。
3. **第三次握手（ACK）**：客户端收到SYN+ACK包后，发送一个ACK（确认）包，确认服务器的序列号（ACK=ISN\_s+1），并将连接状态设置为ESTABLISHED。服务器收到ACK包后，也将连接状态设置为ESTABLISHED。

这个过程可以用下图表示：

```
    客户端                                  服务器
      |                                      |
      |               SYN                    |
      |------------------------------------->|
      |        seq=ISN_c, ack=0              |
      |                                      |
      |               SYN+ACK                |
      |<-------------------------------------|
      |        seq=ISN_s, ack=ISN_c+1        |
      |                                      |
      |               ACK                    |
      |------------------------------------->|
      |        seq=ISN_c+1, ack=ISN_s+1      |
      |                                      |
连接建立|                                      |连接建立


```

#### 2.3.2 三次握手的详细分析

##### 第一次握手（SYN）

客户端通过调用`connect()`函数发起连接请求，这会触发TCP协议栈发送SYN包。SYN包的特点是：

* SYN标志位设置为1
* 序列号设置为客户端的初始序列号（ISN\_c）
* 确认号设置为0（因为还没有收到对方的序列号）
* 可能包含TCP选项，如MSS（最大段大小）、窗口缩放、SACK许可等

客户端发送SYN包后，进入SYN\_SENT状态，等待服务器的响应。如果在一定时间内没有收到响应，客户端会重传SYN包，重传次数和间隔由系统参数控制。

##### 第二次握手（SYN+ACK）

服务器通过`listen()`函数进入监听状态，等待客户端的连接请求。当服务器收到SYN包后，会执行以下操作：

1. 分配资源创建一个新的传输控制块（TCB），用于存储连接信息
2. 生成自己的初始序列号（ISN\_s）
3. 发送SYN+ACK包，其特点是：
   * SYN和ACK标志位都设置为1
   * 序列号设置为服务器的初始序列号（ISN\_s）
   * 确认号设置为客户端序列号加1（ISN\_c+1）
   * 可能包含TCP选项，响应客户端的选项请求

服务器发送SYN+ACK包后，进入SYN\_RCVD状态，等待客户端的确认。此时连接处于"半开"状态，服务器已分配资源但连接尚未完全建立。

##### 第三次握手（ACK）

客户端收到服务器的SYN+ACK包后，会执行以下操作：

1. 验证确认号是否为ISN\_c+1，确保这是对自己SYN包的响应
2. 发送ACK包，其特点是：
   * ACK标志位设置为1
   * 序列号设置为ISN\_c+1
   * 确认号设置为ISN\_s+1
   * 可能包含数据（在某些实现中）

客户端发送ACK包后，进入ESTABLISHED状态，可以开始发送数据。服务器收到ACK包后，也进入ESTABLISHED状态，连接完全建立。

#### 2.3.3 三次握手的源码实现

下面我们通过Linux内核源码来分析TCP三次握手的实现。

##### 客户端发送SYN（第一次握手）

当应用程序调用`connect()`函数时，最终会调用到`tcp_v4_connect()`函数，该函数负责发送SYN包：

```
// 简化版的tcp_v4_connect函数
int tcp_v4_connect(struct sock *sk, struct sockaddr *uaddr, int addr_len)
{
    // ...
    
    // 生成初始序列号
    tp->write_seq = secure_tcp_seq(saddr, daddr, sport, dport);
    
    // 设置SYN_SENT状态
    tcp_set_state(sk, TCP_SYN_SENT);
    
    // 设置连接参数
    tp->ts_recent = 0;
    tp->rcv_wnd = 0;
    tp->rcv_wup = 0;
    tp->snd_wl1 = 0;
    
    // 发送SYN包
    err = tcp_transmit_skb(sk, skb, 1, sk->sk_allocation);
    
    // 启动重传定时器
    inet_csk_reset_xmit_timer(sk, ICSK_TIME_RETRANS,
                             inet_csk(sk)->icsk_rto, TCP_RTO_MAX);
    
    // ...
    
    return 0;
}


```

在`tcp_transmit_skb`函数中，会构建TCP头部并设置SYN标志位：

```
// 简化版的TCP头部构建过程
static int tcp_transmit_skb(struct sock *sk, struct sk_buff *skb, int clone_it,
                           gfp_t gfp_mask)
{
    // ...
    
    // 构建TCP头部
    th = tcp_hdr(skb);
    th->source = inet->inet_sport;
    th->dest = inet->inet_dport;
    th->seq = htonl(tcb->seq);
    th->ack_seq = htonl(tp->rcv_nxt);
    
    // 设置SYN标志位
    tcp_header_size = tcp_options_size + sizeof(struct tcphdr);
    th->doff = (tcp_header_size >> 2);
    TCP_SKB_CB(skb)->tcp_flags = TCPHDR_SYN;
    th->syn = 1;
    
    // ...
    
    // 发送数据包
    err = icsk->icsk_af_ops->queue_xmit(sk, skb, &inet->cork.fl);
    
    // ...
    
    return err;
}


```

##### 服务器发送SYN+ACK（第二次握手）

服务器通过`listen()`函数进入监听状态，当收到SYN包时，会调用`tcp_v4_do_rcv()`函数处理：

```
// 简化版的tcp_v4_do_rcv函数
int tcp_v4_do_rcv(struct sock *sk, struct sk_buff *skb)
{
    // ...
    
    // 根据套接字状态处理
    if (sk->sk_state == TCP_LISTEN) {
        // 处理监听状态下收到的包
        struct sock *nsk = tcp_v4_hnd_req(sk, skb);
        if (!nsk)
            goto discard;
        
        // 如果是新连接，处理SYN包
        if (nsk != sk) {
            if (tcp_child_process(sk, nsk, skb)) {
                // 子套接字处理成功，释放skb
                __kfree_skb(skb);
            }
            return 0;
        }
    }
    
    // ...
    
    // 处理已建立连接的数据
    return tcp_rcv_state_process(sk, skb, tcp_hdr(skb), skb->len);
}


```

在`tcp_v4_hnd_req`函数中，会检查是否有匹配的请求套接字，如果没有，则创建一个新的请求套接字：

```
// 简化版的tcp_v4_hnd_req函数
static struct sock *tcp_v4_hnd_req(struct sock *sk, struct sk_buff *skb)
{
    // ...
    
    // 查找匹配的请求
    struct request_sock *req = inet_csk_search_req(sk, &prev, th->source,
                                                 iph->saddr, iph->daddr);
    if (req)
        return tcp_check_req(sk, skb, req, prev, false);
    
    // 没有匹配的请求，处理新的SYN
    if (th->syn) {
        // 处理SYN包，创建新的请求套接字
        return tcp_v4_cookie_check(sk, skb);
    }
    
    // ...
}


```

当收到SYN包并创建新的请求套接字后，会调用`tcp_v4_send_synack`函数发送SYN+ACK包：

```
// 简化版的tcp_v4_send_synack函数
static int tcp_v4_send_synack(struct sock *sk, struct dst_entry *dst,
                             struct request_sock *req,
                             struct tcp_fastopen_cookie *foc)
{
    // ...
    
    // 构建SYN+ACK包
    skb = tcp_make_synack(sk, dst, req, foc);
    if (!skb)
        return -ENOMEM;
    
    // 发送SYN+ACK包
    err = ip_build_and_send_pkt(skb, sk, req->rsk_ops->saddr(req),
                               req->rsk_ops->daddr(req), NULL);
    
    // ...
    
    return err;
}


```

在`tcp_make_synack`函数中，会构建SYN+ACK包的TCP头部：

```
// 简化版的tcp_make_synack函数
struct sk_buff *tcp_make_synack(struct sock *sk, struct dst_entry *dst,
                               struct request_sock *req,
                               struct tcp_fastopen_cookie *foc)
{
    // ...
    
    // 构建TCP头部
    th = tcp_hdr(skb);
    th->source = htons(ireq->ir_num);
    th->dest = ireq->ir_rmt_port;
    th->seq = htonl(tcp_rsk(req)->snt_isn);
    th->ack_seq = htonl(tcp_rsk(req)->rcv_nxt);
    
    // 设置SYN和ACK标志位
    th->syn = 1;
    th->ack = 1;
    
    // ...
    
    return skb;
}


```

##### 客户端发送ACK（第三次握手）

客户端收到服务器的SYN+ACK包后，会调用`tcp_rcv_state_process`函数处理：

```
// 简化版的tcp_rcv_state_process函数
int tcp_rcv_state_process(struct sock *sk, struct sk_buff *skb,
                         const struct tcphdr *th, unsigned int len)
{
    // ...
    
    // 根据套接字状态处理
    switch (sk->sk_state) {
    case TCP_SYN_SENT:
        // 处理SYN_SENT状态下收到的包
        queued = tcp_rcv_synsent_state_process(sk, skb, th, len);
        // ...
        break;
    // 其他状态的处理
    // ...
    }
    
    // ...
}


```

在`tcp_rcv_synsent_state_process`函数中，会验证SYN+ACK包并发送ACK包：

```
// 简化版的tcp_rcv_synsent_state_process函数
static int tcp_rcv_synsent_state_process(struct sock *sk, struct sk_buff *skb,
                                        const struct tcphdr *th, unsigned int len)
{
    // ...
    
    // 验证SYN+ACK包
    if (th->ack) {
        // 检查确认号
        if (!tcp_ack(sk, skb, FLAG_SLOWPATH))
            return 1;
    }
    
    // 检查SYN标志位
    if (th->syn) {
        // 处理SYN+ACK
        tcp_rcv_synrecv_state_fastpath(sk, skb, th);
        
        // 发送ACK包
        tcp_send_ack(sk);
        
        // 设置ESTABLISHED状态
        tcp_set_state(sk, TCP_ESTABLISHED);
        
        // ...
    }
    
    // ...
}


```

在`tcp_send_ack`函数中，会构建并发送ACK包：

```
// 简化版的tcp_send_ack函数
void tcp_send_ack(struct sock *sk)
{
    // ...
    
    // 构建ACK包
    buff = alloc_skb(MAX_TCP_HEADER, sk_gfp_atomic(sk, GFP_ATOMIC));
    if (!buff)
        return;
    
    // 设置TCP头部
    skb_reserve(buff, MAX_TCP_HEADER);
    tcp_init_nondata_skb(buff, tp->snd_una, TCPHDR_ACK);
    
    // 发送ACK包
    tcp_transmit_skb(sk, buff, 0, sk_gfp_atomic(sk, GFP_ATOMIC));
    
    // ...
}


```

#### 2.3.4 三次握手的作用与必要性

TCP三次握手的设计有其深刻的考虑，主要解决以下问题：

##### 同步序列号

三次握手使得通信双方能够同步各自的初始序列号（ISN），这是TCP可靠传输的基础。序列号的同步确保了：

* 数据能够按顺序重组
* 丢失的数据能够被检测和重传
* 重复的数据能够被识别和丢弃

##### 防止历史连接干扰

如果网络中存在延迟的、过期的连接请求，三次握手可以有效防止这些请求干扰新的连接。假设一个场景：

1. 客户端发送SYN包，但由于网络问题，该包在网络中延迟了
2. 客户端超时后重新发送SYN包，与服务器建立了连接，然后关闭连接
3. 之前延迟的SYN包最终到达服务器

在这种情况下，如果只有两次握手，服务器会认为这是一个新的连接请求，并分配资源。但由于客户端已经不再期望这个连接，这会导致服务器资源的浪费。

有了三次握手，服务器发送SYN+ACK后，客户端不会回应最后的ACK，服务器会在超时后释放资源，从而避免了资源浪费。

##### 确认双方的收发能力

三次握手确保了通信双方都具备发送和接收数据的能力：

* 第一次握手：客户端证明自己有发送能力
* 第二次握手：服务器证明自己有接收和发送能力
* 第三次握手：客户端证明自己有接收能力

只有在双方都确认了对方的收发能力后，连接才被视为完全建立。

##### 协商连接参数

三次握手过程中，双方可以协商多种连接参数，如：

* 最大段大小（MSS）
* 窗口缩放因子
* 选择性确认（SACK）的支持
* 时间戳选项
* 快速打开（TFO）cookie

这些参数的协商使得TCP连接能够适应不同的网络环境和应用需求。

#### 2.3.5 三次握手的常见问题与优化

##### SYN洪泛攻击

SYN洪泛攻击是一种常见的拒绝服务攻击，攻击者发送大量的SYN包但不完成三次握手，导致服务器的半连接队列被填满，无法处理正常的连接请求。

防御措施包括：

* **SYN Cookie**：在收到SYN包时不立即分配资源，而是将连接信息编码在SYN+ACK包的序列号中，只有在收到最后的ACK包后才分配资源
* **增加半连接队列大小**：通过调整系统参数增加半连接队列的容量
* **减少SYN+ACK重传次数和超时时间**：加快对未完成的握手的清理
* **使用防火墙或负载均衡器**：过滤可疑的SYN包或限制单一来源的SYN包数量

##### 连接建立延迟

传统的三次握手需要1.5个往返时间（RTT）才能完成，在高延迟网络中可能导致明显的延迟。为了减少这种延迟，TCP引入了一些优化技术：

* **TCP快速打开（TFO）**：允许在SYN包中携带数据，并在第三次握手完成前就将数据交付给应用程序，减少了一个RTT的延迟
* **并行连接**：同时建立多个TCP连接，分散数据传输，提高并行度
* **持久连接**：复用已建立的TCP连接，避免频繁的连接建立和关闭

##### 半连接队列溢出

当服务器收到大量的SYN包时，半连接队列可能会溢出，导致新的连接请求被丢弃。解决方法包括：

* **增加半连接队列大小**：通过调整`net.ipv4.tcp_max_syn_backlog`参数
* **启用SYN Cookie**：通过设置`net.ipv4.tcp_syncookies=1`
* **调整SYN+ACK重传参数**：通过`net.ipv4.tcp_synack_retries`控制重传次数
* **使用负载均衡**：分散连接请求到多个服务器

##### 全连接队列溢出

当服务器完成三次握手但应用程序未及时接受连接时，全连接队列可能会溢出。解决方法包括：

* **增加全连接队列大小**：通过调整`net.core.somaxconn`和`listen()`函数的backlog参数
* **优化应用程序**：确保应用程序能够及时处理新的连接
* **使用异步I/O或事件驱动模型**：提高连接处理的效率

TCP三次握手是TCP协议的基础机制之一，它通过精心设计的交互过程，确保了连接的可靠建立。理解三次握手的原理和实现，对于网络编程、协议优化和故障排除都有重要意义。

### 2.4 TCP四次挥手

TCP四次挥手（Four-Way Handshake）是TCP连接终止过程中的关键机制，它确保了连接的优雅关闭，使得双方都能够完成数据传输并释放资源。四次挥手的过程精确而可靠，是TCP连接生命周期的最后阶段。

#### 2.4.1 四次挥手的基本过程

TCP四次挥手的基本过程如下：

1. **第一次挥手（FIN）**：主动关闭方发送一个FIN（结束）包，表示已经没有数据要发送了，但仍然可以接收数据，并将连接状态设置为FIN\_WAIT\_1。
2. **第二次挥手（ACK）**：被动关闭方收到FIN包后，发送一个ACK（确认）包，确认收到了FIN包，并将连接状态设置为CLOSE\_WAIT。主动关闭方收到ACK后，将连接状态设置为FIN\_WAIT\_2。
3. **第三次挥手（FIN）**：被动关闭方完成所有数据发送后，发送一个FIN包，表示也没有数据要发送了，并将连接状态设置为LAST\_ACK。
4. **第四次挥手（ACK）**：主动关闭方收到FIN包后，发送一个ACK包，确认收到了FIN包，并将连接状态设置为TIME\_WAIT。被动关闭方收到ACK后，将连接状态设置为CLOSED。主动关闭方在TIME\_WAIT状态等待2MSL（最大报文生存时间）后，也将连接状态设置为CLOSED。

这个过程可以用下图表示：

```
    主动关闭方                               被动关闭方
      |                                      |
      |               FIN                    |
      |------------------------------------->|
      |        seq=u, ack=v                  |
FIN_WAIT_1|                                      |CLOSE_WAIT
      |               ACK                    |
      |<-------------------------------------|
      |        seq=v, ack=u+1                |
FIN_WAIT_2|                                      |
      |                                      |
      |               FIN                    |
      |<-------------------------------------|
      |        seq=w, ack=u+1                |
TIME_WAIT |                                      |LAST_ACK
      |               ACK                    |
      |------------------------------------->|
      |        seq=u+1, ack=w+1              |
      |                                      |CLOSED
      |                                      |
      |        (等待2MSL)                    |
      |                                      |
CLOSED |                                      |


```

#### 2.4.2 四次挥手的详细分析

##### 第一次挥手（FIN）

当应用程序调用`close()`或`shutdown()`函数时，会触发TCP协议栈发送FIN包。FIN包的特点是：

* FIN标志位设置为1
* 序列号设置为当前已发送数据的最后一个字节的序列号加1
* 确认号设置为已接收数据的最后一个字节的序列号加1
* 可能包含最后的数据

主动关闭方发送FIN包后，进入FIN\_WAIT\_1状态，表示自己已经完成了数据发送，但仍然可以接收数据。

##### 第二次挥手（ACK）

被动关闭方收到FIN包后，会执行以下操作：

1. 向应用程序发送一个文件结束（EOF）信号，通知应用程序对方已经关闭了发送通道
2. 发送ACK包，确认收到了FIN包，其特点是：
   * ACK标志位设置为1
   * 确认号设置为收到的FIN包的序列号加1
   * 序列号设置为当前已发送数据的最后一个字节的序列号加1

被动关闭方发送ACK包后，进入CLOSE\_WAIT状态，表示自己已经知道对方不再发送数据，但自己还可能有数据要发送。主动关闭方收到ACK包后，进入FIN\_WAIT\_2状态，等待被动关闭方的FIN包。

##### 第三次挥手（FIN）

被动关闭方在完成所有数据发送后（可能是立即的，也可能是经过一段时间的处理），会发送FIN包，其特点是：

* FIN标志位设置为1
* 序列号设置为当前已发送数据的最后一个字节的序列号加1
* 确认号设置为已接收数据的最后一个字节的序列号加1
* 可能包含最后的数据

被动关闭方发送FIN包后，进入LAST\_ACK状态，等待最后的确认。

##### 第四次挥手（ACK）

主动关闭方收到FIN包后，会执行以下操作：

1. 发送ACK包，确认收到了FIN包，其特点是：
   * ACK标志位设置为1
   * 确认号设置为收到的FIN包的序列号加1
   * 序列号设置为当前已发送数据的最后一个字节的序列号加1

主动关闭方发送ACK包后，进入TIME\_WAIT状态，等待2MSL（最大报文生存时间）后才会完全关闭连接。被动关闭方收到ACK包后，立即进入CLOSED状态，释放所有资源。

#### 2.4.3 四次挥手的源码实现

下面我们通过Linux内核源码来分析TCP四次挥手的实现。

##### 主动关闭方发送FIN（第一次挥手）

当应用程序调用`close()`函数时，最终会调用到`tcp_close()`函数，该函数负责发送FIN包：

```
// 简化版的tcp_close函数
void tcp_close(struct sock *sk, long timeout)
{
    // ...
    
    // 检查是否有未发送的数据
    if (sk->sk_send_head) {
        // 还有数据未发送，设置LINGER定时器
        if (timeout) {
            // ...
        } else {
            // 没有设置超时，立即关闭
            tcp_send_active_reset(sk, sk->sk_allocation);
            goto adjudge_to_death;
        }
    }
    
    // 没有未发送的数据，发送FIN包
    if (tcp_close_state(sk)) {
        tcp_send_fin(sk);
    }
    
    // ...
}


```

在`tcp_send_fin`函数中，会构建并发送FIN包：

```
// 简化版的tcp_send_fin函数
void tcp_send_fin(struct sock *sk)
{
    // ...
    
    // 构建FIN包
    buff = tcp_write_queue_tail(sk);
    if (buff && skb_queue_len(&sk->sk_write_queue) == 1) {
        // 如果写队列中只有一个包，直接在这个包上设置FIN标志
        TCP_SKB_CB(buff)->tcp_flags |= TCPHDR_FIN;
        TCP_SKB_CB(buff)->end_seq++;
        tp->write_seq++;
    } else {
        // 创建一个新的FIN包
        buff = alloc_skb_fclone(MAX_TCP_HEADER, sk->sk_allocation);
        if (!buff)
            return;
        
        // 设置FIN标志
        tcp_init_nondata_skb(buff, tp->write_seq, TCPHDR_ACK | TCPHDR_FIN);
        tcp_queue_skb(sk, buff);
    }
    
    // 发送FIN包
    tcp_transmit_skb(sk, buff, 1, sk->sk_allocation);
    
    // ...
}


```

##### 被动关闭方发送ACK（第二次挥手）

被动关闭方收到FIN包后，会调用`tcp_rcv_state_process`函数处理：

```
// 简化版的tcp_rcv_state_process函数
int tcp_rcv_state_process(struct sock *sk, struct sk_buff *skb,
                         const struct tcphdr *th, unsigned int len)
{
    // ...
    
    // 根据套接字状态处理
    switch (sk->sk_state) {
    // 其他状态的处理
    // ...
    
    case TCP_ESTABLISHED:
        // 处理ESTABLISHED状态下收到的包
        if (th->fin) {
            // 收到FIN包，进入CLOSE_WAIT状态
            tcp_set_state(sk, TCP_CLOSE_WAIT);
            
            // 通知应用程序
            sk->sk_shutdown |= RCV_SHUTDOWN;
            sock_set_flag(sk, SOCK_DONE);
            
            // 发送ACK确认FIN
            tcp_send_ack(sk);
            
            // ...
        }
        break;
    
    // 其他状态的处理
    // ...
    }
    
    // ...
}


```

##### 被动关闭方发送FIN（第三次挥手）

被动关闭方在应用程序调用`close()`函数后，会发送FIN包，过程与主动关闭方类似：

```
// 简化版的tcp_close函数
void tcp_close(struct sock *sk, long timeout)
{
    // ...
    
    // 检查是否有未发送的数据
    if (sk->sk_send_head) {
        // 还有数据未发送，设置LINGER定时器
        if (timeout) {
            // ...
        } else {
            // 没有设置超时，立即关闭
            tcp_send_active_reset(sk, sk->sk_allocation);
            goto adjudge_to_death;
        }
    }
    
    // 没有未发送的数据，发送FIN包
    if (tcp_close_state(sk)) {
        tcp_send_fin(sk);
    }
    
    // ...
}


```

不同的是，此时套接字的状态是CLOSE\_WAIT，调用`tcp_close_state`会将状态设置为LAST\_ACK：

```
// 简化版的tcp_close_state函数
int tcp_close_state(struct sock *sk)
{
    // ...
    
    switch (sk->sk_state) {
    case TCP_CLOSE_WAIT:
        // 从CLOSE_WAIT状态转换为LAST_ACK状态
        tcp_set_state(sk, TCP_LAST_ACK);
        break;
    
    // 其他状态的处理
    // ...
    }
    
    // ...
}


```

##### 主动关闭方发送ACK（第四次挥手）

主动关闭方收到FIN包后，会调用`tcp_rcv_state_process`函数处理：

```
// 简化版的tcp_rcv_state_process函数
int tcp_rcv_state_process(struct sock *sk, struct sk_buff *skb,
                         const struct tcphdr *th, unsigned int len)
{
    // ...
    
    // 根据套接字状态处理
    switch (sk->sk_state) {
    // 其他状态的处理
    // ...
    
    case TCP_FIN_WAIT2:
        // 处理FIN_WAIT2状态下收到的包
        if (th->fin) {
            // 收到FIN包，进入TIME_WAIT状态
            tcp_time_wait(sk, TCP_TIME_WAIT, 0);
            
            // 发送ACK确认FIN
            tcp_send_ack(sk);
            
            // ...
        }
        break;
    
    // 其他状态的处理
    // ...
    }
    
    // ...
}


```

在`tcp_time_wait`函数中，会将套接字状态设置为TIME\_WAIT，并启动2MSL定时器：

```
// 简化版的tcp_time_wait函数
void tcp_time_wait(struct sock *sk, int state, int timeo)
{
    // ...
    
    // 设置TIME_WAIT状态
    tcp_set_state(sk, state);
    
    // 启动2MSL定时器
    inet_csk_reset_keepalive_timer(sk, TCP_TIMEWAIT_LEN);
    
    // ...
}


```

#### 2.4.4 四次挥手的作用与必要性

TCP四次挥手的设计有其深刻的考虑，主要解决以下问题：

##### 确保数据完整传输

四次挥手确保了双方都能够完成数据的发送，避免了数据丢失。具体来说：

* 第一次挥手后，主动关闭方不再发送数据，但仍然可以接收数据
* 第二次挥手后，被动关闭方知道主动关闭方不再发送数据，但自己仍然可以发送数据
* 第三次挥手后，被动关闭方也不再发送数据
* 第四次挥手后，连接完全关闭

这种设计使得即使一方决定关闭连接，另一方仍然有机会发送剩余的数据，确保了数据的完整传输。

##### 处理半关闭状态

TCP支持半关闭（Half-Close）状态，即一方关闭了发送通道，但仍然保持接收通道开放。四次挥手的设计使得半关闭状态能够被正确处理：

* 第一次挥手和第二次挥手完成后，连接处于半关闭状态，主动关闭方不再发送数据，但仍然可以接收数据
* 应用程序可以通过`shutdown()`函数实现半关闭，只关闭发送通道或接收通道

半关闭状态在某些应用场景中非常有用，如文件传输完成后，客户端可以关闭发送通道，但仍然保持接收通道开放，以接收服务器的确认或错误信息。

##### TIME\_WAIT状态的作用

四次挥手中，主动关闭方在发送最后的ACK后会进入TIME\_WAIT状态，并等待2MSL（最大报文生存时间）才会完全关闭连接。这个设计有两个重要作用：

1. **确保最后的ACK能够到达**：如果最后的ACK丢失，被动关闭方会重传FIN包，主动关闭方可以再次发送ACK。如果没有TIME\_WAIT状态，主动关闭方可能已经关闭连接，无法响应重传的FIN包，导致被动关闭方无法正常关闭连接。
2. **防止历史连接干扰**：如果没有TIME\_WAIT状态，可能会出现这样的情况：旧连接的延迟数据包在新连接建立后到达，被误认为是新连接的数据包。TIME\_WAIT状态确保了旧连接的所有数据包都已经从网络中消失，不会干扰新的连接。

##### 资源的正确释放

四次挥手确保了连接资源的正确释放，避免了资源泄漏：

* 第二次挥手后，被动关闭方知道主动关闭方不再发送数据，可以释放接收缓冲区
* 第四次挥手后，被动关闭方完全关闭连接，释放所有资源
* TIME\_WAIT状态结束后，主动关闭方也完全关闭连接，释放所有资源

这种设计确保了连接资源的有序释放，避免了资源泄漏和不必要的资源占用。

#### 2.4.5 四次挥手的常见问题与优化

##### TIME\_WAIT状态过多

在高并发服务器中，可能会出现大量的TIME\_WAIT状态的连接，占用系统资源。解决方法包括：

* **启用TIME\_WAIT复用**：通过设置`net.ipv4.tcp_tw_reuse=1`，允许新连接复用TIME\_WAIT状态的端口
* **减少TIME\_WAIT超时时间**：通过设置`net.ipv4.tcp_fin_timeout`参数（注意，这不会改变2MSL的时间，但会影响FIN\_WAIT2状态的超时时间）
* **使用长连接**：减少连接的建立和关闭次数，避免产生大量TIME\_WAIT状态
* **使用SO\_LINGER选项**：在特定场景下，可以通过设置SO\_LINGER选项为0，使`close()`函数立即发送RST包而不是FIN包，跳过四次挥手过程（注意，这可能导致数据丢失）

##### FIN\_WAIT2状态卡住

如果主动关闭方在发送FIN包并收到ACK后，由于某种原因（如被动关闭方崩溃）没有收到被动关闭方的FIN包，就会一直停留在FIN\_WAIT2状态。解决方法包括：

* **设置FIN\_WAIT2超时时间**：通过设置`net.ipv4.tcp_fin_timeout`参数，控制FIN\_WAIT2状态的最长时间
* **启用TCP保活机制**：通过设置`SO_KEEPALIVE`选项，定期检测连接是否仍然有效
* **实现应用层心跳**：在应用层实现心跳机制，及时检测对方是否仍然在线

##### CLOSE\_WAIT状态过多

如果被动关闭方收到FIN包后，应用程序没有及时调用`close()`函数，就会一直停留在CLOSE\_WAIT状态。这通常是应用程序的问题，解决方法包括：

* **优化应用程序**：确保应用程序能够及时关闭不再使用的连接
* **实现连接监控**：监控CLOSE\_WAIT状态的连接数量，及时发现问题
* **设置应用层超时**：在应用层设置超时机制，确保连接不会无限期地保持打开状态

##### 连接重置（RST）

在某些情况下，TCP连接可能会被重置，而不是通过四次挥手正常关闭。常见的原因包括：

* **访问已关闭的连接**：尝试向已关闭的连接发送数据
* **连接超时**：连接长时间没有活动，被一方超时关闭
* **异常关闭**：应用程序异常退出，操作系统发送RST包关闭连接
* **使用SO\_LINGER选项**：设置SO\_LINGER选项为0，使`close()`函数发送RST包

连接重置会导致缓冲区中的数据丢失，应该尽量避免。正常情况下，应该通过四次挥手正常关闭连接，确保数据的完整传输。

TCP四次挥手是TCP连接生命周期的最后阶段，它通过精心设计的交互过程，确保了连接的优雅关闭。理解四次挥手的原理和实现，对于网络编程、协议优化和故障排除都有重要意义。

### 2.5 TCP状态转换图

TCP状态转换图是理解TCP连接生命周期的重要工具，它描述了TCP连接在不同事件下的状态变化。TCP状态转换图不仅是理论上的概念模型，也是TCP协议实现的基础。

#### 2.5.1 TCP状态概述

TCP连接在其生命周期中会经历多个状态，每个状态都有其特定的含义和行为。以下是TCP的11个标准状态：

1. **CLOSED**：表示没有连接，这是初始状态和最终状态。
2. **LISTEN**：服务器等待来自客户端的连接请求。
3. **SYN\_SENT**：客户端已发送SYN包，等待服务器的SYN+ACK包。
4. **SYN\_RCVD**：服务器已收到SYN包并发送SYN+ACK包，等待客户端的ACK包。
5. **ESTABLISHED**：连接已建立，数据可以双向传输。
6. **FIN\_WAIT\_1**：主动关闭方已发送FIN包，等待对方的ACK包。
7. **FIN\_WAIT\_2**：主动关闭方已收到对方的ACK包，等待对方的FIN包。
8. **CLOSE\_WAIT**：被动关闭方已收到对方的FIN包并发送ACK包，等待应用程序关闭连接。
9. **LAST\_ACK**：被动关闭方已发送FIN包，等待对方的ACK包。
10. **TIME\_WAIT**：主动关闭方已收到对方的FIN包并发送ACK包，等待2MSL时间后关闭连接。
11. **CLOSING**：双方同时关闭连接时的特殊状态，表示已发送FIN包并收到对方的FIN包，但尚未收到对方对自己FIN包的ACK。

除了这些标准状态外，还有一些特殊状态或子状态，如：

* **NEW\_SYN\_RECV**：在Linux实现中，当使用SYN Cookie时，服务器收到SYN包后不会创建完整的连接结构，而是进入这个特殊状态。
* **TCP\_NEW\_SYN\_RECV**：在较新的Linux内核中，这个状态替代了NEW\_SYN\_RECV。
* **CLOSE\_WAIT\_2**：在某些实现中，CLOSE\_WAIT状态可能有两个子状态，表示不同的处理阶段。

#### 2.5.2 TCP状态转换图

TCP状态转换图描述了TCP连接在不同事件下的状态变化。以下是一个简化的TCP状态转换图：

```
                              +---------+
                              |  CLOSED |
                              +---------+
                                  |
                  passive open     |     active open
                  -------------    |    -------------
                   create TCB      |     create TCB
                  -------------    |    -------------
                      |            |         |
                      V            V         V
              +---------+        +---------+
              |  LISTEN |        | SYN_SENT|
              +---------+        +---------+
                  |                   |
      rcv SYN     |                   |    rcv SYN+ACK
      ---------   |                   |    -----------
      send SYN+ACK|                   |    send ACK
      ---------   |                   |    -----------
                  V                   V
              +---------+        +---------+
              | SYN_RCVD|        |ESTABLISHED|
              +---------+        +---------+
                  |                   |
       rcv ACK    |                   |    close
       --------   |                   |    -------
                  |                   |    send FIN
                  |                   |    -------
                  V                   V
              +---------+        +---------+
              |ESTABLISHED|      |FIN_WAIT_1|
              +---------+        +---------+
                  |                   |
       close      |                   |    rcv ACK
       -------    |                   |    -------
       send FIN   |                   |
       -------    |                   |
                  V                   V
              +---------+        +---------+
              |CLOSE_WAIT|       |FIN_WAIT_2|
              +---------+        +---------+
                  |                   |
       close      |                   |    rcv FIN
       -------    |                   |    -------
       send FIN   |                   |    send ACK
       -------    |                   |    -------
                  V                   V
              +---------+        +---------+
              | LAST_ACK|        | TIME_WAIT|
              +---------+        +---------+
                  |                   |
       rcv ACK    |                   |    2MSL timeout
       --------   |                   |    ------------
                  |                   |
                  V                   V
              +---------+        +---------+
              |  CLOSED |        |  CLOSED |
              +---------+        +---------+


```

这个图展示了TCP连接的主要状态转换路径，包括连接的建立、数据传输和连接的关闭。实际的TCP实现可能更复杂，包含更多的状态和转换路径。

#### 2.5.3 TCP状态在Linux内核中的实现

在Linux内核中，TCP状态是通过枚举类型定义的：

```
// file: include/net/tcp_states.h
enum {
    TCP_ESTABLISHED = 1,
    TCP_SYN_SENT,
    TCP_SYN_RECV,
    TCP_FIN_WAIT1,
    TCP_FIN_WAIT2,
    TCP_TIME_WAIT,
    TCP_CLOSE,
    TCP_CLOSE_WAIT,
    TCP_LAST_ACK,
    TCP_LISTEN,
    TCP_CLOSING,
    TCP_NEW_SYN_RECV,
    
    TCP_MAX_STATES   /* 最大状态数 */
};


```

TCP状态的转换是通过`tcp_set_state`函数实现的：

```
// 简化版的tcp_set_state函数
void tcp_set_state(struct sock *sk, int state)
{
    int oldstate = sk->sk_state;
    
    // 更新状态
    sk->sk_state = state;
    
    // 处理状态变化的副作用
    if (state == TCP_ESTABLISHED) {
        // 连接建立，可能需要启动保活定时器
        if (oldstate != TCP_ESTABLISHED)
            tcp_init_xmit_timers(sk);
    } else if (state == TCP_CLOSE) {
        // 连接关闭，需要清理资源
        if (oldstate == TCP_CLOSE_WAIT || oldstate == TCP_ESTABLISHED)
            tcp_send_fin(sk);
    } else if (state == TCP_CLOSE_WAIT) {
        // 进入CLOSE_WAIT状态，需要通知应用程序
        sk->sk_shutdown |= RCV_SHUTDOWN;
        sock_set_flag(sk, SOCK_DONE);
    }
    
    // 更新统计信息
    if (state == TCP_CLOSE)
        inet_csk_destroy_sock(sk);
}


```

TCP状态的转换是由各种事件触发的，如收到特定类型的TCP段、应用程序调用特定的函数等。以下是一些关键的状态转换函数：

##### 连接建立阶段的状态转换

```
// 客户端调用connect()函数，进入SYN_SENT状态
int tcp_v4_connect(struct sock *sk, struct sockaddr *uaddr, int addr_len)
{
    // ...
    tcp_set_state(sk, TCP_SYN_SENT);
    // ...
}

// 服务器收到SYN包，进入SYN_RCVD状态
int tcp_v4_do_rcv(struct sock *sk, struct sk_buff *skb)
{
    // ...
    if (sk->sk_state == TCP_LISTEN) {
        // ...
        tcp_set_state(nsk, TCP_SYN_RECV);
        // ...
    }
    // ...
}

// 客户端收到SYN+ACK包，进入ESTABLISHED状态
static int tcp_rcv_synsent_state_process(struct sock *sk, struct sk_buff *skb,
                                        const struct tcphdr *th, unsigned int len)
{
    // ...
    tcp_set_state(sk, TCP_ESTABLISHED);
    // ...
}

// 服务器收到ACK包，进入ESTABLISHED状态
int tcp_rcv_state_process(struct sock *sk, struct sk_buff *skb,
                         const struct tcphdr *th, unsigned int len)
{
    // ...
    if (sk->sk_state == TCP_SYN_RECV) {
        // ...
        tcp_set_state(sk, TCP_ESTABLISHED);
        // ...
    }
    // ...
}


```

##### 连接关闭阶段的状态转换

```
// 主动关闭方调用close()函数，进入FIN_WAIT_1状态
int tcp_close_state(struct sock *sk)
{
    // ...
    switch (sk->sk_state) {
    case TCP_ESTABLISHED:
        // ...
        tcp_set_state(sk, TCP_FIN_WAIT1);
        break;
    // ...
    }
    // ...
}

// 被动关闭方收到FIN包，进入CLOSE_WAIT状态
int tcp_rcv_state_process(struct sock *sk, struct sk_buff *skb,
                         const struct tcphdr *th, unsigned int len)
{
    // ...
    if (sk->sk_state == TCP_ESTABLISHED) {
        if (th->fin) {
            // ...
            tcp_set_state(sk, TCP_CLOSE_WAIT);
            // ...
        }
    }
    // ...
}

// 主动关闭方收到ACK包，进入FIN_WAIT_2状态
int tcp_rcv_state_process(struct sock *sk, struct sk_buff *skb,
                         const struct tcphdr *th, unsigned int len)
{
    // ...
    if (sk->sk_state == TCP_FIN_WAIT1) {
        if (th->ack) {
            // ...
            tcp_set_state(sk, TCP_FIN_WAIT2);
            // ...
        }
    }
    // ...
}

// 被动关闭方调用close()函数，进入LAST_ACK状态
int tcp_close_state(struct sock *sk)
{
    // ...
    switch (sk->sk_state) {
    case TCP_CLOSE_WAIT:
        // ...
        tcp_set_state(sk, TCP_LAST_ACK);
        break;
    // ...
    }
    // ...
}

// 主动关闭方收到FIN包，进入TIME_WAIT状态
int tcp_rcv_state_process(struct sock *sk, struct sk_buff *skb,
                         const struct tcphdr *th, unsigned int len)
{
    // ...
    if (sk->sk_state == TCP_FIN_WAIT2) {
        if (th->fin) {
            // ...
            tcp_time_wait(sk, TCP_TIME_WAIT, 0);
            // ...
        }
    }
    // ...
}

// 被动关闭方收到ACK包，进入CLOSED状态
int tcp_rcv_state_process(struct sock *sk, struct sk_buff *skb,
                         const struct tcphdr *th, unsigned int len)
{
    // ...
    if (sk->sk_state == TCP_LAST_ACK) {
        if (th->ack) {
            // ...
            tcp_set_state(sk, TCP_CLOSE);
            // ...
        }
    }
    // ...
}


```

#### 2.5.4 TCP状态的实际应用

理解TCP状态转换图对于网络编程、协议分析和故障排除都非常重要。以下是一些实际应用场景：

##### 网络编程

在使用套接字API进行网络编程时，了解TCP状态转换有助于理解和处理各种网络事件：

* **连接建立**：理解`connect()`、`listen()`和`accept()`函数如何影响TCP状态
* **数据传输**：理解ESTABLISHED状态下的数据传输行为
* **连接关闭**：理解`close()`和`shutdown()`函数如何影响TCP状态，以及如何处理半关闭状态
* **错误处理**：理解各种错误条件下的TCP状态变化，如连接重置、超时等

##### 协议分析

使用`netstat`、`ss`等工具或Wireshark等网络分析工具时，了解TCP状态转换有助于分析网络通信过程：

* **连接状态监控**：通过`netstat -ant`或`ss -ant`命令查看当前系统中各TCP连接的状态
* **连接建立分析**：通过Wireshark捕获TCP三次握手过程，分析SYN、SYN+ACK和ACK包的交换
* **连接关闭分析**：通过Wireshark捕获TCP四次挥手过程，分析FIN和ACK包的交换
* **异常状态分析**：识别和分析异常的TCP状态，如大量的TIME\_WAIT或CLOSE\_WAIT状态

##### 故障排除

在排查网络问题时，了解TCP状态转换有助于定位和解决问题：

* **连接建立失败**：分析SYN\_SENT或SYN\_RCVD状态的连接，查找连接建立失败的原因
* **连接关闭异常**：分析FIN\_WAIT2、CLOSE\_WAIT或TIME\_WAIT状态的连接，查找连接关闭异常的原因
* **资源泄漏**：识别和处理长时间处于非CLOSED状态的连接，防止资源泄漏
* **性能优化**：分析TCP状态分布，优化网络配置和应用程序行为

#### 2.5.5 TCP状态的常见问题与优化

##### 大量TIME\_WAIT状态

在高并发服务器中，可能会出现大量的TIME\_WAIT状态的连接，占用系统资源。解决方法包括：

* **启用TIME\_WAIT复用**：通过设置`net.ipv4.tcp_tw_reuse=1`，允许新连接复用TIME\_WAIT状态的端口
* **启用TIME\_WAIT回收**：通过设置`net.ipv4.tcp_tw_recycle=1`，加速TIME\_WAIT状态的回收（注意，这个选项在Linux 4.12后被移除，因为它可能导致NAT环境下的连接问题）
* **减少TIME\_WAIT超时时间**：通过设置`net.ipv4.tcp_fin_timeout`参数（注意，这不会改变2MSL的时间，但会影响FIN\_WAIT2状态的超时时间）
* **使用长连接**：减少连接的建立和关闭次数，避免产生大量TIME\_WAIT状态
* **使用连接池**：复用已建立的连接，减少连接的建立和关闭次数

##### 大量CLOSE\_WAIT状态

大量CLOSE\_WAIT状态通常表示应用程序没有正确关闭连接。解决方法包括：

* **优化应用程序**：确保应用程序能够及时关闭不再使用的连接
* **实现连接监控**：监控CLOSE\_WAIT状态的连接数量，及时发现问题
* **设置应用层超时**：在应用层设置超时机制，确保连接不会无限期地保持打开状态
* **使用`SO_LINGER`选项**：在特定场景下，可以通过设置`SO_LINGER`选项为0，使`close()`函数立即发送RST包而不是FIN包，跳过四次挥手过程（注意，这可能导致数据丢失）

##### 大量SYN\_RCVD状态

大量SYN\_RCVD状态可能表示SYN洪泛攻击或网络连接问题。解决方法包括：

* **启用SYN Cookie**：通过设置`net.ipv4.tcp_syncookies=1`，在收到SYN包时不立即分配资源，防止SYN洪泛攻击
* **增加半连接队列大小**：通过设置`net.ipv4.tcp_max_syn_backlog`参数，增加半连接队列的容量
* **减少SYN+ACK重传次数**：通过设置`net.ipv4.tcp_synack_retries`参数，减少SYN+ACK的重传次数
* **使用防火墙或负载均衡器**：过滤可疑的SYN包或限制单一来源的SYN包数量

##### 大量FIN\_WAIT2状态

大量FIN\_WAIT2状态可能表示网络连接问题或应用程序行为异常。解决方法包括：

* **设置FIN\_WAIT2超时时间**：通过设置`net.ipv4.tcp_fin_timeout`参数，控制FIN\_WAIT2状态的最长时间
* **启用TCP保活机制**：通过设置`SO_KEEPALIVE`选项，定期检测连接是否仍然有效
* **实现应用层心跳**：在应用层实现心跳机制，及时检测对方是否仍然在线
* **优化应用程序**：确保应用程序能够正确处理连接关闭事件

TCP状态转换图是理解TCP协议行为的重要工具，它描述了TCP连接在不同事件下的状态变化。深入理解TCP状态转换图对于网络编程、协议分析和故障排除都有重要意义。
