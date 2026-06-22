<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Bot, DollarSign, MessageSquare, Zap, Trash2, Tag, RefreshCw, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, Wand2, HeartPulse } from 'lucide-vue-next'
import { useAIUsageTracking, type UsagePeriod, type UsageSummary } from '@/composables/useAIUsageTracking'
import { useAIChat } from '@/composables/useAIChat'
import { useWorkProfile } from '@/composables/useWorkProfile'
import { useMemoryAssessment } from '@/composables/useMemoryAssessment'
import { useSettingsStore } from '@/stores/settings'
import SettingsSection from '../SettingsSection.vue'
import SettingsToggle from '../SettingsToggle.vue'
import { PROVIDER_OPTIONS, GROQ_MODELS, OPENROUTER_MODELS, asIdLabel, filterFreeModels, type AIProviderKey } from '@/config/aiModels'
import { tauriFetch } from '@/services/ai/utils/tauriHttp'
import { resetSharedRouter } from '@/services/ai/routerFactory'
import { isBridgeAvailable } from '@/services/ai/proxy/bridgeClient'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
import type { AIMemoryDebugSnapshot } from '@/types/aiMemory'
import type { TranscriptionProviderId } from '@/services/transcription/types'

const { usageSummary, weekUsage, monthUsage, hasUsageData, pricingCatalog, clearUsageData } = useAIUsageTracking()
const settingsStore = useSettingsStore()
const aiMemoryDb = useSupabaseDatabase()

// ── TASK-1814: Subscription brain (Claude/Codex via VPS bridge) ──
const BRAIN_OPTIONS = [
  { key: 'claude' as const, label: 'Claude', desc: 'Claude Code subscription' },
  { key: 'codex' as const, label: 'Codex', desc: 'ChatGPT / GPT subscription' },
]
const bridgeStatus = ref<'checking' | 'online' | 'offline'>('checking')
async function checkBridge() {
  bridgeStatus.value = 'checking'
  bridgeStatus.value = (await isBridgeAvailable()) ? 'online' : 'offline'
}
function setBrain(brain: 'claude' | 'codex') {
  settingsStore.updateSetting('aiBrain', brain)
  resetSharedRouter()
}
function onToggleSubscription(v: boolean) {
  settingsStore.updateSetting('aiUseSubscription', v)
  resetSharedRouter()
  if (v) void checkBridge()
}
void checkBridge()
const { profile, loadProfile, savePreferences, computeCapacityMetrics, resetLearnedData } = useWorkProfile()

const VOICE_TRANSCRIPTION_OPTIONS: Array<{ key: TranscriptionProviderId; label: string; desc: string }> = [
  { key: 'auto', label: 'Auto', desc: 'Android Gemma when ready, otherwise Whisper' },
  { key: 'whisper-cloud', label: 'Whisper', desc: 'Current Groq Whisper cloud path' },
  { key: 'android-gemma-local', label: 'Android Gemma', desc: 'Local-only Android bridge' },
]

function setVoiceTranscriptionProvider(provider: TranscriptionProviderId) {
  settingsStore.updateSetting('voiceTranscriptionProvider', provider)
}

// ── TASK-1356: Memory Health Assessment ──
const {
  isRunning: memoryHealthRunning,
  progress: memoryHealthProgress,
  currentCheck: memoryHealthCheck,
  report: memoryHealthReport,
  error: memoryHealthError,
  runFastAssessment,
  getHistory: getMemoryHistory,
} = useMemoryAssessment()

const lastMemoryReport = computed(() => {
  if (memoryHealthReport.value) return memoryHealthReport.value
  const history = getMemoryHistory()
  return history.length > 0 ? history[0] : null
})

const aiMemoryDebug = ref<AIMemoryDebugSnapshot | null>(null)
const aiMemoryDebugLoading = ref(false)
const aiMemoryDebugClearing = ref(false)
const aiMemoryDebugError = ref('')

const aiMemoryDebugCounts = computed(() => {
  const snapshot = aiMemoryDebug.value
  return [
    { label: 'Entities', value: snapshot?.contextEntities.length ?? 0 },
    { label: 'Edges', value: snapshot?.contextEdges.length ?? 0 },
    { label: 'Beliefs', value: snapshot?.parameterBeliefs.length ?? 0 },
    { label: 'Snapshots', value: snapshot?.memorySnapshots.length ?? 0 },
    { label: 'Events', value: snapshot?.clarificationEvents.length ?? 0 },
    { label: 'Feedback', value: snapshot?.recommendationFeedback.length ?? 0 },
    { label: 'Pending sync', value: snapshot?.pendingWriteCount ?? 0 },
  ]
})

const aiMemorySchemaStatusLabel = computed(() => {
  const snapshot = aiMemoryDebug.value
  if (!snapshot) return ''
  if (snapshot.schemaStatus === 'ready') return 'Server schema ready'
  if (snapshot.schemaStatus === 'local_only') return 'Local memory only'
  if (snapshot.schemaStatus === 'missing') return 'AI memory schema missing'
  return `AI memory schema partial: ${snapshot.schemaMissingTables.join(', ')}`
})

const aiMemoryDebugSubtitle = computed(() => {
  const snapshot = aiMemoryDebug.value
  if (!snapshot) return 'Refresh to inspect the context chat can currently use'
  if (snapshot.schemaStatus === 'ready') return 'Server-backed context currently available to chat'
  if (snapshot.schemaStatus === 'local_only') return 'Local-only memory on this device; sign in for cross-device memory'
  if (snapshot.schemaStatus === 'missing') return 'Server schema unavailable; chat is using local fallback and queued writes'
  return 'Partial server schema; unavailable tables are using fallback behavior'
})

function aiMemoryEventLabel(snapshot: AIMemoryDebugSnapshot): string[] {
  return snapshot.clarificationEvents.slice(0, 3).map(event => {
    const answer = event.selectedLabel || event.freeText || event.eventType
    return `${event.entityKey}: ${answer}`
  })
}

async function refreshAIMemoryDebug() {
  aiMemoryDebugLoading.value = true
  aiMemoryDebugError.value = ''
  try {
    if (typeof aiMemoryDb.fetchAIMemoryDebugSnapshot !== 'function') {
      throw new Error('AI memory debug snapshot is unavailable.')
    }
    aiMemoryDebug.value = await aiMemoryDb.fetchAIMemoryDebugSnapshot(6)
  } catch (e) {
    aiMemoryDebugError.value = e instanceof Error ? e.message : String(e)
  } finally {
    aiMemoryDebugLoading.value = false
  }
}

