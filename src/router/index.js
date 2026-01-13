import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/pages/Home.vue'),
    meta: { title: '小说助手' }
  },
  {
    path: '/workbench/:novelId',
    name: 'Workbench',
    component: () => import('@/pages/Workbench.vue'),
    meta: { title: '写作工作台' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/pages/Settings.vue'),
    meta: { title: '应用设置' }
  },
  {
    path: '/layout',
    name: 'Layout',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/novels',
    children: [
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
      }
    ]
  },
  {
    path: '/novels',
    redirect: '/layout/novels'
  },
  {
    path: '/novel/:id',
    redirect: to => `/layout/novel/${to.params.id}`
  },
  {
    path: '/reader/:novelId/:chapterId?',
    redirect: to => `/layout/reader/${to.params.novelId}${to.params.chapterId ? '/' + to.params.chapterId : ''}`
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
