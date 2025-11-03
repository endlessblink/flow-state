<template>
  <div
    :class="[
      'base-nav-item',
      {
        'is-active': active,
        'is-nested': nested,
        'is-drag-target': isDragTarget,
        'is-drag-valid': isDragValid && projectId,
        'is-drag-invalid': isDragTarget && !isDragValid && isDragging && projectId
      }
    ]"
    :draggable="!!projectId"
    @click="$emit('click', $event)"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
    @dragenter="handleDragEnter"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <!-- Expand/collapse chevron for items with children -->
    <button
      v-if="hasChildren"
      class="expand-chevron"
      :class="{ expanded }"
      @click.stop="$emit('toggle-expand')"
    >
      <ChevronDown :size="14" />
    </button>
    <div v-else-if="nested" class="chevron-spacer"></div>

    <!-- Icon slot -->
    <div v-if="$slots.icon" class="nav-icon">
      <slot name="icon" />
    </div>

    <!-- Color dot or emoji (for projects) -->
    <div v-if="colorType === 'emoji' && emoji" class="project-emoji">
      {{ emoji }}
    </div>
    <div
      v-else-if="colorDot"
      class="color-dot"
      :style="{ backgroundColor: colorDot }"
    ></div>

    <!-- Label -->
    <span class="nav-label">
      <slot />
    </span>

    <!-- Count badge -->
    <BaseBadge
      v-if="count !== undefined"
      variant="count"
      size="sm"
      rounded
    >
      {{ count }}
    </BaseBadge>

    <!-- Drop target indicator removed - green highlighting is sufficient -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import BaseBadge from './BaseBadge.vue'
import { useDragAndDrop, type DragData } from '@/composables/useDragAndDrop'
import { useTaskStore } from '@/stores/tasks'

interface Props {
  active?: boolean
  nested?: boolean
  hasChildren?: boolean
  expanded?: boolean
  colorDot?: string
  colorType?: 'hex' | 'emoji'
  emoji?: string
  count?: number
  projectId?: string // For project items to enable drop zones
}

const props = withDefaults(defineProps<Props>(), {
  active: false,
  nested: false,
  hasChildren: false,
  expanded: false,
  colorType: 'hex'
})

const emit = defineEmits<{
  click: [event: MouseEvent]
  'toggle-expand': []
  'task-drop': [data: DragData]
  'project-drop': [data: DragData]
}>()

const { isDragging, dragData, isValidDrop, setDropTarget, startDrag, endDrag } = useDragAndDrop()
const taskStore = useTaskStore()

const isDragTarget = ref(false)

const isDragValid = computed(() => {
  if (!props.projectId || !dragData.value) return false

  // Special case: "__root__" project ID is for un-nesting projects
  if (props.projectId === '__root__') {
    // Only accept project drops on root (for un-nesting)
    if (dragData.value.type === 'project' && dragData.value.projectId) {
      const draggedProject = taskStore.getProjectById(dragData.value.projectId)
      // Only valid if the project currently has a parent (can be un-nested)
      return !!draggedProject?.parentId
    }
    return false
  }

  // Valid if it's a task being dropped on a project
  if (dragData.value.type === 'task' && dragData.value.taskId) {
    // CRITICAL: Don't allow dropping a task on its current project
    // This prevents confusion about which project the task belongs to
    const task = taskStore.tasks.find(t => t.id === dragData.value!.taskId)
    if (task && task.projectId === props.projectId) {
      return false // Task already in this project - not a valid move
    }

    return isValidDrop(dragData.value, 'project')
  }

  // Valid if it's a project being dropped on another project (for nesting)
  if (dragData.value.type === 'project' && dragData.value.projectId) {
    // Can't drop a project onto itself
    if (dragData.value.projectId === props.projectId) return false

    // Can't drop a parent onto its own descendant (would create circular reference)
    // Check if target is a descendant of the dragged project
    if (taskStore.isDescendantOf(props.projectId, dragData.value.projectId)) {
      return false // Target is a child/grandchild/etc of dragged project
    }

    return true
  }

  return false
})

// Get project name for drop target label
const getProjectName = () => {
  if (!props.projectId) return ''
  if (props.projectId === '__root__') return 'Root Level'
  const project = taskStore.getProjectById(props.projectId)
  return project?.name || 'Unknown Project'
}

