<template>
  <div class="mobile-inbox">
    <!-- Debug Banner (tap to toggle) -->
    <div v-if="showDebug" class="debug-banner" @click="showDebug = false">
      <div><strong>Sync Debug</strong> (tap to hide)</div>
      <div>Auth: {{ authStatus }}</div>
      <div>User: {{ userId || 'none' }}</div>
      <div>Tasks loaded: {{ taskStore.tasks.length }}</div>
      <div>Filtered: {{ filteredTasks.length }}</div>
      <div v-if="syncError" class="error">Error: {{ syncError }}</div>
    </div>
    <button v-else class="debug-toggle" @click="showDebug = true">?</button>

    <!-- Header -->
    <div class="mobile-inbox-header">
      <h2>Inbox</h2>
      <div class="header-actions">
        <span class="task-count">{{ filteredTasks.length }}</span>
      </div>
    </div>

    <!-- Filter Chips -->
    <div class="filter-section">
      <div class="filter-chips">
        <button
          v-for="filter in statusFilters"
          :key="filter.value"
          :class="['filter-chip', { active: activeStatusFilter === filter.value }]"
          @click="setStatusFilter(filter.value)"
        >
          <component :is="filter.icon" :size="14" />
          {{ filter.label }}
        </button>
      </div>

      <!-- Sort toggle -->
      <div class="sort-section">
        <button class="sort-btn" @click="toggleSort">
          <ArrowUpDown :size="16" />
          {{ sortLabel }}
        </button>
      </div>
    </div>

    <!-- Task List -->
    <div class="mobile-task-list">
      <div v-if="filteredTasks.length === 0" class="empty-state">
        <Inbox :size="48" />
        <p v-if="activeStatusFilter === 'all'">No tasks yet</p>
        <p v-else>No {{ activeStatusFilter }} tasks</p>
      </div>

      <div
        v-for="task in filteredTasks"
        :key="task.id"
        :class="[
          'mobile-task-item',
          'long-press-item',
          { 'timer-active': isTimerActive(task.id) },
          { 'long-press-idle': getLongPressState(task.id).state === 'idle' },
          { 'long-press-pressing': getLongPressState(task.id).state === 'pressing' },
          { 'long-press-activated': getLongPressState(task.id).state === 'activated' }
        ]"
        :style="getLongPressStyles(task.id)"
        :data-long-press-state="getLongPressState(task.id).state"
        :data-task-id="task.id"
        @click="handleTaskClick(task)"
        @touchstart="handleTouchStart(task, $event)"
        @touchmove="handleTouchMove(task, $event)"
        @touchend="handleTouchEnd(task)"
        @touchcancel="handleLongPressCancel(task.id)"
        @contextmenu="handleContextMenu"
      >
        <div class="task-checkbox" @click.stop="toggleTask(task)">
          <div :class="['checkbox-circle', { checked: task.status === 'done' }]">
            <Check v-if="task.status === 'done'" :size="14" />
          </div>
        </div>

        <div class="task-content">
          <span :class="['task-title', { done: task.status === 'done' }]">{{ task.title }}</span>
          <div class="task-meta">
            <span v-if="task.priority" :class="['priority-badge', task.priority]">
              {{ priorityLabel(task.priority || 'none') }}
            </span>
            <span v-if="task.dueDate" :class="['due-date', { overdue: isOverdue(task.dueDate) }]">
              <Calendar :size="12" />
              {{ formatDueDate(task.dueDate) }}
            </span>
          </div>
        </div>

        <button class="timer-btn" @click.stop="startTimer(task)">
          <Play :size="16" />
        </button>
      </div>
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
        />

        <!-- Mic button -->
        <button
          v-if="isVoiceSupported"
          :class="['mic-btn', { recording: isListening }]"
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
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
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
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
          </div>
          <span class="voice-status">{{ displayTranscript || (voiceLanguage === 'he-IL' ? 'דבר עכשיו...' : 'Speak now...') }}</span>
        </template>

        <button class="voice-cancel" @click="cancelVoice">
          <X :size="16" />
        </button>
      </div>

      <!-- Voice mode indicator when not recording -->
      <div v-if="isVoiceSupported && !isListening && !isProcessingVoice && !showVoiceConfirmation" class="voice-lang-hint">
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

      <!-- Voice Task Confirmation (TASK-1028) -->
      <VoiceTaskConfirmation
        :is-open="showVoiceConfirmation"
        :parsed-task="parsedVoiceTask"
        @confirm="handleVoiceTaskConfirm"
        @cancel="handleVoiceTaskCancel"
      />
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
      :voice-transcript="displayTranscript"
      @close="isTaskCreateOpen = false"
      @created="handleTaskSheetCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useAuthStore } from '@/stores/auth'
