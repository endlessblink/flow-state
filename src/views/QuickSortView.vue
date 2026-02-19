<template>
  <div class="quick-sort-view">
    <!-- Header -->
    <header class="quick-sort-header">
      <div class="header-content--quicksort">
        <h1 class="view-title">
          <Zap :size="24" />
          {{ $t('views.quick_sort') }}
        </h1>
        <p class="view-subtitle">
          {{ activeTab === 'capture' ? 'Capture tasks quickly, then sort them all at once' : 'Rapidly categorize your uncategorized tasks' }}
        </p>
      </div>

      <button class="close-button" aria-label="Exit Quick Sort" @click="handleExit">
        <X :size="24" />
      </button>
    </header>

    <!-- Tab Navigation -->
    <div class="tab-navigation">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'sort' }"
        @click="activeTab = 'sort'"
      >
        <Zap :size="18" />
        <span>{{ $t('quick_sort.sort_tab') }}</span>
        <span v-if="uncategorizedCount > 0" class="tab-badge">{{ uncategorizedCount }}</span>
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'capture' }"
        @click="activeTab = 'capture'"
      >
        <Plus :size="18" />
        <span>{{ $t('quick_sort.capture_tab') }}</span>
        <span v-if="pendingCount > 0" class="tab-badge pending">{{ pendingCount }}</span>
      </button>
    </div>

    <!-- Main Content -->
    <div class="quick-sort-content">
      <!-- CAPTURE TAB -->
      <Transition name="tab-fade" mode="out-in">
        <QuickCaptureTab
          v-if="activeTab === 'capture'"
          key="capture"
          ref="captureTabRef"
          @switch-to-sort="handleSwitchToSort"
        />

        <!-- SORT TAB -->
        <div v-else key="sort" class="sort-tab-content">
          <!-- Progress Indicator - Full width -->
          <SortProgress
            v-if="!isComplete"
            :current="progress.current"
            :total="progress.total"
            :message="motivationalMessage"
            :streak="currentStreak"
            class="sort-progress-bar"
          />

          <!-- Three-Column Layout: actions | card+projects | context -->
          <div v-if="currentTask && !isComplete" class="sort-layout">
            <!-- Left Sidebar: Action Buttons -->
            <div class="action-sidebar">
              <!-- Row 1: Done + Save -->
              <div class="action-row">
                <button class="action-btn done" aria-label="Mark task as done" @click="handleMarkDone">
                  <CheckCircle :size="18" />
                  <span class="action-label">{{ $t('quick_sort.done') }}</span>
                  <kbd>D</kbd>
                </button>
                <button class="action-btn save" aria-label="Save and advance" @click="handleSave">
                  <Save :size="18" />
                  <span class="action-label">{{ $t('quick_sort.save') }}</span>
                  <span v-if="isTaskDirty" class="dirty-dot" />
                  <kbd>→</kbd>
                </button>
              </div>

              <!-- Row 2: Skip + Edit + Delete -->
              <div class="action-row">
                <button class="action-btn skip" aria-label="Skip this task" @click="handleSkip">
                  <SkipForward :size="16" />
                  <span class="action-label">{{ $t('quick_sort.skip') }}</span>
                  <kbd>↓</kbd>
                </button>
                <button class="action-btn edit" aria-label="Edit task" @click="handleEditTask">
                  <Edit2 :size="16" />
                  <span class="action-label">{{ $t('quick_sort.edit') }}</span>
                  <kbd>↑</kbd>
                </button>
                <button class="action-btn delete" aria-label="Delete task" @click="handleMarkDoneAndDelete">
                  <Trash2 :size="16" />
                  <span class="action-label">{{ $t('quick_sort.del') }}</span>
                  <kbd>←</kbd>
                </button>
              </div>

              <!-- AI Actions Divider (TASK-1221) -->
              <div class="ai-divider">
                <span class="ai-divider-label">AI</span>
              </div>

              <!-- Row 3: AI Suggest -->
              <div class="action-row">
                <button
                  class="action-btn ai-suggest"
                  :class="{ 'is-loading': aiAction === 'suggest' }"
                  :disabled="isAIBusy"
                  aria-label="AI suggest priority, date, project"
                  @click="handleAISuggest"
                >
                  <Loader2 v-if="aiAction === 'suggest'" :size="16" class="spin" />
                  <Sparkles v-else :size="16" />
                  <span class="action-label">{{ $t('quick_sort.suggest') }}</span>
                  <kbd>A</kbd>
                </button>
              </div>

              <!-- AI Cancel (visible during loading) -->
              <button
                v-if="isAIBusy"
                class="action-btn ai-cancel"
                @click="handleAICancel"
              >
                <X :size="14" />
                <span class="action-label">Cancel AI</span>
              </button>

              <!-- Undo (appears when available) -->
              <button
                v-if="canUndo"
                class="action-btn undo"
                aria-label="Undo last action"
                @click="handleUndo"
              >
                <Undo2 :size="14" />
                <span class="action-label">Undo</span>
              </button>
            </div>

            <!-- Center Column: Card + Category Selector -->
            <div class="sort-main-column">
              <!-- Task Card -->
              <Transition name="card-slide" mode="out-in">
                <QuickSortCard
                  :key="currentTaskId ?? undefined"
                  :task="currentTask"
                  @update-task="handleTaskUpdate"
                  @swipe-save="handleSave"
                  @swipe-delete="handleMarkDoneAndDelete"
                />
              </Transition>

              <!-- Project Selector -->
              <CategorySelector
                @select="handleCategorize"
                @skip="handleSkip"
                @create-new="showProjectModal = true"
              />

              <!-- Helper Hint -->
              <div class="helper-hint">
                1-9 assign • →/S save • D done • ← del • ↓ skip • ↑ edit • A suggest
              </div>
            </div>

            <!-- Context Info Panel (desktop only) -->
            <aside class="context-panel" role="complementary" aria-label="Task context information">
              <!-- Task Due Date (reactive) -->
              <div class="context-section">
                <div class="context-icon-wrapper">
                  <Calendar :size="18" />
                </div>
                <div class="context-info">
                  <span class="context-label">{{ $t('task.due_date') }}</span>
                  <span v-if="taskDueDate" class="context-value" :class="{ 'due-overdue': isTaskOverdue }">
                    {{ taskDueDate }}
                  </span>
                  <span v-else class="context-value context-empty">No date set</span>
                </div>
              </div>

              <!-- Today Reference -->
              <div class="context-today-ref">
                {{ todayReference }}
              </div>

              <!-- Task Priority -->
              <div class="context-section">
                <div
                  class="priority-dot"
                  :class="`priority-${currentTask.priority || 'none'}`"
                  :aria-label="`Priority: ${currentTask.priority || 'none'}`"
                />
                <div class="context-info">
                  <span class="context-label">{{ $t('task.priority') }}</span>
                  <span
                    class="context-value capitalize"
                    :class="`priority-text-${currentTask.priority || 'none'}`"
                  >
                    {{ currentTask.priority || 'None' }}
                  </span>
                </div>
              </div>

              <!-- Task Project -->
              <div class="context-section">
                <div class="context-icon-wrapper">
                  <Briefcase :size="18" />
                </div>
                <div class="context-info">
                  <span class="context-label">{{ $t('task.header_project') }}</span>
                  <span v-if="currentTaskProject" class="context-value project-name">
                    <span v-if="currentTaskProject.emoji" class="project-emoji">{{ currentTaskProject.emoji }}</span>
                    {{ currentTaskProject.name }}
                  </span>
                  <span v-else class="context-value context-empty">{{ $t('quick_sort.no_project') }}</span>
                </div>
              </div>

              <!-- AI Results (TASK-1221) -->
              <template v-if="aiState === 'preview' || aiState === 'error'">
                <div class="ai-divider">
                  <span class="ai-divider-label">AI Results</span>
                </div>

                <!-- AI Error -->
                <div v-if="aiState === 'error'" class="ai-error-section">
                  <p class="ai-error-text" dir="auto">
                    {{ aiError }}
                  </p>
                  <button class="action-btn ai-retry" @click="handleAIRetry">
                    Retry
                  </button>
                </div>

                <!-- Smart Suggest Results -->
                <div v-else-if="aiAction === 'suggest'" class="ai-suggest-results">
                  <div
                    v-for="suggestion in currentSuggestions"
                    :key="suggestion.field"
                    class="ai-suggestion-card"
                  >
                    <div class="ai-suggestion-header">
                      <span class="ai-suggestion-field">{{ suggestion.field }}</span>
                      <span class="ai-suggestion-confidence" :style="{ opacity: suggestion.confidence }">
                        {{ Math.round(suggestion.confidence * 100) }}%
                      </span>
                    </div>
                    <div class="ai-suggestion-values">
                      <span class="ai-old-value">{{ suggestion.currentValue || 'none' }}</span>
                      <span class="ai-arrow">&rarr;</span>
                      <span class="ai-new-value">{{ suggestion.suggestedValue }}</span>
                    </div>
                    <p v-if="suggestion.reasoning" class="ai-suggestion-reason" dir="auto">
                      {{ suggestion.reasoning }}
                    </p>
                  </div>
                  <div v-if="suggestedProjectId" class="ai-suggestion-card">
                    <div class="ai-suggestion-header">
                      <span class="ai-suggestion-field">project</span>
                    </div>
                    <div class="ai-suggestion-values">
                      <span class="ai-old-value">{{ currentTaskProject?.name || 'none' }}</span>
                      <span class="ai-arrow">&rarr;</span>
                      <span class="ai-new-value">{{ suggestedProjectName || suggestedProjectId }}</span>
                    </div>
                  </div>
                  <div class="ai-actions-row">
                    <button class="action-btn ai-apply" @click="handleApplySuggestions">
                      Apply All
                    </button>
                    <button class="action-btn ai-dismiss" @click="quickSortAI.dismiss()">
                      Dismiss
                    </button>
                  </div>
                </div>
              </template>
            </aside>
          </div>

          <!-- Empty State (centered, full width) -->
          <div v-else-if="!isComplete && uncategorizedTasks.length === 0" class="empty-state">
            <CheckCircle :size="64" />
            <h2>All Caught Up!</h2>
            <p>You have no uncategorized tasks.</p>
            <button class="primary-button" @click="handleExit">
              Return to Tasks
            </button>
          </div>

          <!-- Completion State (centered, full width) -->
          <div v-else-if="isComplete" class="completion-state">
            <div class="celebration-icon">
              🎉
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
                <span class="stat-value">🔥 {{ sessionSummary.streakDays }}</span>
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
    <Transition name="fade">
      <div v-if="actionFeedback" class="feedback-overlay" :class="actionFeedback.type">
        <span class="feedback-text">{{ actionFeedback.text }}</span>
      </div>
    </Transition>

    <!-- Project Modal -->
    <ProjectModal
      v-if="showProjectModal"
      :is-open="showProjectModal"
      @close="showProjectModal = false"
    />

    <!-- Task Edit Modal -->
    <TaskEditModal
      :is-open="showEditModal"
      :task="taskToEdit"
      @close="showEditModal = false; taskToEdit = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Zap, X, CheckCircle, Undo2, SkipForward, Plus, Edit2, Calendar, Briefcase, Save, Trash2, Sparkles, Loader2 } from 'lucide-vue-next'
