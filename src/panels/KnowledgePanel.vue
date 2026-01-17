<template>
  <div class="h-full flex flex-col overflow-hidden">
    <div class="flex-shrink-0 px-4 py-3 border-b border-[color:var(--app-border)] bg-transparent workbench-panel-header">
      <div class="flex items-center justify-between">
        <div class="workbench-panel-title">
          <div class="p-1.5 rounded-lg bg-indigo-100">
            <el-icon class="text-indigo-600 text-base"><CollectionTag /></el-icon>
          </div>
          <span class="text-sm font-semibold">知识库与记忆</span>
        </div>
        <div class="flex items-center gap-2">
          <el-button
            text
            type="primary"
            :loading="syncing"
            class="hover:bg-indigo-50"
            @click="syncKnowledge"
          >
            <el-icon class="mr-1"><Refresh /></el-icon>
            同步记忆
          </el-button>
          <el-button
            text
            :loading="loading"
            class="hover:bg-indigo-50"
            @click="loadEntries"
          >
            刷新知识库
          </el-button>
          <el-button
            text
            :loading="memoryLoading"
            class="hover:bg-emerald-50"
            @click="loadMemory"
          >
            <el-icon class="mr-1"><Refresh /></el-icon>
            刷新记忆
          </el-button>
        </div>
      </div>
    </div>

    <div class="flex-1 px-4 py-4 min-h-0 overflow-y-auto">
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div class="lg:col-span-2 space-y-4">
          <div class="app-section p-3 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs workbench-section-title">知识库</span>
              <el-button size="small" type="primary" plain @click="startCreate">新建条目</el-button>
            </div>
            <el-input
              v-model="keyword"
              size="small"
              placeholder="搜索角色 / 地点 / 时间线 / 剧情"
              clearable
              class="w-full"
              @change="handleSearch"
            >
              <template #prefix>
                <el-icon class="text-gray-400"><Search /></el-icon>
              </template>
            </el-input>
            <div class="grid grid-cols-2 gap-2">
              <el-select
                v-model="selectedType"
                size="small"
                placeholder="类型"
                clearable
                class="w-full"
                @change="loadEntries"
              >
                <el-option label="全部" value="" />
                <el-option label="角色" value="character" />
                <el-option label="地点" value="location" />
                <el-option label="时间线" value="timeline" />
                <el-option label="剧情" value="plot" />
              </el-select>
              <el-select
                v-model="selectedReviewStatus"
                size="small"
                placeholder="审核状态"
                clearable
                class="w-full"
                @change="loadEntries"
              >
                <el-option label="全部" value="" />
                <el-option label="待审核" value="pending" />
                <el-option label="已通过" value="approved" />
                <el-option label="已驳回" value="rejected" />
              </el-select>
            </div>
          </div>

          <div v-if="loading" class="flex flex-col justify-center items-center py-12 app-section">
            <el-icon class="is-loading text-3xl text-blue-500 mb-2"><Loading /></el-icon>
            <div class="text-sm app-muted">加载中...</div>
          </div>

          <div v-else class="app-section p-3">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs workbench-section-title">条目列表</span>
              <el-tag size="small" effect="plain" class="workbench-count">{{ entries.length }}</el-tag>
            </div>
            <div v-if="!entries.length" class="text-xs app-muted">暂无条目</div>
            <div v-else class="space-y-2">
              <div
                v-for="item in entries"
                :key="item.id"
                class="flex items-center justify-between p-2 app-section cursor-pointer hover:bg-[color:var(--app-surface-muted)]"
                @click="selectEntry(item)"
              >
                <div>
                  <div class="text-sm font-semibold">{{ item.name }}</div>
                  <div class="text-[11px] app-muted">
                    {{ typeLabel(item.type) }} · 第{{ item.sourceChapter || '-' }}章
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <el-tag size="small" effect="plain">{{ item.tags?.[0] || typeLabel(item.type) }}</el-tag>
                  <el-tag size="small" :type="reviewTagType(item.reviewStatus)" effect="light">
                    {{ reviewLabel(item.reviewStatus) }}
                  </el-tag>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="lg:col-span-3 space-y-4">
          <div class="app-section p-3">
            <div class="flex items-center justify-between">
              <span class="text-xs workbench-section-title">记忆</span>
              <el-tag size="small" effect="plain" class="workbench-count">{{ memoryTotal }}</el-tag>
            </div>
            <div class="mt-2 text-xs app-muted">StoryEngine 提取的实体、事件与依赖概览</div>
          </div>

          <div v-if="memoryLoading" class="flex flex-col justify-center items-center py-12 app-section">
            <el-icon class="is-loading text-3xl text-emerald-500 mb-2"><Loading /></el-icon>
            <div class="text-sm app-muted">记忆加载中...</div>
          </div>
          <div
            v-else-if="
              memory.entities.length === 0 &&
              memory.events.length === 0 &&
              memory.dependencies.length === 0
            "
            class="flex flex-col justify-center items-center py-12 px-4 app-section"
          >
            <div class="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
              <el-icon class="text-2xl text-emerald-400"><Memo /></el-icon>
            </div>
            <div class="text-sm font-medium mb-1">暂无记忆数据</div>
            <div class="app-muted text-xs text-center max-w-xs">
              StoryEngine 提取的数据会在这里展示
            </div>
          </div>
          <div v-else class="space-y-5">
            <section>
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs workbench-section-title">实体</span>
                <el-tag size="small" effect="plain" class="workbench-count">{{ memory.entities.length }}</el-tag>
              </div>
              <div v-if="memory.entities.length === 0" class="text-xs app-muted">暂无实体</div>
              <div v-else class="space-y-2">
                <div
                  v-for="entity in memory.entities"
                  :key="entity.id"
                  class="app-section p-3"
                >
                  <div class="flex items-center justify-between">
                    <div class="text-sm font-semibold truncate">{{ entity.name }}</div>
                    <span class="text-[11px] app-muted">第{{ entity.chapterNumber }}章</span>
                  </div>
                  <div v-if="entity.states" class="mt-2 text-xs app-muted">
                    状态：{{ formatObject(entity.states) }}
                  </div>
                  <div v-if="entity.history" class="mt-1 text-xs app-muted">
                    轨迹：{{ formatList(entity.history) }}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs workbench-section-title">事件</span>
                <el-tag size="small" effect="plain" class="workbench-count">{{ memory.events.length }}</el-tag>
              </div>
              <div v-if="memory.events.length === 0" class="text-xs app-muted">暂无事件</div>
              <div v-else class="space-y-2">
                <div
                  v-for="event in memory.events"
                  :key="event.id"
                  class="app-section p-3"
                >
                  <div class="flex items-center justify-between">
                    <div class="text-sm font-semibold truncate">
                      {{ event.summary || event.detail || '未命名事件' }}
                    </div>
                    <span class="text-[11px] app-muted">第{{ event.chapterNumber }}章</span>
                  </div>
                  <div class="mt-2 text-xs app-muted">类型：{{ event.type || '未分类' }}</div>
                  <div v-if="event.actors?.length" class="mt-1 text-xs app-muted">
                    参与者：{{ formatList(event.actors) }}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs workbench-section-title">依赖</span>
                <el-tag size="small" effect="plain" class="workbench-count">{{ memory.dependencies.length }}</el-tag>
              </div>
              <div v-if="memory.dependencies.length === 0" class="text-xs app-muted">暂无依赖</div>
              <div v-else class="space-y-2">
                <div
                  v-for="dependency in memory.dependencies"
                  :key="dependency.id"
                  class="app-section p-3"
                >
                  <div class="flex items-center justify-between">
                    <div class="text-sm font-semibold truncate">
                      {{ dependency.description || '未命名依赖' }}
                    </div>
                    <span class="text-[11px] app-muted">第{{ dependency.chapterNumber }}章</span>
                  </div>
                  <div class="mt-2 text-xs app-muted">类型：{{ dependency.type || '未分类' }}</div>
                  <div v-if="dependency.status" class="mt-1 text-xs app-muted">
                    状态：{{ dependency.status }}
                  </div>
                  <div v-if="dependency.relatedCharacters?.length" class="mt-1 text-xs app-muted">
                    相关角色：{{ formatList(dependency.relatedCharacters) }}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <el-collapse v-model="editorOpen" class="app-section" accordion>
            <el-collapse-item name="editor">
              <template #title>
                <div class="flex items-center justify-between w-full">
              <span class="text-xs workbench-section-title">知识库编辑</span>
              <div class="flex items-center gap-2">
                <div class="flex items-center gap-1 mr-1">
                  <el-button
                    size="small"
                    type="success"
                    plain
                    @click.stop="approveEntry"
                    :disabled="!editingEntry.id"
                  >
                    通过
                  </el-button>
                  <el-button
                    size="small"
                    type="warning"
                    plain
                    @click.stop="rejectEntry"
                    :disabled="!editingEntry.id"
                  >
                    驳回
                  </el-button>
                </div>
                <div class="w-px h-3 bg-gray-300 dark:bg-gray-600 mx-1"></div>
                <el-button size="small" type="danger" plain @click.stop="deleteEntry" :disabled="!editingEntry.id">删除</el-button>
              </div>
            </div>
          </template>
          <div class="p-3 space-y-3">
            <el-form label-position="top" size="small" class="space-y-2">

                  <el-form-item label="类型">
                    <el-select v-model="editingEntry.type" placeholder="选择类型">
                      <el-option label="角色" value="character" />
                      <el-option label="地点" value="location" />
                      <el-option label="时间线" value="timeline" />
                      <el-option label="剧情" value="plot" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="名称">
                    <el-input v-model="editingEntry.name" placeholder="条目名称" />
                  </el-form-item>
                  <el-form-item label="摘要">
                    <el-input v-model="editingEntry.summary" type="textarea" :rows="2" />
                  </el-form-item>
                  <el-form-item label="详细描述">
                    <el-input v-model="editingEntry.detail" type="textarea" :rows="5" />
                  </el-form-item>
                  <el-form-item label="别名（逗号分隔）">
                    <el-input v-model="aliasInput" placeholder="别名1, 别名2" />
                  </el-form-item>
                  <el-form-item label="标签（逗号分隔）">
                    <el-input v-model="tagInput" placeholder="标签1, 标签2" />
                  </el-form-item>
                  <el-form-item label="审核状态">
                    <el-select v-model="editingEntry.reviewStatus" placeholder="选择状态">
                      <el-option label="待审核" value="pending" />
                      <el-option label="已通过" value="approved" />
                      <el-option label="已驳回" value="rejected" />
                    </el-select>
                  </el-form-item>
                </el-form>
                <div class="flex items-center gap-2">
                  <el-button type="primary" size="small" @click="saveEntry" :loading="saving">保存</el-button>
                  <el-button size="small" @click="resetForm">重置</el-button>
                </div>
              </div>
            </el-collapse-item>
          </el-collapse>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CollectionTag, Loading, Memo, Refresh, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'

