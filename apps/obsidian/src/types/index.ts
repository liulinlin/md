import type { ThemeName } from '@md/shared/configs'

export interface WxAccount {
  name: string
  appId: string
  appSecret: string
  enabled: boolean
}

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

  // 导入设置
  importFolder: string
  anythingMdApi: string

  // Jina Reader 设置
  jinaApiKey: string
  jinaEmDelimiter: string
  jinaEngine: string
  jinaHeadingStyle: string

  // 自定义 CSS
  customCSS: string

  // 微信公众号推送
  wxAccounts: WxAccount[]
  wxProxyUrl: string
  wxDefaultAuthor: string

  // 旧字段（迁移用，运行时不再使用）
  wxAppId?: string
  wxAppSecret?: string
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

  importFolder: '',
  anythingMdApi: '',

  jinaApiKey: '',
  jinaEmDelimiter: '*',
  jinaEngine: 'browser',
  jinaHeadingStyle: 'setext',

  customCSS: '',

  wxAccounts: [],
  wxProxyUrl: 'https://wx-proxy.codeby.cc',
  wxDefaultAuthor: '',
}

export const PREVIEW_VIEW_TYPE = 'wechat-publisher-preview'
