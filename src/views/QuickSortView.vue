<template>
  <div class="quick-sort-view">
    <!-- Header -->
    <header class="qs-header">
      <div class="header-left">
        <h1 class="qs-title">
          <Zap :size="18" class="zap-icon" />
          <span>{{ $t('views.quick_sort') }}</span>
        </h1>
      </div>
      <div class="header-stats">
        <span v-if="!isComplete && progress.total > 0" class="stat-badge">
          {{ progress.total - progress.current }}
        </span>
        <span v-if="!isComplete && currentStreak > 2" class="streak-badge">{{ currentStreak }}</span>
      </div>
      <button class="close-button" aria-label="Exit Quick Sort" @click="handleExit">
        <X :size="20" />
      </button>
    </header>

    <!-- Glowing Progress Bar -->
    <div v-if="!isComplete && progress.total > 0 && activeTab === 'sort'" class="glow-progress-track">
      <div class="glow-progress-fill" :style="{ width: `${progressPercentage}%` }" />
      <div class="glow-progress-glow" :style="{ insetInlineStart: `${progressPercentage}%` }" />
    </div>

    <!-- Tab Navigation -->
    <div class="tab-navigation">
      <button class="tab-btn" :class="{ active: activeTab === 'sort' }" @click="activeTab = 'sort'">
        <Zap :size="16" />
        Sort
        <span v-if="uncategorizedCount > 0" class="tab-badge">{{ uncategorizedCount }}</span>
      </button>
      <button class="tab-btn" :class="{ active: activeTab === 'capture' }" @click="activeTab = 'capture'">
        <Plus :size="16" />
        Capture
      </button>
    </div>

    <!-- Main Content -->
    <div class="qs-content">
      <Transition name="tab-fade" mode="out-in">
        <!-- CAPTURE TAB -->
        <QuickCaptureTab
          v-if="activeTab === 'capture'"
          key="capture"
          ref="captureTabRef"
        />

        <!-- SORT TAB -->
        <div v-else key="sort" class="sort-phase">
          <!-- Active sort layout -->
          <div v-if="currentTask && !isComplete" class="sort-center">
            <!-- Task Context Bar -->
            <div class="task-context-bar">
              <div class="ctx-item">
                <CalendarDays :size="14" />
                <span v-if="taskDueDate" :class="{ 'ctx-overdue': isTaskOverdue }">{{ taskDueDate }}</span>
                <span v-else class="ctx-empty">No date</span>
              </div>
              <div class="ctx-divider" />
              <div class="ctx-item">
                <span class="ctx-priority-dot" :class="`priority-${currentTask.priority || 'none'}`" />
                <span class="capitalize">{{ currentTask.priority || 'None' }}</span>
              </div>
              <div class="ctx-divider" />
              <div class="ctx-item">
                <FolderOpen :size="14" />
                <span v-if="currentTaskProject" class="ctx-project">
                  <span v-if="currentTaskProject.emoji" class="ctx-emoji">{{ currentTaskProject.emoji }}</span>
                  {{ currentTaskProject.name }}
                </span>
                <span v-else class="ctx-empty">No project</span>
              </div>
            </div>

            <!-- Edit hint (above card) -->
            <div class="direction-hint hint-vertical">
              <Pencil :size="14" />
              <span>Edit</span>
              <span class="hint-arrow">&darr;</span>
            </div>

            <!-- Card row: left hint + card stack + right hint -->
            <div class="card-row">
              <div class="direction-hint hint-side">
                <span class="hint-arrow">&larr;</span>
                <Trash2 :size="14" />
                <span>Delete</span>
              </div>

              <div class="card-stack">
                <div
                  v-for="(task, idx) in stackPreview"
                  :key="task.id"
                  class="stack-card"
                  :style="{
                    transform: `scale(${1 - (idx + 1) * 0.04}) translateY(${(idx + 1) * 6}px)`,
                    opacity: 1 - (idx + 1) * 0.25,
                    zIndex: 10 - (idx + 1)
                  }"
                />

                <Transition name="card-slide" mode="out-in">
                  <QuickSortCard
                    :key="currentTaskId ?? undefined"
                    :task="currentTask"
                    class="stack-active"
                    @swipe-right="handleSave"
                    @swipe-left="requestDelete"
                    @swipe-up="handleEditTask"
                    @swipe-down="handleSkip"
                  />
                </Transition>
              </div>

              <div class="direction-hint hint-side">
                <span>Save</span>
                <Save :size="14" />
                <span class="hint-arrow">&rarr;</span>
              </div>
            </div>

            <!-- Skip hint (below card) -->
            <div class="direction-hint hint-vertical">
              <span class="hint-arrow">&darr;</span>
              <SkipForward :size="14" />
              <span>Skip</span>
            </div>

            <!-- Compact action bar -->
            <div class="compact-actions">
              <button class="action-btn done" @click="handleMarkDone">
                <CheckCircle :size="18" />
                <span>Done</span>
                <kbd>D</kbd>
              </button>
              <button class="action-btn save" @click="handleSave">
                <Save :size="18" />
                <span>Save</span>
                <span v-if="isTaskDirty" class="dirty-dot" />
                <kbd>S</kbd>
              </button>
              <button v-if="canUndo" class="action-btn undo" @click="handleUndo">
                <Undo2 :size="16" />
                <span>Undo</span>
              </button>
            </div>

            <!-- Keyboard hint -->
            <div class="key-hint">
              Drag card or use arrow keys &bull; D done &bull; 1-9 assign
            </div>
          </div>

          <!-- Empty State -->
          <div v-else-if="!isComplete && uncategorizedTasks.length === 0" class="empty-state">
            <CheckCircle :size="64" />
            <h2>All Caught Up!</h2>
            <p>You have no uncategorized tasks.</p>
            <button class="primary-button" @click="handleExit">
              Return to Tasks
            </button>
          </div>

          <!-- Completion State -->
          <div v-else-if="isComplete" class="completion-state">
            <div class="celebration-icon">
              &#x1F389;
            </div>
            <h2>Amazing Work!</h2>
            <p class="completion-message">
              You've sorted all your tasks!
            </p>
            <div v-if="sessionSummary" class="session-stats">
              <div class="stat-card">
                <span class="stat-value">{{ sessionSummary.tasksProcessed }}</span>
                <span class="stat-label">Tasks Sorted</span>
              </div>
              <div class="stat-card">
                <span class="stat-value">{{ formatTime(sessionSummary.timeSpent) }}</span>
                <span class="stat-label">Time Taken</span>
              </div>
              <div class="stat-card">
                <span class="stat-value">{{ sessionSummary.efficiency.toFixed(1) }}</span>
                <span class="stat-label">Tasks/Min</span>
              </div>
              <div v-if="sessionSummary.streakDays > 0" class="stat-card streak-card">
                <span class="stat-value">{{ sessionSummary.streakDays }}</span>
                <span class="stat-label">Day Streak</span>
              </div>
            </div>
            <button class="primary-button" @click="handleExit">
              <CheckCircle :size="20" />
              {{ $t('quick_sort.done') }}
            </button>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Action Feedback Overlay -->
    <Transition name="celebration">
      <div
        v-if="actionFeedback"
        class="feedback-overlay"
        :class="actionFeedback.type"
        aria-live="assertive"
      >
        <div class="celebration-ring" />
        <CheckCircle v-if="actionFeedback.type === 'success'" :size="28" class="celebration-icon" />
        <span class="feedback-text">{{ actionFeedback.text }}</span>
        <span v-if="actionFeedback.type === 'success'" class="celebration-sparkle" aria-hidden="true">✨</span>
      </div>
    </Transition>

    <!-- Quick Edit Panel (slide-up, inside main content area) -->
    <Transition name="panel-slide">
      <div v-if="showEditPanel && currentTask" class="edit-panel-overlay" @click.self="showEditPanel = false">
        <div class="edit-panel">
          <div class="edit-panel-handle" @click="showEditPanel = false" />

          <h3 class="edit-panel-title" dir="auto">
            {{ currentTask.title }}
          </h3>

          <!-- Priority pills -->
          <div class="control-row">
            <span class="control-label">Priority</span>
            <div class="pill-group">
              <button class="pill" :class="{ active: currentTask.priority === 'low' }" @click="handleTaskUpdate({ priority: 'low' })">
                Low
              </button>
              <button class="pill" :class="{ active: currentTask.priority === 'medium' }" @click="handleTaskUpdate({ priority: 'medium' })">
                Med
              </button>
              <button class="pill" :class="{ active: currentTask.priority === 'high' }" @click="handleTaskUpdate({ priority: 'high' })">
                High
              </button>
            </div>
          </div>

          <!-- Date pills -->
          <div class="control-row">
            <span class="control-label">Due</span>
            <div class="pill-group pill-scroll">
              <button class="pill" :class="{ active: isDueToday }" @click="setQuickDate('today')">
                Today
              </button>
              <button class="pill" :class="{ active: isDueTomorrow }" @click="setQuickDate('tomorrow')">
                +1
              </button>
              <button class="pill" @click="setQuickDate('in3days')">
                +3
              </button>
              <button class="pill" :class="{ active: isDueWeekend }" @click="setQuickDate('weekend')">
                Wknd
              </button>
              <button class="pill" :class="{ active: isDueNextWeek }" @click="setQuickDate('nextweek')">
                +7
              </button>
              <button class="pill" @click="setQuickDate('in2weeks')">
                +14
              </button>
              <button class="pill" @click="setQuickDate('in30days')">
                +30
              </button>
              <NPopover trigger="click" placement="bottom" :show-arrow="false">
                <template #trigger>
                  <button class="pill date-picker-trigger" :class="{ active: currentTask.dueDate && !isDueToday && !isDueTomorrow && !isDueWeekend && !isDueNextWeek }">
                    <Calendar :size="14" />
                  </button>
                </template>
                <div @click.stop>
                  <NDatePicker
                    panel
                    :value="currentTask.dueDate ? new Date(currentTask.dueDate + 'T00:00:00').getTime() : null"
                    type="date"
                    :actions="[]"
                    @update:value="handleDatePickerUpdate"
                  />
                </div>
              </NPopover>
              <button class="pill clear" :class="{ active: !currentTask.dueDate }" @click="setQuickDate('clear')">
                <X :size="14" />
              </button>
            </div>
          </div>

          <!-- Project Selector -->
          <CategorySelector
            compact
            @select="handleCategorize"
            @skip="handleSkip"
            @create-new="showProjectModal = true"
          />

          <!-- Full edit button -->
          <button class="pill full-edit-pill" @click="openFullEdit">
            <Pencil :size="14" />
            Full Edit
          </button>
        </div>
      </div>
    </Transition>

    <!-- Modals -->
    <ProjectModal v-if="showProjectModal" :is-open="showProjectModal" @close="showProjectModal = false" />
    <TaskEditModal :is-open="showEditModal" :task="taskToEdit" @close="showEditModal = false; taskToEdit = null" />

    <!-- Delete Confirmation Modal -->
    <BaseModal
      :is-open="showDeleteConfirm"
      size="sm"
      variant="danger"
      :show-footer="false"
      :show-header="false"
      @close="showDeleteConfirm = false"
    >
      <div class="delete-confirm-content">
        <div class="delete-confirm-icon">
          <Trash2 :size="32" />
        </div>
        <h3 class="delete-confirm-title">
          Delete this task?
        </h3>
        <p class="delete-confirm-desc">
          This action cannot be undone. The task will be permanently removed.
        </p>
        <div class="delete-confirm-actions">
          <button class="dc-cancel-btn" @click="showDeleteConfirm = false">
            Cancel
          </button>
          <button class="dc-delete-btn" @click="confirmDelete">
            Delete
          </button>
        </div>
      </div>
    </BaseModal>
    <!-- Nothing Set Reminder (positioned inside panel, not viewport) -->
    <Transition name="fade">
      <div v-if="showNothingSetReminder" class="nothing-set-overlay" @click.self="cancelSaveReminder">
        <div class="nothing-set-modal">
          <span class="nothing-set-emoji" aria-hidden="true">🤔</span>
          <h3 class="nothing-set-title">
            Whoops, nothing changed!
          </h3>
          <p class="nothing-set-desc">
            You swiped without setting anything. Go back and triage, or save as-is.
          </p>
          <div class="nothing-set-actions">
            <button class="ns-set-btn" @click="cancelSaveReminder">
              Go back
            </button>
            <button class="ns-save-btn" @click="confirmSaveAnyway">
              Save as-is
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { NPopover, NDatePicker } from 'naive-ui'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  Zap, X, CheckCircle, Undo2, Plus, Save, Trash2, Pencil, SkipForward,
  CalendarDays, FolderOpen, Calendar
} from 'lucide-vue-next'
import { useQuickSort } from '@/composables/useQuickSort'
import { useQuickCapture } from '@/composables/useQuickCapture'
import { useTaskStore } from '@/stores/tasks'
import { useProjectStore } from '@/stores/projects'
import QuickSortCard from '@/components/QuickSortCard.vue'
import QuickCaptureTab from '@/components/quicksort/QuickCaptureTab.vue'
import CategorySelector from '@/components/layout/CategorySelector.vue'
import ProjectModal from '@/components/projects/ProjectModal.vue'
import TaskEditModal from '@/components/tasks/TaskEditModal.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import type { SessionSummary } from '@/stores/quickSort'
import type { Task } from '@/types/tasks'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const taskStore = useTaskStore()
const projectStore = useProjectStore()
const quickCapture = useQuickCapture()

