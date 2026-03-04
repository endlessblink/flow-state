<template>
  <div class="duration-section">
    <button
      class="section-toggle"
      :aria-expanded="sidebar.isDurationSectionExpanded.value"
      @click="sidebar.toggleDurationSection"
    >
      <Clock :size="14" />
      <span>{{ $t('sidebar.duration_group') }}</span>
      <ChevronRight
        :size="14"
        class="toggle-chevron"
        :class="{ rotated: sidebar.isDurationSectionExpanded.value }"
      />
    </button>

    <div v-show="sidebar.isDurationSectionExpanded.value" class="duration-grid">
      <!-- Quick (<15m) -->
      <SidebarSmartItem
        :active="taskStore.activeDurationFilter === 'quick'"
        :count="sidebar.quickCount.value"
        drop-type="duration"
        :drop-value="15"
        color="green"
        compact
        @click="sidebar.selectSmartView('quick')"
      >
        <template #icon>
          <Zap :size="14" />
        </template>
        {{ $t('sidebar.quick') }}
      </SidebarSmartItem>

      <!-- Short (15-30m) -->
      <SidebarSmartItem
        :active="taskStore.activeDurationFilter === 'short'"
        :count="sidebar.shortCount.value"
        drop-type="duration"
        :drop-value="30"
        color="teal"
        compact
        @click="sidebar.selectSmartView('short')"
      >
        <template #icon>
          <Coffee :size="14" />
        </template>
        {{ $t('sidebar.short') }}
      </SidebarSmartItem>

      <!-- Medium (30-60m) -->
      <SidebarSmartItem
        :active="taskStore.activeDurationFilter === 'medium'"
        :count="sidebar.mediumCount.value"
        drop-type="duration"
        :drop-value="60"
        color="teal"
        compact
        @click="sidebar.selectSmartView('medium')"
      >
        <template #icon>
          <Hourglass :size="14" />
        </template>
        {{ $t('sidebar.medium') }}
      </SidebarSmartItem>

      <!-- Long (>60m) -->
      <SidebarSmartItem
        :active="taskStore.activeDurationFilter === 'long'"
        :count="sidebar.longCount.value"
        drop-type="duration"
        :drop-value="120"
        color="purple"
        compact
        @click="sidebar.selectSmartView('long')"
      >
        <template #icon>
          <Mountain :size="14" />
        </template>
        {{ $t('sidebar.long') }}
      </SidebarSmartItem>

      <!-- Unestimated -->
      <SidebarSmartItem
        :active="taskStore.activeDurationFilter === 'unestimated'"
        :count="sidebar.unestimatedCount.value"
        drop-type="duration"
        :drop-value="-1"
        color="gray"
        compact
        @click="sidebar.selectSmartView('unestimated')"
      >
        <template #icon>
          <HelpCircle :size="14" />
        </template>
        {{ $t('sidebar.no_estimate') }}
      </SidebarSmartItem>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTaskStore } from '@/stores/tasks'
import { useSidebarManagement } from '@/composables/app/useSidebarManagement'
import { Clock, ChevronRight, Zap, Coffee, Hourglass, Mountain, HelpCircle } from 'lucide-vue-next'
import SidebarSmartItem from '@/components/layout/SidebarSmartItem.vue'

const taskStore = useTaskStore()
const sidebar = useSidebarManagement()
</script>

<style scoped>
.duration-section {
  margin-bottom: var(--space-4);
}

.section-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-1);
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  letter-spacing: 0.05em;
  cursor: pointer;
  text-transform: uppercase;
  margin-bottom: var(--space-2);
}

.section-toggle:hover {
  color: var(--text-secondary);
}

.toggle-chevron {
  margin-inline-start: auto;
  transition: transform var(--duration-fast);
  opacity: 0.5;
}

.toggle-chevron.rotated {
  transform: rotate(90deg);
}

.duration-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-2);
  padding: 0 var(--space-4) var(--space-4) var(--space-4);
}
</style>
