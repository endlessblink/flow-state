<template>
  <div class="inbox-filters">
    <!-- All Tasks (Reset Filters) -->
    <button
      class="filter-chip"
      :class="{ active: !hasActiveFilters }"
      title="Show all tasks"
      @click="clearAllFilters"
    >
      <List :size="14" />
      <span class="chip-label">All</span>
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
      <span class="chip-label">{{ hideDoneTasks ? 'Hiding Done' : 'Show Done' }}</span>
    </button>

    <!-- Unscheduled Toggle -->
    <button
      class="filter-chip"
      :class="{ active: unscheduledOnly }"
      title="Show only unscheduled tasks (not on calendar)"
      @click="$emit('update:unscheduledOnly', !unscheduledOnly)"
    >
      <CalendarOff :size="14" />
      <span class="chip-label">Unscheduled</span>
      <span v-if="unscheduledCount > 0" class="chip-count">{{ unscheduledCount }}</span>
    </button>

    <!-- Priority Filter -->
    <div ref="priorityDropdownRef" class="filter-dropdown">
      <button
        class="filter-chip"
        :class="{ active: selectedPriority !== null }"
        @click="showPriorityDropdown = !showPriorityDropdown"
      >
        <Flag :size="14" />
        <span class="chip-label">{{ priorityLabel }}</span>
        <ChevronDown :size="12" class="chevron" :class="{ rotated: showPriorityDropdown }" />
      </button>
      <div v-if="showPriorityDropdown" class="dropdown-menu">
        <button
          class="dropdown-item"
          :class="{ selected: selectedPriority === null }"
          @click="selectPriority(null)"
        >
          All Priorities
        </button>
        <button
          v-for="priority in priorities"
          :key="priority.value"
          class="dropdown-item"
          :class="{ selected: selectedPriority === priority.value }"
          @click="selectPriority(priority.value)"
        >
          <span class="priority-dot" :class="`priority-${priority.value}`" />
          {{ priority.label }}
          <span class="item-count">{{ getPriorityCount(priority.value) }}</span>
        </button>
      </div>
    </div>

    <!-- Duration Filter -->
    <div ref="durationDropdownRef" class="filter-dropdown">
      <button
        class="filter-chip"
        :class="{ active: selectedDuration !== null }"
        @click="showDurationDropdown = !showDurationDropdown"
      >
        <Clock :size="14" />
        <span class="chip-label">{{ durationLabel }}</span>
        <ChevronDown :size="12" class="chevron" :class="{ rotated: showDurationDropdown }" />
      </button>
      <div v-if="showDurationDropdown" class="dropdown-menu">
        <button
          class="dropdown-item"
          :class="{ selected: selectedDuration === null }"
          @click="selectDuration(null)"
        >
          All Durations
        </button>
        <button
          v-for="duration in durations"
          :key="duration.value"
          class="dropdown-item"
          :class="{ selected: selectedDuration === duration.value }"
          @click="selectDuration(duration.value)"
        >
          <span class="duration-icon">{{ duration.icon }}</span>
          {{ duration.label }}
          <span class="item-count">{{ getDurationCount(duration.value) }}</span>
        </button>
      </div>
    </div>

    <!-- Project Filter -->
    <div ref="projectDropdownRef" class="filter-dropdown">
      <button
        class="filter-chip"
        :class="{ active: selectedProject !== null }"
        @click="showProjectDropdown = !showProjectDropdown"
      >
        <FolderOpen :size="14" />
        <span class="chip-label">{{ projectLabel }}</span>
        <ChevronDown :size="12" class="chevron" :class="{ rotated: showProjectDropdown }" />
      </button>
      <div v-if="showProjectDropdown" class="dropdown-menu">
        <button
          class="dropdown-item"
          :class="{ selected: selectedProject === null }"
          @click="selectProject(null)"
        >
          All Projects
        </button>
        <button
          class="dropdown-item"
          :class="{ selected: selectedProject === 'none' }"
          @click="selectProject('none')"
        >
          <span class="project-icon">📥</span>
          No Project
          <span class="item-count">{{ getProjectCount(null) }}</span>
        </button>
        <button
          v-for="project in projects"
          :key="project.id"
          class="dropdown-item"
          :class="{ selected: selectedProject === project.id }"
          @click="selectProject(project.id)"
        >
          <span class="project-icon">{{ project.emoji || '📁' }}</span>
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
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { CalendarOff, Flag, FolderOpen, ChevronDown, X, List, Clock, CheckCircle2 } from 'lucide-vue-next'
import type { Task, Project } from '@/stores/tasks'


