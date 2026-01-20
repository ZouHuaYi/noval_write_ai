import { defineStore } from 'pinia'
import { ElMessage } from 'element-plus'

export const useNovelStore = defineStore('novel', {
  state: () => ({
    novels: [] as any[],
    currentNovel: null,
    loading: false
  }),

  actions: {
    // 获取所有小说
    async fetchNovels() {
      this.loading = true
      try {
        if (window.electronAPI?.novel) {
          this.novels = await window.electronAPI.novel.list()
        } else {
          ElMessage.warning('Electron API 未加载')
          this.novels = []
        }
      } catch (error) {
        console.error('获取小说列表失败:', error)
        ElMessage.error('获取小说列表失败')
        this.novels = []
      } finally {
        this.loading = false
      }
    },

    // 获取小说详情
    async fetchNovelById(id: string) {
      try {
        if (window.electronAPI?.novel) {
          this.currentNovel = await window.electronAPI.novel.get(id)
          return this.currentNovel
        } else {
          ElMessage.warning('Electron API 未加载')
          return null
        }
      } catch (error) {
        console.error('获取小说详情失败:', error)
        ElMessage.error('获取小说详情失败')
        return null
      }
    },

    // 添加小说
    async addNovel(novelData: { title: string; genre?: string; author?: string; description?: string }) {
      try {
        if (window.electronAPI?.novel) {
          const novel = await window.electronAPI.novel.create({
            title: novelData.title,
            genre: novelData.genre || novelData.author || undefined,
            description: novelData.description || undefined
          })

          await this.fetchNovels()
          return novel?.id || null
        } else {
          ElMessage.error('Electron API 未加载')
          return null
        }
      } catch (error) {
        console.error('添加小说失败:', error)
        ElMessage.error('添加小说失败')
        return null
      }
    },

    // 更新小说
    async updateNovel(id: string, novelData: { title: string; genre?: string; author?: string; description?: string }) {
      try {
        if (window.electronAPI?.novel) {
          await window.electronAPI.novel.update(id, {
            title: novelData.title,
            genre: novelData.genre || novelData.author || undefined,
            description: novelData.description || undefined
          })

          await this.fetchNovels()
          return true
        } else {
          ElMessage.error('Electron API 未加载')
          return false
        }
      } catch (error) {
        console.error('更新小说失败:', error)
        ElMessage.error('更新小说失败')
        return false
      }
    },

    // 删除小说
    async deleteNovel(id: string) {
      try {
        if (window.electronAPI?.novel) {
          await window.electronAPI.novel.delete(id)
          await this.fetchNovels()
          return true
        } else {
          ElMessage.error('Electron API 未加载')
          return false
        }
      } catch (error) {
        console.error('删除小说失败:', error)
        ElMessage.error('删除小说失败')
        return false
      }
    },

    // 获取章节列表
    async fetchChapters(novelId: string) {
      try {
        if (window.electronAPI?.chapter) {
          return await window.electronAPI.chapter.list(novelId)
        } else {
          ElMessage.warning('Electron API 未加载')
          return []
        }
      } catch (error) {
        console.error('获取章节列表失败:', error)
        return []
      }
    },

    // 添加章节
    async addChapter(novelId: string, chapterData: { title: string; content?: string; status?: string }) {
      try {
        if (window.electronAPI?.chapter) {
          const chapter = await window.electronAPI.chapter.create(novelId, {
            title: chapterData.title,
            content: chapterData.content || '',
            status: chapterData.status || 'draft'
          })

          return chapter?.id || null
        } else {
          ElMessage.error('Electron API 未加载')
          return null
        }
      } catch (error) {
        console.error('添加章节失败:', error)
        ElMessage.error('添加章节失败')
        return null
      }
    },

    // 获取章节内容
    async fetchChapter(chapterId: string) {
      try {
        if (window.electronAPI?.chapter) {
          return await window.electronAPI.chapter.get(chapterId)
        } else {
          ElMessage.warning('Electron API 未加载')
          return null
        }
      } catch (error) {
        console.error('获取章节失败:', error)
        return null
      }
    }
  }
})
