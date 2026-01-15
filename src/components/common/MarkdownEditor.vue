<template>
  <div class="markdown-editor" :dir="textDirection">
    <TiptapEditor
      :model-value="internalValue"
      :text-direction="textDirection"
      @update:model-value="handleInternalUpdate"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import TiptapEditor from './TiptapEditor.vue'

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

// Debounced RTL detection - avoids running regex on every keystroke
// 300ms delay provides buffer without noticeable layout delay
const textDirection = ref<'ltr' | 'rtl'>('ltr')
const updateTextDirection = useDebounceFn((content: string) => {
  if (!content.trim()) {
    textDirection.value = 'ltr'
    return
  }
  const sample = content.trim().substring(0, 100)
  const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
  textDirection.value = rtlRegex.test(sample) ? 'rtl' : 'ltr'
}, 300)

// Watch internal value for RTL detection
watch(internalValue, updateTextDirection, { immediate: true })
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

/* Tiptap WYSIWYG Styling */
:deep(.tiptap) {
  font-size: var(--text-sm);
  font-family: var(--font-sans);
  line-height: 1.6;
  color: var(--text-primary);
  min-height: 100px;
}

:deep(.tiptap p) {
  margin-bottom: var(--space-2);
}

:deep(.tiptap p:last-child) {
  margin-bottom: 0;
}

/* Headings */
:deep(.tiptap h1),
:deep(.tiptap h2),
:deep(.tiptap h3) {
  margin-top: var(--space-3);
  margin-bottom: var(--space-2);
  color: var(--brand-primary);
  font-weight: var(--font-bold);
}

:deep(.tiptap h1) { font-size: 1.5em; }
:deep(.tiptap h2) { font-size: 1.3em; }
:deep(.tiptap h3) { font-size: 1.1em; }

/* Lists */
:deep(.tiptap ul),
:deep(.tiptap ol) {
  padding-inline-start: var(--space-6);
  margin-bottom: var(--space-2);
}

:deep(.tiptap li) {
  margin-bottom: var(--space-1);
}

/* Task List */
:deep(.tiptap ul[data-type="taskList"]) {
  list-style-type: none;
  padding-inline-start: 0;
}

:deep(.tiptap ul[data-type="taskList"] li) {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

:deep(.tiptap ul[data-type="taskList"] li > label) {
  flex-shrink: 0;
  margin-top: 3px;
}

:deep(.tiptap ul[data-type="taskList"] li > label input[type="checkbox"]) {
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--glass-border-heavy);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-soft);
  cursor: pointer;
  position: relative;
  transition: all var(--duration-fast) var(--ease-out);
}

:deep(.tiptap ul[data-type="taskList"] li > label input[type="checkbox"]:hover) {
  border-color: var(--brand-primary);
}

:deep(.tiptap ul[data-type="taskList"] li > label input[type="checkbox"]:checked) {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
}

:deep(.tiptap ul[data-type="taskList"] li > label input[type="checkbox"]:checked::after) {
  content: '';
  position: absolute;
  top: 1px;
  left: var(--space-1);
  width: 5px;
  height: 9px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

/* Strong/Bold */
:deep(.tiptap strong) {
  font-weight: var(--font-bold);
  color: var(--text-primary);
}

/* Emphasis/Italic */
:deep(.tiptap em) {
  font-style: italic;
}

/* Strikethrough */
:deep(.tiptap s) {
  text-decoration: line-through;
  color: var(--text-muted);
}

/* Code */
:deep(.tiptap code) {
  background: var(--glass-bg-medium);
  padding: 0.1rem 0.4rem;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono, monospace);
  font-size: 0.9em;
}

:deep(.tiptap pre) {
  background: var(--glass-bg-heavy);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  overflow-x: auto;
  margin-bottom: var(--space-2);
  border: 1px solid var(--glass-border);
}

:deep(.tiptap pre code) {
  background: transparent;
  padding: 0;
}

/* Blockquote */
:deep(.tiptap blockquote) {
  border-inline-start: 3px solid var(--brand-primary);
  padding-inline-start: var(--space-3);
  margin-inline: 0;
  margin-bottom: var(--space-2);
  color: var(--text-muted);
  font-style: italic;
}

/* Links */
:deep(.tiptap a) {
  color: var(--brand-primary);
  text-decoration: none;
}

:deep(.tiptap a:hover) {
  text-decoration: underline;
}

/* Horizontal Rule */
:deep(.tiptap hr) {
  border: 0;
  border-top: 1px solid var(--glass-border);
  margin: var(--space-3) 0;
}

/* RTL Support */
.markdown-editor[dir="rtl"] :deep(.tiptap) {
  text-align: right;
  direction: rtl;
}

.markdown-editor[dir="rtl"] :deep(.tiptap ul),
.markdown-editor[dir="rtl"] :deep(.tiptap ol) {
  padding-inline-start: 0;
  padding-inline-end: var(--space-6);
}

/* Placeholder styling when empty */
:deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  color: var(--text-muted);
  pointer-events: none;
  float: left;
  height: 0;
  opacity: 0.6;
}
</style>
