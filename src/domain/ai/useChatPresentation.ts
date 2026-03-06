import { computed, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAIChatStore } from '@/stores/aiChat'
import { useTimerStore } from '@/stores/timer'
import { GROQ_MODELS, OPENROUTER_MODELS, asValueLabel, getDisplayName } from '@/config/aiModels'

export interface UseChatPresentationOptions {
  error: Ref<string | null>
  activeProvider: Ref<string | null>
  selectedProvider: Ref<string>
  selectedModel: Ref<string | null>
  setProvider: (p: 'auto' | 'groq' | 'openrouter' | 'ollama') => void | Promise<void>
  setModel: (m: string | null) => void
  executeDirectTool: (label: string, tool: { tool: string; parameters: Record<string, unknown> }) => void
  sendMessage: (msg: string) => void | Promise<void>
  clearError: () => void
  lastUserMessage: Ref<string>
  showSettings: Ref<boolean>
}

export function useChatPresentation(options: UseChatPresentationOptions) {
  const {
    error,
    activeProvider,
    selectedProvider,
    selectedModel,
    setProvider,
    setModel,
    executeDirectTool,
    sendMessage,
    clearError,
    lastUserMessage,
    showSettings,
  } = options

  const { t } = useI18n()
  const store = useAIChatStore()
  const timerStore = useTimerStore()

  // Error UX
  const friendlyError = computed(() => {
    if (!error.value) return null
    const err = error.value.toLowerCase()

    if (err.includes('econnrefused') || err.includes('localhost:11434')) {
      return { message: 'Ollama is not running. Start it with: ollama serve', type: 'warning' as const }
    }
    if (err.includes('network') || err.includes('fetch')) {
      return { message: 'Network error. Check your internet connection.', type: 'error' as const }
    }
    if (err.includes('rate limit') || err.includes('429')) {
      return { message: 'Rate limited. Please wait a moment and try again.', type: 'warning' as const }
    }
    if (err.includes('401') || err.includes('unauthorized')) {
      return { message: 'Authentication failed. Check your API key.', type: 'error' as const }
    }
    if (err.includes('all providers failed')) {
      return { message: 'AI is currently unavailable. Check provider settings.', type: 'error' as const }
    }
    return { message: error.value, type: 'error' as const }
  })

  function retryLastMessage() {
    if (lastUserMessage.value) {
      clearError()
      sendMessage(lastUserMessage.value)
    }
  }

  // Quick Actions
  function handleQuickAction(action: { label: string; message: string; directTool?: { tool: string; parameters: Record<string, unknown> } | null }) {
    if (action.directTool) {
      executeDirectTool(action.label, action.directTool)
    } else {
      sendMessage(action.message)
    }
  }

  const quickActions = computed(() => {
    const actions: { label: string; message: string; directTool?: { tool: string; parameters: Record<string, unknown> } | null }[] = []

    actions.push({ label: t('ai_chat.suggestion_plan'), message: 'Plan my day', directTool: { tool: 'get_daily_summary', parameters: {} } })
    actions.push({ label: t('ai_chat.suggestion_overdue'), message: 'What tasks are overdue?', directTool: { tool: 'get_overdue_tasks', parameters: {} } })

    if (store.context.selectedTask) {
      actions.push({ label: 'Break down this task', message: `Break down the task "${store.context.selectedTask.title}" into actionable subtasks.`, directTool: null })
    }

    if (timerStore.isTimerActive) {
      actions.push({ label: t('ai_chat.suggestion_time'), message: 'How much time is left on my current timer?', directTool: { tool: 'get_timer_status', parameters: {} } })
    }

    return actions.slice(0, 4)
  })

  // Provider Display
  const providerLabel = computed(() => {
    const p = activeProvider.value
    if (p === 'ollama') return 'Local'
    if (p === 'groq') return 'Groq'
    if (p === 'openrouter') return 'OpenRouter'
    return p || ''
  })

  const displayModelName = computed(() => {
    const model = selectedModel.value
    if (!model) return null
    const displayName = getDisplayName(model)
    if (displayName === model && model.includes(':')) return model
    return displayName !== model ? displayName : model
  })

  const headerBadgeText = computed(() => {
    const label = providerLabel.value
    if (!label) return ''
    if (selectedProvider.value === 'auto') return label
    if (displayModelName.value) return `${label} \u00B7 ${displayModelName.value}`
    return label
  })

  // Provider Settings
  const groqModels = asValueLabel(GROQ_MODELS)
  const openrouterModels = asValueLabel(OPENROUTER_MODELS)
  const currentProvider = computed(() => String(selectedProvider.value))

  const showCloudModelSelector = computed(() =>
    currentProvider.value === 'groq' || currentProvider.value === 'openrouter'
  )

  const cloudModelOptions = computed(() => {
    if (currentProvider.value === 'groq') return groqModels
    if (currentProvider.value === 'openrouter') return openrouterModels
    return []
  })

  function handleCloudModelChange(value: string | number) {
    setModel(value ? String(value) : null)
  }

  function selectProviderOption(provider: 'auto' | 'groq' | 'openrouter' | 'ollama') {
    setProvider(provider)
    if (provider === 'auto') {
      showSettings.value = false
    }
  }

  return {
    friendlyError,
    retryLastMessage,
    handleQuickAction,
    quickActions,
    providerLabel,
    displayModelName,
    headerBadgeText,
    showCloudModelSelector,
    cloudModelOptions,
    handleCloudModelChange,
    selectProviderOption,
  }
}
