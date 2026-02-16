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
        <ProjectEmojiIcon v-if="project.emoji" :emoji="project.emoji" size="xs" />
        <div v-else class="project-color-dot" :style="{ backgroundColor: Array.isArray(project.color) ? project.color[0] : (project.color || '#6B7280') }" />
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
    <div v-if="projectGroups.length === 0" class="empty-state">
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
import { ref, computed, watch } from 'vue'
import type { Task } from '@/stores/tasks'
import { useTaskStore } from '@/stores/tasks'
import HierarchicalTaskRow from '@/components/tasks/HierarchicalTaskRow.vue'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'
import { Inbox, ChevronRight } from 'lucide-vue-next'

interface Props {
  tasks: Task[]
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

const taskStore = useTaskStore()

// Expand/collapse state
const expandedTasks = ref<Set<string>>(new Set())
const expandedProjects = ref<Set<string>>(new Set())
const selectedTaskIds = ref<string[]>([])

// Group tasks by project
const projectGroups = computed(() => {
  const groups = new Map<string, Task[]>()

  props.tasks.forEach(task => {
    const projectId = task.projectId || '' // Use empty string for uncategorized tasks
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
      name: project?.name || 'Uncategorized',
      emoji: project?.emoji,
      color: project?.color,
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

// BUG-FIX: Watch for new groups and auto-expand them (e.g. when creating first task in a project)

watch(projectGroups, (newGroups, oldGroups) => {
  const oldIds = new Set(oldGroups?.map(g => g.id) || [])
  newGroups.forEach(group => {
    if (!oldIds.has(group.id)) {
      expandedProjects.value.add(group.id)
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
  gap: var(--space-2); /* ADHD: Small gap between groups */
  background: transparent; /* Remove container background - groups have their own */
  border: none; /* Remove container border - groups are self-contained */
  border-radius: 0;
  padding: var(--space-2); /* Inner breathing room */
  /* Parent container handles scrolling - don't create nested scroll */
  overflow-y: visible;
  min-height: 0; /* Critical for flex scroll */
  flex: 1;
}

/* ADHD-friendly: Visual chunking with whitespace between project groups */
.project-group {
  margin-bottom: var(--space-4); /* 16px gap between groups for breathing room */
  background: var(--glass-bg-subtle);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  overflow: hidden;
}

.project-group:last-child {
  margin-bottom: 0;
}

.project-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3); /* Increased padding for breathing room */
  background-color: var(--glass-bg-heavy); /* Slightly darker header for contrast */
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

.project-name {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-secondary);
  flex: 1;
}

.project-task-count {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.project-color-dot {
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
