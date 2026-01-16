<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- 工具栏 -->
    <div class="flex-shrink-0 px-4 py-3 border-b border-[color:var(--app-border)] bg-transparent workbench-panel-header">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 workbench-panel-title">
          <span class="text-sm font-semibold">大纲列表</span>
          <el-tag size="small" effect="plain" class="workbench-count">{{ outlines.length }}</el-tag>
        </div>
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
    <div class="flex-1 px-4 py-4 min-h-0 overflow-y-auto">

      <div v-if="loading" class="flex flex-col justify-center items-center py-16">
        <el-icon class="is-loading text-4xl text-blue-500 mb-3"><Loading /></el-icon>
        <div class="text-sm app-muted">加载中...</div>
      </div>
      <div v-else-if="outlines.length === 0" class="flex flex-col justify-center items-center py-16 px-4">
        <div class="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
          <el-icon class="text-2xl text-emerald-400"><Document /></el-icon>
        </div>

        <div class="text-sm font-medium app-muted mb-1">暂无大纲</div>
        <div class="app-muted text-xs text-center max-w-xs">
          点击上方按钮创建第一个大纲
        </div>
      </div>
      <div v-else class="space-y-2.5">
        <div
          v-for="outline in outlines"
          :key="outline.id"
          class="group relative p-3.5 rounded-xl cursor-pointer transition-all duration-200 border-2 app-section"
          :class="{ 
            'border-emerald-400 bg-emerald-50 shadow-lg ring-2 ring-emerald-100': outline.id === activeOutlineId,
            'border-[color:var(--app-border)] hover:border-emerald-300 hover:shadow-md hover:bg-emerald-50/40': outline.id !== activeOutlineId
          }"
          @click="selectOutline(outline.id)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-sm truncate mb-2 leading-tight">
                {{ outline.title }}
              </div>
              <!-- 章节范围显示 -->
              <div v-if="outline.startChapter !== null && outline.startChapter !== undefined || outline.endChapter !== null && outline.endChapter !== undefined" class="mb-2">
                <el-tag size="small" type="info" effect="plain" class="text-xs px-2 py-0.5 workbench-count">
                  <span v-if="outline.startChapter && outline.endChapter">
                    第{{ outline.startChapter }}章 - 第{{ outline.endChapter }}章
                  </span>
                </el-tag>
              </div>
              <div class="text-xs app-muted">
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
            class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-emerald-500 rounded-r-full"

          />
        </div>
      </div>
    </div>

    <!-- 新建大纲对话框 -->
    <el-dialog
      v-model="dialogVisible"
      title="新建大纲"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
        label-position="left"
      >
        <el-form-item label="大纲标题" prop="title">
          <el-input
            v-model="formData.title"
            placeholder="请输入大纲标题"
            clearable
          />
        </el-form-item>
        <el-form-item label="起始章节" prop="startChapter">
          <el-input-number
            v-model="formData.startChapter"
            :min="1"
            :precision="0"
            placeholder="请输入起始章节号"
            style="width: 100%"
            clearable
          />
        </el-form-item>
        <el-form-item label="结束章节" prop="endChapter">
          <el-input-number
            v-model="formData.endChapter"
            :min="formData.startChapter || 1"
            :precision="0"
            placeholder="请输入结束章节号"
            style="width: 100%"
            clearable
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitCreateOutline" :loading="creating">
            创建
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { Delete, Document, Loading, Plus } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, reactive, ref, watch } from 'vue'

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
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()

const formData = reactive({
  title: '',
  startChapter: null as number | null,
  endChapter: null as number | null
})

const formRules: FormRules = {
  title: [
    { required: true, message: '请输入大纲标题', trigger: 'blur' },
    { min: 1, max: 100, message: '标题长度在 1 到 100 个字符', trigger: 'blur' }
  ],
  startChapter: [
    { required: true, message: '请输入起始章节', trigger: 'blur' },
    { type: 'number', min: 1, message: '起始章节必须大于0', trigger: 'blur' }
  ],
  endChapter: [
    { required: true, message: '请输入结束章节', trigger: 'blur' },
    { type: 'number', min: 1, message: '结束章节必须大于0', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (formData.startChapter !== null && value !== null) {
          if (value < formData.startChapter) {
            callback(new Error('结束章节不能小于起始章节'))
          } else {
            callback()
          }
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

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

const handleCreateOutline = () => {
  if (!props.novelId) {
    ElMessage.warning('请先选择小说')
    return
  }
  
  // 重置表单
  formData.title = ''
  formData.startChapter = null
  formData.endChapter = null
  formRef.value?.clearValidate()
  dialogVisible.value = true
}

const submitCreateOutline = async () => {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
    
    creating.value = true
    try {
      if (window.electronAPI?.outline) {
        const outline = await window.electronAPI.outline.create(props.novelId!, {
          title: formData.title.trim(),
          content: '',
          startChapter: formData.startChapter!,
          endChapter: formData.endChapter!
        })
        
        if (outline?.id) {
          dialogVisible.value = false
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
    // 表单验证失败
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
