<template>
  <div ref="triggerRef" class="base-dropdown">
    <button
      type="button"
      class="dropdown-trigger"
      :class="{ 'is-open': isOpen, 'is-disabled': disabled }"
      :disabled="disabled"
      @click="toggleDropdown"
      @keydown.down.prevent="openAndFocusFirst"
      @keydown.up.prevent="openAndFocusLast"
      @keydown.enter.prevent="toggleDropdown"
      @keydown.space.prevent="toggleDropdown"
      @keydown.esc="closeDropdown"
    >
      <slot name="trigger" :selected="selectedOption" :is-open="isOpen">
        <span class="trigger-value">{{ displayValue }}</span>
        <ChevronDown :size="14" class="trigger-icon" :class="{ 'is-open': isOpen }" />
      </slot>
    </button>

    <BasePopover
      :is-visible="isOpen"
      :x="popoverX"
      :y="popoverY"
      position="auto"
      variant="dropdown"
      :close-on-click-outside="true"
      @close="closeDropdown"
    >
      <ul
        class="dropdown-list"
        role="listbox"
        @keydown.down.prevent="focusNext"
        @keydown.up.prevent="focusPrevious"
        @keydown.enter.prevent="selectFocused"
        @keydown.esc="closeDropdown"
      >
        <li
          v-for="(option, index) in options"
          :key="getOptionValue(option)"
          class="dropdown-option"
          :class="{
            'is-selected': isSelected(option),
            'is-focused': index === focusedIndex,
            'is-disabled': option.disabled
          }"
          role="option"
          :aria-selected="isSelected(option)"
          :aria-disabled="option.disabled"
          @click="!option.disabled && selectOption(option)"
          @mouseenter="!option.disabled && (focusedIndex = index)"
        >
          <slot name="option" :option="option" :is-selected="isSelected(option)">
            <component
              v-if="option.icon"
              :is="option.icon"
              :size="16"
              :stroke-width="1.5"
              class="option-icon"
            />
            <span class="option-label">{{ getOptionLabel(option) }}</span>
            <Check v-if="isSelected(option)" :size="16" class="selected-icon" />
          </slot>
        </li>
      </ul>
    </BasePopover>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ChevronDown, Check } from 'lucide-vue-next'
import BasePopover from './BasePopover.vue'
import type { Component } from 'vue'

export interface DropdownOption {
  label: string
  value: string | number
  icon?: Component
  disabled?: boolean
}

interface Props {
  modelValue: string | number | (string | number)[]
  options: DropdownOption[]
  placeholder?: string
  disabled?: boolean
  multiple?: boolean
  searchable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Select...',
  disabled: false,
  multiple: false,
  searchable: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number | (string | number)[]]
}>()

const triggerRef = ref<HTMLElement>()
const isOpen = ref(false)
const focusedIndex = ref(0)
const popoverX = ref(0)
const popoverY = ref(0)

const selectedOption = computed(() => {
  if (props.multiple) {
    const values = Array.isArray(props.modelValue) ? props.modelValue : [props.modelValue]
    return props.options.filter(opt => values.includes(opt.value))
  } else {
    return props.options.find(opt => opt.value === props.modelValue)
  }
})

const displayValue = computed(() => {
  if (props.multiple) {
    const selected = Array.isArray(selectedOption.value) ? selectedOption.value : []
    if (selected.length === 0) return props.placeholder
    if (selected.length === 1) return selected[0].label
    return `${selected.length} selected`
  } else {
    return selectedOption.value ? selectedOption.value.label : props.placeholder
  }
})

const getOptionLabel = (option: DropdownOption) => option.label
const getOptionValue = (option: DropdownOption) => option.value

const isSelected = (option: DropdownOption) => {
  if (props.multiple) {
    const values = Array.isArray(props.modelValue) ? props.modelValue : []
    return values.includes(option.value)
  } else {
    return option.value === props.modelValue
  }
}

const calculatePopoverPosition = () => {
  if (!triggerRef.value) return

  const rect = triggerRef.value.getBoundingClientRect()
  popoverX.value = rect.left
  popoverY.value = rect.bottom + 4 // 4px offset from trigger
}

