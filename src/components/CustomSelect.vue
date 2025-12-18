<template>
  <div ref="selectRef" class="custom-select">
    <button
      ref="triggerRef"
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
      <ChevronDown :size="14" class="select-icon" :class="{ 'is-open': isOpen }" />
    </button>

    <Teleport to="body">
      <Transition name="dropdown">
        <ul
          v-if="isOpen"
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
  modelValue: string | number
  options: SelectOption[]
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Select...'
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const selectRef = ref<HTMLElement>()
const triggerRef = ref<HTMLButtonElement>()
const isOpen = ref(false)
const focusedIndex = ref(0)

// Dropdown positioning
const dropdownStyle = ref({
  position: 'fixed' as const,
  top: '0px',
  left: '0px',
  width: '0px'
})

const calculateDropdownPosition = () => {
  if (!triggerRef.value) return

  const rect = triggerRef.value.getBoundingClientRect()
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
    width: `${rect.width}px`
  }
}

const displayValue = computed(() => {
  const selected = props.options.find(opt => opt.value === props.modelValue)
  return selected ? selected.label : props.placeholder
})

const toggleDropdown = async () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
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

// Click outside to close
const handleClickOutside = (event: MouseEvent) => {
  if (selectRef.value && !selectRef.value.contains(event.target as Node)) {
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
const handleScroll = () => {
  if (isOpen.value) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('resize', handleResize)
  window.addEventListener('scroll', handleScroll, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('scroll', handleScroll, true)
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

  /* Glass morphism base - matches BaseDropdown */
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(12px) saturate(100%);
  -webkit-backdrop-filter: blur(12px) saturate(100%);

  /* Stroke border */
  border: 1px solid rgba(255, 255, 255, 0.1);
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
  border-color: rgba(255, 255, 255, 0.2);
  box-shadow: 0 0 12px rgba(78, 205, 196, 0.1);
}

.select-trigger:focus {
  border-color: rgba(78, 205, 196, 0.5);
  box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.15);
}

.select-trigger.is-open {
  border-color: rgba(78, 205, 196, 0.5);
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
  z-index: 9999;

  /* Glass morphism - transparent with blur (matches BasePopover) */
  background: rgba(20, 20, 20, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);

  /* Stroke border */
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-xl);

  /* Layered shadow */
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.5),
    0 8px 24px rgba(0, 0, 0, 0.3);

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
  padding: var(--space-3) var(--space-4);

  /* Transparent base with stroke on interaction */
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);

  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  user-select: none;
}

.select-option:hover,
.select-option.is-focused {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.1);
}

.select-option.is-selected {
  /* Stroke-based selection - no fill */
  background: transparent;
  border-color: rgba(78, 205, 196, 0.5);
  color: rgba(78, 205, 196, 1);
  font-weight: var(--font-semibold);
}

.select-option.is-selected:hover,
.select-option.is-selected.is-focused {
  background: rgba(78, 205, 196, 0.05);
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
</style>
