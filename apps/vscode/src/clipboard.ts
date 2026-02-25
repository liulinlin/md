import juice from 'juice'

export function inlineCSS(html: string, css: string): string {
  const fullHtml = `<style>${css}</style><div id="output">${html}</div>`
  return juice(fullHtml, {
    removeStyleTags: true,
    preserveImportant: true,
  })
}
