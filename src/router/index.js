import { createRouter, createWebHistory } from 'vue-router'
import { watch } from 'vue'
import * as autoRoutes from 'vue-router/auto-routes'
import { useTokenStore } from '@/stores/tokenStore'
import { useAuthStore } from '@/stores/auth'

const generatedRoutes = autoRoutes.routes ?? []

const myRoutes = [
  {
    path: '/',
    redirect: '/login',
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
    meta: {
      title: 'Home',
      requiresToken: false,
    },
  },
  {
    path: '/tokens',
    name: 'TokenImport',
    component: () => import('@/views/TokenImport/index.vue'),
    meta: {
      title: 'Token Manager',
      requiresToken: false,
      requiresAuth: true,
    },
    props: route => ({
      token: route.query.token,
      name: route.query.name,
      server: route.query.server,
      wsUrl: route.query.wsUrl,
      api: route.query.api,
      auto: route.query.auto === 'true',
    }),
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
          title: 'Dashboard',
          requiresToken: true,
          requiresAuth: true,
        },
      },
      {
        path: 'game-features',
        name: 'GameFeatures',
        component: () => import('@/views/GameFeatures.vue'),
        meta: {
          title: 'Game Features',
          requiresToken: true,
          requiresAuth: true,
        },
      },
      {
        path: 'message-test',
        name: 'MessageTest',
        component: () => import('@/components/Test/MessageTester.vue'),
        meta: {
          title: 'Message Test',
          requiresToken: true,
          requiresAuth: true,
        },
      },
      {
        path: 'legion-war',
        name: 'LegionWar',
        component: () => import('@/views/LegionWar.vue'),
        meta: {
          title: 'Legion War',
          requiresToken: true,
        },
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/views/Profile.vue'),
        meta: {
          title: 'Profile',
          requiresToken: true,
          requiresAuth: true,
        },
      },
      {
        path: 'daily-tasks',
        name: 'DailyTasks',
        component: () => import('@/views/DailyTasks.vue'),
        meta: {
          title: 'Daily Tasks',
          requiresToken: true,
          requiresAuth: true,
        },
      },
      {
        path: 'batch-daily-tasks',
        name: 'BatchDailyTasks',
        component: () => import('@/views/BatchDailyTasks.vue'),
        meta: {
          title: 'Batch Daily Tasks',
          requiresToken: true,
          requiresAuth: true,
        },
      },
      {
        path: 'server-tasks',
        name: 'ServerScheduledTasks',
        component: () => import('@/views/ServerScheduledTasks.vue'),
        meta: {
          title: 'Server Scheduled Tasks',
          requiresAuth: true,
        },
      },
      {
        path: 'users',
        name: 'AdminUsers',
        component: () => import('@/views/AdminUsers.vue'),
        meta: {
          title: 'Users',
          requiresAuth: true,
          requiresAdmin: true,
        },
      },
      {
        path: 'club-car',
        name: 'AdminClubCarSystem',
        component: () => import('@/views/ClubCarSystem.vue'),
        meta: {
          title: 'Club Car System',
          requiresAuth: true,
          requiresAdmin: true,
        },
      },
      ...generatedRoutes,
    ],
  },
  {
    path: '/club-car/bind',
    name: 'PublicClubCarMemberBind',
    component: () => import('@/views/ClubCarMemberBind.vue'),
    meta: {
      title: 'Club Member Bind',
      requiresToken: false,
    },
  },
  {
    path: '/club-car/monitor',
    name: 'ClubCarMonitor',
    component: () => import('@/views/ClubCarMonitor.vue'),
    meta: {
      title: 'Club Car Monitor',
      requiresAuth: true,
      requiresAdmin: true,
    },
  },
  {
    path: '/websocket-test',
    name: 'WebSocketTest',
    component: () => import('@/components/Test/WebSocketTester.vue'),
    meta: {
      title: 'WebSocket Test',
      requiresToken: true,
      requiresAuth: true,
    },
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: {
      title: 'Login',
      requiresToken: false,
    },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/Register.vue'),
    meta: {
      title: 'Register',
      requiresToken: false,
    },
  },
  {
    path: '/game-roles',
    redirect: '/tokens',
  },
  ...generatedRoutes,
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: {
      title: 'Not Found',
    },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes: myRoutes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    return { top: 0 }
  },
})

router.beforeEach(async (to, from, next) => {
  const tokenStore = useTokenStore()
  const authStore = useAuthStore()
  const isAdminUser = authStore.user?.role === 'admin'

  document.title = to.meta.title
    ? `${to.meta.title} - XYZW Console`
    : 'XYZW Console'

  if (tokenStore.remoteBinSyncing?.value) {
    await new Promise(resolve => {
      const stop = watch(
        () => tokenStore.remoteBinSyncing?.value,
        (syncing) => {
          if (!syncing) {
            stop()
            resolve()
          }
        },
      )
    })
  }

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

  if (to.meta.requiresToken && !tokenStore.hasTokens && !isAdminUser) {
    next('/tokens')
    return
  }

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

  next()
})

export default router
