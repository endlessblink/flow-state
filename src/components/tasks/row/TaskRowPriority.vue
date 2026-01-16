<template>
  <div class="task-row__priority" @click.stop>
    <span
      v-if="priority"
      class="task-row__priority-badge task-row__priority-badge--clickable"
      :class="{
        'task-row__priority-badge--high': priority === 'high',
        'task-row__priority-badge--medium': priority === 'medium',
        'task-row__priority-badge--low': priority === 'low'
      }"
      title="Click to change priority"
      @click="toggleDropdown"
    >
      {{ formattedPriority }}
    </span>

    <!-- Priority Selector Dropdown -->
    <Transition name="dropdown-slide">
      <div v-if="isOpen" class="priority-dropdown">
        <button
          v-for="option in priorityOptions"
          :key="option.value"
          class="priority-dropdown__item"
          :class="[
            `priority-dropdown__item--${option.value}`,
            { 'is-active': priority === option.value }
          ]"
          @click="selectPriority(option.value)"
        >
          <span class="priority-dropdown__label">{{ option.label }}</span>
          <Check v-if="priority === option.value" :size="14" class="priority-dropdown__check" />
        </button>
      </div>
    </Transition>

    <!-- Click outside overlay -->
    <div
      v-if="isOpen"
      class="priority-dropdown__overlay"
      @click="closeDropdown"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Check } from 'lucide-vue-next'

const props = defineProps<{
  priority?: string | null
}>()

const emit = defineEmits<{
  'update:priority': [priority: string]
}>()

const isOpen = ref(false)

const priorityOptions = [
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' }
]

const formattedPriority = computed(() => {
  const map: Record<string, string> = {
    'low': 'Low',
    'medium': 'Med',
    'high': 'High',
    'urgent': 'Urgent'
  }
  return map[props.priority || 'medium'] || props.priority
})

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

const closeDropdown = () => {
  isOpen.value = false
}

const selectPriority = (value: string) => {
  emit('update:priority', value)
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
.task-row__priority {
  grid-area: priority;
  display: flex;
  align-items: center;
  position: relative;
}

/* Priority Badge - compact size matching status dropdown */
.task-row__priority-badge {
  font-size: var(--text-xs);
  font-weight: 500;
  padding: 0 var(--space-1_5);
  border-radius: var(--radius-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background-color: var(--glass-bg-soft);
  color: var(--text-secondary);
  border: 1px solid transparent;
  height: 22px;
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  line-height: 1;
}

.task-row__priority-badge--clickable {
  cursor: pointer;
  transition: all var(--duration-fast);
}

.task-row__priority-badge--clickable:hover {
  transform: translateY(-1px);
  filter: brightness(1.2);
}

.task-row__priority-badge--high {
  color: var(--priority-high-text);
  background-color: var(--priority-high-bg);
  border-color: var(--priority-high-border);
}

.task-row__priority-badge--medium {
  color: var(--priority-medium-text);
  background-color: var(--priority-medium-bg);
  border-color: var(--priority-medium-border);
}

.task-row__priority-badge--low {
  color: var(--priority-low-text);
  background-color: var(--priority-low-bg);
  border-color: var(--priority-low-border);
}

/* Priority Selector Dropdown - Glass morphism matching CustomSelect */
.priority-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 99999;

  /* Glass morphism - matching CustomSelect */
  background: rgba(30, 30, 40, 0.65);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.08) inset;
  border-radius: var(--radius-md);

  min-width: 100px;
  max-height: 200px;
  overflow-y: auto;
  padding: var(--space-1);

  /* Ensure backdrop-filter works */
  isolation: isolate;
  transform: translateX(-50%) translateZ(0);
}

.priority-dropdown__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-1_5) var(--space-2);
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-primary);
  font-size: var(--text-xs);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: left;
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  border-radius: var(--radius-md);
  user-select: none;
  white-space: nowrap;
  min-height: 28px;
}

.priority-dropdown__item:hover {
  background: var(--surface-hover);
}

.priority-dropdown__item.is-active {
  background: rgba(78, 205, 196, 0.15);
  color: var(--brand-primary);
}

.priority-dropdown__item--high {
  color: var(--priority-high-text);
}

.priority-dropdown__item--high:hover,
.priority-dropdown__item--high.is-active {
  background: var(--priority-high-bg);
}

.priority-dropdown__item--medium {
  color: var(--priority-medium-text);
}

.priority-dropdown__item--medium:hover,
.priority-dropdown__item--medium.is-active {
  background: var(--priority-medium-bg);
}

.priority-dropdown__item--low {
  color: var(--priority-low-text);
}

.priority-dropdown__item--low:hover,
.priority-dropdown__item--low.is-active {
  background: var(--priority-low-bg);
}

.priority-dropdown__label {
  flex: 1;
}

.priority-dropdown__check {
  flex-shrink: 0;
  opacity: 0.8;
}

.priority-dropdown__overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
}

/* Dropdown transitions */
.dropdown-slide-enter-active,
.dropdown-slide-leave-active {
  transition: all var(--duration-fast) ease;
}

.dropdown-slide-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-4px);
}

.dropdown-slide-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-4px);
}
</style>
