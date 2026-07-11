---
title: "计算机网络-TCP可靠传输机制"
description: "TCP（传输控制协议）的核心特性是提供可靠的数据传输服务，即确保数据能够无错、完整、按序地从发送方传输到接收方。这种可靠性是通过一系列精心设计的机制实现的，包括序列号与确认号机制、超时重传机制、滑动窗口机制和差错控制机制等。本章将深入探讨这些机制的原理和实现。"
sourceId: "147141877"
source: "https://blog.csdn.net/qq_45852626/article/details/147141877"
sourceSeries:
  - "计算机网络"
category: computer-fundamentals
subcategory: networking
tags:
  - "计算机网络"
  - "TCP/IP"
status: draft
difficulty: advanced
contentType: source-analysis
sidebar:
  order: 147141877
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/147141877)（历史文章导入，当前状态为草稿）

## 3. TCP可靠传输机制

TCP（传输控制协议）的核心特性是提供可靠的数据传输服务，即确保数据能够无错、完整、按序地从发送方传输到接收方。这种可靠性是通过一系列精心设计的机制实现的，包括序列号与确认号机制、超时重传机制、滑动窗口机制和差错控制机制等。本章将深入探讨这些机制的原理和实现。

### 3.1 序列号与确认号机制

序列号和确认号是TCP可靠传输的基础，它们使得TCP能够跟踪已发送和已接收的数据，检测丢失或重复的数据，并确保数据按序交付。

#### 3.1.1 序列号与确认号的基本概念

**序列号（Sequence Number）**：用于标识从TCP发送端向TCP接收端发送的数据字节流的位置。序列号是32位的无符号整数，当它达到2^32-1时会绕回到0。

**确认号（Acknowledgment Number）**：用于告知发送方接收方已成功接收的数据。确认号表示接收方期望从发送方收到的下一个字节的序列号，即已成功接收的数据的最高序列号加1。

在TCP连接建立时，通过三次握手过程，双方会交换随机生成的初始序列号（ISN），这是为了安全考虑，防止序列号被猜测和连接被劫持。

#### 3.1.2 序列号与确认号的工作原理

TCP将数据视为无结构的字节流，每个字节都有一个序列号。当发送数据时，TCP会为每个数据段分配序列号，接收方则通过确认号告知发送方已成功接收的数据。

以下是序列号与确认号工作的基本流程：

1. **发送方发送数据**：

   * 发送方将数据分割成多个段
   * 为每个段分配序列号，序列号等于该段第一个字节在整个数据流中的位置
   * 发送数据段，并启动重传定时器
2. **接收方接收数据**：

   * 接收方接收数据段，检查序列号是否在预期范围内
   * 如果数据段有效，接收方将数据放入接收缓冲区
   * 接收方发送确认，确认号等于已成功接收的数据的最高序列号加1
3. **发送方处理确认**：

   * 发送方接收确认，检查确认号
   * 如果确认号大于已确认的序列号，发送方更新已确认的序列号
   * 发送方可以释放已确认数据的缓冲区空间

这个过程确保了数据的可靠传输：如果数据段丢失，接收方不会确认该段，发送方会在超时后重传；如果数据段乱序到达，接收方可以根据序列号重新排序；如果数据段重复到达，接收方可以根据序列号识别并丢弃重复的数据。

#### 3.1.3 序列号与确认号在Linux内核中的实现

在Linux内核中，序列号和确认号的处理涉及多个数据结构和函数。以下是一些关键的实现细节：

##### TCP控制块中的序列号和确认号字段

TCP控制块（TCP Control Block，TCB）是存储TCP连接状态的数据结构，在Linux内核中对应`struct tcp_sock`。它包含了与序列号和确认号相关的多个字段：

```
// file: include/linux/tcp.h
struct tcp_sock {
    // ...
    
    /* 发送相关 */
    u32 snd_una;    /* 已发送但未确认的第一个字节的序列号 */
    u32 snd_nxt;    /* 下一个要发送的字节的序列号 */
    u32 snd_wl1;    /* 用于窗口更新的序列号 */
    u32 snd_wl2;    /* 用于窗口更新的确认号 */
    u32 write_seq;  /* 初始发送序列号 */
    
    /* 接收相关 */
    u32 rcv_nxt;    /* 期望接收的下一个字节的序列号 */
    u32 rcv_wup;    /* 接收窗口更新点 */
    u32 copied_seq; /* 已复制到用户空间的最后一个字节的序列号 */
    
    // ...
};


```

##### 序列号的初始化

在TCP连接建立时，需要为连接分配初始序列号（ISN）。Linux内核使用`secure_tcp_seq`函数生成随机的初始序列号：

```
// 简化版的secure_tcp_seq函数
__u32 secure_tcp_seq(__be32 saddr, __be32 daddr, __be16 sport, __be16 dport)
{
    struct tcp_secret secret;
    u32 hash[MD5_DIGEST_WORDS];
    u32 seq;
    
    // 使用密钥和连接四元组计算哈希值
    net_secret_init(&secret);
    seq = secret.secrets[0];
    seq += ktime_get_real_ns() >> 6;
    seq += saddr;
    seq += daddr;
    seq += (sport << 16) + dport;
    
    // 添加随机性
    seq ^= secure_tcp_sequence_number(hash);
    
    return seq;
}


```

这个函数使用源IP地址、目的IP地址、源端口、目的端口以及一个密钥和时间戳来生成随机的初始序列号，增加了序列号被猜测的难度，提高了
安全性 
。

##### 发送数据时的序列号处理

当发送数据时，TCP需要为数据段分配序列号。这通常在`tcp_transmit_skb`函数中完成：

