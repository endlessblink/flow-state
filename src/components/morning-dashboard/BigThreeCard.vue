<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import draggable from 'vuedraggable'
import { useTaskStore } from '@/stores/tasks'
import { useRecurrenceAwareDelete } from '@/composables/useRecurrenceAwareDelete'
import { useMorningDashboard, type TaskPoolGroup, type TimeBlock } from '@/composables/useMorningDashboard'
import BigThreeSlot from './BigThreeSlot.vue'
import TaskPoolCard from './TaskPoolCard.vue'
import TimeBlockPicker from './TimeBlockPicker.vue'
import MorningTimeBlockCalendar from './MorningTimeBlockCalendar.vue'
import TaskContextMenu from '@/components/tasks/TaskContextMenu.vue'
import TaskEditModal from '@/components/tasks/TaskEditModal.vue'
import ConfirmationModal from '@/components/common/ConfirmationModal.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import type { Task } from '@/types/tasks'

const taskStore = useTaskStore()
const { recurrenceAwareDelete } = useRecurrenceAwareDelete()

const {
  stage,
  goToTimeBlock,
  goBackToPick,
  big3Slots,
  allSlotsAssigned,
  groupedTasks,
  expandedGroups,
  toggleGroupExpanded,
  timeBlocks,
  assignSlot,
  clearSlot,
  startMyDay,
} = useMorningDashboard()

const GROUP_LIMITS: Record<string, number> = {
  overdue: 5,
  today: 5,
  inProgress: 3,
  highPriority: 5,
  other: 5,
}

function getVisibleTasks(key: string, tasks: PoolTask[]) {
  if (expandedGroups.value.has(key)) return tasks
  const limit = GROUP_LIMITS[key] ?? 5
  return tasks.slice(0, limit)
}

function getHiddenCount(key: string, tasks: PoolTask[]): number {
  if (expandedGroups.value.has(key)) return 0
  const limit = GROUP_LIMITS[key] ?? 5
  return Math.max(0, tasks.length - limit)
}

// --- Search ---
const searchQuery = ref('')

// --- Task creation ---
const newTaskTitle = ref('')

// --- Drag state (suppress click after drag) ---
const isDragging = ref(false)

// --- Recently assigned slot index (for animation) ---
const justAssigned = ref<number | null>(null)

// --- Context menu ---
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTask = ref<Task | null>(null)

// Pool task type for drag/drop
interface PoolTask {
  id: string
  title: string
  priority: 'low' | 'medium' | 'high' | null
  dueDate: string
  projectId: string
}

// Visible groups (hide empty ones)
const visibleGroups = computed(() => {
  return Object.entries(groupedTasks.value)
    .filter(([_, group]) => group.tasks.length > 0) as [string, TaskPoolGroup][]
})

// Search results
const searchResults = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return null

  const assignedIds = new Set(
    big3Slots.value.map((s) => s.taskId).filter(Boolean)
  )

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

// --- Drop zone models ---
const zone0 = ref<PoolTask[]>([])
const zone1 = ref<PoolTask[]>([])
const zone2 = ref<PoolTask[]>([])
const zones = [zone0, zone1, zone2]

// Sync from big3Slots -> zone arrays (e.g. on load from localStorage)
watch(big3Slots, (slots) => {
  slots.forEach((slot, i) => {
    if (slot.title.trim()) {
      zones[i].value = [{
        id: slot.taskId ?? `custom-${i}`,
        title: slot.title,
        priority: null,
        dueDate: '',
        projectId: '',
      }]
    } else {
      zones[i].value = []
    }
  })
}, { immediate: true, deep: true })

// Handle drop events from vuedraggable
function onZoneChange(index: number, evt: { added?: { element: PoolTask } }) {
  if (evt.added) {
    const task = evt.added.element
    triggerAssignAnimation(index)
    assignSlot(index, task.id, task.title)
  }
}

// --- Drag handlers ---
function onDragStart() {
  isDragging.value = true
}

