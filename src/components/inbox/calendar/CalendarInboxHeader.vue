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
      {{ $t('smart_views.inbox') }}
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
      <span>{{ $t('calendar.today') }}</span>
      <span v-if="todayCount > 0" class="count-badge">{{ todayCount }}</span>
    </button>

  </div>

  <div v-if="!isCollapsed" class="calendar-filter-toolbar">
    <div class="calendar-toolbar-row">
      <div class="calendar-sort-control">
        <CustomSelect
          class="calendar-sort-select"
          :model-value="sortBy || 'newest'"
          :options="sortOptions"
          placeholder="Sort"
          compact
          @update:model-value="handleSortSelect"
        />
        <button
          class="calendar-direction-btn"
          :title="sortDirection === 'asc' ? $t('filters.sort_ascending') : $t('filters.sort_descending')"
          @click="$emit('update:sortDirection', sortDirection === 'asc' ? 'desc' : 'asc')"
        >
          <ArrowUpNarrowWide v-if="sortDirection === 'asc'" :size="13" />
          <ArrowDownNarrowWide v-else :size="13" />
        </button>
      </div>

      <button
        class="calendar-filter-menu-btn"
        :class="{ active: hasSecondaryFilters || showAdvancedFilters }"
        @click="$emit('update:showAdvancedFilters', !showAdvancedFilters)"
      >
        <ListFilter :size="14" />
        <span>Filters</span>
        <span v-if="secondaryFilterCount > 0" class="toolbar-count">{{ secondaryFilterCount }}</span>
        <ChevronDown :size="12" class="toolbar-chevron" :class="{ rotated: showAdvancedFilters }" />
      </button>
    </div>

    <div class="calendar-toolbar-row">
      <div v-if="canvasGroupOptions.length > 1" class="calendar-source-control">
        <span class="toolbar-label">Source</span>
        <CustomSelect
          :model-value="Array.from(selectedCanvasGroups)[0] || ''"
          :options="canvasGroupOptions"
          placeholder="All tasks"
          compact
          @update:model-value="$emit('update:selectedCanvasGroups', new Set($event ? [String($event)] : []))"
        />
      </div>

      <div class="calendar-search-control" :class="{ active: searchQuery }">
        <Search :size="14" class="search-icon" />
        <input
          dir="auto"
          class="search-input"
          type="text"
          :value="searchQuery"
          placeholder="Search tasks..."
          @input="handleSearchInput"
          @keydown.escape="clearSearch"
        >
        <button
          v-if="searchQuery"
          class="clear-search-btn"
          title="Clear search"
          @click="clearSearch"
        >
          <X :size="12" />
        </button>
      </div>
    </div>

    <div v-if="activeFilterTokens.length > 0" class="calendar-active-filters">
      <button
        v-for="token in activeFilterTokens"
        :key="token.key"
        class="calendar-filter-token"
        @click="token.clear"
      >
        <component :is="token.icon" :size="12" />
        <span>{{ token.label }}</span>
        <X :size="10" />
      </button>
      <button class="calendar-filter-token clear-token" @click="$emit('clearAllFilters')">
        <X :size="12" />
        <span>{{ $t('filters.clear_all') }}</span>
      </button>
    </div>

    <Transition name="slide-down">
      <div v-if="showAdvancedFilters" class="calendar-filter-panel">
        <div class="filter-panel-section">
          <span class="filter-panel-label">Status</span>
          <button
            class="filter-row-option"
            :class="{ active: unscheduledOnly }"
            @click="$emit('update:unscheduledOnly', !unscheduledOnly)"
          >
            <CalendarOff :size="14" />
            <span>{{ $t('filters.unscheduled') }}</span>
            <Check v-if="unscheduledOnly" :size="13" />
          </button>
          <button
            class="filter-row-option"
            :class="{ active: hideDoneTasks }"
            @click="$emit('toggleHideDoneTasks')"
          >
            <CheckCircle2 :size="14" />
            <span>{{ hideDoneTasks ? $t('filters.hiding_done') : $t('filters.show_done') }}</span>
            <Check v-if="hideDoneTasks" :size="13" />
          </button>
        </div>

        <div class="filter-panel-section">
          <span class="filter-panel-label">{{ $t('filters.sort_priority') }}</span>
          <button
            v-for="priority in priorityOptions"
            :key="priority.value"
            class="filter-row-option"
            :class="{ active: selectedPriorities.has(priority.value) }"
            @click="togglePriority(priority.value)"
          >
            <span class="priority-dot" :class="`priority-${priority.value}`" />
            <span>{{ priority.label }}</span>
            <Check v-if="selectedPriorities.has(priority.value)" :size="13" />
          </button>
        </div>

        <div class="filter-panel-section">
          <span class="filter-panel-label">{{ $t('filters.duration') }}</span>
          <button
            v-for="duration in durationOptions"
            :key="duration.value"
            class="filter-row-option"
            :class="{ active: selectedDurations.has(duration.value) }"
            @click="toggleDuration(duration.value)"
          >
            <Clock :size="14" />
            <span>{{ duration.label }}</span>
            <Check v-if="selectedDurations.has(duration.value)" :size="13" />
          </button>
        </div>

        <div class="filter-panel-section">
          <span class="filter-panel-label">{{ $t('filters.project') }}</span>
          <button
            class="filter-row-option"
            :class="{ active: selectedProjects.has('none') }"
            @click="toggleProject('none')"
          >
            <FolderOpen :size="14" />
            <span>{{ $t('filters.no_project') }}</span>
            <Check v-if="selectedProjects.has('none')" :size="13" />
          </button>
          <button
            v-for="project in rootProjects"
            :key="project.id"
            class="filter-row-option"
            :class="{ active: selectedProjects.has(project.id) }"
            @click="toggleProject(project.id)"
          >
            <FolderOpen :size="14" />
            <span>{{ project.name }}</span>
            <Check v-if="selectedProjects.has(project.id)" :size="13" />
          </button>
        </div>
      </div>
    </Transition>
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

