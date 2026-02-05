import { WorkerEntrypoint } from 'cloudflare:workers'
import { handleCORS, handleRender } from './render-api'

const MP_HOST = `https://api.weixin.qq.com`

interface Env {
  RENDER_API_KEY?: string
  MD_KV: KVNamespace
  MD_DB: D1Database
}

export default class extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    // 1️⃣ 获取原请求 URL 与路径
    const url = new URL(request.url)

    // 🔐 Handle Login
    if (url.pathname === `/api/login`) {
      if (request.method === `OPTIONS`) {
        return handleCORS()
      }
      if (request.method === `POST`) {
        try {
          const body = await request.json() as { username?: string, password?: string }
          const { username, password } = body

          if (!username || !password) {
            return new Response(JSON.stringify({ error: 'Username and password required' }), {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
            })
          }

          // Check D1
          const user = await this.env.MD_DB.prepare(
            'SELECT * FROM users WHERE username = ?',
          ).bind(username).first() as { password?: string } | null

          if (user && user.password === password) {
            return new Response(JSON.stringify({ success: true, token: 'd1-authenticated' }), {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
            })
          }
          else {
            return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
              status: 401,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
            })
          }
        }
        catch (e: any) {
          return new Response(JSON.stringify({ error: 'Server validation error', details: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          })
        }
      }
      return new Response(JSON.stringify({ error: `Method not allowed` }), {
        status: 405,
        headers: { 'Content-Type': `application/json` },
      })
    }

    // 处理 /api/render 端点
    if (url.pathname === `/api/render`) {
      if (request.method === `OPTIONS`) {
        return handleCORS()
      }
      if (request.method === `POST`) {
        return handleRender(request, this.env.RENDER_API_KEY)
      }
      return new Response(JSON.stringify({ error: `Method not allowed` }), {
        status: 405,
        headers: { 'Content-Type': `application/json` },
      })
    }

    // 拼接转发目标，例如请求 /cgi-bin/stable_token 就会转发到
    // https://api.weixin.qq.com/cgi-bin/stable_token
    const targetUrl = `${MP_HOST}${url.pathname}${url.search}`

    // 2️⃣ 克隆请求头
    const headers = new Headers(request.headers)

    // 可选：删除或修改一些可能引起冲突的头
    headers.delete(`host`)
    headers.delete(`content-length`)
    headers.delete(`cf-connecting-ip`)
    headers.delete(`x-forwarded-for`)

    // 3️⃣ 构造新的请求
    const init: RequestInit = {
      method: request.method,
      headers,
      redirect: `follow`,
    }

    // ⚙️ 特别处理带 body 的请求（POST/PUT 等）
    if (request.method !== `GET` && request.method !== `HEAD`) {
      // 对文件上传、JSON、表单都可直接转发
      init.body = request.body
    }

    try {
      // 4️⃣ 发起转发请求
      const resp = await fetch(targetUrl, init)

      // 5️⃣ 克隆返回的响应头
      const respHeaders = new Headers(resp.headers)
      // 可选：允许跨域访问（如果你需要在网页端调用）
      respHeaders.set(`Access-Control-Allow-Origin`, `*`)
      respHeaders.set(`Access-Control-Allow-Headers`, `*`)

      return new Response(resp.body, {
        status: resp.status,
        headers: respHeaders,
      })
    }
    catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': `application/json` },
      })
    }
  }
}
