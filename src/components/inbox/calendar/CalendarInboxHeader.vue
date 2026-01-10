<template>
  <div class="inbox-header">
    <button
      class="collapse-btn"
      :title="isCollapsed ? 'Expand Inbox' : 'Collapse Inbox'"
      @click="$emit('update:isCollapsed', !isCollapsed)"
    >
      <ChevronLeft v-if="!isCollapsed" :size="16" />
      <ChevronRight v-else :size="16" />
    </button>
    <h3 v-if="!isCollapsed" class="inbox-title">
      Inbox
    </h3>

    <!-- Expanded state count -->
    <NBadge v-if="!isCollapsed" :value="inboxCount" type="info" />

    <!-- Quick Today Filter -->
    <button
      v-if="!isCollapsed"
      class="today-quick-filter"
      :class="{ active: showTodayOnly }"
      :title="`Show tasks due today (${todayCount})`"
      @click="$emit('update:showTodayOnly', !showTodayOnly)"
    >
      <CalendarDays :size="14" />
      <span>Today</span>
      <span v-if="todayCount > 0" class="count-badge">{{ todayCount }}</span>
    </button>
  </div>

  <!-- Collapsed state task count indicators -->
  <div v-if="isCollapsed" class="collapsed-badges-container">
    <BaseBadge
      v-if="!hasActiveFilters"
      variant="count"
      size="sm"
      rounded
    >
      {{ baseCount }}
    </BaseBadge>
    <div v-else class="dual-badges">
      <BaseBadge
        variant="count"
        size="sm"
        rounded
        class="total-count"
      >
        {{ baseCount }}
      </BaseBadge>
      <BaseBadge
        variant="info"
        size="sm"
        rounded
        class="filtered-count"
      >
        {{ inboxCount }}
      </BaseBadge>
    </div>
  </div>

  <!-- Canvas Group Filter -->
  <div v-if="!isCollapsed && canvasGroupOptions.length > 1" class="canvas-group-filter">
    <CustomSelect
      :model-value="selectedCanvasGroups"
      @update:model-value="$emit('update:selectedCanvasGroups', $event)"
      :options="canvasGroupOptions"
      placeholder="Show from: All Tasks"
    />
  </div>

  <!-- Additional Filters -->
  <div v-if="!isCollapsed" class="advanced-filters-section">
    <button
      class="toggle-filters-btn"
      :class="{ active: showAdvancedFilters }"
      @click="$emit('update:showAdvancedFilters', !showAdvancedFilters)"
    >
      <Filter :size="14" />
      <span>{{ showAdvancedFilters ? 'Hide filters' : 'More filters' }}</span>
      <ChevronDown :size="14" class="toggle-icon" :class="{ rotated: showAdvancedFilters }" />
    </button>

    <Transition name="slide-down">
      <InboxFilters
        v-if="showAdvancedFilters"
        :unscheduled-only="unscheduledOnly"
        @update:unscheduled-only="$emit('update:unscheduledOnly', $event)"
        :selected-priority="selectedPriority"
        @update:selected-priority="$emit('update:selectedPriority', $event)"
        :selected-project="selectedProject"
        @update:selected-project="$emit('update:selectedProject', $event)"
        :selected-duration="selectedDuration"
        @update:selected-duration="$emit('update:selectedDuration', $event)"
        :hide-done-tasks="hideDoneTasks"
        :tasks="baseTasks"
        :projects="rootProjects"
        @update:hide-done-tasks="$emit('toggleHideDoneTasks')"
        @clear-all="$emit('clearAllFilters')"
      />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ChevronLeft, ChevronRight, CalendarDays, Filter, ChevronDown } from 'lucide-vue-next'
import { NBadge } from 'naive-ui'
import BaseBadge from '@/components/base/BaseBadge.vue'
import CustomSelect from '@/components/common/CustomSelect.vue'
import InboxFilters from '@/components/canvas/InboxFilters.vue'
import { type Task } from '@/stores/tasks'
import { type DurationCategory } from '@/utils/durationCategories'

defineProps<{
  isCollapsed: boolean
  inboxCount: number
  showTodayOnly: boolean
  todayCount: number
  hasActiveFilters: boolean
  baseCount: number
  canvasGroupOptions: any[]
  selectedCanvasGroups: Set<string>
  showAdvancedFilters: boolean
  unscheduledOnly: boolean
  selectedPriority: 'high' | 'medium' | 'low' | null
  selectedProject: string | null
  selectedDuration: DurationCategory | null
  hideDoneTasks: boolean
  baseTasks: Task[]
  rootProjects: any[]
}>()

defineEmits<{
  (e: 'update:isCollapsed', value: boolean): void
  (e: 'update:showTodayOnly', value: boolean): void
  (e: 'update:selectedCanvasGroups', value: Set<string>): void
  (e: 'update:showAdvancedFilters', value: boolean): void
  (e: 'update:unscheduledOnly', value: boolean): void
  (e: 'update:selectedPriority', value: 'high' | 'medium' | 'low' | null): void
  (e: 'update:selectedProject', value: string | null): void
  (e: 'update:selectedDuration', value: DurationCategory | null): void
  (e: 'toggleHideDoneTasks'): void
  (e: 'clearAllFilters'): void
}>()
</script>

<style scoped>
.inbox-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
}

.collapse-btn {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-muted);
  padding: var(--space-1);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all var(--duration-normal) var(--spring-smooth);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.collapse-btn:hover {
  background: var(--state-hover-bg);
  color: var(--text-primary);
}

.inbox-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
  flex: 1;
}

.today-quick-filter {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: var(--glass-bg-light);
  backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  white-space: nowrap;
}

.today-quick-filter:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.today-quick-filter.active {
  background: var(--brand-bg-subtle);
  border-color: var(--brand-border-subtle);
  color: var(--brand-primary);
}

.today-quick-filter .count-badge {
  background: var(--brand-primary);
  color: white;
  font-size: 10px;
  padding: 0 4px;
  border-radius: var(--radius-full);
  min-width: 16px;
  text-align: center;
}

.collapsed-badges-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin-top: var(--space-2);
}

.dual-badges {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.toggle-filters-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: var(--text-xs);
  cursor: pointer;
  padding: var(--space-1) 0;
  width: 100%;
}

.toggle-filters-btn:hover {
  color: var(--text-primary);
}

.toggle-icon {
  transition: transform var(--duration-normal);
  margin-left: auto;
}

.toggle-icon.rotated {
  transform: rotate(180deg);
}
</style>
