<template>
  <div class="custom-select" ref="selectRef">
    <button
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

    <Transition name="dropdown">
      <ul
        v-if="isOpen"
        class="select-dropdown"
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
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
const isOpen = ref(false)
const focusedIndex = ref(0)

const displayValue = computed(() => {
  const selected = props.options.find(opt => opt.value === props.modelValue)
  return selected ? selected.label : props.placeholder
})

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    // Focus current selection
    const selectedIndex = props.options.findIndex(opt => opt.value === props.modelValue)
    focusedIndex.value = selectedIndex >= 0 ? selectedIndex : 0
  }
}

const openAndFocusFirst = () => {
  isOpen.value = true
  focusedIndex.value = 0
}

const openAndFocusLast = () => {
  isOpen.value = true
  focusedIndex.value = props.options.length - 1
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

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
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
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  min-height: 44px;
  cursor: pointer;
  outline: none;
  transition: all var(--duration-fast) ease;
  text-align: left;
}

.select-trigger:hover {
  border-color: var(--border-medium);
  background: var(--glass-bg-weak);
}

.select-trigger:focus {
  border-color: var(--state-active-border);
  background: var(--glass-bg-soft);
  box-shadow: 0 0 0 2px var(--state-active-bg);
}

.select-trigger.is-open {
  border-color: var(--border-medium);
  background: var(--glass-bg-soft);
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
  transition: transform var(--duration-fast) var(--spring-smooth);
}

.select-icon.is-open {
  transform: rotate(180deg);
}

.select-dropdown {
  position: absolute;
  top: calc(100% + var(--space-1));
  left: 0;
  right: 0;
  z-index: var(--z-dropdown);
  background: linear-gradient(
    135deg,
    rgba(20, 20, 20, 0.96) 0%,
    rgba(15, 15, 15, 0.98) 100%
  );
  backdrop-filter: blur(48px) saturate(180%);
  -webkit-backdrop-filter: blur(48px) saturate(180%);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-xl);
  max-height: 240px;
  overflow-y: auto;
  padding: var(--space-1);
  margin: 0;
  list-style: none;
}

.select-option {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  user-select: none;
  background: transparent;
}

.select-option:hover,
.select-option.is-focused {
  background: var(--glass-bg-soft);
}

.select-option.is-selected {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
  font-weight: var(--font-medium);
}

.select-option.is-selected:hover,
.select-option.is-selected.is-focused {
  background: var(--glass-bg-soft);
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
