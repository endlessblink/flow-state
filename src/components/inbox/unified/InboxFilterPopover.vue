<template>
  <NPopover
    trigger="click"
    placement="bottom-end"
    :show-arrow="false"
    raw
    to="body"
  >
    <template #trigger>
      <!-- Trigger: icon-only filter button matching .icon-filter-btn pattern -->
      <button
        class="icon-filter-btn"
        :class="{ active: hasActiveFilters }"
        title="Filter tasks"
      >
        <Filter :size="14" />
        <span v-if="hasActiveFilters" class="filter-active-dot" />
      </button>
    </template>

    <!-- Popover content -->
    <div class="filter-popover-content">

      <!-- Status Section -->
      <div class="filter-section">
        <div class="filter-section-label">Status</div>

        <button
          class="filter-option"
          @click.stop="$emit('update:unscheduledOnly', !unscheduledOnly)"
        >
          <span class="checkbox-indicator" :class="{ checked: unscheduledOnly }">
            <Check v-if="unscheduledOnly" :size="10" />
          </span>
          <CalendarOff :size="14" />
          Unscheduled
          <span class="item-count">{{ unscheduledCount }}</span>
        </button>

        <button
          v-if="context !== 'canvas'"
          class="filter-option"
          @click.stop="$emit('update:onCanvasOnly', !onCanvasOnly)"
        >
          <span class="checkbox-indicator" :class="{ checked: onCanvasOnly }">
            <Check v-if="onCanvasOnly" :size="10" />
          </span>
          <LayoutGrid :size="14" />
          On Canvas
          <span class="item-count">{{ computedOnCanvasCount }}</span>
        </button>
      </div>

      <!-- Priority Section -->
      <div class="filter-section">
        <div class="filter-section-label">Priority</div>

        <button
          v-for="priority in priorities"
          :key="priority.value"
          class="filter-option"
          :class="{ selected: selectedPriorities.has(priority.value) }"
          @click.stop="togglePriority(priority.value)"
        >
          <span class="checkbox-indicator" :class="{ checked: selectedPriorities.has(priority.value) }">
            <Check v-if="selectedPriorities.has(priority.value)" :size="10" />
          </span>
          <span class="priority-dot" :class="`priority-${priority.value}`" />
          {{ priority.label }}
          <span class="item-count">{{ getPriorityCount(priority.value) }}</span>
        </button>
      </div>

      <!-- Duration Section -->
      <div class="filter-section">
        <div class="filter-section-label">Duration</div>

        <button
          v-for="duration in durations"
          :key="duration.value"
          class="filter-option"
          :class="{ selected: selectedDurations.has(duration.value) }"
          @click.stop="toggleDuration(duration.value)"
        >
          <span class="checkbox-indicator" :class="{ checked: selectedDurations.has(duration.value) }">
            <Check v-if="selectedDurations.has(duration.value)" :size="10" />
          </span>
          <span class="duration-icon">{{ duration.icon }}</span>
          {{ duration.label }}
          <span class="item-count">{{ getDurationCount(duration.value) }}</span>
        </button>
      </div>

      <!-- Project Section -->
      <div class="filter-section">
        <div class="filter-section-label">Project</div>

        <button
          class="filter-option"
          :class="{ selected: selectedProjects.has('none') }"
          @click.stop="toggleProject('none')"
        >
          <span class="checkbox-indicator" :class="{ checked: selectedProjects.has('none') }">
            <Check v-if="selectedProjects.has('none')" :size="10" />
          </span>
          <FolderOpen :size="14" />
          No Project
          <span class="item-count">{{ getProjectCount(null) }}</span>
        </button>

        <button
          v-for="project in projects"
          :key="project.id"
          class="filter-option"
          :class="{ selected: selectedProjects.has(project.id) }"
          @click.stop="toggleProject(project.id)"
        >
          <span class="checkbox-indicator" :class="{ checked: selectedProjects.has(project.id) }">
            <Check v-if="selectedProjects.has(project.id)" :size="10" />
          </span>
          <span class="project-icon">{{ project.emoji || '📁' }}</span>
          {{ project.name }}
          <span class="item-count">{{ getProjectCount(project.id) }}</span>
        </button>
      </div>

      <div class="filter-divider" />

      <!-- Saved Views -->
      <SavedViewsDropdown />

      <!-- Clear All -->
      <button
        v-if="hasActiveFilters"
        class="clear-all-btn"
        @click.stop="clearAllFilters"
      >
        <X :size="14" />
        Clear all filters
      </button>
    </div>
  </NPopover>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NPopover } from 'naive-ui'
