<template>
  <div :class="compact ? 'heroes-grid compact' : 'hero-list'">
    <div v-for="(hero, index) in heroes" :key="hero.heroId || index" :class="compact ? 'hero-card compact' : 'hero-item'" @click="$emit('select', hero)">
      <n-avatar round :size="compact ? 64 : 40" :src="hero.heroAvate" />
      <div class="hero-info">
        <span class="hero-name">{{ hero.heroName || '未知武将' }}</span>
        <div class="hero-stats">
          <span>战力: {{ hero.power || 0 }}</span><span>星级: {{ hero.star || 0 }}</span><span>红数: {{ hero.red || 0 }}</span>
          <span v-if="showHole">开孔: {{ reliable ? (hero.hole || 0) : '接口未返回' }}</span>
          <span :class="hero.HolyBeast ? 'opened' : 'closed'">{{ hero.HolyBeast ? '已开四圣' : '未开四圣' }}</span>
          <span v-if="hero.HolyBeast">四圣等级: {{ hero.HBlevel || 0 }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { formatStarLevel } from '@/utils/HeroList';
defineEmits(['select']);
defineProps({ heroes: { type: Array, default: () => [] }, compact: Boolean, showHole: Boolean, reliable: { type: Boolean, default: true } });
</script>

<style scoped>
.hero-list,.heroes-grid{display:grid;gap:12px}.hero-list{grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}.heroes-grid{grid-template-columns:repeat(5,minmax(0,1fr));gap:16px}.hero-item,.hero-card{min-width:0;box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg-secondary,#f9f9f9);border:1px solid var(--border-light,#eee);border-radius:6px;cursor:pointer}.hero-card{flex-direction:column;justify-content:center;text-align:center;height:190px}.hero-info{min-width:0;flex:1}.hero-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}.hero-stats{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px;font-size:12px;color:var(--text-secondary,#666)}.hero-card .hero-stats{flex-direction:column;align-items:center}.opened{color:#18a058}.closed{color:#f0a020}@media(max-width:768px){.heroes-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.hero-card{height:auto;min-height:170px;padding:10px 6px}}
</style>
