<template>
  <div class="h-full flex flex-col bg-[var(--app-bg)]">
    <!-- 工具栏 -->
    <div class="flex flex-wrap gap-y-4 justify-between items-center px-4 py-3 border-b border-[var(--app-border)] bg-[var(--app-surface-muted)] shrink-0">
      <div class="flex items-center gap-2">
        <el-input 
          v-model="searchQuery" 
          placeholder="搜索实体..." 
          size="small"
          style="width: 200px"
          clearable
          @input="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select v-model="filterType" size="small" placeholder="筛选类型" clearable style="width: 120px">
          <el-option label="全部" value="" />
          <el-option label="角色" value="character" />
          <el-option label="地点" value="location" />
          <el-option label="物品" value="item" />
          <el-option label="组织" value="organization" />
        </el-select>
      </div>
      <div class="flex items-center gap-2">
        <el-button size="small" @click="analyzeAllChapters" :loading="analyzing">
          <el-icon><MagicStick /></el-icon>
          分析章节
        </el-button>
        <el-button size="small" @click="runConsistencyCheck" :loading="checking">
          <el-icon><Warning /></el-icon>
          一致性检查
        </el-button>
        <el-button size="small" @click="showAddEntityDialog = true">
          <el-icon><Plus /></el-icon>
          添加实体
        </el-button>
        <el-button size="small" @click="refreshGraph">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
        <el-button size="small" @click="showWorldSettings">
          <el-icon><Setting /></el-icon>
          世界观
        </el-button>
      </div>
    </div>

    <!-- 统计栏 -->
    <div class="flex items-center gap-6 px-4 py-3 bg-[var(--el-fill-color-lighter)] border-b border-[var(--app-border)] shrink-0">
      <div class="flex items-center gap-2 cursor-default">
        <el-icon class="text-lg text-[var(--el-color-primary)]"><User /></el-icon>
        <span class="text-lg font-bold">{{ stats.nodeTypes?.character || 0 }}</span>
        <span class="text-xs text-[var(--el-text-color-secondary)]">角色</span>
      </div>
      <div class="flex items-center gap-2 cursor-default">
        <el-icon class="text-lg text-[var(--el-color-success)]"><Location /></el-icon>
        <span class="text-lg font-bold">{{ stats.nodeTypes?.location || 0 }}</span>
        <span class="text-xs text-[var(--el-text-color-secondary)]">地点</span>
      </div>
      <div class="flex items-center gap-2 cursor-default">
        <el-icon class="text-lg text-[var(--el-color-warning)]"><Present /></el-icon>
        <span class="text-lg font-bold">{{ stats.nodeTypes?.item || 0 }}</span>
        <span class="text-xs text-[var(--el-text-color-secondary)]">物品</span>
      </div>
      <div class="flex items-center gap-2 cursor-default">
        <el-icon class="text-lg text-[var(--el-color-info)]"><Connection /></el-icon>
        <span class="text-lg font-bold">{{ stats.edgeCount || 0 }}</span>
        <span class="text-xs text-[var(--el-text-color-secondary)]">关系</span>
      </div>
      <div v-if="conflictCount > 0" class="flex items-center gap-2 cursor-pointer px-2 py-1 rounded-md bg-[#fef0f0]" @click="showConsistencyResult = true">
        <el-icon class="text-lg text-[var(--el-color-danger)]"><Warning /></el-icon>
        <span class="text-lg font-bold">{{ conflictCount }}</span>
        <span class="text-xs text-[var(--el-text-color-secondary)]">冲突</span>
      </div>
    </div>

    <!-- 图谱区域 -->
    <div class="flex-1 overflow-hidden">
      <KnowledgeGraphView 
        ref="graphViewRef"
        :novel-id="novelId"
        hide-toolbar
      />
    </div>

    <!-- 添加实体对话框 -->
    <el-dialog v-model="showAddEntityDialog" title="添加实体" width="500px">
      <el-form :model="newEntity" label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="newEntity.name" placeholder="实体名称" />
        </el-form-item>
        <el-form-item label="类型" required>
          <el-select v-model="newEntity.type" placeholder="选择类型" style="width: 100%">
            <el-option label="角色" value="character" />
            <el-option label="地点" value="location" />
            <el-option label="物品" value="item" />
            <el-option label="组织" value="organization" />
            <el-option label="事件" value="event" />
            <el-option label="概念" value="concept" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="newEntity.description" type="textarea" :rows="3" placeholder="实体描述" />
        </el-form-item>
        <el-form-item label="别名">
          <el-input v-model="newEntity.aliasesText" placeholder="多个别名用逗号分隔" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddEntityDialog = false">取消</el-button>
        <el-button type="primary" @click="addEntity" :loading="adding">添加</el-button>
      </template>
    </el-dialog>

    <!-- 一致性检查结果 -->
    <el-drawer v-model="showConsistencyResult" title="一致性检查结果" size="450px">
      <div v-if="consistencyResult" class="px-2">
        <!-- 冲突 -->
        <div v-if="consistencyResult.conflicts?.length" class="mb-5">
          <div class="flex items-center gap-2 font-600 text-sm mb-3 px-3 py-2 rounded-md bg-[#fef0f0] text-[#f56c6c]">
            <el-icon><CircleClose /></el-icon>
            严重冲突 ({{ consistencyResult.conflicts.length }})
          </div>
          <div v-for="(conflict, i) in consistencyResult.conflicts" :key="i" class="p-3 rounded-md mb-2 bg-[#fef0f0] border-l-3 border-[#f56c6c]">
            <div class="font-600 mb-1 text-[13px]">{{ conflict.title }}</div>
            <div class="text-xs text-[var(--el-text-color-regular)] leading-relaxed">{{ conflict.message }}</div>
            <div v-if="conflict.suggestion" class="mt-2 text-xs text-[var(--el-color-primary)]">
              💡 {{ conflict.suggestion }}
            </div>
          </div>
        </div>

        <!-- 警告 -->
        <div v-if="consistencyResult.warnings?.length" class="mb-5">
          <div class="flex items-center gap-2 font-600 text-sm mb-3 px-3 py-2 rounded-md bg-[#fdf6ec] text-[#e6a23c]">
            <el-icon><WarnTriangleFilled /></el-icon>
            警告 ({{ consistencyResult.warnings.length }})
          </div>
          <div v-for="(warning, i) in consistencyResult.warnings" :key="i" class="p-3 rounded-md mb-2 bg-[#fdf6ec] border-l-3 border-[#e6a23c]">
            <div class="font-600 mb-1 text-[13px]">{{ warning.title }}</div>
            <div class="text-xs text-[var(--el-text-color-regular)] leading-relaxed">{{ warning.message }}</div>
          </div>
        </div>

        <!-- 建议 -->
        <div v-if="consistencyResult.suggestions?.length" class="mb-5">
          <div class="flex items-center gap-2 font-600 text-sm mb-3 px-3 py-2 rounded-md bg-[#f4f4f5] text-[#909399]">
            <el-icon><InfoFilled /></el-icon>
            建议 ({{ consistencyResult.suggestions.length }})
          </div>
          <div v-for="(sug, i) in consistencyResult.suggestions" :key="i" class="p-3 rounded-md mb-2 bg-[#f4f4f5] border-l-3 border-[#909399]">
            <div class="font-600 mb-1 text-[13px]">{{ sug.title }}</div>
            <div class="text-xs text-[var(--el-text-color-regular)] leading-relaxed">{{ sug.message }}</div>
          </div>
        </div>

        <!-- 无问题 -->
        <div v-if="!consistencyResult.conflicts?.length && !consistencyResult.warnings?.length" class="flex flex-col items-center py-10 text-[var(--el-color-success)]">
          <el-icon class="text-5xl mb-3"><CircleCheckFilled /></el-icon>
          <span>太棒了！没有发现一致性问题</span>
        </div>
      </div>
    </el-drawer>
    <!-- 世界观设定对话框 -->
    <el-dialog
      v-model="worldSettingsVisible"
      title="世界观与规则设定"
      width="800px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <div class="px-3">
        <el-tabs v-model="activeSettingTab">
          <el-tab-pane label="世界观设定" name="worldview">
            <div class="flex flex-col gap-3 min-h-[300px]">
              <div class="text-[13px] mb-1 app-muted">设定故事的背景、基调、力量体系等宏观信息</div>
              <el-input
                v-model="worldSettings.worldview"
                type="textarea"
                :rows="12"
                placeholder="在此输入世界观设定..."
                resize="none"
              />
            </div>
          </el-tab-pane>
          <el-tab-pane label="规则与限制" name="rules">
            <div class="flex flex-col gap-3 min-h-[300px]">
              <div class="text-[13px] mb-1 app-muted">设定故事中不可违反的客观规律、禁忌等</div>
              <el-input
                v-model="worldSettings.rules"
                type="textarea"
                :rows="12"
                placeholder="在此输入规则与限制内..."
                resize="none"
              />
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
      <template #footer>
        <el-button @click="worldSettingsVisible = false">取消</el-button>
        <el-button type="primary" @click="saveWorldSettings" :loading="savingSettings">
          保存设定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  CircleCheckFilled, CircleClose, Connection, InfoFilled, 
  Location, MagicStick, Plus, Present, Refresh, 
  Search, Setting, User, Warning, WarnTriangleFilled 
} from '@element-plus/icons-vue'
import KnowledgeGraphView from '@/components/KnowledgeGraphView.vue'

