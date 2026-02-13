import juice from 'juice'

/**
 * 将 HTML + CSS 转换为内联样式的 HTML，适合粘贴到微信编辑器
 */
export function inlineCSS(html: string, css: string): string {
  const fullHtml = `<style>${css}</style><div id="output">${html}</div>`
  return juice(fullHtml, {
    removeStyleTags: true,
    preserveImportant: true,
  })
}

/**
 * 复制富文本 HTML 到剪贴板
 */
export async function copyToClipboard(html: string): Promise<void> {
  const blob = new Blob([html], { type: 'text/html' })
  const item = new ClipboardItem({ 'text/html': blob })
  await navigator.clipboard.write([item])
}
