/**
 * AI Usage Tracking Composable
 *
 * Aggregates token usage and cost data from AI chat conversations.
 * Computes per-provider and per-model usage statistics based on message metadata.
 *
 * @see TASK-1316 in MASTER_PLAN.md
 */

import { computed } from 'vue'
import { useAIChatStore } from '@/stores/aiChat'

// ============================================================================
// Types
// ============================================================================

/**
 * Usage stats for a specific model.
 */
export interface ModelUsage {
  /** Model identifier (e.g., 'llama3.2', 'llama-3.3-70b-versatile') */
  model: string
  /** Total tokens used by this model */
  tokens: number
  /** Number of requests made with this model */
  requests: number
  /** Estimated cost in USD for this model */
  costUSD: number
}

/**
 * Usage stats for a provider, including breakdown by model.
 */
export interface ProviderUsage {
  /** Provider identifier ('ollama', 'groq', 'openrouter') */
  provider: string
  /** Human-readable display name */
  displayName: string
  /** Total tokens across all models */
  totalTokens: number
  /** Total requests across all models */
  totalRequests: number
  /** Estimated total cost in USD */
  estimatedCostUSD: number
  /** Usage breakdown by model */
  models: ModelUsage[]
}

/**
 * Overall usage summary across all providers.
 */
export interface UsageSummary {
  /** Total tokens used across all providers */
  totalTokens: number
  /** Total requests across all providers */
  totalRequests: number
  /** Total estimated cost in USD */
  totalCostUSD: number
  /** Usage breakdown by provider */
  providers: ProviderUsage[]
  /** Time period label */
  periodLabel: string
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Pricing per provider (per 1M tokens).
 * Must match PROVIDER_PRICING in src/services/ai/router.ts
 */
const PROVIDER_PRICING: Record<string, { input: number; output: number }> = {
  ollama: { input: 0, output: 0 },           // Free (local)
  groq: { input: 0.59, output: 0.79 },       // Llama 3.3 70B pricing
  openrouter: { input: 3.00, output: 15.00 } // Claude 3.5 Sonnet via OpenRouter
}

/**
 * Display names for providers.
 */
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  ollama: 'Ollama (Local)',
  groq: 'Groq',
  openrouter: 'OpenRouter'
}

/**
 * Estimated input/output token ratio.
 * Since we only have total tokens (not split), we estimate:
 * - 30% input (prompt)
 * - 70% output (completion)
 */
const INPUT_RATIO = 0.3
const OUTPUT_RATIO = 0.7

// ============================================================================
// Model Pricing Catalog
// ============================================================================

/**
 * Pricing info for a single model.
 */
export interface ModelPricingInfo {
  /** Model identifier as used by the provider */
  model: string
  /** Human-readable model name */
  displayName: string
  /** Provider this model belongs to */
  provider: string
  /** Input cost per 1M tokens (USD) */
  inputPer1M: number
  /** Output cost per 1M tokens (USD) */
  outputPer1M: number
  /** Context window size in tokens */
  contextWindow: number
  /** Whether this is the default model for its provider in FlowState */
  isDefault?: boolean
}

/**
 * Full pricing catalog for all supported models.
 * Updated: February 2026
 * Sources: https://groq.com/pricing, https://openrouter.ai/pricing
 */
