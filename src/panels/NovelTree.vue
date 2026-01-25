<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- 工具栏 -->
    <div class="flex-shrink-0 px-4 py-3 border-b border-[color:var(--app-border)] space-y-3 workbench-panel-header">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center space-x-2 flex-1 workbench-panel-title">
          <el-select
            v-model="pageSize"
            size="default"
            style="width: 75px"
            class="custom-select"
            @change="handlePageSizeChange"
          >
            <el-option label="10" :value="10" />
            <el-option label="20" :value="20" />
            <el-option label="50" :value="50" />
          </el-select>
          <el-input
            v-model="searchKeyword"
            placeholder="搜索章节..."
            size="default"
            class="flex-1"
            clearable
          >
            <template #prefix>
              <el-icon class="app-muted text-sm"><Search /></el-icon>
            </template>
          </el-input>
        </div>
        <el-tag size="small" effect="plain" class="workbench-count">{{ chapters.length }} 章</el-tag>
      </div>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <el-button
            size="small"
            plain
            @click="handleRefresh"
            :loading="loading"
          >
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
          <el-button
            type="primary"
            size="small"
            @click="showCreateDialog"
            :loading="creating"
          >
            新建章节
          </el-button>
          <el-button
            type="danger"
            size="small"
            plain
            @click="handleClearAllChapters"
            :loading="clearing"
            :disabled="chapters.length === 0"
          >
            清空所有
          </el-button>
        </div>
      </div>
    </div>

    <!-- 章节列表区域 - 可滚动 -->
    <div class="flex-1 px-4 py-4 min-h-0 overflow-y-auto">

      <div v-if="loading" class="flex flex-col justify-center items-center py-16">
        <el-icon class="is-loading text-4xl text-blue-500 mb-3"><Loading /></el-icon>
        <div class="text-sm app-muted">加载中...</div>
      </div>
      <div v-else-if="filteredChapters.length === 0" class="flex flex-col justify-center items-center py-16 px-4">
        <div class="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
          <el-icon class="text-2xl text-emerald-400"><Document /></el-icon>
        </div>
        <div class="app-muted text-sm font-medium mb-2">
          {{ searchKeyword ? '未找到匹配的章节' : '暂无章节' }}
        </div>
        <div v-if="!searchKeyword" class="app-muted text-xs text-center max-w-xs mb-4">
          从这里开始创建故事的第一章
        </div>
        <el-button
          v-if="!searchKeyword"
          type="primary"
          size="small"
          @click="showCreateDialog"
        >
          新建章节
        </el-button>
      </div>
      <div v-else class="space-y-2.5">
        <div
          v-for="chapter in paginatedChapters"
          :key="chapter.id"
          class="group relative p-3.5 rounded-xl cursor-pointer transition-all duration-200 border-2 app-section"
          :class="{ 
            'border-emerald-400 bg-emerald-50 shadow-lg ring-2 ring-emerald-100': chapter.id === activeChapterId,
            'border-[color:var(--app-border)] hover:border-emerald-300 hover:shadow-md hover:bg-emerald-50/40': chapter.id !== activeChapterId
          }"
          @click="selectChapter(chapter.id)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <div class="text-xs app-muted font-medium">第 {{ chapter.chapterNumber }} 章</div>
                <div class="flex items-center space-x-2.5">
                  <span class="text-xs app-muted font-medium">{{ chapter.wordCount }} 字</span>
                  <el-tag 
                    v-if="chapter.status" 
                    :type="getStatusType(chapter.status)" 
                  size="small"
                  effect="plain"
                  class="px-2 py-0.5 text-xs workbench-count"
                >
                  {{ getStatusText(chapter.status) }}
                </el-tag>
                </div>
              </div>
              <div class="font-semibold text-sm truncate mb-2 leading-tight">
                {{ chapter.title }}
              </div>
            </div>
            <el-button
              type="danger"
              :icon="Delete"
              size="small"
              text
              class="opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 hover:bg-red-50 rounded-lg p-1.5"
              @click.stop="handleDeleteChapter(chapter.id, chapter.title)"
            />
          </div>
          <!-- 选中指示器 -->
          <div 
            v-if="chapter.id === activeChapterId"
            class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-emerald-500 rounded-r-full"

          />
        </div>
      </div>
    </div>

    <!-- 分页组件 - 固定在底部 -->
    <div v-if="filteredChapters.length > pageSize" class="flex-shrink-0 px-4 py-3 border-t border-[color:var(--app-border)] bg-transparent">

      <el-pagination
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :total="filteredChapters.length"
        :pager-count="5"
        small
        layout="prev, pager, next"
        class="custom-pagination"
        @current-change="handlePageChange"
      />
    </div>



    <!-- 新建章节对话框 -->
    <el-dialog
      v-model="dialogVisible"
      title="新建章节"
      width="500px"
      :close-on-click-modal="false"
      @close="resetForm"
    >
      <el-form
        ref="formRef"
        :model="chapterForm"
        :rules="formRules"
        label-width="80px"
        label-position="left"
      >
        <el-form-item label="章节编号" prop="chapterNumber">
          <el-input-number
            v-model="chapterForm.chapterNumber"
            :min="1"
            :max="9999"
            placeholder="请输入章节编号"
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="章节标题" prop="title">
          <el-input
            v-model="chapterForm.title"
            placeholder="请输入章节标题"
            clearable
            maxlength="100"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleCreateChapter" :loading="creating">
            确定
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { Delete, Document, Loading, Search, Refresh } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

