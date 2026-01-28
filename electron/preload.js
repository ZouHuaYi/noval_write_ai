const { contextBridge, ipcRenderer } = require('electron')

// 暴露受保护的方法给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  novel: {
    list: () => ipcRenderer.invoke('novel:list'),
    get: (id) => ipcRenderer.invoke('novel:get', id),
    create: (data) => ipcRenderer.invoke('novel:create', data),
    update: (id, data) => ipcRenderer.invoke('novel:update', id, data),
    delete: (id) => ipcRenderer.invoke('novel:delete', id),
    export: (id) => ipcRenderer.invoke('novel:export', id)
  },

  chapter: {
    list: (novelId) => ipcRenderer.invoke('chapter:list', novelId),
    get: (id) => ipcRenderer.invoke('chapter:get', id),
    getByNumber: (novelId, chapterNumber) => ipcRenderer.invoke('chapter:getByNumber', novelId, chapterNumber),
    create: (novelId, data) => ipcRenderer.invoke('chapter:create', novelId, data),
    update: (id, data) => ipcRenderer.invoke('chapter:update', id, data),
    delete: (id) => ipcRenderer.invoke('chapter:delete', id),
    deleteAll: (novelId) => ipcRenderer.invoke('chapter:deleteAll', novelId),
    generateChunks: (payload) => ipcRenderer.invoke('chapter:generateChunks', payload),
    checkConsistencyDiff: (novelId, chapterId, content, extraPrompt) =>
      ipcRenderer.invoke('chapter:checkConsistencyDiff', novelId, chapterId, content, extraPrompt),
  },

  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value, description) => ipcRenderer.invoke('settings:set', key, value, description),
  },

  worldview: {
    get: (novelId) => ipcRenderer.invoke('worldview:get', novelId),
    save: (novelId, data) => ipcRenderer.invoke('worldview:save', novelId, data)
  },

  llm: {
    chat: (options) => ipcRenderer.invoke('llm:chat', options),
  },

  reio: {
    check: (options) => ipcRenderer.invoke('reio:check', options),
    getStats: () => ipcRenderer.invoke('reio:stats'),
  },

  planning: {
    generateEventGraph: (options) => ipcRenderer.invoke('outline:generateEventGraph', options),

    buildContext: (novelId, chapterId) => ipcRenderer.invoke('planning:buildContext', { novelId, chapterId }),

    generatePlan: (options) => ipcRenderer.invoke('planning:generatePlan', options),
    createKanban: (chapters) => ipcRenderer.invoke('planning:createKanban', chapters),

    getChapterPlan: (novelId, chapterNumber) => ipcRenderer.invoke('planning:getChapterPlan', novelId, chapterNumber),
    updateChapterStatus: (novelId, chapterNumber, status, extra) => ipcRenderer.invoke('planning:updateChapterStatus', novelId, chapterNumber, status, extra),
    getMeta: (novelId) => ipcRenderer.invoke('planning:getMeta', novelId),
    updateMeta: (novelId, meta) => ipcRenderer.invoke('planning:updateMeta', novelId, meta),
    ensureChapter: (novelId, data) => ipcRenderer.invoke('planning:ensureChapter', novelId, data),
    updateChapter: (novelId, chapterNumber, patch) => ipcRenderer.invoke('planning:updateChapter', novelId, chapterNumber, patch),
    updateChapterNumber: (novelId, fromChapter, toChapter) => ipcRenderer.invoke('planning:updateChapterNumber', novelId, fromChapter, toChapter),

    saveData: (novelId, data) => ipcRenderer.invoke('planning:saveData', novelId, data),
    loadData: (novelId) => ipcRenderer.invoke('planning:loadData', novelId),
    clearData: (novelId) => ipcRenderer.invoke('planning:clearData', novelId),
    export: (options) => ipcRenderer.invoke('planning:export', options)
  },

  pipeline: {
    start: (options) => ipcRenderer.invoke('pipeline:start', options),
    pause: (runId) => ipcRenderer.invoke('pipeline:pause', runId),
    resume: (runId) => ipcRenderer.invoke('pipeline:resume', runId),
    status: (runId) => ipcRenderer.invoke('pipeline:status', runId),
    retryStep: (options) => ipcRenderer.invoke('pipeline:retryStep', options),
    updateSettings: (options) => ipcRenderer.invoke('pipeline:updateSettings', options),
    listByNovel: (novelId) => ipcRenderer.invoke('pipeline:listByNovel', novelId),
    listByStatus: (status) => ipcRenderer.invoke('pipeline:listByStatus', status),
    clear: (novelId) => ipcRenderer.invoke('pipeline:clear', novelId)
  },

  graph: {
    getStats: (novelId) => ipcRenderer.invoke('graph:getStats', novelId),
    exportForVisualization: (novelId) => ipcRenderer.invoke('graph:exportForVisualization', novelId),
    save: (novelId) => ipcRenderer.invoke('graph:save', novelId),
    delete: (novelId) => ipcRenderer.invoke('graph:delete', novelId),
    clear: (novelId) => ipcRenderer.invoke('graph:clear', novelId),

    addNode: (novelId, id, attributes) => ipcRenderer.invoke('graph:addNode', novelId, id, attributes),

    getNodeEdges: (novelId, nodeId, direction) => ipcRenderer.invoke('graph:getNodeEdges', novelId, nodeId, direction),

    searchEntities: (novelId, query, type) => ipcRenderer.invoke('graph:searchEntities', novelId, query, type),

    checkConsistency: (novelId) => ipcRenderer.invoke('graph:checkConsistency', novelId),

    analyzeChapter: (novelId, chapter, content, previousContent, contentHash) =>
      ipcRenderer.invoke('graph:analyzeChapter', novelId, chapter, content, previousContent, contentHash),

  },

  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
  }

})
