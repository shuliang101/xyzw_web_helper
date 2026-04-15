<template>
  <div class="club-car-page">
    <div class="page-header">
      <div>
        <h1>发车管理</h1>
        <p>配置主 BIN、同步成员，并按规则管理俱乐部发车安排。</p>
      </div>
      <n-space>
        <n-button @click="$router.push('/club-car/monitor')">
          监视页
        </n-button>
        <n-button @click="fetchAll" :loading="loading">
          刷新
        </n-button>
      </n-space>
    </div>

    <n-spin :show="loading">
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
          <input
            ref="memberBinInputRef"
            type="file"
            accept=".bin,.dmp"
            style="display: none"
            @change="handleMemberBinSelected"
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

      <n-card title="护送方案设置" class="panel-card form-card">
        <n-alert
          v-if="!members.length"
          type="warning"
          :show-icon="false"
          style="margin-bottom: 16px"
        >
          请先上传主 BIN 并同步俱乐部成员，再设置护送方案。
        </n-alert>

        <n-form label-placement="top" require-mark-placement="right-hanging">
          <n-form-item label="护送成员" required>
            <n-select
              v-model:value="schemeForm.targetRoleId"
              :options="targetOptions"
              placeholder="请选择护送成员"
              filterable
            />
          </n-form-item>

          <n-alert type="info" :show-icon="false" style="margin-bottom: 16px">
            保存一次后，会自动生成周一到周三相同的护送方案。每个护送成员最多 4 个时段，同一天内时段必须至少间隔 4 小时。
          </n-alert>

          <n-grid cols="1 900:2 1200:4" :x-gap="16" :y-gap="16">
            <n-gi v-for="(slot, index) in schemeForm.slots" :key="index">
              <n-card size="small" :title="`时段 ${index + 1}`" embedded>
                <n-space vertical :size="12">
                  <n-form-item :label="`发车成员 ${index + 1}`">
                    <n-select
                      v-model:value="slot.senderRoleId"
                      :options="senderOptionsForTarget(schemeForm.targetRoleId)"
                      placeholder="请选择发车成员"
                      filterable
                      clearable
                    />
                  </n-form-item>

                  <n-form-item :label="`发车时间 ${index + 1}`">
                    <n-time-picker
                      v-model:value="slot.sendTimeTs"
                      format="HH:mm"
                      clearable
                      style="width: 100%"
                    />
                  </n-form-item>

                  <n-form-item :label="`发车类型 ${index + 1}`">
                    <n-radio-group v-model:value="slot.sendMode" class="mode-group">
                      <n-radio-button
                        v-for="option in sendModeOptions"
                        :key="option.value"
                        :value="option.value"
                      >
                        {{ option.label }}
                      </n-radio-button>
                    </n-radio-group>
                  </n-form-item>

                  <n-button quaternary size="small" @click="clearSchemeSlot(index)">
                    清空时段
                  </n-button>
                </n-space>
              </n-card>
            </n-gi>
          </n-grid>

          <n-form-item label="生效日期">
            <n-space>
              <n-tag v-for="option in weekdayOptions" :key="option.value" size="small" type="info">
                {{ option.label }}
              </n-tag>
            </n-space>
          </n-form-item>

          <div class="form-tip">
            * 只需要配置一次，系统会自动展开成周一到周三的规则。
          </div>

          <n-space justify="end" style="margin-top: 20px">
            <n-button v-if="editingSchemeTargetRoleId" @click="resetSchemeForm">
              取消编辑
            </n-button>
            <n-button
              type="primary"
              :disabled="!members.length"
              :loading="savingPlan"
              @click="submitSchemeForm"
            >
              {{ editingSchemeTargetRoleId ? '保存方案' : '创建方案' }}
            </n-button>
          </n-space>
        </n-form>
      </n-card>

      <n-card :title="`护送方案列表（${planSchemes.length}）`" class="panel-card">
        <div class="table-scroll">
          <n-table striped :bordered="false">
            <thead>
              <tr>
                <th>护送成员</th>
                <th>周一到周三时段</th>
                <th style="width: 180px">最近执行</th>
                <th style="width: 170px">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!planSchemes.length">
                <td colspan="4">
                  <div class="empty">暂无护送方案</div>
                </td>
              </tr>
              <tr v-for="scheme in planSchemes" :key="scheme.targetRoleId">
                <td>{{ memberDisplay(scheme.target) }}</td>
                <td>
                  <div class="scheme-slot-list">
                    <div
                      v-for="(slot, index) in scheme.slots"
                      :key="`${scheme.targetRoleId}-${index}`"
                      class="scheme-slot-item"
                    >
                      <span class="scheme-slot-index">时段 {{ index + 1 }}</span>
                      <span>{{ memberDisplay(slot.sender) }}</span>
                      <span>{{ slot.sendTime }}</span>
                      <n-tag size="small" :type="sendModeTagType(slot.sendMode)">
                        {{ sendModeLabel(slot.sendMode) }}
                      </n-tag>
                    </div>
                  </div>
                </td>
                <td>{{ formatDate(scheme.lastRunAt) }}</td>
                <td>
                  <n-space :size="8">
                    <n-button size="small" type="primary" ghost @click="editScheme(scheme)">
                      编辑
                    </n-button>
                    <n-popconfirm @positive-click="removeScheme(scheme)">
                      <template #trigger>
                        <n-button size="small" type="error" ghost :loading="deletingSchemeTargetRoleId === scheme.targetRoleId">
                          删除
                        </n-button>
                      </template>
                      确认删除该护送方案吗？
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
            <n-space vertical :size="12" style="margin-bottom: 16px">
              <n-alert type="info" :show-icon="false">
                只对已绑定 BIN 的成员生效。勾选的成员会按统一时间自动收车，未勾选的成员会关闭自动收车。
              </n-alert>
              <n-grid cols="1 900:3" :x-gap="12" :y-gap="12">
                <n-gi>
                  <div class="batch-claim-box">
                    <div class="info-label">已勾选成员</div>
                    <div class="info-value batch-claim-count">{{ selectedClaimRoleIds.length }}</div>
                  </div>
                </n-gi>
                <n-gi>
                  <n-time-picker
                    v-model:value="batchClaimTimeTs"
                    format="HH:mm"
                    clearable
                    style="width: 100%"
                  />
                </n-gi>
                <n-gi>
                  <n-space justify="end">
                    <n-button @click="selectAllBoundMembers">
                      全选已绑定
                    </n-button>
                    <n-button @click="clearClaimSelection">
                      清空勾选
                    </n-button>
                    <n-button type="primary" :loading="savingBatchClaim" @click="saveBatchClaimSchedule">
                      保存自动收车
                    </n-button>
                  </n-space>
                </n-gi>
              </n-grid>
            </n-space>

            <div class="table-scroll">
              <n-table striped :bordered="false">
                <thead>
                  <tr>
                    <th style="width: 64px">勾选</th>
                    <th style="width: 72px">ID</th>
                    <th>成员</th>
                    <th style="width: 180px">BIN 绑定</th>
                    <th style="width: 170px">自动收车</th>
                    <th style="width: 160px">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!members.length">
                    <td colspan="6">
                      <div class="empty">暂无成员数据</div>
                    </td>
                  </tr>
                  <tr v-for="member in members" :key="member.id">
                    <td>
                      <n-checkbox
                        :checked="selectedClaimRoleIds.includes(member.roleId)"
                        :disabled="!member.boundBinName"
                        @update:checked="toggleClaimSelection(member, $event)"
                      />
                    </td>
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
                        <n-button
                          size="small"
                          :loading="bindingMemberId === member.id"
                          @click="openMemberBinPicker(member)"
                        >
                          {{ member.boundBinName ? '更换 BIN' : '绑定 BIN' }}
                        </n-button>
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
              <n-space :size="8" align="center">
                <span class="sub-text">自动刷新 10 秒</span>
                <n-button size="small" @click="fetchLogs" :loading="loadingLogs">
                  刷新日志
                </n-button>
              </n-space>
            </template>

            <n-empty v-if="!logs.length" description="暂无执行日志" />

            <div v-else class="logs-scroll">
              <n-timeline>
              <n-timeline-item
                v-for="log in logs"
                :key="log.id"
                :type="timelineType(log.status)"
                :title="logTitle(log)"
                :time="formatDate(log.createdAt)"
              >
                <div class="log-item">
                  <div class="log-message">{{ log.message }}</div>
                  <div v-if="logSummary(log)" class="log-summary">
                    {{ logSummary(log) }}
                  </div>
                  <div v-if="logDetailLines(log).length" class="log-lines">
                    <div
                      v-for="(line, index) in logDetailLines(log)"
                      :key="`${log.id}-${index}`"
                      class="log-line"
                    >
                      {{ line }}
                    </div>
                  </div>
                </div>
              </n-timeline-item>
              </n-timeline>
            </div>
          </n-card>
        </n-gi>
      </n-grid>
    </n-spin>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useMessage } from 'naive-ui'
