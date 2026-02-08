/**
 * AI Services Module
 *
 * Unified AI provider system supporting multiple backends:
 * - Ollama (local inference)
 * - Groq (direct + proxy via Supabase Edge Function)
 * - OpenRouter (proxy via Supabase Edge Function)
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
  GroqProvider,
  createGroqProvider,
  autoDetectGroq,
  GroqProxyProvider,
  createGroqProxyProvider,
  OpenRouterProxyProvider,
  createOpenRouterProxyProvider,
} from './providers'

// Router
export {
  AIRouter,
  createAIRouter,
  DEFAULT_ROUTER_CONFIG,
} from './router'

export type {
  TaskType,
  RouterProviderType,
  RouterConfig,
  RouterOptions,
  ProviderCostTracking,
} from './router'

// TASK-1186: Tauri HTTP utilities for CORS-free requests
export {
  tauriFetch,
  tauriFetchWithTimeout,
  isTauriEnvironment,
  isServiceReachable,
} from './utils/tauriHttp'

export type {
  TauriFetchOptions,
} from './utils/tauriHttp'

// AI Tools for tool execution
export {
  AI_TOOLS,
  MAX_TOOLS_PER_RESPONSE,
  executeTool,
  parseToolCalls,
  buildToolsPrompt,
} from './tools'

export type {
  ToolDefinition,
  ToolParam,
  ToolCall,
  ToolResult,
} from './tools'
