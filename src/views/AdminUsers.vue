<template>
  <div class="admin-users-page">
    <div class="page-header">
      <div>
        <h1>用户管理</h1>
        <p>查看/删除普通账号，管理用户 BIN 文件，并支持安全的密码重置。</p>
      </div>
      <n-space>
        <n-button tertiary @click="fetchUsers" :loading="isLoading">
          刷新列表
        </n-button>
      </n-space>
    </div>

    <n-card class="users-card">
      <template #header>
        <div class="card-header">
          <span>普通用户（{{ users.length }}）</span>
        </div>
      </template>

      <n-spin :show="isLoading">
        <div class="table-scroll">
          <n-table :bordered="false" striped>
            <thead>
              <tr>
                <th style="width: 80px">ID</th>
                <th>用户名</th>
                <th>昵称</th>
                <th style="width: 200px">注册时间</th>
                <th style="width: 260px">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!users.length && !isLoading">
                <td colspan="5">
                  <div class="empty">暂无普通用户</div>
                </td>
              </tr>
              <tr v-for="user in users" :key="user.id">
                <td>#{{ user.id }}</td>
                <td>{{ user.username }}</td>
                <td>{{ user.nickname || '-' }}</td>
                <td>{{ formatDate(user.createdAt) }}</td>
                <td>
                  <n-space :size="8">
                    <n-button size="small" @click="viewUserBins(user)" :loading="binsLoading && selectedUser && selectedUser.id === user.id">
                      查看 BIN
                    </n-button>
                    <n-button size="small" type="warning" ghost @click="openPasswordModal(user)">
                      重置密码
                    </n-button>
                    <n-popconfirm
                      :positive-text="'删除'"
                      :positive-button-props="{ type: 'error' }"
                      negative-text="取消"
                      @positive-click="() => removeUser(user.id)"
                    >
                      <template #trigger>
                        <n-button size="small" type="error" ghost>
                          删除
                        </n-button>
                      </template>
                      确认删除用户 {{ user.username }} 吗？该操作不可恢复。
                    </n-popconfirm>
                  </n-space>
                </td>
              </tr>
            </tbody>
          </n-table>
        </div>
      </n-spin>
    </n-card>

    <n-card v-if="selectedUser" class="bins-card">
      <template #header>
        <div class="card-header">
          <span>{{ selectedUser.nickname || selectedUser.username }} 的 BIN 文件（{{ userBins.length }}）</span>
        </div>
      </template>
      <n-spin :show="binsLoading">
        <div class="table-scroll">
          <n-table :bordered="false" striped>
            <thead>
              <tr>
                <th style="width: 80px">ID</th>
                <th>文件名</th>
                <th style="width: 140px">大小</th>
                <th style="width: 220px">上传时间</th>
                <th style="width: 220px">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!userBins.length && !binsLoading">
                <td colspan="5">
                  <div class="empty">该用户尚未上传 BIN 文件</div>
                </td>
              </tr>
              <tr v-for="bin in userBins" :key="bin.id">
                <td>#{{ bin.id }}</td>
                <td>{{ bin.originalName }}</td>
                <td>{{ formatSize(bin.size) }}</td>
                <td>{{ formatDate(bin.createdAt) }}</td>
                <td>
                  <n-space :size="8">
                    <n-button size="small" secondary @click="downloadUserBin(bin)" :loading="downloadingBinId === bin.id">
                      下载
                    </n-button>
                    <n-popconfirm
                      :positive-text="'删除'"
                      :positive-button-props="{ type: 'error' }"
                      negative-text="取消"
                      @positive-click="() => removeUserBin(bin)"
                    >
                      <template #trigger>
                        <n-button size="small" type="error" quaternary :loading="removingBinId === bin.id">
                          删除
                        </n-button>
                      </template>
                      确认删除文件 {{ bin.originalName }} 吗？该操作不可恢复。
                    </n-popconfirm>
                  </n-space>
                </td>
              </tr>
            </tbody>
          </n-table>
        </div>
      </n-spin>
    </n-card>

    <n-modal v-model:show="showPasswordModal" :mask-closable="false">
      <n-card style="width: 420px" title="重置密码" :bordered="false">
        <n-form :model="passwordForm" :rules="passwordRules" ref="passwordFormRef">
          <n-form-item label="新密码" path="password">
            <n-input v-model:value="passwordForm.password" type="password" placeholder="请输入新密码" />
          </n-form-item>
          <n-form-item label="确认密码" path="confirm">
            <n-input v-model:value="passwordForm.confirm" type="password" placeholder="请再次输入" />
          </n-form-item>
        </n-form>
        <template #footer>
          <n-space justify="end">
            <n-button @click="closePasswordModal">取消</n-button>
            <n-button type="primary" :loading="savingPassword" @click="submitPassword">
              保存
            </n-button>
          </n-space>
        </template>
      </n-card>
    </n-modal>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useMessage } from 'naive-ui'
import api from '@/api'

const users = ref([])
const isLoading = ref(false)
const binsLoading = ref(false)
const selectedUser = ref(null)
const userBins = ref([])
const removingBinId = ref(null)
const downloadingBinId = ref(null)
const showPasswordModal = ref(false)
const passwordTarget = ref(null)
const savingPassword = ref(false)
const passwordFormRef = ref(null)
const adminPublicKey = ref(null)
const passwordForm = reactive({
  password: '',
  confirm: ''
})
const message = useMessage()

const passwordRules = {
  password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '新密码长度至少 6 位', trigger: 'blur' }
  ],
  confirm: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (rule, value) => value === passwordForm.password,
      message: '两次输入的密码不一致',
      trigger: 'blur'
    }
  ]
}