import { useTimerStore } from '@/stores/timer'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
import { type LongPressState } from '@/composables/useLongPress'
import TaskEditBottomSheet from '@/mobile/components/TaskEditBottomSheet.vue'
import TaskCreateBottomSheet from '@/mobile/components/TaskCreateBottomSheet.vue'
import VoiceTaskConfirmation from '@/mobile/components/VoiceTaskConfirmation.vue'
import {
  Plus, Check, Play, Calendar, Inbox,
  Circle, Clock, CheckCircle2, ArrowUpDown,
  Flag, ChevronDown, Mic, MicOff, X
} from 'lucide-vue-next'
import { useSpeechRecognition } from '@/composables/useSpeechRecognition'
import { useWhisperSpeech } from '@/composables/useWhisperSpeech'
import { useVoiceTaskParser, type ParsedVoiceTask } from '@/composables/useVoiceTaskParser'

const taskStore = useTaskStore()
const authStore = useAuthStore()
const timerStore = useTimerStore()
const { lastSyncError } = useSupabaseDatabase()
const { parseTranscript } = useVoiceTaskParser()

// State
const newTaskTitle = ref('')
const taskInput = ref<HTMLInputElement | null>(null)
const showDebug = ref(false)
const activeStatusFilter = ref<string>('active')
const sortBy = ref<'newest' | 'priority' | 'dueDate'>('newest')

// Quick-add expanded state
const isQuickAddExpanded = ref(false)
const selectedDueDate = ref<string | null>(null)
const selectedPriority = ref<string | null>(null)

// Task create sheet state
const isTaskCreateOpen = ref(false)

// Voice confirmation state (TASK-1028)
const parsedVoiceTask = ref<ParsedVoiceTask | null>(null)
const showVoiceConfirmation = ref(false)

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
      // Auto-detect language from Whisper response
      const lang = result.language === 'he' ? 'he-IL' : 'en-US'
      const parsed = parseTranscript(result.transcript.trim(), lang)
      parsedVoiceTask.value = parsed
      showVoiceConfirmation.value = true
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
      const parsed = parseTranscript(result.transcript.trim(), voiceLanguage.value)
      parsedVoiceTask.value = parsed
      showVoiceConfirmation.value = true
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
    // Reset confirmation state when starting new voice input
    parsedVoiceTask.value = null
    showVoiceConfirmation.value = false
    expandQuickAdd()
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

// Long-press state tracking for each task item
const longPressStates = ref<Map<string, { state: LongPressState; progress: number }>>(new Map())
const activeLongPressTaskId = ref<string | null>(null)
// Track if long-press was activated (to prevent tap action)
const wasLongPressActivated = ref(false)

// Get long-press state for a task
const getLongPressState = (taskId: string) => {
  return longPressStates.value.get(taskId) || { state: 'idle' as LongPressState, progress: 0 }
}

// Get dynamic styles for long-press visual feedback
const getLongPressStyles = (taskId: string) => {
  const lpState = getLongPressState(taskId)

  if (lpState.state === 'idle') {
    return {
      transform: 'scale(1)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      transition: 'transform var(--duration-normal) var(--spring-smooth), box-shadow var(--duration-normal) var(--spring-smooth)'
    }
  }

  if (lpState.state === 'pressing') {
    // Progressive scale from 1.0 to 1.03 during press
    const scale = 1 + (lpState.progress * 0.03)
    // Progressive shadow elevation
    const shadowOpacity = 0.05 + (lpState.progress * 0.2)
    const shadowBlur = 3 + (lpState.progress * 21)
    const shadowY = 1 + (lpState.progress * 11)

    return {
      transform: `scale(${scale.toFixed(4)})`,
      boxShadow: `0 ${shadowY}px ${shadowBlur}px rgba(0, 0, 0, ${shadowOpacity.toFixed(2)})`,
      transition: 'none'
    }
  }

  // Activated state
  return {
    transform: 'scale(1.03)',
    boxShadow: '0 12px 24px rgba(0, 0, 0, 0.25), 0 0 0 2px var(--brand-primary, #4ECDC4)',
    transition: 'transform var(--duration-fast) var(--spring-bounce), box-shadow var(--duration-fast) var(--spring-smooth)'
  }
}