type KnowledgeEntry = {
  id?: string
  type?: string
  name?: string
  summary?: string
  detail?: string
  aliases?: string[]
  tags?: string[]
  reviewStatus?: string
  reviewedAt?: number | null
  sourceChapter?: number
}

type MemoryData = {
  entities: any[]
  events: any[]
  dependencies: any[]
}

const props = defineProps<{
  novelId?: string
}>()

const entries = ref<KnowledgeEntry[]>([])
const loading = ref(false)
const syncing = ref(false)
const saving = ref(false)
const memoryLoading = ref(false)
const editorOpen = ref('')
const keyword = ref('')
const selectedType = ref('')
const selectedReviewStatus = ref('')
const editingEntry = reactive<KnowledgeEntry>({})
const aliasInput = ref('')
const tagInput = ref('')
const memory = reactive<MemoryData>({
  entities: [],
  events: [],
  dependencies: []
})

const memoryTotal = computed(() => (
  memory.entities.length + memory.events.length + memory.dependencies.length
))

watch(() => props.novelId, () => {
  loadEntries()
  loadMemory()
}, { immediate: true })

function typeLabel(type?: string) {
  const map: Record<string, string> = {
    character: '角色',
    location: '地点',
    timeline: '时间线',
    plot: '剧情'
  }
  return map[type || ''] || '未知'
}