function aiMemoryClearConfirmMessage(): string {
  const status = aiMemoryDebug.value?.schemaStatus
  if (status === 'local_only') {
    return 'Clear local AI chat memory on this device? The assistant will need to re-learn clarification answers and feedback here.'
  }
  if (status === 'missing') {
    return 'Clear local fallback and queued AI chat memory? Server memory is not available until the AI memory schema is ready.'
  }
  if (status === 'partial') {
    return 'Clear available AI chat memory and local fallbacks? Some server memory tables are currently unavailable.'
  }
  return 'Clear server-backed AI chat memory? The assistant will need to re-learn clarification answers and feedback.'
}

async function clearAIMemoryDebugData() {
  if (!confirm(aiMemoryClearConfirmMessage())) return
  aiMemoryDebugClearing.value = true
  aiMemoryDebugError.value = ''
  try {
    if (typeof aiMemoryDb.clearAIMemoryDebugData !== 'function') {
      throw new Error('AI memory clear is unavailable.')
    }
    await aiMemoryDb.clearAIMemoryDebugData()
    aiMemoryDebug.value = await aiMemoryDb.fetchAIMemoryDebugSnapshot(6)
  } catch (e) {
    aiMemoryDebugError.value = e instanceof Error ? e.message : String(e)
  } finally {
    aiMemoryDebugClearing.value = false
  }
}

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'var(--brand-primary)'
    case 'B': return 'var(--color-info)'
    case 'C': return 'var(--color-warning)'
    case 'D': return 'var(--color-danger)'
    case 'F': return 'var(--color-danger)'
    default: return 'var(--text-muted)'
  }
}

// ── Default Provider/Model ──
const {
  selectedProvider,
  selectedModel,
  availableOllamaModels,
  setProvider,
  setModel,
  refreshOllamaModels,
} = useAIChat()

const groqModels = asIdLabel(GROQ_MODELS)
const openrouterModels = asIdLabel(OPENROUTER_MODELS)

const currentModelOptions = computed(() => {
  switch (selectedProvider.value) {
    case 'ollama':
      return availableOllamaModels.value.map(m => ({ id: m, label: m }))
    case 'groq':
      return groqModels
    case 'openrouter':
      return openrouterModels
    default:
      return []
  }
})

function onProviderChange(provider: AIProviderKey) {
  setProvider(provider)
}

function onModelChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  setModel(value || null)
}

const showFreeOnly = ref(false)

// ── Weekly Plan Provider/Model (TASK-1327) ──
const wpProviderOptions = PROVIDER_OPTIONS.map(opt => {
  // Override 'auto' description for weekly plan context
  if (opt.key === 'auto') {
    return { ...opt, desc: 'Uses your default chat model' }
  }
  return opt
})

const wpModelOptions = computed(() => {
  switch (settingsStore.weeklyPlanProvider) {
    case 'ollama':
      return availableOllamaModels.value.map(m => ({ id: m, label: m }))
    case 'groq':
      return showFreeOnly.value ? asIdLabel(filterFreeModels(GROQ_MODELS)) : groqModels
    case 'openrouter':
      return showFreeOnly.value ? asIdLabel(filterFreeModels(OPENROUTER_MODELS)) : openrouterModels
    default:
      return []
  }
})

function onWpProviderChange(provider: AIProviderKey) {
  settingsStore.updateSetting('weeklyPlanProvider', provider)
  // Reset model when provider changes
  settingsStore.updateSetting('weeklyPlanModel', '')
}

function onWpModelChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  settingsStore.updateSetting('weeklyPlanModel', value || '')
}

// ── TASK-1350: Groq API Key Management ──
const groqKeyInput = ref(settingsStore.groqApiKey || '')
const showGroqKey = ref(false)
const groqTestStatus = ref<'success' | 'error' | 'testing' | null>(null)
const groqTestMessage = ref('')

