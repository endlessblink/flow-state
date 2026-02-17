<template>
  <div class="mobile-inbox">
    <!-- Debug Banner (tap to toggle) — dev user only -->
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
    <div class="mobile-inbox-header">
      <h2>Inbox</h2>
      <div class="header-actions">
        <span class="task-count">{{ filteredTasks.length }}</span>
      </div>
    </div>

    <!-- TASK-1104: Enhanced Filter Section -->
    <div class="filter-section">
      <!-- Time-based Filters Row -->
      <div class="filter-chips">
        <button
          v-for="filter in timeFilters"
          :key="filter.value"
          class="filter-chip"
          :class="[{ active: activeTimeFilter === filter.value }]"
          @click="setTimeFilter(filter.value)"
        >
          <component :is="filter.icon" :size="14" />
          {{ filter.label }}
          <span v-if="filter.count > 0" class="filter-count">{{ filter.count }}</span>
        </button>
      </div>

      <!-- Group By + Sort Row -->
      <div class="controls-row">
        <!-- Group By Dropdown -->
        <div class="group-by-control">
          <button class="control-btn" @click="toggleGroupByDropdown">
            <Layers :size="14" />
            <span>{{ groupByLabel }}</span>
            <ChevronDown :size="12" :class="{ rotated: showGroupByDropdown }" />
          </button>
          <div v-if="showGroupByDropdown" class="dropdown-menu">
            <button
              v-for="option in groupByOptions"
              :key="option.value"
              class="dropdown-item"
              :class="{ active: groupBy === option.value }"
              @click="selectGroupBy(option.value)"
            >
              <component :is="option.icon" :size="14" />
              {{ option.label }}
            </button>
          </div>
        </div>

        <!-- Sort toggle -->
        <button class="sort-btn" @click="toggleSort">
          <ArrowUpDown :size="16" />
          {{ sortLabel }}
        </button>

        <!-- Hide Done Toggle -->
        <button
          class="control-btn hide-done-btn"
          :class="{ active: hideDoneTasks }"
          :title="hideDoneTasks ? 'Showing active tasks' : 'Show completed tasks'"
          @click="hideDoneTasks = !hideDoneTasks"
        >
          <CheckCircle2 :size="14" />
        </button>
      </div>
    </div>

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
    <div class="mobile-task-list">
      <div v-if="filteredTasks.length === 0" class="empty-state">
        <Inbox :size="48" />
        <p v-if="activeTimeFilter === 'all'">
          No tasks yet
        </p>
        <p v-else>
          No {{ timeFilterLabel }} tasks
        </p>
      </div>

      <!-- TASK-1104: Grouped Task Display -->
      <template v-if="groupBy !== 'none' && filteredTasks.length > 0">
        <div v-for="group in groupedTasks" :key="group.key" class="task-group">
          <div class="group-header">
            <span v-if="group.color" class="group-color-dot" :style="{ backgroundColor: group.color }" />
            <span class="group-title">{{ group.title }}</span>
            <span class="group-count">{{ group.tasks.length }}</span>
          </div>
          <SwipeableTaskItem
            v-for="task in group.tasks"
            :key="task.id"
            :task-id="task.id"
            @edit="handleEditTask(task)"
            @delete="handleDeleteTask(task)"
          >
            <div
              class="mobile-task-item"
              :class="[{ 'timer-active': isTimerActive(task.id) }]"
              @click="handleTaskClick(task)"
            >
              <div class="task-checkbox" @click.stop="toggleTask(task)">
                <div class="checkbox-circle" :class="[{ checked: task.status === 'done' }]">
                  <Check v-if="task.status === 'done'" :size="14" />
                </div>
              </div>

              <div class="task-content">
                <div class="task-title-row">
                  <span class="task-title" dir="auto" :class="[{ done: task.status === 'done' }]">{{ task.title }}</span>
                  <span v-if="task.priority && groupBy !== 'priority'" class="priority-badge-inline" :class="[task.priority]">
                    {{ priorityLabel(task.priority || 'none') }}
                  </span>
                </div>
                <div class="task-meta">
                  <span v-if="task.dueDate && groupBy !== 'date'" class="due-date" :class="[{ overdue: isOverdue(task.dueDate) }]">
                    <Calendar :size="12" />
                    {{ formatDueDate(task.dueDate) }}
                  </span>
                  <span v-if="getProjectName(task.projectId) && groupBy !== 'project'" class="project-badge">
                    {{ getProjectName(task.projectId) }}
                  </span>
                </div>
              </div>

              <button class="timer-btn" @click.stop="startTimer(task)">
                <Play :size="16" />
              </button>
            </div>
          </SwipeableTaskItem>
        </div>
      </template>

      <!-- Flat List (no grouping) -->
      <template v-else>
        <SwipeableTaskItem
          v-for="task in filteredTasks"
          :key="task.id"
          :task-id="task.id"
          @edit="handleEditTask(task)"
          @delete="handleDeleteTask(task)"
        >
          <div
            class="mobile-task-item"
            :class="[{ 'timer-active': isTimerActive(task.id) }]"
            @click="handleTaskClick(task)"
          >
            <div class="task-checkbox" @click.stop="toggleTask(task)">
              <div class="checkbox-circle" :class="[{ checked: task.status === 'done' }]">
                <Check v-if="task.status === 'done'" :size="14" />
              </div>
            </div>

            <div class="task-content">
              <div class="task-title-row">
                <span class="task-title" dir="auto" :class="[{ done: task.status === 'done' }]">{{ task.title }}</span>
                <span v-if="task.priority" class="priority-badge-inline" :class="[task.priority]">
                  {{ priorityLabel(task.priority || 'none') }}
                </span>
              </div>
              <div class="task-meta">
                <span v-if="task.dueDate" class="due-date" :class="[{ overdue: isOverdue(task.dueDate) }]">
                  <Calendar :size="12" />
                  {{ formatDueDate(task.dueDate) }}
                </span>
                <span v-if="getProjectName(task.projectId)" class="project-badge">
                  {{ getProjectName(task.projectId) }}
                </span>
              </div>
            </div>

            <button class="timer-btn" @click.stop="startTimer(task)">
              <Play :size="16" />
            </button>
          </div>
        </SwipeableTaskItem>
      </template>
    </div>

    <!-- Quick Add Bar (trigger only) — Teleported to <body> to escape scroll container's
         overflow clipping, which breaks position:fixed on mobile WebKit/Blink (BUG-1312) -->
    <Teleport to="body">
      <div class="quick-add-bar">
        <div class="quick-add-row">
          <input
            type="text"
            placeholder="Add a task..."
            class="quick-add-input"
            readonly
            @click="openTaskCreateSheet"
          >

          <!-- Mic button with offline queue badge (TASK-1131) -->
          <button
            v-if="isVoiceSupported"
            class="mic-btn"
            :class="[{ recording: isListening, offline: !isVoiceOnline }]"
            @click="toggleVoiceInput"
          >
            <Mic v-if="!isListening" :size="20" />
            <MicOff v-else :size="20" />
            <span v-if="hasVoicePending" class="voice-pending-badge">{{ voicePendingCount }}</span>
          </button>

          <button
            class="add-btn"
            @click="openTaskCreateSheet"
          >
            <Plus :size="20" />
          </button>
        </div>

        <!-- Voice feedback (when recording) - Whisper only (TASK-1119) -->
        <div v-if="isListening || isProcessingVoice || isVoiceQueued" class="voice-feedback">
          <span class="voice-mode-badge whisper">🤖 AI</span>
          <div class="voice-waveform" :class="{ paused: isVoiceQueued }">
            <span class="wave-bar" />
            <span class="wave-bar" />
            <span class="wave-bar" />
            <span class="wave-bar" />
            <span class="wave-bar" />
          </div>
          <span class="voice-status">
            <template v-if="isVoiceQueued">📥 Saved offline - will transcribe when online</template>
            <template v-else-if="isProcessingVoice">Processing...</template>
            <template v-else>{{ recordingDuration }}s - Speak freely...</template>
          </span>
          <button v-if="!isVoiceQueued" class="voice-cancel" @click="cancelVoice">
            <X :size="16" />
          </button>
        </div>

        <!-- Voice mode indicator when not recording -->
        <div v-if="isVoiceSupported && !isListening && !isProcessingVoice && !isVoiceQueued" class="voice-lang-hint">
          <span v-if="!isVoiceOnline" class="voice-offline-badge">📴 Offline</span>
          <span class="voice-mode-badge whisper">🤖 AI (auto-detect)</span>
          <span v-if="hasVoicePending" class="voice-queue-status">{{ voicePendingCount }} queued</span>
        </div>

        <!-- Voice error message -->
        <div v-if="voiceError && !isListening" class="voice-error">
          {{ voiceError }}
        </div>

      <!-- Voice Task Confirmation removed - using TaskCreateBottomSheet instead (TASK-1077) -->
      </div>
    </Teleport>

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
      :can-re-record="isVoiceSupported"
      @close="handleTaskCreateClose"
      @created="handleTaskSheetCreated"
      @stop-recording="stopVoice"
      @start-recording="handleStartReRecord"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useAuthStore } from '@/stores/auth'
