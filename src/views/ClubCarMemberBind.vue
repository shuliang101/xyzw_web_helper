<template>
  <div class="member-bind-page">
    <n-card class="bind-card" title="俱乐部成员绑定">
      <template #header-extra>
        <n-button text @click="logoutMember" v-if="memberToken">退出</n-button>
      </template>

      <n-spin :show="checkingSession">
        <n-form v-if="!memberToken" :model="loginForm" label-placement="top">
          <n-alert type="info" :show-icon="false" style="margin-bottom: 12px">
            首次使用请先设置密码；已设置过密码的成员可直接登录。
          </n-alert>

          <n-form-item label="成员角色 ID">
            <n-input v-model:value="loginForm.roleId" placeholder="请输入你的角色 ID" />
          </n-form-item>

          <n-form-item label="密码">
            <n-input
              v-model:value="loginForm.password"
              type="password"
              show-password-on="click"
              placeholder="请输入密码（至少 6 位）"
              @keyup.enter="loginMember"
            />
          </n-form-item>

          <n-space vertical>
            <n-button type="primary" block :loading="loggingIn" @click="loginMember">
              登录并进入绑定页
            </n-button>
            <n-button type="warning" ghost block :loading="settingPassword" @click="setPasswordAndLogin">
              首次设置密码并登录
            </n-button>
          </n-space>
        </n-form>

        <div v-else>
          <n-alert type="success" :show-icon="false" style="margin-bottom: 12px">
            当前成员：{{ memberInfo.name }}（{{ memberInfo.roleId }}）
            <span v-if="memberInfo.boundAt">，上次绑定：{{ formatDate(memberInfo.boundAt) }}</span>
          </n-alert>

          <n-card size="small" title="自动收车设置">
            <n-alert type="info" :show-icon="false" style="margin-bottom: 12px">
              发车时间由管理员设置：{{ memberInfo.sendTime || '--:--' }}。自动收车默认关闭，开启时需满足与发车时间间隔 >= 4 小时。
            </n-alert>

            <n-form label-placement="left" label-width="100px">
              <n-form-item label="是否自动收车">
                <n-switch v-model:value="scheduleForm.claimEnabled" />
              </n-form-item>
              <n-form-item label="收车时间">
                <n-time-picker
                  v-model:value="scheduleForm.claimTimeTs"
                  format="HH:mm"
                  style="width: 220px"
                  :disabled="!scheduleForm.claimEnabled"
                />
              </n-form-item>
            </n-form>

            <n-button type="primary" :loading="savingSchedule" @click="saveSchedule">
              保存自动收车设置
            </n-button>
          </n-card>

          <n-collapse arrow-placement="right" style="margin-top: 12px">
            <n-collapse-item title="修改密码" name="password">
              <n-form label-placement="top">
                <n-form-item label="当前密码">
                  <n-input
                    v-model:value="passwordForm.currentPassword"
                    type="password"
                    show-password-on="click"
                    placeholder="请输入当前密码"
                  />
                </n-form-item>
                <n-form-item label="新密码">
                  <n-input
                    v-model:value="passwordForm.newPassword"
                    type="password"
                    show-password-on="click"
                    placeholder="请输入新密码（至少 6 位）"
                  />
                </n-form-item>
                <n-form-item label="确认新密码">
                  <n-input
                    v-model:value="passwordForm.confirmPassword"
                    type="password"
                    show-password-on="click"
                    placeholder="请再次输入新密码"
                  />
                </n-form-item>
                <n-button type="warning" :loading="changingPassword" @click="changePassword">
                  更新密码
                </n-button>
              </n-form>
            </n-collapse-item>

            <n-collapse-item title="微信扫码生成 BIN（可选）" name="wx">
              <p class="hint">
                这里与 Token 管理页一致，可扫码登录微信后下载 BIN，再在下方上传绑定。
              </p>
              <WxQrcodeForm />
            </n-collapse-item>
          </n-collapse>

          <n-divider />

          <div class="upload-area">
            <p class="hint">上传要绑定的 BIN 文件（.bin/.dmp）</p>
            <input
              ref="memberBinInputRef"
              type="file"
              accept=".bin,.dmp"
              style="display: none"
              @change="handleMemberBinSelected"
            >
            <n-space>
              <n-button @click="memberBinInputRef?.click?.()" :loading="uploadingBin">
                选择 BIN 文件
              </n-button>
              <span class="filename">{{ selectedFileName || memberInfo.boundBinName || '未选择文件' }}</span>
            </n-space>
          </div>
        </div>
      </n-spin>
    </n-card>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useMessage } from 'naive-ui'
import api from '@/api'
import WxQrcodeForm from '@/views/TokenImport/wxqrcode.vue'

const route = useRoute()
const message = useMessage()

const SESSION_KEY = 'club_car_member_token'

const checkingSession = ref(false)
const loggingIn = ref(false)
const settingPassword = ref(false)
const changingPassword = ref(false)
const savingSchedule = ref(false)
const uploadingBin = ref(false)

const memberToken = ref('')
const memberInfo = reactive({
  roleId: '',
  name: '',
  boundAt: '',
  boundBinName: '',
  sendTime: '12:00',
  claimTime: '16:00',
  claimEnabled: false,
})

const loginForm = reactive({
  roleId: String(route.query.roleId || ''),
  password: '',
})

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const scheduleForm = reactive({
  claimTimeTs: null,
  claimEnabled: false,
})

const selectedFileName = ref('')
const memberBinInputRef = ref(null)

