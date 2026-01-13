<template>
  <div class="h-screen flex flex-col bg-gray-50">
    <!-- 顶部导航栏 -->
    <div class="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6 flex-shrink-0">
      <div class="flex items-center space-x-4">
        <el-button 
          text 
          @click="goToHome"
          class="flex items-center"
        >
          <el-icon class="mr-1"><HomeFilled /></el-icon>
          首页
        </el-button>
        <el-divider direction="vertical" />
        <h1 class="text-xl font-bold flex items-center">
          <el-icon class="mr-2"><Setting /></el-icon>
          应用设置
        </h1>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="flex-1 overflow-auto p-6">
      <div class="max-w-5xl mx-auto">
        <el-tabs v-model="activeTab" type="card" class="settings-tabs">
          <!-- LLM 配置 Tab -->
          <el-tab-pane label="LLM 对话模型" name="llm">
            <el-card shadow="hover" class="mb-6">
              <template #header>
                <div class="flex items-center justify-between">
                  <div class="flex items-center">
                    <el-icon class="mr-2 text-blue-500"><Cpu /></el-icon>
                    <span class="font-semibold">LLM 对话模型配置（兼容 OpenAI API）</span>
                  </div>
                  <el-button
                    type="primary"
                    @click="showLLMDialog = true"
                  >
                    <el-icon class="mr-1"><Plus /></el-icon>
                    添加 LLM 配置
                  </el-button>
                </div>
              </template>

              <!-- LLM 配置列表 -->
              <div v-if="llmConfigs.length === 0" class="text-center py-12 text-gray-400">
                <el-icon class="text-4xl mb-2"><Box /></el-icon>
                <div>暂无 LLM 配置，点击上方按钮添加</div>
              </div>

              <div v-else class="space-y-4">
                <div
                  v-for="(config, index) in sortedLLMConfigs"
                  :key="config.id"
                  class="p-4 border rounded-lg hover:border-blue-300 transition-colors"
                  :class="{ 'border-blue-500 bg-blue-50': config.isDefault }"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <div class="flex items-center space-x-2 mb-2">
                        <span class="font-semibold text-lg">{{ config.name || `配置 ${index + 1}` }}</span>
                        <el-tag v-if="config.isDefault" type="success" size="small">默认</el-tag>
                        <el-tag v-if="config.model" type="info" size="small">{{ config.model }}</el-tag>
                      </div>
                      <div class="grid grid-cols-2 gap-2 text-sm text-gray-600">
                        <div>
                          <span class="font-medium">API 地址：</span>
                          <span class="font-mono text-xs">{{ config.apiBase || '未设置' }}</span>
                        </div>
                        <div>
                          <span class="font-medium">模型：</span>
                          <span>{{ config.model || '未设置' }}</span>
                        </div>
                        <div>
                          <span class="font-medium">温度：</span>
                          <span>{{ config.temperature ?? '未设置' }}</span>
                        </div>
                        <div>
                          <span class="font-medium">最大 Token：</span>
                          <span>{{ config.maxTokens || '未设置' }}</span>
                        </div>
                        <div>
                          <span class="font-medium">API Key：</span>
                          <span class="font-mono text-xs">{{ config.apiKey ? '***' + config.apiKey.slice(-4) : '未设置' }}</span>
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center space-x-2 ml-4">
                      <el-button
                        v-if="!config.isDefault"
                        type="success"
                        size="small"
                        text
                        @click="setLLMAsDefault(config.id)"
                      >
                        <el-icon class="mr-1"><Star /></el-icon>
                        设为默认
                      </el-button>
                      <el-button
                        type="primary"
                        size="small"
                        text
                        @click="editLLMConfig(config)"
                      >
                        <el-icon class="mr-1"><Edit /></el-icon>
                        编辑
                      </el-button>
                      <el-button
                        type="info"
                        size="small"
                        text
                        @click="testLLMConnection(config)"
                        :loading="testingLLMId === config.id"
                      >
                        <el-icon class="mr-1"><Connection /></el-icon>
                        测试
                      </el-button>
                      <el-button
                        type="danger"
                        size="small"
                        text
                        @click="deleteLLMConfig(config.id, config.name)"
                      >
                        <el-icon class="mr-1"><Delete /></el-icon>
                        删除
                      </el-button>
                    </div>
                  </div>
                </div>
              </div>
            </el-card>
          </el-tab-pane>

          <!-- 向量模型配置 Tab -->
          <el-tab-pane label="向量分词模型" name="vector">
            <el-card shadow="hover" class="mb-6">
              <template #header>
                <div class="flex items-center justify-between">
                  <div class="flex items-center">
                    <el-icon class="mr-2 text-purple-500"><Box /></el-icon>
                    <span class="font-semibold">向量分词模型配置（兼容 OpenAI API）</span>
                  </div>
                  <el-button
                    type="primary"
                    @click="showVectorDialog = true"
                  >
                    <el-icon class="mr-1"><Plus /></el-icon>
                    添加向量模型配置
                  </el-button>
                </div>
              </template>

              <!-- 向量模型配置列表 -->
              <div v-if="vectorConfigs.length === 0" class="text-center py-12 text-gray-400">
                <el-icon class="text-4xl mb-2"><Box /></el-icon>
                <div>暂无向量模型配置，点击上方按钮添加</div>
              </div>

              <div v-else class="space-y-4">
                <div
                  v-for="(config, index) in sortedVectorConfigs"
                  :key="config.id"
                  class="p-4 border rounded-lg hover:border-purple-300 transition-colors"
                  :class="{ 'border-purple-500 bg-purple-50': config.isDefault }"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <div class="flex items-center space-x-2 mb-2">
                        <span class="font-semibold text-lg">{{ config.name || `配置 ${index + 1}` }}</span>
                        <el-tag v-if="config.isDefault" type="success" size="small">默认</el-tag>
                        <el-tag v-if="config.model" type="info" size="small">{{ config.model }}</el-tag>
                      </div>
                      <div class="grid grid-cols-2 gap-2 text-sm text-gray-600">
                        <div>
                          <span class="font-medium">API 地址：</span>
                          <span class="font-mono text-xs">{{ config.apiBase || '未设置' }}</span>
                        </div>
                        <div>
                          <span class="font-medium">模型：</span>
                          <span>{{ config.model || '未设置' }}</span>
                        </div>
                        <div>
                          <span class="font-medium">API Key：</span>
                          <span class="font-mono text-xs">{{ config.apiKey ? '***' + config.apiKey.slice(-4) : '未设置' }}</span>
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center space-x-2 ml-4">
                      <el-button
                        v-if="!config.isDefault"
                        type="success"
                        size="small"
                        text
                        @click="setVectorAsDefault(config.id)"
                      >
                        <el-icon class="mr-1"><Star /></el-icon>
                        设为默认
                      </el-button>
                      <el-button
                        type="primary"
                        size="small"
                        text
                        @click="editVectorConfig(config)"
                      >
                        <el-icon class="mr-1"><Edit /></el-icon>
                        编辑
                      </el-button>
                      <el-button
                        type="info"
                        size="small"
                        text
                        @click="testVectorConnection(config)"
                        :loading="testingVectorId === config.id"
                      >
                        <el-icon class="mr-1"><Connection /></el-icon>
                        测试
                      </el-button>
                      <el-button
                        type="danger"
                        size="small"
                        text
                        @click="deleteVectorConfig(config.id, config.name)"
                      >
                        <el-icon class="mr-1"><Delete /></el-icon>
                        删除
                      </el-button>
                    </div>
                  </div>
                </div>
              </div>
            </el-card>
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>

    <!-- LLM 添加/编辑对话框 -->
    <el-dialog
      v-model="showLLMDialog"
      :title="editingLLMConfig ? '编辑 LLM 配置' : '添加 LLM 配置'"
      width="600px"
      @close="resetLLMForm"
    >
      <el-form
        :model="llmForm"
        :rules="llmRules"
        ref="llmFormRef"
        label-width="120px"
        label-position="left"
      >
        <el-form-item label="配置名称" prop="name">
          <el-input
            v-model="llmForm.name"
            placeholder="例如：OpenAI GPT-4"
            clearable
          />
          <div class="text-xs text-gray-500 mt-1">
            为这个配置起一个便于识别的名称
          </div>
        </el-form-item>

        <el-form-item label="API 地址" prop="apiBase">
          <el-input
            v-model="llmForm.apiBase"
            placeholder="https://api.openai.com/v1"
            clearable
          >
            <template #prepend>
              <el-icon><Link /></el-icon>
            </template>
          </el-input>
          <div class="text-xs text-gray-500 mt-1">
            兼容 OpenAI API 的接口地址
          </div>
        </el-form-item>

        <el-form-item label="API Key" prop="apiKey">
          <el-input
            v-model="llmForm.apiKey"
            type="password"
            placeholder="sk-..."
            show-password
            clearable
          >
            <template #prepend>
              <el-icon><Key /></el-icon>
            </template>
          </el-input>
          <div class="text-xs text-gray-500 mt-1">
            API Key 将安全存储在本地数据库中
          </div>
        </el-form-item>

        <el-form-item label="对话模型" prop="model">
          <el-input
            v-model="llmForm.model"
            placeholder="gpt-3.5-turbo"
            clearable
          >
            <template #prepend>
              <el-icon><Box /></el-icon>
            </template>
          </el-input>
          <div class="text-xs text-gray-500 mt-1">
            例如：gpt-3.5-turbo, gpt-4, claude-3-opus 等
          </div>
        </el-form-item>

        <el-form-item label="温度参数" prop="temperature">
          <el-slider
            v-model="llmForm.temperature"
            :min="0"
            :max="2"
            :step="0.1"
            show-input
            :format-tooltip="(val) => val.toFixed(1)"
          />
          <div class="text-xs text-gray-500 mt-1">
            控制输出的随机性，0 表示最确定，2 表示最随机（默认：0.7）
          </div>
        </el-form-item>

        <el-form-item label="最大 Token" prop="maxTokens">
          <el-input-number
            v-model="llmForm.maxTokens"
            :min="100"
            :max="32000"
            :step="100"
            placeholder="2000"
            class="w-full"
          />
          <div class="text-xs text-gray-500 mt-1">
            生成内容的最大 token 数量（默认：2000）
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showLLMDialog = false">取消</el-button>
        <el-button
          type="primary"
          @click="saveLLMConfig"
          :loading="savingLLM"
        >
          {{ editingLLMConfig ? '更新' : '添加' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 向量模型添加/编辑对话框 -->
    <el-dialog
      v-model="showVectorDialog"
      :title="editingVectorConfig ? '编辑向量模型配置' : '添加向量模型配置'"
      width="600px"
      @close="resetVectorForm"
    >
      <el-form
        :model="vectorForm"
        :rules="vectorRules"
        ref="vectorFormRef"
        label-width="120px"
        label-position="left"
      >
        <el-form-item label="配置名称" prop="name">
          <el-input
            v-model="vectorForm.name"
            placeholder="例如：OpenAI Embedding"
            clearable
          />
          <div class="text-xs text-gray-500 mt-1">
            为这个配置起一个便于识别的名称
          </div>
        </el-form-item>

        <el-form-item label="API 地址" prop="apiBase">
          <el-input
            v-model="vectorForm.apiBase"
            placeholder="https://api.openai.com/v1"
            clearable
          >
            <template #prepend>
              <el-icon><Link /></el-icon>
            </template>
          </el-input>
          <div class="text-xs text-gray-500 mt-1">
            兼容 OpenAI API 的接口地址
          </div>
        </el-form-item>

        <el-form-item label="API Key" prop="apiKey">
          <el-input
            v-model="vectorForm.apiKey"
            type="password"
            placeholder="sk-..."
            show-password
            clearable
          >
            <template #prepend>
              <el-icon><Key /></el-icon>
            </template>
          </el-input>
          <div class="text-xs text-gray-500 mt-1">
            API Key 将安全存储在本地数据库中
          </div>
        </el-form-item>

        <el-form-item label="向量模型" prop="model">
          <el-input
            v-model="vectorForm.model"
            placeholder="text-embedding-3-small"
            clearable
          >
            <template #prepend>
              <el-icon><Box /></el-icon>
            </template>
          </el-input>
          <div class="text-xs text-gray-500 mt-1">
            例如：text-embedding-3-small, text-embedding-ada-002 等
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showVectorDialog = false">取消</el-button>
        <el-button
          type="primary"
          @click="saveVectorConfig"
          :loading="savingVector"
        >
          {{ editingVectorConfig ? '更新' : '添加' }}
        </el-button>
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
  HomeFilled,
  Key,
  Link,
  Plus,
  Setting,
  Star
} from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

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
  maxTokens: 2000
})

