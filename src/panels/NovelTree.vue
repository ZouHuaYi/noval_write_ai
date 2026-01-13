<template>
  <div class="h-full flex flex-col overflow-hidden bg-gradient-to-b from-gray-50/30 to-white">
    <!-- 工具栏 -->
    <div class="flex-shrink-0 px-4 pb-3 border-b border-gray-200">
      <div class="flex items-center space-x-2">
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
            <el-icon class="text-gray-400 text-sm"><Search /></el-icon>
          </template>
        </el-input>
      </div>
    </div>

    <!-- 章节列表区域 - 可滚动 -->
    <div class="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar min-h-0">
      <div v-if="loading" class="flex flex-col justify-center items-center py-16">
        <el-icon class="is-loading text-4xl text-blue-500 mb-3"><Loading /></el-icon>
        <div class="text-sm text-gray-500">加载中...</div>
      </div>
      <div v-else-if="filteredChapters.length === 0" class="flex flex-col justify-center items-center py-16 px-4">
        <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <el-icon class="text-2xl text-gray-400"><Document /></el-icon>
        </div>
        <div class="text-gray-600 text-sm font-medium mb-1">
          {{ searchKeyword ? '未找到匹配的章节' : '暂无章节' }}
        </div>
        <div v-if="!searchKeyword" class="text-gray-400 text-xs text-center max-w-xs">
          点击下方按钮创建第一个章节
        </div>
      </div>
      <div v-else class="space-y-2.5">
        <div
          v-for="chapter in paginatedChapters"
          :key="chapter.id"
          class="group relative p-3.5 rounded-xl cursor-pointer transition-all duration-200 border-2 bg-white"
          :class="{ 
            'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-400 shadow-lg ring-2 ring-blue-100': chapter.id === activeChapterId,
            'border-gray-200 hover:border-blue-300 hover:shadow-md hover:bg-blue-50/30': chapter.id !== activeChapterId
          }"
          @click="selectChapter(chapter.id)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-sm text-gray-900 truncate mb-2 leading-tight">
                {{ chapter.title }}
              </div>
              <div class="flex items-center space-x-2.5">
                <span class="text-xs text-gray-500 font-medium">{{ chapter.wordCount }} 字</span>
                <el-tag 
                  v-if="chapter.status" 
                  :type="getStatusType(chapter.status)" 
                  size="small"
                  effect="plain"
                  class="px-2 py-0.5 text-xs"
                >
                  {{ getStatusText(chapter.status) }}
                </el-tag>
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
            class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-full"
          />
        </div>
      </div>
    </div>

    <!-- 分页组件 - 固定在底部 -->
    <div v-if="filteredChapters.length > pageSize" class="flex-shrink-0 px-4 py-3 border-t border-gray-200/60 bg-white/80 backdrop-blur-sm">
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

    <!-- 底部操作栏 -->
    <div class="flex justify-between px-4 pb-4 border-t border-gray-200/60 bg-white/80 backdrop-blur-sm">
      <el-button
        type="primary"
        size="default"
        class="shadow-md hover:shadow-lg transition-all duration-200 font-medium"
        @click="createChapter"
        :loading="creating"
      >
        <el-icon class="mr-1.5"><Plus /></el-icon>
        新建章节
      </el-button>
      <el-button
        type="danger"
        size="default"
        plain
        class="hover:shadow-md transition-all duration-200"
        @click="handleClearAllChapters"
        :loading="clearing"
        :disabled="chapters.length === 0"
      >
        <el-icon class="mr-1.5"><Delete /></el-icon>
        清空所有
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Delete, Document, Loading, Plus, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

type Chapter = {
  id: string
  title: string
  wordCount: number
  status?: string
}

const props = defineProps<{
  novelId?: string
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

// 过滤后的章节列表
const filteredChapters = computed(() => {
  if (!searchKeyword.value.trim()) {
    return chapters.value
  }
  const keyword = searchKeyword.value.toLowerCase()
  return chapters.value.filter(chapter => 
    chapter.title.toLowerCase().includes(keyword)
  )
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
      // 如果当前选中的章节被删除了，重新选择第一章节
      if (chapters.value.length > 0 && activeChapterId.value) {
        const exists = chapters.value.find(c => c.id === activeChapterId.value)
        if (!exists) {
          activeChapterId.value = chapters.value[0].id
          emit('chapter-selected', chapters.value[0].id)
        }
      }
      // 如果没有章节了，清空选中
      if (chapters.value.length === 0) {
        activeChapterId.value = null
      }
    } else {
      ElMessage.warning('Electron API 未加载')
    }
  } catch (error: any) {
    console.error('加载章节列表失败:', error)
    ElMessage.error('加载章节列表失败')
  } finally {
    loading.value = false
  }
}

const selectChapter = (id: string) => {
  activeChapterId.value = id
  emit('chapter-selected', id)
}

const createChapter = async () => {
  if (!props.novelId) {
    ElMessage.warning('请先选择或创建小说')
    return
  }

  creating.value = true
  try {
    if (window.electronAPI?.chapter) {
      const chapter = await window.electronAPI.chapter.create(props.novelId, {
        title: `第${chapters.value.length + 1}章 新章节`,
        status: 'draft'
      })
      
      if (chapter?.id) {
        await loadChapters()
        activeChapterId.value = chapter.id
        emit('chapter-selected', chapter.id)
        ElMessage.success('创建成功')
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
        
        // 重新排序章节索引（删除后需要重新排序）
        if (window.electronAPI?.chapter?.reorder && props.novelId) {
          await window.electronAPI.chapter.reorder(props.novelId)
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
