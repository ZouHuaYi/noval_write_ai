<template>
  <div class="rich-editor" :class="{ 'rich-editor--focused': isFocused }">
    <editor-content :editor="editor" class="rich-editor__content" />
    
    <!-- @ 提及建议列表 -->
    <div 
      v-if="showMentionSuggestions" 
      ref="suggestionListRef"
      class="mention-suggestions"
      :style="mentionListStyle"
    >
      <div
        v-for="(item, index) in filteredSuggestions"
        :key="item.id"
        class="mention-item"
        :class="{ 'mention-item--active': index === selectedIndex }"
        @click="selectMention(item)"
        @mouseenter="selectedIndex = index"
      >
        <span class="mention-item__icon">{{ getTypeIcon(item.type) }}</span>
        <span class="mention-item__name">{{ item.name }}</span>
        <span class="mention-item__type">{{ getTypeLabel(item.type) }}</span>
      </div>
      <div v-if="filteredSuggestions.length === 0" class="mention-empty">
        无匹配项
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Mention from '@tiptap/extension-mention'
import { computed, onBeforeUnmount, ref, watch, nextTick } from 'vue'

// 知识条目类型
interface KnowledgeItem {
  id: string
  type: 'character' | 'location' | 'event' | 'item' | 'rule' | 'other'
  name: string
  summary?: string
  detail?: string
  aliases?: string[]
}

const props = defineProps<{
  modelValue: string
  placeholder?: string
  knowledgeItems?: KnowledgeItem[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'mention-insert', item: KnowledgeItem): void
  (e: 'focus'): void
  (e: 'blur'): void
}>()

// 编辑器状态
const isFocused = ref(false)
const showMentionSuggestions = ref(false)
const mentionQuery = ref('')
const selectedIndex = ref(0)
const mentionListStyle = ref({ top: '0px', left: '0px' })

// 可用的知识条目
const knowledgeItems = computed(() => props.knowledgeItems || [])

// 过滤后的建议列表
const filteredSuggestions = computed(() => {
  const query = mentionQuery.value.toLowerCase()
  if (!query) return knowledgeItems.value.slice(0, 10)
  
  return knowledgeItems.value
    .filter(item => {
      const nameMatch = item.name.toLowerCase().includes(query)
      const aliasMatch = item.aliases?.some(alias => 
        alias.toLowerCase().includes(query)
      )
      return nameMatch || aliasMatch
    })
    .slice(0, 10)
})

// Mention 扩展配置
const MentionConfig = Mention.configure({
  HTMLAttributes: {
    class: 'mention',
  },
  suggestion: {
    items: ({ query }: { query: string }) => {
      mentionQuery.value = query
      return filteredSuggestions.value
    },
    render: () => {
      return {
        onStart: (props: any) => {
          showMentionSuggestions.value = true
          selectedIndex.value = 0
          updateMentionPosition(props)
        },
        onUpdate: (props: any) => {
          selectedIndex.value = 0
          updateMentionPosition(props)
        },
        onKeyDown: (props: any) => {
          if (props.event.key === 'ArrowUp') {
            selectedIndex.value = Math.max(0, selectedIndex.value - 1)
            return true
          }
          if (props.event.key === 'ArrowDown') {
            selectedIndex.value = Math.min(
              filteredSuggestions.value.length - 1,
              selectedIndex.value + 1
            )
            return true
          }
          if (props.event.key === 'Enter') {
            const item = filteredSuggestions.value[selectedIndex.value]
            if (item) {
              props.command({ id: item.id, label: item.name })
              emit('mention-insert', item)
            }
            return true
          }
          if (props.event.key === 'Escape') {
            showMentionSuggestions.value = false
            return true
          }
          return false
        },
        onExit: () => {
          showMentionSuggestions.value = false
        },
      }
    },
  },
})

// 创建编辑器
const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit.configure({
      heading: false,
      codeBlock: false,
    }),
    Placeholder.configure({
      placeholder: props.placeholder || '开始写作... 输入 @ 引用知识库内容',
    }),
    MentionConfig,
  ],
  editable: !props.disabled,
  onUpdate: ({ editor }) => {
    const html = editor.getHTML()
    emit('update:modelValue', html)
  },
  onFocus: () => {
    isFocused.value = true
    emit('focus')
  },
  onBlur: () => {
    isFocused.value = false
    emit('blur')
  },
})

