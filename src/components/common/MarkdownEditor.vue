<template>
  <MilkdownProvider>
    <div class="markdown-editor" :dir="textDirection">
      <MilkdownEditorSurface
        :model-value="internalValue"
        :text-direction="textDirection"
        @update:model-value="handleInternalUpdate"
      />
    </div>
  </MilkdownProvider>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { MilkdownProvider } from '@milkdown/vue'
import MilkdownEditorSurface from './MilkdownEditorSurface.vue'

interface Props {
  modelValue: string
  placeholder?: string
  rows?: number // Accept but don't use - prevents fallthrough to MilkdownProvider
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: 'Type here... Use **bold**, *italic*, or - [ ] for tasks',
  rows: 4
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const internalValue = ref(props.modelValue)

const handleInternalUpdate = (markdown: string) => {
  if (markdown !== internalValue.value) {
    internalValue.value = markdown
    emit('update:modelValue', markdown)
  }
}

watch(() => props.modelValue, (newVal) => {
  if (newVal !== internalValue.value) {
    internalValue.value = newVal
  }
})

const textDirection = computed(() => {
  if (!internalValue.value.trim()) return 'ltr'
  const sample = internalValue.value.trim().substring(0, 100)
  const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
  return rtlRegex.test(sample) ? 'rtl' : 'ltr'
})
</script>

<style scoped>
.markdown-editor {
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-bg-soft);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 150px;
}

/* Milkdown WYSIWYG Styling */
:deep(.milkdown) {
  background: transparent !important;
  color: var(--text-primary) !important;
  box-shadow: none !important;
}

:deep(.milkdown .editor) {
  padding: 0 !important;
  outline: none !important;
  font-size: var(--text-sm);
  font-family: var(--font-sans);
  line-height: 1.6;
  color: var(--text-primary);
  min-height: 100px;
}

:deep(.milkdown .editor p) {
  margin-bottom: var(--space-2);
}

:deep(.milkdown .editor p:last-child) {
  margin-bottom: 0;
}

/* Headings */
:deep(.milkdown .editor h1),
:deep(.milkdown .editor h2),
:deep(.milkdown .editor h3) {
  margin-top: var(--space-3);
  margin-bottom: var(--space-2);
  color: var(--brand-primary);
  font-weight: var(--font-bold);
}

:deep(.milkdown .editor h1) { font-size: 1.5em; }
:deep(.milkdown .editor h2) { font-size: 1.3em; }
:deep(.milkdown .editor h3) { font-size: 1.1em; }

/* Lists */
:deep(.milkdown .editor ul),
:deep(.milkdown .editor ol) {
  padding-inline-start: 1.5rem;
  margin-bottom: var(--space-2);
}

:deep(.milkdown .editor li) {
  margin-bottom: 0.25rem;
}

/* Task List (GFM Checkboxes) */
:deep(.milkdown .editor .task-list-item) {
  list-style-type: none;
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  margin-inline-start: -1.5rem;
}

:deep(.milkdown .editor .task-list-item input[type="checkbox"]) {
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--glass-border-heavy);
  border-radius: 4px;
  background: var(--glass-bg-soft);
  cursor: pointer;
  position: relative;
  margin-top: 3px;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

:deep(.milkdown .editor .task-list-item input[type="checkbox"]:hover) {
  border-color: var(--brand-primary);
}

:deep(.milkdown .editor .task-list-item input[type="checkbox"]:checked) {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
}

:deep(.milkdown .editor .task-list-item input[type="checkbox"]:checked::after) {
  content: '';
  position: absolute;
  top: 1px;
  left: 4px;
  width: 5px;
  height: 9px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

/* Strong/Bold */
:deep(.milkdown .editor strong) {
  font-weight: var(--font-bold);
  color: var(--text-primary);
}

/* Emphasis/Italic */
:deep(.milkdown .editor em) {
  font-style: italic;
}

/* Code */
:deep(.milkdown .editor code) {
  background: var(--glass-bg-medium);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  font-family: var(--font-mono, monospace);
  font-size: 0.9em;
}

:deep(.milkdown .editor pre) {
  background: var(--glass-bg-heavy);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  overflow-x: auto;
  margin-bottom: var(--space-2);
  border: 1px solid var(--glass-border);
}

:deep(.milkdown .editor pre code) {
  background: transparent;
  padding: 0;
}

/* Blockquote */
:deep(.milkdown .editor blockquote) {
  border-inline-start: 3px solid var(--brand-primary);
  padding-inline-start: var(--space-3);
  margin-inline: 0;
  margin-bottom: var(--space-2);
  color: var(--text-muted);
  font-style: italic;
}

/* Links */
:deep(.milkdown .editor a) {
  color: var(--brand-primary);
  text-decoration: none;
}

:deep(.milkdown .editor a:hover) {
  text-decoration: underline;
}

/* Horizontal Rule */
:deep(.milkdown .editor hr) {
  border: 0;
  border-top: 1px solid var(--glass-border);
  margin: var(--space-3) 0;
}

/* RTL Support */
.markdown-editor[dir="rtl"] :deep(.editor) {
  text-align: right;
  direction: rtl;
}

.markdown-editor[dir="rtl"] :deep(.editor ul),
.markdown-editor[dir="rtl"] :deep(.editor ol) {
  padding-inline-start: 0;
  padding-inline-end: 1.5rem;
}

/* Placeholder styling when empty */
:deep(.milkdown .editor.ProseMirror-focused:empty::before),
:deep(.milkdown .editor:empty::before) {
  content: attr(data-placeholder);
  color: var(--text-muted);
  pointer-events: none;
  position: absolute;
  opacity: 0.6;
}
</style>