const props = defineProps<{
  novelId?: string
}>()

// 引用
const graphViewRef = ref<any>(null)

// 状态
const searchQuery = ref('')
const filterType = ref('')
const stats = ref<any>({})
const analyzing = ref(false)
const checking = ref(false)
const adding = ref(false)

// 一致性检查
const consistencyResult = ref<any>(null)
const showConsistencyResult = ref(false)

// 添加实体
const showAddEntityDialog = ref(false)
const newEntity = ref({
  name: '',
  type: 'character',
  description: '',
  aliasesText: ''
})

// 世界观设定
const worldSettingsVisible = ref(false)
const activeSettingTab = ref('worldview')
const savingSettings = ref(false)
const worldSettings = ref({
  worldview: '',
  rules: ''
})

// 计算属性
const conflictCount = computed(() => {
  return (consistencyResult.value?.conflicts?.length || 0) + 
         (consistencyResult.value?.warnings?.length || 0)
})

// 加载统计
async function loadStats() {
  if (!props.novelId) return
  
  try {
    stats.value = await window.electronAPI?.graph?.getStats(props.novelId) || {}
  } catch (error) {
    console.error('加载统计失败:', error)
  }
}

// 刷新图谱
function refreshGraph() {
  graphViewRef.value?.loadGraph?.()
  loadStats()
}