const llmRules: FormRules = {
  name: [
    { required: true, message: '请输入配置名称', trigger: 'blur' }
  ],
  apiBase: [
    { required: true, message: '请输入 API 地址', trigger: 'blur' },
    { type: 'url', message: '请输入有效的 URL 地址', trigger: 'blur' }
  ],
  apiKey: [
    { required: true, message: '请输入 API Key', trigger: 'blur' }
  ],
  model: [
    { required: true, message: '请输入对话模型名称', trigger: 'blur' }
  ],
  temperature: [
    { type: 'number', min: 0, max: 2, message: '温度参数应在 0-2 之间', trigger: 'blur' }
  ],
  maxTokens: [
    { type: 'number', min: 100, max: 32000, message: '最大 Token 应在 100-32000 之间', trigger: 'blur' }
  ]
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
  name: [
    { required: true, message: '请输入配置名称', trigger: 'blur' }
  ],
  apiBase: [
    { required: true, message: '请输入 API 地址', trigger: 'blur' },
    { type: 'url', message: '请输入有效的 URL 地址', trigger: 'blur' }
  ],
  apiKey: [
    { required: true, message: '请输入 API Key', trigger: 'blur' }
  ],
  model: [
    { required: true, message: '请输入向量模型名称', trigger: 'blur' }
  ]
}

