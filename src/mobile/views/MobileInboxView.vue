<template>
  <div class="mobile-inbox">
    <!-- Debug Banner (tap to toggle) -->
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

    <!-- Quick Add Bar (trigger only) -->
    <div class="quick-add-bar">
      <div class="quick-add-row">
        <input
          type="text"
          placeholder="Add a task..."
          class="quick-add-input"
          readonly
          @click="openTaskCreateSheet"
        >

        <!-- Mic button -->
        <button
          v-if="isVoiceSupported"
          class="mic-btn"
          :class="[{ recording: isListening }]"
          @click="toggleVoiceInput"
        >
          <Mic v-if="!isListening" :size="20" />
          <MicOff v-else :size="20" />
        </button>

        <button
          class="add-btn"
          @click="openTaskCreateSheet"
        >
          <Plus :size="20" />
        </button>
      </div>

      <!-- Voice feedback (when recording) -->
      <div v-if="isListening || isProcessingVoice" class="voice-feedback">
        <!-- Whisper mode: AI indicator + duration -->
        <template v-if="voiceMode === 'whisper'">
          <span class="voice-mode-badge whisper">🤖 AI</span>
          <div class="voice-waveform">
            <span class="wave-bar" />
            <span class="wave-bar" />
            <span class="wave-bar" />
            <span class="wave-bar" />
            <span class="wave-bar" />
          </div>
          <span class="voice-status">
            <template v-if="isProcessingVoice">Processing...</template>
            <template v-else>{{ recordingDuration }}s - Speak freely...</template>
          </span>
        </template>

        <!-- Browser mode: Language toggle + waveform -->
        <template v-else>
          <button
            class="voice-lang-toggle"
            :title="voiceLanguage === 'he-IL' ? 'Switch to English' : 'Switch to Hebrew'"
            @click="toggleVoiceLanguage"
          >
            {{ voiceLanguage === 'he-IL' ? 'עב' : 'EN' }}
          </button>
          <div class="voice-waveform">
            <span class="wave-bar" />
            <span class="wave-bar" />
            <span class="wave-bar" />
            <span class="wave-bar" />
            <span class="wave-bar" />
          </div>
          <span class="voice-status">{{ displayTranscript || (voiceLanguage === 'he-IL' ? 'דבר עכשיו...' : 'Speak now...') }}</span>
        </template>

        <button class="voice-cancel" @click="cancelVoice">
          <X :size="16" />
        </button>
      </div>

      <!-- Voice mode indicator when not recording -->
      <div v-if="isVoiceSupported && !isListening && !isProcessingVoice" class="voice-lang-hint">
        <button class="voice-mode-btn" @click="toggleVoiceMode">
          {{ voiceMode === 'whisper' ? '🤖 AI (auto-detect)' : '🌐 Browser' }}
        </button>
        <!-- Language toggle only shown in browser mode -->
        <button v-if="voiceMode === 'browser'" class="voice-lang-btn" @click="toggleVoiceLanguage">
          {{ voiceLanguage === 'he-IL' ? '🇮🇱 Hebrew' : '🇺🇸 English' }}
        </button>
      </div>

      <!-- Voice error message -->
      <div v-if="voiceError && !isListening" class="voice-error">
        {{ voiceError }}
      </div>

      <!-- Voice Task Confirmation removed - using TaskCreateBottomSheet instead (TASK-1077) -->
    </div>

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
      :voice-transcript="finalVoiceTranscript || displayTranscript"
      @close="handleTaskCreateClose"
      @created="handleTaskSheetCreated"
      @stop-recording="stopVoice"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useAuthStore } from '@/stores/auth'
import { useTimerStore } from '@/stores/timer'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
import TaskEditBottomSheet from '@/mobile/components/TaskEditBottomSheet.vue'
import TaskCreateBottomSheet from '@/mobile/components/TaskCreateBottomSheet.vue'
import SwipeableTaskItem from '@/mobile/components/SwipeableTaskItem.vue'
import {
  Plus, Check, Play, Calendar, Inbox,
  Circle, Clock, CheckCircle2, ArrowUpDown,
  Flag, ChevronDown, Mic, MicOff, X,
  Layers, CalendarClock, AlertCircle, FolderOpen, ListFilter
} from 'lucide-vue-next'
import { useSpeechRecognition } from '@/composables/useSpeechRecognition'
import { useWhisperSpeech } from '@/composables/useWhisperSpeech'
import { useHaptics } from '@/composables/useHaptics'

