<template>
  <div class="event-graph-container">
    <!-- 工具栏 -->
    <div class="event-graph-toolbar">
      <div class="toolbar-left">
        <el-button size="small" @click="fitView">
          <el-icon><FullScreen /></el-icon>
          适应视图
        </el-button>
        <el-button size="small" @click="layoutNodes">
          <el-icon><Grid /></el-icon>
          自动布局
        </el-button>
        <el-divider direction="vertical" />
        <el-select v-model="layoutDirection" size="small" style="width: 100px">
          <el-option label="水平" value="LR" />
          <el-option label="垂直" value="TB" />
        </el-select>
      </div>
      <div class="toolbar-right">
        <el-tag size="small" type="info">{{ nodes.length }} 个事件</el-tag>
        <el-tag size="small" type="success">{{ edges.length }} 条关系</el-tag>
      </div>
    </div>

    <!-- Vue Flow 画布 -->
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      :default-viewport="{ zoom: 1, x: 0, y: 0 }"
      :min-zoom="0.2"
      :max-zoom="2"
      :snap-to-grid="true"
      :snap-grid="[15, 15]"
      fit-view-on-init
      class="event-flow"
      @node-click="onNodeClick"
      @node-drag-stop="onNodeDragStop"
    >
      <!-- 自定义节点模板 -->
      <template #node-eventNode="{ data }">
        <div 
          class="event-node" 
          :class="[
            `event-node--${data.eventType || 'plot'}`,
            { 'event-node--selected': data.selected }
          ]"
        >
          <div class="event-node__header">
            <span class="event-node__type">{{ getEventTypeLabel(data.eventType) }}</span>
            <span v-if="data.chapter" class="event-node__chapter">第{{ data.chapter }}章</span>
          </div>
          <div class="event-node__title">{{ data.label }}</div>
          <div v-if="data.description" class="event-node__desc">
            {{ truncate(data.description, 50) }}
          </div>
          <div v-if="data.characters?.length" class="event-node__chars">
            <el-tag 
              v-for="char in data.characters.slice(0, 3)" 
              :key="char" 
              size="small" 
              type="info"
            >
              {{ char }}
            </el-tag>
            <span v-if="data.characters.length > 3" class="event-node__more">
              +{{ data.characters.length - 3 }}
            </span>
          </div>
        </div>
      </template>

      <!-- 自定义边标签 -->
      <template #edge-label="{ label }">
        <div class="edge-label">{{ label }}</div>
      </template>

      <!-- 背景 -->
      <Background :gap="20" :size="1" pattern-color="#e5e7eb" />
      
      <!-- 控制器 -->
      <Controls position="bottom-right" />
      
      <!-- 迷你地图 -->
      <MiniMap 
        v-if="showMiniMap"
        position="bottom-left"
        :pannable="true"
        :zoomable="true"
      />
    </VueFlow>

    <!-- 事件详情侧边栏 -->
    <transition name="slide">
      <div v-if="selectedNode" class="event-detail-panel">
        <div class="event-detail-header">
          <span class="event-detail-title">事件详情</span>
          <el-button :icon="Close" size="small" text @click="selectedNode = null" />
        </div>
        <div class="event-detail-content">
          <div class="detail-item">
            <span class="detail-label">事件名称</span>
            <span class="detail-value">{{ selectedNode.data.label }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">事件类型</span>
            <el-tag :type="getEventTypeTagType(selectedNode.data.eventType)">
              {{ getEventTypeLabel(selectedNode.data.eventType) }}
            </el-tag>
          </div>
          <div v-if="selectedNode.data.chapter" class="detail-item">
            <span class="detail-label">所属章节</span>
            <span class="detail-value">第 {{ selectedNode.data.chapter }} 章</span>
          </div>
          <div v-if="selectedNode.data.description" class="detail-item">
            <span class="detail-label">事件描述</span>
            <p class="detail-desc">{{ selectedNode.data.description }}</p>
          </div>
          <div v-if="selectedNode.data.characters?.length" class="detail-item">
            <span class="detail-label">相关角色</span>
            <div class="detail-tags">
              <el-tag 
                v-for="char in selectedNode.data.characters" 
                :key="char" 
                size="small"
              >
                {{ char }}
              </el-tag>
            </div>
          </div>
          <div v-if="selectedNode.data.preconditions?.length" class="detail-item">
            <span class="detail-label">前置条件</span>
            <ul class="detail-list">
              <li v-for="(cond, i) in selectedNode.data.preconditions" :key="i">{{ cond }}</li>
            </ul>
          </div>
          <div v-if="selectedNode.data.postconditions?.length" class="detail-item">
            <span class="detail-label">后置影响</span>
            <ul class="detail-list">
              <li v-for="(cond, i) in selectedNode.data.postconditions" :key="i">{{ cond }}</li>
            </ul>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { Close, FullScreen, Grid } from '@element-plus/icons-vue'
import type { Node, Edge } from '@vue-flow/core'

// 事件节点类型
interface EventNodeData {
  id: string
  label: string
  eventType: 'plot' | 'character' | 'conflict' | 'resolution' | 'transition'
  description?: string
  chapter?: number
  characters?: string[]
  preconditions?: string[]
  postconditions?: string[]
  dependencies?: string[]
  selected?: boolean
}

const props = defineProps<{
  eventNodes?: EventNodeData[]
  showMiniMap?: boolean
}>()

const emit = defineEmits<{
  (e: 'node-select', node: EventNodeData): void
  (e: 'node-update', nodes: Node[]): void
}>()

// Vue Flow 实例
const { fitView, getNodes, getEdges } = useVueFlow()

// 节点和边
const nodes = ref<Node[]>([])
const edges = ref<Edge[]>([])
const selectedNode = ref<Node | null>(null)
const layoutDirection = ref<'LR' | 'TB'>('LR')

// 事件类型标签
const eventTypeLabels: Record<string, string> = {
  plot: '情节',
  character: '角色',
  conflict: '冲突',
  resolution: '解决',
  transition: '过渡'
}

const eventTypeTagTypes: Record<string, string> = {
  plot: 'primary',
  character: 'success',
  conflict: 'danger',
  resolution: 'warning',
  transition: 'info'
}

function getEventTypeLabel(type: string): string {
  return eventTypeLabels[type] || type
}

function getEventTypeTagType(type: string): string {
  return eventTypeTagTypes[type] || 'info'
}

function truncate(text: string, length: number): string {
  return text.length > length ? text.slice(0, length) + '...' : text
}

// 将 EventNode 数据转换为 Vue Flow 节点
function convertToFlowNodes(eventNodes: EventNodeData[]): { nodes: Node[], edges: Edge[] } {
  const flowNodes: Node[] = []
  const flowEdges: Edge[] = []

  eventNodes.forEach((event, index) => {
    // 创建节点
    flowNodes.push({
      id: event.id,
      type: 'eventNode',
      position: { x: 0, y: 0 }, // 初始位置，后续自动布局
      data: {
        ...event,
        label: event.label
      }
    })

    // 根据依赖关系创建边
    if (event.dependencies) {
      event.dependencies.forEach(depId => {
        flowEdges.push({
          id: `${depId}-${event.id}`,
          source: depId,
          target: event.id,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#94a3b8', strokeWidth: 2 }
        })
      })
    }
  })

  return { nodes: flowNodes, edges: flowEdges }
}

// 自动布局节点（简单的层级布局）
function layoutNodes() {
  const nodeMap = new Map<string, Node>()
  const levels = new Map<string, number>()
  
  // 构建节点映射
  nodes.value.forEach(node => {
    nodeMap.set(node.id, node)
    levels.set(node.id, 0)
  })

  // 计算每个节点的层级
  edges.value.forEach(edge => {
    const sourceLevel = levels.get(edge.source) || 0
    const currentTargetLevel = levels.get(edge.target) || 0
    levels.set(edge.target, Math.max(currentTargetLevel, sourceLevel + 1))
  })

  // 按层级分组
  const levelGroups = new Map<number, string[]>()
  levels.forEach((level, nodeId) => {
    if (!levelGroups.has(level)) {
      levelGroups.set(level, [])
    }
    levelGroups.get(level)!.push(nodeId)
  })

  // 设置节点位置
  const nodeWidth = 220
  const nodeHeight = 120
  const levelGap = layoutDirection.value === 'LR' ? 300 : 180
  const nodeGap = layoutDirection.value === 'LR' ? 150 : 280

  levelGroups.forEach((nodeIds, level) => {
    nodeIds.forEach((nodeId, index) => {
      const node = nodeMap.get(nodeId)
      if (node) {
        if (layoutDirection.value === 'LR') {
          node.position = {
            x: level * levelGap + 50,
            y: index * nodeGap + 50
          }
        } else {
          node.position = {
            x: index * nodeGap + 50,
            y: level * levelGap + 50
          }
        }
      }
    })
  })

  // 触发更新
  nodes.value = [...nodes.value]
  
  // 适应视图
  setTimeout(() => fitView({ padding: 0.2 }), 100)
}

// 节点点击
function onNodeClick({ node }: { node: Node }) {
  // 取消之前选中的节点
  nodes.value.forEach(n => {
    n.data.selected = false
  })
  
  // 选中当前节点
  node.data.selected = true
  selectedNode.value = node
  
  emit('node-select', node.data as EventNodeData)
}

// 节点拖拽结束
function onNodeDragStop() {
  emit('node-update', nodes.value)
}

// 监听事件节点数据变化
watch(() => props.eventNodes, (newNodes) => {
  if (newNodes && newNodes.length > 0) {
    const { nodes: flowNodes, edges: flowEdges } = convertToFlowNodes(newNodes)
    nodes.value = flowNodes
    edges.value = flowEdges
    
    // 延迟布局确保节点已渲染
    setTimeout(layoutNodes, 100)
  }
}, { immediate: true, deep: true })

// 监听布局方向变化
watch(layoutDirection, () => {
  layoutNodes()
})

onMounted(() => {
  // 如果有初始数据，执行布局
  if (nodes.value.length > 0) {
    setTimeout(layoutNodes, 200)
  }
})
</script>

<style>
/* 导入 Vue Flow 样式 */
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
@import '@vue-flow/controls/dist/style.css';
@import '@vue-flow/minimap/dist/style.css';
</style>

<style scoped>
.event-graph-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--app-bg);
  border-radius: 8px;
  overflow: hidden;
}

