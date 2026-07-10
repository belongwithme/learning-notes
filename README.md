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
category: distributed-systems
subcategory: consistency
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

## CSDN 历史文章导入

CSDN 导出文件位于 `/Users/wangyi/csdn-article-export/exports` 时，可使用项目内的可重复导入脚本：

```bash
node scripts/import-csdn.mjs
```

脚本会根据专栏和文章标题归类，生成“专题 / 二级知识域 / 文章”的三级结构，补充统一元数据，清理 CSDN 代码行号和页面残留，并把正文引用的图片复制到二级知识域下的 `assets/<文章ID>/` 目录。首次导入的文章统一为 `status: draft`，导入报告写入 `scripts/csdn-import-report.json`。

```text
src/content/docs/knowledge/java-backend/
├── index.mdx
├── java-language/
│   ├── java-backend-135635990.md
│   └── assets/135635990/
├── concurrency/
├── jvm-runtime/
└── spring/
```

默认情况下已存在的文章会跳过；确认要重新生成时使用 `--force`。更换导出目录时使用 `--source /path/to/exports`。导入后运行 `npm run check` 和 `npm run build` 验收。

## 下一步

1. 按专题逐篇检查当前的 `draft` 文章。
2. 为需要长期维护的文章补充版本边界、实验条件和验证证据。
3. 将确认可靠的文章改为 `verified` 或 `evergreen`。
4. 配置 GitHub 远程仓库与线上部署。
