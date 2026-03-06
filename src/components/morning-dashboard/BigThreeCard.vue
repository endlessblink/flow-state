<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
// @ts-expect-error — sortablejs has no type declarations
import Sortable from 'sortablejs/modular/sortable.core.esm.js'
import draggable from 'vuedraggable'
import { useTaskStore } from '@/stores/tasks'
import { useMorningDashboard, type TaskPoolGroup } from '@/composables/useMorningDashboard'
import BigThreeSlot from './BigThreeSlot.vue'
import TaskPoolCard from './TaskPoolCard.vue'
import TaskContextMenu from '@/components/tasks/TaskContextMenu.vue'
import ConfirmationModal from '@/components/common/ConfirmationModal.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import type { Task } from '@/types/tasks'

const taskStore = useTaskStore()

const {
  big3Slots,
  allSlotsAssigned,
  groupedTasks,
  assignSlot,
  clearSlot,
  startMyDay,
} = useMorningDashboard()

// --- Drag state ---
const dragoverIndex = ref<number | null>(null)

// Drop zone refs for Sortable.create
const zoneRef0 = ref<HTMLElement | null>(null)
const zoneRef1 = ref<HTMLElement | null>(null)
const zoneRef2 = ref<HTMLElement | null>(null)
const sortableInstances: Sortable[] = []

// --- Search ---
const searchQuery = ref('')

// --- Task creation ---
const newTaskTitle = ref('')

// --- Context menu ---
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTask = ref<Task | null>(null)

// Visible groups (hide empty ones)
const visibleGroups = computed(() => {
  return Object.entries(groupedTasks.value)
    .filter(([_, group]) => group.tasks.length > 0) as [string, TaskPoolGroup][]
})

// Search results — when query is set, show flat list from ALL non-done tasks
const searchResults = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return null

  const assignedIds = new Set(
    big3Slots.value.map((s) => s.taskId).filter(Boolean)
  )

  // Use _rawTasks to bypass active view filters
  const tasks = taskStore._rawTasks ?? []
  return tasks
    .filter((t) => {
      if (t.status === 'done') return false
      if (assignedIds.has(t.id)) return false
      return t.title.toLowerCase().includes(query)
    })
    .slice(0, 20)
    .map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      dueDate: t.dueDate ?? '',
      projectId: t.projectId ?? '',
    }))
})

const hasAnyTasks = computed(() => {
  if (searchResults.value) return searchResults.value.length > 0
  return visibleGroups.value.length > 0
})

// --- Drop zone setup with native Sortable ---
function setupDropZones() {
  const zones = [zoneRef0.value, zoneRef1.value, zoneRef2.value]

  zones.forEach((el, index) => {
    if (!el) return

    const instance = Sortable.create(el, {
      group: { name: 'big3', pull: false, put: true },
      ghostClass: 'ghost-zone',
      animation: 150,
      onAdd(evt: Sortable.SortableEvent) {
        // Read task data from the cloned element's data attributes
        const item = evt.item as HTMLElement
        const taskId = item.getAttribute('data-task-id') ?? item.querySelector('[data-task-id]')?.getAttribute('data-task-id')
        const taskTitle = item.getAttribute('data-task-title') ?? item.querySelector('[data-task-title]')?.getAttribute('data-task-title')

        if (taskId && taskTitle) {
          assignSlot(index, taskId, taskTitle)
        }

        // Remove the cloned DOM element that Sortable inserted
        if (item.parentNode) {
          item.parentNode.removeChild(item)
        }

        dragoverIndex.value = null
      },
    })

    sortableInstances.push(instance)
  })
}

onMounted(() => {
  nextTick(() => {
    setupDropZones()
  })
})

onBeforeUnmount(() => {
  sortableInstances.forEach((s) => s.destroy())
  sortableInstances.length = 0
})

// --- Handlers ---
function handleClear(index: number) {
  clearSlot(index)
}

function handleContextMenu(taskId: string, event: MouseEvent) {
  const task = (taskStore.tasks ?? []).find((t) => t.id === taskId)
  if (!task) return

  contextMenuTask.value = task
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  showContextMenu.value = true
}

function closeContextMenu() {
  showContextMenu.value = false
  contextMenuTask.value = null
}

// --- Confirmation modal (delete / permanent delete) ---
const showConfirmModal = ref(false)
const confirmTitle = ref('Delete Task')
const confirmMessage = ref('Are you sure you want to delete this task? You can press Ctrl+Z to undo.')
const confirmText = ref('Delete')
const confirmActionFn = ref<(() => void | Promise<void>) | null>(null)

function handleConfirmDelete(taskId: string) {
  confirmTitle.value = 'Delete Task'
  confirmMessage.value = 'Are you sure you want to delete this task? You can press Ctrl+Z to undo.'
  confirmText.value = 'Delete'
  confirmActionFn.value = () => {
    taskStore.deleteTask(taskId)
  }
  showConfirmModal.value = true
}