const hhmmToTs = (hhmm) => {
  const text = String(hhmm || '').trim()
  const match = text.match(/^(\d{1,2}):(\d{1,2})$/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  const date = new Date()
  date.setHours(hour, minute, 0, 0)
  return date.getTime()
}

const tsToHHmm = (timestamp, fallback = '16:00') => {
  if (!timestamp) return fallback
  const date = new Date(timestamp)
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${hour}:${minute}`
}

const setMemberToken = (token) => {
  memberToken.value = token || ''
  if (token) {
    sessionStorage.setItem(SESSION_KEY, token)
  } else {
    sessionStorage.removeItem(SESSION_KEY)
  }
}

const applyMember = (member = {}) => {
  memberInfo.roleId = member.roleId || ''
  memberInfo.name = member.name || ''
  memberInfo.boundAt = member.boundAt || ''
  memberInfo.boundBinName = member.boundBinName || ''
  memberInfo.sendTime = member.sendTime || '12:00'
  memberInfo.claimTime = member.claimTime || '16:00'
  memberInfo.claimEnabled = !!member.claimEnabled

  scheduleForm.claimEnabled = !!memberInfo.claimEnabled
  scheduleForm.claimTimeTs = hhmmToTs(memberInfo.claimTime || '16:00')
}

const loadMemberProfile = async (token) => {
  const member = await api.clubCar.memberProfile(token)
  applyMember(member)
}

const restoreSession = async () => {
  const cachedToken = sessionStorage.getItem(SESSION_KEY)
  if (!cachedToken) return
  checkingSession.value = true
  try {
    await loadMemberProfile(cachedToken)
    setMemberToken(cachedToken)
  } catch {
    setMemberToken('')
  } finally {
    checkingSession.value = false
  }
}

const loginMember = async () => {
  if (!loginForm.roleId.trim() || !loginForm.password) {
    message.warning('请输入角色 ID 和密码')
    return
  }

  loggingIn.value = true
  try {
    const payload = await api.clubCar.memberLogin({
      roleId: loginForm.roleId.trim(),
      password: loginForm.password,
    })
    setMemberToken(payload.token)
    applyMember(payload.member)
    loginForm.password = ''
    message.success('登录成功')
  } catch (error) {
    message.error(error.message || '登录失败')
  } finally {
    loggingIn.value = false
  }
}

const setPasswordAndLogin = async () => {
  const roleId = loginForm.roleId.trim()
  const password = loginForm.password
  if (!roleId || !password) {
    message.warning('请输入角色 ID 和密码')
    return
  }
  if (password.length < 6) {
    message.warning('密码至少 6 位')
    return
  }

  settingPassword.value = true
  try {
    const payload = await api.clubCar.memberSetPassword({ roleId, password })
    setMemberToken(payload.token)
    applyMember(payload.member)
    loginForm.password = ''
    message.success('密码设置成功，已自动登录')
  } catch (error) {
    message.error(error.message || '设置密码失败')
  } finally {
    settingPassword.value = false
  }
}

const saveSchedule = async () => {
  savingSchedule.value = true
  try {
    const member = await api.clubCar.memberUpdateSchedule(memberToken.value, {
      claimEnabled: scheduleForm.claimEnabled,
      claimTime: tsToHHmm(scheduleForm.claimTimeTs, memberInfo.claimTime || '16:00'),
    })
    applyMember(member)
    message.success('自动收车设置已保存')
  } catch (error) {
    message.error(error.message || '保存设置失败')
  } finally {
    savingSchedule.value = false
  }
}

const changePassword = async () => {
  if (!passwordForm.currentPassword || !passwordForm.newPassword) {
    message.warning('请填写完整密码信息')
    return
  }
  if (passwordForm.newPassword.length < 6) {
    message.warning('新密码至少 6 位')
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    message.warning('两次新密码不一致')
    return
  }

  changingPassword.value = true
  try {
    await api.clubCar.memberChangePassword(memberToken.value, {
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    })
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
    message.success('密码已更新')
  } catch (error) {
    message.error(error.message || '更新密码失败')
  } finally {
    changingPassword.value = false
  }
}

const handleMemberBinSelected = async (event) => {
  const file = event?.target?.files?.[0]
  event.target.value = ''
  if (!file) return
  selectedFileName.value = file.name

  uploadingBin.value = true
  try {
    const formData = new FormData()
    formData.append('bin', file)
    const member = await api.clubCar.memberBindBin(memberToken.value, formData)
    applyMember(member)
    message.success('BIN 绑定成功')
  } catch (error) {
    message.error(error.message || 'BIN 绑定失败')
  } finally {
    uploadingBin.value = false
  }
}

const logoutMember = () => {
  setMemberToken('')
  applyMember({})
  loginForm.password = ''
}

const formatDate = (value) => {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

onMounted(restoreSession)
</script>

<style scoped lang="scss">
.member-bind-page {
  min-height: 100vh;
  padding: var(--spacing-xl) var(--spacing-sm);
  background: linear-gradient(135deg, #f3f6fb 0%, #e5edf8 100%);
}

.bind-card {
  max-width: 860px;
  margin: 0 auto;
}

.hint {
  margin: 0 0 8px;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.upload-area {
  padding: 12px;
  border: 1px dashed var(--border-light);
  border-radius: 8px;
}

.filename {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  display: inline-flex;
  align-items: center;
}

@media (max-width: 768px) {
  .member-bind-page {
    padding: var(--spacing-md) var(--spacing-xs);
  }
}
</style>
