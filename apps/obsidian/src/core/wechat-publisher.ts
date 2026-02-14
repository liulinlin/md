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
  const match = dataUri.match(/^data:image\/(\w+);base64,(.+)$/)
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
 * 从 HTML 内容中提取第一个图片的 src
 * 支持 <img> 标签和 Markdown 图片语法 ![alt](url)
 */
function extractFirstImage(html: string): string | null {
  // 同时匹配 <img src="..."> 和 ![...](...)
  const imgTagMatch = html.match(/<img\s[^>]*src="([^"]+)"/)
  const mdImgMatch = html.match(/!\[[^\]]*\]\(([^)]+)\)/)

  if (!imgTagMatch && !mdImgMatch)
    return null

  // 返回最先出现的那个
  if (imgTagMatch && mdImgMatch) {
    return imgTagMatch.index! < mdImgMatch.index! ? imgTagMatch[1] : mdImgMatch[1]
  }

  return imgTagMatch ? imgTagMatch[1] : mdImgMatch![1]
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
    try {
      const headers: Record<string, string> = {}
      headers.Referer = 'https://mp.weixin.qq.com/'
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      const res = await requestUrl({ url: src, method: 'GET', headers })
      const ext = new URL(src).pathname.split('.').pop() || 'jpg'
      return { data: res.arrayBuffer, filename: `cover.${ext}` }
    }
    catch {
      return null
    }
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
 */
async function replaceImages(proxyUrl: string, token: string, html: string): Promise<string> {
  const imgRegex = /<img\s[^>]*src="([^"]+)"[^>]*>/g
  const matches = [...html.matchAll(imgRegex)]

  for (const match of matches) {
    const src = match[1]
    let imageData: ArrayBuffer | null = null
    let filename = 'image.png'

    if (src.startsWith('data:image')) {
      // base64 data URI
      const decoded = decodeDataUri(src)
      if (decoded) {
        imageData = decoded.data
        filename = `image.${decoded.ext}`
      }
    }
    else if (src.startsWith('http://') || src.startsWith('https://')) {
      // 已经是微信 CDN 的图片跳过
      if (src.includes('mmbiz.qpic.cn'))
        continue

      try {
        const res = await requestUrl({ url: src, method: 'GET' })
        imageData = res.arrayBuffer
        // 从 URL 提取文件名
        const urlPath = new URL(src).pathname
        const ext = urlPath.split('.').pop() || 'png'
        filename = `image.${ext}`
      }
      catch {
        // 下载失败，保留原始 URL
        continue
      }
    }

    if (imageData) {
      try {
        const cdnUrl = await wxUploadImage(proxyUrl, token, imageData, filename)
        html = html.split(src).join(cdnUrl)
      }
      catch {
        // 上传失败，保留原始 src
      }
    }
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
    try {
      const res = await requestUrl({ url: cover, method: 'GET' })
      const ext = new URL(cover).pathname.split('.').pop() || 'jpg'
      return { data: res.arrayBuffer, filename: `cover.${ext}` }
    }
    catch {
      return null
    }
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
 * 批量推送到所有已启用的公众号账号
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

  const results: AccountPublishResult[] = []

  for (const account of enabledAccounts) {
    try {
      const result = await publish(app, settings, html, css, title, file, account)
      results.push({ account, success: true, mediaId: result.mediaId })
    }
    catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({ account, success: false, error: msg })
    }
  }

  return results
}
