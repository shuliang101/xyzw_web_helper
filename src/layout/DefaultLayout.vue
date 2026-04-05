<template>
  <div class="default-layout">
    <nav class="dashboard-nav">
      <div class="nav-container">
        <div class="nav-brand">
          <img src="/icons/logo.png" alt="logo" class="brand-logo">
          <button class="brand-toggle" @click="isMobileMenuOpen = true">
            <n-icon><Menu /></n-icon>
            <span class="brand-text">XYZW 控制台</span>
          </button>
        </div>

        <div class="nav-menu">
          <template v-if="isAdmin">
            <router-link to="/admin/users" class="nav-item" active-class="active">
              <n-icon><People /></n-icon>
              <span>用户管理</span>
            </router-link>
            <router-link to="/admin/club-car" class="nav-item" active-class="active">
              <n-icon><CarSport /></n-icon>
              <span>俱乐部收发车</span>
            </router-link>
          </template>
          <template v-else>
            <router-link to="/admin/dashboard" class="nav-item" active-class="active">
              <n-icon><Home /></n-icon>
              <span>首页</span>
            </router-link>
            <router-link to="/admin/game-features" class="nav-item" active-class="active">
              <n-icon><Cube /></n-icon>
              <span>游戏功能</span>
            </router-link>
            <router-link to="/tokens" class="nav-item" active-class="active">
              <n-icon><PersonCircle /></n-icon>
              <span>Token 管理</span>
            </router-link>
            <router-link to="/admin/batch-daily-tasks" class="nav-item" active-class="active">
              <n-icon><Layers /></n-icon>
              <span>批量日常</span>
            </router-link>
            <router-link to="/admin/server-tasks" class="nav-item" active-class="active">
              <n-icon><Timer /></n-icon>
              <span>定时任务</span>
            </router-link>
            <router-link to="/admin/message-test" class="nav-item" active-class="active">
              <n-icon><ChatbubbleEllipsesSharp /></n-icon>
              <span>消息测试</span>
            </router-link>
            <router-link to="/admin/profile" class="nav-item" active-class="active">
              <n-icon><Settings /></n-icon>
              <span>个人设置</span>
            </router-link>
          </template>
        </div>

        <div class="nav-user">
          <ThemeToggle />
          <n-dropdown :options="userMenuOptions" @select="handleUserAction">
            <div class="user-info">
              <span class="username">{{ displayName }}</span>
              <n-icon><ChevronDown /></n-icon>
            </div>
          </n-dropdown>
        </div>
      </div>
    </nav>

    <n-drawer v-model:show="isMobileMenuOpen" placement="left" style="width: 260px">
      <div class="drawer-menu">
        <template v-if="isAdmin">
          <router-link to="/admin/users" class="drawer-item" @click="isMobileMenuOpen = false">
            <n-icon><People /></n-icon>
            <span>用户管理</span>
          </router-link>
          <router-link to="/admin/club-car" class="drawer-item" @click="isMobileMenuOpen = false">
            <n-icon><CarSport /></n-icon>
            <span>俱乐部收发车</span>
          </router-link>
        </template>
        <template v-else>
          <router-link to="/admin/dashboard" class="drawer-item" @click="isMobileMenuOpen = false">
            <n-icon><Home /></n-icon>
            <span>首页</span>
          </router-link>
          <router-link to="/admin/game-features" class="drawer-item" @click="isMobileMenuOpen = false">
            <n-icon><Cube /></n-icon>
            <span>游戏功能</span>
          </router-link>
          <router-link to="/tokens" class="drawer-item" @click="isMobileMenuOpen = false">
            <n-icon><PersonCircle /></n-icon>
            <span>Token 管理</span>
          </router-link>
          <router-link to="/admin/batch-daily-tasks" class="drawer-item" @click="isMobileMenuOpen = false">
            <n-icon><Layers /></n-icon>
            <span>批量日常</span>
          </router-link>
          <router-link to="/admin/server-tasks" class="drawer-item" @click="isMobileMenuOpen = false">
            <n-icon><Timer /></n-icon>
            <span>定时任务</span>
          </router-link>
          <router-link to="/admin/message-test" class="drawer-item" @click="isMobileMenuOpen = false">
            <n-icon><ChatbubbleEllipsesSharp /></n-icon>
            <span>消息测试</span>
          </router-link>
          <router-link to="/admin/profile" class="drawer-item" @click="isMobileMenuOpen = false">
            <n-icon><Settings /></n-icon>
            <span>个人设置</span>
          </router-link>
        </template>
      </div>
    </n-drawer>

    <div class="main">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import {
  CarSport,
  ChatbubbleEllipsesSharp,
  ChevronDown,
  Cube,
  Home,
  Layers,
  Menu,
  People,
  PersonCircle,
  Settings,
  Timer,
} from '@vicons/ionicons5'
import { useAuthStore } from '@/stores/auth'
import ThemeToggle from '@/components/Common/ThemeToggle.vue'

const authStore = useAuthStore()
const router = useRouter()
const message = useMessage()

const isMobileMenuOpen = ref(false)
const isAdmin = computed(() => authStore.user?.role === 'admin')
const displayName = computed(() => authStore.user?.nickname || authStore.user?.username || '未登录')

const userMenuOptions = [
  { label: '个人资料', key: 'profile' },
  { type: 'divider' },
  { label: '退出登录', key: 'logout' },
]

const handleUserAction = (key) => {
  if (key === 'profile') {
    router.push('/admin/profile')
    return
  }
  if (key === 'logout') {
    authStore.logout()
    message.success('账号已退出')
    router.push('/login')
  }
}
</script>

<style scoped lang="scss">
.dashboard-nav {
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-light);
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  padding: 0 var(--spacing-lg);
}

.nav-container {
  display: flex;
  align-items: center;
  height: 64px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  padding: 0 var(--spacing-md);
}

.nav-brand {
  display: flex;
  align-items: center;
  margin-right: var(--spacing-xl);
  gap: var(--spacing-sm);
}

.brand-logo {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}

.brand-toggle {
  border: none;
  background: transparent;
  color: inherit;
  display: none;
  align-items: center;
  gap: var(--spacing-xs);
  cursor: pointer;
}

.brand-text {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.nav-menu {
  display: flex;
  gap: var(--spacing-md);
  flex: 1;
  overflow-x: auto;
  scrollbar-width: none;
}

.nav-menu::-webkit-scrollbar {
  display: none;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--border-radius-medium);
  color: var(--text-secondary);
  text-decoration: none;
  transition: all var(--transition-fast);
}

.nav-item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--primary-color-light);
  color: var(--primary-color);
}

.nav-user {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  border-radius: var(--border-radius-medium);
  cursor: pointer;
}

.user-info:hover {
  background: var(--bg-tertiary);
}

.username {
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.drawer-menu {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
}

.drawer-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--border-radius-medium);
  color: var(--text-secondary);
  text-decoration: none;
}

.drawer-item.router-link-active {
  background: var(--primary-color-light);
  color: var(--primary-color);
}

@media (max-width: 1024px) {
  .nav-menu {
    display: none;
  }

  .brand-toggle {
    display: inline-flex;
  }
}

@media (max-width: 768px) {
  .dashboard-nav {
    padding: 0 var(--spacing-sm);
  }

  .nav-container {
    height: 58px;
    padding: 0;
  }

  .brand-logo {
    display: none;
  }

  .username {
    display: none;
  }
}
</style>
