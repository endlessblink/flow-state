<template>
  <!-- MODAL MANAGER - Extracted from App.vue to reduce complexity -->
  <div class="modal-manager">
    <!-- SETTINGS MODAL -->
    <SettingsModal
      :is-open="uiStore.settingsModalOpen"
      @close="uiStore.closeSettingsModal()"
    />
    
    <!-- AUTH MODAL -->
    <AuthModal
      :is-open="uiStore.authModalOpen"
      :initial-view="uiStore.authModalView"
      @close="uiStore.closeAuthModal()"
    />

    <!-- PROJECT MODAL -->
    <ProjectModal
      :is-open="sidebar.showProjectModal.value"
      :project="sidebar.editingProject.value"
      @close="sidebar.showProjectModal.value = false"
    />

    <!-- TASK EDIT MODAL -->
    <TaskEditModal
      :is-open="showTaskEditModal"
      :task="editingTask"
      @close="showTaskEditModal = false"
    />

    <!-- TASK CONTEXT MENU -->
    <TaskContextMenu
      :is-visible="showTaskContextMenu"
      :x="contextMenuX"
      :y="contextMenuY"
      :task="contextMenuTask"
      :compact-mode="settingsStore.boardDensity === 'ultrathin'"
      @close="closeTaskContextMenu"
      @edit="(taskId: string) => {
        const task = taskStore.tasks.find(t => t.id === taskId)
        if (task) openEditTask(task)
      }"
      @confirm-delete="handleContextMenuDelete"
      @move-to-section="handleMoveToSection"
    />

    <!-- PROJECT CONTEXT MENU -->
    <ContextMenu
      :is-visible="showProjectContextMenu"
      :x="projectContextMenuX"
      :y="projectContextMenuY"
      :items="projectContextMenuItems"
      @close="showProjectContextMenu = false"
    />

    <!-- CONFIRMATION MODAL -->
    <ConfirmationModal
      :is-open="showConfirmModal"
      title="Confirm Action"
      :message="confirmMessage"
      :details="confirmDetails"
      confirm-text="Delete"
      @confirm="executeConfirmAction"
      @cancel="cancelConfirmAction"
    />

    <!-- SEARCH MODAL -->
    <SearchModal
      :is-open="showSearchModal"
      @close="showSearchModal = false"
      @select-task="handleSearchSelectTask"
      @select-project="handleSearchSelectProject"
    />

    <!-- QUICK TASK CREATE MODAL -->
    <QuickTaskCreateModal
      :is-open="showQuickTaskCreate"
      :loading="false"
      @cancel="closeQuickTaskCreate"
      @create="handleQuickTaskCreate"
    />

    <!-- COMMAND PALETTE -->
    <CommandPalette ref="commandPaletteRef" />

    <!-- SECTION SELECTION MODAL -->
    <SectionSelectionModal
      :is-open="showSectionSelectionModal"
      :task="selectedTaskForSection"
      @cancel="showSectionSelectionModal = false"
      @confirm="confirmMoveToSection"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useTaskStore, type Task, type Project } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useCanvasStore } from '@/stores/canvas'
import { useSidebarManagement } from '@/composables/app/useSidebarManagement'
import { createLazyModal } from '@/composables/useLazyComponent'
import { getViewportCoordinates } from '@/utils/contextMenuCoordinates'
import { Edit, Palette, Copy, Trash2 } from 'lucide-vue-next'

// Components
import AuthModal from '@/components/auth/AuthModal.vue'
import SettingsModal from '@/components/layout/SettingsModal.vue'
import ProjectModal from '@/components/projects/ProjectModal.vue'
import TaskEditModal from '@/components/tasks/TaskEditModal.vue'
import TaskContextMenu from '@/components/tasks/TaskContextMenu.vue'
import ConfirmationModal from '@/components/common/ConfirmationModal.vue'
import ContextMenu, { type ContextMenuItem } from '@/components/ContextMenu.vue'
import SearchModal from '@/components/layout/SearchModal.vue'
import QuickTaskCreateModal from '@/components/tasks/QuickTaskCreateModal.vue'
import SectionSelectionModal from '@/components/canvas/SectionSelectionModal.vue'
const CommandPalette = createLazyModal(() => import('@/components/layout/CommandPalette.vue'))

