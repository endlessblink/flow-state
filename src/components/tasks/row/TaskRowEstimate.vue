<template>
  <div ref="triggerWrapperRef" class="task-row__estimate" @click.stop>
    <span
      ref="triggerRef"
      class="task-row__estimate-trigger"
      :class="{ 'task-row__estimate-trigger--empty': !estimatedDuration }"
      title="Click to set time estimate"
      @click="toggleDropdown"
    >
      {{ formattedEstimate }}
    </span>

    <!-- Estimate Selector Dropdown (teleported to body to avoid overflow clipping) -->
    <Teleport to="body">
      <Transition name="dropdown-slide">
        <div
          v-if="isOpen"
          ref="dropdownRef"
          class="estimate-dropdown"
          :style="dropdownStyle"
        >
          <button
            v-for="option in estimateOptions"
            :key="option.label"
            class="estimate-dropdown__item"
            :class="{ 'is-active': isOptionActive(option.value) }"
            @click="selectEstimate(option.value)"
          >
            <span class="estimate-dropdown__label">{{ option.label }}</span>
            <Check v-if="isOptionActive(option.value)" :size="14" class="estimate-dropdown__check" />
          </button>

          <!-- Custom input -->
          <div class="estimate-dropdown__custom">
            <input
              ref="customInputRef"
              v-model="customMinutes"
              type="number"
              min="1"
              max="480"
              placeholder="Min"
              class="estimate-dropdown__input"
              @keydown.enter="applyCustom"
              @keydown.stop
            >
            <button class="estimate-dropdown__apply" @click="applyCustom">
              Set
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { Check } from 'lucide-vue-next'

const props = defineProps<{
  estimatedDuration?: number | null
}>()

const emit = defineEmits<{
  'update:estimatedDuration': [value: number | null]
}>()

const isOpen = ref(false)
const triggerWrapperRef = ref<HTMLElement>()
const triggerRef = ref<HTMLElement>()
const dropdownRef = ref<HTMLElement>()
const customInputRef = ref<HTMLInputElement>()
const customMinutes = ref('')

const dropdownStyle = ref<Record<string, string>>({
  position: 'fixed',
  top: '0px',
  left: '0px'
})

const calculateDropdownPosition = () => {
  if (!triggerRef.value) return
  const rect = triggerRef.value.getBoundingClientRect()
  const viewportHeight = window.innerHeight
  const dropdownHeight = 8 * 36 + 16
  const spaceBelow = viewportHeight - rect.bottom
  const positionAbove = spaceBelow < dropdownHeight && rect.top > spaceBelow

  dropdownStyle.value = {
    position: 'fixed',
    top: positionAbove ? `${rect.top - dropdownHeight - 4}px` : `${rect.bottom + 4}px`,
    left: `${rect.left + rect.width / 2}px`,
    transform: 'translateX(-50%)'
  }
}

const estimateOptions: Array<{ label: string; value: number | null }> = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '4 hours', value: 240 },
  { label: '1 day', value: 480 },
  { label: 'No estimate', value: null }
]

const formatEstimate = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h${m}m` : `${h}h`
}

const formattedEstimate = computed(() => {
  if (!props.estimatedDuration) return '-'
  return formatEstimate(props.estimatedDuration)
})

const isOptionActive = (value: number | null): boolean => {
  if (value === null && !props.estimatedDuration) return true
  if (!props.estimatedDuration || value === null) return false
  return props.estimatedDuration === value
}

const toggleDropdown = async () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    customMinutes.value = props.estimatedDuration ? String(props.estimatedDuration) : ''
    await nextTick()
    calculateDropdownPosition()
  }
}

const closeDropdown = () => {
  isOpen.value = false
}

const selectEstimate = (value: number | null) => {
  emit('update:estimatedDuration', value)
  closeDropdown()
}

const applyCustom = () => {
  const val = parseInt(customMinutes.value)
  if (val > 0 && val <= 480) {
    emit('update:estimatedDuration', val)
    closeDropdown()
  }
}

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
.task-row__estimate {
  grid-area: estimate;
  display: flex;
  align-items: center;
  position: relative;
}

.task-row__estimate-trigger {
  display: inline-flex;
  align-items: center;
  padding: 0 var(--space-1_5);
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-tertiary);
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
  height: var(--space-5_5);
  box-sizing: border-box;
  line-height: 1;
}

.task-row__estimate-trigger:hover {
  border-color: var(--border-hover);
  color: var(--text-secondary);
  background: var(--glass-bg-soft);
}

.task-row__estimate-trigger--empty {
  color: var(--glass-border);
  border-style: dashed;
}
</style>

<style>
/* Estimate Dropdown - Dark glass morphism (teleported to body, NOT scoped) */
.estimate-dropdown {
  z-index: var(--z-tooltip);
  background: var(--overlay-component-bg) !important;
  backdrop-filter: var(--overlay-component-backdrop);
  -webkit-backdrop-filter: var(--overlay-component-backdrop);
  border: 1px solid var(--glass-border) !important;
  box-shadow: var(--shadow-xl);
  border-radius: var(--radius-md);
  min-width: var(--space-30);
  max-height: var(--space-50);
  overflow-y: auto;
  padding: var(--space-1);
  isolation: isolate;
}

.estimate-dropdown__item {
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
  text-align: start;
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  border-radius: var(--radius-md);
  user-select: none;
  white-space: nowrap;
  min-height: var(--space-7);
}

.estimate-dropdown__item:hover {
  background: var(--glass-bg-medium) !important;
  background-color: var(--glass-bg-medium) !important;
}

.estimate-dropdown__label {
  flex: 1;
}

.estimate-dropdown__check {
  flex-shrink: 0;
  opacity: 0.8;
}

.estimate-dropdown__custom {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1_5) var(--space-2);
  border-top: 1px solid var(--border-subtle);
  margin-top: var(--space-1);
}

.estimate-dropdown__input {
  flex: 1;
  padding: var(--space-1) var(--space-1_5);
  font-size: var(--text-xs);
  background: var(--surface-primary);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  outline: none;
  width: 60px;
}

.estimate-dropdown__input:focus {
  border-color: var(--brand-primary);
}

.estimate-dropdown__input::placeholder {
  color: rgba(var(--color-slate-50), 0.3);
}

/* Hide spinner for number input */
.estimate-dropdown__input::-webkit-inner-spin-button,
.estimate-dropdown__input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.estimate-dropdown__apply {
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-xs);
  font-weight: 500;
  background: var(--glass-bg-soft);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-sm);
  color: var(--brand-primary);
  cursor: pointer;
  transition: all var(--duration-fast);
  backdrop-filter: var(--blur-sm);
}

.estimate-dropdown__apply:hover {
  background: rgba(78, 205, 196, 0.15);
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
