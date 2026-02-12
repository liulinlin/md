<script setup lang="ts">
import { ChevronsDownUp, ChevronsUpDown, CloudDownload, CloudUpload, PanelLeft, PlusSquare } from 'lucide-vue-next'
import { useCloudSync } from '@/composables/useCloudSync'
import { useAuthStore } from '@/stores/auth'
import { usePostStore } from '@/stores/post'
import { useUIStore } from '@/stores/ui'

withDefaults(defineProps<{
  asSub?: boolean
}>(), {
  asSub: false,
})

const uiStore = useUIStore()
const { isOpenPostSlider } = storeToRefs(uiStore)
const { toggleShowAddPostDialog, toggleShowServerListDialog } = uiStore

const postStore = usePostStore()

const authStore = useAuthStore()
const { isAuthenticated } = storeToRefs(authStore)

const {
  uploading,
  loadingServerList,
  uploadPost,
} = useCloudSync()
</script>

<template>
  <!-- 作为 MenubarSub 使用 -->
  <MenubarSub v-if="asSub">
    <MenubarSubTrigger>
      内容管理
    </MenubarSubTrigger>
    <MenubarSubContent class="w-56">
      <!-- 打开/关闭面板 -->
      <MenubarItem @click="isOpenPostSlider = !isOpenPostSlider">
        <PanelLeft class="mr-2 size-4" />
        {{ isOpenPostSlider ? '关闭内容面板' : '打开内容面板' }}
      </MenubarItem>

      <MenubarSeparator />

      <!-- 新增内容 -->
      <MenubarItem @click="toggleShowAddPostDialog(true)">
        <PlusSquare class="mr-2 size-4" />
        新增内容
      </MenubarItem>

      <MenubarSeparator />

      <!-- 全部收起 -->
      <MenubarItem @click="postStore.collapseAllPosts()">
        <ChevronsDownUp class="mr-2 size-4" />
        全部收起
      </MenubarItem>
      <!-- 全部展开 -->
      <MenubarItem @click="postStore.expandAllPosts()">
        <ChevronsUpDown class="mr-2 size-4" />
        全部展开
      </MenubarItem>

      <!-- 云同步功能（需登录） -->
      <template v-if="isAuthenticated">
        <MenubarSeparator />
        <MenubarItem :disabled="uploading" @click="uploadPost()">
          <CloudUpload class="mr-2 size-4" />
          上传当前文章
        </MenubarItem>
        <MenubarItem :disabled="loadingServerList" @click="toggleShowServerListDialog(true)">
          <CloudDownload class="mr-2 size-4" />
          服务器文章管理
        </MenubarItem>
      </template>
    </MenubarSubContent>
  </MenubarSub>

  <!-- 作为 MenubarMenu 使用（默认） -->
  <MenubarMenu v-else>
    <MenubarTrigger>
      内容管理
    </MenubarTrigger>
    <MenubarContent class="w-56" align="start">
      <!-- 打开/关闭面板 -->
      <MenubarItem @click="isOpenPostSlider = !isOpenPostSlider">
        <PanelLeft class="mr-2 size-4" />
        {{ isOpenPostSlider ? '关闭内容面板' : '打开内容面板' }}
      </MenubarItem>

      <MenubarSeparator />

      <!-- 新增内容 -->
      <MenubarItem @click="toggleShowAddPostDialog(true)">
        <PlusSquare class="mr-2 size-4" />
        新增内容
      </MenubarItem>

      <MenubarSeparator />

      <!-- 全部收起 -->
      <MenubarItem @click="postStore.collapseAllPosts()">
        <ChevronsDownUp class="mr-2 size-4" />
        全部收起
      </MenubarItem>
      <!-- 全部展开 -->
      <MenubarItem @click="postStore.expandAllPosts()">
        <ChevronsUpDown class="mr-2 size-4" />
        全部展开
      </MenubarItem>

      <!-- 云同步功能（需登录） -->
      <template v-if="isAuthenticated">
        <MenubarSeparator />
        <MenubarItem :disabled="uploading" @click="uploadPost()">
          <CloudUpload class="mr-2 size-4" />
          上传当前文章
        </MenubarItem>
        <MenubarItem :disabled="loadingServerList" @click="toggleShowServerListDialog(true)">
          <CloudDownload class="mr-2 size-4" />
          服务器文章管理
        </MenubarItem>
      </template>
    </MenubarContent>
  </MenubarMenu>
</template>
