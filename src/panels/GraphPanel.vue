<template>
  <div class="graph-panel">
    <!-- 工具栏 -->
    <div class="panel-toolbar">
      <div class="toolbar-left">
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
      <div class="toolbar-right">
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
      </div>
    </div>

    <!-- 统计栏 -->
    <div class="panel-stats">
      <div class="stat-item">
        <el-icon class="stat-icon stat-icon--primary"><User /></el-icon>
        <span class="stat-value">{{ stats.nodeTypes?.character || 0 }}</span>
        <span class="stat-label">角色</span>
      </div>
      <div class="stat-item">
        <el-icon class="stat-icon stat-icon--success"><Location /></el-icon>
        <span class="stat-value">{{ stats.nodeTypes?.location || 0 }}</span>
        <span class="stat-label">地点</span>
      </div>
      <div class="stat-item">
        <el-icon class="stat-icon stat-icon--warning"><Present /></el-icon>
        <span class="stat-value">{{ stats.nodeTypes?.item || 0 }}</span>
        <span class="stat-label">物品</span>
      </div>
      <div class="stat-item">
        <el-icon class="stat-icon stat-icon--info"><Connection /></el-icon>
        <span class="stat-value">{{ stats.edgeCount || 0 }}</span>
        <span class="stat-label">关系</span>
      </div>
      <div v-if="conflictCount > 0" class="stat-item stat-item--warning" @click="showConsistencyResult = true">
        <el-icon class="stat-icon stat-icon--danger"><Warning /></el-icon>
        <span class="stat-value">{{ conflictCount }}</span>
        <span class="stat-label">冲突</span>
      </div>
    </div>

    <!-- 图谱区域 -->
    <div class="panel-content">
      <KnowledgeGraphView 
        ref="graphViewRef"
        :novel-id="novelId"
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
      <div v-if="consistencyResult" class="consistency-result">
        <!-- 冲突 -->
        <div v-if="consistencyResult.conflicts?.length" class="result-section">
          <div class="section-header section-header--error">
            <el-icon><CircleClose /></el-icon>
            严重冲突 ({{ consistencyResult.conflicts.length }})
          </div>
          <div v-for="(conflict, i) in consistencyResult.conflicts" :key="i" class="issue-item issue-item--error">
            <div class="issue-title">{{ conflict.title }}</div>
            <div class="issue-message">{{ conflict.message }}</div>
            <div v-if="conflict.suggestion" class="issue-suggestion">
              💡 {{ conflict.suggestion }}
            </div>
          </div>
        </div>

        <!-- 警告 -->
        <div v-if="consistencyResult.warnings?.length" class="result-section">
          <div class="section-header section-header--warning">
            <el-icon><WarnTriangleFilled /></el-icon>
            警告 ({{ consistencyResult.warnings.length }})
          </div>
          <div v-for="(warning, i) in consistencyResult.warnings" :key="i" class="issue-item issue-item--warning">
            <div class="issue-title">{{ warning.title }}</div>
            <div class="issue-message">{{ warning.message }}</div>
          </div>
        </div>

        <!-- 建议 -->
        <div v-if="consistencyResult.suggestions?.length" class="result-section">
          <div class="section-header section-header--info">
            <el-icon><InfoFilled /></el-icon>
            建议 ({{ consistencyResult.suggestions.length }})
          </div>
          <div v-for="(sug, i) in consistencyResult.suggestions" :key="i" class="issue-item issue-item--info">
            <div class="issue-title">{{ sug.title }}</div>
            <div class="issue-message">{{ sug.message }}</div>
          </div>
        </div>

        <!-- 无问题 -->
        <div v-if="!consistencyResult.conflicts?.length && !consistencyResult.warnings?.length" class="all-clear">
          <el-icon class="all-clear-icon"><CircleCheckFilled /></el-icon>
          <span>太棒了！没有发现一致性问题</span>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  CircleCheckFilled, CircleClose, Connection, InfoFilled, 
  Location, MagicStick, Plus, Present, Refresh, 
  Search, User, Warning, WarnTriangleFilled 
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
  // 搜索逻辑由 KnowledgeGraphView 组件处理
}

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

// 监听 novelId 变化
watch(() => props.novelId, () => {
  loadStats()
  consistencyResult.value = null
}, { immediate: true })

onMounted(() => {
  if (props.novelId) {
    loadStats()
  }
})
</script>

<style scoped>
.graph-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--app-bg);
}

.panel-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-section-bg);
  flex-shrink: 0;
}

.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-stats {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 12px 16px;
  background: var(--el-fill-color-lighter);
  border-bottom: 1px solid var(--app-border);
  flex-shrink: 0;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: default;
}

.stat-item--warning {
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  background: #fef0f0;
}

.stat-icon {
  font-size: 18px;
}

.stat-icon--primary { color: var(--el-color-primary); }
.stat-icon--success { color: var(--el-color-success); }
.stat-icon--warning { color: var(--el-color-warning); }
.stat-icon--info { color: var(--el-color-info); }
.stat-icon--danger { color: var(--el-color-danger); }

.stat-value {
  font-size: 18px;
  font-weight: 700;
}

.stat-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.panel-content {
  flex: 1;
  overflow: hidden;
}

/* 一致性检查结果 */
.consistency-result {
  padding: 0 8px;
}

.result-section {
  margin-bottom: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 12px;
  padding: 8px 12px;
  border-radius: 6px;
}

.section-header--error {
  background: #fef0f0;
  color: #f56c6c;
}

.section-header--warning {
  background: #fdf6ec;
  color: #e6a23c;
}

.section-header--info {
  background: #f4f4f5;
  color: #909399;
}

.issue-item {
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 8px;
}

.issue-item--error {
  background: #fef0f0;
  border-left: 3px solid #f56c6c;
}

.issue-item--warning {
  background: #fdf6ec;
  border-left: 3px solid #e6a23c;
}

.issue-item--info {
  background: #f4f4f5;
  border-left: 3px solid #909399;
}

.issue-title {
  font-weight: 600;
  margin-bottom: 4px;
  font-size: 13px;
}

.issue-message {
  font-size: 12px;
  color: var(--el-text-color-regular);
  line-height: 1.5;
}

.issue-suggestion {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-color-primary);
}

.all-clear {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  color: var(--el-color-success);
}

.all-clear-icon {
  font-size: 48px;
  margin-bottom: 12px;
}
</style>