const toggleDropdown = () => {
  if (props.disabled) return

  isOpen.value = !isOpen.value
  if (isOpen.value) {
    calculatePopoverPosition()
    // Focus current selection or first option
    if (props.multiple) {
      focusedIndex.value = 0
    } else {
      const selectedIndex = props.options.findIndex(opt => opt.value === props.modelValue)
      focusedIndex.value = selectedIndex >= 0 ? selectedIndex : 0
    }
  }
}

const openAndFocusFirst = () => {
  if (props.disabled) return
  isOpen.value = true
  calculatePopoverPosition()
  focusedIndex.value = 0
}

const openAndFocusLast = () => {
  if (props.disabled) return
  isOpen.value = true
  calculatePopoverPosition()
  focusedIndex.value = props.options.length - 1
}

const closeDropdown = () => {
  isOpen.value = false
}

const focusNext = () => {
  let nextIndex = focusedIndex.value + 1
  // Skip disabled options
  while (nextIndex < props.options.length && props.options[nextIndex].disabled) {
    nextIndex++
  }
  if (nextIndex < props.options.length) {
    focusedIndex.value = nextIndex
  }
}

const focusPrevious = () => {
  let prevIndex = focusedIndex.value - 1
  // Skip disabled options
  while (prevIndex >= 0 && props.options[prevIndex].disabled) {
    prevIndex--
  }
  if (prevIndex >= 0) {
    focusedIndex.value = prevIndex
  }
}

const selectFocused = () => {
  if (focusedIndex.value >= 0 && focusedIndex.value < props.options.length) {
    const option = props.options[focusedIndex.value]
    if (!option.disabled) {
      selectOption(option)
    }
  }
}

const selectOption = (option: DropdownOption) => {
  if (props.multiple) {
    const values = Array.isArray(props.modelValue) ? props.modelValue : []
    if (values.includes(option.value)) {
      // Remove from selection
      emit('update:modelValue', values.filter(v => v !== option.value))
    } else {
      // Add to selection
      emit('update:modelValue', [...values, option.value])
    }
  } else {
    emit('update:modelValue', option.value)
    closeDropdown()
  }
}

// Reset focused index when dropdown closes
watch(isOpen, (newVal) => {
  if (!newVal && !props.multiple) {
    const selectedIndex = props.options.findIndex(opt => opt.value === props.modelValue)
    focusedIndex.value = selectedIndex >= 0 ? selectedIndex : 0
  }
})
</script>

<style scoped>
.base-dropdown {
  position: relative;
  display: inline-block;
  width: 100%;
}

.dropdown-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
}

.dropdown-trigger:hover:not(:disabled) {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-strong);
}

.dropdown-trigger:focus {
  outline: none;
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand-primary) 15%, transparent);
}

.dropdown-trigger.is-open {
  border-color: var(--brand-primary);
  background: var(--glass-bg-medium);
}

.dropdown-trigger.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.trigger-value {
  flex: 1;
  text-align: left;
  color: var(--text-primary);
}

.trigger-icon {
  flex-shrink: 0;
  color: var(--text-muted);
  transition: transform var(--duration-fast) var(--spring-smooth);
}

.trigger-icon.is-open {
  transform: rotate(180deg);
}

.dropdown-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.dropdown-option {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  user-select: none;
}

.dropdown-option:hover:not(.is-disabled) {
  background: var(--glass-bg-soft);
  border-color: var(--glass-border);
}

.dropdown-option.is-focused {
  background: var(--glass-bg-soft);
  border-color: var(--glass-border);
}

.dropdown-option.is-selected {
  background: color-mix(in srgb, var(--brand-primary) 10%, transparent);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  font-weight: var(--font-semibold);
}

.dropdown-option.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.option-icon {
  flex-shrink: 0;
  color: currentColor;
}

.option-label {
  flex: 1;
}

.selected-icon {
  flex-shrink: 0;
  color: var(--brand-primary);
}
</style>
