<template>
  <MyCard class="bottle-helper" :statusClass="{ active: state.isRunning }">
    <template #icon>
      <img :src="iconPath" alt="宝箱图标" />
    </template>
    <template #title>
      <h3>宝箱助手</h3>
    </template>
    <template #badge>
      <span>{{ state.isRunning ? "运行中" : "已停止" }}</span>
    </template>
    <template #default>
      <div class="total-points">
        <span class="label">宝箱总积分：</span>
        <span class="value">{{ totalPoints }}</span>
      </div>
      <div class="container">
        <div class="list">
          <div class="item" v-for="item in boxDataList" :key="item.type">
            <img :src="item.img" :alt="item.type" />
            <div class="box-info">
              <div class="box-type">{{ item.type }}</div>
              <div class="box-count">数量：{{ item.count }}</div>
            </div>
          </div>
        </div>
        <div class="selects">
          <n-select v-model:value="type" :options="typeOptions" />
          <n-input-number
            v-model:value="number"
            :min="1"
            :step="10"
            :precision="0"
            placeholder="输入开箱数量"
          />
        </div>
      </div>
    </template>
    <template #action>
      <a-button
        type="primary"
        :disabled="state.isRunning"
        secondary
        size="small"
        block
        @click="handleBoxHelper"
      >
        {{ state.isRunning ? "运行中" : "开启宝箱" }}
      </a-button>
      <a-button type="primary" size="small" @click="batchclaimboxpointreward"
        >领取宝箱积分</a-button
      >
    </template>
  </MyCard>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, watchEffect } from "vue";
import { useMessage } from "naive-ui";
import { useTokenStore } from "@/stores/tokenStore";
import MyCard from "../Common/MyCard.vue";

const tokenStore = useTokenStore();
const message = useMessage();

const iconPath = computed(() => import.meta.env.BASE_URL + "box/zsbx.png");

const roleInfo = computed(() => tokenStore.gameData?.roleInfo || null);

