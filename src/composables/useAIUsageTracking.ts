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
export function useAIUsageTracking() {
  const aiChatStore = useAIChatStore()

  /**
   * Compute usage summary from all conversations.
   */
  const usageSummary = computed<UsageSummary>(() => {
    // Aggregate data from all conversations
    const providerMap = new Map<string, {
      totalTokens: number
      totalRequests: number
      totalCost: number
      models: Map<string, { tokens: number; requests: number; cost: number }>
    }>()

    // Iterate all conversations and their messages
    for (const conversation of aiChatStore.conversations) {
      for (const message of conversation.messages) {
        // Only count messages with metadata (AI responses)
        if (!message.metadata?.provider || !message.metadata.tokens) continue

        const { provider, model, tokens } = message.metadata

        // Get or create provider entry
        if (!providerMap.has(provider)) {
          providerMap.set(provider, {
            totalTokens: 0,
            totalRequests: 0,
            totalCost: 0,
            models: new Map()
          })
        }

        const providerData = providerMap.get(provider)!

        // Update provider totals
        providerData.totalTokens += tokens
        providerData.totalRequests += 1

        // Calculate cost for this message
        const pricing = PROVIDER_PRICING[provider] || { input: 0, output: 0 }
        const inputTokens = Math.floor(tokens * INPUT_RATIO)
        const outputTokens = Math.floor(tokens * OUTPUT_RATIO)
        const inputCost = (inputTokens / 1_000_000) * pricing.input
        const outputCost = (outputTokens / 1_000_000) * pricing.output
        const messageCost = inputCost + outputCost

        providerData.totalCost += messageCost

        // Update model stats
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

    // Convert map to array of ProviderUsage
    const providers: ProviderUsage[] = Array.from(providerMap.entries()).map(([provider, data]) => {
      // Convert model map to array
      const models: ModelUsage[] = Array.from(data.models.entries()).map(([model, modelData]) => ({
        model,
        tokens: modelData.tokens,
        requests: modelData.requests,
        costUSD: modelData.cost
      }))

      // Sort models by tokens (highest first)
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

    // Sort providers by total tokens (highest first)
    providers.sort((a, b) => b.totalTokens - a.totalTokens)

    // Calculate totals
    const totalTokens = providers.reduce((sum, p) => sum + p.totalTokens, 0)
    const totalRequests = providers.reduce((sum, p) => sum + p.totalRequests, 0)
    const totalCostUSD = providers.reduce((sum, p) => sum + p.estimatedCostUSD, 0)

    return {
      totalTokens,
      totalRequests,
      totalCostUSD,
      providers,
      periodLabel: 'All Time'
    }
  })

  /**
   * Get usage for a specific provider.
   */
  function getProviderUsage(provider: string): ProviderUsage | null {
    return usageSummary.value.providers.find(p => p.provider === provider) || null
  }

  /**
   * Check if there is any usage data.
   */
  const hasUsageData = computed(() => {
    return usageSummary.value.totalTokens > 0
  })

  return {
    usageSummary,
    hasUsageData,
    getProviderUsage
  }
}