type Chapter = {
  id: string
  chapterNumber: number
  title: string
  wordCount: number
  status?: string
}

const props = defineProps<{
  novelId?: string
  selectedChapterId?: string | null
}>()

const emit = defineEmits<{
  (e: 'chapter-selected', chapterId: string): void
}>()

const chapters = ref<Chapter[]>([])
const activeChapterId = ref<string | null>(null)
const loading = ref(false)
const creating = ref(false)
const deleting = ref(false)
const clearing = ref(false)
const searchKeyword = ref('')
const currentPage = ref(1)
const pageSize = ref(10) // 每页显示10个章节

// 新建章节对话框相关
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const chapterForm = ref({
  chapterNumber: 1,
  title: ''
})

// 表单验证规则
const formRules: FormRules = {
  chapterNumber: [
    { required: true, message: '请输入章节编号', trigger: 'blur' },
    { type: 'number', min: 1, max: 9999, message: '章节编号必须在1-9999之间', trigger: 'blur' }
  ],
  title: [
    { required: true, message: '请输入章节标题', trigger: 'blur' },
    { min: 1, max: 100, message: '标题长度在1到100个字符之间', trigger: 'blur' }
  ]
}

// 过滤后的章节列表
const filteredChapters = computed(() => {
  if (!searchKeyword.value.trim()) {
    return chapters.value
  }
  const keyword = searchKeyword.value.toLowerCase()
  return chapters.value.filter(chapter => {
    // 支持按标题搜索
    const titleMatch = chapter.title.toLowerCase().includes(keyword)
    // 支持按章节编号搜索
    const numberMatch = chapter.chapterNumber.toString().includes(keyword)
    return titleMatch || numberMatch
  })
})

// 分页后的章节列表
const paginatedChapters = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredChapters.value.slice(start, end)
})

// 监听章节创建事件的处理函数
const handleChapterCreated = (event: any) => {
  if (event.detail?.chapterId && props.novelId) {
    loadChapters()
  }
}

onMounted(() => {
  if (props.novelId) {
    loadChapters()
  }
  
  // 监听章节创建事件
  window.addEventListener('chapter-created', handleChapterCreated as EventListener)
})

onUnmounted(() => {
  // 清理事件监听器
  window.removeEventListener('chapter-created', handleChapterCreated as EventListener)
})

watch(() => props.novelId, (novelId) => {
  if (novelId) {
    loadChapters()
  } else {
    chapters.value = []
    activeChapterId.value = null
    currentPage.value = 1
    searchKeyword.value = ''
  }
})

