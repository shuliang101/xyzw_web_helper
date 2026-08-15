<template>
  <MyCard class="star-upgrade" :statusClass="{ active: state.isRunning }">
    <template #icon>
      <img src="/icons/legionCup.png" alt="升级图标" />
    </template>
    <template #title>
      <h3>武将升级</h3>
      <p>武将升级,方便卡速</p>
    </template>
    <template #badge>
      <span>{{ state.isRunning ? "运行中" : "已停止" }}</span>
    </template>
    <template #default>
      <div class="settings">
        <span class="label">武将选择</span>
        <n-select
          v-model:value="HeroValue"
          :options="HeroOptions"
          @update:value="handleUpdateValue"
        ></n-select>
      </div>
    </template>
    <template #action>
      <div class="action-row" v-if="HeroItem != null">
        <div class="hero-item">
          <img :src="HeroItem.avatar" :alt="HeroItem.name" />
        </div>
        <div class="hero-property">
          <div class="current-property">
            <div>攻击：{{ HeroItem.attack }}</div>
            <div>速度：{{ HeroItem.speed }}</div>
          </div>
        </div>
        <div class="button-area">
          <div class="input-area">
            <span class="label">升级方式</span>
            <n-select
              v-model:value="upgradeMode"
              :options="upgradeModeOptions"
            />
          </div>
          <div class="input-area" v-if="upgradeMode === 'target'">
            <span class="label">目标等级</span>
            <n-input-number
              v-model:value="targetLevel"
              :min="1"
              :max="6000"
              :step="100"
              :precision="0"
              placeholder="输入目标等级"
            />
          </div>
          <div class="input-area" v-if="upgradeMode === 'count'">
            <span class="label">升级等级</span>
            <n-select
              v-model:value="levelNum"
              :options="levelOptions"
            ></n-select>
          </div>
          <div class="button-group">
            <a-button
              type="primary"
              :disabled="state.isRunning"
              size="small"
              @click="levelHeroUpgrade"
              >升级</a-button
            >
            <a-button
              type="primary"
              :disabled="
                judgeLevelupgrade(HeroItem.level, 1, HeroItem.order) == false
              "
              size="small"
              v-if="false"
              @click="orderHeroUpgrade"
              >进阶</a-button
            >
          </div>
        </div>
      </div>
    </template>
  </MyCard>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { useMessage } from "naive-ui";
import { useTokenStore } from "@/stores/tokenStore";
import MyCard from "../Common/MyCard.vue";
import { HERO_DICT } from "@/utils/HeroList";

const tokenStore = useTokenStore();
const message = useMessage();
const COMMAND_DELAY = 500;
const UPGRADE_OPTIONS = [50, 10, 5, 1];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const HeroOptions = computed(() => [
  ...Object.values(tokenStore.gameData.roleInfo.role.heroes).map((item) => {
    return {
      label: HERO_DICT[item.heroId].name + "(" + item.level + "/6000)",
      value: item.heroId,
      disabled: item.level == 6000,
    };
  }),
]);

const HeroValue = ref(null);
const HeroItem = ref(null);
const upgradeMode = ref("count");
const levelNum = ref(1);
const targetLevel = ref(100);
const state = ref({
  isRunning: false,
  showConfirm: false,
  progressText: "待开始",
  stopRequested: false,
  total: 0,
  done: 0,
});

const handleUpdateValue = (value) => {
  HeroItem.value = Object.assign(
    {},
    tokenStore.gameData.roleInfo.role.heroes[value],
    HERO_DICT[value],
  );
  const currentLevel = Number(HeroItem.value?.level || 0);
  if (targetLevel.value <= currentLevel) {
    targetLevel.value = Math.min(6000, currentLevel + 1);
  }
};

const upgradeModeOptions = [
  { label: "升固定等级", value: "count" },
  { label: "升到等级", value: "target" },
];

const levelOptions = [
  {
    label: "1",
    value: 1,
  },
  {
    label: "5",
    value: 5,
  },
  {
    label: "10",
    value: 10,
  },
  {
    label: "50",
    value: 50,
  },
];

