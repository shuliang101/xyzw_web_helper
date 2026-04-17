<template>
  <div class="server-tasks-page">
    <div class="page-header">
      <div style="display: flex; align-items: center; gap: 12px">
        <h2>定时任务</h2>
        <n-tag type="success" size="small">服务端执行</n-tag>
      </div>
      <n-button type="primary" @click="openCreateModal">
        <template #icon><n-icon><Add /></n-icon></template>
        新建任务
      </n-button>
    </div>

    <n-spin :show="loading">
      <div v-if="tasks.length === 0" class="empty-state">
        <n-empty description="暂无定时任务，点击「新建任务」创建" />
      </div>

      <div v-else class="task-list">
        <n-card
          v-for="task in tasks"
          :key="task.id"
          class="task-card"
          :class="{ disabled: !task.enabled }"
        >
          <div class="task-header">
            <div class="task-info">
              <span class="task-name">{{ task.name }}</span>
              <n-tag :type="task.enabled ? 'success' : 'default'" size="small">
                {{ task.enabled ? '已启用' : '已禁用' }}
              </n-tag>
              <n-tag type="info" size="small">
                {{ task.runType === 'daily' ? `每天 ${task.runTime}` : task.cronExpression }}
              </n-tag>
              <n-tag size="small">{{ getValidBinCount(task.binIds) }} 个角色</n-tag>
            </div>
            <div class="task-actions">
              <n-button size="small" @click="runNow(task)" :loading="runningIds.has(task.id)">
                立即执行
              </n-button>
              <n-button size="small" @click="viewLogs(task)">日志</n-button>
              <n-button size="small" @click="editTask(task)">编辑</n-button>
              <n-button
                size="small"
                :type="task.enabled ? 'warning' : 'success'"
                @click="toggleTask(task)"
              >
                {{ task.enabled ? '禁用' : '启用' }}
              </n-button>
              <n-popconfirm @positive-click="deleteTask(task.id)">
                <template #trigger>
                  <n-button size="small" type="error">删除</n-button>
                </template>
                确认删除任务「{{ task.name }}」？
              </n-popconfirm>
            </div>
          </div>
          <div class="task-meta">
            <span v-if="task.lastRunAt">上次执行：{{ formatTime(task.lastRunAt) }}</span>
            <span v-else>从未执行</span>
            <span>任务：{{ task.selectedTasks.length > 0 ? task.selectedTasks.map(t => taskLabelMap[t] || t).join('、') : '日常任务' }}</span>
            <span v-if="getValidBinCount(task.binIds) > 0">角色：{{ getBinNames(task.binIds) }}</span>
            <span v-else>角色：-</span>
          </div>
        </n-card>
      </div>
    </n-spin>

    <!-- 创建/编辑弹窗 -->
    <n-modal v-model:show="showModal" :title="editingTask ? '编辑任务' : '新建任务'" preset="card" style="width: 620px">
      <n-form :model="form" label-placement="left" label-width="90px">
        <n-form-item label="任务名称" required>
          <n-input v-model:value="form.name" placeholder="例如：每日任务-全部账号" />
        </n-form-item>

        <n-form-item label="执行方式" required>
          <n-radio-group v-model:value="form.runType">
            <n-radio value="daily">每天固定时间</n-radio>
            <n-radio value="cron">Cron 表达式</n-radio>
          </n-radio-group>
        </n-form-item>

        <n-form-item v-if="form.runType === 'daily'" label="执行时间" required>
          <n-time-picker v-model:value="form.runTimeTs" format="HH:mm" style="width: 100%" />
        </n-form-item>

        <n-form-item v-if="form.runType === 'cron'" label="Cron 表达式" required>
          <n-input v-model:value="form.cronExpression" placeholder="例如：0 8 * * * (每天8点)" />
        </n-form-item>

        <n-form-item label="选择角色" required>
          <div style="width: 100%">
            <n-spin :show="binsLoading" style="width: 100%">
              <div v-if="bins.length === 0 && !binsLoading" style="color: #999; font-size: 13px; padding: 8px 0">
                暂无已上传的 bin 文件，请先在「Token管理」页上传
              </div>
              <n-checkbox-group v-else v-model:value="form.binIds" style="width: 100%">
                <div class="bin-list">
                  <n-checkbox
                    v-for="bin in bins"
                    :key="bin.id"
                    :value="bin.id"
                    class="bin-item"
                  >
                    <span>{{ bin.originalName }}</span>
                    <span style="color: #999; font-size: 11px; margin-left: 6px">{{ formatSize(bin.size) }}</span>
                  </n-checkbox>
                </div>
              </n-checkbox-group>
            </n-spin>
            <div style="margin-top: 6px; font-size: 12px; color: #999">
              已选 {{ form.binIds.length }} 个角色
            </div>
          </div>
        </n-form-item>

        <n-form-item label="执行任务">
          <n-space vertical style="width: 100%">
            <n-checkbox-group v-model:value="form.selectedTasks">
              <n-space>
                <n-checkbox v-for="t in availableServerTasks" :key="t.value" :value="t.value">{{ t.label }}</n-checkbox>
              </n-space>
            </n-checkbox-group>
            <span style="font-size: 12px; color: #999">不选则默认执行日常任务</span>
          </n-space>
        </n-form-item>

        <n-form-item label="任务设置">
          <n-space vertical style="width: 100%">
            <n-grid :cols="2" :x-gap="12">
              <n-gi>
                <n-form-item label="竞技场阵容" label-placement="left" label-width="80px">
                  <n-input-number v-model:value="form.taskSettings.arenaFormation" :min="1" :max="6" style="width: 100%" />
                </n-form-item>
              </n-gi>
              <n-gi>
                <n-form-item label="爬塔阵容" label-placement="left" label-width="80px">
                  <n-input-number v-model:value="form.taskSettings.towerFormation" :min="1" :max="6" style="width: 100%" />
                </n-form-item>
              </n-gi>
              <n-gi>
                <n-form-item label="BOSS阵容" label-placement="left" label-width="80px">
                  <n-input-number v-model:value="form.taskSettings.bossFormation" :min="1" :max="6" style="width: 100%" />
                </n-form-item>
              </n-gi>
              <n-gi>
                <n-form-item label="BOSS次数" label-placement="left" label-width="80px">
                  <n-input-number v-model:value="form.taskSettings.bossTimes" :min="0" :max="4" style="width: 100%" />
                </n-form-item>
              </n-gi>
            </n-grid>
            <n-space>
              <n-checkbox v-model:checked="form.taskSettings.arenaEnable">竞技场</n-checkbox>
              <n-checkbox v-model:checked="form.taskSettings.claimHangUp">挂机奖励</n-checkbox>
              <n-checkbox v-model:checked="form.taskSettings.claimBottle">盐罐奖励</n-checkbox>
              <n-checkbox v-model:checked="form.taskSettings.claimEmail">邮件奖励</n-checkbox>
              <n-checkbox v-model:checked="form.taskSettings.payRecruit">付费招募</n-checkbox>
              <n-checkbox v-model:checked="form.taskSettings.openBox">开宝箱</n-checkbox>
              <n-checkbox v-model:checked="form.taskSettings.blackMarketPurchase">黑市采购</n-checkbox>
            </n-space>
          </n-space>
        </n-form-item>

        <n-form-item label="启用">
          <n-switch v-model:value="form.enabled" />
        </n-form-item>
      </n-form>

      <template #footer>
        <n-space justify="end">
          <n-button @click="showModal = false">取消</n-button>
          <n-button type="primary" :loading="saving" @click="saveTask">保存</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 日志弹窗 -->
    <n-modal v-model:show="showLogsModal" :title="`执行日志 - ${logsTask?.name}`" preset="card" style="width: 700px">
      <n-spin :show="logsLoading">
        <div v-if="logs.length === 0" style="text-align: center; padding: 20px; color: #999">暂无执行记录</div>
        <n-collapse v-else>
          <n-collapse-item
            v-for="log in logs"
            :key="log.id"
            :title="`${formatTime(log.startedAt)} - ${getBinNameById(log.tokenId)}`"
            :name="log.id"
          >
            <template #header-extra>
              <n-tag :type="statusType(log.status)" size="small">{{ statusLabel(log.status) }}</n-tag>
            </template>
            <div class="log-entries">
              <div
                v-for="(entry, i) in log.logs"
                :key="i"
                class="log-entry"
                :class="entry.type"
              >
                <span class="log-time">{{ entry.time }}</span>
                <span class="log-msg">{{ entry.message }}</span>
              </div>
            </div>
          </n-collapse-item>
        </n-collapse>
      </n-spin>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useMessage } from 'naive-ui'