```
// 简化版的tcp_transmit_skb函数
static int tcp_transmit_skb(struct sock *sk, struct sk_buff *skb, int clone_it,
                           gfp_t gfp_mask)
{
    // ...
    
    // 构建TCP头部
    th = tcp_hdr(skb);
    th->source = inet->inet_sport;
    th->dest = inet->inet_dport;
    
    // 设置序列号
    th->seq = htonl(tcb->seq);
    
    // 设置确认号（如果需要）
    if (tcb->tcp_flags & TCPHDR_ACK)
        th->ack_seq = htonl(tp->rcv_nxt);
    
    // ...
    
    // 更新发送序列号
    if (!(tcb->tcp_flags & TCPHDR_SYN))
        tp->snd_nxt = TCP_SKB_CB(skb)->end_seq;
    
    // ...
}


```

##### 接收数据时的确认号处理

当接收数据时，TCP需要处理序列号和生成确认号。这通常在`tcp_rcv_established`函数中完成：

```
// 简化版的tcp_rcv_established函数
void tcp_rcv_established(struct sock *sk, struct sk_buff *skb,
                        const struct tcphdr *th, unsigned int len)
{
    // ...
    
    // 检查序列号是否在接收窗口内
    if (!tcp_sequence(tp, TCP_SKB_CB(skb)->seq, TCP_SKB_CB(skb)->end_seq)) {
        // 序列号不在接收窗口内，丢弃数据段
        // ...
        goto discard;
    }
    
    // 处理数据
    tcp_data_queue(sk, skb);
    
    // 更新接收序列号
    tp->rcv_nxt = TCP_SKB_CB(skb)->end_seq;
    
    // 发送确认
    tcp_send_ack(sk);
    
    // ...
}


```

在`tcp_send_ack`函数中，会构建并发送ACK包，确认号设置为`tp->rcv_nxt`：

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
    
    // 设置确认号
    th = tcp_hdr(buff);
    th->ack_seq = htonl(tp->rcv_nxt);
    
    // 发送ACK包
    tcp_transmit_skb(sk, buff, 0, sk_gfp_atomic(sk, GFP_ATOMIC));
    
    // ...
}


```

#### 3.1.4 序列号与确认号的实际应用

序列号和确认号机制在TCP的实际应用中发挥着关键作用，它们支持了多种重要功能：

##### 数据的有序交付

序列号使得接收方能够按照发送顺序重组数据，即使数据段乱序到达。接收方会根据序列号将数据段放入正确的位置，确保应用程序收到的数据与发送时的顺序相同。

##### 检测丢失的数据

通过确认号，发送方可以知道哪些数据已经被接收方成功接收。如果在一定时间内没有收到某个数据段的确认，发送方会认为该数据段丢失，并重新发送。

##### 去除重复的数据

如果接收方收到了重复的数据段（可能是由于网络延迟或重传导致的），它可以根据序列号识别出这是重复的数据，并丢弃它，避免将重复的数据交付给应用程序。

##### 支持流量控制和拥塞控制

序列号和确认号是TCP流量控制和拥塞控制的基础。通过跟踪已发送和已确认的数据量，TCP可以调整发送速率，避免接收方缓冲区溢出和网络拥塞。

##### 支持选择性确认（SACK）

在标准的TCP中，确认号只能确认连续的数据。选择性确认（SACK）扩展了这一机制，允许接收方确认非连续的数据块，提高了重传效率。SACK通过TCP选项实现，使用序列号范围来指示已接收的数据块。

#### 3.1.5 序列号与确认号的常见问题与优化

##### 序列号回绕问题

序列号是32位的无符号整数，当发送的数据量超过4GB时，序列号会回绕到0。这可能导致新旧数据无法区分，特别是在高速网络中。

TCP通过时间戳选项解决了这个问题。时间戳选项为每个数据段添加一个时间戳，即使序列号回绕，也可以通过时间戳区分新旧数据。这个机制被称为PAWS（Protection Against Wrapped Sequence numbers）。

##### 初始序列号的安全性

如果初始序列号是可预测的，攻击者可能会猜测序列号并伪造TCP段，导致连接劫持或数据注入。为了提高安全性，现代TCP实现使用加密
算法 
生成随机的初始序列号，如前面介绍的`secure_tcp_seq`函数。

##### 确认延迟

为了减少网络开销，TCP通常不会立即确认每个接收到的数据段，而是延迟一段时间（通常是200ms），希望在这段时间内有数据要发送，可以将确认捎带在数据段中。这种延迟确认机制可能会增加重传超时的可能性。

优化方法包括：

* 调整延迟确认的超时时间
* 在特定场景下禁用延迟确认
* 实现更智能的确认策略，如根据网络状况动态调整确认行为

##### 重复确认和快速重传

如果接收方收到了乱序的数据段，它会发送重复确认（duplicate ACK），确认号仍然是期望接收的下一个字节的序列号。当发送方收到多个重复确认（通常是3个）时，会触发快速重传机制，立即重传可能丢失的数据段，而不等待重传超时。

这个机制在Linux内核中的实现如下：

```
// 简化版的tcp_fastretrans_alert函数
void tcp_fastretrans_alert(struct sock *sk, int pkts_acked, int flag)
{
    // ...
    
    // 检查是否收到了3个重复确认
    if (tp->dup_ack >= tp->reordering) {
        // 触发快速重传
        tcp_retransmit_skb(sk, tcp_write_queue_head(sk));
        
        // 进入快速恢复状态
        tp->snd_cwnd = tp->snd_ssthresh + tp->reordering;
        
        // ...
    }
    
    // ...
}


