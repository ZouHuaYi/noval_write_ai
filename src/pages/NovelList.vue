<template>
  <div class="h-full flex flex-col app-shell">
    <!-- 工具栏 -->
    <div class="p-5 app-header flex items-center justify-between">
      <div class="flex items-center space-x-4">
        <el-button text @click="goToHome">
          <el-icon class="mr-1"><HomeFilled /></el-icon>
          首页
        </el-button>
        <el-divider direction="vertical" />
        <div>
          <div class="text-xs app-muted">创作管理</div>
          <h2 class="text-xl font-semibold">小说列表</h2>
        </div>
        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button label="table">
            <el-icon class="mr-1"><List /></el-icon>
            表格
          </el-radio-button>
          <el-radio-button label="card">
            <el-icon class="mr-1"><Grid /></el-icon>
            卡片
          </el-radio-button>
        </el-radio-group>
      </div>
      <el-button type="primary" @click="showAddDialog = true">
        <el-icon class="mr-1"><Plus /></el-icon>
        添加小说
      </el-button>
    </div>


    <!-- 内容区域 -->
    <div class="flex-1 overflow-auto p-6">
      <div class="app-section p-4 mb-4 flex flex-wrap items-center gap-3">
        <div class="text-sm font-semibold">快速筛选</div>
        <el-input
          v-model="searchKeyword"
          placeholder="按标题搜索"
          clearable
          class="w-56"
        />
        <el-select v-model="sortBy" class="w-40" placeholder="排序方式">
          <el-option label="最近更新" value="updated" />
          <el-option label="创建时间" value="created" />
          <el-option label="标题" value="title" />
        </el-select>
        <el-tag size="small" effect="plain">显示 {{ filteredNovels.length }} / {{ novels.length }}</el-tag>
      </div>
      <!-- 表格视图 -->
      <div v-if="viewMode === 'table'" class="app-card p-3">
        <el-table
          v-loading="loading"
          :data="filteredNovels"
          style="width: 100%"
          @row-click="handleRowClick"
        >
          <el-table-column prop="title" label="标题" width="200" />
          <el-table-column prop="genre" label="类型" width="150" />
          <el-table-column prop="description" label="简介" show-overflow-tooltip />
          <el-table-column prop="updatedAt" label="更新时间" width="180">
            <template #default="{ row }">
              {{ formatDate(row.updatedAt) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click.stop="goToWorkbench(row.id)">
                工作台
              </el-button>
              <el-button link type="primary" @click.stop="editNovel(row)">
                编辑
              </el-button>
              <el-button link type="danger" @click.stop="deleteNovel(row.id)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="filteredNovels.length === 0 && !loading" class="text-center py-10 app-muted">
          <div class="text-sm">暂无小说，点击上方按钮创建</div>
        </div>
      </div>

      <!-- 卡片视图 -->
      <div v-else-if="viewMode === 'card'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <el-card
          v-for="novel in filteredNovels"
          :key="novel.id"
          shadow="hover"
          class="cursor-pointer transition-shadow app-card"
          @click="goToNovelDetail(novel.id)"
        >
          <div class="mb-3">
            <h3 class="text-lg font-semibold mb-2">{{ novel?.title }}</h3>
            <p class="text-sm app-muted line-clamp-2 mb-3">{{ novel?.description || '暂无简介' }}</p>
            <div class="flex items-center justify-between">
              <el-tag v-if="novel?.genre" size="small">{{ novel?.genre }}</el-tag>
              <span class="text-xs app-muted">{{ formatDate(novel?.updatedAt) }}</span>
            </div>
          </div>
          <div class="flex space-x-2 pt-3 border-t border-[color:var(--app-border)]">
            <el-button size="small" type="primary" text @click.stop="goToWorkbench(novel.id)">
              工作台
            </el-button>
            <el-button size="small" text @click.stop="editNovel(novel)">
              编辑
            </el-button>
            <el-button size="small" type="danger" text @click.stop="deleteNovel(novel.id)">
              删除
            </el-button>
          </div>
        </el-card>

        <div v-if="filteredNovels.length === 0 && !loading" class="col-span-full text-center py-12 app-muted">
          <el-icon class="text-4xl mb-2"><Document /></el-icon>
          <div>暂无小说，点击上方按钮创建</div>
        </div>
      </div>
    </div>


    <!-- 添加/编辑对话框 -->
    <el-dialog
      v-model="showAddDialog"
      :title="editingNovel ? '编辑小说' : '添加小说'"
      width="600px"
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
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="saveNovel" :loading="saving">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { Document, Grid, HomeFilled, List, Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
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
const saving = ref(false)
const viewMode = ref<'table' | 'card'>('table')
const showAddDialog = ref(false)
const editingNovel = ref<Novel | null>(null)
const searchKeyword = ref('')
const sortBy = ref('updated')
const novelForm = ref({
  title: '',
  genre: '',
  description: ''
})

const filteredNovels = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  let list = novels.value

  if (keyword) {
    list = list.filter((novel) => {
      return (novel.title || '').toLowerCase().includes(keyword)
    })
  }

  const sorted = [...list]
  if (sortBy.value === 'title') {
    sorted.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'zh-CN'))
  } else if (sortBy.value === 'created') {
    sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  } else {
    sorted.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  }

  return sorted
})

