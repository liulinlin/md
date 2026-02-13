# Obsidian 插件：微信公众号推送功能

## Context

`apps/obsidian/` 已实现 Markdown 渲染、预览、复制到剪贴板等功能。`reference/note-to-mp/` 是一个已实现公众号推送的 Obsidian 插件，作为参考。目标是在现有插件中增加"推送到微信草稿箱"能力。

核心发现：`apps/web/worker/index.ts` 已经是一个透明的微信 API 代理（将任意路径转发到 `api.weixin.qq.com`），可直接复用，无需新建 Worker。

## 实现方案

### 新增文件

#### 1. `apps/obsidian/src/core/wechat-api.ts` — 微信 API 客户端

封装所有微信 API 调用，通过可配置的代理 URL 路由请求。使用 Obsidian 的 `requestUrl` 发起 HTTP 请求。

- `wxGetToken(proxyUrl, appid, secret)` — POST `{proxyUrl}/cgi-bin/stable_token`，获取 access_token，模块级缓存（过期前 5 分钟刷新）
- `wxUploadImage(proxyUrl, token, data: ArrayBuffer, filename)` — POST multipart 到 `{proxyUrl}/cgi-bin/media/uploadimg`（文章内图片，返回 URL）
- `wxUploadCover(proxyUrl, token, data: ArrayBuffer, filename)` — POST multipart 到 `{proxyUrl}/cgi-bin/material/add_material?type=image`（封面图，返回 media_id）
- `wxAddDraft(proxyUrl, token, article)` — POST `{proxyUrl}/cgi-bin/draft/add`，创建草稿
- `wxBatchGetMaterial(proxyUrl, token)` — 获取素材列表（用于默认封面）

multipart 构造参考 `reference/note-to-mp/src/weixin-api.ts:101-138` 的 boundary 拼接方式。

定义 `WeChatApiError` 类，处理常见错误码（40001/40125/40164/45009/48001）并给出中文提示。

#### 2. `apps/obsidian/src/core/wechat-publisher.ts` — 推送编排器

```
publish(html, css, title, file) 流程：
  1. 获取 access_token（wxGetToken）
  2. CSS 内联（复用现有 clipboard.ts 的 inlineCSS）
  3. 提取 HTML 中所有 <img src="...">
     - data:image base64 → 解码为 ArrayBuffer → wxUploadImage → 替换为微信 CDN URL
     - http(s):// → requestUrl 下载 → wxUploadImage → 替换为微信 CDN URL
  4. 处理封面图
     - frontmatter 中有 cover 字段 → 上传为永久素材（wxUploadCover）
     - 否则 → wxBatchGetMaterial 取第一个素材作为封面
     - 都没有 → 报错提示用户设置封面
  5. 组装 DraftArticle（title, content, thumb_media_id, author, digest 等，author/digest 从 frontmatter 读取）
  6. wxAddDraft 创建草稿，返回 media_id
```

### 修改文件

#### 3. `apps/obsidian/src/types/index.ts` — 扩展设置类型

PluginSettings 新增字段：

```typescript
wxAppId: string // 默认 ''
wxAppSecret: string // 默认 ''
wxProxyUrl: string // 默认 ''，为空时推送功能隐藏
wxDefaultAuthor: string // 默认 ''
```

#### 4. `apps/obsidian/src/settings/settings-tab.ts` — 新增"微信公众号推送"配置区

在现有设置末尾添加：

- 代理服务器地址（text input，placeholder: `https://your-worker.workers.dev`）
- AppID（text input）
- AppSecret（password input）
- 默认作者（text input）
- 测试连接按钮（调用 wxGetToken 验证配置）

#### 5. `apps/obsidian/src/views/preview-view.ts` — 工具栏添加"推送"按钮

- 在"刷新"按钮后添加"推送"按钮
- `wxProxyUrl` 或 `wxAppId` 为空时隐藏按钮
- `handlePush()` 方法：校验配置 → 调用 WeChatPublisher.publish() → Notice 提示结果
- `handlePush` 改为 public，供 main.ts 的命令调用

#### 6. `apps/obsidian/src/main.ts` — 注册推送命令

新增命令 `push-wechat`（"推送到微信公众号草稿箱"），逻辑：确保预览面板打开 → 调用 view.handlePush()

### 不需要新建 Worker

现有 `apps/web/worker/index.ts`（第 95-138 行）已实现透明代理：任意路径 → `https://api.weixin.qq.com` + 路径。用户只需部署该 Worker 并将 URL 填入插件设置即可。在插件设置的代理地址说明中注明这一点。

## 关键参考文件

| 文件                                         | 用途                                       |
| -------------------------------------------- | ------------------------------------------ |
| `reference/note-to-mp/src/weixin-api.ts`     | multipart 上传构造、API 端点签名、错误码   |
| `reference/note-to-mp/src/article-render.ts` | 推送流程编排（prepareArticle/postArticle） |
| `apps/web/worker/index.ts:95-138`            | 现有透明代理实现                           |
| `apps/obsidian/src/core/clipboard.ts`        | 复用 inlineCSS()                           |
| `apps/obsidian/src/views/preview-view.ts`    | 添加推送按钮、lastHtml/lastCss 已可用      |

## 实现顺序

1. `types/index.ts` — 添加设置字段
2. `core/wechat-api.ts` — API 客户端（独立模块）
3. `core/wechat-publisher.ts` — 推送编排器
4. `settings/settings-tab.ts` — 配置 UI
5. `views/preview-view.ts` — 推送按钮
6. `main.ts` — 注册命令

## 验证方式

1. 部署 Worker：`cd apps/web && pnpm wrangler:deploy`
2. 在插件设置中填入 Worker URL、AppID、AppSecret
3. 点击"测试连接"验证 token 获取
4. 打开一篇含图片的 Markdown 文件，打开预览面板
5. 点击"推送"按钮，检查微信公众号后台草稿箱是否出现文章
6. 验证图片正确显示、CSS 样式保留
