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
        getByNumber: (novelId: string, chapterNumber: number) => Promise<any>
        create: (novelId: string, data?: { title?: string; content?: string; status?: string; chapterNumber?: number }) => Promise<any>
        update: (id: string, data: Partial<{ title: string; content: string; status: string; idx: number; chapterNumber: number }>) => Promise<any>
        updateContent: (id: string, content: string, chapterNumber?: number) => Promise<any>
        delete: (id: string) => Promise<{ success: boolean }>
        deleteAll: (novelId: string) => Promise<{ success: boolean; deletedCount: number }>
        snapshotList: (chapterId: string) => Promise<any[]>
        snapshotRestore: (snapshotId: string) => Promise<any>
        generateChunks: (payload: {
          novelId: string
          chapterId: string
          novelTitle?: string
          chunkSize?: number
          maxChunks?: number
          extraPrompt?: string
          systemPrompt: string
        }) => Promise<{
          chapter: any
          status: string
          currentChunk?: number
          totalChunks?: number
          planCompletionSuggested?: boolean
          contextSummary?: {
            outlineContext?: string
            memoryContext?: string
            knowledgeContext?: string
            planningContext?: string
          }
        }>
        generateStatus: (chapterId: string) => Promise<any>
        generateReset: (chapterId: string) => Promise<{ success: boolean }>
        checkConsistencyDiff: (
          novelId: string,
          chapterId: string,
          content: string,
          extraPrompt?: string
        ) => Promise<{
          summary: string
          suggestions: Array<{
            id: string
            category: string
            issue: string
            originalText: string
            suggestedText: string
            reason: string
          }>
        }>
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
        generate: (data: { systemPrompt: string; userPrompt: string }) => Promise<string>
      }

      // 世界观/规则相关 API
      worldview: {
        get: (novelId: string) => Promise<any>
        save: (novelId: string, data: { worldview: string; rules: string }) => Promise<any>
      }

      // StoryEngine 记忆相关 API
      memory: {
        get: (novelId: string) => Promise<{
          entities: any[]
          events: any[]
          dependencies: any[]
        }>
      }

      // 知识库相关 API
      knowledge: {
        list: (novelId: string, type?: string, reviewStatus?: string) => Promise<any[]>
        search: (novelId: string, keyword: string, reviewStatus?: string) => Promise<any[]>
        create: (novelId: string, data: {
          type: string
          name: string
          summary?: string
          detail?: string
          aliases?: string[]
          tags?: string[]
          reviewStatus?: string
          reviewedAt?: number
          sourceChapter?: number
          sourceEventId?: string
          sourceEntityId?: string
          sourceType?: string
        }) => Promise<any>
        update: (id: string, data: Partial<{
          type: string
          name: string
          summary: string
          detail: string
          aliases: string[]
          tags: string[]
          reviewStatus: string
          reviewedAt: number
          sourceChapter: number
          sourceEventId: string
          sourceEntityId: string
          sourceType: string
        }>) => Promise<any>
        delete: (id: string) => Promise<{ success: boolean }>
        upsert: (novelId: string, data: {
          type: string
          name: string
          summary?: string
          detail?: string
          aliases?: string[]
          tags?: string[]
          reviewStatus?: string
          reviewedAt?: number
          sourceChapter?: number
          sourceEventId?: string
          sourceEntityId?: string
          sourceType?: string
        }) => Promise<any>
        syncFromMemory: (novelId: string) => Promise<{ total: number }>
        reviewList: (novelId: string, reviewStatus?: string) => Promise<any[]>
        reviewUpdate: (id: string, reviewStatus: string) => Promise<any>
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

      // ReIO 检查相关 API
      reio: {
        check: (options: {
          generatedText: string
          eventGoal?: string
          memoryContext?: string
          worldviewContext?: string
          activeCharacters?: string[]
          worldRules?: string[]
          novelId?: string
        }) => Promise<{
          passed: boolean
          score?: number
          deviatesFromGoal?: boolean
          hasLogicConflict?: boolean
          hasCharacterInconsistency?: boolean
          hasWorldRuleViolation?: boolean
          issues: string[]
          rewriteSuggestion?: string
          highlights?: string[]
        }>
        quickCheck: (text: string, constraints: string[]) => Promise<{
          passed: boolean
          reason?: string
          error?: string
        }>
        rewrite: (options: {
          originalText: string
          issues: string[]
          suggestion?: string
          eventGoal?: string
          memoryContext?: string
          systemPrompt?: string
        }) => Promise<string>
        getStats: () => Promise<{
          totalChecks: number
          passedChecks: number
          failedChecks: number
          totalRewrites: number
          lastCheckTime: number | null
          lastCheckResult: any
        } | null>
        resetStats: () => Promise<boolean>
        generateWithCheck: (options: {
          messages: Array<{ role: string; content: string }>
          eventGoal?: string
          memoryContext?: string
          activeCharacters?: string[]
          worldRules?: string[]
          systemPrompt?: string
          novelId?: string
          maxRetries?: number
          temperature?: number
        }) => Promise<{
          content: string
          checkResult: any
          rewriteCount: number
          checkHistory?: any[]
          stats?: any
        }>
        extractCharacters: (memoryContext: string) => Promise<string[]>
        extractWorldRules: (novelId: string) => Promise<string[]>
      }

      // Planning Agent API
      planning: {
        // ===== Outline Agent =====
        // 生成事件图谱
        generateEventGraph: (options) => Promise<any>
        // 从章节提取事件
        extractEvents: (options) => Promise<any>
        // 分析事件依赖
        analyzeDependencies: (events) => Promise<any>
        // 扩展事件节点
        expandEvent: (event, context) => Promise<any>
        // 验证事件图谱
        validateGraph: (events) => Promise<any>

        // ===== Context Building =====
        buildContext: (novelId: string, chapterId: string) => Promise<any>

        // ===== Planning Agent =====
        // 生成章节计划
        generatePlan: (options) => Promise<any>
        // 创建看板
        createKanban: (chapters) => Promise<any>
        recommendTask: (options: { novelId: string; events?: any[]; chapters?: any[]; progress?: any }) => Promise<any>
        // 估算写作时间
        estimateTime: (chapter, wordsPerHour) => Promise<any>
        // 生成写作日程
        generateSchedule: (chapters, options) => Promise<any>

        // ===== 规划元数据与章节 =====
        getChapterPlan: (novelId: string, chapterNumber: number) => Promise<any>
        updateChapterStatus: (novelId: string, chapterNumber: number, status: string, extra?: { lockWritingTarget?: boolean }) => Promise<any>
        getMeta: (novelId: string) => Promise<any>
        updateMeta: (novelId: string, meta: any) => Promise<any>
        ensureChapter: (novelId: string, data: { chapterNumber: number }) => Promise<any>
        updateChapter: (novelId: string, chapterNumber: number, patch: { title?: string }) => Promise<any>
        updateChapterNumber: (novelId: string, fromChapter: number, toChapter: number) => Promise<{ success: boolean; chapter: number }>

        // ===== 数据持久化 =====
        // 保存规划数据
        saveData: (novelId: string, data: any) => Promise<any>
        // 加载规划数据
        loadData: (novelId: string) => Promise<any>
        // 清除规划数据
        clearData: (novelId: string) => Promise<any>
        // 导出数据
        export: (options: { title: string; content: string; type: string }) => Promise<{ success: boolean; filePath?: string }>
      }


      // 知识图谱 API
      graph: {
        // 图谱管理
        getStats: (novelId: string) => Promise<{
          nodeCount: number
          edgeCount: number
          nodeTypes: Record<string, number>
          edgeTypes: Record<string, number>
          density: number
        }>
        exportForVisualization: (novelId: string) => Promise<{
          nodes: any[]
          edges: any[]
        }>
        getCharacterNetwork: (novelId: string) => Promise<{
          nodes: any[]
          edges: any[]
        }>
        save: (novelId: string) => Promise<boolean>;
        load: (novelId: string) => Promise<{ success: boolean }>;
        delete: (novelId: string) => Promise<boolean>;
        clear: (novelId: string) => Promise<boolean>;
        exportJSON: (novelId: string) => Promise<any>;

        // 节点操作
        getAllNodes: (novelId: string, type?: string) => Promise<any[]>
        getNode: (novelId: string, nodeId: string) => Promise<any | null>
        addNode: (novelId: string, id: string, attributes: {
          type?: string
          label?: string
          description?: string
          aliases?: string[]
          properties?: Record<string, any>
        }) => Promise<boolean>
        updateNode: (novelId: string, id: string, attributes: any) => Promise<boolean>
        removeNode: (novelId: string, id: string) => Promise<boolean>

        // 边操作
        addEdge: (novelId: string, source: string, target: string, attributes?: {
          type?: string
          label?: string
          chapter?: number
          bidirectional?: boolean
        }) => Promise<string | null>
        getNodeEdges: (novelId: string, nodeId: string, direction?: 'in' | 'out' | 'all') => Promise<any[]>
        removeEdge: (novelId: string, edgeId: string) => Promise<boolean>

        // 查询操作
        findNeighbors: (novelId: string, nodeId: string, depth?: number) => Promise<any[]>
        findPath: (novelId: string, source: string, target: string) => Promise<any[] | null>
        searchEntities: (novelId: string, query: string, type?: string) => Promise<any[]>

        // 一致性检查
        checkConsistency: (novelId: string) => Promise<{
          conflicts: any[]
          warnings: any[]
          suggestions: any[]
          stats: { totalChecks: number; conflictsFound: number; warningsFound: number }
        }>
        validateContent: (novelId: string, content: string, chapter: number) => Promise<{
          valid: boolean
          issues: any[]
        }>

        // 自动关系提取
        analyzeChapter: (novelId: string, chapter: number, content: string, previousContent?: string | null, contentHash?: string | null) => Promise<{
          entities: any[]
          relations: any[]
          stateChanges: any[]
          graphUpdates: any
          conflicts: any[]
          skipped?: boolean
          reason?: string
        }>

        // 删除章节相关图谱数据
        cleanupChapter: (novelId: string, chapterNumber: number) => Promise<{
          nodesRemoved: number
          edgesRemoved: number
        }>

        // 批量操作
        importEntities: (novelId: string, entities: any[]) => Promise<{ added: number }>
        addRelations: (novelId: string, relations: any[]) => Promise<{ added: number }>
      }

    }
  }
}

export { }
