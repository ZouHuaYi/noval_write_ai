<template>
  <div class="h-screen flex flex-col app-shell">
    <Breadcrumb />

    <div class="h-14 app-header flex items-center px-6 flex-shrink-0">
      <div class="flex items-center gap-3">
        <el-icon class="text-xl text-[var(--app-primary)]"><InfoFilled /></el-icon>
        <span class="text-xl font-semibold">关于我们</span>
      </div>
    </div>

    <div class="flex-1 overflow-auto p-6">
      <div class="max-w-5xl mx-auto flex flex-col gap-6">
        <el-card shadow="hover" class="app-card">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-xs app-muted">软件信息</div>
              <h2 class="text-2xl font-semibold mt-1">{{ productName }}</h2>
              <p class="app-muted mt-2">{{ descriptionText }}</p>
            </div>
            <div class="text-right">
              <div class="text-xs app-muted">当前版本</div>
              <div class="text-lg font-semibold">{{ version }}</div>
            </div>
          </div>
          <div class="mt-4 flex flex-wrap gap-3">
            <el-tag size="small" effect="plain">包名：{{ packageName }}</el-tag>
            <el-tag size="small" effect="plain">许可证：{{ license }}</el-tag>
            <el-tag size="small" effect="plain">作者：{{ author }}</el-tag>
          </div>
        </el-card>

        <el-card shadow="hover" class="app-card">
          <template #header>
            <div class="flex items-center justify-between">
              <span class="font-semibold">使用手册</span>
              <el-tag size="small" type="info" effect="plain">USER_MANUAL.md</el-tag>
            </div>
          </template>
          <div class="manual-content custom-scrollbar">
            <div class="markdown-body" v-html="manualHtml"></div>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { InfoFilled } from '@element-plus/icons-vue'
import Breadcrumb from '@/components/Breadcrumb.vue'
// 读取项目根目录的使用手册
import manualText from '../../USER_MANUAL.md?raw'
// 读取 package.json 中的软件信息
import pkg from '../../package.json'

// 展示软件名称与版本信息
const productName = computed(() => pkg?.build?.productName || pkg?.name || '小说管理')
const version = computed(() => pkg?.version || '-')
const packageName = computed(() => pkg?.name || '-')
const license = computed(() => pkg?.license || '-')
const descriptionText = computed(() => pkg?.description || '暂无描述')
const author = computed(() => pkg?.author || '-')

// 简易 Markdown 渲染：覆盖标题/列表/代码块/行内样式，满足手册展示需求
const manualHtml = computed(() => renderMarkdown(manualText || ''))

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function renderInline(value: string) {
  const escaped = escapeHtml(value)
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

function renderMarkdown(source: string) {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let inCode = false
  let codeBuffer: string[] = []
  let inList = false

  const flushList = () => {
    if (inList) {
      html.push('</ul>')
      inList = false
    }
  }

  const flushCode = () => {
    if (inCode) {
      html.push(`<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`)
      codeBuffer = []
      inCode = false
    }
  }

  lines.forEach((line) => {
    if (line.trim().startsWith('```')) {
      if (inCode) {
        flushCode()
      } else {
        flushList()
        inCode = true
      }
      return
    }

    if (inCode) {
      codeBuffer.push(line)
      return
    }

    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) {
        html.push('<ul>')
        inList = true
      }
      const item = line.replace(/^\s*[-*]\s+/, '')
      html.push(`<li>${renderInline(item)}</li>`)
      return
    }

    flushList()

    if (/^#{1,6}\s+/.test(line)) {
      const level = Math.min(6, line.match(/^#+/)?.[0].length || 1)
      const content = line.replace(/^#{1,6}\s+/, '')
      html.push(`<h${level}>${renderInline(content)}</h${level}>`)
      return
    }

    if (!line.trim()) {
      html.push('<div class="md-spacer"></div>')
      return
    }

    html.push(`<p>${renderInline(line)}</p>`)
  })

  flushCode()
  flushList()
  return html.join('\n')
}
</script>

<style scoped>
.manual-content {
  max-height: 520px;
  overflow: auto;
  background: var(--app-surface-muted);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  padding: 16px;
}

.markdown-body :deep(h1) {
  font-size: 20px;
  font-weight: 700;
  margin: 8px 0;
}

.markdown-body :deep(h2) {
  font-size: 18px;
  font-weight: 600;
  margin: 8px 0;
}

.markdown-body :deep(h3) {
  font-size: 16px;
  font-weight: 600;
  margin: 8px 0;
}

.markdown-body :deep(p) {
  margin: 6px 0;
  line-height: 1.7;
  color: var(--app-text);
}

.markdown-body :deep(ul) {
  margin: 6px 0 6px 18px;
  list-style: disc;
}

.markdown-body :deep(li) {
  margin: 4px 0;
  line-height: 1.7;
}

.markdown-body :deep(code) {
  background: var(--app-surface-strong);
  padding: 1px 6px;
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 12px;
}

.markdown-body :deep(pre) {
  margin: 10px 0;
  padding: 12px;
  background: var(--app-surface-strong);
  border-radius: 10px;
  overflow: auto;
}

.markdown-body :deep(pre code) {
  padding: 0;
  background: transparent;
  font-size: 12px;
}

.markdown-body :deep(.md-spacer) {
  height: 6px;
}
</style>