// 监听外部传入的选中章节ID
watch(() => props.selectedChapterId, (newId) => {
  if (newId) {
    activeChapterId.value = newId
    console.log('[NovelTree] 外部选中章节:', newId)
    // 确保选中的章节在当前页面可见
    const chapterIndex = filteredChapters.value.findIndex(c => c.id === newId)
    if (chapterIndex !== -1) {
      const targetPage = Math.floor(chapterIndex / pageSize.value) + 1
      if (targetPage !== currentPage.value) {
        console.log('[NovelTree] 切换到页面:', targetPage)
        currentPage.value = targetPage
      }
    }
  }
}, { immediate: true })

watch(searchKeyword, () => {
  // 搜索时重置到第一页
  currentPage.value = 1
})

const handlePageChange = (page: number) => {
  currentPage.value = page
}

const handlePageSizeChange = () => {
  currentPage.value = 1 // 切换每页显示数量时重置到第一页
}

async function loadChapters() {
  if (!props.novelId) return
  
  loading.value = true
  try {
    if (window.electronAPI?.chapter) {
      chapters.value = await window.electronAPI.chapter.list(props.novelId)
      // 默认选中第一章节
      if (chapters.value.length > 0 && !activeChapterId.value) {
        activeChapterId.value = chapters.value[0].id
        emit('chapter-selected', chapters.value[0].id)
      }
      // 如果当前选中的章节被删除了,重新选择第一章节
      if (chapters.value.length > 0 && activeChapterId.value) {
        const exists = chapters.value.find(c => c.id === activeChapterId.value)
        if (!exists) {
          activeChapterId.value = chapters.value[0].id
          emit('chapter-selected', chapters.value[0].id)
        }
      }
      // 如果没有章节了,清空选中
      if (chapters.value.length === 0) {
        activeChapterId.value = null
      }
    } else {
      ElMessage.warning('Electron API 未加载')
    }
  } catch (error: any) {
    console.error('[NovelTree] 加载章节列表失败:', error)
    ElMessage.error('加载章节列表失败')
  } finally {
    loading.value = false
  }
}

// 刷新章节列表
async function handleRefresh() {
  await loadChapters()
}

const selectChapter = (id: string) => {
  activeChapterId.value = id
  emit('chapter-selected', id)
}

// 显示新建章节对话框
const showCreateDialog = () => {
  if (!props.novelId) {
    ElMessage.warning('请先选择或创建小说')
    return
  }
  // 设置默认章节编号为当前章节数+1
  chapterForm.value.chapterNumber = chapters.value.length + 1
  chapterForm.value.title = ''
  dialogVisible.value = true
}

// 重置表单
const resetForm = () => {
  formRef.value?.resetFields()
  chapterForm.value = {
    chapterNumber: chapters.value.length + 1,
    title: ''
  }
}

// 创建章节
const handleCreateChapter = async () => {
  if (!formRef.value) return
  // 验证表单
  try {
    await formRef.value.validate()
  } catch {
    return // 验证失败，直接返回
  }
  if (!props.novelId) {
    ElMessage.warning('请先选择或创建小说')
    return
  }
  creating.value = true
  try {
    if (window.electronAPI?.chapter) {
      // 构建章节标题：如果标题为空，使用默认格式；否则使用用户输入的标题
      const title = chapterForm.value.title.trim() 
      const chapterNumber: number = Number(chapterForm.value.chapterNumber)
      const chapter = await window.electronAPI.chapter.create(props.novelId, {
        title: title,
        status: 'draft',
        chapterNumber: chapterNumber
      })
      
      if (chapter?.id) {
        await loadChapters()
        activeChapterId.value = chapter.id
        emit('chapter-selected', chapter.id)
        ElMessage.success('创建成功')
        dialogVisible.value = false
        resetForm()
      }
    } else {
      ElMessage.error('Electron API 未加载')
    }
  } catch (error: any) {
    console.error('创建章节失败:', error)
    ElMessage.error('创建章节失败: ' + (error.message || '未知错误'))
  } finally {
    creating.value = false
  }
}

