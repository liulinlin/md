import type { Post } from '@/stores/post'
import { useAuthStore } from '@/stores/auth'
import { usePostStore } from '@/stores/post'
import { addPrefix } from '@/utils'

/** 服务器文章索引的存储 key */
const INDEX_KEY = addPrefix(`post_index`)

/** 单篇文章的存储 key 前缀 */
const POST_KEY_PREFIX = addPrefix(`post__`)

function postKey(id: string) {
  return `${POST_KEY_PREFIX}${id}`
}

/** 服务器端文章摘要 */
export interface ServerPostMeta {
  id: string
  title: string
  updateDatetime: string
}

function getAuthToken(): string | null {
  return localStorage.getItem(`md_auth_token`)
}

async function storageRequest(method: string, endpoint: string, data?: any): Promise<any> {
  const token = getAuthToken()
  if (!token) {
    throw new Error(`未登录`)
  }

  const headers: HeadersInit = {
    'Content-Type': `application/json`,
    'Authorization': `Bearer ${token}`,
  }

  const response = await fetch(`/storage/${encodeURIComponent(endpoint)}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  })

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}))
    throw new Error((errBody as any).error || `请求失败: ${response.status}`)
  }

  if (method === `HEAD`) {
    return { status: response.status }
  }

  return response.json()
}

export function useCloudSync() {
  const uploading = ref(false)
  const loadingServerList = ref(false)
  const serverPostList = ref<ServerPostMeta[]>([])
  /** 正在操作中的服务器文章 ID 集合（拉取/删除时的 loading 状态） */
  const operatingIds = ref<Set<string>>(new Set())

  const authStore = useAuthStore()
  const postStore = usePostStore()
  const { posts, currentPostId } = storeToRefs(postStore)

  function checkAuth(): boolean {
    if (!authStore.isAuthenticated) {
      toast.error(`请先登录`)
      return false
    }
    return true
  }

  /* ============ 上传单篇文章 ============ */

  async function uploadPost(postId?: string) {
    if (!checkAuth())
      return

    const id = postId || currentPostId.value
    const post = postStore.getPostById(id)
    if (!post) {
      toast.error(`未找到要上传的文章`)
      return
    }

    uploading.value = true
    try {
      // 1. 上传文章数据
      await storageRequest(`PUT`, postKey(post.id), {
        value: JSON.stringify(post),
      })

      // 2. 更新服务器索引
      await updateServerIndex(post)

      toast.success(`「${post.title}」上传成功`)
    }
    catch (e: any) {
      console.error(`[CloudSync] Upload failed:`, e)
      toast.error(`上传失败: ${e.message}`)
    }
    finally {
      uploading.value = false
    }
  }

  /** 上传后更新服务器索引 */
  async function updateServerIndex(post: Post) {
    let index: ServerPostMeta[] = []
    try {
      const result = await storageRequest(`GET`, INDEX_KEY)
      if (result.value) {
        index = JSON.parse(result.value)
      }
    }
    catch {
      // 索引不存在，用空数组
    }

    // 更新或追加
    const existing = index.findIndex(item => item.id === post.id)
    const meta: ServerPostMeta = {
      id: post.id,
      title: post.title,
      updateDatetime: String(post.updateDatetime),
    }
    if (existing >= 0) {
      index[existing] = meta
    }
    else {
      index.push(meta)
    }

    await storageRequest(`PUT`, INDEX_KEY, {
      value: JSON.stringify(index),
    })
  }

  /* ============ 获取服务器文章列表 ============ */

  async function fetchServerPostList() {
    if (!checkAuth())
      return

    loadingServerList.value = true
    try {
      const result = await storageRequest(`GET`, INDEX_KEY)
      if (result.value) {
        serverPostList.value = JSON.parse(result.value)
      }
      else {
        serverPostList.value = []
      }
    }
    catch (e: any) {
      console.error(`[CloudSync] Fetch list failed:`, e)
      serverPostList.value = []
      toast.error(`获取服务器列表失败: ${e.message}`)
    }
    finally {
      loadingServerList.value = false
    }
  }

  /* ============ 拉取单篇文章 ============ */

  async function pullPost(postId: string) {
    if (!checkAuth())
      return

    operatingIds.value.add(postId)
    try {
      const result = await storageRequest(`GET`, postKey(postId))
      if (!result.value) {
        toast.warning(`服务器上未找到该文章数据`)
        return
      }

      const serverPost: Post = JSON.parse(result.value)

      // 检查本地是否已存在
      const localPost = postStore.getPostById(postId)
      if (localPost) {
        // 覆盖本地文章内容
        Object.assign(localPost, serverPost)
      }
      else {
        // 本地不存在，追加到列表
        posts.value.push(serverPost)
      }

      // 切换到该文章
      currentPostId.value = postId

      const meta = serverPostList.value.find(m => m.id === postId)
      toast.success(`「${meta?.title || postId}」拉取成功`)
    }
    catch (e: any) {
      console.error(`[CloudSync] Pull post failed:`, e)
      toast.error(`拉取失败: ${e.message}`)
    }
    finally {
      operatingIds.value.delete(postId)
    }
  }

  /* ============ 删除服务器上的单篇文章 ============ */

  async function deleteServerPost(postId: string) {
    if (!checkAuth())
      return

    operatingIds.value.add(postId)
    try {
      // 1. 删除文章数据
      await storageRequest(`DELETE`, postKey(postId))

      // 2. 更新索引
      let index: ServerPostMeta[] = []
      try {
        const result = await storageRequest(`GET`, INDEX_KEY)
        if (result.value) {
          index = JSON.parse(result.value)
        }
      }
      catch {
        // ignore
      }

      index = index.filter(item => item.id !== postId)
      await storageRequest(`PUT`, INDEX_KEY, {
        value: JSON.stringify(index),
      })

      // 3. 更新本地列表
      serverPostList.value = serverPostList.value.filter(item => item.id !== postId)

      toast.success(`已从服务器删除`)
    }
    catch (e: any) {
      console.error(`[CloudSync] Delete server post failed:`, e)
      toast.error(`删除失败: ${e.message}`)
    }
    finally {
      operatingIds.value.delete(postId)
    }
  }

  return {
    uploading,
    loadingServerList,
    serverPostList,
    operatingIds,
    uploadPost,
    fetchServerPostList,
    pullPost,
    deleteServerPost,
  }
}
