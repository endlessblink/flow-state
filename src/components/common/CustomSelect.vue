<template>
  <div ref="selectRef" class="custom-select" :class="{ 'is-compact': compact }">
    <button
      ref="triggerElement"
      type="button"
      class="select-trigger"
      :class="{ 'is-open': isOpen }"
      @click="toggleDropdown"
      @keydown.down.prevent="openAndFocusFirst"
      @keydown.up.prevent="openAndFocusLast"
      @keydown.enter.prevent="toggleDropdown"
      @keydown.space.prevent="toggleDropdown"
      @keydown.esc="closeDropdown"
    >
      <span class="select-value">{{ displayValue }}</span>
      <ChevronDown :size="compact ? 12 : 14" class="select-icon" :class="{ 'is-open': isOpen }" />
    </button>

    <Teleport to="body">
      <Transition name="dropdown">
        <ul
          v-if="isOpen"
          ref="dropdownRef"
          class="select-dropdown"
          :style="dropdownStyle"
          role="listbox"
          @keydown.down.prevent="focusNext"
          @keydown.up.prevent="focusPrevious"
          @keydown.enter.prevent="selectFocused"
          @keydown.esc="closeDropdown"
        >
          <li
            v-for="(option, index) in options"
            :key="option.value"
            class="select-option"
            :class="{
              'is-selected': option.value === modelValue,
              'is-focused': index === focusedIndex
            }"
            role="option"
            :aria-selected="option.value === modelValue"
            @click="selectOption(option)"
            @mouseenter="focusedIndex = index"
          >
            {{ option.label }}
          </li>
        </ul>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ChevronDown } from 'lucide-vue-next'

interface SelectOption {
  label: string
  value: string | number
}

