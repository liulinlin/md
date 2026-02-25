import type { ThemeName } from '@md/shared'
import * as path from 'node:path'
import { initRenderer } from '@md/core/renderer'
import { generateCSSVariables } from '@md/core/theme'
import { modifyHtmlContent } from '@md/core/utils'
import { baseCSSContent, themeMap } from '@md/shared'
import * as vscode from 'vscode'
import { polishMarkdown } from './ai-polish'
import { inlineCSS } from './clipboard'
import { css } from './css'
import { MarkdownTreeDataProvider } from './treeDataProvider'
import { fetchViaJina } from './url-importer'

let activePanel: vscode.WebviewPanel | undefined
let lastHtml = ``
let lastCss = ``

export function activate(context: vscode.ExtensionContext) {
  // Register TreeDataProvider
  const treeDataProvider = new MarkdownTreeDataProvider(context)
  vscode.window.registerTreeDataProvider(`markdown.preview.view`, treeDataProvider)

  // Command for registering style settings
  context.subscriptions.push(
    vscode.commands.registerCommand(`markdown.setFontSize`, (size: string) => {
      treeDataProvider.updateFontSize(size)
    }),
    vscode.commands.registerCommand(`markdown.setTheme`, (theme: ThemeName) => {
      treeDataProvider.updateTheme(theme)
    }),
    vscode.commands.registerCommand(`markdown.setPrimaryColor`, (color: string) => {
      treeDataProvider.updatePrimaryColor(color)
    }),
    vscode.commands.registerCommand(`markdown.setFontFamily`, (font: string) => {
      treeDataProvider.updateFontFamily(font)
    }),
    vscode.commands.registerCommand(`markdown.toggleCountStatus`, () => {
      treeDataProvider.updateCountStatus(!treeDataProvider.getCurrentCountStatus())
    }),
    vscode.commands.registerCommand(`markdown.toggleMacCodeBlock`, () => {
      treeDataProvider.updateMacCodeBlock(!treeDataProvider.getCurrentMacCodeBlock())
    }),
    vscode.commands.registerCommand(`markdown.toggleUseIndent`, () => {
      treeDataProvider.updateUseIndent(!treeDataProvider.getCurrentUseIndent())
    }),
    vscode.commands.registerCommand(`markdown.toggleUseJustify`, () => {
      treeDataProvider.updateUseJustify(!treeDataProvider.getCurrentUseJustify())
    }),
    vscode.commands.registerCommand(`markdown.toggleCiteStatus`, () => {
      treeDataProvider.updateCiteStatus(!treeDataProvider.getCurrentCiteStatus())
    }),
    vscode.commands.registerCommand(`markdown.toggleShowLineNumber`, () => {
      treeDataProvider.updateShowLineNumber(!treeDataProvider.getCurrentShowLineNumber())
    }),
    vscode.commands.registerCommand(`markdown.setLegend`, (legend: string) => {
      treeDataProvider.updateLegend(legend)
    }),
  )

  const disposable = vscode.commands.registerCommand(`markdown.preview`, () => {
    const editor = vscode.window.activeTextEditor
    if (!editor || editor.document.languageId !== `markdown`) {
      return
    }

    // 如果已有面板且未关闭，则直接显示
    if (activePanel) {
      activePanel.reveal(vscode.ViewColumn.Two)
      return
    }

    // Create and display a new webview panel
    const docDir = vscode.Uri.file(path.dirname(editor.document.uri.fsPath))
    const localRoots = [docDir]
    if (vscode.workspace.workspaceFolders) {
      localRoots.push(...vscode.workspace.workspaceFolders.map(f => f.uri))
    }

    const panel = vscode.window.createWebviewPanel(
      `markdownPreview`,
      `Markdown Preview - ${editor.document.fileName}`,
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: localRoots,
      },
    )

    activePanel = panel

    panel.onDidDispose(() => {
      activePanel = undefined
    })

    treeDataProvider.onDidChangeTreeData(updateWebview)
    function updateWebview() {
      if (!editor)
        return

      const renderer = initRenderer({
        countStatus: treeDataProvider.getCurrentCountStatus(),
        isMacCodeBlock: treeDataProvider.getCurrentMacCodeBlock(),
        citeStatus: treeDataProvider.getCurrentCiteStatus(),
        isShowLineNumber: treeDataProvider.getCurrentShowLineNumber(),
        legend: treeDataProvider.getCurrentLegend(),
      })

      const markdownContent = editor.document.getText()
      let html = modifyHtmlContent(markdownContent, renderer)
      html = fixLocalImages(html, panel, editor.document.uri)

      const variables = generateCSSVariables({
        primaryColor: treeDataProvider.getCurrentPrimaryColor(),
        fontFamily: treeDataProvider.getCurrentFontFamily(),
        fontSize: treeDataProvider.getCurrentFontSize(),
        isUseIndent: treeDataProvider.getCurrentUseIndent(),
        isUseJustify: treeDataProvider.getCurrentUseJustify(),
      })

      const themeCSS = themeMap[treeDataProvider.getCurrentTheme() as ThemeName]
      const customCSS = vscode.workspace.getConfiguration(`markdownPreview`).get<string>(`customCSS`, ``)
      const completeCss = `${variables}\n\n${baseCSSContent}\n\n${themeCSS}\n\n${css}\n\n${customCSS}`

      lastHtml = html
      lastCss = completeCss

      panel.webview.html = wrapHtmlTag(html, completeCss)
    }

    // render first webview
    updateWebview()

    // Monitor the changes of documents
    const changeSubscription = vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
      if (e.document === editor.document) {
        updateWebview()
      }
    })

    // Cancel the subscription when the panel is closed
    panel.onDidDispose(() => {
      changeSubscription.dispose()
    })
  })

  context.subscriptions.push(disposable)

  // Copy to clipboard
  context.subscriptions.push(
    vscode.commands.registerCommand(`markdown.copyToClipboard`, () => {
      if (!activePanel) {
        vscode.window.showWarningMessage(`请先打开 Markdown 预览`)
        return
      }
      const inlined = inlineCSS(lastHtml, lastCss)
      activePanel.webview.postMessage({ type: `copy`, html: inlined })
      vscode.window.showInformationMessage(`已复制到剪贴板`)
    }),
  )

  // AI polish
  context.subscriptions.push(
    vscode.commands.registerCommand(`markdown.aiPolish`, async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor || editor.document.languageId !== `markdown`) {
        vscode.window.showWarningMessage(`请先打开一个 Markdown 文件`)
        return
      }
      const config = vscode.workspace.getConfiguration(`markdownPreview`)
      const settings = {
        aiEndpoint: config.get<string>(`aiEndpoint`, `https://proxy-ai.doocs.org/v1`),
        aiModel: config.get<string>(`aiModel`, `Qwen/Qwen2.5-7B-Instruct`),
        aiApiKey: config.get<string>(`aiApiKey`, ``),
        aiTemperature: config.get<number>(`aiTemperature`, 1),
        aiMaxTokens: config.get<number>(`aiMaxTokens`, 4096),
        aiPolishPrompt: config.get<string>(`aiPolishPrompt`, `你是一名资深的微信公众号科技长文写手。请将以下科技素材深度改写为适合微信公众号发布的长文。`),
      }
      const text = editor.document.getText()
      await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `AI 润色中...` }, async () => {
        try {
          const result = await polishMarkdown(settings, text)
          await editor.edit((editBuilder) => {
            const fullRange = new vscode.Range(editor.document.positionAt(0), editor.document.positionAt(text.length))
            editBuilder.replace(fullRange, result.content)
          })
          vscode.window.showInformationMessage(`AI 润色完成`)
        }
        catch (e: any) {
          vscode.window.showErrorMessage(e.message)
        }
      })
    }),
  )

  // URL import
  context.subscriptions.push(
    vscode.commands.registerCommand(`markdown.importFromUrl`, async () => {
      const url = await vscode.window.showInputBox({ prompt: `输入要导入的 URL`, placeHolder: `https://example.com/article` })
      if (!url)
        return
      await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `正在导入...` }, async () => {
        try {
          const content = await fetchViaJina(url)
          const doc = await vscode.workspace.openTextDocument({ content, language: `markdown` })
          await vscode.window.showTextDocument(doc)
        }
        catch (e: any) {
          vscode.window.showErrorMessage(e.message)
        }
      })
    }),
  )

  // Watch customCSS config changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`markdownPreview.customCSS`) && activePanel) {
        treeDataProvider.refresh()
      }
    }),
  )

  // When the Markdown file is opened, the preview button is displayed in the status bar.
  vscode.window.onDidChangeActiveTextEditor((editor: vscode.TextEditor | undefined) => {
    if (editor && editor.document.languageId === `markdown`) {
      vscode.commands.executeCommand(`setContext`, `markdownFileActive`, true)
    }
    else {
      vscode.commands.executeCommand(`setContext`, `markdownFileActive`, false)
    }
  })
}

