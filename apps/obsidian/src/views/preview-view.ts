import type { ThemeName } from '@md/shared/configs'
import type { WorkspaceLeaf } from 'obsidian'
import type WeChatPublisherPlugin from '../main'
import { initRenderer } from '@md/core/renderer'
import { generateCSSVariables } from '@md/core/theme'
import { modifyHtmlContent } from '@md/core/utils'
import { baseCSSContent, themeMap } from '@md/shared/configs'
import { ItemView, Notice } from 'obsidian'
import { copyToClipboard, inlineCSS } from '../core/clipboard'
import { ObsidianSyntaxPreprocessor } from '../core/preprocessor'
import { publish } from '../core/wechat-publisher'
import { ensureMathJax } from '../main'
import { PREVIEW_VIEW_TYPE } from '../types'
/* eslint-disable no-new */
export class PreviewView extends ItemView {
  plugin: WeChatPublisherPlugin
  private previewEl!: HTMLElement
  private pushBtn!: HTMLButtonElement
  private lastHtml = ''
  private lastCss = ''

  constructor(leaf: WorkspaceLeaf, plugin: WeChatPublisherPlugin) {
    super(leaf)
    this.plugin = plugin
  }

  getViewType(): string {
    return PREVIEW_VIEW_TYPE
  }

  getDisplayText(): string {
    return '微信排版预览'
  }

  getIcon(): string {
    return 'file-text'
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1]
    container.empty()
    container.addClass('wechat-publisher-container')

    // 工具栏
    const toolbar = container.createDiv({ cls: 'wechat-publisher-toolbar' })

    const copyBtn = toolbar.createEl('button', { text: '复制' })
    copyBtn.addEventListener('click', () => this.handleCopy())

    const refreshBtn = toolbar.createEl('button', { text: '刷新' })
    refreshBtn.addEventListener('click', () => this.updatePreview())

    // 推送按钮（配置不完整时隐藏）
    this.pushBtn = toolbar.createEl('button', { text: '推送' })
    this.pushBtn.addEventListener('click', () => this.handlePush())
    this.updatePushBtnVisibility()

    // 预览区域
    const previewWrapper = container.createDiv({ cls: 'wechat-publisher-preview' })
    this.previewEl = previewWrapper.createDiv({ cls: 'wechat-publisher-preview-inner' })

    // 初始渲染
    await this.updatePreview()

    // 监听编辑器变化
    this.registerEvent(
      this.app.workspace.on('editor-change', () => {
        this.updatePreview()
      }),
    )

    // 监听活动文件切换
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        this.updatePreview()
      }),
    )
  }

  async onClose(): Promise<void> {
    this.previewEl?.empty()
  }

  async updatePreview(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile()
    if (!activeFile || activeFile.extension !== 'md')
      return

    try {
      const rawMarkdown = await this.app.vault.read(activeFile)

      // 预处理 Obsidian 语法
      const preprocessor = new ObsidianSyntaxPreprocessor(
        this.app,
        activeFile,
        this.plugin.settings,
      )
      const markdown = await preprocessor.process(rawMarkdown)

      // 确保 MathJax 运行时未被 Obsidian 覆盖
      ensureMathJax()

      // 渲染 HTML
      const renderer = initRenderer({
        citeStatus: this.plugin.settings.citeStatus,
        countStatus: this.plugin.settings.countStatus,
        isMacCodeBlock: this.plugin.settings.isMacCodeBlock,
        isShowLineNumber: this.plugin.settings.isShowLineNumber,
        legend: this.plugin.settings.legend,
      })

      const html = modifyHtmlContent(markdown, renderer)

      // 组装 CSS
      const variables = generateCSSVariables({
        primaryColor: this.plugin.settings.primaryColor,
        fontFamily: this.plugin.settings.fontFamily,
        fontSize: this.plugin.settings.fontSize,
        isUseIndent: this.plugin.settings.isUseIndent,
        isUseJustify: this.plugin.settings.isUseJustify,
      })

      const themeCSS = themeMap[this.plugin.settings.theme as ThemeName]
      const css = `${variables}\n${baseCSSContent}\n${themeCSS}\n${this.plugin.settings.customCSS}`

      this.lastHtml = html
      this.lastCss = css

      // 注入到预览区域
      this.previewEl.empty()

      const styleEl = document.createElement('style')
      styleEl.textContent = css
      this.previewEl.appendChild(styleEl)

      const outputEl = this.previewEl.createDiv({ attr: { id: 'output' } })
      outputEl.innerHTML = html
    }
    catch (err) {
      console.error('[WeChat Publisher] Render error:', err)
      this.previewEl.empty()
      const errorEl = this.previewEl.createDiv({ cls: 'wechat-publisher-error' })
      errorEl.style.cssText = 'padding:16px;color:#dc2626;font-family:monospace;font-size:13px;white-space:pre-wrap;word-break:break-all;'
      const error = err instanceof Error ? err : new Error(String(err))
      errorEl.textContent = `渲染失败:\n\n${error.message}\n\n${error.stack || ''}`
    }
  }

  updatePushBtnVisibility(): void {
    if (!this.pushBtn)
      return
    const { wxProxyUrl, wxAppId } = this.plugin.settings
    this.pushBtn.style.display = (wxProxyUrl && wxAppId) ? '' : 'none'
  }

  async handlePush(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile()
    if (!activeFile || activeFile.extension !== 'md') {
      new Notice('请先打开一个 Markdown 文件', 1500)
      return
    }

    if (!this.lastHtml) {
      new Notice('没有可推送的内容，请先刷新预览', 1500)
      return
    }

    const { wxProxyUrl, wxAppId, wxAppSecret } = this.plugin.settings
    if (!wxProxyUrl || !wxAppId || !wxAppSecret) {
      new Notice('请先在插件设置中配置微信公众号推送参数', 3000)
      return
    }

    new Notice('正在推送到微信草稿箱...', 2000)

    try {
      const result = await publish(
        this.app,
        this.plugin.settings,
        this.lastHtml,
        this.lastCss,
        activeFile.basename,
        activeFile,
      )
      new Notice(`推送成功！草稿 media_id: ${result.mediaId}`, 5000)
    }
    catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[WeChat Publisher] Push failed:', err)
      new Notice(`推送失败: ${msg}`, 5000)
    }
  }

  private async handleCopy(): Promise<void> {
    if (!this.lastHtml) {
      new Notice('没有可复制的内容', 1500)
      return
    }

    try {
      const inlinedHtml = inlineCSS(this.lastHtml, this.lastCss)
      await copyToClipboard(inlinedHtml)
      new Notice('已复制到剪贴板，可直接粘贴到微信编辑器', 1500)
    }
    catch (err) {
      console.error('Copy failed:', err)
      new Notice('复制失败，请重试', 1500)
    }
  }
}
