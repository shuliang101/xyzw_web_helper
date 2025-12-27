import '@arco-design/web-vue/dist/arco.css';
import 'virtual:uno.css';
import './assets/styles/global.scss'
import './assets/styles/responsive.scss'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import naive from 'naive-ui'
import router from './router'
import App from './App.vue'
import { useAuthStore } from '@/stores/auth'
// import { i18n } from './locales';

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(naive)
// app.use(i18n)

const applyTheme = () => {
  const saved = localStorage.getItem('theme') || 'auto'
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark')
  } else if (saved === 'light') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    if (prefersDark) document.documentElement.setAttribute('data-theme', 'dark')
    else document.documentElement.removeAttribute('data-theme')

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        const t = localStorage.getItem('theme') || 'auto'
        if (t === 'auto') {
          if (e.matches) document.documentElement.setAttribute('data-theme', 'dark')
          else document.documentElement.removeAttribute('data-theme')
        }
      })
    }
  }
}

applyTheme()

const bootstrap = async () => {
  const authStore = useAuthStore(pinia)
  await authStore.initAuth()
  app.mount('#app')
}

bootstrap()
