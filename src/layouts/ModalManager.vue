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
      @permanent-delete="handleContextMenuPermanentDelete"
    />

    <!-- MINI-CANVAS OVERLAY (Planning Canvas) -->
    <MiniCanvasOverlay />

    <!-- TASK CONTEXT MENU -->
    <TaskContextMenu
      :is-visible="showTaskContextMenu"
      :x="contextMenuX"
      :y="contextMenuY"
      :task="contextMenuTask"
      :selected-count="contextMenuSelectedCount"
      :selected-ids="contextMenuSelectedIds"
      :context="contextMenuContext"
      :compact-mode="settingsStore.boardDensity === 'ultrathin'"
      @close="closeTaskContextMenu"
      @edit="(taskId: string) => {
        const task = taskStore.tasks.find(t => t.id === taskId)
        if (task) openEditTask(task)
      }"
      @confirm-delete="handleContextMenuDelete"
      @confirm-permanent-delete="handleContextMenuPermanentDelete"
      @set-priority="handleBatchSetPriority"
      @set-status="handleBatchSetStatus"
      @set-due-date="handleBatchSetDueDate"
      @set-duration="handleBatchSetDuration"
      @set-project="handleBatchSetProject"
      @delete-selected="handleBatchDeleteSelected"
    />

    <!-- PROJECT CONTEXT MENU -->
    <ContextMenu
      :is-visible="showProjectContextMenu"
      :x="projectContextMenuX"
      :y="projectContextMenuY"
      :items="projectContextMenuItems"
      @close="showProjectContextMenu = false"
    />

    <!-- SEARCH MODAL -->
    <SearchModal
      :is-open="showSearchModal"
      @close="showSearchModal = false"
      @select-task="handleSearchSelectTask"
      @select-project="handleSearchSelectProject"
      @reveal-task="handleSearchRevealTask"
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

    <!-- KEYBOARD SHORTCUTS PANEL (TASK-1319) -->
    <KeyboardShortcutsPanel
      :is-open="uiStore.shortcutsPanelOpen"
      @close="uiStore.closeShortcutsPanel()"
    />

    <!-- TASK-1520: Recurrence-aware delete modal -->
    <RecurrenceDeleteModal
      :is-open="showRecurrenceDeleteModal"
      :task-title="recurrenceDeleteTaskTitle"
      :recurrence-rule="recurrenceDeleteTaskRule"
      :show-remove-from-canvas="recurrenceDeleteShowCanvasRemove"
      @skip="handleRecurrenceSkip"
      @stop="handleRecurrenceStop"
      @remove-from-canvas="handleRecurrenceRemoveFromCanvas"
      @cancel="showRecurrenceDeleteModal = false"
    />

    <!-- CONFIRMATION MODAL — rendered LAST so it always appears on top of search/other modals -->
    <ConfirmationModal
      :is-open="showConfirmModal"
      title="Confirm Action"
      :message="confirmMessage"
      :details="confirmDetails"
      confirm-text="Delete"
      @confirm="executeConfirmAction"
      @cancel="cancelConfirmAction"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useTaskStore, type Task, type Project } from '@/stores/tasks'
import type { TaskAttachment } from '@/types/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useSidebarManagement } from '@/composables/app/useSidebarManagement'
import { createLazyModal } from '@/composables/useLazyComponent'
import { getViewportCoordinates } from '@/utils/contextMenuCoordinates'
import { Edit, Palette, Copy, Trash2 } from 'lucide-vue-next'
import { useMessage } from 'naive-ui'

// Components
import AuthModal from '@/components/auth/AuthModal.vue'
import SettingsModal from '@/components/layout/SettingsModal.vue'
import ProjectModal from '@/components/projects/ProjectModal.vue'
import TaskEditModal from '@/components/tasks/TaskEditModal.vue'
import TaskContextMenu from '@/components/tasks/TaskContextMenu.vue'
import MiniCanvasOverlay from '@/components/mini-canvas/MiniCanvasOverlay.vue'
import ConfirmationModal from '@/components/common/ConfirmationModal.vue'
import RecurrenceDeleteModal from '@/components/common/RecurrenceDeleteModal.vue'
import ContextMenu, { type ContextMenuItem } from '@/components/ContextMenu.vue'
import SearchModal from '@/components/layout/SearchModal.vue'
import QuickTaskCreateModal from '@/components/tasks/QuickTaskCreateModal.vue'
import SectionSelectionModal from '@/components/canvas/SectionSelectionModal.vue'
import KeyboardShortcutsPanel from '@/components/layout/KeyboardShortcutsPanel.vue'
const CommandPalette = createLazyModal(() => import('@/components/layout/CommandPalette.vue'))

