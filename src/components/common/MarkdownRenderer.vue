<template>
  <div 
    class="markdown-content" 
    :class="{ 'rtl-aware': rtlAware }"
    v-html="renderedHtml"
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

const renderedHtml = computed(() => parseMarkdown(props.content))
</script>

<style scoped>
.markdown-content {
  line-height: 1.6;
  font-size: var(--text-sm);
  color: var(--text-primary);
  overflow-wrap: break-word;
}

.markdown-content.rtl-aware {
  unicode-bidi: plaintext;
  text-align: start;
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
