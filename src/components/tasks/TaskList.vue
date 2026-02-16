<template>
  <div class="task-list">
    <!-- TASK-1334: Grouped rendering with sticky headers -->
    <div v-for="group in groups" :key="group.key" class="task-group" :class="{ 'task-group--indented': (group.indent || 0) > 0 }">
      <!-- Sticky Group Header -->
      <div
        v-if="groupBy !== 'none'"
        class="group-header"
        :style="(group.indent || 0) > 0 ? { paddingLeft: `${12 + (group.indent || 0) * 24}px` } : undefined"
        @click="toggleGroupExpand(group.key)"
      >
        <ChevronRight
          :size="16"
          class="group-expand-icon"
          :class="{ 'group-expand-icon--expanded': expandedGroups.has(group.key) }"
        />
        <ProjectEmojiIcon v-if="group.emoji" :emoji="group.emoji" size="xs" />
        <div v-else-if="group.color" class="group-color-dot" :style="{ backgroundColor: Array.isArray(group.color) ? group.color[0] : (group.color || '#6B7280') }" />
        <span class="group-name">{{ group.title }}</span>
        <span class="group-task-count">{{ group.tasks.length }}</span>
      </div>

      <!-- Group Tasks (only parent tasks, subtasks rendered recursively) -->
      <template v-if="groupBy === 'none' || expandedGroups.has(group.key)">
        <HierarchicalTaskRow
          v-for="task in group.parentTasks"
          :key="task.id"
          :task="task"
          :indent-level="0"
          :selected="selectedTaskIds.includes(task.id)"
          :expanded-tasks="expandedTasks"
          @select="$emit('select', $event)"
          @toggle-complete="$emit('toggleComplete', $event)"
          @start-timer="$emit('startTimer', $event)"
          @edit="$emit('edit', $event)"
          @context-menu="handleContextMenu"
          @toggle-expand="toggleTaskExpand"
          @move-task="handleMoveTask"
          @update-task="(taskId: string, updates: Partial<Task>) => $emit('updateTask', taskId, updates)"
        />
      </template>
    </div>

    <!-- Empty State -->
    <div v-if="groups.length === 0" class="empty-state">
      <Inbox :size="48" class="empty-icon" />
      <p class="empty-title">
        No tasks found
      </p>
      <p class="empty-description">
        {{ emptyMessage || 'Create your first task to get started' }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Task, TaskGroup } from '@/types/tasks'
import HierarchicalTaskRow from '@/components/tasks/HierarchicalTaskRow.vue'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'
import { Inbox, ChevronRight } from 'lucide-vue-next'

interface Props {
  tasks: Task[]
  groups: TaskGroup[]
  groupBy: string
  emptyMessage?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [taskId: string]
  toggleComplete: [taskId: string]
  startTimer: [taskId: string]
  edit: [taskId: string]
  contextMenu: [event: MouseEvent, task: Task]
  moveTask: [taskId: string, targetProjectId: string | null, targetParentId: string | null]
  updateTask: [taskId: string, updates: Partial<Task>]
}>()

// Expand/collapse state
const expandedTasks = ref<Set<string>>(new Set())
const expandedGroups = ref<Set<string>>(new Set())
const selectedTaskIds = ref<string[]>([])

const toggleTaskExpand = (taskId: string) => {
  if (expandedTasks.value.has(taskId)) {
    expandedTasks.value.delete(taskId)
  } else {
    expandedTasks.value.add(taskId)
  }
}

const toggleGroupExpand = (groupKey: string) => {
  if (expandedGroups.value.has(groupKey)) {
    expandedGroups.value.delete(groupKey)
  } else {
    expandedGroups.value.add(groupKey)
  }
}

// Expand/collapse all functionality
const expandAll = () => {
  // Expand all groups
  props.groups.forEach(group => {
    expandedGroups.value.add(group.key)
  })

  // Expand all tasks with subtasks
  props.tasks.forEach(task => {
    if (task.subtasks && task.subtasks.length > 0) {
      expandedTasks.value.add(task.id)
    }
  })
}

const collapseAll = () => {
  expandedTasks.value.clear()
  expandedGroups.value.clear()
}

// Context menu handler
const handleContextMenu = (event: MouseEvent, task: Task) => {
  emit('contextMenu', event, task)
}

// Drag and drop handler
const handleMoveTask = (taskId: string, targetProjectId: string | null, targetParentId: string | null) => {
  emit('moveTask', taskId, targetProjectId, targetParentId)
}

// Initialize with all groups expanded by default
expandedGroups.value = new Set(props.groups.map(g => g.key))

// Auto-expand new groups when they appear
watch(() => props.groups, (newGroups, oldGroups) => {
  const oldKeys = new Set(oldGroups?.map(g => g.key) || [])
  newGroups.forEach(group => {
    if (!oldKeys.has(group.key)) {
      expandedGroups.value.add(group.key)
    }
  })
}, { deep: true })

// Expose methods for parent component
defineExpose({
  expandAll,
  collapseAll
})
</script>

<style scoped>
.task-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  background: transparent;
  border: none;
  border-radius: 0;
  padding: var(--space-2);
  overflow-y: visible;
  min-height: 0;
  flex: 1;
}

/* TASK-1334: Group containers */
.task-group {
  margin-bottom: var(--space-4);
  background: var(--glass-bg-subtle);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  /* No overflow:hidden — TaskRowDueDate dropdown uses position:absolute */
}

.task-group--indented {
  margin-left: var(--space-6);
  margin-bottom: var(--space-2);
}

.task-group:last-child {
  margin-bottom: 0;
}

/* TASK-1334: Sticky group header */
.group-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background-color: var(--glass-bg-heavy);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: background-color var(--duration-fast) ease;
  position: sticky;
  top: 0;
  z-index: 2;
}

.group-header:hover {
  background-color: var(--surface-hover);
}

.group-expand-icon {
  color: var(--text-tertiary);
  transition: transform var(--duration-fast) ease;
  flex-shrink: 0;
}

.group-expand-icon--expanded {
  transform: rotate(90deg);
}

.group-name {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-secondary);
  flex: 1;
}

.group-task-count {
  font-size: var(--text-xs);
  color: var(--text-muted);
  background: var(--glass-bg-soft);
  padding: 0 var(--space-1_5);
  border-radius: var(--radius-full);
  min-width: 20px;
  text-align: center;
}

.group-color-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12) var(--space-6);
  text-align: center;
}

.empty-icon {
  color: var(--text-tertiary);
  margin-bottom: var(--space-4);
}

.empty-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-2) 0;
}

.empty-description {
  font-size: var(--text-base);
  color: var(--text-secondary);
  margin: 0;
}
</style>
