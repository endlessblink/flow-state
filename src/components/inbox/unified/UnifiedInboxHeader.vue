<template>
  <div class="inbox-header" :class="{ 'is-collapsed': isCollapsed }">
    <button 
      class="collapse-btn" 
      :class="{ 'is-collapsed': isCollapsed }" 
      :title="isCollapsed ? 'Expand Inbox' : 'Collapse Inbox'" 
      @click="$emit('toggleCollapse')"
    >
      <template v-if="context === 'canvas'">
        <ChevronRight v-if="!isCollapsed" :size="16" />
        <ChevronLeft v-else :size="14" />
      </template>
      <template v-else>
        <ChevronLeft v-if="!isCollapsed" :size="16" />
        <ChevronRight v-else :size="14" />
      </template>
    </button>
    <h3 v-if="!isCollapsed" class="inbox-title">
      Inbox
    </h3>

    <!-- Count Badge -->
    <NBadge v-if="!isCollapsed" :value="taskCount" type="info" />

    <!-- Quick Today Filter -->
    <button
      v-if="!isCollapsed"
      class="today-quick-filter"
      :class="{ active: activeTimeFilter === 'today' }"
      :title="`Filter inbox: Show only today's tasks (${todayCount})`"
      @click="$emit('toggleToday')"
    >
      <CalendarDays :size="14" />
      <span>Today</span>
      <span v-if="todayCount > 0" class="count-badge">{{ todayCount }}</span>
    </button>
  </div>

  <!-- Filter Chips (Canvas Groups) -->
  <div v-if="!isCollapsed && showGroupChips" class="group-filter-chips">
    <button
      v-for="group in groupOptions"
      :key="group.value"
      class="group-chip"
      :class="{ active: isChipActive(group) }"
      :style="getChipStyle(group)"
      :title="group.value === '' ? 'Show all tasks' : `Filter by ${group.label} (Ctrl+click for multi-select)`"
      @click="handleChipClick($event, group)"
    >
      <span v-if="group.color" class="chip-dot" :style="{ backgroundColor: group.color }" />
      <span class="chip-label">{{ group.label }}</span>
      <span v-if="group.count !== undefined" class="chip-count">{{ group.count }}</span>
    </button>
  </div>

  <!-- Advanced Filters Toggle -->
  <div v-if="!isCollapsed" class="advanced-filters-section">
    <button
      class="toggle-filters-btn"
      :class="{ active: showAdvancedFilters }"
      @click="$emit('toggleAdvancedFilters')"
    >
      <Filter :size="14" />
      <span>{{ showAdvancedFilters ? 'Hide filters' : 'More filters' }}</span>
      <ChevronDown :size="14" class="toggle-icon" :class="{ rotated: showAdvancedFilters }" />
    </button>

    <Transition name="slide-down">
      <InboxFilters
        v-if="showAdvancedFilters"
        :unscheduled-only="unscheduledOnly"
        :selected-priority="selectedPriority"
        :selected-project="selectedProject"
        :selected-duration="selectedDuration"
        :hide-done-tasks="hideDoneTasks"
        :tasks="baseTasks"
        :projects="rootProjects"
        @update:unscheduled-only="$emit('update:unscheduled-only', $event)"
        @update:selected-priority="$emit('update:selected-priority', $event)"
        @update:selected-project="$emit('update:selected-project', $event)"
        @update:selected-duration="$emit('update:selected-duration', $event)"
        @update:hide-done-tasks="$emit('update:hide-done-tasks', $event)"
        @clear-all="$emit('clearAll')"
      />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ChevronLeft, ChevronRight, CalendarDays, Filter, ChevronDown } from 'lucide-vue-next'
import { NBadge } from 'naive-ui'
import InboxFilters from '@/components/canvas/InboxFilters.vue'
import type { Task } from '@/types/tasks'
import type { DurationCategory } from '@/utils/durationCategories'

interface GroupOption {
  label: string
  value: string
  color?: string
  count?: number
}

const props = defineProps<{
  isCollapsed: boolean
  taskCount: number
  activeTimeFilter: 'all' | 'today'
  todayCount: number
  showGroupChips: boolean
  groupOptions: GroupOption[]
  selectedCanvasGroups: Set<string>
  showAdvancedFilters: boolean
  unscheduledOnly: boolean
  selectedPriority: 'high' | 'medium' | 'low' | null
  selectedProject: string | null
  selectedDuration: DurationCategory | null
  hideDoneTasks: boolean
  baseTasks: Task[]
  rootProjects: any[]
  context: string
}>()

