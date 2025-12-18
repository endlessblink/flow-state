<template>
  <div class="base-input-wrapper">
    <label v-if="label" :for="inputId" class="input-label">
      {{ label }}
      <span v-if="required" class="required-indicator">*</span>
    </label>

    <div class="input-container">
      <slot name="prefix" />

      <input
        :id="inputId"
        ref="inputRef"
        v-model="localValue"
        :type="type"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        :class="inputClasses"
        :style="inputStyles"
        @blur="$emit('blur', $event)"
        @focus="$emit('focus', $event)"
      >

      <slot name="suffix" />
    </div>

    <span v-if="helperText" class="helper-text">
      {{ helperText }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, useSlots } from 'vue'
import { useHebrewAlignment } from '@/composables/useHebrewAlignment'

interface Props {
  modelValue?: string | number
  type?: string
  label?: string
  placeholder?: string
  helperText?: string
  disabled?: boolean
  required?: boolean
  id?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  type: 'text',
  disabled: false,
  required: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  blur: [event: FocusEvent]
  focus: [event: FocusEvent]
}>()

const inputRef = ref<HTMLInputElement>()
const inputId = computed(() => props.id || `input-${Math.random().toString(36).substr(2, 9)}`)

// Initialize slots for Vue 3 Composition API
const slots = useSlots()

// Hebrew alignment support
const { shouldAlignRight: _shouldAlignRight, getAlignmentClasses, applyInputAlignment } = useHebrewAlignment()

const localValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Computed properties for Hebrew text alignment
const inputText = computed(() => String(localValue.value || ''))
const _hasHebrew = computed(() => _shouldAlignRight(inputText.value))
const alignmentClasses = computed(() => getAlignmentClasses(inputText.value))
const alignmentStyles = computed(() => applyInputAlignment(inputText.value))

// Dynamic classes for Hebrew alignment
const inputClasses = computed(() => [
  'base-input',
  { 'has-prefix': slots.prefix, 'has-suffix': slots.suffix },
  alignmentClasses.value
])

// Dynamic styles for Hebrew alignment
const inputStyles = computed(() => alignmentStyles.value)


// Expose focus method
defineExpose({
  focus: () => inputRef.value?.focus()
})
</script>

<style scoped>
/* Base Input - Stroke + Glass Morphism Design */
.base-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
}

.input-label {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.required-indicator {
  color: rgba(239, 68, 68, 1);
}

.input-container {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.base-input {
  /* Layout */
  width: 100%;
  height: var(--btn-lg);
  padding: 0 var(--space-4);

  /* Typography */
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--font-normal);

  /* Visual - Glass morphism with stroke */
  background: var(--glass-bg-solid);
  backdrop-filter: blur(20px) saturate(100%);
  -webkit-backdrop-filter: blur(20px) saturate(100%);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  border-radius: var(--radius-lg);

  /* Animation */
  transition: all var(--duration-normal) var(--spring-smooth);

  /* RTL support */
  text-align: start;
  direction: inherit;

  /* Remove default styles */
  outline: none;
  -webkit-appearance: none;
  -moz-appearance: none;
}

.base-input::placeholder {
  color: var(--text-muted);
  opacity: 0.6;
}

.base-input:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, 0.2);
  box-shadow: 0 0 8px rgba(78, 205, 196, 0.1);
}

.base-input:focus {
  border-color: rgba(78, 205, 196, 0.5);
  box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.15), 0 0 12px rgba(78, 205, 196, 0.1);
}

.base-input:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: rgba(0, 0, 0, 0.2);
}

/* Adjust padding when slots are used */
.base-input.has-prefix {
  padding-inline-start: var(--space-2); /* RTL: prefix at start */
}

.base-input.has-suffix {
  padding-inline-end: var(--space-2); /* RTL: suffix at end */
}

.helper-text {
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-normal);
}
</style>