const activeTab = ref<'sort' | 'capture'>('sort')
const captureTabRef = ref<InstanceType<typeof QuickCaptureTab> | null>(null)

const uncategorizedCount = computed(() => uncategorizedTasks.value.length)

const showProjectModal = ref(false)
const showEditModal = ref(false)
const showEditPanel = ref(false)
const showDeleteConfirm = ref(false)
const showNothingSetReminder = ref(false)
const actionFeedback = ref<{ text: string; type: 'success' | 'info' | 'danger' | 'warning' } | null>(null)
const celebrationLabels = ['Sorted!', 'Nice!', 'Got it!', 'Done!', 'Sweet!']
const celebrationLabel = ref('Sorted!')
function pickCelebrationLabel() {
  celebrationLabel.value = celebrationLabels[Math.floor(Math.random() * celebrationLabels.length)]
}
const sessionSummary = ref<SessionSummary | null>(null)
const taskToEdit = ref<Task | null>(null)
const userTouchedCard = ref(false)

const stackPreview = computed(() => {
  if (!currentTask.value) return []
  const currentIdx = uncategorizedTasks.value.findIndex(t => t.id === currentTask.value!.id)
  if (currentIdx === -1) return []
  return uncategorizedTasks.value.slice(currentIdx + 1, currentIdx + 4)
})