</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  CalendarDays,
  CalendarOff,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  FolderOpen,
  ListFilter,
  Search,
  X,
} from 'lucide-vue-next'
import { NBadge } from 'naive-ui'
import BaseBadge from '@/components/base/BaseBadge.vue'
import CustomSelect from '@/components/common/CustomSelect.vue'
import { type Task } from '@/stores/tasks'
import type { Project } from '@/types/tasks'
import { DURATION_FILTER_OPTIONS, type DurationCategory } from '@/utils/durationCategories'
import type { SortByType, SortDirection } from '@/composables/inbox/useUnifiedInboxState'

const props = defineProps<{
  isCollapsed: boolean
  inboxCount: number
  showTodayOnly: boolean
  todayCount: number
  hasActiveFilters: boolean
  baseCount: number
  canvasGroupOptions: { label: string; value: string | number }[]
  selectedCanvasGroups: Set<string>
  showAdvancedFilters: boolean
  unscheduledOnly: boolean
  selectedPriorities: Set<string>
  selectedProjects: Set<string>
  selectedDurations: Set<DurationCategory>
  hideDoneTasks: boolean
  baseTasks: Task[]
  rootProjects: Project[]
  searchQuery: string // TASK-1075
  sortBy?: SortByType // TASK-1303
  sortDirection?: SortDirection // TASK-1412
}>()

const emit = defineEmits<{
  (e: 'update:isCollapsed', value: boolean): void
  (e: 'update:showTodayOnly', value: boolean): void
  (e: 'update:selectedCanvasGroups', value: Set<string>): void
  (e: 'update:showAdvancedFilters', value: boolean): void
  (e: 'update:unscheduledOnly', value: boolean): void
  (e: 'update:selectedPriorities', value: Set<string>): void
  (e: 'update:selectedProjects', value: Set<string>): void
  (e: 'update:selectedDurations', value: Set<DurationCategory>): void
  (e: 'update:searchQuery', value: string): void // TASK-1075
  (e: 'update:sortBy', value: SortByType): void // TASK-1303
  (e: 'update:sortDirection', value: SortDirection): void // TASK-1412
  (e: 'toggleHideDoneTasks'): void
  (e: 'clearAllFilters'): void
}>()

const { t } = useI18n()

const sortOptions = computed(() => [
  { label: t('filters.sort_newest'), value: 'newest' },
  { label: t('filters.sort_priority'), value: 'priority' },
  { label: t('filters.sort_due'), value: 'dueDate' },
  { label: `${t('filters.sort_canvas')} order`, value: 'canvasOrder' },
])

