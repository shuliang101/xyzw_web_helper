<template>
  <MyCard class="bottle-helper" :statusClass="{ active: state.isRunning }">
    <template #icon>
      <img src="/icons/1736425783912140.png" alt="竞技场" />
    </template>
    <template #title>
      <h3>竞技场助手</h3>
    </template>
    <template #badge>
      <span>{{ state.isRunning ? "运行中" : "已停止" }}</span>
    </template>
    <template #default>
      <div class="total-points">
        <span class="label">当前咸神门票数量：</span>
        <span class="value">{{ itemcount }}</span>
      </div>
      <div class="container">
        <div class="selects">
          <n-select v-model:value="number" :options="numberOptions" />
          <n-button size="small" type="tertiary" @click="openArenaSettingsModal" :disabled="state.isRunning">
            选择策略
          </n-button>
        </div>
      </div>
    </template>
    <template #action>
      <a-button type="primary" :disabled="state.isRunning" secondary size="small" block @click="handleFightHelper">
        {{ state.isRunning ? "运行中" : "开始战斗" }}
      </a-button>
    </template>
  </MyCard>
  <n-modal v-model:show="showArenaSettingsModal" preset="card" title="竞技场对手筛选设置"
    style="width: 430px; max-width: 92vw">
    <n-spin :show="arenaSettingsLoading">
      <div class="arena-settings">
        <div class="setting-row">
          <label class="setting-label">排序策略</label>
          <n-select v-model:value="arenaSettings.strategy" :options="strategyOptions" size="small" />
        </div>
        <div class="setting-row">
          <label class="setting-label">战力区间（单位：亿）</label>
          <div class="range-row">
            <n-input-number v-model:value="arenaSettings.powerMin" :precision="2" :step="0.1" size="small"
              placeholder="最小值" clearable :status="powerMinStatus" />
            <span class="range-split">-</span>
            <n-input-number v-model:value="arenaSettings.powerMax" :precision="2" :step="0.1" size="small"
              placeholder="最大值" clearable :status="powerMaxStatus" />
          </div>
          <div class="tips">留空表示不限制</div>
        </div>
        <div class="setting-row">
          <label class="setting-label">分数区间（下限 1000）</label>
          <div class="range-row">
            <n-input-number v-model:value="arenaSettings.scoreMin" :step="100" size="small"
              placeholder="最小值" clearable :status="scoreMinStatus" />
            <span class="range-split">-</span>
            <n-input-number v-model:value="arenaSettings.scoreMax" :step="100" size="small"
              placeholder="最大值" clearable :status="scoreMaxStatus" />
          </div>
          <div class="tips">为空表示不限制，最小值需 ≥ 1000</div>
        </div>
        <div class="modal-actions">
          <n-button size="small" @click="showArenaSettingsModal = false">取消</n-button>
          <n-button size="small" type="primary" :loading="arenaSettingsSaving" @click="handleSaveArenaSettings">
            保存设置
          </n-button>
        </div>
      </div>
    </n-spin>
  </n-modal>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { useMessage } from "naive-ui";
import { useTokenStore } from "@/stores/tokenStore";
import { useAuthStore } from "@/stores/auth";
import {
  buildArenaHelperSettingsKeySets,
  createDefaultArenaHelperSettings,
  loadArenaHelperSettings,
  saveArenaHelperSettings
} from "@/utils/arenaHelperSettingsStorage";
import MyCard from "../Common/MyCard.vue";

const tokenStore = useTokenStore();
const authStore = useAuthStore();
const message = useMessage();
const POWER_UNIT = 100000000;

const roleInfo = computed(() => tokenStore.gameData?.roleInfo || null);
const itemcount = computed(() => roleInfo.value?.role?.items?.[1007]?.quantity || 0);

const number = ref(10);
const numberOptions = [
  { label: "1", value: 1 },
  { label: "5", value: 5 },
  { label: "10", value: 10 },
  { label: "50", value: 50 },
  { label: "100", value: 100 },
  { label: "500", value: 500 },
  { label: "1000", value: 1000 }
];
const state = ref({
  isRunning: false,
});

