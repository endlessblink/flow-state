<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMessage } from 'naive-ui'
import { X } from 'lucide-vue-next'
import { useMorningRitual } from '@/composables/useMorningRitual'
import { useProjectStore } from '@/stores/projects'
import { useTaskStore } from '@/stores/tasks'
import { useRecurrenceAwareDelete } from '@/composables/useRecurrenceAwareDelete'
import MorningCandidateCard from './MorningCandidateCard.vue'
import MorningTimeBlockCalendar from './MorningTimeBlockCalendar.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import TaskContextMenu from '@/components/tasks/TaskContextMenu.vue'
import TaskEditModal from '@/components/tasks/TaskEditModal.vue'
import ConfirmationModal from '@/components/common/ConfirmationModal.vue'
import type { Task } from '@/types/tasks'
import type { Big3Slot, TimeBlock } from '@/composables/useMorningDashboard'

defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const taskStore = useTaskStore()
const { recurrenceAwareDelete } = useRecurrenceAwareDelete()
const message = useMessage()

const {
  focusIds,
  focusLimit,
  focusCount,
  isTimeBlockMode,
  groupedCandidates,
  focusTasks,
  timeBlocks,
  toggleFocus,
  goToTimeBlocks,
  goBackToPick,
  updateTimeBlock,
  startRitual,
} = useMorningRitual()

// Bridge: convert ritual composable state → MorningTimeBlockCalendar props
const big3Slots = computed<Big3Slot[]>(() =>
  focusTasks.value.map(t => ({
    taskId: t.id,
    title: t.title,
    completed: false
  }))
)

const indexedTimeBlocks = computed<TimeBlock[]>(() =>
  focusIds.value.map(id => timeBlocks.value.get(id) ?? { startTime: '', duration: 60 })
)

function handleTimeBlockUpdate(index: number, block: TimeBlock) {
  const taskId = focusIds.value[index]
  if (taskId) updateTimeBlock(taskId, block)
}

// --- Footer microcopy ---
const footerText = computed(() => {
  if (focusCount.value === 0) return 'Tap a task to commit to it'
  if (focusCount.value < focusLimit.value)
    return `${focusCount.value} chosen \u2014 pick ${focusLimit.value - focusCount.value} more or continue`
  return 'Great lineup. Let\'s schedule them.'
})

// --- Focus toggle with toast ---
function handleToggleFocus(taskId: string) {
  const result = toggleFocus(taskId)
  if (result === false && !focusIds.value.includes(taskId)) {
    message.warning('Morning focus is full. Unselect one to swap.')
  }
}

// --- Context menu ---
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTask = ref<Task | null>(null)

function handleContextMenu(event: MouseEvent, task: { id: string }) {
  const fullTask = (taskStore._rawTasks ?? []).find(t => t.id === task.id)
  if (!fullTask) return
  contextMenuTask.value = fullTask
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  showContextMenu.value = true
}

function closeContextMenu() {
  showContextMenu.value = false
  contextMenuTask.value = null
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

// --- Confirmation modal (for context menu delete) ---
const showConfirmModal = ref(false)
const confirmTitle = ref('Delete Task')
const confirmMessage = ref('Are you sure you want to delete this task? You can press Ctrl+Z to undo.')
const confirmText = ref('Delete')
const confirmActionFn = ref<(() => void | Promise<void>) | null>(null)

// TASK-1520: recurrence-aware delete via composable
function handleConfirmDelete(taskId: string) {
  const allTasks = taskStore._rawTasks ?? []
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
  const allTasks = taskStore._rawTasks ?? []
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

function handleStartMyDay() {
  startRitual()
  emit('close')
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition name="backdrop-fade">
      <div
        v-if="show"
        class="ritual-panel-backdrop"
        @click="handleClose"
      />
    </Transition>

    <!-- Panel -->
    <Transition name="panel-slide">
      <div v-if="show" class="ritual-panel-overlay">
        <div class="ritual-panel" @click.stop>
          <!-- Close button -->
          <button
            class="panel-close"
            type="button"
            aria-label="Close"
            @click="handleClose"
          >
            <X :size="18" />
          </button>

          <!-- ===== PICK STEP ===== -->
          <div v-if="!isTimeBlockMode" class="ritual-step pick-step">
            <div class="step-header">
              <h2 class="step-title">Pick your morning focus</h2>
              <p class="step-subtitle">Choose up to {{ focusLimit }} tasks to commit to this morning</p>
            </div>

            <div class="focus-counter">
              <span class="counter-current">{{ focusCount }}</span>
              <span class="counter-separator">/</span>
              <span class="counter-max">{{ focusLimit }}</span>
              <span class="counter-label">chosen</span>
            </div>

            <div class="candidate-list">
              <template v-for="(group, key) in groupedCandidates" :key="key">
                <div v-if="group.tasks.length > 0" class="candidate-group">
                  <div class="group-header">
                    <span class="group-dot" :style="{ background: group.color }" />
                    <span class="group-label">{{ group.label }}</span>
                    <span class="group-count">{{ group.tasks.length }}</span>
                  </div>
                  <MorningCandidateCard
                    v-for="task in group.tasks"
                    :key="task.id"
                    :task="task"
                    :is-focused="focusIds.includes(task.id)"
                    :disabled="!focusIds.includes(task.id) && focusCount >= focusLimit"
                    @toggle="handleToggleFocus(task.id)"
                    @context-menu="handleContextMenu($event, task)"
                    @edit="handleEditTask(task.id)"
                  />
                </div>
              </template>

              <!-- Empty state -->
              <div v-if="Object.keys(groupedCandidates).length === 0" class="candidate-empty">
                No candidate tasks found. Create some tasks first.
              </div>
            </div>

            <div class="step-footer">
              <p class="footer-microcopy">{{ footerText }}</p>
              <BaseButton
                v-if="focusCount > 0"
                variant="primary"
                @click="goToTimeBlocks()"
              >
                Next: Schedule blocks
              </BaseButton>
            </div>
          </div>

          <!-- ===== SCHEDULE STEP ===== -->
          <div v-else class="ritual-step schedule-step">
            <MorningTimeBlockCalendar
              :big3-slots="big3Slots"
              :time-blocks="indexedTimeBlocks"
              @update:time-block="handleTimeBlockUpdate"
              @back="goBackToPick()"
              @start="handleStartMyDay()"
              @close="handleClose"
            />
          </div>
        </div>

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
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ===== OVERLAY & PANEL ===== */

.ritual-panel-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: var(--z-overlay);
}

.ritual-panel-overlay {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-overlay) + 1);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  pointer-events: none;
}