async function testGroqConnection() {
  groqTestStatus.value = 'testing'
  groqTestMessage.value = 'Testing...'
  try {
    const response = await tauriFetch('https://api.groq.com/openai/v1/models', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${groqKeyInput.value}` },
      signal: AbortSignal.timeout(10000),
    })
    if (response.ok) {
      groqTestStatus.value = 'success'
      groqTestMessage.value = 'Connected!'
    } else if (response.status === 401) {
      groqTestStatus.value = 'error'
      groqTestMessage.value = 'Invalid API key'
    } else {
      groqTestStatus.value = 'error'
      groqTestMessage.value = `HTTP ${response.status}`
    }
  } catch (err) {
    groqTestStatus.value = 'error'
    groqTestMessage.value = err instanceof Error ? err.message : 'Failed'
  }
}

function saveGroqKey() {
  settingsStore.updateSetting('groqApiKey', groqKeyInput.value)
  resetSharedRouter()
  groqTestStatus.value = null
}

function clearGroqKey() {
  groqKeyInput.value = ''
  settingsStore.updateSetting('groqApiKey', '')
  resetSharedRouter()
  groqTestStatus.value = null
}

// Re-run wizard via global event (wizard lives in App.vue, not in settings modal tree)
function rerunWizard() {
  window.dispatchEvent(new Event('global-rerun-ai-wizard'))
}

/** Currently selected time period */
const selectedPeriod = ref<UsagePeriod>('all')

const periods: { id: UsagePeriod; label: string }[] = [
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'all', label: 'All Time' }
]

/** Get the usage data for the selected period */
const currentUsage = computed<UsageSummary>(() => {
  switch (selectedPeriod.value) {
    case 'week': return weekUsage.value
    case 'month': return monthUsage.value
    default: return usageSummary.value
  }
})

/** Format large numbers with commas */
function formatNumber(num: number): string {
  return num.toLocaleString('en-US')
}

/** Format cost as USD currency */
function formatCost(cost: number): string {
  if (cost === 0) return 'Free'
  if (cost < 0.01) return `$${cost.toFixed(6)}`
  return `$${cost.toFixed(4)}`
}

/** Format pricing rate (per 1M tokens) */
function formatRate(rate: number): string {
  if (rate === 0) return 'Free'
  return `$${rate.toFixed(2)}`
}

/** Format context window size */
function formatContext(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(0)}M`
  return `${(tokens / 1_000).toFixed(0)}K`
}

/** Get color indicator for provider */
function getProviderColor(provider: string): string {
  switch (provider) {
    case 'ollama': return 'var(--color-success)'
    case 'groq': return 'var(--color-info)'
    case 'openrouter': return 'var(--color-warning)'
    default: return 'var(--text-muted)'
  }
}

/** Clear all usage data */
function handleClearUsageData() {
  if (!confirm('This will clear all AI usage tracking data. Continue?')) return
  clearUsageData()
}

/** Summary stats for the selected period */
const summaryStats = computed(() => [
  { label: 'Total Tokens', value: formatNumber(currentUsage.value.totalTokens), icon: Zap },
  { label: 'Requests', value: formatNumber(currentUsage.value.totalRequests), icon: MessageSquare },
  { label: 'Est. Cost', value: formatCost(currentUsage.value.totalCostUSD), icon: DollarSign }
])

// ── Work Profile Settings ──
const isRecalculating = ref(false)
const isResetting = ref(false)
const isClearingMemories = ref(false)

onMounted(async () => {
  await loadProfile()
  void refreshAIMemoryDebug()
})

async function onRecalculate() {
  isRecalculating.value = true
  try {
    await computeCapacityMetrics()
  } finally {
    isRecalculating.value = false
  }
}

async function onReset() {
  if (!confirm('Reset all learned patterns? This cannot be undone.')) return
  isResetting.value = true
  try {
    await resetLearnedData()
  } finally {
    isResetting.value = false
  }
}

async function onClearMemories() {
  if (!confirm('Clear all memory observations? The AI will need to re-learn patterns.')) return
  isClearingMemories.value = true
  try {
    await savePreferences({ memoryGraph: [] } as unknown as import('@/composables/useWorkProfile').WorkProfileData)
  } finally {
    isClearingMemories.value = false
  }
}
</script>

<template>
  <div class="ai-settings-tab">
    <!-- TASK-1814: Subscription brain (Claude/Codex) -->
    <SettingsSection title="AI Brain (Subscription)">
      <p class="section-desc">
        Use your Claude and Codex subscriptions as the AI brain — far better results than the free
        models, with no per-token API cost. Switch brains anytime; every AI action uses your choice.
        If the brain is ever unavailable, AI automatically falls back to the free provider.
      </p>

      <SettingsToggle
        label="Use my subscription (Claude / Codex)"
        :value="settingsStore.aiUseSubscription"
        @update="onToggleSubscription"
      />

      <template v-if="settingsStore.aiUseSubscription">
        <div class="provider-chips" style="margin-top: 12px;">
          <button
            v-for="opt in BRAIN_OPTIONS"
            :key="opt.key"
            class="provider-chip"
            :class="{ active: settingsStore.aiBrain === opt.key }"
            @click="setBrain(opt.key)"
          >
            <span class="provider-chip-label">{{ opt.label }}</span>
            <span class="provider-chip-desc">{{ opt.desc }}</span>
          </button>
        </div>

        <div class="bridge-status" style="margin-top: 10px; display: flex; align-items: center; gap: 8px; font-size: 13px;">
          <CheckCircle2 v-if="bridgeStatus === 'online'" :size="15" style="color: var(--color-success, #34d399);" />
          <AlertCircle v-else-if="bridgeStatus === 'offline'" :size="15" style="color: var(--color-warning, #fbbf24);" />
          <Loader2 v-else :size="15" class="spin" />
          <span>
            <template v-if="bridgeStatus === 'online'">Connected — using your subscription brain.</template>
            <template v-else-if="bridgeStatus === 'offline'">Bridge unreachable — falling back to the free provider.</template>
            <template v-else>Checking connection…</template>
          </span>
          <button class="refresh-models-btn" title="Re-check" @click="checkBridge()">
            <RefreshCw :size="13" />
          </button>
        </div>
      </template>
    </SettingsSection>

    <SettingsSection title="Voice Transcription">
      <p class="section-desc">
        Choose how mobile voice capture is transcribed. Android Gemma requires the native FlowState
        bridge and a FlowState-accessible model copy; Edge Gallery's private app storage is not used.
      </p>

      <div class="provider-chips">
        <button
          v-for="opt in VOICE_TRANSCRIPTION_OPTIONS"
          :key="opt.key"
          class="provider-chip"
          :class="{ active: settingsStore.voiceTranscriptionProvider === opt.key }"
          @click="setVoiceTranscriptionProvider(opt.key)"
        >
          <span class="provider-chip-label">{{ opt.label }}</span>
          <span class="provider-chip-desc">{{ opt.desc }}</span>
        </button>
      </div>
    </SettingsSection>

    <!-- Default Provider & Model -->
    <SettingsSection title="Default Provider & Model">
      <p class="section-desc">
        Choose which AI provider and model to use by default. This applies to all new chat sessions.
      </p>

      <!-- Provider selector -->
      <div class="provider-chips">
        <button
          v-for="opt in PROVIDER_OPTIONS"
          :key="opt.key"
          class="provider-chip"
          :class="{ active: selectedProvider === opt.key }"
          @click="onProviderChange(opt.key)"
        >
          <span class="provider-chip-label">{{ opt.label }}</span>
          <span class="provider-chip-desc">{{ opt.desc }}</span>
        </button>
      </div>

      <!-- Model selector (when not auto) -->
      <div v-if="selectedProvider !== 'auto'" class="model-selector">
        <label class="model-selector-label">Model</label>
        <div class="model-select-wrapper">
          <select
            class="model-select"
            :value="selectedModel || ''"
            @change="onModelChange"
          >
            <option value="">
              Default
            </option>
            <option
              v-for="m in currentModelOptions"
              :key="m.id"
              :value="m.id"
            >
              {{ m.label }}
            </option>
          </select>
        </div>
        <button
          v-if="selectedProvider === 'ollama'"
          class="refresh-models-btn"
          title="Refresh local models"
          @click="refreshOllamaModels()"
        >
          <RefreshCw :size="14" />
        </button>
      </div>
    </SettingsSection>

    <!-- TASK-1350: Groq API Key -->
    <SettingsSection title="Groq API Key">
      <p class="section-desc">
        Provide your own Groq API key for direct access. Free tier available at
        <a
          href="https://console.groq.com/keys"
          target="_blank"
          rel="noopener noreferrer"
          class="settings-link"
        >console.groq.com</a>.
      </p>

      <div class="groq-key-row">
        <div class="groq-key-input-wrapper">
          <input
            :type="showGroqKey ? 'text' : 'password'"
            v-model="groqKeyInput"
            placeholder="gsk_..."
            class="groq-key-input"
            spellcheck="false"
            autocomplete="off"
          />
          <button class="key-toggle-btn" @click="showGroqKey = !showGroqKey" :title="showGroqKey ? 'Hide' : 'Show'">
            <EyeOff v-if="showGroqKey" :size="14" />
            <Eye v-else :size="14" />
          </button>
        </div>

        <div class="groq-key-actions">
          <button
            class="groq-action-btn save"
            :disabled="groqKeyInput === settingsStore.groqApiKey"
            @click="saveGroqKey"
          >
            Save
          </button>
          <button
            class="groq-action-btn test"
            :disabled="!groqKeyInput || groqTestStatus === 'testing'"
            @click="testGroqConnection"
          >
            <Loader2 v-if="groqTestStatus === 'testing'" :size="12" class="spinning" />
            Test
          </button>
          <button
            v-if="settingsStore.groqApiKey"
            class="groq-action-btn danger"
            @click="clearGroqKey"
          >
            Clear
          </button>
        </div>
      </div>

      <div v-if="groqTestStatus" class="groq-test-result" :class="groqTestStatus">
        <CheckCircle2 v-if="groqTestStatus === 'success'" :size="14" />
        <AlertCircle v-if="groqTestStatus === 'error'" :size="14" />
        <Loader2 v-if="groqTestStatus === 'testing'" :size="14" class="spinning" />
        <span>{{ groqTestMessage }}</span>
      </div>
    </SettingsSection>

    <!-- Re-run AI Setup Wizard -->
    <SettingsSection title="Setup Wizard">
      <button class="wizard-rerun-btn" @click="rerunWizard()">
        <Wand2 :size="14" />
        Re-run AI Setup Wizard
      </button>
    </SettingsSection>

    <!-- TASK-1327: Weekly Plan Model Override -->
    <SettingsSection title="Weekly Plan Model">
      <p class="section-desc">
        Override the model used for weekly plan generation. Defaults to your chat model.
      </p>

      <!-- Provider selector -->
      <div class="provider-chips">
        <button
          v-for="opt in wpProviderOptions"
          :key="opt.key"
          class="provider-chip"
          :class="{ active: settingsStore.weeklyPlanProvider === opt.key }"
          @click="onWpProviderChange(opt.key)"
        >
          <span class="provider-chip-label">{{ opt.label }}</span>
          <span class="provider-chip-desc">{{ opt.desc }}</span>
        </button>
      </div>

      <!-- Model selector (when not auto) -->
      <div v-if="settingsStore.weeklyPlanProvider !== 'auto'" class="model-selector">
        <label class="model-selector-label">Model</label>
        <button
          class="free-filter-btn"
          :class="{ active: showFreeOnly }"
          @click="showFreeOnly = !showFreeOnly"
        >
          Free
        </button>
        <div class="model-select-wrapper">
          <select
            class="model-select"
            :value="settingsStore.weeklyPlanModel || ''"
            @change="onWpModelChange"
          >
            <option value="">
              Default
            </option>
            <option
              v-for="m in wpModelOptions"
              :key="m.id"
              :value="m.id"
            >
              {{ m.label }}
            </option>
          </select>
        </div>
        <button
          v-if="settingsStore.weeklyPlanProvider === 'ollama'"
          class="refresh-models-btn"
          title="Refresh local models"
          @click="refreshOllamaModels()"
        >
          <RefreshCw :size="14" />
        </button>
      </div>
    </SettingsSection>

    <!-- TASK-1500: Smart Model Routing -->
    <SettingsSection title="Smart Model Routing">
      <p class="section-desc">
        Automatically route complex queries (planning, analysis) to a premium model via OpenRouter,
        while keeping simple chats on free providers.
      </p>

      <SettingsToggle
        label="Enable smart routing"
        :value="settingsStore.aiSmartRouting"
        @update="(v: boolean) => settingsStore.updateSetting('aiSmartRouting', v)"
      />

      <div v-if="settingsStore.aiSmartRouting" class="smart-routing-config">
        <div class="smart-routing-field">
          <label class="model-selector-label">Premium model (for complex queries)</label>
          <div class="model-select-wrapper">
            <select
              class="model-select"
              :value="settingsStore.aiPremiumModel"
              @change="(e: Event) => settingsStore.updateSetting('aiPremiumModel', (e.target as HTMLSelectElement).value)"
            >
              <option
                v-for="m in openrouterModels"
                :key="m.id"
                :value="m.id"
              >
                {{ m.label }}
              </option>
            </select>
          </div>
        </div>

        <div class="smart-routing-field">
          <label class="model-selector-label">Monthly budget</label>
          <div class="budget-input-row">
            <span class="budget-currency">$</span>
            <input
              class="budget-input"
              type="number"
              min="0"
              step="1"
              :value="(settingsStore.aiMonthlyBudgetCents / 100).toFixed(0)"
              @change="(e: Event) => settingsStore.updateSetting('aiMonthlyBudgetCents', Math.round(parseFloat((e.target as HTMLInputElement).value || '0') * 100))"
            />
            <span class="budget-hint">/ month (informational)</span>
          </div>
        </div>

        <p class="smart-routing-note">
          Simple queries (greetings, short questions) stay on Groq/Ollama.
          Complex queries (planning, analysis) escalate to the premium model above.
        </p>
      </div>
    </SettingsSection>

    <!-- Your Usage (top) -->
    <SettingsSection title="Your Usage">
      <!-- Period selector -->
      <div class="period-selector">
        <button
          v-for="period in periods"
          :key="period.id"
          class="period-btn"
          :class="{ active: selectedPeriod === period.id }"
          @click="selectedPeriod = period.id"
        >
          {{ period.label }}
        </button>
      </div>

      <div v-if="hasUsageData" class="usage-content">
        <!-- Summary cards -->
        <div class="summary-cards">
          <div
            v-for="stat in summaryStats"
            :key="stat.label"
            class="summary-card"
          >
            <div class="summary-icon">
              <component :is="stat.icon" :size="18" />
            </div>
            <div class="summary-info">
              <span class="summary-label">{{ stat.label }}</span>
              <span class="summary-value">{{ stat.value }}</span>
            </div>
          </div>
        </div>

        <!-- Provider breakdown -->
        <div v-if="currentUsage.providers.length > 0" class="provider-list">
          <div
            v-for="provider in currentUsage.providers"
            :key="provider.provider"
            class="provider-row"
          >
            <div class="provider-header">
              <div
                class="provider-indicator"
                :style="{ backgroundColor: getProviderColor(provider.provider) }"
              />
              <span class="provider-name">{{ provider.displayName }}</span>
              <span class="provider-cost">{{ formatCost(provider.estimatedCostUSD) }}</span>
            </div>
            <div class="provider-stats">
              <div class="provider-stat">
                <span class="stat-label">Tokens</span>
                <span class="stat-value">{{ formatNumber(provider.totalTokens) }}</span>
              </div>
              <div class="provider-stat">
                <span class="stat-label">Requests</span>
                <span class="stat-value">{{ formatNumber(provider.totalRequests) }}</span>
              </div>
            </div>

            <!-- Model breakdown within provider -->
            <div v-if="provider.models.length > 1" class="model-breakdown">
              <div
                v-for="model in provider.models"
                :key="model.model"
                class="model-row"
              >
                <span class="model-name">{{ model.model }}</span>
                <span class="model-tokens">{{ formatNumber(model.tokens) }} tok</span>
              </div>
            </div>
          </div>
        </div>
        <p v-else class="no-period-data">
          No usage in {{ currentUsage.periodLabel.toLowerCase() }}.
        </p>

        <!-- Clear button -->
        <button class="clear-btn" @click="handleClearUsageData">
          <Trash2 :size="14" />
          <span>Clear Usage Data</span>
        </button>
      </div>

      <div v-else class="no-usage">
        <Bot :size="28" />
        <p>No usage data yet. Start chatting with AI to track spending.</p>
      </div>
    </SettingsSection>

    <!-- Model Pricing Reference (always visible) -->
    <SettingsSection title="Model Pricing">
      <p class="section-desc">
        Rates per 1M tokens. Ollama runs locally (free). Cloud providers charge per token.
      </p>
      <div class="pricing-groups">
        <div
          v-for="group in pricingCatalog"
          :key="group.provider"
          class="pricing-group"
        >
          <div class="pricing-group-header">
            <div
              class="provider-indicator"
              :style="{ backgroundColor: getProviderColor(group.provider) }"
            />
            <span class="pricing-group-name">{{ group.displayName }}</span>
          </div>

          <table class="pricing-table">
            <thead>
              <tr>
                <th class="th-model">
                  Model
                </th>
                <th class="th-rate">
                  Input
                </th>
                <th class="th-rate">
                  Output
                </th>
                <th class="th-ctx">
                  Context
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="model in group.models"
                :key="model.model"
                :class="{ 'is-default': model.isDefault }"
              >
                <td class="td-model">
                  {{ model.displayName }}
                  <Tag v-if="model.isDefault" :size="10" class="default-tag" />
                </td>
                <td class="td-rate">
                  {{ formatRate(model.inputPer1M) }}
                </td>
                <td class="td-rate">
                  {{ formatRate(model.outputPer1M) }}
                </td>
                <td class="td-ctx">
                  {{ formatContext(model.contextWindow) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </SettingsSection>

    <SettingsSection title="AI Learning">
      <SettingsToggle
        label="Enable AI work profile learning"
        :value="settingsStore.aiLearningEnabled"
        @update="(v: boolean) => settingsStore.updateSetting('aiLearningEnabled', v)"
      />
      <p class="learning-hint">
        When enabled, FlowState tracks your work patterns to improve AI suggestions over time.
      </p>
    </SettingsSection>

    <SettingsSection title="Learned Patterns">
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-value">
            {{ profile?.avgWorkMinutesPerDay ? Math.round(profile.avgWorkMinutesPerDay) + ' min' : '—' }}
          </div>
          <div class="metric-label">
            Avg work/day
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-value">
            {{ profile?.avgTasksCompletedPerDay ? profile.avgTasksCompletedPerDay.toFixed(1) : '—' }}
          </div>
          <div class="metric-label">
            Avg tasks/day
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-value">
            {{ profile?.avgPlanAccuracy ? profile.avgPlanAccuracy.toFixed(0) + '%' : '—' }}
          </div>
          <div class="metric-label">
            Plan accuracy
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-value">
            {{ profile?.peakProductivityDays?.length ? profile.peakProductivityDays.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ') : '—' }}
          </div>
          <div class="metric-label">
            Peak days
          </div>
        </div>
      </div>

      <div class="wp-action-row">
        <button class="wp-action-btn" :disabled="isRecalculating" @click="onRecalculate">
          <RefreshCw :size="14" :class="{ spinning: isRecalculating }" />
          {{ isRecalculating ? 'Recalculating...' : 'Recalculate' }}
        </button>
        <button class="wp-action-btn danger" :disabled="isResetting" @click="onReset">
          <Trash2 :size="14" />
          {{ isResetting ? 'Resetting...' : 'Reset Profile' }}
        </button>
      </div>
    </SettingsSection>

    <!-- TASK-1356: Memory Health Quick Check -->
    <SettingsSection title="Memory Health">
      <div class="memory-health-summary">
        <!-- Last report or empty state -->
        <div v-if="lastMemoryReport" class="mh-result-row">
          <div class="mh-grade-badge" :style="{ borderColor: gradeColor(lastMemoryReport.grade), color: gradeColor(lastMemoryReport.grade) }">
            {{ lastMemoryReport.grade }}
          </div>
          <div class="mh-details">
            <span class="mh-score">{{ lastMemoryReport.overallScore }}/100</span>
            <span class="mh-meta">
              {{ lastMemoryReport.mode === 'fast' ? 'Quick' : 'Full' }}
              &middot;
              {{ new Date(lastMemoryReport.timestamp).toLocaleDateString() }}
            </span>
          </div>
          <div class="mh-sections-mini">
            <div
              v-for="section in lastMemoryReport.sections"
              :key="section.id"
              class="mh-section-dot"
              :title="`${section.name}: ${section.score}/100`"
              :style="{ backgroundColor: section.score >= 70 ? 'var(--brand-primary)' : section.score >= 45 ? 'var(--color-warning)' : 'var(--color-danger)' }"
            />
          </div>
        </div>
        <div v-else class="mh-empty">
          <HeartPulse :size="18" />
          <span>No assessment yet</span>
        </div>

        <!-- Progress indicator -->
        <div v-if="memoryHealthRunning" class="mh-progress">
          <div class="mh-progress-bar">
            <div class="mh-progress-fill" :style="{ width: memoryHealthProgress + '%' }" />
          </div>
          <span class="mh-progress-label">{{ memoryHealthCheck || 'Running...' }}</span>
        </div>

        <!-- Error -->
        <div v-if="memoryHealthError" class="mh-error">
          <AlertCircle :size="12" />
          {{ memoryHealthError }}
        </div>

        <!-- Action -->
        <button
          class="mh-run-btn"
          :disabled="memoryHealthRunning"
          @click="runFastAssessment()"
        >
          <HeartPulse :size="14" :class="{ spinning: memoryHealthRunning }" />
          {{ memoryHealthRunning ? 'Checking...' : 'Run Quick Check' }}
        </button>
        <p class="mh-hint">Full assessment available in AI Hub &gt; Memory tab.</p>

        <div class="ai-memory-debug" data-testid="ai-memory-debug">
          <div class="ai-memory-debug-header">
            <div>
              <strong>AI memory debug</strong>
              <span>{{ aiMemoryDebugSubtitle }}</span>
            </div>
            <div class="ai-memory-debug-actions">
              <button
                type="button"
                class="mh-run-btn compact"
                :disabled="aiMemoryDebugLoading || aiMemoryDebugClearing"
                @click="refreshAIMemoryDebug"
              >
                <RefreshCw :size="13" :class="{ spinning: aiMemoryDebugLoading }" />
                {{ aiMemoryDebugLoading ? 'Loading...' : 'Refresh' }}
              </button>
              <button
                type="button"
                class="mh-run-btn compact danger"
                :disabled="aiMemoryDebugLoading || aiMemoryDebugClearing"
                @click="clearAIMemoryDebugData"
              >
                <Trash2 :size="13" />
                {{ aiMemoryDebugClearing ? 'Clearing...' : 'Clear' }}
              </button>
            </div>
          </div>

          <div class="ai-memory-debug-counts">
            <div
              v-for="item in aiMemoryDebugCounts"
              :key="item.label"
              class="ai-memory-debug-count"
            >
              <span>{{ item.value }}</span>
              <small>{{ item.label }}</small>
            </div>
          </div>

          <div v-if="aiMemoryDebugError" class="mh-error">
            <AlertCircle :size="12" />
            {{ aiMemoryDebugError }}
          </div>

          <div
            v-if="!aiMemoryDebugError && aiMemoryDebug"
            class="ai-memory-debug-status"
            :data-status="aiMemoryDebug.schemaStatus"
          >
            {{ aiMemorySchemaStatusLabel }}
            <span v-if="aiMemoryDebug.pendingWriteCount > 0">
              · {{ aiMemoryDebug.pendingWriteCount }} queued write{{ aiMemoryDebug.pendingWriteCount === 1 ? '' : 's' }}
            </span>
            <small v-if="aiMemoryDebug.schemaMissingTables.length">
              Missing: {{ aiMemoryDebug.schemaMissingTables.join(', ') }}
            </small>
          </div>

          <div v-if="!aiMemoryDebugError && aiMemoryDebug" class="ai-memory-debug-list">
            <span
              v-for="entity in aiMemoryDebug.contextEntities.slice(0, 3)"
              :key="`entity:${entity.entityKey}`"
              class="detail-tag"
            >
              {{ entity.entityKey }}
            </span>
            <span
              v-for="belief in aiMemoryDebug.parameterBeliefs.slice(0, 3)"
              :key="`belief:${belief.entityKey}:${belief.parameterKey}`"
              class="detail-tag"
            >
              {{ belief.entityKey }} / {{ belief.parameterKey }} {{ Math.round(belief.confidence * 100) }}%
            </span>
            <span
              v-for="edge in aiMemoryDebug.contextEdges.slice(0, 3)"
              :key="`edge:${edge.sourceEntityKey}:${edge.targetEntityKey}:${edge.relationType}`"
              class="detail-tag"
            >
              {{ edge.sourceEntityKey }} {{ edge.relationType }} {{ edge.targetEntityKey }}
            </span>
            <span
              v-for="snapshot in aiMemoryDebug.memorySnapshots.slice(0, 3)"
              :key="`snapshot:${snapshot.snapshotKey}`"
              class="detail-tag"
            >
              {{ snapshot.snapshotKey }} · {{ snapshot.sourceEventCount }} events
            </span>
            <span
              v-for="event in aiMemoryEventLabel(aiMemoryDebug)"
              :key="`event:${event}`"
              class="detail-tag"
            >
              {{ event }}
            </span>
          </div>

          <p v-if="aiMemoryDebug && !aiMemoryDebug.contextEntities.length && !aiMemoryDebug.contextEdges.length && !aiMemoryDebug.parameterBeliefs.length && !aiMemoryDebug.memorySnapshots.length && !aiMemoryDebug.clarificationEvents.length" class="mh-hint">
            No server-backed AI memory rows yet, or the memory migration is not available for this user.
          </p>
        </div>
      </div>
    </SettingsSection>

    <SettingsSection title="Memory Observations">
      <p class="obs-hint">
        {{ profile?.memoryGraph?.length || 0 }} observations from your work patterns
      </p>

      <div v-if="profile?.memoryGraph?.length" class="obs-list">
        <div
          v-for="(obs, idx) in profile.memoryGraph"
          :key="idx"
          class="obs-card"
        >
          <div class="obs-header">
            <span class="obs-entity">{{ obs.entity }}</span>
            <span class="obs-relation">{{ obs.relation }}</span>
          </div>
          <div class="obs-value">
            {{ obs.value }}
          </div>
          <div class="obs-meta">
            <div class="confidence-bar">
              <div class="confidence-fill" :style="{ width: (obs.confidence * 100) + '%' }" />
            </div>
            <span class="obs-confidence">{{ (obs.confidence * 100).toFixed(0) }}%</span>
            <span class="obs-source">{{ obs.source }}</span>
          </div>
        </div>
      </div>
      <p v-else class="obs-empty">
        No observations yet. They'll appear as FlowState learns your patterns.
      </p>

      <div v-if="profile?.memoryGraph?.length" class="wp-action-row">
        <button class="wp-action-btn danger" :disabled="isClearingMemories" @click="onClearMemories">
          <Trash2 :size="14" />
          {{ isClearingMemories ? 'Clearing...' : 'Clear Memories' }}
        </button>
      </div>
    </SettingsSection>
  </div>
</template>

<style scoped>
.ai-settings-tab {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.section-desc {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: 0 0 var(--space-3) 0;
}

/* ── Provider & Model Selector ── */
.provider-chips {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.provider-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-0_5);
  padding: var(--space-2_5) var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  background: var(--glass-bg-soft);
  backdrop-filter: blur(8px);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
  text-align: start;
}

.provider-chip:hover {
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.provider-chip.active {
  background: var(--brand-primary-subtle);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.provider-chip-label {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
}

.provider-chip-desc {
  font-size: var(--text-xs);
  opacity: 0.7;
}

.model-selector {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.model-selector-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  white-space: nowrap;
}

.model-select-wrapper {
  flex: 1;
}

.model-select {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  cursor: pointer;
  backdrop-filter: blur(8px);
  appearance: auto;
}

.model-select:focus {
  outline: none;
  border-color: var(--brand-primary);
}

.refresh-models-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast);
  flex-shrink: 0;
}

.refresh-models-btn:hover {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.free-filter-btn {
  padding: var(--space-0_5) var(--space-2);
  font-size: 10px;
  font-weight: var(--font-semibold);
  letter-spacing: 0.03em;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast);
  flex-shrink: 0;
}

.free-filter-btn:hover {
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.free-filter-btn.active {
  background: var(--brand-bg-light);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

/* ── Pricing Reference ── */
.pricing-groups {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.pricing-group {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  backdrop-filter: blur(8px);
  overflow: hidden;
}

.pricing-group-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--glass-border);
}

.pricing-group-name {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.pricing-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-xs);
}

.pricing-table th {
  text-align: start;
  padding: var(--space-2) var(--space-3);
  color: var(--text-muted);
  font-weight: var(--font-medium);
  border-bottom: 1px solid var(--glass-border);
}

.th-rate, .th-ctx {
  text-align: end;
}

.pricing-table td {
  padding: var(--space-2) var(--space-3);
  color: var(--text-secondary);
  border-bottom: 1px solid var(--glass-border);
}

.pricing-table tr:last-child td {
  border-bottom: none;
}

.pricing-table tr.is-default td {
  color: var(--text-primary);
  font-weight: var(--font-medium);
}

.td-model {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.td-rate, .td-ctx {
  text-align: end;
  font-family: var(--font-mono, monospace);
}

.default-tag {
  color: var(--brand-primary);
  flex-shrink: 0;
}

/* ── Period Selector ── */
.period-selector {
  display: flex;
  gap: var(--space-1);
  background: var(--glass-bg-soft);
  border-radius: var(--radius-lg);
  padding: var(--space-1);
  border: 1px solid var(--glass-border);
}

.period-btn {
  flex: 1;
  padding: var(--space-1_5) var(--space-2);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.period-btn:hover {
  color: var(--text-secondary);
  background: var(--glass-bg-medium);
}

.period-btn.active {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  color: var(--text-primary);
}

/* ── Usage Content ── */
.usage-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
}

.summary-card {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(8px);
}

.summary-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-bg-medium);
  border-radius: var(--radius-md);
  color: var(--brand-primary);
  flex-shrink: 0;
}

.summary-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.summary-label {
  font-size: var(--text-2xs);
  color: var(--text-muted);
  font-weight: var(--font-medium);
}

.summary-value {
  font-size: var(--text-sm);
  font-weight: var(--font-bold);
  color: var(--text-primary);
}

/* ── Provider List ── */
.provider-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.provider-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(8px);
}

.provider-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.provider-indicator {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.provider-name {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  flex: 1;
}

.provider-cost {
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  color: var(--brand-primary);
  font-family: var(--font-mono, monospace);
}

.provider-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-2);
}

.provider-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: var(--text-2xs);
  color: var(--text-muted);
  font-weight: var(--font-medium);
}

.stat-value {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

/* ── Model Breakdown ── */
.model-breakdown {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding-top: var(--space-2);
  border-top: 1px solid var(--glass-border);
}

.model-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-1) var(--space-2);
  background: var(--glass-bg-medium);
  border-radius: var(--radius-sm);
}

.model-name {
  font-size: var(--text-2xs);
  color: var(--text-secondary);
  font-family: var(--font-mono, monospace);
}

.model-tokens {
  font-size: var(--text-2xs);
  color: var(--text-muted);
  font-family: var(--font-mono, monospace);
}

.no-period-data {
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-align: center;
  padding: var(--space-4);
  margin: 0;
}

/* ── No Usage State ── */
.no-usage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-6);
  color: var(--text-muted);
  text-align: center;
}

