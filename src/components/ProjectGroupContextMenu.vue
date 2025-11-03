<template>
  <div
    v-if="isVisible"
    ref="menuRef"
    class="project-context-menu"
    :style="menuPosition"
  >
    <!-- Project Info Header -->
    <div class="project-header">
      <div class="project-badge">
        <span
          v-if="project?.colorType === 'emoji' && project?.emoji"
          class="project-emoji"
        >
          {{ project.emoji }}
        </span>
        <div
          v-else
          class="project-color"
          :style="{ backgroundColor: project?.color }"
        ></div>
      </div>
      <div class="project-info">
        <div class="project-name">{{ project?.name || 'Unknown Project' }}</div>
        <div class="project-stats">{{ tasksCount }} tasks</div>
      </div>
    </div>

    <div class="menu-divider"></div>

    <!-- Project Management Section -->
    <div class="menu-section">
      <div class="section-header">
        <div class="section-label">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="section-icon">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
          <span class="section-title">Project</span>
        </div>
      </div>

      <button class="menu-item" @click="editProject">
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="menu-icon">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
        </svg>
        <span class="menu-text">Edit Project</span>
        <span class="menu-shortcut">Ctrl+E</span>
      </button>

      <button class="menu-item" @click="createSubProject">
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="menu-icon">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
        </svg>
        <span class="menu-text">Create Sub-Project</span>
      </button>

      <button class="menu-item danger" @click="deleteProject">
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="menu-icon">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
        <span class="menu-text">Delete Project</span>
      </button>
    </div>

    <div class="menu-divider"></div>

    <!-- View Type Section -->
    <div class="menu-section">
      <div class="section-header">
        <div class="section-label">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="section-icon">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
          </svg>
          <span class="section-title">View</span>
        </div>
      </div>

      <div class="view-type-row">
        <button
          class="view-type-btn"
          :class="{ active: project?.viewType === 'status' }"
          @click="changeViewType('status')"
          title="Status View"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="view-icon">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span>Status</span>
        </button>

        <button
          class="view-type-btn"
          :class="{ active: project?.viewType === 'date' }"
          @click="changeViewType('date')"
          title="Date View"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="view-icon">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          <span>Date</span>
        </button>

        <button
          class="view-type-btn"
          :class="{ active: project?.viewType === 'priority' }"
          @click="changeViewType('priority')"
          title="Priority View"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="view-icon">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 2H21l-3 6 3 6h-8.5l-1-2H5a2 2 0 00-2 2zm9-13.5V9"/>
          </svg>
          <span>Priority</span>
        </button>
      </div>
    </div>

    <div class="menu-divider"></div>

    <!-- Task Operations Section -->
    <div class="menu-section">
      <div class="section-header">
        <div class="section-label">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="section-icon">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
          <span class="section-title">Tasks</span>
        </div>
      </div>

      <button class="menu-item" @click="createTask">
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="menu-icon">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
        </svg>
        <span class="menu-text">Add Task</span>
        <span class="menu-shortcut">Ctrl+N</span>
      </button>

      <button class="menu-item" @click="hideTasks" :disabled="tasksCount === 0">
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="menu-icon">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
        </svg>
        <span class="menu-text">Hide Tasks</span>
      </button>

      <button class="menu-item" @click="expandCollapseAll">
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="menu-icon">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"/>
        </svg>
        <span class="menu-text">{{ isExpanded ? 'Collapse All' : 'Expand All' }}</span>
      </button>
    </div>

    <div class="menu-divider"></div>

    <!-- Quick Actions -->
    <button class="menu-item" @click="sortTasks">
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="menu-icon">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4"/>
      </svg>
      <span class="menu-text">Sort Tasks</span>
    </button>

    <button class="menu-item" @click="archiveProject">
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="menu-icon">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
      </svg>
      <span class="menu-text"> Archive Project</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import type { Project } from '@/stores/tasks'

interface Props {
  isVisible: boolean
  x: number
  y: number
  project: Project | null
  tasksCount?: number
  isExpanded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  tasksCount: 0,
  isExpanded: true
})

const emit = defineEmits<{
  close: []
  editProject: [project: Project]
  deleteProject: [project: Project]
  createSubProject: [parentProject: Project]
  createTask: [projectId: string]
  hideTasks: [projectId: string]
  changeViewType: [projectId: string, viewType: 'status' | 'date' | 'priority']
  expandCollapseAll: [projectId: string, isExpanded: boolean]
  sortTasks: [projectId: string]
  archiveProject: [projectId: string]
}>()

const taskStore = useTaskStore()
const menuRef = ref<HTMLElement | null>(null)