const progressPercentage = computed(() => {
  if (progress.value.total === 0) return 0
  return Math.round((progress.value.current / progress.value.total) * 100)
})

function showFeedback(text: string, type: 'success' | 'info' | 'danger' | 'warning' = 'info', duration = 600) {
  actionFeedback.value = { text, type }
  setTimeout(() => { actionFeedback.value = null }, duration)
}

watch(() => route.query.tab, (tab) => {
  if (tab === 'capture') activeTab.value = 'capture'
}, { immediate: true })

watch(() => quickCapture.defaultTabOnOpen.value, (defaultTab) => {
  if (defaultTab === 'capture' && route.name === 'quick-sort') activeTab.value = 'capture'
}, { immediate: true })


const {
  currentTask, currentTaskId, uncategorizedTasks, progress, isComplete,
  isTaskDirty, canUndo, currentStreak,
  startSession, endSession, categorizeTask, saveTask,
  markTaskDone, markDoneAndDeleteTask, skipTask, undoLastCategorization, tryResumeSession
} = useQuickSort()

// Reset touch tracking when task changes
watch(currentTaskId, () => { userTouchedCard.value = false })

onMounted(() => {
  const resumed = tryResumeSession()
  if (!resumed) startSession()
  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => { window.removeEventListener('keydown', handleGlobalKeydown) })

watch(isComplete, (completed) => {
  if (completed) sessionSummary.value = endSession() || null
})

function handleCategorize(projectId: string) {
  if (!currentTask.value) return
  userTouchedCard.value = true
  categorizeTask(currentTask.value.id, projectId)
}

function handleSave() {
  if (!currentTask.value) return
  if (!userTouchedCard.value) {
    showNothingSetReminder.value = true
    return
  }
  _doSave()
}

function _doSave() {
  if (!currentTask.value) return
  pickCelebrationLabel()
  showFeedback(celebrationLabel.value, 'success')
  saveTask()
}

function confirmSaveAnyway() {
  showNothingSetReminder.value = false
  _doSave()
}

function cancelSaveReminder() {
  showNothingSetReminder.value = false
}

async function handleTaskUpdate(updates: Partial<Task>) {
  if (!currentTask.value) return
  userTouchedCard.value = true
  await taskStore.updateTask(currentTask.value.id, updates)
}

function handleSkip() {
  showFeedback('Skipped', 'warning')
  skipTask()
}

function handleUndo() { if (canUndo) undoLastCategorization() }

function handleMarkDone() {
  if (!currentTask.value) return
  showFeedback('Done!', 'success')
  markTaskDone(currentTask.value.id)
}

function requestDelete() {
  if (!currentTask.value) return
  showDeleteConfirm.value = true
}

function confirmDelete() {
  if (!currentTask.value) return
  showDeleteConfirm.value = false
  showFeedback('Deleted', 'danger')
  markDoneAndDeleteTask(currentTask.value.id)
}

function handleEditTask() {
  if (!currentTask.value) return
  showEditPanel.value = true
}

function openFullEdit() {
  if (!currentTask.value) return
  showEditPanel.value = false
  taskToEdit.value = currentTask.value
  showEditModal.value = true
}

function handleExit() { router.push({ name: 'board' }) }

// Quick date setters
const isDueToday = computed(() => {
  if (!currentTask.value?.dueDate) return false
  const d = new Date(currentTask.value.dueDate)
  const today = new Date(); today.setHours(0,0,0,0); d.setHours(0,0,0,0)
  return d.getTime() === today.getTime()
})

const isDueTomorrow = computed(() => {
  if (!currentTask.value?.dueDate) return false
  const d = new Date(currentTask.value.dueDate)
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0,0,0,0); d.setHours(0,0,0,0)
  return d.getTime() === tomorrow.getTime()
})