export const MODEL_PRICING_CATALOG: ModelPricingInfo[] = [
  // --- Ollama (Local, Free) ---
  {
    model: 'llama3.2',
    displayName: 'Llama 3.2 3B',
    provider: 'ollama',
    inputPer1M: 0,
    outputPer1M: 0,
    contextWindow: 128_000,
    isDefault: true
  },
  {
    model: 'llama3.1:8b',
    displayName: 'Llama 3.1 8B',
    provider: 'ollama',
    inputPer1M: 0,
    outputPer1M: 0,
    contextWindow: 128_000
  },
  {
    model: 'mistral',
    displayName: 'Mistral 7B',
    provider: 'ollama',
    inputPer1M: 0,
    outputPer1M: 0,
    contextWindow: 32_000
  },
  {
    model: 'gemma2',
    displayName: 'Gemma 2 9B',
    provider: 'ollama',
    inputPer1M: 0,
    outputPer1M: 0,
    contextWindow: 8_192
  },

  // --- Groq (Cloud, Fast Inference) ---
  // Source: https://groq.com/pricing (Feb 2026)
  {
    model: 'llama-3.3-70b-versatile',
    displayName: 'Llama 3.3 70B Versatile',
    provider: 'groq',
    inputPer1M: 0.59,
    outputPer1M: 0.79,
    contextWindow: 128_000,
    isDefault: true
  },
  {
    model: 'llama-3.1-8b-instant',
    displayName: 'Llama 3.1 8B Instant',
    provider: 'groq',
    inputPer1M: 0.05,
    outputPer1M: 0.08,
    contextWindow: 128_000
  },
  {
    model: 'llama-4-scout-17bx16e',
    displayName: 'Llama 4 Scout (17Bx16E)',
    provider: 'groq',
    inputPer1M: 0.11,
    outputPer1M: 0.34,
    contextWindow: 128_000
  },
  {
    model: 'llama-4-maverick-17bx128e',
    displayName: 'Llama 4 Maverick (17Bx128E)',
    provider: 'groq',
    inputPer1M: 0.20,
    outputPer1M: 0.60,
    contextWindow: 128_000
  },
  {
    model: 'qwen-3-32b',
    displayName: 'Qwen 3 32B',
    provider: 'groq',
    inputPer1M: 0.29,
    outputPer1M: 0.59,
    contextWindow: 131_000
  },

  // --- OpenRouter (Cloud, Premium Models) ---
  // Source: https://openrouter.ai/pricing (Feb 2026)
  {
    model: 'anthropic/claude-sonnet-4.5',
    displayName: 'Claude Sonnet 4.5',
    provider: 'openrouter',
    inputPer1M: 3.00,
    outputPer1M: 15.00,
    contextWindow: 200_000,
    isDefault: true
  },
  {
    model: 'anthropic/claude-sonnet-4',
    displayName: 'Claude Sonnet 4',
    provider: 'openrouter',
    inputPer1M: 3.00,
    outputPer1M: 15.00,
    contextWindow: 200_000
  },
  {
    model: 'anthropic/claude-opus-4',
    displayName: 'Claude Opus 4',
    provider: 'openrouter',
    inputPer1M: 15.00,
    outputPer1M: 75.00,
    contextWindow: 200_000
  },
  {
    model: 'openai/gpt-4o',
    displayName: 'GPT-4o',
    provider: 'openrouter',
    inputPer1M: 2.50,
    outputPer1M: 10.00,
    contextWindow: 128_000
  },
  {
    model: 'openai/gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    provider: 'openrouter',
    inputPer1M: 0.15,
    outputPer1M: 0.60,
    contextWindow: 128_000
  },
  {
    model: 'google/gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    provider: 'openrouter',
    inputPer1M: 0.10,
    outputPer1M: 0.40,
    contextWindow: 1_000_000
  },
  {
    model: 'deepseek/deepseek-v3',
    displayName: 'DeepSeek V3',
    provider: 'openrouter',
    inputPer1M: 0.30,
    outputPer1M: 0.88,
    contextWindow: 128_000
  }
]

// ============================================================================
// Composable
// ============================================================================

/**
 * AI Usage Tracking Composable.
 *
 * Aggregates usage data from all conversations' messages.
 * Returns reactive computed properties for usage stats.
 *
 * Usage:
 * ```typescript
 * const { usageSummary, providerUsageByProvider } = useAIUsageTracking()
 * ```
 */
/**
 * Time period for filtering usage data.
 */
export type UsagePeriod = 'week' | 'month' | 'all'

/**
 * Get the start-of-period Date for a given period.
 */
function getPeriodStart(period: UsagePeriod): Date | null {
  if (period === 'all') return null
  const now = new Date()
  if (period === 'week') {
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Monday start
    return new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0)
  }
  // month
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
}

/**
 * Pricing catalog grouped by provider for display.
 */
export interface ProviderPricingGroup {
  provider: string
  displayName: string
  models: ModelPricingInfo[]
}

/**
 * Get the pricing catalog grouped by provider.
 */
export function getPricingByProvider(): ProviderPricingGroup[] {
  const groups = new Map<string, ModelPricingInfo[]>()

  for (const model of MODEL_PRICING_CATALOG) {
    if (!groups.has(model.provider)) {
      groups.set(model.provider, [])
    }
    groups.get(model.provider)!.push(model)
  }

  const order = ['ollama', 'groq', 'openrouter']
  return order
    .filter(p => groups.has(p))
    .map(p => ({
      provider: p,
      displayName: PROVIDER_DISPLAY_NAMES[p] || p,
      models: groups.get(p)!
    }))
}

