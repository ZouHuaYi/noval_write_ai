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
    deleteAll: (novelId) => ipcRenderer.invoke('chapter:deleteAll', novelId),
    snapshotList: (chapterId) => ipcRenderer.invoke('chapter:snapshot:list', chapterId),
    snapshotRestore: (snapshotId) => ipcRenderer.invoke('chapter:snapshot:restore', snapshotId),
    generateChunks: (payload) => ipcRenderer.invoke('chapter:generateChunks', payload),
    generateStatus: (chapterId) => ipcRenderer.invoke('chapter:generateStatus', chapterId),
    generateReset: (chapterId) => ipcRenderer.invoke('chapter:generateReset', chapterId)
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

  // 知识库相关 API
  knowledge: {
    list: (novelId, type, reviewStatus) => ipcRenderer.invoke('knowledge:list', novelId, type, reviewStatus),
    search: (novelId, keyword, reviewStatus) => ipcRenderer.invoke('knowledge:search', novelId, keyword, reviewStatus),
    create: (novelId, data) => ipcRenderer.invoke('knowledge:create', novelId, data),
    update: (id, data) => ipcRenderer.invoke('knowledge:update', id, data),
    delete: (id) => ipcRenderer.invoke('knowledge:delete', id),
    upsert: (novelId, data) => ipcRenderer.invoke('knowledge:upsert', novelId, data),
    syncFromMemory: (novelId) => ipcRenderer.invoke('knowledge:syncFromMemory', novelId),
    reviewList: (novelId, reviewStatus) => ipcRenderer.invoke('knowledge:review:list', novelId, reviewStatus),
    reviewUpdate: (id, reviewStatus) => ipcRenderer.invoke('knowledge:review:update', id, reviewStatus)
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

  // ReIO 检查相关 API（写作流程闭环核心）
  reio: {
    // 检查生成内容是否符合要求
    check: (options) => ipcRenderer.invoke('reio:check', options),
    // 快速一致性检查
    quickCheck: (text, constraints) => ipcRenderer.invoke('reio:quickCheck', text, constraints),
    // 请求重写内容
    rewrite: (options) => ipcRenderer.invoke('reio:rewrite', options),
    // 获取 ReIO 统计信息
    getStats: () => ipcRenderer.invoke('reio:stats'),
    // 重置统计
    resetStats: () => ipcRenderer.invoke('reio:resetStats'),
    // 完整的 ReIO 生成流程（生成 + 检查 + 重写）
    generateWithCheck: (options) => ipcRenderer.invoke('reio:generateWithCheck', options),
    // 从记忆上下文提取活跃角色
    extractCharacters: (memoryContext) => ipcRenderer.invoke('reio:extractCharacters', memoryContext),
    // 从世界观提取规则
    extractWorldRules: (novelId) => ipcRenderer.invoke('reio:extractWorldRules', novelId)
  }

})