const isDueNextWeek = computed(() => {
  if (!currentTask.value?.dueDate) return false
  const d = new Date(currentTask.value.dueDate)
  const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7)
  nextWeek.setHours(0,0,0,0); d.setHours(0,0,0,0)
  return d.getTime() === nextWeek.getTime()
})

const isDueWeekend = computed(() => {
  if (!currentTask.value?.dueDate) return false
  const d = new Date(currentTask.value.dueDate)
  d.setHours(0,0,0,0)
  const nextSat = getNextSaturday()
  return d.getTime() === nextSat.getTime()
})

function getNextSaturday(): Date {
  const d = new Date()
  d.setHours(0,0,0,0)
  const day = d.getDay() // 0=Sun, 6=Sat
  const daysUntilSat = (6 - day + 7) % 7 || 7  // if today is Saturday, go to next Saturday
  d.setDate(d.getDate() + daysUntilSat)
  return d
}

function setQuickDate(preset: string) {
  const d = new Date(); d.setHours(0,0,0,0)
  if (preset === 'today') { /* already today */ }
  else if (preset === 'tomorrow') d.setDate(d.getDate() + 1)
  else if (preset === 'in3days') d.setDate(d.getDate() + 3)
  else if (preset === 'weekend') { const sat = getNextSaturday(); d.setTime(sat.getTime()) }
  else if (preset === 'nextweek') d.setDate(d.getDate() + 7)
  else if (preset === 'in2weeks') d.setDate(d.getDate() + 14)
  else if (preset === 'in30days') d.setDate(d.getDate() + 30)
  else if (preset === 'clear') {
    handleTaskUpdate({ dueDate: '' })
    return
  }
  handleTaskUpdate({ dueDate: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })
}

