import { ref, computed } from 'vue'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useMobileFilters } from '@/composables/mobile/useMobileFilters'
import { useWhisperSpeech } from '@/composables/useWhisperSpeech'
import { useOfflineVoiceQueue } from '@/composables/useOfflineVoiceQueue'
import { useHaptics } from '@/composables/useHaptics'

export type ViewMode = 'tasks' | 'today'
export type TimeFilterType = 'all' | 'today' | 'week' | 'overdue'

export function useMobileInboxLogic() {
    const taskStore = useTaskStore()
    const { triggerHaptic } = useHaptics()

    const {
        groupBy,
        hideDoneTasks,
        setGroupBy
    } = useMobileFilters()

    // --- View State ---
    const VIEW_MODE_KEY = 'flowstate-inbox-view-mode'
    const viewMode = ref<ViewMode>((localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || 'tasks')

    const setViewMode = (mode: ViewMode) => {
        viewMode.value = mode
        localStorage.setItem(VIEW_MODE_KEY, mode)
    }

    const activeTimeFilter = ref<TimeFilterType>('all')
    const sortBy = ref<'newest' | 'priority' | 'dueDate'>('newest')
    const showGroupByDropdown = ref(false)
    const isTaskCreateOpen = ref(false)

    // --- Date Helpers ---
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

    // --- Voice / Offline Queue (Whisper Only) ---
    const finalVoiceTranscript = ref('')

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
        const response = await fetch(getWhisperEndpoint(), { method: 'POST', body: formData })
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.error?.message || `API error: ${response.status}`)
        }
        const data = await response.json()
        return { text: data.text || '', language: data.language || 'unknown' }
    }

    const {
        pendingCount: voicePendingCount,
        hasPending: hasVoicePending,
        isProcessing: isQueueProcessing,
        enqueue: enqueueVoice
    } = useOfflineVoiceQueue({
        transcribeAudio: transcribeAudioForQueue,
        onProcessed: (result) => {
            console.log('[OfflineVoice] Processed queued audio:', result.transcript)
            finalVoiceTranscript.value = result.transcript.trim()
            isTaskCreateOpen.value = true
        },
        onError: (error, item) => {
            console.error('[OfflineVoice] Failed to process queued audio:', error, item.id)
        }
    })

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
                finalVoiceTranscript.value = result.transcript.trim()
            }
        },
        onError: (err) => {
            console.warn('[Whisper] Error:', err)
        },
        onOfflineRecord: async (audioBlob, mimeType) => {
            console.log('[Whisper] Offline - queuing audio')
            await enqueueVoice(audioBlob, mimeType)
            triggerHaptic('medium')
        }
    })

    const isListening = computed(() => isWhisperRecording.value)
    const isProcessingVoice = computed(() => isWhisperProcessing.value || isQueueProcessing.value)
    const isVoiceQueued = computed(() => isWhisperQueued.value)
    const isVoiceSupported = computed(() => isWhisperSupported.value && hasWhisperApiKey.value)
    const voiceError = computed(() => whisperError.value)
    const voiceSessionActive = computed(() => isListening.value || isProcessingVoice.value || isWhisperQueued.value)

    const startVoice = async () => await startWhisper()
    const stopVoice = () => stopWhisper()
    const cancelVoice = () => cancelWhisper()

    const handleStartReRecord = async () => {
        finalVoiceTranscript.value = ''
        await startVoice()
    }

    const toggleVoiceInput = async () => {
        if (isListening.value) {
            stopVoice()
        } else {
            finalVoiceTranscript.value = ''
            isTaskCreateOpen.value = true
            await startVoice()
        }
    }

    const handleTaskCreateClose = () => {
        if (isListening.value || isProcessingVoice.value) {
            cancelVoice()
        }
        isTaskCreateOpen.value = false
        finalVoiceTranscript.value = ''
    }

    // --- Computed Task Lists ---
    const filteredTasks = computed(() => {
        let tasks = [...taskStore.tasks]

        if (viewMode.value === 'today') {
            tasks = tasks.filter(t => {
                if (t.status === 'done') return false
                if (!t.dueDate) return false
                return isDueToday(t.dueDate) || isTaskOverdue(t.dueDate)
            })
        }

        if (hideDoneTasks.value) {
            tasks = tasks.filter(t => t.status !== 'done')
        }

        if (viewMode.value === 'tasks') {
            switch (activeTimeFilter.value) {
                case 'today': tasks = tasks.filter(t => isDueToday(t.dueDate)); break
                case 'week': tasks = tasks.filter(t => isDueThisWeek(t.dueDate)); break
                case 'overdue': tasks = tasks.filter(t => isTaskOverdue(t.dueDate) && t.status !== 'done'); break
            }
        }

        switch (sortBy.value) {
            case 'priority': {
                const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3, none: 4 }
                tasks.sort((a, b) => (priorityOrder[a.priority || 'none'] || 4) - (priorityOrder[b.priority || 'none'] || 4))
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

    // --- Filter Configuration & Options ---
    const timeFilters = computed(() => {
        const allTasks = taskStore.tasks.filter(t => !hideDoneTasks.value || t.status !== 'done')
        return [
            { value: 'all' as const, label: 'All', count: allTasks.length },
            { value: 'today' as const, label: 'Today', count: allTasks.filter(t => isDueToday(t.dueDate)).length },
            { value: 'week' as const, label: 'This Week', count: allTasks.filter(t => isDueThisWeek(t.dueDate)).length },
            { value: 'overdue' as const, label: 'Overdue', count: allTasks.filter(t => isTaskOverdue(t.dueDate) && t.status !== 'done').length },
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

    const groupByOptions = [
        { value: 'none' as const, label: 'No Grouping' },
        { value: 'date' as const, label: 'By Date' },
        { value: 'project' as const, label: 'By Project' },
        { value: 'priority' as const, label: 'By Priority' },
    ]

    const groupByLabel = computed(() => {
        const option = groupByOptions.find(o => o.value === groupBy.value)
        return option?.label || 'Group'
    })

    const sortLabel = computed(() => {
        switch (sortBy.value) {
            case 'priority': return 'Priority'
            case 'dueDate': return 'Due'
            default: return 'Newest'
        }
    })

    const setTimeFilter = (filter: TimeFilterType) => {
        activeTimeFilter.value = filter
    }

    const toggleSort = () => {
        const sortOptions: Array<'newest' | 'priority' | 'dueDate'> = ['newest', 'priority', 'dueDate']
        const currentIndex = sortOptions.indexOf(sortBy.value)
        sortBy.value = sortOptions[(currentIndex + 1) % sortOptions.length]
    }

    const todayDateLabel = computed(() => {
        const now = new Date()
        const day = now.toLocaleDateString('en-US', { weekday: 'long' })
        const date = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
        return `${day}, ${date}`
    })

    // --- Grouping ---
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

        const sortedGroups = Array.from(groups.values())

        if (groupBy.value === 'date') {
            const dateOrder = ['overdue', 'today', 'this-week', 'later', 'no-date']
            sortedGroups.sort((a, b) => dateOrder.indexOf(a.key) - dateOrder.indexOf(b.key))
        } else if (groupBy.value === 'priority') {
            const priorityOrder = ['critical', 'high', 'medium', 'low', 'none']
            sortedGroups.sort((a, b) => priorityOrder.indexOf(a.key) - priorityOrder.indexOf(b.key))
        } else if (groupBy.value === 'project') {
            sortedGroups.sort((a, b) => {
                if (a.key === 'no-project') return 1
                if (b.key === 'no-project') return -1
                return a.title.localeCompare(b.title)
            })
        }

        return sortedGroups
    })

    // Exported properties & methods
    return {
        // State
        viewMode,
        activeTimeFilter,
        sortBy,
        groupBy,
        hideDoneTasks,
        showGroupByDropdown,
        isTaskCreateOpen,
        finalVoiceTranscript,

        // Voice State
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

        // Methods
        setViewMode,
        setGroupBy,
        startVoice,
        stopVoice,
        cancelVoice,
        toggleVoiceInput,
        handleStartReRecord,
        handleTaskCreateClose,
        isDueToday,
        isDueThisWeek,
        isTaskOverdue,

        // Data
        filteredTasks,
        groupedTasks,
        timeFilters,
        timeFilterLabel,
        groupByOptions,
        groupByLabel,
        sortLabel,
        todayDateLabel
    }
}
