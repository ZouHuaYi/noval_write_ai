<template>
  <div class="h-full flex flex-col app-shell">
    <!-- 面包屑导航 -->
    <Breadcrumb />
    <!-- 工具栏 -->
    <div class="p-5 app-header flex items-center justify-between">
      <div class="flex items-center space-x-4">
        <div>
          <div class="text-xs app-muted">创作管理</div>
          <h2 class="text-xl font-semibold bg-gradient-to-r from-[var(--app-primary)] to-[var(--app-accent)] bg-clip-text text-transparent">小说列表</h2>
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
      <el-button type="primary" @click="openAddDialog">
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
        >
          <el-table-column prop="title" label="标题" width="200" />
          <el-table-column prop="genre" label="类型" width="150" />
          <el-table-column prop="description" label="简介" show-overflow-tooltip />
          <el-table-column prop="updatedAt" label="更新时间" width="180">
            <template #default="{ row }">
              {{ formatDate(row.updatedAt) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="450" fixed="right">
            <template #default="{ row }">
              <el-button size="small"  type="info" @click.stop="handleRowClick(row.id)">
                详情
              </el-button>
              <el-button size="small"  type="primary" @click.stop="editNovel(row)">
                编辑
              </el-button>
              <el-button size="small" type="warning" @click.stop="openWorldviewDialog(row)">
                设置
              </el-button>
              <el-button size="small"  type="success" @click.stop="handleExportNovel(row.id)">
                <el-icon class="mr-1"><Download /></el-icon>
                导出
              </el-button>
              <el-button size="small"  type="danger" @click.stop="deleteNovel(row.id)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="filteredNovels.length === 0 && !loading" class="text-center py-16">
          <EmptyState 
            title="暂无小说"
            description="点击上方按钮创建你的第一部作品"
            action-text="添加小说"
            :icon="Document"
            @action="openAddDialog"
          />
        </div>
      </div>

      <!-- 卡片视图 -->
      <div v-else-if="viewMode === 'card'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <el-card
          v-for="novel in filteredNovels"
          :key="novel.id"
          shadow="hover"
          class="cursor-pointer transition-shadow app-card"
          @click="handleRowClick(novel.id)"
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
            <el-button size="small" text @click.stop="editNovel(novel)">
              编辑
            </el-button>
            <el-button size="small" text type="warning" @click.stop="openWorldviewDialog(novel)">
              设置
            </el-button>
            <el-button size="small" type="success" text @click.stop="handleExportNovel(novel.id)">
              <el-icon class="mr-1"><Download /></el-icon>
              导出
            </el-button>
            <el-button size="small" type="danger" text @click.stop="deleteNovel(novel.id)">
              删除
            </el-button>
          </div>
        </el-card>

        <div v-if="filteredNovels.length === 0 && !loading" class="col-span-full">
          <EmptyState 
            title="暂无小说"
            description="点击上方按钮创建你的第一部作品"
            action-text="添加小说"
            :icon="Document"
            size="large"
            @action="openAddDialog"
          />
        </div>
      </div>
    </div>

    <!-- 添加/编辑对话框 -->
      <el-dialog
        v-model="showAddDialog"
        :title="editingNovel ? '编辑小说' : '添加小说'"
        width="600px"
        @closed="resetDialogState"
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

    <!-- 世界观/规则/大纲 对话框 -->
    <el-dialog
      v-model="showWorldviewDialog"
      :title="`世界观/规则/大纲 - ${worldviewForm.title || '未命名'}`"
      width="720px"
      @closed="resetWorldviewDialog"
    >
      <div v-loading="worldviewLoading">
        <el-tabs v-model="worldviewActiveTab" class="min-h-[320px]">
          <el-tab-pane label="世界观" name="worldview">
            <el-form label-position="top">
              <el-form-item label="世界观">
                <el-input
                  v-model="worldviewForm.worldview"
                  type="textarea"
                  :rows="10"
                  placeholder="请输入世界观设定..."
                />
              </el-form-item>
            </el-form>
          </el-tab-pane>
          <el-tab-pane label="规则" name="rules">
            <el-form label-position="top">
              <el-form-item label="规则">
                <el-input
                  v-model="worldviewForm.rules"
                  type="textarea"
                  :rows="10"
                  placeholder="请输入生成规则与限制..."
                />
              </el-form-item>
            </el-form>
          </el-tab-pane>
          <el-tab-pane label="大纲" name="outline">
            <el-form label-position="top">
              <el-form-item label="大纲">
                <el-input
                  v-model="worldviewForm.outline"
                  type="textarea"
                  :rows="12"
                  placeholder="请输入小说大纲..."
                />
              </el-form-item>
            </el-form>
          </el-tab-pane>
        </el-tabs>
      </div>
      <template #footer>
        <el-button @click="showWorldviewDialog = false">取消</el-button>
        <el-button type="primary" :loading="worldviewSaving" @click="saveWorldviewForm">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { Document, Download, Grid, List, Plus } from '@element-plus/icons-vue'
import EmptyState from '@/components/EmptyState.vue'
import Breadcrumb from '@/components/Breadcrumb.vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

type Novel = {
  id: string
  title: string
  description?: string
  genre?: string
  updatedAt?: number
  createdAt?: number
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
// 世界观/规则/大纲 弹窗状态
const showWorldviewDialog = ref(false)
const worldviewLoading = ref(false)
const worldviewSaving = ref(false)
const worldviewActiveTab = ref('worldview')
const draftKeyPrefix = 'pipeline:draft:'
const worldviewForm = ref({
  novelId: '',
  title: '',
  worldview: '',
  rules: '',
  outline: ''
})
const emptyNovelForm = {
  title: '',
  genre: '',
  description: ''
}
const novelForm = ref({ ...emptyNovelForm })

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

function handleRowClick(id: string) {
  router.push(`/novel/${id}`)
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

function resetDialogState() {
  editingNovel.value = null
  novelForm.value = { ...emptyNovelForm }
}

function openAddDialog() {
  resetDialogState()
  showAddDialog.value = true
}

// 打开世界观/规则/大纲弹窗并加载数据
async function openWorldviewDialog(novel: Novel) {
  if (!novel?.id) {
    ElMessage.warning('请先选择一本小说')
    return
  }
  if (!window.electronAPI?.worldview || !window.electronAPI?.settings) {
    ElMessage.error('Electron API 未加载')
    return
  }
  worldviewLoading.value = true
  showWorldviewDialog.value = true
  worldviewActiveTab.value = 'worldview'
  worldviewForm.value = {
    novelId: novel.id,
    title: novel.title || '未命名',
    worldview: '',
    rules: '',
    outline: ''
  }
  try {
    const [worldview, draft] = await Promise.all([
      window.electronAPI.worldview.get(novel.id),
      window.electronAPI.settings.get(`${draftKeyPrefix}${novel.id}`)
    ])
    worldviewForm.value.worldview = draft?.worldview ?? worldview?.worldview ?? ''
    worldviewForm.value.rules = draft?.rules ?? worldview?.rules ?? ''
    worldviewForm.value.outline = draft?.outline ?? ''
  } catch (error: any) {
    console.error('加载世界观失败:', error)
    ElMessage.error('加载失败: ' + (error.message || '未知错误'))
  } finally {
    worldviewLoading.value = false
  }
}

// 保存世界观/规则/大纲到数据库与草稿
async function saveWorldviewForm() {
  if (!worldviewForm.value.novelId) return
  if (!window.electronAPI?.worldview || !window.electronAPI?.settings) {
    ElMessage.error('Electron API 未加载')
    return
  }
  worldviewSaving.value = true
  try {
    await window.electronAPI.worldview.save(worldviewForm.value.novelId, {
      worldview: worldviewForm.value.worldview.trim(),
      rules: worldviewForm.value.rules.trim()
    })
    await window.electronAPI.settings.set(
      `${draftKeyPrefix}${worldviewForm.value.novelId}`,
      {
        worldview: worldviewForm.value.worldview,
        rules: worldviewForm.value.rules,
        outline: worldviewForm.value.outline,
        updatedAt: Date.now()
      },
      '流水线输入草稿'
    )
    ElMessage.success('保存成功')
    showWorldviewDialog.value = false
  } catch (error: any) {
    console.error('保存世界观失败:', error)
    ElMessage.error('保存失败: ' + (error.message || '未知错误'))
  } finally {
    worldviewSaving.value = false
  }
}

// 重置世界观弹窗状态
function resetWorldviewDialog() {
  worldviewActiveTab.value = 'worldview'
  worldviewForm.value = {
    novelId: '',
    title: '',
    worldview: '',
    rules: '',
    outline: ''
  }
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
      resetDialogState()
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

async function handleExportNovel(id: string) {
  try {
    if (!window.electronAPI?.novel) {
      ElMessage.error('Electron API 未加载')
      return
    }

    const { success, filePath, canceled } = await window.electronAPI.novel.export(id)
    
    if (canceled) {
      return
    }

    if (success) {
      ElMessage.success(`导出成功: ${filePath}`)
    }
  } catch (error: any) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败: ' + (error.message || '未知错误'))
  }
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.app-card {
  transition: all var(--app-transition-base) ease;
}

.app-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--app-shadow);
}
</style>