.no-usage p {
  margin: 0;
  font-size: var(--text-xs);
}

/* ── Clear Button ── */
.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-md);
  color: var(--color-danger);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
  backdrop-filter: blur(8px);
  align-self: flex-start;
}

.clear-btn:hover {
  background: var(--danger-bg-subtle);
}

/* ── Weekly Plan Settings ── */
.wp-setting-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) 0;
}

.wp-setting-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.day-chips,
.number-chips {
  display: flex;
  gap: var(--space-1_5);
  flex-wrap: wrap;
}

.day-chip,
.number-chip {
  padding: var(--space-1_5) var(--space-3);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-soft);
  backdrop-filter: blur(8px);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.day-chip:hover,
.number-chip:hover {
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.day-chip.active {
  background: var(--brand-bg-light);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.day-chip.off.active {
  background: var(--danger-bg-subtle);
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.day-chip.meeting.active {
  background: var(--orange-bg-light);
  border-color: var(--color-warning);
  color: var(--color-warning);
}

.number-chip {
  width: 40px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.number-chip.active {
  background: var(--brand-bg-light);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.style-chips {
  display: flex;
  gap: var(--space-2);
}

.style-chip {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-0_5);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-soft);
  backdrop-filter: blur(8px);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.style-chip:hover {
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.style-chip.active {
  background: var(--brand-bg-light);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.style-label {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
}

.style-desc {
  font-size: var(--text-xs);
  opacity: 0.7;
}

.save-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding-top: var(--space-3);
}

.save-btn {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  background: var(--glass-bg-soft);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-lg);
  color: var(--brand-primary);
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: all var(--duration-fast);
}

.save-btn:hover:not(:disabled) {
  background: var(--brand-bg-dim);
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.save-message {
  font-size: var(--text-sm);
  color: var(--brand-primary);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
}

.metric-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
}

.metric-value {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--text-primary);
}

.metric-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.wp-action-row {
  display: flex;
  gap: var(--space-3);
  padding-top: var(--space-2);
}

.wp-action-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1_5);
  padding: var(--space-1_5) var(--space-3);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.wp-action-btn:hover:not(:disabled) {
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.wp-action-btn.danger:hover:not(:disabled) {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.wp-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinning {
  animation: wp-spin 1s linear infinite;
}

@keyframes wp-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.learning-hint {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: 0;
  line-height: var(--leading-relaxed);
}

.obs-hint {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: 0 0 var(--space-3) 0;
}

.obs-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.obs-card {
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
}

.obs-header {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  margin-bottom: var(--space-1);
}

.obs-entity {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--brand-primary);
  background: var(--brand-bg-dim);
  padding: var(--space-0_5) var(--space-1_5);
  border-radius: var(--radius-xs);
}

.obs-relation {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.obs-value {
  font-size: var(--text-sm);
  color: var(--text-primary);
  margin-bottom: var(--space-1_5);
}

.obs-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.confidence-bar {
  flex: 1;
  max-width: 80px;
  height: 4px;
  background: var(--glass-bg);
  border-radius: var(--radius-xs);
  overflow: hidden;
}

.confidence-fill {
  height: 100%;
  background: var(--brand-primary);
  border-radius: var(--radius-xs);
  transition: width var(--duration-normal);
}

.obs-confidence {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  min-width: 32px;
}

.obs-source {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.obs-empty {
  font-size: var(--text-sm);
  color: var(--text-muted);
  font-style: italic;
  margin: 0;
}

/* ── TASK-1350: Groq API Key ── */
.settings-link {
  color: var(--brand-primary);
  text-decoration: none;
}
.settings-link:hover {
  text-decoration: underline;
}

.groq-key-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.groq-key-input-wrapper {
  display: flex;
  gap: var(--space-1_5);
}

.groq-key-input {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  font-family: var(--font-mono, monospace);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  backdrop-filter: blur(8px);
  transition: border-color var(--duration-fast);
}
.groq-key-input:focus {
  outline: none;
  border-color: var(--brand-primary);
}
.groq-key-input::placeholder {
  color: var(--text-muted);
  opacity: 0.5;
}

.key-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: all var(--duration-fast);
}
.key-toggle-btn:hover {
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.groq-key-actions {
  display: flex;
  gap: var(--space-2);
}

.groq-action-btn {
  padding: var(--space-1_5) var(--space-3);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: all var(--duration-fast);
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}
.groq-action-btn:hover:not(:disabled) {
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}
.groq-action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.groq-action-btn.save {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}
.groq-action-btn.danger:hover:not(:disabled) {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.groq-test-result {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}
.groq-test-result.success {
  background: var(--brand-primary-subtle);
  color: var(--brand-primary);
}
.groq-test-result.error {
  background: var(--danger-bg-subtle);
  color: var(--color-danger);
}
.groq-test-result.testing {
  background: var(--glass-bg-soft);
  color: var(--text-secondary);
}

.wizard-rerun-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: all var(--duration-fast);
}
.wizard-rerun-btn:hover {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

/* ── TASK-1356: Memory Health ── */
.memory-health-summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.mh-result-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(8px);
}

.mh-grade-badge {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  border: 2px solid;
  border-radius: var(--radius-md);
  background: var(--glass-bg-soft);
  flex-shrink: 0;
}

.mh-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-0_5);
  flex: 1;
  min-width: 0;
}

.mh-score {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.mh-meta {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.mh-sections-mini {
  display: flex;
  gap: var(--space-1);
  flex-shrink: 0;
}

.mh-section-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
}

.mh-empty {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.mh-progress {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.mh-progress-bar {
  height: 4px;
  background: var(--glass-bg);
  border-radius: var(--radius-xs);
  overflow: hidden;
}

.mh-progress-fill {
  height: 100%;
  background: var(--brand-primary);
  border-radius: var(--radius-xs);
  transition: width var(--duration-normal);
}

.mh-progress-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.mh-error {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  font-size: var(--text-xs);
  color: var(--color-danger);
}

.mh-run-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1_5);
  padding: var(--space-1_5) var(--space-3);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  background: var(--glass-bg-soft);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-sm);
  color: var(--brand-primary);
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: all var(--duration-fast);
  align-self: flex-start;
}

.mh-run-btn:hover:not(:disabled) {
  background: var(--brand-bg-dim);
}

.mh-run-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mh-run-btn.compact {
  padding: var(--space-1) var(--space-2);
}

.mh-run-btn.danger {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.mh-run-btn.danger:hover:not(:disabled) {
  background: rgba(var(--color-danger-rgb, 220, 38, 38), 0.1);
}

.mh-hint {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: 0;
}

.ai-memory-debug {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-bg-subtle);
}

.ai-memory-debug-header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  align-items: flex-start;
}

.ai-memory-debug-header strong {
  display: block;
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.ai-memory-debug-header span {
  display: block;
  color: var(--text-muted);
  font-size: var(--text-xs);
  margin-top: 2px;
}

.ai-memory-debug-actions {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
  justify-content: flex-end;
}

.ai-memory-debug-counts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(84px, 1fr));
  gap: var(--space-1_5);
}

.ai-memory-debug-count {
  padding: var(--space-2);
  border: 1px solid var(--glass-border-faint);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-soft);
}

