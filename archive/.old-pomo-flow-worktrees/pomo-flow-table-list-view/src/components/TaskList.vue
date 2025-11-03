<template>
  <div class="task-list">
    <!-- Group by Projects -->
    <div v-for="project in projectGroups" :key="project.id" class="project-group">
      <!-- Project Header -->
      <div class="project-header" @click="toggleProjectExpand(project.id)">
        <ChevronRight
          :size="16"
          class="project-expand-icon"
          :class="{ 'project-expand-icon--expanded': expandedProjects.has(project.id) }"
        />
        <span class="project-emoji">{{ project.emoji || '📁' }}</span>
        <span class="project-name">{{ project.name }}</span>
        <span class="project-task-count">{{ project.tasks.length }}</span>
      </div>

      <!-- Project Tasks (only parent tasks, subtasks rendered recursively) -->
      <template v-if="expandedProjects.has(project.id)">
        <HierarchicalTaskRow
          v-for="task in project.parentTasks"
          :key="task.id"
          :task="task"
          :indent-level="0"
          :selected="isSelected(task.id)"
          :expanded-tasks="expandedTasks"
          :multi-select-mode="multiSelectMode"
          @select="$emit('select', $event)"
          @toggleSelect="() => handleClick(task.id)"
          @toggleComplete="$emit('toggleComplete', $event)"
          @startTimer="$emit('startTimer', $event)"
          @edit="$emit('edit', $event)"
          @contextMenu="handleContextMenu"
          @toggleExpand="toggleTaskExpand"
          @moveTask="handleMoveTask"
        />
      </template>
    </div>

    <!-- Empty State -->
    <div v-if="projectGroups.length === 0" class="empty-state">
      <Inbox :size="48" class="empty-icon" />
      <p class="empty-title">No tasks found</p>
      <p class="empty-description">
        {{ emptyMessage || 'Create your first task to get started' }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Task } from '@/stores/tasks'
import { useTaskStore } from '@/stores/tasks'
import HierarchicalTaskRow from '@/components/HierarchicalTaskRow.vue'
import { Inbox, ChevronRight } from 'lucide-vue-next'
import { useMultiSelect } from '@/composables/useMultiSelect'

interface Props {
  tasks: Task[]
  emptyMessage?: string
  multiSelectMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  multiSelectMode: false
})

const emit = defineEmits<{
  select: [taskId: string]
  toggleComplete: [taskId: string]
  startTimer: [taskId: string]
  edit: [taskId: string]
  contextMenu: [event: MouseEvent, task: Task]
  moveTask: [taskId: string, targetProjectId: string | null, targetParentId: string | null]
  selectionChange: [selectedIds: string[]]
}>()

const taskStore = useTaskStore()

// Multi-select functionality
const {
  selectedIds,
  selectedCount,
  isSelected,
  selectAll,
  clearSelection,
  invertSelection,
  handleClick
} = useMultiSelect({
  items: computed(() => props.tasks),
  getItemId: (task: Task) => task.id,
  onSelectionChange: (ids: string[]) => {
    emit('selectionChange', ids)
  },
  enableKeyboardShortcuts: true
})

// Expand/collapse state
const expandedTasks = ref<Set<string>>(new Set())
const expandedProjects = ref<Set<string>>(new Set())

// Group tasks by project
const projectGroups = computed(() => {
  const groups = new Map<string, Task[]>()

  props.tasks.forEach(task => {
    const projectId = task.projectId || '1'
    if (!groups.has(projectId)) {
      groups.set(projectId, [])
    }
    groups.get(projectId)!.push(task)
  })

  return Array.from(groups.entries()).map(([projectId, tasks]) => {
    const project = taskStore.projects.find(p => p.id === projectId)
    // Filter to only show parent tasks (tasks without parentTaskId)
    const parentTasks = tasks.filter(t => !t.parentTaskId)

    return {
      id: projectId,
      name: project?.name || 'Unknown Project',
      emoji: project?.emoji,
      tasks: tasks,
      parentTasks: parentTasks
    }
  })
})

const toggleTaskExpand = (taskId: string) => {
  if (expandedTasks.value.has(taskId)) {
    expandedTasks.value.delete(taskId)
  } else {
    expandedTasks.value.add(taskId)
  }
}

const toggleProjectExpand = (projectId: string) => {
  if (expandedProjects.value.has(projectId)) {
    expandedProjects.value.delete(projectId)
  } else {
    expandedProjects.value.add(projectId)
  }
}

// Expand/collapse all functionality
const expandAll = () => {
  // Expand all projects
  projectGroups.value.forEach(group => {
    expandedProjects.value.add(group.id)
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
  expandedProjects.value.clear()
}

// Context menu handler
const handleContextMenu = (event: MouseEvent, task: Task) => {
  emit('contextMenu', event, task)
}

// Drag and drop handler
const handleMoveTask = (taskId: string, targetProjectId: string | null, targetParentId: string | null) => {
  emit('moveTask', taskId, targetProjectId, targetParentId)
}

// Initialize with all projects expanded by default
expandedProjects.value = new Set(projectGroups.value.map(g => g.id))

// Expose methods for parent component
defineExpose({
  expandAll,
  collapseAll,
  selectedIds: computed(() => selectedIds.value),
  selectedCount,
  clearSelection
})
</script>

<style scoped>
.task-list {
  display: flex;
  flex-direction: column;
  background-color: var(--surface-secondary);
  border-radius: var(--radius-lg);
  overflow: hidden;
  contain: layout style; /* Performance optimization */
}

.project-group {
  border-bottom: 1px solid var(--border-subtle);
}

.project-group:last-child {
  border-bottom: none;
}

.project-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background-color: var(--surface-tertiary);
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: background-color var(--duration-fast) ease;
}

.project-header:hover {
  background-color: var(--surface-hover);
}

.project-expand-icon {
  color: var(--text-tertiary);
  transition: transform var(--duration-fast) ease;
  flex-shrink: 0;
}

.project-expand-icon--expanded {
  transform: rotate(90deg);
}

.project-emoji {
  font-size: var(--text-base);
  flex-shrink: 0;
}

.project-name {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}

.project-task-count {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  background-color: var(--surface-secondary);
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  min-width: 24px;
  text-align: center;
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
