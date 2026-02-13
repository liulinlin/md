# Obsidian 微信公众号排版插件 - 完整实施方案

> 将现有的 Markdown 转微信公众号排版功能移植到 Obsidian 插件
>
> 文档版本：v1.1（基于项目源码审查优化）
> 最后更新：2026-02-13

---

## 📋 目录

- [1. 可行性分析](#1-可行性分析)
- [2. 技术架构](#2-技术架构)
- [3. 功能设计](#3-功能设计)
- [4. 实施步骤](#4-实施步骤)
- [5. 部署方案](#5-部署方案)
- [6. 测试计划](#6-测试计划)

---

## 1. 可行性分析

### 1.1 核心优势

✅ **高度可行** - 核心渲染引擎 `@md/core` 是纯 TypeScript 实现，无框架依赖
✅ **成熟的实现参考** - VSCode 扩展提供了最小化集成模式（仅 4 个核心 API 调用）
✅ **跨平台兼容** - Obsidian 基于 Electron，所有浏览器端依赖（Mermaid、MathJax 等）可直接运行
✅ **Callout 原生支持** - `@md/core` 的 `markedAlert` 扩展已内置 Obsidian Callout 语法（20+ 变体）

### 1.2 关键挑战

| 挑战                  | 影响 | 解决方案                                                                           |
| --------------------- | ---- | ---------------------------------------------------------------------------------- |
| Obsidian 特有语法处理 | 中   | 仅需处理 `[[wikilink]]`、`![[embed]]`、`%%注释%%`；Callout 已由 `markedAlert` 支持 |
| MathJax 脚本加载      | 中   | `@md/core` 的 KaTeX 扩展依赖 `window.MathJax`，需在 Webview 中注入 CDN 脚本        |
| 图片路径处理          | 中   | 集成图床上传或转换为 base64，利用 Obsidian Vault API 读取本地图片                  |
| 移动端性能            | 低   | 禁用 Mermaid/Infographic 重度扩展                                                  |
| CSS 作用域            | 低   | `ThemeInjector` 注入 `<style>` 到 `document.head`，需确认 Obsidian Webview 隔离性  |

---

## 2. 技术架构

### 2.1 整体架构

```
apps/obsidian/                    # 新增插件目录
├── src/
│   ├── main.ts                   # 插件入口（集成 @md/core 渲染）
│   ├── views/
│   │   └── preview-view.ts       # 独立预览面板（Webview）
│   ├── settings/
│   │   └── settings-tab.ts       # 设置界面（复用 @md/shared/configs 选项）
│   ├── core/
│   │   ├── preprocessor.ts       # Obsidian 语法预处理
│   │   └── clipboard.ts          # 剪贴板处理（juice CSS 内联）
│   ├── utils/
│   │   └── image-uploader.ts     # 图片上传
│   └── types/
│       └── index.ts              # TypeScript 类型定义
├── styles/
│   └── styles.css                # 插件样式（工具栏、预览容器）
├── manifest.json                 # 插件元数据
├── versions.json                 # 版本兼容性
├── esbuild.config.mjs            # 构建配置
├── package.json
└── README.md
```

### 2.2 核心依赖

> 以下依赖基于 VSCode 扩展（`apps/vscode/package.json`）的实际集成模式整理。

```json
{
  "dependencies": {
    "@md/core": "workspace:*", // 核心渲染引擎（initRenderer, modifyHtmlContent, generateCSSVariables）
    "@md/shared": "workspace:*", // 共享配置（themeMap, baseCSSContent, colorOptions 等）
    "isomorphic-dompurify": "^2.35.0", // @md/core 的 peer dependency，XSS 清洗
    "juice": "^10.0.0" // CSS 内联（复制到微信时使用）
  },
  "devDependencies": {
    "@types/node": "^20.14.9",
    "@types/obsidian": "^1.7.2",
    "builtin-modules": "^4.0.0", // esbuild external 配置需要
    "esbuild": "^0.23.1",
    "obsidian": "latest",
    "typescript": "^5.9.0"
  }
}
```

### 2.3 渲染流程

> 基于 `@md/core` 实际 API（参考 `apps/vscode/src/extension.ts` 集成模式）。

```
用户触发（打开预览 / 文档变更）
    ↓
预处理 Obsidian 语法
    ├── resolveWikiLinks()     [[link]] → [link](path)
    ├── resolveEmbeds()        ![[file]] → 展开内容 / 上传图片
    └── 移除 %%注释%%
    ↓
modifyHtmlContent(markdown, renderer)
    └── 内部已封装: marked.parse() + 扩展处理 + DOMPurify 清洗
    ↓
组装 CSS（顺序重要）
    ├── 1. generateCSSVariables({ primaryColor, fontFamily, fontSize, ... })
    ├── 2. baseCSSContent（from @md/shared）
    ├── 3. themeMap[currentTheme]（from @md/shared，scoped to #output）
    └── 4. customCSS（用户自定义，最高优先级）
    ↓
注入到预览面板 Webview HTML
    ↓
复制时: juice 内联所有 CSS → ClipboardItem API
```

---

## 3. 功能设计

### 3.1 功能模式：独立预览面板

**设计决策**：采用侧边栏独立视图模式（类似 PDF 预览）

**原因**：

- ✅ 不干扰 Obsidian 原生编辑/预览体验
- ✅ 避免与其他插件冲突
- ✅ 支持并排对比（编辑器 + 预览）
- ✅ 实现简单，性能可控

**用户体验**：

```
┌──────────────────┬──────────────────┐
│                  │                  │
│   编辑器窗口      │  公众号预览面板   │
│   (原生 MD)      │  (样式化输出)    │
│                  │                  │
│                  │  [主题选择]       │
│                  │  [复制] [刷新]    │
│                  │                  │
│                  │  渲染结果...      │
└──────────────────┴──────────────────┘
```

### 3.2 扩展支持

> 以下扩展均已在 `@md/core/extensions/` 中实现，可直接复用。

| 扩展                    | 桌面端 | 移动端 | 说明                                                    |
| ----------------------- | ------ | ------ | ------------------------------------------------------- |
| **数学公式** (MathJax)  | ✅     | ✅     | 依赖 `window.MathJax`，需在 Webview 中加载 MathJax CDN  |
| **Mermaid 流程图**      | ✅     | ❌     | 依赖 DOM，移动端显示占位符或源码                        |
| **代码高亮**            | ✅     | ✅     | highlight.js，30+ 常用语言预注册，支持 CDN 动态加载更多 |
| **GFM Alert / Callout** | ✅     | ✅     | `markedAlert` 已支持 Obsidian Callout 语法（20+ 变体）  |
| **脚注引用**            | ✅     | ✅     | `markedFootnotes`，底部汇总显示                         |
| **Ruby 注音**           | ✅     | ✅     | `[文字]{读音}` 和 `[文字]^(读音)` 两种语法              |
| **高亮/下划线/波浪线**  | ✅     | ✅     | `==高亮==` `++下划线++` `~波浪线~`                      |
| **PlantUML**            | ⚠️     | ⚠️     | 需外部服务器渲染，可选                                  |
| **TOC 目录**            | ✅     | ✅     | `[TOC]` 自动生成目录（`markedToc`）                     |
| **图片滑动**            | ✅     | ✅     | `<![](url),![](url)>` 水平滚动图片组（`markedSlider`）  |
| **信息图表**            | ✅     | ❌     | `@antv/infographic`，仅桌面端（`markedInfographic`）    |
| **图片上传**            | ✅     | ✅     | 支持多种图床服务                                        |
| **Obsidian 语法**       | ✅     | ✅     | `[[链接]]` `![[嵌入]]` 转换（需预处理器）               |

### 3.3 主题系统

**五层架构**（基于 `@md/core/theme/themeApplicator.ts` 实际处理顺序）：

```
1. CSS Variables    — generateCSSVariables({ primaryColor, fontFamily, fontSize, ... })
       ↓
2. Base CSS         — baseCSSContent（from @md/shared，全局基础样式）
       ↓
3. Theme CSS        — themeMap[themeName]（from @md/shared，scoped to #output）
       ↓
4. Heading Styles   — generateHeadingStyles()（可选，按级别自定义标题样式）
       ↓
5. Custom CSS       — 用户自定义 CSS（最高优先级）
       ↓
   PostCSS Processing — calc 简化、CSS 变量替换
```

**核心 API 调用**（参考 `apps/vscode/src/extension.ts`）：

```typescript
import { generateCSSVariables } from '@md/core/theme'
import { baseCSSContent, themeMap } from '@md/shared'

// 组装完整 CSS
const variables = generateCSSVariables({
  primaryColor: settings.primaryColor,
  fontFamily: settings.fontFamily,
  fontSize: settings.fontSize,
  isUseIndent: settings.isUseIndent,
  isUseJustify: settings.isUseJustify,
})
const themeCSS = themeMap[settings.theme] // 'default' | 'grace' | 'simple'
const completeCss = `${variables}\n\n${baseCSSContent}\n\n${themeCSS}\n\n${customCSS}`
```

**可配置选项**：

1. **预设主题** (3 个内置)

   - `default` - 默认主题
   - `grace` - 优雅主题
   - `simple` - 简洁主题

2. **颜色配置**

   - 主色调 (Primary Color) — 11 个预设色（经典蓝、翡翠绿等，来自 `colorOptions`）

3. **排版选项**

   - 字体族（Sans-serif / Serif / Monospace，来自 `fontFamilyOptions`）
   - 字号（14px - 18px，来自 `fontSizeOptions`）
   - 行高（1.5 - 2.0）
   - 首行缩进（开/关）
   - 两端对齐（开/关）

4. **代码块样式**

   - Mac 风格窗口
   - 显示行号
   - 语言标签

5. **高级自定义**
   - CSS 编辑器（仅桌面端）
   - 支持完整 CSS 语法
   - 实时预览效果

### 3.4 Obsidian 语法处理

**需要转换的语法**：

| Obsidian 语法     | 转换结果               | 处理逻辑                    |
| ----------------- | ---------------------- | --------------------------- |
| `[[笔记名称]]`    | `[笔记名称](相对路径)` | 使用 MetadataCache API 解析 |
| `[[笔记\|别名]]`  | `[别名](相对路径)`     | 提取别名作为显示文本        |
| `![[图片.png]]`   | `![](图片URL)`         | 读取文件并上传/转 base64    |
| `![[笔记]]`       | 展开笔记内容           | 递归读取（限制深度 1 级）   |
| `![[PDF#page=3]]` | 移除或转为链接         | 微信不支持嵌入              |
| `#标签`           | 保持或移除             | 可配置                      |
| `%%注释%%`        | 移除                   | 注释不显示                  |

**实现示例**：

> 注意：`getFirstLinkpathDest` 是同步 API，`resolveWikiLinks` 无需 async。
> `resolveEmbeds` 使用从后往前替换，避免 offset 偏移导致的错误替换。

```typescript
class ObsidianSyntaxPreprocessor {
  constructor(
    private app: App,
    private currentFile: TFile,
    private settings: PluginSettings
  ) {}

  async process(markdown: string): Promise<string> {
    // 1. 处理 Wiki 链接（同步操作）
    markdown = this.resolveWikiLinks(markdown)

    // 2. 处理嵌入（异步：涉及文件读取和图片上传）
    markdown = await this.resolveEmbeds(markdown)

    // 3. 移除注释
    markdown = markdown.replace(/%%.*?%%/gs, '')

    // 4. 处理标签（可选）
    if (this.settings.removeTags) {
      markdown = markdown.replace(/#[\w\u4E00-\u9FFF-]+/g, '')
    }

    return markdown
  }

  // 同步方法：getFirstLinkpathDest 是同步 API
  private resolveWikiLinks(markdown: string): string {
    const linkRegex = /\[\[([^\]|]+)(\|([^\]]+))?\]\]/g

    return markdown.replace(linkRegex, (match, target, _, alias) => {
      const file = this.app.metadataCache
        .getFirstLinkpathDest(target, this.currentFile.path)

      if (!file)
        return alias || target // 链接失效，保持文本

      const displayText = alias || target
      return `[${displayText}](${this.getRelativePath(file)})`
    })
  }

  private async resolveEmbeds(markdown: string): Promise<string> {
    const embedRegex = /!\[\[([^\]]+)\]\]/g
    const matches = [...markdown.matchAll(embedRegex)]

    // 从后往前替换，避免 offset 偏移导致错误替换
    for (const match of matches.reverse()) {
      const target = match[1]
      const file = this.app.metadataCache
        .getFirstLinkpathDest(target, this.currentFile.path)

      if (!file || match.index === undefined)
        continue

      let replacement = ''

      if (file.extension.match(/^(png|jpg|jpeg|gif|svg|webp)$/i)) {
        // 图片：上传并替换 URL
        const url = await this.uploadImage(file)
        replacement = `![](${url})`
      }
      else if (file.extension === 'md') {
        // 笔记：展开内容（限制深度 1 级，不递归处理嵌入）
        const content = await this.app.vault.read(file)
        replacement = content
      }
      else {
        // 其他类型：转为链接
        replacement = `[${file.name}](${this.getRelativePath(file)})`
      }

      // 使用精确位置替换，避免重复内容误替换
      markdown = markdown.slice(0, match.index)
        + replacement
        + markdown.slice(match.index + match[0].length)
    }

    return markdown
  }
}
```

### 3.5 图片上传

**支持的图床服务**（复用 Web 版配置）：

1. **SM.MS** - 免费 5GB
2. **阿里云 OSS**
3. **腾讯云 COS**
4. **七牛云**
5. **GitHub** - 利用仓库存储
6. **自定义服务器** - 支持自部署

**上传流程**：

```typescript
class ImageUploader {
  async processImages(markdown: string): Promise<string> {
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
    const matches = [...markdown.matchAll(imageRegex)]

    for (const match of matches) {
      const [fullMatch, alt, originalPath] = match

      // 跳过已经是 HTTP 的图片
      if (originalPath.startsWith('http'))
        continue

      // 解析本地路径
      const file = this.resolveImagePath(originalPath)
      if (!file)
        continue

      // 上传图片
      const publicUrl = await this.upload(file)

      // 替换 URL
      markdown = markdown.replace(
        fullMatch,
        `![${alt}](${publicUrl})`
      )
    }

    return markdown
  }

  private async upload(file: TFile): Promise<string> {
    const cacheKey = `upload_${file.path}_${file.stat.mtime}`

    // 检查缓存
    const cached = this.cache.get(cacheKey)
    if (cached)
      return cached

    // 读取文件
    const content = await this.app.vault.readBinary(file)

    // 调用上传服务
    const url = await this.uploadProvider.upload({
      name: file.name,
      data: content,
      type: this.getMimeType(file.extension)
    })

    // 缓存结果
    this.cache.set(cacheKey, url)

    return url
  }
}
```

---

## 4. 实施步骤

### 4.1 项目初始化

**Step 1: 创建插件目录结构**

```bash
# 在项目根目录执行
mkdir -p apps/obsidian/{src/{views,settings,core,utils,types},styles}
```

在 `apps/obsidian/package.json` 创建：

```json
{
  "name": "@md/obsidian",
  "version": "1.0.0",
  "description": "Obsidian plugin for converting Markdown to WeChat format",
  "main": "main.js",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "tsc -noEmit && node esbuild.config.mjs production",
    "version": "node version-bump.mjs && git add manifest.json versions.json"
  },
  "keywords": ["obsidian", "wechat", "markdown"],
  "dependencies": {
    "@md/core": "workspace:*",
    "@md/shared": "workspace:*",
    "isomorphic-dompurify": "^2.35.0",
    "juice": "^10.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.9",
    "@types/obsidian": "^1.7.2",
    "builtin-modules": "^4.0.0",
    "esbuild": "^0.23.1",
    "obsidian": "latest",
    "typescript": "^5.9.0"
  }
}
```

**Step 2: 配置 TypeScript**

`apps/obsidian/tsconfig.json`:

```json
{
  "extends": "../../packages/config/tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "target": "ES2021",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "outDir": "./dist",
    "lib": ["ES2021", "DOM"],
    "types": ["node"],
    "paths": {
      "@md/core/*": ["../../packages/core/src/*"],
      "@md/shared/*": ["../../packages/shared/src/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Step 3: 配置构建工具**

`apps/obsidian/esbuild.config.mjs`:

```javascript
import { copyFile, mkdir } from 'node:fs/promises'
import process from 'node:process'
import builtins from 'builtin-modules'
import esbuild from 'esbuild'

const banner = `/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
Repository: https://github.com/doocs/md
*/`

const prod = process.argv[2] === 'production'

const context = await esbuild.context({
  banner: { js: banner },
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: [
    'obsidian',
    'electron',
    '@codemirror/*',
    ...builtins
  ],
  format: 'cjs',
  target: 'es2021',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  outfile: prod ? 'dist/main.js' : 'main.js',
  minify: prod,
  define: {
    'process.env.NODE_ENV': JSON.stringify(prod ? 'production' : 'development')
  },
  loader: {
    '.css': 'text', // CSS 文件作为字符串内联（与 VSCode 扩展一致）
    '.txt': 'text'
  }
})

if (prod) {
  await context.rebuild()
  await context.dispose()

  // 复制必需文件到 dist/（与 main.js 同目录）
  await mkdir('dist', { recursive: true })
  await copyFile('manifest.json', 'dist/manifest.json')
  await copyFile('styles/styles.css', 'dist/styles.css')

  console.log('Build complete!')
}
else {
  await context.watch()
  console.log('Watching for changes...')
}
```

**Step 4: 创建元数据文件**

`apps/obsidian/manifest.json`:

```json
{
  "id": "wechat-publisher",
  "name": "WeChat Publisher",
  "version": "1.0.0",
  "minAppVersion": "1.4.0",
  "description": "将 Markdown 文档转换为微信公众号排版格式，支持自定义主题、数学公式、Mermaid 图表、代码高亮等功能。",
  "author": "Doocs",
  "authorUrl": "https://github.com/doocs/md",
  "fundingUrl": "https://github.com/doocs/md#donate",
  "isDesktopOnly": false
}
```

`apps/obsidian/versions.json`:

```json
{
  "1.0.0": "1.4.0"
}
```

### 4.2 核心功能实现

**Step 5: 插件主入口**

> 核心集成模式参考 `apps/vscode/src/extension.ts`，仅需 4 个 API 调用。

`apps/obsidian/src/main.ts` 关键逻辑：

```typescript
import { initRenderer } from '@md/core/renderer'
import { generateCSSVariables } from '@md/core/theme'
import { modifyHtmlContent } from '@md/core/utils'
import { baseCSSContent, themeMap } from '@md/shared'
import { Plugin, WorkspaceLeaf } from 'obsidian'

export default class WeChatPublisherPlugin extends Plugin {
  renderer = initRenderer({
    isMacCodeBlock: false,
    legend: 'none',
  })

  renderToHtml(markdown: string): { html: string, css: string } {
    // 1. 更新渲染器配置
    this.renderer.reset({
      citeStatus: this.settings.citeStatus,
      isMacCodeBlock: this.settings.isMacCodeBlock,
      isShowLineNumber: this.settings.isShowLineNumber,
      legend: this.settings.legend,
    })

    // 2. 渲染 Markdown → HTML（内部已封装 marked + DOMPurify + 扩展）
    const html = modifyHtmlContent(markdown, this.renderer)

    // 3. 组装 CSS（顺序重要）
    const variables = generateCSSVariables({
      primaryColor: this.settings.primaryColor,
      fontFamily: this.settings.fontFamily,
      fontSize: this.settings.fontSize,
      isUseIndent: this.settings.isUseIndent,
      isUseJustify: this.settings.isUseJustify,
    })
    const themeCSS = themeMap[this.settings.theme]
    const css = `${variables}\n${baseCSSContent}\n${themeCSS}\n${this.settings.customCSS}`

    return { html, css }
  }
}
```

完整的实现代码包括：

- 插件主入口 (`main.ts`) — 生命周期管理、命令注册
- 预览视图 (`preview-view.ts`) — Webview 渲染、工具栏
- 语法预处理器 (`preprocessor.ts`) — Wiki 链接、嵌入、注释处理
- 剪贴板处理器 (`clipboard.ts`) — juice CSS 内联 + ClipboardItem API
- 图片上传器 (`image-uploader.ts`) — 多图床支持、缓存
- 设置面板 (`settings-tab.ts`) — 复用 `@md/shared/configs` 选项列表
- 类型定义 (`types/index.ts`)

### 4.3 样式文件

**Step 13: 插件样式**

`apps/obsidian/styles/styles.css` - 包含工具栏样式、预览容器样式、移动端适配等。

---

## 5. 部署方案

### 5.1 本地开发测试

```bash
# 1. 设置环境变量（指向测试仓库）
export OBSIDIAN_VAULT_PATH="/Users/liulinlin/obsidian_仓库/AI杂货铺"

# 2. 安装依赖
pnpm install

# 3. 监听文件变化（开发模式）
pnpm --filter @md/obsidian dev

# 4. 部署到测试仓库
pnpm --filter @md/obsidian deploy

# 5. 在 Obsidian 中启用插件
# Settings → Community plugins → Reload plugins
# 启用 "WeChat Publisher"
```

**热重载调试**：

- Obsidian 开发者工具：`Cmd+Option+I` (Mac) 或 `Ctrl+Shift+I` (Win/Linux)
- 每次修改代码后按 `Cmd+R` 重载 Obsidian

### 5.2 构建生产版本

```bash
# 构建
pnpm --filter @md/obsidian build

# 打包发布文件（构建产物在 dist/ 目录）
cd apps/obsidian
zip -r wechat-publisher-v1.0.0.zip dist/main.js dist/manifest.json dist/styles.css
```

### 5.3 手动安装（用户）

用户安装步骤：

1. 下载 `wechat-publisher-v1.0.0.zip`
2. 解压到 Obsidian 仓库的插件目录：`<vault>/.obsidian/plugins/wechat-publisher/`
3. 重启 Obsidian
4. Settings → Community plugins → Enable "WeChat Publisher"

### 5.4 官方插件市场发布

**前置要求**：

- GitHub 公开仓库
- 至少 1 个 Release 版本
- README 包含使用说明
- MIT 或类似开源许可证

**首次发布流程**：

```bash
# 1. 创建独立仓库（或使用 Git Subtree）
git remote add obsidian-plugin git@github.com:yourusername/obsidian-wechat-publisher.git

# 2. 推送插件代码
git subtree push --prefix=apps/obsidian obsidian-plugin main

# 3. 创建 Release
git tag 1.0.0
git push obsidian-plugin --tags
```

**提交到官方仓库**：

1. Fork [obsidianmd/obsidian-releases](https://github.com/obsidianmd/obsidian-releases)
2. 编辑 `community-plugins.json` 添加插件信息
3. 提交 Pull Request
4. 等待审核（通常 1-2 周）

### 5.5 CI/CD 自动化

创建 `.github/workflows/release-obsidian.yml` 实现自动化构建和发布。

### 5.6 Beta 测试渠道

使用 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 插件进行测试版分发。

---

## 6. 测试计划

### 6.1 功能测试矩阵

| 功能        | 桌面端 Windows | 桌面端 macOS | 桌面端 Linux | 移动端 iOS | 移动端 Android |
| ----------- | -------------- | ------------ | ------------ | ---------- | -------------- |
| 基础渲染    | ✅             | ✅           | ✅           | ✅         | ✅             |
| 数学公式    | ✅             | ✅           | ✅           | ✅         | ✅             |
| Mermaid     | ✅             | ✅           | ✅           | ⚠️ 降级    | ⚠️ 降级        |
| Infographic | ✅             | ✅           | ✅           | ❌ 禁用    | ❌ 禁用        |
| 代码高亮    | ✅             | ✅           | ✅           | ✅         | ✅             |
| 主题切换    | ✅             | ✅           | ✅           | ✅         | ✅             |
| 剪贴板复制  | ✅             | ✅           | ✅           | ⚠️ 待测    | ⚠️ 待测        |
| 图片上传    | ✅             | ✅           | ✅           | ✅         | ✅             |
| Wiki 链接   | ✅             | ✅           | ✅           | ✅         | ✅             |
| 嵌入解析    | ✅             | ✅           | ✅           | ✅         | ✅             |
| TOC 目录    | ✅             | ✅           | ✅           | ✅         | ✅             |
| 自定义 CSS  | ✅             | ✅           | ✅           | ❌ 禁用    | ❌ 禁用        |

### 6.2 测试用例

创建 `test-cases.md` 测试文档，涵盖所有功能点。

### 6.3 性能测试

- **渲染时间** < 2 秒（5000 行文档）
- **内存占用** < 100MB
- **无明显卡顿**

### 6.4 兼容性测试

测试与 Dataview、Tasks、Kanban 等常见插件的共存。

---

## 7. 附录

### 7.1 关键文件路径速查

```
apps/obsidian/
├── src/
│   ├── main.ts                      # 插件入口（集成 @md/core）
│   ├── views/preview-view.ts        # 预览视图
│   ├── settings/settings-tab.ts     # 设置面板
│   ├── core/
│   │   ├── preprocessor.ts          # 语法预处理
│   │   └── clipboard.ts             # 剪贴板处理
│   ├── utils/
│   │   └── image-uploader.ts        # 图片上传
│   └── types/index.ts               # 类型定义
├── styles/styles.css                # 样式文件
├── manifest.json                    # 插件元数据
├── versions.json                    # 版本兼容
├── esbuild.config.mjs               # 构建配置
└── package.json                     # 依赖管理
```

### 7.2 常见问题 FAQ

**Q: 为什么不需要单独的 renderer.ts 包装类？**
A: `@md/core` 已提供完整的 API（`initRenderer` + `modifyHtmlContent` + `generateCSSVariables`），VSCode 扩展验证了直接调用即可，无需额外封装层。

**Q: 为什么选择独立视图而不是替换原生渲染？**
A: 避免与其他插件冲突，保持 Obsidian 原生体验，用户可自由选择使用。

**Q: 移动端为什么禁用 Mermaid？**
A: Mermaid 渲染需要较多 DOM 操作，移动端性能有限，显示占位符或源码。

**Q: 图片上传失败怎么办？**
A: 检查网络连接、API Token 配置，或切换到 base64 内嵌模式（不推荐）。

**Q: 如何处理循环嵌入？**
A: 限制嵌入展开深度为 1 级，避免无限递归。

**Q: 自定义 CSS 不生效？**
A: 确保 CSS 语法正确，使用开发者工具查看样式优先级。

### 7.3 参考资源

- [Obsidian 插件开发文档](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [Obsidian API 参考](https://github.com/obsidianmd/obsidian-api)
- [现有项目文档](./CLAUDE.md)
- [VSCode 扩展实现](apps/vscode/src/extension.ts) — 最小化集成模式参考
- [核心渲染器](packages/core/src/renderer/renderer-impl.ts) — `initRenderer()` API
- [核心工具函数](packages/core/src/utils/markdownHelpers.ts) — `modifyHtmlContent()` / `renderMarkdown()`
- [主题系统](packages/core/src/theme/) — `generateCSSVariables()` / `applyTheme()`
- [扩展系统](packages/core/src/extensions/) — 10 个 marked 扩展
- [共享配置](packages/shared/src/configs/) — 选项列表、主题 CSS、样式常量
- [Web 版渲染逻辑](apps/web/src/stores/render.ts) — 完整渲染管线参考

---

## 总结

将微信公众号排版功能做成 Obsidian 插件**完全可行**：

- 核心渲染通过 `initRenderer()` + `modifyHtmlContent()` + `generateCSSVariables()` 三个 API 集成
- `markedAlert` 已原生支持 Obsidian Callout 语法，预处理器仅需处理 Wiki 链接、嵌入和注释
- Obsidian 基于 Electron，所有浏览器端扩展（Mermaid、MathJax 等）桌面端可直接运行

**立即开始？**运行以下命令创建项目结构：

```bash
mkdir -p apps/obsidian/{src/{views,settings,core,utils,types},styles}
cd apps/obsidian
pnpm init
```
