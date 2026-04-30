<template>
  <div class="parent-task-node" :class="[`priority-${data.priority || 'none'}`]" dir="rtl">
    <Handle type="source" :position="Position.Top" id="top" />
    <Handle type="source" :position="Position.Right" id="right" />
    <Handle type="source" :position="Position.Bottom" id="bottom" />
    <Handle type="source" :position="Position.Left" id="left" />

    <div class="parent-status" :class="data.status">
      {{ data.status === 'done' ? 'Done' : 'Active' }}
    </div>

    <h3 class="parent-title" dir="auto">{{ data.title }}</h3>

    <p v-if="data.description" class="parent-description" dir="auto">
      {{ truncatedDescription }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

interface Props {
  data: {
    title: string
    description: string
    status: string
    priority: string | null
    taskId: string
  }
}

const props = defineProps<Props>()

const truncatedDescription = computed(() => {
  const desc = props.data.description || ''
  return desc.length > 120 ? desc.substring(0, 120) + '...' : desc
})
</script>

<style scoped>
.parent-task-node {
  background: var(--glass-bg-medium, rgba(30, 30, 40, 0.8));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 2px solid var(--brand-primary, #4ECDC4);
  border-radius: var(--radius-xl, 16px);
  padding: var(--space-4, 16px) var(--space-5, 20px);
  min-width: 240px;
  max-width: 360px;
  box-shadow: 0 0 30px rgba(78, 205, 196, 0.15), 0 4px 20px rgba(0, 0, 0, 0.3);
  text-align: center;
}

.parent-task-node.priority-high {
  border-color: #ef4444;
  box-shadow: 0 0 30px rgba(239, 68, 68, 0.15), 0 4px 20px rgba(0, 0, 0, 0.3);
}

.parent-task-node.priority-medium {
  border-color: #f59e0b;
  box-shadow: 0 0 30px rgba(245, 158, 11, 0.15), 0 4px 20px rgba(0, 0, 0, 0.3);
}

.parent-status {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 2px 8px;
  border-radius: 999px;
  display: inline-block;
  margin-bottom: var(--space-2, 8px);
  color: var(--brand-primary, #4ECDC4);
  background: rgba(78, 205, 196, 0.1);
  border: 1px solid rgba(78, 205, 196, 0.2);
}

.parent-status.done {
  color: var(--text-muted, #888);
  background: rgba(128, 128, 128, 0.1);
  border-color: rgba(128, 128, 128, 0.2);
}

.parent-title {
  font-size: var(--text-base, 16px);
  font-weight: var(--font-semibold, 600);
  color: var(--text-primary, #fff);
  margin: 0 0 var(--space-1, 4px);
  line-height: 1.3;
}

.parent-description {
  font-size: var(--text-xs, 12px);
  color: var(--text-muted, #888);
  margin: 0;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}
</style>
