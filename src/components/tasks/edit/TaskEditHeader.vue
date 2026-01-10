<template>
  <div class="form-group">
    <label class="form-label">Title</label>
    <input
      ref="titleInput"
      v-model="modelValue.title"
      type="text"
      class="form-input text-lg font-semibold"
      :class="titleAlignmentClasses"
      :style="titleAlignmentStyles"
      placeholder="Task title"
      @keydown.enter.prevent
    />
  </div>

  <div class="form-group">
    <label class="form-label">Description</label>
    <MarkdownEditor
      v-model="modelValue.description"
      placeholder="Describe what needs to be done..."
      :min-height="120"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { type Task } from '@/stores/tasks'
import MarkdownEditor from '@/components/common/MarkdownEditor.vue'
import { useHebrewAlignment } from '@/composables/useHebrewAlignment'

const props = defineProps<{
  modelValue: Task
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: Task): void
}>()

const titleInput = ref<HTMLInputElement | null>(null)

// Hebrew Alignment
const { getAlignmentClasses, applyInputAlignment } = useHebrewAlignment()
const titleAlignmentClasses = computed(() => getAlignmentClasses(props.modelValue.title))
const titleAlignmentStyles = computed(() => applyInputAlignment(props.modelValue.title))

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