import { useSettingsStore } from '@/stores/settings'

// Stores
const uiStore = useUIStore()
const settingsStore = useSettingsStore()
const taskStore = useTaskStore()
const canvasStore = useCanvasStore()
const sidebar = useSidebarManagement()

// State
const showTaskEditModal = ref(false)
const editingTask = ref<Task | null>(null)

const showTaskContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTask = ref<Task | null>(null)

const showProjectContextMenu = ref(false)
const projectContextMenuX = ref(0)
const projectContextMenuY = ref(0)
const contextMenuProject = ref<Project | null>(null)

const showConfirmModal = ref(false)
const confirmAction = ref<() => void | Promise<void>>(() => {})
const confirmMessage = ref('')
const confirmDetails = ref<string[]>([])

const showSearchModal = ref(false)
const showQuickTaskCreate = ref(false)
const showSectionSelectionModal = ref(false)
const selectedTaskForSection = ref<Task | null>(null)
const commandPaletteRef = ref<{ open: () => void; close: () => void } | null>(null)

// Methods
const openEditTask = (task: Task) => {
  editingTask.value = task
  showTaskEditModal.value = true
}

const closeTaskContextMenu = () => {
  showTaskContextMenu.value = false
  contextMenuTask.value = null
}

const confirmDeleteTask = async (task: Task) => {
  confirmMessage.value = `Delete task "${task.title}"?`
  confirmAction.value = async () => {
    const { useUnifiedUndoRedo } = await import('@/composables/useUnifiedUndoRedo')
    const undoRedoActions = useUnifiedUndoRedo()
    await undoRedoActions.deleteTaskWithUndo(task.id)
  }
  showConfirmModal.value = true
}

const handleContextMenuDelete = (taskId: string, instanceId?: string, isCalendarEvent?: boolean) => {
  const task = taskStore.tasks.find(t => t.id === taskId)

  if (!task) {
    return
  }

  if (isCalendarEvent && instanceId) {
    confirmMessage.value = `Remove "${task.title}" from calendar?`
    confirmAction.value = () => {
      taskStore.deleteTaskInstance(taskId, instanceId)
      showTaskContextMenu.value = false
    }
    confirmDetails.value = ['This will remove the scheduled instance and return the task to the sidebar.']
    showConfirmModal.value = true
  } else {
    confirmDeleteTask(task)
  }
}

const executeConfirmAction = async () => {
  // Close modal first (optimistic) to ensure it closes even if action fails
  const action = confirmAction.value
  showConfirmModal.value = false
  confirmAction.value = () => {}
  confirmMessage.value = ''
  confirmDetails.value = []

  // Execute action after modal is closed
  try {
    await action()
  } catch (error) {
    console.error('[ModalManager] Confirm action failed:', error)
  }
}

const cancelConfirmAction = () => {
  showConfirmModal.value = false
  confirmAction.value = () => {}
  confirmMessage.value = ''
  confirmDetails.value = []
}

const handleSearchSelectTask = (task: Task) => {
  openEditTask(task)
}

const handleSearchSelectProject = (project: Project) => {
  console.log('Selected project:', project)
  // Logic from App.vue: // TODO: Navigate to project view or filter by project
}

const closeQuickTaskCreate = () => {
  showQuickTaskCreate.value = false
}

const handleQuickTaskCreate = async (data: {
  title: string
  description: string
  status: string
  priority: 'low' | 'medium' | 'high'
  dueDate?: string
  projectId?: string
}) => {
  try {
    await taskStore.createTaskWithUndo({
      title: data.title,
      description: data.description,
      status: data.status as any,
      priority: data.priority,
      dueDate: data.dueDate,
      projectId: data.projectId || undefined
    })
    closeQuickTaskCreate()
  } catch (error) {
    console.error('Failed to create task:', error)
  }
}

const handleMoveToSection = (taskId: string) => {
  const task = taskStore.tasks.find(t => t.id === taskId)
  if (task) {
    selectedTaskForSection.value = task
    showSectionSelectionModal.value = true
    showTaskContextMenu.value = false
  }
}