const sortedLLMConfigs = computed(() => {
  const list = [...llmConfigs.value]
  return list.sort((a, b) => {
    const aDefault = a.isDefault ? 1 : 0
    const bDefault = b.isDefault ? 1 : 0
    if (aDefault !== bDefault) {
      return bDefault - aDefault
    }
    return (a.createdAt || 0) - (b.createdAt || 0)
  })
})

const sortedVectorConfigs = computed(() => {
  const list = [...vectorConfigs.value]
  return list.sort((a, b) => {
    const aDefault = a.isDefault ? 1 : 0
    const bDefault = b.isDefault ? 1 : 0
    if (aDefault !== bDefault) {
      return bDefault - aDefault
    }
    return (a.createdAt || 0) - (b.createdAt || 0)
  })
})

onMounted(async () => {
  await loadAllConfigs()
})

async function loadAllConfigs() {
  await Promise.all([loadLLMConfigs(), loadVectorConfigs()])
}

async function loadLLMConfigs() {
  try {
    if (window.electronAPI?.settings) {
      const configs = await window.electronAPI.settings.get('llm_configs')
      if (configs && Array.isArray(configs)) {
        llmConfigs.value = configs
      } else {
        llmConfigs.value = []
      }
    }
  } catch (error: any) {
    console.error('加载 LLM 配置失败:', error)
    llmConfigs.value = []
  }
}

