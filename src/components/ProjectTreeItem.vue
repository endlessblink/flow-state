<template>
  <div
    class="project-tree-item"
    :style="{ '--nesting-depth': nestingDepth }"
    role="treeitem"
    :aria-expanded="hasChildren ? isExpanded : undefined"
    :aria-level="level"
    :aria-selected="taskStore.activeProjectId === project.id"
    :aria-label="project.name"
    :id="`project-${project.id}`"
    tabindex="-1"
  >
    <!-- The project itself -->
    <BaseNavItem
      :active="taskStore.activeProjectId === project.id"
      :project-id="project.id"
      :has-children="hasChildren"
      :expanded="isExpanded"
      :color-dot="project.color"
      :color-type="project.colorType"
      :emoji="project.emoji"
      :count="getProjectTaskCount(project.id)"
      :nested="nested"
      :style="{ '--nesting-indent': `${nestingDepth * 20}px` }"
      :aria-expanded="hasChildren ? isExpanded : undefined"
      :aria-level="level"
      :tabindex="taskStore.activeProjectId === project.id ? 0 : -1"
      @click="handleProjectClick(project)"
      @toggle-expand="toggleExpand"
      @contextmenu.prevent="$emit('contextmenu', $event, project)"
      @project-drop="$emit('project-drop', $event)"
    >
      {{ project.name }}
    </BaseNavItem>

    <!-- Recursively render children if expanded -->
    <Transition
      name="nested-projects"
      tag="div"
      class="nested-children-transition"
    >
      <div
        v-if="hasChildren && isExpanded"
        class="nested-children"
        role="group"
        :style="{ '--nesting-indent': `${(nestingDepth + 1) * 20}px` }"
      >
        <ProjectTreeItem
          v-for="child in children"
          :key="child.id"
          :project="child"
          :expanded-projects="expandedProjects"
          :nested="true"
          :nesting-depth="nestingDepth + 1"
          :level="level + 1"
          @click="(project) => $emit('click', project)"
          @toggle-expand="(projectId) => $emit('toggle-expand', projectId)"
          @contextmenu="(event, project) => $emit('contextmenu', event, project)"
          @project-drop="(data) => $emit('project-drop', data)"
        />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTaskStore, type Project } from '@/stores/tasks'
import BaseNavItem from './base/BaseNavItem.vue'

interface Props {
  project: Project
  expandedProjects: string[]
  nested?: boolean
  nestingDepth?: number
  level?: number
}

const props = withDefaults(defineProps<Props>(), {
  nested: false,
  nestingDepth: 0,
  level: 1
})

const emit = defineEmits<{
  click: [project: Project]
  'toggle-expand': [projectId: string]
  contextmenu: [event: MouseEvent, project: Project]
  'project-drop': [data: any]
}>()

const taskStore = useTaskStore()

// Check if this project has children
const hasChildren = computed(() => {
  return taskStore.projects.some(p => p.parentId === props.project.id)
})

// Check if this project is expanded
const isExpanded = computed(() => {
  return props.expandedProjects.includes(props.project.id)
})

// Get children of this project
const children = computed(() => {
  return taskStore.projects.filter(p => p.parentId === props.project.id)
})

// Toggle expansion
const toggleExpand = () => {
  emit('toggle-expand', props.project.id)
}

// Handle project click - emit event and set as active project
const handleProjectClick = (project: Project) => {
  emit('click', project)
  taskStore.setActiveProject(project.id)
}

// Recursively count tasks in this project and all descendants (matches BoardView filtering logic)
const getProjectTaskCount = (projectId: string): number => {
  // Get all child projects (same logic as filteredTasks)
  const getChildProjectIds = (pid: string): string[] => {
    const ids = [pid]
    const children = taskStore.projects.filter(p => p.parentId === pid)
    children.forEach(child => {
      ids.push(...getChildProjectIds(child.id))
    })
    return ids
  }

  // Get all child project IDs for this project tree
  const allChildProjectIds = getChildProjectIds(projectId)

  // Count tasks that belong to this project tree (excluding done tasks globally)
  const projectTasks = taskStore.tasks.filter(task => {
    // Only count tasks that belong to this project tree
    if (!allChildProjectIds.includes(task.projectId)) return false

    // CRITICAL: Counters should NEVER show done tasks, regardless of settings
    if (task.status === 'done') return false

    return true
  })

  return projectTasks.length
}
</script>

<style scoped>
.project-tree-item {
  display: flex;
  flex-direction: column;
}

.nested-children {
  /* Dynamic indentation based on nesting level */
  padding-left: calc(var(--nesting-indent, 20px) + var(--space-2));
  margin-top: var(--space-1);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  position: relative;
}

/* Add visual connection lines for nested projects */
.nested-children::before {
  content: '';
  position: absolute;
  left: calc(var(--nesting-indent, 20px) / 2);
  top: 0;
  bottom: calc(var(--space-1) / 2);
  width: 1px;
  background: var(--border-subtle);
  opacity: 0.5;
}

/* Smooth expand/collapse animations for nested children */
.nested-children {
  overflow: hidden;
  transition:
    max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Animation states handled by Vue's Transition component will override these */

/* Vue Transition for nested projects expand/collapse */
.nested-projects-enter-active,
.nested-projects-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.nested-projects-enter-from {
  opacity: 0;
  max-height: 0;
  transform: scaleY(0) translateY(-8px);
}

.nested-projects-leave-to {
  opacity: 0;
  max-height: 0;
  transform: scaleY(0) translateY(-8px);
}

.nested-projects-enter-to,
.nested-projects-leave-from {
  opacity: 1;
  max-height: 500px; /* Sufficient height for typical nested projects */
  transform: scaleY(1) translateY(0);
}

/* Container for the transition to ensure proper layout */
.nested-children-transition {
  display: contents;
}
</style>