import api from '@/api'

const message = useMessage()

const SEND_WINDOW_START_MINUTES = 6 * 60
const SEND_WINDOW_END_MINUTES = 20 * 60

const loading = ref(false)
const syncingMembers = ref(false)
const uploadingMasterBin = ref(false)
const loadingLogs = ref(false)
const savingPlan = ref(false)
const savingBatchClaim = ref(false)
const deletingSchemeTargetRoleId = ref(null)
const editingSchemeTargetRoleId = ref(null)
let logsAutoRefreshTimer = null

const masterBinInputRef = ref(null)
const memberBinInputRef = ref(null)
const bindingMemberId = ref(null)
const selectedBindingMember = ref(null)
const selectedClaimRoleIds = ref([])
const batchClaimTimeTs = ref(null)

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

const createEmptySchemeSlot = () => ({
  senderRoleId: null,
  sendMode: 'no_refresh',
  sendTimeTs: null,
})

const createDefaultSchemeForm = () => ({
  targetRoleId: null,
  slots: Array.from({ length: 4 }, () => createEmptySchemeSlot()),
})

const schemeForm = reactive(createDefaultSchemeForm())

const memberOptions = computed(() =>
  members.value.map(member => ({
    label: `${member.name} (${member.roleId})`,
    value: member.roleId,
  })))

