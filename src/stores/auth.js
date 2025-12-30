import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useLocalTokenStore } from './localTokenManager'
import { useTokenStore } from './tokenStore'
import api from '@/api'

const TOKEN_KEY = 'token'
const USER_KEY = 'user'
const DEFAULT_AVATAR = '/icons/logo.png'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const token = ref(localStorage.getItem(TOKEN_KEY) || null)
  const isLoading = ref(false)

  const localTokenStore = useLocalTokenStore()

  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const userInfo = computed(() => user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  const normalizeUser = (profile = {}) => ({
    ...profile,
    nickname: profile.nickname || profile.username || '用户',
    avatar: profile.avatar || DEFAULT_AVATAR,
    role: profile.role || 'user'
  })

  const persistSession = (sessionToken, profile) => {
    token.value = sessionToken
    user.value = normalizeUser(profile)
    localStorage.setItem(TOKEN_KEY, sessionToken)
    localStorage.setItem(USER_KEY, JSON.stringify(user.value))
    localTokenStore.setUserToken(sessionToken)
  }

  const login = async (credentials) => {
    try {
      isLoading.value = true
      const result = await api.auth.login(credentials)
      persistSession(result.token, result.user)
      const tokenStore = useTokenStore()
      if (result.user?.role === 'admin') {
        tokenStore.clearAllTokens()
      } else if (!tokenStore.hasTokens) {
        await tokenStore.restoreTokensFromRemoteBins()
      }
      return { success: true }
    } catch (error) {
      return { success: false, message: error.message || '登录失败' }
    } finally {
      isLoading.value = false
    }
  }

  const register = async (formData) => {
    try {
      isLoading.value = true
      await api.auth.register(formData)
      return { success: true }
    } catch (error) {
      return { success: false, message: error.message || '注册失败' }
    } finally {
      isLoading.value = false
    }
  }

  const logout = () => {
    const tokenStore = useTokenStore()
    user.value = null
    token.value = null

    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)

    localTokenStore.clearUserToken()
    localTokenStore.clearAllGameTokens()
    tokenStore.clearAllTokens()
  }

  const fetchUserInfo = async () => {
    try {
      if (!token.value) return false

      const profile = await api.auth.profile()
      user.value = normalizeUser(profile.user)
      localStorage.setItem(USER_KEY, JSON.stringify(user.value))
      return true
    } catch (error) {
      console.error('获取用户信息失败:', error)
      logout()
      return false
    }
  }

  const initAuth = async () => {
    const savedToken = localStorage.getItem(TOKEN_KEY)
    const savedUser = localStorage.getItem(USER_KEY)
    if (savedToken) {
      token.value = savedToken
    }
    if (savedUser) {
      try {
        user.value = normalizeUser(JSON.parse(savedUser))
      } catch (error) {
        localStorage.removeItem(USER_KEY)
      }
    }
    if (token.value && !user.value) {
      await fetchUserInfo()
    }
    if (token.value) {
      localTokenStore.initTokenManager()
      const tokenStore = useTokenStore()
      if (user.value?.role === 'admin') {
        tokenStore.clearAllTokens()
      } else if (!tokenStore.hasTokens) {
        await tokenStore.restoreTokensFromRemoteBins()
      }
    }
  }

  return {
    user,
    token,
    isLoading,
    isAuthenticated,
    userInfo,
    isAdmin,
    login,
    register,
    logout,
    fetchUserInfo,
    initAuth
  }
})
