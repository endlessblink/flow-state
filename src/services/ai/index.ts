/**
 * AI Services Module
 *
 * Unified AI provider system supporting multiple backends:
 * - Ollama (local inference)
 * - OpenAI (cloud, future)
 * - Groq (cloud, future)
 *
 * @see ROAD-011 in MASTER_PLAN.md
 */

// Types
export type {
  AIProvider,
  AIProviderType,
  AIModel,
  ChatMessage,
  MessageRole,
  GenerateOptions,
  GenerateResponse,
  StreamChunk,
  ProviderHealthStatus,
  ProviderConnectionStatus,
  AIProviderEvent,
  AIProviderEventListener,
  ModelCapability,
  BaseProviderConfig,
  OllamaConfig,
  OpenAIConfig,
  GroqConfig,
  AIServiceConfig,
} from './types'

// Default configs
export {
  DEFAULT_OLLAMA_CONFIG,
  DEFAULT_AI_SERVICE_CONFIG,
} from './types'

// Providers
export {
  OllamaProvider,
  createOllamaProvider,
  autoDetectOllama,
} from './providers'
