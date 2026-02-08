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

/* ADHD-friendly: Medium priority is visually subdued - not every task needs attention */
.task-row__priority-badge--medium {
  color: var(--text-muted); /* Muted text instead of orange */
  background-color: transparent; /* No background - reduces visual noise */
  border-color: var(--border-subtle); /* Subtle border only */
}

.task-row__priority-badge--low {
  color: var(--priority-low-text);
  background-color: var(--priority-low-bg);
  border-color: var(--priority-low-border);
}

/* Priority Selector Dropdown - Dark glass morphism */
.priority-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-tooltip);

  /* Glass morphism - dark purple-tinted with solid fallback */
  background-color: var(--overlay-component-bg) !important;
  background: var(--overlay-component-bg) !important;
  backdrop-filter: var(--overlay-component-backdrop);
  -webkit-backdrop-filter: var(--overlay-component-backdrop);
  border: var(--overlay-component-border) !important;
  box-shadow: var(--overlay-component-shadow);
  border-radius: var(--radius-md);

  min-width: 100px;
  max-height: 200px;
  overflow-y: auto;
  padding: var(--space-1);

  isolation: isolate;
}

.priority-dropdown__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-1_5) var(--space-2);
  border: none !important;
  background: none !important;
  background-color: transparent !important;
  color: var(--text-primary) !important;
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
  background: var(--glass-bg-heavy) !important;
  background-color: var(--glass-bg-heavy) !important;
}

.priority-dropdown__item.is-active {
  /* Simple checkmark indicator, no background highlight */
}

.priority-dropdown__item--high {
  color: var(--color-priority-high) !important;
}

.priority-dropdown__item--high:hover {
  background: var(--priority-high-bg) !important;
}

.priority-dropdown__item--medium {
  color: var(--color-priority-medium) !important;
}

.priority-dropdown__item--medium:hover {
  background: var(--priority-medium-bg) !important;
}

.priority-dropdown__item--low {
  color: var(--color-priority-low) !important;
}

.priority-dropdown__item--low:hover {
  background: var(--priority-low-bg) !important;
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
  z-index: var(--z-dropdown);
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
