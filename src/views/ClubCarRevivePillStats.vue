<template>
  <div class="revive-stats-page">
    <div class="stats-header">
      <div>
        <div class="stats-kicker">Club Car Revive Pills</div>
        <h1>复活丹统计</h1>
        <p>按日期区间查看成员复活丹库存变化。</p>
      </div>
      <n-space>
        <n-button v-if="isAdmin" @click="goManage">管理页</n-button>
        <n-button @click="goMonitor">监视页</n-button>
        <n-button :loading="exportingImage" @click="exportImage">导出图片</n-button>
        <n-button :loading="exportingTable" @click="exportTable">导出表格</n-button>
        <n-button type="primary" :loading="loading" @click="fetchStats">刷新</n-button>
      </n-space>
    </div>

    <n-spin :show="loading">
      <div ref="exportPanelRef" class="export-panel">
        <n-card class="panel-card filter-card">
          <n-grid cols="1 720:4" :x-gap="12" :y-gap="12">
            <n-gi>
              <div class="field-block">
                <div class="field-label">开始日期</div>
                <input v-model="filters.startDate" class="date-input" type="date">
              </div>
            </n-gi>
            <n-gi>
              <div class="field-block">
                <div class="field-label">结束日期</div>
                <input v-model="filters.endDate" class="date-input" type="date">
              </div>
            </n-gi>
            <n-gi>
              <div class="field-block">
                <div class="field-label">成员筛选</div>
                <n-select
                  v-model:value="filters.roleId"
                  :options="memberOptions"
                  placeholder="全部成员"
                  clearable
                  filterable
                />
              </div>
            </n-gi>
            <n-gi>
              <div class="field-block">
                <div class="field-label">统计范围</div>
                <div class="range-summary">{{ rangeSummary }}</div>
              </div>
            </n-gi>
          </n-grid>
        </n-card>

        <n-grid cols="1 900:4" :x-gap="12" :y-gap="12" class="summary-grid">
          <n-gi>
            <div class="summary-tile">
              <span>成员数</span>
              <strong>{{ memberSummaries.length }}</strong>
            </div>
          </n-gi>
          <n-gi>
            <div class="summary-tile">
              <span>记录数</span>
              <strong>{{ stats.length }}</strong>
            </div>
          </n-gi>
          <n-gi>
            <div class="summary-tile">
              <span>最新总量</span>
              <strong>{{ formatNumber(latestTotal) }}</strong>
            </div>
          </n-gi>
          <n-gi>
            <div class="summary-tile">
              <span>区间变化</span>
              <strong :class="changeClass(totalChange)">{{ signedNumber(totalChange) }}</strong>
            </div>
          </n-gi>
        </n-grid>

        <n-card title="成员变化" class="panel-card">
          <n-empty v-if="!memberSummaries.length" description="暂无复活丹统计数据" />
          <div v-else class="table-scroll">
            <n-table striped :bordered="false">
              <thead>
                <tr>
                  <th>成员</th>
                  <th>角色 ID</th>
                  <th>期初</th>
                  <th>最新</th>
                  <th>变化</th>
                  <th>最后采样</th>
                  <th>每周趋势</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="member in memberSummaries" :key="member.roleId">
                  <td>{{ member.name }}</td>
                  <td>{{ member.roleId }}</td>
                  <td>{{ formatNumber(member.firstCount) }}</td>
                  <td>{{ formatNumber(member.latestCount) }}</td>
                  <td :class="changeClass(member.change)">{{ signedNumber(member.change) }}</td>
                  <td>{{ formatDateTime(member.latestSampledAt) }}</td>
                  <td>
                    <div class="sparkline">
                      <div
                        v-for="point in member.weeklyPoints"
                        :key="`${member.roleId}-${point.weekKey}`"
                        class="spark-point"
                        :title="`${point.weekLabel}: ${point.revivePillCount}`"
                      >
                        <div class="spark-bar" :style="{ height: `${barHeight(point.revivePillCount)}%` }"></div>
                        <span>{{ point.weekLabel }}</span>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </n-table>
          </div>
        </n-card>

      </div>
    </n-spin>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import html2canvas from 'html2canvas'
import * as XLSX from 'xlsx'
import api from '@/api'
import { useAuthStore } from '@/stores/auth'
import { downloadCanvasAsImage } from '@/utils/imageExport'

const router = useRouter()
const message = useMessage()
const authStore = useAuthStore()

