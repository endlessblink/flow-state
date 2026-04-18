<template>
  <div class="kanban-column" :class="wipStatusClass">
    <div class="column-header">
      <div class="header-left">
        <span
          v-if="columnIndicatorColor"
          class="column-priority-dot"
          :style="{ background: columnIndicatorColor as string }"
        />
        <span class="column-title">{{ title }}</span>
        <span class="task-count">{{ taskCount }}</span>
      </div>
      <button class="add-task-btn" @click="$emit('addTask', status)">
        <Plus :size="12" />
      </button>
    </div>

    <div
      class="tasks-container"
      :class="{ 'inbox-drag-over': isDragOver }"
      @dragover.prevent="handleNativeDragOver"
      @dragleave="handleNativeDragLeave"
      @drop="handleNativeDrop"
    >
      <!-- eslint-disable vue/prefer-true-attribute-shorthand -- BUG-1335: vuedraggable requires explicit :attr="true" bindings, shorthand breaks drag -->
      <draggable
        v-model="localTasks"
        :group="dragGroup"
        item-key="id"
        class="drag-area"
        :animation="200"
        ghost-class="ghost-card"
        chosen-class="chosen-card"
        drag-class="drag-card"
        :force-fallback="true"
        :fallback-on-body="true"
        fallback-class="sortable-fallback"
        :fallback-tolerance="3"
        :scroll-sensitivity="100"
        :scroll-speed="20"
        :bubble-scroll="true"
        :delay="100"
        :delay-on-touch-only="true"
        :touch-start-threshold="5"
        :disabled="false"
        easing="cubic-bezier(0.25, 0.46, 0.45, 0.94)"
        tag="div"
        @start="onDragStart"
        @end="onDragEnd"
        @change="handleDragChange"
      >
        <template #item="{ element: task }">
          <TaskCard
            :key="task.id"
            :task="task"
            class="task-item"
            @select="$emit('selectTask', $event)"
            @start-timer="$emit('startTimer', $event)"
            @edit="$emit('editTask', $event)"
            @delete="$emit('deleteTask', $event)"
            @context-menu="(event, task) => $emit('contextMenu', event, task)"
          />
        </template>

        <template #footer>
          <div v-if="hasMore" class="show-more-footer" @click="isExpanded = true">
            <span class="show-more-text">Show {{ hiddenCount }} more</span>
          </div>
          <div v-else-if="allTasks.length === 0" class="empty-column">
            <span class="empty-message">{{ $t('kanban.no_tasks_in', { status: title.toLowerCase() }) }}</span>
            <button class="add-first-task" @click="$emit('addTask', status)">
              <Plus :size="16" />
              {{ $t('kanban.add_task_in', { status: title.toLowerCase() }) }}
            </button>
          </div>
        </template>
      </draggable>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import draggable from 'vuedraggable'
import TaskCard from './TaskCard.vue'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useDragAndDrop } from '@/composables/useDragAndDrop'
import { Plus } from 'lucide-vue-next'

import './KanbanColumn.css'

interface Props {
  title: string
  status: Task['status']
  tasks: Task[]
  wipLimit?: number
  columnType?: 'status' | 'priority' | 'date' | 'category'
  swimlaneId?: string
}

const props = withDefaults(defineProps<Props>(), {
  wipLimit: 10,
  columnType: 'status',
  swimlaneId: 'default'
})

defineEmits<{
  addTask: [status: Task['status']]
  selectTask: [taskId: string]
  startTimer: [taskId: string]
  editTask: [taskId: string]
  deleteTask: [taskId: string]
  contextMenu: [event: MouseEvent, task: Task]
}>()

// BUG-1193: Track drag state to prevent reactive overwrites during drag
const isDragActive = ref(false)

// TASK-1160: Progressive rendering — limit rendered tasks per column
const COLUMN_RENDER_LIMIT = 30
const isExpanded = ref(false)

const allTasks = ref([...props.tasks])

const localTasks = computed({
  get: () => {
    if (isExpanded.value || allTasks.value.length <= COLUMN_RENDER_LIMIT) {
      return allTasks.value
    }
    return allTasks.value.slice(0, COLUMN_RENDER_LIMIT)
  },
  set: (val) => {
    if (isExpanded.value || allTasks.value.length <= COLUMN_RENDER_LIMIT) {
      allTasks.value = val
    } else {
      // During drag on truncated list: merge back with hidden items
      const hiddenTasks = allTasks.value.slice(COLUMN_RENDER_LIMIT)
      allTasks.value = [...val, ...hiddenTasks]
    }
  }
})