const arenaSettings = ref(createDefaultArenaHelperSettings());
const showArenaSettingsModal = ref(false);
const arenaSettingsLoading = ref(false);
const arenaSettingsSaving = ref(false);
const arenaSettingsKeySets = ref(null);
const currentSettingsTokenId = ref(null);

const strategyOptions = [
  { label: "默认顺序", value: "first" },
  { label: "战力最高优先", value: "power-desc" },
  { label: "战力最低优先", value: "power-asc" },
  { label: "分数最高优先", value: "score-desc" },
  { label: "分数最低优先", value: "score-asc" }
];

const scoreMinStatus = computed(() => {
  const min = arenaSettings.value.scoreMin;
  const max = arenaSettings.value.scoreMax;
  if (min != null && min < 1000) return "error";
  if (min != null && max != null && min > max) return "error";
  return undefined;
});

const scoreMaxStatus = computed(() => {
  const min = arenaSettings.value.scoreMin;
  const max = arenaSettings.value.scoreMax;
  if (max != null && max < 1000) return "error";
  if (min != null && max != null && min > max) return "error";
  return undefined;
});

const powerMinStatus = computed(() => {
  const min = arenaSettings.value.powerMin;
  const max = arenaSettings.value.powerMax;
  if (min != null && min < 0) return "error";
  if (min != null && max != null && min > max) return "error";
  return undefined;
});

const powerMaxStatus = computed(() => {
  const min = arenaSettings.value.powerMin;
  const max = arenaSettings.value.powerMax;
  if (max != null && max < 0) return "error";
  if (min != null && max != null && min > max) return "error";
  return undefined;
});

const resetArenaSettings = () => {
  arenaSettings.value = createDefaultArenaHelperSettings();
  arenaSettingsKeySets.value = null;
  currentSettingsTokenId.value = null;
};

const refreshArenaSettings = async () => {
  const token = tokenStore.selectedToken;
  if (!token) {
    resetArenaSettings();
    arenaSettingsLoading.value = false;
    return;
  }

  const requestId = token.id;
  currentSettingsTokenId.value = requestId;
  arenaSettingsLoading.value = true;
  try {
    const keySets = buildArenaHelperSettingsKeySets({
      authUser: authStore.user,
      token,
      role: tokenStore.gameData?.roleInfo?.role
    });
    arenaSettingsKeySets.value = keySets;
    const result = await loadArenaHelperSettings({
      keySets,
      hasAuth: !!authStore.token
    });
    if (currentSettingsTokenId.value === requestId) {
      arenaSettings.value = {
        ...createDefaultArenaHelperSettings(),
        ...(result?.data || {})
      };
    }
  } catch (error) {
    console.error("[ArenaHelper] Failed to load arena settings:", error);
    message.error("加载竞技场助手设置失败");
  } finally {
    if (currentSettingsTokenId.value === requestId) {
      arenaSettingsLoading.value = false;
    }
  }
};

watch(
  () => [tokenStore.selectedToken?.id, authStore.token],
  () => {
    refreshArenaSettings();
  },
  { immediate: true }
);

const openArenaSettingsModal = () => {
  if (!tokenStore.selectedToken) {
    message.warning("请先选择Token");
    return;
  }
  showArenaSettingsModal.value = true;
};

const validateArenaSettingsRanges = () => {
  const { powerMin, powerMax, scoreMin, scoreMax } = arenaSettings.value;
  if (powerMin != null && powerMin < 0) {
    message.warning("战力最小值不能小于0");
    return false;
  }
  if (powerMax != null && powerMax < 0) {
    message.warning("战力最大值不能小于0");
    return false;
  }
  if (powerMin != null && powerMax != null && powerMin > powerMax) {
    message.warning("战力最小值不能大于最大值");
    return false;
  }
  if (scoreMin != null && scoreMin < 1000) {
    message.warning("分数下限不能小于1000");
    return false;
  }
  if (scoreMax != null && scoreMax < 1000) {
    message.warning("分数下限不能小于1000");
    return false;
  }
  if (scoreMin != null && scoreMax != null && scoreMin > scoreMax) {
    message.warning("分数最小值不能大于最大值");
    return false;
  }
  return true;
};

