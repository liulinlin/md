const JINA_READER_API = 'https://jina.codeby.cc/'
const DEFAULT_JINA_KEY = 'jina_b2a6bdbd297f4fc2bc890ace1e9dc896eFSHApz4Zu4M_uF5dYQeqFVEkNd-'

export async function fetchViaJina(url: string, jinaApiKey?: string): Promise<string> {
  const apiKey = jinaApiKey?.trim() || DEFAULT_JINA_KEY

  const res = await fetch(`${JINA_READER_API}${url}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'X-Md-Em-Delimiter': '*',
      'X-Engine': 'browser',
      'X-Md-Heading-Style': 'setext',
    },
  })

  if (!res.ok) {
    throw new Error(`请求失败: ${res.status}`)
  }

  let content = await res.text()
  if (!content.trim()) {
    throw new Error('该链接返回的内容为空')
  }

  content = content.replace(/\[!\[(.*?)\]\((.*?)\)\]\(.*?\)/g, '![$1]($2)')
  return content
}