import { Add } from '@vicons/ionicons5'
import api from '@/api/index.js'

const availableServerTasks = [
  { label: '日常任务', value: 'startBatch' },
  { label: '一键爬塔', value: 'climbTower' },
]

const availableServerTaskValues = new Set(availableServerTasks.map(t => t.value))
const sanitizeSelectedTasks = (selectedTasks) => Array.isArray(selectedTasks)
  ? selectedTasks.filter(task => availableServerTaskValues.has(task))
  : []

const taskLabelMap = Object.fromEntries(availableServerTasks.map(t => [t.value, t.label]))

const message = useMessage()
const loading = ref(false)
const saving = ref(false)
const tasks = ref([])
const runningIds = ref(new Set())

const bins = ref([])
const binsLoading = ref(false)
const binMap = ref({})

const fetchBins = async () => {
  binsLoading.value = true
  try {
    const res = await api.bins.list()
    bins.value = res.bins || res.data?.bins || res.data || []
    binMap.value = Object.fromEntries(bins.value.map(b => [b.id, b]))
  } catch (e) {
    message.error('加载角色列表失败: ' + e.message)
  } finally {
    binsLoading.value = false
  }
}

const getBinNameById = (id) => {
  const bin = binMap.value[id]
  return bin ? bin.originalName : `角色 ${id}`
}

