<script setup lang="ts">
import { ChevronsDownUp, ChevronsUpDown, CloudDownload, CloudUpload, FolderKanban, PanelLeft, PlusSquare } from 'lucide-vue-next'
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

const postStore = usePostStore()
const { posts } = storeToRefs(postStore)

const authStore = useAuthStore()
const { isAuthenticated } = storeToRefs(authStore)

const {
  uploading,
  loadingServerList,
  serverPostList,
  operatingIds,
  uploadPost,
  fetchServerPostList,
  pullPost,
  deleteServerPost,
} = useCloudSync()

/* ============ 新增内容 ============ */
const isOpenAddDialog = ref(false)
const addPostInputVal = ref(``)

watch(isOpenAddDialog, (o) => {
  if (o) {
    addPostInputVal.value = ``
  }
})

function addPost() {
  if (!addPostInputVal.value.trim())
    return toast.error(`内容标题不可为空`)
  if (posts.value.some(post => post.title === addPostInputVal.value.trim()))
    return toast.error(`内容标题已存在`)
  postStore.addPost(addPostInputVal.value.trim(), null)
  isOpenAddDialog.value = false
  toast.success(`内容新增成功`)
}

/* ============ 服务器文章管理 ============ */
const isOpenServerListDialog = ref(false)

async function openServerListDialog() {
  isOpenServerListDialog.value = true
  await fetchServerPostList()
}

const pullTargetId = ref<string | null>(null)
const isOpenPullConfirmDialog = ref(false)

function confirmPullPost(id: string) {
  pullTargetId.value = id
  isOpenPullConfirmDialog.value = true
}

async function doPull() {
  isOpenPullConfirmDialog.value = false
  if (pullTargetId.value) {
    await pullPost(pullTargetId.value)
  }
}

const deleteTargetId = ref<string | null>(null)
const isOpenDeleteServerConfirmDialog = ref(false)

function confirmDeleteServerPost(id: string) {
  deleteTargetId.value = id
  isOpenDeleteServerConfirmDialog.value = true
}

async function doDeleteServerPost() {
  isOpenDeleteServerConfirmDialog.value = false
  if (deleteTargetId.value) {
    await deleteServerPost(deleteTargetId.value)
  }
}
</script>

<template>
  <!-- 作为 MenubarSub 使用 -->
  <MenubarSub v-if="asSub">
    <MenubarSubTrigger>
      <FolderKanban class="mr-2 size-4" />
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
      <MenubarItem @click="isOpenAddDialog = true">
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
        <MenubarItem :disabled="loadingServerList" @click="openServerListDialog()">
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
      <MenubarItem @click="isOpenAddDialog = true">
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
        <MenubarItem :disabled="loadingServerList" @click="openServerListDialog()">
          <CloudDownload class="mr-2 size-4" />
          服务器文章管理
        </MenubarItem>
      </template>
    </MenubarContent>
  </MenubarMenu>

  <!-- 新增内容对话框 -->
  <Dialog v-model:open="isOpenAddDialog">
    <DialogContent class="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>新增内容</DialogTitle>
        <DialogDescription>
          请输入新内容的标题
        </DialogDescription>
      </DialogHeader>
      <div class="grid gap-4 py-4">
        <Input
          v-model="addPostInputVal"
          placeholder="请输入内容标题"
          @keyup.enter="addPost()"
        />
      </div>
      <DialogFooter>
        <Button variant="outline" @click="isOpenAddDialog = false">
          取消
        </Button>
        <Button @click="addPost()">
          确定
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- 服务器文章列表弹窗 -->
  <Dialog v-model:open="isOpenServerListDialog">
    <DialogContent class="sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle>服务器文章管理</DialogTitle>
        <DialogDescription>
          管理已上传到服务器的文章
        </DialogDescription>
      </DialogHeader>
      <div class="max-h-[400px] overflow-y-auto">
        <div v-if="loadingServerList" class="flex items-center justify-center py-8">
          加载中...
        </div>
        <div v-else-if="!serverPostList.length" class="flex items-center justify-center py-8 text-muted-foreground">
          暂无服务器文章
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="item in serverPostList"
            :key="item.id"
            class="flex items-center justify-between rounded-md border p-3"
          >
            <span class="truncate">{{ item.title }}</span>
            <div class="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                :disabled="operatingIds.has(item.id)"
                @click="confirmPullPost(item.id)"
              >
                拉取
              </Button>
              <Button
                size="sm"
                variant="destructive"
                :disabled="operatingIds.has(item.id)"
                @click="confirmDeleteServerPost(item.id)"
              >
                删除
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>

  <!-- 拉取确认弹窗 -->
  <AlertDialog v-model:open="isOpenPullConfirmDialog">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>确认拉取</AlertDialogTitle>
        <AlertDialogDescription>
          拉取将会覆盖本地同名文章内容，确定继续？
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>取消</AlertDialogCancel>
        <AlertDialogAction @click="doPull()">
          确定
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <!-- 删除服务器文章确认弹窗 -->
  <AlertDialog v-model:open="isOpenDeleteServerConfirmDialog">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>确认删除</AlertDialogTitle>
        <AlertDialogDescription>
          确定要从服务器删除该文章？此操作不可恢复。
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>取消</AlertDialogCancel>
        <AlertDialogAction class="bg-destructive text-destructive-foreground hover:bg-destructive/90" @click="doDeleteServerPost()">
          删除
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