watch(() => props.tasks, (newTasks) => {
  // BUG-1193: Don't overwrite allTasks during active drag operation
  // vuedraggable manages the array during drag - reactive updates cause desync
  // where the wrong task element gets associated with the drag ghost
  if (!isDragActive.value) {
    allTasks.value = [...newTasks]
  }
})

const hasMore = computed(() => !isExpanded.value && allTasks.value.length > COLUMN_RENDER_LIMIT)
const hiddenCount = computed(() => Math.max(0, allTasks.value.length - COLUMN_RENDER_LIMIT))

// BUG-1335: Use a shared drag group across all swimlanes so tasks can be dragged
// between projects. Static string avoids SortableJS re-init on reactive changes.
const dragGroup = 'tasks'

// FEATURE-1336b: Bridge vuedraggable drag to global useDragAndDrop for sidebar drops
// BUG-1516c: Also expose dragData so handleNativeDrop can read singleton (WebKitGTK/Tauri fix)
const { startDrag, endDrag: endGlobalDrag, dragData } = useDragAndDrop()

const onDragStart = (evt: any) => {
  isDragActive.value = true

  // Bridge to global drag state so sidebar can receive drops
  const taskId = evt.item?.dataset?.taskId || evt.item?.querySelector?.('[data-task-id]')?.dataset?.taskId
  const taskTitle = evt.item?.querySelector?.('.task-title')?.textContent?.trim() || ''
  if (taskId) {
    startDrag({
      type: 'task',
      taskId,
      title: taskTitle,
      source: 'kanban'
    })
  }
}

const onDragEnd = (evt: any) => {
  isDragActive.value = false

  // Check if dropped on a sidebar project (SortableJS forceFallback doesn't fire
  // native drag events on external elements, so we detect the target manually)
  const mouseEvt = evt.originalEvent as MouseEvent | undefined
  if (mouseEvt) {
    const elements = document.elementsFromPoint(mouseEvt.clientX, mouseEvt.clientY)
    for (const el of elements) {
      const navItem = (el as HTMLElement).closest('[data-drop-project-id]') as HTMLElement | null
      if (navItem) {
        const projectId = navItem.dataset.dropProjectId
        const taskId = evt.item?.dataset?.taskId || evt.item?.querySelector?.('[data-task-id]')?.dataset?.taskId
        if (projectId && taskId) {
          taskStore.moveTaskToProject(taskId, projectId)
        }
        break
      }
    }
  }

  endGlobalDrag()
  // Broadcast drag-end so ALL columns resync (not just this source column)
  window.dispatchEvent(new CustomEvent('kanban:drag-end'))
}

const taskCount = computed(() => allTasks.value.length)

// --- Inbox → Kanban native HTML5 drop support ---
// SortableJS only accepts drops from other SortableJS instances, so inbox drags
// (which use native HTML5 drag) need a separate native drop handler on the column.
const isDragOver = ref(false)

const handleNativeDragOver = (event: DragEvent) => {
  // Only show highlight for inbox drags (they set application/json with fromInbox: true).
  // We can't read the data content during dragover (browser security), but we can
  // check that application/json is at least present in the types list.
  if (event.dataTransfer?.types.includes('application/json')) {
    isDragOver.value = true
  }
}

const handleNativeDragLeave = (event: DragEvent) => {
  // Only clear when truly leaving the column (not entering a child element)
  const related = event.relatedTarget as Node | null
  const column = (event.currentTarget as HTMLElement)
  if (!related || !column.contains(related)) {
    isDragOver.value = false
  }
}

const handleNativeDrop = async (event: DragEvent) => {
  isDragOver.value = false
  event.preventDefault()

  // BUG-1516c: Read from dragData singleton FIRST (required for WebKitGTK/Tauri where
  // dataTransfer.getData() returns empty string). Fall back to dataTransfer for browser.
  let data: { taskId?: string; taskIds?: string[]; fromInbox?: boolean } | null = null
  if (dragData.value && dragData.value.source !== 'kanban') {
    // Singleton has data from a non-SortableJS drag (inbox uses HTML5 native drag)
    data = {
      taskId: dragData.value.taskId,
      taskIds: dragData.value.taskIds,
      fromInbox: dragData.value.source === 'sidebar' || !!(dragData.value as any).fromInbox
    }
    // For inbox drags, check if the drag was specifically from inbox by looking at the
    // dataTransfer type hint — inbox sets fromInbox in the JSON payload
    const jsonData = event.dataTransfer?.getData('application/json')
    if (jsonData) {
      try {
        const parsed = JSON.parse(jsonData) as { taskId?: string; taskIds?: string[]; fromInbox?: boolean }
        // Prefer the explicit fromInbox flag from the JSON payload
        if (parsed.fromInbox !== undefined) {
          data.fromInbox = parsed.fromInbox
        }
      } catch { /* ignore parse errors */ }
    }
  } else {
    const jsonData = event.dataTransfer?.getData('application/json')
    if (!jsonData) return
    try {
      data = JSON.parse(jsonData) as { taskId?: string; taskIds?: string[]; fromInbox?: boolean }
    } catch {
      return
    }
  }

  if (!data) return

  try {
    // Only handle inbox drags; SortableJS handles its own internal drops
    if (!data.fromInbox) return

    const ids = data.taskIds?.length ? data.taskIds : data.taskId ? [data.taskId] : []
    if (ids.length === 0) return

    for (const taskId of ids) {
      if (props.columnType === 'status') {
        await taskStore.moveTaskWithUndo(taskId, props.status)
      }
      // Clear inbox flag regardless of column type so task leaves the inbox
      await taskStore.updateTask(taskId, { isInInbox: false })
    }
  } catch (e) {
    console.error('[KanbanColumn] Native drop from inbox failed:', e)
  }
}