```

序列号和确认号机制是TCP可靠传输的基础，它们通过精心设计的交互过程，确保了数据的可靠、有序传输。理解序列号和确认号的原理和实现，对于深入理解TCP协议和优化网络应用都有重要意义。

### 3.2 超时重传机制

超时重传机制是TCP可靠传输的关键组成部分，它确保了在数据包丢失的情况下，发送方能够检测到丢失并重新发送数据，从而保证数据的可靠传输。

#### 3.2.1 超时重传的基本概念

\*\*超时重传（
Timeout 
 Retransmission）\*\*是指当发送方在一定时间内没有收到已发送数据的确认时，假定数据已丢失，并重新发送该数据的机制。

超时重传机制基于以下假设：

* 如果数据在网络中丢失，接收方将无法确认该数据
* 如果确认在网络中丢失，发送方将无法知道数据已被接收
* 在这两种情况下，发送方都需要重新发送数据

超时重传的关键是确定合适的超时时间，即**重传超时时间（Retransmission Timeout，RTO）**。如果RTO设置得太短，可能会导致不必要的重传，增加网络负担；如果RTO设置得太长，则会延长数据恢复的时间，降低传输效率。

#### 3.2.2 超时重传的工作原理

TCP超时重传的基本工作流程如下：

1. **发送数据**：

   * 发送方发送数据段
   * 启动重传定时器，超时时间为当前的RTO值
2. **等待确认**：

   * 如果在RTO时间内收到确认，取消重传定时器
   * 如果在RTO时间内没有收到确认，触发超时重传
3. **超时重传**：

   * 重新发送未被确认的最小序列号的数据段
   * 更新RTO值（通常是将当前RTO值加倍，这被称为指数退避）
   * 重新启动重传定时器
4. **重传限制**：

   * 如果重传次数超过最大限制，TCP会放弃重传，关闭连接或通知上层应用

TCP的超时重传机制不仅仅是简单地重新发送数据，还包括了RTO的计算和调整，以适应网络状况的变化。

#### 3.2.3 RTO的计算

RTO的计算是TCP超时重传机制的核心部分。TCP使用往返时间（Round-Trip Time，RTT）的测量值来计算RTO。RFC 6298定义了标准的RTO计算算法，称为Jacobson/Karels算法：

1. **初始化**：

   * 初始RTO设置为1秒（或3秒，取决于实现）
   * 初始SRTT（平滑RTT）和RTTVAR（RTT变化量）未定义
2. **首次RTT测量**：

   * 当收到第一个RTT测量值R时
   * SRTT = R
   * RTTVAR = R/2
   * RTO = SRTT + 4 \* RTTVAR
3. **后续RTT测量**：

   * 当收到新的RTT测量值R时
   * RTTVAR = (1 - beta) \* RTTVAR + beta \* |SRTT - R|，其中beta通常为0.25
   * SRTT = (1 - alpha) \* SRTT + alpha \* R，其中alpha通常为0.125
   * RTO = SRTT + 4 \* RTTVAR
4. **RTO限制**：

   * RTO不应小于1秒（某些实现可能使用更小的值，如200ms）
   * 没有明确的上限，但通常会设置一个最大值（如60秒）
5. **指数退避**：

   * 当发生超时重传时，RTO加倍
   * 连续重传时，RTO会呈指数增长（1s, 2s, 4s, 8s, …）
   * 当收到新的确认时，RTO重新计算

这个算法使得RTO能够适应网络状况的变化：当网络稳定时，RTO接近RTT；当网络不稳定时，RTO会增大，减少不必要的重传。

#### 3.2.4 超时重传在Linux内核中的实现

在Linux内核中，超时重传机制的实现涉及多个函数和数据结构。以下是一些关键的实现细节：

##### RTO的计算

Linux内核使用类似于RFC 6298的算法计算RTO，但有一些优化和调整：

```
// 简化版的tcp_rtt_estimator函数
void tcp_rtt_estimator(struct sock *sk, long mrtt_us)
{
    struct tcp_sock *tp = tcp_sk(sk);
    long m = mrtt_us;
    u32 srtt = tp->srtt_us;
    
    // 更新SRTT和RTTVAR
    if (srtt != 0) {
        // 已有SRTT，使用EWMA算法更新
        m -= (srtt >> 3);  // m = rtt - srtt/8
        srtt += m;         // srtt += m/8
        
        if (m < 0) {
            m = -m;
            m -= (tp->mdev_us >> 2);
            if (m > 0)
                m >>= 3;
        } else {
            m -= (tp->mdev_us >> 2);
            if (m > 0)
                m >>= 2;
        }
        
        tp->mdev_us += m;  // mdev += m/4
        
        // 更新最大MDEV
        if (tp->mdev_us > tp->mdev_max_us) {
            tp->mdev_max_us = tp->mdev_us;
            if (tp->mdev_max_us > tp->rttvar_us)
                tp->rttvar_us = tp->mdev_max_us;
        }
        
        // 每隔一段时间，更新RTTVAR
        if (after(tp->snd_una, tp->rtt_seq)) {
            tp->rtt_seq = tp->snd_nxt;
            if (tp->mdev_max_us < tp->rttvar_us)
                tp->rttvar_us -= (tp->rttvar_us - tp->mdev_max_us) >> 2;
            tp->mdev_max_us = tcp_rto_min_us(sk);
        }
    } else {
        // 首次测量RTT
        srtt = m << 3;
        tp->mdev_us = m;
        tp->mdev_max_us = m;
        tp->rttvar_us = m << 1;
    }
    
    tp->srtt_us = srtt;
    
    // 计算RTO
    tp->rto = __tcp_set_rto(tp);
    
    // 限制RTO的范围
    tp->rto = min(tp->rto, TCP_RTO_MAX);
    tp->rto = max(tp->rto, TCP_RTO_MIN);
}


