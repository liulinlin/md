import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false)

  // 从环境变量获取配置的用户名密码
  const configUsername = import.meta.env.VITE_AUTH_USERNAME
  const configPassword = import.meta.env.VITE_AUTH_PASSWORD

  // 检查是否启用了认证
  const isAuthEnabled = Boolean(configUsername && configPassword)

  // 初始化状态（如果已记录在 localStorage 或未启用认证，则视为已登录）
  if (!isAuthEnabled) {
    isAuthenticated.value = true
  }
  else {
    // 检查 localStorage
    const savedAuth = localStorage.getItem('md_auth_token')
    if (savedAuth === 'authenticated') {
      isAuthenticated.value = true
    }
  }

  function login(username: string, pass: string): boolean {
    if (!isAuthEnabled) {
      isAuthenticated.value = true
      return true
    }

    if (username === configUsername && pass === configPassword) {
      isAuthenticated.value = true
      localStorage.setItem('md_auth_token', 'authenticated')
      return true
    }
    return false
  }

  function logout() {
    if (!isAuthEnabled)
      return

    isAuthenticated.value = false
    localStorage.removeItem('md_auth_token')
    // 可选：重载页面清理内存中的状态
    // window.location.reload()
  }

  return {
    isAuthenticated,
    isAuthEnabled,
    login,
    logout,
  }
})