// Long-press handlers for individual task items
const handleLongPressStart = (taskId: string) => {
  activeLongPressTaskId.value = taskId
  longPressStates.value.set(taskId, { state: 'pressing', progress: 0 })
}

const handleLongPressProgress = (taskId: string, progress: number) => {
  const current = longPressStates.value.get(taskId)
  if (current) {
    longPressStates.value.set(taskId, { ...current, progress })
  }
}

const handleLongPressActivated = (task: Task) => {
  const taskId = task.id
  longPressStates.value.set(taskId, { state: 'activated', progress: 1 })
  wasLongPressActivated.value = true

  // Open edit bottom sheet for the task
  handleEditTask(task)

  // Reset state after a brief delay to show activation feedback
  setTimeout(() => {
    resetLongPressState(taskId)
  }, 300)
}

const handleLongPressCancel = (taskId: string) => {
  resetLongPressState(taskId)
}

const resetLongPressState = (taskId: string) => {
  longPressStates.value.set(taskId, { state: 'idle', progress: 0 })
  if (activeLongPressTaskId.value === taskId) {
    activeLongPressTaskId.value = null
  }
}

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

// Prevent context menu during long-press
const handleContextMenu = (e: Event) => {
  const target = e.currentTarget as HTMLElement
  const state = target?.dataset?.longPressState
  if (state === 'pressing' || state === 'activated') {
    e.preventDefault()
  }
}

// Touch event handlers for long-press detection
let longPressTimer: ReturnType<typeof setTimeout> | null = null
let progressInterval: ReturnType<typeof setInterval> | null = null
let startTime = 0
const LONG_PRESS_DURATION = 500 // ms
const MOVEMENT_THRESHOLD = 10 // px
let startX = 0
let startY = 0

const handleTouchStart = (task: Task, e: TouchEvent) => {
  const touch = e.touches[0]
  startX = touch.clientX
  startY = touch.clientY
  startTime = Date.now()

  handleLongPressStart(task.id)

  // Start progress tracking
  progressInterval = setInterval(() => {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / LONG_PRESS_DURATION, 1)
    handleLongPressProgress(task.id, progress)

    // Check for milestone haptics
    if (progress >= 0.25 && progress < 0.26) triggerHaptic(10)
    if (progress >= 0.5 && progress < 0.51) triggerHaptic(10)
    if (progress >= 0.75 && progress < 0.76) triggerHaptic(10)
  }, 16) // ~60fps

  // Set activation timer
  longPressTimer = setTimeout(() => {
    clearInterval(progressInterval!)
    progressInterval = null
    triggerHaptic(50) // Strong haptic on activation
    handleLongPressActivated(task)
  }, LONG_PRESS_DURATION)
}

const handleTouchMove = (task: Task, e: TouchEvent) => {
  if (!activeLongPressTaskId.value || activeLongPressTaskId.value !== task.id) return

  const touch = e.touches[0]
  const deltaX = Math.abs(touch.clientX - startX)
  const deltaY = Math.abs(touch.clientY - startY)

  // Cancel if moved too far
  if (deltaX > MOVEMENT_THRESHOLD || deltaY > MOVEMENT_THRESHOLD) {
    clearLongPressTimers()
    handleLongPressCancel(task.id)
  }
}

const handleTouchEnd = (task: Task) => {
  clearLongPressTimers()
  const lpState = getLongPressState(task.id)

  if (lpState.state === 'pressing') {
    // Released before activation - cancel and allow tap
    handleLongPressCancel(task.id)
    wasLongPressActivated.value = false
  }

  // Reset long-press activated flag after a short delay
  // This prevents the click event from firing right after long-press
  setTimeout(() => {
    wasLongPressActivated.value = false
  }, 100)
}

const clearLongPressTimers = () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
  if (progressInterval) {
    clearInterval(progressInterval)
    progressInterval = null
  }
}