const priorityOptions = computed(() => [
  { value: 'high', label: t('task.priority_high') },
  { value: 'medium', label: t('task.priority_medium') },
  { value: 'low', label: t('task.priority_low') },
] as const)

const durationOptions = computed(() =>
  DURATION_FILTER_OPTIONS.map(({ value, label }) => ({ value, label })),
)

const secondaryFilterCount = computed(() =>
  Number(props.unscheduledOnly) +
  Number(props.hideDoneTasks) +
  props.selectedPriorities.size +
  props.selectedProjects.size +
  props.selectedDurations.size,
)

const hasSecondaryFilters = computed(() => secondaryFilterCount.value > 0)

const activeFilterTokens = computed(() => {
  const tokens: { key: string; label: string; icon: unknown; clear: () => void }[] = []

  if (props.unscheduledOnly) {
    tokens.push({
      key: 'unscheduled',
      label: t('filters.unscheduled'),
      icon: CalendarOff,
      clear: () => emit('update:unscheduledOnly', false),
    })
  }

  if (props.hideDoneTasks) {
    tokens.push({
      key: 'hide-done',
      label: t('filters.hiding_done'),
      icon: CheckCircle2,
      clear: () => emit('toggleHideDoneTasks'),
    })
  }

  if (props.selectedPriorities.size > 0) {
    tokens.push({
      key: 'priority',
      label: priorityTokenLabel.value,
      icon: Flag,
      clear: () => emit('update:selectedPriorities', new Set()),
    })
  }

  if (props.selectedDurations.size > 0) {
    tokens.push({
      key: 'duration',
      label: durationTokenLabel.value,
      icon: Clock,
      clear: () => emit('update:selectedDurations', new Set()),
    })
  }

  if (props.selectedProjects.size > 0) {
    tokens.push({
      key: 'project',
      label: projectTokenLabel.value,
      icon: FolderOpen,
      clear: () => emit('update:selectedProjects', new Set()),
    })
  }

  return tokens
})

const priorityTokenLabel = computed(() => {
  if (props.selectedPriorities.size === 1) {
    const value = Array.from(props.selectedPriorities)[0]
    return priorityOptions.value.find((priority) => priority.value === value)?.label || t('filters.sort_priority')
  }
  return `${props.selectedPriorities.size} ${t('filters.sort_priority')}`
})

const durationTokenLabel = computed(() => {
  if (props.selectedDurations.size === 1) {
    const value = Array.from(props.selectedDurations)[0]
    return durationOptions.value.find((duration) => duration.value === value)?.label || t('filters.duration')
  }
  return `${props.selectedDurations.size} ${t('filters.duration')}`
})

const projectTokenLabel = computed(() => {
  if (props.selectedProjects.size === 1) {
    const value = Array.from(props.selectedProjects)[0]
    if (value === 'none') return t('filters.no_project')
    return props.rootProjects.find((project) => project.id === value)?.name || t('filters.project')
  }
  return `${props.selectedProjects.size} ${t('filters.project')}`
})

const handleSortSelect = (value: string | number | null) => {
  if (!value) return
  emit('update:sortBy', String(value) as SortByType)
}

const handleSearchInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:searchQuery', target.value)
}

const clearSearch = () => {
  emit('update:searchQuery', '')
}

const togglePriority = (priority: 'high' | 'medium' | 'low') => {
  const next = new Set(props.selectedPriorities)
  if (next.has(priority)) next.delete(priority)
  else next.add(priority)
  emit('update:selectedPriorities', next)
}

const toggleDuration = (duration: DurationCategory) => {
  const next = new Set(props.selectedDurations)
  if (next.has(duration)) next.delete(duration)
  else next.add(duration)
  emit('update:selectedDurations', next)
}

const toggleProject = (projectId: string) => {
  const next = new Set(props.selectedProjects)
  if (next.has(projectId)) next.delete(projectId)
  else next.add(projectId)
  emit('update:selectedProjects', next)
}

</script>

<style scoped>
.inbox-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
  min-width: 0;
}