import { useRoute, useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'

// Stores
const uiStore = useUIStore()
const settingsStore = useSettingsStore()
const message = useMessage()
const taskStore = useTaskStore()
const canvasStore = useCanvasStore()
const sidebar = useSidebarManagement()
const route = useRoute()
const router = useRouter()

// Deep link: wait for tasks to load (app init is async)
const waitForTasks = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (taskStore.tasks.length > 0) {
      resolve()
      return
    }
    const timeout = setTimeout(() => {
      reject(new Error('Timed out waiting for tasks to load'))
    }, 10000)

    const unwatch = watch(() => taskStore.tasks.length, (len) => {
      if (len > 0) {
        clearTimeout(timeout)
        unwatch()
        resolve()
      }
    })
  })
}

// Deep link: ?editTask=<id> opens the task edit modal
watch(() => route.query.editTask, async (taskId) => {
  if (!taskId || typeof taskId !== 'string') return

  try {
    await waitForTasks()
  } catch {
    console.warn('[DeepLink] Timed out waiting for tasks to load')
    return
  }

  const task = taskStore.tasks.find(t => t.id === taskId)
  if (task) {
    openEditTask(task)
  } else {
    console.warn('[DeepLink] Task not found:', taskId)
  }

  // Clean up query param to prevent re-opening on refresh
  const { editTask: _editTask, ...rest } = route.query
  router.replace({ query: rest })
}, { immediate: true })

// State
const showTaskEditModal = ref(false)
const editingTask = ref<Task | null>(null)

const showTaskContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTask = ref<Task | null>(null)
const contextMenuSelectedIds = ref<string[]>([])
const contextMenuSelectedCount = ref(0)
type TaskMenuContext = 'calendar' | 'board' | 'list' | 'canvas'
// TASK-1785 Push 2: surface the menu was opened from, so the calendar can show
// the "Lock time on calendar" toggle while other surfaces hide it.
const contextMenuContext = ref<TaskMenuContext>('list')

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

// TASK-1520: Recurrence delete modal state
const showRecurrenceDeleteModal = ref(false)
const recurrenceDeleteTaskId = ref<string | null>(null)
const recurrenceDeleteTaskTitle = ref('')
const recurrenceDeleteTaskRule = ref<import('@/types/tasks').SimpleRecurrenceRule | null>(null)
// Track whether the pending action is a permanent delete
const recurrenceDeleteIsPermanent = ref(false)
const recurrenceDeleteShowCanvasRemove = ref(false)
const recurrenceDeleteContext = ref<TaskMenuContext>('list')

// Methods
const openEditTask = (task: Task) => {
  editingTask.value = task
  showTaskEditModal.value = true
}

const closeTaskContextMenu = () => {
  showTaskContextMenu.value = false
  contextMenuTask.value = null
  // TASK-1419: Do NOT clear selectedIds/selectedCount here.
  // Batch handlers fire AFTER close (composable emits 'close' before batch events
  // per BUG-1095). IDs are overwritten on next open in handleTaskContextMenu.
}

const canvasSafeDeleteTaskWithUndo = async (taskId: string) => {
  try {
    // BUG-1850: Real hard delete (writes tombstone) so the task is permanently removed and the
    // sync layer cannot resurrect it. Undo clears the tombstone and restores from snapshot.
    const { getUndoSystem } = await import('@/composables/undoSingleton')
    await getUndoSystem().permanentlyDeleteTaskWithUndo(taskId)
    showTaskContextMenu.value = false
  } catch (error) {
    console.error('[ModalManager] Canvas permanent delete failed:', error)
    message.error('Failed to delete task from canvas')
    throw error
  }
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
  // TASK-1487: Use rawTasks so delete works from search (which shows unfiltered tasks)
  const allTasks = taskStore.rawTasks || taskStore.tasks
  const task = allTasks.find(t => t.id === taskId)

  if (!task) {
    console.warn('[ModalManager] handleContextMenuDelete: task not found', taskId)
    return
  }

  if (isCalendarEvent && instanceId) {
    confirmMessage.value = `Remove "${task.title}" from calendar?`
    confirmAction.value = async () => {
      await taskStore.deleteTaskInstance(taskId, instanceId)
      showTaskContextMenu.value = false
    }
    confirmDetails.value = ['This will remove the scheduled instance and return the task to the sidebar.']
    showConfirmModal.value = true
  } else if (task.recurrenceRule) {
    // TASK-1520: Show recurrence-aware delete dialog
    recurrenceDeleteTaskId.value = taskId
    recurrenceDeleteTaskTitle.value = task.title || 'Untitled Task'
    recurrenceDeleteTaskRule.value = task.recurrenceRule
    recurrenceDeleteIsPermanent.value = false
    recurrenceDeleteShowCanvasRemove.value = !!task.canvasPosition
    recurrenceDeleteContext.value = contextMenuContext.value
    showRecurrenceDeleteModal.value = true
  } else {
    confirmDeleteTask(task)
  }
}

