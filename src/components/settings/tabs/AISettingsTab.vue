<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Bot, DollarSign, MessageSquare, Zap, Trash2, Tag, RefreshCw } from 'lucide-vue-next'
import { useAIUsageTracking, type UsagePeriod, type UsageSummary } from '@/composables/useAIUsageTracking'
import { useAIChat } from '@/composables/useAIChat'
import { useAIChatStore } from '@/stores/aiChat'
import { useWorkProfile } from '@/composables/useWorkProfile'
import { useSettingsStore } from '@/stores/settings'
import SettingsSection from '../SettingsSection.vue'
import SettingsToggle from '../SettingsToggle.vue'

const { usageSummary, weekUsage, monthUsage, hasUsageData, pricingCatalog, clearUsageData } = useAIUsageTracking()
const aiChatStore = useAIChatStore()
const settingsStore = useSettingsStore()
const { profile, loadProfile, savePreferences, computeCapacityMetrics, resetLearnedData } = useWorkProfile()

// ── Default Provider/Model ──
const {
  selectedProvider,
  selectedModel,
  availableOllamaModels,
  setProvider,
  setModel,
  refreshOllamaModels,
} = useAIChat()

type ProviderOption = 'auto' | 'ollama' | 'groq' | 'openrouter'

const providerOptions: { key: ProviderOption; label: string; desc: string }[] = [
  { key: 'auto', label: 'Auto', desc: 'Prefers local, falls back to cloud' },
  { key: 'ollama', label: 'Local (Ollama)', desc: 'Free, private, runs on your machine' },
  { key: 'groq', label: 'Groq', desc: 'Fast cloud inference' },
  { key: 'openrouter', label: 'OpenRouter', desc: 'Premium models (Claude, GPT-4, Kimi)' },
]

