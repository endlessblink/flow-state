/**
 * Centralized AI Model Registry
 * SINGLE SOURCE OF TRUTH for all AI model lists across the application.
 *
 * To add/remove a model: Update the arrays below, everything else updates automatically.
 */

import type { AIModel, ModelCapability } from '@/services/ai/types'

export interface ModelEntry {
  id: string
  label: string
  shortLabel?: string // For badge display (defaults to label if not provided)
  description?: string
  contextLength?: number
  supportsStreaming?: boolean // defaults to true
  pricing?: { inputPer1M: number; outputPer1M: number }
}

export type AIProviderKey = 'auto' | 'ollama' | 'groq' | 'openrouter'

export interface ProviderOption {
  key: AIProviderKey
  label: string
  desc: string
}

// ============================================================================
// MODEL REGISTRIES
// ============================================================================

/**
 * Ollama Models Registry (local, free)
 */
export const OLLAMA_MODELS: ModelEntry[] = [
  { id: 'llama3.2', label: 'Llama 3.2 3B', description: 'Meta compact model', contextLength: 128_000, pricing: { inputPer1M: 0, outputPer1M: 0 } },
  { id: 'llama3.1:8b', label: 'Llama 3.1 8B', description: 'Meta efficient model', contextLength: 128_000, pricing: { inputPer1M: 0, outputPer1M: 0 } },
  { id: 'mistral', label: 'Mistral 7B', description: 'Mistral compact model', contextLength: 32_000, pricing: { inputPer1M: 0, outputPer1M: 0 } },
  { id: 'gemma2', label: 'Gemma 2 9B', description: 'Google open model', contextLength: 8_192, pricing: { inputPer1M: 0, outputPer1M: 0 } },
]

/**
 * Groq Models Registry
 */