// Drag start handler for projects
const handleDragStart = (event: DragEvent) => {
  if (!props.projectId) return

  event.stopPropagation() // Prevent parent elements from starting drag

  const project = taskStore.getProjectById(props.projectId)
  if (!project) return

  const dragData: DragData = {
    type: 'project',
    projectId: props.projectId,
    title: project.name,
    source: 'sidebar'
  }

  // Use composable for global drag state
  startDrag(dragData)

  // Still set dataTransfer for HTML5 drag-and-drop compatibility
  if (event.dataTransfer) {
    event.dataTransfer.setData('application/json', JSON.stringify(dragData))
    event.dataTransfer.effectAllowed = 'move'
  }
}

// Drag end handler
const handleDragEnd = () => {
  endDrag()
}

const handleDragEnter = (event: DragEvent) => {
  if (!props.projectId) return
  event.preventDefault()
  isDragTarget.value = true
  setDropTarget(props.projectId)
}

const handleDragOver = (event: DragEvent) => {
  if (!props.projectId) return
  event.preventDefault()

  if (isDragValid.value) {
    event.dataTransfer!.dropEffect = 'move'
  } else {
    event.dataTransfer!.dropEffect = 'none'
  }
}

const handleDragLeave = (event: DragEvent) => {
  if (!props.projectId) return
  event.preventDefault()

  // Only clear if actually leaving the element
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const x = event.clientX
  const y = event.clientY

  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
    isDragTarget.value = false
    setDropTarget(null)
  }
}

const handleDrop = (event: DragEvent) => {
  if (!props.projectId) return
  event.preventDefault()
  event.stopPropagation() // Prevent parent elements from handling drop

  isDragTarget.value = false
  setDropTarget(null)

  if (dragData.value && isDragValid.value) {
    // Handle task drop - move task to this project
    if (dragData.value.type === 'task' && dragData.value.taskId) {
      taskStore.moveTaskToProject(dragData.value.taskId, props.projectId)
      emit('task-drop', dragData.value)
    }

    // Handle project drop
    if (dragData.value.type === 'project' && dragData.value.projectId) {
      // Special case: "__root__" means un-nest the project
      if (props.projectId === '__root__') {
        // The parent component will handle this via @project-drop
        emit('project-drop', dragData.value)
      } else {
        // Regular nesting: update the dragged project's parentId
        taskStore.updateProject(dragData.value.projectId, {
          parentId: props.projectId
        })
        emit('project-drop', dragData.value)
        console.log(`Project "${dragData.value.title}" nested under project "${taskStore.getProjectById(props.projectId)?.name}"`)
      }
    }
  }
}
</script>

<style scoped>
/* Base Nav Item - Matches screenshot sidebar navigation */
.base-nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  cursor: pointer;
  /* Separate transitions to prevent white flash */
  transition:
    background-color var(--duration-slow) var(--spring-smooth),
    border-color var(--duration-slow) var(--spring-smooth),
    box-shadow var(--duration-slow) var(--spring-smooth),
    transform var(--duration-normal) var(--spring-smooth);
  position: relative;
  min-height: 40px;
  user-select: none;
  border: 1px solid transparent; /* Always have border to prevent layout shift */
}

.base-nav-item:hover {
  background: var(--surface-hover);
}

