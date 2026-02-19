<template>
  <div class="task-description" :class="alignmentClasses">
    <MarkdownRenderer
      :content="description || ''"
      :class="{ 'expanded': isExpanded || !isLong }"
      @checkbox-click="$emit('checkboxClick', $event)"
    />
    <button
      v-if="isLong"
      class="description-toggle"
      :aria-expanded="isExpanded"
      aria-label="Show more description"
      @click.stop="$emit('toggleExpand')"
    >
      {{ isExpanded ? 'Show less' : 'Show more' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import MarkdownRenderer from '@/components/common/MarkdownRenderer.vue'

defineProps<{
  description?: string
  isExpanded: boolean
  isLong: boolean
  alignmentClasses: object | string
}>()

defineEmits<{
  (e: 'checkboxClick', index: number): void
  (e: 'toggleExpand'): void
}>()
</script>

<style scoped>
.task-description {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-bottom: var(--space-3);
  line-height: 1.5;
}

.description-toggle {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: var(--text-xs);
  padding: 0;
  margin-top: var(--space-1);
  cursor: pointer;
  text-decoration: underline;
}

.description-toggle:hover {
  color: var(--text-primary);
}

/* RTL Support */
.task-description.text-right {
  text-align: right;
  direction: rtl;
}
.task-description.text-left {
  text-align: left;
  direction: ltr;
}

/* Collapsed state - limit description height */
.task-description :deep(.markdown-content) {
  max-height: 4.8em; /* ~3 lines at line-height 1.6 */
  overflow: hidden;
  transition: max-height var(--duration-normal) ease;
}

/* Expanded state - show full description */
.task-description :deep(.markdown-content.expanded) {
  max-height: none;
  overflow: visible;
}
</style>