/* Glass morphism override for NBadge — no solid fills */
.inbox-header :deep(.n-badge-sup) {
  background: var(--brand-primary-subtle) !important;
  border: 1px solid var(--brand-primary-dim) !important;
  color: var(--brand-primary) !important;
  backdrop-filter: blur(8px);
  font-weight: var(--font-medium);
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
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  flex-shrink: 0;
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
  background: var(--brand-primary-subtle);
  border: 1px solid var(--brand-primary-dim);
  color: var(--brand-primary);
  font-size: var(--text-xs);
  padding: 0 var(--space-1);
  border-radius: var(--radius-full);
  min-width: 16px;
  text-align: center;
}

.collapsed-badges-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  margin-top: var(--space-2);
}

.dual-badges {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}

.calendar-filter-toolbar {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--glass-bg-weak);
  border: 1px solid var(--glass-border-light);
  border-radius: var(--radius-md);
  min-width: 0;
  width: 100%;
}

.calendar-toolbar-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  width: 100%;
}

.calendar-sort-control,
.calendar-source-control {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  min-width: 0;
}

.calendar-sort-control {
  flex: 1;
}

.calendar-source-control {
  flex: 1;
}

.calendar-sort-select {
  min-width: 0;
  flex: 1;
}

.toolbar-label {
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  white-space: nowrap;
}

.calendar-direction-btn,
.calendar-filter-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-bg-light);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out);
  flex-shrink: 0;
}

.calendar-direction-btn {
  width: 28px;
  padding: 0;
}

.calendar-filter-menu-btn {
  gap: var(--space-1);
  padding: 0 var(--space-2);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.calendar-direction-btn:hover,
.calendar-filter-menu-btn:hover {
  background: var(--surface-hover);
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.calendar-filter-menu-btn.active {
  background: var(--brand-primary-subtle);
  color: var(--brand-primary);
  border-color: var(--brand-primary-dim);
}

.toolbar-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 var(--space-1);
  border-radius: var(--radius-sm);
  background: var(--surface-elevated);
  color: currentColor;
  font-size: var(--text-xs);
  line-height: 1;
}

.toolbar-chevron {
  transition: transform var(--duration-normal) var(--ease-out);
}

.toolbar-chevron.rotated {
  transform: rotate(180deg);
}

.calendar-search-control {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  min-width: 0;
  flex: 1;
  height: 28px;
  padding: 0 var(--space-2);
  background: var(--surface-1);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-tertiary);
  transition: background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out);
}

.calendar-search-control:focus-within,
.calendar-search-control.active {
  border-color: var(--brand-primary-dim);
  background: var(--surface-2);
  box-shadow: 0 0 0 2px var(--brand-primary-subtle);
}

.search-icon {
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: var(--text-xs);
  outline: none;
  min-width: 0;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.clear-search-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--surface-hover);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  flex-shrink: 0;
}

.clear-search-btn:hover {
  background: var(--surface-active);
  color: var(--text-primary);
}

.calendar-active-filters {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  overflow-x: auto;
  scrollbar-width: none;
  min-width: 0;
  padding-top: var(--space-1);
  border-top: 1px solid var(--glass-border-faint);
}

.calendar-active-filters::-webkit-scrollbar {
  display: none;
}

.calendar-filter-token {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  height: 24px;
  padding: 0 var(--space-1_5);
  border: 1px solid var(--glass-border-light);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--text-xs);
  white-space: nowrap;
  cursor: pointer;
  flex-shrink: 0;
  transition: background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out);
}

.calendar-filter-token:hover {
  background: var(--surface-hover);
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.clear-token {
  color: var(--text-muted);
}

.calendar-filter-panel {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--glass-border-light);
}

.filter-panel-section {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-1);
  min-width: 0;
}

.filter-panel-label {
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
}

.filter-row-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  height: 28px;
  padding: 0 var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--text-xs);
  text-align: start;
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out);
}

.filter-row-option span:not(.priority-dot) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-row-option svg:last-child {
  margin-inline-start: auto;
  flex-shrink: 0;
}

.filter-row-option:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.filter-row-option.active {
  background: var(--brand-primary-subtle);
  border-color: var(--brand-primary-dim);
  color: var(--brand-primary);
}

.priority-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.priority-high {
  background: var(--color-priority-high);
}

.priority-medium {
  background: var(--color-priority-medium);
}

.priority-low {
  background: var(--color-priority-low);
}

/* Slide-down animation */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all var(--duration-normal) var(--ease-out);
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  max-height: 360px;
}
</style>
