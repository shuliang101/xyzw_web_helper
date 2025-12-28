<template>
  <div class="default-layout">
    <!-- 顶部导航 -->
    <nav class="dashboard-nav">
      <div class="nav-container">
        <div class="nav-brand">
          <img src="/icons/logo.png" alt="隐♥月" class="brand-logo">
          <div class="brand-toggle" @click="isMobileMenuOpen = true">
            <n-icon>
              <Menu />
            </n-icon>
            <span class="brand-text">隐♥月控制台</span>
          </div>
        </div>

        <div class="nav-menu">
          <template v-if="isAdmin">
            <router-link to="/admin/users" class="nav-item" active-class="active">
              <n-icon>
                <People />
              </n-icon>
              <span>用户管理</span>
            </router-link>
          </template>
          <template v-else>
            <router-link to="/admin/dashboard" class="nav-item" active-class="active">
              <n-icon>
                <Home />
              </n-icon>
              <span>首页</span>
            </router-link>
            <router-link to="/admin/game-features" class="nav-item" active-class="active">
              <n-icon>
                <Cube />
              </n-icon>
              <span>游戏功能</span>
            </router-link>
            <router-link to="/tokens" class="nav-item" active-class="active">
              <n-icon>
                <PersonCircle />
              </n-icon>
              <span>Token管理</span>
            </router-link>
            <router-link to="/admin/daily-tasks" class="nav-item" active-class="active">
              <n-icon>
                <Settings />
              </n-icon>
              <span>任务管理</span>
            </router-link>
            <router-link to="/admin/batch-daily-tasks" class="nav-item" active-class="active">
              <n-icon>
                <Layers />
              </n-icon>
              <span>批量日常</span>
            </router-link>
            <router-link to="/admin/message-test" class="nav-item" active-class="active">
              <n-icon>
                <ChatbubbleEllipsesSharp />
              </n-icon>
              <span>消息测试</span>
            </router-link>
            <router-link to="/admin/profile" class="nav-item" active-class="active">
              <n-icon>
                <Settings />
              </n-icon>
              <span>个人设置</span>
            </router-link>
          </template>
        </div>

        <div class="nav-user">
          <!-- 主题切换按钮 -->
          <ThemeToggle />

          <n-dropdown :options="userMenuOptions" @select="handleUserAction">
            <div class="user-info">
              <span class="username">{{ displayName }}</span>
              <n-icon>
                <ChevronDown />
              </n-icon>
            </div>
          </n-dropdown>
        </div>
      </div>
    </nav>
    <n-drawer v-model:show="isMobileMenuOpen" placement="left" style="width: 260px">
      <div class="drawer-menu">
        <template v-if="isAdmin">
          <router-link to="/admin/users" class="drawer-item" @click="isMobileMenuOpen = false">
            <n-icon>
              <People />
            </n-icon>
            <span>用户管理</span>
          </router-link>
        </template>
        <template v-else>
          <router-link to="/admin/dashboard" class="drawer-item" @click="isMobileMenuOpen = false">
            <n-icon>
              <Home />
            </n-icon>
            <span>首页</span>
          </router-link>
          <router-link to="/admin/game-features" class="drawer-item" @click="isMobileMenuOpen = false">
            <n-icon>
              <Cube />
            </n-icon>
            <span>游戏功能</span>
          </router-link>
          <router-link to="/tokens" class="drawer-item" @click="isMobileMenuOpen = false">
            <n-icon>
              <PersonCircle />
            </n-icon>
            <span>Token管理</span>
          </router-link>
          <router-link to="/admin/daily-tasks" class="drawer-item" @click="isMobileMenuOpen = false">
            <n-icon>
              <Settings />
            </n-icon>
            <span>任务管理</span>
          </router-link>
          <router-link to="/admin/batch-daily-tasks" class="drawer-item" @click="isMobileMenuOpen = false">
            <n-icon>
              <Layers />
            </n-icon>
            <span>批量日常</span>
          </router-link>
          <router-link to="/admin/message-test" class="drawer-item" @click="isMobileMenuOpen = false">
            <n-icon>
              <ChatbubbleEllipsesSharp />
            </n-icon>
            <span>消息测试</span>
          </router-link>
          <router-link to="/admin/profile" class="drawer-item" @click="isMobileMenuOpen = false">
            <n-icon>
              <Settings />
            </n-icon>
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
import { useAuthStore } from '@/stores/auth'
import ThemeToggle from '@/components/Common/ThemeToggle.vue'
import {
  Home,
  PersonCircle,
  Cube,
  Settings,
  ChevronDown,
  ChatbubbleEllipsesSharp,
  Menu,
  Layers,
  People
} from '@vicons/ionicons5'


import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { ref, computed } from 'vue'

const authStore = useAuthStore()
const router = useRouter()
const message = useMessage()

const isMobileMenuOpen = ref(false)
const isAdmin = computed(() => authStore.user?.role === 'admin')
const displayName = computed(() =>
  authStore.user?.nickname || authStore.user?.username || '未登录'
)

const userMenuOptions = [
  {
    label: '个人资料',
    key: 'profile'
  },
  {
    type: 'divider'
  },
  {
    label: '退出登录',
    key: 'logout'
  }
]

// 方法
const handleUserAction = (key) => {
  switch (key) {
    case 'profile':
      router.push('/admin/profile')
      break
    case 'logout':
      authStore.logout()
      message.success('账号已退出')
      router.push('/login')
      break
  }
}

</script>

<style scoped lang="scss">
// 导航栏
.dashboard-nav {
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-light);
  padding: 0 var(--spacing-lg);
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
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
  gap: var(--spacing-xs);
  margin-right: var(--spacing-xl);
}

.brand-logo {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}

.brand-text {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.brand-toggle {
  display: none;
  align-items: center;
  gap: var(--spacing-xs);
  cursor: pointer;
  font-size: var(--font-size-lg);
}

.brand-toggle .n-icon {
  font-size: inherit;
}

.nav-menu {
  display: flex;
  gap: var(--spacing-md);
  flex: 1;
  flex-wrap: wrap;
  overflow-x: auto;
  padding: var(--spacing-xs) 0;
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

  &:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  &.active {
    background: var(--primary-color-light);
    color: var(--primary-color);
  }
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
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  border-radius: var(--border-radius-medium);
  cursor: pointer;
  transition: background var(--transition-fast);

  &:hover {
    background: var(--bg-tertiary);
  }
}

.username {
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

@media (max-width: 1024px) {
  .nav-menu {
    display: none;
  }

  .brand-toggle {
    display: inline-flex;
  }

  .nav-container {
    height: 60px;
  }
}

@media (max-width: 768px) {
  .nav-container {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-sm);
    height: auto;
  }

  .nav-user {
    width: 100%;
    justify-content: space-between;
  }

  .brand-logo {
    display: none;
  }
}

@media (max-width: 640px) {
  .nav-user {
    gap: var(--spacing-sm);
  }

  .user-info {
    width: 100%;
    justify-content: space-between;
  }

  .username {
    display: none;
  }
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
</style>
