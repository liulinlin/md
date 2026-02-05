<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { useAuthStore } from '@/stores/auth'

const username = ref('')
const password = ref('')
const authStore = useAuthStore()

function handleLogin() {
  if (!username.value || !password.value) {
    toast.error('请输入用户名和密码')
    return
  }

  const success = authStore.login(username.value, password.value)
  if (success) {
    toast.success('登录成功')
  }
  else {
    toast.error('用户名或密码错误')
  }
}
</script>

<template>
  <div class="flex h-screen w-screen items-center justify-center bg-background">
    <div class="w-full max-w-sm space-y-6 rounded-lg border bg-card p-6 shadow-lg">
      <div class="flex flex-col space-y-2 text-center">
        <h1 class="text-2xl font-semibold tracking-tight">
          访问验证
        </h1>
        <p class="text-sm text-muted-foreground">
          请输入凭证以继续
        </p>
      </div>

      <div class="space-y-4">
        <div class="space-y-2">
          <Input
            v-model="username"
            placeholder="用户名"
            class="w-full"
            @keyup.enter="handleLogin"
          />
        </div>
        <div class="space-y-2">
          <PasswordInput
            v-model="password"
            placeholder="密码"
            class="w-full"
            @keyup.enter="handleLogin"
          />
        </div>
        <Button class="w-full" @click="handleLogin">
          进入编辑器
        </Button>
      </div>
    </div>
  </div>
</template>