const handleContextMenuPermanentDelete = (taskId: string) => {
  const allTasks = taskStore.rawTasks || taskStore.tasks
  const task = allTasks.find(t => t.id === taskId)
  if (!task) {
    return
  }

  if (task.recurrenceRule) {
    // TASK-1520: Show recurrence-aware delete dialog for permanent delete too
    recurrenceDeleteTaskId.value = taskId
    recurrenceDeleteTaskTitle.value = task.title || 'Untitled Task'
    recurrenceDeleteTaskRule.value = task.recurrenceRule
    recurrenceDeleteIsPermanent.value = true
    recurrenceDeleteShowCanvasRemove.value = !!task.canvasPosition
    recurrenceDeleteContext.value = contextMenuContext.value
    showRecurrenceDeleteModal.value = true
    return
  }

  confirmMessage.value = `Permanently delete task "${task.title}"?`
  confirmDetails.value = [
    'This performs a hard delete from storage.',
    'Use this only when you do not want the task recoverable from trash.'
  ]
  confirmAction.value = async () => {
    if (contextMenuContext.value === 'canvas') {
      await canvasSafeDeleteTaskWithUndo(task.id)
      return
    }

    const { getUndoSystem } = await import('@/composables/undoSingleton')
    await getUndoSystem().permanentlyDeleteTaskWithUndo(task.id)
    showTaskContextMenu.value = false
  }
  showConfirmModal.value = true
}

// TASK-1520: Recurrence delete handlers
const handleRecurrenceSkip = async () => {
  const taskId = recurrenceDeleteTaskId.value
  const isPermanent = recurrenceDeleteIsPermanent.value
  const context = recurrenceDeleteContext.value
  showRecurrenceDeleteModal.value = false
  recurrenceDeleteTaskId.value = null
  recurrenceDeleteContext.value = 'list'
  if (!taskId) return

  try {
    if (isPermanent && context === 'canvas') {
      await canvasSafeDeleteTaskWithUndo(taskId)
      return
    }

    if (isPermanent) {
      // BUG-1508: Permanent delete — chain is cleared inside permanentlyDeleteTask,
      // so the scheduler cannot recreate this occurrence after the hard delete.
      const { getUndoSystem } = await import('@/composables/undoSingleton')
      await getUndoSystem().permanentlyDeleteTaskWithUndo(taskId)
    } else {
      await taskStore.skipRecurringOccurrence(taskId)
    }
  } catch (error) {
    console.error('[ModalManager] Skip recurring occurrence failed:', error)
  }
}

const handleRecurrenceStop = async () => {
  const taskId = recurrenceDeleteTaskId.value
  const isPermanent = recurrenceDeleteIsPermanent.value
  const context = recurrenceDeleteContext.value
  showRecurrenceDeleteModal.value = false
  recurrenceDeleteTaskId.value = null
  recurrenceDeleteContext.value = 'list'
  if (!taskId) return

  try {
    if (isPermanent && context === 'canvas') {
      await canvasSafeDeleteTaskWithUndo(taskId)
      return
    }

    if (isPermanent) {
      // BUG-1508: For permanent delete, use permanentlyDeleteTask which clears the
      // recurrence chain first (via clearRecurrenceChain) then hard-deletes.
      // This stops future occurrences AND prevents recreation by the scheduler.
      const { getUndoSystem } = await import('@/composables/undoSingleton')
      await getUndoSystem().permanentlyDeleteTaskWithUndo(taskId)
    } else {
      await taskStore.stopRecurrence(taskId)
    }
  } catch (error) {
    console.error('[ModalManager] Stop recurrence failed:', error)
  }
}

