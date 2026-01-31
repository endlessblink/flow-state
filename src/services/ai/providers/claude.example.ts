/**
 * Claude Provider Usage Examples
 *
 * This file demonstrates how to use the ClaudeProvider for various AI operations.
 * The examples cover initialization, completions, streaming, and error handling.
 *
 * @see ROAD-011 in MASTER_PLAN.md - AI-Powered Features Roadmap
 */

import { createClaudeProvider } from './claude'
import { AIProvider, type AIMessage } from '@/types/ai'

// ============================================================================
// Example 1: Basic Setup
// ============================================================================

async function basicSetup() {
  // Create the provider
  const claude = createClaudeProvider()

  // Initialize with config
  await claude.initialize({
    provider: AIProvider.ANTHROPIC,
    enabled: true,
    endpoint: 'https://api.anthropic.com',
    apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY, // From .env
    model: 'claude-sonnet-4-20250514',
    maxTokens: 4096,
    temperature: 0.7,
    timeout: 60000
  })

  console.log('Provider initialized:', claude.isInitialized)
}

// ============================================================================
// Example 2: Simple Completion
// ============================================================================

async function simpleCompletion() {
  const claude = createClaudeProvider()
  await claude.initialize({
    provider: AIProvider.ANTHROPIC,
    enabled: true,
    endpoint: 'https://api.anthropic.com',
    apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 2048,
    temperature: 0.7,
    timeout: 60000
  })

  const messages: AIMessage[] = [
    { role: 'user', content: 'What is the capital of France?' }
  ]

  const response = await claude.complete(messages)

  console.log('Response:', response.content)
  console.log('Tokens used:', response.usage?.totalTokens)
  console.log('Latency:', response.latencyMs, 'ms')
}

// ============================================================================
// Example 3: Streaming Response
// ============================================================================

async function streamingCompletion() {
  const claude = createClaudeProvider()
  await claude.initialize({
    provider: AIProvider.ANTHROPIC,
    enabled: true,
    endpoint: 'https://api.anthropic.com',
    apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 2048,
    temperature: 0.7,
    timeout: 60000
  })

  const messages: AIMessage[] = [
    { role: 'user', content: 'Write a short poem about coding.' }
  ]

  console.log('Streaming response:')
  for await (const chunk of claude.stream(messages)) {
    process.stdout.write(chunk.content)

    if (chunk.done) {
      console.log('\n\nStream finished!')
      console.log('Total tokens:', chunk.usage?.totalTokens)
    }
  }
}

// ============================================================================
// Example 4: Multi-turn Conversation
// ============================================================================

async function multiTurnConversation() {
  const claude = createClaudeProvider()
  await claude.initialize({
    provider: AIProvider.ANTHROPIC,
    enabled: true,
    endpoint: 'https://api.anthropic.com',
    apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 2048,
    temperature: 0.7,
    timeout: 60000
  })

  const messages: AIMessage[] = [
    { role: 'user', content: 'What is TypeScript?' },
    { role: 'assistant', content: 'TypeScript is a statically typed superset of JavaScript...' },
    { role: 'user', content: 'What are its main benefits?' }
  ]

  const response = await claude.complete(messages)
  console.log('Assistant:', response.content)
}

// ============================================================================
// Example 5: System Prompt
// ============================================================================

async function withSystemPrompt() {
  const claude = createClaudeProvider()
  await claude.initialize({
    provider: AIProvider.ANTHROPIC,
    enabled: true,
    endpoint: 'https://api.anthropic.com',
    apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 2048,
    temperature: 0.7,
    timeout: 60000
  })

  const messages: AIMessage[] = [
    { role: 'user', content: 'Suggest a task name for organizing my inbox.' }
  ]

  const response = await claude.complete(messages, {
    systemPrompt: 'You are a productivity assistant. Respond in a concise, actionable manner.'
  })

  console.log('Suggestion:', response.content)
}

// ============================================================================
// Example 6: Health Check
// ============================================================================

async function healthCheck() {
  const claude = createClaudeProvider()
  await claude.initialize({
    provider: AIProvider.ANTHROPIC,
    enabled: true,
    endpoint: 'https://api.anthropic.com',
    apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 2048,
    temperature: 0.7,
    timeout: 60000
  })

  const health = await claude.healthCheck()

  console.log('Provider healthy:', health.healthy)
  console.log('Latency:', health.latencyMs, 'ms')
  console.log('Available models:', health.availableModels)

  if (!health.healthy) {
    console.error('Error:', health.error)
  }
}

// ============================================================================
// Example 7: List Available Models
// ============================================================================

async function listModels() {
  const claude = createClaudeProvider()
  await claude.initialize({
    provider: AIProvider.ANTHROPIC,
    enabled: true,
    endpoint: 'https://api.anthropic.com',
    apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 2048,
    temperature: 0.7,
    timeout: 60000
  })

  const models = await claude.getModels()

  console.log('Available Claude models:')
  models.forEach(model => {
    console.log(`- ${model.name} (${model.id})`)
    console.log(`  Context: ${model.contextWindow?.toLocaleString()} tokens`)
    console.log(`  Streaming: ${model.supportsStreaming ? 'Yes' : 'No'}`)
  })
}

// ============================================================================
// Example 8: Error Handling
// ============================================================================

async function errorHandling() {
  const claude = createClaudeProvider()

  try {
    // Initialize without API key (will fail)
    await claude.initialize({
      provider: AIProvider.ANTHROPIC,
      enabled: true,
      endpoint: 'https://api.anthropic.com',
      model: 'claude-sonnet-4-20250514',
      maxTokens: 2048,
      temperature: 0.7,
      timeout: 60000
    })

    const messages: AIMessage[] = [
      { role: 'user', content: 'Hello' }
    ]

    await claude.complete(messages)
  } catch (error) {
    // Errors are normalized to AIProviderError
    console.error('Error code:', (error as any).code)
    console.error('Error message:', (error as any).message)
    console.error('Retryable:', (error as any).retryable)
  }
}

// ============================================================================
// Example 9: Abort Request
// ============================================================================

async function abortRequest() {
  const claude = createClaudeProvider()
  await claude.initialize({
    provider: AIProvider.ANTHROPIC,
    enabled: true,
    endpoint: 'https://api.anthropic.com',
    apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 2048,
    temperature: 0.7,
    timeout: 60000
  })

  const abortController = new AbortController()

  // Abort after 1 second
  setTimeout(() => abortController.abort(), 1000)

  const messages: AIMessage[] = [
    { role: 'user', content: 'Write a very long essay about AI.' }
  ]

  try {
    await claude.complete(messages, {
      signal: abortController.signal
    })
  } catch (error) {
    console.error('Request aborted:', (error as Error).message)
  }
}

// ============================================================================
// Example 10: Resource Cleanup
// ============================================================================

async function cleanup() {
  const claude = createClaudeProvider()
  await claude.initialize({
    provider: AIProvider.ANTHROPIC,
    enabled: true,
    endpoint: 'https://api.anthropic.com',
    apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 2048,
    temperature: 0.7,
    timeout: 60000
  })

  // Use the provider...
  // ...

  // Clean up resources when done
  claude.dispose()
  console.log('Provider disposed, resources cleaned up')
}

// Export examples for testing/documentation
export {
  basicSetup,
  simpleCompletion,
  streamingCompletion,
  multiTurnConversation,
  withSystemPrompt,
  healthCheck,
  listModels,
  errorHandling,
  abortRequest,
  cleanup
}