```

##### 重传 定时器 的管理

TCP使用定时器来触发超时重传。在Linux内核中，这通过`tcp_write_timer`函数实现：

```
// 简化版的tcp_write_timer函数
void tcp_write_timer(struct timer_list *t)
{
    struct inet_connection_sock *icsk = from_timer(icsk, t, icsk_retransmit_timer);
    struct sock *sk = &icsk->icsk_inet.sk;
    
    // 检查是否需要重传
    if (!sock_owned_by_user(sk)) {
        tcp_retransmit_timer(sk);
    } else {
        // 如果套接字正在被用户使用，延迟重传
        inet_csk_reset_xmit_timer(sk, ICSK_TIME_RETRANS,
                                 icsk->icsk_rto, TCP_RTO_MAX);
    }
    
    sock_put(sk);
}


```

当重传定时器超时时，会调用`tcp_retransmit_timer`函数处理：

```
// 简化版的tcp_retransmit_timer函数
void tcp_retransmit_timer(struct sock *sk)
{
    struct tcp_sock *tp = tcp_sk(sk);
    
    // 检查是否有未确认的数据
    if (!tp->packets_out)
        goto out;
    
    // 检查是否超过最大重传次数
    if (tcp_write_timeout(sk))
        goto out;
    
    // 执行超时重传
    tcp_retransmit_skb(sk, tcp_write_queue_head(sk));
    
    // 更新RTO（指数退避）
    icsk->icsk_rto = min(icsk->icsk_rto << 1, TCP_RTO_MAX);
    
    // 重新启动重传定时器
    inet_csk_reset_xmit_timer(sk, ICSK_TIME_RETRANS,
                             icsk->icsk_rto, TCP_RTO_MAX);
    
    // ...
    
out:
    // ...
}


```

##### 重传数据段

当需要重传数据段时，会调用`tcp_retransmit_skb`函数：

```
// 简化版的tcp_retransmit_skb函数
int tcp_retransmit_skb(struct sock *sk, struct sk_buff *skb)
{
    // ...
    
    // 准备重传
    TCP_SKB_CB(skb)->seq = tp->snd_una;
    
    // 更新重传计数
    TCP_SKB_CB(skb)->tcp_flags |= TCPHDR_SYN;
    tp->retrans_stamp = tcp_time_stamp(tp);
    tp->retrans_out += tcp_skb_pcount(skb);
    
    // 发送重传的数据段
    err = tcp_transmit_skb(sk, skb, 1, GFP_ATOMIC);
    
    // ...
    
    return err;
}


