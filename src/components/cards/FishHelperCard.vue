<template>
  <MyCard class="helper" :statusClass="{ active: state.isRunning }">
    <template #icon>
      <img :src="iconPath" alt="普通鱼竿图标" />
    </template>
    <template #title>
      <h3>钓鱼助手</h3>
    </template>
    <template #badge>
      <span>{{ state.isRunning ? "运行中" : "已停止" }}</span>
    </template>
    <template #default>
      <div class="container">
        <div class="list">
          <div class="item" v-for="item in dataList" :key="item.type">
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
            :min="10"
            :step="10"
            :precision="0"
            placeholder="输入钓鱼数量"
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
        @click="handleHelper"
      >
        {{ state.isRunning ? "运行中" : "开始钓鱼" }}
      </a-button>
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

const iconPath = computed(() => {
  return import.meta.env.BASE_URL + "fish/hjyg.png";
});

const roleInfo = computed(() => tokenStore.gameData?.roleInfo || null);

const dataList = computed(() => {
  const getImgPath = (path) =>
    import.meta.env.BASE_URL + path.replace(/^\//, "");
  return [
    {
      type: "普通鱼竿",
      img: getImgPath("/fish/ptyg.png"),
      count: roleInfo.value?.role?.items?.[1011]?.quantity || 0,
    },
    {
      type: "黄金鱼竿",
      img: getImgPath("/fish/hjyg.png"),
      count: roleInfo.value?.role?.items?.[1012]?.quantity || 0,
    },
  ];
});

const type = ref(1);
const typeOptions = [
  { label: "普通鱼竿", value: 1 },
  { label: "黄金鱼竿", value: 2 },
];

const number = ref(10);

const state = ref({
  isRunning: false,
});

const getSelectedFishRodCount = () => {
  const itemId = type.value === 1 ? 1011 : 1012;
  return roleInfo.value?.role?.items?.[itemId]?.quantity || 0;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const syncRoleState = async (tokenId) => {
  await tokenStore.sendMessageWithPromise(tokenId, "role_getroleinfo", {}, 10000);
  await sleep(500);
};

const fishBatch = (tokenId, fishType, lotteryNumber) =>
  tokenStore.sendMessageWithPromise(
    tokenId,
    "artifact_lottery",
    { type: fishType, lotteryNumber, newFree: true },
    10000,
  );

const runFishBatch = async (tokenId, fishType, lotteryNumber) => {
  try {
    await fishBatch(tokenId, fishType, lotteryNumber);
    return;
  } catch (error) {
    const messageText = String(error?.message || error);
    if (!messageText.includes("200020") && !messageText.includes("400312")) {
      throw error;
    }

    await syncRoleState(tokenId);
    await sleep(1200);

    try {
      await fishBatch(tokenId, fishType, lotteryNumber);
      return;
    } catch (retryError) {
      if (lotteryNumber <= 1) throw retryError;

      for (let i = 0; i < lotteryNumber; i++) {
        await syncRoleState(tokenId);
        await sleep(800);
        await fishBatch(tokenId, fishType, 1);
      }
    }
  }
};

const handleHelper = async () => {
  if (!tokenStore.selectedToken) {
    message.warning("请先选择Token");
    return;
  }
  const fishCount = Math.floor(Number(number.value || 0));
  if (fishCount < 10) {
    message.warning("请输入正确数量");
    return;
  }
  if (fishCount % 10 !== 0) {
    message.warning("钓鱼数量必须是 10 的倍数");
    return;
  }
  const availableCount = getSelectedFishRodCount();
  if (fishCount > availableCount) {
    message.warning(`数量不足，当前只有 ${availableCount} 个`);
    return;
  }
  const tokenId = tokenStore.selectedToken.id;
  state.value.isRunning = true;
  message.info("钓鱼助手运行中");
  console.log("🚀 ~ handleHelper ~ type.value:", type.value);
  try {
    await syncRoleState(tokenId);
    let remaining = fishCount;
    while (remaining > 0) {
      const batchCount = Math.min(10, remaining);
      await runFishBatch(tokenId, type.value, batchCount);
      remaining -= batchCount;
      await sleep(1000);
    }
    await tokenStore.sendMessage(tokenId, "role_getroleinfo");
    // 更新活动进度
    tokenStore.sendMessage(tokenId, "activity_get");
    message.success("钓鱼完毕");
  } catch (error) {
    message.error(`钓鱼失败: ${error.message || error}`);
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
    justify-content: space-around;
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