import { Filter, CalendarOff, LayoutGrid, FolderOpen, Check, X } from 'lucide-vue-next'
import SavedViewsDropdown from '@/components/filters/SavedViewsDropdown.vue'
import type { Task, Project } from '@/stores/tasks'
import type { DurationCategory } from '@/utils/durationCategories'
import { DURATION_FILTER_OPTIONS, matchesDurationCategory } from '@/utils/durationCategories'

interface Props {
  tasks: Task[]
  projects: Project[]
  unscheduledOnly: boolean
  onCanvasOnly?: boolean
  selectedPriorities: Set<string>
  selectedProjects: Set<string>
  selectedDurations: Set<DurationCategory>
  context?: string
  onCanvasCount?: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:unscheduledOnly': [value: boolean]
  'update:onCanvasOnly': [value: boolean]
  'update:selectedPriorities': [value: Set<string>]
  'update:selectedProjects': [value: Set<string>]
  'update:selectedDurations': [value: Set<DurationCategory>]
  'clearAll': []
}>()

const { t } = useI18n()

// Priority options
const priorities = computed(() => [
  { value: 'immediate' as const, label: t('task.priority_immediate') },
  { value: 'high' as const, label: t('task.priority_high') },
  { value: 'medium' as const, label: t('task.priority_medium') },
  { value: 'low' as const, label: t('task.priority_low') },
  { value: 'relaxed' as const, label: t('task.priority_relaxed') },
  { value: 'none' as const, label: t('task.priority_none_full') }
])

// Duration options from centralized source
const durations = DURATION_FILTER_OPTIONS

// Count of unscheduled tasks (no dueDate or overdue)
const unscheduledCount = computed(() => {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return props.tasks.filter(task => {
    if (!task.dueDate) return true
    const normalized = task.dueDate.trim().substring(0, 10)
    return normalized && normalized < todayStr
  }).length
})

// Count of tasks on canvas — use pre-computed prop when available
const computedOnCanvasCount = computed(() => {
  if (props.onCanvasCount !== undefined) return props.onCanvasCount
  return props.tasks.filter(t => !!t.canvasPosition).length
})

// Whether any filters are active
const hasActiveFilters = computed(() => {
  return (
    props.unscheduledOnly ||
    !!props.onCanvasOnly ||
    props.selectedPriorities.size > 0 ||
    props.selectedProjects.size > 0 ||
    props.selectedDurations.size > 0
  )
})

// Count helpers
const getPriorityCount = (priority: 'immediate' | 'high' | 'medium' | 'low' | 'relaxed' | 'none'): number => {
  if (priority === 'none') return props.tasks.filter(task => !task.priority).length
  return props.tasks.filter(task => task.priority === priority).length
}

const getProjectCount = (projectId: string | null): number => {
  if (projectId === null) {
    return props.tasks.filter(task => !task.projectId).length
  }
  return props.tasks.filter(task => task.projectId === projectId).length
}

const getDurationCount = (duration: DurationCategory): number => {
  return props.tasks.filter(task =>
    matchesDurationCategory(task.estimatedDuration, duration)
  ).length
}

// Toggle handlers — use @click.stop on each option so popover stays open
const togglePriority = (priority: 'immediate' | 'high' | 'medium' | 'low' | 'relaxed' | 'none') => {
  const next = new Set(props.selectedPriorities)
  if (next.has(priority)) {
    next.delete(priority)
  } else {
    next.add(priority)
  }
  emit('update:selectedPriorities', next)
}

