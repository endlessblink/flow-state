<template>
  <div class="overdue-badge-wrapper" @click.stop>
    <button
      class="overdue-badge"
      @click="toggleMenu"
      title="Reschedule overdue task"
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
        @click="handleReschedule(option.value)"
      >
        <component :is="option.icon" :size="14" />
        {{ option.label }}
      </button>
    </div>

    <!-- Click outside to close -->
    <div v-if="isMenuOpen" class="backdrop" @click="closeMenu" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { AlertCircle, Calendar, Sun, Sunrise, CalendarDays, CalendarRange } from 'lucide-vue-next'

const emit = defineEmits<{
  reschedule: [dateType: string]
}>()

const isMenuOpen = ref(false)

const rescheduleOptions = [
  { value: 'today', label: 'Today', icon: Sun },
  { value: 'tomorrow', label: 'Tomorrow', icon: Sunrise },
  { value: 'this_weekend', label: 'This Weekend', icon: CalendarDays },
  { value: 'next_week', label: 'Next Week', icon: CalendarRange },
  { value: 'pick_date', label: 'Pick a date...', icon: Calendar }
]

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
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: var(--color-danger);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  font-weight: 500;
}

.overdue-badge:hover {
  background: rgba(239, 68, 68, 0.25);
  border-color: rgba(239, 68, 68, 0.6);
  transform: scale(1.02);
}

.reschedule-menu {
  position: absolute;
  top: calc(100% + var(--space-1));
  left: 0;
  z-index: 1000;
  min-width: 160px;
  background: var(--overlay-component-bg);
  border: var(--overlay-component-border);
  border-radius: var(--radius-md);
  box-shadow: var(--overlay-component-shadow);
  padding: var(--space-1);
  display: flex;
  flex-direction: column;
  gap: var(--space-0_5);
}

.reschedule-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out);
  text-align: left;
  width: 100%;
}

.reschedule-option:hover {
  background: var(--glass-bg-medium);
}

.backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
}
</style>
