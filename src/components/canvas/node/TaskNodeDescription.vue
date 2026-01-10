<template>
  <div class="task-description" :class="alignmentClasses">
    <MarkdownRenderer
      :content="description || ''"
      :class="{ 'expanded': isExpanded || !isLong }"
      @checkbox-click="$emit('checkbox-click', $event)"
    />
    <button
      v-if="isLong"
      class="description-toggle"
      :aria-expanded="isExpanded"
      aria-label="Show more description"
      @click.stop="$emit('toggle-expand')"
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
  alignmentClasses: string
}>()

defineEmits<{
  (e: 'checkbox-click', index: number): void
  (e: 'toggle-expand'): void
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
</style>
