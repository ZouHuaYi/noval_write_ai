<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- 顶部工具栏 -->
    <div class="flex-shrink-0 px-4 py-2 border-b border-[color:var(--app-border)] bg-transparent flex items-center justify-between workbench-panel-header">
      <div class="workbench-panel-title">
        <div class="p-1.5 rounded-lg bg-amber-100">
          <el-icon class="text-amber-600 text-base"><Edit /></el-icon>
        </div>
        <span class="font-semibold">写作区</span>
      </div>
      <div class="flex items-center space-x-2">
        <el-button 
          type="primary" 
          @click="markMemory"
          class="shadow-sm hover:shadow-md transition-shadow"
        >
          <el-icon class="mr-1"><MagicStick /></el-icon>
          记忆
        </el-button>
        <el-button 
          type="success" 
          @click="markComplete"
          class="shadow-sm hover:shadow-md transition-shadow"
        >
          标记
        </el-button>
      </div>
    </div>

    <!-- 编辑区域 -->
    <div class="flex-1 px-6 py-5 overflow-y-auto min-h-0">
      <div class="editor-panel-form">
        <div v-if="!props.chapterId" class="h-full flex flex-col items-center justify-center app-muted">
          <div class="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-4">
            <el-icon class="text-2xl text-amber-400"><Edit /></el-icon>
          </div>
          <div class="text-sm">请选择左侧章节开始写作</div>
        </div>
        <div v-else>
          <div class="mb-4 app-section workbench-info-card p-3 flex flex-wrap items-center gap-3 text-sm">
            <span class="workbench-section-title">当前章节</span>
            <span class="app-muted">第 {{ chapterNumber || '-' }} 章</span>
            <span class="app-muted">标题：{{ chapterTitle || '未命名章节' }}</span>
            <el-tag size="small" :type="statusType" effect="plain" class="workbench-count">{{ statusText }}</el-tag>
            <el-tag size="small" type="info" effect="plain" class="workbench-count">{{ wordCount }} 字</el-tag>
          </div>
          <!-- 章节编号和标题 -->
          <div class="mb-5 app-section p-4">
            <div class="flex items-end space-x-3">
              <div class="flex-shrink-0 w-28">
                <div class="text-xs font-medium app-muted mb-2">章节编号</div>
                <el-input-number
                  v-model="chapterNumber"
                  :min="1"
                  :precision="0"
                  class="w-full"
                />
              </div>
              <div class="flex-1">
                <div class="text-xs font-medium app-muted mb-2">章节标题</div>
                <el-input
                  v-model="chapterTitle"
                  placeholder="请输入章节标题"
                  size="default"
                  clearable
                />
              </div>
            </div>
          </div>

          <!-- 正文编辑区 -->
          <div class="app-section p-4">
            <el-input
              v-model="content"
              type="textarea"
              :rows="25"
              placeholder="开始写作..."
              resize="none"
              class="editor-textarea"
              @input="handleContentInput"

              @select="handleTextSelect"
              @change="autoSave"
            />
          </div>
        </div>
      </div>
    </div>
  </div>

</template>

<script setup lang="ts">
import { Edit, MagicStick } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { computed, ref, watch } from 'vue';

const props = defineProps<{
  novelId?: string
  chapterId?: string | null
  externalContent?: string
}>()

const emit = defineEmits<{
  (e: 'chapter-updated', chapter: any): void
  (e: 'text-selected', text: string): void
  (e: 'content-changed', content: string): void
}>()


const selectedText = ref('')

const chapterTitle = ref('')
const chapterNumber = ref<number | null>(null)
const content = ref('')
const wordCount = ref(0)
const status = ref<'draft' | 'writing' | 'completed'>('draft')
const saving = ref(false)

const statusType = computed(() => {
  const map = {
    draft: 'info',
    writing: 'warning',
    completed: 'success'
  }
  return map[status.value]
})

const statusText = computed(() => {
  const map = {
    draft: '草稿',
    writing: '写作中',
    completed: '已完成'
  }
  return map[status.value]
})

