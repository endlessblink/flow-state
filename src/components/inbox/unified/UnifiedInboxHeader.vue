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

    <!-- Done Tasks Filter - Shows ONLY done tasks when active -->
    <button
      v-if="!isCollapsed"
      key="done-toggle"
      class="done-toggle-btn"
      :class="{ active: !hideDoneTasks }"
      :title="hideDoneTasks ? `Show only done tasks (${doneTaskCount})` : 'Show active tasks'"
      @click="$emit('update:hide-done-tasks', !hideDoneTasks)"
    >
      <CheckCircle2 :size="14" />
      <span class="done-count">{{ doneTaskCount }}</span>
    </button>

    <!-- Time Filter Dropdown -->
    <NDropdown
      v-if="!isCollapsed"
      :options="timeFilterOptions"
      trigger="click"
      @select="handleTimeFilterSelect"
    >
      <button class="time-filter-dropdown" :class="{ active: activeTimeFilter !== 'all' }">
        <CalendarDays :size="14" />
        <span>{{ timeFilterLabel }}</span>
        <ChevronDown :size="12" />
      </button>
    </NDropdown>
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
import { computed } from 'vue'
import { ChevronLeft, ChevronRight, CalendarDays, Filter, ChevronDown, CheckCircle2 } from 'lucide-vue-next'
import { NBadge, NDropdown } from 'naive-ui'
import InboxFilters from '@/components/canvas/InboxFilters.vue'
import type { Task } from '@/types/tasks'
import type { DurationCategory } from '@/utils/durationCategories'
import type { TimeFilterType } from '@/composables/inbox/useUnifiedInboxState'

interface GroupOption {
  label: string
  value: string
  color?: string
  count?: number
}

const props = defineProps<{
  isCollapsed: boolean
  taskCount: number
  activeTimeFilter: TimeFilterType
  todayCount: number
  weekCount: number
  monthCount: number
  showGroupChips: boolean
  groupOptions: GroupOption[]
  selectedCanvasGroups: Set<string>
  showAdvancedFilters: boolean
  unscheduledOnly: boolean
  selectedPriority: 'high' | 'medium' | 'low' | null
  selectedProject: string | null
  selectedDuration: DurationCategory | null
  hideDoneTasks: boolean
  doneTaskCount: number
  baseTasks: Task[]
  rootProjects: any[]
  context: string
}>()

const emit = defineEmits<{
  (e: 'toggleCollapse'): void
  (e: 'update:activeTimeFilter', value: TimeFilterType): void
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

// Time Filter Dropdown Options
const timeFilterOptions = computed(() => [
  { label: 'All', key: 'all' },
  { label: `Today (${props.todayCount})`, key: 'today' },
  { label: `This Week (${props.weekCount})`, key: 'week' },
  { label: `This Month (${props.monthCount})`, key: 'month' }
])

const timeFilterLabel = computed(() => {
  const labels: Record<TimeFilterType, string> = {
    all: 'All',
    today: 'Today',
    week: 'This Week',
    month: 'This Month'
  }
  return labels[props.activeTimeFilter]
})

const handleTimeFilterSelect = (key: string) => {
  emit('update:activeTimeFilter', key as TimeFilterType)
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

.time-filter-dropdown {
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

.time-filter-dropdown:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.time-filter-dropdown.active {
  background: var(--brand-primary-subtle);
  color: var(--brand-primary);
  border-color: var(--brand-primary-dim);
  font-weight: var(--font-medium);
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

/* Done Tasks Toggle Button */
/* Inactive state - subtle/muted (showing active tasks, hideDoneTasks=true) */
.done-toggle-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background: transparent;
  color: var(--text-tertiary);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out);
  flex-shrink: 0;
  min-width: 28px;
  min-height: 28px;
}

.done-toggle-btn:hover {
  background: var(--surface-hover);
  color: var(--text-secondary);
  border: 1px solid var(--border-hover);
}

/* Active state - green to indicate filtering for completed tasks */
.done-toggle-btn.active {
  border: 1px solid #22c55e;
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.done-toggle-btn.active:hover {
  background: rgba(34, 197, 94, 0.25);
}

.done-count {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 var(--space-1);
  border-radius: var(--radius-full);
  background: var(--surface-elevated);
  color: var(--text-secondary);
  font-size: 0.625rem;
  font-weight: 600;
}

.done-toggle-btn.active .done-count {
  background: #22c55e;
  color: white;
}
</style>
