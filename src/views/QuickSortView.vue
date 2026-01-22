<template>
  <div class="quick-sort-view">
    <!-- Header -->
    <header class="quick-sort-header">
      <div class="header-content--quicksort">
        <h1 class="view-title">
          <Zap :size="32" />
          Quick Sort
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
        <span>Sort</span>
        <span v-if="uncategorizedCount > 0" class="tab-badge">{{ uncategorizedCount }}</span>
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'capture' }"
        @click="activeTab = 'capture'"
      >
        <Plus :size="18" />
        <span>Capture</span>
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
          <!-- Progress Indicator -->
          <SortProgress
            v-if="!isComplete"
            :current="progress.current"
            :total="progress.total"
            :message="motivationalMessage"
            :streak="currentStreak"
          />

          <!-- Task Card or Completion -->
          <div class="card-container">
            <!-- Active Task Card -->
            <Transition name="card-slide" mode="out-in">
              <QuickSortCard
                v-if="currentTask && !isComplete"
                :key="currentTask.id"
                :task="currentTask"
                @update-task="handleTaskUpdate"
                @mark-done="handleMarkDone"
                @edit-task="handleEditTask"
                @mark-done-and-delete="handleMarkDoneAndDelete"
              />

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
                  Done
                </button>
              </div>
            </Transition>
          </div>

          <!-- Category Selector -->
          <CategorySelector
            v-if="!isComplete && currentTask"
            @select="handleCategorize"
            @skip="handleSkip"
            @create-new="showProjectModal = true"
          />

          <!-- Action Buttons -->
          <div v-if="!isComplete && currentTask" class="action-buttons">
            <button
              class="action-button"
              :disabled="!canUndo"
              aria-label="Undo last categorization"
              @click="handleUndo"
            >
              <Undo2 :size="20" />
              Undo
              <kbd v-if="canUndo">Ctrl+Z</kbd>
            </button>

            <button class="action-button" aria-label="Skip this task" @click="handleSkip">
              <SkipForward :size="20" />
              Skip
              <kbd>Space</kbd>
            </button>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Celebration Animation -->
    <Transition name="fade">
      <div v-if="showCelebration" class="celebration-overlay">
        <div class="celebration-content">
          <CheckCircle :size="48" class="check-icon" />
          <span class="celebration-text">Sorted!</span>
        </div>
      </div>
    </Transition>

    <!-- Project Modal -->
    <ProjectModal
      v-if="showProjectModal"
      :is-open="showProjectModal"
      @close="showProjectModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Zap, X, CheckCircle, Undo2, SkipForward, Plus } from 'lucide-vue-next'
import { useQuickSort } from '@/composables/useQuickSort'
import { useQuickCapture } from '@/composables/useQuickCapture'
import { useTaskStore } from '@/stores/tasks'
import QuickSortCard from '@/components/QuickSortCard.vue'
import QuickCaptureTab from '@/components/quicksort/QuickCaptureTab.vue'
import CategorySelector from '@/components/layout/CategorySelector.vue'
import SortProgress from '@/components/tasks/SortProgress.vue'
import ProjectModal from '@/components/projects/ProjectModal.vue'
import type { SessionSummary } from '@/stores/quickSort'
import type { Task } from '@/types/tasks'

const router = useRouter()
const route = useRoute()
const taskStore = useTaskStore()
const quickCapture = useQuickCapture()

// Tab state
const activeTab = ref<'sort' | 'capture'>('sort')
const captureTabRef = ref<InstanceType<typeof QuickCaptureTab> | null>(null)

// Tab badge counts
const uncategorizedCount = computed(() => uncategorizedTasks.value.length)
const pendingCount = computed(() => quickCapture.pendingTasks.value.length)

const showProjectModal = ref(false)
const showEditModal = ref(false)
const showCelebration = ref(false)
const sessionSummary = ref<SessionSummary | null>(null)
const taskToEdit = ref<Task | null>(null)

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
  uncategorizedTasks,
  progress,
  isComplete,
  motivationalMessage,
  canUndo,
  currentStreak,
  startSession,
  endSession,
  categorizeTask,
  markTaskDone,
  markDoneAndDeleteTask,
  skipTask,
  undoLastCategorization
} = useQuickSort()

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

  // Show celebration animation
  showCelebration.value = true
  setTimeout(() => {
    showCelebration.value = false
  }, 800)

  // Categorize task (this will auto-advance)
  categorizeTask(currentTask.value.id, projectId)
}