import { useTimerStore } from '@/stores/timer'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
import { useMobileFilters, type GroupByType } from '@/composables/mobile/useMobileFilters'
import TaskEditBottomSheet from '@/mobile/components/TaskEditBottomSheet.vue'
import TaskCreateBottomSheet from '@/mobile/components/TaskCreateBottomSheet.vue'
import SwipeableTaskItem from '@/mobile/components/SwipeableTaskItem.vue'
import {
  Plus, Check, Play, Calendar, Inbox,
  CheckCircle2, ArrowUpDown,
  Flag, ChevronDown, Mic, MicOff, X,
  Layers, CalendarClock, AlertCircle, FolderOpen, ListFilter
} from 'lucide-vue-next'
// Web Speech API removed (TASK-1119) - Whisper-only for better Hebrew support
import { useWhisperSpeech } from '@/composables/useWhisperSpeech'
import { useOfflineVoiceQueue } from '@/composables/useOfflineVoiceQueue'
import { useHaptics } from '@/composables/useHaptics'

const taskStore = useTaskStore()
const authStore = useAuthStore()
const timerStore = useTimerStore()
const { lastSyncError } = useSupabaseDatabase()
const { triggerHaptic } = useHaptics()

// Shared mobile filter state (persists across view navigation)
const {
  groupBy,
  hideDoneTasks,
  hasActiveFilters: _hasActiveFilters,
  priorityLabel,
  setGroupBy,
  toggleHideDoneTasks: _toggleHideDoneTasks
} = useMobileFilters()

// State
const newTaskTitle = ref('')
const taskInput = ref<HTMLInputElement | null>(null)
const showDebug = ref(false)
const isDevUser = computed(() => authStore.user?.email === 'endlessblink@gmail.com')
const sortBy = ref<'newest' | 'priority' | 'dueDate'>('newest')

