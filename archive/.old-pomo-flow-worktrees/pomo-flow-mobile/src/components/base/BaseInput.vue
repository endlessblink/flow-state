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
        :class="['base-input', { 'has-prefix': $slots.prefix, 'has-suffix': $slots.suffix }]"
        @blur="$emit('blur', $event)"
        @focus="$emit('focus', $event)"
      />

      <slot name="suffix" />
    </div>

    <span v-if="helperText" class="helper-text">
      {{ helperText }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

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

const localValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Expose focus method
defineExpose({
  focus: () => inputRef.value?.focus()
})
</script>

<style scoped>
/* Base Input - Token-based styling */
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
  color: var(--color-danger);
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

  /* Visual - all from tokens */
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  color: var(--input-text);
  border-radius: var(--radius-lg);

  /* Animation */
  transition: all var(--duration-normal) var(--spring-smooth);

  /* Remove default styles */
  outline: none;
  -webkit-appearance: none;
  -moz-appearance: none;
}

.base-input::placeholder {
  color: var(--input-placeholder);
  opacity: 0.7;
}

.base-input:hover:not(:disabled) {
  border-color: var(--border-hover);
}

.base-input:focus {
  border-color: var(--input-border-focus);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--input-border-focus) 15%, transparent);
}

.base-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--surface-hover);
}

/* Adjust padding when slots are used */
.base-input.has-prefix {
  padding-left: var(--space-2);
}

.base-input.has-suffix {
  padding-right: var(--space-2);
}

.helper-text {
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-normal);
}
</style>
