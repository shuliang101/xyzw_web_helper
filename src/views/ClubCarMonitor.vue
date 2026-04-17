<template>
  <div class="club-car-monitor-page">
    <div class="monitor-hero">
      <div>
        <div class="monitor-kicker">Club Car Monitor</div>
        <h1>发车监视</h1>
        <p>{{ pageSubtitle }}</p>
      </div>
      <n-space>
        <n-button v-if="isAdmin" @click="goManage">
          管理页
        </n-button>
        <n-button type="primary" :loading="loading" @click="fetchAll">
          刷新
        </n-button>
      </n-space>
    </div>

    <n-spin :show="loading">
      <n-card class="panel-card" style="margin-bottom: 16px">
        <n-grid cols="1 700:3" :x-gap="12" :y-gap="12">
          <n-gi>
            <div class="filter-block">
              <div class="summary-label">护送人筛选</div>
              <n-select
                v-model:value="selectedTargetRoleId"
                :options="targetFilterOptions"
                placeholder="选择护送人"
                clearable
                filterable
              />
            </div>
          </n-gi>
          <n-gi>
            <div class="filter-block">
              <div class="summary-label">活动日</div>
              <div class="filter-value">{{ todayLabel }}</div>
            </div>
          </n-gi>
          <n-gi>
            <div class="filter-block">
              <div class="summary-label">说明</div>
              <div class="filter-value">只看今天，状态简化为未发送、成功、失败、部分完成</div>
            </div>
          </n-gi>
        </n-grid>
      </n-card>

      <n-card title="今天时间轴" class="panel-card">
        <template #header-extra>
          <span class="minor-text">自动刷新 10 秒</span>
        </template>

        <n-empty v-if="!timelinePlans.length" description="今天没有可展示的发车计划" />

        <div v-else class="timeline-list">
          <div
            v-for="plan in timelinePlans"
            :key="plan.id"
            class="timeline-item"
          >
            <div class="timeline-rail">
              <div class="timeline-dot" :class="`is-${plan.status}`"></div>
              <div class="timeline-line"></div>
            </div>

            <div class="timeline-content">
              <div class="timeline-top">
                <div>
                  <div class="timeline-time">{{ plan.sendTime }}</div>
                  <div class="timeline-member">{{ plan.senderName }}</div>
                </div>
                <n-space size="small">
                  <n-tag size="small" :type="sendModeTagType(plan.sendMode)">
                    {{ sendModeLabel(plan.sendMode) }}
                  </n-tag>
                  <n-tag size="small" :type="statusTagType(plan.status)">
                    {{ plan.statusText }}
                  </n-tag>
                </n-space>
              </div>

              <div class="timeline-meta">
                <span>护送人: {{ plan.targetName }}</span>
                <span v-if="plan.latestAttemptAt">最近尝试: {{ formatDateTime(plan.latestAttemptAt) }}</span>
              </div>
            </div>
          </div>
        </div>
      </n-card>
    </n-spin>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import api from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useTokenStore } from '@/stores/tokenStore'

const router = useRouter()
const message = useMessage()
const authStore = useAuthStore()
const tokenStore = useTokenStore()

const loading = ref(false)
const plans = ref([])
const logs = ref([])
const selectedTargetRoleId = ref(null)
let refreshTimer = null
const isAdmin = computed(() => authStore.user?.role === 'admin')
const currentRoleId = computed(() => {
  if (isAdmin.value) return ''
  return String(tokenStore.selectedToken?.id || '')
})

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

const getLocalWeekday = (date = new Date()) => {
  const weekday = date.getDay()
  return weekday >= 1 && weekday <= 3 ? weekday : 0
}

const isSameLocalDate = (left, right) =>
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate()

const parseDateSafe = (value) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const toMinutesOfDay = (hhmm) => {
  const [hourText = '0', minuteText = '0'] = String(hhmm || '').split(':')
  return (Number(hourText) * 60) + Number(minuteText)
}

const weekdayLabel = (weekday) =>
  weekdayOptions.find(item => item.value === Number(weekday))?.label || '-'

const sendModeLabel = (mode) =>
  sendModeOptions.find(item => item.value === mode)?.label || mode || '-'

const sendModeTagType = (mode) => {
  if (mode === 'gold') return 'warning'
  if (mode === 'no_refresh') return 'default'
  return 'error'
}

const statusTagType = (status) => {
  if (status === 'completed') return 'success'
  if (status === 'partial') return 'warning'
  if (status === 'pending') return 'default'
  if (status === 'waiting') return 'info'
  return 'error'
}

const now = () => new Date()

const todayWeekday = computed(() => getLocalWeekday(now()))
const todayLabel = computed(() => todayWeekday.value ? weekdayLabel(todayWeekday.value) : '今天不是活动日')

const pageSubtitle = computed(() => {
  if (!todayWeekday.value) return '今天不是周一到周三，页面会继续显示今天的执行记录。'
  if (!isAdmin.value && currentRoleId.value) {
    return `${todayLabel.value}的计划安排和执行结果。当前仅展示与角色 ${currentRoleId.value} 相关的数据。`
  }
  return `${todayLabel.value}的计划安排、实时执行结果和重试状态都在这里。`
})

const todayPlans = computed(() => {
  if (!todayWeekday.value) return []
  return [...plans.value]
    .filter(plan => Number(plan.weekday) === todayWeekday.value)
    .sort((left, right) => toMinutesOfDay(left.sendTime) - toMinutesOfDay(right.sendTime))
})

const targetFilterOptions = computed(() => {
  const grouped = new Map()
  for (const plan of todayPlans.value) {
    const value = String(plan.targetRoleId || '')
    if (!value || grouped.has(value)) continue
    grouped.set(value, {
      label: `${plan.target?.name || value} (${value})`,
      value,
    })
  }
  return [...grouped.values()]
})