```

#### 3.2.5 超时重传的实际应用

超时重传机制在TCP的实际应用中发挥着关键作用，它确保了数据的可靠传输，特别是在网络状况不佳的情况下。以下是一些实际应用场景：

##### 处理数据包丢失

在网络拥塞或链路质量差的情况下，数据包可能会丢失。超时重传机制能够检测到这种丢失，并重新发送数据，确保数据的完整性。

##### 处理确认丢失

即使数据包成功到达接收方，确认包也可能在返回途中丢失。超时重传机制同样能够处理这种情况，通过重新发送数据来触发新的确认。

##### 适应网络状况变化

通过动态调整RTO，TCP能够适应网络状况的变化。当网络延迟增加时，RTO会相应增加，减少不必要的重传；当网络状况改善时，RTO会逐渐减小，提高传输效率。

##### 与快速重传的协同

超时重传机制与快速重传机制协同工作，共同提高TCP的可靠性和效率。快速重传通过重复确认检测丢失，能够更快地响应；而超时重传作为最后的保障，确保即使在没有足够重复确认的情况下，丢失的数据也能被恢复。

#### 3.2.6 超时重传的常见问题与优化

##### 虚假超时

如果RTO设置得不合理，或者网络延迟突然增加，可能会导致虚假超时，即数据实际上没有丢失，但由于确认没有在RTO时间内到达，触发了不必要的重传。

优化方法包括：

* 使用更准确的RTT测量方法
* 实现更智能的RTO计算算法，如考虑RTT的历史变化趋势
* 使用时间戳选项，提高RTT测量的准确性

##### 重传歧义

当发生重传后，如果收到确认，无法确定这个确认是针对原始传输还是重传。这被称为重传歧义问题，它会影响RTT的测量和RTO的计算。

解决方法包括：

* 使用Karn算法：忽略重传数据段的RTT测量
* 使用时间戳选项：通过时间戳可以区分原始传输和重传的确认

##### 重传风暴

在网络严重拥塞的情况下，大量的数据包可能会丢失，导致大规模的重传。如果所有连接同时进行重传，可能会加剧网络拥塞，形成重传风暴。

解决方法包括：

* 实现随机化的重传退避
* 与拥塞控制机制协同，在检测到严重拥塞时减少发送速率
* 使用ECN（显式拥塞通知）等机制，提前感知网络拥塞

##### 针对特定网络环境的优化

不同的网络环境（如有线网络、无线网络、卫星链路等）有不同的特性，标准的超时重传机制可能不是最优的。针对特定网络环境的优化包括：

* **无线网络**：区分拥塞丢包和无线链路丢包，避免不必要的拥塞控制
* **高延迟网络**：使用更大的初始窗口和更激进的窗口增长策略
* **高带宽延迟积网络**：使用更大的窗口和更精确的RTT测量

超时重传机制是TCP可靠传输的重要组成部分，它通过检测和恢复丢失的数据，确保了数据的完整传输。理解超时重传的原理和实现，对于优化网络应用和解决网络问题都有重要意义。

### 3.3 滑动窗口机制

滑动窗口机制是TCP流量控制和可靠传输的核心机制，它允许发送方在收到确认前发送多个数据段，提高了网络利用率，同时防止发送方发送过多数据导致接收方缓冲区溢出。

#### 3.3.1 滑动窗口的基本概念

\*\*滑动窗口（Sliding Window）\*\*是一种流量控制机制，它定义了在任意时刻，发送方可以发送的数据量。窗口的大小是动态调整的，取决于接收方的处理能力和网络状况。

TCP使用两种窗口：

* **发送窗口（Send Window）**：发送方维护的窗口，表示可以发送的数据量
* **接收窗口（Receive Window）**：接收方维护的窗口，表示可以接收的数据量

滑动窗口机制的核心思想是：发送方可以在收到确认前发送多个数据段，但发送的数据量不能超过当前的窗口大小。随着数据的发送和确认，窗口会沿着数据流"滑动"，这就是"滑动窗口"名称的由来。

#### 3.3.2 滑动窗口的工作原理

##### 发送窗口

发送窗口可以分为四个部分：

1. **已发送且已确认**：窗口左边界左侧的数据，这些数据已经成功传输，发送方可以释放相应的缓冲区
2. **已发送但未确认**：窗口内的左侧部分，这些数据已经发送，但还没有收到确认
3. **未发送但允许发送**：窗口内的右侧部分，这些数据可以立即发送
4. **未发送且不允许发送**：窗口右边界右侧的数据，这些数据只有在窗口滑动后才能发送

发送窗口的大小取决于接收方通告的接收窗口大小和发送方的拥塞窗口大小，取两者的较小值。

##### 接收窗口

接收窗口也可以分为三个部分：

1. **已接收且已确认**：窗口左边界左侧的数据，这些数据已经成功接收并确认
2. **未接收但允许接收**：窗口内的数据，接收方准备好接收这些数据
3. **未接收且不允许接收**：窗口右边界右侧的数据，接收方暂时不能接收这些数据

接收窗口的大小取决于接收方的缓冲区大小和当前已使用的缓冲区空间。

##### 窗口滑动过程

滑动窗口的工作过程如下：

1. **初始状态**：

   * 发送方和接收方都有一个初始窗口大小
   * 发送方的窗口左边界是已确认的最高序列号加1（snd\_una）
   * 发送方的窗口右边界是左边界加窗口大小（snd\_una + snd\_wnd）
2. **发送数据**：

   * 发送方可以发送窗口内的所有数据
   * 每发送一个数据段，窗口内的可用空间减少
   * 发送方不能发送窗口外的数据
3. **接收确认**：

   * 当发送方收到确认时，窗口左边界向右滑动
   * 滑动的距离等于新确认的数据量
   * 窗口右边界也相应向右滑动，允许发送更多数据
4. **接收窗口更新**：

   * 接收方在发送确认时，会通告自己的接收窗口大小
   * 发送方根据接收方通告的窗口大小调整自己的发送窗口
   * 如果接收方的窗口大小为0，发送方会暂停发送数据，进入持续状态

这个过程确保了发送方不会发送超过接收方能够处理的数据量，实现了流量控制。

#### 3.3.3 滑动窗口在Linux内核中的实现

在Linux内核中，滑动窗口机制的实现涉及多个数据结构和函数。以下是一些关键的实现细节：

##### TCP控制块中的窗口字段

TCP控制块（struct tcp\_sock）包含了与滑动窗口相关的多个字段：

```
// file: include/linux/tcp.h
struct tcp_sock {
    // ...
    
    /* 发送窗口相关 */
    u32 snd_una;    /* 已发送但未确认的第一个字节的序列号 */
    u32 snd_nxt;    /* 下一个要发送的字节的序列号 */
    u32 snd_wnd;    /* 发送窗口大小 */
    u32 snd_wl1;    /* 用于窗口更新的序列号 */
    u32 snd_wl2;    /* 用于窗口更新的确认号 */
    u32 write_seq;  /* 初始发送序列号 */
    
    /* 接收窗口相关 */
    u32 rcv_nxt;    /* 期望接收的下一个字节的序列号 */
    u32 rcv_wnd;    /* 接收窗口大小 */
    u32 rcv_wup;    /* 接收窗口更新点 */
    
    // ...
};


```

##### 发送窗口的管理

发送窗口的大小由接收方通告的窗口大小和拥塞窗口大小共同决定：

```
// 简化版的tcp_current_mss函数
u32 tcp_wnd_end(const struct tcp_sock *tp)
{
    return tp->snd_una + min(tp->snd_wnd, tp->snd_cwnd);
}


```

当发送数据时，TCP会检查数据是否在发送窗口内：

```
// 简化版的tcp_write_xmit函数
static bool tcp_write_xmit(struct sock *sk, unsigned int mss_now, int nonagle,
                          int push_one, gfp_t gfp)
{
    // ...
    
    while ((skb = tcp_send_head(sk))) {
        // 检查是否在发送窗口内
        if (tcp_snd_wnd_test(tp, skb, mss_now))
            break;
        
        // 发送数据段
        tcp_transmit_skb(sk, skb, 1, gfp);
        
        // 更新发送序列号
        tp->snd_nxt = TCP_SKB_CB(skb)->end_seq;
        
        // ...
    }
    
    // ...
}


```

##### 接收窗口的管理

接收窗口的大小取决于接收缓冲区的大小和当前已使用的空间：

```
// 简化版的tcp_select_window函数
u16 tcp_select_window(struct sock *sk)
{
    struct tcp_sock *tp = tcp_sk(sk);
    u32 cur_win = tcp_receive_window(tp);
    u32 new_win = __tcp_select_window(sk);
    
    // 确保窗口不会收缩
    if (new_win < cur_win) {
        new_win = cur_win;
    }
    
    // 限制窗口大小
    if (new_win > 65535)
        new_win = 65535;
    
    return new_win;
}