const boxDataList = computed(() => {
  const getImgPath = (path) =>
    import.meta.env.BASE_URL + path.replace(/^\//, "");
  return [
    {
      type: "木质宝箱",
      img: getImgPath("/box/mzbx.png"),
      count: roleInfo.value?.role?.items?.[2001]?.quantity || 0,
    },
    {
      type: "青铜宝箱",
      img: getImgPath("/box/qtbx.png"),
      count: roleInfo.value?.role?.items?.[2002]?.quantity || 0,
    },
    {
      type: "黄金宝箱",
      img: getImgPath("/box/hjbx.png"),
      count: roleInfo.value?.role?.items?.[2003]?.quantity || 0,
    },
    {
      type: "铂金宝箱",
      img: getImgPath("/box/bjbx.png"),
      count: roleInfo.value?.role?.items?.[2004]?.quantity || 0,
    },
  ];
});

const totalPoints = computed(() => {
  const wooden = roleInfo.value?.role?.items?.[2001]?.quantity || 0;
  const bronze = roleInfo.value?.role?.items?.[2002]?.quantity || 0;
  const gold = roleInfo.value?.role?.items?.[2003]?.quantity || 0;
  const platinum = roleInfo.value?.role?.items?.[2004]?.quantity || 0;

  return wooden * 1 + bronze * 10 + gold * 20 + platinum * 50;
});

const type = ref(2001);
const typeOptions = [
  { label: "木质宝箱", value: 2001 },
  { label: "青铜宝箱", value: 2002 },
  { label: "黄金宝箱", value: 2003 },
  { label: "铂金宝箱", value: 2004 },
];

const number = ref(10);

const state = ref({
  isRunning: false,
});

const getSelectedBoxCount = () =>
  roleInfo.value?.role?.items?.[type.value]?.quantity || 0;

const MAX_BOX_OPEN_BATCH = 100;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const syncRoleState = async (tokenId) => {
  await tokenStore.sendMessageWithPromise(tokenId, "role_getroleinfo", {}, 10000);
  await sleep(500);
};

const openBoxBatch = (tokenId, itemId, boxNumber) =>
  tokenStore.sendMessageWithPromise(
    tokenId,
    "item_openbox",
    { itemId, number: boxNumber },
    10000,
  );

const runBoxBatch = async (tokenId, itemId, boxNumber) => {
  try {
    await openBoxBatch(tokenId, itemId, boxNumber);
    return;
  } catch (error) {
    await syncRoleState(tokenId);
    await sleep(1200);

    try {
      await openBoxBatch(tokenId, itemId, boxNumber);
      return;
    } catch (retryError) {
      if (boxNumber <= 1) throw retryError;

      const fallbackBatch = boxNumber > 10 ? 10 : 1;
      let remaining = boxNumber;
      while (remaining > 0) {
        const count = Math.min(fallbackBatch, remaining);
        await runBoxBatch(tokenId, itemId, count);
        remaining -= count;
        if (remaining > 0) await sleep(500);
      }
    }
  }
};

const batchclaimboxpointreward = async () => {
  if (!tokenStore.selectedToken) {
    message.warning("请先选择Token");
    return;
  }
  const openCount = Math.floor(Number(number.value || 0));
  if (false && openCount < 1) {
    message.warning("请输入正确数量");
    return;
  }
  const availableCount = getSelectedBoxCount();
  if (false && openCount > availableCount) {
    message.warning(`数量不足，当前只有 ${availableCount} 个`);
    return;
  }
  const tokenId = tokenStore.selectedToken.id;
  await tokenStore.sendMessage(tokenId, "item_batchclaimboxpointreward");
  await new Promise((r) => setTimeout(r, 500));
  await tokenStore.sendMessage(tokenId, "role_getroleinfo");
  message.success("宝箱积分领取完毕");
};

const handleBoxHelper = async () => {
  if (!tokenStore.selectedToken) {
    message.warning("请先选择Token");
    return;
  }
  const openCount = Math.floor(Number(number.value || 0));
  if (openCount < 1) {
    message.warning("请输入正确数量");
    return;
  }
  const availableCount = getSelectedBoxCount();
  if (openCount > availableCount) {
    message.warning(`数量不足，当前只有 ${availableCount} 个`);
    return;
  }
  const tokenId = tokenStore.selectedToken.id;
  state.value.isRunning = true;
  message.info("宝箱开启中");
  try {
    let remaining = openCount;
    while (remaining > 0) {
      const batchCount = Math.min(MAX_BOX_OPEN_BATCH, remaining);
      await runBoxBatch(tokenId, type.value, batchCount);
      remaining -= batchCount;
      if (remaining > 0) await sleep(500);
    }
    await tokenStore.sendMessage(tokenId, "item_batchclaimboxpointreward");
    await new Promise((r) => setTimeout(r, 500));
    await tokenStore.sendMessage(tokenId, "role_getroleinfo");
    // 更新活动进度
    tokenStore.sendMessage(tokenId, "activity_get");
    message.success("宝箱开启完毕");
  } catch (error) {
    message.error(`宝箱开启失败: ${error.message || error}`);
  } finally {
    state.value.isRunning = false;
  }
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
    justify-content: space-between;
    gap: var(--spacing-sm);
    min-width: 0;

    .item {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 0;
      flex: 1 1 0;

      > img {
        width: 40px;
        height: 40px;
      }

      .box-info {
        display: flex;
        flex-direction: column;
        align-items: center;

        .box-type {
          font-weight: bold;
          margin-top: 4px;
          text-align: center;
          overflow-wrap: anywhere;
        }

        .box-count {
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
    min-width: 0;

    :deep(.n-select),
    :deep(.n-input-number) {
      min-width: 0;
      flex: 1 1 0;
    }
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

@media (max-width: 640px) {
  .container {
    .list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      justify-content: stretch;
    }

    .selects {
      flex-direction: column;
      align-items: stretch;
      gap: var(--spacing-sm);
    }
  }
}
</style>
