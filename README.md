# 个人学习知识库

基于 Astro Starlight 构建的个人学习与知识管理网站，用于整理知识专题、学习路线和问题复盘。

## 当前阶段

仓库已经完成最小可运行基线：

- Astro Starlight 站点
- 知识专题、学习路线、问题复盘和关于本站四个入口
- 统一的笔记元数据校验
- GitHub Actions 自动检查和构建

现阶段只建立内容框架，具体分类将在现有笔记盘点后确定。

## 本地环境

- Node.js 22.12 或更高版本
- npm 10 或更高版本

使用 nvm 时可以执行：

```bash
nvm install
nvm use
```

## 本地运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run check
npm run build
```

## 内容目录

```text
src/content/docs/
├── index.mdx
├── knowledge/
├── learning-paths/
├── retrospectives/
└── about.md
```

Markdown 和 MDX 文件会根据 `src/content/docs/` 下的路径生成对应页面。

## 笔记元数据

```yaml
---
title: Redis 分布式锁实践
description: 分析常见失效场景及验证方法
created: 2026-07-10
updated: 2026-07-10
category: distributed-system
tags:
  - Redis
  - 并发控制
status: verified
difficulty: intermediate
contentType: practice
source: project-practice
---
```

`status` 可选值：`draft`、`verified`、`evergreen`、`outdated`。

`contentType` 可选值：`knowledge`、`practice`、`retrospective`、`source-analysis`、`learning-path`。

## 下一步

1. 盘点现有 Markdown 笔记。
2. 确认一级分类和标签边界。
3. 选择首批 15～30 篇内容。
4. 将审核通过的内容复制到本仓库。
5. 配置 GitHub 远程仓库与线上部署。
