import type { ThemeName } from '@md/shared/configs'
import * as vscode from 'vscode'
import { colorOptions, fontFamilyOptions, fontSizeOptions, legendOptions, themeOptions } from './styleChoices'

export class MarkdownTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined> = new vscode.EventEmitter<vscode.TreeItem | undefined>()
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined> = this._onDidChangeTreeData.event
  private currentFontSize: string
  private currentTheme: ThemeName
  private currentPrimaryColor: string
  private currentFontFamily: string
  private countStatus: boolean
  private isMacCodeBlock: boolean
  private isUseIndent: boolean
  private isUseJustify: boolean
  private citeStatus: boolean
  private isShowLineNumber: boolean
  private legend: string
  private context: vscode.ExtensionContext

  constructor(context: vscode.ExtensionContext) {
    this.context = context
    this.currentFontSize = this.context.workspaceState.get(`markdownPreview.fontSize`, fontSizeOptions[0].value)
    this.currentTheme = this.context.workspaceState.get(`markdownPreview.theme`, themeOptions[0].value)
    this.currentPrimaryColor = this.context.workspaceState.get(`markdownPreview.primaryColor`, colorOptions[0].value)
    this.currentFontFamily = this.context.workspaceState.get(`markdownPreview.fontFamily`, fontFamilyOptions[0].value)
    this.countStatus = this.context.workspaceState.get(`markdownPreview.countStatus`, false)
    this.isMacCodeBlock = this.context.workspaceState.get(`markdownPreview.isMacCodeBlock`, false)
    this.isUseIndent = this.context.workspaceState.get(`markdownPreview.isUseIndent`, false)
    this.isUseJustify = this.context.workspaceState.get(`markdownPreview.isUseJustify`, false)
    this.citeStatus = this.context.workspaceState.get(`markdownPreview.citeStatus`, false)
    this.isShowLineNumber = this.context.workspaceState.get(`markdownPreview.isShowLineNumber`, false)
    this.legend = this.context.workspaceState.get(`markdownPreview.legend`, `none`)
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element
  }

  updateCountStatus(status: boolean): void {
    this.countStatus = status
    this.context.workspaceState.update(`markdownPreview.countStatus`, status)
    this._onDidChangeTreeData.fire(undefined)
  }

  updateMacCodeBlock(status: boolean): void {
    this.isMacCodeBlock = status
    this.context.workspaceState.update(`markdownPreview.isMacCodeBlock`, status)
    this._onDidChangeTreeData.fire(undefined)
  }

  getCurrentMacCodeBlock(): boolean {
    return this.isMacCodeBlock
  }

  getCurrentCountStatus(): boolean {
    return this.countStatus
  }

  getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
    if (!element) {
      return Promise.resolve([
        new vscode.TreeItem(`字号`, vscode.TreeItemCollapsibleState.Expanded),
        new vscode.TreeItem(`字体`, vscode.TreeItemCollapsibleState.Expanded),
        new vscode.TreeItem(`主题`, vscode.TreeItemCollapsibleState.Expanded),
        new vscode.TreeItem(`主题色`, vscode.TreeItemCollapsibleState.Expanded),
        new vscode.TreeItem(`计数状态`, vscode.TreeItemCollapsibleState.None),
        new vscode.TreeItem(`Mac代码块`, vscode.TreeItemCollapsibleState.None),
        new vscode.TreeItem(`首行缩进`, vscode.TreeItemCollapsibleState.None),
        new vscode.TreeItem(`两端对齐`, vscode.TreeItemCollapsibleState.None),
        new vscode.TreeItem(`链接转脚注`, vscode.TreeItemCollapsibleState.None),
        new vscode.TreeItem(`显示行号`, vscode.TreeItemCollapsibleState.None),
        new vscode.TreeItem(`图片标题`, vscode.TreeItemCollapsibleState.Expanded),
      ].map((item) => {
        const toggleMap: Record<string, { command: string, active: boolean }> = {
          计数状态: { command: `markdown.toggleCountStatus`, active: this.countStatus },
          Mac代码块: { command: `markdown.toggleMacCodeBlock`, active: this.isMacCodeBlock },
          首行缩进: { command: `markdown.toggleUseIndent`, active: this.isUseIndent },
          两端对齐: { command: `markdown.toggleUseJustify`, active: this.isUseJustify },
          链接转脚注: { command: `markdown.toggleCiteStatus`, active: this.citeStatus },
          显示行号: { command: `markdown.toggleShowLineNumber`, active: this.isShowLineNumber },
        }
        const toggle = toggleMap[item.label as string]
        if (toggle) {
          item.command = { command: toggle.command, title: toggle.command, arguments: [] }
          if (toggle.active) {
            item.iconPath = new vscode.ThemeIcon(`check`)
          }
        }
        return item
      }))
    }
    else if (element.label === `字号`) {
      return Promise.resolve(fontSizeOptions.map((option) => {
        const size = option.value
        const label = option.label
        const desc = option.desc
        const item = new vscode.TreeItem(`${label}  ${desc}`)
        item.command = {
          command: `markdown.setFontSize`,
          title: `Set Font Size`,
          arguments: [size],
        }
        if (size === this.currentFontSize) {
          item.iconPath = new vscode.ThemeIcon(`check`)
        }
        return item
      }))
    }
    else if (element.label === `字体`) {
      return Promise.resolve(fontFamilyOptions.map((option) => {
        const font = option.value
        const label = option.label
        const desc = option.desc
        const item = new vscode.TreeItem(`${label}  ${desc}`)
        item.command = {
          command: `markdown.setFontFamily`,
          title: `Set Font Family`,
          arguments: [font],
        }
        if (font === this.currentFontFamily) {
          item.iconPath = new vscode.ThemeIcon(`check`)
        }
        return item
      }))
    }
    else if (element.label === `主题`) {
      return Promise.resolve(themeOptions.map((option) => {
        const theme = option.value
        const label = option.label
        const desc = option.desc
        const item = new vscode.TreeItem(`${label}  ${desc}`)
        item.command = {
          command: `markdown.setTheme`,
          title: `Set Theme`,
          arguments: [theme],
        }
        if (theme === this.currentTheme) {
          item.iconPath = new vscode.ThemeIcon(`check`)
        }
        return item
      }))
    }
    else if (element.label === `主题色`) {
      return Promise.resolve(colorOptions.map((option) => {
        const color = option.value
        const label = option.label
        const desc = option.desc
        const item = new vscode.TreeItem(`${label}  ${desc}`)
        item.command = {
          command: `markdown.setPrimaryColor`,
          title: `Set Primary Color`,
          arguments: [color],
        }
        if (color === this.currentPrimaryColor) {
          item.iconPath = new vscode.ThemeIcon(`check`)
        }
        return item
      }))
    }
    else if (element.label === `图片标题`) {
      return Promise.resolve(legendOptions.map((option) => {
        const item = new vscode.TreeItem(`${option.label}  ${option.desc}`)
        item.command = {
          command: `markdown.setLegend`,
          title: `Set Legend`,
          arguments: [option.value],
        }
        if (option.value === this.legend) {
          item.iconPath = new vscode.ThemeIcon(`check`)
        }
        return item
      }))
    }
    return Promise.resolve([])
  }

  updateUseIndent(status: boolean): void {
    this.isUseIndent = status
    this.context.workspaceState.update(`markdownPreview.isUseIndent`, status)
    this._onDidChangeTreeData.fire(undefined)
  }

  updateUseJustify(status: boolean): void {
    this.isUseJustify = status
    this.context.workspaceState.update(`markdownPreview.isUseJustify`, status)
    this._onDidChangeTreeData.fire(undefined)
  }

  updateCiteStatus(status: boolean): void {
    this.citeStatus = status
    this.context.workspaceState.update(`markdownPreview.citeStatus`, status)
    this._onDidChangeTreeData.fire(undefined)
  }

  updateShowLineNumber(status: boolean): void {
    this.isShowLineNumber = status
    this.context.workspaceState.update(`markdownPreview.isShowLineNumber`, status)
    this._onDidChangeTreeData.fire(undefined)
  }

  updateLegend(legend: string): void {
    this.legend = legend
    this.context.workspaceState.update(`markdownPreview.legend`, legend)
    this._onDidChangeTreeData.fire(undefined)
  }

  getCurrentUseIndent(): boolean { return this.isUseIndent }
  getCurrentUseJustify(): boolean { return this.isUseJustify }
  getCurrentCiteStatus(): boolean { return this.citeStatus }
  getCurrentShowLineNumber(): boolean { return this.isShowLineNumber }
  getCurrentLegend(): string { return this.legend }

  updateFontSize(size: string) {
    this.currentFontSize = size
    this.context.workspaceState.update(`markdownPreview.fontSize`, size)
    this._onDidChangeTreeData.fire(undefined)
  }

  updateTheme(theme: ThemeName) {
    this.currentTheme = theme
    this.context.workspaceState.update(`markdownPreview.theme`, theme)
    this._onDidChangeTreeData.fire(undefined)
  }

  updatePrimaryColor(color: string) {
    this.currentPrimaryColor = color
    this.context.workspaceState.update(`markdownPreview.primaryColor`, color)
    this._onDidChangeTreeData.fire(undefined)
  }

  updateFontFamily(font: string) {
    this.currentFontFamily = font
    this.context.workspaceState.update(`markdownPreview.fontFamily`, font)
    this._onDidChangeTreeData.fire(undefined)
  }

  getCurrentFontSize() {
    return this.currentFontSize
  }

  getCurrentFontSizeNumber() {
    return Number(this.currentFontSize.replace(`px`, ``))
  }

  getCurrentTheme(): ThemeName {
    return this.currentTheme
  }

  getCurrentPrimaryColor() {
    return this.currentPrimaryColor
  }

  getCurrentFontFamily() {
    return this.currentFontFamily
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined)
  }
}
