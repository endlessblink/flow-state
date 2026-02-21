<template>
  <div class="mobile-inbox">
    <!-- Debug Banner (tap to toggle) - dev user only -->
    <template v-if="isDevUser">
      <div v-if="showDebug" class="debug-banner" @click="showDebug = false">
        <div><strong>Sync Debug</strong> (tap to hide)</div>
        <div>Auth: {{ authStatus }}</div>
        <div>User: {{ userId || 'none' }}</div>
        <div>Tasks loaded: {{ taskStore.tasks.length }}</div>
        <div>Filtered: {{ filteredTasks.length }}</div>
        <div v-if="syncError" class="error">
          Error: {{ syncError }}
        </div>
      </div>
      <button v-else class="debug-toggle" @click="showDebug = true">
        ?
      </button>
    </template>

    <!-- Header -->
    <MobileInboxHeader
      :view-mode="viewMode"
      :today-date-label="todayDateLabel"
      :filtered-tasks-count="filteredTasks.length"
      @update:view-mode="setViewMode"
    />

    <!-- Filter Section -->
    <MobileInboxFilters
      :view-mode="viewMode"
      :active-time-filter="activeTimeFilter"
      :group-by="groupBy"
      :sort-by="sortBy"
      :hide-done-tasks="hideDoneTasks"
      :show-group-by-dropdown="showGroupByDropdown"
      :group-by-label="groupByLabel"
      :sort-label="sortLabel"
      :time-filters="timeFilters"
      :group-by-options="groupByOptions"
      @update:active-time-filter="activeTimeFilter = $event"
      @toggle-group-by-dropdown="showGroupByDropdown = !showGroupByDropdown"
      @select-group-by="setGroupBy"
      @toggle-sort="toggleSort"
      @update:hide-done-tasks="hideDoneTasks = $event"
    />

    <!-- Swipe hint (shows once) -->
    <div v-if="showSwipeHint" class="swipe-hint">
      <span class="hint-text">← Delete</span>
      <span class="hint-divider">|</span>
      <span class="hint-text">Edit →</span>
      <button class="hint-dismiss" @click="dismissSwipeHint">
        Got it
      </button>
    </div>

    <!-- Task List -->
    <MobileInboxTaskList
      :filtered-tasks="filteredTasks"
      :grouped-tasks="groupedTasks"
      :view-mode="viewMode"
      :active-time-filter="activeTimeFilter"
      :group-by="groupBy"
      :time-filter-label="timeFilterLabel"
      :is-timer-active="isTimerActive"
      :priority-label="priorityLabel"
      :is-overdue="(date) => isTaskOverdue(date as string | undefined)"
      :get-project-name="getProjectName"
      @edit-task="handleEditTask"
      @delete-task="handleDeleteTask"
      @click-task="handleTaskClick"
      @toggle-task="toggleTask"
      @start-timer="startTimer"
    />

    <!-- Quick Add Bar -->
    <MobileInboxQuickAdd
      :is-voice-supported="isVoiceSupported"
      :is-listening="isListening"
      :is-voice-online="isVoiceOnline"
      :has-voice-pending="hasVoicePending"
      :voice-pending-count="voicePendingCount"
      :is-processing-voice="isProcessingVoice"
      :is-voice-queued="isVoiceQueued"
      :recording-duration="recordingDuration"
      :voice-error="voiceError"
      @open-task-create-sheet="openTaskCreateSheet"
      @toggle-voice-input="toggleVoiceInput"
      @cancel-voice="cancelVoice"
    />

    <!-- Task Edit Bottom Sheet -->
    <TaskEditBottomSheet
      :is-open="isEditSheetOpen"
      :task="editingTask"
      @close="closeEditSheet"
      @save="handleSaveTask"
    />

    <!-- Full-screen Task Creation Sheet -->
    <TaskCreateBottomSheet
      :is-open="isTaskCreateOpen"
      :is-listening="isListening"
      :is-processing="isProcessingVoice"
      :voice-transcript="finalVoiceTranscript || whisperTranscript"
      :voice-error="voiceError"
      :can-re-record="isVoiceSupported"
      :voice-session-active="voiceSessionActive"
      @close="handleTaskCreateClose"
      @created="handleTaskSheetCreated"
      @stop-recording="stopVoice"
      @start-recording="handleStartReRecord"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useAuthStore } from '@/stores/auth'
import { useTimerStore } from '@/stores/timer'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
import { useMobileFilters } from '@/composables/mobile/useMobileFilters'
import { useMobileInboxLogic } from '@/mobile/composables/useMobileInboxLogic'

import MobileInboxHeader from '@/mobile/components/MobileInboxHeader.vue'
import MobileInboxFilters from '@/mobile/components/MobileInboxFilters.vue'
import MobileInboxTaskList from '@/mobile/components/MobileInboxTaskList.vue'
import MobileInboxQuickAdd from '@/mobile/components/MobileInboxQuickAdd.vue'
import TaskEditBottomSheet from '@/mobile/components/TaskEditBottomSheet.vue'
import TaskCreateBottomSheet from '@/mobile/components/TaskCreateBottomSheet.vue'

const taskStore = useTaskStore()
const authStore = useAuthStore()
const timerStore = useTimerStore()
const { lastSyncError } = useSupabaseDatabase()
const { priorityLabel } = useMobileFilters()