function handleDatePickerUpdate(timestamp: number | null) {
  if (!timestamp) {
    handleTaskUpdate({ dueDate: '' })
    return
  }
  const d = new Date(timestamp)
  handleTaskUpdate({ dueDate: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })
}

// Keyboard shortcuts
function shouldIgnoreKeyEvent(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement
  if (!target) return false
  const tag = target.tagName?.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' ||
    target.isContentEditable || !!target.closest('[role="dialog"], .modal, .n-modal')
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (shouldIgnoreKeyEvent(event)) return
  if (event.key === 'Escape') {
    event.preventDefault()
    if (showEditPanel.value) { showEditPanel.value = false; return }
    handleExit()
  }
  if ((event.ctrlKey || event.metaKey) && event.key === 'z') { event.preventDefault(); event.stopImmediatePropagation(); handleUndo() }
  if (activeTab.value !== 'sort') return

  if (event.key === 'd' || event.key === 'D') { event.preventDefault(); handleMarkDone() }
  if ((event.key === 's' || event.key === 'S') && !event.ctrlKey && !event.metaKey) { event.preventDefault(); handleSave() }
  if (event.key === ' ') { event.preventDefault(); handleSkip() }
  if (event.key === 'e' || event.key === 'E') { event.preventDefault(); handleEditTask() }
  if (event.key === 'Delete') { event.preventDefault(); requestDelete() }
  if (event.key === 'ArrowRight') { event.preventDefault(); handleSave() }
  if (event.key === 'ArrowLeft') { event.preventDefault(); requestDelete() }
  if (event.key === 'ArrowUp') { event.preventDefault(); handleEditTask() }
  if (event.key === 'ArrowDown') { event.preventDefault(); handleSkip() }
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const r = s % 60
  return m === 0 ? `${r}s` : `${m}:${r.toString().padStart(2, '0')}`
}

const taskDueDate = computed(() => {
  if (!currentTask.value?.dueDate) return null
  const d = new Date(currentTask.value.dueDate)
  if (isNaN(d.getTime())) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const taskDate = new Date(d); taskDate.setHours(0,0,0,0)
  const diff = Math.round((taskDate.getTime() - today.getTime()) / (1000*60*60*24))
  if (diff === 0) return t('quick_sort.today')
  if (diff === 1) return t('task.date_tomorrow')
  if (diff === -1) return 'Yesterday'
  if (diff > 1 && diff <= 7) return `In ${diff} days`
  if (diff < -1) return `${Math.abs(diff)} days ago`
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
})

const isTaskOverdue = computed(() => {
  if (!currentTask.value?.dueDate) return false
  const d = new Date(currentTask.value.dueDate)
  if (isNaN(d.getTime())) return false
  const today = new Date(); today.setHours(0,0,0,0); d.setHours(0,0,0,0)
  return d.getTime() < today.getTime()
})

const currentTaskProject = computed(() => {
  if (!currentTask.value?.projectId) return null
  return projectStore.projects.find(p => p.id === currentTask.value!.projectId)
})
</script>

<style scoped>
/* ================================
   ROOT LAYOUT
   ================================ */
.quick-sort-view {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* ================================
   HEADER
   ================================ */
.qs-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--glass-border-light);
  flex-shrink: 0;
}

.header-left { flex: 1; }

.qs-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  margin: 0;
  letter-spacing: -0.02em;
}

.zap-icon { color: var(--brand-primary); }

.header-stats {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.stat-badge {
  padding: var(--space-1_5) var(--space-3);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.streak-badge {
  padding: var(--space-1) var(--space-2);
  background: var(--orange-bg-light);
  border: 1px solid var(--danger-border-medium);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  color: var(--color-priority-high);
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-normal);
}

.close-button:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
}

/* ================================
   PROGRESS BAR
   ================================ */
.glow-progress-track {
  position: relative;
  height: var(--space-0_5);
  background: var(--glass-bg-weak);
  flex-shrink: 0;
  overflow: hidden;
}

.glow-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--brand-primary), var(--brand-active));
  transition: width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.glow-progress-glow {
  position: absolute;
  top: 50%;
  width: var(--space-5);
  height: var(--space-5);
  background: var(--brand-primary);
  border-radius: var(--radius-full);
  filter: blur(var(--blur-sm));
  transform: translate(-50%, -50%);
  transition: inset-inline-start 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  pointer-events: none;
}