function onDragEnd() {
  // Delay clearing so click handler can check
  setTimeout(() => { isDragging.value = false }, 50)
}

// --- Click-to-assign (suppressed during drag) ---
function clickAssign(task: PoolTask) {
  if (isDragging.value) return
  const emptyIndex = big3Slots.value.findIndex(s => !s.title.trim())
  if (emptyIndex === -1) return
  triggerAssignAnimation(emptyIndex)
  assignSlot(emptyIndex, task.id, task.title)
}

// --- Assign animation ---
function triggerAssignAnimation(index: number) {
  justAssigned.value = index
  setTimeout(() => { justAssigned.value = null }, 900)
}

// --- Time block update ---
function updateTimeBlock(index: number, block: TimeBlock) {
  timeBlocks.value[index] = block
}

// --- Task Edit Modal ---
const showEditModal = ref(false)
const editingTask = ref<Task | null>(null)

function handleEditTask(taskId: string) {
  const task = (taskStore._rawTasks ?? []).find(t => t.id === taskId)
  if (task) {
    editingTask.value = task
    showEditModal.value = true
  }
}

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

// --- Confirmation modal ---
const showConfirmModal = ref(false)
const confirmTitle = ref('Delete Task')
const confirmMessage = ref('Are you sure you want to delete this task? You can press Ctrl+Z to undo.')
const confirmText = ref('Delete')
const confirmActionFn = ref<(() => void | Promise<void>) | null>(null)

// TASK-1520: recurrence-aware delete via composable
function handleConfirmDelete(taskId: string) {
  const allTasks = taskStore._rawTasks ?? taskStore.tasks
  const task = allTasks.find(t => t.id === taskId)
  if (task?.recurrenceRule) {
    recurrenceAwareDelete(taskId)
    return
  }
  confirmTitle.value = 'Delete Task'
  confirmMessage.value = 'Are you sure you want to delete this task? You can press Ctrl+Z to undo.'
  confirmText.value = 'Delete'
  confirmActionFn.value = () => recurrenceAwareDelete(taskId)
  showConfirmModal.value = true
}

function handleConfirmPermanentDelete(taskId: string) {
  const allTasks = taskStore._rawTasks ?? taskStore.tasks
  const task = allTasks.find(t => t.id === taskId)
  if (!task) return
  if (task.recurrenceRule) {
    recurrenceAwareDelete(taskId, { permanent: true })
    return
  }
  confirmTitle.value = 'Permanently Delete Task'
  confirmMessage.value = `Permanently delete "${task.title}"? This performs a hard delete from storage.`
  confirmText.value = 'Permanently Delete'
  confirmActionFn.value = () => recurrenceAwareDelete(taskId, { permanent: true })
  showConfirmModal.value = true
}