const handleRecurrenceRemoveFromCanvas = async () => {
  const taskId = recurrenceDeleteTaskId.value
  showRecurrenceDeleteModal.value = false
  recurrenceDeleteTaskId.value = null
  recurrenceDeleteContext.value = 'list'
  if (!taskId) return

  try {
    const { getUndoSystem } = await import('@/composables/undoSingleton')
    await getUndoSystem().bulkMoveToInboxWithUndo([taskId])
  } catch (error) {
    console.error('[ModalManager] Remove recurring task from canvas failed:', error)
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

const handleSearchRevealTask = async (task: Task) => {
  showSearchModal.value = false

  if (route.name !== 'canvas') {
    await router.push('/')
    // Wait for canvas to mount and initialize nodes
    await new Promise(resolve => setTimeout(resolve, 600))
  }

  window.dispatchEvent(new CustomEvent('reveal-task-on-canvas', {
    detail: { taskId: task.id }
  }))
}

const handleSearchSelectProject = (_project: Project) => {
  // TODO: Navigate to project view or filter by project
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
  attachments?: TaskAttachment[]  // FEATURE-1414
}) => {
  try {
    await taskStore.createTaskWithUndo({
      title: data.title,
      description: data.description,
      status: data.status as Task['status'],
      priority: data.priority,
      dueDate: data.dueDate,
      projectId: data.projectId || undefined,
      attachments: data.attachments
    })
    closeQuickTaskCreate()
  } catch (error) {
    console.error('Failed to create task:', error)
  }
}

const confirmMoveToSection = async (sectionId: string) => {
  if (!selectedTaskForSection.value) return

  // TASK-1429: Use the shared composable for consistent behavior
  const { useMoveToCanvasGroup } = await import('@/composables/canvas/useMoveToCanvasGroup')
  const { moveToGroupWithToast } = useMoveToCanvasGroup()

  await moveToGroupWithToast(selectedTaskForSection.value.id, sectionId)

  showSectionSelectionModal.value = false
  selectedTaskForSection.value = null
}

// TASK-1419: Batch operation handlers for multi-select context menu
const handleBatchSetPriority = async (priority: 'low' | 'medium' | 'high') => {
  const { useUnifiedUndoRedo } = await import('@/composables/useUnifiedUndoRedo')
  const { updateTaskWithUndo } = useUnifiedUndoRedo()
  for (const taskId of contextMenuSelectedIds.value) {
    await updateTaskWithUndo(taskId, { priority })
  }
  canvasStore.requestSync('user:context-menu')
}

const handleBatchSetStatus = async (status: 'todo' | 'done') => {
  const { useUnifiedUndoRedo } = await import('@/composables/useUnifiedUndoRedo')
  const { updateTaskWithUndo } = useUnifiedUndoRedo()
  for (const taskId of contextMenuSelectedIds.value) {
    await updateTaskWithUndo(taskId, { status })
  }
  canvasStore.requestSync('user:context-menu')
}

const handleBatchSetDueDate = async (dateType: string) => {
  const today = new Date()
  let dueDate: Date | null = null

  switch (dateType) {
    case 'today':
      dueDate = today
      break
    case 'tomorrow':
      dueDate = new Date(today)
      dueDate.setDate(today.getDate() + 1)
      break
    case 'weekend': {
      dueDate = new Date(today)
      const daysUntilSaturday = (6 - today.getDay()) % 7 || 7
      dueDate.setDate(today.getDate() + daysUntilSaturday)
      break
    }
    case 'nextweek':
      dueDate = new Date(today)
      dueDate.setDate(today.getDate() + 7)
      break
    case 'nextmonth':
      dueDate = new Date(today)
      dueDate.setMonth(today.getMonth() + 1)
      break
    case 'twomonths':
      dueDate = new Date(today)
      dueDate.setMonth(today.getMonth() + 2)
      break
    case 'nextquarter':
      dueDate = new Date(today)
      dueDate.setMonth(today.getMonth() + 3)
      break
    case 'halfyear':
      dueDate = new Date(today)
      dueDate.setMonth(today.getMonth() + 6)
      break
    default:
      return
  }

  if (!dueDate) return
  const formattedDate = dueDate.toISOString().split('T')[0]
  const { useUnifiedUndoRedo } = await import('@/composables/useUnifiedUndoRedo')
  const { updateTaskWithUndo } = useUnifiedUndoRedo()
  for (const taskId of contextMenuSelectedIds.value) {
    await updateTaskWithUndo(taskId, { dueDate: formattedDate })
  }
  canvasStore.requestSync('user:context-menu')
}

const handleBatchSetDuration = async (duration: number | null) => {
  const { useUnifiedUndoRedo } = await import('@/composables/useUnifiedUndoRedo')
  const { updateTaskWithUndo } = useUnifiedUndoRedo()
  for (const taskId of contextMenuSelectedIds.value) {
    await updateTaskWithUndo(taskId, { estimatedDuration: duration ?? undefined })
  }
  canvasStore.requestSync('user:context-menu')
}

const handleBatchSetProject = async (projectId: string | null) => {
  const { useUnifiedUndoRedo } = await import('@/composables/useUnifiedUndoRedo')
  const { updateTaskWithUndo } = useUnifiedUndoRedo()
  for (const taskId of contextMenuSelectedIds.value) {
    await updateTaskWithUndo(taskId, {
      projectId: projectId ?? undefined,
      isUncategorized: !projectId
    })
  }
  canvasStore.requestSync('user:context-menu')
}

const handleBatchDeleteSelected = () => {
  const selectedIds = [...contextMenuSelectedIds.value]
  if (selectedIds.length === 0) return

  // TASK-1520: Check if any selected task is recurring — handle one-by-one
  const allTasks = taskStore.rawTasks || taskStore.tasks
  const selectedTasks = allTasks.filter(task => selectedIds.includes(task.id))
  const recurringTasks = selectedTasks.filter(t => t.recurrenceRule)
  const normalIds = selectedIds.filter(id => !recurringTasks.some(t => t.id === id))

  // If there are recurring tasks, show recurrence dialog for the first one
  // (user handles them one at a time)
  if (recurringTasks.length > 0) {
    const first = recurringTasks[0]
    recurrenceDeleteTaskId.value = first.id
    recurrenceDeleteTaskTitle.value = first.title || 'Untitled Task'
    recurrenceDeleteTaskRule.value = first.recurrenceRule ?? null
    recurrenceDeleteIsPermanent.value = false
    recurrenceDeleteShowCanvasRemove.value = !!first.canvasPosition
    recurrenceDeleteContext.value = contextMenuContext.value
    showRecurrenceDeleteModal.value = true
    return
  }

  confirmMessage.value = `Delete ${selectedTasks.length} selected tasks?`
  confirmDetails.value = [
    'This will remove the following tasks:',
    ...selectedTasks.map(task => `• ${task.title}`)
  ]
  confirmAction.value = async () => {
    const { useUnifiedUndoRedo } = await import('@/composables/useUnifiedUndoRedo')
    const undoRedoActions = useUnifiedUndoRedo()
    for (const taskId of normalIds) {
      await undoRedoActions.deleteTaskWithUndo(taskId)
    }
  }
  showConfirmModal.value = true
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
  const taskCount = (taskStore._rawTasks || []).filter(t => !t._soft_deleted && t.projectId === project.id).length
  const childCount = taskStore.projects.filter(p => p.parentId === project.id).length
  const details: string[] = []
  if (taskCount > 0) details.push(`${taskCount} task${taskCount > 1 ? 's' : ''} will become uncategorized`)
  if (childCount > 0) details.push(`${childCount} child project${childCount > 1 ? 's' : ''} will be un-nested`)

  confirmMessage.value = `Delete project "${project.name}"?`
  confirmAction.value = async () => {
    try {
      await taskStore.deleteProject(project.id)
    } catch (error) {
      // BUG-1775: deleteProject now throws + rolls back on remote failure
      console.error('❌ Error deleting project:', error)
      message.error(`Failed to delete "${project.name}" — please try again.`)
    }
    showProjectContextMenu.value = false
  }
  confirmDetails.value = details
  showConfirmModal.value = true
}

const handleConfirmDeleteSelected = () => {
  const selectedTaskIds = [...taskStore.selectedTaskIds]
  if (selectedTaskIds.length === 0) return

  const allTasks = taskStore.rawTasks || taskStore.tasks
  const selectedTasks = allTasks.filter(task => selectedTaskIds.includes(task.id))

  // TASK-1520: If a single recurring task, show recurrence dialog
  if (selectedTasks.length === 1 && selectedTasks[0].recurrenceRule) {
    const task = selectedTasks[0]
    recurrenceDeleteTaskId.value = task.id
    recurrenceDeleteTaskTitle.value = task.title || 'Untitled Task'
    recurrenceDeleteTaskRule.value = task.recurrenceRule ?? null
    recurrenceDeleteIsPermanent.value = false
    recurrenceDeleteShowCanvasRemove.value = !!task.canvasPosition
    recurrenceDeleteContext.value = 'list'
    showRecurrenceDeleteModal.value = true
    return
  }

  // If batch has recurring tasks, handle first recurring one
  const recurringTasks = selectedTasks.filter(t => t.recurrenceRule)
  if (recurringTasks.length > 0) {
    const first = recurringTasks[0]
    recurrenceDeleteTaskId.value = first.id
    recurrenceDeleteTaskTitle.value = first.title || 'Untitled Task'
    recurrenceDeleteTaskRule.value = first.recurrenceRule ?? null
    recurrenceDeleteIsPermanent.value = false
    recurrenceDeleteShowCanvasRemove.value = !!first.canvasPosition
    recurrenceDeleteContext.value = 'list'
    showRecurrenceDeleteModal.value = true
    return
  }

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
  const customEvent = event as CustomEvent
  const { event: mouseEvent, task, instanceId, isCalendarEvent, selectedIds, selectedCount, context } = customEvent.detail

  if (isCalendarEvent && instanceId) {
    contextMenuTask.value = {
      ...task,
      instanceId,
      isCalendarEvent
    } as Task & { instanceId: string; isCalendarEvent: boolean }
  } else {
    contextMenuTask.value = task
  }

  // TASK-1785 Push 2: 'calendar' enables the lock toggle in the menu.
  // Canvas passes its origin so permanent delete can use the canvas-safe path.
  contextMenuContext.value = isCalendarEvent
    ? 'calendar'
    : context === 'canvas' || context === 'board' || context === 'list'
      ? context
      : 'list'

  // TASK-1419: Pass multi-select info to context menu
  contextMenuSelectedIds.value = selectedIds || [task.id]
  contextMenuSelectedCount.value = selectedCount || 1

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

// TASK-1520 follow-up: Global listener for recurrence-aware deletes from any component
const handleRecurrenceDeleteEvent = (e: Event) => {
  const { taskId, permanent, context } = (e as CustomEvent).detail
  const allTasks = taskStore.rawTasks || taskStore.tasks
  const task = allTasks.find(t => t.id === taskId)
  if (!task) return

  recurrenceDeleteTaskId.value = taskId
  recurrenceDeleteTaskTitle.value = task.title || 'Untitled Task'
  recurrenceDeleteTaskRule.value = task.recurrenceRule ?? null
  recurrenceDeleteIsPermanent.value = permanent ?? false
  recurrenceDeleteShowCanvasRemove.value = !!task.canvasPosition
  recurrenceDeleteContext.value = context === 'canvas' ? 'canvas' : 'list'
  showRecurrenceDeleteModal.value = true
}

const handleOpenCommandPalette = () => { commandPaletteRef.value?.open() }
const handleOpenSearch = () => { showSearchModal.value = true }
const handleOpenQuickTaskCreate = () => { showQuickTaskCreate.value = true }
const handleOpenShortcutsPanel = () => { uiStore.toggleShortcutsPanel() }

onMounted(() => {
  window.addEventListener('open-task-edit', handleOpenTaskEdit)
  window.addEventListener('task-context-menu', handleTaskContextMenu as unknown as EventListener)
  window.addEventListener('project-context-menu', handleProjectContextMenu)
  window.addEventListener('open-command-palette', handleOpenCommandPalette)
  window.addEventListener('open-search', handleOpenSearch)
  window.addEventListener('open-quick-task-create', handleOpenQuickTaskCreate)
  window.addEventListener('confirm-delete-selected', handleConfirmDeleteSelected)
  window.addEventListener('open-shortcuts-panel', handleOpenShortcutsPanel)
  window.addEventListener('recurrence-delete-requested', handleRecurrenceDeleteEvent)
})

onUnmounted(() => {
  window.removeEventListener('open-task-edit', handleOpenTaskEdit)
  window.removeEventListener('task-context-menu', handleTaskContextMenu as unknown as EventListener)
  window.removeEventListener('project-context-menu', handleProjectContextMenu)
  window.removeEventListener('open-command-palette', handleOpenCommandPalette)
  window.removeEventListener('open-search', handleOpenSearch)
  window.removeEventListener('open-quick-task-create', handleOpenQuickTaskCreate)
  window.removeEventListener('confirm-delete-selected', handleConfirmDeleteSelected)
  window.removeEventListener('open-shortcuts-panel', handleOpenShortcutsPanel)
  window.removeEventListener('recurrence-delete-requested', handleRecurrenceDeleteEvent)
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
