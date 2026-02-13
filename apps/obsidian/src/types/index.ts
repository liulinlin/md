import type { ThemeName } from '@md/shared/configs'

export interface PluginSettings {
  // 主题
  theme: ThemeName
  primaryColor: string
  fontFamily: string
  fontSize: string

  // 排版
  isUseIndent: boolean
  isUseJustify: boolean

  // 代码块
  isMacCodeBlock: boolean
  isShowLineNumber: boolean

  // 渲染
  citeStatus: boolean
  countStatus: boolean
  legend: string

  // Obsidian 语法
  removeTags: boolean

  // 自定义 CSS
  customCSS: string

  // 微信公众号推送
  wxAppId: string
  wxAppSecret: string
  wxProxyUrl: string
  wxDefaultAuthor: string
}

export const DEFAULT_SETTINGS: PluginSettings = {
  theme: 'default',
  primaryColor: '#0F4C81',
  fontFamily: '-apple-system-font,BlinkMacSystemFont, Helvetica Neue, PingFang SC, Hiragino Sans GB , Microsoft YaHei UI , Microsoft YaHei ,Arial,sans-serif',
  fontSize: '16px',

  isUseIndent: false,
  isUseJustify: false,

  isMacCodeBlock: true,
  isShowLineNumber: false,

  citeStatus: false,
  countStatus: false,
  legend: 'none',

  removeTags: false,

  customCSS: '',

  wxAppId: '',
  wxAppSecret: '',
  wxProxyUrl: '',
  wxDefaultAuthor: '',
}

export const PREVIEW_VIEW_TYPE = 'wechat-publisher-preview'
