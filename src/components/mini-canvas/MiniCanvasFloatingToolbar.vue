<template>
  <NodeToolbar
    v-if="nodeId"
    :node-id="nodeId"
    :is-visible="isVisible"
    :position="Position.Top"
    :offset="8"
  >
    <div
      class="mini-canvas-floating-toolbar"
      role="toolbar"
      aria-label="Selected node actions"
      @click.stop
      @pointerdown.stop
    >
      <BaseIconButton
        v-if="nodeType === 'subtaskNode'"
        size="sm"
        :variant="isCompleted ? 'success' : 'default'"
        :active="isCompleted"
        :title="isCompleted ? 'Mark incomplete' : 'Mark complete'"
        :aria-label="isCompleted ? 'Mark incomplete' : 'Mark complete'"
        @click="$emit('toggle-complete')"
      >
        <Check :size="14" />
      </BaseIconButton>

      <BaseIconButton
        size="sm"
        title="Edit"
        aria-label="Edit"
        @click="$emit('edit')"
      >
        <Pencil :size="14" />
      </BaseIconButton>

      <BaseIconButton
        size="sm"
        title="Add child"
        aria-label="Add child node"
        @click="$emit('add-child')"
      >
        <Plus :size="14" />
      </BaseIconButton>

      <BaseIconButton
        size="sm"
        variant="danger"
        title="Delete"
        aria-label="Delete"
        @click="$emit('delete')"
      >
        <Trash2 :size="14" />
      </BaseIconButton>
    </div>
  </NodeToolbar>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NodeToolbar } from '@vue-flow/node-toolbar'
import { Position } from '@vue-flow/core'
import { Check, Pencil, Plus, Trash2 } from 'lucide-vue-next'
import BaseIconButton from '@/components/base/BaseIconButton.vue'

interface Props {
  nodeId: string | null
  nodeType: 'subtaskNode' | 'noteNode' | null
  isCompleted?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isCompleted: false,
})

defineEmits<{
  edit: []
  delete: []
  'add-child': []
  'toggle-complete': []
}>()

const isVisible = computed(() => props.nodeId !== null && props.nodeType !== null)
</script>

<style scoped>
.mini-canvas-floating-toolbar {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background: rgba(22, 22, 30, 0.95);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}

@media (prefers-reduced-motion: no-preference) {
  .mini-canvas-floating-toolbar {
    animation: mini-toolbar-in 120ms cubic-bezier(0.16, 1, 0.3, 1);
  }
}

@keyframes mini-toolbar-in {
  from { opacity: 0; transform: translateY(2px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
