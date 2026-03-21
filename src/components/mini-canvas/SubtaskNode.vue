<template>
  <div
    class="subtask-node"
    :class="{ completed: data.isCompleted }"
  >
    <Handle type="target" :position="Position.Top" />
    <Handle type="source" :position="Position.Bottom" />

    <div class="subtask-header">
      <button
        class="subtask-checkbox"
        :class="{ checked: data.isCompleted }"
        @click.stop="$emit('toggle-complete', data.subtaskId)"
      >
        <Check v-if="data.isCompleted" :size="12" />
      </button>

      <input
        ref="titleInput"
        class="subtask-title"
        :class="{ completed: data.isCompleted }"
        :value="data.title"
        placeholder="Subtask title..."
        @blur="handleTitleBlur"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      />
    </div>

    <div v-if="data.description" class="subtask-description">
      {{ data.description }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { Check } from 'lucide-vue-next'

interface Props {
  data: {
    title: string
    description: string
    isCompleted: boolean
    subtaskId: string
  }
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'toggle-complete': [subtaskId: string]
  'update-title': [subtaskId: string, title: string]
}>()

const titleInput = ref<HTMLInputElement | null>(null)

const handleTitleBlur = (e: FocusEvent) => {
  const value = (e.target as HTMLInputElement).value.trim()
  if (value && value !== props.data.title) {
    emit('update-title', props.data.subtaskId, value)
  }
}
</script>

<style scoped>
.subtask-node {
  background: var(--glass-bg-soft);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
  min-width: 180px;
  max-width: 280px;
  transition: all var(--duration-normal) var(--ease-out);
  cursor: grab;
}

.subtask-node:hover {
  border-color: var(--brand-primary);
  box-shadow: 0 0 12px var(--brand-primary-alpha-20);
}

.subtask-node.completed {
  opacity: 0.6;
}

.subtask-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.subtask-checkbox {
  width: 18px;
  height: 18px;
  border: 1.5px solid var(--glass-border-strong);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-soft);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all var(--duration-fast) var(--ease-out);
  color: white;
  padding: 0;
}

.subtask-checkbox:hover {
  border-color: var(--brand-primary);
}

.subtask-checkbox.checked {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
}

.subtask-title {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  line-height: 1.4;
  padding: var(--space-1) 0;
}

.subtask-title.completed {
  text-decoration: line-through;
  color: var(--text-muted);
}

.subtask-title::placeholder {
  color: var(--text-muted);
}

.subtask-description {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin-top: var(--space-1);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
</style>