watch(() => props.chapterId, async (newId) => {
  if (newId) {
    await loadChapter(newId)
  } else {
    chapterTitle.value = ''
    chapterNumber.value = null
    content.value = ''
    wordCount.value = 0
    status.value = 'draft'
  }
}, { immediate: true })

watch(() => props.externalContent, (newContent) => {
  if (typeof newContent === 'string' && newContent !== content.value) {
    content.value = newContent
    updateWordCount()
  }
})

async function loadChapter(chapterId: string) {

  if (!chapterId) return
  
  try {
    if (window.electronAPI?.chapter) {
      const chapter = await window.electronAPI.chapter.get(chapterId)
      if (chapter) {
        chapterTitle.value = chapter.title || ''
        chapterNumber.value = chapter.chapterNumber || null
        content.value = chapter.content || ''
        status.value = (chapter.status as any) || 'draft'
        updateWordCount()
      }
    }
  } catch (error: any) {
    console.error('加载章节失败:', error)
    ElMessage.error('加载章节失败')
  }
}

const updateWordCount = () => {
  // 简单的中文字数统计（去除空格和标点）
  const text = content.value.replace(/[\s\p{P}]/gu, '')
  wordCount.value = text.length
}

const handleContentInput = () => {
  updateWordCount()
  emit('content-changed', content.value)
}


const handleTextSelect = (event: Event) => {
  const target = event.target as HTMLTextAreaElement
  if (!target) return
  
  const start = target.selectionStart
  const end = target.selectionEnd
  
  if (start !== end && start !== null && end !== null) {
    selectedText.value = content.value.substring(start, end)
    emit('text-selected', selectedText.value)
  } else {
    selectedText.value = ''
    emit('text-selected', '')
  }
}

/**
 * 自动保存
 */
async function autoSave() {
  if (!props.chapterId || saving.value) return
  try {
    if (window.electronAPI?.chapter) {
      const updateData: any = {
        title: chapterTitle.value,
        content: content.value,
        status: 'draft' // 草稿状态
      }
      if (chapterNumber.value !== null) {
        updateData.chapterNumber = chapterNumber.value
      }
      await window.electronAPI.chapter.update(props.chapterId, updateData)
      // 静默保存，不显示消息
      status.value = 'draft'
    }
  } catch (error: any) {
    ElMessage.error('保存失败: ' + (error.message || '未知错误'))
  }
}

async function markMemory() {
  if (!props.chapterId) {
    ElMessage.warning('请先选择章节')
    return
  }
  saving.value = true
  try {
    if (props.novelId && window.electronAPI?.storyEngine) {
      try {
        await window.electronAPI.storyEngine.run(props.novelId)
      } catch (error: any) {
        console.error('运行记忆提取失败:', error)
        ElMessage.error('运行记忆提取失败')
      }
    }

    // 调用相关的记忆功能的接口
    if (window.electronAPI?.chapter) {
      const updateData: any = {
        title: chapterTitle.value,
        content: content.value,
        status: 'completed'
      }
      if (chapterNumber.value !== null) {
        updateData.chapterNumber = chapterNumber.value
      }
      const chapter = await window.electronAPI.chapter.update(props.chapterId, updateData)
      status.value = 'completed'
      emit('chapter-updated', chapter)
      ElMessage.success('章节已完成')
    }
  } catch (error: any) {
    ElMessage.error('更新失败: ' + (error.message || '未知错误'))
  } finally {
    saving.value = false
  }
}


async function markComplete() {
  if (!props.chapterId) {
    ElMessage.warning('请先选择章节')
    return
  }
  saving.value = true
  try {
    if (window.electronAPI?.chapter) {
      const updateData: any = {
        title: chapterTitle.value,
        content: content.value,
        status: 'writing'
      }
      if (chapterNumber.value !== null) {
        updateData.chapterNumber = chapterNumber.value
      }
      const chapter = await window.electronAPI.chapter.update(props.chapterId, updateData)
      status.value = 'writing'
      emit('chapter-updated', chapter)
      ElMessage.success('章节已标记为写作中')
    }
  } catch (error: any) {
    ElMessage.error('更新失败: ' + (error.message || '未知错误'))
  } finally {
    saving.value = false
  }
}
</script>