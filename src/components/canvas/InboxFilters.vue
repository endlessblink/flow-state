<template>
  <div class="inbox-filters">
    <!-- TASK-1073: Sort Controls -->
    <div class="sort-row">
      <span class="sort-label">{{ $t('filters.sort_label') }}</span>
      <div class="sort-buttons">
        <button
          class="sort-btn"
          :class="{ active: sortBy === 'newest' }"
          title="Sort by newest first"
          @click="$emit('update:sortBy', 'newest')"
        >
          <Clock :size="12" />
          {{ $t('filters.sort_newest') }}
        </button>
        <button
          class="sort-btn"
          :class="{ active: sortBy === 'priority' }"
          title="Sort by priority (high first)"
          @click="$emit('update:sortBy', 'priority')"
        >
          <Flag :size="12" />
          {{ $t('filters.sort_priority') }}
        </button>
        <button
          class="sort-btn"
          :class="{ active: sortBy === 'dueDate' }"
          title="Sort by due date"
          @click="$emit('update:sortBy', 'dueDate')"
        >
          <CalendarDays :size="12" />
          {{ $t('filters.sort_due') }}
        </button>
        <button
          v-if="context !== 'canvas'"
          class="sort-btn"
          :class="{ active: sortBy === 'canvasOrder' }"
          title="Sort by canvas position (top to bottom)"
          @click="$emit('update:sortBy', 'canvasOrder')"
        >
          <LayoutGrid :size="12" />
          {{ $t('filters.sort_canvas') }}
        </button>
      </div>
    </div>

    <div class="filter-divider" />

    <!-- Filter Chips Row -->
    <div class="filter-chips-row">
      <!-- All Tasks (Reset Filters) -->
      <button
        class="filter-chip"
        :class="{ active: !hasActiveFilters }"
        title="Show all tasks"
        @click="clearAllFilters"
      >
        <List :size="14" />
        <span class="chip-label">{{ $t('filters.all') }}</span>
      </button>

      <!-- TASK-076: Hide Done Toggle -->
      <button
        v-if="hideDoneTasks !== undefined"
        class="filter-chip"
        :class="{ active: hideDoneTasks }"
        title="Hide completed tasks"
        @click="$emit('update:hideDoneTasks', !hideDoneTasks)"
      >
        <CheckCircle2 :size="14" />
        <span class="chip-label">{{ hideDoneTasks ? $t('filters.hiding_done') : $t('filters.show_done') }}</span>
      </button>

      <!-- Unscheduled Toggle -->
      <button
        class="filter-chip"
        :class="{ active: unscheduledOnly }"
        title="Show only unscheduled tasks (not on calendar)"
        @click="$emit('update:unscheduledOnly', !unscheduledOnly)"
      >
        <CalendarOff :size="14" />
        <span class="chip-label">{{ $t('filters.unscheduled') }}</span>
        <span v-if="unscheduledCount > 0" class="chip-count">{{ unscheduledCount }}</span>
      </button>

      <!-- TASK-1246: Priority Multi-Select Filter -->
      <div ref="priorityDropdownRef" class="filter-dropdown">
        <button
          class="filter-chip"
          :class="{ active: selectedPriorities.size > 0 }"
          @click="showPriorityDropdown = !showPriorityDropdown"
        >
          <Flag :size="14" />
          <span class="chip-label">{{ priorityLabel }}</span>
          <ChevronDown :size="12" class="chevron" :class="{ rotated: showPriorityDropdown }" />
        </button>
        <div v-if="showPriorityDropdown" class="dropdown-menu">
          <button
            class="dropdown-item"
            @click="clearPriorities"
          >
            {{ $t('filters.all_priorities') }}
          </button>
          <button
            v-for="priority in priorities"
            :key="priority.value"
            class="dropdown-item"
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
      </div>

      <!-- TASK-1246: Duration Multi-Select Filter -->
      <div ref="durationDropdownRef" class="filter-dropdown">
        <button
          class="filter-chip"
          :class="{ active: selectedDurations.size > 0 }"
          @click="showDurationDropdown = !showDurationDropdown"
        >
          <Clock :size="14" />
          <span class="chip-label">{{ durationLabel }}</span>
          <ChevronDown :size="12" class="chevron" :class="{ rotated: showDurationDropdown }" />
        </button>
        <div v-if="showDurationDropdown" class="dropdown-menu">
          <button
            class="dropdown-item"
            @click="clearDurations"
          >
            {{ $t('filters.all_durations') }}
          </button>
          <button
            v-for="duration in durations"
            :key="duration.value"
            class="dropdown-item"
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
      </div>

      <!-- TASK-1246: Project Multi-Select Filter -->
      <div ref="projectDropdownRef" class="filter-dropdown">
        <button
          class="filter-chip"
          :class="{ active: selectedProjects.size > 0 }"
          @click="showProjectDropdown = !showProjectDropdown"
        >
          <FolderOpen :size="14" />
          <span class="chip-label">{{ projectLabel }}</span>
          <ChevronDown :size="12" class="chevron" :class="{ rotated: showProjectDropdown }" />
        </button>
        <div v-if="showProjectDropdown" class="dropdown-menu">
          <button
            class="dropdown-item"
            @click="clearProjects"
          >
            {{ $t('filters.all_projects') }}
          </button>
          <button
            class="dropdown-item"
            :class="{ selected: selectedProjects.has('none') }"
            @click.stop="toggleProject('none')"
          >
            <span class="checkbox-indicator" :class="{ checked: selectedProjects.has('none') }">
              <Check v-if="selectedProjects.has('none')" :size="10" />
            </span>
            <span class="project-icon">&#128229;</span>
            {{ $t('filters.no_project') }}
            <span class="item-count">{{ getProjectCount(null) }}</span>
          </button>
          <button
            v-for="project in projects"
            :key="project.id"
            class="dropdown-item"
            :class="{ selected: selectedProjects.has(project.id) }"
            @click.stop="toggleProject(project.id)"
          >
            <span class="checkbox-indicator" :class="{ checked: selectedProjects.has(project.id) }">
              <Check v-if="selectedProjects.has(project.id)" :size="10" />
            </span>
            <span class="project-icon">{{ project.emoji || '&#128193;' }}</span>
            {{ project.name }}
            <span class="item-count">{{ getProjectCount(project.id) }}</span>
          </button>
        </div>
      </div>

      <!-- Clear All Filters -->
      <button
        v-if="hasActiveFilters"
        class="clear-filters-btn"
        title="Clear all filters"
        @click="clearAllFilters"
      >
        <X :size="14" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { CalendarOff, Flag, FolderOpen, ChevronDown, X, List, Clock, CheckCircle2, CalendarDays, Check, LayoutGrid } from 'lucide-vue-next'
