<template>
  <div 
    class="markdown-content" 
    :class="{ 'rtl-aware': rtlAware }"
    :dir="calculatedDir"
    v-html="renderedHtml"
    @click="handleClick"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { parseMarkdown } from '@/utils/markdown'

interface Props {
  content: string
  rtlAware?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  content: '',
  rtlAware: true
})

const emit = defineEmits<{
  'checkbox-click': [index: number, isChecked: boolean]
}>()

const renderedHtml = computed(() => parseMarkdown(props.content))

const calculatedDir = computed(() => {
  if (!props.content.trim()) return 'auto'
  // Look for first strong directional character in the first 100 characters
  const sample = props.content.trim().substring(0, 100)
  const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
  return rtlRegex.test(sample) ? 'rtl' : 'ltr'
})

const handleClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (target.tagName === 'INPUT' && target.classList.contains('md-checkbox')) {
    event.stopPropagation()
    event.preventDefault()
    
    // Find index of this checkbox among all checkboxes in this renderer
    const allCheckboxes = (event.currentTarget as HTMLElement).querySelectorAll('.md-checkbox')
    const index = Array.from(allCheckboxes).indexOf(target)
    
    if (index !== -1) {
      emit('checkbox-click', index, (target as HTMLInputElement).checked)
    }
  }
}
</script>

<style scoped>
.markdown-content {
  line-height: 1.6;
  font-size: var(--text-sm);
  color: var(--text-primary);
  overflow-wrap: break-word;
}

.markdown-content.rtl-aware {
  width: 100%;
}

:deep(p), :deep(h1), :deep(h2), :deep(h3), :deep(h4), :deep(h5), :deep(h6) {
  width: 100%;
  margin-top: 0;
  margin-bottom: var(--space-4);
  line-height: var(--leading-relaxed);
  /* Let dir="auto" on the parent or the element itself handle alignment */
}

/* Markdown Styling */
:deep(h1), :deep(h2), :deep(h3) {
  margin-top: var(--space-4);
  margin-bottom: var(--space-2);
  font-weight: var(--font-bold);
  color: var(--text-primary);
}

:deep(h1) { font-size: 1.4rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.3rem; }
:deep(h2) { font-size: 1.2rem; }
:deep(h3) { font-size: 1.1rem; }

:deep(p) {
  margin-bottom: var(--space-3);
}

:deep(ul), :deep(ol) {
  padding-inline-start: 1.5rem;
  margin-bottom: var(--space-3);
}

:deep(li) {
  margin-bottom: 0.25rem;
  position: relative;
}

/* GFM Task List Styling */
:deep(li.task-list-item) {
  list-style-type: none;
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  margin-inline-start: -1.5rem; /* Counteract parent padding for task items */
  padding-inline-start: 0.5rem;
}

:deep(ul.task-list) {
  list-style-type: none;
  padding-inline-start: 1.5rem;
}

/* Custom Checkbox Styling */
:deep(input.md-checkbox) {
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--glass-border-heavy);
  border-radius: 4px;
  background: var(--glass-bg-soft);
  cursor: pointer;
  position: relative;
  margin-top: 2px; /* Center with text line height */
  flex-shrink: 0;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: inline-block;
  vertical-align: middle;
}

:deep(input.md-checkbox:checked) {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
}

:deep(input.md-checkbox:checked::after) {
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

:deep(input.md-checkbox:hover) {
  border-color: var(--brand-primary);
  box-shadow: 0 0 8px var(--brand-primary-alpha-20);
}

:deep(code) {
  background: var(--glass-bg-medium);
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  font-family: var(--font-mono, monospace);
  font-size: 0.9em;
}

:deep(pre) {
  background: var(--glass-bg-heavy);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  overflow-x: auto;
  margin-bottom: var(--space-3);
  border: 1px solid var(--glass-border);
}

:deep(pre code) {
  background: transparent;
  padding: 0;
}

:deep(blockquote) {
  border-inline-start: 4px solid var(--brand-primary);
  padding-inline-start: var(--space-3);
  margin-inline: 0;
  margin-bottom: var(--space-3);
  color: var(--text-muted);
  font-style: italic;
}

:deep(hr) {
  border: 0;
  border-top: 1px solid var(--border-subtle);
  margin: var(--space-4) 0;
}

:deep(a) {
  color: var(--brand-primary);
  text-decoration: none;
}

:deep(a:hover) {
  text-decoration: underline;
}

:deep(img) {
  max-width: 100%;
  border-radius: var(--radius-md);
}

/* Checkbox lists */
:deep(ul li input[type="checkbox"]) {
  margin-inline-end: 0.5rem;
  vertical-align: middle;
}
</style>
