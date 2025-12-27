import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

// 创建axios实例
const request = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    const authStore = useAuthStore()
    if (authStore.token) {
      config.headers.Authorization = `Bearer ${authStore.token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const authStore = useAuthStore()
    
    // 处理HTTP错误
    if (error.response) {
      const { status, data } = error.response
      
      switch (status) {
        case 401:
          // 未授权，清除登录状态
          authStore.logout()
          window.location.href = '/login'
          return Promise.reject({
            success: false,
            message: '登录已过期，请重新登录'
          })
        case 403:
          return Promise.reject({
            success: false,
            message: '没有权限访问'
          })
        case 404:
          return Promise.reject({
            success: false,
            message: '请求的资源不存在'
          })
        case 500:
          return Promise.reject({
            success: false,
            message: '服务器内部错误'
          })
        default:
          return Promise.reject({
            success: false,
            message: data?.message || '请求失败'
          })
      }
    } else if (error.request) {
      // 网络错误
      return Promise.reject({
        success: false,
        message: '网络连接失败，请检查网络'
      })
    } else {
      // 其他错误
      return Promise.reject({
        success: false,
        message: error.message || '未知错误'
      })
    }
  }
)

// API接口定义
const api = {
  // 认证相关
  auth: {
    login: (credentials) => request.post('/auth/login', credentials),
    register: (userInfo) => request.post('/auth/register', userInfo),
    profile: () => request.get('/auth/profile')
  },

  bins: {
    list: () => request.get('/bins'),
    upload: (formData) =>
      request.post('/bins', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      }),
    remove: (id) => request.delete(`/bins/${id}`)
  },

  storage: {
    list: () => request.get('/storage'),
    get: (key) => request.get(`/storage/${encodeURIComponent(key)}`),
    set: (key, value) => request.post('/storage', { key, value }),
    remove: (key) => request.delete(`/storage/${encodeURIComponent(key)}`)
  },

  activity: {
    list: (limit = 10) => request.get('/activity', { params: { limit } })
  },

  admin: {
    listUsers: () => request.get('/admin/users'),
    getUser: (id) => request.get(`/admin/users/${id}`),
    deleteUser: (id) => request.delete(`/admin/users/${id}`),
    listUserBins: (id) => request.get(`/admin/users/${id}/bins`),
    removeUserBin: (userId, binId) => request.delete(`/admin/users/${userId}/bins/${binId}`),
    downloadUserBin: (userId, binId) =>
      request.get(`/admin/users/${userId}/bins/${binId}/download`, { responseType: 'blob' }),
    updateUserPassword: (userId, payload) => request.put(`/admin/users/${userId}/password`, payload),
    getPublicKey: () => request.get('/admin/public-key')
  }
}

export default api