// TASK-1104: Enhanced filtering state (view-specific)
type TimeFilterType = 'all' | 'today' | 'week' | 'overdue'

const activeTimeFilter = ref<TimeFilterType>('all')
const showGroupByDropdown = ref(false)

// Quick-add expanded state
const isQuickAddExpanded = ref(false)
const selectedDueDate = ref<string | null>(null)
const quickAddPriority = ref<string | null>(null) // Local state for quick-add form only

// Task create sheet state
const isTaskCreateOpen = ref(false)
const finalVoiceTranscript = ref('')

// Swipe hint - show once for first-time users
const SWIPE_HINT_KEY = 'flowstate-inbox-swipe-hint-dismissed'
const showSwipeHint = ref(false)

onMounted(() => {
  const dismissed = localStorage.getItem(SWIPE_HINT_KEY)
  if (!dismissed) {
    showSwipeHint.value = true
  }
})

const dismissSwipeHint = () => {
  showSwipeHint.value = false
  localStorage.setItem(SWIPE_HINT_KEY, 'true')
}

// TASK-1131: Offline voice queue - transcribe audio function for queue processing
const getWhisperEndpoint = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
  if (supabaseUrl.startsWith('/')) {
    return `${window.location.origin}${supabaseUrl}/functions/v1/whisper-transcribe`
  }
  return `${supabaseUrl}/functions/v1/whisper-transcribe`
}

const transcribeAudioForQueue = async (blob: Blob, mimeType: string): Promise<{ text: string; language: string }> => {
  const formData = new FormData()
  const extension = mimeType.includes('webm') ? 'webm'
    : mimeType.includes('mp4') ? 'mp4'
    : mimeType.includes('wav') ? 'wav'
    : 'webm'

  formData.append('file', blob, `audio.${extension}`)
  formData.append('model', 'whisper-large-v3-turbo')

  const response = await fetch(getWhisperEndpoint(), {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error?.message || `API error: ${response.status}`)
  }

  const data = await response.json()
  return { text: data.text || '', language: data.language || 'unknown' }
}

// TASK-1131: Offline voice queue
const {
  pendingCount: voicePendingCount,
  hasPending: hasVoicePending,
  isProcessing: isQueueProcessing,
  enqueue: enqueueVoice
} = useOfflineVoiceQueue({
  transcribeAudio: transcribeAudioForQueue,
  onProcessed: (result) => {
    console.log('[OfflineVoice] Processed queued audio:', result.transcript)
    // Open TaskCreateBottomSheet and set transcript
    finalVoiceTranscript.value = result.transcript.trim()
    isTaskCreateOpen.value = true
  },
  onError: (error, item) => {
    console.error('[OfflineVoice] Failed to process queued audio:', error, item.id)
  }
})

// Voice input - Whisper only (TASK-1119: removed Web Speech API for better Hebrew support)
const {
  isRecording: isWhisperRecording,
  isProcessing: isWhisperProcessing,
  isQueued: isWhisperQueued,
  isSupported: isWhisperSupported,
  hasApiKey: hasWhisperApiKey,
  transcript: whisperTranscript,
  error: whisperError,
  recordingDuration,
  isOnline: isVoiceOnline,
  start: startWhisper,
  stop: stopWhisper,
  cancel: cancelWhisper
} = useWhisperSpeech({
  onResult: (result) => {
    console.log('[Whisper] Result:', result)
    if (result.transcript.trim()) {
      // Keep TaskCreateBottomSheet open - transcript flows via voiceTranscript prop
      // The sheet's watcher will populate the text field
      finalVoiceTranscript.value = result.transcript.trim()
    }
  },
  onError: (err) => {
    console.warn('[Whisper] Error:', err)
  },
  // TASK-1131: Handle offline recording
  onOfflineRecord: async (audioBlob, mimeType) => {
    console.log('[Whisper] Offline - queuing audio')
    await enqueueVoice(audioBlob, mimeType)
    // Show feedback that audio was queued
    triggerHaptic('medium')
  }
})

// Voice state - Whisper only (TASK-1119) + offline queue (TASK-1131)
const isListening = computed(() => isWhisperRecording.value)
const isProcessingVoice = computed(() => isWhisperProcessing.value || isQueueProcessing.value)
const isVoiceQueued = computed(() => isWhisperQueued.value)
const isVoiceSupported = computed(() => isWhisperSupported.value && hasWhisperApiKey.value)
const voiceError = computed(() => whisperError.value)

// Voice control functions - Whisper only
const startVoice = async () => {
  await startWhisper()
}

const stopVoice = () => {
  stopWhisper()
}

// TASK-1110: Handle re-record request from TaskCreateBottomSheet
const handleStartReRecord = async () => {
  // Clear previous transcript
  finalVoiceTranscript.value = ''
  // Start new recording
  await startVoice()
}

const cancelVoice = () => {
  cancelWhisper()
}

// Toggle voice recording
const toggleVoiceInput = async () => {
  if (isListening.value) {
    stopVoice()
  } else {
    // Reset state when starting new voice input
    finalVoiceTranscript.value = ''
    // Open TaskCreateBottomSheet to show voice feedback during recording
    isTaskCreateOpen.value = true
    await startVoice()
  }
}

// Date quick options
const _dateOptions = [
  { label: 'Today', value: 'today' },
  { label: 'Tomorrow', value: 'tomorrow' },
  { label: 'Next Week', value: 'nextweek' },
  { label: 'None', value: null }
]