interface Props {
  modelValue: string | number | null
  options: SelectOption[]
  placeholder?: string
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Select...',
  compact: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const selectRef = ref<HTMLElement>()
const triggerElement = ref<HTMLButtonElement>()
const dropdownRef = ref<HTMLElement>()
const isOpen = ref(false)
const focusedIndex = ref(0)

// Unique ID for this dropdown instance (for global close coordination)
const dropdownId = Math.random().toString(36).substring(2, 9)

// Dropdown positioning
const dropdownStyle = ref<Record<string, string>>({
  position: 'fixed' as const,
  top: '0px',
  left: '0px',
  minWidth: '0px',
  maxWidth: 'none'
})

const calculateDropdownPosition = () => {
  if (!triggerElement.value) return

  const rect = triggerElement.value.getBoundingClientRect()
  const viewportHeight = window.innerHeight
  const spaceBelow = viewportHeight - rect.bottom
  const spaceAbove = rect.top
  const dropdownHeight = Math.min(240, props.options.length * 44 + 16) // Estimate height

  // Position below if there's enough space, otherwise above
  const positionAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow

  dropdownStyle.value = {
    position: 'fixed',
    top: positionAbove ? `${rect.top - dropdownHeight - 4}px` : `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    minWidth: `max(${rect.width}px, 150px)`,
    maxWidth: `max(${rect.width}px, calc(100vw - ${rect.left}px - 16px))`
  }
}

const displayValue = computed(() => {
  const selected = props.options.find(opt => opt.value === props.modelValue)
  return selected ? selected.label : props.placeholder
})

const toggleDropdown = async () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    // Close any other open dropdowns
    window.dispatchEvent(new CustomEvent('close-all-dropdowns', { detail: { except: dropdownId } }))
    // Focus current selection
    const selectedIndex = props.options.findIndex(opt => opt.value === props.modelValue)
    focusedIndex.value = selectedIndex >= 0 ? selectedIndex : 0
    // Calculate dropdown position
    await nextTick()
    calculateDropdownPosition()
  }
}

const openAndFocusFirst = async () => {
  isOpen.value = true
  focusedIndex.value = 0
  await nextTick()
  calculateDropdownPosition()
}

const openAndFocusLast = async () => {
  isOpen.value = true
  focusedIndex.value = props.options.length - 1
  await nextTick()
  calculateDropdownPosition()
}

const closeDropdown = () => {
  isOpen.value = false
}

const focusNext = () => {
  if (focusedIndex.value < props.options.length - 1) {
    focusedIndex.value++
  }
}

const focusPrevious = () => {
  if (focusedIndex.value > 0) {
    focusedIndex.value--
  }
}

const selectFocused = () => {
  if (focusedIndex.value >= 0 && focusedIndex.value < props.options.length) {
    selectOption(props.options[focusedIndex.value])
  }
}

const selectOption = (option: SelectOption) => {
  emit('update:modelValue', option.value)
  closeDropdown()
}

// Click outside to close (must check both trigger AND teleported dropdown)
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node
  const isInsideTrigger = selectRef.value?.contains(target)
  const isInsideDropdown = dropdownRef.value?.contains(target)

  if (!isInsideTrigger && !isInsideDropdown) {
    closeDropdown()
  }
}

// Handle window resize to recalculate position
const handleResize = () => {
  if (isOpen.value) {
    calculateDropdownPosition()
  }
}

// Handle scroll to close dropdown (avoid position issues)
const handleScroll = (event: Event) => {
  if (isOpen.value) {
    // If scrolling happens inside the dropdown, don't close
    const target = event.target as HTMLElement
    if (dropdownRef.value && (target === dropdownRef.value || dropdownRef.value.contains(target))) {
      return
    }
    closeDropdown()
  }
}

// Handle global close event (when another dropdown opens)
const handleGlobalClose = (event: Event) => {
  const customEvent = event as CustomEvent<{ except: string }>
  if (customEvent.detail?.except !== dropdownId && isOpen.value) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('resize', handleResize)
  window.addEventListener('scroll', handleScroll, true)
  window.addEventListener('close-all-dropdowns', handleGlobalClose)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('scroll', handleScroll, true)
  window.removeEventListener('close-all-dropdowns', handleGlobalClose)
})

// Reset focused index when dropdown closes
watch(isOpen, (newVal) => {
  if (!newVal) {
    const selectedIndex = props.options.findIndex(opt => opt.value === props.modelValue)
    focusedIndex.value = selectedIndex >= 0 ? selectedIndex : 0
  }
})
</script>

<style scoped>
.custom-select {
  position: relative;
  width: 100%;
}

.select-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);

  /* Standardized input styling */
  background: var(--input-bg, var(--glass-bg-medium));
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  border: 1px solid var(--glass-border-hover);
  border-radius: var(--radius-lg);

  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  min-height: 44px;
  cursor: pointer;
  outline: none;
  transition: all var(--duration-fast) var(--spring-smooth);
  text-align: left;
}

.select-trigger:hover {
  border-color: var(--border-hover);
  box-shadow: 0 0 12px rgba(78, 205, 196, 0.1);
}

.select-trigger:focus {
  border-color: var(--brand-primary-alpha-50);
  box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.15);
}

.select-trigger.is-open {
  border-color: var(--brand-primary-alpha-50);
  box-shadow: 0 0 12px rgba(78, 205, 196, 0.15);
}

.select-value {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.select-icon {
  flex-shrink: 0;
  color: var(--text-muted);
  transition: transform var(--duration-normal) var(--spring-smooth);
}

.select-icon.is-open {
  transform: rotate(180deg);
  color: rgba(78, 205, 196, 0.8);
}

.select-dropdown {
  /* Position is set via inline style from Teleport */
  z-index: 99999;

  /* Use design tokens for consistent overlay styling */
  background: var(--overlay-component-bg);
  backdrop-filter: var(--overlay-component-backdrop);
  -webkit-backdrop-filter: var(--overlay-component-backdrop);
  border: var(--overlay-component-border);
  box-shadow: var(--overlay-component-shadow);
  border-radius: var(--radius-xl);

  max-height: 240px;
  overflow-y: auto;
  padding: var(--space-2);
  margin: 0;
  list-style: none;

  /* Ensure backdrop-filter works */
  isolation: isolate;
  transform: translateZ(0);
}

.select-option {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2_5) var(--space-3);

  /* Clean styling matching SectionSelector */
  background: transparent;
  border-radius: var(--radius-md);

  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out);
  user-select: none;
  white-space: nowrap;
}

.select-option:hover,
.select-option.is-focused {
  background: var(--glass-bg-heavy);
}

.select-option.is-selected {
  background: var(--brand-primary-bg-medium);
  color: var(--brand-primary);
  font-weight: var(--font-medium);
}

.select-option.is-selected:hover,
.select-option.is-selected.is-focused {
  background: var(--brand-primary-bg-heavy);
}

/* Dropdown transition */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity var(--duration-fast) ease, transform var(--duration-fast) ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ============================================
   COMPACT VARIANT - for use inside metadata bars
   ============================================ */
.custom-select.is-compact {
  width: auto;
}

.custom-select.is-compact .select-trigger {
  /* Remove glass morphism - parent provides container styling */
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border: none;

  /* Compact sizing */
  padding: 0;
  min-height: unset;
  height: auto;
  width: auto;

  /* Remove hover effects that conflict with parent */
  box-shadow: none;
}

.custom-select.is-compact .select-trigger:hover,
.custom-select.is-compact .select-trigger:focus,
.custom-select.is-compact .select-trigger.is-open {
  background: transparent;
  border: none;
  box-shadow: none;
}

.custom-select.is-compact .select-value {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.custom-select.is-compact .select-icon {
  color: var(--text-tertiary);
}
</style>
