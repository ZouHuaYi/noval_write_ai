<template>
  <div class="h-full flex flex-col overflow-hidden">
    <div class="flex-shrink-0 px-4 py-3 border-b border-[color:var(--app-border)] bg-transparent flex items-center justify-between workbench-panel-header">
      <div class="workbench-panel-title">
        <div class="p-1.5 rounded-lg bg-emerald-100">
          <el-icon class="text-emerald-600 text-base"><Edit /></el-icon>
        </div>
        <span class="font-semibold">世界观与规则</span>
      </div>
      <div class="flex items-center space-x-2">
        <el-button
          type="primary"
          @click="saveWorldview"
          :loading="saving"
          class="shadow-sm hover:shadow-md transition-shadow"
        >
          <el-icon class="mr-1"><Check /></el-icon>
          保存
        </el-button>
      </div>
    </div>

    <div class="flex-1 px-6 py-5 overflow-y-auto min-h-0">
      <div v-if="!novelId" class="flex flex-col items-center justify-center h-full app-muted">
        <el-icon class="text-4xl mb-3 app-muted"><Edit /></el-icon>
        <div class="text-sm app-muted">请选择一本小说</div>
      </div>
      <div v-else class="space-y-4">
        <div class="app-section workbench-info-card p-3 flex flex-wrap items-center gap-3 text-sm">
          <span class="workbench-section-title">设定提示</span>
          <span class="app-muted">世界观用于统一故事基调</span>
          <span class="app-muted">规则用于约束剧情合理性</span>
        </div>
        <div class="app-section p-4">
          <div class="text-xs font-medium app-muted mb-2">世界观设定</div>
          <el-input
            v-model="worldviewText"
            type="textarea"
            :rows="10"
            placeholder="输入世界观设定..."
            resize="none"
          />
        </div>

        <div class="app-section p-4">
          <div class="text-xs font-medium app-muted mb-2">规则与限制</div>
          <el-input
            v-model="rulesText"
            type="textarea"
            :rows="10"
            placeholder="输入规则与限制..."
            resize="none"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Check, Edit } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { ref, watch } from 'vue'

const props = defineProps<{
  novelId?: string
}>()

const worldviewText = ref('')
const rulesText = ref('')
const loading = ref(false)
const saving = ref(false)

watch(() => props.novelId, () => {
  loadWorldview()
}, { immediate: true })

async function loadWorldview() {
  if (!props.novelId || loading.value) return

  loading.value = true
  try {
    if (!window.electronAPI?.worldview) {
      ElMessage.warning('Electron API 未加载')
      return
    }
    const record = await window.electronAPI.worldview.get(props.novelId)
    worldviewText.value = record?.worldview || ''
    rulesText.value = record?.rules || ''
  } catch (error: any) {
    console.error('加载世界观失败:', error)
    ElMessage.error('加载世界观失败')
  } finally {
    loading.value = false
  }
}

async function saveWorldview() {
  if (!props.novelId) {
    ElMessage.warning('请先选择小说')
    return
  }

  saving.value = true
  try {
    if (!window.electronAPI?.worldview) {
      ElMessage.warning('Electron API 未加载')
      return
    }
    await window.electronAPI.worldview.save(props.novelId, {
      worldview: worldviewText.value.trim(),
      rules: rulesText.value.trim()
    })
    ElMessage.success('保存成功')
  } catch (error: any) {
    console.error('保存世界观失败:', error)
    ElMessage.error('保存世界观失败')
  } finally {
    saving.value = false
  }
}
</script>