const senderMemberOptions = computed(() =>
  members.value
    .filter(member => member.boundBinName)
    .map(member => ({
      label: `${member.name} (${member.roleId})`,
      value: member.roleId,
    })))

const senderOptionsForTarget = (targetRoleId) =>
  senderMemberOptions.value.filter(option => option.value !== targetRoleId)

const targetOptions = computed(() =>
  memberOptions.value)

const planSchemes = computed(() => {
  const grouped = new Map()

  for (const plan of plans.value) {
    const key = String(plan.targetRoleId || '')
    if (!key) continue

    if (!grouped.has(key)) {
      grouped.set(key, {
        targetRoleId: key,
        target: plan.target || null,
        lastRunAt: plan.lastRunAt || '',
        slotsMap: new Map(),
      })
    }

    const scheme = grouped.get(key)
    if (plan.lastRunAt && (!scheme.lastRunAt || new Date(plan.lastRunAt) > new Date(scheme.lastRunAt))) {
      scheme.lastRunAt = plan.lastRunAt
    }

    const slotKey = `${plan.senderRoleId}|${plan.sendTime}|${plan.sendMode}`
    if (!scheme.slotsMap.has(slotKey)) {
      scheme.slotsMap.set(slotKey, {
        senderRoleId: plan.senderRoleId,
        sender: plan.sender || null,
        sendTime: plan.sendTime,
        sendMode: plan.sendMode,
      })
    }
  }

  return [...grouped.values()]
    .map(scheme => ({
      targetRoleId: scheme.targetRoleId,
      target: scheme.target,
      lastRunAt: scheme.lastRunAt,
      slots: [...scheme.slotsMap.values()]
        .sort((left, right) => toMinutesOfDay(left.sendTime) - toMinutesOfDay(right.sendTime)),
    }))
    .sort((left, right) => memberDisplay(left.target).localeCompare(memberDisplay(right.target), 'zh-Hans-CN'))
})

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
  selectedClaimRoleIds.value = members.value
    .filter(member => member.boundBinName && member.claimEnabled)
    .map(member => member.roleId)
  const firstClaimMember = members.value.find(member => member.boundBinName && member.claimEnabled && member.claimTime)
  if (firstClaimMember) {
    batchClaimTimeTs.value = hhmmToTs(firstClaimMember.claimTime || '16:00')
  } else if (!batchClaimTimeTs.value) {
    batchClaimTimeTs.value = hhmmToTs('16:00')
  }
}

