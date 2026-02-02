import type { IOpts, RendererAPI } from '@md/shared/types'
import type { ReadTimeResults } from 'reading-time'
import { initRenderer } from '@md/core/renderer'
import { marked } from 'marked'

const MAX_CONTENT_LENGTH = 100 * 1024 // 100KB

interface RenderRequest {
  content: string
  options?: Partial<IOpts>
}

interface RenderResponse {
  html: string
  readingTime: ReadTimeResults
  warnings: string[]
}

function createCorsHeaders(): Headers {
  const headers = new Headers()
  headers.set(`Access-Control-Allow-Origin`, `*`)
  headers.set(`Access-Control-Allow-Methods`, `POST, OPTIONS`)
  headers.set(`Access-Control-Allow-Headers`, `Content-Type, Authorization, X-API-Key`)
  headers.set(`Content-Type`, `application/json`)
  return headers
}

/**
 * 验证 API Key
 * 支持两种方式：Authorization: Bearer <key> 或 X-API-Key: <key>
 */
function validateApiKey(request: Request, apiKey: string | undefined): boolean {
  if (!apiKey) {
    return true // 未配置 API Key 时跳过验证
  }

  // 方式1: Authorization: Bearer <key>
  const authHeader = request.headers.get(`Authorization`)
  if (authHeader?.startsWith(`Bearer `)) {
    const token = authHeader.slice(7)
    if (token === apiKey) {
      return true
    }
  }

  // 方式2: X-API-Key: <key>
  const xApiKey = request.headers.get(`X-API-Key`)
  if (xApiKey === apiKey) {
    return true
  }

  return false
}

export function handleCORS(): Response {
  return new Response(null, {
    status: 204,
    headers: createCorsHeaders(),
  })
}

/**
 * Worker 安全的 Markdown 渲染
 * 跳过 DOMPurify（在 Worker 环境中不可用）
 */
function renderMarkdownForWorker(raw: string, renderer: RendererAPI) {
  const { markdownContent, readingTime } = renderer.parseFrontMatterAndContent(raw)
  const html = marked.parse(markdownContent) as string
  return { html, readingTime }
}

/**
 * Worker 安全的 HTML 后处理
 */
function postProcessHtmlForWorker(
  baseHtml: string,
  reading: ReadTimeResults,
  renderer: RendererAPI,
): string {
  let html = baseHtml
  html = renderer.buildReadingTime(reading) + html
  html += renderer.buildFootnotes()
  html += renderer.buildAddition()
  html += `
    <style>
      .hljs.code__pre > .mac-sign {
        display: ${renderer.getOpts().isMacCodeBlock ? `flex` : `none`};
      }
    </style>
  `
  html += `
    <style>
      h2 strong {
        color: inherit !important;
      }
    </style>
  `
  return renderer.createContainer(html)
}

export async function handleRender(request: Request, apiKey?: string): Promise<Response> {
  const headers = createCorsHeaders()

  // API Key 验证
  if (!validateApiKey(request, apiKey)) {
    return new Response(
      JSON.stringify({ error: `Unauthorized. Invalid or missing API key.` }),
      { status: 401, headers },
    )
  }

  const warnings: string[] = []

  try {
    const body = await request.json() as RenderRequest

    if (!body.content || typeof body.content !== `string`) {
      return new Response(
        JSON.stringify({ error: `Missing or invalid "content" field` }),
        { status: 400, headers },
      )
    }

    if (body.content.length > MAX_CONTENT_LENGTH) {
      return new Response(
        JSON.stringify({
          error: `Content too large. Maximum size is ${MAX_CONTENT_LENGTH / 1024}KB`,
        }),
        { status: 413, headers },
      )
    }

    // 检测不支持的功能
    if (/```mermaid/i.test(body.content)) {
      warnings.push(`Mermaid diagrams require browser rendering`)
    }
    if (/\$\$[\s\S]*?\$\$|\$[^$\n]+\$/.test(body.content)) {
      warnings.push(`KaTeX math formulas require browser rendering`)
    }
    if (/```infographic/i.test(body.content)) {
      warnings.push(`Infographic diagrams require browser rendering`)
    }

    const defaultOpts: IOpts = {
      citeStatus: true,
      countStatus: false,
      isMacCodeBlock: true,
      isShowLineNumber: true,
      themeMode: `light`,
    }
    const opts: IOpts = { ...defaultOpts, ...body.options }

    const renderer = initRenderer(opts)
    const { html: baseHtml, readingTime } = renderMarkdownForWorker(body.content, renderer)
    const html = postProcessHtmlForWorker(baseHtml, readingTime, renderer)

    const response: RenderResponse = {
      html,
      readingTime,
      warnings,
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers,
    })
  }
  catch (error: any) {
    console.error(`Render API error:`, error)
    return new Response(
      JSON.stringify({
        error: `Failed to render markdown`,
        message: error.message || `Unknown error`,
      }),
      { status: 500, headers },
    )
  }
}
