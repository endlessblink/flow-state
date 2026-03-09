<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMessage } from 'naive-ui'
import { Zap, Clock, X, ChevronLeft } from 'lucide-vue-next'
import { useMorningRitual } from '@/composables/useMorningRitual'
import { useProjectStore } from '@/stores/projects'
import { useTaskStore } from '@/stores/tasks'
import MorningCandidateCard from './MorningCandidateCard.vue'
import CustomSelect from '@/components/common/CustomSelect.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import TaskContextMenu from '@/components/tasks/TaskContextMenu.vue'
import TaskEditModal from '@/components/tasks/TaskEditModal.vue'
import ConfirmationModal from '@/components/common/ConfirmationModal.vue'
import type { Task } from '@/types/tasks'

defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const taskStore = useTaskStore()
const message = useMessage()

const {
  focusIds,
  focusLimit,
  focusCount,
  isTimeBlockMode,
  autoPlaceMode,
  groupedCandidates,
  focusTasks,
  totalFocusMinutes,
  hasOverlap,
  timeBlocks,
  toggleFocus,
  goToTimeBlocks,
  goBackToPick,
  autoPlaceTasks,
  updateTimeBlock,
  startRitual,
} = useMorningRitual()

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

function handleConfirmDelete(taskId: string) {
  confirmTitle.value = 'Delete Task'
  confirmMessage.value = 'Are you sure you want to delete this task? You can press Ctrl+Z to undo.'
  confirmText.value = 'Delete'
  confirmActionFn.value = () => { taskStore.deleteTask(taskId) }
  showConfirmModal.value = true
}

async function handleConfirmPermanentDelete(taskId: string) {
  const task = (taskStore._rawTasks ?? []).find(t => t.id === taskId)
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
  if (action) await action()
}

function cancelConfirmAction() {
  showConfirmModal.value = false
  confirmActionFn.value = null
}

// --- Time block scheduling ---

// Time options: 15-min increments from 6:00 to 22:00
const timeOptions = computed(() => {
  const options: { label: string; value: string }[] = []
  for (let h = 6; h <= 22; h++) {
    for (const m of [0, 15, 30, 45]) {
      const hh = h.toString().padStart(2, '0')
      const mm = m.toString().padStart(2, '0')
      const ampm = h < 12 ? 'AM' : 'PM'
      const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h
      options.push({
        label: `${displayH}:${mm} ${ampm}`,
        value: `${hh}:${mm}`,
      })
    }
  }
  return options
})