/* Active State - OUTLINED + GLASS (not filled) */
.base-nav-item.is-active {
  background: var(--state-active-bg);
  border: 1px solid var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  -webkit-backdrop-filter: var(--state-active-glass);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

/* Nested items - indented like in screenshot */
.base-nav-item.is-nested {
  padding-inline-start: var(--space-8); /* RTL: nested item indentation */
  min-height: 36px;
}

/* Expand chevron */
.expand-chevron {
  background: transparent;
  border: none;
  color: var(--text-muted);
  padding: var(--space-1);
  margin-inline-start: calc(var(--space-1) * -1); /* RTL: expand chevron alignment */
  cursor: pointer;
  transition: transform var(--duration-fast) var(--spring-bouncy),
              color var(--duration-fast);
  display: flex;
  align-items: center;
  justify-content: center;
}

.expand-chevron.expanded {
  transform: rotate(0deg);
}

.expand-chevron:not(.expanded) {
  transform: rotate(-90deg);
}

.expand-chevron:hover {
  color: var(--text-secondary);
}

.chevron-spacer {
  width: 14px;
  flex-shrink: 0;
}

/* Icon container - smooth color transition */
.nav-icon {
  color: var(--text-muted);
  display: flex;
  align-items: center;
  flex-shrink: 0;
  transition: color var(--duration-normal) var(--spring-smooth);
}

.base-nav-item.is-active .nav-icon {
  color: var(--text-primary);
  animation: iconPulse var(--duration-slow) var(--spring-gentle);
}

.base-nav-item:hover .nav-icon {
  color: var(--text-secondary);
}

@keyframes iconPulse {
  0% {
    opacity: 0.7;
    transform: scale(0.95);
  }
  50% {
    opacity: 1;
    transform: scale(1.05);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

/* Color dot (for projects) */
.color-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
  opacity: 0.9;
  transition: all var(--duration-fast);
}

.base-nav-item:hover .color-dot {
  opacity: 1;
  transform: scale(1.1);
}

/* Label */
.nav-label {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color var(--duration-fast);
}

.base-nav-item.is-active .nav-label {
  color: var(--text-primary);
  font-weight: var(--font-semibold);
}

.base-nav-item:hover .nav-label {
  color: var(--text-primary);
}

/* Nested items - smaller labels */
.base-nav-item.is-nested .nav-label {
  font-size: var(--text-sm);
}

/* Project emoji */
.project-emoji {
  font-size: 16px;
  flex-shrink: 0;
  opacity: 0.9;
  transition: all var(--duration-fast);
  display: flex;
  align-items: center;
  justify-content: center;
}

.base-nav-item:hover .project-emoji {
  opacity: 1;
  transform: scale(1.1);
}

/* Drag states - Use isDragTarget (set on dragenter) instead of :hover */
/* Green highlight when mouse enters a valid drop target */
.base-nav-item.is-drag-target.is-drag-valid {
  background: rgba(78, 205, 196, 0.15) !important;
  border-color: #4ECDC4 !important;
  box-shadow: 0 0 0 2px rgba(78, 205, 196, 0.2) !important;
  animation: pulseValid 1.5s ease-in-out infinite;
}

/* Red highlight when mouse enters an invalid target */
.base-nav-item.is-drag-target.is-drag-invalid {
  background: rgba(255, 107, 107, 0.1) !important;
  border-color: rgba(255, 107, 107, 0.3) !important;
  opacity: 0.6;
  cursor: not-allowed;
}

/* Global dragging state - fade out non-target items */
:global(body.dragging-active) .base-nav-item:not(.is-drag-target) {
  opacity: 0.7;
  transition: opacity var(--duration-fast);
}

/* Pulse animation for valid drop targets */
@keyframes pulseValid {
  0%, 100% {
    box-shadow: 0 0 0 2px rgba(78, 205, 196, 0.2) !important;
  }
  50% {
    box-shadow: 0 0 0 4px rgba(78, 205, 196, 0.3) !important;
  }
}

/* Drop target label - shows project name when valid drop target */
.drop-target-label {
  position: absolute;
  inset-inline-start: 100%; /* RTL: drop target label position */
  top: 50%;
  transform: translateY(-50%);
  margin-inline-start: var(--space-3); /* RTL: drop target label spacing */
  padding: var(--space-2) var(--space-3);
  background: linear-gradient(
    135deg,
    rgba(78, 205, 196, 0.95) 0%,
    rgba(78, 205, 196, 0.85) 100%
  );
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(78, 205, 196, 1);
  border-radius: var(--radius-md);
  color: #0a0a0a;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  white-space: nowrap;
  pointer-events: none;
  box-shadow:
    0 4px 12px rgba(78, 205, 196, 0.3),
    0 0 0 2px rgba(78, 205, 196, 0.2);
  z-index: 1000;
  animation: slideInLabel 0.2s var(--spring-smooth);
}

.drop-target-label strong {
  font-weight: var(--font-semibold);
  color: #000;
}

.drop-arrow {
  display: inline-block;
  margin-inline-end: var(--space-2); /* RTL: drop arrow spacing */
  font-weight: var(--font-bold);
}

@keyframes slideInLabel {
  from {
    opacity: 0;
    transform: translateY(-50%) translateX(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(-50%) translateX(0);
  }
}

/* For root/un-nesting */
.base-nav-item[data-project-id="__root__"] .drop-target-label {
  background: linear-gradient(
    135deg,
    rgba(147, 197, 253, 0.95) 0%,
    rgba(147, 197, 253, 0.85) 100%
  );
  border-color: rgba(147, 197, 253, 1);
  box-shadow:
    0 4px 12px rgba(147, 197, 253, 0.3),
    0 0 0 2px rgba(147, 197, 253, 0.2);
}
</style>
