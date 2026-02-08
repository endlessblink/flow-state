<template>
  <div ref="wrapperRef" class="overdue-badge-wrapper" @click.stop>
    <button
      class="overdue-badge"
      title="Reschedule overdue task"
      @click="toggleMenu"
    >
      <AlertCircle :size="12" />
      Overdue
    </button>

    <!-- Reschedule Dropdown -->
    <div v-if="isMenuOpen" class="reschedule-menu">
      <button
        v-for="option in rescheduleOptions"
        :key="option.value"
        class="reschedule-option"
        :class="{ 'is-active': getActiveOption === option.value }"
        @click="handleReschedule(option.value)"
      >
        <component :is="option.icon" :size="14" class="reschedule-option__icon" />
        <span class="reschedule-option__label">{{ option.label }}</span>
        <Check v-if="getActiveOption === option.value" :size="14" class="reschedule-option__check" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { AlertCircle, Calendar, Sun, Sunrise, CalendarDays, CalendarRange, Check } from 'lucide-vue-next'

const props = defineProps<{
  currentDueDate?: string | null
}>()

const emit = defineEmits<{
  reschedule: [dateType: string]
}>()

const isMenuOpen = ref(false)
const wrapperRef = ref<HTMLElement | null>(null)

const rescheduleOptions = [
  { value: 'today', label: 'Today', icon: Sun },
  { value: 'tomorrow', label: 'Tomorrow', icon: Sunrise },
  { value: 'this_weekend', label: 'This Weekend', icon: CalendarDays },
  { value: 'next_week', label: 'Next Week', icon: CalendarRange },
  { value: 'pick_date', label: 'Pick a date...', icon: Calendar }
]

// Helper to check if current due date matches an option
const getActiveOption = computed(() => {
  if (!props.currentDueDate) return null

  const dueDate = new Date(props.currentDueDate)
  dueDate.setHours(0, 0, 0, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // This Weekend (next Saturday)
  const dayOfWeek = today.getDay()
  const daysUntilSaturday = dayOfWeek === 6 ? 7 : (6 - dayOfWeek + 7) % 7
  const saturday = new Date(today)
  saturday.setDate(today.getDate() + daysUntilSaturday)

  // Next Week (next Monday)
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  const monday = new Date(today)
  monday.setDate(today.getDate() + daysUntilMonday)

  if (dueDate.getTime() === today.getTime()) return 'today'
  if (dueDate.getTime() === tomorrow.getTime()) return 'tomorrow'
  if (dueDate.getTime() === saturday.getTime()) return 'this_weekend'
  if (dueDate.getTime() === monday.getTime()) return 'next_week'

  return null
})

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

const closeMenu = () => {
  isMenuOpen.value = false
}

const handleReschedule = (dateType: string) => {
  emit('reschedule', dateType)
  closeMenu()
}

// Close menu when clicking outside
onClickOutside(wrapperRef, () => {
  if (isMenuOpen.value) {
    closeMenu()
  }
})

// Also close on Escape key
watch(isMenuOpen, (open) => {
  if (open) {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu()
        document.removeEventListener('keydown', handleEscape)
      }
    }
    document.addEventListener('keydown', handleEscape)
  }
})
</script>

<style scoped>
.overdue-badge-wrapper {
  position: relative;
  display: inline-flex;
}

.overdue-badge {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  padding: var(--space-0_5) var(--space-1_5);
  border-radius: var(--radius-sm);
  background: var(--red-bg-soft);
  border: 1px solid var(--red-border);
  color: var(--color-danger);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  font-weight: var(--font-medium);
}

.overdue-badge:hover {
  background: var(--red-bg-medium);
  border-color: var(--red-border-hover);
  transform: scale(1.02);
}

/* Reschedule Menu - Glass morphism matching other dropdowns */
.reschedule-menu {
  position: absolute;
  top: calc(100% + var(--space-1));
  left: 0;
  z-index: var(--z-tooltip);

  /* Glass morphism - purple-tinted matching standardized dropdowns */
  background: var(--overlay-component-bg);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-xl);
  border-radius: var(--radius-md);

  min-width: 160px;
  padding: var(--space-1);
  display: flex;
  flex-direction: column;

  /* Ensure backdrop-filter works */
  isolation: isolate;
  transform: translateZ(0);
}

.reschedule-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-1_5) var(--space-2);
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-primary);
  font-size: var(--text-xs);
  text-align: left;
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  border-radius: var(--radius-md);
  user-select: none;
  white-space: nowrap;
  min-height: var(--space-7);
}

.reschedule-option:hover {
  background: var(--surface-hover);
}

.reschedule-option.is-active {
  /* Simple checkmark indicator, no background highlight */
}

.reschedule-option__icon {
  flex-shrink: 0;
  opacity: 0.7;
}

.reschedule-option__label {
  flex: 1;
}

.reschedule-option__check {
  flex-shrink: 0;
  opacity: 0.7;
}
</style>
