<script setup lang="ts">
defineProps<{
  title: string
  taskId: string
}>()

const emit = defineEmits<{
  select: [taskId: string, title: string]
}>()

function handleClick(taskId: string, title: string) {
  emit('select', taskId, title)
}
</script>

<template>
  <button
    class="suggestion-chip"
    type="button"
    :title="title"
    @click="handleClick(taskId, title)"
  >
    {{ title }}
  </button>
</template>

<style scoped>
.suggestion-chip {
  display: inline-block;
  max-width: 180px;
  padding: var(--space-1) var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: 9999px;
  color: var(--text-secondary);
  font-size: 0.75rem;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition:
    border-color var(--duration-normal) var(--ease-out),
    color var(--duration-normal) var(--ease-out),
    background var(--duration-normal) var(--ease-out);
  backdrop-filter: blur(8px);
  flex-shrink: 0;
}

.suggestion-chip:hover {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  background: rgba(45, 212, 191, 0.06);
}

.suggestion-chip:active {
  transform: scale(0.97);
}
</style>
