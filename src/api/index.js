import axios from "axios";
import { useAuthStore } from "@/stores/auth";

// 创建axios实例
const request = axios.create({
  baseURL: "/api",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    const authStore = useAuthStore();
    if (authStore.token) {
      config.headers.Authorization = `Bearer ${authStore.token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    const data = response.data;

    // 统一处理响应格式
    if (
      data &&
      typeof data === "object" &&
      Object.prototype.hasOwnProperty.call(data, "success")
    ) {
      if (data.success === false) {
        return Promise.reject({
          success: false,
          status: response.status,
          message: data.message || "请求失败",
          data,
        });
      }

      if (Object.prototype.hasOwnProperty.call(data, "data")) {
        return data.data;
      }
    }

    return data;
  },
  (error) => {
    const authStore = useAuthStore();

    // 处理HTTP错误
    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 401:
          // 未授权，清除登录状态
          authStore.logout();
          window.location.href = "/login";
          return Promise.reject({
            success: false,
            status,
            message: "登录已过期，请重新登录",
          });
        case 403:
          return Promise.reject({
            success: false,
            status,
            message: "没有权限访问",
          });
        case 404:
          return Promise.reject({
            success: false,
            status,
            message: "请求的资源不存在",
          });
        case 500:
          return Promise.reject({
            success: false,
            status,
            message: "服务器内部错误",
          });
        default:
          return Promise.reject({
            success: false,
            status,
            message: data?.message || "请求失败",
          });
      }
    } else if (error.request) {
      // 网络错误
      return Promise.reject({
        success: false,
        status: null,
        message: "网络连接失败，请检查网络",
      });
    } else {
      // 其他错误
      return Promise.reject({
        success: false,
        status: null,
        message: error.message || "未知错误",
      });
    }
  },
);

// API接口定义
const api = {
  // 认证相关
  auth: {
    login: (credentials) => request.post("/auth/login", credentials),
    register: (userInfo) => request.post("/auth/register", userInfo),
    logout: () => request.post("/auth/logout"),
    getUserInfo: () => request.get("/auth/user"),
    refreshToken: () => request.post("/auth/refresh"),
    profile: () => request.get("/auth/profile"),
  },

  // Bin 文件相关
  bins: {
    list: () => request.get("/bins"),
    upload: (formData) =>
      request.post("/bins", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
    remove: (id) => request.delete(`/bins/${id}`),
  },

  // 游戏角色相关
  gameRoles: {
    getList: () => request.get("/gamerole_list"),
    add: (roleData) => request.post("/gameroles", roleData),
    update: (roleId, roleData) => request.put(`/gameroles/${roleId}`, roleData),
    delete: (roleId) => request.delete(`/gameroles/${roleId}`),
    getDetail: (roleId) => request.get(`/gameroles/${roleId}`),
  },

  // 日常任务相关
  dailyTasks: {
    getList: (roleId) => request.get(`/daily-tasks?roleId=${roleId}`),
    getStatus: (roleId) => request.get(`/daily-tasks/status?roleId=${roleId}`),
    complete: (taskId, roleId) =>
      request.post(`/daily-tasks/${taskId}/complete`, { roleId }),
    getHistory: (roleId, page = 1, limit = 20) =>
      request.get(
        `/daily-tasks/history?roleId=${roleId}&page=${page}&limit=${limit}`,
      ),
  },

  // 用户相关
  user: {
    getProfile: () => request.get("/user/profile"),
    updateProfile: (profileData) => request.put("/user/profile", profileData),
    changePassword: (passwordData) =>
      request.put("/user/password", passwordData),
    getStats: () => request.get("/user/stats"),
  },

  // 键值存储
  storage: {
    list: () => request.get("/storage"),
    get: (key) => request.get(`/storage/${encodeURIComponent(key)}`),
    set: (key, value) => request.post("/storage", { key, value }),
    remove: (key) => request.delete(`/storage/${encodeURIComponent(key)}`),
  },

  // 用户动态
  activity: {
    list: (limit = 10) => request.get("/activity", { params: { limit } }),
  },

  // 管理员
  admin: {
    listUsers: () => request.get("/admin/users"),
    getUser: (id) => request.get(`/admin/users/${id}`),
    deleteUser: (id) => request.delete(`/admin/users/${id}`),
    listUserBins: (id) => request.get(`/admin/users/${id}/bins`),
    removeUserBin: (userId, binId) =>
      request.delete(`/admin/users/${userId}/bins/${binId}`),
    downloadUserBin: (userId, binId) =>
      request.get(`/admin/users/${userId}/bins/${binId}/download`, {
        responseType: "blob",
      }),
    updateUserPassword: (userId, payload) =>
      request.put(`/admin/users/${userId}/password`, payload),
    getPublicKey: () => request.get("/admin/public-key"),
  },
};

export default api;
