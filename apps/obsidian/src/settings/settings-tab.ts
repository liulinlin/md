import type { ThemeName } from '@md/shared/configs'
import type { App } from 'obsidian'
import type WeChatPublisherPlugin from '../main'
import type { WxAccount } from '../types'
import { colorOptions, fontFamilyOptions, fontSizeOptions, legendOptions, themeOptions } from '@md/shared/configs'
import { Notice, PluginSettingTab, Setting } from 'obsidian'
import { clearTokenCache, wxGetToken } from '../core/wechat-api'
/* eslint-disable no-new */
export class WeChatPublisherSettingTab extends PluginSettingTab {
  plugin: WeChatPublisherPlugin

  constructor(app: App, plugin: WeChatPublisherPlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()

    // 主题设置
    containerEl.createEl('h3', { text: '主题设置' })

    new Setting(containerEl)
      .setName('预设主题')
      .setDesc('选择排版主题风格')
      .addDropdown((dropdown) => {
        for (const opt of themeOptions) {
          dropdown.addOption(opt.value, opt.label)
        }
        dropdown.setValue(this.plugin.settings.theme)
        dropdown.onChange(async (value) => {
          this.plugin.settings.theme = value as ThemeName
          await this.plugin.saveSettings()
        })
      })

    new Setting(containerEl)
      .setName('主色调')
      .setDesc('主题强调色')
      .addDropdown((dropdown) => {
        for (const opt of colorOptions) {
          dropdown.addOption(opt.value, opt.label)
        }
        dropdown.setValue(this.plugin.settings.primaryColor)
        dropdown.onChange(async (value) => {
          this.plugin.settings.primaryColor = value
          await this.plugin.saveSettings()
        })
      })

    // 排版设置
    containerEl.createEl('h3', { text: '排版设置' })

    new Setting(containerEl)
      .setName('字体')
      .addDropdown((dropdown) => {
        for (const opt of fontFamilyOptions) {
          dropdown.addOption(opt.value, opt.label)
        }
        dropdown.setValue(this.plugin.settings.fontFamily)
        dropdown.onChange(async (value) => {
          this.plugin.settings.fontFamily = value
          await this.plugin.saveSettings()
        })
      })

    new Setting(containerEl)
      .setName('字号')
      .addDropdown((dropdown) => {
        for (const opt of fontSizeOptions) {
          dropdown.addOption(opt.value, opt.label)
        }
        dropdown.setValue(this.plugin.settings.fontSize)
        dropdown.onChange(async (value) => {
          this.plugin.settings.fontSize = value
          await this.plugin.saveSettings()
        })
      })

    new Setting(containerEl)
      .setName('首行缩进')
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.isUseIndent)
        toggle.onChange(async (value) => {
          this.plugin.settings.isUseIndent = value
          await this.plugin.saveSettings()
        })
      })

    new Setting(containerEl)
      .setName('两端对齐')
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.isUseJustify)
        toggle.onChange(async (value) => {
          this.plugin.settings.isUseJustify = value
          await this.plugin.saveSettings()
        })
      })

    // 代码块设置
    containerEl.createEl('h3', { text: '代码块' })

    new Setting(containerEl)
      .setName('Mac 风格窗口')
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.isMacCodeBlock)
        toggle.onChange(async (value) => {
          this.plugin.settings.isMacCodeBlock = value
          await this.plugin.saveSettings()
        })
      })

    new Setting(containerEl)
      .setName('显示行号')
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.isShowLineNumber)
        toggle.onChange(async (value) => {
          this.plugin.settings.isShowLineNumber = value
          await this.plugin.saveSettings()
        })
      })

    // 渲染设置
    containerEl.createEl('h3', { text: '渲染设置' })

    new Setting(containerEl)
      .setName('链接脚注')
      .setDesc('将链接转换为脚注引用')
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.citeStatus)
        toggle.onChange(async (value) => {
          this.plugin.settings.citeStatus = value
          await this.plugin.saveSettings()
        })
      })

    new Setting(containerEl)
      .setName('字数统计')
      .setDesc('显示阅读时间和字数')
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.countStatus)
        toggle.onChange(async (value) => {
          this.plugin.settings.countStatus = value
          await this.plugin.saveSettings()
        })
      })

    new Setting(containerEl)
      .setName('图片题注')
      .addDropdown((dropdown) => {
        for (const opt of legendOptions) {
          dropdown.addOption(opt.value, opt.label)
        }
        dropdown.setValue(this.plugin.settings.legend)
        dropdown.onChange(async (value) => {
          this.plugin.settings.legend = value
          await this.plugin.saveSettings()
        })
      })

    // Obsidian 语法
    containerEl.createEl('h3', { text: 'Obsidian 语法' })

    new Setting(containerEl)
      .setName('移除标签')
      .setDesc('渲染时移除 #标签')
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.removeTags)
        toggle.onChange(async (value) => {
          this.plugin.settings.removeTags = value
          await this.plugin.saveSettings()
        })
      })

    // 导入设置
    containerEl.createEl('h3', { text: '导入设置' })

    new Setting(containerEl)
      .setName('导入文件夹')
      .setDesc('导入笔记的保存路径，留空则保存到 Vault 根目录')
      .addText((text) => {
        text.setPlaceholder('例如: Imports')
        text.setValue(this.plugin.settings.importFolder)
        text.onChange(async (value) => {
          this.plugin.settings.importFolder = value
          await this.plugin.saveSettings()
        })
      })

    new Setting(containerEl)
      .setName('Anything-MD API 地址')
      .setDesc('留空则使用默认地址 https://anything-md.doocs.org/')
      .addText((text) => {
        text.setPlaceholder('https://anything-md.doocs.org/')
        text.setValue(this.plugin.settings.anythingMdApi)
        text.onChange(async (value) => {
          this.plugin.settings.anythingMdApi = value
          await this.plugin.saveSettings()
        })
      })

    // Jina Reader 设置
    containerEl.createEl('h3', { text: 'Jina Reader 设置' })

    new Setting(containerEl)
      .setName('API Key')
      .setDesc('留空则使用内置默认 Key')
      .addText((text) => {
        text.inputEl.type = 'password'
        text.setPlaceholder('jina_...')
        text.setValue(this.plugin.settings.jinaApiKey)
        text.onChange(async (value) => {
          this.plugin.settings.jinaApiKey = value
          await this.plugin.saveSettings()
        })
      })

    new Setting(containerEl)
      .setName('强调符号')
      .setDesc('X-Md-Em-Delimiter')
      .addDropdown((dropdown) => {
        dropdown.addOption('*', '* (星号)')
        dropdown.addOption('_', '_ (下划线)')
        dropdown.setValue(this.plugin.settings.jinaEmDelimiter)
        dropdown.onChange(async (value) => {
          this.plugin.settings.jinaEmDelimiter = value
          await this.plugin.saveSettings()
        })
      })

    new Setting(containerEl)
      .setName('引擎')
      .setDesc('X-Engine')
      .addDropdown((dropdown) => {
        dropdown.addOption('browser', 'browser')
        dropdown.addOption('readability', 'readability')
        dropdown.addOption('direct', 'direct')
        dropdown.setValue(this.plugin.settings.jinaEngine)
        dropdown.onChange(async (value) => {
          this.plugin.settings.jinaEngine = value
          await this.plugin.saveSettings()
        })
      })

    new Setting(containerEl)
      .setName('标题风格')
      .setDesc('X-Md-Heading-Style')
      .addDropdown((dropdown) => {
        dropdown.addOption('setext', 'setext')
        dropdown.addOption('atx', 'atx')
        dropdown.setValue(this.plugin.settings.jinaHeadingStyle)
        dropdown.onChange(async (value) => {
          this.plugin.settings.jinaHeadingStyle = value
          await this.plugin.saveSettings()
        })
      })

    // 自定义 CSS
    containerEl.createEl('h3', { text: '自定义 CSS' })

    new Setting(containerEl)
      .setName('自定义样式')
      .setDesc('输入自定义 CSS，优先级最高')
      .addTextArea((text) => {
        text.inputEl.rows = 8
        text.inputEl.cols = 50
        text.inputEl.style.fontFamily = 'monospace'
        text.inputEl.style.fontSize = '12px'
        text.setValue(this.plugin.settings.customCSS)
        text.onChange(async (value) => {
          this.plugin.settings.customCSS = value
          await this.plugin.saveSettings()
        })
      })

    // 微信公众号推送
    containerEl.createEl('h3', { text: '微信公众号推送' })

    new Setting(containerEl)
      .setName('代理服务器地址')
      .setDesc('默认使用 https://wx-proxy.codeby.cc/，也可自行部署代理服务器（见项目 README）')
      .addText((text) => {
        text.setPlaceholder('https://wx-proxy.codeby.cc/')
        text.setValue(this.plugin.settings.wxProxyUrl)
        text.onChange(async (value) => {
          this.plugin.settings.wxProxyUrl = value.replace(/\/+$/, '')
          clearTokenCache()
          await this.plugin.saveSettings()
        })
      })

    new Setting(containerEl)
      .setName('默认作者')
      .setDesc('文章默认作者名，可在 frontmatter 中用 author 字段覆盖')
      .addText((text) => {
        text.setPlaceholder('作者名')
        text.setValue(this.plugin.settings.wxDefaultAuthor)
        text.onChange(async (value) => {
          this.plugin.settings.wxDefaultAuthor = value
          await this.plugin.saveSettings()
        })
      })

    // 公众号账号列表
    this.renderAccountList(containerEl)
  }

  private renderAccountList(containerEl: HTMLElement): void {
    const listContainer = containerEl.createDiv({ cls: 'wx-account-list' })

    const accounts = this.plugin.settings.wxAccounts

    for (let i = 0; i < accounts.length; i++) {
      this.renderAccountCard(listContainer, accounts[i], i)
    }

    // 添加公众号按钮
    new Setting(containerEl)
      .addButton((btn) => {
        btn.setButtonText('+ 添加公众号')
        btn.setCta()
        btn.onClick(async () => {
          this.plugin.settings.wxAccounts.push({
            name: `公众号 ${this.plugin.settings.wxAccounts.length + 1}`,
            appId: '',
            appSecret: '',
            enabled: true,
          })
          await this.plugin.saveSettings()
          this.display()
        })
      })
  }

  private renderAccountCard(container: HTMLElement, account: WxAccount, index: number): void {
    const card = container.createDiv({ cls: 'wx-account-card' })
    card.style.cssText = 'border:1px solid var(--background-modifier-border);border-radius:8px;padding:12px;margin-bottom:12px;'

    // 头部：名称 + 启用开关 + 删除按钮
    new Setting(card)
      .setName(`#${index + 1}`)
      .addText((text) => {
        text.setPlaceholder('账号名称')
        text.setValue(account.name)
        text.onChange(async (value) => {
          account.name = value
          await this.plugin.saveSettings()
        })
      })
      .addToggle((toggle) => {
        toggle.setTooltip('启用/禁用')
        toggle.setValue(account.enabled)
        toggle.onChange(async (value) => {
          account.enabled = value
          await this.plugin.saveSettings()
        })
      })
      .addButton((btn) => {
        btn.setIcon('trash')
        btn.setTooltip('删除此账号')
        btn.onClick(async () => {
          this.plugin.settings.wxAccounts.splice(index, 1)
          clearTokenCache(account.appId)
          await this.plugin.saveSettings()
          this.display()
        })
      })

    new Setting(card)
      .setName('AppID')
      .addText((text) => {
        text.setPlaceholder('wx...')
        text.setValue(account.appId)
        text.onChange(async (value) => {
          clearTokenCache(account.appId)
          account.appId = value.trim()
          await this.plugin.saveSettings()
        })
      })

    new Setting(card)
      .setName('AppSecret')
      .addText((text) => {
        text.inputEl.type = 'password'
        text.setPlaceholder('输入 AppSecret')
        text.setValue(account.appSecret)
        text.onChange(async (value) => {
          clearTokenCache(account.appId)
          account.appSecret = value.trim()
          await this.plugin.saveSettings()
        })
      })

    new Setting(card)
      .addButton((btn) => {
        btn.setButtonText('测试连接')
        btn.onClick(async () => {
          const { wxProxyUrl } = this.plugin.settings
          if (!wxProxyUrl || !account.appId || !account.appSecret) {
            new Notice('请先填写代理地址、AppID 和 AppSecret')
            return
          }
          btn.setButtonText('测试中...')
          btn.setDisabled(true)
          try {
            clearTokenCache(account.appId)
            await wxGetToken(wxProxyUrl, account.appId, account.appSecret)
            new Notice(`「${account.name || '未命名'}」连接成功`)
          }
          catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            new Notice(`「${account.name || '未命名'}」连接失败: ${msg}`, 5000)
          }
          finally {
            btn.setButtonText('测试连接')
            btn.setDisabled(false)
          }
        })
      })
  }
}