/* ================================
   TAB NAVIGATION
   ================================ */
.tab-navigation {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-6);
  padding-inline-start: var(--space-8);
  flex-shrink: 0;
}

.tab-btn {
  flex: 1;
  max-width: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2_5) var(--space-4);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
}

.tab-btn.active {
  background: transparent;
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.tab-badge {
  padding: var(--space-0_5) var(--space-2);
  background: var(--glass-border-hover);
  color: var(--text-primary);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  min-width: 1.5rem;
  text-align: center;
}

.tab-btn.active .tab-badge {
  background: var(--overlay-component-bg-lighter);
  color: var(--brand-primary);
  border: 1px solid var(--brand-primary);
}

.tab-badge.pending {
  background: var(--glass-bg-soft);
  color: var(--warning);
  border: 1px solid var(--warning);
}

/* ================================
   MAIN CONTENT
   ================================ */
.qs-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.sort-phase {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

/* ================================
   SORT CENTER (card-centric)
   ================================ */
.sort-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-5);
  padding: var(--space-6) var(--space-8);
  max-width: 640px;
  margin: 0 auto;
  width: 100%;
}

/* Task Context Bar */
.task-context-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-1_5);
  padding: var(--space-3) var(--space-5);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  width: 100%;
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  color: var(--text-secondary);
  flex: 1;
  min-width: 0;
  justify-content: center;
}

.ctx-item:first-child { justify-content: flex-start; }
.ctx-item:last-child { justify-content: flex-end; }

.ctx-divider {
  width: 1px;
  height: var(--space-3);
  background: var(--border-subtle);
  opacity: 0.5;
}

.ctx-empty { color: var(--text-muted); opacity: 0.6; }
.ctx-overdue { color: var(--color-priority-high); font-weight: var(--font-semibold); }