const confirmMoveToSection = async (sectionId: string) => {
  if (!selectedTaskForSection.value) return

  const task = selectedTaskForSection.value
  const section = canvasStore.sections.find(s => s.id === sectionId)
  
  if (section) {
    // Calculate new position (center of section)
    const newPosition = {
      x: section.position.x + (section.position.width / 2) - 100,
      y: section.position.y + (section.position.height / 2) - 40
    }

    const updates: any = {
      canvasPosition: newPosition,
      isInInbox: false
    }

    // Apply "Assign on Drop" settings
    if (section.assignOnDrop) {
      if (section.assignOnDrop.priority) updates.priority = section.assignOnDrop.priority
      if (section.assignOnDrop.status) updates.status = section.assignOnDrop.status
      if (section.assignOnDrop.projectId) updates.projectId = section.assignOnDrop.projectId
      
      if (section.assignOnDrop.dueDate) {
        const { resolveDueDate } = await import('@/composables/useGroupSettings')
        const dateStr = await resolveDueDate(section.assignOnDrop.dueDate)
        if (dateStr) updates.dueDate = dateStr
      }
    }

    await taskStore.updateTaskWithUndo(task.id, updates)
    canvasStore.requestSync('user:context-menu')
  }

  showSectionSelectionModal.value = false
  selectedTaskForSection.value = null
}

const projectContextMenuItems = computed<ContextMenuItem[]>(() => {
  if (!contextMenuProject.value) return []
  const project = contextMenuProject.value
  const isDefaultProject = project.id === '1'

  return [
    { id: 'edit', label: 'Edit Project', icon: Edit, action: () => sidebar.openEditProject(project) },
    { id: 'change-icon', label: 'Change Icon', icon: Palette, action: () => sidebar.openEditProject(project) },
    { id: 'duplicate', label: 'Duplicate Project', icon: Copy, action: () => duplicateProject(project) },
    {
      id: 'delete',
      label: 'Delete Project',
      icon: Trash2,
      action: () => confirmDeleteProject(project),
      danger: true,
      disabled: isDefaultProject
    }
  ]
})

const duplicateProject = async (project: Project) => {
  if (!project || !project.id) return
  taskStore.createProject({
    name: `${project.name} (Copy)`,
    color: project.color,
    colorType: project.colorType,
    emoji: project.emoji,
    viewType: project.viewType,
    parentId: project.parentId
  })
  showProjectContextMenu.value = false
}

const confirmDeleteProject = (project: Project) => {
  if (!project || !project.id) return
  const taskCount = taskStore.tasks.filter(t => t.projectId === project.id).length
  const childCount = taskStore.projects.filter(p => p.parentId === project.id).length
  const details: string[] = []
  if (taskCount > 0) details.push(`${taskCount} task${taskCount > 1 ? 's' : ''} will become uncategorized`)
  if (childCount > 0) details.push(`${childCount} child project${childCount > 1 ? 's' : ''} will be un-nested`)

  confirmMessage.value = `Delete project "${project.name}"?`
  confirmAction.value = () => {
    taskStore.deleteProject(project.id)
    showProjectContextMenu.value = false
  }
  confirmDetails.value = details
  showConfirmModal.value = true
}

const handleConfirmDeleteSelected = () => {
  const selectedTaskIds = [...taskStore.selectedTaskIds]
  if (selectedTaskIds.length === 0) return

  const selectedTasks = taskStore.tasks.filter(task => selectedTaskIds.includes(task.id))
  let message = ''
  let details: string[] = []

  if (selectedTasks.length === 1) {
    const task = selectedTasks[0]
    message = `Delete task "${task.title}"?`
    details = ['This will permanently remove the task from all views.']
  } else {
    message = `Delete ${selectedTasks.length} selected tasks?`
    const taskTitles = selectedTasks.map(task => `• ${task.title}`)
    details = [
      'This will permanently remove the following tasks from all views:',
      ...taskTitles
    ]
  }

  confirmAction.value = async () => {
    const { useUnifiedUndoRedo } = await import('@/composables/useUnifiedUndoRedo')
    const undoRedoActions = useUnifiedUndoRedo()
    for (const taskId of selectedTaskIds) {
      await undoRedoActions.deleteTaskWithUndo(taskId)
    }
    taskStore.clearSelection()
  }
  confirmMessage.value = message
  confirmDetails.value = details
  showConfirmModal.value = true
}

