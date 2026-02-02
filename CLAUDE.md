# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

微信 Markdown 编辑器 - 一款将 Markdown 文档自动渲染为微信公众号图文的工具。支持多平台部署（Web、Chrome/Firefox 扩展、VSCode 插件、uTools 插件、CLI）。

## 常用命令

```bash
# 安装依赖
pnpm install

# 启动 Web 开发服务器 (http://localhost:5173/md/)
pnpm web dev

# 构建生产版本
pnpm web build                # 部署在 /md 目录
pnpm web build:h5-netlify     # 部署在根目录

# 代码检查
pnpm lint                     # ESLint + Prettier
pnpm type-check               # TypeScript 类型检查

# 浏览器扩展
pnpm web ext:dev              # Chrome 扩展开发模式
pnpm web ext:zip              # Chrome 扩展打包
pnpm web firefox:zip          # Firefox 扩展打包

# Cloudflare Workers
pnpm web wrangler:dev         # 开发模式
pnpm web wrangler:deploy      # 部署

# CLI 工具
pnpm build:cli                # 构建 CLI
```

## 项目架构

### Monorepo 结构 (pnpm workspace)

```
apps/
  web/          # 主 Web 应用 (Vue 3 + Vite + WXT 浏览器扩展)
  vscode/       # VSCode 插件 (Webpack)
  utools/       # uTools 插件

packages/
  core/         # 核心 Markdown 渲染引擎
  shared/       # 共享配置、常量、类型、工具函数
  config/       # 项目级 TypeScript 配置
  md-cli/       # 命令行工具
```

### 核心技术栈

- **前端**: Vue 3.5 + TypeScript 5.9 + Vite 7 + Tailwind CSS 4
- **编辑器**: CodeMirror 6
- **Markdown**: marked 17 + 自定义扩展
- **状态管理**: Pinia 3
- **UI 组件**: Radix Vue / Reka UI

### 核心渲染流程

`@md/core` 包负责 Markdown 到 HTML 的转换：

1. **入口**: `packages/core/src/renderer/renderer-impl.ts` - `initRenderer()` 函数
2. **扩展系统**: `packages/core/src/extensions/` - 支持 KaTeX、Mermaid、PlantUML、GFM Alert、Ruby 注音等
3. **主题系统**: `packages/core/src/theme/` - CSS 变量处理、主题注入、样式导出

### Web 应用状态管理

`apps/web/src/stores/` 包含多个 Pinia store：

- `editor.ts` - 编辑器状态
- `render.ts` - 渲染配置
- `theme.ts` - 主题设置
- `aiConfig.ts` - AI 助手配置
- `post.ts` - 文章内容管理

### 包导出约定

`@md/core` 和 `@md/shared` 使用子路径导出：

```typescript
import { initRenderer } from '@md/core/renderer'
import { COMMON_LANGUAGES } from '@md/shared/constants'
import { IOpts } from '@md/shared/types'
```

## 开发规范

### 提交信息格式

```
<type>(<scope>): <description>

类型: feat | fix | docs | style | refactor | perf | test | build | chore
示例: feat(editor): 支持自定义快捷键
```

### 分支命名

```
feat/<简要描述>
fix/<简要描述>
docs/<简要描述>
```

## 环境要求

- Node.js >= 22.16.0
- pnpm >= 10