.ai-memory-debug-count span {
  display: block;
  color: var(--text-primary);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
}

.ai-memory-debug-count small {
  color: var(--text-muted);
  font-size: var(--text-xs);
}

.ai-memory-debug-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.ai-memory-debug-status {
  color: var(--text-muted);
  font-size: var(--text-xs);
  line-height: 1.35;
}

.ai-memory-debug-status small {
  display: block;
  margin-top: 2px;
}

.ai-memory-debug-status[data-status='ready'] {
  color: var(--brand-primary);
}

.ai-memory-debug-status[data-status='partial'],
.ai-memory-debug-status[data-status='missing'] {
  color: var(--color-warning);
}

.detail-tag {
  display: inline-flex;
  max-width: 100%;
  padding: 2px var(--space-1_5);
  border: 1px solid var(--glass-border-faint);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  background: var(--glass-bg-soft);
  font-size: var(--text-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── TASK-1500: Smart Model Routing ── */
.smart-routing-config {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--glass-border);
}

.smart-routing-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1_5);
}

.budget-input-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.budget-currency {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-weight: var(--font-semibold);
}

.budget-input {
  width: 80px;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  backdrop-filter: blur(8px);
  transition: border-color var(--duration-fast);
}

.budget-input:focus {
  outline: none;
  border-color: var(--brand-primary);
}

.budget-hint {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.smart-routing-note {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: 0;
  line-height: var(--leading-relaxed);
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
}
</style>