// Column color indicator (priority dot or project color)
const columnIndicatorColor = computed(() => {
  if (props.columnType === 'priority') {
    const priorityColors: Record<string, string> = {
      'high': 'var(--color-priority-high)',
      'medium': 'var(--color-priority-medium)',
      'low': 'var(--color-priority-low)',
      'no_priority': 'rgba(255, 255, 255, 0.2)'
    }
    return priorityColors[props.status] || null
  }
  if (props.columnType === 'category') {
    // FEATURE-1336: Show project color dot for category columns
    const project = taskStore.projects.find(p => p.id === props.status)
    return project?.color || 'rgba(255, 255, 255, 0.2)'
  }
  return null
})

const wipStatusClass = computed(() => {
  if (!props.wipLimit) return ''
  const count = taskCount.value
  const limit = props.wipLimit
  if (count >= limit) return 'wip-exceeded'
  if (count >= Math.floor(limit * 0.8)) return 'wip-warning'
  return ''
})

const taskStore = useTaskStore()

/**
 * Recalculate order values for all tasks in localTasks based on their current array position.
 * Uses simple integer indexing (0, 1, 2, ...) and persists via updateTask.
 */
const persistOrderForColumn = () => {
  allTasks.value.forEach((task, index) => {
    if (task.order !== index) {
      taskStore.updateTask(task.id, { order: index })
    }
  })
}

const handleDragChange = async (event: { added?: { element: Task }; removed?: { element: Task }; moved?: { element: Task } }) => {
  if (event.added) {
    try {
      const taskId = event.added.element.id
      const task = event.added.element as Task

      if (props.columnType === 'category') {
        // FEATURE-1336: Category columns: move task to target project
        const targetProjectId = props.status as string
        taskStore.moveTaskToProject(taskId, targetProjectId === 'uncategorized' ? '' : targetProjectId)
      } else if (props.columnType === 'priority') {
        // Priority columns: update task priority
        taskStore.moveTaskToPriority(taskId, props.status as 'high' | 'medium' | 'low')
      } else if (props.columnType === 'date') {
        // Date columns: update task due date
        taskStore.moveTaskToDate(taskId, props.status)
      } else {
        // Status columns (default): update task status
        await taskStore.moveTaskWithUndo(taskId, props.status)
      }

      // BUG-1335: When task is dropped in a different swimlane (project),
      // also update the task's projectId to match the target swimlane
      if (props.columnType !== 'category' && props.swimlaneId !== 'default' && props.swimlaneId !== '__date__' && props.swimlaneId !== '__category__') {
        const currentProjectId = task.projectId || ''
        if (currentProjectId !== props.swimlaneId) {
          taskStore.moveTaskToProject(taskId, props.swimlaneId)
        }
      }

      // Persist order for all tasks in this column after cross-column move
      persistOrderForColumn()
    } catch (error) {
      console.error('Failed to move task:', error)
      window.dispatchEvent(new CustomEvent('flowstate:error', {
        detail: { message: 'Failed to move task. Please try again.' }
      }))
    }
  }

  if (event.moved) {
    // Within-column reorder: persist new order values
    persistOrderForColumn()
  }
}

// Listen for drag-end broadcast from ANY column to resync DOM with Vue's vdom.
// SortableJS physically moves DOM elements between groups, causing Vue desync.
// Double-flush (clear → repopulate) forces Vue to re-render with proper bindings.
const handleDragEndBroadcast = () => {
  nextTick(() => {
    const current = [...props.tasks]
    allTasks.value = []
    nextTick(() => {
      allTasks.value = current
    })
  })
}

onMounted(() => {
  window.addEventListener('kanban:drag-end', handleDragEndBroadcast)
})

onUnmounted(() => {
  window.removeEventListener('kanban:drag-end', handleDragEndBroadcast)
})
</script>
