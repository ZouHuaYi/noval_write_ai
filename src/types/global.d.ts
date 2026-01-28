/// <reference types="vite/client" />

declare global {
  interface Window {
    electronAPI: {
      novel: {
        list: () => Promise<any[]>
        get: (id: string) => Promise<any>
        create: (data: { title: string; genre?: string; description?: string }) => Promise<any>
        update: (id: string, data: Partial<{ title: string; genre: string; description: string }>) => Promise<any>
        delete: (id: string) => Promise<{ success: boolean }>
        export: (id: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean }>
      }

      chapter: {
        list: (novelId: string) => Promise<any[]>
        get: (id: string) => Promise<any>
        getByNumber: (novelId: string, chapterNumber: number) => Promise<any>
        create: (novelId: string, data?: { title?: string; content?: string; status?: string; chapterNumber?: number }) => Promise<any>
        update: (id: string, data: Partial<{ title: string; content: string; status: string; idx: number; chapterNumber: number }>) => Promise<any>
        delete: (id: string) => Promise<{ success: boolean }>
        deleteAll: (novelId: string) => Promise<{ success: boolean; deletedCount: number }>
        generateChunks: (payload: {
          novelId: string
          chapterId: string
          novelTitle?: string
          chunkSize?: number
          maxChunks?: number
          extraPrompt?: string
          systemPrompt: string
          targetWords?: number
          modelSource?: 'pipeline' | 'workbench'
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

      settings: {
        get: (key: string) => Promise<any>
        set: (key: string, value: any, description?: string) => Promise<string>
      }

      worldview: {
        get: (novelId: string) => Promise<any>
        save: (novelId: string, data: { worldview: string; rules: string }) => Promise<any>
      }

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
      }

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
        getStats: () => Promise<{
          totalChecks: number
          passedChecks: number
          failedChecks: number
          totalRewrites: number
          lastCheckTime: number | null
          lastCheckResult: any
        } | null>
      }

      planning: {
        generateEventGraph: (options: any) => Promise<any>
        buildContext: (novelId: string, chapterId: string) => Promise<any>
        generatePlan: (options: any) => Promise<any>
        createKanban: (chapters: any[]) => Promise<any>

        getChapterPlan: (novelId: string, chapterNumber: number) => Promise<any>
        updateChapterStatus: (novelId: string, chapterNumber: number, status: string, extra?: { lockWritingTarget?: boolean }) => Promise<any>
        getMeta: (novelId: string) => Promise<any>
        updateMeta: (novelId: string, meta: any) => Promise<any>
        ensureChapter: (novelId: string, data: { chapterNumber: number }) => Promise<any>
        updateChapter: (novelId: string, chapterNumber: number, patch: { title?: string }) => Promise<any>
        updateChapterNumber: (novelId: string, fromChapter: number, toChapter: number) => Promise<{ success: boolean; chapter: number }>

        saveData: (novelId: string, data: any) => Promise<any>
        loadData: (novelId: string) => Promise<any>
        clearData: (novelId: string) => Promise<any>
        export: (options: { title: string; content: string; type: string }) => Promise<{ success: boolean; filePath?: string }>
      }

      pipeline: {
        start: (options: {
          novelId: string
          inputWorldview?: string
          inputRules?: string
          inputOutline?: string
          settings?: Record<string, any>
        }) => Promise<any>
        pause: (runId: string) => Promise<any>
        resume: (runId: string) => Promise<any>
        status: (runId: string) => Promise<{ run: any; steps: any[] } | null>
        retryStep: (options: { runId: string; stage: string; batchIndex?: number | null }) => Promise<any>
        updateSettings: (options: { runId: string; settings: Record<string, any> }) => Promise<any>
        listByNovel: (novelId: string) => Promise<any[]>
        listByStatus: (status: string) => Promise<any[]>
        clear: (novelId: string) => Promise<{ success: boolean }>
      }

      graph: {
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
        save: (novelId: string) => Promise<boolean>
        delete: (novelId: string) => Promise<boolean>
        clear: (novelId: string) => Promise<boolean>
        addNode: (novelId: string, id: string, attributes: {
          type?: string
          label?: string
          description?: string
          aliases?: string[]
          properties?: Record<string, any>
        }) => Promise<boolean>
        getNodeEdges: (novelId: string, nodeId: string, direction?: 'in' | 'out' | 'all') => Promise<any[]>
        searchEntities: (novelId: string, query: string, type?: string) => Promise<any[]>
        checkConsistency: (novelId: string) => Promise<{
          conflicts: any[]
          warnings: any[]
          suggestions: any[]
          stats: { totalChecks: number; conflictsFound: number; warningsFound: number }
        }>
        analyzeChapter: (
          novelId: string,
          chapter: number,
          content: string,
          previousContent?: string | null,
          contentHash?: string | null,
          options?: { force?: boolean }
        ) => Promise<{
          entities: any[]
          relations: any[]
          stateChanges: any[]
          graphUpdates: any
          conflicts: any[]
          skipped?: boolean
          reason?: string
        }>
      }

      knowledge?: {
        list: (novelId: string, type?: string, reviewStatus?: string) => Promise<any[]>
      }

      window: {
        minimize: () => void
        maximize: () => void
        close: () => void
      }
    }
  }
}

export { }
