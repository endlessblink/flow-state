<template>
  <div class="filter-section">
    <!-- Time-based Filters Row (hidden in Today mode) -->
    <div v-if="viewMode === 'tasks'" class="filter-chips">
      <button
        v-for="filter in timeFilters"
        :key="filter.value"
        class="filter-chip"
        :class="[{ active: activeTimeFilter === filter.value }]"
        @click="$emit('update:activeTimeFilter', filter.value)"
      >
        <component :is="timeFilterIcons[filter.value]" :size="14" />
        {{ filter.label }}
        <span v-if="filter.count > 0" class="filter-count">{{ filter.count }}</span>
      </button>
    </div>

    <!-- Group By + Sort Row -->
    <div class="controls-row">
      <!-- Group By Dropdown -->
      <div class="group-by-control">
        <button class="control-btn" @click="$emit('toggleGroupByDropdown')">
          <Layers :size="14" />
          <span>{{ groupByLabel }}</span>
          <ChevronDown :size="12" :class="{ rotated: showGroupByDropdown }" />
        </button>
        <div v-if="showGroupByDropdown" class="dropdown-menu">
          <button
            v-for="option in groupByOptions"
            :key="option.value"
            class="dropdown-item"
            :class="{ active: groupBy === option.value }"
            @click="$emit('selectGroupBy', option.value)"
          >
            <component :is="groupByIcons[option.value]" :size="14" />
            {{ option.label }}
          </button>
        </div>
      </div>

      <!-- Sort toggle -->
      <button class="sort-btn" @click="$emit('toggleSort')">
        <ArrowUpDown :size="16" />
        {{ sortLabel }}
      </button>

      <!-- Hide Done Toggle -->
      <button
        class="control-btn hide-done-btn"
        :class="{ active: hideDoneTasks }"
        :title="hideDoneTasks ? 'Showing active tasks' : 'Show completed tasks'"
        @click="$emit('update:hideDoneTasks', !hideDoneTasks)"
      >
        <CheckCircle2 :size="14" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Inbox, Calendar, CalendarClock, AlertCircle,
  Layers, ChevronDown, ListFilter, FolderOpen, Flag, CheckCircle2, ArrowUpDown
} from 'lucide-vue-next'
import type { TimeFilterType, ViewMode } from '@/mobile/composables/useMobileInboxLogic'
import type { GroupByType } from '@/composables/mobile/useMobileFilters'

// Because the original file used icons in the returned arrays but composables 
// shouldn't hold Vue components, we map them here locally based on value:
const timeFilterIcons = {
  all: Inbox,
  today: Calendar,
  week: CalendarClock,
  overdue: AlertCircle
} as const

const groupByIcons = {
  none: ListFilter,
  date: Calendar,
  project: FolderOpen,
  priority: Flag
} as const

const props = defineProps<{
  viewMode: ViewMode
  activeTimeFilter: TimeFilterType
  groupBy: GroupByType
  sortBy: 'newest' | 'priority' | 'dueDate'
  hideDoneTasks: boolean
  showGroupByDropdown: boolean
  groupByLabel: string
  sortLabel: string
  // Array types without the icon component
  timeFilters: ReadonlyArray<{ value: TimeFilterType; label: string; count: number }>
  groupByOptions: ReadonlyArray<{ value: GroupByType; label: string }>
}>()

defineEmits<{
  (e: 'update:activeTimeFilter', filter: TimeFilterType): void
  (e: 'toggleGroupByDropdown'): void
  (e: 'selectGroupBy', value: GroupByType): void
  (e: 'toggleSort'): void
  (e: 'update:hideDoneTasks', hide: boolean): void
}>()
</script>

<style scoped>
/* Filter Section */
.filter-section {
  padding: 0 var(--space-4) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.filter-chips {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.filter-chips::-webkit-scrollbar {
  display: none;
}

.filter-chip {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  padding: var(--space-2) var(--space-3_5);
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-subtle);
  background: var(--surface-secondary);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  white-space: nowrap;
  cursor: pointer;
  transition: all var(--duration-normal);
}

.filter-chip.active {
  background: transparent;
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.filter-count {
  background: var(--border-hover);
  padding: var(--space-0_5) var(--space-1_5);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  margin-left: var(--space-0_5);
}

.filter-chip.active .filter-count {
  background: var(--brand-primary);
  color: white;
}

/* Controls row (Group By + Sort) */
.controls-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.control-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background: var(--surface-secondary);
  color: var(--text-secondary);
  font-size: var(--text-meta);
  cursor: pointer;
  transition: all var(--duration-normal);
}

.control-btn:active {
  transform: scale(0.98);
}

.control-btn .rotated {
  transform: rotate(180deg);
}

/* Group By Dropdown */
.group-by-control {
  position: relative;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: var(--space-1);
  min-width: 150px;
  background: var(--surface-primary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  z-index: 100;
  overflow: hidden;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: var(--space-2_5);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  text-align: left;
  cursor: pointer;
  transition: all var(--duration-fast);
}

.dropdown-item:hover {
  background: var(--surface-secondary);
}

.dropdown-item.active {
  background: var(--brand-primary-subtle);
  color: var(--brand-primary);
}

/* Hide Done Toggle */
.hide-done-btn {
  padding: var(--space-2);
  min-width: 36px;
  justify-content: center;
}

.hide-done-btn.active {
  background: var(--brand-primary-subtle);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.sort-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background: var(--surface-secondary);
  color: var(--text-secondary);
  font-size: var(--text-meta);
  cursor: pointer;
  transition: all var(--duration-normal);
}

.sort-btn:active {
  transform: scale(0.98);
}

[dir="rtl"] .filter-chips {
  flex-direction: row-reverse;
}

[dir="rtl"] .controls-row {
  flex-direction: row-reverse;
}

[dir="rtl"] .dropdown-menu {
  left: auto;
  right: 0;
}
</style>