const getValidBinIds = (ids) => Array.isArray(ids)
  ? ids.filter(id => !!binMap.value[id])
  : []

const getValidBinCount = (ids) => getValidBinIds(ids).length

const getBinNames = (ids) => {
  const validIds = getValidBinIds(ids)
  if (!validIds.length) return '-'
  return validIds.map(id => getBinNameById(id)).join('、')
}

const formatSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B'
  return (bytes / 1024).toFixed(1) + ' KB'
}

const showModal = ref(false)
const editingTask = ref(null)
const form = reactive({
  name: '',
  runType: 'daily',
  runTime: '08:00',
  runTimeTs: null,
  cronExpression: '0 8 * * *',
  binIds: [],
  selectedTasks: [],
  enabled: true,
  taskSettings: {
    arenaFormation: 1,
    towerFormation: 1,
    bossFormation: 1,
    bossTimes: 2,
    arenaEnable: true,
    claimHangUp: true,
    claimBottle: true,
    claimEmail: true,
    payRecruit: true,
    openBox: true,
    blackMarketPurchase: true,
    commandDelay: 500,
    taskDelay: 500,
  },
})

const showLogsModal = ref(false)
const logsTask = ref(null)
const logsLoading = ref(false)
const logs = ref([])

const fetchTasks = async () => {
  loading.value = true
  try {
    const res = await api.scheduledTasks.list()
    tasks.value = (res.data || res).map(task => ({
      ...task,
      selectedTasks: sanitizeSelectedTasks(task.selectedTasks),
    }))
  } catch (e) {
    message.error('加载任务失败: ' + e.message)
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  form.name = ''
  form.runType = 'daily'
  form.runTime = '08:00'
  form.runTimeTs = null
  form.cronExpression = '0 8 * * *'
  form.binIds = []
  form.selectedTasks = []
  form.enabled = true
  Object.assign(form.taskSettings, {
    arenaFormation: 1, towerFormation: 1, bossFormation: 1, bossTimes: 2,
    arenaEnable: true, claimHangUp: true, claimBottle: true,
    claimEmail: true, payRecruit: true, openBox: true,
    blackMarketPurchase: true, commandDelay: 500, taskDelay: 500,
  })
}

const openCreateModal = async () => {
  editingTask.value = null
  resetForm()
  await fetchBins()
  showModal.value = true
}

const editTask = async (task) => {
  await fetchBins()
  editingTask.value = task
  form.name = task.name
  form.runType = task.runType
  form.runTime = task.runTime || '08:00'
  form.cronExpression = task.cronExpression || '0 8 * * *'
  form.binIds = getValidBinIds(task.binIds || [])
  form.selectedTasks = sanitizeSelectedTasks(task.selectedTasks)
  form.enabled = task.enabled
  Object.assign(form.taskSettings, task.taskSettings || {})
  showModal.value = true
}

const saveTask = async () => {
  if (!form.name.trim()) { message.warning('请填写任务名称'); return }
  if (form.binIds.length === 0) { message.warning('请至少选择一个角色'); return }

  let runTime = form.runTime
  if (form.runTimeTs) {
    const d = new Date(form.runTimeTs)
    runTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const payload = {
    name: form.name,
    runType: form.runType,
    runTime: form.runType === 'daily' ? runTime : null,
    cronExpression: form.runType === 'cron' ? form.cronExpression : null,
    binIds: form.binIds,
    selectedTasks: sanitizeSelectedTasks(form.selectedTasks),
    taskSettings: { ...form.taskSettings },
    enabled: form.enabled,
  }

  saving.value = true
  try {
    if (editingTask.value) {
      await api.scheduledTasks.update(editingTask.value.id, payload)
      message.success('任务已更新')
    } else {
      await api.scheduledTasks.create(payload)
      message.success('任务已创建')
    }
    showModal.value = false
    fetchTasks()
  } catch (e) {
    message.error('保存失败: ' + e.message)
  } finally {
    saving.value = false
  }
}

const deleteTask = async (id) => {
  try {
    await api.scheduledTasks.delete(id)
    message.success('已删除')
    fetchTasks()
  } catch (e) {
    message.error('删除失败: ' + e.message)
  }
}

const toggleTask = async (task) => {
  try {
    await api.scheduledTasks.toggle(task.id)
    message.success(task.enabled ? '已禁用' : '已启用')
    fetchTasks()
  } catch (e) {
    message.error('操作失败: ' + e.message)
  }
}

const runNow = async (task) => {
  runningIds.value = new Set([...runningIds.value, task.id])
  try {
    await api.scheduledTasks.runNow(task.id)
    message.success('任务已触发，正在后台执行')
  } catch (e) {
    message.error('触发失败: ' + e.message)
  } finally {
    const s = new Set(runningIds.value)
    s.delete(task.id)
    runningIds.value = s
  }
}

const viewLogs = async (task) => {
  logsTask.value = task
  showLogsModal.value = true
  logsLoading.value = true
  try {
    const res = await api.scheduledTasks.getLogs(task.id)
    logs.value = res.data || res
  } catch (e) {
    message.error('加载日志失败: ' + e.message)
  } finally {
    logsLoading.value = false
  }
}

const formatTime = (iso) => {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('zh-CN')
}

const statusLabel = (s) => ({ running: '执行中', success: '成功', failed: '失败', partial: '部分成功' }[s] || s)
const statusType = (s) => ({ running: 'info', success: 'success', failed: 'error', partial: 'warning' }[s] || 'default')

const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    fetchBins()
    fetchTasks()
  }
}