async function executeConfirmAction() {
  const action = confirmActionFn.value
  showConfirmModal.value = false
  confirmActionFn.value = null
  if (action) await action()
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

</script>

<template>
  <div class="big-three-card">
    <!-- Stage 1: Pick tasks -->
    <template v-if="stage === 'pick'">
      <div class="card-header">
        <h2 class="card-title">Today's Big 3</h2>
        <span class="card-subtitle">Click a task or drag it into a focus zone</span>
      </div>

      <div class="big-three-layout">
        <!-- LEFT: Task Pool -->
        <div class="task-pool-wrapper">
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
                  :sort="false"
                  item-key="id"
                  :animation="0"
                  ghost-class="ghost-card"
                  chosen-class="chosen-card"
                  drag-class="drag-card"
                  :force-fallback="true"
                  :fallback-on-body="true"
                  fallback-class="sortable-fallback"
                  :fallback-tolerance="5"
                  tag="div"
                  class="pool-drag-area"
                  @start="onDragStart"
                  @end="onDragEnd"
                >
                  <template #item="{ element }">
                    <TaskPoolCard
                      :task="element"
                      @click="clickAssign(element)"
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
                  :model-value="getVisibleTasks(key, group.tasks)"
                  :group="{ name: 'big3', pull: 'clone', put: false }"
                  :sort="false"
                  item-key="id"
                  :animation="0"
                  ghost-class="ghost-card"
                  chosen-class="chosen-card"
                  drag-class="drag-card"
                  :force-fallback="true"
                  :fallback-on-body="true"
                  fallback-class="sortable-fallback"
                  :fallback-tolerance="5"
                  tag="div"
                  class="pool-drag-area"
                  @start="onDragStart"
                  @end="onDragEnd"
                >
                  <template #item="{ element }">
                    <TaskPoolCard
                      :task="element"
                      @click="clickAssign(element)"
                      @contextmenu="handleContextMenu"
                    />
                  </template>
                </draggable>

                <button
                  v-if="getHiddenCount(key, group.tasks) > 0"
                  class="show-more-btn"
                  type="button"
                  @click="toggleGroupExpanded(key)"
                >
                  Show {{ getHiddenCount(key, group.tasks) }} more
                </button>
                <button
                  v-else-if="expandedGroups.has(key) && group.tasks.length > (GROUP_LIMITS[key] ?? 5)"
                  class="show-more-btn"
                  type="button"
                  @click="toggleGroupExpanded(key)"
                >
                  Show less
                </button>
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
            class="zone-wrapper"
            :class="{ 'zone-wrapper--pop': justAssigned === index }"
          >
            <!-- Filled/completed slot -->
            <BigThreeSlot
              v-if="slot.title.trim()"
              :slot="slot"
              :index="index"
              @clear="handleClear"
            />

            <!-- Empty slot: vuedraggable drop target -->
            <draggable
              v-else
              v-model="zones[index].value"
              :group="{ name: 'big3', pull: false, put: true }"
              item-key="id"
              :animation="0"
              ghost-class="ghost-zone-item"
              :force-fallback="true"
              :fallback-on-body="true"
              fallback-class="sortable-fallback"
              :fallback-tolerance="5"
              tag="div"
              class="zone-drop-target"
              @change="(evt: any) => onZoneChange(index, evt)"
            >
              <template #item="{ element }">
                <div class="zone-temp-item">{{ element.title }}</div>
              </template>
              <template #header>
                <BigThreeSlot
                  :slot="slot"
                  :index="index"
                />
              </template>
            </draggable>
          </div>

          <!-- Next: Time Block button -->
          <button
            class="start-day-button"
            :class="{ 'start-day-button--ready': allSlotsAssigned }"
            :disabled="!allSlotsAssigned"
            type="button"
            @click="goToTimeBlock"
          >
            Next: Time Block
          </button>
        </div>
      </div>
    </template>

    <!-- Stage 2: Time Block (Calendar View) -->
    <template v-else-if="stage === 'timeblock'">
      <MorningTimeBlockCalendar
        :big3-slots="big3Slots"
        :time-blocks="timeBlocks"
        @update:time-block="updateTimeBlock"
        @back="goBackToPick"
        @start="startMyDay"
      />
    </template>

    <!-- Context Menu -->
    <TaskContextMenu
      :is-visible="showContextMenu"
      :x="contextMenuX"
      :y="contextMenuY"
      :task="contextMenuTask"
      @close="closeContextMenu"
      @edit="handleEditTask"
      @confirm-delete="handleConfirmDelete"
      @confirm-permanent-delete="handleConfirmPermanentDelete"
    />

    <!-- Task Edit Modal -->
    <TaskEditModal
      :is-open="showEditModal"
      :task="editingTask"
      @close="showEditModal = false; editingTask = null"
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

<!-- Global styles (unscoped — @property is a global at-rule, SortableJS appends to body) -->
<style>
@property --glow-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

.sortable-fallback {
  opacity: 0.95 !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3) !important;
  cursor: grabbing !important;
  z-index: 10000 !important;
  transition: none !important;
  animation: none !important;
}
</style>