.ctx-priority-dot {
  width: var(--space-2);
  height: var(--space-2);
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.ctx-priority-dot.priority-high { background: var(--color-priority-high); }
.ctx-priority-dot.priority-medium { background: var(--color-priority-medium); }
.ctx-priority-dot.priority-low { background: var(--color-priority-low); }
.ctx-priority-dot.priority-none { background: var(--text-muted); opacity: 0.3; }

.ctx-project {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ctx-emoji { font-size: var(--text-sm); line-height: 1; }
.capitalize { text-transform: capitalize; }

/* ================================
   DIRECTION HINTS + CARD LAYOUT
   ================================ */
.direction-hint {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  pointer-events: none;
  opacity: 0.35;
  transition: opacity var(--duration-normal) ease;
}

.sort-center:hover .direction-hint {
  opacity: 0.55;
}

.hint-arrow {
  font-size: var(--text-base);
  line-height: 1;
}

/* Top/bottom hints (Edit / Skip) */
.hint-vertical {
  justify-content: center;
}

.hint-vertical:first-of-type {
  color: var(--color-info);
}

.hint-vertical:last-of-type {
  color: var(--text-muted);
}

/* Card row: [left hint] [card] [right hint] */
.card-row {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  width: 100%;
}

.hint-side {
  flex-shrink: 0;
  white-space: nowrap;
}

.hint-side:first-child {
  color: var(--color-danger);
}

.hint-side:last-child {
  color: var(--brand-primary);
}

/* ================================
   CARD STACK
   ================================ */
.card-stack {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  perspective: 1000px;
  min-height: 220px;
}

.stack-card {
  position: absolute;
  width: 100%;
  max-width: 480px;
  height: 200px;
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-border-light);
  border-radius: var(--radius-2xl);
  pointer-events: none;
}

.stack-active {
  position: relative;
  z-index: 11;
}

/* ================================
   COMPACT ACTIONS (below card)
   ================================ */
.compact-actions {
  display: flex;
  gap: var(--space-3);
  width: 100%;
}

/* ================================
   EDIT PANEL (slide-up overlay)
   ================================ */
.edit-panel-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  z-index: var(--z-sticky);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.edit-panel {
  width: calc(100% - var(--space-8));
  max-width: 520px;
  max-height: 75vh;
  overflow-y: auto;
  background: var(--surface-primary);
  border: 1px solid var(--glass-border-hover);
  border-bottom: none;
  border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
  padding: var(--space-4) var(--space-6) var(--space-8);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: var(--shadow-2xl), 0 0 0 1px rgba(255,255,255,0.06) inset;
}

.edit-panel-handle {
  width: 40px;
  height: 4px;
  background: var(--glass-border-hover);
  border-radius: var(--radius-full);
  margin: 0 auto var(--space-2);
  cursor: pointer;
}

.edit-panel-title {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0;
  text-align: start;
  unicode-bidi: plaintext;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.full-edit-pill {
  align-self: center;
  border-color: var(--glass-border-hover);
  color: var(--text-secondary);
}

.full-edit-pill:hover {
  border-color: var(--color-info);
  color: var(--color-info);
}

/* Panel slide transition */
.panel-slide-enter-active { transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.panel-slide-leave-active { transition: all 0.2s ease; }
.panel-slide-enter-from { opacity: 0; }
.panel-slide-leave-to { opacity: 0; }
.panel-slide-enter-from .edit-panel { transform: translateY(100%); }
.panel-slide-leave-to .edit-panel { transform: translateY(100%); }

.control-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.control-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  min-width: 52px;
}

.pill-group {
  display: flex;
  gap: var(--space-2);
  flex: 1;
  min-width: 0; /* Allow shrinking below content width for scroll */
}

.pill-scroll {
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  gap: var(--space-1_5);
  min-width: 0;
}
.pill-scroll::-webkit-scrollbar { display: none; }

.pill-scroll .pill {
  padding: var(--space-1_5) var(--space-2);
  font-size: var(--text-xs);
}

.pill {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  white-space: nowrap;
}

.pill:hover {
  background: var(--glass-bg-medium);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.pill.active {
  background: var(--glass-bg-soft);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.pill.clear { padding: var(--space-2); color: var(--text-muted); }
.pill.clear:hover { border-color: var(--danger-muted); color: var(--danger); }
.pill.clear.active { border-color: var(--danger); color: var(--danger); }

.pill kbd {
  padding: var(--space-0_5) var(--space-1);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  color: var(--text-muted);
  line-height: 1;
}

.pill:active { transform: scale(0.95); }

.date-picker-trigger {
  padding: var(--space-1_5) var(--space-2);
}

/* Priority pills expand equally */
.control-row:first-child .pill-group .pill { flex: 1; justify-content: center; }

.ai-row {
  border-top: 1px solid var(--glass-border);
  padding-top: var(--space-3);
}

.pill.ai-pill {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.pill.ai-pill:disabled { opacity: 0.4; }

@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.spin { animation: spin 1s linear infinite; }

/* AI Results */
.ai-results {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-lg);
}

.ai-suggestion {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
}

.ai-field { font-weight: var(--font-semibold); color: var(--brand-primary); min-width: 60px; }
.ai-old { color: var(--text-muted); }
.ai-arrow { color: var(--text-muted); }
.ai-new { color: var(--text-primary); font-weight: var(--font-semibold); }

.ai-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.ai-error {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--danger-bg-subtle);
  border: 1px solid var(--danger-muted);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  color: var(--danger);
}

/* Action buttons */
.action-row {
  display: flex;
  gap: var(--space-2);
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1_5);
  padding: var(--space-3) var(--space-4);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
}

.action-btn kbd {
  padding: var(--space-0_5) var(--space-1);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  color: var(--text-muted);
  line-height: 1;
}

.action-btn.done { color: var(--color-success); border-color: var(--success-border); }
.action-btn.done:hover { background: var(--success-bg-subtle); }
.action-btn.save { color: var(--brand-primary); border-color: var(--state-hover-border); }
.action-btn.save:hover { background: var(--state-hover-bg); }
.action-btn.undo { flex: 0 0 auto; color: var(--text-muted); border-color: var(--glass-border); }
.action-btn.undo:hover { border-color: var(--warning); color: var(--warning); }

.dirty-dot {
  width: var(--space-2);
  height: var(--space-2);
  border-radius: var(--radius-full);
  background: var(--brand-primary);
  animation: dirty-pulse 2s ease-in-out infinite;
}

@keyframes dirty-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.8); }
}

.action-btn:active { transform: scale(0.95); }

/* Key hint */
.key-hint {
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-align: center;
  opacity: 0.6;
  padding: var(--space-2);
}

/* ================================
   EMPTY / COMPLETION STATES
   ================================ */
.empty-state,
.completion-state {
  text-align: center;
  padding: var(--space-12) var(--space-8);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-6);
}

.empty-state h2, .completion-state h2 {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0;
}

.empty-state p, .completion-message {
  font-size: var(--text-lg);
  color: var(--text-secondary);
  margin: 0;
}

.celebration-icon {
  font-size: 64px;
  animation: bounce 0.6s ease-in-out;
}

@keyframes bounce {
  0%, 100% { transform: scale(1) translateY(0); }
  50% { transform: scale(1.2) translateY(-10px); }
}

.session-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--space-4);
  width: 100%;
  max-width: 500px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-5) var(--space-4);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.stat-card.streak-card {
  background: var(--orange-bg-light);
  border-color: var(--danger-border-medium);
}

.stat-value {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  line-height: var(--leading-none);
}

.stat-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.primary-button {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  background: var(--glass-bg-soft);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-lg);
  color: var(--brand-primary);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  cursor: pointer;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: all var(--duration-normal);
}

.primary-button:hover { background: var(--state-hover-bg); }

/* ================================
   FEEDBACK OVERLAY (Celebration)
   ================================ */
.feedback-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-6) var(--space-8);
  background: var(--glass-bg-strong);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-2xl);
  z-index: var(--z-modal);
  pointer-events: none;
}