function fixLocalImages(html: string, panel: vscode.WebviewPanel, docUri: vscode.Uri): string {
  const docDir = path.dirname(docUri.fsPath)
  return html.replace(/<img\s[^>]*?src="([^"]+)"([^>]*)>/g, (match, src) => {
    if (/^(?:https?:|data:)/i.test(src))
      return match
    const absPath = path.isAbsolute(src) ? src : path.resolve(docDir, src)
    const webviewUri = panel.webview.asWebviewUri(vscode.Uri.file(absPath))
    return `<img ${match.slice(4, match.indexOf('src=')).trim()}src="${webviewUri}">`
  })
}

function wrapHtmlTag(html: string, css: string) {
  const clipboardScript = `<script>window.addEventListener('message',e=>{if(e.data?.type==='copy'){const b=new Blob([e.data.html],{type:'text/html'});navigator.clipboard.write([new ClipboardItem({'text/html':b})])}})</script>`
  return `<html><head><meta charset="utf-8" /><style>${css}</style></head><body><div style="width: 375px; margin: auto;padding:20px;background:white;position: relative;min-height: 100%;margin: 0 auto;padding: 20px;font-size: 14px;box-sizing: border-box;outline: none;transition: all 300ms ease-in-out;word-wrap: break-word;">${html}</div>${clipboardScript}</body></html>`
}