// Priority options (matches Task type: 'low' | 'medium' | 'high' | null)
const _priorityOptions = [
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' }
]

// Edit sheet state
const isEditSheetOpen = ref(false)
const editingTask = ref<Task | null>(null)

// Debug info
const authStatus = computed(() => authStore.isAuthenticated ? 'Signed in' : 'Not signed in')
const userId = computed(() => authStore.user?.id?.substring(0, 8) + '...' || null)
const syncError = computed(() => lastSyncError.value)

// Open edit bottom sheet for task
const handleEditTask = (task: Task) => {
  editingTask.value = task
  isEditSheetOpen.value = true
}

// Close edit bottom sheet
const closeEditSheet = () => {
  isEditSheetOpen.value = false
  // Delay clearing the task to allow close animation
  setTimeout(() => {
    editingTask.value = null
  }, 300)
}

// Save task changes from edit sheet
const handleSaveTask = async (taskId: string, updates: Partial<Task>) => {
  // BUG-1051: AWAIT to ensure persistence
  await taskStore.updateTask(taskId, updates)
}

// Delete task (triggered by swipe left + confirm)
const handleDeleteTask = (task: Task) => {
  taskStore.deleteTask(task.id)
}

// TASK-1104: Date helpers
const getToday = () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

const getWeekEnd = () => {
  const today = getToday()
  const dayOfWeek = today.getDay()
  const daysUntilSunday = dayOfWeek === 0 ? 7 : (7 - dayOfWeek)
  const weekEnd = new Date(today)
  weekEnd.setDate(today.getDate() + daysUntilSunday)
  return weekEnd
}

const isDueToday = (dueDate: string | undefined): boolean => {
  if (!dueDate) return false
  const date = new Date(dueDate)
  date.setHours(0, 0, 0, 0)
  return date.getTime() === getToday().getTime()
}

const isDueThisWeek = (dueDate: string | undefined): boolean => {
  if (!dueDate) return false
  const date = new Date(dueDate)
  date.setHours(0, 0, 0, 0)
  const today = getToday()
  const weekEnd = getWeekEnd()
  return date >= today && date < weekEnd
}

const isTaskOverdue = (dueDate: string | undefined): boolean => {
  if (!dueDate) return false
  const date = new Date(dueDate)
  date.setHours(0, 0, 0, 0)
  return date < getToday()
}

// TASK-1104: Time filter configuration with counts
const timeFilters = computed(() => {
  const allTasks = taskStore.tasks.filter(t => !hideDoneTasks.value || t.status !== 'done')
  return [
    { value: 'all' as const, label: 'All', icon: Inbox, count: allTasks.length },
    { value: 'today' as const, label: 'Today', icon: Calendar, count: allTasks.filter(t => isDueToday(t.dueDate)).length },
    { value: 'week' as const, label: 'This Week', icon: CalendarClock, count: allTasks.filter(t => isDueThisWeek(t.dueDate)).length },
    { value: 'overdue' as const, label: 'Overdue', icon: AlertCircle, count: allTasks.filter(t => isTaskOverdue(t.dueDate) && t.status !== 'done').length },
  ]
})

const timeFilterLabel = computed(() => {
  const labels: Record<TimeFilterType, string> = {
    all: 'all',
    today: 'due today',
    week: 'due this week',
    overdue: 'overdue'
  }
  return labels[activeTimeFilter.value]
})

// TASK-1104: Group by options
const groupByOptions = [
  { value: 'none' as const, label: 'No Grouping', icon: ListFilter },
  { value: 'date' as const, label: 'By Date', icon: Calendar },
  { value: 'project' as const, label: 'By Project', icon: FolderOpen },
  { value: 'priority' as const, label: 'By Priority', icon: Flag },
]

const groupByLabel = computed(() => {
  const option = groupByOptions.find(o => o.value === groupBy.value)
  return option?.label || 'Group'
})

// Computed: Filtered tasks
const filteredTasks = computed(() => {
  let tasks = [...taskStore.tasks]

  // Hide done tasks filter
  if (hideDoneTasks.value) {
    tasks = tasks.filter(t => t.status !== 'done')
  }

  // Time-based filter
  switch (activeTimeFilter.value) {
    case 'today':
      tasks = tasks.filter(t => isDueToday(t.dueDate))
      break
    case 'week':
      tasks = tasks.filter(t => isDueThisWeek(t.dueDate))
      break
    case 'overdue':
      tasks = tasks.filter(t => isTaskOverdue(t.dueDate) && t.status !== 'done')
      break
    // 'all' shows everything
  }

  // Sort
  switch (sortBy.value) {
    case 'priority': {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3, none: 4 }
      tasks.sort((a, b) =>
        (priorityOrder[a.priority || 'none'] || 4) - (priorityOrder[b.priority || 'none'] || 4)
      )
      break
    }
    case 'dueDate':
      tasks.sort((a, b) => {
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      })
      break
    case 'newest':
    default:
      tasks.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return bTime - aTime
      })
  }

  return tasks
})

// TASK-1104: Grouped tasks computed
interface TaskGroup {
  key: string
  title: string
  color?: string
  tasks: Task[]
}