function handleTaskUpdate(updates: Partial<Task>) {
  if (!currentTask.value) return

  // Update task with new priority or due date
  taskStore.updateTask(currentTask.value.id, updates)
}

function handleSkip() {
  skipTask()
}

function handleUndo() {
  if (canUndo) {
    undoLastCategorization()
  }
}

function handleMarkDone() {
  if (!currentTask.value) return

  // Show minimal celebration animation
  showCelebration.value = true
  setTimeout(() => {
    showCelebration.value = false
  }, 500)

  // Mark task as done and move to next
  markTaskDone(currentTask.value.id)
}

function handleMarkDoneAndDelete() {
  if (!currentTask.value) return

  // Show minimal celebration animation
  showCelebration.value = true
  setTimeout(() => {
    showCelebration.value = false
  }, 500)

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
</script>

<style scoped>
.quick-sort-view {
  height: 100%;
  min-height: 0; /* Allow flexbox shrinking */
  padding: var(--space-8);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  overflow-y: auto; /* Enable scrolling if content exceeds */
  position: relative; /* Establish positioning context for celebration overlay */
}

.quick-sort-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-6);
}

.header-content--quicksort {
  flex: 1;
}

.view-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-4xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0 0 var(--space-2) 0;
}

.view-subtitle {
  font-size: var(--text-base);
  color: var(--text-secondary);
  margin: 0;
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
  background: var(--brand-gradient);
  border-color: var(--brand-primary);
  color: var(--bg-primary);
  font-weight: var(--font-semibold);
  box-shadow: 0 2px 8px var(--brand-primary-alpha-20);
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
  background: var(--overlay-light);
  color: var(--bg-primary);
}

.tab-badge.pending {
  background: var(--warning);
  color: var(--bg-primary);
}

.tab-btn.active .tab-badge.pending {
  background: var(--overlay-light);
  color: var(--bg-primary);
}

/* Sort Tab Content */
.sort-tab-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-8);
  width: 100%;
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
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-8);
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.card-container {
  width: 100%;
  min-height: 350px;
  display: flex;
  align-items: center;
  justify-content: center;
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
  background: rgba(251, 146, 60, 0.1);
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

.action-buttons {
  display: flex;
  gap: var(--space-3);
  justify-content: center;
  flex-wrap: wrap;
}

.action-button {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal);
}

.action-button:hover:not(:disabled) {
  background: var(--glass-bg-heavy);
  border-color: var(--glass-border-hover);
  transform: translateY(-2px);
}

.action-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.action-button kbd {
  margin-left: var(--space-2);
  padding: var(--space-1) var(--space-1_5);
  background: var(--glass-bg-heavy);
  border-radius: var(--radius-sm);
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
  background: rgba(78, 205, 196, 0.08);
  border-color: var(--brand-hover);
  color: var(--brand-hover);
  transform: translateY(-2px);
  box-shadow: var(--state-hover-shadow);
}

/* Celebration Overlay */
.celebration-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 50;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.celebration-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8) var(--space-12);
  background: rgba(16, 185, 129, 0.95);
  border-radius: var(--radius-xl);
  box-shadow: 0 8px 32px rgba(16, 185, 129, 0.5);
  animation: celebrate var(--duration-slower) var(--ease-out);
}

@keyframes celebrate {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.check-icon {
  color: var(--text-primary);
}

.celebration-text {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  text-align: center;
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
  .celebration-icon {
    animation: none !important;
    transition: none !important;
  }
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .quick-sort-view {
    padding: var(--space-5);
  }

  .view-title {
    font-size: var(--space-7);
  }

  .session-stats {
    grid-template-columns: 1fr 1fr;
  }

  .tab-navigation {
    width: 100%;
    justify-content: center;
  }

  .tab-btn {
    flex: 1;
    justify-content: center;
  }
}
</style>
