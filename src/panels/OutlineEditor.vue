<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- 顶部工具栏 -->
    <div class="flex-shrink-0 px-4 py-3 border-b border-[color:var(--app-border)] bg-transparent flex items-center justify-between workbench-panel-header">
      <div class="workbench-panel-title">
        <div class="p-1.5 rounded-lg bg-emerald-100">
          <el-icon class="text-emerald-600 text-base"><Document /></el-icon>
        </div>
        <span class="font-semibold">大纲编辑</span>
      </div>
      <div class="flex items-center space-x-2">
        <el-button 
          type="primary" 
          @click="saveOutline" 
          :loading="saving"
          class="shadow-sm hover:shadow-md transition-shadow"
        >
          <el-icon class="mr-1"><Check /></el-icon>
          保存
        </el-button>
      </div>
    </div>

    <!-- 编辑区域 -->
    <div class="flex-1 px-6 py-5 overflow-y-auto min-h-0">
      <div v-if="!outlineId" class="flex flex-col items-center justify-center h-full app-muted">
        <el-icon class="text-4xl mb-3 app-muted"><Document /></el-icon>
        <div class="text-sm app-muted">请从左侧选择一个大纲进行编辑</div>
      </div>
      <div v-else class="space-y-4 outline-editor-form">
        <div class="app-section workbench-info-card p-3 flex flex-wrap items-center gap-3 text-sm">
          <span class="workbench-section-title">大纲范围</span>
          <span class="app-muted">起始：{{ startChapter ?? '-' }}</span>
          <span class="app-muted">结束：{{ endChapter ?? '-' }}</span>
          <span class="app-muted">保存后自动同步范围</span>
        </div>
        <!-- 大纲标题 -->
        <div class="app-section p-4">

          <div class="text-xs font-medium app-muted mb-2">大纲标题</div>
          <el-input
            v-model="outlineTitle"
            placeholder="请输入大纲标题"
            size="default"
            clearable
          />
        <!-- 章节范围 -->
        <div class="flex items-end space-x-3 mt-16px">
           <div class="flex-1">
              <div class="text-xs app-muted mb-1.5">起始章节</div>
              <el-input-number
                v-model="startChapter"
                :min="1"
                :precision="0"
                class="w-full"
                placeholder="起始章节"
                :controls="false"
                :clearable="true"
              />
            </div>
            <div class="flex items-center pb-1">
              <span class="app-muted text-sm font-medium">至</span>
            </div>
            <div class="flex-1">
              <div class="text-xs app-muted mb-1.5">结束章节</div>
              <el-input-number
                v-model="endChapter"
                :precision="0"
                class="w-full"
                placeholder="结束章节"
                :controls="false"
                :min="startChapter ? startChapter : 1"
                :clearable="true"
              />
            </div>
          </div>
        </div>

        <!-- 大纲内容 -->
        <div class="app-section p-4">
          <div class="text-xs font-medium app-muted mb-2">大纲内容</div>
          <el-input
            v-model="outlineContent"
            type="textarea"
            :rows="25"
            placeholder="请输入大纲内容..."
            resize="none"
            class="outline-textarea"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Check, Document } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { onMounted, onUnmounted, ref, watch } from 'vue';


const props = defineProps<{
  outlineId?: string | null
}>()

const emit = defineEmits<{
  (e: 'outline-updated', outline: any): void
}>()

const outlineTitle = ref('')
const outlineContent = ref('')
const startChapter = ref<number | null>(null)
const endChapter = ref<number | null>(null)
const saving = ref(false)

watch(() => props.outlineId, async (newId) => {
  if (newId) {
    await loadOutline(newId)
  } else {
    outlineTitle.value = ''
    outlineContent.value = ''
    startChapter.value = null
    endChapter.value = null
  }
}, { immediate: true })

async function loadOutline(outlineId: string) {
  if (!outlineId) return
  
  try {
    if (!window.electronAPI?.outline) {
      ElMessage.warning('Electron API 未加载')
      return
    }
    const outline = await window.electronAPI.outline.get(outlineId)
    if (outline) {
      outlineTitle.value = outline.title || ''
      outlineContent.value = outline.content || ''
      startChapter.value = outline.startChapter || null
      endChapter.value = outline.endChapter || null
    }
  } catch (error: any) {
    console.error('加载大纲失败:', error)
    ElMessage.error('加载大纲失败')
  }
}

const handleOutlineUpdated = (event: Event) => {
  const customEvent = event as CustomEvent
  const updatedId = customEvent.detail?.outlineId
  if (updatedId && updatedId === props.outlineId) {
    loadOutline(updatedId)
  }
}

onMounted(() => {
  window.addEventListener('outline-updated', handleOutlineUpdated as EventListener)
})

onUnmounted(() => {
  window.removeEventListener('outline-updated', handleOutlineUpdated as EventListener)
})

// 自动保存（防抖）
let saveTimer: any = null
watch([() => outlineTitle.value, () => outlineContent.value, () => startChapter.value, () => endChapter.value], () => {

  if (props.outlineId) {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      autoSave()
    }, 2000) // 2秒后自动保存
  }
})

async function autoSave() {
  if (!props.outlineId || saving.value) return
  
  try {
    if (!window.electronAPI?.outline) {
      ElMessage.warning('Electron API 未加载')
      return
    }
    const updateData: any = {
      title: outlineTitle.value,
      content: outlineContent.value
    }
    if (startChapter.value !== null) {
      updateData.startChapter = startChapter.value
    }
    if (endChapter.value !== null) {
      updateData.endChapter = endChapter.value
    }
    const outline = await window.electronAPI.outline.update(props.outlineId, updateData)
    emit('outline-updated', outline)
  } catch (error) {
    console.error('自动保存失败:', error)
    ElMessage.error('自动保存失败')
  }
}

async function saveOutline() {
  if (!props.outlineId) {
    ElMessage.warning('请先选择大纲')
    return
  }

  if (!outlineTitle.value.trim()) {
    ElMessage.warning('大纲标题不能为空')
    return
  }

  // 验证范围
  if (startChapter.value !== null && endChapter.value !== null) {
    if (startChapter.value > endChapter.value) {
      ElMessage.warning('起始章节不能大于结束章节')
      return
    }
  }

  saving.value = true
  try {
    if (!window.electronAPI?.outline) {
      ElMessage.error('Electron API 未加载')
      return
    }
    const updateData: any = {
      title: outlineTitle.value.trim(),
      content: outlineContent.value
    }
    if (startChapter.value !== null) {
      updateData.startChapter = startChapter.value
    }
    if (endChapter.value !== null) {
      updateData.endChapter = endChapter.value
    }
    const outline = await window.electronAPI.outline.update(props.outlineId, updateData)
    emit('outline-updated', outline)
    ElMessage.success('保存成功')
  } catch (error: any) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败: ' + (error.message || '未知错误'))
  } finally {
    saving.value = false
  }
}
</script>