// 删除章节
const handleDeleteChapter = async (chapterId: string, chapterTitle: string) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除章节 "${chapterTitle}" 吗？此操作不可恢复！`,
      '确认删除',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
        dangerouslyUseHTMLString: false
      }
    )

    deleting.value = true
    try {
      if (window.electronAPI?.chapter) {
        // 删除章节
        await window.electronAPI.chapter.delete(chapterId)
        // 如果是当前选中的章节，需要切换到其他章节
        if (chapterId === activeChapterId.value) {
          const remainingChapters = chapters.value.filter(c => c.id !== chapterId)
          if (remainingChapters.length > 0) {
            activeChapterId.value = remainingChapters[0].id
            emit('chapter-selected', remainingChapters[0].id)
          } else {
            activeChapterId.value = null
          }
        }
        // 重新加载章节列表
        await loadChapters()
        ElMessage.success('章节删除成功')
        // 如果当前页没有内容了，跳转到上一页
        if (paginatedChapters.value.length === 0 && currentPage.value > 1) {
          currentPage.value--
        }
      } else {
        ElMessage.error('Electron API 未加载')
      }
    } catch (error: any) {
      console.error('删除章节失败:', error)
      ElMessage.error('删除章节失败: ' + (error.message || '未知错误'))
    } finally {
      deleting.value = false
    }
  } catch {
    // 用户取消删除
  }
}

// 获取状态类型
const getStatusType = (status: string) => {
  const map: Record<string, string> = {
    draft: 'info',
    writing: 'warning',
    completed: 'success'
  }
  return map[status] || 'info'
}

// 获取状态文本
const getStatusText = (status: string) => {
  const map: Record<string, string> = {
    draft: '草稿',
    writing: '写作中',
    completed: '已完成'
  }
  return map[status] || status
}

// 清空所有章节
const handleClearAllChapters = async () => {
  if (!props.novelId) {
    ElMessage.warning('请先选择小说')
    return
  }

  if (chapters.value.length === 0) {
    ElMessage.warning('当前没有章节可清空')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要清空所有章节吗？\n\n将删除 ${chapters.value.length} 个章节，此操作不可恢复！`,
      '确认清空所有章节',
      {
        confirmButtonText: '确定清空',
        cancelButtonText: '取消',
        type: 'error',
        dangerouslyUseHTMLString: false,
        confirmButtonClass: 'el-button--danger'
      }
    )

    clearing.value = true
    try {
      if (window.electronAPI?.chapter) {
        const result = await window.electronAPI.chapter.deleteAll(props.novelId)
        
        // 同时清空知识图谱
        if (window.electronAPI.graph?.delete) {
          await window.electronAPI.graph.delete(props.novelId)
        }
        
        // 清空当前选中
        activeChapterId.value = null
        emit('chapter-selected', '')
        
        // 重新加载章节列表
        await loadChapters()
        
        ElMessage.success(`已清空 ${result.deletedCount || chapters.value.length} 个章节`)
      } else {
        ElMessage.error('Electron API 未加载')
      }
    } catch (error: any) {
      console.error('清空所有章节失败:', error)
      ElMessage.error('清空所有章节失败: ' + (error.message || '未知错误'))
    } finally {
      clearing.value = false
    }
  } catch {
    // 用户取消操作
  }
}

// 暴露方法供父组件调用
defineExpose({
  loadChapters
})
</script>

<style scoped>
/* 组件特定样式 */
.space-y-1 > * + * {
  margin-top: 0.25rem;
}

/* 自定义选择器样式 */
:deep(.custom-select .el-input__inner) {
  font-weight: 500;
}

/* 自定义分页样式 */
:deep(.custom-pagination .el-pager li) {
  border-radius: 6px;
  margin: 0 2px;
  transition: all 0.2s ease;
}

:deep(.custom-pagination .el-pager li:hover) {
  background-color: #e0e7ff;
  color: #6366f1;
}

:deep(.custom-pagination .el-pager li.is-active) {
  background-color: #6366f1;
  color: white;
}

:deep(.custom-pagination .btn-prev),
:deep(.custom-pagination .btn-next) {
  border-radius: 6px;
  transition: all 0.2s ease;
}

:deep(.custom-pagination .btn-prev:hover),
:deep(.custom-pagination .btn-next:hover) {
  background-color: #e0e7ff;
  color: #6366f1;
}
</style>