```

当接收数据时，TCP会检查数据是否在接收窗口内：

```
// 简化版的tcp_rcv_established函数
void tcp_rcv_established(struct sock *sk, struct sk_buff *skb,
                        const struct tcphdr *th, unsigned int len)
{
    // ...
    
    // 检查序列号是否在接收窗口内
    if (!tcp_sequence(tp, TCP_SKB_CB(skb)->seq, TCP_SKB_CB(skb)->end_seq)) {
        // 序列号不在接收窗口内，丢弃数据段
        // ...
        goto discard;
    }
    
    // 处理数据
    tcp_data_queue(sk, skb);
    
    // 更新接收序列号
    tp->rcv_nxt = TCP_SKB_CB(skb)->end_seq;
    
    // 发送确认和窗口更新
    tcp_send_ack(sk);
    
    // ...
}


```

##### 窗口更新

当接收方的窗口大小发生变化时，需要通知发送方。这通常通过发送ACK包实现：

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
    
    // 设置确认号
    th = tcp_hdr(buff);
    th->ack_seq = htonl(tp->rcv_nxt);
    
    // 设置窗口大小
    th->window = htons(tcp_select_window(sk));
    
    // 发送ACK包
    tcp_transmit_skb(sk, buff, 0, sk_gfp_atomic(sk, GFP_ATOMIC));
    
    // ...
}


```

当发送方收到窗口更新时，会更新自己的发送窗口：

```
// 简化版的tcp_ack函数
static bool tcp_ack(struct sock *sk, const struct sk_buff *skb, int flag)
{
    // ...
    
    // 检查是否需要更新窗口
    if (tcp_may_update_window(tp, ack, ack_seq, nwin)) {
        // 更新发送窗口
        tcp_update_wl(tp, ack_seq, ack);
        tp->snd_wnd = nwin;
        
        // 检查是否可以发送更多数据
        tcp_fast_path_check(sk);
    }
    
    // ...
}


```

#### 3.3.4 滑动窗口的实际应用

滑动窗口机制在TCP的实际应用中发挥着关键作用，它支持了多种重要功能：

##### 流量控制

滑动窗口的主要作用是实现流量控制，防止发送方发送过多数据导致接收方缓冲区溢出。通过动态调整窗口大小，接收方可以控制数据的接收速率，适应自己的处理能力。

##### 提高网络利用率

传统的停等协议（发送一个数据包，等待确认后再发送下一个）在高延迟网络中效率很低。滑动窗口允许发送方在收到确认前发送多个数据段，提高了网络利用率，特别是在高延迟网络中。

##### 支持批量确认

滑动窗口机制允许接收方使用累积确认，即一个确认可以确认多个数据段。这减少了确认的数量，降低了网络开销。

##### 与拥塞控制的协同

滑动窗口机制与拥塞控制机制协同工作，共同决定发送方的发送速率。拥塞窗口限制了发送方向网络中注入的数据量，防止网络拥塞；而接收窗口限制了发送方向接收方发送的数据量，防止接收方缓冲区溢出。

#### 3.3.5 滑动窗口的常见问题与优化

##### 窗口缩放问题

TCP头部中的窗口大小字段是16位的，最大值为65535字节。这在高带宽延迟积网络中可能不够用。为了解决这个问题，TCP引入了窗口缩放选项，允许将窗口大小乘以一个缩放因子（最大为14），从而支持最大约1GB的窗口。

在Linux内核中，窗口缩放的实现如下：

```
// 简化版的tcp_select_window函数
u16 tcp_select_window(struct sock *sk)
{
    // ...
    
    // 应用窗口缩放
    if (tp->rx_opt.rcv_wscale) {
        new_win = new_win >> tp->rx_opt.rcv_wscale;
    }
    
    // ...
}


```

##### 零窗口问题

如果接收方的缓冲区已满，它会通告一个零窗口，告诉发送方暂停发送数据。当接收方处理了一些数据后，它需要通知发送方恢复发送。但如果这个窗口更新包丢失了，可能会导致死锁：发送方一直等待窗口更新，而接收方认为发送方已经知道窗口已经打开。

为了解决这个问题，TCP引入了零窗口探测机制：当发送方收到零窗口通告时，会启动一个持续定时器，定期发送一个字节的数据（称为窗口探测包），强制接收方重新通告窗口大小。

在Linux内核中，零窗口探测的实现如下：

```
// 简化版的tcp_send_probe0函数
void tcp_send_probe0(struct sock *sk)
{
    // ...
    
    // 构建探测包
    buff = alloc_skb(MAX_TCP_HEADER, sk_gfp_atomic(sk, GFP_ATOMIC));
    if (!buff)
        return;
    
    // 设置TCP头部
    skb_reserve(buff, MAX_TCP_HEADER);
    tcp_init_nondata_skb(buff, tp->snd_una - 1, TCPHDR_ACK);
    
    // 发送探测包
    tcp_transmit_skb(sk, buff, 0, sk_gfp_atomic(sk, GFP_ATOMIC));
    
    // 重新启动持续定时器
    inet_csk_reset_xmit_timer(sk, ICSK_TIME_PROBE0,
                             min(icsk->icsk_rto << icsk->icsk_backoff, TCP_RTO_MAX),
                             TCP_RTO_MAX);
    
    // ...
}


```

##### 糊涂窗口综合症

糊涂窗口综合症（Silly Window Syndrome）是指接收方只处理了少量数据就急于通告窗口更新，或发送方收到小窗口更新就急于发送小数据段，导致网络中充斥着小数据段，降低了传输效率。

解决方法包括：

