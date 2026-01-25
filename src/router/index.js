import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        name: 'Home',
        component: () => import('@/pages/Home.vue'),
        meta: { title: '小说助手' }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/pages/Settings.vue'),
        meta: { title: '应用设置' }
      },
      {
        path: 'about',
        name: 'About',
        component: () => import('@/pages/About.vue'),
        meta: { title: '关于我们' }
      },
      {
        path: 'workbench/:novelId',
        name: 'Workbench',
        component: () => import('@/pages/Workbench.vue'),
        meta: { title: '写作工作台' }
      },
      {
        path: 'novels',
        name: 'Novels',
        component: () => import('@/pages/NovelList.vue'),
        meta: { title: '小说列表' }
      },
      {
        path: 'novel/:id',
        name: 'NovelDetail',
        component: () => import('@/pages/NovelDetail.vue'),
        meta: { title: '小说详情' }
      },
      {
        path: 'reader/:novelId/:chapterId?',
        name: 'Reader',
        component: () => import('@/pages/Reader.vue'),
        meta: { title: '阅读器' }
      },
      {
        path: 'pipeline',
        name: 'Pipeline',
        component: () => import('@/pages/Pipeline.vue'),
        meta: { title: '流水线生成' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
