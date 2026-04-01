<template>
  <div class="form-group">
    <label v-if="!hideLabels" class="form-label">Title</label>
    <input
      ref="titleInput"
      v-model="title"
      type="text"
      class="form-input text-lg font-semibold"
      :class="titleAlignmentClasses"
      :style="titleAlignmentStyles"
      placeholder="Task title"
      :dir="titleDir"
      @keydown.enter.prevent
    >
  </div>

  <div class="form-group">
    <label v-if="!hideLabels" class="form-label">Description</label>
    <MarkdownEditor
      v-model="description"
      :placeholder="hideLabels ? 'Add a description... Use the toolbar for formatting.' : 'Describe what needs to be done...'"
      :min-height="hideLabels ? 80 : 120"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { type Task } from '@/stores/tasks'
import MarkdownEditor from '@/components/common/MarkdownEditor.vue'
import { useHebrewAlignment } from '@/composables/useHebrewAlignment'

const props = withDefaults(defineProps<{
  modelValue: Task
  hideLabels?: boolean
}>(), {
  hideLabels: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: Task): void
}>()

const title = computed({
  get: () => props.modelValue.title,
  set: (val) => emit('update:modelValue', { ...props.modelValue, title: val })
})

const description = computed({
  get: () => props.modelValue.description,
  set: (val) => emit('update:modelValue', { ...props.modelValue, description: val })
})

const titleInput = ref<HTMLInputElement | null>(null)

// Hebrew Alignment
const { getAlignmentClasses, applyInputAlignment, containsHebrew } = useHebrewAlignment()
const titleAlignmentClasses = computed(() => getAlignmentClasses(props.modelValue.title))
const titleAlignmentStyles = computed(() => applyInputAlignment(props.modelValue.title))
const titleDir = computed(() => containsHebrew(props.modelValue.title ?? '') ? 'rtl' : 'ltr')

defineExpose({
  titleInput
})
</script>

<style scoped>
.form-group {
  margin-bottom: var(--space-3);
}

.form-label {
  display: block;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-muted);
  margin-bottom: var(--space-2);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.form-input {
  background: linear-gradient(135deg, var(--glass-bg-soft) 0%, var(--glass-bg-light) 100%);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  width: 100%;
  font-size: var(--text-sm);
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: inset var(--shadow-sm);
}

.form-input:focus {
  outline: none;
  border-color: var(--calendar-creating-border);
  background: linear-gradient(135deg, var(--glass-bg-heavy) 0%, var(--glass-bg-tint) 100%);
  box-shadow: 0 0 0 3px var(--calendar-creating-bg), inset var(--shadow-sm);
}
</style>