const taskStore = useTaskStore()
const authStore = useAuthStore()
const timerStore = useTimerStore()
const { lastSyncError } = useSupabaseDatabase()
const { triggerHaptic } = useHaptics()

// State
const newTaskTitle = ref('')
const taskInput = ref<HTMLInputElement | null>(null)
const showDebug = ref(false)
const sortBy = ref<'newest' | 'priority' | 'dueDate'>('newest')

// TASK-1104: Enhanced filtering state
type TimeFilterType = 'all' | 'today' | 'week' | 'overdue'
type GroupByType = 'none' | 'date' | 'project' | 'priority'

const activeTimeFilter = ref<TimeFilterType>('all')
const groupBy = ref<GroupByType>('none')
const hideDoneTasks = ref(true) // Default to hiding done tasks
const showGroupByDropdown = ref(false)

// Quick-add expanded state
const isQuickAddExpanded = ref(false)
const selectedDueDate = ref<string | null>(null)
const selectedPriority = ref<string | null>(null)

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

// Voice mode: 'whisper' (AI auto-detect) or 'browser' (Web Speech API)
const voiceMode = ref<'whisper' | 'browser'>('whisper')

// Voice language toggle - detect from browser or default to English (for browser mode)
const getDefaultVoiceLanguage = (): 'he-IL' | 'en-US' => {
  const browserLang = navigator.language || navigator.languages?.[0] || 'en-US'
  return browserLang.startsWith('he') ? 'he-IL' : 'en-US'
}
const voiceLanguage = ref<'he-IL' | 'en-US'>(getDefaultVoiceLanguage())

// Whisper-based voice input (AI auto-detect, supports mixed languages)
const {
  isRecording: isWhisperRecording,
  isProcessing: isWhisperProcessing,
  isSupported: isWhisperSupported,
  hasApiKey: hasWhisperApiKey,
  transcript: whisperTranscript,
  error: whisperError,
  recordingDuration,
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
  }
})

// Browser-based voice input (Web Speech API, single language)
const {
  isListening: isBrowserListening,
  isSupported: isBrowserVoiceSupported,
  displayTranscript: browserDisplayTranscript,
  error: browserVoiceError,
  start: startBrowserVoice,
  stop: stopBrowserVoice,
  cancel: cancelBrowserVoice,
  setLanguage
} = useSpeechRecognition({
  language: voiceLanguage.value,
  interimResults: true,
  silenceTimeout: 2500,
  onResult: (result) => {
    if (result.isFinal && result.transcript.trim()) {
      // Keep TaskCreateBottomSheet open - transcript flows via voiceTranscript prop
      finalVoiceTranscript.value = result.transcript.trim()
    }
  },
  onError: (err) => {
    console.warn('[BrowserVoice] Error:', err)
  }
})

// Unified voice state (combines both modes)
const isListening = computed(() =>
  voiceMode.value === 'whisper'
    ? isWhisperRecording.value
    : isBrowserListening.value
)
const isProcessingVoice = computed(() => isWhisperProcessing.value)
const isVoiceSupported = computed(() =>
  voiceMode.value === 'whisper'
    ? isWhisperSupported.value && hasWhisperApiKey.value
    : isBrowserVoiceSupported.value
)
const displayTranscript = computed(() =>
  voiceMode.value === 'whisper'
    ? whisperTranscript.value
    : browserDisplayTranscript.value
)
const voiceError = computed(() =>
  voiceMode.value === 'whisper'
    ? whisperError.value
    : browserVoiceError.value
)

// Auto-select mode based on API key availability
if (!hasWhisperApiKey.value && isBrowserVoiceSupported.value) {
  voiceMode.value = 'browser'
}

// Toggle voice mode
const toggleVoiceMode = () => {
  if (voiceMode.value === 'whisper' && isBrowserVoiceSupported.value) {
    voiceMode.value = 'browser'
  } else if (hasWhisperApiKey.value) {
    voiceMode.value = 'whisper'
  }
  triggerHaptic(10)
}

// Toggle voice language (only for browser mode)
const toggleVoiceLanguage = async () => {
  const oldLang = voiceLanguage.value
  voiceLanguage.value = voiceLanguage.value === 'he-IL' ? 'en-US' : 'he-IL'
  console.log('[Voice] 🌐 Language switched:', oldLang, '→', voiceLanguage.value)
  await setLanguage(voiceLanguage.value)
  triggerHaptic(10)
}