const handleSaveArenaSettings = async () => {
  if (!arenaSettingsKeySets.value) {
    message.warning("请先选择Token");
    return;
  }
  if (!validateArenaSettingsRanges()) return;
  arenaSettingsSaving.value = true;
  try {
    await saveArenaHelperSettings({
      keySets: arenaSettingsKeySets.value,
      data: { ...arenaSettings.value },
      hasAuth: !!authStore.token,
      remote: true,
      local: true
    });
    message.success("竞技场助手设置已保存");
    showArenaSettingsModal.value = false;
  } catch (error) {
    const errMessage = error?.message || "保存竞技场助手设置失败";
    message.error(errMessage);
  } finally {
    arenaSettingsSaving.value = false;
  }
};

const hasAdvancedSelection = () => {
  const settings = arenaSettings.value;
  return (
    settings.strategy !== "first" ||
    settings.powerMin != null ||
    settings.powerMax != null ||
    settings.scoreMin != null ||
    settings.scoreMax != null
  );
};

const extractCandidateId = (candidate, fallback) => {
  return (
    candidate?.roleId ??
    candidate?.id ??
    candidate?.role?.roleId ??
    candidate?.info?.roleId ??
    candidate?.info?.id ??
    fallback ??
    null
  );
};

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const getCandidatePower = (candidate) => {
  return normalizeNumber(
    candidate?.info?.power ??
    candidate?.power ??
    candidate?.info?.fightPower
  );
};

const getCandidateScore = (candidate) => {
  return normalizeNumber(
    candidate?.info?.score ??
    candidate?.score ??
    candidate?.info?.arenaScore
  );
};

const gatherArenaCandidates = (targets) => {
  const result = [];
  const seen = new Set();
  const candidateLists = [
    targets?.rankList,
    targets?.roleList,
    targets?.targets,
    targets?.targetList,
    targets?.list
  ];

  candidateLists.forEach((list) => {
    if (!Array.isArray(list)) return;
    list.forEach((item) => {
      const id = extractCandidateId(item);
      if (!id || seen.has(id)) return;
      seen.add(id);
      result.push(item);
    });
  });

  if (!result.length && (targets?.roleId || targets?.id)) {
    result.push(targets);
  }

  return result;
};

const basicPickTargetId = (targets) => {
  const candidate =
    targets?.rankList?.[0] ||
    targets?.roleList?.[0] ||
    targets?.targets?.[0] ||
    targets?.targetList?.[0] ||
    targets?.list?.[0];

  const fallback = targets?.roleId || targets?.id || null;
  if (!candidate) return fallback;
  return extractCandidateId(candidate, fallback);
};

const sortCandidatesByStrategy = (candidates, strategy) => {
  if (strategy === "first") return candidates;
  const comparator = strategy.startsWith("power")
    ? getCandidatePower
    : getCandidateScore;
  const filtered = candidates.filter((item) => comparator(item) !== null);
  if (!filtered.length) return [];
  const sorted = [...filtered].sort((a, b) => {
    const aValue = comparator(a);
    const bValue = comparator(b);
    if (aValue === bValue) return 0;
    if (strategy.endsWith("asc")) {
      return aValue - bValue;
    }
    return bValue - aValue;
  });
  return sorted;
};