import { useQuickSort } from '@/composables/useQuickSort'
import { useQuickSortAI } from '@/composables/useQuickSortAI'
import { useQuickCapture } from '@/composables/useQuickCapture'
import { useTaskStore } from '@/stores/tasks'
import { useProjectStore } from '@/stores/projects'
import QuickSortCard from '@/components/QuickSortCard.vue'
import QuickCaptureTab from '@/components/quicksort/QuickCaptureTab.vue'
import CategorySelector from '@/components/layout/CategorySelector.vue'
import SortProgress from '@/components/tasks/SortProgress.vue'
import ProjectModal from '@/components/projects/ProjectModal.vue'
import TaskEditModal from '@/components/tasks/TaskEditModal.vue'
import type { SessionSummary } from '@/stores/quickSort'
import type { Task } from '@/types/tasks'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const taskStore = useTaskStore()
const projectStore = useProjectStore()
const quickCapture = useQuickCapture()

// Tab state
const activeTab = ref<'sort' | 'capture'>('sort')
const captureTabRef = ref<InstanceType<typeof QuickCaptureTab> | null>(null)

// Tab badge counts
const uncategorizedCount = computed(() => uncategorizedTasks.value.length)
const pendingCount = computed(() => quickCapture.pendingTasks.value.length)

const showProjectModal = ref(false)
const showEditModal = ref(false)
const _showCelebration = ref(false)
const actionFeedback = ref<{ text: string; type: 'success' | 'info' | 'danger' | 'warning' } | null>(null)
const sessionSummary = ref<SessionSummary | null>(null)
const taskToEdit = ref<Task | null>(null)

