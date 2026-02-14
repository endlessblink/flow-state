<script setup lang="ts">
import { ref, computed } from 'vue'
import { Bot, DollarSign, MessageSquare, Zap, Trash2, Tag } from 'lucide-vue-next'
import { useAIUsageTracking, type UsagePeriod, type UsageSummary } from '@/composables/useAIUsageTracking'
import { useAIChatStore } from '@/stores/aiChat'
import SettingsSection from '../SettingsSection.vue'

const { usageSummary, weekUsage, monthUsage, hasUsageData, pricingCatalog } = useAIUsageTracking()
const aiChatStore = useAIChatStore()

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

/** Clear all usage data (clears metadata from messages) */
function handleClearUsageData() {
  if (!confirm('This will clear all AI usage tracking data. Continue?')) return
  for (const conversation of aiChatStore.conversations) {
    for (const message of conversation.messages) {
      if (message.metadata) {
        delete message.metadata
      }
    }
  }
}

/** Summary stats for the selected period */
const summaryStats = computed(() => [
  { label: 'Total Tokens', value: formatNumber(currentUsage.value.totalTokens), icon: Zap },
  { label: 'Requests', value: formatNumber(currentUsage.value.totalRequests), icon: MessageSquare },
  { label: 'Est. Cost', value: formatCost(currentUsage.value.totalCostUSD), icon: DollarSign }
])
</script>

<template>
  <div class="ai-settings-tab">
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
        <p v-else class="no-period-data">No usage in {{ currentUsage.periodLabel.toLowerCase() }}.</p>

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
                <th class="th-model">Model</th>
                <th class="th-rate">Input</th>
                <th class="th-rate">Output</th>
                <th class="th-ctx">Context</th>
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
                <td class="td-rate">{{ formatRate(model.inputPer1M) }}</td>
                <td class="td-rate">{{ formatRate(model.outputPer1M) }}</td>
                <td class="td-ctx">{{ formatContext(model.contextWindow) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
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
</style>