watch(
  () => tokenStore.gameData.roleInfo.heroes,
  () => {
    if (HeroValue.value) {
      if (
        tokenStore.gameData.roleInfo.role.heroes[HeroValue.value].level != 6000
      ) {
        HeroItem.value = Object.assign(
          {},
          tokenStore.gameData.roleInfo.role.heroes[HeroValue.value],
          HERO_DICT[HeroValue.value],
        );
      } else {
        HeroItem.value = null;
      }
    }
  },
  { deep: true }, // 深度监听内部变化
);

//英雄进阶
const orderHeroUpgrade = async () => {
  if (!tokenStore.selectedToken) {
    message.warning("请先选择游戏角色");
    return;
  }

  const tokenId = tokenStore.selectedToken.id;

  // 检查WebSocket连接
  const wsStatus = tokenStore.getWebSocketStatus(tokenId);
  if (wsStatus !== "connected") {
    message.error("WebSocket未连接，无法执行命令");
    return;
  }
  state.value.isRunning = true;

  try {
    let orderJudgement = judgeLevelupgrade(
      HeroItem.value.level,
      levelNum.value,
      HeroItem.value.order,
    );
    if (orderJudgement == HeroItem.value.level) {
      const result = await tokenStore.sendMessageWithPromise(
        tokenId,
        "hero_heroupgradeorder",
        {
          heroId: HeroValue.value,
        },
        5000,
      );
      if (result?.role.heroes) {
        message.success("杩涢樁鎴愬姛");
        tokenStore.sendGetRoleInfo(tokenId);
      }
    } else {
      message.warning("杩涢樁澶辫触");
    }
    return;

    let current = {
      level: Number(HeroItem.value?.level || 0),
      order: Number(HeroItem.value?.order || 0),
    };
    const target = Math.min(6000, Math.floor(Number(targetLevel.value || 0)));
    let remaining =
      upgradeMode.value === "target"
        ? target - current.level
        : Math.max(1, Number(levelNum.value || 1));

    if (remaining <= 0) {
      message.warning("目标等级必须大于当前等级");
      return;
    }

    while (remaining > 0) {
      const pendingOrder = findPendingOrder(current.level, current.order);
      if (pendingOrder) {
        const orderResult = await tokenStore.sendMessageWithPromise(
          tokenId,
          "hero_heroupgradeorder",
          {
            heroId: HeroValue.value,
          },
          5000,
        );
        if (!orderResult?.role?.heroes) {
          throw new Error("进阶后未返回武将数据");
        }
        current = getHeroUpgradeState(orderResult);
        refreshSelectedHero(current);
        await delay(COMMAND_DELAY);
        continue;
      }

      const barrier = findNextOrderBarrier(
        current.level,
        remaining,
        current.order,
      );
      const upgradeNum = barrier
        ? Number(barrier.level) - current.level
        : remaining;
      if (upgradeNum <= 0) break;

      const result = await tokenStore.sendMessageWithPromise(
        tokenId,
        "hero_heroupgradelevel",
        {
          heroId: HeroValue.value,
          upgradeNum,
        },
        5000,
      );
      if (result?.role.heroes) {
        current = getHeroUpgradeState(result);
        refreshSelectedHero(current);
        remaining -= upgradeNum;
        await delay(COMMAND_DELAY);
      } else {
        throw new Error("升级后未返回武将数据");
      }
    }

    const pendingOrder = findPendingOrder(current.level, current.order);
    if (pendingOrder) {
      const orderResult = await tokenStore.sendMessageWithPromise(
        tokenId,
        "hero_heroupgradeorder",
        {
          heroId: HeroValue.value,
      },
      5000,
    );
      if (!orderResult?.role?.heroes) {
        throw new Error("进阶后未返回武将数据");
      }
      current = getHeroUpgradeState(orderResult);
      refreshSelectedHero(current);
      await delay(COMMAND_DELAY);
    }

    tokenStore.sendGetRoleInfo(tokenId);
    message.success("升级完成");
    return;

    let judgement = judgeLevelupgrade(
      HeroItem.value.level,
      levelNum.value,
      HeroItem.value.order,
    );
    if (judgement == HeroItem.value.level) {
      const result = await tokenStore.sendMessageWithPromise(
        tokenId,
        "hero_heroupgradeorder",
        {
          heroId: HeroValue.value,
        },
        5000,
      );
      if (result?.role.heroes) {
        message.success("进阶成功");
        tokenStore.sendGetRoleInfo(tokenId);
      }
    } else {
      message.warning("进阶失败");
    }
  } catch (error) {
    message.error(`进阶失败: ${error.message}`);
    tokenStore.sendGetRoleInfo(tokenId);
  } finally {
    state.value.isRunning = false;
  }
};

