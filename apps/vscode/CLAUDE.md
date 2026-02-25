# VSCode 插件优化方案 — 借鉴 Obsidian 插件功能

## Context

VSCode 插件（`apps/vscode/`）目前功能非常基础，仅有预览 + 6 项设置。Obsidian 插件（`apps/obsidian/`）功能丰富得多，包含复制到剪贴板、微信推送、AI 润色、URL 导入、丰富的渲染设置等。两个插件共用 `@md/core` 和 `@md/shared`，很多功能可以低成本移植。

## 现状对比

| 功能                   | VSCode             | Obsidian             |
| ---------------------- | ------------------ | -------------------- |
| Markdown 预览          | ✅                 | ✅                   |
| 实时更新               | ✅                 | ✅（300ms debounce） |
| 复制到剪贴板（富文本） | ❌                 | ✅ juice CSS 内联    |
| 本地图片显示           | ❌                 | ✅                   |
| 字号/字体/主题/主题色  | ✅                 | ✅                   |
| 首行缩进/两端对齐      | ❌（硬编码 false） | ✅                   |
| 链接脚注/行号/图片标题 | ❌（硬编码 none）  | ✅                   |
| 自定义 CSS             | ❌                 | ✅                   |
| 微信推送               | ❌                 | ✅ 多账号            |
| AI 润色                | ❌                 | ✅                   |
| URL 导入               | ❌                 | ✅                   |

## 优化方案（按优先级分阶段）

### Phase 1: 核心功能补齐

#### 1.1 复制到剪贴板（最关键缺失功能）

没有复制功能，用户无法将渲染结果粘贴到微信编辑器，插件基本不可用。

**实现方式：**

- 添加 `juice` 依赖，在 extension host（Node.js）侧做 CSS 内联
- 通过 `postMessage` 将内联后的 HTML 发送到 webview
- webview 内用 `ClipboardItem` API 写入 `text/html` 富文本到剪贴板
- 参考：`apps/obsidian/src/core/clipboard.ts` 的 `inlineCSS()` 可直接复用

**修改文件：**

- `apps/vscode/package.json` — 添加 `juice` 依赖，注册 `markdown.copyToClipboard` 命令
- `apps/vscode/src/extension.ts` — 添加 copy 命令，缓存最新 html/css，webview 注入消息监听脚本，修改 `wrapHtmlTag()` 添加 message handler
- 新建 `apps/vscode/src/clipboard.ts` — 适配自 Obsidian 的 `inlineCSS()`

#### 1.2 本地图片显示

当前预览中本地图片全部无法显示。

**实现方式：**

- 创建 webview 时设置 `localResourceRoots`（文档所在目录 + workspace 目录）
- 渲染后用正则扫描 `<img>` 标签，将相对/本地路径通过 `panel.webview.asWebviewUri()` 转换为 webview 可访问的 URI
- 跳过 `http` 和 `data:` 开头的 URL

**修改文件：**

- `apps/vscode/src/extension.ts` — webview 创建时加 `localResourceRoots`，添加 `fixLocalImages()` 函数

#### 1.3 补齐渲染设置

`styleChoices.ts` 已导入 `legendOptions` 和 `codeBlockThemeOptions` 但未使用。`extension.ts` 硬编码了 `isUseIndent: false`、`isUseJustify: false`、`legend: 'none'`。这些设置 `@md/core` 已支持，只需在 tree view 中暴露。

**新增设置项：**

- 首行缩进（toggle）— 对应 `isUseIndent`
- 两端对齐（toggle）— 对应 `isUseJustify`
- 链接转脚注（toggle）— 对应 `citeStatus`
- 显示行号（toggle）— 对应 `isShowLineNumber`
- 图片标题（expandable list）— 对应 `legend`，使用已导入的 `legendOptions`

**修改文件：**

- `apps/vscode/src/treeDataProvider.ts` — 添加 5 个新设置的状态、getter、updater、tree items
- `apps/vscode/src/extension.ts` — 注册新命令，将硬编码值改为从 treeDataProvider 读取
- `apps/vscode/package.json` — 注册新命令

### Phase 2: 体验增强

#### 2.1 自定义 CSS

利用 VSCode 原生 settings 机制，添加 `markdownPreview.customCSS` 配置项。

**修改文件：**

- `apps/vscode/package.json` — `contributes.configuration` 添加 customCSS 字段
- `apps/vscode/src/extension.ts` — 读取配置并追加到 CSS 链末尾