// 搜索
function handleSearch() {
  graphViewRef.value?.performSearch?.(searchQuery.value, filterType.value)
}

// 监听筛选变化
watch(filterType, () => {
  handleSearch()
})

// 分析所有章节
async function analyzeAllChapters() {
  if (!props.novelId) {
    ElMessage.warning('请先选择小说')
    return
  }

  analyzing.value = true
  try {
    // 获取所有章节
    const chapters = await window.electronAPI?.chapter?.list(props.novelId)
    
    if (!chapters || chapters.length === 0) {
      ElMessage.warning('没有可分析的章节')
      return
    }

    let analyzed = 0
    for (const chapter of chapters) {
      if (chapter.content && chapter.content.length > 50) {
        await window.electronAPI?.graph?.analyzeChapter(
          props.novelId,
          chapter.chapterNumber || 1,
          chapter.content
        )
        analyzed++
      }
    }

    ElMessage.success(`已分析 ${analyzed} 个章节`)
    refreshGraph()
  } catch (error: any) {
    console.error('分析章节失败:', error)
    ElMessage.error('分析章节失败: ' + (error.message || '未知错误'))
  } finally {
    analyzing.value = false
  }
}

// 一致性检查
async function runConsistencyCheck() {
  if (!props.novelId) {
    ElMessage.warning('请先选择小说')
    return
  }

  checking.value = true
  try {
    consistencyResult.value = await window.electronAPI?.graph?.checkConsistency(props.novelId)
    showConsistencyResult.value = true
    
    const count = conflictCount.value
    if (count === 0) {
      ElMessage.success('没有发现一致性问题')
    } else {
      ElMessage.warning(`发现 ${count} 个问题`)
    }
  } catch (error: any) {
    console.error('一致性检查失败:', error)
    ElMessage.error('一致性检查失败')
  } finally {
    checking.value = false
  }
}

// 添加实体
async function addEntity() {
  if (!props.novelId || !newEntity.value.name || !newEntity.value.type) {
    ElMessage.warning('请填写必要信息')
    return
  }

  adding.value = true
  try {
    const id = newEntity.value.name.toLowerCase().replace(/\s+/g, '_')
    const aliases = newEntity.value.aliasesText
      .split(/[,，]/)
      .map(a => a.trim())
      .filter(a => a)

    await window.electronAPI?.graph?.addNode(props.novelId, id, {
      type: newEntity.value.type,
      label: newEntity.value.name,
      description: newEntity.value.description,
      aliases
    })

    ElMessage.success('实体添加成功')
    showAddEntityDialog.value = false
    
    // 重置表单
    newEntity.value = {
      name: '',
      type: 'character',
      description: '',
      aliasesText: ''
    }
    
    refreshGraph()
  } catch (error: any) {
    console.error('添加实体失败:', error)
    ElMessage.error('添加实体失败')
  } finally {
    adding.value = false
  }
}

// 世界观设定
async function showWorldSettings() {
  if (!props.novelId) {
    ElMessage.warning('请先选择小说')
    return
  }
  
  worldSettingsVisible.value = true
  // 加载现有设定
  try {
    const record = await window.electronAPI?.worldview?.get(props.novelId)
    worldSettings.value = {
      worldview: record?.worldview || '',
      rules: record?.rules || ''
    }
  } catch (error) {
    console.error('加载世界观失败:', error)
  }
}

async function saveWorldSettings() {
  if (!props.novelId) return
  
  savingSettings.value = true
  try {
    await window.electronAPI?.worldview?.save(props.novelId, {
      worldview: worldSettings.value.worldview.trim(),
      rules: worldSettings.value.rules.trim()
    })
    ElMessage.success('世界观设定已保存')
    worldSettingsVisible.value = false
  } catch (error: any) {
    console.error('保存设定失败:', error)
    ElMessage.error('保存失败')
  } finally {
    savingSettings.value = false
  }
}

// 监听 novelId 变化
watch(() => props.novelId, () => {
  loadStats()
  consistencyResult.value = null
  worldSettingsVisible.value = false
}, { immediate: true })

onMounted(() => {
  if (props.novelId) {
    loadStats()
  }
})
</script>
