import type { App, TFile } from 'obsidian'
import type { PluginSettings } from '../types'
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
 * 推送编排器：将渲染好的 HTML 推送到微信公众号草稿箱
 */
export async function publish(
  app: App,
  settings: PluginSettings,
  html: string,
  css: string,
  title: string,
  file: TFile,
): Promise<PublishResult> {
  const { wxProxyUrl, wxAppId, wxAppSecret } = settings

  if (!wxProxyUrl || !wxAppId || !wxAppSecret) {
    throw new Error('请先在插件设置中配置微信公众号推送参数')
  }

  // 1. 获取 access_token
  const token = await wxGetToken(wxProxyUrl, wxAppId, wxAppSecret)

  // 2. CSS 内联
  let content = inlineCSS(html, css)

  // 3. 上传图片并替换 URL
  content = await replaceImages(wxProxyUrl, token, content)

  // 4. 处理封面图
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
    // 尝试从素材库取第一个图片素材
    thumbMediaId = await wxBatchGetMaterial(wxProxyUrl, token) || ''
  }

  if (!thumbMediaId) {
    throw new Error('未找到封面图。请在 frontmatter 中设置 cover 字段，或在公众号后台上传至少一张图片素材。')
  }

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
