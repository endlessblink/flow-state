<template>
  <div ref="triggerWrapperRef" class="task-row__priority" @click.stop>
    <span
      ref="triggerRef"
      class="task-row__priority-badge task-row__priority-badge--clickable"
      :class="{
        'task-row__priority-badge--high': priority === 'high',
        'task-row__priority-badge--medium': priority === 'medium',
        'task-row__priority-badge--low': priority === 'low',
        'task-row__priority-badge--none': !priority
      }"
      title="Click to change priority"
      @click="toggleDropdown"
    >
      {{ formattedPriority }}
    </span>

    <!-- Priority Selector Dropdown (teleported to body to avoid overflow clipping) -->
    <Teleport to="body">
      <Transition name="dropdown-slide">
        <div v-if="isOpen" ref="dropdownRef" class="priority-dropdown" :style="dropdownStyle">
          <button
            v-for="option in priorityOptions"
            :key="option.value ?? 'none'"
            class="priority-dropdown__item"
            :class="[
              `priority-dropdown__item--${option.value ?? 'none'}`,
              { 'is-active': isOptionActive(option.value) }
            ]"
            @click="selectPriority(option.value)"
          >
            <span class="priority-dropdown__label">{{ option.label }}</span>
            <Check v-if="isOptionActive(option.value)" :size="14" class="priority-dropdown__check" />
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { Check } from 'lucide-vue-next'

const props = defineProps<{
  priority?: string | null
}>()

const emit = defineEmits<{
  'update:priority': [priority: string]
}>()

const isOpen = ref(false)
const triggerWrapperRef = ref<HTMLElement>()
const triggerRef = ref<HTMLElement>()
const dropdownRef = ref<HTMLElement>()

// Fixed positioning for teleported dropdown
const dropdownStyle = ref<Record<string, string>>({
  position: 'fixed',
  top: '0px',
  left: '0px'
})

const calculateDropdownPosition = () => {
  if (!triggerRef.value) return
  const rect = triggerRef.value.getBoundingClientRect()
  const viewportHeight = window.innerHeight
  const dropdownHeight = 4 * 36 + 16 // 4 options * ~36px + padding
  const spaceBelow = viewportHeight - rect.bottom
  const positionAbove = spaceBelow < dropdownHeight && rect.top > spaceBelow

  dropdownStyle.value = {
    position: 'fixed',
    top: positionAbove ? `${rect.top - dropdownHeight - 4}px` : `${rect.bottom + 4}px`,
    left: `${rect.left + rect.width / 2}px`,
    transform: 'translateX(-50%)'
  }
}

const priorityOptions: Array<{ label: string; value: string | null }> = [
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
  { label: 'None', value: null }
]

const formattedPriority = computed(() => {
  if (!props.priority) return 'None'
  const map: Record<string, string> = {
    'low': 'Low',
    'medium': 'Med',
    'high': 'High',
    'urgent': 'Urgent'
  }
  return map[props.priority] || props.priority
})

const isOptionActive = (value: string | null): boolean => {
  if (value === null && !props.priority) return true
  if (!props.priority || !value) return false
  return props.priority === value
}

const toggleDropdown = async () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    await nextTick()
    calculateDropdownPosition()
  }
}

const closeDropdown = () => {
  isOpen.value = false
}

const selectPriority = (value: string | null) => {
  emit('update:priority', value as string)
  closeDropdown()
}

// Click outside to close (check both trigger and teleported dropdown)
const handleClickOutside = (event: MouseEvent) => {
  if (!isOpen.value) return
  const target = event.target as Node
  const isInsideTrigger = triggerWrapperRef.value?.contains(target)
  const isInsideDropdown = dropdownRef.value?.contains(target)
  if (!isInsideTrigger && !isInsideDropdown) {
    closeDropdown()
  }
}

const handleEscapeKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape') closeDropdown()
}

const handleScroll = (event: Event) => {
  if (!isOpen.value) return
  const target = event.target as HTMLElement
  if (dropdownRef.value && (target === dropdownRef.value || dropdownRef.value.contains(target))) return
  closeDropdown()
}

onMounted(() => {
  document.addEventListener('keydown', handleEscapeKey)
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('scroll', handleScroll, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleEscapeKey)
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('scroll', handleScroll, true)
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
  color: var(--text-muted);
  background-color: transparent;
  border-color: var(--border-subtle);
}

.task-row__priority-badge--low {
  color: var(--priority-low-text);
  background-color: var(--priority-low-bg);
  border-color: var(--priority-low-border);
}

/* None priority - subtle empty state */
.task-row__priority-badge--none {
  color: var(--glass-border);
  background-color: transparent;
  border-color: var(--border-subtle);
  border-style: dashed;
}
</style>

<style>
/* Priority Dropdown - Dark glass morphism (teleported to body, NOT scoped) */
.priority-dropdown {
  z-index: var(--z-tooltip);
  background-color: hsl(var(--slate-900)) !important;
  background: rgba(28, 25, 45, 0.95) !important;
  backdrop-filter: blur(var(--space-4));
  -webkit-backdrop-filter: blur(var(--space-4));
  border: var(--space-0_5) solid rgba(var(--color-slate-50), 0.1) !important;
  box-shadow:
    0 var(--space-2) var(--space-8) rgba(var(--color-slate-900), 0.4),
    0 0 0 var(--space-0_5) rgba(var(--color-slate-50), 0.05) inset;
  border-radius: var(--radius-md);
  min-width: var(--space-25);
  max-height: var(--space-50);
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
  color: rgba(var(--color-slate-50), 0.9) !important;
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
  min-height: var(--space-7);
}

.priority-dropdown__item:hover {
  background: rgba(var(--color-slate-50), 0.08) !important;
  background-color: rgba(var(--color-slate-50), 0.08) !important;
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

.priority-dropdown__item--none {
  color: var(--text-muted) !important;
}

.priority-dropdown__label {
  flex: 1;
}

.priority-dropdown__check {
  flex-shrink: 0;
  opacity: 0.8;
}

/* Dropdown transitions */
.dropdown-slide-enter-active,
.dropdown-slide-leave-active {
  transition: opacity var(--duration-fast) ease;
}

.dropdown-slide-enter-from,
.dropdown-slide-leave-to {
  opacity: 0;
}
</style>