const groqModels = [
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
  { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
  { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
  { id: 'gemma2-9b-it', label: 'Gemma 2 9B' },
]

const openrouterModels = [
  { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
  { id: 'anthropic/claude-opus-4-6', label: 'Claude Opus 4.6' },
  { id: 'openai/gpt-4o', label: 'GPT-4o' },
  { id: 'moonshotai/kimi-k2-instruct-0905', label: 'Kimi K2' },
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
  { id: 'mistralai/mistral-large', label: 'Mistral Large' },
  { id: 'google/gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
]

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

function onProviderChange(provider: ProviderOption) {
  setProvider(provider)
}

function onModelChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  setModel(value || null)
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

// ── Weekly Plan Settings ──
const isSaving = ref(false)
const isRecalculating = ref(false)
const isResetting = ref(false)
const saveMessage = ref('')
const isClearingMemories = ref(false)

const form = ref({
  workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as string[],
  daysOff: [] as string[],
  heavyMeetingDays: [] as string[],
  maxTasksPerDay: 6,
  preferredWorkStyle: 'balanced' as 'frontload' | 'balanced' | 'backload',
})

const dayOptions = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
]

const workStyleOptions = [
  { key: 'frontload' as const, label: 'Front-load', desc: 'Heavy Mon-Tue, lighter Thu-Fri' },
  { key: 'balanced' as const, label: 'Balanced', desc: 'Even distribution across days' },
  { key: 'backload' as const, label: 'Back-load', desc: 'Lighter Mon-Tue, heavier Thu-Fri' },
]

onMounted(async () => {
  const p = await loadProfile()
  if (p) {
    form.value.workDays = [...p.workDays]
    form.value.daysOff = [...p.daysOff]
    form.value.heavyMeetingDays = [...p.heavyMeetingDays]
    form.value.maxTasksPerDay = p.maxTasksPerDay
    form.value.preferredWorkStyle = p.preferredWorkStyle
  }
})

function toggleDay(list: string[], key: string) {
  const idx = list.indexOf(key)
  if (idx === -1) list.push(key)
  else list.splice(idx, 1)
}

async function onSave() {
  isSaving.value = true
  saveMessage.value = ''
  try {
    await savePreferences({
      workDays: [...form.value.workDays],
      daysOff: [...form.value.daysOff],
      heavyMeetingDays: [...form.value.heavyMeetingDays],
      maxTasksPerDay: form.value.maxTasksPerDay,
      preferredWorkStyle: form.value.preferredWorkStyle,
    })
    saveMessage.value = 'Preferences saved!'
    setTimeout(() => { saveMessage.value = '' }, 3000)
  } catch {
    saveMessage.value = 'Failed to save'
  } finally {
    isSaving.value = false
  }
}

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
    await savePreferences({ memoryGraph: [] } as any)
  } finally {
    isClearingMemories.value = false
  }
}
</script>

<template>
  <div class="ai-settings-tab">
    <!-- Default Provider & Model -->
    <SettingsSection title="Default Provider & Model">
      <p class="section-desc">
        Choose which AI provider and model to use by default. This applies to all new chat sessions.
      </p>

      <!-- Provider selector -->
      <div class="provider-chips">
        <button
          v-for="opt in providerOptions"
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
            <option value="">Default</option>
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
          @click="refreshOllamaModels()"
          title="Refresh local models"
        >
          <RefreshCw :size="14" />
        </button>
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

    <!-- Weekly Plan Settings (merged from WeeklyPlanSettingsTab) -->
    <SettingsSection title="AI Learning">
      <SettingsToggle
        label="Enable AI work profile learning"
        :value="settingsStore.aiLearningEnabled"
        @update="(v: boolean) => settingsStore.updateSetting('aiLearningEnabled', v)"
      />
      <p class="learning-hint">
        When enabled, FlowState tracks your work patterns to make weekly plans smarter over time.
      </p>
    </SettingsSection>

    <SettingsSection title="Planning Preferences">
      <div class="wp-setting-row">
        <label class="wp-setting-label">Work days</label>
        <div class="day-chips">
          <button
            v-for="d in dayOptions"
            :key="d.key"
            class="day-chip"
            :class="{ active: form.workDays.includes(d.key) }"
            @click="toggleDay(form.workDays, d.key)"
          >
            {{ d.label }}
          </button>
        </div>
      </div>

      <div class="wp-setting-row">
        <label class="wp-setting-label">Days off</label>
        <div class="day-chips">
          <button
            v-for="d in dayOptions"
            :key="d.key"
            class="day-chip off"
            :class="{ active: form.daysOff.includes(d.key) }"
            @click="toggleDay(form.daysOff, d.key)"
          >
            {{ d.label }}
          </button>
        </div>
      </div>

      <div class="wp-setting-row">
        <label class="wp-setting-label">Heavy meeting days</label>
        <div class="day-chips">
          <button
            v-for="d in dayOptions"
            :key="d.key"
            class="day-chip meeting"
            :class="{ active: form.heavyMeetingDays.includes(d.key) }"
            @click="toggleDay(form.heavyMeetingDays, d.key)"
          >
            {{ d.label }}
          </button>
        </div>
      </div>

      <div class="wp-setting-row">
        <label class="wp-setting-label">Max tasks per day</label>
        <div class="number-chips">
          <button
            v-for="n in [3, 5, 6, 8, 10]"
            :key="n"
            class="number-chip"
            :class="{ active: form.maxTasksPerDay === n }"
            @click="form.maxTasksPerDay = n"
          >
            {{ n }}
          </button>
        </div>
      </div>

      <div class="wp-setting-row">
        <label class="wp-setting-label">Work style</label>
        <div class="style-chips">
          <button
            v-for="ws in workStyleOptions"
            :key="ws.key"
            class="style-chip"
            :class="{ active: form.preferredWorkStyle === ws.key }"
            @click="form.preferredWorkStyle = ws.key"
          >
            <span class="style-label">{{ ws.label }}</span>
            <span class="style-desc">{{ ws.desc }}</span>
          </button>
        </div>
      </div>

      <div class="save-row">
        <button class="save-btn" :disabled="isSaving" @click="onSave">
          {{ isSaving ? 'Saving...' : 'Save Preferences' }}
        </button>
        <span v-if="saveMessage" class="save-message">{{ saveMessage }}</span>
      </div>
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
  text-align: left;
}

.provider-chip:hover {
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.provider-chip.active {
  background: rgba(78, 205, 196, 0.1);
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
  text-align: left;
  padding: var(--space-2) var(--space-3);
  color: var(--text-muted);
  font-weight: var(--font-medium);
  border-bottom: 1px solid var(--glass-border);
}

.th-rate, .th-ctx {
  text-align: right;
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
  text-align: right;
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
  font-size: 10px;
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
  font-size: 10px;
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
  font-size: 10px;
  color: var(--text-secondary);
  font-family: var(--font-mono, monospace);
}

.model-tokens {
  font-size: 10px;
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
  background: rgba(78, 205, 196, 0.12);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.day-chip.off.active {
  background: rgba(239, 68, 68, 0.12);
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.day-chip.meeting.active {
  background: rgba(245, 158, 11, 0.12);
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
  background: rgba(78, 205, 196, 0.12);
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
  background: rgba(78, 205, 196, 0.12);
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
  background: rgba(78, 205, 196, 0.08);
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
  background: rgba(78, 205, 196, 0.08);
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
  border-radius: 2px;
  overflow: hidden;
}

.confidence-fill {
  height: 100%;
  background: var(--brand-primary);
  border-radius: 2px;
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
</style>
