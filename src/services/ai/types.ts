/**
 * AI Provider System Types
 *
 * Core interfaces and types for the multi-provider AI integration system.
 * Supports local (Ollama) and cloud providers (OpenAI, Groq) with a unified interface.
 *
 * @see ROAD-011 in MASTER_PLAN.md
 */

// ============================================================================
// Provider Types
// ============================================================================

/**
 * Supported AI providers.
 */
export type AIProviderType = 'ollama' | 'openai' | 'groq'

/**
 * Provider connection status.
 */
export type ProviderConnectionStatus = 'connected' | 'disconnected' | 'checking' | 'error'

/**
 * Health status of an AI provider.
 */
export interface ProviderHealthStatus {
  /** Whether the provider is currently available */
  isHealthy: boolean
  /** Current connection status */
  status: ProviderConnectionStatus
  /** Last successful connection timestamp */
  lastConnected?: Date
  /** Last error message if any */
  lastError?: string
  /** Response time in ms for last health check */
  latencyMs?: number
  /** Provider version if available */
  version?: string
}

/**
 * Information about an available AI model.
 */
export interface AIModel {
  /** Model identifier used for API calls */
  id: string
  /** Human-readable model name */
  name: string
  /** Model description */
  description?: string
  /** Model size (e.g., "7B", "13B", "70B") */
  size?: string
  /** Parameter count */
  parameters?: number
  /** Context window size in tokens */
  contextLength?: number
  /** Whether the model supports streaming */
  supportsStreaming: boolean
  /** Model capabilities */
  capabilities: ModelCapability[]
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>
}

/**
 * Model capabilities.
 */
export type ModelCapability =
  | 'chat'           // Conversational responses
  | 'completion'     // Text completion
  | 'embedding'      // Text embeddings
  | 'vision'         // Image understanding
  | 'function_call'  // Function/tool calling

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Message role in a conversation.
 */
export type MessageRole = 'system' | 'user' | 'assistant'

/**
 * A single message in a conversation.
 */
export interface ChatMessage {
  role: MessageRole
  content: string
}

/**
 * Options for generating a response.
 */
export interface GenerateOptions {
  /** Model to use for generation */
  model: string
  /** Temperature (0-1, higher = more creative) */
  temperature?: number
  /** Maximum tokens to generate */
  maxTokens?: number
  /** Stop sequences */
  stopSequences?: string[]
  /** System prompt to prepend */
  systemPrompt?: string
  /** Whether to stream the response */
  stream?: boolean
  /** Timeout in milliseconds */
  timeout?: number
  /** OpenAI-compatible tools for native function calling (cloud providers only) */
  tools?: OpenAITool[]
  /** Tool choice: 'auto' lets model decide, 'none' disables tools */
  toolChoice?: 'auto' | 'none'
}

/**
 * Non-streaming generation response.
 */
export interface GenerateResponse {
  /** Generated text content */
  content: string
  /** Model that generated the response */
  model: string
  /** Total tokens used */
  totalTokens?: number
  /** Prompt tokens */
  promptTokens?: number
  /** Completion tokens */
  completionTokens?: number
  /** Generation time in ms */
  generationTimeMs?: number
  /** Whether the response was truncated */
  truncated?: boolean
  /** Stop reason */
  stopReason?: 'stop' | 'length' | 'error'
}

/**
 * Streaming chunk of a generation response.
 */
export interface StreamChunk {
  /** Partial content */
  content: string
  /** Whether this is the final chunk */
  done: boolean
  /** Error message if streaming failed */
  error?: string
  /** Native tool calls accumulated during streaming (populated in final chunk only) */
  toolCalls?: NativeToolCall[]
}

// ============================================================================
// Tool Calling Types (OpenAI-compatible)
// ============================================================================

/** OpenAI-compatible function definition for tools */
export interface OpenAIToolFunction {
  name: string
  description: string
  parameters: Record<string, unknown>
}

/** OpenAI-compatible tool definition */
export interface OpenAITool {
  type: 'function'
  function: OpenAIToolFunction
}