// 更新提及列表位置
function updateMentionPosition(props: any) {
  nextTick(() => {
    if (!props.clientRect) return
    const rect = props.clientRect()
    mentionListStyle.value = {
      top: `${rect.bottom + 8}px`,
      left: `${rect.left}px`,
    }
  })
}

// 选择提及项
function selectMention(item: KnowledgeItem) {
  if (editor.value) {
    editor.value.commands.insertContent({
      type: 'mention',
      attrs: {
        id: item.id,
        label: item.name,
      },
    })
  }
  showMentionSuggestions.value = false
  emit('mention-insert', item)
}

// 类型图标
function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    character: '👤',
    location: '📍',
    event: '📅',
    item: '📦',
    rule: '📜',
    other: '📝',
  }
  return icons[type] || '📝'
}

// 类型标签
function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    character: '角色',
    location: '地点',
    event: '事件',
    item: '物品',
    rule: '规则',
    other: '其他',
  }
  return labels[type] || '其他'
}

// 监听外部值变化
watch(() => props.modelValue, (newValue) => {
  if (editor.value && newValue !== editor.value.getHTML()) {
    editor.value.commands.setContent(newValue)
  }
})

// 监听禁用状态
watch(() => props.disabled, (disabled) => {
  editor.value?.setEditable(!disabled)
})

// 清理
onBeforeUnmount(() => {
  editor.value?.destroy()
})

// 暴露方法
defineExpose({
  focus: () => editor.value?.commands.focus(),
  blur: () => editor.value?.commands.blur(),
  getHTML: () => editor.value?.getHTML() || '',
  getText: () => editor.value?.getText() || '',
  insertText: (text: string) => editor.value?.commands.insertContent(text),
  // 提取所有 @提及的内容
  getMentions: () => {
    const html = editor.value?.getHTML() || ''
    const mentions: string[] = []
    const regex = /data-id="([^"]+)"/g
    let match
    while ((match = regex.exec(html)) !== null) {
      mentions.push(match[1])
    }
    return mentions
  },
})
</script>

<style scoped>
.rich-editor {
  position: relative;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-bg);
  transition: all 0.2s ease;
}

.rich-editor--focused {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

.rich-editor__content {
  min-height: 200px;
  padding: 16px;
}

.rich-editor__content :deep(.ProseMirror) {
  outline: none;
  min-height: 200px;
  font-size: 15px;
  line-height: 1.8;
}

.rich-editor__content :deep(.ProseMirror p) {
  margin: 0 0 1em 0;
}

.rich-editor__content :deep(.ProseMirror p:last-child) {
  margin-bottom: 0;
}

.rich-editor__content :deep(.ProseMirror .is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: var(--el-text-color-placeholder);
  pointer-events: none;
  height: 0;
}

/* @ 提及样式 */
.rich-editor__content :deep(.mention) {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  margin: 0 2px;
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.15), rgba(103, 194, 58, 0.15));
  border: 1px solid rgba(64, 158, 255, 0.3);
  border-radius: 4px;
  color: var(--el-color-primary);
  font-weight: 500;
  font-size: 14px;
  cursor: default;
  transition: all 0.2s ease;
}

.rich-editor__content :deep(.mention:hover) {
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.25), rgba(103, 194, 58, 0.25));
  border-color: rgba(64, 158, 255, 0.5);
}

/* 提及建议列表 */
.mention-suggestions {
  position: fixed;
  z-index: 9999;
  min-width: 200px;
  max-width: 320px;
  max-height: 280px;
  overflow-y: auto;
  background: var(--app-bg);
  border: 1px solid var(--app-border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  padding: 4px;
}

.mention-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mention-item:hover,
.mention-item--active {
  background: var(--el-fill-color-light);
}

.mention-item__icon {
  font-size: 16px;
  flex-shrink: 0;
}

.mention-item__name {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mention-item__type {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color);
  padding: 2px 6px;
  border-radius: 4px;
}

.mention-empty {
  padding: 12px;
  text-align: center;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}
</style>