function showFeedback(text: string, type: 'success' | 'info' | 'danger' | 'warning' = 'info', duration = 600) {
  actionFeedback.value = { text, type }
  setTimeout(() => {
    actionFeedback.value = null
  }, duration)
}

// Handle tab query parameter
watch(() => route.query.tab, (tab) => {
  if (tab === 'capture') {
    activeTab.value = 'capture'
  }
}, { immediate: true })

// Handle default tab from quick capture
watch(() => quickCapture.defaultTabOnOpen.value, (defaultTab) => {
  if (defaultTab === 'capture' && route.name === 'quick-sort') {
    activeTab.value = 'capture'
  }
}, { immediate: true })

function handleSwitchToSort() {
  activeTab.value = 'sort'
}

const {
  currentTask,
  currentTaskId,
  uncategorizedTasks,
  progress,
  isComplete,
  isTaskDirty,
  motivationalMessage,
  canUndo,
  currentStreak,
  startSession,
  endSession,
  categorizeTask,
  saveTask,
  markTaskDone,
  markDoneAndDeleteTask,
  skipTask,
  undoLastCategorization
} = useQuickSort()

const quickSortAI = useQuickSortAI()
const {
  aiState,
  aiAction,
  aiError,
  isAIBusy,
  currentSuggestions,
  suggestedProjectId,
  suggestedProjectName
} = quickSortAI