* **接收方延迟窗口更新**：只有当窗口大小达到一定阈值（如MSS或接收缓冲区的一半）时，才通告窗口更新
* **发送方延迟发送**：只有当可发送的数据量达到一定阈值（如MSS）时，才发送数据
* **Nagle算法**：将多个小数据段合并成一个大数据段发送，减少网络中的小数据段数量

在Linux内核中，这些优化的实现如下：

```
// 简化版的tcp_nagle_test函数
static bool tcp_nagle_test(const struct tcp_sock *tp, const struct sk_buff *skb,
                          unsigned int mss_now, int nonagle)
{
    // 检查是否启用Nagle算法
    if (nonagle & TCP_NAGLE_OFF)
        return true;
    
    // 如果有未确认的数据且数据大小小于MSS，延迟发送
    if ((nonagle & TCP_NAGLE_CORK) && tp->packets_out)
        return false;
    
    // 标准Nagle算法
    return (skb->len >= mss_now ||
            !tcp_packets_in_flight(tp) ||
            (TCP_SKB_CB(skb)->tcp_flags & TCPHDR_FIN));
}


```

##### 接收窗口自动调整

为了适应不同的网络环境和应用需求，现代TCP实现通常会自动调整接收窗口的大小。Linux内核实现了接收窗口自动调整机制，根据应用程序的读取速率和网络状况动态调整接收窗口的大小。

```
// 简化版的tcp_rcv_space_adjust函数
void tcp_rcv_space_adjust(struct sock *sk)
{
    // ...
    
    // 计算新的接收窗口大小
    if (tp->rcv_ssthresh < tp->window_clamp &&
        (tp->rcv_ssthresh <= tp->rcv_wnd ||
         (tp->rcv_wnd < tp->window_clamp &&
          tp->rcv_wnd < tp->rcv_ssthresh + 2 * tp->advmss))) {
        // 增加接收窗口
        tp->rcv_ssthresh = min(tp->rcv_ssthresh + tp->advmss, tp->window_clamp);
        tp->rcv_wnd = min(tp->rcv_wnd + tp->advmss, tp->window_clamp);
    }
    
    // ...
}


```

滑动窗口机制是TCP流量控制和可靠传输的核心机制，它通过动态调整窗口大小，实现了发送方和接收方之间的流量平衡。理解滑动窗口的原理和实现，对于优化网络应用和解决网络问题都有重要意义。

### 3.4 差错控制机制

差错控制是TCP可靠传输的重要组成部分，它确保了数据在传输过程中的完整性和正确性。TCP通过多种机制检测和处理传输过程中可能出现的错误，包括校验和、确认和重传、序列号和确认号以及超时机制等。

#### 3.4.1 差错控制的基本概念

\*\*差错控制（Error Control）\*\*是指检测和纠正传输过程中可能出现的错误的机制。在网络通信中，数据可能会因为多种原因而损坏或丢失，如信号衰减、电磁干扰、设备故障等。差错控制机制的目标是确保接收方能够正确地接收发送方发送的数据，或者至少能够检测到错误并请求重传。

TCP的差错控制主要解决以下几类问题：

* **位错误**：数据在传输过程中的某些位被错误地改变
* **丢包**：数据包在传输过程中完全丢失
* **重复**：同一个数据包被接收多次
* **乱序**：数据包的到达顺序与发送顺序不同

#### 3.4.2 TCP的差错控制机制

TCP使用多种机制来实现差错控制，主要包括：

##### 校验和（Checksum）

TCP使用校验和来检测数据在传输过程中是否被损坏。校验和是对TCP头部、数据以及一个伪头部（包含源IP地址、目的IP地址、协议号和TCP长度）进行计算得出的。

校验和的计算方法是：将所有16位字进行反码求和，然后取反码。接收方使用相同的算法计算校验和，如果结果为0，则认为数据完整；否则，认为数据已损坏，将丢弃该段。

校验和能够检测出大多数的位错误，但它不是一个强校验机制，某些特定模式的错误可能无法被检测出。为了提高可靠性，TCP通常与底层的错误检测机制（如以太网的CRC校验）结合使用。

##### 确认和重传

TCP使用确认和重传机制来处理丢包问题。当发送方发送数据后，会等待接收方的确认；如果在一定时间内没有收到确认，发送方会假定数据已丢失，并重新发送。

TCP使用累积确认机制，即确认号表示接收方已成功接收的所有数据的最高序列号加1。这意味着一个确认可以确认多个数据段，减少了确认的数量，但也可能导致不必要的重传。

为了提高效率，TCP还支持选择性确认（SACK）机制，允许接收方确认非连续的数据块，减少不必要的重传。

##### 序列号和确认号

TCP使用序列号和确认号来检测和处理重复和乱序的数据包。每个数据段都有一个唯一的序列号，接收方可以根据序列号识别重复的数据段并丢弃它们，也可以根据序列号重新排序乱序到达的数据段。

序列号和确认号机制确保了数据的有序交付，即使底层网络可能导致数据包乱序到达。

##### 超时机制

TCP使用超时机制来处理确认丢失的情况。当发送方在一定时间内没有收到确认时，会假定确认已丢失，并重新发送数据。

超时时间（RTO）是根据往返时间（RTT）的测量值动态计算的，以适应网络状况的变化。如果网络延迟增加，RTO会相应增加，减少不必要的重传；如果网络状况改善，RTO会逐渐减小，提高传输效率。

#### 3.4.3 差错控制在Linux内核中的实现

在Linux内核中，TCP的差错控制机制的实现涉及多个函数和数据结构。以下是一些关键的实现细节：

##### 校验和的计算和验证

TCP校验和的计算在`tcp_v4_send_check`函数中实现：

