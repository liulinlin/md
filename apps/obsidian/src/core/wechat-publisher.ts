import type { App, TFile } from 'obsidian'
import type { PluginSettings, WxAccount } from '../types'
import { requestUrl } from 'obsidian'
import { inlineCSS } from './clipboard'
import {
  wxAddDraft,
  wxBatchGetMaterial,
  wxGetToken,
  wxUploadCover,
  wxUploadImage,
} from './wechat-api'

/**
 * 通用 HTTP GET 请求，自动携带微信所需的 Referer 和 User-Agent
 */
async function fetchWithWxHeaders(url: string) {
  return requestUrl({
    url,
    method: 'GET',
    headers: {
      'Referer': 'https://mp.weixin.qq.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  })
}

/**
 * 下载远程图片并返回 ArrayBuffer + 文件名，失败时返回 null
 */
async function fetchRemoteImage(url: string, prefix = 'image', defaultExt = 'jpg'): Promise<{ data: ArrayBuffer, filename: string } | null> {
  try {
    const res = await fetchWithWxHeaders(url)
    const ext = new URL(url).pathname.split('.').pop() || defaultExt
    return { data: res.arrayBuffer, filename: `${prefix}.${ext}` }
  }
  catch {
    return null
  }
}

interface PublishResult {
  mediaId: string
}

export interface AccountPublishResult {
  account: WxAccount
  success: boolean
  mediaId?: string
  error?: string
}

/**
 * 从 frontmatter 读取文章元数据
 */
function getFrontmatter(app: App, file: TFile): Record<string, any> {
  const cache = app.metadataCache.getFileCache(file)
  return cache?.frontmatter || {}
}

/**
 * 将 base64 data URI 解码为 ArrayBuffer + 文件名
 */
function decodeDataUri(dataUri: string): { data: ArrayBuffer, ext: string } | null {
  const match = dataUri.match(/^data:image\/([\w+]+);base64,(.+)$/)
  if (!match)
    return null

  const ext = match[1] === 'svg+xml' ? 'svg' : match[1]
  const binary = atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return { data: bytes.buffer, ext }
}

/**
 * 从 HTML 内容中提取第一个 <img> 的 src
 */
function extractFirstImage(html: string): string | null {
  const match = html.match(/<img\s[^>]*src="([^"]+)"/)
  return match ? match[1] : null
}

/**
 * 将图片 src 转为 ArrayBuffer + 文件名，支持 data URI 和 HTTP(S) URL
 */
async function fetchImageAsBuffer(src: string): Promise<{ data: ArrayBuffer, filename: string } | null> {
  if (src.startsWith('data:image')) {
    const decoded = decodeDataUri(src)
    if (!decoded)
      return null
    return { data: decoded.data, filename: `cover.${decoded.ext}` }
  }

  if (src.startsWith('http://') || src.startsWith('https://')) {
    return fetchRemoteImage(src, 'cover')
  }

  return null
}

/**
 * 推送编排器：将渲染好的 HTML 推送到指定公众号的草稿箱
 */
export async function publish(
  app: App,
  settings: PluginSettings,
  html: string,
  css: string,
  title: string,
  file: TFile,
  account: WxAccount,
): Promise<PublishResult> {
  const { wxProxyUrl } = settings
  const { appId, appSecret } = account

  if (!wxProxyUrl || !appId || !appSecret) {
    throw new Error('推送参数不完整，请检查代理地址和账号配置')
  }

  // 1. 获取 access_token
  const token = await wxGetToken(wxProxyUrl, appId, appSecret)

  // 2. CSS 内联
  let content = inlineCSS(html, css)

  // 3. 处理封面图
  const fm = getFrontmatter(app, file)
  let thumbMediaId = ''

  if (fm.cover) {
    // frontmatter 指定了封面 → 上传为永久素材
    const coverData = await fetchCoverImage(app, file, fm.cover)
    if (coverData) {
      thumbMediaId = await wxUploadCover(wxProxyUrl, token, coverData.data, coverData.filename)
    }
  }

  if (!thumbMediaId) {
    // 尝试从文章内容提取第一张图片作为封面
    const firstImgSrc = extractFirstImage(content)
    if (firstImgSrc) {
      console.log('尝试使用文章中的第一张图片作为封面:', firstImgSrc)
      const imgBuffer = await fetchImageAsBuffer(firstImgSrc)
      if (imgBuffer) {
        try {
          thumbMediaId = await wxUploadCover(wxProxyUrl, token, imgBuffer.data, imgBuffer.filename)
        }
        catch {
          // 上传失败，降级到素材库
        }
      }
    }
  }

  if (!thumbMediaId) {
    // 尝试从素材库取第一个图片素材
    thumbMediaId = await wxBatchGetMaterial(wxProxyUrl, token) || ''
  }

  if (!thumbMediaId) {
    throw new Error('未找到封面图。请在 frontmatter 中设置 cover 字段，或在公众号后台上传至少一张图片素材。')
  }

  // 4. 上传图片并替换 URL
  content = await replaceImages(wxProxyUrl, token, content)

  // 5. 组装文章
  const articleTitle = fm.title || title
  const author = fm.author || settings.wxDefaultAuthor || ''
  const digest = fm.digest || ''

  // 6. 创建草稿
  const mediaId = await wxAddDraft(wxProxyUrl, token, {
    title: articleTitle,
    content,
    thumb_media_id: thumbMediaId,
    author,
    digest,
  })

  return { mediaId }
}

/**
 * 提取并上传 HTML 中所有 <img> 的图片，替换为微信 CDN URL
 * 并发下载和上传（最多 5 个并行），使用精确位置替换避免误替换
 */
async function replaceImages(proxyUrl: string, token: string, html: string): Promise<string> {
  const imgRegex = /<img\s[^>]*src="([^"]+)"[^>]*>/g
  const matches = [...html.matchAll(imgRegex)]

  // 阶段 1：并发准备所有图片数据
  interface ImageTask {
    src: string
    fullMatch: string
    imageData: ArrayBuffer
    filename: string
  }

  const prepareTask = async (match: RegExpExecArray): Promise<ImageTask | null> => {
    const src = match[1]

    if (src.startsWith('data:image')) {
      const decoded = decodeDataUri(src)
      if (!decoded)
        return null
      return { src, fullMatch: match[0], imageData: decoded.data, filename: `image.${decoded.ext}` }
    }

    if (src.startsWith('http://') || src.startsWith('https://')) {
      if (src.includes('mmbiz.qpic.cn'))
        return null
      const result = await fetchRemoteImage(src, 'image', 'png')
      if (!result)
        return null
      return { src, fullMatch: match[0], imageData: result.data, filename: result.filename }
    }

    return null
  }

  const tasks = (await Promise.all(matches.map(m => prepareTask(m)))).filter((t): t is ImageTask => t !== null)

  // 阶段 2：并发上传（限制并发数 5）
  const CONCURRENCY = 5
  const urlMap = new Map<string, string>()

  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map(async (task) => {
        const cdnUrl = await wxUploadImage(proxyUrl, token, task.imageData, task.filename)
        urlMap.set(task.src, cdnUrl)
      }),
    )
    for (const r of results) {
      if (r.status === 'rejected') {
        console.warn('[WeChat Publisher] Image upload failed:', r.reason)
      }
    }
  }

  // 阶段 3：从后往前精确替换 <img> 标签中的 src，避免误替换其他位置
  for (const match of [...matches].reverse()) {
    const src = match[1]
    const cdnUrl = urlMap.get(src)
    if (!cdnUrl || match.index === undefined)
      continue
    const newTag = match[0].replace(src, cdnUrl)
    html = html.slice(0, match.index) + newTag + html.slice(match.index + match[0].length)
  }

  return html
}