import type { Task, Project } from '@/stores/tasks'
import type { SortByType } from '@/composables/inbox/useUnifiedInboxState'
// TASK-144: Use centralized duration categories
import { type DurationCategory, DURATION_FILTER_OPTIONS, matchesDurationCategory } from '@/utils/durationCategories'


// TASK-1246: Multi-select props (Set types)
interface Props {
  tasks: Task[]
  projects: Project[]
  unscheduledOnly: boolean
  selectedPriorities: Set<string>
  selectedProjects: Set<string>
  selectedDurations: Set<DurationCategory>
  hideDoneTasks?: boolean // TASK-076: Separate done filter for each view
  sortBy?: SortByType // TASK-1073: Sort option
  context?: string // Hide canvas sort when inside canvas view
}

const { t } = useI18n()

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:unscheduledOnly': [value: boolean]
  'update:selectedPriorities': [value: Set<string>]
  'update:selectedProjects': [value: Set<string>]
  'update:selectedDurations': [value: Set<DurationCategory>]
  'update:hideDoneTasks': [value: boolean] // TASK-076
  'update:sortBy': [value: SortByType] // TASK-1073
  clearAll: []
}>()

// Dropdown visibility state
const showPriorityDropdown = ref(false)
const showProjectDropdown = ref(false)
const showDurationDropdown = ref(false)
const priorityDropdownRef = ref<HTMLElement>()
const projectDropdownRef = ref<HTMLElement>()
const durationDropdownRef = ref<HTMLElement>()

// Priority options
const priorities = [
  { value: 'high' as const, label: 'High' },
  { value: 'medium' as const, label: 'Medium' },
  { value: 'low' as const, label: 'Low' }
]

// TASK-144: Duration options from centralized source
const durations = DURATION_FILTER_OPTIONS

// Computed: Check if task is scheduled on calendar (has instances with dates)
const isScheduledOnCalendar = (task: Task): boolean => {
  if (!task.instances || task.instances.length === 0) return false
  return task.instances.some(inst => inst.scheduledDate)
}

// Computed: Count of unscheduled tasks
const unscheduledCount = computed(() => {
  return props.tasks.filter(task => !isScheduledOnCalendar(task)).length
})

// TASK-1246: Computed labels with count badges
const priorityLabel = computed(() => {
  const count = props.selectedPriorities.size
  if (count === 0) return t('filters.sort_priority')
  if (count === 1) return priorities.find(p => p.value === [...props.selectedPriorities][0])?.label || t('filters.sort_priority')
  return `${t('filters.sort_priority')} (${count})`
})

const durationLabel = computed(() => {
  const count = props.selectedDurations.size
  if (count === 0) return t('filters.duration')
  if (count === 1) return durations.find(d => d.value === [...props.selectedDurations][0])?.label.split(' ')[0] || t('filters.duration')
  return `${t('filters.duration')} (${count})`
})

const projectLabel = computed(() => {
  const count = props.selectedProjects.size
  if (count === 0) return t('filters.project')
  if (count === 1) {
    const first = [...props.selectedProjects][0]
    if (first === 'none') return t('filters.no_project')
    const project = props.projects.find(p => p.id === first)
    return project?.name || t('filters.project')
  }
  return `${t('filters.project')} (${count})`
})