onMounted(() => {
  fetchTasks()
  fetchBins()
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>

<style scoped>
.server-tasks-page { padding: 20px; max-width: 1000px; margin: 0 auto; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-header h2 { margin: 0; }
.empty-state { padding: 60px 0; }
.task-list { display: flex; flex-direction: column; gap: 12px; }
.task-card { transition: opacity 0.2s; }
.task-card.disabled { opacity: 0.6; }
.task-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.task-info { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.task-name { font-weight: 600; font-size: 15px; }
.task-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.task-meta { margin-top: 8px; font-size: 12px; color: #999; display: flex; gap: 16px; flex-wrap: wrap; }
.bin-list { display: flex; flex-direction: column; gap: 6px; max-height: 200px; overflow-y: auto; padding: 4px; border: 1px solid var(--n-border-color, #e0e0e6); border-radius: 4px; }
.bin-item { padding: 4px 8px; }
.log-entries { max-height: 300px; overflow-y: auto; font-family: monospace; font-size: 12px; }
.log-entry { padding: 2px 0; display: flex; gap: 8px; }
.log-time { color: #999; flex-shrink: 0; }
.log-entry.success .log-msg { color: #18a058; }
.log-entry.error .log-msg { color: #d03050; }
.log-entry.warning .log-msg { color: #f0a020; }
</style>