const durationOptions = [
  { label: '25 min', value: 25 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1 hour', value: 60 },
  { label: '1.5 hours', value: 90 },
  { label: '2 hours', value: 120 },
]

function endTimeLabel(startTime: string, duration: number): string {
  const [h, m] = startTime.split(':').map(Number)
  const totalMin = h * 60 + m + duration
  const endH = Math.floor(totalMin / 60) % 24
  const endM = totalMin % 60
  const ampm = endH < 12 ? 'AM' : 'PM'
  const displayH = endH === 0 ? 12 : endH > 12 ? endH - 12 : endH
  return `${displayH}:${endM.toString().padStart(2, '0')} ${ampm}`
}

function handleUpdateStartTime(taskId: string, value: string | number | null) {
  if (typeof value !== 'string' || !value) return
  const existing = timeBlocks.value.get(taskId)
  if (existing) {
    updateTimeBlock(taskId, { ...existing, startTime: value })
  }
}

function handleUpdateDuration(taskId: string, value: string | number | null) {
  if (value === null || value === undefined) return
  const duration = Number(value)
  if (isNaN(duration)) return
  const existing = timeBlocks.value.get(taskId)
  if (existing) {
    updateTimeBlock(taskId, { ...existing, duration })
  }
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
            <div class="step-header">
              <button class="back-button" type="button" @click="goBackToPick()">
                <ChevronLeft :size="16" />
                <span>Back to pick</span>
              </button>
              <h2 class="step-title">Schedule your blocks</h2>
              <p class="step-subtitle">Choose how to place {{ focusCount }} tasks in your day</p>
            </div>

            <!-- Mode selector -->
            <div class="mode-selector">
              <button
                class="mode-option"
                :class="{ active: autoPlaceMode }"
                type="button"
                @click="autoPlaceMode = true"
              >
                <Zap :size="16" />
                <span>Auto-place</span>
                <small>Fill from now, sequentially</small>
              </button>
              <button
                class="mode-option"
                :class="{ active: !autoPlaceMode }"
                type="button"
                @click="autoPlaceMode = false"
              >
                <Clock :size="16" />
                <span>Manual</span>
                <small>Pick times yourself</small>
              </button>
            </div>

            <!-- Auto-place mode -->
            <div v-if="autoPlaceMode" class="auto-place-section">
              <BaseButton
                variant="secondary"
                @click="autoPlaceTasks()"
              >
                Auto-place from now
              </BaseButton>

              <!-- Mini timeline preview (replicates TimeBlockPicker pattern) -->
              <div v-if="focusTasks.length > 0" class="tb-timeline">
                <div class="tb-timeline-track">
                  <div
                    v-for="(task, i) in focusTasks"
                    :key="task.id"
                    class="tb-timeline-block"
                    :class="`tb-timeline-block--${i % 3}`"
                    :style="{
                      left: timeBlocks.has(task.id)
                        ? `${((parseInt(timeBlocks.get(task.id)!.startTime.split(':')[0]) * 60 + parseInt(timeBlocks.get(task.id)!.startTime.split(':')[1])) - 360) / (960 - 360) * 100}%`
                        : '0%',
                      width: timeBlocks.has(task.id)
                        ? `${timeBlocks.get(task.id)!.duration / (960 - 360) * 100}%`
                        : '0%',
                    }"
                  >
                    <span class="tb-timeline-label">{{ i + 1 }}</span>
                  </div>
                </div>
                <div class="tb-timeline-hours">
                  <span v-for="h in [6, 8, 10, 12, 14, 16, 18, 20, 22]" :key="h" class="tb-hour-mark">
                    {{ h > 12 ? h - 12 : h }}{{ h < 12 ? 'a' : 'p' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Manual mode -->
            <div v-else class="manual-place-section">
              <div
                v-for="(task, i) in focusTasks"
                :key="task.id"
                class="manual-row"
              >
                <div class="manual-task-info">
                  <span class="manual-slot-number">{{ i + 1 }}.</span>
                  <span class="manual-task-title">{{ task.title }}</span>
                </div>
                <div class="manual-controls">
                  <CustomSelect
                    :model-value="timeBlocks.get(task.id)?.startTime ?? '09:00'"
                    :options="timeOptions"
                    placeholder="Start"
                    :compact="true"
                    @update:model-value="handleUpdateStartTime(task.id, $event)"
                  />
                  <CustomSelect
                    :model-value="timeBlocks.get(task.id)?.duration ?? 30"
                    :options="durationOptions"
                    placeholder="Duration"
                    :compact="true"
                    @update:model-value="handleUpdateDuration(task.id, $event)"
                  />
                  <span class="manual-end-time">
                    until {{ endTimeLabel(
                      timeBlocks.get(task.id)?.startTime ?? '09:00',
                      timeBlocks.get(task.id)?.duration ?? 30
                    ) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Overlap warning -->
            <div v-if="hasOverlap" class="overlap-warning">
              Time blocks overlap \u2014 consider adjusting
            </div>

            <!-- Footer -->
            <div class="schedule-footer">
              <span v-if="totalFocusMinutes > 0" class="total-time">
                Total: {{ totalFocusMinutes }} min
              </span>
              <BaseButton
                variant="primary"
                @click="handleStartMyDay()"
              >
                Start My Day
              </BaseButton>
            </div>
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
  z-index: var(--z-modal);
}

.ritual-panel-overlay {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-modal) + 1);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  pointer-events: none;
}

.ritual-panel {
  position: relative;
  max-height: 70vh;
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
  right: var(--space-3);
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
  margin-left: var(--space-1);
}

.candidate-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-height: 40vh;
  overflow-y: auto;
  padding-right: var(--space-2);
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

.back-button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0;
  align-self: flex-start;
  transition: color 0.15s ease;
}

.back-button:hover {
  color: var(--text-primary);
}

.mode-selector {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.mode-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s ease;
  backdrop-filter: blur(8px);
}

.mode-option:hover {
  border-color: var(--border-hover);
  background: var(--glass-bg-medium);
}

.mode-option.active {
  border-color: var(--brand-primary);
  background: rgba(78, 205, 196, 0.06);
  color: var(--text-primary);
}

.mode-option span {
  font-size: 0.8rem;
  font-weight: 600;
}

.mode-option small {
  font-size: 0.65rem;
  color: var(--text-muted);
  text-align: center;
}

/* --- Auto place --- */

.auto-place-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  align-items: flex-start;
}

/* --- Mini timeline (ported from TimeBlockPicker) --- */

.tb-timeline {
  width: 100%;
  padding: var(--space-2) 0;
}

.tb-timeline-track {
  position: relative;
  height: 24px;
  background: var(--glass-bg-soft);
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  overflow: hidden;
}

.tb-timeline-block {
  position: absolute;
  top: 2px;
  height: 20px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  transition: left 0.3s ease, width 0.3s ease;
}

.tb-timeline-block--0 {
  background: rgba(78, 205, 196, 0.3);
  border: 1px solid var(--brand-primary);
}

.tb-timeline-block--1 {
  background: rgba(255, 195, 0, 0.25);
  border: 1px solid var(--color-warning);
}

.tb-timeline-block--2 {
  background: rgba(147, 130, 220, 0.25);
  border: 1px solid #9382dc;
}

.tb-timeline-label {
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--text-primary);
}

.tb-timeline-hours {
  display: flex;
  justify-content: space-between;
  padding: var(--space-1) 0 0;
}

.tb-hour-mark {
  font-size: 0.55rem;
  color: var(--text-muted);
}

/* --- Manual place --- */

.manual-place-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.manual-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--surface-primary);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
}

.manual-task-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}

.manual-slot-number {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--brand-primary);
  flex-shrink: 0;
}

.manual-task-title {
  font-size: 0.8rem;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.manual-controls {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.manual-end-time {
  font-size: 0.65rem;
  color: var(--text-muted);
  white-space: nowrap;
  min-width: 70px;
}

/* --- Overlap warning --- */

.overlap-warning {
  font-size: 0.7rem;
  color: var(--color-warning);
  padding: var(--space-1) var(--space-2);
  background: rgba(255, 195, 0, 0.06);
  border-radius: var(--radius-sm);
}

/* --- Schedule footer --- */

.schedule-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding-top: var(--space-2);
  border-top: 1px solid var(--glass-border);
}

.total-time {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 500;
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

  .mode-selector {
    grid-template-columns: 1fr;
  }

  .manual-row {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }

  .manual-controls {
    flex-wrap: wrap;
    width: 100%;
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

  .tb-timeline-block {
    transition: none;
  }
}
</style>
