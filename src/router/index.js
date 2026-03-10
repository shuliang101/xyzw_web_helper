import { createRouter, createWebHistory } from 'vue-router'
import { watch } from 'vue'
import * as autoRoutes from 'vue-router/auto-routes'
import { useTokenStore } from '@/stores/tokenStore'
import { useAuthStore } from '@/stores/auth'
import { isNowInLegionWarTime } from "@/utils/clubBattleUtils"

const generatedRoutes = autoRoutes.routes ?? []

const my_routes = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
    meta: {
      title: '首页',
      requiresToken: false
    }
  },
  {
    path: '/tokens',
    name: 'TokenImport',
    component: () => import('@/views/TokenImport/index.vue'),
    meta: {
      title: 'Token管理',
      requiresToken: false,
      requiresAuth: true
    },
    props: route => ({
      token: route.query.token,
      name: route.query.name,
      server: route.query.server,
      wsUrl: route.query.wsUrl,
      api: route.query.api,
      auto: route.query.auto === 'true'
    })
  },
  {
    name: 'DefaultLayout',
    path: '/admin',
    component: () => import('@/layout/DefaultLayout.vue'),
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: {
          title: '控制台',
          requiresToken: true,
          requiresAuth: true
        }
      },
      {
        path: 'game-features',
        name: 'GameFeatures',
        component: () => import('@/views/GameFeatures.vue'),
        meta: {
          title: '游戏功能',
          requiresToken: true,
          requiresAuth: true
        }
      },
      {
        path: 'message-test',
        name: 'MessageTest',
        component: () => import('@/components/Test/MessageTester.vue'),
        meta: {
          title: '消息测试',
          requiresToken: true,
          requiresAuth: true
        }
      },
      {
        path: 'legion-war',
        name: 'LegionWar',
        component: () => import('@/views/LegionWar.vue'),
        meta: {
          title: '实时盐场',
          requiresToken: true
        }
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/views/Profile.vue'),
        meta: {
          title: '个人设置',
          requiresToken: true,
          requiresAuth: true
        }
      },
      {
        path: 'daily-tasks',
        name: 'DailyTasks',
        component: () => import('@/views/DailyTasks.vue'),
        meta: {
          title: '日常任务',
          requiresToken: true,
          requiresAuth: true
        }
      },
      {
        path: 'batch-daily-tasks',
        name: 'BatchDailyTasks',
        component: () => import('@/views/BatchDailyTasks.vue'),
        meta: {
          title: '批量日常',
          requiresToken: true,
          requiresAuth: true
        }
      },
      {
        path: 'users',
        name: 'AdminUsers',
        component: () => import('@/views/AdminUsers.vue'),
        meta: {
          title: '用户管理',
          requiresAuth: true,
          requiresAdmin: true
        }
      },
      ...generatedRoutes
    ]
  },
  {
    path: '/websocket-test',
    name: 'WebSocketTest',
    component: () => import('@/components/Test/WebSocketTester.vue'),
    meta: {
      title: 'WebSocket测试',
      requiresToken: true,
      requiresAuth: true
    }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: {
      title: '登录',
      requiresToken: false
    }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/Register.vue'),
    meta: {
      title: '注册',
      requiresToken: false
    }
  },
  {
    path: '/game-roles',
    redirect: '/tokens'
  },
  ...generatedRoutes,
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: {
      title: '页面不存在'
    }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes: my_routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    return { top: 0 }
  }
})

autoRoutes.handleHotUpdate?.(router)

router.beforeEach(async (to, from, next) => {
  const tokenStore = useTokenStore()
  const authStore = useAuthStore()
  const isAdminUser = authStore.user?.role === 'admin'

  // 设置页面标题
  document.title = to.meta.title
    ? `${to.meta.title} - 隐♥月管理系统`
    : '隐♥月管理系统'

  // 等待远程 bin 恢复完成（登录后异步拉取）
  if (tokenStore.remoteBinSyncing?.value) {
    await new Promise(resolve => {
      const stop = watch(
        () => tokenStore.remoteBinSyncing?.value,
        (syncing) => { if (!syncing) { stop(); resolve() } }
      )
    })
  }

  // 1. 检查认证（server分支逻辑）
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }

  if (to.meta.requiresAdmin && authStore.user?.role !== 'admin') {
    next('/admin/dashboard')
    return
  }

  if ((to.path === '/login' || to.path === '/register') && authStore.isAuthenticated) {
    if (isAdminUser) {
      next('/admin/users')
    } else if (tokenStore.hasTokens) {
      next('/admin/dashboard')
    } else {
      next('/tokens')
    }
    return
  }

  // 2. 检查token（原有逻辑）
  if (to.meta.requiresToken && !tokenStore.hasTokens && !isAdminUser) {
    next('/tokens')
    return
  }

  // 3. 根路径智能跳转
  if (to.path === '/') {
    if (isAdminUser) {
      next('/admin/users')
    } else if (tokenStore.hasTokens) {
      if (tokenStore.selectedToken) {
        next('/admin/dashboard')
      } else {
        next('/tokens')
      }
    } else {
      next('/tokens')
    }
    return
  }

  // 4. 军团战时间自动跳转（main分支）
  if (to.name !== 'LegionWar' && isNowInLegionWarTime()) {
    next('/admin/legion-war')
    return
  }

  next()
})

export default router
