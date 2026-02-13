import type { WorkspaceLeaf } from 'obsidian'
import type { PluginSettings } from './types'
import { Plugin } from 'obsidian'
import { WeChatPublisherSettingTab } from './settings/settings-tab'
import { DEFAULT_SETTINGS, PREVIEW_VIEW_TYPE } from './types'
import { PreviewView } from './views/preview-view'

// MathJax stub: @md/core 的 KaTeX 扩展会调用 window.MathJax.texReset() / tex2svg()
// Obsidian 环境可能已有 MathJax 配置对象但缺少运行时方法，直接补齐
const mj = ((window as any).MathJax ??= {}) as Record<string, any>
if (typeof mj.texReset !== 'function') {
  mj.texReset = () => {}
}
if (typeof mj.tex2svg !== 'function') {
  mj.tex2svg = (text: string, options?: { display?: boolean }) => {
    const span = document.createElement('span')
    span.style.cssText = 'font-family:monospace;font-size:0.9em;color:#555;'
    span.textContent = options?.display ? `$$${text}$$` : `$${text}$`
    const container = document.createElement('div')
    container.appendChild(span)
    return container
  }
}

export default class WeChatPublisherPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS

  async onload(): Promise<void> {
    await this.loadSettings()

    // 注册预览视图
    this.registerView(
      PREVIEW_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new PreviewView(leaf, this),
    )

    // 注册命令：打开预览
    this.addCommand({
      id: 'open-preview',
      name: '打开微信排版预览',
      callback: () => this.activatePreview(),
    })

    // 注册命令：复制为微信格式
    this.addCommand({
      id: 'copy-wechat',
      name: '复制为微信公众号格式',
      callback: () => this.copyCurrentFile(),
    })

    // 注册设置面板
    this.addSettingTab(new WeChatPublisherSettingTab(this.app, this))

    // 添加 Ribbon 图标
    this.addRibbonIcon('file-text', '微信排版预览', () => {
      this.activatePreview()
    })
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(PREVIEW_VIEW_TYPE)
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings)

    // 通知预览视图刷新
    const leaves = this.app.workspace.getLeavesOfType(PREVIEW_VIEW_TYPE)
    for (const leaf of leaves) {
      const view = leaf.view as PreviewView
      if (view?.updatePreview) {
        view.updatePreview()
      }
    }
  }

  private async activatePreview(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(PREVIEW_VIEW_TYPE)

    if (existing.length > 0) {
      // 已有预览面板，激活它
      this.app.workspace.revealLeaf(existing[0])
      return
    }

    // 在右侧打开新面板
    const leaf = this.app.workspace.getRightLeaf(false)
    if (leaf) {
      await leaf.setViewState({
        type: PREVIEW_VIEW_TYPE,
        active: true,
      })
      this.app.workspace.revealLeaf(leaf)
    }
  }

  private async copyCurrentFile(): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(PREVIEW_VIEW_TYPE)

    if (leaves.length === 0) {
      // 先打开预览，再复制
      await this.activatePreview()
    }

    // 等待视图就绪后触发复制
    const updatedLeaves = this.app.workspace.getLeavesOfType(PREVIEW_VIEW_TYPE)
    if (updatedLeaves.length > 0) {
      const view = updatedLeaves[0].view as PreviewView
      if (view?.updatePreview) {
        await view.updatePreview()
        // 触发工具栏的复制按钮逻辑
        const copyBtn = view.containerEl.querySelector('.wechat-publisher-toolbar button') as HTMLButtonElement
        copyBtn?.click()
      }
    }
  }
}
