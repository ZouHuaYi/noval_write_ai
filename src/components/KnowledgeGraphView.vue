<template>
  <div class="knowledge-graph-container">
    <!-- 工具栏 -->
    <div v-if="!hideToolbar" class="graph-toolbar">
      <div class="toolbar-left">
        <el-button size="small" @click="refreshGraph" :loading="loading">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
        <el-button size="small" @click="fitView">
          <el-icon><FullScreen /></el-icon>
          适应
        </el-button>
        <el-divider direction="vertical" />
        <el-select v-model="filterType" size="small" placeholder="筛选类型" clearable style="width: 120px">
          <el-option label="全部" value="" />
          <el-option label="角色" value="character" />
          <el-option label="地点" value="location" />
          <el-option label="物品" value="item" />
          <el-option label="组织" value="organization" />
        </el-select>
        <el-input 
          v-model="searchQuery" 
          size="small" 
          placeholder="搜索实体..."
          style="width: 150px"
          clearable
          @input="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>
      <div class="toolbar-right">
        <el-tag size="small" type="primary">{{ graphStats?.nodeCount || 0 }} 节点</el-tag>
        <el-tag size="small" type="success">{{ graphStats?.edgeCount || 0 }} 关系</el-tag>
        <el-button size="small" @click="showConsistencyCheck = true">
          <el-icon><Warning /></el-icon>
          一致性检查
        </el-button>
      </div>
    </div>

    <!-- 图谱画布 -->
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      :default-viewport="{ zoom: 0.8, x: 100, y: 100 }"
      :min-zoom="0.2"
      :max-zoom="2"
      fit-view-on-init
      class="graph-flow"
      @node-click="onNodeClick"
    >
      <!-- 自定义节点 -->
      <template #node-graphNode="{ data }">
        <div 
          class="graph-node" 
          :class="[
            `graph-node--${data.nodeType}`,
            { 'graph-node--highlighted': highlightedNodes.has(data.id) }
          ]"
        >
          <div class="node-icon">
            <el-icon v-if="data.nodeType === 'character'"><User /></el-icon>
            <el-icon v-else-if="data.nodeType === 'location'"><Location /></el-icon>
            <el-icon v-else-if="data.nodeType === 'item'"><Present /></el-icon>
            <el-icon v-else-if="data.nodeType === 'organization'"><OfficeBuilding /></el-icon>
            <el-icon v-else><Document /></el-icon>
          </div>
          <div class="node-label">{{ data.label }}</div>
          <div v-if="data.properties?.status === 'dead'" class="node-status node-status--dead">
            已故
          </div>
        </div>
      </template>

      <Background pattern-color="#e5e7eb" :gap="25" />
      <Controls position="bottom-right" />
      <MiniMap position="bottom-left" :pannable="true" />
    </VueFlow>

    <!-- 节点详情面板 -->
    <transition name="slide">
      <div v-if="selectedNode" class="node-detail-panel">
        <div class="panel-header">
          <span class="panel-title">{{ selectedNode.data.label }}</span>
          <el-button :icon="Close" size="small" text @click="selectedNode = null" />
        </div>
        <div class="panel-content">
          <div class="detail-section">
            <div class="detail-label">类型</div>
            <el-tag :type="getNodeTypeTag(selectedNode.data.nodeType)">
              {{ getNodeTypeLabel(selectedNode.data.nodeType) }}
            </el-tag>
          </div>
          
          <div v-if="selectedNode.data.description" class="detail-section">
            <div class="detail-label">描述</div>
            <p class="detail-text">{{ selectedNode.data.description }}</p>
          </div>

          <div v-if="selectedNode.data.aliases?.length" class="detail-section">
            <div class="detail-label">别名</div>
            <div class="alias-tags">
              <el-tag v-for="alias in selectedNode.data.aliases" :key="alias" size="small" type="info">
                {{ alias }}
              </el-tag>
            </div>
          </div>

          <div v-if="Object.keys(selectedNode.data.properties || {}).length" class="detail-section">
            <div class="detail-label">属性</div>
            <div class="properties-list">
              <div v-for="(value, key) in selectedNode.data.properties" :key="key" class="property-item">
                <span class="property-key">{{ key }}</span>
                <span class="property-value">{{ value }}</span>
              </div>
            </div>
          </div>

          <div v-if="nodeRelations.length" class="detail-section">
            <div class="detail-label">关系 ({{ nodeRelations.length }})</div>
            <div class="relations-list">
              <div v-for="rel in nodeRelations.slice(0, 10)" :key="rel.id" class="relation-item">
                <span class="relation-type">{{ rel.label || rel.type }}</span>
                <span class="relation-target">→ {{ getNodeLabel(rel.target) }}</span>
              </div>
              <div v-if="nodeRelations.length > 10" class="relations-more">
                还有 {{ nodeRelations.length - 10 }} 个关系...
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- 一致性检查弹窗 -->
    <el-dialog
      v-model="showConsistencyCheck"
      title="🔍 一致性检查"
      width="600px"
    >
      <div v-if="consistencyLoading" class="loading-state">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>正在检查...</span>
      </div>
      <div v-else-if="consistencyResult" class="consistency-result">
        <div v-if="consistencyResult.conflicts.length" class="result-section">
          <div class="section-header section-header--error">
            <el-icon><CircleClose /></el-icon>
            冲突 ({{ consistencyResult.conflicts.length }})
          </div>
          <div v-for="(conflict, i) in consistencyResult.conflicts" :key="i" class="issue-item issue-item--error">
            <div class="issue-title">{{ conflict.title }}</div>
            <div class="issue-message">{{ conflict.message }}</div>
            <div v-if="conflict.suggestion" class="issue-suggestion">
              💡 {{ conflict.suggestion }}
            </div>
          </div>
        </div>

        <div v-if="consistencyResult.warnings.length" class="result-section">
          <div class="section-header section-header--warning">
            <el-icon><WarnTriangleFilled /></el-icon>
            警告 ({{ consistencyResult.warnings.length }})
          </div>
          <div v-for="(warning, i) in consistencyResult.warnings" :key="i" class="issue-item issue-item--warning">
            <div class="issue-title">{{ warning.title }}</div>
            <div class="issue-message">{{ warning.message }}</div>
          </div>
        </div>

        <div v-if="consistencyResult.suggestions.length" class="result-section">
          <div class="section-header section-header--info">
            <el-icon><InfoFilled /></el-icon>
            建议 ({{ consistencyResult.suggestions.length }})
          </div>
          <div v-for="(sug, i) in consistencyResult.suggestions" :key="i" class="issue-item issue-item--info">
            <div class="issue-title">{{ sug.title }}</div>
            <div class="issue-message">{{ sug.message }}</div>
          </div>
        </div>

        <div v-if="!consistencyResult.conflicts.length && !consistencyResult.warnings.length" class="all-clear">
          <el-icon class="all-clear-icon"><CircleCheckFilled /></el-icon>
          <span>太棒了！没有发现任何一致性问题</span>
        </div>
      </div>
      <template #footer>
        <el-button @click="showConsistencyCheck = false">关闭</el-button>
        <el-button type="primary" @click="runConsistencyCheck" :loading="consistencyLoading">
          重新检查
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { 
  CircleCheckFilled, CircleClose, Close, Document, FullScreen, 
  InfoFilled, Loading, Location, OfficeBuilding, Present, 
  Refresh, Search, User, WarnTriangleFilled, Warning 
} from '@element-plus/icons-vue'
import type { Node, Edge } from '@vue-flow/core'