//英雄升级
const getHeroUpgradeState = (result) => {
  const hero =
    result?.role?.heroes?.[HeroValue.value] ||
    tokenStore.gameData?.roleInfo?.role?.heroes?.[HeroValue.value] ||
    HeroItem.value;

  return {
    level: Number(hero?.level || 0),
    order: Number(hero?.order || 0),
  };
};

const findPendingOrder = (level, order) =>
  levelArr.find(
    (item) =>
      Number(item.level) === Number(level) &&
      Number(order) !== Number(item.order),
  );

const findNextOrderBarrier = (level, upgradeNum, order) =>
  levelArr.find(
    (item) =>
      Number(order) !== Number(item.order) &&
      Number(level) < Number(item.level) &&
      Number(item.level) <= Number(level) + Number(upgradeNum),
  );

const refreshSelectedHero = (heroState) => {
  const source = tokenStore.gameData?.roleInfo?.role?.heroes?.[HeroValue.value];
  if (!source) return;
  HeroItem.value = Object.assign({}, source, HERO_DICT[HeroValue.value], heroState || {});
};

const getUpgradeRemaining = (currentLevel) => {
  if (upgradeMode.value === "target") {
    const target = Math.min(6000, Math.floor(Number(targetLevel.value || 0)));
    return target - Number(currentLevel || 0);
  }
  return Math.max(1, Number(levelNum.value || 1));
};

const getNextUpgradeNum = (current, remaining) => {
  const barrier = findNextOrderBarrier(
    current.level,
    remaining,
    current.order,
  );
  const stepLimit = barrier
    ? Math.min(Number(barrier.level) - current.level, remaining)
    : remaining;
  return UPGRADE_OPTIONS.find((num) => num <= stepLimit) || 1;
};