#### 2.2 AI 润色

Obsidian 的 `ai-polish.ts` 几乎是平台无关的，只需将 `requestUrl` 替换为 Node.js `fetch`。

**修改文件：**

- 新建 `apps/vscode/src/ai-polish.ts` — 适配自 Obsidian 版本
- `apps/vscode/package.json` — 注册命令 + AI 相关配置项（endpoint, model, apiKey, prompt）
- `apps/vscode/src/extension.ts` — 注册 `markdown.aiPolish` 命令

#### 2.3 URL 导入

Obsidian 的 `url-importer.ts` 同样平台无关。

**修改文件：**

- 新建 `apps/vscode/src/url-importer.ts` — 适配自 Obsidian 版本
- `apps/vscode/package.json` — 注册 `markdown.importFromUrl` 命令
- `apps/vscode/src/extension.ts` — 注册命令，输入框获取 URL，创建新文档

### Phase 3: 高级功能（可选）

#### 3.1 微信推送

复杂度高（多账号管理、密钥存储、图片上传到 CDN），且 Phase 1 的复制功能已覆盖 90% 使用场景。建议后续按需实现。

## 关键参考文件

- `apps/obsidian/src/core/clipboard.ts` — `inlineCSS()` 可直接复用（6 行纯 JS）
- `apps/obsidian/src/core/ai-polish.ts` — AI 润色，替换 `requestUrl` 为 `fetch` 即可
- `apps/obsidian/src/core/url-importer.ts` — URL 导入，同上
- `apps/obsidian/src/views/preview-view.ts:195-220` — 本地图片处理参考
- `apps/obsidian/src/types/index.ts` — 完整设置项定义参考
- `apps/vscode/src/styleChoices.ts` — 已导入 `legendOptions`、`codeBlockThemeOptions` 未使用

## 开发与部署

### 开发流程

所有命令均在项目根目录执行，通过 `pnpm vscode` 代理到 `apps/vscode`：

```bash
# 安装依赖
pnpm install

# 监听模式开发（自动重新编译）
pnpm vscode watch

# 单次编译
pnpm vscode compile
```

调试步骤：

1. 在 VSCode 中打开项目根目录
2. 运行 `pnpm vscode watch` 启动 webpack watch 模式
3. 按 `F5` 启动 Extension Development Host
4. 修改代码后 webpack 自动重编译，在调试窗口执行 `Developer: Reload Window` 加载更新

### 构建与打包

```bash
# 生产构建（输出到 apps/vscode/dist/extension.js）
pnpm vscode build

# 打包为 .vsix 文件
pnpm vscode package
```

构建配置要点：

- Webpack target: `node`，输出 CommonJS2 格式
- `vscode` 模块作为 external 不打包
- CSS/TXT 文件通过 `asset/source` 以字符串形式内联
- `tsconfig-paths-webpack-plugin` 解析 `@/*` 路径别名（指向 `apps/*`）
- workspace 依赖 `@md/core` 和 `@md/shared` 会被 webpack 打包进 bundle

### 发布

```bash
# 打包 .vsix（不含 node_modules），产物在 apps/vscode/doocs-md-0.0.1.vsix
pnpm vscode package

# 手动安装测试（macOS 下 code 可能不在 PATH 中，使用完整路径）
"/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" --install-extension apps/vscode/doocs-md-0.0.1.vsix

# 发布到 VS Code Marketplace（需要 PAT）
pnpm vscode exec vsce publish
```

### 注意事项

- 修改 `@md/core` 或 `@md/shared` 后需重新构建对应包，webpack watch 会自动拾取变更
- `package.json` 中 `webpack` 和 `ts-loader` 放在 dependencies 而非 devDependencies，这是因为 `vsce package --no-dependencies` 跳过了 npm install
- 入口文件 `src/extension.ts`，导出 `activate()` 函数
- 产物路径 `dist/extension.js`，对应 `package.json` 的 `"main"` 字段

## 验证方式

1. 打开包含本地图片的 Markdown 文件，执行 `Open Markdown Preview`，确认图片正常显示
2. 修改侧边栏设置（缩进、对齐、脚注等），确认预览实时更新
3. 执行 `Copy to Clipboard` 命令，粘贴到微信公众号编辑器，确认格式正确保留
4. 运行 `pnpm lint` 和 `pnpm type-check` 确认无报错
