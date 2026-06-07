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

  function chatText(en: string, he: string): string {
    return store.chatLanguage === 'he' ? he : en
  }

  // Error UX
  const friendlyError = computed(() => {
    if (!error.value) return null
    const err = error.value.toLowerCase()

    if (err.includes('econnrefused') || err.includes('localhost:11434')) {
      return { message: chatText('Ollama is not running. Start it with: ollama serve', 'Ollama לא פועל. הפעל אותו עם: ollama serve'), type: 'warning' as const }
    }
    if (err.includes('network') || err.includes('fetch')) {
      return { message: chatText('Network error. Check your internet connection.', 'שגיאת רשת. בדוק את החיבור לאינטרנט.'), type: 'error' as const }
    }
    if (err.includes('rate limit') || err.includes('429')) {
      return { message: chatText('Rate limited. Please wait a moment and try again.', 'הגעת למגבלת שימוש. המתן רגע ונסה שוב.'), type: 'warning' as const }
    }
    if (err.includes('401') || err.includes('unauthorized')) {
      return { message: chatText('Authentication failed. Check your API key.', 'האימות נכשל. בדוק את מפתח ה-API.'), type: 'error' as const }
    }
    if (err.includes('all providers failed')) {
      return { message: chatText('AI is currently unavailable. Check provider settings.', 'ה-AI לא זמין כרגע. בדוק את הגדרות הספקים.'), type: 'error' as const }
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

    actions.push({
      label: chatText(t('ai_chat.suggestion_plan'), 'תכנן לי את היום'),
      message: chatText('Plan my day', 'תכנן לי את היום'),
      directTool: { tool: 'get_daily_summary', parameters: {} },
    })
    actions.push({
      label: chatText(t('ai_chat.suggestion_overdue'), 'מה המשימות באיחור?'),
      message: chatText('What tasks are overdue?', 'מה המשימות באיחור?'),
      directTool: { tool: 'get_overdue_tasks', parameters: {} },
    })

    if (store.context.selectedTask) {
      actions.push({
        label: chatText('Break down this task', 'פרק את המשימה הזאת'),
        message: chatText(
          `Break down the task "${store.context.selectedTask.title}" into actionable subtasks.`,
          `פרק את המשימה "${store.context.selectedTask.title}" לתת-משימות מעשיות.`
        ),
        directTool: null,
      })
    }

    if (timerStore.isTimerActive) {
      actions.push({
        label: chatText(t('ai_chat.suggestion_time'), 'כמה זמן נשאר?'),
        message: chatText('How much time is left on my current timer?', 'כמה זמן נשאר בטיימר הנוכחי?'),
        directTool: { tool: 'get_timer_status', parameters: {} },
      })
    }

    return actions.slice(0, 4)
  })

  // Provider Display
  const providerLabel = computed(() => {
    const p = activeProvider.value
    // TASK-1814: subscription bridge shows the active brain, not "bridge"
    if (p === 'bridge' || selectedProvider.value === 'bridge') {
      return selectedModel.value === 'codex' ? 'Codex' : 'Claude'
    }
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
    // TASK-1814: bridge badge is just the brain name (e.g. "Claude") \u2014 no model suffix
    if (selectedProvider.value === 'bridge') return label
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
