<template>
  <div class="h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100">
    <!-- 顶部导航栏 -->
    <div class="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
      <div class="flex items-center space-x-4">
        <h1 class="text-2xl font-bold text-gray-800">📚 小说写作助手</h1>
      </div>
      <div class="flex items-center space-x-3">
        <el-button type="primary" @click="goToSettings">
          <el-icon class="mr-1"><Setting /></el-icon>
          设置
        </el-button>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="flex-1 overflow-auto p-8">
      <div class="max-w-6xl mx-auto">
        <!-- 欢迎卡片 -->
        <el-card shadow="hover" class="mb-6">
          <div class="text-center py-8">
            <h2 class="text-3xl font-bold text-gray-800 mb-4">欢迎使用小说写作助手</h2>
            <p class="text-gray-600 text-lg mb-6">一个强大的 AI 辅助小说创作工具</p>
            <div class="flex justify-center space-x-4">
              <el-button type="primary" size="large" @click="goToNovels">
                <el-icon class="mr-1"><Document /></el-icon>
                管理小说
              </el-button>
              <el-button size="large" @click="createNovel" :loading="creating">
                <el-icon class="mr-1"><Plus /></el-icon>
                创建新小说
              </el-button>
            </div>
          </div>
        </el-card>

        <!-- 快速访问 -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <el-card shadow="hover" class="cursor-pointer hover:shadow-lg transition-shadow" @click="goToNovels">
            <div class="text-center py-6">
              <el-icon class="text-4xl text-blue-500 mb-3"><Document /></el-icon>
              <h3 class="text-lg font-semibold mb-2">小说管理</h3>
              <p class="text-sm text-gray-500">查看和管理所有小说</p>
            </div>
          </el-card>

          <el-card shadow="hover" class="cursor-pointer hover:shadow-lg transition-shadow" @click="goToWorkbench" :class="{ 'opacity-50': !hasNovels }">
            <div class="text-center py-6">
              <el-icon class="text-4xl text-green-500 mb-3"><Edit /></el-icon>
              <h3 class="text-lg font-semibold mb-2">写作工作台</h3>
              <p class="text-sm text-gray-500">开始创作你的小说</p>
            </div>
          </el-card>

          <el-card shadow="hover" class="cursor-pointer hover:shadow-lg transition-shadow" @click="goToSettings">
            <div class="text-center py-6">
              <el-icon class="text-4xl text-purple-500 mb-3"><Setting /></el-icon>
              <h3 class="text-lg font-semibold mb-2">应用设置</h3>
              <p class="text-sm text-gray-500">配置 AI 模型和其他设置</p>
            </div>
          </el-card>
        </div>

        <!-- 最近的小说 -->
        <el-card shadow="hover" v-if="recentNovels.length > 0">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold">最近的小说</h3>
              <el-button text @click="goToNovels">查看全部</el-button>
            </div>
          </template>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="novel in recentNovels"
              :key="novel.id"
              class="p-4 border rounded-lg hover:border-blue-300 cursor-pointer transition-colors"
              @click="goToNovelDetail(novel.id)"
            >
              <h4 class="font-semibold mb-2">{{ novel?.title }}</h4>
              <p class="text-sm text-gray-500 line-clamp-2 mb-2">{{ novel.description || '暂无简介' }}</p>
              <div class="flex items-center justify-between">
                <el-tag v-if="novel.genre" size="small">{{ novel.genre }}</el-tag>
                <span class="text-xs text-gray-400">{{ formatDate(novel.updatedAt) }}</span>
              </div>
            </div>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 创建小说对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      title="创建新小说"
      width="500px"
    >
      <el-form :model="novelForm" label-width="80px">
        <el-form-item label="标题" required>
          <el-input v-model="novelForm.title" placeholder="请输入小说标题" />
        </el-form-item>
        <el-form-item label="类型">
          <el-input v-model="novelForm.genre" placeholder="如：玄幻、都市、科幻" />
        </el-form-item>
        <el-form-item label="简介">
          <el-input
            v-model="novelForm.description"
            type="textarea"
            :rows="4"
            placeholder="请输入小说简介"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreateNovel" :loading="creating">
          创建
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { Document, Edit, Plus, Setting } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

type Novel = {
  id: string
  title: string
  description?: string
  genre?: string
  updatedAt?: number
}

const router = useRouter()
const novels = ref<Novel[]>([])
const loading = ref(false)
const creating = ref(false)
const showCreateDialog = ref(false)
const novelForm = ref({
  title: '',
  genre: '',
  description: ''
})

const hasNovels = computed(() => novels.value.length > 0)
const recentNovels = computed(() => novels.value.slice(0, 6))

onMounted(async () => {
  await loadNovels()
})

async function loadNovels() {
  loading.value = true
  try {
    if (window.electronAPI?.novel) {
      novels.value = await window.electronAPI.novel.list()
    }
  } catch (error: any) {
    console.error('加载小说列表失败:', error)
  } finally {
    loading.value = false
  }
}

function createNovel() {
  showCreateDialog.value = true
}

async function handleCreateNovel() {
  if (!novelForm.value.title.trim()) {
    ElMessage.warning('请输入小说标题')
    return
  }

  creating.value = true
  try {
    if (window.electronAPI?.novel) {
      const novel = await window.electronAPI.novel.create({
        title: novelForm.value.title.trim(),
        genre: novelForm.value.genre.trim() || undefined,
        description: novelForm.value.description.trim() || undefined
      })
      
      ElMessage.success('创建成功！')
      showCreateDialog.value = false
      novelForm.value = { title: '', genre: '', description: '' }
      
      await loadNovels()
      
      // 跳转到工作台
      if (novel?.id) {
        router.push(`/workbench/${novel.id}`)
      }
    } else {
      ElMessage.error('Electron API 未加载')
    }
  } catch (error: any) {
    console.error('创建小说失败:', error)
    ElMessage.error('创建小说失败: ' + (error.message || '未知错误'))
  } finally {
    creating.value = false
  }
}

function goToNovels() {
  router.push('/novels')
}

function goToWorkbench() {
  if (novels.value.length > 0) {
    router.push(`/workbench/${novels.value[0].id}`)
  } else {
    ElMessage.warning('请先创建小说')
  }
}

function goToNovelDetail(id: string) {
  router.push(`/novel/${id}`)
}

function goToSettings() {
  router.push('/settings')
}

function formatDate(timestamp?: number) {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  return date.toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
