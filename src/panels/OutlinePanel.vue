<template>
  <div class="h-full flex flex-col overflow-hidden bg-gradient-to-b from-gray-50/30 to-white">
    <!-- 工具栏 -->
    <div class="flex-shrink-0 px-4 pb-3 border-b border-gray-200/60 bg-white/60 backdrop-blur-sm">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-gray-600">大纲列表</span>
        <el-button
          type="primary"
          @click="handleCreateOutline"
          :loading="creating"
          class="shadow-sm hover:shadow-md transition-all"
        >
          <el-icon class="mr-1"><Plus /></el-icon>
          新建
        </el-button>
      </div>
    </div>

    <!-- 大纲列表区域 - 可滚动 -->
    <div class="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar min-h-0">
      <div v-if="loading" class="flex flex-col justify-center items-center py-16">
        <el-icon class="is-loading text-4xl text-blue-500 mb-3"><Loading /></el-icon>
        <div class="text-sm text-gray-500">加载中...</div>
      </div>
      <div v-else-if="outlines.length === 0" class="flex flex-col justify-center items-center py-16 px-4">
        <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <el-icon class="text-2xl text-gray-400"><Document /></el-icon>
        </div>
        <div class="text-gray-600 text-sm font-medium mb-1">暂无大纲</div>
        <div class="text-gray-400 text-xs text-center max-w-xs">
          点击上方按钮创建第一个大纲
        </div>
      </div>
      <div v-else class="space-y-2.5">
        <div
          v-for="outline in outlines"
          :key="outline.id"
          class="group relative p-3.5 rounded-xl cursor-pointer transition-all duration-200 border-2 bg-white"
          :class="{ 
            'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-400 shadow-lg ring-2 ring-blue-100': outline.id === activeOutlineId,
            'border-gray-200 hover:border-blue-300 hover:shadow-md hover:bg-blue-50/30': outline.id !== activeOutlineId
          }"
          @click="selectOutline(outline.id)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-sm text-gray-900 truncate mb-2 leading-tight">
                {{ outline.title }}
              </div>
              <!-- 章节范围显示 -->
              <div v-if="outline.startChapter !== null && outline.startChapter !== undefined || outline.endChapter !== null && outline.endChapter !== undefined" class="mb-2">
                <el-tag size="small" type="info" effect="plain" class="text-xs px-2 py-0.5">
                  <span v-if="outline.startChapter && outline.endChapter">
                    第{{ outline.startChapter }}章 - 第{{ outline.endChapter }}章
                  </span>
                </el-tag>
              </div>
              <div class="text-xs text-gray-400">
                {{ formatDate(outline.updatedAt || outline.createdAt) }}
              </div>
            </div>
            <el-button
              type="danger"
              :icon="Delete"
              size="small"
              text
              class="opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 hover:bg-red-50 rounded-lg p-1.5"
              @click.stop="handleDeleteOutline(outline.id, outline.title)"
            />
          </div>
          <!-- 选中指示器 -->
          <div 
            v-if="outline.id === activeOutlineId"
            class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-full"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Delete, Document, Loading, Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, ref, watch } from 'vue'

type Outline = {
  id: string
  title: string
  content: string
  startChapter?: number | null
  endChapter?: number | null
  createdAt: number
  updatedAt: number
}

const props = defineProps<{
  novelId?: string
}>()

const emit = defineEmits<{
  (e: 'outline-selected', outlineId: string): void
}>()

const outlines = ref<Outline[]>([])
const activeOutlineId = ref<string | null>(null)
const loading = ref(false)
const creating = ref(false)
const deleting = ref(false)

watch(() => props.novelId, (novelId) => {
  if (novelId) {
    loadOutlines()
  } else {
    outlines.value = []
    activeOutlineId.value = null
  }
}, { immediate: true })

onMounted(() => {
  if (props.novelId) {
    loadOutlines()
  }
})

async function loadOutlines() {
  if (!props.novelId) return
  
  loading.value = true
  try {
    if (window.electronAPI?.outline) {
      outlines.value = await window.electronAPI.outline.list(props.novelId)
      // 默认选中第一个大纲
      if (outlines.value.length > 0 && !activeOutlineId.value) {
        activeOutlineId.value = outlines.value[0].id
        emit('outline-selected', outlines.value[0].id)
      }
    } else {
      ElMessage.warning('Electron API 未加载')
    }
  } catch (error: any) {
    console.error('加载大纲列表失败:', error)
    ElMessage.error('加载大纲列表失败')
  } finally {
    loading.value = false
  }
}

const selectOutline = (id: string) => {
  activeOutlineId.value = id
  emit('outline-selected', id)
}

const handleCreateOutline = async () => {
  if (!props.novelId) {
    ElMessage.warning('请先选择小说')
    return
  }

  try {
    const { value: formData } = await ElMessageBox.prompt(
      '请输入大纲标题',
      '新建大纲',
      {
        confirmButtonText: '创建',
        cancelButtonText: '取消',
        inputPlaceholder: '大纲标题',
        inputValidator: (value) => {
          if (!value || value.trim() === '') {
            return '大纲标题不能为空'
          }
          return true
        }
      }
    )

    creating.value = true
    try {
      if (window.electronAPI?.outline) {
        const outline = await window.electronAPI.outline.create(props.novelId, {
          title: formData.trim(),
          content: ''
        })
        
        if (outline?.id) {
          await loadOutlines()
          activeOutlineId.value = outline.id
          emit('outline-selected', outline.id)
          ElMessage.success('创建成功')
        }
      } else {
        ElMessage.error('Electron API 未加载')
      }
    } catch (error: any) {
      console.error('创建大纲失败:', error)
      ElMessage.error('创建大纲失败: ' + (error.message || '未知错误'))
    } finally {
      creating.value = false
    }
  } catch {
    // 用户取消
  }
}

const handleDeleteOutline = async (outlineId: string, outlineTitle: string) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除大纲 "${outlineTitle}" 吗？此操作不可恢复！`,
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
      if (window.electronAPI?.outline) {
        await window.electronAPI.outline.delete(outlineId)
        
        // 如果是当前选中的大纲，需要切换到其他大纲
        if (outlineId === activeOutlineId.value) {
          const remainingOutlines = outlines.value.filter(o => o.id !== outlineId)
          if (remainingOutlines.length > 0) {
            activeOutlineId.value = remainingOutlines[0].id
            emit('outline-selected', remainingOutlines[0].id)
          } else {
            activeOutlineId.value = null
          }
        }
        
        await loadOutlines()
        ElMessage.success('大纲删除成功')
      } else {
        ElMessage.error('Electron API 未加载')
      }
    } catch (error: any) {
      console.error('删除大纲失败:', error)
      ElMessage.error('删除大纲失败: ' + (error.message || '未知错误'))
    } finally {
      deleting.value = false
    }
  } catch {
    // 用户取消删除
  }
}

const formatDate = (timestamp: number) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style scoped>
/* 文本截断样式已在全局样式中定义 */
</style>
