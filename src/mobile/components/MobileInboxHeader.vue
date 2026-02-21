<template>
  <div class="mobile-inbox-header">
    <div class="header-left">
      <div class="view-toggle">
        <button
          class="toggle-btn"
          :class="{ active: viewMode === 'tasks' }"
          @click="$emit('update:viewMode', 'tasks')"
        >
          Tasks
        </button>
        <button
          class="toggle-btn"
          :class="{ active: viewMode === 'today' }"
          @click="$emit('update:viewMode', 'today')"
        >
          Today
        </button>
      </div>
      <span v-if="viewMode === 'today'" class="today-subtitle">{{ todayDateLabel }}</span>
    </div>
    <div class="header-actions">
      <span class="task-count">{{ filteredTasksCount }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ViewMode } from '@/mobile/composables/useMobileInboxLogic'

defineProps<{
  viewMode: ViewMode
  todayDateLabel: string
  filteredTasksCount: number
}>()

defineEmits<{
  (e: 'update:viewMode', mode: ViewMode): void
}>()
</script>

<style scoped>
.mobile-inbox-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4);
  position: sticky;
  top: 0;
  background: var(--app-background-gradient);
  z-index: 10;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.view-toggle {
  display: flex;
  background: var(--surface-secondary);
  border-radius: var(--radius-xl);
  padding: var(--space-0_5);
  gap: var(--space-0_5);
}

.toggle-btn {
  padding: var(--space-1_5) var(--space-4);
  border-radius: var(--radius-lg);
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
}

.toggle-btn.active {
  background: var(--surface-primary);
  color: var(--text-primary);
  box-shadow: var(--shadow-xs);
}

.today-subtitle {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  padding-left: var(--space-2);
}

.task-count {
  background: var(--surface-secondary);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-xl);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

[dir="rtl"] .mobile-inbox-header {
  flex-direction: row-reverse;
}

[dir="rtl"] .today-subtitle {
  padding-left: 0;
  padding-right: var(--space-2);
}
</style>