// Start session on mount
onMounted(() => {
  startSession()
  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})

// Watch for completion
watch(isComplete, (completed) => {
  if (completed) {
    const summary = endSession()
    sessionSummary.value = summary || null
  }
})

function handleCategorize(projectId: string) {
  if (!currentTask.value) return
  categorizeTask(currentTask.value.id, projectId)
}

function handleSave() {
  if (!currentTask.value) return

  showFeedback('Saved!', 'success')
  saveTask()
}

async function handleTaskUpdate(updates: Partial<Task>) {
  if (!currentTask.value) return

  // Update task with new priority or due date - AWAIT to ensure persistence (BUG-1051)
  await taskStore.updateTask(currentTask.value.id, updates)
}

function handleSkip() {
  showFeedback('Skipped', 'warning')
  skipTask()
}

function handleUndo() {
  if (canUndo) {
    undoLastCategorization()
  }
}

function handleMarkDone() {
  if (!currentTask.value) return

  showFeedback('Done!', 'success')

  // Mark task as done and move to next
  markTaskDone(currentTask.value.id)
}

function handleMarkDoneAndDelete() {
  if (!currentTask.value) return

  showFeedback('Deleted', 'danger')

  // Mark done and delete task, then move to next
  markDoneAndDeleteTask(currentTask.value.id)
}

function handleEditTask() {
  if (!currentTask.value) return

  // Set the task to edit and open modal
  taskToEdit.value = currentTask.value
  showEditModal.value = true
}

function _closeEditModal() {
  showEditModal.value = false
  taskToEdit.value = null
}

function handleExit() {
  router.push({ name: 'board' })
}

// AI Command Handler (TASK-1221)
function handleAISuggest() {
  if (!currentTask.value || isAIBusy.value) return
  quickSortAI.autoSuggest(currentTask.value)
}

function handleAICancel() {
  quickSortAI.abort()
}

let lastAIAction: (() => void) | null = null

function handleAIRetry() {
  quickSortAI.dismiss()
  if (lastAIAction) lastAIAction()
}

async function handleApplySuggestions() {
  if (!currentTask.value) return
  const updates: Record<string, unknown> = {}
  for (const s of currentSuggestions.value) {
    if (s.field === 'priority') updates.priority = s.suggestedValue
    else if (s.field === 'dueDate') updates.dueDate = s.suggestedValue
    else if (s.field === 'status') updates.status = s.suggestedValue
    else if (s.field === 'estimatedDuration') updates.estimatedDuration = s.suggestedValue
  }
  if (suggestedProjectId.value) {
    updates.projectId = suggestedProjectId.value
  }
  if (Object.keys(updates).length > 0) {
    await taskStore.updateTask(currentTask.value.id, updates)
  }
  quickSortAI.dismiss()
  showFeedback('AI suggestions applied!', 'success')
}

function shouldIgnoreKeyEvent(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement
  if (!target) return false
  const tagName = target.tagName?.toLowerCase()
  return tagName === 'input' ||
         tagName === 'textarea' ||
         tagName === 'select' ||
         target.isContentEditable ||
         !!target.closest('[role="dialog"], .modal, .n-modal')
}

function handleGlobalKeydown(event: KeyboardEvent) {
  // Skip if user is in an input field or modal
  if (shouldIgnoreKeyEvent(event)) return

  // Escape to exit
  if (event.key === 'Escape') {
    event.preventDefault()
    handleExit()
  }

  // Ctrl+Z to undo
  if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
    event.preventDefault()
    handleUndo()
  }

  // D key to mark as done (only in sort tab)
  if (activeTab.value === 'sort' && (event.key === 'd' || event.key === 'D')) {
    event.preventDefault()
    handleMarkDone()
  }

  // S key to save task (only in sort tab)
  if (activeTab.value === 'sort' && (event.key === 's' || event.key === 'S') && !event.ctrlKey && !event.metaKey) {
    event.preventDefault()
    handleSave()
  }

  // Space key to skip task (only in sort tab)
  if (activeTab.value === 'sort' && event.key === ' ') {
    event.preventDefault()
    handleSkip()
  }

  // E key to edit task (only in sort tab)
  if (activeTab.value === 'sort' && (event.key === 'e' || event.key === 'E')) {
    event.preventDefault()
    handleEditTask()
  }

  // Delete key to mark done and delete (only in sort tab)
  if (activeTab.value === 'sort' && event.key === 'Delete') {
    event.preventDefault()
    handleMarkDoneAndDelete()
  }

  // Arrow keys (only in sort tab)
  if (activeTab.value === 'sort' && event.key === 'ArrowRight') {
    event.preventDefault()
    handleSave()
  }

  if (activeTab.value === 'sort' && event.key === 'ArrowLeft') {
    event.preventDefault()
    handleMarkDoneAndDelete()
  }

  if (activeTab.value === 'sort' && event.key === 'ArrowUp') {
    event.preventDefault()
    handleEditTask()
  }

  if (activeTab.value === 'sort' && event.key === 'ArrowDown') {
    event.preventDefault()
    handleSkip()
  }

  // AI shortcut (TASK-1221) - only in sort tab, not during AI operation
  if (activeTab.value === 'sort' && !isAIBusy.value) {
    if (event.key === 'a' || event.key === 'A') {
      event.preventDefault()
      handleAISuggest()
    }
  }
}

function formatTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes === 0) {
    return `${remainingSeconds}s`
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

// Context panel computed properties
const todayReference = computed(() => {
  const now = new Date()
  return now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
})

const taskDueDate = computed(() => {
  if (!currentTask.value?.dueDate) return null
  const d = new Date(currentTask.value.dueDate)
  if (isNaN(d.getTime())) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const taskDate = new Date(d)
  taskDate.setHours(0, 0, 0, 0)

  const diffDays = Math.round((taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return t('quick_sort.today')
  if (diffDays === 1) return t('task.date_tomorrow')
  if (diffDays === -1) return 'Yesterday'
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`
  if (diffDays < -1) return `${Math.abs(diffDays)} days ago`

  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
})

const isTaskOverdue = computed(() => {
  if (!currentTask.value?.dueDate) return false
  const d = new Date(currentTask.value.dueDate)
  if (isNaN(d.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return d.getTime() < today.getTime()
})

const currentTaskProject = computed(() => {
  if (!currentTask.value?.projectId) return null
  return projectStore.projects.find(p => p.id === currentTask.value!.projectId)
})
</script>

<style scoped>
.quick-sort-view {
  flex: 1;
  min-height: 0; /* Allow flexbox shrinking */
  padding: var(--space-4) var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  overflow: visible; /* Inner .quick-sort-content handles scrolling via overflow-y: auto */
  position: relative; /* Establish positioning context for celebration overlay */
}

.quick-sort-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  flex-shrink: 0; /* Never collapse header */
}

.header-content--quicksort {
  flex: 1;
}

.view-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0;
}

.view-subtitle {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin: 0;
  display: none; /* Hide on desktop to save space */
}

@media (max-width: 1024px) {
  .view-subtitle {
    display: block;
  }
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--duration-normal);
}

.close-button:hover {
  background: var(--glass-bg-heavy);
  border-color: var(--glass-border-hover);
  transform: scale(1.05);
}

/* Tab Navigation */
.tab-navigation {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  width: fit-content;
  margin: 0 auto;
  flex-shrink: 0; /* Never collapse tabs */
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2_5) var(--space-5);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.tab-btn:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
}

.tab-btn.active {
  background: transparent;
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  font-weight: var(--font-semibold);
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 var(--space-1_5);
  background: var(--glass-bg-medium);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
}

.tab-btn.active .tab-badge {
  background: var(--glass-bg-soft);
  color: var(--brand-primary);
  border: 1px solid var(--brand-primary);
}

.tab-badge.pending {
  background: var(--glass-bg-soft);
  color: var(--warning);
  border: 1px solid var(--warning);
}

.tab-btn.active .tab-badge.pending {
  background: var(--glass-bg-soft);
  color: var(--warning);
  border: 1px solid var(--warning);
}

/* Sort Tab Content */
.sort-tab-content {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-4);
  width: 100%;
}

/* Progress bar spans full width */
.sort-progress-bar {
  max-width: 100%;
}

/* Three-Column Layout: actions | card+projects | context */
.sort-layout {
  display: flex;
  gap: var(--space-5);
  justify-content: center;
  align-items: flex-start;
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
}

/* Left Sidebar: Action Buttons */
.action-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  flex-shrink: 0;
  width: 300px;
  position: sticky;
  top: var(--space-4);
}

/* Rows of buttons */
.action-row {
  display: flex;
  gap: var(--space-3);
}

.action-row .action-btn {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2_5) var(--space-3);
  min-height: 40px;
  width: auto;
  height: auto;
  background: var(--glass-bg-soft);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal);
  white-space: nowrap;
}

.action-btn:hover {
  background: var(--glass-bg-medium);
  transform: translateX(2px);
}

.action-label {
  flex: 1;
  text-align: left;
}

.action-btn kbd {
  padding: var(--space-0_5) var(--space-1_5);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  color: var(--text-muted);
  line-height: 1;
}

.action-btn.done {
  border-color: var(--success);
  color: var(--success);
}

.action-btn.done:hover {
  background: var(--success-bg-light);
  border-color: var(--success);
}

.action-btn.save {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.action-btn.save:hover {
  background: var(--brand-primary-subtle);
  border-color: var(--brand-primary);
}

.dirty-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--brand-primary);
  animation: dirty-pulse 2s ease-in-out infinite;
}

@keyframes dirty-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.8); }
}

.action-btn.skip {
  border-color: var(--glass-border-hover);
  color: var(--text-secondary);
}

.action-btn.skip:hover {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.action-btn.edit {
  border-color: var(--glass-border-hover);
  color: var(--text-secondary);
}

.action-btn.edit:hover {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.action-btn.delete {
  border-color: var(--danger-muted);
  color: var(--danger);
}

.action-btn.delete:hover {
  background: var(--danger-bg);
  border-color: var(--danger);
}

.action-btn.undo {
  border-color: var(--glass-border);
  color: var(--text-muted);
}

.action-btn.undo:hover {
  border-color: var(--warning);
  color: var(--warning);
}

/* Center Column: Card + Category Selector */
.sort-main-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-5);
  flex: 1;
  max-width: 600px;
  min-width: 0;
}

/* Context Panel (desktop only) */
.context-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 220px;
  flex-shrink: 0;
  padding: var(--space-5);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.context-section {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}

.context-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--space-8);
  height: var(--space-8);
  background: var(--glass-bg-soft);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  flex-shrink: 0;
}

.priority-dot {
  width: var(--space-8);
  height: var(--space-8);
  border-radius: var(--radius-full);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.priority-dot::after {
  content: '';
  width: var(--space-3);
  height: var(--space-3);
  border-radius: var(--radius-full);
  background: currentColor;
}

.priority-dot.priority-high {
  color: var(--color-priority-high);
  background: var(--danger-bg-subtle);
}

.priority-dot.priority-medium {
  color: var(--color-priority-medium);
  background: var(--color-warning-alpha-10);
}

.priority-dot.priority-low {
  color: var(--color-priority-low);
  background: var(--blue-bg-light);
}

.priority-dot.priority-none {
  color: var(--text-muted);
  background: var(--glass-bg-subtle);
}

.context-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
  min-width: 0;
}

.context-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.context-value {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  line-height: var(--leading-tight);
  word-break: break-word;
}

.context-value.capitalize {
  text-transform: capitalize;
}

.context-value.due-overdue {
  color: var(--color-priority-high);
}

.context-today-ref {
  font-size: var(--text-xs);
  color: var(--text-muted);
  padding: 0 var(--space-1);
  margin-top: calc(-1 * var(--space-2));
  opacity: 0.7;
}

.context-empty {
  color: var(--text-muted);
  font-style: italic;
}

.priority-text-high {
  color: var(--color-priority-high);
}

.priority-text-medium {
  color: var(--color-priority-medium);
}

.priority-text-low {
  color: var(--color-priority-low);
}

.priority-text-none {
  color: var(--text-muted);
}

.project-name {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
}

.project-emoji {
  font-size: var(--text-lg);
  line-height: 1;
}

/* Tab Fade Transition */
.tab-fade-enter-active,
.tab-fade-leave-active {
  transition: all 0.25s var(--spring-smooth);
}

.tab-fade-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.tab-fade-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.quick-sort-content {
  flex: 1;
  min-height: 0; /* Allow flexbox shrinking for scroll */
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-4);
  width: 100%;
  overflow-y: auto; /* Scroll only the content area, not header/tabs */
  padding: var(--space-4) var(--space-6); /* Breathing room for card hover transform + shadow */
}

.empty-state,
.completion-state {
  text-align: center;
  padding: var(--space-12) var(--space-8);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-6);
}

.empty-state h2,
.completion-state h2 {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0;
}

.empty-state p,
.completion-message {
  font-size: var(--text-lg);
  color: var(--text-secondary);
  margin: 0;
}

.celebration-icon {
  font-size: 64px;
  animation: bounce 0.6s ease-in-out;
}

@keyframes bounce {
  0%,
  100% {
    transform: scale(1) translateY(0);
  }
  50% {
    transform: scale(1.2) translateY(-10px);
  }
}

.session-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--space-4);
  width: 100%;
  max-width: 600px;
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
}

.stat-card.streak-card {
  background: var(--orange-bg-light);
  border-color: rgba(251, 146, 60, 0.3);
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

/* Helper Hint */
.helper-hint {
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-align: center;
  opacity: 0.7;
}

.helper-hint kbd {
  display: inline-block;
  padding: var(--space-0_5) var(--space-1);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}

.primary-button {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3_5) var(--space-7);
  background: transparent;
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-lg);
  color: var(--brand-primary);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal);
}

.primary-button:hover {
  background: var(--brand-primary-subtle);
  border-color: var(--brand-hover);
  color: var(--brand-hover);
  transform: translateY(-2px);
  box-shadow: var(--state-hover-shadow);
}

/* Action Feedback Overlay */
.feedback-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 50;
  pointer-events: none;
  padding: var(--space-4) var(--space-8);
  border-radius: var(--radius-lg);
  animation: feedback-pop 0.4s var(--ease-out);
}

.feedback-overlay.success {
  background: var(--color-work);
  box-shadow: 0 4px 24px var(--success-shadow);
}

.feedback-overlay.info {
  background: var(--brand-primary);
  box-shadow: 0 4px 24px var(--brand-primary-dim);
}

.feedback-overlay.warning {
  background: var(--color-warning);
  box-shadow: 0 4px 24px rgba(245, 158, 11, 0.4);
}

.feedback-overlay.danger {
  background: var(--color-danger);
  box-shadow: 0 4px 24px var(--danger-shadow-strong);
}

.feedback-text {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  color: white;
}

@keyframes feedback-pop {
  0% { transform: translate(-50%, -50%) scale(0.7); opacity: 0; }
  60% { transform: translate(-50%, -50%) scale(1.05); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
}

/* Transitions */
.card-slide-enter-active,
.card-slide-leave-active {
  transition: all var(--duration-slow) var(--ease-in-out);
}

.card-slide-enter-from {
  transform: translateX(100px);
  opacity: 0;
}

.card-slide-leave-to {
  transform: translateX(-100px);
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-slow);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Reduce motion for accessibility */
@media (prefers-reduced-motion: reduce) {
  .card-slide-enter-active,
  .card-slide-leave-active,
  .fade-enter-active,
  .fade-leave-active,
  .celebration-content,
  .celebration-icon,
  .dirty-dot {
    animation: none !important;
    transition: none !important;
  }
}

/* Responsive: Tablet — collapse sidebar to horizontal row */
@media (max-width: 768px) {
  .sort-layout {
    flex-direction: column;
    align-items: center;
  }

  .action-sidebar {
    width: 100%;
    max-width: 600px;
    position: static;
    order: 2; /* Move below card on tablet */
  }

  .action-row {
    justify-content: center;
  }

  .action-row .action-btn {
    flex: none;
  }

  .action-btn:hover {
    transform: translateY(-2px);
  }

  .sort-main-column {
    width: 100%;
  }

  /* Transform context panel into compact horizontal bar */
  .context-panel {
    width: 100%;
    max-width: 600px;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    gap: var(--space-3);
    order: -1;
  }

  .context-section {
    flex-direction: row;
    gap: var(--space-2);
    flex: 1;
    min-width: 0;
    justify-content: center;
    align-items: center;
  }

  .context-section:first-child {
    justify-content: flex-start;
  }

  .context-section:last-child {
    justify-content: flex-end;
  }

  .context-icon-wrapper,
  .priority-dot {
    width: var(--space-5);
    height: var(--space-5);
  }

  .context-icon-wrapper svg {
    width: 14px;
    height: 14px;
  }

  .priority-dot::after {
    width: var(--space-2);
    height: var(--space-2);
  }

  .context-info {
    flex-direction: row;
    gap: var(--space-1);
    align-items: center;
  }

  .context-label {
    display: none;
  }

  .context-value {
    font-size: var(--text-sm);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .context-today-ref {
    display: none;
  }

  .project-emoji {
    font-size: var(--text-sm);
  }

  .project-name {
    gap: var(--space-1);
  }
}

/* Responsive: Mobile — tighter spacing, smaller elements */
@media (max-width: 640px) {
  .quick-sort-view {
    padding: var(--space-3) var(--space-4);
    gap: var(--space-2);
  }

  .view-title {
    font-size: var(--text-xl);
  }

  .session-stats {
    grid-template-columns: 1fr 1fr;
  }

  .tab-navigation {
    width: 100%;
    justify-content: center;
    padding: var(--space-2);
  }

  .tab-btn {
    flex: 1;
    justify-content: center;
    padding: var(--space-2) var(--space-3);
  }

  /* Action buttons: icon-only on mobile */
  .action-sidebar {
    gap: var(--space-1_5);
  }

  .action-label {
    display: none;
  }

  .action-btn kbd {
    display: none;
  }

  .action-btn {
    justify-content: center;
    padding: var(--space-2);
  }

  .context-panel {
    max-width: none;
    padding: var(--space-2_5) var(--space-3);
  }

  .context-icon-wrapper,
  .priority-dot {
    width: var(--space-4);
    height: var(--space-4);
  }

  .context-icon-wrapper svg {
    width: 12px;
    height: 12px;
  }

  .priority-dot::after {
    width: var(--space-1_5);
    height: var(--space-1_5);
  }

  .context-value {
    font-size: var(--text-xs);
  }

  .sort-main-column {
    gap: var(--space-3);
  }

  .helper-hint {
    display: none;
  }
}

/* Responsive: Very narrow — extra compact */
@media (max-width: 400px) {
  .quick-sort-view {
    padding: var(--space-2) var(--space-3);
  }

  .quick-sort-header {
    gap: var(--space-2);
  }

  .view-title {
    font-size: var(--text-lg);
  }

  .close-button {
    width: 40px;
    height: 40px;
  }

  .context-panel {
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
  }
}

/* AI Divider (TASK-1221) */
.ai-divider {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.ai-divider::before,
.ai-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--glass-border);
}

.ai-divider-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--brand-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* AI Button Variants */
.action-btn.ai-suggest,
.action-btn.ai-sort,
.action-btn.ai-batch,
.action-btn.ai-explain {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.action-btn.ai-suggest:hover,
.action-btn.ai-sort:hover,
.action-btn.ai-batch:hover,
.action-btn.ai-explain:hover {
  background: var(--brand-primary-subtle);
  border-color: var(--brand-primary);
}

.action-btn.is-loading {
  opacity: 0.7;
  cursor: wait;
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none !important;
}

.action-btn.ai-cancel {
  border-color: var(--danger-muted);
  color: var(--danger);
  font-size: var(--text-xs);
}

.action-btn.ai-cancel:hover {
  background: var(--danger-bg);
  border-color: var(--danger);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.spin {
  animation: spin 1s linear infinite;
}

/* AI Results in Context Panel */
.ai-error-section {
  padding: var(--space-3);
  background: var(--danger-bg);
  border: 1px solid var(--danger-muted);
  border-radius: var(--radius-md);
}

.ai-error-text {
  font-size: var(--text-sm);
  color: var(--danger);
  margin: 0 0 var(--space-2) 0;
}

.action-btn.ai-retry {
  border-color: var(--danger-muted);
  color: var(--danger);
  font-size: var(--text-xs);
  padding: var(--space-1) var(--space-2);
}

.action-btn.ai-apply {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  font-size: var(--text-xs);
  flex: 1;
}

.action-btn.ai-apply:hover {
  background: var(--brand-primary-subtle);
}

.action-btn.ai-dismiss {
  border-color: var(--glass-border);
  color: var(--text-muted);
  font-size: var(--text-xs);
  flex: 1;
}

.ai-actions-row {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

/* Suggestion Cards */
.ai-suggest-results {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.ai-suggestion-card {
  padding: var(--space-2);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
}

.ai-suggestion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-1);
}

.ai-suggestion-field {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  text-transform: capitalize;
}

.ai-suggestion-confidence {
  font-size: var(--text-xs);
  color: var(--brand-primary);
  font-weight: var(--font-semibold);
}

.ai-suggestion-values {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-sm);
}

.ai-old-value {
  color: var(--text-muted);
  text-decoration: line-through;
}

.ai-arrow {
  color: var(--brand-primary);
}

.ai-new-value {
  color: var(--text-primary);
  font-weight: var(--font-semibold);
}

.ai-suggestion-reason {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: var(--space-1) 0 0 0;
  font-style: italic;
}

/* Batch Results */
.ai-batch-results {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.ai-batch-count {
  font-size: var(--text-sm);
  color: var(--brand-primary);
  font-weight: var(--font-semibold);
  margin: 0;
}

.ai-batch-card {
  padding: var(--space-1_5) var(--space-2);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
}

.ai-batch-title {
  font-size: var(--text-xs);
  color: var(--text-primary);
  display: block;
  margin-bottom: var(--space-0_5);
}

.ai-batch-meta {
  display: flex;
  gap: var(--space-1);
}

.ai-batch-tag {
  font-size: 10px;
  padding: 1px var(--space-1);
  background: var(--glass-bg-medium);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
}

.ai-batch-more {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: 0;
}

/* Explain Results */
.ai-explain-results {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.ai-explain-desc {
  font-size: var(--text-sm);
  color: var(--text-primary);
  margin: 0;
  line-height: 1.5;
}

.ai-explain-steps {
  margin: 0;
  padding-left: var(--space-4);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.ai-explain-steps li {
  margin-bottom: var(--space-1);
}
</style>
