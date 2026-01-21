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
    getByNumber: (novelId, chapterNumber) => ipcRenderer.invoke('chapter:getByNumber', novelId, chapterNumber),
    create: (novelId, data) => ipcRenderer.invoke('chapter:create', novelId, data),
    update: (id, data) => ipcRenderer.invoke('chapter:update', id, data),
    updateContent: (id, content) => ipcRenderer.invoke('chapter:updateContent', id, content),
    delete: (id) => ipcRenderer.invoke('chapter:delete', id),
    deleteAll: (novelId) => ipcRenderer.invoke('chapter:deleteAll', novelId),
    snapshotList: (chapterId) => ipcRenderer.invoke('chapter:snapshot:list', chapterId),
    snapshotRestore: (snapshotId) => ipcRenderer.invoke('chapter:snapshot:restore', snapshotId),
    generateChunks: (payload) => ipcRenderer.invoke('chapter:generateChunks', payload),
    generateStatus: (chapterId) => ipcRenderer.invoke('chapter:generateStatus', chapterId),
    generateReset: (chapterId) => ipcRenderer.invoke('chapter:generateReset', chapterId),
    checkConsistencyDiff: (novelId, chapterId, content, extraPrompt) =>
      ipcRenderer.invoke('chapter:checkConsistencyDiff', novelId, chapterId, content, extraPrompt),
    validateParagraph: (options) => ipcRenderer.invoke('chapter:validateParagraph', options)
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
  },

  // Planning Agent API（事件图谱 + 看板 + 智能分配）
  planning: {
    // ===== Outline Agent =====
    // 生成事件图谱
    generateEventGraph: (options) => ipcRenderer.invoke('outline:generateEventGraph', options),

    // ===== Context Building =====
    buildContext: (novelId, chapterId) => ipcRenderer.invoke('planning:buildContext', { novelId, chapterId }),

    // ===== Planning Agent =====
    // 生成章节计划
    generatePlan: (options) => ipcRenderer.invoke('planning:generatePlan', options),
    // 创建看板
    createKanban: (chapters) => ipcRenderer.invoke('planning:createKanban', chapters),
    // 推荐下一个任务
    recommendTask: (options) => ipcRenderer.invoke('planning:recommendTask', options),

    // ===== 规划元数据与章节 =====
    getChapterPlan: (novelId, chapterNumber) => ipcRenderer.invoke('planning:getChapterPlan', novelId, chapterNumber),
    updateChapterStatus: (novelId, chapterNumber, status, extra) => ipcRenderer.invoke('planning:updateChapterStatus', novelId, chapterNumber, status, extra),
    getMeta: (novelId) => ipcRenderer.invoke('planning:getMeta', novelId),
    updateMeta: (novelId, meta) => ipcRenderer.invoke('planning:updateMeta', novelId, meta),
    ensureChapter: (novelId, data) => ipcRenderer.invoke('planning:ensureChapter', novelId, data),
    updateChapter: (novelId, chapterNumber, patch) => ipcRenderer.invoke('planning:updateChapter', novelId, chapterNumber, patch),
    updateChapterNumber: (novelId, fromChapter, toChapter) => ipcRenderer.invoke('planning:updateChapterNumber', novelId, fromChapter, toChapter),

    // ===== 数据持久化 =====
    // 保存规划数据
    saveData: (novelId, data) => ipcRenderer.invoke('planning:saveData', novelId, data),
    // 加载规划数据
    loadData: (novelId) => ipcRenderer.invoke('planning:loadData', novelId),
    // 清除规划数据
    clearData: (novelId) => ipcRenderer.invoke('planning:clearData', novelId),
    // 导出数据
    export: (options) => ipcRenderer.invoke('planning:export', options)
  },

  // 知识图谱 API
  graph: {
    // 图谱管理
    getStats: (novelId) => ipcRenderer.invoke('graph:getStats', novelId),
    exportForVisualization: (novelId) => ipcRenderer.invoke('graph:exportForVisualization', novelId),
    getCharacterNetwork: (novelId) => ipcRenderer.invoke('graph:getCharacterNetwork', novelId),
    save: (novelId) => ipcRenderer.invoke('graph:save', novelId),
    load: (novelId) => ipcRenderer.invoke('graph:load', novelId),
    delete: (novelId) => ipcRenderer.invoke('graph:delete', novelId),
    clear: (novelId) => ipcRenderer.invoke('graph:clear', novelId),
    exportJSON: (novelId) => ipcRenderer.invoke('graph:exportJSON', novelId),

    // 节点操作
    getAllNodes: (novelId, type) => ipcRenderer.invoke('graph:getAllNodes', novelId, type),
    getNode: (novelId, nodeId) => ipcRenderer.invoke('graph:getNode', novelId, nodeId),
    addNode: (novelId, id, attributes) => ipcRenderer.invoke('graph:addNode', novelId, id, attributes),
    updateNode: (novelId, id, attributes) => ipcRenderer.invoke('graph:updateNode', novelId, id, attributes),
    removeNode: (novelId, id) => ipcRenderer.invoke('graph:removeNode', novelId, id),

    // 边操作
    addEdge: (novelId, source, target, attributes) => ipcRenderer.invoke('graph:addEdge', novelId, source, target, attributes),
    getNodeEdges: (novelId, nodeId, direction) => ipcRenderer.invoke('graph:getNodeEdges', novelId, nodeId, direction),
    removeEdge: (novelId, edgeId) => ipcRenderer.invoke('graph:removeEdge', novelId, edgeId),

    // 查询操作
    findNeighbors: (novelId, nodeId, depth) => ipcRenderer.invoke('graph:findNeighbors', novelId, nodeId, depth),
    findPath: (novelId, source, target) => ipcRenderer.invoke('graph:findPath', novelId, source, target),
    searchEntities: (novelId, query, type) => ipcRenderer.invoke('graph:searchEntities', novelId, query, type),

    // 一致性检查
    checkConsistency: (novelId) => ipcRenderer.invoke('graph:checkConsistency', novelId),
    validateContent: (novelId, content, chapter) => ipcRenderer.invoke('graph:validateContent', novelId, content, chapter),

    // 自动关系提取
    analyzeChapter: (novelId, chapter, content, previousContent, contentHash) =>
      ipcRenderer.invoke('graph:analyzeChapter', novelId, chapter, content, previousContent, contentHash),

    // 删除章节相关图谱数据
    cleanupChapter: (novelId, chapterNumber) => ipcRenderer.invoke('graph:cleanupChapter', novelId, chapterNumber),

    // 批量操作
    importEntities: (novelId, entities) => ipcRenderer.invoke('graph:importEntities', novelId, entities),
    addRelations: (novelId, relations) => ipcRenderer.invoke('graph:addRelations', novelId, relations)
  },

  // 窗口控制 API
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
  }

})