const props = defineProps<{
  novelId?: string
  hideToolbar?: boolean
}>()

const { fitView: doFitView } = useVueFlow()

// 状态
const loading = ref(false)
const nodes = ref<Node[]>([])
const edges = ref<Edge[]>([])
const selectedNode = ref<Node | null>(null)
const nodeRelations = ref<any[]>([])
const graphStats = ref<any>(null)
const filterType = ref('')
const searchQuery = ref('')
const highlightedNodes = ref<Set<string>>(new Set())

// ...

// 搜索 (暴露给父组件调用)
async function performSearch(query: string, type?: string) {
  searchQuery.value = query
  filterType.value = type || ''
  await handleSearch()
}

defineExpose({
  loadGraph,
  performSearch,
  fitView
})

// 一致性检查
const showConsistencyCheck = ref(false)
const consistencyLoading = ref(false)
const consistencyResult = ref<any>(null)

// 节点类型配置
const nodeTypeLabels: Record<string, string> = {
  character: '角色',
  location: '地点',
  item: '物品',
  organization: '组织',
  event: '事件',
  concept: '概念'
}

const nodeTypeTags: Record<string, string> = {
  character: 'primary',
  location: 'success',
  item: 'warning',
  organization: 'danger',
  event: 'info',
  concept: ''
}

function getNodeTypeLabel(type: string): string {
  return nodeTypeLabels[type] || type
}

function getNodeTypeTag(type: string): string {
  return nodeTypeTags[type] || 'info'
}

function getNodeLabel(nodeId: string): string {
  const node = nodes.value.find(n => n.id === nodeId)
  return node?.data?.label || nodeId
}

// 加载图谱
async function loadGraph() {
  if (!props.novelId) return
  
  loading.value = true
  try {
    // 加载可视化数据
    const data = await window.electronAPI?.graph?.exportForVisualization(props.novelId)
    if (data) {
      nodes.value = data.nodes
      edges.value = data.edges
    }

    // 加载统计
    graphStats.value = await window.electronAPI?.graph?.getStats(props.novelId)
  } catch (error) {
    console.error('加载图谱失败:', error)
  } finally {
    loading.value = false
  }
}