export function useAIUsageTracking() {
  const aiChatStore = useAIChatStore()

  /**
   * Aggregate usage from conversations, optionally filtered by time period.
   */
  function aggregateUsage(period: UsagePeriod): UsageSummary {
    const periodStart = getPeriodStart(period)

    const providerMap = new Map<string, {
      totalTokens: number
      totalRequests: number
      totalCost: number
      models: Map<string, { tokens: number; requests: number; cost: number }>
    }>()

    let totalMessages = 0
    let messagesWithMeta = 0
    for (const conversation of aiChatStore.conversations) {
      for (const message of conversation.messages) {
        totalMessages++
        if (!message.metadata?.provider || !message.metadata.tokens) continue
        messagesWithMeta++

        // Filter by time period
        if (periodStart) {
          const msgDate = message.timestamp instanceof Date
            ? message.timestamp
            : new Date(message.timestamp)
          if (msgDate < periodStart) continue
        }

        const { provider, model, tokens } = message.metadata

        if (!providerMap.has(provider)) {
          providerMap.set(provider, {
            totalTokens: 0,
            totalRequests: 0,
            totalCost: 0,
            models: new Map()
          })
        }

        const providerData = providerMap.get(provider)!
        providerData.totalTokens += tokens
        providerData.totalRequests += 1

        // Look up model-specific pricing from catalog, fall back to provider default
        const catalogEntry = MODEL_PRICING_CATALOG.find(
          m => m.model === model && m.provider === provider
        )
        const pricing = catalogEntry
          ? { input: catalogEntry.inputPer1M, output: catalogEntry.outputPer1M }
          : PROVIDER_PRICING[provider] || { input: 0, output: 0 }

        const inputTokens = Math.floor(tokens * INPUT_RATIO)
        const outputTokens = Math.floor(tokens * OUTPUT_RATIO)
        const inputCost = (inputTokens / 1_000_000) * pricing.input
        const outputCost = (outputTokens / 1_000_000) * pricing.output
        const messageCost = inputCost + outputCost

        providerData.totalCost += messageCost

        const modelKey = model || 'unknown'
        if (!providerData.models.has(modelKey)) {
          providerData.models.set(modelKey, { tokens: 0, requests: 0, cost: 0 })
        }

        const modelData = providerData.models.get(modelKey)!
        modelData.tokens += tokens
        modelData.requests += 1
        modelData.cost += messageCost
      }
    }

    const providers: ProviderUsage[] = Array.from(providerMap.entries()).map(([provider, data]) => {
      const models: ModelUsage[] = Array.from(data.models.entries()).map(([model, modelData]) => ({
        model,
        tokens: modelData.tokens,
        requests: modelData.requests,
        costUSD: modelData.cost
      }))
      models.sort((a, b) => b.tokens - a.tokens)

      return {
        provider,
        displayName: PROVIDER_DISPLAY_NAMES[provider] || provider,
        totalTokens: data.totalTokens,
        totalRequests: data.totalRequests,
        estimatedCostUSD: data.totalCost,
        models
      }
    })

    providers.sort((a, b) => b.totalTokens - a.totalTokens)

    const periodLabels: Record<UsagePeriod, string> = {
      week: 'This Week',
      month: 'This Month',
      all: 'All Time'
    }

    return {
      totalTokens: providers.reduce((s, p) => s + p.totalTokens, 0),
      totalRequests: providers.reduce((s, p) => s + p.totalRequests, 0),
      totalCostUSD: providers.reduce((s, p) => s + p.estimatedCostUSD, 0),
      providers,
      periodLabel: periodLabels[period]
    }
  }

  /** All time usage (reactive) */
  const usageSummary = computed<UsageSummary>(() => aggregateUsage('all'))

  /** This week usage (reactive) */
  const weekUsage = computed<UsageSummary>(() => aggregateUsage('week'))

  /** This month usage (reactive) */
  const monthUsage = computed<UsageSummary>(() => aggregateUsage('month'))

  /** Pricing catalog grouped by provider */
  const pricingCatalog = computed(() => getPricingByProvider())

  /** Check if there is any usage data */
  const hasUsageData = computed(() => usageSummary.value.totalTokens > 0)

  function getProviderUsage(provider: string): ProviderUsage | null {
    return usageSummary.value.providers.find(p => p.provider === provider) || null
  }

  return {
    usageSummary,
    weekUsage,
    monthUsage,
    hasUsageData,
    pricingCatalog,
    getProviderUsage
  }
}