.feedback-overlay.success { color: var(--brand-primary); border-color: var(--brand-primary); }
.feedback-overlay.danger { color: var(--color-danger); border-color: var(--color-danger); }
.feedback-overlay.warning { color: var(--color-priority-medium); border-color: var(--color-priority-medium); }
.feedback-overlay.info { color: var(--text-primary); border-color: var(--glass-border); }

.feedback-overlay .celebration-ring {
  position: absolute;
  inset: -4px;
  border-radius: var(--radius-2xl);
  border: 2px solid var(--brand-primary);
  opacity: 0;
  animation: ringPulse 0.7s ease-out forwards;
  pointer-events: none;
}

.feedback-overlay .celebration-icon {
  color: var(--brand-primary);
}

.feedback-text {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  letter-spacing: -0.01em;
}

.celebration-sparkle {
  position: absolute;
  top: -12px;
  inset-inline-end: -12px;
  font-size: var(--text-xl);
  animation: sparkleSpin 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.celebration-enter-active {
  animation: celebrateIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.celebration-leave-active {
  animation: celebrateOut var(--duration-slow) ease forwards;
}

@keyframes celebrateIn {
  0%   { transform: translate(-50%, -50%) scale(0.4) rotate(-4deg); opacity: 0; }
  60%  { transform: translate(-50%, -50%) scale(1.08) rotate(2deg); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; }
}

@keyframes celebrateOut {
  0%   { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(0.85); opacity: 0; }
}

@keyframes ringPulse {
  0%   { transform: scale(1); opacity: 0.8; }
  60%  { transform: scale(1.25); opacity: 0.4; }
  100% { transform: scale(1.5); opacity: 0; }
}

@keyframes sparkleSpin {
  0%   { transform: scale(0) rotate(-45deg); opacity: 0; }
  70%  { transform: scale(1.3) rotate(10deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}

/* Old fade transition replaced by celebration */
.fade-enter-active, .fade-leave-active { transition: opacity var(--duration-normal) ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Card slide transition */
.card-slide-enter-active { transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.card-slide-leave-active { transition: all 0.2s ease; }
.card-slide-enter-from { opacity: 0; transform: scale(0.9) translateY(20px); }
.card-slide-leave-to { opacity: 0; transform: scale(0.95); }

/* Tab fade transition */
.tab-fade-enter-active, .tab-fade-leave-active { transition: all 0.25s ease; }
.tab-fade-enter-from { opacity: 0; transform: translateX(20px); }
.tab-fade-leave-to { opacity: 0; transform: translateX(-20px); }

/* ================================
   DELETE CONFIRMATION MODAL
   ================================ */
.delete-confirm-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-6);
  text-align: center;
}

.delete-confirm-icon { color: var(--color-danger); margin-bottom: var(--space-4); }

.delete-confirm-title {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  margin: 0 0 var(--space-2);
}

.delete-confirm-desc {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  margin: 0 0 var(--space-6);
}

.delete-confirm-actions {
  display: flex;
  gap: var(--space-3);
  width: 100%;
}

.dc-cancel-btn, .dc-delete-btn {
  flex: 1;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
}

.dc-cancel-btn {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.dc-cancel-btn:hover { background: var(--glass-bg-medium); }

.dc-delete-btn {
  background: var(--color-danger);
  border: none;
  color: white;
}

.dc-delete-btn:hover { opacity: 0.9; }

/* ================================
   NOTHING SET REMINDER
   ================================ */
.nothing-set-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
}

.nothing-set-modal {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-8) var(--space-10);
  text-align: center;
  background: var(--overlay-component-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-2xl);
  max-width: 380px;
  width: 90%;
  margin: var(--space-4);
}

.nothing-set-emoji {
  font-size: 2.5rem;
  margin-bottom: var(--space-3);
  animation: emojiWobble 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes emojiWobble {
  0%   { transform: scale(0) rotate(-15deg); }
  50%  { transform: scale(1.2) rotate(8deg); }
  75%  { transform: scale(0.95) rotate(-3deg); }
  100% { transform: scale(1) rotate(0deg); }
}

.nothing-set-title {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  margin: 0 0 var(--space-2);
}

.nothing-set-desc {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  margin: 0 0 var(--space-6);
}

.nothing-set-actions {
  display: flex;
  gap: var(--space-3);
  width: 100%;
}

.ns-set-btn, .ns-save-btn {
  flex: 1;
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--duration-normal) ease;
}

.ns-set-btn {
  background: var(--glass-bg-soft);
  border: 1px solid var(--brand-primary);
  color: var(--brand-primary);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.ns-set-btn:hover { background: var(--glass-bg-medium); }

.ns-save-btn {
  background: var(--glass-bg-weak);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
}

.ns-save-btn:hover { background: var(--glass-bg-light); }

/* ================================
   REDUCED MOTION
   ================================ */
@media (prefers-reduced-motion: reduce) {
  .glow-progress-fill,
  .glow-progress-glow,
  .celebration-icon,
  .dirty-dot,
  .spin {
    animation: none !important;
    transition: none !important;
  }
}
</style>