// Haptic feedback helper
const triggerHaptic = (duration: number = 50) => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(duration)
    } catch {
      // Vibration API not supported
    }
  }
}

// Cleanup on unmount
onUnmounted(() => {
  clearLongPressTimers()
})

// Filter configuration
const statusFilters = [
  { value: 'all', label: 'All', icon: Inbox },
  { value: 'active', label: 'Active', icon: Circle },
  { value: 'planned', label: 'Planned', icon: Clock },
  { value: 'done', label: 'Done', icon: CheckCircle2 },
]

// Computed
const filteredTasks = computed(() => {
  let tasks = [...taskStore.tasks]

  // Status filter
  if (activeStatusFilter.value === 'active') {
    tasks = tasks.filter(t => t.status !== 'done')
  } else if (activeStatusFilter.value !== 'all') {
    tasks = tasks.filter(t => t.status === activeStatusFilter.value)
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

const sortLabel = computed(() => {
  switch (sortBy.value) {
    case 'priority': return 'Priority'
    case 'dueDate': return 'Due'
    default: return 'Newest'
  }
})

// Actions
const setStatusFilter = (filter: string) => {
  activeStatusFilter.value = filter
}

const toggleSort = () => {
  const sortOptions: Array<'newest' | 'priority' | 'dueDate'> = ['newest', 'priority', 'dueDate']
  const currentIndex = sortOptions.indexOf(sortBy.value)
  sortBy.value = sortOptions[(currentIndex + 1) % sortOptions.length]
}

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

// Voice task confirmation handlers (TASK-1028)
const handleVoiceTaskConfirm = (task: { title: string; priority: 'high' | 'medium' | 'low' | null; dueDate: Date | null }) => {
  taskStore.createTask({
    title: task.title,
    status: 'planned',
    ...(task.dueDate && { dueDate: task.dueDate.toISOString() }),
    ...(task.priority && { priority: task.priority })
  })

  resetVoiceState()
}

const handleVoiceTaskCancel = () => {
  resetVoiceState()
}

// Task create sheet handler
const handleTaskSheetCreated = (data: { title: string; description: string; priority: 'high' | 'medium' | 'low' | null; dueDate: Date | null }) => {
  taskStore.createTask({
    title: data.title,
    status: 'planned',
    ...(data.description && { description: data.description }),
    ...(data.dueDate && { dueDate: data.dueDate.toISOString() }),
    ...(data.priority && { priority: data.priority })
  })
  isTaskCreateOpen.value = false
}

const resetVoiceState = () => {
  parsedVoiceTask.value = null
  showVoiceConfirmation.value = false
  // Also cancel any ongoing voice input
  cancelVoice()
}

const toggleTask = async (task: Task) => {
  const newStatus = task.status === 'done' ? 'planned' : 'done'
  // BUG-1051: AWAIT to ensure persistence
  await taskStore.updateTask(task.id, { status: newStatus })
}

const handleTaskClick = (task: Task) => {
  // Don't trigger click if long-press was just activated
  if (wasLongPressActivated.value) {
    wasLongPressActivated.value = false
    return
  }
  // Normal tap - could open task detail or do nothing
  // For now, we only use long-press to edit
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

.sort-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  border: none;
  background: var(--surface-tertiary);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
}

/* Task List */
.mobile-task-list {
  flex: 1;
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
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
  /* GPU acceleration for smooth long-press animations */
  will-change: transform, box-shadow;
  transform: translateZ(0);
  /* Base transition - overridden during long-press by inline styles */
  transition:
    transform var(--duration-normal, 200ms) var(--spring-smooth, cubic-bezier(0.25, 0.46, 0.45, 0.94)),
    box-shadow var(--duration-normal, 200ms) var(--spring-smooth, cubic-bezier(0.25, 0.46, 0.45, 0.94));
  /* Prevent text selection during long press */
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

/* Disable default active state when long-pressing */
.mobile-task-item.long-press-pressing:active,
.mobile-task-item.long-press-activated:active {
  transform: none; /* Let JS control the transform */
}

/* Only apply press-down on quick taps (idle state) */
.mobile-task-item.long-press-idle:active {
  transform: scale(0.98);
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-title.done {
  text-decoration: line-through;
  color: var(--text-muted);
}

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
</style>