// Unified voice control functions
const startVoice = async () => {
  if (voiceMode.value === 'whisper') {
    await startWhisper()
  } else {
    setLanguage(voiceLanguage.value)
    await startBrowserVoice()
  }
}

const stopVoice = () => {
  if (voiceMode.value === 'whisper') {
    stopWhisper()
  } else {
    stopBrowserVoice()
  }
}

const cancelVoice = () => {
  if (voiceMode.value === 'whisper') {
    cancelWhisper()
  } else {
    cancelBrowserVoice()
  }
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
const dateOptions = [
  { label: 'Today', value: 'today' },
  { label: 'Tomorrow', value: 'tomorrow' },
  { label: 'Next Week', value: 'nextweek' },
  { label: 'None', value: null }
]

// Priority options (matches Task type: 'low' | 'medium' | 'high' | null)
const priorityOptions = [
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
    case 'priority':
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3, none: 4 }
      tasks.sort((a, b) =>
        (priorityOrder[a.priority || 'none'] || 4) - (priorityOrder[b.priority || 'none'] || 4)
      )
      break
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
          color = '#ef4444'
        } else if (isDueToday(task.dueDate)) {
          key = 'today'
          title = 'Today'
          color = '#22c55e'
        } else if (isDueThisWeek(task.dueDate)) {
          key = 'this-week'
          title = 'This Week'
          color = '#3b82f6'
        } else {
          key = 'later'
          title = 'Later'
          color = '#6b7280'
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
          critical: '#dc2626',
          high: '#f97316',
          medium: '#eab308',
          low: '#22c55e',
          none: '#6b7280'
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
  groupBy.value = value
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
const expandQuickAdd = () => {
  console.log('[TASK-1005] expandQuickAdd called, setting isQuickAddExpanded to true')
  isQuickAddExpanded.value = true
}

const collapseQuickAdd = () => {
  isQuickAddExpanded.value = false
}

// Open task create sheet
const openTaskCreateSheet = () => {
  isTaskCreateOpen.value = true
}

const selectDueDate = (value: string | null) => {
  selectedDueDate.value = value
}

const selectPriority = (value: string | null) => {
  selectedPriority.value = selectedPriority.value === value ? null : value
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

const submitTask = () => {
  if (!newTaskTitle.value.trim()) return

  const dueDate = calculateDueDate(selectedDueDate.value)

  taskStore.createTask({
    title: newTaskTitle.value,
    status: 'planned',
    ...(dueDate && { dueDate: dueDate.toISOString() }),
    ...(selectedPriority.value && { priority: selectedPriority.value as 'high' | 'medium' | 'low' })
  })

  // Reset state
  newTaskTitle.value = ''
  selectedDueDate.value = null
  selectedPriority.value = null
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

// Helpers
const priorityLabel = (priority: string) => {
  const labels: Record<string, string> = {
    critical: 'P0',
    high: 'P1',
    medium: 'P2',
    low: 'P3'
  }
  return labels[priority] || priority
}

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
  min-height: 100vh;
  padding-bottom: 140px; /* Space for quick-add + nav */
}

.mobile-inbox-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  position: sticky;
  top: 0;
  background: var(--app-background-gradient);
  z-index: 10;
}

.mobile-inbox-header h2 {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
}

.task-count {
  background: var(--surface-secondary);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

/* Filter Section */
.filter-section {
  padding: 0 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-chips {
  display: flex;
  gap: 8px;
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
  gap: 6px;
  padding: 8px 14px;
  border-radius: 20px;
  border: 1px solid var(--border-subtle);
  background: var(--surface-secondary);
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-chip.active {
  background: var(--primary-brand);
  border-color: var(--primary-brand);
  color: white;
}

.sort-section {
  display: flex;
  justify-content: flex-end;
}

/* TASK-1104: Filter count badge */
.filter-count {
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  margin-left: 2px;
}

.filter-chip.active .filter-count {
  background: rgba(255, 255, 255, 0.3);
}

/* TASK-1104: Controls row (Group By + Sort) */
.controls-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: var(--surface-secondary);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
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
  margin-top: 4px;
  min-width: 150px;
  background: var(--surface-primary);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  z-index: 100;
  overflow: hidden;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 16px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;
}

.dropdown-item:hover {
  background: var(--surface-secondary);
}

.dropdown-item.active {
  background: var(--primary-brand-bg-subtle);
  color: var(--primary-brand);
}

/* Hide Done Toggle */
.hide-done-btn {
  padding: 8px;
  min-width: 36px;
  justify-content: center;
}

.hide-done-btn.active {
  background: var(--primary-brand-bg-subtle);
  border-color: var(--primary-brand);
  color: var(--primary-brand);
}

.sort-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: var(--surface-secondary);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.sort-btn:active {
  transform: scale(0.98);
}

/* Swipe hint banner */
.swipe-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 10px 16px;
  margin: 0 16px 12px;
  background: var(--surface-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-subtle);
}

.hint-text {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.hint-divider {
  color: var(--border-subtle);
}

.hint-dismiss {
  margin-left: 8px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--primary-brand);
  background: var(--primary-brand-bg-subtle);
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.hint-dismiss:active {
  transform: scale(0.95);
}

/* Task List */
.mobile-task-list {
  flex: 1;
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* TASK-1104: Task Groups */
.task-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-group:not(:first-child) {
  margin-top: 16px;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 4px;
  border-bottom: 1px solid var(--border-subtle);
}

.group-color-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.group-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}

.group-count {
  font-size: 12px;
  color: var(--text-tertiary);
  background: var(--surface-secondary);
  padding: 2px 8px;
  border-radius: 10px;
}

/* Project badge in task meta */
.project-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
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
  padding: 14px;
  border-radius: 12px;
  gap: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
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
  border: 2px solid var(--timer-active-border, var(--primary-brand));
  box-shadow: 0 0 12px var(--timer-active-glow, rgba(var(--primary-brand-rgb), 0.2));
}

.task-checkbox {
  padding: 4px;
  flex-shrink: 0;
}

.checkbox-circle {
  width: 22px;
  height: 22px;
  border: 2px solid var(--border-subtle);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.checkbox-circle.checked {
  background: var(--primary-brand);
  border-color: var(--primary-brand);
  color: white;
}

.task-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-title {
  font-size: 15px;
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
  gap: 8px;
}

.task-title-row .task-title {
  flex: 1;
  min-width: 0;
}

/* Inline priority badge (right side of title) */
.priority-badge-inline {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  margin-top: 2px; /* Align with first line of title */
  background: var(--surface-tertiary);
  color: var(--text-secondary);
}

.priority-badge-inline.critical { background: var(--danger-bg-subtle); color: var(--danger-text); }
.priority-badge-inline.high { background: var(--warning-bg-subtle); color: var(--warning-text); }
.priority-badge-inline.medium { background: var(--primary-brand-bg-subtle); color: var(--primary-brand); }
.priority-badge-inline.low { background: var(--surface-tertiary); color: var(--text-muted); }

.task-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.priority-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--surface-tertiary);
  color: var(--text-secondary);
}

.priority-badge.critical { background: var(--danger-bg-subtle); color: var(--danger-text); }
.priority-badge.high { background: var(--warning-bg-subtle); color: var(--warning-text); }
.priority-badge.medium { background: var(--primary-brand-bg-subtle); color: var(--primary-brand); }
.priority-badge.low { background: var(--surface-tertiary); color: var(--text-muted); }

.due-date {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.due-date.overdue {
  color: var(--danger-text);
}

.timer-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: var(--primary-brand-bg-subtle);
  color: var(--primary-brand);
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
  padding: 60px 20px;
}

.empty-state p {
  margin-top: 12px;
}

/* Expanded Quick Add Bar */
.quick-add-bar {
  position: fixed;
  bottom: 64px; /* Above nav */
  left: 0;
  right: 0;
  padding: 12px 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  background: var(--surface-primary);
  border-top: 1px solid var(--border-subtle);
  z-index: 50;
  box-shadow: 0 -4px 12px rgba(0,0,0,0.08);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.quick-add-bar.expanded {
  padding-top: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  box-shadow: 0 -8px 24px rgba(0,0,0,0.15);
  border-radius: 24px 24px 0 0;
}

.quick-add-row {
  display: flex;
  gap: 12px;
}

.quick-add-input {
  flex: 1;
  padding: 12px 16px;
  border-radius: 24px;
  border: 1px solid var(--border-subtle);
  background: var(--surface-secondary);
  color: var(--text-primary);
  font-size: 16px;
  outline: none;
}

.quick-add-input:focus {
  border-color: var(--primary-brand);
  box-shadow: 0 0 0 2px rgba(var(--primary-brand-rgb), 0.1);
}

.add-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: var(--primary-brand);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(var(--primary-brand-rgb), 0.3);
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
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  animation: slideUp 0.2s ease-out;
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
  gap: 8px;
}

.option-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.option-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.option-chip {
  padding: 8px 14px;
  border-radius: 18px;
  border: 1px solid var(--border-subtle);
  background: var(--surface-secondary);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.option-chip:active {
  transform: scale(0.96);
}

.option-chip.active {
  background: var(--primary-brand);
  border-color: var(--primary-brand);
  color: white;
}

/* Priority-specific colors when active */
.option-chip.priority-chip.high.active {
  background: var(--danger-text);
  border-color: var(--danger-text);
}

.option-chip.priority-chip.medium.active {
  background: var(--warning-text);
  border-color: var(--warning-text);
}

.option-chip.priority-chip.low.active {
  background: var(--text-tertiary);
  border-color: var(--text-tertiary);
}

.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px;
  margin-top: 4px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 13px;
  cursor: pointer;
}

.collapse-btn:active {
  opacity: 0.7;
}

/* Mic Button (TASK-1025) */
.mic-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: var(--surface-tertiary);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s ease;
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
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
}

