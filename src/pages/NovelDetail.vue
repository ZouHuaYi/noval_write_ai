<template>
  <div class="h-full p-6 overflow-auto app-shell">
    <div v-if="loading" class="flex justify-center items-center h-full">
      <el-icon class="is-loading text-4xl"><Loading /></el-icon>
    </div>

    <div v-else-if="novel" class="max-w-4xl mx-auto">
      <div class="mb-6 flex items-center justify-between">
        <el-button @click="$router.back()">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <div class="flex items-center space-x-2">
          <el-button type="primary" @click="goToWorkbench">
            进入工作台
          </el-button>
          <el-button :disabled="chapters.length === 0" @click="readFirstChapter">
            开始阅读
          </el-button>
        </div>
      </div>

      <div class="app-card p-6 mb-6">
        <div class="flex gap-6">
          <img
            v-if="novel.cover"
            :src="novel.cover"
            alt="封面"
            class="w-32 h-48 object-cover rounded"
          />
          <div class="flex-1">
            <h1 class="text-3xl font-semibold mb-2">{{ novel?.title }}</h1>
            <p class="app-muted">{{ novel?.description || '暂无描述' }}</p>
            <div class="mt-4 flex flex-wrap items-center gap-3">
              <el-tag size="small" effect="plain">共 {{ chapters.length }} 章</el-tag>
              <el-tag size="small" effect="plain">总字数 {{ totalWords }}</el-tag>
              <el-tag size="small" effect="plain">已完成 {{ completedChapters }} 章</el-tag>
              <div class="flex items-center gap-2">
                <span class="text-xs app-muted">进度</span>
                <el-progress
                  :percentage="completionRate"
                  :stroke-width="6"
                  :show-text="false"
                  class="w-28"
                />
              </div>
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
              <el-tag size="small" type="info" effect="plain">草稿 {{ draftChapters }}</el-tag>
              <el-tag size="small" type="warning" effect="plain">写作中 {{ writingChapters }}</el-tag>
              <el-tag size="small" type="success" effect="plain">已完成 {{ completedChapters }}</el-tag>
            </div>
          </div>
        </div>
      </div>

      <div class="app-card p-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold">章节目录</h2>
          <div class="text-sm app-muted">最近更新：{{ lastUpdatedAt }}</div>
        </div>

        <el-collapse v-model="activeGroups">
          <el-collapse-item name="writing">
            <template #title>
              <span class="font-semibold">写作中（{{ writingChaptersList.length }}）</span>
            </template>
            <el-table
              :data="writingChaptersList"
              style="width: 100%"
              size="small"
              empty-text="暂无写作中章节"
            >
              <el-table-column prop="chapterNumber" label="序号" width="80" />
              <el-table-column prop="title" label="标题" />
              <el-table-column label="状态" width="120">
                <template #default="{ row }">
                  <el-tag size="small" :type="getStatusType(row.status)" effect="plain">
                    {{ getStatusText(row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="wordCount" label="字数" width="100" />
              <el-table-column label="操作" width="150">
                <template #default="{ row }">
                  <el-button link type="primary" @click="readChapter(row.id)">阅读</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-collapse-item>
          <el-collapse-item name="draft">
            <template #title>
              <span class="font-semibold">草稿（{{ draftChaptersList.length }}）</span>
            </template>
            <el-table
              :data="draftChaptersList"
              style="width: 100%"
              size="small"
              empty-text="暂无草稿章节"
            >
              <el-table-column prop="chapterNumber" label="序号" width="80" />
              <el-table-column prop="title" label="标题" />
              <el-table-column label="状态" width="120">
                <template #default="{ row }">
                  <el-tag size="small" :type="getStatusType(row.status)" effect="plain">
                    {{ getStatusText(row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="wordCount" label="字数" width="100" />
              <el-table-column label="操作" width="150">
                <template #default="{ row }">
                  <el-button link type="primary" @click="readChapter(row.id)">阅读</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-collapse-item>
          <el-collapse-item name="completed">
            <template #title>
              <span class="font-semibold">已完成（{{ completedChaptersList.length }}）</span>
            </template>
            <el-table
              :data="completedChaptersList"
              style="width: 100%"
              size="small"
              empty-text="暂无已完成章节"
            >
              <el-table-column prop="chapterNumber" label="序号" width="80" />
              <el-table-column prop="title" label="标题" />
              <el-table-column label="状态" width="120">
                <template #default="{ row }">
                  <el-tag size="small" :type="getStatusType(row.status)" effect="plain">
                    {{ getStatusText(row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="wordCount" label="字数" width="100" />
              <el-table-column label="操作" width="150">
                <template #default="{ row }">
                  <el-button link type="primary" @click="readChapter(row.id)">阅读</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>

  </div>
</template>


<script setup lang="ts">

import { useNovelStore } from '@/stores/novel'
import { ArrowLeft, Loading } from '@element-plus/icons-vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const novelStore = useNovelStore()

const loading = ref(true)
const novel = ref(null)
const chapters = ref([])
const chapterForm = ref({
  title: '',
  chapterNumber: 1,
  content: ''
})

const novelId = computed(() => route.params.id)
const totalWords = computed(() => {
  return chapters.value.reduce((total, chapter) => total + (chapter.wordCount || 0), 0)
})
const completedChaptersList = computed(() => {
  return chapters.value.filter((chapter) => chapter.status === 'completed')
})
const writingChaptersList = computed(() => {
  return chapters.value.filter((chapter) => chapter.status === 'writing')
})
const draftChaptersList = computed(() => {
  return chapters.value.filter((chapter) => !chapter.status || chapter.status === 'draft')
})
const completedChapters = computed(() => completedChaptersList.value.length)
const writingChapters = computed(() => writingChaptersList.value.length)
const draftChapters = computed(() => draftChaptersList.value.length)
const completionRate = computed(() => {
  if (!chapters.value.length) return 0
  return Math.round((completedChapters.value / chapters.value.length) * 100)
})
const lastUpdatedAt = computed(() => {
  if (!chapters.value.length) return '暂无'
  const latest = chapters.value.reduce((max, chapter) => {
    const timestamp = chapter.updatedAt || chapter.createdAt || 0
    return timestamp > max ? timestamp : max
  }, 0)
  if (!latest) return '暂无'
  return new Date(latest).toLocaleDateString('zh-CN')
})

const activeGroups = ref(['writing', 'draft'])

const getStatusText = (status?: string) => {
  if (status === 'completed') return '已完成'
  if (status === 'writing') return '写作中'
  return '草稿'
}

const getStatusType = (status?: string) => {
  if (status === 'completed') return 'success'
  if (status === 'writing') return 'warning'
  return 'info'
}


onMounted(async () => {
  await loadData()
})

const loadData = async () => {
  loading.value = true
  try {
    novel.value = await novelStore.fetchNovelById(novelId.value)
    chapters.value = await novelStore.fetchChapters(novelId.value)
  } finally {
    loading.value = false
  }
}

const readChapter = (chapterId) => {
  router.push(`/reader/${novelId.value}/${chapterId}`)
}

const readFirstChapter = () => {
  if (chapters.value.length === 0) return
  readChapter(chapters.value[0].id)
}

const goToWorkbench = () => {
  router.push(`/workbench/${novelId.value}`)
}



</script>
