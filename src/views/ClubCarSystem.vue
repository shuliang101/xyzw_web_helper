<template>
  <div class="club-car-page">
    <div class="page-header">
      <div>
        <h1>发车管理</h1>
        <p>配置主 BIN、同步成员，并按规则管理俱乐部发车安排。</p>
      </div>
      <n-space>
        <n-button @click="fetchAll" :loading="loading">
          刷新
        </n-button>
      </n-space>
    </div>

    <n-spin :show="loading">
      <n-grid cols="1 900:2" :x-gap="16" :y-gap="16" class="top-grid">
        <n-gi>
          <n-card title="基础信息" class="panel-card">
            <n-space vertical :size="12">
              <div class="info-line">
                <span class="info-label">主 BIN</span>
                <span class="info-value">{{ config.masterBinName || '未上传' }}</span>
              </div>
              <div class="info-line">
                <span class="info-label">俱乐部</span>
                <span class="info-value">{{ clubInfo.clubName || '-' }}</span>
              </div>
              <div class="info-line">
                <span class="info-label">会长</span>
                <span class="info-value">{{ clubInfo.leaderName || '-' }}</span>
              </div>
              <div class="info-line">
                <span class="info-label">成员数</span>
                <span class="info-value">{{ members.length }}</span>
              </div>
              <input
                ref="masterBinInputRef"
                type="file"
                accept=".bin,.dmp"
                style="display: none"
                @change="handleMasterBinSelected"
              >
              <n-space>
                <n-button @click="openMasterBinPicker" :loading="uploadingMasterBin">
                  上传主 BIN
                </n-button>
                <n-button type="primary" @click="syncMembers" :loading="syncingMembers">
                  同步成员
                </n-button>
              </n-space>
            </n-space>
          </n-card>
        </n-gi>

        <n-gi>
          <n-card title="执行操作" class="panel-card">
            <n-space vertical :size="12">
              <n-alert type="info" :show-icon="false">
                发车支持周一到周三 06:00 到 20:00 自定义时间。同一天内，同一个发车成员或同一个护送成员的规则，必须至少间隔 4 小时。
              </n-alert>
              <n-space>
                <n-button type="primary" ghost @click="runSendNow" :loading="runningSend">
                  立即发车
                </n-button>
                <n-button type="warning" ghost @click="runClaimNow" :loading="runningClaim">
                  立即收车
                </n-button>
              </n-space>
            </n-space>
          </n-card>
        </n-gi>
      </n-grid>

      <n-card title="添加发车规则" class="panel-card form-card">
        <n-alert
          v-if="!members.length"
          type="warning"
          :show-icon="false"
          style="margin-bottom: 16px"
        >
          请先上传主 BIN 并同步俱乐部成员，再添加发车规则。
        </n-alert>

        <n-form :model="ruleForm" label-placement="top" require-mark-placement="right-hanging">
          <n-grid cols="1 700:2" :x-gap="16">
            <n-gi>
              <n-form-item label="选择护送日期" required>
                <n-select
                  v-model:value="ruleForm.weekday"
                  :options="weekdayOptions"
                  placeholder="请选择护送日期"
                />
              </n-form-item>
            </n-gi>

            <n-gi>
              <n-form-item label="选择护送成员" required>
                <n-select
                  v-model:value="ruleForm.targetRoleId"
                  :options="targetOptions"
                  placeholder="请选择护送成员"
                  filterable
                />
              </n-form-item>
            </n-gi>

            <n-gi>
              <n-form-item label="选择发车成员" required>
                <n-select
                  v-model:value="ruleForm.senderRoleId"
                  :options="senderOptions"
                  placeholder="请选择发车成员"
                  filterable
                />
              </n-form-item>
            </n-gi>

            <n-gi>
              <n-form-item label="选择发车时间" required>
                <n-time-picker
                  v-model:value="ruleForm.sendTimeTs"
                  format="HH:mm"
                  clearable
                  style="width: 100%"
                />
              </n-form-item>
            </n-gi>
          </n-grid>

          <n-form-item label="发车类型" required>
            <n-radio-group v-model:value="ruleForm.sendMode" class="mode-group">
              <n-radio-button
                v-for="option in sendModeOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </n-radio-button>
            </n-radio-group>
          </n-form-item>

          <n-form-item label="是否神券">
            <n-switch v-model:value="ruleForm.useCoupon" />
          </n-form-item>

          <div class="form-tip">
            * 注意：同一天里，同一护送成员或同一发车成员，与已有规则时间间隔需 ≥ 4 小时
          </div>

          <n-space justify="end" style="margin-top: 20px">
            <n-button v-if="editingPlanId" @click="resetRuleForm">
              取消编辑
            </n-button>
            <n-button
              type="primary"
              :disabled="!members.length"
              :loading="savingPlan"
              @click="submitRuleForm"
            >
              {{ editingPlanId ? '保存修改' : '确定' }}
            </n-button>
          </n-space>
        </n-form>
      </n-card>

      <n-card :title="`发车规则列表（${plans.length}）`" class="panel-card">
        <div class="table-scroll">
          <n-table striped :bordered="false">
            <thead>
              <tr>
                <th style="width: 72px">ID</th>
                <th style="width: 120px">护送日期</th>
                <th>护送成员</th>
                <th>发车成员</th>
                <th style="width: 120px">发车类型</th>
                <th style="width: 90px">神券</th>
                <th style="width: 130px">发车时间</th>
                <th style="width: 180px">最近执行</th>
                <th style="width: 170px">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!plans.length">
                <td colspan="9">
                  <div class="empty">暂无发车规则</div>
                </td>
              </tr>
              <tr v-for="plan in plans" :key="plan.id">
                <td>#{{ plan.id }}</td>
                <td>{{ weekdayLabel(plan.weekday) }}</td>
                <td>{{ memberDisplay(plan.target) }}</td>
                <td>{{ memberDisplay(plan.sender) }}</td>
                <td>
                  <n-tag size="small" :type="sendModeTagType(plan.sendMode)">
                    {{ sendModeLabel(plan.sendMode) }}
                  </n-tag>
                </td>
                <td>{{ plan.useCoupon ? '开启' : '关闭' }}</td>
                <td>{{ plan.sendTime || '-' }}</td>
                <td>{{ formatDate(plan.lastRunAt) }}</td>
                <td>
                  <n-space :size="8">
                    <n-button size="small" type="primary" ghost @click="editPlan(plan)">
                      编辑
                    </n-button>
                    <n-popconfirm @positive-click="removePlan(plan.id)">
                      <template #trigger>
                        <n-button size="small" type="error" ghost :loading="deletingPlanId === plan.id">
                          删除
                        </n-button>
                      </template>
                      确认删除该发车规则吗？
                    </n-popconfirm>
                  </n-space>
                </td>
              </tr>
            </tbody>
          </n-table>
        </div>
      </n-card>

      <n-grid cols="1 1000:2" :x-gap="16" :y-gap="16">
        <n-gi>
          <n-card :title="`俱乐部成员（${members.length}）`" class="panel-card">
            <div class="table-scroll">
              <n-table striped :bordered="false">
                <thead>
                  <tr>
                    <th style="width: 72px">ID</th>
                    <th>成员</th>
                    <th style="width: 180px">BIN 绑定</th>
                    <th style="width: 170px">自动收车</th>
                    <th style="width: 160px">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!members.length">
                    <td colspan="5">
                      <div class="empty">暂无成员数据</div>
                    </td>
                  </tr>
                  <tr v-for="member in members" :key="member.id">
                    <td>#{{ member.id }}</td>
                    <td>
                      <div class="member-name">{{ member.name }}</div>
                      <div class="member-role">{{ member.roleId }}</div>
                    </td>
                    <td>
                      <n-tag :type="member.boundBinName ? 'success' : 'warning'" size="small">
                        {{ member.boundBinName ? '已绑定' : '未绑定' }}
                      </n-tag>
                      <div v-if="member.boundBinName" class="sub-text">{{ member.boundBinName }}</div>
                    </td>
                    <td>
                      <div>{{ member.claimEnabled ? '已开启' : '未开启' }}</div>
                      <div class="sub-text">{{ member.claimEnabled ? `收车时间：${member.claimTime}` : '-' }}</div>
                    </td>
                    <td>
                      <n-space :size="8">
                        <n-button size="small" @click="copyBindLink(member)">
                          复制绑定链接
                        </n-button>
                        <n-popconfirm
                          v-if="member.boundBinName"
                          @positive-click="unbindMember(member.id)"
                        >
                          <template #trigger>
                            <n-button size="small" type="error" ghost>
                              解绑 BIN
                            </n-button>
                          </template>
                          确认解绑该成员的 BIN 吗？
                        </n-popconfirm>
                      </n-space>
                    </td>
                  </tr>
                </tbody>
              </n-table>
            </div>
          </n-card>
        </n-gi>

        <n-gi>
          <n-card title="最近执行日志" class="panel-card">
            <template #header-extra>
              <n-button size="small" @click="fetchLogs" :loading="loadingLogs">
                刷新日志
              </n-button>
            </template>

            <n-empty v-if="!logs.length" description="暂无执行日志" />

            <n-timeline v-else>
              <n-timeline-item
                v-for="log in logs"
                :key="log.id"
                :type="timelineType(log.status)"
                :title="`${log.runType} / ${log.status}`"
                :content="log.message"
                :time="formatDate(log.createdAt)"
              />
            </n-timeline>
          </n-card>
        </n-gi>
      </n-grid>
    </n-spin>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useMessage } from 'naive-ui'
