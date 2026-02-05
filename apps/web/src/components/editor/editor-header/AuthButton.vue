<script setup lang="ts">
import { LogOut } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'

defineProps<{
  asSub?: boolean
}>()

const authStore = useAuthStore()
const { isAuthenticated } = storeToRefs(authStore)
</script>

<template>
  <template v-if="isAuthenticated">
    <MenubarSub v-if="asSub">
      <MenubarSubTrigger>用户</MenubarSubTrigger>
      <MenubarSubContent>
        <MenubarItem @click="authStore.logout">
          <LogOut class="mr-2 h-4 w-4" />
          <span>退出登录</span>
        </MenubarItem>
      </MenubarSubContent>
    </MenubarSub>

    <MenubarMenu v-else>
      <MenubarTrigger>用户</MenubarTrigger>
      <MenubarContent>
        <MenubarItem @click="authStore.logout">
          <LogOut class="mr-2 h-4 w-4" />
          <span>退出登录</span>
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  </template>
</template>