const selectArenaTarget = (targets) => {
  if (!hasAdvancedSelection()) {
    const fallbackId = basicPickTargetId(targets);
    return fallbackId
      ? { targetId: fallbackId }
      : { error: "未找到可挑战的竞技场目标" };
  }

  const candidates = gatherArenaCandidates(targets);
  if (!candidates.length) {
    const fallbackId = basicPickTargetId(targets);
    return fallbackId
      ? { targetId: fallbackId }
      : { error: "未找到可挑战的竞技场目标" };
  }

  const settings = arenaSettings.value;
  const needPower =
    settings.strategy.startsWith("power") ||
    settings.powerMin != null ||
    settings.powerMax != null;
  const needScore =
    settings.strategy.startsWith("score") ||
    settings.scoreMin != null ||
    settings.scoreMax != null;

  const hasPowerData = candidates.some((item) => getCandidatePower(item) !== null);
  const hasScoreData = candidates.some((item) => getCandidateScore(item) !== null);

  if (needPower && needScore && !hasPowerData && !hasScoreData) {
    return { error: "候选对手缺少战力与分数信息，无法筛选" };
  }
  if (needPower && !hasPowerData) {
    return { error: "候选对手缺少战力信息，无法按战力筛选" };
  }
  if (needScore && !hasScoreData) {
    return { error: "候选对手缺少分数信息，无法按分数筛选" };
  }

  const powerMin = settings.powerMin != null ? settings.powerMin * POWER_UNIT : null;
  const powerMax = settings.powerMax != null ? settings.powerMax * POWER_UNIT : null;
  const scoreMin = settings.scoreMin != null ? settings.scoreMin : null;
  const scoreMax = settings.scoreMax != null ? settings.scoreMax : null;

  const filtered = candidates.filter((candidate) => {
    if (powerMin != null || powerMax != null) {
      const power = getCandidatePower(candidate);
      if (power === null) return false;
      if (powerMin != null && power < powerMin) return false;
      if (powerMax != null && power > powerMax) return false;
    }
    if (scoreMin != null || scoreMax != null) {
      const score = getCandidateScore(candidate);
      if (score === null) return false;
      if (scoreMin != null && score < scoreMin) return false;
      if (scoreMax != null && score > scoreMax) return false;
    }
    return true;
  });

  if (!filtered.length) {
    return { error: "战力或分数区间内没有符合条件的对手" };
  }

  const sorted = sortCandidatesByStrategy(filtered, settings.strategy);
  if (!sorted.length) {
    return { error: "没有包含所需战力或分数信息的对手" };
  }

  const picked = sorted[0];
  const targetId = extractCandidateId(picked);
  if (!targetId) {
    return { error: "选中的对手缺少角色ID，无法发起战斗" };
  }
  return { targetId };
};

const pickArenaTargetId = (targets) => {
  const selection = selectArenaTarget(targets);
  if (!selection?.targetId) {
    if (selection?.error) {
      message.warning(selection.error);
    }
    return null;
  }
  return selection.targetId;
};

const handleFightHelper = async () => {
  if (!tokenStore.selectedToken) {
    message.warning("请先选择Token");
    return;
  }
  if (itemcount.value < number.value) {
    message.warning("咸神门票不足以完成该战斗次数");
    return;
  }
  if (!validateArenaSettingsRanges()) return;

  const tokenId = tokenStore.selectedToken.id;
  state.value.isRunning = true;
  message.info("竞技场战斗中");
  for (let i = 0; i < number.value; i++) {
    await tokenStore.sendMessageWithPromise(tokenId, "arena_startarea", {});
    let targets;
    try {
      targets = await tokenStore.sendMessageWithPromise(tokenId, "arena_getareatarget", {});
    } catch (err) {
      message.error(`获取竞技场目标失败：${err.message}`);
      break;
    }

    const targetId = pickArenaTargetId(targets);
    if (!targetId) {
      break;
    }
    try {
      await tokenStore.sendMessageWithPromise(tokenId, "fight_startareaarena", { targetId });
    } catch (e) {
      message.error(`竞技场对决失败：${e.message}`);
    }
  }

  await tokenStore.sendMessage(tokenId, "role_getroleinfo");
  message.success("竞技场战斗完毕");
  state.value.isRunning = false;
  return;
};
</script>

<style scoped lang="scss">
.container {
    padding: 10px 0;
    display: flex;
    flex-direction: column;
    .list {
        display: flex;
        align-items: center;
        justify-content: center;
        .item {
            display: flex;
            flex-direction: column;
            align-items: center;
            > img {
                width: 40px;
                height: 40px;
            }
            .fight-info {
                display: flex;
                flex-direction: column;
                align-items: center;
                .fight-type {
                    font-weight: bold;
                    margin-top: 4px;
                }
                .fight-count {
                    margin-top: 2px;
                    color: #666;
                }
            }
        }
    }
    .selects {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 12px;
    flex-wrap: wrap;
    }
    .total-points {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 2px;
    background: var(--bg-tertiary);
    border-radius: var(--border-radius-medium);

    .label {
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
    }

    .value {
      color: var(--text-primary);
      font-size: var(--font-size-md);
      font-weight: var(--font-weight-semibold);
    }
  }
}

.arena-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-label {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.range-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.range-split {
  color: var(--text-secondary);
}

.tips {
  font-size: 12px;
  color: var(--text-tertiary);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
