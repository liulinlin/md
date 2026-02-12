import { WorkerEntrypoint } from 'cloudflare:workers'

const MP_HOST = `https://api.weixin.qq.com`

interface Env {
  RENDER_API_KEY?: string
  MD_KV: KVNamespace
  MD_DB: D1Database
}

/* ============ 辅助函数 ============ */

function handleCORS(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': `*`,
      'Access-Control-Allow-Methods': `GET,PUT,DELETE,HEAD,POST,OPTIONS`,
      'Access-Control-Allow-Headers': `Content-Type,Authorization`,
      'Access-Control-Max-Age': `86400`,
    },
  })
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': `application/json`,
      'Access-Control-Allow-Origin': `*`,
    },
  })
}

function verifyAuth(request: Request): boolean {
  const auth = request.headers.get(`Authorization`)
  if (!auth || !auth.startsWith(`Bearer `))
    return false
  const token = auth.slice(7).trim()
  return token.length > 0
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
            return jsonResponse({ error: `Username and password required` }, 400)
          }

          // Check D1
          const user = await this.env.MD_DB.prepare(
            `SELECT * FROM users WHERE username = ?`,
          ).bind(username).first() as { password?: string } | null

          if (user && user.password === password) {
            return jsonResponse({ success: true, token: `d1-authenticated` })
          }
          else {
            return jsonResponse({ error: `Invalid credentials` }, 401)
          }
        }
        catch (e: any) {
          return jsonResponse({ error: `Server validation error`, details: e.message }, 500)
        }
      }
      return jsonResponse({ error: `Method not allowed` }, 405)
    }

    // 📦 Handle Storage API — /storage/*
    if (url.pathname.startsWith(`/storage`)) {
      if (request.method === `OPTIONS`) {
        return handleCORS()
      }

      // 认证检查
      if (!verifyAuth(request)) {
        return jsonResponse({ error: `Unauthorized` }, 401)
      }

      return this.handleStorage(request, url)
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
      return jsonResponse({ error: err.message }, 500)
    }
  }

  /* ============ Storage 路由处理 ============ */

  private async handleStorage(request: Request, url: URL): Promise<Response> {
    const db = this.env.MD_DB
    const method = request.method

    // GET /storage/keys — 获取所有键
    if (url.pathname === `/storage/keys` && method === `GET`) {
      const result = await db.prepare(`SELECT key FROM kv_storage`).all()
      const keys = result.results.map((row: any) => row.key)
      return jsonResponse({ keys })
    }

    // DELETE /storage — 清空所有
    if (url.pathname === `/storage` && method === `DELETE`) {
      await db.prepare(`DELETE FROM kv_storage`).run()
      return jsonResponse({ success: true })
    }

    // 提取 key: /storage/:key
    const keyMatch = url.pathname.match(/^\/storage\/(.+)$/)
    if (!keyMatch) {
      return jsonResponse({ error: `Invalid storage path` }, 400)
    }
    const key = decodeURIComponent(keyMatch[1])

    switch (method) {
      case `GET`: {
        const row = await db.prepare(`SELECT value FROM kv_storage WHERE key = ?`).bind(key).first() as { value?: string } | null
        if (!row) {
          return jsonResponse({ value: null }, 404)
        }
        return jsonResponse({ value: row.value })
      }

      case `PUT`: {
        const body = await request.json() as { value?: string }
        if (body.value === undefined) {
          return jsonResponse({ error: `Missing value in body` }, 400)
        }
        await db.prepare(
          `INSERT INTO kv_storage (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        ).bind(key, body.value).run()
        return jsonResponse({ success: true })
      }

      case `DELETE`: {
        await db.prepare(`DELETE FROM kv_storage WHERE key = ?`).bind(key).run()
        return jsonResponse({ success: true })
      }

      case `HEAD`: {
        const exists = await db.prepare(`SELECT 1 FROM kv_storage WHERE key = ?`).bind(key).first()
        return new Response(null, {
          status: exists ? 200 : 404,
          headers: { 'Access-Control-Allow-Origin': `*` },
        })
      }

      default:
        return jsonResponse({ error: `Method not allowed` }, 405)
    }
  }
}