const toggleProject = (projectId: string) => {
  const next = new Set(props.selectedProjects)
  if (next.has(projectId)) {
    next.delete(projectId)
  } else {
    next.add(projectId)
  }
  emit('update:selectedProjects', next)
}

const toggleDuration = (duration: DurationCategory) => {
  const next = new Set(props.selectedDurations)
  if (next.has(duration)) {
    next.delete(duration)
  } else {
    next.add(duration)
  }
  emit('update:selectedDurations', next)
}

const clearAllFilters = () => {
  emit('update:unscheduledOnly', false)
  emit('update:onCanvasOnly', false)
  emit('update:selectedPriorities', new Set())
  emit('update:selectedProjects', new Set())
  emit('update:selectedDurations', new Set())
  emit('clearAll')
}
</script>

<style scoped>
/* Trigger button — matches .icon-filter-btn pattern from UnifiedInboxHeader */
.icon-filter-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 28px;
  height: 28px;
  padding: var(--space-1);
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out);
  flex-shrink: 0;
}

.icon-filter-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.icon-filter-btn.active {
  background: var(--brand-primary-subtle);
  color: var(--brand-primary);
  border-color: var(--brand-primary-dim);
}

/* Active dot indicator */
.filter-active-dot {
  position: absolute;
  top: 3px;
  inset-inline-end: 3px;
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--brand-primary);
}

/* Popover content wrapper */
.filter-popover-content {
  width: 260px;
  max-height: 400px;
  overflow-y: auto;
  padding: var(--space-2);
  background: var(--surface-elevated);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(12px);
  z-index: var(--z-popover);
  position: relative;
}

/* Section label */
.filter-section-label {
  font-size: var(--text-2xs);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: var(--space-1) var(--space-2);
  margin-block-start: var(--space-2);
}

.filter-section:first-child .filter-section-label {
  margin-block-start: 0;
}

/* Filter option rows */
.filter-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-1_5) var(--space-2);
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--text-xs);
  text-align: start;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.filter-option:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
}

.filter-option.selected {
  background: var(--state-active-bg);
  color: var(--state-active-text);
}

/* Checkbox indicator */
.checkbox-indicator {
  width: var(--space-3_5);
  height: var(--space-3_5);
  border: var(--space-px) solid var(--glass-border);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all var(--duration-fast) var(--spring-smooth);
}

.checkbox-indicator.checked {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  color: var(--state-active-text);
}

/* Priority dots */
.priority-dot {
  width: var(--space-2);
  height: var(--space-2);
  border-radius: 50%;
  flex-shrink: 0;
}

.priority-dot.priority-high {
  background: var(--color-priority-high);
}

.priority-dot.priority-medium {
  background: var(--color-priority-medium);
}

.priority-dot.priority-low {
  background: var(--color-priority-low);
}

/* Inline icons / emoji for project and duration */
.project-icon,
.duration-icon {
  font-size: var(--text-sm);
  flex-shrink: 0;
}

/* Item count pushed to inline-end */
.item-count {
  margin-inline-start: auto;
  color: var(--text-muted);
  font-size: var(--text-xs);
}

/* Divider */
.filter-divider {
  height: 1px;
  background: var(--border-subtle);
  margin: var(--space-2) 0;
}

/* Clear all button */
.clear-all-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-1_5) var(--space-2);
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: var(--text-xs);
  cursor: pointer;
  margin-block-start: var(--space-1);
  transition: all var(--duration-fast) var(--ease-out);
}

.clear-all-btn:hover {
  background: var(--danger-bg-light);
  color: var(--color-danger);
}

/* Custom scrollbar */
.filter-popover-content::-webkit-scrollbar {
  width: var(--space-1);
}

.filter-popover-content::-webkit-scrollbar-track {
  background: transparent;
}

.filter-popover-content::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: var(--radius-full);
}
</style>