const fetchPlans = async () => {
  plans.value = await api.clubCar.listSendPlans()
}

const fetchLogs = async () => {
  loadingLogs.value = true
  try {
    logs.value = await api.clubCar.listLogs(10)
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

const resetSchemeForm = () => {
  Object.assign(schemeForm, createDefaultSchemeForm())
  editingSchemeTargetRoleId.value = null
}

const clearSchemeSlot = (index) => {
  schemeForm.slots[index] = createEmptySchemeSlot()
}

const validateSchemeForm = () => {
  if (!schemeForm.targetRoleId) {
    message.warning('请选择护送成员')
    return false
  }
  const availableSenderValues = new Set(senderOptionsForTarget(schemeForm.targetRoleId).map(option => option.value))
  const filledSlots = schemeForm.slots
    .map((slot, index) => ({
      index,
      senderRoleId: slot.senderRoleId,
      sendMode: slot.sendMode,
      sendTime: tsToHHmm(slot.sendTimeTs),
    }))
    .filter(slot => slot.senderRoleId || slot.sendTime)

  if (!filledSlots.length) {
    message.warning('至少填写一个时段')
    return false
  }

  for (const slot of filledSlots) {
    if (!slot.senderRoleId) {
      message.warning(`时段 ${slot.index + 1} 缺少发车成员`)
      return false
    }
    if (!availableSenderValues.has(slot.senderRoleId)) {
      message.warning(`时段 ${slot.index + 1} 的发车成员必须是已绑定 BIN 的成员`)
      return false
    }
    if (slot.senderRoleId === schemeForm.targetRoleId) {
      message.warning(`时段 ${slot.index + 1} 的发车成员不能和护送成员相同`)
      return false
    }
    if (!slot.sendTime) {
      message.warning(`时段 ${slot.index + 1} 缺少发车时间`)
      return false
    }
    const sendMinutes = toMinutesOfDay(slot.sendTime)
    if (sendMinutes < SEND_WINDOW_START_MINUTES || sendMinutes > SEND_WINDOW_END_MINUTES) {
      message.warning(`时段 ${slot.index + 1} 的发车时间必须在 06:00 到 20:00 之间`)
      return false
    }
  }

  const sortedSlots = [...filledSlots]
    .sort((left, right) => toMinutesOfDay(left.sendTime) - toMinutesOfDay(right.sendTime))

  for (let i = 1; i < sortedSlots.length; i += 1) {
    const gap = toMinutesOfDay(sortedSlots[i].sendTime) - toMinutesOfDay(sortedSlots[i - 1].sendTime)
    if (gap < 240) {
      message.warning('同一护送方案内，相邻时段必须至少间隔 4 小时')
      return false
    }
  }

  return true
}

const submitSchemeForm = async () => {
  if (!validateSchemeForm()) return

  savingPlan.value = true
  try {
    const targetRoleId = schemeForm.targetRoleId
    const filledSlots = schemeForm.slots
      .map(slot => ({
        targetRoleId,
        senderRoleId: slot.senderRoleId,
        sendMode: slot.sendMode,
        sendTime: tsToHHmm(slot.sendTimeTs),
      }))
      .filter(slot => slot.senderRoleId && slot.sendTime)

    const existingPlans = plans.value.filter(plan => String(plan.targetRoleId) === String(targetRoleId))
    for (const plan of existingPlans) {
      await api.clubCar.deleteSendPlan(plan.id)
    }

    for (const weekday of weekdayOptions.map(option => option.value)) {
      for (const slot of filledSlots) {
        await api.clubCar.createSendPlan({
          weekday,
          targetRoleId: slot.targetRoleId,
          senderRoleId: slot.senderRoleId,
          sendMode: slot.sendMode,
          sendTime: slot.sendTime,
        })
      }
    }

    message.success(editingSchemeTargetRoleId.value ? '护送方案已更新' : '护送方案已创建')
    resetSchemeForm()
    await fetchPlans()
  } catch (error) {
    message.error(error.message || '保存护送方案失败')
  } finally {
    savingPlan.value = false
  }
}

const editScheme = (scheme) => {
  const slots = Array.from({ length: 4 }, (_, index) => {
    const source = scheme.slots[index]
    if (!source) return createEmptySchemeSlot()
    return {
      senderRoleId: source.senderRoleId,
      sendMode: source.sendMode || 'no_refresh',
      sendTimeTs: hhmmToTs(source.sendTime || ''),
    }
  })

  Object.assign(schemeForm, {
    targetRoleId: scheme.targetRoleId || null,
    slots,
  })
  editingSchemeTargetRoleId.value = scheme.targetRoleId
}

const removeScheme = async (scheme) => {
  deletingSchemeTargetRoleId.value = scheme.targetRoleId
  try {
    const relatedPlans = plans.value.filter(plan => String(plan.targetRoleId) === String(scheme.targetRoleId))
    for (const plan of relatedPlans) {
      await api.clubCar.deleteSendPlan(plan.id)
    }
    if (editingSchemeTargetRoleId.value === scheme.targetRoleId) {
      resetSchemeForm()
    }
    await fetchPlans()
    message.success('护送方案已删除')
  } catch (error) {
    message.error(error.message || '删除护送方案失败')
  } finally {
    deletingSchemeTargetRoleId.value = null
  }
}

const openMasterBinPicker = () => {
  masterBinInputRef.value?.click?.()
}

const openMemberBinPicker = (member) => {
  selectedBindingMember.value = member
  memberBinInputRef.value?.click?.()
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

const handleMemberBinSelected = async (event) => {
  const file = event?.target?.files?.[0]
  event.target.value = ''
  const member = selectedBindingMember.value
  selectedBindingMember.value = null
  if (!file || !member) return

  bindingMemberId.value = member.id
  try {
    const formData = new FormData()
    formData.append('bin', file)
    await api.clubCar.bindMemberBin(member.roleId, formData)
    await Promise.all([fetchMembers(), fetchPlans()])
    message.success(`${member.name} 的 BIN 已绑定`)
  } catch (error) {
    message.error(error.message || '绑定成员 BIN 失败')
  } finally {
    bindingMemberId.value = null
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

const toggleClaimSelection = (member, checked) => {
  if (!member?.boundBinName) return
  const current = new Set(selectedClaimRoleIds.value)
  if (checked) current.add(member.roleId)
  else current.delete(member.roleId)
  selectedClaimRoleIds.value = [...current]
}

const selectAllBoundMembers = () => {
  selectedClaimRoleIds.value = members.value
    .filter(member => member.boundBinName)
    .map(member => member.roleId)
}

const clearClaimSelection = () => {
  selectedClaimRoleIds.value = []
}

const saveBatchClaimSchedule = async () => {
  const claimTime = tsToHHmm(batchClaimTimeTs.value)
  if (!claimTime) {
    message.warning('请选择统一收车时间')
    return
  }

  savingBatchClaim.value = true
  try {
    await api.clubCar.batchUpdateMemberClaimSchedule({
      roleIds: selectedClaimRoleIds.value,
      claimEnabled: selectedClaimRoleIds.value.length > 0,
      claimTime,
    })
    await fetchMembers()
    message.success('自动收车设置已保存')
  } catch (error) {
    message.error(error.message || '保存自动收车设置失败')
  } finally {
    savingBatchClaim.value = false
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

const logTitle = (log) => `${log.runType} / ${log.status}`

const logSummary = (log) => {
  const detail = log?.detail
  if (!detail || typeof detail !== 'object') return ''

  if (typeof detail.sentCars === 'number') {
    return `发车 ${detail.sentCars}/${detail.totalPlans ?? 0}，失败 ${detail.failedPlans ?? 0}`
  }
  if (typeof detail.claimedCars === 'number') {
    return `收车 ${detail.claimedCars}/${detail.totalMembers ?? 0}，失败 ${detail.failedMembers ?? 0}`
  }
  if (typeof detail.sendDue === 'number' || typeof detail.claimDue === 'number') {
    return `到点发车 ${detail.sendDue ?? 0}，到点收车 ${detail.claimDue ?? 0}`
  }
  return ''
}

const logDetailLines = (log) => {
  const detail = log?.detail
  if (!detail || typeof detail !== 'object') return []

  const items = Array.isArray(detail.detail) ? detail.detail : []
  return items.flatMap((item) => {
    const header = item.planId
      ? `规则 #${item.planId} ${item.senderName || item.senderRoleId || '-'} -> ${item.targetName || item.targetRoleId || '-'}`
      : `${item.name || '-'} (${item.roleId || '-'})`

    const lines = [header]

    if (item.sendMode) {
      lines.push(`发车类型: ${sendModeLabel(item.sendMode)}，时间: ${item.sendTime || '-'}`)
    }
    if (item.refreshAttempts !== undefined) {
      lines.push(`刷新次数: ${item.refreshAttempts}`)
    }
    if (item.sent !== undefined) {
      lines.push(`发车结果: ${item.sent ? '已发出' : '未发出'}`)
    }
    if (Array.isArray(item.sentCarsDetail) && item.sentCarsDetail.length) {
      item.sentCarsDetail.forEach(car => {
        const detail = [`车辆 ${car.carId}`]
        if (car.stopReason) {
          detail.push(car.stopReason)
        }
        if (Array.isArray(car.matchedRewards) && car.matchedRewards.length) {
          detail.push(`奖励: ${car.matchedRewards.join('，')}`)
        }
        lines.push(detail.join('，'))
      })
    }
    if (item.claimed !== undefined) {
      lines.push(`收车数量: ${item.claimed}`)
    }
    if (item.researchUpgraded !== undefined) {
      lines.push(`赛车科技升级: ${item.researchUpgraded} 级，当前等级: ${item.researchLevel ?? 0}`)
    }
    if (item.researchRewardClaimed) {
      lines.push('已领取赛车科技累计奖励')
    }
    if (item.skippedReason) {
      lines.push(`跳过原因: ${item.skippedReason}`)
    }
    if (Array.isArray(item.errors) && item.errors.length) {
      item.errors.forEach(error => lines.push(`错误: ${error}`))
    }

    return lines
  })
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
onMounted(() => {
  logsAutoRefreshTimer = window.setInterval(() => {
    if (!loadingLogs.value) {
      fetchLogs()
    }
  }, 10000)
})

onUnmounted(() => {
  if (logsAutoRefreshTimer) {
    window.clearInterval(logsAutoRefreshTimer)
    logsAutoRefreshTimer = null
  }
})
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

.batch-claim-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--bg-secondary);
}

.batch-claim-count {
  text-align: left;
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

.scheme-slot-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.scheme-slot-item {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.scheme-slot-index {
  min-width: 48px;
  font-size: 12px;
  color: var(--text-secondary);
}

.log-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.log-message {
  color: var(--text-primary);
}

.log-summary {
  font-size: 12px;
  color: var(--text-secondary);
}

.logs-scroll {
  max-height: 720px;
  overflow-y: auto;
  padding-right: 4px;
}

.log-lines {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--bg-tertiary);
}

.log-line {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-primary);
  word-break: break-word;
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