async function loadVectorConfigs() {
  try {
    if (window.electronAPI?.settings) {
      const configs = await window.electronAPI.settings.get('vector_configs')
      if (configs && Array.isArray(configs)) {
        vectorConfigs.value = configs
      } else {
        vectorConfigs.value = []
      }
    }
  } catch (error: any) {
    console.error('加载向量模型配置失败:', error)
    vectorConfigs.value = []
  }
}

// LLM 配置操作
async function saveLLMConfig() {
  if (!llmFormRef.value) return

  await llmFormRef.value.validate(async (valid) => {
    if (valid) {
      savingLLM.value = true
      try {
        if (window.electronAPI?.settings) {
          const config = {
            id: editingLLMConfig.value?.id || `llm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: llmForm.value.name,
            apiBase: llmForm.value.apiBase,
            apiKey: llmForm.value.apiKey,
            model: llmForm.value.model,
            temperature: llmForm.value.temperature,
            maxTokens: llmForm.value.maxTokens,
            isDefault: editingLLMConfig.value?.isDefault || false,
            createdAt: editingLLMConfig.value?.createdAt || Date.now(),
            updatedAt: Date.now()
          }

          let updatedConfigs = [...llmConfigs.value]
          
          if (editingLLMConfig.value) {
            const index = updatedConfigs.findIndex(c => c.id === editingLLMConfig.value.id)
            if (index !== -1) {
              updatedConfigs[index] = config
            }
          } else {
            if (updatedConfigs.length === 0) {
              config.isDefault = true
            }
            updatedConfigs.push(config)
          }

          await window.electronAPI.settings.set(
            'llm_configs',
            updatedConfigs,
            'LLM 对话模型配置列表'
          )
          
          await loadLLMConfigs()
          showLLMDialog.value = false
          resetLLMForm()
          ElMessage.success(editingLLMConfig.value ? '配置已更新！' : '配置已添加！')
        } else {
          ElMessage.error('Electron API 未加载')
        }
      } catch (error: any) {
        console.error('保存 LLM 配置失败:', error)
        ElMessage.error('保存失败: ' + (error.message || '未知错误'))
      } finally {
        savingLLM.value = false
      }
    }
  })
}

async function setLLMAsDefault(configId: string) {
  try {
    const updatedConfigs = llmConfigs.value.map(config => ({
      ...config,
      isDefault: config.id === configId
    }))

    await window.electronAPI.settings.set(
      'llm_configs',
      updatedConfigs,
      'LLM 对话模型配置列表'
    )
    
    await loadLLMConfigs()
    ElMessage.success('已设置为默认 LLM 配置')
  } catch (error: any) {
    console.error('设置默认 LLM 配置失败:', error)
    ElMessage.error('设置失败: ' + (error.message || '未知错误'))
  }
}

function editLLMConfig(config: any) {
  editingLLMConfig.value = config
  llmForm.value = {
    name: config.name || '',
    apiBase: config.apiBase || 'https://api.openai.com/v1',
    apiKey: config.apiKey || '',
    model: config.model || 'gpt-3.5-turbo',
    temperature: config.temperature ?? 0.7,
    maxTokens: config.maxTokens || 2000
  }
  showLLMDialog.value = true
}

async function deleteLLMConfig(configId: string, configName: string) {
  try {
    await ElMessageBox.confirm(
      `确定要删除配置 "${configName}" 吗？此操作不可恢复！`,
      '确认删除',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const config = llmConfigs.value.find(c => c.id === configId)
    if (config?.isDefault && llmConfigs.value.length > 1) {
      const otherConfigs = llmConfigs.value.filter(c => c.id !== configId)
      if (otherConfigs.length > 0) {
        otherConfigs[0].isDefault = true
      }
    }

    const updatedConfigs = llmConfigs.value.filter(c => c.id !== configId)
    
    await window.electronAPI.settings.set(
      'llm_configs',
      updatedConfigs,
      'LLM 对话模型配置列表'
    )
    
    await loadLLMConfigs()
    ElMessage.success('配置已删除')
  } catch {
    // 用户取消删除
  }
}

async function testLLMConnection(config: any) {
  if (!config.apiBase || !config.apiKey) {
    ElMessage.warning('配置信息不完整')
    return
  }

  testingLLMId.value = config.id
  try {
    const testUrl = config.apiBase.replace(/\/$/, '') + '/models'
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      ElMessage.success('连接测试成功！API 配置正确。')
    } else {
      const errorText = await response.text()
      ElMessage.error(`连接测试失败: ${response.status} ${response.statusText}`)
      console.error('测试失败:', errorText)
    }
  } catch (error: any) {
    console.error('测试连接失败:', error)
    ElMessage.error('连接测试失败: ' + (error.message || '网络错误'))
  } finally {
    testingLLMId.value = null
  }
}

function resetLLMForm() {
  editingLLMConfig.value = null
  llmForm.value = {
    name: '',
    apiBase: '',
    apiKey: '',
    model: '',
    temperature: 0.7,
    maxTokens: 2000
  }
  llmFormRef.value?.resetFields()
}

// 向量模型配置操作
async function saveVectorConfig() {
  if (!vectorFormRef.value) return

  await vectorFormRef.value.validate(async (valid) => {
    if (valid) {
      savingVector.value = true
      try {
        if (window.electronAPI?.settings) {
          const config = {
            id: editingVectorConfig.value?.id || `vector_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: vectorForm.value.name,
            apiBase: vectorForm.value.apiBase,
            apiKey: vectorForm.value.apiKey,
            model: vectorForm.value.model,
            isDefault: editingVectorConfig.value?.isDefault || false,
            createdAt: editingVectorConfig.value?.createdAt || Date.now(),
            updatedAt: Date.now()
          }

          let updatedConfigs = [...vectorConfigs.value]
          
          if (editingVectorConfig.value) {
            const index = updatedConfigs.findIndex(c => c.id === editingVectorConfig.value.id)
            if (index !== -1) {
              updatedConfigs[index] = config
            }
          } else {
            if (updatedConfigs.length === 0) {
              config.isDefault = true
            }
            updatedConfigs.push(config)
          }

          await window.electronAPI.settings.set(
            'vector_configs',
            updatedConfigs,
            '向量分词模型配置列表'
          )
          
          await loadVectorConfigs()
          showVectorDialog.value = false
          resetVectorForm()
          ElMessage.success(editingVectorConfig.value ? '配置已更新！' : '配置已添加！')
        } else {
          ElMessage.error('Electron API 未加载')
        }
      } catch (error: any) {
        console.error('保存向量模型配置失败:', error)
        ElMessage.error('保存失败: ' + (error.message || '未知错误'))
      } finally {
        savingVector.value = false
      }
    }
  })
}