// Computed: Check if any filters are active
const hasActiveFilters = computed(() => {
  return props.unscheduledOnly || props.selectedPriorities.size > 0 || props.selectedProjects.size > 0 || props.selectedDurations.size > 0 || props.hideDoneTasks
})

// Get count of tasks with specific priority
const getPriorityCount = (priority: 'high' | 'medium' | 'low'): number => {
  return props.tasks.filter(task => task.priority === priority).length
}

// Get count of tasks with specific project
const getProjectCount = (projectId: string | null): number => {
  if (projectId === null) {
    return props.tasks.filter(task => !task.projectId).length
  }
  return props.tasks.filter(task => task.projectId === projectId).length
}

// TASK-144: Get count of tasks with specific duration using centralized matching
const getDurationCount = (duration: DurationCategory): number => {
  return props.tasks.filter(task =>
    matchesDurationCategory(task.estimatedDuration, duration)
  ).length
}

// TASK-1246: Toggle handlers (multi-select, don't close dropdown)
const togglePriority = (priority: 'high' | 'medium' | 'low') => {
  const next = new Set(props.selectedPriorities)
  if (next.has(priority)) { next.delete(priority) } else { next.add(priority) }
  emit('update:selectedPriorities', next)
}

const clearPriorities = () => {
  emit('update:selectedPriorities', new Set())
  showPriorityDropdown.value = false
}

const toggleProject = (projectId: string) => {
  const next = new Set(props.selectedProjects)
  if (next.has(projectId)) { next.delete(projectId) } else { next.add(projectId) }
  emit('update:selectedProjects', next)
}

const clearProjects = () => {
  emit('update:selectedProjects', new Set())
  showProjectDropdown.value = false
}

const toggleDuration = (duration: DurationCategory) => {
  const next = new Set(props.selectedDurations)
  if (next.has(duration)) { next.delete(duration) } else { next.add(duration) }
  emit('update:selectedDurations', next)
}

const clearDurations = () => {
  emit('update:selectedDurations', new Set())
  showDurationDropdown.value = false
}

// Clear all filters
const clearAllFilters = () => {
  emit('update:unscheduledOnly', false)
  emit('update:selectedPriorities', new Set())
  emit('update:selectedProjects', new Set())
  emit('update:selectedDurations', new Set())
  emit('update:hideDoneTasks', false) // TASK-076
  emit('clearAll')
}

// Close dropdowns when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node
  if (priorityDropdownRef.value && !priorityDropdownRef.value.contains(target)) {
    showPriorityDropdown.value = false
  }
  if (projectDropdownRef.value && !projectDropdownRef.value.contains(target)) {
    showProjectDropdown.value = false
  }
  if (durationDropdownRef.value && !durationDropdownRef.value.contains(target)) {
    showDurationDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.inbox-filters {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
}

/* TASK-1073: Sort Row */
.sort-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.sort-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-weight: 500;
}

.sort-buttons {
  display: flex;
  gap: var(--space-1);
}

.sort-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: transparent;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
}

.sort-btn:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.sort-btn.active {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  color: var(--state-active-text);
}

.filter-divider {
  height: 1px;
  background: var(--border-subtle);
  margin: var(--space-1) 0;
}

/* Filter chips row */
.filter-chips-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.filter-chip {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  white-space: nowrap;
}

.filter-chip:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.filter-chip.active {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  color: var(--state-active-text);
}

.chip-label {
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chip-count {
  background: var(--accent-primary);
  color: white;
  font-size: var(--text-2xs);
  font-weight: var(--font-semibold);
  padding: 0 var(--space-1);
  border-radius: var(--radius-full);
  min-width: var(--space-3_5);
  height: var(--space-3_5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.filter-chip.active .chip-count {
  background: var(--surface-primary);
  color: var(--accent-primary);
}

.chevron {
  transition: transform var(--duration-fast) var(--spring-smooth);
}

.chevron.rotated {
  transform: rotate(180deg);
}

.filter-dropdown {
  position: relative;
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + var(--space-1));
  left: 0;
  z-index: 100;
  min-width: 160px;
  max-height: 240px;
  overflow-y: auto;
  background: var(--dropdown-bg);
  backdrop-filter: var(--overlay-backdrop);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  padding: var(--space-1);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  text-align: left;
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
}

.dropdown-item:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
}

.dropdown-item.selected {
  background: var(--state-active-bg);
  color: var(--state-active-text);
}

/* TASK-1246: Checkbox indicator for multi-select */
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

.project-icon, .duration-icon {
  font-size: var(--text-sm);
}

.item-count {
  margin-left: auto;
  color: var(--text-muted);
  font-size: var(--text-xs);
}

.clear-filters-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--space-6);
  height: var(--space-6);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
}

.clear-filters-btn:hover {
  background: var(--danger-bg-light);
  border-color: var(--danger-border-medium);
  color: var(--color-danger);
}

/* Scrollbar for dropdown */
.dropdown-menu::-webkit-scrollbar {
  width: var(--space-1);
}

.dropdown-menu::-webkit-scrollbar-track {
  background: transparent;
}

.dropdown-menu::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: var(--radius-full);
}
</style>