const todaySendLogs = computed(() => logs.value.filter((log) => {
  if (!String(log.runType || '').startsWith('send')) return false
  const createdAt = parseDateSafe(log.createdAt)
  return createdAt ? isSameLocalDate(createdAt, now()) : false
}))

const latestAttemptMap = computed(() => {
  const map = new Map()

  for (const log of todaySendLogs.value) {
    const createdAt = parseDateSafe(log.createdAt)
    const items = Array.isArray(log?.detail?.detail) ? log.detail.detail : []
    for (const item of items) {
      const planId = Number(item.planId || 0)
      if (!planId) continue
      const current = map.get(planId)
      if (!current || createdAt > current.createdAt) {
        map.set(planId, {
          createdAt,
          item,
        })
      }
    }
  }

  return map
})

const todayPlanCards = computed(() => {
  const current = now()
  const currentMinutes = (current.getHours() * 60) + current.getMinutes()

  return todayPlans.value.map((plan) => {
    const latest = latestAttemptMap.value.get(Number(plan.id))
    const item = latest?.item || null
    const sendMinutes = toMinutesOfDay(plan.sendTime)

    let status = 'pending'
    let statusText = '待执行'

    if (item?.completed) {
      status = 'completed'
      statusText = '成功'
    } else if (item?.sent > 0) {
      status = 'partial'
      statusText = '部分完成'
    } else if (item?.errors?.length) {
      status = 'failed'
      statusText = '执行失败'
    } else if (item?.skippedReason) {
      status = currentMinutes >= sendMinutes ? 'waiting' : 'pending'
      statusText = '未发送'
    } else if (currentMinutes > sendMinutes) {
      status = 'waiting'
      statusText = '未发送'
    }

    return {
      ...plan,
      senderName: plan.sender?.name || plan.senderRoleId || '-',
      targetName: plan.target?.name || plan.targetRoleId || '-',
      latestAttemptAt: latest?.createdAt?.toISOString?.() || '',
      status,
      statusText,
    }
  })
})

const filteredPlanCards = computed(() => {
  if (!selectedTargetRoleId.value) return todayPlanCards.value
  return todayPlanCards.value.filter(item => String(item.targetRoleId) === String(selectedTargetRoleId.value))
})

const timelinePlans = computed(() => filteredPlanCards.value)

const fetchAll = async () => {
  loading.value = true
  try {
    const [planData, logData] = await Promise.all([
      api.clubCar.listSendPlans(currentRoleId.value),
      api.clubCar.listLogs(50, currentRoleId.value),
    ])
    plans.value = planData
    logs.value = logData
  } catch (error) {
    message.error(error.message || '加载监视数据失败')
  } finally {
    loading.value = false
  }
}

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = parseDateSafe(value)
  if (!date) return value
  return date.toLocaleString()
}

const goManage = () => {
  router.push('/admin/club-car')
}

onMounted(() => {
  fetchAll()
  refreshTimer = window.setInterval(() => {
    if (!loading.value) {
      fetchAll()
    }
  }, 10000)
})

onUnmounted(() => {
  if (refreshTimer) {
    window.clearInterval(refreshTimer)
    refreshTimer = null
  }
})
</script>

<style scoped lang="scss">
.club-car-monitor-page {
  min-height: 100vh;
  padding: 20px;
  background:
    radial-gradient(circle at top right, rgba(208, 48, 80, 0.12), transparent 28%),
    radial-gradient(circle at top left, rgba(24, 160, 88, 0.12), transparent 24%),
    linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
}

.monitor-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  padding: 20px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(15, 23, 42, 0.06);
  backdrop-filter: blur(12px);
}

.monitor-kicker {
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #d03050;
}

.monitor-hero h1 {
  margin: 8px 0;
  font-size: 32px;
  line-height: 1.1;
}

.monitor-hero p {
  margin: 0;
  color: var(--text-secondary);
}

.summary-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.panel-card {
  border-radius: 18px;
}

.minor-text {
  font-size: 12px;
  color: var(--text-secondary);
}

.filter-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-value {
  min-height: 40px;
  display: flex;
  align-items: center;
  font-size: 13px;
  color: var(--text-primary);
}

.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.timeline-item {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: 12px;
  min-height: 110px;
}

.timeline-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.timeline-dot {
  width: 14px;
  height: 14px;
  margin-top: 8px;
  border-radius: 999px;
  border: 3px solid #cbd5e1;
  background: #fff;
  z-index: 1;
}

.timeline-dot.is-completed {
  border-color: #18a058;
}

.timeline-dot.is-partial {
  border-color: #f0a020;
}

.timeline-dot.is-failed {
  border-color: #d03050;
}

.timeline-dot.is-waiting,
.timeline-dot.is-pending {
  border-color: #2080f0;
}

.timeline-line {
  width: 2px;
  flex: 1;
  margin-top: 6px;
  background: rgba(148, 163, 184, 0.5);
}

.timeline-item:last-child .timeline-line {
  opacity: 0;
}

.timeline-content {
  padding: 14px;
  margin-bottom: 12px;
  border-radius: 16px;
  background: #f8fafc;
  border: 1px solid rgba(15, 23, 42, 0.06);
}

.timeline-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.timeline-time {
  font-size: 24px;
  font-weight: 700;
  line-height: 1;
}

.timeline-member {
  margin-top: 6px;
  font-weight: 600;
}

.timeline-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .club-car-monitor-page {
    padding: 12px;
  }

  .monitor-hero {
    flex-direction: column;
    padding: 16px;
  }

  .monitor-hero h1 {
    font-size: 28px;
  }

  .timeline-top {
    flex-direction: column;
  }
}
</style>