// Smart positioning to prevent cutoff (same as TaskContextMenu)
const menuPosition = computed(() => {
  if (!menuRef.value) {
    return { left: props.x + 'px', top: props.y + 'px' }
  }

  const menuHeight = menuRef.value.offsetHeight || 400 // Estimated height
  const menuWidth = menuRef.value.offsetWidth || 280 // Wider than task menu
  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth
  const padding = 8 // Padding from viewport edge

  let left = props.x
  let top = props.y

  // Check if menu overflows bottom of viewport
  if (top + menuHeight > viewportHeight - padding) {
    // Flip to render above the click point
    top = props.y - menuHeight
  }

  // Check if menu overflows right of viewport
  if (left + menuWidth > viewportWidth - padding) {
    left = viewportWidth - menuWidth - padding
  }

  // Ensure menu doesn't go off-screen on the left
  if (left < padding) {
    left = padding
  }

  // Ensure menu doesn't go off-screen on the top
  if (top < padding) {
    top = padding
  }

  return {
    left: left + 'px',
    top: top + 'px'
  }
})

// Actions
const editProject = () => {
  if (props.project) {
    emit('editProject', props.project)
  }
  emit('close')
}

const deleteProject = () => {
  if (props.project) {
    emit('deleteProject', props.project)
  }
  emit('close')
}

const createSubProject = () => {
  if (props.project) {
    emit('createSubProject', props.project)
  }
  emit('close')
}

const createTask = () => {
  if (props.project) {
    emit('createTask', props.project.id)
  }
  emit('close')
}

const hideTasks = () => {
  if (props.project) {
    emit('hideTasks', props.project.id)
  }
  emit('close')
}

const changeViewType = (viewType: 'status' | 'date' | 'priority') => {
  if (props.project) {
    emit('changeViewType', props.project.id, viewType)
  }
  emit('close')
}

const expandCollapseAll = () => {
  if (props.project) {
    emit('expandCollapseAll', props.project.id, !props.isExpanded)
  }
  emit('close')
}

const sortTasks = () => {
  if (props.project) {
    emit('sortTasks', props.project.id)
  }
  emit('close')
}

const archiveProject = () => {
  if (props.project) {
    emit('archiveProject', props.project.id)
  }
  emit('close')
}

// Click outside handler (same as TaskContextMenu)
const handleClickOutside = (event: MouseEvent) => {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    // Clicking outside - close the menu
    emit('close')
  }
}

// Add/remove event listener when menu visibility changes
watch(() => props.isVisible, (isVisible) => {
  if (isVisible) {
    // Add listener on next tick to avoid closing immediately
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 0)
  } else {
    document.removeEventListener('click', handleClickOutside)
  }
})

// Cleanup on unmount
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.project-context-menu {
  position: fixed;
  background: var(--surface-secondary);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: var(--space-2) 0;
  min-width: 280px;
  z-index: 1000;
  animation: menuSlideIn var(--duration-fast) var(--spring-smooth);
}

@keyframes menuSlideIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.project-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--glass-bg-light);
  border-radius: var(--radius-md);
  margin: var(--space-2) var(--space-3);
}

.project-badge {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px var(--shadow-md);
  border: 2px solid var(--glass-border);
  flex-shrink: 0;
}

.project-color {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-md);
}

.project-emoji {
  font-size: 24px;
  line-height: 1;
}

.project-info {
  flex: 1;
  min-width: 0;
}

.project-name {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-stats {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-top: 2px;
}

.menu-item {
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-primary);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  font-weight: var(--font-normal);
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  transition: background-color 0.15s ease;
}

.menu-item:hover {
  background: var(--bg-hover);
}

.menu-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.menu-item:disabled:hover {
  background: transparent;
}

.menu-item.danger {
  color: var(--danger-text);
}

.menu-item.danger:hover {
  background: var(--danger-bg-subtle);
}

.menu-icon {
  flex-shrink: 0;
}

.menu-text {
  flex: 1;
  font-weight: var(--font-normal);
}

.menu-shortcut {
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-normal);
}

.menu-divider {
  height: 1px;
  background: var(--border-secondary);
  margin: var(--space-2) 0;
}

/* Menu Sections */
.menu-section {
  padding: var(--space-3) var(--space-4);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.section-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.section-icon {
  color: var(--text-muted);
}

.section-title {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
}

/* View Type Buttons */
.view-type-row {
  display: flex;
  gap: var(--space-2);
}

.view-type-btn {
  flex: 1;
  background: var(--surface-tertiary);
  border: 1px solid var(--border-secondary);
  padding: var(--space-2);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.view-type-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}

.view-type-btn.active {
  background: var(--blue-bg-subtle);
  border-color: var(--color-info);
  color: var(--color-info);
}

.view-icon {
  width: 16px;
  height: 16px;
}

/* Remove light theme overrides - using design tokens for all themes */
</style>