const groupedTasks = computed((): TaskGroup[] => {
  if (groupBy.value === 'none') return []

  const tasks = filteredTasks.value
  const groups: Map<string, TaskGroup> = new Map()

  tasks.forEach(task => {
    let key: string
    let title: string
    let color: string | undefined

    switch (groupBy.value) {
      case 'date': {
        if (!task.dueDate) {
          key = 'no-date'
          title = 'No Due Date'
        } else if (isTaskOverdue(task.dueDate)) {
          key = 'overdue'
          title = 'Overdue'
          color = 'var(--color-priority-high)'
        } else if (isDueToday(task.dueDate)) {
          key = 'today'
          title = 'Today'
          color = 'var(--color-success)'
        } else if (isDueThisWeek(task.dueDate)) {
          key = 'this-week'
          title = 'This Week'
          color = 'var(--color-info)'
        } else {
          key = 'later'
          title = 'Later'
          color = 'var(--color-neutral)'
        }
        break
      }
      case 'project': {
        if (!task.projectId) {
          key = 'no-project'
          title = 'No Project'
        } else {
          const project = taskStore.projects.find(p => p.id === task.projectId)
          key = task.projectId
          title = project?.name || 'Unknown Project'
          // Handle color being string or string[]
          const projectColor = project?.color
          color = Array.isArray(projectColor) ? projectColor[0] : projectColor
        }
        break
      }
      case 'priority': {
        const priorityColors: Record<string, string> = {
          critical: 'var(--color-danger)',
          high: 'var(--color-priority-high)',
          medium: 'var(--color-priority-medium)',
          low: 'var(--color-success)',
          none: 'var(--color-neutral)'
        }
        const priorityLabels: Record<string, string> = {
          critical: 'Critical (P0)',
          high: 'High (P1)',
          medium: 'Medium (P2)',
          low: 'Low (P3)',
          none: 'No Priority'
        }
        const priority = task.priority || 'none'
        key = priority
        title = priorityLabels[priority] || 'No Priority'
        color = priorityColors[priority]
        break
      }
      default:
        key = 'default'
        title = 'Tasks'
    }

    if (!groups.has(key)) {
      groups.set(key, { key, title, color, tasks: [] })
    }
    groups.get(key)!.tasks.push(task)
  })

  // Sort groups based on groupBy type
  const sortedGroups = Array.from(groups.values())

  if (groupBy.value === 'date') {
    const dateOrder = ['overdue', 'today', 'this-week', 'later', 'no-date']
    sortedGroups.sort((a, b) => dateOrder.indexOf(a.key) - dateOrder.indexOf(b.key))
  } else if (groupBy.value === 'priority') {
    const priorityOrder = ['critical', 'high', 'medium', 'low', 'none']
    sortedGroups.sort((a, b) => priorityOrder.indexOf(a.key) - priorityOrder.indexOf(b.key))
  } else if (groupBy.value === 'project') {
    // Sort by project name, with "No Project" at the end
    sortedGroups.sort((a, b) => {
      if (a.key === 'no-project') return 1
      if (b.key === 'no-project') return -1
      return a.title.localeCompare(b.title)
    })
  }

  return sortedGroups
})

// Helper to get project name
const getProjectName = (projectId: string | undefined | null): string | null => {
  if (!projectId) return null
  const project = taskStore.projects.find(p => p.id === projectId)
  return project?.name || null
}

const sortLabel = computed(() => {
  switch (sortBy.value) {
    case 'priority': return 'Priority'
    case 'dueDate': return 'Due'
    default: return 'Newest'
  }
})

// TASK-1104: Filter Actions
const setTimeFilter = (filter: TimeFilterType) => {
  activeTimeFilter.value = filter
}

const toggleGroupByDropdown = () => {
  showGroupByDropdown.value = !showGroupByDropdown.value
}

const selectGroupBy = (value: GroupByType) => {
  setGroupBy(value)
  showGroupByDropdown.value = false
}

const toggleSort = () => {
  const sortOptions: Array<'newest' | 'priority' | 'dueDate'> = ['newest', 'priority', 'dueDate']
  const currentIndex = sortOptions.indexOf(sortBy.value)
  sortBy.value = sortOptions[(currentIndex + 1) % sortOptions.length]
}

// Close dropdown when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.group-by-control')) {
    showGroupByDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Quick-add expansion handlers
const _expandQuickAdd = () => {
  console.log('[TASK-1005] expandQuickAdd called, setting isQuickAddExpanded to true')
  isQuickAddExpanded.value = true
}

const _collapseQuickAdd = () => {
  isQuickAddExpanded.value = false
}

// Open task create sheet
const openTaskCreateSheet = () => {
  isTaskCreateOpen.value = true
}

const _selectDueDate = (value: string | null) => {
  selectedDueDate.value = value
}

const _selectQuickAddPriority = (value: string | null) => {
  quickAddPriority.value = quickAddPriority.value === value ? null : value
}

// Calculate actual due date from option
const calculateDueDate = (option: string | null): Date | null => {
  if (!option) return null

  const today = new Date()
  today.setHours(23, 59, 59, 999)

  switch (option) {
    case 'today':
      return today
    case 'tomorrow': {
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      return tomorrow
    }
    case 'nextweek': {
      const nextWeek = new Date(today)
      nextWeek.setDate(nextWeek.getDate() + 7)
      return nextWeek
    }
    default:
      return null
  }
}

const _submitTask = () => {
  if (!newTaskTitle.value.trim()) return

  const dueDate = calculateDueDate(selectedDueDate.value)

  taskStore.createTask({
    title: newTaskTitle.value,
    status: 'planned',
    ...(dueDate && { dueDate: dueDate.toISOString() }),
    ...(quickAddPriority.value && { priority: quickAddPriority.value as 'high' | 'medium' | 'low' })
  })

  // Reset state
  newTaskTitle.value = ''
  selectedDueDate.value = null
  quickAddPriority.value = null
  isQuickAddExpanded.value = false
  taskInput.value?.blur()
}

