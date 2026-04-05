import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

const request = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

request.interceptors.request.use(
  (cfg) => {
    const authStore = useAuthStore()
    if (authStore.token && !cfg.headers.Authorization) {
      cfg.headers.Authorization = `Bearer ${authStore.token}`
    }
    return cfg
  },
  error => Promise.reject(error),
)

request.interceptors.response.use(
  (response) => {
    const payload = response.data

    if (
      payload
      && typeof payload === 'object'
      && Object.prototype.hasOwnProperty.call(payload, 'success')
    ) {
      if (payload.success === false) {
        return Promise.reject({
          success: false,
          status: response.status,
          message: payload.message || '请求失败',
          data: payload,
        })
      }

      if (Object.prototype.hasOwnProperty.call(payload, 'data')) {
        return payload.data
      }
    }

    return payload
  },
  (error) => {
    const authStore = useAuthStore()

    if (error.response) {
      const { status, data } = error.response
      const requestUrl = String(error.config?.url || '')
      const isPublicAuthRequest = requestUrl.includes('/auth/login')
        || requestUrl.includes('/auth/register')
        || requestUrl.includes('/club-car/member/')

      switch (status) {
        case 401:
          if (isPublicAuthRequest) {
            return Promise.reject({
              success: false,
              status,
              message: data?.message || '登录信息错误或已失效',
            })
          }
          authStore.logout()
          window.location.href = '/login'
          return Promise.reject({
            success: false,
            status,
            message: '登录已过期，请重新登录',
          })
        case 403:
          return Promise.reject({
            success: false,
            status,
            message: '没有权限访问',
          })
        case 404:
          return Promise.reject({
            success: false,
            status,
            message: '请求的资源不存在',
          })
        case 500:
          return Promise.reject({
            success: false,
            status,
            message: '服务器内部错误',
          })
        default:
          return Promise.reject({
            success: false,
            status,
            message: data?.message || '请求失败',
          })
      }
    }

    if (error.request) {
      return Promise.reject({
        success: false,
        status: null,
        message: '网络连接失败，请检查网络',
      })
    }

    return Promise.reject({
      success: false,
      status: null,
      message: error.message || '未知错误',
    })
  },
)

const api = {
  auth: {
    login: credentials => request.post('/auth/login', credentials),
    register: userInfo => request.post('/auth/register', userInfo),
    logout: () => request.post('/auth/logout'),
    getUserInfo: () => request.get('/auth/user'),
    refreshToken: () => request.post('/auth/refresh'),
    profile: () => request.get('/auth/profile'),
  },

  bins: {
    list: () => request.get('/bins'),
    upload: formData => request.post('/bins', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    remove: id => request.delete(`/bins/${id}`),
  },

  gameRoles: {
    getList: () => request.get('/gamerole_list'),
    add: roleData => request.post('/gameroles', roleData),
    update: (roleId, roleData) => request.put(`/gameroles/${roleId}`, roleData),
    delete: roleId => request.delete(`/gameroles/${roleId}`),
    getDetail: roleId => request.get(`/gameroles/${roleId}`),
  },

  dailyTasks: {
    getList: roleId => request.get(`/daily-tasks?roleId=${roleId}`),
    getStatus: roleId => request.get(`/daily-tasks/status?roleId=${roleId}`),
    complete: (taskId, roleId) => request.post(`/daily-tasks/${taskId}/complete`, { roleId }),
    getHistory: (roleId, page = 1, limit = 20) => request.get(
      `/daily-tasks/history?roleId=${roleId}&page=${page}&limit=${limit}`,
    ),
  },

  user: {
    getProfile: () => request.get('/user/profile'),
    updateProfile: profileData => request.put('/user/profile', profileData),
    changePassword: passwordData => request.put('/user/password', passwordData),
    getStats: () => request.get('/user/stats'),
  },

  storage: {
    list: () => request.get('/storage'),
    get: key => request.get(`/storage/${encodeURIComponent(key)}`),
    set: (key, value) => request.post('/storage', { key, value }),
    remove: key => request.delete(`/storage/${encodeURIComponent(key)}`),
  },

  activity: {
    list: (limit = 10) => request.get('/activity', { params: { limit } }),
  },

  admin: {
    listUsers: () => request.get('/admin/users'),
    getUser: id => request.get(`/admin/users/${id}`),
    deleteUser: id => request.delete(`/admin/users/${id}`),
    listUserBins: id => request.get(`/admin/users/${id}/bins`),
    removeUserBin: (userId, binId) => request.delete(`/admin/users/${userId}/bins/${binId}`),
    downloadUserBin: (userId, binId) => request.get(`/admin/users/${userId}/bins/${binId}/download`, {
      responseType: 'blob',
    }),
    updateUserPassword: (userId, body) => request.put(`/admin/users/${userId}/password`, body),
    getPublicKey: () => request.get('/admin/public-key'),
  },

  scheduledTasks: {
    list: () => request.get('/scheduled-tasks'),
    create: data => request.post('/scheduled-tasks', data),
    update: (id, data) => request.put(`/scheduled-tasks/${id}`, data),
    delete: id => request.delete(`/scheduled-tasks/${id}`),
    toggle: id => request.patch(`/scheduled-tasks/${id}/toggle`),
    getLogs: (id, limit = 50) => request.get(`/scheduled-tasks/${id}/logs`, { params: { limit } }),
    runNow: id => request.post(`/scheduled-tasks/${id}/run`),
  },

  clubCar: {
    getConfig: () => request.get('/club-car/config'),
    getClubInfo: () => request.get('/club-car/club-info'),
    updateConfig: data => request.put('/club-car/config', data),
    uploadMasterBin: formData => request.post('/club-car/master-bin', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    syncMembers: () => request.post('/club-car/sync-members'),
    listMembers: (activeOnly = false) => request.get('/club-car/members', { params: { activeOnly } }),
    listSendPlans: () => request.get('/club-car/send-plans'),
    createSendPlan: body => request.post('/club-car/send-plans', body),
    updateSendPlan: (planId, body) => request.put(`/club-car/send-plans/${planId}`, body),
    deleteSendPlan: planId => request.delete(`/club-car/send-plans/${planId}`),
    updateMemberSchedule: (memberId, body) => request.put(`/club-car/members/${memberId}/schedule`, body),
    updateMemberTarget: (memberId, body) => request.put(`/club-car/members/${memberId}/target`, body),
    unbindMemberBin: memberId => request.delete(`/club-car/members/${memberId}/bound-bin`),
    runSendNow: () => request.post('/club-car/run/send'),
    runClaimNow: () => request.post('/club-car/run/claim'),
    listLogs: (limit = 50) => request.get('/club-car/logs', { params: { limit } }),

    memberLogin: body => request.post('/club-car/member/login', body),
    memberSetPassword: body => request.post('/club-car/member/set-password', body),
    memberProfile: memberToken => request.get('/club-car/member/profile', {
      headers: { Authorization: `Bearer ${memberToken}` },
    }),
    memberBindBin: (memberToken, formData) => request.post('/club-car/member/bind-bin', formData, {
      headers: {
        Authorization: `Bearer ${memberToken}`,
        'Content-Type': 'multipart/form-data',
      },
    }),
    memberChangePassword: (memberToken, body) => request.put('/club-car/member/password', body, {
      headers: { Authorization: `Bearer ${memberToken}` },
    }),
    memberUpdateSchedule: (memberToken, body) => request.put('/club-car/member/schedule', body, {
      headers: { Authorization: `Bearer ${memberToken}` },
    }),
  },
}

export default api