const fetchUsers = async () => {
  try {
    isLoading.value = true
    const { users: list } = await api.admin.listUsers()
    users.value = list
  } catch (error) {
    message.error(error.message || '加载用户失败')
  } finally {
    isLoading.value = false
  }
}

const removeUser = async (userId) => {
  try {
    await api.admin.deleteUser(userId)
    users.value = users.value.filter(user => user.id !== userId)
    if (selectedUser.value?.id === userId) {
      selectedUser.value = null
      userBins.value = []
    }
    message.success('用户已删除')
  } catch (error) {
    message.error(error.message || '删除失败')
  }
}

const viewUserBins = async (user) => {
  selectedUser.value = user
  binsLoading.value = true
  try {
    const { bins } = await api.admin.listUserBins(user.id)
    userBins.value = bins || []
    if (!userBins.value.length) {
      message.info('该用户暂时没有 BIN 文件')
    }
  } catch (error) {
    message.error(error.message || '加载 BIN 列表失败')
  } finally {
    binsLoading.value = false
  }
}

const removeUserBin = async (bin) => {
  if (!selectedUser.value) return
  removingBinId.value = bin.id
  try {
    await api.admin.removeUserBin(selectedUser.value.id, bin.id)
    userBins.value = userBins.value.filter(item => item.id !== bin.id)
    message.success('BIN 文件已删除')
  } catch (error) {
    message.error(error.message || '删除 BIN 失败')
  } finally {
    removingBinId.value = null
  }
}

const downloadUserBin = async (bin) => {
  if (!selectedUser.value) return
  downloadingBinId.value = bin.id
  try {
    const blob = await api.admin.downloadUserBin(selectedUser.value.id, bin.id)
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = bin.originalName || `bin-${bin.id}.bin`
    a.click()
    window.URL.revokeObjectURL(url)
  } catch (error) {
    message.error(error.message || '下载失败')
  } finally {
    downloadingBinId.value = null
  }
}

const fetchPublicKey = async () => {
  if (adminPublicKey.value) return adminPublicKey.value
  try {
    const { publicKey } = await api.admin.getPublicKey()
    adminPublicKey.value = publicKey
    return publicKey
  } catch (error) {
    message.error(error.message || '获取加密公钥失败')
    throw error
  }
}

const pemToArrayBuffer = (pem) => {
  const b64 = pem.replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s+/g, '')
  const binary = window.atob(b64)
  const len = binary.length
  const buffer = new ArrayBuffer(len)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < len; i++) {
    view[i] = binary.charCodeAt(i)
  }
  return buffer
}

const encryptPassword = async (text) => {
  const pem = await fetchPublicKey()
  const binaryDer = pemToArrayBuffer(pem)
  const cryptoKey = await window.crypto.subtle.importKey(
    'spki',
    binaryDer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256'
    },
    false,
    ['encrypt']
  )
  const encoded = new TextEncoder().encode(text)
  const encrypted = await window.crypto.subtle.encrypt({ name: 'RSA-OAEP' }, cryptoKey, encoded)
  const bytes = new Uint8Array(encrypted)
  let binary = ''
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte)
  })
  return window.btoa(binary)
}

const openPasswordModal = (user) => {
  passwordTarget.value = user
  passwordForm.password = ''
  passwordForm.confirm = ''
  showPasswordModal.value = true
}

const closePasswordModal = () => {
  showPasswordModal.value = false
  passwordTarget.value = null
}

const submitPassword = async () => {
  if (!passwordTarget.value) return
  try {
    await passwordFormRef.value?.validate()
  } catch {
    return
  }
  savingPassword.value = true
  try {
    const encrypted = await encryptPassword(passwordForm.password)
    await api.admin.updateUserPassword(passwordTarget.value.id, { password: encrypted })
    message.success('密码已重置')
    closePasswordModal()
  } catch (error) {
    message.error(error.message || '重置密码失败')
  } finally {
    savingPassword.value = false
  }
}

const formatDate = (value) => {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

const formatSize = (size) => {
  if (!size) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

onMounted(() => {
  fetchUsers()
})
</script>

<style scoped lang="scss">
.admin-users-page {
  padding: var(--spacing-xl);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xl);

  h1 {
    margin: 0;
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-bold);
  }

  p {
    margin: var(--spacing-xs) 0 0;
    color: var(--text-secondary);
  }
}

.users-card,
.bins-card {
  box-shadow: var(--shadow-light);
  margin-bottom: var(--spacing-xl);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: var(--font-weight-medium);
}

table {
  width: 100%;

  th {
    text-align: left;
    color: var(--text-secondary);
  }

  td {
    vertical-align: middle;
  }
}

.empty {
  text-align: center;
  padding: var(--spacing-2xl) 0;
  color: var(--text-secondary);
}

.table-scroll {
  width: 100%;
  overflow-x: auto;
  padding-bottom: var(--spacing-xs);
}

.table-scroll table {
  min-width: 640px;
}

.table-scroll::-webkit-scrollbar {
  height: 4px;
}

.table-scroll::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 2px;
}

@media (max-width: 900px) {
  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-xs);
  }

  .table-scroll table {
    min-width: 540px;
  }
}

@media (max-width: 640px) {
  .admin-users-page {
    padding: var(--spacing-lg) var(--spacing-sm);
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-sm);
  }

  table th:nth-child(1),
  table td:nth-child(1) {
    width: auto;
  }

  table th:nth-child(4),
  table td:nth-child(4) {
    width: auto;
  }

  .table-scroll {
    margin: 0 calc(-1 * var(--spacing-sm));
    padding: 0 var(--spacing-sm) var(--spacing-xs);
  }

  .table-scroll table {
    min-width: 460px;
  }
}
</style>