function reviewLabel(status?: string) {
  const map: Record<string, string> = {
    pending: '待审核',
    approved: '已通过',
    rejected: '已驳回'
  }
  return map[status || 'pending'] || '待审核'
}

function reviewTagType(status?: string) {
  const map: Record<string, 'warning' | 'success' | 'danger'> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger'
  }
  return map[status || 'pending'] || 'warning'
}

async function loadEntries() {
  if (!props.novelId || !window.electronAPI?.knowledge) return
  loading.value = true
  try {
    const data = await window.electronAPI.knowledge.list(
      props.novelId,
      selectedType.value || undefined,
      selectedReviewStatus.value || undefined
    )
    entries.value = data || []
  } catch (error: any) {
    console.error('加载知识库失败:', error)
    ElMessage.error('加载知识库失败')
  } finally {
    loading.value = false
  }
}

async function handleSearch() {
  if (!props.novelId || !window.electronAPI?.knowledge) return
  if (!keyword.value) {
    loadEntries()
    return
  }
  loading.value = true
  try {
    entries.value = await window.electronAPI.knowledge.search(
      props.novelId,
      keyword.value,
      selectedReviewStatus.value || undefined
    )
  } catch (error: any) {
    console.error('搜索知识库失败:', error)
    ElMessage.error('搜索失败')
  } finally {
    loading.value = false
  }
}

