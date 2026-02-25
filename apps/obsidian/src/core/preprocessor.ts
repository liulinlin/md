import type { App, TFile } from 'obsidian'
import type { PluginSettings } from '../types'
import { resolveFile } from '../utils/resolve-file'

/**
 * Obsidian 语法预处理器
 * 将 Obsidian 特有语法转换为标准 Markdown
 */
export class ObsidianSyntaxPreprocessor {
  constructor(
    private app: App,
    private currentFile: TFile,
    private settings: PluginSettings,
  ) {}

  async process(markdown: string): Promise<string> {
    // 1. 移除注释 %%...%%
    markdown = markdown.replace(/%%.*?%%/gs, '')

    // 2. 处理 Wiki 链接（同步）
    markdown = this.resolveWikiLinks(markdown)

    // 3. 处理嵌入（异步：涉及文件读取）
    markdown = await this.resolveEmbeds(markdown)

    // 4. 处理标准 Markdown 本地图片 ![alt](local-path) → base64
    markdown = await this.resolveMarkdownImages(markdown)

    // 5. 处理标签（可选）
    if (this.settings.removeTags) {
      markdown = markdown.replace(/(^|\s)#[\w\u4E00-\u9FFF-]+/g, '$1')
    }

    return markdown
  }

  /**
   * 解析 Wiki 链接 [[target|alias]] → [alias](path)
   */
  private resolveWikiLinks(markdown: string): string {
    const linkRegex = /\[\[([^\]|]+)(\|([^\]]+))?\]\]/g

    return markdown.replace(linkRegex, (_match, target, _pipe, alias) => {
      const file = resolveFile(this.app, target, this.currentFile)

      if (!file)
        return alias || target

      const displayText = alias || target
      return `[${displayText}](${this.getRelativePath(file)})`
    })
  }

  /**
   * 解析嵌入 ![[target]] → 展开内容或图片
   */
  private async resolveEmbeds(markdown: string): Promise<string> {
    const embedRegex = /!\[\[([^\]]+)\]\]/g
    const matches = [...markdown.matchAll(embedRegex)]

    // 从后往前替换，避免 offset 偏移
    for (const match of matches.reverse()) {
      const target = match[1]
      const file = resolveFile(this.app, target.split('#')[0], this.currentFile)

      if (!file || match.index === undefined)
        continue

      let replacement = ''

      if (this.isImageFile(file)) {
        // 图片：转为标准 Markdown，使用 vault 路径
        // 预览时由 fixLocalImageSources 替换为 resource URL
        // 推送时由 replaceImages 从 vault 读取上传
        replacement = `![${file.basename}](${encodeURI(file.path)})`
      }
      else if (file.extension === 'md') {
        // 笔记：展开内容（限制深度 1 级）
        const content = await this.app.vault.read(file)
        replacement = content
      }
      else {
        // 其他类型：转为文本链接
        replacement = `[${file.name}](${this.getRelativePath(file)})`
      }

      markdown = markdown.slice(0, match.index)
        + replacement
        + markdown.slice(match.index + match[0].length)
    }

    return markdown
  }

  /**
   * 解析标准 Markdown 图片 ![alt](local-path) → 规范化 vault 路径
   * 通过 resolveFile 多级回退解析，将相对路径/附件路径统一为 vault 绝对路径
   * 预览时由 preview-view 将 vault 路径替换为 resource URL 显示
   * 推送时由 replaceImages 直接从 vault 读取二进制上传
   */
  private async resolveMarkdownImages(markdown: string): Promise<string> {
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
    const matches = [...markdown.matchAll(imageRegex)]

    // 从后往前替换，避免 offset 偏移
    for (const match of matches.reverse()) {
      const [, alt, src] = match

      // 跳过远程 URL 和 data URI
      if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:'))
        continue

      if (match.index === undefined)
        continue

      const file = resolveFile(this.app, decodeURIComponent(src), this.currentFile)
      if (!file || !this.isImageFile(file))
        continue

      // 仅规范化路径，不转 base64（避免推送时 413）
      if (file.path !== src) {
        const replacement = `![${alt}](${encodeURI(file.path)})`
        markdown = markdown.slice(0, match.index)
          + replacement
          + markdown.slice(match.index + match[0].length)
      }
    }

    return markdown
  }

  private isImageFile(file: TFile): boolean {
    return /^(?:png|jpg|jpeg|gif|svg|webp|bmp)$/i.test(file.extension)
  }

  private getRelativePath(file: TFile): string {
    return file.path
  }
}