interface Props {
  tasks: Task[]
  projects: Project[]
  unscheduledOnly: boolean
  selectedPriority: 'high' | 'medium' | 'low' | null
  selectedProject: string | null
  selectedDuration: 'quick' | 'short' | 'medium' | 'long' | 'unestimated' | null
  hideDoneTasks?: boolean // TASK-076: Separate done filter for each view
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:unscheduledOnly': [value: boolean]
  'update:selectedPriority': [value: 'high' | 'medium' | 'low' | null]
  'update:selectedProject': [value: string | null]
  'update:selectedDuration': [value: 'quick' | 'short' | 'medium' | 'long' | 'unestimated' | null]
  'update:hideDoneTasks': [value: boolean] // TASK-076
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

// Duration options
const durations = [
  { value: 'quick' as const, label: 'Quick (<15m)', icon: '⚡' },
  { value: 'short' as const, label: 'Short (15-30m)', icon: '☕' },
  { value: 'medium' as const, label: 'Medium (30-60m)', icon: '⏳' },
  { value: 'long' as const, label: 'Long (>1h)', icon: '🏔️' },
  { value: 'unestimated' as const, label: 'No Estimate', icon: '❓' }
]

// Computed: Check if task is scheduled on calendar (has instances with dates)
const isScheduledOnCalendar = (task: Task): boolean => {
  if (!task.instances || task.instances.length === 0) return false
  return task.instances.some(inst => inst.scheduledDate)
}

// Computed: Count of unscheduled tasks
const unscheduledCount = computed(() => {
  return props.tasks.filter(task => !isScheduledOnCalendar(task)).length
})

// Computed: Priority label
const priorityLabel = computed(() => {
  if (props.selectedPriority === null) return 'Priority'
  return priorities.find(p => p.value === props.selectedPriority)?.label || 'Priority'
})

// Computed: Duration label
const durationLabel = computed(() => {
  if (props.selectedDuration === null) return 'Duration'
  return durations.find(d => d.value === props.selectedDuration)?.label.split(' ')[0] || 'Duration'
})

// Computed: Project label
const projectLabel = computed(() => {
  if (props.selectedProject === null) return 'Project'
  if (props.selectedProject === 'none') return 'No Project'
  const project = props.projects.find(p => p.id === props.selectedProject)
  return project?.name || 'Project'
})

// Computed: Check if any filters are active
const hasActiveFilters = computed(() => {
  return props.unscheduledOnly || props.selectedPriority !== null || props.selectedProject !== null || props.selectedDuration !== null || props.hideDoneTasks
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

// Get count of tasks with specific duration
const getDurationCount = (duration: 'quick' | 'short' | 'medium' | 'long' | 'unestimated'): number => {
  return props.tasks.filter(task => {
    const d = task.estimatedDuration
    if (duration === 'unestimated') return !d
    if (!d) return false
    
    switch (duration) {
      case 'quick': return d <= 15
      case 'short': return d > 15 && d <= 30
      case 'medium': return d > 30 && d <= 60
      case 'long': return d > 60
      default: return false
    }
  }).length
}

// Select priority and close dropdown
const selectPriority = (priority: 'high' | 'medium' | 'low' | null) => {
  emit('update:selectedPriority', priority)
  showPriorityDropdown.value = false
}

// Select project and close dropdown
const selectProject = (projectId: string | null) => {
  emit('update:selectedProject', projectId)
  showProjectDropdown.value = false
}

// Select duration and close dropdown
const selectDuration = (duration: 'quick' | 'short' | 'medium' | 'long' | 'unestimated' | null) => {
  emit('update:selectedDuration', duration)
  showDurationDropdown.value = false
}

// Clear all filters
const clearAllFilters = () => {
  emit('update:unscheduledOnly', false)
  emit('update:selectedPriority', null)
  emit('update:selectedProject', null)
  emit('update:selectedDuration', null)
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
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
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
  font-size: 0.75rem;
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
  font-size: 0.625rem;
  font-weight: 600;
  padding: 0 4px;
  border-radius: var(--radius-full);
  min-width: 14px;
  height: 14px;
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
  backdrop-filter: blur(16px);
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
  font-size: 0.8125rem;
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

.priority-dot {
  width: 8px;
  height: 8px;
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
  font-size: 0.875rem;
}

.item-count {
  margin-left: auto;
  color: var(--text-muted);
  font-size: 0.75rem;
}

.clear-filters-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
}

.clear-filters-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
  color: rgb(239, 68, 68);
}

/* Scrollbar for dropdown */
.dropdown-menu::-webkit-scrollbar {
  width: 4px;
}

.dropdown-menu::-webkit-scrollbar-track {
  background: transparent;
}

.dropdown-menu::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: var(--radius-full);
}
</style>
