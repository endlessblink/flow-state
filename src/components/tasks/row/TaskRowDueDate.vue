<template>
  <div class="task-row__due-date" @click.stop>
    <span
      class="task-row__due-date-trigger"
      :class="dueDateClass"
      title="Click to change due date"
      @click="toggleDropdown"
    >
      <Calendar :size="14" class="task-row__due-date-icon" />
      <span class="task-row__due-date-text">{{ formattedDueDate }}</span>
    </span>

    <!-- Due Date Selector Dropdown -->
    <Transition name="dropdown-slide">
      <div v-if="isOpen" class="due-date-dropdown">
        <button
          v-for="option in dateOptions"
          :key="option.label"
          class="due-date-dropdown__item"
          :class="{ 'is-active': isOptionActive(option.value) }"
          @click="selectDate(option.value)"
        >
          <span class="due-date-dropdown__label">{{ option.label }}</span>
          <Check v-if="isOptionActive(option.value)" :size="14" class="due-date-dropdown__check" />
        </button>
      </div>
    </Transition>

    <!-- Click outside overlay -->
    <div
      v-if="isOpen"
      class="due-date-dropdown__overlay"
      @click="closeDropdown"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Calendar, Check } from 'lucide-vue-next'

const props = defineProps<{
  dueDate?: string | null
}>()

const emit = defineEmits<{
  'update:dueDate': [dueDate: string | null]
}>()

const isOpen = ref(false)

// Helper to get date string in YYYY-MM-DD format
const toDateString = (date: Date): string => {
  return date.toISOString().split('T')[0]
}

// Calculate date options dynamically
const dateOptions = computed(() => {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const in3Days = new Date(today)
  in3Days.setDate(in3Days.getDate() + 3)
  const in1Week = new Date(today)
  in1Week.setDate(in1Week.getDate() + 7)

  return [
    { label: 'Today', value: toDateString(today) },
    { label: 'Tomorrow', value: toDateString(tomorrow) },
    { label: 'In 3 days', value: toDateString(in3Days) },
    { label: 'In 1 week', value: toDateString(in1Week) },
    { label: 'No due date', value: null }
  ]
})

const formattedDueDate = computed(() => {
  if (!props.dueDate) return '-'

  const date = new Date(props.dueDate)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
})

const dueDateClass = computed(() => {
  if (!props.dueDate) return 'task-row__due-date--empty'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDate = new Date(props.dueDate)
  dueDate.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'task-row__due-date--overdue'
  if (diffDays === 0) return 'task-row__due-date--today'
  if (diffDays <= 3) return 'task-row__due-date--soon'
  return ''
})

const isOptionActive = (value: string | null): boolean => {
  if (value === null && !props.dueDate) return true
  if (!props.dueDate || !value) return false
  return props.dueDate === value
}

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

const closeDropdown = () => {
  isOpen.value = false
}

const selectDate = (value: string | null) => {
  emit('update:dueDate', value)
  closeDropdown()
}

// Handle escape key to close dropdown
const handleEscapeKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleEscapeKey)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscapeKey)
})
</script>

<style scoped>
.task-row__due-date {
  grid-area: due;
  display: flex;
  align-items: center;
  position: relative;
}

/* Due Date Trigger - standardized 22px height, matches other dropdowns */
.task-row__due-date-trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-0_5) var(--space-1_5);
  font-size: var(--text-xs);
  color: rgba(var(--color-slate-50), 0.6);
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
  box-sizing: border-box;
  line-height: 1;
}

.task-row__due-date-trigger:hover {
  border-color: var(--border-hover);
  color: rgba(var(--color-slate-50), 0.8);
  background: var(--glass-bg-soft);
}

.task-row__due-date-icon {
  flex-shrink: 0;
  opacity: 0.7;
}

.task-row__due-date-text {
  white-space: nowrap;
}

/* Empty state */
.task-row__due-date--empty {
  color: var(--glass-border);
}

/* Overdue - red */
.task-row__due-date--overdue {
  color: var(--color-danger);
  border-color: var(--color-danger);
}

.task-row__due-date--overdue:hover {
  border-color: var(--color-danger);
}

/* Today - yellow */
.task-row__due-date--today {
  color: var(--color-amber);
  border-color: rgba(var(--color-amber), 0.3);
  font-weight: 500;
}

.task-row__due-date--today:hover {
  border-color: rgba(var(--color-amber), 0.5);
}

/* Soon (within 3 days) - blue */
.task-row__due-date--soon {
  color: var(--color-blue);
  border-color: rgba(var(--color-blue), 0.3);
}

.task-row__due-date--soon:hover {
  border-color: rgba(var(--color-blue), 0.5);
}

/* Due Date Dropdown - Dark glass morphism */
.due-date-dropdown {
  position: absolute;
  top: calc(100% + var(--space-1));
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-tooltip);

  /* Glass morphism - dark purple-tinted with solid fallback */
  background-color: hsl(var(--slate-900)) !important;
  background: rgba(28, 25, 45, 0.95) !important;
  backdrop-filter: blur(var(--space-4));
  -webkit-backdrop-filter: blur(var(--space-4));
  border: var(--space-0_5) solid rgba(var(--color-slate-50), 0.1) !important;
  box-shadow:
    0 var(--space-2) var(--space-8) rgba(var(--color-slate-900), 0.4),
    0 0 0 var(--space-0_5) rgba(var(--color-slate-50), 0.05) inset;
  border-radius: var(--radius-md);

  min-width: var(--space-30);
  max-height: var(--space-50);
  overflow-y: auto;
  padding: var(--space-1);

  isolation: isolate;
}

.due-date-dropdown__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-1_5) var(--space-2);
  border: none !important;
  background: none !important;
  background-color: transparent !important;
  color: rgba(var(--color-slate-50), 0.9) !important;
  font-size: var(--text-xs);
  text-align: left;
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  border-radius: var(--radius-md);
  user-select: none;
  white-space: nowrap;
  min-height: var(--space-7);
}

.due-date-dropdown__item:hover {
  background: rgba(var(--color-slate-50), 0.08) !important;
  background-color: rgba(var(--color-slate-50), 0.08) !important;
}

.due-date-dropdown__item.is-active {
  /* Simple checkmark indicator, no background highlight */
}

.due-date-dropdown__label {
  flex: 1;
}

.due-date-dropdown__check {
  flex-shrink: 0;
  opacity: 0.8;
}

.due-date-dropdown__overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-dropdown);
}

/* Dropdown transitions */
.dropdown-slide-enter-active,
.dropdown-slide-leave-active {
  transition: all var(--duration-fast) ease;
}

.dropdown-slide-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(calc(-1 * var(--space-1)));
}

.dropdown-slide-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(calc(-1 * var(--space-1)));
}
</style>
