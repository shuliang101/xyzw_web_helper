<template>
  <span v-if="pet" class="pet-badge">
    <img v-if="pet.icon" :src="pet.icon" :alt="pet.name" />
    <span class="pet-name" :style="{ color: pet.color }">{{ pet.name }}</span>
    <span v-if="pet.level" class="pet-level">Lv.{{ pet.level }}</span>
    <span v-if="Number(pet.petId) >= 700 && pet.star" class="pet-star" :style="starStyle">{{ formatStarLevel(pet.star) }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue';
import { formatStarLevel, getStarTier } from '@/utils/HeroList';
const props = defineProps({ pet: { type: Object, default: null } });
const starStyle = computed(() => {
  const tier = getStarTier(props.pet?.star);
  return { color: tier.color, backgroundColor: tier.background };
});
</script>

<style scoped>
.pet-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; }
.pet-badge img { width: 22px; height: 22px; border-radius: 50%; object-fit: cover; }
.pet-name { font-weight: 600; }
.pet-level { color: #888; }
.pet-star { color: #d4a017; font-weight: 600; }
</style>
