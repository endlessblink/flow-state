<script setup lang="ts">
import { Layout, Crosshair, Skull, Zap, Trophy } from 'lucide-vue-next'

type SectionId = 'overview' | 'missions' | 'boss' | 'upgrades' | 'achievements'

defineProps<{
  activeSection: SectionId
}>()

const emit = defineEmits<{
  'update:activeSection': [section: SectionId]
}>()

const tabs = [
  { id: 'overview', label: 'OVERVIEW', icon: Layout },
  { id: 'missions', label: 'MISSIONS', icon: Crosshair },
  { id: 'boss', label: 'BOSS', icon: Skull },
  { id: 'upgrades', label: 'UPGRADES', icon: Zap },
  { id: 'achievements', label: 'TROPHIES', icon: Trophy },
] as const

const handleTabClick = (tabId: typeof tabs[number]['id']) => {
  emit('update:activeSection', tabId)
}
</script>

<template>
  <nav class="cyber-section-nav">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="cyber-nav-tab"
      :class="{ 'cyber-nav-tab--active': activeSection === tab.id }"
      @click="handleTabClick(tab.id)"
    >
      <component :is="tab.icon" class="cyber-nav-tab__icon" />
      <span class="cyber-nav-tab__label">{{ tab.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.cyber-section-nav {
  display: flex;
  gap: var(--space-1);
  border-bottom: 1px solid var(--border-subtle);
  background: transparent;
}

.cyber-nav-tab {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  font-family: var(--font-cyber-title);
  font-size: var(--text-sm);
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

@media (prefers-reduced-motion: reduce) {
  .cyber-nav-tab {
    transition: none;
  }
}

.cyber-nav-tab__icon {
  width: var(--space-3_5);
  height: var(--space-3_5);
}

.cyber-nav-tab__label {
  font-weight: 600;
}

.cyber-nav-tab:hover:not(.cyber-nav-tab--active) {
  color: var(--text-secondary);
  text-shadow: 0 0 8px var(--cf-cyan-20);
}

.cyber-nav-tab--active {
  color: var(--text-primary);
  border-bottom-color: var(--cf-cyan);
  box-shadow: 0 2px 8px var(--cf-cyan-20);
}

@media (prefers-reduced-motion: reduce) {
  .cyber-nav-tab--active {
    box-shadow: none;
  }

  .cyber-nav-tab:hover:not(.cyber-nav-tab--active) {
    text-shadow: none;
  }
}
</style>