.ritual-panel {
  position: relative;
  max-height: 85vh;
  background: var(--overlay-component-bg, var(--surface-primary));
  border-top: 1px solid var(--glass-border);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  overflow-y: auto;
  padding: var(--space-4) var(--space-5);
  pointer-events: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--glass-border) transparent;
}

.ritual-panel::-webkit-scrollbar {
  width: 4px;
}

.ritual-panel::-webkit-scrollbar-track {
  background: transparent;
}

.ritual-panel::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: 2px;
}

.panel-close {
  position: absolute;
  top: var(--space-3);
  inset-inline-end: var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  color: var(--text-muted);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
  z-index: 1;
}

.panel-close:hover {
  color: var(--text-primary);
  border-color: var(--border-hover);
}

/* ===== TRANSITIONS ===== */

.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: transform 0.35s cubic-bezier(0.33, 1, 0.68, 1);
}

.panel-slide-enter-from,
.panel-slide-leave-to {
  transform: translateY(100%);
}

.backdrop-fade-enter-active,
.backdrop-fade-leave-active {
  transition: opacity 0.3s ease;
}

.backdrop-fade-enter-from,
.backdrop-fade-leave-to {
  opacity: 0;
}

/* ===== SHARED STEP STYLES ===== */

.ritual-step {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.step-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.step-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.step-subtitle {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin: 0;
}

/* ===== PICK STEP ===== */

.focus-counter {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
}

.counter-current {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--brand-primary);
  line-height: 1;
}

.counter-separator {
  font-size: 1rem;
  color: var(--text-muted);
}

.counter-max {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.counter-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-inline-start: var(--space-1);
}

.candidate-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-height: 40vh;
  overflow-y: auto;
  padding-inline-end: var(--space-2);
  scrollbar-width: thin;
  scrollbar-color: var(--glass-border) transparent;
}

.candidate-list::-webkit-scrollbar {
  width: 4px;
}

.candidate-list::-webkit-scrollbar-track {
  background: transparent;
}

.candidate-list::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: 2px;
}

.candidate-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.group-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) 0;
}

.group-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.group-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.group-count {
  font-size: 0.65rem;
  color: var(--text-muted);
  background: var(--glass-bg-soft);
  padding: 0 var(--space-1);
  border-radius: var(--radius-sm);
}

.candidate-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  color: var(--text-muted);
  font-size: 0.85rem;
}

.step-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding-top: var(--space-2);
  border-top: 1px solid var(--glass-border);
}

.footer-microcopy {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin: 0;
}

/* ===== SCHEDULE STEP ===== */

.schedule-step {
  min-height: 0;
  flex: 1;
}

/* ===== MOBILE ===== */

@media (max-width: 768px) {
  .ritual-panel {
    max-height: 100vh;
    border-radius: 0;
    padding: var(--space-4) var(--space-3);
  }

  .step-header {
    position: sticky;
    top: 0;
    background: var(--overlay-component-bg, var(--surface-primary));
    z-index: 1;
    padding-bottom: var(--space-2);
  }

  .candidate-list {
    max-height: none;
  }

}

@media (prefers-reduced-motion: reduce) {
  .panel-slide-enter-active,
  .panel-slide-leave-active {
    transition: none;
  }

  .backdrop-fade-enter-active,
  .backdrop-fade-leave-active {
    transition: none;
  }

}
</style>
