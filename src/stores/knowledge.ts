/**
 * 知识库 Store
 * 管理知识库条目，支持 @DSL 引用
 */
import { defineStore } from 'pinia'
import type { KnowledgeEntry } from '@/shared/schemas'

interface KnowledgeState {
  // 当前小说的知识库条目
  entries: KnowledgeEntry[]
  // ID -> 条目的映射，用于快速查找
  entryMap: Map<string, KnowledgeEntry>
  // 加载状态
  loading: boolean
  // 当前小说 ID
  currentNovelId: string | null
}

export const useKnowledgeStore = defineStore('knowledge', {
  state: (): KnowledgeState => ({
    entries: [],
    entryMap: new Map(),
    loading: false,
    currentNovelId: null
  }),

  getters: {
    // 按类型分组的条目
    entriesByType: (state) => {
      const grouped: Record<string, KnowledgeEntry[]> = {
        character: [],
        location: [],
        event: [],
        item: [],
        rule: [],
        other: []
      }
      for (const entry of state.entries) {
        const type = entry.type || 'other'
        if (!grouped[type]) grouped[type] = []
        grouped[type].push(entry)
      }
      return grouped
    },

    // 角色列表
    characters: (state) => state.entries.filter(e => e.type === 'character'),

    // 地点列表
    locations: (state) => state.entries.filter(e => e.type === 'location'),

    // 事件列表
    events: (state) => state.entries.filter(e => e.type === 'event'),

    // 获取条目总数
    totalCount: (state) => state.entries.length
  },

  actions: {
    /**
     * 加载指定小说的知识库
     */
    async loadKnowledge(novelId: string) {
      if (this.currentNovelId === novelId && this.entries.length > 0) {
        return // 已加载，跳过
      }

      this.loading = true
      this.currentNovelId = novelId

      try {
        if (window.electronAPI?.knowledge) {
          const items = await window.electronAPI.knowledge.list(novelId, undefined, 'approved')
          this.entries = items.map((item: any) => this.normalizeEntry(item))
          this.rebuildMap()
        }
      } catch (error) {
        console.error('加载知识库失败:', error)
        this.entries = []
        this.entryMap.clear()
      } finally {
        this.loading = false
      }
    },

    /**
     * 刷新知识库（强制重新加载）
     */
    async refreshKnowledge() {
      if (!this.currentNovelId) return

      this.loading = true
      try {
        if (window.electronAPI?.knowledge) {
          const items = await window.electronAPI.knowledge.list(
            this.currentNovelId,
            undefined,
            'approved'
          )
          this.entries = items.map((item: any) => this.normalizeEntry(item))
          this.rebuildMap()
        }
      } catch (error) {
        console.error('刷新知识库失败:', error)
      } finally {
        this.loading = false
      }
    },

    /**
     * 根据 ID 获取条目
     */
    getEntryById(id: string): KnowledgeEntry | undefined {
      return this.entryMap.get(id)
    },

    /**
     * 根据名称搜索条目
     */
    searchByName(query: string): KnowledgeEntry[] {
      const lowerQuery = query.toLowerCase()
      return this.entries.filter(entry => {
        const nameMatch = entry.name.toLowerCase().includes(lowerQuery)
        const aliasMatch = entry.aliases?.some(
          alias => alias.toLowerCase().includes(lowerQuery)
        )
        return nameMatch || aliasMatch
      })
    },

    /**
     * 根据 ID 列表获取多个条目
     */
    getEntriesByIds(ids: string[]): KnowledgeEntry[] {
      return ids
        .map(id => this.entryMap.get(id))
        .filter((e): e is KnowledgeEntry => e !== undefined)
    },

    /**
     * 构建上下文字符串（用于 AI Prompt）
     */
    buildContext(ids: string[], maxLength: number = 2000): string {
      const entries = this.getEntriesByIds(ids)
      if (entries.length === 0) return ''

      const sections: string[] = []
      let totalLength = 0

      for (const entry of entries) {
        const section = this.formatEntry(entry)
        if (totalLength + section.length > maxLength) break
        sections.push(section)
        totalLength += section.length
      }

      return `【引用的知识库内容】\n${sections.join('\n\n')}`
    },

    /**
     * 格式化单个条目为文本
     */
    formatEntry(entry: KnowledgeEntry): string {
      const typeLabels: Record<string, string> = {
        character: '角色',
        location: '地点',
        event: '事件',
        item: '物品',
        rule: '规则',
        other: '其他'
      }

      let text = `【${typeLabels[entry.type] || '其他'}：${entry.name}】`

      if (entry.summary) {
        text += `\n摘要：${entry.summary}`
      }

      if (entry.detail) {
        const detail = entry.detail.length > 300
          ? entry.detail.substring(0, 300) + '...'
          : entry.detail
        text += `\n详情：${detail}`
      }

      return text
    },

    /**
     * 规范化条目数据
     */
    normalizeEntry(item: any): KnowledgeEntry {
      return {
        id: item.id,
        type: item.type || 'other',
        name: item.name,
        summary: item.summary,
        detail: item.detail,
        aliases: this.parseJsonField(item.aliases, []),
        tags: this.parseJsonField(item.tags, [])
      }
    },

    /**
     * 解析 JSON 字段
     */
    parseJsonField<T>(value: any, defaultValue: T): T {
      if (!value) return defaultValue
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch {
          return defaultValue
        }
      }
      return value as T
    },

    /**
     * 重建 ID 映射
     */
    rebuildMap() {
      this.entryMap.clear()
      for (const entry of this.entries) {
        this.entryMap.set(entry.id, entry)
      }
    },

    /**
     * 清空状态
     */
    clear() {
      this.entries = []
      this.entryMap.clear()
      this.currentNovelId = null
    }
  }
})
