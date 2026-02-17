/**
 * AI Usage Tracking Composable
 *
 * Aggregates token usage and cost data from AI chat conversations.
 * Computes per-provider and per-model usage statistics based on message metadata.
 *
 * @see TASK-1316 in MASTER_PLAN.md
 */

import { computed } from 'vue'
import { getUsageEntries, clearUsageEntries } from '@/services/ai/usageTracker'
import { OLLAMA_MODELS, GROQ_MODELS, OPENROUTER_MODELS, DEFAULT_MODELS, type ModelEntry } from '@/config/aiModels'

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
 * Derive provider-level pricing from registry's default models.
 */
function getProviderPricing(): Record<string, { input: number; output: number }> {
  const result: Record<string, { input: number; output: number }> = {}
  const providerModels: Record<string, ModelEntry[]> = {
    ollama: OLLAMA_MODELS,
    groq: GROQ_MODELS,
    openrouter: OPENROUTER_MODELS,
  }
  for (const [provider, models] of Object.entries(providerModels)) {
    const defaultId = DEFAULT_MODELS[provider as keyof typeof DEFAULT_MODELS]
    const defaultModel = models.find(m => m.id === defaultId)
    result[provider] = defaultModel?.pricing
      ? { input: defaultModel.pricing.inputPer1M, output: defaultModel.pricing.outputPer1M }
      : { input: 0, output: 0 }
  }
  return result
}

const PROVIDER_PRICING = getProviderPricing()

/**
 * Display names for providers.
 */
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  ollama: 'Ollama (Local)',
  groq: 'Groq',
  openrouter: 'OpenRouter'
}


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
 * Build pricing catalog from centralized model registry.
 * Updated: February 2026
 */
function buildPricingCatalog(): ModelPricingInfo[] {
  const catalog: ModelPricingInfo[] = []

  const providerModels: [string, ModelEntry[]][] = [
    ['ollama', OLLAMA_MODELS],
    ['groq', GROQ_MODELS],
    ['openrouter', OPENROUTER_MODELS],
  ]

  for (const [provider, models] of providerModels) {
    const defaultId = DEFAULT_MODELS[provider as keyof typeof DEFAULT_MODELS]
    for (const model of models) {
      if (model.pricing) {
        catalog.push({
          model: model.id,
          displayName: model.label,
          provider,
          inputPer1M: model.pricing.inputPer1M,
          outputPer1M: model.pricing.outputPer1M,
          contextWindow: model.contextLength ?? 0,
          isDefault: model.id === defaultId,
        })
      }
    }
  }

  return catalog
}

export const MODEL_PRICING_CATALOG: ModelPricingInfo[] = buildPricingCatalog()

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
  const entries = getUsageEntries()

  /**
   * Aggregate usage from the centralized tracker, optionally filtered by time period.
   * Reads from the router-level usage log — captures ALL AI calls (chat, weekly plan,
   * task assist, gamification, and any future AI consumer).
   */
  function aggregateUsage(period: UsagePeriod): UsageSummary {
    const periodStart = getPeriodStart(period)

    const providerMap = new Map<string, {
      totalTokens: number
      totalRequests: number
      totalCost: number
      models: Map<string, { tokens: number; requests: number; cost: number }>
    }>()

    for (const entry of entries.value) {
      // Filter by time period
      if (periodStart) {
        const entryDate = new Date(entry.timestamp)
        if (entryDate < periodStart) continue
      }

      const { provider, model, inputTokens, outputTokens } = entry
      const totalTokens = inputTokens + outputTokens

      if (!providerMap.has(provider)) {
        providerMap.set(provider, {
          totalTokens: 0,
          totalRequests: 0,
          totalCost: 0,
          models: new Map()
        })
      }

      const providerData = providerMap.get(provider)!
      providerData.totalTokens += totalTokens
      providerData.totalRequests += 1

      // Look up model-specific pricing from catalog, fall back to provider default
      const catalogEntry = MODEL_PRICING_CATALOG.find(
        m => m.model === model && m.provider === provider
      )
      const pricing = catalogEntry
        ? { input: catalogEntry.inputPer1M, output: catalogEntry.outputPer1M }
        : PROVIDER_PRICING[provider] || { input: 0, output: 0 }

      const inputCost = (inputTokens / 1_000_000) * pricing.input
      const outputCost = (outputTokens / 1_000_000) * pricing.output
      const entryCost = inputCost + outputCost

      providerData.totalCost += entryCost

      const modelKey = model || 'unknown'
      if (!providerData.models.has(modelKey)) {
        providerData.models.set(modelKey, { tokens: 0, requests: 0, cost: 0 })
      }

      const modelData = providerData.models.get(modelKey)!
      modelData.tokens += totalTokens
      modelData.requests += 1
      modelData.cost += entryCost
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
    getProviderUsage,
    clearUsageData: clearUsageEntries
  }
}
