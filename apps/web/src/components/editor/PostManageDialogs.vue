<script setup lang="ts">
import { useCloudSync } from '@/composables/useCloudSync'
import { usePostStore } from '@/stores/post'
import { useUIStore } from '@/stores/ui'

const uiStore = useUIStore()
const { isShowAddPostDialog, isShowServerListDialog } = storeToRefs(uiStore)

const postStore = usePostStore()
const { posts } = storeToRefs(postStore)

const {
  loadingServerList,
  serverPostList,
  operatingIds,
  fetchServerPostList,
  pullPost,
  deleteServerPost,
} = useCloudSync()

/* ============ 新增内容 ============ */
const addPostInputVal = ref(``)

watch(isShowAddPostDialog, (o) => {
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
  isShowAddPostDialog.value = false
  toast.success(`内容新增成功`)
}

/* ============ 服务器文章管理 ============ */
watch(isShowServerListDialog, async (o) => {
  if (o) {
    await fetchServerPostList()
  }
})

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
  <!-- 新增内容对话框 -->
  <Dialog v-model:open="isShowAddPostDialog">
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
        <Button variant="outline" @click="isShowAddPostDialog = false">
          取消
        </Button>
        <Button @click="addPost()">
          确定
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- 服务器文章列表弹窗 -->
  <Dialog v-model:open="isShowServerListDialog">
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
