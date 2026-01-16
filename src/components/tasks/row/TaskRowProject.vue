<template>
  <div class="task-row__project">
    <span
      class="project-emoji-badge"
      :class="`project-visual--${visual.type}`"
      :title="`Project: ${projectDisplayName}`"
    >
      <ProjectEmojiIcon
        v-if="visual.type === 'emoji'"
        :emoji="visual.content"
        size="xs"
      />
      <div
        v-else-if="visual.type === 'css-circle'"
        class="project-css-circle"
        :style="{ '--project-color': visual.color }"
      />
      <span v-else class="project-placeholder">–</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'

defineProps<{
  visual: any
  projectDisplayName: string
}>()
</script>

<style scoped>
.task-row__project {
  grid-area: project;
  display: flex;
  align-items: center;
  justify-content: center;
}

.project-emoji-badge {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--spring-smooth) ease;
  padding: var(--space-0_5);
  border-radius: var(--radius-full);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
}

.project-placeholder {
  color: var(--text-muted);
  font-size: var(--text-xs);
}

.project-emoji-badge:hover {
  background: var(--surface-hover);
  transform: translateY(-1px) translateZ(0);
}

.project-css-circle {
  width: var(--project-indicator-size-md, 24px);
  height: var(--project-indicator-size-md, 24px);
  border-radius: 50%;
  background: var(--project-color);
  box-shadow: var(--project-indicator-shadow-inset);
  position: relative;
  transition: all var(--spring-smooth) ease;
}

.project-emoji-badge:hover .project-css-circle {
  transform: translateZ(0) scale(1.15);
  box-shadow:
    var(--project-indicator-shadow-inset),
    0 0 16px var(--project-color),
    0 0 32px var(--project-color);
}
</style>