async function handleConfirmPermanentDelete(taskId: string) {
  const task = taskStore.tasks.find(t => t.id === taskId)
  if (!task) return
  confirmTitle.value = 'Permanently Delete Task'
  confirmMessage.value = `Permanently delete "${task.title}"? This performs a hard delete from storage.`
  confirmText.value = 'Permanently Delete'
  confirmActionFn.value = async () => {
    const { getUndoSystem } = await import('@/composables/undoSingleton')
    await getUndoSystem().permanentlyDeleteTaskWithUndo(taskId)
  }
  showConfirmModal.value = true
}

async function executeConfirmAction() {
  const action = confirmActionFn.value
  showConfirmModal.value = false
  confirmActionFn.value = null
  if (action) {
    await action()
  }
}

function cancelConfirmAction() {
  showConfirmModal.value = false
  confirmActionFn.value = null
}

async function handleCreateTask() {
  const title = newTaskTitle.value.trim()
  if (!title) return

  const todayStr = new Date().toISOString().slice(0, 10)
  await taskStore.createTask({ title, dueDate: todayStr, status: 'todo' })
  newTaskTitle.value = ''
}

// Clear search when a slot gets assigned
watch(big3Slots, () => {
  // Keep search active — user might want to assign multiple from search results
}, { deep: true })
</script>

<template>
  <div class="big-three-card">
    <div class="card-header">
      <h2 class="card-title">Today's Big 3</h2>
      <span class="card-subtitle">Drag tasks from the left into your focus zones</span>
    </div>

    <div class="big-three-layout">
      <!-- LEFT: Task Pool -->
      <div class="task-pool-wrapper">
        <!-- Search -->
        <BaseInput
          v-model="searchQuery"
          placeholder="Search tasks..."
          type="text"
          class="pool-search"
        />

        <div class="task-pool">
          <!-- Search results mode -->
          <template v-if="searchResults">
            <div v-if="searchResults.length > 0" class="pool-section">
              <div class="section-header">
                <span class="section-accent" style="background-color: var(--brand-primary)" />
                <span class="section-label">Search Results</span>
                <span class="section-count">{{ searchResults.length }}</span>
              </div>

              <draggable
                :model-value="searchResults"
                :group="{ name: 'big3', pull: 'clone', put: false }"
                item-key="id"
                :animation="150"
                ghost-class="ghost-card"
                chosen-class="chosen-card"
                drag-class="drag-card"
                :force-fallback="true"
                fallback-class="sortable-fallback"
                :fallback-tolerance="3"
                tag="div"
                class="pool-drag-area"
              >
                <template #item="{ element }">
                  <TaskPoolCard
                    :task="element"
                    @contextmenu="handleContextMenu"
                  />
                </template>
              </draggable>
            </div>
            <div v-else class="pool-empty">
              No matching tasks found
            </div>
          </template>

          <!-- Normal grouped mode -->
          <template v-else-if="visibleGroups.length > 0">
            <div
              v-for="[key, group] in visibleGroups"
              :key="key"
              class="pool-section"
            >
              <div class="section-header">
                <span
                  class="section-accent"
                  :style="group.color ? { backgroundColor: group.color } : {}"
                />
                <span class="section-label">{{ group.label }}</span>
                <span class="section-count">{{ group.tasks.length }}</span>
              </div>

              <draggable
                :model-value="group.tasks"
                :group="{ name: 'big3', pull: 'clone', put: false }"
                item-key="id"
                :animation="150"
                ghost-class="ghost-card"
                chosen-class="chosen-card"
                drag-class="drag-card"
                :force-fallback="true"
                fallback-class="sortable-fallback"
                :fallback-tolerance="3"
                tag="div"
                class="pool-drag-area"
              >
                <template #item="{ element }">
                  <TaskPoolCard
                    :task="element"
                    @contextmenu="handleContextMenu"
                  />
                </template>
              </draggable>
            </div>
          </template>

          <div v-else class="pool-empty">
            No tasks yet — create one below!
          </div>
        </div>

        <!-- Quick create -->
        <div class="pool-create">
          <BaseInput
            v-model="newTaskTitle"
            placeholder="Create a new task..."
            type="text"
            class="create-input"
            @enter="handleCreateTask"
          />
          <button
            class="create-button"
            type="button"
            :disabled="!newTaskTitle.trim()"
            @click="handleCreateTask"
          >
            Add
          </button>
        </div>
      </div>

      <!-- RIGHT: Drop Zones -->
      <div class="drop-zones">
        <div
          v-for="(slot, index) in big3Slots"
          :key="index"
          :ref="(el: any) => { if (index === 0) zoneRef0 = el; else if (index === 1) zoneRef1 = el; else zoneRef2 = el; }"
          class="zone-wrapper"
          @dragenter.prevent="dragoverIndex = index"
          @dragover.prevent
          @dragleave="dragoverIndex = null"
        >
          <BigThreeSlot
            :slot="slot"
            :index="index"
            :is-dragover="dragoverIndex === index && !slot.title.trim()"
            @clear="handleClear"
          />
        </div>

        <!-- Start My Day button -->
        <button
          class="start-day-button"
          :class="{ 'start-day-button--ready': allSlotsAssigned }"
          :disabled="!allSlotsAssigned"
          type="button"
          @click="startMyDay"
        >
          Start My Day
        </button>
      </div>
    </div>

    <!-- Context Menu -->
    <TaskContextMenu
      :is-visible="showContextMenu"
      :x="contextMenuX"
      :y="contextMenuY"
      :task="contextMenuTask"
      @close="closeContextMenu"
      @confirm-delete="handleConfirmDelete"
      @confirm-permanent-delete="handleConfirmPermanentDelete"
    />

    <!-- Confirmation Modal -->
    <ConfirmationModal
      :is-open="showConfirmModal"
      :title="confirmTitle"
      :message="confirmMessage"
      :confirm-text="confirmText"
      @confirm="executeConfirmAction"
      @cancel="cancelConfirmAction"
    />
  </div>
