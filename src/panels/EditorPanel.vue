<template>
  <div class="h-full flex flex-col bg-white overflow-hidden">
    <!-- 顶部工具栏 -->
    <div class="flex-shrink-0 px-4 py-3 border-b border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-sm flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <div class="p-1.5 rounded-lg bg-blue-100">
          <el-icon class="text-blue-600 text-base"><Edit /></el-icon>
        </div>
        <span class="font-semibold text-gray-800">写作区</span>
      </div>
      <div class="flex items-center space-x-2">
        <el-button 
          size="small" 
          type="success" 
          @click="markComplete"
          class="shadow-sm hover:shadow-md transition-shadow"
        >
          <el-icon class="mr-1"><Check /></el-icon>
          标记完成
        </el-button>
        <el-tag size="small" type="info" effect="plain" class="px-2">{{ wordCount }} 字</el-tag>
        <el-tag size="small" :type="statusType" effect="plain" class="px-2">{{ statusText }}</el-tag>
      </div>
    </div>

    <!-- 编辑区域 -->
    <div class="flex-1 px-6 py-5 overflow-y-auto custom-scrollbar min-h-0 bg-gray-50/50">
      <div class="editor-panel-form">
        <!-- 章节编号和标题 -->
        <div class="mb-5 bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div class="flex items-end space-x-3">
            <div class="flex-shrink-0 w-28">
              <div class="text-xs font-medium text-gray-600 mb-2">章节编号</div>
              <el-input-number
                v-model="chapterNumber"
                :min="1"
                :precision="0"
                class="w-full"
                @change="handleChapterNumberChange"
              />
            </div>
            <div class="flex-1">
              <div class="text-xs font-medium text-gray-600 mb-2">章节标题</div>
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
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <el-input
            v-model="content"
            type="textarea"
            :rows="25"
            placeholder="开始写作..."
            resize="none"
            class="editor-textarea"
            @input="updateWordCount"
            @select="handleTextSelect"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Check, Edit } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { computed, ref, watch } from 'vue';

const props = defineProps<{
  novelId?: string
  chapterId?: string | null
}>()

const emit = defineEmits<{
  (e: 'chapter-updated', chapter: any): void
  (e: 'text-selected', text: string): void
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

// 自动保存（防抖）
let saveTimer: any = null
watch([() => content.value, () => chapterTitle.value, () => chapterNumber.value], () => {
  updateWordCount()
  if (props.chapterId) {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      autoSave()
    }, 2000) // 2秒后自动保存
  }
})

async function autoSave() {
  if (!props.chapterId || saving.value) return
  
  try {
    if (window.electronAPI?.chapter) {
      const updateData: any = {
        title: chapterTitle.value,
        content: content.value,
        status: status.value
      }
      if (chapterNumber.value !== null) {
        updateData.chapterNumber = chapterNumber.value
      }
      await window.electronAPI.chapter.update(props.chapterId, updateData)
      // 静默保存，不显示消息
    }
  } catch (error) {
    console.error('自动保存失败:', error)
  }
}

function handleChapterNumberChange(value: number | null) {
  if (props.chapterId && value !== null) {
    // 立即保存章节编号
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      autoSave()
    }, 500) // 0.5秒后保存
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
        status: 'completed'
      }
      if (chapterNumber.value !== null) {
        updateData.chapterNumber = chapterNumber.value
      }
      const chapter = await window.electronAPI.chapter.update(props.chapterId, updateData)
      status.value = 'completed'
      emit('chapter-updated', chapter)
      ElMessage.success('章节已标记为完成')
    }
  } catch (error: any) {
    console.error('更新失败:', error)
    ElMessage.error('更新失败')
  } finally {
    saving.value = false
  }
}
</script>