```
// 简化版的tcp_v4_send_check函数
void tcp_v4_send_check(struct sock *sk, struct sk_buff *skb)
{
    struct inet_sock *inet = inet_sk(sk);
    struct tcphdr *th = tcp_hdr(skb);
    
    // 计算校验和
    th->check = 0;
    th->check = tcp_v4_check(skb->len, inet->inet_saddr, inet->inet_daddr,
                            csum_partial(th, skb->len, 0));
}


```

校验和的验证在`tcp_v4_do_rcv`函数中实现：

```
// 简化版的tcp_v4_do_rcv函数
int tcp_v4_do_rcv(struct sock *sk, struct sk_buff *skb)
{
    // ...
    
    // 验证校验和
    if (!pskb_may_pull(skb, sizeof(struct tcphdr)) ||
        (skb_checksum_complete(skb))) {
        goto discard_it;
    }
    
    // ...
}


```

##### 确认和重传的实现

TCP的确认机制在`tcp_send_ack`函数中实现：

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
    
    // 设置确认号
    th = tcp_hdr(buff);
    th->ack_seq = htonl(tp->rcv_nxt);
    
    // 发送ACK包
    tcp_transmit_skb(sk, buff, 0, sk_gfp_atomic(sk, GFP_ATOMIC));
    
    // ...
}


```

重传机制在`tcp_retransmit_timer`函数中实现：

```
// 简化版的tcp_retransmit_timer函数
void tcp_retransmit_timer(struct sock *sk)
{
    // ...
    
    // 检查是否有未确认的数据
    if (!tp->packets_out)
        goto out;
    
    // 检查是否超过最大重传次数
    if (tcp_write_timeout(sk))
        goto out;
    
    // 执行超时重传
    tcp_retransmit_skb(sk, tcp_write_queue_head(sk));
    
    // 更新RTO（指数退避）
    icsk->icsk_rto = min(icsk->icsk_rto << 1, TCP_RTO_MAX);
    
    // 重新启动重传定时器
    inet_csk_reset_xmit_timer(sk, ICSK_TIME_RETRANS,
                             icsk->icsk_rto, TCP_RTO_MAX);
    
    // ...
    
out:
    // ...
}


```

##### 选择性确认（SACK）的实现

TCP的选择性确认机制在`tcp_sacktag_write_queue`函数中实现：

```
// 简化版的tcp_sacktag_write_queue函数
int tcp_sacktag_write_queue(struct sock *sk, const struct sk_buff *ack_skb,
                           u32 prior_snd_una)
{
    // ...
    
    // 解析SACK选项
    if (sack = TCP_SKB_CB(ack_skb)->sacked) {
        // 处理SACK块
        for (i = 0; i < num_sacks; i++) {
            start_seq = sack[i].start_seq;
            end_seq = sack[i].end_seq;
            
            // 标记已被选择性确认的数据段
            tcp_sacktag_one(sk, start_seq, end_seq, ...);
        }
    }
    
    // ...
}


```

#### 3.4.4 差错控制的实际应用

TCP的差错控制机制在实际应用中发挥着关键作用，确保了数据的可靠传输，特别是在网络状况不佳的情况下。以下是一些实际应用场景：

##### 处理网络丢包

在网络拥塞或链路质量差的情况下，数据包可能会丢失。TCP的确认和重传机制能够检测到这种丢失，并重新发送数据，确保数据的完整性。

##### 处理网络乱序

在复杂的网络环境中，数据包可能会走不同的路径，导致乱序到达。TCP的序列号机制能够重新排序这些数据包，确保应用程序收到的数据与发送时的顺序相同。

##### 处理数据损坏

数据在传输过程中可能会因为各种原因而损坏。TCP的校验和机制能够检测到这种损坏，并丢弃损坏的数据包，触发重传。

##### 适应网络状况变化

通过动态调整RTO，TCP能够适应网络状况的变化。当网络延迟增加时，RTO会相应增加，减少不必要的重传；当网络状况改善时，RTO会逐渐减小，提高传输效率。

#### 3.4.5 差错控制的常见问题与优化

##### 校验和的局限性

TCP校验和是一个相对简单的错误检测机制，它可能无法检测出某些特定模式的错误。此外，校验和的计算也会增加CPU负担。

优化方法包括：

* 使用硬件校验和卸载，减轻CPU负担
* 结合底层的错误检测机制，如以太网的CRC校验
* 在应用层实现更强的校验机制，如MD5或SHA-1校验

##### 重传歧义问题

当发生重传后，如果收到确认，无法确定这个确认是针对原始传输还是重传。这被称为重传歧义问题，它会影响RTT的测量和RTO的计算。

解决方法包括：

* 使用Karn算法：忽略重传数据段的RTT测量
* 使用时间戳选项：通过时间戳可以区分原始传输和重传的确认

##### 选择性确认的开销

选择性确认（SACK）机制可以提高重传效率，但它也增加了TCP头部的大小和处理复杂性。在某些资源受限的环境中，这可能是一个问题。

优化方法包括：

* 根据网络状况动态启用或禁用SACK
* 优化SACK的实现，减少处理开销
* 在特定场景下使用其他机制，如前向纠错（FEC）

##### 差错控制与拥塞控制的协同

TCP的差错控制机制与拥塞控制机制密切相关，它们共同决定了TCP的行为。在某些情况下，这两种机制可能会相互影响，导致性能下降。

优化方法包括：

* 区分拥塞丢包和非拥塞丢包，采取不同的策略
* 实现更智能的重传策略，如早期重传（Early Retransmit）
* 使用显式拥塞通知（ECN）等机制，提前感知网络拥塞

TCP的差错控制机制是其可靠传输的重要组成部分，它通过多种机制检测和处理传输过程中可能出现的错误，确保了数据的完整性和正确性。理解差错控制的原理和实现，对于优化网络应用和解决网络问题都有重要意义。