<style scoped>
.big-three-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
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
  grid-template-columns: 1fr 280px;
  gap: var(--space-4);
}

.task-pool-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-height: 0;
  overflow: hidden;
}

.pool-search {
  flex-shrink: 0;
}

.task-pool {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 1;
  min-height: 0;
  max-height: 280px;
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

.show-more-btn {
  background: none;
  border: none;
  color: var(--brand-primary);
  font-size: 0.7rem;
  font-weight: 500;
  cursor: pointer;
  padding: var(--space-1) 0;
  opacity: 0.8;
  transition: opacity 0.15s ease;
}

.show-more-btn:hover {
  opacity: 1;
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
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(8px);
  align-self: start;
}

.zone-wrapper {
  min-height: 48px;
  position: relative;
}

.zone-wrapper--pop {
  animation: slot-engage 0.7s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Sweeping border glow — rotating energy beam around the slot */
.zone-wrapper--pop::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: var(--radius-md);
  background: conic-gradient(
    from var(--glow-angle, 0deg),
    transparent 0%,
    rgba(78, 205, 196, 0.8) 10%,
    rgba(78, 205, 196, 0) 40%
  );
  animation: border-sweep 0.6s linear forwards;
  z-index: -1;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  padding: 2px;
}

/* Expanding glow burst */
.zone-wrapper--pop::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--radius-md);
  box-shadow:
    0 0 12px rgba(78, 205, 196, 0.6),
    0 0 24px rgba(78, 205, 196, 0.3),
    inset 0 0 12px rgba(78, 205, 196, 0.1);
  animation: glow-burst 0.8s ease-out forwards;
  pointer-events: none;
  z-index: 0;
}

@keyframes slot-engage {
  0% { transform: scale(0.9); opacity: 0.5; }
  30% { transform: scale(1.06); }
  50% { transform: scale(0.98); }
  70% { transform: scale(1.02); }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes border-sweep {
  0% { --glow-angle: 0deg; opacity: 1; }
  80% { opacity: 1; }
  100% { --glow-angle: 360deg; opacity: 0; }
}

@keyframes glow-burst {
  0% {
    box-shadow:
      0 0 0 rgba(78, 205, 196, 0),
      0 0 0 rgba(78, 205, 196, 0),
      inset 0 0 0 rgba(78, 205, 196, 0);
    opacity: 0;
  }
  20% {
    box-shadow:
      0 0 16px rgba(78, 205, 196, 0.7),
      0 0 32px rgba(78, 205, 196, 0.4),
      inset 0 0 16px rgba(78, 205, 196, 0.15);
    opacity: 1;
  }
  100% {
    box-shadow:
      0 0 2px rgba(78, 205, 196, 0.1),
      0 0 4px rgba(78, 205, 196, 0.05),
      inset 0 0 0 rgba(78, 205, 196, 0);
    opacity: 0;
  }
}

.zone-drop-target {
  min-height: 48px;
}

.zone-temp-item {
  display: none; /* BigThreeSlot takes over rendering once assigned */
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
  transition: none !important;
}

.drag-card {
  opacity: 1;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  cursor: grabbing;
  transition: none !important;
}

.ghost-zone-item {
  opacity: 0.5;
  background: rgba(78, 205, 196, 0.08) !important;
  border: 2px dashed var(--brand-primary) !important;
  border-radius: var(--radius-md) !important;
  min-height: 48px;
}

.start-day-button {
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-soft);
  color: var(--brand-primary);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-md);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: background 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease;
  width: 100%;
  margin-top: var(--space-1);
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

/* Mobile: stack vertically, drop zones first */
@media (max-width: 768px) {
  .big-three-layout {
    grid-template-columns: 1fr;
    gap: var(--space-3);
  }

  .drop-zones {
    order: -1;
  }

  .task-pool {
    max-height: 200px;
  }
}
</style>