async function setVectorAsDefault(configId: string) {
  try {
    const updatedConfigs = vectorConfigs.value.map(config => ({
      ...config,
      isDefault: config.id === configId
    }))

    await window.electronAPI.settings.set(
      'vector_configs',
      updatedConfigs,
      '向量分词模型配置列表'
    )
    
    await loadVectorConfigs()
    ElMessage.success('已设置为默认向量模型配置')
  } catch (error: any) {
    console.error('设置默认向量模型配置失败:', error)
    ElMessage.error('设置失败: ' + (error.message || '未知错误'))
  }
}

function editVectorConfig(config: any) {
  editingVectorConfig.value = config
  vectorForm.value = {
    name: config.name || '',
    apiBase: config.apiBase || 'https://api.openai.com/v1',
    apiKey: config.apiKey || '',
    model: config.model || 'text-embedding-3-small'
  }
  showVectorDialog.value = true
}

async function deleteVectorConfig(configId: string, configName: string) {
  try {
    await ElMessageBox.confirm(
      `确定要删除配置 "${configName}" 吗？此操作不可恢复！`,
      '确认删除',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const config = vectorConfigs.value.find(c => c.id === configId)
    if (config?.isDefault && vectorConfigs.value.length > 1) {
      const otherConfigs = vectorConfigs.value.filter(c => c.id !== configId)
      if (otherConfigs.length > 0) {
        otherConfigs[0].isDefault = true
      }
    }

    const updatedConfigs = vectorConfigs.value.filter(c => c.id !== configId)
    
    await window.electronAPI.settings.set(
      'vector_configs',
      updatedConfigs,
      '向量分词模型配置列表'
    )
    
    await loadVectorConfigs()
    ElMessage.success('配置已删除')
  } catch {
    // 用户取消删除
  }
}

async function testVectorConnection(config: any) {
  if (!config.apiBase || !config.apiKey) {
    ElMessage.warning('配置信息不完整')
    return
  }

  testingVectorId.value = config.id
  try {
    const testUrl = config.apiBase.replace(/\/$/, '') + '/models'
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      ElMessage.success('连接测试成功！API 配置正确。')
    } else {
      const errorText = await response.text()
      ElMessage.error(`连接测试失败: ${response.status} ${response.statusText}`)
      console.error('测试失败:', errorText)
    }
  } catch (error: any) {
    console.error('测试连接失败:', error)
    ElMessage.error('连接测试失败: ' + (error.message || '网络错误'))
  } finally {
    testingVectorId.value = null
  }
}

function resetVectorForm() {
  editingVectorConfig.value = null
  vectorForm.value = {
    name: '',
    apiBase: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'text-embedding-3-small'
  }
  vectorFormRef.value?.resetFields()
}

function goBack() {
  router.back()
}

function goToHome() {
  router.push('/')
}
</script>

<style scoped>
:deep(.el-card__header) {
  background-color: #fafafa;
  border-bottom: 1px solid #ebeef5;
}

.settings-tabs :deep(.el-tabs__header) {
  margin-bottom: 20px;
}
</style>