// 刷新
function refreshGraph() {
  loadGraph()
}

// 适应视图
function fitView() {
  doFitView({ padding: 0.2 })
}

// 节点点击
async function onNodeClick({ node }: { node: Node }) {
  selectedNode.value = node
  
  // 加载节点关系
  if (props.novelId) {
    try {
      nodeRelations.value = await window.electronAPI?.graph?.getNodeEdges(
        props.novelId, 
        node.id, 
        'out'
      ) || []
    } catch (error) {
      console.error('加载节点关系失败:', error)
      nodeRelations.value = []
    }
  }
}

// 搜索
async function handleSearch() {
  if (!props.novelId || !searchQuery.value) {
    highlightedNodes.value.clear()
    return
  }

  try {
    const results = await window.electronAPI?.graph?.searchEntities(
      props.novelId, 
      searchQuery.value,
      filterType.value || undefined
    )
    
    highlightedNodes.value = new Set(results?.map((r: any) => r.id) || [])
  } catch (error) {
    console.error('搜索失败:', error)
  }
}

// 一致性检查
async function runConsistencyCheck() {
  if (!props.novelId) return
  
  consistencyLoading.value = true
  try {
    consistencyResult.value = await window.electronAPI?.graph?.checkConsistency(props.novelId)
  } catch (error) {
    console.error('一致性检查失败:', error)
  } finally {
    consistencyLoading.value = false
  }
}

// 监听 novelId 变化
watch(() => props.novelId, () => {
  loadGraph()
  consistencyResult.value = null
}, { immediate: true })

// 打开检查弹窗时自动执行检查
watch(showConsistencyCheck, (show) => {
  if (show && !consistencyResult.value) {
    runConsistencyCheck()
  }
})

onMounted(() => {
  if (props.novelId) {
    loadGraph()
  }
})
</script>

<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
@import '@vue-flow/controls/dist/style.css';
@import '@vue-flow/minimap/dist/style.css';
</style>

<style scoped>
.knowledge-graph-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--app-bg);
}

.graph-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--app-section-bg);
  border-bottom: 1px solid var(--app-border);
  flex-shrink: 0;
}

.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.graph-flow {
  flex: 1;
  background: linear-gradient(180deg, #fafafa 0%, #f5f5f5 100%);
}

/* 图节点样式 */
.graph-node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: white;
  border-radius: 20px;
  border: 2px solid #e5e7eb;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 80px;
}

.graph-node:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.graph-node--highlighted {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.3);
}

.graph-node--character { border-color: #409eff; }
.graph-node--character .node-icon { color: #409eff; }

.graph-node--location { border-color: #67c23a; }
.graph-node--location .node-icon { color: #67c23a; }

.graph-node--item { border-color: #e6a23c; }
.graph-node--item .node-icon { color: #e6a23c; }

.graph-node--organization { border-color: #f56c6c; }
.graph-node--organization .node-icon { color: #f56c6c; }

.node-icon {
  font-size: 16px;
}

.node-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.node-status {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
}

.node-status--dead {
  background: #fef0f0;
  color: #f56c6c;
}

/* 节点详情面板 */
.node-detail-panel {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 300px;
  background: white;
  border-left: 1px solid var(--app-border);
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.08);
  z-index: 10;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--app-border);
  background: var(--el-fill-color-lighter);
}

.panel-title {
  font-weight: 600;
  font-size: 15px;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.detail-section {
  margin-bottom: 16px;
}

.detail-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
}

.detail-text {
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
}

.alias-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.properties-list {
  font-size: 12px;
}

.property-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  border-bottom: 1px dashed var(--el-border-color-lighter);
}

.property-key {
  color: var(--el-text-color-secondary);
}

.property-value {
  font-weight: 500;
}

.relations-list {
  font-size: 12px;
}

.relation-item {
  padding: 4px 0;
  display: flex;
  gap: 8px;
}

.relation-type {
  color: var(--el-color-primary);
  font-weight: 500;
}

.relation-target {
  color: var(--el-text-color-regular);
}

.relations-more {
  color: var(--el-text-color-placeholder);
  font-style: italic;
  margin-top: 4px;
}

/* 一致性检查结果 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px;
  gap: 12px;
  color: var(--el-text-color-secondary);
}

.consistency-result {
  max-height: 400px;
  overflow-y: auto;
}

.result-section {
  margin-bottom: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  margin-bottom: 8px;
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
}

.issue-message {
  font-size: 13px;
  color: var(--el-text-color-regular);
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
  padding: 32px;
  color: var(--el-color-success);
}

.all-clear-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

/* 动画 */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>
