<template>
  <MyCard class="helper" :statusClass="{ active: state.isRunning }">
    <template #icon>
      <img :src="iconPath" alt="招募图标" />
    </template>
    <template #title>
      <h3>招募助手</h3>
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
          <n-input-number
            v-model:value="number"
            :min="10"
            :step="10"
            :precision="0"
            placeholder="输入招募数量"
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
        {{ state.isRunning ? "运行中" : "开始招募" }}
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
const iconPath = computed(() => import.meta.env.BASE_URL + "icons/zml.png");

const roleInfo = computed(() => tokenStore.gameData?.roleInfo || null);

const dataList = computed(() => {
  const getImgPath = (path) =>
    import.meta.env.BASE_URL + path.replace(/^\//, "");
  return [
    {
      type: "招募令",
      img: getImgPath("/icons/zml.png"),
      count: roleInfo.value?.role?.items?.[1001]?.quantity || 0,
    },
  ];
});

const number = ref(10);

const state = ref({
  isRunning: false,
});

const getRecruitTokenCount = () =>
  roleInfo.value?.role?.items?.[1001]?.quantity || 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const syncRoleState = async (tokenId) => {
  await tokenStore.sendMessageWithPromise(tokenId, "role_getroleinfo", {}, 10000);
  await sleep(500);
};

const recruitBatch = (tokenId, recruitNumber) =>
  tokenStore.sendMessageWithPromise(
    tokenId,
    "hero_recruit",
    { recruitType: 1, recruitNumber },
    10000,
  );

const runRecruitBatch = async (tokenId, recruitNumber) => {
  try {
    await recruitBatch(tokenId, recruitNumber);
    return;
  } catch (error) {
    const messageText = String(error?.message || error);
    if (!messageText.includes("400312") && !messageText.includes("200020")) {
      throw error;
    }

    await syncRoleState(tokenId);
    await sleep(1200);

    try {
      await recruitBatch(tokenId, recruitNumber);
      return;
    } catch (retryError) {
      if (recruitNumber <= 1) throw retryError;

      for (let i = 0; i < recruitNumber; i++) {
        await syncRoleState(tokenId);
        await sleep(800);
        await recruitBatch(tokenId, 1);
      }
    }
  }
};

const handleHelper = async () => {
  if (!tokenStore.selectedToken) {
    message.warning("请先选择Token");
    return;
  }
  const recruitCount = Math.floor(Number(number.value || 0));
  if (recruitCount < 10) {
    message.warning("请输入正确数量");
    return;
  }
  if (false && recruitCount % 10 !== 0) {
    message.warning("招募数量必须是 10 的倍数");
    return;
  }
  const availableCount = getRecruitTokenCount();
  if (false && recruitCount > availableCount) {
    message.warning(`数量不足，当前只有 ${availableCount} 个`);
    return;
  }
  const tokenId = tokenStore.selectedToken.id;
  state.value.isRunning = true;
  message.info("招募助手运行中");
  try {
    await syncRoleState(tokenId);
    let remaining = recruitCount;
    while (remaining > 0) {
      const batchCount = Math.min(10, remaining);
      await runRecruitBatch(tokenId, batchCount);
      remaining -= batchCount;
      await sleep(1000);
    }
    await tokenStore.sendMessage(tokenId, "role_getroleinfo");
    // 更新活动进度
    tokenStore.sendMessage(tokenId, "activity_get");
    message.success("招募完毕");
  } catch (error) {
    message.error(`招募失败: ${error.message || error}`);
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
      grid-template-columns: minmax(0, 1fr);
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
