<template>
  <div
    :id="`project-${project.id}`"
    class="project-tree-item"
    :class="{ 'is-selected': isSelected }"
    :style="{ '--nesting-depth': nestingDepth }"
    role="treeitem"
    :aria-expanded="hasChildren ? isExpanded : undefined"
    :aria-level="level"
    :aria-selected="taskStore.activeProjectId === project.id || isSelected"
    :aria-label="project.name"
    tabindex="-1"
  >
    <!-- The project itself -->
    <BaseNavItem
      :active="taskStore.activeProjectId === project.id"
      :selected="isSelected"
      :project-id="project.id"
      :has-children="hasChildren"
      :expanded="isExpanded"
      :color-dot="Array.isArray(project.color) ? project.color[0] : project.color"
      :color-type="project.colorType"
      :emoji="project.emoji"
      :count="getProjectTaskCount(project.id)"
      :nested="nested"
      :style="{ '--nesting-indent': `${nestingDepth * 14}px` }"
      :aria-expanded="hasChildren ? isExpanded : undefined"
      :aria-level="level"
      :tabindex="taskStore.activeProjectId === project.id ? 0 : -1"
      @click="handleProjectClick"
      @toggle-expand="toggleExpand"
      @contextmenu.prevent="$emit('contextmenu', $event, project)"
      @project-drop="$emit('projectDrop', $event)"
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
        :style="{ '--nesting-indent': `${(nestingDepth + 1) * 14}px` }"
      >
        <ProjectTreeItem
          v-for="child in children"
          :key="child.id"
          :project="child"
          :expanded-projects="expandedProjects"
          :selected-project-ids="selectedProjectIds"
          nested
          :nesting-depth="nestingDepth + 1"
          :level="level + 1"
          @click="(event, project) => $emit('click', event, project)"
          @toggle-expand="(projectId) => $emit('toggleExpand', projectId)"
          @contextmenu="(event, project) => $emit('contextmenu', event, project)"
          @project-drop="(data) => $emit('projectDrop', data)"
        />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTaskStore, type Project } from '@/stores/tasks'
import BaseNavItem from '@/components/base/BaseNavItem.vue'

interface Props {
  project: Project
  expandedProjects: string[]
  // Allow Set, Array, or Object (for cross-tab sync compatibility)
  selectedProjectIds?: Set<string> | string[] | Record<string, any>
  nested?: boolean
  nestingDepth?: number
  level?: number
}

const props = withDefaults(defineProps<Props>(), {
  nested: false,
  nestingDepth: 0,
  level: 1,
  selectedProjectIds: () => new Set()
})

const emit = defineEmits<{
  click: [event: MouseEvent, project: Project]
  toggleExpand: [projectId: string]
  contextmenu: [event: MouseEvent, project: Project]
  projectDrop: [data: unknown]
}>()

const taskStore = useTaskStore()

// Safely convert selectedProjectIds to Set (handles cross-tab sync serialization)
// PiniaSharedState serializes Sets as plain objects, so we need to handle that
const selectedIds = computed<Set<string>>(() => {
  const raw = props.selectedProjectIds
  if (raw instanceof Set) return raw
  if (Array.isArray(raw)) return new Set(raw)
  if (raw && typeof raw === 'object') {
    // Object from JSON serialization - use keys or values
    return new Set(Object.keys(raw))
  }
  return new Set()
})

// Check if this project is selected
const isSelected = computed(() => {
  return selectedIds.value.has(props.project.id)
})

// Check if this project has children
const hasChildren = computed(() => {
  return taskStore.projects.some(p => p.parentId === props.project.id)
})

// Check if this project is expanded
const isExpanded = computed(() => {
  return Array.isArray(props.expandedProjects) && props.expandedProjects.includes(props.project.id)
})

// Get children of this project
const children = computed(() => {
  return taskStore.projects.filter(p => p.parentId === props.project.id)
})

// Toggle expansion
const toggleExpand = () => {
  emit('toggleExpand', props.project.id)
}

// Handle project click - pass event and project to parent for selection handling
const handleProjectClick = (event: MouseEvent) => {
  emit('click', event, props.project)
}

// Recursively count tasks in this project and all descendants
// TASK-243: Uses raw tasks to show accurate counts regardless of active smart view filter
const getProjectTaskCount = (projectId: string): number => {
  // Get all child projects (same logic as filteredTasks) with cycle detection
  const getChildProjectIds = (pid: string, visited = new Set<string>()): string[] => {
    if (visited.has(pid)) return []
    visited.add(pid)

    const ids = [pid]
    const children = taskStore.projects.filter(p => p.parentId === pid)
    children.forEach(child => {
      ids.push(...getChildProjectIds(child.id, visited))
    })
    return ids
  }

  // Get all child project IDs for this project tree
  const allChildProjectIds = getChildProjectIds(projectId)

  // Count tasks using raw tasks (bypasses smart view filters for accurate counts)
  const projectTasks = taskStore.rawTasks.filter(task => {
    // Only count tasks that belong to this project tree
    if (!allChildProjectIds.includes(task.projectId)) return false

    // Exclude soft-deleted tasks
    if (task._soft_deleted) return false

    // Respect hideDoneTasks setting for consistency with sidebar counts
    if (taskStore.hideDoneTasks && task.status === 'done') return false

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

.project-tree-item.is-selected :deep(.nav-item) {
  background: var(--brand-primary-alpha-15, rgba(78, 205, 196, 0.15));
  border-color: var(--brand-primary-alpha-30, rgba(78, 205, 196, 0.3));
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

/* Visual connection lines removed for cleaner Todoist-style appearance */

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
  transition: all var(--duration-slow) cubic-bezier(0.4, 0, 0.2, 1);
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