async function loadMemory() {
  if (!props.novelId) return

  memoryLoading.value = true
  try {

    if (!window.electronAPI?.memory) {
      ElMessage.warning('Electron API 未加载')
      return
    }

    const data = await window.electronAPI.memory.get(props.novelId)
    memory.entities = data?.entities || []
    memory.events = data?.events || []
    memory.dependencies = data?.dependencies || []
  } catch (error: any) {
    console.error('加载记忆失败:', error)
    ElMessage.error('加载记忆失败')
  } finally {
    memoryLoading.value = false
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


function selectEntry(entry: KnowledgeEntry) {
  editingEntry.id = entry.id
  editingEntry.type = entry.type
  editingEntry.name = entry.name
  editingEntry.summary = entry.summary
  editingEntry.detail = entry.detail
  editingEntry.aliases = entry.aliases || []
  editingEntry.tags = entry.tags || []
  editingEntry.reviewStatus = entry.reviewStatus || 'pending'
  editingEntry.reviewedAt = entry.reviewedAt || null
  aliasInput.value = (entry.aliases || []).join(', ')
  tagInput.value = (entry.tags || []).join(', ')
  editorOpen.value = 'editor'
}

function resetForm() {
  editingEntry.id = undefined
  editingEntry.type = selectedType.value || 'character'
  editingEntry.name = ''
  editingEntry.summary = ''
  editingEntry.detail = ''
  editingEntry.aliases = []
  editingEntry.tags = []
  editingEntry.reviewStatus = 'pending'
  editingEntry.reviewedAt = null
  aliasInput.value = ''
  tagInput.value = ''
}

function startCreate() {
  resetForm()
  editorOpen.value = 'editor'
}

async function updateReviewStatus(status: 'pending' | 'approved' | 'rejected') {
  if (!editingEntry.id || !window.electronAPI?.knowledge) return
  try {
    await window.electronAPI.knowledge.reviewUpdate(editingEntry.id, status)
    editingEntry.reviewStatus = status
    editingEntry.reviewedAt = Date.now()
    ElMessage.success(status === 'approved' ? '已通过' : '已驳回')
    loadEntries()
  } catch (error: any) {
    console.error('更新审核状态失败:', error)
    ElMessage.error('更新审核状态失败')
  }
}

function approveEntry() {
  updateReviewStatus('approved')
}

function rejectEntry() {
  updateReviewStatus('rejected')
}

async function saveEntry() {
  if (!props.novelId || !window.electronAPI?.knowledge) return
  if (!editingEntry.name || !editingEntry.type) {
    ElMessage.warning('请填写名称与类型')
    return
  }

  const reviewStatus = editingEntry.reviewStatus || 'pending'

  saving.value = true
  try {
    const payload = {
      type: editingEntry.type,
      name: editingEntry.name,
      summary: editingEntry.summary,
      detail: editingEntry.detail,
      aliases: aliasInput.value ? aliasInput.value.split(',').map(item => item.trim()).filter(Boolean) : [],
      tags: tagInput.value ? tagInput.value.split(',').map(item => item.trim()).filter(Boolean) : [],
      reviewStatus
    }

    if (editingEntry.id) {
      await window.electronAPI.knowledge.update(editingEntry.id, payload)
    } else {
      await window.electronAPI.knowledge.create(props.novelId, payload)
    }

    ElMessage.success('保存成功')
    loadEntries()
  } catch (error: any) {
    console.error('保存知识库失败:', error)
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

async function deleteEntry() {
  if (!editingEntry.id || !window.electronAPI?.knowledge) return
  try {
    await window.electronAPI.knowledge.delete(editingEntry.id)
    ElMessage.success('删除成功')
    resetForm()
    loadEntries()
  } catch (error: any) {
    console.error('删除失败:', error)
    ElMessage.error('删除失败')
  }
}

async function syncKnowledge() {
  if (!props.novelId || !window.electronAPI?.knowledge) return
  syncing.value = true
  try {
    await window.electronAPI.knowledge.syncFromMemory(props.novelId)
    selectedReviewStatus.value = 'pending'
    ElMessage.success('已从记忆同步')
    loadEntries()
  } catch (error: any) {
    console.error('同步失败:', error)
    ElMessage.error('同步失败')
  } finally {
    syncing.value = false
  }
}
</script>
