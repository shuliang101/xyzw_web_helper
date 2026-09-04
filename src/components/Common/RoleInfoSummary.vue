<template>
  <div class="role-summary">
    <n-avatar round :size="60" :src="role.headImg" />
    <div class="role-detail">
      <h3>{{ role.name || '未知玩家' }}</h3>
      <div class="summary-row">
        <span>战力: <b>{{ role.power || 0 }}</b></span>
        <span>服务器: {{ role.serverName || '未知' }}</span>
      </div>
      <div class="summary-row">俱乐部: {{ role.legionName || '无' }}</div>
      <div class="summary-row">
        <span>总红数: {{ role.totalRedCount || 0 }}</span>
        <span>四圣: {{ role.holyBeast || 0 }}</span>
      </div>
      <PetBadge v-if="role.pet" :pet="role.pet" />
    </div>
  </div>
</template>

<script setup>
import PetBadge from './PetBadge.vue';
defineProps({ role: { type: Object, required: true } });
</script>

<style scoped>
.role-summary{display:flex;align-items:center;gap:16px;padding-bottom:15px;border-bottom:1px solid var(--border-light,#eee)}
.role-detail{min-width:0;flex:1}.role-detail h3{margin:0 0 8px;font-size:16px}.summary-row{display:flex;flex-wrap:wrap;gap:16px;margin-bottom:4px;font-size:14px;color:var(--text-secondary,#666)}.summary-row b{color:#1890ff}.pet-badge{margin-top:2px}
</style>