.event-graph-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--app-section-bg);
  border-bottom: 1px solid var(--app-border);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.event-flow {
  flex: 1;
  background: #fafafa;
}

/* 事件节点样式 */
.event-node {
  min-width: 180px;
  max-width: 220px;
  padding: 12px;
  background: white;
  border-radius: 8px;
  border: 2px solid #e5e7eb;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: all 0.2s ease;
}

.event-node:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.event-node--selected {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.2);
}

/* 事件类型颜色 */
.event-node--plot { border-left: 4px solid #409eff; }
.event-node--character { border-left: 4px solid #67c23a; }
.event-node--conflict { border-left: 4px solid #f56c6c; }
.event-node--resolution { border-left: 4px solid #e6a23c; }
.event-node--transition { border-left: 4px solid #909399; }

.event-node__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.event-node__type {
  font-size: 11px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
}

.event-node__chapter {
  font-size: 10px;
  color: var(--el-text-color-placeholder);
  background: var(--el-fill-color-light);
  padding: 2px 6px;
  border-radius: 4px;
}

.event-node__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
  line-height: 1.4;
}

.event-node__desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
  margin-bottom: 8px;
}

.event-node__chars {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}

.event-node__more {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

/* 边标签 */
.edge-label {
  font-size: 11px;
  background: white;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #e5e7eb;
}

/* 事件详情面板 */
.event-detail-panel {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 320px;
  background: white;
  border-left: 1px solid var(--app-border);
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.08);
  z-index: 10;
  display: flex;
  flex-direction: column;
}

.event-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--app-border);
  background: var(--el-fill-color-lighter);
}

.event-detail-title {
  font-weight: 600;
  font-size: 14px;
}

.event-detail-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.detail-item {
  margin-bottom: 16px;
}

.detail-label {
  display: block;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}

.detail-value {
  font-size: 14px;
  font-weight: 500;
}

.detail-desc {
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
  margin: 0;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.detail-list {
  margin: 4px 0;
  padding-left: 20px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.detail-list li {
  margin-bottom: 4px;
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
