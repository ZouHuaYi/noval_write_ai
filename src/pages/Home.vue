<template>
  <div class="h-screen flex flex-col app-shell">
    <!-- 顶部导航栏 -->
    <div class="h-16 app-header flex items-center justify-between px-6">
      <div class="flex items-center space-x-4">
        <div class="logo-container">
          <img src="@/assets/logo.svg" alt="Logo" class="app-logo" />
        </div>
        <div>
          <div class="text-xs app-muted">创作工作台</div>
          <h1 class="text-2xl font-semibold bg-gradient-to-r from-[var(--app-primary)] to-[var(--app-accent)] bg-clip-text text-transparent">小说写作助手</h1>
        </div>
      </div>
      <div class="flex items-center space-x-3">
        <el-button type="primary" @click="goToSettings" class="hover-lift">
          <el-icon class="mr-1"><Setting /></el-icon>
          设置
        </el-button>
      </div>
    </div>


    <!-- 主要内容区域 -->
    <div class="flex-1 overflow-auto p-8">
      <div class="max-w-6xl mx-auto">
        <!-- 欢迎卡片 -->
        <el-card shadow="hover" class="mb-6 app-card welcome-card fade-slide-in">
          <div class="text-center py-12">
            <div class="welcome-icon mb-4">
              <img src="@/assets/logo.svg" alt="Welcome" style="width: 80px; height: 80px; margin: 0 auto;" />
            </div>
            <h2 class="text-4xl font-bold mb-4 bg-gradient-to-r from-[var(--app-primary)] to-[var(--app-accent)] bg-clip-text text-transparent">
              欢迎进入创作时刻
            </h2>
            <p class="app-muted text-lg mb-8 max-w-2xl mx-auto">
              让 AI 成为你的写作伙伴，一起创造精彩故事
            </p>
            <div class="flex justify-center space-x-4">
              <el-button type="primary" size="large" @click="goToNovels" class="hover-lift">
                <el-icon class="mr-1"><Document /></el-icon>
                管理小说
              </el-button>
              <el-button size="large" @click="createNovel" :loading="creating" class="hover-lift">
                <el-icon class="mr-1"><Plus /></el-icon>
                创建新小说
              </el-button>
            </div>
          </div>
        </el-card>


        <!-- 快速访问 -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <el-card shadow="hover" class="cursor-pointer app-card feature-card hover-lift" @click="goToNovels">
            <div class="text-center py-8">
              <div class="feature-icon mb-4">
                <el-icon class="text-4xl"><Document /></el-icon>
              </div>
              <h3 class="text-lg font-semibold mb-2">小说管理</h3>
              <p class="text-sm app-muted">查看和管理所有小说</p>
            </div>
          </el-card>

          <el-card
            shadow="hover"
            class="cursor-pointer app-card feature-card hover-lift"
            @click="goToWorkbench"
            :class="{ 'opacity-50 pointer-events-none': !hasNovels }"
          >
            <div class="text-center py-8">
              <div class="feature-icon accent mb-4">
                <el-icon class="text-4xl"><Edit /></el-icon>
              </div>
              <h3 class="text-lg font-semibold mb-2">写作工作台</h3>
              <p class="text-sm app-muted">开始创作你的小说</p>
            </div>
          </el-card>

          <el-card shadow="hover" class="cursor-pointer app-card feature-card hover-lift" @click="goToSettings">
            <div class="text-center py-8">
              <div class="feature-icon danger mb-4">
                <el-icon class="text-4xl"><Setting /></el-icon>
              </div>
              <h3 class="text-lg font-semibold mb-2">应用设置</h3>
              <p class="text-sm app-muted">配置 AI 模型和其他设置</p>
            </div>
          </el-card>
        </div>


        <!-- 最近的小说 -->
        <el-card shadow="hover" v-if="recentNovels.length > 0" class="app-card">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold">最近在写</h3>
              <el-button text @click="goToNovels">查看全部</el-button>
            </div>
          </template>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="novel in recentNovels"
              :key="novel.id"
              class="p-4 app-section hover:border-emerald-300 cursor-pointer transition-colors"
              @click="goToNovelDetail(novel.id)"
            >
              <h4 class="font-semibold mb-2">{{ novel?.title }}</h4>
              <p class="text-sm app-muted line-clamp-2 mb-2">{{ novel.description || '暂无简介' }}</p>
              <div class="flex items-center justify-between">
                <el-tag v-if="novel.genre" size="small">{{ novel.genre }}</el-tag>
                <span class="text-xs app-muted">{{ formatDate(novel.updatedAt) }}</span>
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
.logo-container {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.app-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: transform var(--app-transition-base) ease;
}

.app-logo:hover {
  transform: scale(1.05);
}

.welcome-card {
  background: var(--app-gradient-surface);
  border: 1px solid var(--app-border);
  position: relative;
  overflow: hidden;
}

.welcome-card::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(79, 138, 118, 0.05) 0%, transparent 70%);
  pointer-events: none;
}

.welcome-icon {
  animation: scaleIn 0.6s ease-out;
}

.feature-card {
  transition: all var(--app-transition-base) ease;
  border: 1px solid transparent;
}

.feature-card:hover {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
}

.feature-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: var(--app-primary-soft);
  color: var(--app-primary);
  transition: all var(--app-transition-base) ease;
}

.feature-icon.accent {
  background: var(--app-warning-soft);
  color: var(--app-warning);
}

.feature-icon.danger {
  background: rgba(212, 91, 91, 0.1);
  color: var(--app-danger);
}

.feature-card:hover .feature-icon {
  transform: scale(1.1);
  box-shadow: var(--app-shadow-colored);
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
