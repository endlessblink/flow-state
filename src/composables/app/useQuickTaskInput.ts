import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useTaskStore } from '@/stores/tasks'
import { useWhisperSpeech } from '@/composables/useWhisperSpeech'
import { useFilterDefaults } from '@/composables/tasks/useFilterDefaults'
import { SUCCESS_FLASH_DURATION_MS } from '@/config/timing'

export function useQuickTaskInput() {
  const { t } = useI18n()
  const route = useRoute()
  const taskStore = useTaskStore()
  const { filterDefaults } = useFilterDefaults()

  // Refs for template elements
  const quickTaskRef = ref<HTMLInputElement | null>(null)
  const quickTaskExpandedRef = ref<HTMLTextAreaElement | null>(null)

  // State
  const quickTaskText = ref('')
  const quickTaskFocused = ref(false)
  const showFullscreenCreator = ref(false)
  const showSuccessFlash = ref(false)

  // TASK-1324: Quick task metadata (date + priority)
  const quickTaskDueDate = ref<string | null>(null)
  const quickTaskPriority = ref<'low' | 'medium' | 'high' | null>(null)
  const showDatePicker = ref(false)
  const showPriorityPicker = ref(false)

  // RTL detection for Hebrew input
  const quickTaskDirection = computed(() => {
    const text = quickTaskText.value.trim()
    if (!text) return 'ltr'
    const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
    return rtlRegex.test(text[0]) ? 'rtl' : 'ltr'
  })

  // TASK-1324 Feature 1: Auto-expand when text gets long
  const isQuickAddExpanded = computed(() => {
    const text = quickTaskText.value.trim()
    if (!text) return false
    const wordCount = text.split(/\s+/).length
    return wordCount >= 6 || text.length > 40
  })

  // Show metadata row when input is focused, has values set, or a dropdown is open
  const showMetadataRow = computed(() => {
    return quickTaskFocused.value || quickTaskDueDate.value !== null || quickTaskPriority.value !== null || showDatePicker.value || showPriorityPicker.value
  })

  // TASK-1451: Pre-fill due date from filter defaults so user sees the badge
  watch(() => filterDefaults.value.dueDate, (defaultDate) => {
    // Only pre-fill if user hasn't manually set a date
    if (quickTaskDueDate.value === null && defaultDate) {
      quickTaskDueDate.value = defaultDate
    }
  }, { immediate: true })

  // Also update when smart view changes (e.g. user switches to "Today")
  watch(() => taskStore.activeSmartView, () => {
    // Reset to filter default when switching views (unless user manually set a date)
    const defaultDate = filterDefaults.value.dueDate
    quickTaskDueDate.value = defaultDate || null
  })

  // Auto-focus the textarea when expanding
  watch(isQuickAddExpanded, (expanded) => {
    if (expanded) {
      nextTick(() => quickTaskExpandedRef.value?.focus())
    }
  })

  // FEATURE-1200: Auto-expand to fullscreen modal for very long text
  const shouldAutoExpand = computed(() => {
    const text = quickTaskText.value.trim()
    if (!text) return false
    const wordCount = text.split(/\s+/).length
    return wordCount >= 20 || text.length > 150
  })

  watch(shouldAutoExpand, (shouldExpand) => {
    if (shouldExpand && !showFullscreenCreator.value) {
      expandToFullscreen()
    }
  })

  // Collapse quick add (clear text)
  const collapseQuickAdd = () => {
    quickTaskText.value = ''
  }

  // FEATURE-1200: Open fullscreen creator with current text
  const expandToFullscreen = () => {
    showFullscreenCreator.value = true
  }

  const handleFullscreenCreate = async (data: {
    title: string
    description: string
    status: string
    priority: 'low' | 'medium' | 'high'
    dueDate?: string
    projectId?: string
  }) => {
    try {
      await taskStore.createTaskWithUndo({
        ...filterDefaults.value,
        title: data.title,
        description: data.description,
        status: data.status as 'todo' | 'done',
        priority: data.priority,
        dueDate: data.dueDate,
        projectId: data.projectId
      })
      quickTaskText.value = ''
      quickTaskDueDate.value = null
      quickTaskPriority.value = null
      showFullscreenCreator.value = false
      showSuccessFlash.value = true
      setTimeout(() => { showSuccessFlash.value = false }, SUCCESS_FLASH_DURATION_MS)
    } catch (error) {
      console.error('Error creating task from fullscreen:', error)
    }
  }

  const handleFullscreenCancel = () => {
    showFullscreenCreator.value = false
    // Don't clear text - user might want to continue editing inline
  }

  // TASK-1324 Feature 2: Date picker
  const toggleDatePicker = () => {
    showDatePicker.value = !showDatePicker.value
    showPriorityPicker.value = false
  }

  const selectDate = (option: 'today' | 'tomorrow' | 'weekend' | null) => {
    if (option === null) {
      quickTaskDueDate.value = null
    } else if (option === 'today') {
      const today = new Date()
      quickTaskDueDate.value = today.toISOString().split('T')[0]
    } else if (option === 'tomorrow') {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      quickTaskDueDate.value = tomorrow.toISOString().split('T')[0]
    } else if (option === 'weekend') {
      const today = new Date()
      const dayOfWeek = today.getDay()
      const daysUntilSaturday = (6 - dayOfWeek + 7) % 7
      const saturday = new Date()
      saturday.setDate(today.getDate() + daysUntilSaturday)
      quickTaskDueDate.value = saturday.toISOString().split('T')[0]
    }
    showDatePicker.value = false
  }

  const formatDateLabel = (date: string | null): string => {
    if (!date) return t('sidebar.no_date')
    const d = new Date(date + 'T00:00:00')
    const today = new Date()
    const tomorrow = new Date()
    tomorrow.setDate(today.getDate() + 1)

    const dateStr = d.toISOString().split('T')[0]
    const todayStr = today.toISOString().split('T')[0]
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    if (dateStr === todayStr) return t('smart_views.today')
    if (dateStr === tomorrowStr) return t('sidebar.tomorrow')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // TASK-1324 Feature 3: Priority picker
  const togglePriorityPicker = () => {
    showPriorityPicker.value = !showPriorityPicker.value
    showDatePicker.value = false
  }

  const selectPriority = (priority: 'low' | 'medium' | 'high' | null) => {
    quickTaskPriority.value = priority
    showPriorityPicker.value = false
  }

  const formatPriorityLabel = (priority: 'low' | 'medium' | 'high' | null): string => {
    if (!priority) return t('common.none')
    return priority.charAt(0).toUpperCase() + priority.slice(1)
  }

  const getPriorityColor = (priority: 'low' | 'medium' | 'high' | null) => {
    if (!priority) return {}
    const colors: Record<string, string> = {
      low: 'var(--color-priority-low)',
      medium: 'var(--color-priority-medium)',
      high: 'var(--color-priority-high)'
    }
    return { color: colors[priority] }
  }

  // Close dropdowns when clicking outside
  const handleOutsideClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement
    if (!target.closest('.metadata-picker')) {
      showDatePicker.value = false
      showPriorityPicker.value = false
    }
  }

  // TASK-1322: Whisper-only voice input
  const {
    isRecording: isWhisperRecording,
    isProcessing: isWhisperProcessing,
    transcript: whisperTranscript,
    error: whisperError,
    start: startWhisper,
    stop: stopWhisper,
    cancel: cancelWhisper
  } = useWhisperSpeech({
    onResult: (result) => {
      console.log('[Whisper Sidebar] Result:', result)
      if (result.transcript.trim()) {
        quickTaskText.value = result.transcript.trim()
        // Don't auto-submit — let user review and press Enter
      }
    },
    onError: (err) => {
      console.warn('[Whisper Sidebar] Error:', err)
    }
  })

  // Voice state
  const isListening = computed(() => isWhisperRecording.value)
  const isProcessingVoice = computed(() => isWhisperProcessing.value)
  const displayTranscript = computed(() => whisperTranscript.value)
  const voiceError = computed(() => whisperError.value)

  // Toggle voice recording
  const toggleVoiceInput = async () => {
    if (isListening.value) {
      stopWhisper()
    } else {
      quickTaskText.value = ''
      await startWhisper()
    }
  }

  // Cancel voice recording
  const cancelVoice = () => {
    cancelWhisper()
  }

  const createQuickTask = async () => {
    if (!quickTaskText.value.trim()) return

    const title = quickTaskText.value.trim()

    // When on canvas view, dispatch event so CanvasView handles creation at viewport center
    if (route.path === '/canvas') {
      window.dispatchEvent(new CustomEvent('sidebar-quick-task-create', {
        detail: {
          ...filterDefaults.value,
          title,
          description: '',
          status: 'todo',
          priority: quickTaskPriority.value || 'medium',
          dueDate: quickTaskDueDate.value || undefined,
        }
      }))
      quickTaskText.value = ''
      quickTaskDueDate.value = null
      quickTaskPriority.value = null
      showSuccessFlash.value = true
      setTimeout(() => { showSuccessFlash.value = false }, SUCCESS_FLASH_DURATION_MS)
      return
    }

    // Default: create inbox task
    try {
      await taskStore.createTaskWithUndo({
        ...filterDefaults.value,
        title,
        description: '',
        status: 'todo',
        ...(quickTaskDueDate.value && { dueDate: quickTaskDueDate.value }),
        ...(quickTaskPriority.value && { priority: quickTaskPriority.value })
      })
      quickTaskText.value = ''
      quickTaskDueDate.value = null
      quickTaskPriority.value = null
      // Visual confirmation flash
      showSuccessFlash.value = true
      setTimeout(() => { showSuccessFlash.value = false }, SUCCESS_FLASH_DURATION_MS)
    } catch (error) {
      console.error('Error creating quick task:', error)
    }
  }

  // Focus input method (exposed to parent)
  const focusInput = () => {
    quickTaskRef.value?.focus()
  }

  return {
    // Refs
    quickTaskRef,
    quickTaskExpandedRef,

    // State
    quickTaskText,
    quickTaskFocused,
    quickTaskDirection,
    showFullscreenCreator,
    showSuccessFlash,
    quickTaskDueDate,
    quickTaskPriority,
    showDatePicker,
    showPriorityPicker,

    // Computed
    isQuickAddExpanded,
    showMetadataRow,
    isListening,
    isProcessingVoice,
    displayTranscript,
    voiceError,

    // Methods
    collapseQuickAdd,
    expandToFullscreen,
    handleFullscreenCreate,
    handleFullscreenCancel,
    toggleDatePicker,
    selectDate,
    formatDateLabel,
    togglePriorityPicker,
    selectPriority,
    formatPriorityLabel,
    getPriorityColor,
    handleOutsideClick,
    toggleVoiceInput,
    cancelVoice,
    createQuickTask,
    focusInput
  }
}
