<script setup lang="ts">
import { computed } from 'vue'
import { Bot, DollarSign, MessageSquare, Zap, Trash2 } from 'lucide-vue-next'
import { useAIUsageTracking } from '@/composables/useAIUsageTracking'
import { useAIChatStore } from '@/stores/aiChat'
import SettingsSection from '../SettingsSection.vue'

const { usageSummary, hasUsageData } = useAIUsageTracking()
const aiChatStore = useAIChatStore()

/**
 * Format large numbers with commas (e.g., 1234567 -> "1,234,567")
 */
function formatNumber(num: number): string {
  return num.toLocaleString('en-US')
}

/**
 * Format cost as USD currency (e.g., 1.23 -> "$1.23")
 */
function formatCost(cost: number): string {
  if (cost === 0) return 'Free'
  return `$${cost.toFixed(4)}`
}

/**
 * Get color indicator for provider.
 */
function getProviderColor(provider: string): string {
  switch (provider) {
    case 'ollama':
      return 'var(--color-success)'
    case 'groq':
      return 'var(--color-info)'
    case 'openrouter':
      return 'var(--color-warning)'
    default:
      return 'var(--text-muted)'
  }
}

/**
 * Clear all usage data (clears metadata from messages).
 */
async function handleClearUsageData() {
  if (!confirm('This will clear all AI usage tracking data. Continue?')) return

  // Iterate all conversations and clear metadata
  for (const conversation of aiChatStore.conversations) {
    for (const message of conversation.messages) {
      if (message.metadata) {
        delete message.metadata
      }
    }
  }

  alert('Usage data cleared successfully!')
}

/**
 * Compute summary stats for display.
 */
const summaryStats = computed(() => [
  {
    label: 'Total Tokens',
    value: formatNumber(usageSummary.value.totalTokens),
    icon: Zap
  },
  {
    label: 'Total Requests',
    value: formatNumber(usageSummary.value.totalRequests),
    icon: MessageSquare
  },
  {
    label: 'Estimated Cost',
    value: formatCost(usageSummary.value.totalCostUSD),
    icon: DollarSign
  }
])
</script>

<template>
  <div class="ai-settings-tab">
    <!-- Usage Overview -->
    <SettingsSection title="📊 Usage Overview">
      <div v-if="hasUsageData" class="summary-cards">
        <div
          v-for="stat in summaryStats"
          :key="stat.label"
          class="summary-card"
        >
          <div class="summary-icon">
            <component :is="stat.icon" :size="20" />
          </div>
          <div class="summary-info">
            <span class="summary-label">{{ stat.label }}</span>
            <span class="summary-value">{{ stat.value }}</span>
          </div>
        </div>
      </div>
      <div v-else class="no-usage">
        <Bot :size="32" />
        <p>No AI usage data yet. Start chatting to see stats!</p>
      </div>
    </SettingsSection>

    <!-- Provider Breakdown -->
    <SettingsSection v-if="hasUsageData" title="🤖 Provider Breakdown">
      <div class="provider-list">
        <div
          v-for="provider in usageSummary.providers"
          :key="provider.provider"
          class="provider-row"
        >
          <div class="provider-header">
            <div
              class="provider-indicator"
              :style="{ backgroundColor: getProviderColor(provider.provider) }"
            />
            <span class="provider-name">{{ provider.displayName }}</span>
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
            <div class="provider-stat">
              <span class="stat-label">Cost</span>
              <span class="stat-value">{{ formatCost(provider.estimatedCostUSD) }}</span>
            </div>
          </div>

          <!-- Model breakdown -->
          <div v-if="provider.models.length > 0" class="model-breakdown">
            <div
              v-for="model in provider.models"
              :key="model.model"
              class="model-row"
            >
              <span class="model-name">{{ model.model }}</span>
              <span class="model-tokens">{{ formatNumber(model.tokens) }} tokens</span>
            </div>
          </div>
        </div>
      </div>
    </SettingsSection>

    <!-- Actions -->
    <SettingsSection v-if="hasUsageData" title="⚙️ Actions">
      <div class="actions-panel">
        <p class="actions-description">
          Clear all tracked usage data. This will not affect your conversations, only the metadata used for tracking.
        </p>
        <button class="clear-btn" @click="handleClearUsageData">
          <Trash2 :size="16" />
          <span>Clear Usage Data</span>
        </button>
      </div>
    </SettingsSection>
  </div>
</template>

<style scoped>
.ai-settings-tab {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* Summary Cards */
.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-3);
}

.summary-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  backdrop-filter: blur(8px);
}

.summary-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-bg-medium);
  border-radius: var(--radius-lg);
  color: var(--brand-primary);
}

.summary-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.summary-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-weight: var(--font-medium);
}

.summary-value {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--text-primary);
}

/* No Usage State */
.no-usage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8);
  color: var(--text-muted);
  text-align: center;
}

.no-usage p {
  margin: 0;
  font-size: var(--text-sm);
}

/* Provider List */
.provider-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.provider-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  backdrop-filter: blur(8px);
}

.provider-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.provider-indicator {
  width: 12px;
  height: 12px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.provider-name {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.provider-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: var(--space-3);
}

.provider-stat {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.stat-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-weight: var(--font-medium);
}

.stat-value {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

/* Model Breakdown */
.model-breakdown {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--glass-border);
}

.model-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2);
  background: var(--glass-bg-medium);
  border-radius: var(--radius-md);
}

.model-name {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-weight: var(--font-medium);
  font-family: var(--font-mono, monospace);
}

.model-tokens {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* Actions Panel */
.actions-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.actions-description {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2_5) var(--space-4);
  background: var(--glass-bg-soft);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-md);
  color: var(--color-danger);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
  backdrop-filter: blur(8px);
}

.clear-btn:hover {
  background: var(--danger-bg-subtle, rgba(239, 68, 68, 0.1));
  transform: translateY(-1px);
}

.clear-btn:active {
  transform: translateY(0);
}
</style>