</template>

<style scoped>
.big-three-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-6);
  background: var(--surface-primary);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
}

.card-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.card-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.card-subtitle {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.big-three-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-5);
  min-height: 280px;
}

.task-pool-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.pool-search {
  flex-shrink: 0;
}

.task-pool {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-height: 340px;
  overflow-y: auto;
  padding-right: var(--space-2);
  scrollbar-width: thin;
  scrollbar-color: var(--glass-border) transparent;
}

.task-pool::-webkit-scrollbar {
  width: 4px;
}

.task-pool::-webkit-scrollbar-track {
  background: transparent;
}

.task-pool::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: 2px;
}

.pool-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.section-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) 0;
}

.section-accent {
  width: 3px;
  height: 14px;
  border-radius: 2px;
  flex-shrink: 0;
}

.section-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.section-count {
  font-size: 0.65rem;
  color: var(--text-muted);
  background: var(--glass-bg-soft);
  padding: 0 var(--space-1);
  border-radius: var(--radius-sm);
}

.pool-drag-area {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.pool-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  color: var(--text-muted);
  font-size: 0.85rem;
}

.pool-create {
  display: flex;
  gap: var(--space-2);
  align-items: flex-end;
  flex-shrink: 0;
}

.create-input {
  flex: 1;
}

.create-button {
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-soft);
  color: var(--brand-primary);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-md);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: background 0.15s ease, opacity 0.15s ease;
  white-space: nowrap;
  height: 36px;
}

.create-button:hover:not(:disabled) {
  background: rgba(78, 205, 196, 0.12);
}

.create-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.drop-zones {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  justify-content: center;
}

.zone-wrapper {
  min-height: 48px;
}

/* Ghost classes for drag feedback */
.ghost-card {
  opacity: 0.5;
  background: rgba(78, 205, 196, 0.08) !important;
  border: 2px dashed var(--brand-primary) !important;
  border-radius: var(--radius-md) !important;
}

.chosen-card {
  opacity: 1;
  transform: scale(1.02);
  z-index: 1000;
}

.drag-card {
  opacity: 1;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  cursor: grabbing;
}

.ghost-zone {
  display: none;
}

.start-day-button {
  padding: var(--space-3) var(--space-6);
  background: var(--glass-bg-soft);
  color: var(--brand-primary);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: background 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease;
  align-self: center;
  min-width: 160px;
  margin-top: var(--space-2);
}

.start-day-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.start-day-button--ready {
  animation: pulse-teal 2s ease-in-out infinite;
}

.start-day-button--ready:hover {
  background: rgba(78, 205, 196, 0.12);
}

@keyframes pulse-teal {
  0%, 100% { box-shadow: 0 0 0 0 rgba(78, 205, 196, 0.4); }
  50% { box-shadow: 0 0 20px 4px rgba(78, 205, 196, 0.2); }
}

@media (prefers-reduced-motion: reduce) {
  .start-day-button--ready { animation: none; }
}

/* Mobile: stack vertically */
@media (max-width: 768px) {
  .big-three-layout {
    grid-template-columns: 1fr;
    gap: var(--space-4);
  }

  .task-pool {
    max-height: 200px;
    flex-direction: row;
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    padding-right: 0;
    padding-bottom: var(--space-2);
  }

  .pool-section {
    min-width: 200px;
    flex-shrink: 0;
  }
}
</style>