/**
 * 获取封面图数据
 */
async function fetchCoverImage(
  app: App,
  currentFile: TFile,
  cover: string,
): Promise<{ data: ArrayBuffer, filename: string } | null> {
  if (cover.startsWith('http://') || cover.startsWith('https://')) {
    return fetchRemoteImage(cover, 'cover')
  }

  // 本地文件路径
  const file = app.metadataCache.getFirstLinkpathDest(cover, currentFile.path)
  if (file) {
    const data = await app.vault.readBinary(file)
    return { data, filename: file.name }
  }

  return null
}

/**
 * 批量推送到所有已启用的公众号账号（并行执行）
 */
export async function publishToAll(
  app: App,
  settings: PluginSettings,
  html: string,
  css: string,
  title: string,
  file: TFile,
  accounts?: WxAccount[],
): Promise<AccountPublishResult[]> {
  const enabledAccounts = accounts ?? settings.wxAccounts.filter(a => a.enabled && a.appId && a.appSecret)

  if (enabledAccounts.length === 0) {
    throw new Error('没有已启用且配置完整的公众号账号，请先在设置中添加')
  }

  const results = await Promise.allSettled(
    enabledAccounts.map(account => publish(app, settings, html, css, title, file, account)),
  )

  return enabledAccounts.map((account, i) => {
    const result = results[i]
    if (result.status === 'fulfilled') {
      return { account, success: true, mediaId: result.value.mediaId }
    }
    const msg = result.reason instanceof Error ? result.reason.message : String(result.reason)
    return { account, success: false, error: msg }
  })
}