const sendHeroUpgradeLevelWithFallback = async (tokenId, upgradeNum) => {
  let lastError = null;
  const options = UPGRADE_OPTIONS.filter((num) => num <= upgradeNum);
  for (const num of options) {
    try {
      const result = await tokenStore.sendMessageWithPromise(
        tokenId,
        "hero_heroupgradelevel",
        {
          heroId: HeroValue.value,
          upgradeNum: num,
        },
        5000,
      );
      return { result, upgradeNum: num };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("upgrade failed");
};

const levelHeroUpgrade = async () => {
  if (!tokenStore.selectedToken) {
    message.warning("请先选择游戏角色");
    return;
  }

  const tokenId = tokenStore.selectedToken.id;

  // 检查WebSocket连接
  const wsStatus = tokenStore.getWebSocketStatus(tokenId);
  if (wsStatus !== "connected") {
    message.error("WebSocket未连接，无法执行命令");
    return;
  }
  state.value.isRunning = true;

  try {
    let current = {
      level: Number(HeroItem.value?.level || 0),
      order: Number(HeroItem.value?.order || 0),
    };
    let remaining = getUpgradeRemaining(current.level);

    if (remaining <= 0) {
      message.warning("鐩爣绛夌骇蹇呴』澶т簬褰撳墠绛夌骇");
      return;
    }

    while (remaining > 0) {
      const pendingOrder = findPendingOrder(current.level, current.order);
      if (pendingOrder) {
        const orderResult = await tokenStore.sendMessageWithPromise(
          tokenId,
          "hero_heroupgradeorder",
          {
            heroId: HeroValue.value,
          },
          5000,
        );
        if (!orderResult?.role?.heroes) {
          throw new Error("进阶后未返回武将数据");
        }
        current = getHeroUpgradeState(orderResult);
        refreshSelectedHero(current);
        continue;
      }

      const nextUpgradeNum = getNextUpgradeNum(current, remaining);
      if (nextUpgradeNum <= 0) break;

      const { result, upgradeNum } = await sendHeroUpgradeLevelWithFallback(
        tokenId,
        nextUpgradeNum,
      );
      if (result?.role.heroes) {
        current = getHeroUpgradeState(result);
        refreshSelectedHero(current);
        remaining -= upgradeNum;
      } else {
        throw new Error("升级后未返回武将数据");
      }
    }

    const pendingOrder = findPendingOrder(current.level, current.order);
    if (pendingOrder) {
      const orderResult = await tokenStore.sendMessageWithPromise(
        tokenId,
        "hero_heroupgradeorder",
        {
          heroId: HeroValue.value,
        },
        5000,
      );
      if (!orderResult?.role?.heroes) {
        throw new Error("进阶后未返回武将数据");
      }
      current = getHeroUpgradeState(orderResult);
      refreshSelectedHero(current);
    }

    tokenStore.sendGetRoleInfo(tokenId);
    message.success("升级完成");
    return;

    let judgement = judgeLevelupgrade(
      HeroItem.value.level,
      levelNum.value,
      HeroItem.value.order,
    );
    if (judgement == false) {
      const result = await tokenStore.sendMessageWithPromise(
        tokenId,
        "hero_heroupgradelevel",
        {
          heroId: HeroValue.value,
          upgradeNum: levelNum.value,
        },
        5000,
      );
      if (result?.role.heroes) {
        tokenStore.sendGetRoleInfo(tokenId);
      }
    } else {
      message.warning("请手动升级到" + judgement + "级,然后进行进阶");
    }
  } catch (error) {
    message.error(`升级失败: ${error.message}`);
    tokenStore.sendGetRoleInfo(tokenId);
  } finally {
    state.value.isRunning = false;
  }
};

/**
 * 判断是否需要进阶
 * @param {*} level
 */
const levelArr = [
  { level: 100, order: 1 },
  { level: 200, order: 2 },
  { level: 300, order: 3 },
  { level: 500, order: 4 },
  { level: 700, order: 5 },
  { level: 900, order: 6 },
  { level: 1100, order: 7 },
  { level: 1300, order: 8 },
  { level: 1500, order: 9 },
  { level: 1800, order: 10 },
  { level: 2100, order: 11 },
  { level: 2400, order: 12 },
  { level: 2800, order: 13 },
  { level: 3200, order: 14 },
  { level: 3600, order: 15 },
  { level: 4000, order: 16 },
  { level: 4500, order: 17 },
  { level: 5000, order: 18 },
  { level: 5500, order: 19 },
]; //需要进阶的等级
const judgeLevelupgrade = (level, levelNum, order) => {
  for (const item of levelArr) {
    console.log(
      level,
      levelNum,
      order,
      order != item.order,
      level <= item.level,
      item.level < level + levelNum,
    );
    if (
      order != item.order &&
      level <= item.level &&
      item.level < level + levelNum
    ) {
      return item.level;
    } else {
      continue;
    }
  }
  return false;
};

const formatTime = (ts) => new Date(ts).toLocaleTimeString("zh-CN");
</script>

<style scoped lang="scss">
.settings {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);

  .label {
    flex-shrink: 0;
  }
}

.action-row {
  margin: auto;
  width: 100%;
}
.hero-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
}
.hero-property {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
  justify-content: center;

  .current-property {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }
}
.button-area {
  .input-area {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-md);
    margin: var(--spacing-sm);
    .label {
      flex-shrink: 0;
    }
    :deep(.n-select),
    :deep(.n-input-number) {
      flex: 1 1 0;
      min-width: 0;
    }
  }
  .button-group {
    button {
      width: 100%;
      margin-top: var(--spacing-sm);
    }
  }
}
</style>
