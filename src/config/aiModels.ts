/**
 * Centralized AI Model Registry
 * SINGLE SOURCE OF TRUTH for all AI model lists across the application.
 *
 * To add/remove a model: Update the arrays below, everything else updates automatically.
 */

export interface ModelEntry {
  id: string
  label: string
  shortLabel?: string // For badge display (defaults to label if not provided)
}

export type AIProviderKey = 'auto' | 'ollama' | 'groq' | 'openrouter'

export interface ProviderOption {
  key: AIProviderKey
  label: string
  desc: string
}

/**
 * Groq Models Registry
 */
export const GROQ_MODELS: ModelEntry[] = [
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', shortLabel: 'Llama 3.3 70B' },
  { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant', shortLabel: 'Llama 3.1 8B' },
  { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B', shortLabel: 'Mixtral 8x7B' },
  { id: 'gemma2-9b-it', label: 'Gemma 2 9B' }
]

/**
 * OpenRouter Models Registry
 */
export const OPENROUTER_MODELS: ModelEntry[] = [
  { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', shortLabel: 'Claude 3.5' },
  { id: 'anthropic/claude-opus-4-6', label: 'Claude Opus 4.6' },
  { id: 'openai/gpt-4o', label: 'GPT-4o' },
  { id: 'moonshotai/kimi-k2-instruct-0905', label: 'Kimi K2' },
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
  { id: 'meta-llama/llama-3.1-70b', label: 'Llama 3.1 70B', shortLabel: 'Llama 3.1 70B' },
  { id: 'mistralai/mistral-large', label: 'Mistral Large' },
  { id: 'google/gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { id: 'google/gemini-pro', label: 'Gemini Pro', shortLabel: 'Gemini Pro' }
]

/**
 * Default model per provider
 */
export const DEFAULT_MODELS = {
  ollama: 'llama3.2',
  groq: 'llama-3.3-70b-versatile',
  openrouter: 'moonshotai/kimi-k2-instruct-0905'
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

  // Fallback: return the ID itself
  return modelId
}

/**
 * Get default model for a given provider
 */
export function getDefaultModelForProvider(provider: 'ollama' | 'groq' | 'openrouter'): string {
  return DEFAULT_MODELS[provider]
}
