/// <reference types="vite/client" />

declare global {
  interface Window {
    electronAPI: {
      // 小说相关 API
      novel: {
        list: () => Promise<any[]>
        get: (id: string) => Promise<any>
        create: (data: { title: string; genre?: string; description?: string }) => Promise<any>
        update: (id: string, data: Partial<{ title: string; genre: string; description: string }>) => Promise<any>
        delete: (id: string) => Promise<{ success: boolean }>
      }
      
      // 章节相关 API
      chapter: {
        list: (novelId: string) => Promise<any[]>
        get: (id: string) => Promise<any>
        create: (novelId: string, data?: { title?: string; content?: string; status?: string }) => Promise<any>
        update: (id: string, data: Partial<{ title: string; content: string; status: string; idx: number; chapterNumber: number }>) => Promise<any>
        updateContent: (id: string, content: string) => Promise<any>
        delete: (id: string) => Promise<{ success: boolean }>
        deleteAll: (novelId: string) => Promise<{ success: boolean; deletedCount: number }>
        reorder: (novelId: string) => Promise<{ success: boolean }>
      }
      
      // 实体相关 API
      entity: {
       
      }
      
      // 事件相关 API
      event: {
       
      }
      
      // 设置相关 API
      settings: {
        get: (key: string) => Promise<any>
        set: (key: string, value: any, description?: string) => Promise<string>
        getAll: () => Promise<any[]>
        delete: (key: string) => Promise<{ success: boolean }>
      }
      
      // 大纲相关 API
      outline: {
        list: (novelId: string) => Promise<any[]>
        get: (id: string) => Promise<any>
        create: (novelId: string, data?: { title?: string; content?: string; startChapter?: number; endChapter?: number }) => Promise<any>
        update: (id: string, data: Partial<{ title: string; content: string; startChapter: number; endChapter: number }>) => Promise<any>
        delete: (id: string) => Promise<{ success: boolean }>
      }
      
      // LLM 相关 API
      llm: {
        chat: (options: {
          messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
          temperature?: number
          maxTokens?: number
          configOverride?: Partial<{
            id: string
            name: string
            apiBase: string
            apiKey: string
            model: string
            chatModel: string
            embedModel: string
            temperature: number
            maxTokens: number
            isDefault: boolean
          }>
        }) => Promise<string>
        embed: (options: {
          input: string | string[]
          configOverride?: Partial<{
            id: string
            name: string
            apiBase: string
            apiKey: string
            model: string
            chatModel: string
            embedModel: string
            temperature: number
            maxTokens: number
            isDefault: boolean
          }>
        }) => Promise<number[][]>
      }
      
      // 保留旧的数据库操作 API（向后兼容）
      db: {
        query: (sql: string, params?: any[]) => Promise<any[]>
        execute: (sql: string, params?: any[]) => Promise<{ lastInsertRowid: number; changes: number }>
        getAll: (sql: string, params?: any[]) => Promise<any[]>
        get: (sql: string, params?: any[]) => Promise<any>
      }
    }
  }
}

export { }