// Task create sheet handler
const handleTaskCreateClose = () => {
  isTaskCreateOpen.value = false
  finalVoiceTranscript.value = ''
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

const toggleTask = async (task: Task) => {
  const newStatus = task.status === 'done' ? 'planned' : 'done'
  // BUG-1051: AWAIT to ensure persistence
  await taskStore.updateTask(task.id, { status: newStatus })
}

const handleTaskClick = (_task: Task) => {
  // Normal tap - no action needed
  // Swipe gestures handle edit/delete
}

const startTimer = async (task: Task) => {
  // BUG-1051: AWAIT for timer sync
  await timerStore.startTimer(task.id)
}

const isTimerActive = (taskId: string) => {
  return timerStore.isTimerActive && timerStore.currentTaskId === taskId
}

// Helpers are now provided by useMobileFilters composable (priorityLabel)

const formatDueDate = (dueDate: string | Date): string => {
  const date = new Date(dueDate)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.toDateString() === today.toDateString()) {
    return 'Today'
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow'
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}

const isOverdue = (dueDate: string | Date): boolean => {
  return new Date(dueDate) < new Date()
}
</script>

<style scoped>
.mobile-inbox {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  /* Space for teleported quick-add bar (~80px incl padding) — nav spacing handled by MobileLayout */
  padding-bottom: 80px;
}

.mobile-inbox-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4);
  position: sticky;
  top: 0;
  background: var(--app-background-gradient);
  z-index: 10;
}

.mobile-inbox-header h2 {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  margin: 0;
}

.task-count {
  background: var(--surface-secondary);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-xl);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

/* Filter Section */
.filter-section {
  padding: 0 var(--space-4) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.filter-chips {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.filter-chips::-webkit-scrollbar {
  display: none;
}

.filter-chip {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  padding: var(--space-2) var(--space-3_5);
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-subtle);
  background: var(--surface-secondary);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  white-space: nowrap;
  cursor: pointer;
  transition: all var(--duration-normal);
}

.filter-chip.active {
  background: transparent;
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.sort-section {
  display: flex;
  justify-content: flex-end;
}

/* TASK-1104: Filter count badge */
.filter-count {
  background: var(--border-hover);
  padding: var(--space-0_5) var(--space-1_5);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  margin-left: var(--space-0_5);
}

.filter-chip.active .filter-count {
  background: var(--brand-primary);
  color: white;
}

/* TASK-1104: Controls row (Group By + Sort) */
.controls-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.control-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background: var(--surface-secondary);
  color: var(--text-secondary);
  font-size: var(--text-meta);
  cursor: pointer;
  transition: all var(--duration-normal);
}

.control-btn:active {
  transform: scale(0.98);
}

.control-btn .rotated {
  transform: rotate(180deg);
}

/* Group By Dropdown */
.group-by-control {
  position: relative;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: var(--space-1);
  min-width: 150px;
  background: var(--surface-primary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  z-index: 100;
  overflow: hidden;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: var(--space-2_5);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  text-align: left;
  cursor: pointer;
  transition: all var(--duration-fast);
}

.dropdown-item:hover {
  background: var(--surface-secondary);
}

.dropdown-item.active {
  background: var(--brand-primary-subtle);
  color: var(--brand-primary);
}

/* Hide Done Toggle */
.hide-done-btn {
  padding: var(--space-2);
  min-width: 36px;
  justify-content: center;
}

.hide-done-btn.active {
  background: var(--brand-primary-subtle);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.sort-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background: var(--surface-secondary);
  color: var(--text-secondary);
  font-size: var(--text-meta);
  cursor: pointer;
  transition: all var(--duration-normal);
}

.sort-btn:active {
  transform: scale(0.98);
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

/* Task List */
.mobile-task-list {
  flex: 1;
  padding: 0 var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2_5);
}

/* TASK-1104: Task Groups */
.task-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.task-group:not(:first-child) {
  margin-top: var(--space-4);
}

.group-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-1);
  border-bottom: 1px solid var(--border-subtle);
}

