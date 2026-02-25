export interface PolishResult {
  content: string
}

export async function polishMarkdown(
  settings: { aiEndpoint: string, aiModel: string, aiApiKey: string, aiTemperature: number, aiMaxTokens: number, aiPolishPrompt: string },
  markdown: string,
): Promise<PolishResult> {
  const { aiEndpoint, aiModel, aiApiKey, aiTemperature, aiMaxTokens, aiPolishPrompt } = settings

  if (!aiEndpoint || !aiModel) {
    throw new Error('请先在插件设置中配置 AI 服务的 API 端点和模型')
  }

  const url = `${aiEndpoint.replace(/\/+$/, '')}/chat/completions`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (aiApiKey) {
    headers.Authorization = `Bearer ${aiApiKey}`
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: aiModel,
      messages: [
        { role: 'system', content: aiPolishPrompt },
        { role: 'user', content: markdown },
      ],
      temperature: aiTemperature,
      max_tokens: aiMaxTokens,
      stream: false,
    }),
  })

  if (!res.ok) {
    throw new Error(`AI 服务返回错误 (${res.status}): ${await res.text()}`)
  }

  const data = await res.json() as any
  const content = data?.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('AI 服务返回了空内容')
  }

  return { content: content.trim() }
}
