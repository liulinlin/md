import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false)

  // 初始化状态（只检查 localStorage）
  const savedAuth = localStorage.getItem('md_auth_token')
  if (savedAuth) {
    isAuthenticated.value = true
  }

  async function login(username: string, pass: string): Promise<boolean> {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: pass }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          isAuthenticated.value = true
          localStorage.setItem('md_auth_token', data.token || 'authenticated')
          return true
        }
      }
    }
    catch (e) {
      console.warn('Backend login request failed:', e)
    }

    return false
  }

  function logout() {
    isAuthenticated.value = false
    localStorage.removeItem('md_auth_token')
    // 可选：重载页面清理内存中的状态
    // window.location.reload()
  }

  return {
    isAuthenticated,
    // isAuthEnabled, // 不再导出，外部认为认证始终开启
    login,
    logout,
  }
})
