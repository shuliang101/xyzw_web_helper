<template>
  <span v-if="pet" class="pet-badge">
    <img v-if="pet.icon" :src="pet.icon" :alt="pet.name" />
    <span class="pet-name" :style="{ color: pet.color }">{{ pet.name }}</span>
    <span v-if="pet.level" class="pet-level">Lv.{{ pet.level }}</span>
  </span>
</template>

<script setup>
defineProps({ pet: { type: Object, default: null } });
</script>

<style scoped>
.pet-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; }
.pet-badge img { width: 22px; height: 22px; border-radius: 50%; object-fit: cover; }
.pet-name { font-weight: 600; }
.pet-level { color: #888; }
</style>