// Global Event Handlers
const handleOpenTaskEdit = (event: Event) => {
  const customEvent = event as CustomEvent
  const task = taskStore.tasks.find(t => t.id === customEvent.detail.taskId)
  if (task) openEditTask(task)
}

const handleTaskContextMenu = (event: Event) => {
  console.log('📋 [MODAL-MGR] handleTaskContextMenu received event')
  const customEvent = event as CustomEvent
  const { event: mouseEvent, task, instanceId, isCalendarEvent } = customEvent.detail

  if (isCalendarEvent && instanceId) {
    contextMenuTask.value = {
      ...task,
      instanceId,
      isCalendarEvent
    } as Task & { instanceId: string; isCalendarEvent: boolean }
  } else {
    contextMenuTask.value = task
  }

  // BUG-1096: Use normalized coordinates for Tauri compatibility
  const { x, y } = getViewportCoordinates(mouseEvent)
  contextMenuX.value = x
  contextMenuY.value = y
  showTaskContextMenu.value = true
}

const handleProjectContextMenu = (event: Event) => {
  const customEvent = event as CustomEvent
  const { event: mouseEvent, project } = customEvent.detail

  // BUG-1096: Use normalized coordinates for Tauri compatibility
  const { x, y } = getViewportCoordinates(mouseEvent)
  projectContextMenuX.value = x
  projectContextMenuY.value = y
  contextMenuProject.value = project
  showProjectContextMenu.value = true
}

onMounted(() => {
  window.addEventListener('open-task-edit', handleOpenTaskEdit)
  window.addEventListener('task-context-menu' as any, handleTaskContextMenu as unknown as EventListener)
  window.addEventListener('project-context-menu', handleProjectContextMenu)
  window.addEventListener('open-command-palette', () => { commandPaletteRef.value?.open() })
  window.addEventListener('open-search', () => { showSearchModal.value = true })
  window.addEventListener('open-quick-task-create', () => { showQuickTaskCreate.value = true })
  window.addEventListener('confirm-delete-selected', handleConfirmDeleteSelected)
})

onUnmounted(() => {
  window.removeEventListener('open-task-edit', handleOpenTaskEdit)
  window.removeEventListener('task-context-menu' as any, handleTaskContextMenu as unknown as EventListener)
  window.removeEventListener('project-context-menu', handleProjectContextMenu)
  window.removeEventListener('open-command-palette', () => { commandPaletteRef.value?.open() })
  window.removeEventListener('open-search', () => { showSearchModal.value = true })
  window.removeEventListener('open-quick-task-create', () => { showQuickTaskCreate.value = true })
  window.removeEventListener('confirm-delete-selected', handleConfirmDeleteSelected)
})

// Expose methods for App.vue or parent triggers
defineExpose({
  openEditTask,
  openSearch: () => { showSearchModal.value = true },
  openQuickTask: () => { showQuickTaskCreate.value = true },
  openCommandPalette: () => { commandPaletteRef.value?.open() },
  openConfirmationModal: (title: string, message: string, action: () => void, details: string[] = []) => {
    confirmMessage.value = message
    confirmAction.value = action
    confirmDetails.value = details
    showConfirmModal.value = true
  },
  openTaskContextMenu: (event: MouseEvent, task: Task) => {
    // BUG-1096: Use normalized coordinates for Tauri compatibility
    const { x, y } = getViewportCoordinates(event)
    contextMenuX.value = x
    contextMenuY.value = y
    contextMenuTask.value = task
    showTaskContextMenu.value = true
  },
  openProjectContextMenu: (event: MouseEvent, project: Project) => {
    // BUG-1096: Use normalized coordinates for Tauri compatibility
    const { x, y } = getViewportCoordinates(event)
    projectContextMenuX.value = x
    projectContextMenuY.value = y
    contextMenuProject.value = project
    showProjectContextMenu.value = true
  },
  closeTaskContextMenu
})
</script>