.group-color-dot {
  width: var(--space-2);
  height: var(--space-2);
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.group-title {
  font-size: var(--text-meta);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  flex: 1;
}

.group-count {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  background: var(--surface-secondary);
  padding: var(--space-0_5) var(--space-2);
  border-radius: var(--radius-sm);
}

/* Project badge in task meta */
.project-badge {
  font-size: var(--text-xs);
  padding: var(--space-0_5) var(--space-1_5);
  border-radius: var(--radius-xs);
  background: var(--surface-tertiary);
  color: var(--text-tertiary);
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-task-item {
  display: flex;
  align-items: center;
  background: var(--surface-primary);
  padding: var(--space-3_5);
  border-radius: var(--radius-lg);
  gap: var(--space-3);
  box-shadow: var(--shadow-xs);
  cursor: pointer;
  /* Prevent text selection during swipe */
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

.mobile-task-item:active {
  background: var(--surface-tertiary);
}

.mobile-task-item.timer-active {
  border: var(--space-0_5) solid var(--timer-active-border, var(--brand-primary));
  box-shadow: var(--timer-active-glow-strong);
}

.task-checkbox {
  padding: var(--space-1);
  flex-shrink: 0;
}

.checkbox-circle {
  width: var(--space-5);
  height: var(--space-5);
  border: var(--space-0_5) solid var(--border-subtle);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-normal);
}

.checkbox-circle.checked {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
  color: white;
}

.task-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.task-title {
  font-size: var(--text-base);
  color: var(--text-primary);
  /* Multi-line truncation for RTL/long text */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
  line-height: 1.4;
  word-break: break-word;
  /* RTL support - text aligns based on content direction */
  text-align: start;
  unicode-bidi: plaintext;
}

.task-title.done {
  text-decoration: line-through;
  color: var(--text-muted);
}

/* Title row with inline priority badge */
.task-title-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

.task-title-row .task-title {
  flex: 1;
  min-width: 0;
}

/* Inline priority badge (right side of title) */
.priority-badge-inline {
  flex-shrink: 0;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  padding: var(--space-0_5) var(--space-1_5);
  border-radius: var(--radius-xs);
  margin-top: var(--space-0_5);
  background: var(--surface-tertiary);
  color: var(--text-secondary);
}

.priority-badge-inline.critical { background: var(--danger-bg-subtle); color: var(--danger-text); }
.priority-badge-inline.high { background: var(--color-priority-medium-bg-subtle); color: var(--color-warning); }
.priority-badge-inline.medium { background: var(--brand-primary-subtle); color: var(--brand-primary); }
.priority-badge-inline.low { background: var(--surface-tertiary); color: var(--text-muted); }

.task-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.priority-badge {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  padding: var(--space-0_5) var(--space-1_5);
  border-radius: var(--radius-xs);
  background: var(--surface-tertiary);
  color: var(--text-secondary);
}

.priority-badge.critical { background: var(--danger-bg-subtle); color: var(--danger-text); }
.priority-badge.high { background: var(--color-priority-medium-bg-subtle); color: var(--color-warning); }
.priority-badge.medium { background: var(--brand-primary-subtle); color: var(--brand-primary); }
.priority-badge.low { background: var(--surface-tertiary); color: var(--text-muted); }

.due-date {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.due-date.overdue {
  color: var(--danger-text);
}

.timer-btn {
  width: var(--space-9);
  height: var(--space-9);
  border-radius: var(--radius-full);
  border: none;
  background: var(--brand-primary-subtle);
  color: var(--brand-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.timer-btn:active {
  transform: scale(0.95);
}

.empty-state {
  text-align: center;
  color: var(--text-muted);
  padding: var(--space-16) var(--space-5);
}

.empty-state p {
  margin-top: var(--space-3);
}

/* Quick Add Bar — Teleported to <body> so position:fixed is relative to viewport (BUG-1312) */
.quick-add-bar {
  position: fixed;
  bottom: var(--space-16); /* Above nav */
  left: 0;
  right: 0;
  padding: var(--space-3) var(--space-4);
  padding-bottom: calc(var(--space-3) + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
  background: var(--surface-primary);
  border-top: 1px solid var(--border-subtle);
  z-index: var(--z-sticky);
  box-shadow: var(--shadow-md);
  transition: all var(--duration-slow) var(--spring-smooth);
}

.quick-add-bar.expanded {
  padding-top: var(--space-4);
  padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom, 0px));
  box-shadow: var(--shadow-lg);
  border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
}

.quick-add-row {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  min-width: 0;
}

.quick-add-input {
  flex: 1;
  min-width: 0; /* Allow flex shrinking past intrinsic input width (BUG-1312) */
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-2xl);
  border: 1px solid var(--border-subtle);
  background: var(--surface-secondary);
  color: var(--text-primary);
  font-size: var(--text-base);
  outline: none;
}

.quick-add-input:focus {
  border-color: var(--brand-primary);
  box-shadow: var(--brand-primary-glow);
}

.add-btn {
  width: var(--space-12);
  height: var(--space-12);
  border-radius: var(--radius-full);
  border: none;
  background: var(--brand-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  box-shadow: var(--brand-primary-glow);
}

.add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.add-btn:active:not(:disabled) {
  transform: scale(0.95);
}

/* Quick Add Options (expanded state) */
.quick-add-options {
  margin-top: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3_5);
  animation: slideUp var(--duration-normal) ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.option-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.option-label {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.option-chips {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.option-chip {
  padding: var(--space-2) var(--space-3_5);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  background: var(--surface-secondary);
  color: var(--text-secondary);
  font-size: var(--text-meta);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.option-chip:active {
  transform: scale(0.96);
}

.option-chip.active {
  background: transparent;
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

/* Priority-specific colors when active */
.option-chip.priority-chip.high.active {
  background: transparent;
  border-color: var(--danger-text);
  color: var(--danger-text);
}

.option-chip.priority-chip.medium.active {
  background: transparent;
  border-color: var(--color-warning);
  color: var(--color-warning);
}

.option-chip.priority-chip.low.active {
  background: transparent;
  border-color: var(--text-tertiary);
  color: var(--text-tertiary);
}

.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  padding: var(--space-2);
  margin-top: var(--space-1);
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: var(--text-meta);
  cursor: pointer;
}

.collapse-btn:active {
  opacity: 0.7;
}

/* Mic Button (TASK-1025) */
.mic-btn {
  width: var(--space-12);
  height: var(--space-12);
  border-radius: var(--radius-full);
  border: none;
  background: var(--surface-tertiary);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all var(--duration-normal) ease;
}

.mic-btn:active {
  transform: scale(0.95);
}

.mic-btn.recording {
  background: var(--danger-text);
  color: white;
  animation: pulse-recording 1.5s ease-in-out infinite;
}

@keyframes pulse-recording {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
  }
  50% {
    box-shadow: 0 0 0 12px rgba(239, 68, 68, 0);
  }
}

/* Voice input active state on input */
.quick-add-input.voice-active {
  border-color: var(--danger-text);
  box-shadow: var(--purple-glow-medium);
}

/* Voice feedback panel */
.voice-feedback {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  margin-top: var(--space-3);
  background: var(--surface-secondary);
  border-radius: var(--radius-lg);
  animation: slideUp var(--duration-normal) ease-out;
}

.voice-waveform {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  height: var(--space-6);
}

.wave-bar {
  width: var(--space-1);
  height: var(--space-2);
  background: var(--danger-text);
  border-radius: var(--radius-xs);
  animation: wave 0.8s ease-in-out infinite;
}

.wave-bar:nth-child(1) { animation-delay: 0s; }
.wave-bar:nth-child(2) { animation-delay: 0.1s; }
.wave-bar:nth-child(3) { animation-delay: 0.2s; }
.wave-bar:nth-child(4) { animation-delay: 0.3s; }
.wave-bar:nth-child(5) { animation-delay: 0.4s; }

@keyframes wave {
  0%, 100% { height: var(--space-2); }
  50% { height: var(--space-5); }
}

.voice-status {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.voice-cancel {
  width: var(--space-8);
  height: var(--space-8);
  border-radius: var(--radius-full);
  border: none;
  background: var(--surface-tertiary);
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.voice-cancel:active {
  transform: scale(0.95);
  background: var(--danger-bg-subtle);
  color: var(--danger-text);
}

/* Voice language toggle button (inside feedback) */
.voice-lang-toggle {
  min-width: var(--space-9);
  height: var(--space-7);
  padding: 0 var(--space-2);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-hover);
  background: var(--glass-bg-light);
  color: var(--text-primary);
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  cursor: pointer;
  flex-shrink: 0;
  transition: all var(--duration-fast) ease;
}

.voice-lang-toggle:active {
  transform: scale(0.95);
  background: var(--border-hover);
}

/* Voice language hint (when not recording) */
.voice-lang-hint {
  display: flex;
  justify-content: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.voice-lang-btn {
  padding: var(--space-1_5) var(--space-3);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  background: var(--surface-tertiary);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.voice-lang-btn:active {
  transform: scale(0.97);
  background: var(--surface-secondary);
}

/* Voice mode badge (inside recording feedback) */
.voice-mode-badge {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  flex-shrink: 0;
}

.voice-mode-badge.whisper {
  background: var(--state-active-bg);
  color: var(--brand-primary);
}

/* Voice error message */
.voice-error {
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--danger-bg-subtle);
  border-radius: var(--radius-md);
  font-size: var(--text-meta);
  color: var(--danger-text);
}

/* TASK-1131: Offline voice queue styles */
.mic-btn {
  position: relative;
}

.mic-btn.offline {
  opacity: 0.7;
}

.mic-btn.offline::after {
  content: '';
  position: absolute;
  bottom: var(--space-0_5);
  right: var(--space-0_5);
  width: var(--space-2);
  height: var(--space-2);
  background: var(--color-warning);
  border-radius: var(--radius-full);
  border: var(--space-0_5) solid var(--surface-primary);
}

.voice-pending-badge {
  position: absolute;
  top: calc(-1 * var(--space-1));
  right: calc(-1 * var(--space-1));
  min-width: var(--space-4);
  height: var(--space-4);
  padding: 0 var(--space-1);
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  color: white;
  background: var(--brand-primary);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: pulse-badge 2s ease-in-out infinite;
}

@keyframes pulse-badge {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.voice-waveform.paused .wave-bar {
  animation: none;
  opacity: 0.5;
}

.voice-offline-badge {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  background: var(--orange-bg-light);
  color: var(--color-warning);
}

.voice-queue-status {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  background: var(--brand-primary-subtle);
  color: var(--brand-primary);
}

/* Debug Banner */
.debug-banner {
  background: var(--overlay-component-bg-lighter);
  color: var(--color-success);
  font-family: monospace;
  font-size: var(--text-xs);
  padding: var(--space-2) var(--space-3);
  margin: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  line-height: 1.6;
}

.debug-banner .error {
  color: var(--color-danger);
}

.debug-toggle {
  position: fixed;
  top: var(--space-16);
  right: var(--space-2);
  width: var(--space-7);
  height: var(--space-7);
  border-radius: var(--radius-full);
  background: var(--overlay-component-bg-lighter);
  border: none;
  color: var(--text-muted);
  font-size: var(--text-sm);
  z-index: var(--z-dropdown);
}

/* RTL Layout Support */
[dir="rtl"] .mobile-inbox-header {
  flex-direction: row-reverse;
}

[dir="rtl"] .mobile-task-item {
  flex-direction: row-reverse;
}

[dir="rtl"] .task-content {
  text-align: right;
}

[dir="rtl"] .task-title-row {
  flex-direction: row-reverse;
}

[dir="rtl"] .task-meta {
  flex-direction: row-reverse;
}

[dir="rtl"] .filter-chips {
  flex-direction: row-reverse;
}

[dir="rtl"] .controls-row {
  flex-direction: row-reverse;
}

[dir="rtl"] .group-header {
  flex-direction: row-reverse;
}

[dir="rtl"] .quick-add-row {
  flex-direction: row-reverse;
}

[dir="rtl"] .due-date {
  flex-direction: row-reverse;
}

[dir="rtl"] .dropdown-menu {
  left: auto;
  right: 0;
}

[dir="rtl"] .debug-toggle {
  right: auto;
  left: var(--space-2);
}
</style>