/* Voice feedback panel */
.voice-feedback {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  margin-top: 12px;
  background: var(--surface-secondary);
  border-radius: 12px;
  animation: slideUp 0.2s ease-out;
}

.voice-waveform {
  display: flex;
  align-items: center;
  gap: 3px;
  height: 24px;
}

.wave-bar {
  width: 3px;
  height: 8px;
  background: var(--danger-text);
  border-radius: 2px;
  animation: wave 0.8s ease-in-out infinite;
}

.wave-bar:nth-child(1) { animation-delay: 0s; }
.wave-bar:nth-child(2) { animation-delay: 0.1s; }
.wave-bar:nth-child(3) { animation-delay: 0.2s; }
.wave-bar:nth-child(4) { animation-delay: 0.3s; }
.wave-bar:nth-child(5) { animation-delay: 0.4s; }

@keyframes wave {
  0%, 100% { height: 8px; }
  50% { height: 20px; }
}

.voice-status {
  flex: 1;
  font-size: 14px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.voice-cancel {
  width: 32px;
  height: 32px;
  border-radius: 50%;
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
  min-width: 36px;
  height: 28px;
  padding: 0 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.voice-lang-toggle:active {
  transform: scale(0.95);
  background: rgba(255, 255, 255, 0.2);
}

/* Voice language hint (when not recording) */
.voice-lang-hint {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 8px;
}

.voice-lang-btn {
  padding: 6px 12px;
  border-radius: 16px;
  border: 1px solid var(--border-subtle);
  background: var(--surface-tertiary);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.voice-lang-btn:active {
  transform: scale(0.97);
  background: var(--surface-secondary);
}

/* Voice mode toggle button */
.voice-mode-btn {
  padding: 6px 12px;
  border-radius: 16px;
  border: 1px solid var(--brand-primary);
  background: rgba(78, 205, 196, 0.1);
  color: var(--brand-primary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.voice-mode-btn:active {
  transform: scale(0.97);
  background: rgba(78, 205, 196, 0.2);
}

/* Voice mode badge (inside recording feedback) */
.voice-mode-badge {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.voice-mode-badge.whisper {
  background: rgba(78, 205, 196, 0.15);
  color: var(--brand-primary);
}

/* Voice error message */
.voice-error {
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--danger-bg-subtle);
  border-radius: 8px;
  font-size: 13px;
  color: var(--danger-text);
}

/* Debug Banner */
.debug-banner {
  background: rgba(0, 0, 0, 0.85);
  color: #0f0;
  font-family: monospace;
  font-size: 11px;
  padding: 8px 12px;
  margin: 8px 16px;
  border-radius: 8px;
  line-height: 1.6;
}

.debug-banner .error {
  color: #f66;
}

.debug-toggle {
  position: fixed;
  top: 60px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.4);
  border: none;
  color: var(--text-muted);
  font-size: 14px;
  z-index: 1000;
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
  left: 8px;
}
</style>