const emit = defineEmits<{
  (e: 'toggleCollapse'): void
  (e: 'toggleToday'): void
  (e: 'toggleAdvancedFilters'): void
  (e: 'update:selected-canvas-groups', groups: Set<string>): void
  (e: 'update:unscheduled-only', value: boolean): void
  (e: 'update:selected-priority', value: 'high' | 'medium' | 'low' | null): void
  (e: 'update:selected-project', value: string | null): void
  (e: 'update:selected-duration', value: DurationCategory | null): void
  (e: 'update:hide-done-tasks', value: boolean): void
  (e: 'clearAll'): void
}>()

// Chip Logic
const isChipActive = (group: GroupOption) => {
  return group.value === ''
    ? props.selectedCanvasGroups.size === 0
    : props.selectedCanvasGroups.has(group.value)
}

const getChipStyle = (group: GroupOption) => {
  if (!isChipActive(group) || !group.color) return {}
  return {
    '--chip-color': group.color,
    backgroundColor: `${group.color}20`,
    borderColor: group.color,
    color: group.color
  }
}

const handleChipClick = (event: MouseEvent, group: GroupOption) => {
  const currentSelection = new Set(props.selectedCanvasGroups)

  // 1. "All" Chip
  if (group.value === '') {
    emit('update:selected-canvas-groups', new Set())
    return
  }

  // 2. Multi-select (Ctrl/Cmd)
  if (event.ctrlKey || event.metaKey) {
    if (currentSelection.has(group.value)) {
      currentSelection.delete(group.value)
    } else {
      currentSelection.add(group.value)
    }
    emit('update:selected-canvas-groups', currentSelection)
    return
  }

  // 3. Single Select (Toggle)
  if (currentSelection.size === 1 && currentSelection.has(group.value)) {
    // Deselect if already active -> Go to "All"
    emit('update:selected-canvas-groups', new Set())
  } else {
    emit('update:selected-canvas-groups', new Set([group.value]))
  }
}
</script>

<style scoped>
/* Inheriting styles from UnifiedInboxPanel to keep consistency */
.inbox-header {
  display: flex;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--glass-border);
  background: transparent;
  gap: var(--space-3);
  height: 48px;
  flex-shrink: 0;
}

.inbox-header.is-collapsed {
  padding: var(--space-2);
  justify-content: center;
  height: 40px;
  border-bottom: none;
}

.inbox-title {
  margin: 0;
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  flex: 1;
}

.collapse-btn {
  background: none;
  border: 1px solid var(--border-subtle);
  cursor: pointer;
  color: var(--text-secondary);
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.collapse-btn.is-collapsed {
  width: 24px;
  height: 24px;
  padding: var(--space-0_5);
}

.collapse-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.today-quick-filter {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out);
}

.today-quick-filter:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.today-quick-filter.active {
  background: var(--brand-primary-subtle);
  color: var(--brand-primary);
  border-color: var(--brand-primary-dim);
  font-weight: var(--font-medium);
}

.count-badge {
  background: var(--brand-primary);
  color: white;
  font-size: var(--text-xs);
  padding: 0 5px;
  border-radius: var(--radius-md);
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Filter Chips */
.group-filter-chips {
  padding: var(--space-2) var(--space-4);
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  border-bottom: 1px solid var(--border-light);
  background: var(--surface-ground);
}

.group-chip {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  padding: var(--space-0_5) var(--space-2);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  background: var(--surface-1);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out);
}

.group-chip:hover {
  background: var(--surface-hover);
  border-color: var(--border-hover);
}

.group-chip.active {
  background: var(--brand-primary-subtle);
  color: var(--brand-primary);
  border-color: var(--brand-primary);
}

.chip-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.chip-count {
  opacity: 0.6;
  font-size: var(--text-xs);
  padding-left: var(--space-1);
  border-left: 1px solid currentColor;
  margin-left: var(--space-1);
}

/* Advanced Filters Toggle */
.advanced-filters-section {
  border-bottom: 1px solid var(--border-light);
  background: var(--surface-ground);
}

.toggle-filters-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-normal);
}

.toggle-filters-btn:hover {
  color: var(--text-primary);
  background: var(--surface-hover);
}

.toggle-filters-btn.active {
  color: var(--brand-primary);
  background: var(--brand-primary-subtle);
}

.toggle-icon {
  transition: transform var(--duration-normal) var(--ease-out);
}

.toggle-icon.rotated {
  transform: rotate(180deg);
}
</style>
