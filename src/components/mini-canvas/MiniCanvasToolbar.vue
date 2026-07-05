<template>
  <div class="mini-canvas-toolbar">
    <div class="toolbar-left">
      <button
        class="toolbar-btn back-btn"
        title="Back to canvas (Esc)"
        aria-label="Back to canvas (Esc)"
        @click="$emit('close')"
      >
        <ArrowLeft :size="18" />
      </button>

      <div class="breadcrumb">
        <span class="breadcrumb-parent">Canvas</span>
        <ChevronRight :size="14" class="breadcrumb-sep" />
        <span class="breadcrumb-current" :dir="taskTitleDir">{{ taskTitle }}</span>
      </div>
    </div>

    <div class="toolbar-right">
      <button class="toolbar-btn add-btn" title="Add Subtask" @click="$emit('add-subtask')">
        <CheckSquare :size="16" />
        <span>Subtask</span>
      </button>

      <button class="toolbar-btn add-btn" title="Add Note" @click="$emit('add-note')">
        <StickyNote :size="16" />
        <span>Note</span>
      </button>

      <div class="toolbar-divider" />

      <button
        class="toolbar-btn"
        title="Fit View"
        aria-label="Fit View"
        @click="$emit('fit-view')"
      >
        <Maximize2 :size="16" />
      </button>

      <button
        class="toolbar-btn toggle-btn"
        :class="{ active: hideCompleted }"
        title="Toggle completed subtasks"
        aria-label="Toggle completed subtasks"
        :aria-pressed="hideCompleted"
        @click="$emit('toggle-completed')"
      >
        <EyeOff v-if="hideCompleted" :size="16" />
        <Eye v-else :size="16" />
      </button>

      <div class="toolbar-divider" />

      <button class="toolbar-btn" title="Edit Task Details" @click="$emit('edit-task')">
        <Pencil :size="16" />
        <span>Edit Task</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeft, ChevronRight, CheckSquare, StickyNote, Eye, EyeOff, Maximize2, Pencil } from 'lucide-vue-next'

interface Props {
  taskTitle: string
  hideCompleted?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  hideCompleted: false,
})

defineEmits<{
  close: []
  'add-subtask': []
  'add-note': []
  'toggle-completed': []
  'fit-view': []
  'edit-task': []
}>()

const taskTitleDir = computed(() => {
  const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF]/
  return rtlRegex.test(props.taskTitle) ? 'rtl' : 'ltr'
})
</script>

<style scoped>
.mini-canvas-toolbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-4);
  background: var(--overlay-component-bg);
  backdrop-filter: blur(var(--blur-lg));
  -webkit-backdrop-filter: blur(var(--blur-lg));
  border-bottom: 1px solid var(--glass-border);
  z-index: 10;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.toolbar-btn:hover {
  background: var(--surface-hover);
  border-color: var(--glass-border-hover);
}

.back-btn {
  padding: var(--space-2);
}

.add-btn {
  color: var(--brand-primary);
  border-color: var(--brand-primary-alpha-30);
}

.add-btn:hover {
  background: var(--brand-primary-alpha-10);
  border-color: var(--brand-primary);
}

.toggle-btn.active {
  color: var(--text-muted);
  background: var(--glass-bg-medium);
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-sm);
}

.breadcrumb-parent {
  color: var(--text-muted);
}

.breadcrumb-sep {
  color: var(--text-muted);
  opacity: 0.5;
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: var(--glass-border);
  margin: 0 var(--space-1);
}

.breadcrumb-current {
  color: var(--text-primary);
  font-weight: var(--font-medium);
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
