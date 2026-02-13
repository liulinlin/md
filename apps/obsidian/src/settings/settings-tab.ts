import type { ThemeName } from '@md/shared/configs'
import type { App } from 'obsidian'
import type WeChatPublisherPlugin from '../main'
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
      .setDesc('部署 apps/web 中的 Cloudflare Worker 后填入 URL，例如 https://your-worker.workers.dev')
      .addText((text) => {
        text.setPlaceholder('https://your-worker.workers.dev')
        text.setValue(this.plugin.settings.wxProxyUrl)
        text.onChange(async (value) => {
          this.plugin.settings.wxProxyUrl = value.replace(/\/+$/, '')
          clearTokenCache()
          await this.plugin.saveSettings()
        })
      })

    new Setting(containerEl)
      .setName('AppID')
      .setDesc('公众号后台 → 开发 → 基本配置')
      .addText((text) => {
        text.setPlaceholder('wx...')
        text.setValue(this.plugin.settings.wxAppId)
        text.onChange(async (value) => {
          this.plugin.settings.wxAppId = value.trim()
          clearTokenCache()
          await this.plugin.saveSettings()
        })
      })

    new Setting(containerEl)
      .setName('AppSecret')
      .setDesc('公众号后台 → 开发 → 基本配置')
      .addText((text) => {
        text.inputEl.type = 'password'
        text.setPlaceholder('输入 AppSecret')
        text.setValue(this.plugin.settings.wxAppSecret)
        text.onChange(async (value) => {
          this.plugin.settings.wxAppSecret = value.trim()
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

    new Setting(containerEl)
      .setName('测试连接')
      .setDesc('验证代理地址和 AppID/AppSecret 是否正确')
      .addButton((btn) => {
        btn.setButtonText('测试')
        btn.onClick(async () => {
          const { wxProxyUrl, wxAppId, wxAppSecret } = this.plugin.settings
          if (!wxProxyUrl || !wxAppId || !wxAppSecret) {
            new Notice('请先填写代理地址、AppID 和 AppSecret')
            return
          }
          btn.setButtonText('测试中...')
          btn.setDisabled(true)
          try {
            clearTokenCache()
            await wxGetToken(wxProxyUrl, wxAppId, wxAppSecret)
            new Notice('连接成功，access_token 获取正常')
          }
          catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            new Notice(`连接失败: ${msg}`, 5000)
          }
          finally {
            btn.setButtonText('测试')
            btn.setDisabled(false)
          }
        })
      })
  }
}