const loading = ref(false)
const exportingImage = ref(false)
const exportingTable = ref(false)
const exportPanelRef = ref(null)
const stats = ref([])

const isAdmin = computed(() => authStore.user?.role === 'admin')

const todayText = () => {
  const date = new Date()
  return date.toISOString().slice(0, 10)
}

const daysAgoText = (days) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

const filters = reactive({
  startDate: daysAgoText(6),
  endDate: todayText(),
  roleId: null,
})

const dateKeys = computed(() => [...new Set(stats.value.map(item => item.statDate).filter(Boolean))].sort())

const maxCount = computed(() => Math.max(1, ...stats.value.map(item => Number(item.revivePillCount || 0))))

const getWeekStartDate = (dateText) => {
  const date = new Date(`${dateText}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  const weekday = date.getDay() || 7
  date.setDate(date.getDate() - weekday + 1)
  return date.toISOString().slice(0, 10)
}

const getWeekLabel = (weekKey) => {
  if (!weekKey) return '-'
  const date = new Date(`${weekKey}T00:00:00`)
  if (Number.isNaN(date.getTime())) return weekKey
  const end = new Date(date)
  end.setDate(date.getDate() + 6)
  return `${weekKey.slice(5)}~${end.toISOString().slice(5)}`
}

const buildWeeklyPoints = (points = []) => {
  const grouped = new Map()
  for (const point of points) {
    const weekKey = getWeekStartDate(point.statDate)
    if (!weekKey) continue
    const existing = grouped.get(weekKey)
    if (!existing || new Date(point.sampledAt || 0) > new Date(existing.sampledAt || 0)) {
      grouped.set(weekKey, {
        ...point,
        weekKey,
        weekLabel: getWeekLabel(weekKey),
      })
    }
  }
  return [...grouped.values()].sort((left, right) => left.weekKey.localeCompare(right.weekKey))
}

const memberSummaries = computed(() => {
  const grouped = new Map()
  for (const item of stats.value) {
    const key = String(item.roleId || '')
    if (!key) continue
    if (!grouped.has(key)) {
      grouped.set(key, {
        roleId: key,
        name: item.name || key,
        byDate: new Map(),
      })
    }
    const entry = grouped.get(key)
    const existing = entry.byDate.get(item.statDate)
    if (!existing || new Date(item.sampledAt || 0) > new Date(existing.sampledAt || 0)) {
      entry.byDate.set(item.statDate, item)
      entry.name = item.name || entry.name
    }
  }

  return [...grouped.values()]
    .map((entry) => {
      const points = dateKeys.value
        .map(date => entry.byDate.get(date))
        .filter(Boolean)
        .sort((left, right) => String(left.statDate).localeCompare(String(right.statDate)))
      const first = points[0] || null
      const latest = points[points.length - 1] || null
      const firstCount = Number(first?.revivePillCount || 0)
      const latestCount = Number(latest?.revivePillCount || 0)
      return {
        roleId: entry.roleId,
        name: entry.name,
        firstCount,
        latestCount,
        change: latestCount - firstCount,
        latestSampledAt: latest?.sampledAt || '',
        points,
        weeklyPoints: buildWeeklyPoints(points),
      }
    })
    .sort((left, right) => right.latestCount - left.latestCount)
})

const memberOptions = computed(() => memberSummaries.value.map(member => ({
  label: `${member.name} (${member.roleId})`,
  value: member.roleId,
})))

const latestTotal = computed(() =>
  memberSummaries.value.reduce((sum, member) => sum + Number(member.latestCount || 0), 0))

const totalChange = computed(() =>
  memberSummaries.value.reduce((sum, member) => sum + Number(member.change || 0), 0))

const rangeSummary = computed(() => {
  const start = filters.startDate || '-'
  const end = filters.endDate || '-'
  return `${start} 至 ${end}`
})

const fetchStats = async () => {
  if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
    message.warning('开始日期不能晚于结束日期')
    return
  }

  loading.value = true
  try {
    stats.value = await api.clubCar.listRevivePillStats({
      startDate: filters.startDate,
      endDate: filters.endDate,
      roleId: filters.roleId,
      limit: 1000,
    })
  } catch (error) {
    message.error(error.message || '加载复活丹统计失败')
  } finally {
    loading.value = false
  }
}

const formatNumber = (value) => Number(value || 0).toLocaleString()

const signedNumber = (value) => {
  const number = Number(value || 0)
  if (number > 0) return `+${formatNumber(number)}`
  return formatNumber(number)
}

const changeClass = (value) => {
  const number = Number(value || 0)
  if (number > 0) return 'is-up'
  if (number < 0) return 'is-down'
  return ''
}

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const barHeight = (value) => Math.max(8, Math.round((Number(value || 0) / maxCount.value) * 100))

const exportFileBaseName = computed(() => {
  const start = filters.startDate || 'start'
  const end = filters.endDate || 'end'
  return `复活丹统计_${start}_${end}`
})

const exportTable = () => {
  if (!memberSummaries.value.length) {
    message.warning('暂无可导出的统计数据')
    return
  }

  exportingTable.value = true
  try {
    const workbook = XLSX.utils.book_new()
    const summaryRows = memberSummaries.value.map(member => ({
      成员: member.name,
      角色ID: member.roleId,
      期初: member.firstCount,
      最新: member.latestCount,
      变化: member.change,
      最后采样: formatDateTime(member.latestSampledAt),
      每周趋势: member.weeklyPoints
        .map(point => `${point.weekLabel}: ${point.revivePillCount}`)
        .join('；'),
    }))
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(summaryRows),
      '成员变化',
    )
    XLSX.writeFile(workbook, `${exportFileBaseName.value}.xlsx`)
  } catch (error) {
    message.error(error.message || '导出表格失败')
  } finally {
    exportingTable.value = false
  }
}

const exportImage = async () => {
  if (!exportPanelRef.value) return
  if (!memberSummaries.value.length) {
    message.warning('暂无可导出的统计数据')
    return
  }

  exportingImage.value = true
  try {
    await nextTick()
    const canvas = await html2canvas(exportPanelRef.value, {
      backgroundColor: '#f8fafc',
      scale: Math.min(window.devicePixelRatio || 1, 2),
      useCORS: true,
      allowTaint: true,
    })
    downloadCanvasAsImage(canvas, `${exportFileBaseName.value}.png`)
  } catch (error) {
    message.error(error.message || '导出图片失败')
  } finally {
    exportingImage.value = false
  }
}

const goManage = () => {
  router.push('/admin/club-car')
}

const goMonitor = () => {
  router.push('/club-car/monitor')
}

onMounted(fetchStats)
</script>

<style scoped lang="scss">
.revive-stats-page {
  min-height: 100vh;
  padding: 20px;
  background:
    linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
}

.stats-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  padding: 20px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(15, 23, 42, 0.08);
}

.stats-kicker {
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #d03050;
}

.stats-header h1 {
  margin: 8px 0;
  font-size: 32px;
  line-height: 1.1;
}

.stats-header p {
  margin: 0;
  color: var(--text-secondary);
}

.panel-card {
  margin-bottom: 16px;
  border-radius: 8px;
}

.export-panel {
  background: #f8fafc;
}

.filter-card {
  margin-bottom: 12px;
}

.field-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.date-input {
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: 1px solid rgba(224, 224, 230, 1);
  border-radius: 3px;
  background: #fff;
  color: var(--text-primary);
}

.range-summary {
  min-height: 34px;
  display: flex;
  align-items: center;
  font-size: 13px;
}

.summary-grid {
  margin-bottom: 16px;
}

.summary-tile {
  min-height: 84px;
  padding: 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 8px;
  background: #fff;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.summary-tile span {
  color: var(--text-secondary);
  font-size: 12px;
}

.summary-tile strong {
  font-size: 26px;
  line-height: 1;
}

.table-scroll {
  overflow-x: auto;
}

.is-up {
  color: #18a058;
  font-weight: 700;
}

.is-down {
  color: #d03050;
  font-weight: 700;
}

.sparkline {
  min-width: 220px;
  height: 74px;
  display: flex;
  align-items: flex-end;
  gap: 6px;
}

.spark-point {
  width: 30px;
  height: 74px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  gap: 4px;
}

.spark-bar {
  width: 100%;
  min-height: 6px;
  border-radius: 4px 4px 0 0;
  background: #2080f0;
}

.spark-point span {
  font-size: 10px;
  color: var(--text-secondary);
  white-space: nowrap;
}

@media (max-width: 768px) {
  .revive-stats-page {
    padding: 12px;
  }

  .stats-header {
    flex-direction: column;
    padding: 16px;
  }

  .stats-header h1 {
    font-size: 28px;
  }
}
</style>
