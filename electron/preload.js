const { contextBridge, ipcRenderer } = require('electron')

// 暴露受保护的方法给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 小说相关 API
  novel: {
    list: () => ipcRenderer.invoke('novel:list'),
    get: (id) => ipcRenderer.invoke('novel:get', id),
    create: (data) => ipcRenderer.invoke('novel:create', data),
    update: (id, data) => ipcRenderer.invoke('novel:update', id, data),
    delete: (id) => ipcRenderer.invoke('novel:delete', id)
  },
  
  // 章节相关 API
  chapter: {
    list: (novelId) => ipcRenderer.invoke('chapter:list', novelId),
    get: (id) => ipcRenderer.invoke('chapter:get', id),
    create: (novelId, data) => ipcRenderer.invoke('chapter:create', novelId, data),
    update: (id, data) => ipcRenderer.invoke('chapter:update', id, data),
    updateContent: (id, content) => ipcRenderer.invoke('chapter:updateContent', id, content),
    delete: (id) => ipcRenderer.invoke('chapter:delete', id),
    deleteAll: (novelId) => ipcRenderer.invoke('chapter:deleteAll', novelId)
  },
  
  // 设置相关 API
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value, description) => ipcRenderer.invoke('settings:set', key, value, description),
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    delete: (key) => ipcRenderer.invoke('settings:delete', key)
  },
  
  // 大纲相关 API
  outline: {
    list: (novelId) => ipcRenderer.invoke('outline:list', novelId),
    get: (id) => ipcRenderer.invoke('outline:get', id),
    create: (novelId, data) => ipcRenderer.invoke('outline:create', novelId, data),
    update: (id, data) => ipcRenderer.invoke('outline:update', id, data),
    delete: (id) => ipcRenderer.invoke('outline:delete', id),
    generate: (data) => ipcRenderer.invoke('outline:generate', data)
  },

  // 世界观/规则相关 API
  worldview: {
    get: (novelId) => ipcRenderer.invoke('worldview:get', novelId),
    save: (novelId, data) => ipcRenderer.invoke('worldview:save', novelId, data)
  },
  
  // StoryEngine 记忆相关 API

  memory: {
    get: (novelId) => ipcRenderer.invoke('memory:get', novelId)
  },
  
  // StoryEngine 处理相关 API
  storyEngine: {
    run: (novelId) => ipcRenderer.invoke('storyEngine:run', novelId),
    compress: (chapter, novelId) => ipcRenderer.invoke('storyEngine:compress', chapter, novelId)
  },
  
  // LLM 相关 API（在主进程统一封装）
  llm: {
    chat: (options) => ipcRenderer.invoke('llm:chat', options),
    embed: (options) => ipcRenderer.invoke('llm:embed', options)
  },
  
  // 保留旧的数据库操作 API（向后兼容）

  db: {
    query: (sql, params) => ipcRenderer.invoke('db-query', sql, params),
    execute: (sql, params) => ipcRenderer.invoke('db-execute', sql, params),
    getAll: (sql, params) => ipcRenderer.invoke('db-getAll', sql, params),
    get: (sql, params) => ipcRenderer.invoke('db-get', sql, params)
  }
})