// Import the extracted logic and state
const logicOptions = useMobileInboxLogic()
const {
  viewMode,
  activeTimeFilter,
  sortBy,
  groupBy,
  hideDoneTasks,
  showGroupByDropdown,
  isTaskCreateOpen,
  finalVoiceTranscript,
  
  isListening,
  isProcessingVoice,
  isVoiceQueued,
  isVoiceSupported,
  voiceError,
  voiceSessionActive,
  voicePendingCount,
  hasVoicePending,
  isVoiceOnline,
  whisperTranscript,
  recordingDuration,

  setViewMode,
  setGroupBy,
  stopVoice,
  cancelVoice,
  toggleVoiceInput,
  handleStartReRecord,
  handleTaskCreateClose,
  isTaskOverdue,

  filteredTasks,
  groupedTasks,
  timeFilters,
  timeFilterLabel,
  groupByOptions,
  groupByLabel,
  sortLabel,
  todayDateLabel
} = logicOptions

// --- Local UI State ---
const showDebug = ref(false)
const isDevUser = computed(() => authStore.user?.email === 'endlessblink@gmail.com')
const authStatus = computed(() => authStore.isAuthenticated ? 'Signed in' : 'Not signed in')
const userId = computed(() => authStore.user?.id?.substring(0, 8) + '...' || null)
const syncError = computed(() => lastSyncError.value)

// Swipe hint
const SWIPE_HINT_KEY = 'flowstate-inbox-swipe-hint-dismissed'
const showSwipeHint = ref(false)

onMounted(() => {
  const dismissed = localStorage.getItem(SWIPE_HINT_KEY)
  if (!dismissed) {
    showSwipeHint.value = true
  }
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})

const dismissSwipeHint = () => {
  showSwipeHint.value = false
  localStorage.setItem(SWIPE_HINT_KEY, 'true')
}

// Close Dropdown helper
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.group-by-control')) {
    showGroupByDropdown.value = false
  }
}

// Toggle logic (wired through event mapping in template but we need to define toggleSort manually since it manipulates ref from composable)
const toggleSort = () => {
   const sortOptions: Array<'newest' | 'priority' | 'dueDate'> = ['newest', 'priority', 'dueDate']
   const currentIndex = sortOptions.indexOf(sortBy.value)
   sortBy.value = sortOptions[(currentIndex + 1) % sortOptions.length]
}

// Sheet Actions
const isEditSheetOpen = ref(false)
const editingTask = ref<Task | null>(null)

const handleEditTask = (task: Task) => {
  editingTask.value = task
  isEditSheetOpen.value = true
}

const closeEditSheet = () => {
  isEditSheetOpen.value = false
  setTimeout(() => {
    editingTask.value = null
  }, 300)
}

const handleSaveTask = async (taskId: string, updates: Partial<Task>) => {
  await taskStore.updateTask(taskId, updates)
}

const handleDeleteTask = (task: Task) => {
  taskStore.deleteTask(task.id)
}

const openTaskCreateSheet = () => {
  isTaskCreateOpen.value = true
}

const handleTaskSheetCreated = (data: { title: string; description: string; priority: 'high' | 'medium' | 'low' | null; dueDate: Date | null }) => {
  taskStore.createTask({
    title: data.title,
    status: 'planned',
    ...(data.description && { description: data.description }),
    ...(data.dueDate && { dueDate: data.dueDate.toISOString() }),
    ...(data.priority && { priority: data.priority })
  })
  handleTaskCreateClose()
}

// Task Item Actions
const toggleTask = async (task: Task) => {
  const newStatus = task.status === 'done' ? 'planned' : 'done'
  await taskStore.updateTask(task.id, { status: newStatus })
}

const handleTaskClick = (_task: Task) => {
  // handled by swipe
}

const startTimer = async (task: Task) => {
  await timerStore.startTimer(task.id)
}

const isTimerActive = (taskId: string) => {
  return timerStore.isTimerActive && timerStore.currentTaskId === taskId
}

const getProjectName = (projectId: string | undefined | null): string | null => {
  if (!projectId) return null
  const project = taskStore.projects.find(p => p.id === projectId)
  return project?.name || null
}
</script>

<style scoped>
.mobile-inbox {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  /* Space for teleported quick-add bar (~80px incl padding) - nav spacing handled by MobileLayout */
  padding-bottom: 80px;
}

/* Debug / Auth Banner */
.debug-toggle {
  position: fixed;
  top: env(safe-area-inset-top, 10px);
  right: 10px;
  z-index: 9999;
  width: 30px;
  height: 30px;
  border-radius: 15px;
  background: rgba(0,0,0,0.5);
  color: white;
  border: none;
  font-weight: bold;
}

.debug-banner {
  position: fixed;
  top: env(safe-area-inset-top, 0);
  left: 0;
  right: 0;
  background: rgba(0,0,0,0.8);
  color: #0f0;
  font-family: monospace;
  font-size: 10px;
  padding: 10px;
  z-index: 9999;
}

.error {
  color: #f00;
  font-weight: bold;
}

/* Swipe hint banner */
.swipe-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-2_5) var(--space-4);
  margin: 0 var(--space-4) var(--space-3);
  background: var(--surface-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
}

.hint-text {
  font-size: var(--text-meta);
  color: var(--text-secondary);
  font-weight: var(--font-medium);
}

.hint-divider {
  color: var(--border-subtle);
}

.hint-dismiss {
  margin-left: var(--space-2);
  padding: var(--space-1_5) var(--space-3);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--brand-primary);
  background: var(--brand-primary-subtle);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
}

.hint-dismiss:active {
  transform: scale(0.95);
}
</style>