import api from '@/api'

const message = useMessage()

const SEND_WINDOW_START_MINUTES = 6 * 60
const SEND_WINDOW_END_MINUTES = 20 * 60

const loading = ref(false)
const syncingMembers = ref(false)
const uploadingMasterBin = ref(false)
const runningSend = ref(false)
const runningClaim = ref(false)
const loadingLogs = ref(false)
const savingPlan = ref(false)
const deletingPlanId = ref(null)
const editingPlanId = ref(null)

const masterBinInputRef = ref(null)

const config = reactive({
  masterBinName: '',
})

const clubInfo = reactive({
  clubId: '',
  clubName: '',
  leaderName: '',
  updatedAt: '',
})

const members = ref([])
const plans = ref([])
const logs = ref([])

const weekdayOptions = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
]

const sendModeOptions = [
  { label: '红车', value: 'red' },
  { label: '金车', value: 'gold' },
  { label: '不刷新', value: 'no_refresh' },
]

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

const tsToHHmm = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${hour}:${minute}`
}

const toMinutesOfDay = (hhmm) => {
  const [hourText = '0', minuteText = '0'] = String(hhmm || '').split(':')
  return (Number(hourText) * 60) + Number(minuteText)
}

const createDefaultRuleForm = () => ({
  weekday: 1,
  targetRoleId: null,
  senderRoleId: null,
  sendMode: 'no_refresh',
  useCoupon: false,
  sendTimeTs: hhmmToTs('06:00'),
})

const ruleForm = reactive(createDefaultRuleForm())

const memberOptions = computed(() =>
  members.value.map(member => ({
    label: `${member.name} (${member.roleId})`,
    value: member.roleId,
  })))

const senderOptions = computed(() =>
  memberOptions.value.filter(option => option.value !== ruleForm.targetRoleId))

const targetOptions = computed(() =>
  memberOptions.value.filter(option => option.value !== ruleForm.senderRoleId))

const applyConfig = (payload = {}) => {
  config.masterBinName = payload.masterBinName || ''
}

const applyClubInfo = (payload = {}) => {
  clubInfo.clubId = payload.clubId || ''
  clubInfo.clubName = payload.clubName || ''
  clubInfo.leaderName = payload.leaderName || ''
  clubInfo.updatedAt = payload.updatedAt || ''
}

const fetchConfig = async () => {
  const data = await api.clubCar.getConfig()
  applyConfig(data)
}

const fetchClubInfo = async () => {
  const data = await api.clubCar.getClubInfo()
  applyClubInfo(data)
}

const fetchMembers = async () => {
  members.value = await api.clubCar.listMembers(true)
}

const fetchPlans = async () => {
  plans.value = await api.clubCar.listSendPlans()
}

const fetchLogs = async () => {
  loadingLogs.value = true
  try {
    logs.value = await api.clubCar.listLogs(20)
  } catch (error) {
    message.error(error.message || '加载日志失败')
  } finally {
    loadingLogs.value = false
  }
}

const fetchAll = async () => {
  loading.value = true
  try {
    await Promise.all([
      fetchConfig(),
      fetchClubInfo(),
      fetchMembers(),
      fetchPlans(),
      fetchLogs(),
    ])
  } catch (error) {
    message.error(error.message || '加载发车管理数据失败')
  } finally {
    loading.value = false
  }
}

const resetRuleForm = () => {
  Object.assign(ruleForm, createDefaultRuleForm())
  editingPlanId.value = null
}

const validateRuleForm = () => {
  const sendTime = tsToHHmm(ruleForm.sendTimeTs)
  const sendMinutes = toMinutesOfDay(sendTime)

  if (!ruleForm.weekday) {
    message.warning('请选择护送日期')
    return false
  }
  if (!ruleForm.targetRoleId) {
    message.warning('请选择护送成员')
    return false
  }
  if (!ruleForm.senderRoleId) {
    message.warning('请选择发车成员')
    return false
  }
  if (ruleForm.targetRoleId === ruleForm.senderRoleId) {
    message.warning('护送成员和发车成员不能相同')
    return false
  }
  if (!sendTime) {
    message.warning('请选择发车时间')
    return false
  }
  if (sendMinutes < SEND_WINDOW_START_MINUTES || sendMinutes > SEND_WINDOW_END_MINUTES) {
    message.warning('发车时间必须在 06:00 到 20:00 之间')
    return false
  }
  return true
}

const submitRuleForm = async () => {
  if (!validateRuleForm()) return

  savingPlan.value = true
  try {
    const payload = {
      weekday: ruleForm.weekday,
      targetRoleId: ruleForm.targetRoleId,
      senderRoleId: ruleForm.senderRoleId,
      sendMode: ruleForm.sendMode,
      useCoupon: ruleForm.useCoupon,
      sendTime: tsToHHmm(ruleForm.sendTimeTs),
    }

    if (editingPlanId.value) {
      await api.clubCar.updateSendPlan(editingPlanId.value, payload)
      message.success('发车规则已更新')
    } else {
      await api.clubCar.createSendPlan(payload)
      message.success('发车规则已添加')
    }

    resetRuleForm()
    await fetchPlans()
  } catch (error) {
    message.error(error.message || '保存发车规则失败')
  } finally {
    savingPlan.value = false
  }
}

const editPlan = (plan) => {
  editingPlanId.value = plan.id
  Object.assign(ruleForm, {
    weekday: Number(plan.weekday || 1),
    targetRoleId: plan.targetRoleId || null,
    senderRoleId: plan.senderRoleId || null,
    sendMode: plan.sendMode || 'no_refresh',
    useCoupon: !!plan.useCoupon,
    sendTimeTs: hhmmToTs(plan.sendTime || '06:00'),
  })
}

const removePlan = async (planId) => {
  deletingPlanId.value = planId
  try {
    await api.clubCar.deleteSendPlan(planId)
    plans.value = plans.value.filter(plan => plan.id !== planId)
    if (editingPlanId.value === planId) {
      resetRuleForm()
    }
    message.success('发车规则已删除')
  } catch (error) {
    message.error(error.message || '删除发车规则失败')
  } finally {
    deletingPlanId.value = null
  }
}

const openMasterBinPicker = () => {
  masterBinInputRef.value?.click?.()
}

const handleMasterBinSelected = async (event) => {
  const file = event?.target?.files?.[0]
  event.target.value = ''
  if (!file) return

  uploadingMasterBin.value = true
  try {
    const formData = new FormData()
    formData.append('bin', file)
    const payload = await api.clubCar.uploadMasterBin(formData)
    applyConfig(payload.config || {})
    applyClubInfo(payload.clubInfo || {})
    await Promise.all([fetchMembers(), fetchPlans(), fetchLogs()])
    message.success('主 BIN 上传成功')
  } catch (error) {
    message.error(error.message || '上传主 BIN 失败')
  } finally {
    uploadingMasterBin.value = false
  }
}

const syncMembers = async () => {
  syncingMembers.value = true
  try {
    await api.clubCar.syncMembers()
    await Promise.all([fetchClubInfo(), fetchMembers(), fetchPlans()])
    message.success('成员已同步')
  } catch (error) {
    message.error(error.message || '同步成员失败')
  } finally {
    syncingMembers.value = false
  }
}

const runSendNow = async () => {
  runningSend.value = true
  try {
    const result = await api.clubCar.runSendNow()
    message.success(result?.message || '已执行发车任务')
    await Promise.all([fetchPlans(), fetchLogs(), fetchMembers()])
  } catch (error) {
    message.error(error.message || '执行发车任务失败')
  } finally {
    runningSend.value = false
  }
}

const runClaimNow = async () => {
  runningClaim.value = true
  try {
    const result = await api.clubCar.runClaimNow()
    message.success(result?.message || '已执行收车任务')
    await Promise.all([fetchLogs(), fetchMembers()])
  } catch (error) {
    message.error(error.message || '执行收车任务失败')
  } finally {
    runningClaim.value = false
  }
}

const buildBindUrl = (member) =>
  `${window.location.origin}/club-car/bind?roleId=${encodeURIComponent(member.roleId)}`

const copyBindLink = async (member) => {
  try {
    await navigator.clipboard.writeText(buildBindUrl(member))
    message.success('绑定链接已复制')
  } catch {
    message.error('复制失败，请检查浏览器权限')
  }
}

const unbindMember = async (memberId) => {
  try {
    await api.clubCar.unbindMemberBin(memberId)
    await fetchMembers()
    message.success('BIN 已解绑')
  } catch (error) {
    message.error(error.message || '解绑 BIN 失败')
  }
}

const weekdayLabel = (weekday) => {
  const match = weekdayOptions.find(item => item.value === Number(weekday))
  return match?.label || `周${weekday}`
}

const sendModeLabel = (mode) => {
  const match = sendModeOptions.find(item => item.value === mode)
  return match?.label || mode || '-'
}

const sendModeTagType = (mode) => {
  if (mode === 'gold') return 'warning'
  if (mode === 'no_refresh') return 'default'
  return 'error'
}

const memberDisplay = (member) => {
  if (!member) return '-'
  return `${member.name} (${member.roleId})`
}

const timelineType = (status) => {
  if (status === 'success') return 'success'
  if (status === 'partial') return 'warning'
  return 'error'
}

const formatDate = (value) => {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

onMounted(fetchAll)
</script>

<style scoped lang="scss">
.club-car-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.page-header h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
}

.page-header p {
  margin: 8px 0 0;
  color: var(--text-secondary);
}

.panel-card {
  border-radius: 16px;
}

.top-grid {
  align-items: stretch;
}

.info-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.info-label {
  color: var(--text-secondary);
}

.info-value {
  font-weight: 600;
  color: var(--text-primary);
  text-align: right;
}

.mode-group {
  display: flex;
  width: 100%;
}

.mode-group :deep(.n-radio-button) {
  flex: 1;
  text-align: center;
}

.form-tip {
  color: #d03050;
  font-size: 14px;
}

.table-scroll {
  overflow-x: auto;
}

.empty {
  padding: 24px 0;
  text-align: center;
  color: var(--text-secondary);
}

.member-name {
  font-weight: 600;
  color: var(--text-primary);
}

.member-role,
.sub-text {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .club-car-page {
    gap: 12px;
  }

  .page-header h1 {
    font-size: 24px;
  }
}
</style>
