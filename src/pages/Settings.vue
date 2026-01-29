<template>
  <div class="h-screen flex flex-col app-shell">
    <!-- 面包屑导航 -->
    <Breadcrumb />
    
    <!-- 顶部标题栏 -->
    <div class="h-14 app-header flex items-center px-6 flex-shrink-0">
      <div class="flex items-center space-x-2">
        <el-icon class="text-xl text-[var(--app-primary)]"><Setting /></el-icon>
        <span class="text-xl font-semibold">应用设置</span>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="flex-1 overflow-auto p-6">
      <div class="max-w-5xl mx-auto">
        <div class="app-card p-4 mb-6 border-l-4 border-l-[var(--app-primary)]">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-semibold">模型配置提示</div>
              <div class="text-xs app-muted mt-1">为创作体验选择稳定、响应快的模型服务，API Key 将仅显示后四位</div>
            </div>
            <el-tag type="success" effect="light" round>建议每类至少配置 1 个默认模型</el-tag>
          </div>
        </div>

        <el-tabs v-model="activeTab" class="settings-tabs">
          <!-- LLM 配置 Tab -->
          <el-tab-pane label="LLM 对话模型" name="llm">
            <div class="space-y-4">
              <div class="flex items-center justify-between mb-2 px-2">
                <div class="flex items-center text-sm font-medium">
                  <el-icon class="mr-2 text-emerald-500"><Cpu /></el-icon>
                  <span>对话模型列表</span>
                </div>
                <el-button
                  type="primary"
                  size="small"
                  @click="showLLMDialog = true"
                >
                  <el-icon class="mr-1"><Plus /></el-icon>
                  添加配置
                </el-button>
              </div>
              
              <div v-if="llmConfigs.length === 0" class="app-card py-12 text-center app-muted">
                <el-icon class="text-4xl mb-2 opacity-20"><Box /></el-icon>
                <div class="text-sm">暂无 LLM 配置，请添加后开始创作</div>
              </div>

              <div v-else class="grid grid-cols-1 gap-4 pb-10">
                <div
                  v-for="(config, index) in sortedLLMConfigs"
                  :key="config.id"
                  class="app-card p-5 group transition-all hover:border-[var(--app-primary)]"
                  :class="{ 'border-emerald-500/50 bg-emerald-50/10': config.isDefault }"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <div class="flex items-center space-x-2 mb-3">
                        <span class="font-bold text-base">{{ config.name || `配置 ${index + 1}` }}</span>
                        <el-tag v-if="config.isDefault" type="success" size="small" effect="dark">默认</el-tag>
                        <span class="text-xs bg-[var(--app-surface-strong)] px-2 py-0.5 rounded text-[var(--app-text-muted)]">{{ config.model }}</span>
                      </div>
                      <div class="grid grid-cols-2 lg:grid-cols-3 gap-y-3 gap-x-6 text-sm">
                        <div class="flex flex-col">
                          <span class="text-[10px] uppercase tracking-wider opacity-50 mb-1 font-bold">API Base</span>
                          <span class="font-mono text-xs truncate max-w-[200px]">{{ config.apiBase }}</span>
                        </div>
                        <div class="flex flex-col">
                          <span class="text-[10px] uppercase tracking-wider opacity-50 mb-1 font-bold">Temperature</span>
                          <span>{{ config.temperature ?? 0.7 }}</span>
                        </div>
                        <div class="flex flex-col">
                          <span class="text-[10px] uppercase tracking-wider opacity-50 mb-1 font-bold">API Key</span>
                          <span class="font-mono text-xs">{{ config.apiKey ? '••••' + config.apiKey.slice(-4) : '未设置' }}</span>
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <el-tooltip content="设为默认" placement="top" v-if="!config.isDefault">
                        <el-button
                          type="success"
                          circle
                          size="small"
                          plain
                          @click="setLLMAsDefault(config.id)"
                        >
                          <el-icon><Star /></el-icon>
                        </el-button>
                      </el-tooltip>
                      <el-tooltip content="编辑" placement="top">
                        <el-button
                          type="primary"
                          circle
                          size="small"
                          plain
                          @click="editLLMConfig(config)"
                        >
                          <el-icon><Edit /></el-icon>
                        </el-button>
                      </el-tooltip>
                      <el-tooltip content="测试连接" placement="top">
                        <el-button
                          type="info"
                          circle
                          size="small"
                          plain
                          @click="testLLMConnection(config)"
                          :loading="testingLLMId === config.id"
                        >
                          <el-icon><Connection /></el-icon>
                        </el-button>
                      </el-tooltip>
                      <el-tooltip content="删除" placement="top">
                        <el-button
                          type="danger"
                          circle
                          size="small"
                          plain
                          @click="deleteLLMConfig(config.id, config.name)"
                        >
                          <el-icon><Delete /></el-icon>
                        </el-button>
                      </el-tooltip>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <!-- 向量模型配置 Tab -->
          <el-tab-pane label="向量分词模型" name="vector">
            <div class="space-y-4">
              <div class="flex items-center justify-between mb-2 px-2">
                <div class="flex items-center text-sm font-medium">
                  <el-icon class="mr-2 text-amber-500"><Box /></el-icon>
                  <span>向量模型列表</span>
                </div>
                <el-button
                  type="primary"
                  size="small"
                  @click="showVectorDialog = true"
                >
                  <el-icon class="mr-1"><Plus /></el-icon>
                  添加配置
                </el-button>
              </div>
              
              <div v-if="vectorConfigs.length === 0" class="app-card py-12 text-center app-muted">
                <el-icon class="text-4xl mb-2 opacity-20"><Box /></el-icon>
                <div class="text-sm">暂无向量模型配置，推荐配置与 LLM 同厂商服务</div>
              </div>

              <div v-else class="grid grid-cols-1 gap-4 pb-10">
                <div
                  v-for="(config, index) in sortedVectorConfigs"
                  :key="config.id"
                  class="app-card p-5 group transition-all hover:border-[var(--app-primary)]"
                  :class="{ 'border-amber-500/50 bg-amber-50/10': config.isDefault }"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <div class="flex items-center space-x-2 mb-3">
                        <span class="font-bold text-base">{{ config.name || `配置 ${index + 1}` }}</span>
                        <el-tag v-if="config.isDefault" type="success" size="small" effect="dark">默认</el-tag>
                        <span class="text-xs bg-[var(--app-surface-strong)] px-2 py-0.5 rounded text-[var(--app-text-muted)]">{{ config.model }}</span>
                      </div>
                      <div class="grid grid-cols-2 lg:grid-cols-3 gap-y-3 gap-x-6 text-sm">
                        <div class="flex flex-col">
                          <span class="text-[10px] uppercase tracking-wider opacity-50 mb-1 font-bold">API Base</span>
                          <span class="font-mono text-xs truncate max-w-[200px]">{{ config.apiBase }}</span>
                        </div>
                        <div class="flex flex-col">
                          <span class="text-[10px] uppercase tracking-wider opacity-50 mb-1 font-bold">API Key</span>
                          <span class="font-mono text-xs">{{ config.apiKey ? '••••' + config.apiKey.slice(-4) : '未设置' }}</span>
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <el-tooltip content="设为默认" placement="top" v-if="!config.isDefault">
                        <el-button
                          type="success"
                          circle
                          size="small"
                          plain
                          @click="setVectorAsDefault(config.id)"
                        >
                          <el-icon><Star /></el-icon>
                        </el-button>
                      </el-tooltip>
                      <el-tooltip content="编辑" placement="top">
                        <el-button
                          type="primary"
                          circle
                          size="small"
                          plain
                          @click="editVectorConfig(config)"
                        >
                          <el-icon><Edit /></el-icon>
                        </el-button>
                      </el-tooltip>
                      <el-tooltip content="测试连接" placement="top">
                        <el-button
                          type="info"
                          circle
                          size="small"
                          plain
                          @click="testVectorConnection(config)"
                          :loading="testingVectorId === config.id"
                        >
                          <el-icon><Connection /></el-icon>
                        </el-button>
                      </el-tooltip>
                      <el-tooltip content="删除" placement="top">
                        <el-button
                          type="danger"
                          circle
                          size="small"
                          plain
                          @click="deleteVectorConfig(config.id, config.name)"
                        >
                          <el-icon><Delete /></el-icon>
                        </el-button>
                      </el-tooltip>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <!-- Prompt 配置 Tab -->
          <el-tab-pane label="Prompt 模板" name="prompt">
            <div class="space-y-4">
              <div class="flex items-center justify-between mb-2 px-2">
                <div class="flex items-center text-sm font-medium">
                  <el-icon class="mr-2 text-indigo-500"><Edit /></el-icon>
                  <span>Prompt 模板列表</span>
                </div>
                <el-button
                  type="primary"
                  size="small"
                  @click="loadPromptConfigs"
                  :loading="promptLoading"
                >
                  <el-icon class="mr-1"><Refresh /></el-icon>
                  刷新
                </el-button>
              </div>

              <div v-if="promptGroups.length === 0" class="app-card py-12 text-center app-muted">
                <el-icon class="text-4xl mb-2 opacity-20"><Box /></el-icon>
                <div class="text-sm">暂无 Prompt 配置，可点击刷新加载默认模板</div>
              </div>

              <div v-else class="grid grid-cols-1 gap-4 pb-10">
                <div
                  v-for="prompt in promptGroups"
                  :key="prompt.baseId"
                  class="app-card p-5 group transition-all hover:border-[var(--app-primary)]"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1 space-y-2">
                      <div class="flex items-center space-x-2">
                        <span class="font-bold text-base">{{ prompt.name }}</span>
                        <el-tag size="small" type="info" effect="plain">{{ prompt.domain }}</el-tag>
                        <el-tag
                          v-if="prompt.systemItem?.source === 'override' || prompt.userItem?.source === 'override'"
                          size="small"
                          type="success"
                          effect="dark"
                        >
                          已覆盖
                        </el-tag>
                      </div>
                      <div class="text-xs text-[var(--app-text-muted)]">{{ prompt.description || '未填写描述' }}</div>
                      <div class="text-xs text-[var(--app-text-muted)]">
                        系统提示词：{{ (prompt.systemItem?.systemPrompt || '').slice(0, 60) }}{{ (prompt.systemItem?.systemPrompt || '').length > 60 ? '...' : '' }}
                      </div>
                      <div class="text-xs text-[var(--app-text-muted)]">
                        用户提示词：{{ (prompt.userItem?.userPrompt || '').slice(0, 60) }}{{ (prompt.userItem?.userPrompt || '').length > 60 ? '...' : '' }}
                      </div>
                    </div>
                    <div class="flex items-center space-x-2">
                      <el-switch
                        v-model="prompt.enabled"
                        active-text="启用"
                        inactive-text="停用"
                        @change="() => {
                          if (prompt.systemItem) prompt.systemItem.enabled = prompt.enabled
                          if (prompt.userItem) prompt.userItem.enabled = prompt.enabled
                          savePromptConfigs()
                        }"
                      />
                      <el-button
                        type="primary"
                        size="small"
                        plain
                        @click="openPromptEditor(prompt)"
                      >
                        编辑
                      </el-button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>

    <!-- LLM 添加/编辑对话框 -->
    <el-dialog
      v-model="showLLMDialog"
      :title="editingLLMConfig ? '编辑 LLM 配置' : '添加 LLM 配置'"
      width="540px"
      append-to-body
      @close="resetLLMForm"
    >
      <el-form
        :model="llmForm"
        :rules="llmRules"
        ref="llmFormRef"
        label-width="100px"
        label-position="top"
        class="mt-2"
      >
        <el-form-item label="配置名称" prop="name">
          <el-input v-model="llmForm.name" placeholder="例如：OpenAI GPT-4" clearable />
        </el-form-item>

        <div class="grid grid-cols-2 gap-4">
          <el-form-item label="对话模型" prop="model">
            <el-input v-model="llmForm.model" placeholder="gpt-3.5-turbo" clearable />
          </el-form-item>
          <el-form-item label="最大 Token" prop="maxTokens">
            <el-input-number v-model="llmForm.maxTokens" :min="100" :max="128000" :step="1000" class="w-full" />
          </el-form-item>
        </div>

        <el-form-item label="API 地址 (Base URL)" prop="apiBase">
          <el-input v-model="llmForm.apiBase" placeholder="https://api.openai.com/v1" clearable />
        </el-form-item>

        <el-form-item label="API Key" prop="apiKey">
          <el-input v-model="llmForm.apiKey" type="password" placeholder="sk-..." show-password clearable />
        </el-form-item>

        <el-form-item label="温度参数 (Temperature)" prop="temperature">
          <div class="flex items-center space-x-4 w-full">
            <el-slider v-model="llmForm.temperature" :min="0" :max="2" :step="0.1" class="flex-1" />
            <span class="text-xs font-mono w-8 text-right">{{ llmForm.temperature }}</span>
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="flex justify-end space-x-3">
          <el-button @click="showLLMDialog = false">取消</el-button>
          <el-button type="primary" @click="saveLLMConfig" :loading="savingLLM">
            {{ editingLLMConfig ? '保存更改' : '立即添加' }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 向量模型添加/编辑对话框 -->
    <el-dialog
      v-model="showVectorDialog"
      :title="editingVectorConfig ? '编辑向量模型配置' : '添加向量模型配置'"
      width="540px"
      append-to-body
      @close="resetVectorForm"
    >
      <el-form
        :model="vectorForm"
        :rules="vectorRules"
        ref="vectorFormRef"
        label-width="100px"
        label-position="top"
        class="mt-2"
      >
        <el-form-item label="配置名称" prop="name">
          <el-input v-model="vectorForm.name" placeholder="例如：OpenAI Embedding" clearable />
        </el-form-item>

        <el-form-item label="向量模型" prop="model">
          <el-input v-model="vectorForm.model" placeholder="text-embedding-3-small" clearable />
        </el-form-item>

        <el-form-item label="API 地址 (Base URL)" prop="apiBase">
          <el-input v-model="vectorForm.apiBase" placeholder="https://api.openai.com/v1" clearable />
        </el-form-item>

        <el-form-item label="API Key" prop="apiKey">
          <el-input v-model="vectorForm.apiKey" type="password" placeholder="sk-..." show-password clearable />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="flex justify-end space-x-3">
          <el-button @click="showVectorDialog = false">取消</el-button>
          <el-button type="primary" @click="saveVectorConfig" :loading="savingVector">
            {{ editingVectorConfig ? '保存更改' : '立即添加' }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Prompt 编辑对话框 -->
    <el-dialog
      v-model="showPromptDialog"
      :title="editingPromptGroup ? `编辑 Prompt：${editingPromptGroup.name}` : '编辑 Prompt'"
      width="720px"
      append-to-body
      @close="resetPromptForm"
    >
      <div class="space-y-4">
        <div class="text-xs app-muted">
          提示：留空表示使用默认模板；停用会回退默认模板但保留覆盖内容。
        </div>

        <el-form label-position="top" class="mt-2">
          <el-form-item label="启用状态">
            <el-switch v-model="promptForm.enabled" active-text="启用" inactive-text="停用" />
          </el-form-item>

          <el-form-item label="默认系统提示词（只读）">
            <el-input
              type="textarea"
              :rows="6"
              :model-value="editingPromptGroup?.systemItem?.defaultSystemPrompt || ''"
              readonly
            />
          </el-form-item>

          <el-form-item label="默认用户提示词（只读）">
            <el-input
              type="textarea"
              :rows="6"
              :model-value="editingPromptGroup?.userItem?.defaultUserPrompt || ''"
              readonly
            />
          </el-form-item>

          <el-form-item label="覆盖系统提示词">
            <el-input
              v-model="promptForm.systemPrompt"
              type="textarea"
              :rows="6"
              placeholder="留空则使用默认系统提示词"
            />
          </el-form-item>

          <el-form-item label="覆盖用户提示词">
            <el-input
              v-model="promptForm.userPrompt"
              type="textarea"
              :rows="6"
              placeholder="留空则使用默认用户提示词"
            />
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <div class="flex justify-end space-x-3">
          <el-button @click="clearPromptOverrides">重置覆盖</el-button>
          <el-button @click="showPromptDialog = false">取消</el-button>
          <el-button type="primary" :loading="promptSaving" @click="savePromptForm">
            保存
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {
  Box,
  Connection,
  Cpu,
  Delete,
  Edit,
  Plus,
  Refresh,
  Setting,
  Star
} from '@element-plus/icons-vue'
import Breadcrumb from '@/components/Breadcrumb.vue'
import type { PromptConfigItem } from '@/llm/promptClient'
import { listPrompts, savePromptOverrides } from '@/llm/promptClient'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref } from 'vue'

// Tab 切换
const activeTab = ref('llm')

// LLM 相关状态
const llmFormRef = ref<FormInstance>()
const savingLLM = ref(false)
const testingLLMId = ref<string | null>(null)
const showLLMDialog = ref(false)
const editingLLMConfig = ref<any>(null)
const llmConfigs = ref<any[]>([])

const llmForm = ref({
  name: '',
  apiBase: '',
  apiKey: '',
  model: '',
  temperature: 0.7,
  maxTokens: 4096
})

const llmRules: FormRules = {
  name: [{ required: true, message: '请输入配置名称', trigger: 'blur' }],
  apiBase: [
    { required: true, message: '请输入 API 地址', trigger: 'blur' },
    { type: 'url', message: '请输入有效的 URL 地址', trigger: 'blur' }
  ],
  apiKey: [{ required: true, message: '请输入 API Key', trigger: 'blur' }],
  model: [{ required: true, message: '请输入对话模型名称', trigger: 'blur' }]
}

// 向量模型相关状态
const vectorFormRef = ref<FormInstance>()
const savingVector = ref(false)
const testingVectorId = ref<string | null>(null)
const showVectorDialog = ref(false)
const editingVectorConfig = ref<any>(null)
const vectorConfigs = ref<any[]>([])

const vectorForm = ref({
  name: '',
  apiBase: '',
  apiKey: '',
  model: ''
})

const vectorRules: FormRules = {
  name: [{ required: true, message: '请输入配置名称', trigger: 'blur' }],
  apiBase: [
    { required: true, message: '请输入 API 地址', trigger: 'blur' },
    { type: 'url', message: '请输入有效的 URL 地址', trigger: 'blur' }
  ],
  apiKey: [{ required: true, message: '请输入 API Key', trigger: 'blur' }],
  model: [{ required: true, message: '请输入向量模型名称', trigger: 'blur' }]
}

// Prompt 配置相关状态
const promptConfigs = ref<PromptConfigItem[]>([])
const promptLoading = ref(false)
const promptSaving = ref(false)
const showPromptDialog = ref(false)
const editingPrompt = ref<PromptConfigItem | null>(null)
const editingPromptGroup = ref<{
  baseId: string
  name: string
  domain: string
  description: string
  enabled: boolean
  systemItem?: PromptConfigItem
  userItem?: PromptConfigItem
} | null>(null)
const promptForm = ref({
  enabled: true,
  systemPrompt: '',
  userPrompt: ''
})

const sortedLLMConfigs = computed(() => {
  return [...llmConfigs.value].sort((a, b) => {
    const aDef = a.isDefault ? 1 : 0
    const bDef = b.isDefault ? 1 : 0
    return bDef - aDef || (a.createdAt || 0) - (b.createdAt || 0)
  })
})

const sortedVectorConfigs = computed(() => {
  return [...vectorConfigs.value].sort((a, b) => {
    const aDef = a.isDefault ? 1 : 0
    const bDef = b.isDefault ? 1 : 0
    return bDef - aDef || (a.createdAt || 0) - (b.createdAt || 0)
  })
})

onMounted(async () => {
  await loadAllConfigs()
})

// Prompt 分组展示（system + user 合并）
const promptGroups = computed(() => {
  const groups = new Map<string, {
    baseId: string
    name: string
    domain: string
    description: string
    enabled: boolean
    systemItem?: PromptConfigItem
    userItem?: PromptConfigItem
  }>()

  const normalizeName = (name: string) => {
    return name.replace(/-系统提示词|-用户提示词/g, '').trim()
  }

  promptConfigs.value.forEach(item => {
    const baseId = item.id.replace(/\.system$|\.user$/, '')
    const group = groups.get(baseId) || {
      baseId,
      name: normalizeName(item.name || item.id),
      domain: item.domain || 'general',
      description: item.description || '',
      enabled: item.enabled !== false
    }

    if (item.id.endsWith('.system')) {
      group.systemItem = item
    } else if (item.id.endsWith('.user')) {
      group.userItem = item
    } else {
      group.systemItem = item
    }

    const enabled = (group.systemItem?.enabled !== false) && (group.userItem?.enabled !== false)
    group.enabled = enabled

    if (!group.description && item.description) {
      group.description = item.description
    }
    if (!group.domain && item.domain) {
      group.domain = item.domain
    }

    groups.set(baseId, group)
  })

  return Array.from(groups.values())
})

async function loadAllConfigs() {
  await Promise.all([loadLLMConfigs(), loadVectorConfigs(), loadPromptConfigs()])
}

async function loadLLMConfigs() {
  try {
    if (window.electronAPI?.settings) {
      const configs = await window.electronAPI.settings.get('llm_configs')
      llmConfigs.value = Array.isArray(configs) ? configs : []
    }
  } catch (error) {
    console.error('加载 LLM 配置失败:', error)
  }
}

async function loadVectorConfigs() {
  try {
    if (window.electronAPI?.settings) {
      const configs = await window.electronAPI.settings.get('vector_configs')
      vectorConfigs.value = Array.isArray(configs) ? configs : []
    }
  } catch (error) {
    console.error('加载向量模型配置失败:', error)
  }
}

// 加载 Prompt 配置
async function loadPromptConfigs() {
  if (!window.electronAPI?.prompt) return
  promptLoading.value = true
  try {
    promptConfigs.value = await listPrompts()
  } catch (error) {
    console.error('加载 Prompt 配置失败:', error)
  } finally {
    promptLoading.value = false
  }
}

function openPromptEditor(group: {
  baseId: string
  name: string
  domain: string
  description: string
  enabled: boolean
  systemItem?: PromptConfigItem
  userItem?: PromptConfigItem
}) {
  editingPrompt.value = group.systemItem || group.userItem || null
  editingPromptGroup.value = group
  promptForm.value = {
    enabled: group.enabled !== false,
    systemPrompt: group.systemItem?.overrideSystemPrompt || '',
    userPrompt: group.userItem?.overrideUserPrompt || ''
  }
  showPromptDialog.value = true
}

function resetPromptForm() {
  editingPrompt.value = null
  editingPromptGroup.value = null
  promptForm.value = { enabled: true, systemPrompt: '', userPrompt: '' }
  showPromptDialog.value = false
}

function clearPromptOverrides() {
  promptForm.value = { enabled: true, systemPrompt: '', userPrompt: '' }
}

function buildPromptOverrides(list: PromptConfigItem[]) {
  return list
    .map(item => {
      const systemPrompt = item.overrideSystemPrompt?.trim() || ''
      const userPrompt = item.overrideUserPrompt?.trim() || ''
      const hasOverride = Boolean(systemPrompt) || Boolean(userPrompt) || item.enabled === false || item.source === 'custom'
      if (!hasOverride) return null

      return {
        id: item.id,
        name: item.name,
        domain: item.domain,
        description: item.description,
        enabled: item.enabled !== false,
        systemPrompt: systemPrompt || undefined,
        userPrompt: userPrompt || undefined,
        updatedAt: Date.now()
      }
    })
    .filter(Boolean)
}

async function savePromptConfigs() {
  if (!window.electronAPI?.prompt) return
  promptSaving.value = true
  try {
    const overrides = buildPromptOverrides(promptConfigs.value)
    await savePromptOverrides(overrides as Array<any>)
    await loadPromptConfigs()
    ElMessage.success('Prompt 配置已保存')
  } catch (error: any) {
    ElMessage.error('保存 Prompt 失败: ' + (error?.message || '未知错误'))
  } finally {
    promptSaving.value = false
  }
}

async function savePromptForm() {
  if (!editingPromptGroup.value) return
  const baseId = editingPromptGroup.value.baseId
  // 同步表单到列表（同时更新 system / user）
  const updated = promptConfigs.value.map(item => {
    if (!item.id.startsWith(baseId)) return item
    const enabled = promptForm.value.enabled !== false
    const isSystem = item.id.endsWith('.system')
    const isUser = item.id.endsWith('.user')
    const overrideSystemPrompt = isSystem ? promptForm.value.systemPrompt : item.overrideSystemPrompt
    const overrideUserPrompt = isUser ? promptForm.value.userPrompt : item.overrideUserPrompt

    return {
      ...item,
      enabled,
      overrideSystemPrompt,
      overrideUserPrompt,
      systemPrompt: enabled
        ? (overrideSystemPrompt || item.defaultSystemPrompt)
        : item.defaultSystemPrompt,
      userPrompt: enabled
        ? (overrideUserPrompt || item.defaultUserPrompt)
        : item.defaultUserPrompt,
      source: (overrideSystemPrompt || overrideUserPrompt) ? 'override' : item.source
    }
  })
  promptConfigs.value = updated
  await savePromptConfigs()
  showPromptDialog.value = false
}

async function saveLLMConfig() {
  if (!llmFormRef.value) return
  await llmFormRef.value.validate(async (valid) => {
    if (valid) {
      savingLLM.value = true
      try {
        const config = {
          ...llmForm.value,
          id: editingLLMConfig.value?.id || `llm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          isDefault: editingLLMConfig.value?.isDefault || llmConfigs.value.length === 0,
          createdAt: editingLLMConfig.value?.createdAt || Date.now(),
          updatedAt: Date.now()
        }
        const updated = editingLLMConfig.value
          ? llmConfigs.value.map(c => c.id === config.id ? config : c)
          : [...llmConfigs.value, config]
        
        // 剥离 Vue 响应式 Proxy 以避免 DataCloneError
        const rawData = JSON.parse(JSON.stringify(updated))
        await window.electronAPI.settings.set('llm_configs', rawData, 'LLM 配置')
        await loadLLMConfigs()
        showLLMDialog.value = false
        ElMessage.success('配置已保存')
      } catch (e: any) {
        ElMessage.error('保存失败: ' + e.message)
      } finally {
        savingLLM.value = false
      }
    }
  })
}

async function setLLMAsDefault(id: string) {
  const updated = llmConfigs.value.map(c => ({ ...c, isDefault: c.id === id }))
  const rawData = JSON.parse(JSON.stringify(updated))
  await window.electronAPI.settings.set('llm_configs', rawData, '设置默认 LLM')
  await loadLLMConfigs()
  ElMessage.success('默认模型已切换')
}

function editLLMConfig(config: any) {
  editingLLMConfig.value = config
  llmForm.value = { ...config }
  showLLMDialog.value = true
}

async function deleteLLMConfig(id: string, name: string) {
  try {
    await ElMessageBox.confirm(`确定要移除 "${name}" 配置吗？该操作不可撤销。`, '确认移除', {
      confirmButtonText: '确定移除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    const filtered = llmConfigs.value.filter(c => c.id !== id)
    if (filtered.length > 0 && !filtered.some(c => c.isDefault)) filtered[0].isDefault = true
    const rawData = JSON.parse(JSON.stringify(filtered))
    await window.electronAPI.settings.set('llm_configs', rawData, '删除 LLM')
    await loadLLMConfigs()
    ElMessage.success('已移除配置')
  } catch {}
}

async function testLLMConnection(config: any) {
  testingLLMId.value = config.id
  try {
    const res = await fetch(config.apiBase.replace(/\/$/, '') + '/models', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${config.apiKey}` }
    })
    if (res.ok) ElMessage.success('连接成功，模型服务响应正常')
    else ElMessage.error(`连接失败 (HTTP ${res.status})，请检查 API Key 或地址`)
  } catch (e: any) {
    ElMessage.error('无法连接到服务器: ' + e.message)
  } finally {
    testingLLMId.value = null
  }
}

function resetLLMForm() {
  editingLLMConfig.value = null
  llmForm.value = { name: '', apiBase: '', apiKey: '', model: '', temperature: 0.7, maxTokens: 4096 }
}

async function saveVectorConfig() {
  if (!vectorFormRef.value) return
  await vectorFormRef.value.validate(async (valid) => {
    if (valid) {
      savingVector.value = true
      try {
        const config = {
          ...vectorForm.value,
          id: editingVectorConfig.value?.id || `vector_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          isDefault: editingVectorConfig.value?.isDefault || vectorConfigs.value.length === 0,
          createdAt: editingVectorConfig.value?.createdAt || Date.now(),
          updatedAt: Date.now()
        }
        const updated = editingVectorConfig.value
          ? vectorConfigs.value.map(c => c.id === config.id ? config : c)
          : [...vectorConfigs.value, config]

        // 剥离 Vue 响应式 Proxy 以避免 DataCloneError
        const rawData = JSON.parse(JSON.stringify(updated))
        await window.electronAPI.settings.set('vector_configs', rawData, '向量配置')
        await loadVectorConfigs()
        showVectorDialog.value = false
        ElMessage.success('向量配置已保存')
      } catch (e: any) {
        ElMessage.error('保存失败: ' + e.message)
      } finally {
        savingVector.value = false
      }
    }
  })
}

async function setVectorAsDefault(id: string) {
  const updated = vectorConfigs.value.map(c => ({ ...c, isDefault: c.id === id }))
  const rawData = JSON.parse(JSON.stringify(updated))
  await window.electronAPI.settings.set('vector_configs', rawData, '设置默认向量')
  await loadVectorConfigs()
  ElMessage.success('默认向量模型已切换')
}

function editVectorConfig(config: any) {
  editingVectorConfig.value = config
  vectorForm.value = { ...config }
  showVectorDialog.value = true
}

async function deleteVectorConfig(id: string, name: string) {
  try {
    await ElMessageBox.confirm(`确定要移除 "${name}" 向量模型配置吗？`, '确认移除', {
      confirmButtonText: '确定移除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    const filtered = vectorConfigs.value.filter(c => c.id !== id)
    if (filtered.length > 0 && !filtered.some(c => c.isDefault)) filtered[0].isDefault = true
    const rawData = JSON.parse(JSON.stringify(filtered))
    await window.electronAPI.settings.set('vector_configs', rawData, '删除向量配置')
    await loadVectorConfigs()
    ElMessage.success('已移除配置')
  } catch {}
}

async function testVectorConnection(config: any) {
  testingVectorId.value = config.id
  try {
    const res = await fetch(config.apiBase.replace(/\/$/, '') + '/models', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${config.apiKey}` }
    })
    if (res.ok) ElMessage.success('连接成功')
    else ElMessage.error(`连接失败 (HTTP ${res.status})`)
  } catch (e: any) {
    ElMessage.error('测试失败: ' + e.message)
  } finally {
    testingVectorId.value = null
  }
}

function resetVectorForm() {
  editingVectorConfig.value = null
  vectorForm.value = { name: '', apiBase: '', apiKey: '', model: '' }
}
</script>

<style scoped>
.settings-tabs :deep(.el-tabs__content) {
  padding-top: 4px;
}

/* 隐藏部分 UI 细节直到悬浮 */
.group:hover .group-hover\:opacity-100 {
  opacity: 1;
}
</style>