onMounted(async () => {
  await loadNovels()
})



onMounted(async () => {
  await loadNovels()
})

async function loadNovels() {
  loading.value = true
  try {
    if (window.electronAPI?.novel) {
      novels.value = await window.electronAPI.novel.list()
    } else {
      ElMessage.warning('Electron API 未加载')
    }
  } catch (error: any) {
    console.error('加载小说列表失败:', error)
    ElMessage.error('加载小说列表失败: ' + (error.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

function handleRowClick(row: Novel) {
  goToNovelDetail(row.id)
}

function goToNovelDetail(id: string) {
  router.push(`/novel/${id}`)
}

function goToWorkbench(id: string) {
  router.push(`/workbench/${id}`)
}

function goToHome() {
  router.push('/')
}

function formatDate(timestamp?: number) {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN')
}

function editNovel(novel: Novel) {
  editingNovel.value = novel
  novelForm.value = {
    title: novel?.title || '',
    genre: novel?.genre || '',
    description: novel?.description || ''
  }
  showAddDialog.value = true
}

async function saveNovel() {
  if (!novelForm.value.title.trim()) {
    ElMessage.warning('请输入小说标题')
    return
  }

  saving.value = true
  try {
    if (window.electronAPI?.novel) {
      if (editingNovel.value) {
        await window.electronAPI.novel.update(editingNovel.value.id, {
          title: novelForm.value.title.trim(),
          genre: novelForm.value.genre.trim() || undefined,
          description: novelForm.value.description.trim() || undefined
        })
        ElMessage.success('更新成功')
      } else {
        await window.electronAPI.novel.create({
          title: novelForm.value.title.trim(),
          genre: novelForm.value.genre.trim() || undefined,
          description: novelForm.value.description.trim() || undefined
        })
        ElMessage.success('添加成功')
      }
      
      showAddDialog.value = false
      editingNovel.value = null
      novelForm.value = { title: '', genre: '', description: '' }
      await loadNovels()
    } else {
      ElMessage.error('Electron API 未加载')
    }
  } catch (error: any) {
    console.error('保存小说失败:', error)
    ElMessage.error('保存失败: ' + (error.message || '未知错误'))
  } finally {
    saving.value = false
  }
}

async function deleteNovel(id: string) {
  try {
    await ElMessageBox.confirm('确定要删除这本小说吗？此操作不可恢复！', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    if (window.electronAPI?.novel) {
      await window.electronAPI.novel.delete(id)
      ElMessage.success('删除成功')
      await loadNovels()
    } else {
      ElMessage.error('Electron API 未加载')
    }
  } catch {
    // 用户取消
  }
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
