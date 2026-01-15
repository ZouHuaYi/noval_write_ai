<template>
  <div class="h-full flex flex-col overflow-hidden bg-gradient-to-b from-gray-50/30 to-white">
    <div class="flex-shrink-0 px-4 pb-3 border-b border-gray-200/60 bg-white/60 backdrop-blur-sm">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-gray-600">记忆</span>
        <el-button
          type="primary"
          text
          :loading="loading"
          class="hover:bg-blue-50"
          @click="loadMemory"
        >
          <el-icon class="mr-1"><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar min-h-0">
      <div v-if="loading" class="flex flex-col justify-center items-center py-16">
        <el-icon class="is-loading text-4xl text-blue-500 mb-3"><Loading /></el-icon>
        <div class="text-sm text-gray-500">加载中...</div>
      </div>
      <div
        v-else-if="
          memory.entities.length === 0 &&
          memory.events.length === 0 &&
          memory.dependencies.length === 0
        "
        class="flex flex-col justify-center items-center py-16 px-4"
      >
        <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <el-icon class="text-2xl text-gray-400"><Memo /></el-icon>
        </div>
        <div class="text-gray-600 text-sm font-medium mb-1">暂无记忆数据</div>
        <div class="text-gray-400 text-xs text-center max-w-xs">
          StoryEngine 提取的数据会在这里展示
        </div>
      </div>
      <div v-else class="space-y-5">
        <section>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold text-gray-500">实体</span>
            <el-tag size="small" effect="plain">{{ memory.entities.length }}</el-tag>
          </div>
          <div v-if="memory.entities.length === 0" class="text-xs text-gray-400">暂无实体</div>
          <div v-else class="space-y-2">
            <div
              v-for="entity in memory.entities"
              :key="entity.id"
              class="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
            >
              <div class="flex items-center justify-between">
                <div class="text-sm font-semibold text-gray-800 truncate">{{ entity.name }}</div>
                <span class="text-[11px] text-gray-400">第{{ entity.chapterNumber }}章</span>
              </div>
              <div v-if="entity.states" class="mt-2 text-xs text-gray-500">
                状态：{{ formatObject(entity.states) }}
              </div>
              <div v-if="entity.history" class="mt-1 text-xs text-gray-500">
                轨迹：{{ formatList(entity.history) }}
              </div>
            </div>
          </div>
        </section>

        <section>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold text-gray-500">事件</span>
            <el-tag size="small" effect="plain">{{ memory.events.length }}</el-tag>
          </div>
          <div v-if="memory.events.length === 0" class="text-xs text-gray-400">暂无事件</div>
          <div v-else class="space-y-2">
            <div
              v-for="event in memory.events"
              :key="event.id"
              class="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
            >
              <div class="flex items-center justify-between">
                <div class="text-sm font-semibold text-gray-800 truncate">
                  {{ event.summary || event.detail || '未命名事件' }}
                </div>
                <span class="text-[11px] text-gray-400">第{{ event.chapterNumber }}章</span>
              </div>
              <div class="mt-2 text-xs text-gray-500">类型：{{ event.type || '未分类' }}</div>
              <div v-if="event.actors?.length" class="mt-1 text-xs text-gray-500">
                参与者：{{ formatList(event.actors) }}
              </div>
            </div>
          </div>
        </section>

        <section>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold text-gray-500">依赖</span>
            <el-tag size="small" effect="plain">{{ memory.dependencies.length }}</el-tag>
          </div>
          <div v-if="memory.dependencies.length === 0" class="text-xs text-gray-400">暂无依赖</div>
          <div v-else class="space-y-2">
            <div
              v-for="dependency in memory.dependencies"
              :key="dependency.id"
              class="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
            >
              <div class="flex items-center justify-between">
                <div class="text-sm font-semibold text-gray-800 truncate">
                  {{ dependency.description || '未命名依赖' }}
                </div>
                <span class="text-[11px] text-gray-400">第{{ dependency.chapterNumber }}章</span>
              </div>
              <div class="mt-2 text-xs text-gray-500">类型：{{ dependency.type || '未分类' }}</div>
              <div v-if="dependency.status" class="mt-1 text-xs text-gray-500">
                状态：{{ dependency.status }}
              </div>
              <div v-if="dependency.relatedCharacters?.length" class="mt-1 text-xs text-gray-500">
                相关角色：{{ formatList(dependency.relatedCharacters) }}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Loading, Memo, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { reactive, ref, watch } from 'vue'

type MemoryData = {
  entities: any[]
  events: any[]
  dependencies: any[]
}

const props = defineProps<{
  novelId?: string
}>()

const loading = ref(false)
const memory = reactive<MemoryData>({
  entities: [],
  events: [],
  dependencies: []
})

watch(() => props.novelId, () => {
  loadMemory()
}, { immediate: true })

async function loadMemory() {
  if (!props.novelId) return

  loading.value = true
  try {
    if (window.electronAPI?.memory) {
      const data = await window.electronAPI.memory.get(props.novelId)
      memory.entities = data?.entities || []
      memory.events = data?.events || []
      memory.dependencies = data?.dependencies || []
    } else if (window.electronAPI?.db) {
      const [entities, events, dependencies] = await Promise.all([
        window.electronAPI.db.getAll(
          'SELECT * FROM entity WHERE novelId = ? ORDER BY chapterNumber DESC, name ASC',
          [props.novelId]
        ),
        window.electronAPI.db.getAll(
          'SELECT * FROM event WHERE novelId = ? ORDER BY chapterNumber DESC, createdAt ASC',
          [props.novelId]
        ),
        window.electronAPI.db.getAll(
          'SELECT * FROM dependency WHERE novelId = ? ORDER BY chapterNumber DESC, createdAt ASC',
          [props.novelId]
        )
      ])

      memory.entities = entities.map(entity => parseJsonFields(entity, ['states', 'history']))
      memory.events = events.map(event => parseJsonFields(event, ['actors', 'effects']))
      memory.dependencies = dependencies.map(dependency =>
        parseJsonFields(dependency, ['relatedCharacters', 'resolveWhen', 'violateWhen'])
      )
    } else {
      ElMessage.warning('Electron API 未加载')
    }
  } catch (error: any) {
    console.error('加载记忆失败:', error)
    ElMessage.error('加载记忆失败')
  } finally {
    loading.value = false
  }
}

function formatList(value: unknown) {
  if (!value) return ''
  if (Array.isArray(value)) {
    return value.map(item => formatValue(item)).join(' / ')
  }
  return formatValue(value)
}

function formatObject(value: Record<string, unknown>) {
  if (!value) return ''
  return Object.entries(value)
    .map(([key, item]) => `${key}: ${formatValue(item)}`)
    .join(' / ')
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return value.toString()
  if (Array.isArray(value)) return value.join(' / ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function parseJsonFields<T extends Record<string, any>>(record: T, fields: string[]) {
  if (!record) return record
  const parsed = { ...record }
  fields.forEach((field) => {
    const value = parsed[field]
    if (typeof value === 'string') {
      try {
        parsed[field] = JSON.parse(value)
      } catch {
        parsed[field] = value
      }
    }
  })
  return parsed
}
</script>