export const GROQ_MODELS: ModelEntry[] = [
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', shortLabel: 'Llama 3.3 70B', description: 'Fast, high quality general purpose model', contextLength: 131_072, pricing: { inputPer1M: 0.59, outputPer1M: 0.79 } },
  { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant', shortLabel: 'Llama 3.1 8B', description: 'Ultra-fast, efficient model', contextLength: 131_072, pricing: { inputPer1M: 0.05, outputPer1M: 0.08 } },
  { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout', shortLabel: 'Llama 4 Scout', description: 'Llama 4 Scout MoE model (preview)', contextLength: 131_072, pricing: { inputPer1M: 0.11, outputPer1M: 0.34 } },
  { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', label: 'Llama 4 Maverick', shortLabel: 'Llama 4 Maverick', description: 'Llama 4 Maverick MoE model (preview)', contextLength: 131_072, pricing: { inputPer1M: 0.20, outputPer1M: 0.60 } },
  { id: 'qwen/qwen3-32b', label: 'Qwen 3 32B', shortLabel: 'Qwen 3 32B', description: 'Alibaba large language model (preview)', contextLength: 131_072, pricing: { inputPer1M: 0.29, outputPer1M: 0.59 } },
  { id: 'moonshotai/kimi-k2-instruct-0905', label: 'Kimi K2', shortLabel: 'Kimi K2', description: 'Moonshot AI MoE model (preview)', contextLength: 262_144, pricing: { inputPer1M: 1.00, outputPer1M: 3.00 } },
  { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', shortLabel: 'GPT-OSS 120B', description: 'OpenAI open-source 120B model', contextLength: 131_072, pricing: { inputPer1M: 0.15, outputPer1M: 0.60 } },
  { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B', shortLabel: 'GPT-OSS 20B', description: 'OpenAI open-source 20B model', contextLength: 131_072, pricing: { inputPer1M: 0.075, outputPer1M: 0.30 } },
]

/**
 * OpenRouter Models Registry
 */
export const OPENROUTER_MODELS: ModelEntry[] = [
  // Anthropic
  { id: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5', shortLabel: 'Claude 4.5', description: 'Anthropic flagship - fast and intelligent', contextLength: 1_000_000, pricing: { inputPer1M: 3.00, outputPer1M: 15.00 } },
  { id: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4', shortLabel: 'Claude S4', description: 'Anthropic balanced model', contextLength: 1_000_000, pricing: { inputPer1M: 3.00, outputPer1M: 15.00 } },
  { id: 'anthropic/claude-opus-4', label: 'Claude Opus 4', shortLabel: 'Opus 4', description: 'Anthropic most powerful model', contextLength: 200_000, pricing: { inputPer1M: 15.00, outputPer1M: 75.00 } },
  { id: 'anthropic/claude-opus-4.5', label: 'Claude Opus 4.5', shortLabel: 'Opus 4.5', description: 'Anthropic advanced reasoning', contextLength: 200_000, pricing: { inputPer1M: 5.00, outputPer1M: 25.00 } },
  { id: 'anthropic/claude-haiku-4.5', label: 'Claude Haiku 4.5', shortLabel: 'Haiku 4.5', description: 'Anthropic fast and cheap', contextLength: 200_000, pricing: { inputPer1M: 1.00, outputPer1M: 5.00 } },
  // OpenAI
  { id: 'openai/gpt-4o', label: 'GPT-4o', description: 'OpenAI flagship model', contextLength: 128_000, pricing: { inputPer1M: 2.50, outputPer1M: 10.00 } },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', shortLabel: 'GPT-4o Mini', description: 'OpenAI compact model', contextLength: 128_000, pricing: { inputPer1M: 0.15, outputPer1M: 0.60 } },
  // Google
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', shortLabel: 'Gemini 2.5 Flash', description: 'Google fast model', contextLength: 1_048_576, pricing: { inputPer1M: 0.30, outputPer1M: 2.50 } },
  { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', shortLabel: 'Gemini 2.5 Pro', description: 'Google premium model', contextLength: 1_048_576, pricing: { inputPer1M: 1.25, outputPer1M: 10.00 } },
  // Meta
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B', description: 'Meta open model', contextLength: 131_072, pricing: { inputPer1M: 0.10, outputPer1M: 0.32 } },
  { id: 'meta-llama/llama-4-scout', label: 'Llama 4 Scout', shortLabel: 'Llama 4 Scout', description: 'Meta Llama 4 MoE model', contextLength: 327_680, pricing: { inputPer1M: 0.08, outputPer1M: 0.30 } },
  { id: 'meta-llama/llama-4-maverick', label: 'Llama 4 Maverick', shortLabel: 'Llama 4 Maverick', description: 'Meta Llama 4 large MoE model', contextLength: 1_048_576, pricing: { inputPer1M: 0.15, outputPer1M: 0.60 } },
  // Mistral
  { id: 'mistralai/mistral-large-2512', label: 'Mistral Large 3', shortLabel: 'Mistral Large', description: 'Mistral flagship model', contextLength: 262_144, pricing: { inputPer1M: 0.50, outputPer1M: 1.50 } },
  // Moonshot
  { id: 'moonshotai/kimi-k2', label: 'Kimi K2', description: 'Moonshot AI MoE - strong tool calling and coding', contextLength: 131_072, pricing: { inputPer1M: 0.50, outputPer1M: 2.40 } },
  // DeepSeek
  { id: 'deepseek/deepseek-v3.2', label: 'DeepSeek V3.2', shortLabel: 'DeepSeek V3.2', description: 'DeepSeek latest model', contextLength: 163_840, pricing: { inputPer1M: 0.26, outputPer1M: 0.38 } },
  { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1', shortLabel: 'DeepSeek R1', description: 'DeepSeek reasoning model', contextLength: 64_000, pricing: { inputPer1M: 0.70, outputPer1M: 2.50 } },
]

/**
 * Default model per provider
 */
export const DEFAULT_MODELS = {
  ollama: 'llama3.2',
  groq: 'llama-3.3-70b-versatile',
  openrouter: 'anthropic/claude-sonnet-4.5'
} as const

/**
 * Provider options for selector UI
 */
export const PROVIDER_OPTIONS: ProviderOption[] = [
  { key: 'auto' as const, label: 'Auto', desc: 'Prefers local, falls back to cloud' },
  { key: 'ollama' as const, label: 'Local (Ollama)', desc: 'Free, private, runs on your machine' },
  { key: 'groq' as const, label: 'Groq', desc: 'Fast cloud inference' },
  { key: 'openrouter' as const, label: 'OpenRouter', desc: 'Premium models (Claude, GPT-4, Kimi)' }
] as const

// ============================================================================
// ADAPTER FUNCTIONS
// ============================================================================

/**
 * Convert model entries to { id, label } format (for AISettingsTab.vue)
 */
export function asIdLabel(models: ModelEntry[]): { id: string; label: string }[] {
  return models.map(m => ({ id: m.id, label: m.label }))
}

/**
 * Convert model entries to { value, label } format (for AIChatView.vue, AIChatPanel.vue)
 */
export function asValueLabel(models: ModelEntry[]): { value: string; label: string }[] {
  return models.map(m => ({ value: m.id, label: m.label }))
}

/**
 * Get display name for a model (for header badges)
 * Returns shortLabel if available, otherwise label, otherwise the ID
 */
export function getDisplayName(modelId: string): string {
  // Search in Groq models
  const groqModel = GROQ_MODELS.find(m => m.id === modelId)
  if (groqModel) {
    return groqModel.shortLabel || groqModel.label
  }

  // Search in OpenRouter models
  const openRouterModel = OPENROUTER_MODELS.find(m => m.id === modelId)
  if (openRouterModel) {
    return openRouterModel.shortLabel || openRouterModel.label
  }

  // Search in Ollama models
  const ollamaModel = OLLAMA_MODELS.find(m => m.id === modelId)
  if (ollamaModel) {
    return ollamaModel.shortLabel || ollamaModel.label
  }

  // Fallback: return the ID itself
  return modelId
}

/**
 * Get default model for a given provider
 */
export function getDefaultModelForProvider(provider: 'ollama' | 'groq' | 'openrouter'): string {
  return DEFAULT_MODELS[provider]
}

/**
 * Convert ModelEntry[] to AIModel[] for proxy providers.
 */
export function toAIModels(models: ModelEntry[]): AIModel[] {
  return models.map(m => ({
    id: m.id,
    name: m.label,
    description: m.description,
    contextLength: m.contextLength,
    supportsStreaming: m.supportsStreaming ?? true,
    capabilities: ['chat', 'completion'] as ModelCapability[],
  }))
}

/**
 * Get the default pricing for a provider (based on its default model).
 * Used by router.ts for cost tracking.
 */
export function getDefaultPricing(provider: 'ollama' | 'groq' | 'openrouter'): { input: number; output: number } {
  const modelArrays: Record<string, ModelEntry[]> = {
    ollama: OLLAMA_MODELS,
    groq: GROQ_MODELS,
    openrouter: OPENROUTER_MODELS,
  }
  const models = modelArrays[provider]
  const defaultId = DEFAULT_MODELS[provider]
  const defaultModel = models.find(m => m.id === defaultId)
  if (defaultModel?.pricing) {
    return { input: defaultModel.pricing.inputPer1M, output: defaultModel.pricing.outputPer1M }
  }
  return { input: 0, output: 0 }
}