/** A tool call returned by the API in native function calling mode */
export interface NativeToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

// ============================================================================
// Provider Interface
// ============================================================================

/**
 * Core interface that all AI providers must implement.
 */
export interface AIProvider {
  /** Provider type identifier */
  readonly type: AIProviderType

  /** Human-readable provider name */
  readonly name: string

  /** Whether the provider requires an API key */
  readonly requiresApiKey: boolean

  /**
   * Initialize the provider and check availability.
   * @returns Whether initialization was successful
   */
  initialize(): Promise<boolean>

  /**
   * Check if the provider is currently available.
   * @returns Whether the provider can accept requests
   */
  isAvailable(): Promise<boolean>

  /**
   * Get the provider's health status.
   * @returns Health status information
   */
  getHealth(): Promise<ProviderHealthStatus>

  /**
   * List available models from this provider.
   * @returns List of available models
   */
  listModels(): Promise<AIModel[]>

  /**
   * Generate a response (non-streaming).
   * @param messages - Conversation messages
   * @param options - Generation options
   * @returns Generated response
   */
  generate(messages: ChatMessage[], options: GenerateOptions): Promise<GenerateResponse>

  /**
   * Generate a streaming response.
   * @param messages - Conversation messages
   * @param options - Generation options
   * @returns Async iterator of response chunks
   */
  generateStream(messages: ChatMessage[], options: GenerateOptions): AsyncGenerator<StreamChunk>

  /**
   * Dispose of provider resources.
   */
  dispose(): void
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Base configuration for all providers.
 */
export interface BaseProviderConfig {
  /** Whether this provider is enabled */
  enabled: boolean
  /** Default model to use */
  defaultModel?: string
  /** Request timeout in milliseconds */
  timeout?: number
}

/**
 * Ollama-specific configuration.
 */
export interface OllamaConfig extends BaseProviderConfig {
  /** Ollama server host */
  host: string
  /** Ollama server port */
  port: number
  /** Whether to auto-detect Ollama on startup */
  autoDetect: boolean
  /** Health check interval in milliseconds */
  healthCheckInterval: number
  /** Connection retry attempts */
  maxRetries: number
  /** Retry delay in milliseconds */
  retryDelay: number
}

/**
 * OpenAI-specific configuration.
 */
export interface OpenAIConfig extends BaseProviderConfig {
  /** API key */
  apiKey: string
  /** Organization ID (optional) */
  organization?: string
  /** Base URL for API (for proxies/alternatives) */
  baseUrl?: string
}

/**
 * Groq-specific configuration.
 */
export interface GroqConfig extends BaseProviderConfig {
  /** API key */
  apiKey: string
}

/**
 * Complete AI service configuration.
 */
export interface AIServiceConfig {
  /** Currently selected provider */
  activeProvider: AIProviderType
  /** Ollama configuration */
  ollama: OllamaConfig
  /** OpenAI configuration */
  openai?: OpenAIConfig
  /** Groq configuration */
  groq?: GroqConfig
}

/**
 * Default Ollama configuration.
 */
export const DEFAULT_OLLAMA_CONFIG: OllamaConfig = {
  enabled: true,
  host: 'localhost',
  port: 11434,
  autoDetect: true,
  healthCheckInterval: 30000, // 30 seconds
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  timeout: 60000, // 60 seconds
}

/**
 * Default AI service configuration.
 */
export const DEFAULT_AI_SERVICE_CONFIG: AIServiceConfig = {
  activeProvider: 'ollama',
  ollama: DEFAULT_OLLAMA_CONFIG,
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * AI provider events.
 */
export type AIProviderEvent =
  | { type: 'connected'; provider: AIProviderType }
  | { type: 'disconnected'; provider: AIProviderType; reason?: string }
  | { type: 'error'; provider: AIProviderType; error: string }
  | { type: 'model_loaded'; provider: AIProviderType; model: string }
  | { type: 'health_check'; provider: AIProviderType; status: ProviderHealthStatus }

/**
 * Event listener for AI provider events.
 */
export type AIProviderEventListener = (event: AIProviderEvent) => void
