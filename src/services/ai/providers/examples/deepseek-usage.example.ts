/**
 * DeepSeek Provider Usage Examples
 *
 * This file demonstrates how to use the DeepSeek AI provider in FlowState.
 */

import { createDeepSeekProvider, autoDetectDeepSeek } from '../deepseek'
import { AIProvider, type AIMessage } from '@/types/ai'

// ============================================================================
// Example 1: Basic Usage with Manual Initialization
// ============================================================================

async function basicUsageExample() {
  // Create provider with API key from environment
  const provider = createDeepSeekProvider(
    import.meta.env.VITE_DEEPSEEK_API_KEY,
    {
      model: 'deepseek-chat', // or 'deepseek-reasoner' for R1
      temperature: 0.7,
      maxTokens: 2048
    }
  )

  // Initialize the provider
  await provider.initialize({
    provider: AIProvider.OPENAI,
    enabled: true,
    endpoint: 'https://api.deepseek.com/v1',
    apiKey: import.meta.env.VITE_DEEPSEEK_API_KEY,
    model: 'deepseek-chat',
    maxTokens: 2048,
    temperature: 0.7,
    timeout: 60000
  })

  // Generate a completion
  const response = await provider.complete([
    { role: 'user', content: 'What is FlowState?' }
  ])

  console.log(response.content)
  console.log('Tokens used:', response.usage?.totalTokens)

  // Clean up
  provider.dispose()
}

// ============================================================================
// Example 2: Auto-Detection from Environment
// ============================================================================

async function autoDetectionExample() {
  // Auto-detect provider from environment variables
  const provider = await autoDetectDeepSeek({
    model: 'deepseek-chat',
    temperature: 0.7
  })

  if (!provider) {
    console.error('DeepSeek API key not found in environment')
    return
  }

  // Provider is already initialized and health-checked
  const response = await provider.complete([
    { role: 'user', content: 'Hello, DeepSeek!' }
  ])

  console.log(response.content)

  provider.dispose()
}

// ============================================================================
// Example 3: Streaming Response
// ============================================================================

async function streamingExample() {
  const provider = await autoDetectDeepSeek()
  if (!provider) return

  console.log('Assistant: ')

  // Stream the response token by token
  for await (const chunk of provider.stream([
    { role: 'user', content: 'Explain task management in 2 sentences.' }
  ])) {
    process.stdout.write(chunk.content)

    if (chunk.done) {
      console.log('\n\nDone!')
      console.log('Token usage:', chunk.usage)
    }
  }

  provider.dispose()
}

// ============================================================================
// Example 4: Multi-Turn Conversation
// ============================================================================

async function conversationExample() {
  const provider = await autoDetectDeepSeek()
  if (!provider) return

  const messages: AIMessage[] = [
    { role: 'user', content: 'What is a Pomodoro timer?' }
  ]

  // First turn
  const response1 = await provider.complete(messages)
  console.log('Assistant:', response1.content)

  // Add assistant response to conversation
  messages.push({ role: 'assistant', content: response1.content })

  // Second turn
  messages.push({ role: 'user', content: 'How long is one Pomodoro?' })
  const response2 = await provider.complete(messages)
  console.log('Assistant:', response2.content)

  provider.dispose()
}

// ============================================================================
// Example 5: Using DeepSeek Reasoner (R1 Model)
// ============================================================================

async function reasonerExample() {
  const provider = createDeepSeekProvider(
    import.meta.env.VITE_DEEPSEEK_API_KEY,
    {
      model: 'deepseek-reasoner', // Use R1 reasoning model
      temperature: 0.3, // Lower temperature for reasoning tasks
      maxTokens: 4096
    }
  )

  await provider.initialize({
    provider: AIProvider.OPENAI,
    enabled: true,
    endpoint: 'https://api.deepseek.com/v1',
    apiKey: import.meta.env.VITE_DEEPSEEK_API_KEY,
    model: 'deepseek-reasoner',
    maxTokens: 4096,
    temperature: 0.3,
    timeout: 60000
  })

  const response = await provider.complete([
    {
      role: 'user',
      content: 'Given tasks: [Buy groceries, Cook dinner, Clean kitchen]. What is the optimal order?'
    }
  ])

  console.log('Reasoning:', response.content)

  provider.dispose()
}

// ============================================================================
// Example 6: With System Prompt
// ============================================================================

async function systemPromptExample() {
  const provider = await autoDetectDeepSeek()
  if (!provider) return

  const response = await provider.complete(
    [
      { role: 'user', content: 'Suggest 3 task categories for a software project.' }
    ],
    {
      systemPrompt: 'You are a productivity expert specializing in task management. Be concise and actionable.',
      temperature: 0.8
    }
  )

  console.log(response.content)

  provider.dispose()
}

// ============================================================================
// Example 7: Error Handling
// ============================================================================

async function errorHandlingExample() {
  const provider = createDeepSeekProvider('invalid-key')

  await provider.initialize({
    provider: AIProvider.OPENAI,
    enabled: true,
    endpoint: 'https://api.deepseek.com/v1',
    apiKey: 'invalid-key',
    model: 'deepseek-chat',
    maxTokens: 2048,
    temperature: 0.7,
    timeout: 60000
  })

  try {
    await provider.complete([{ role: 'user', content: 'Hello!' }])
  } catch (error: any) {
    console.error('Error code:', error.code)
    console.error('Error message:', error.message)
    console.error('Retryable:', error.retryable)

    if (error.code === 'AUTH_ERROR') {
      console.log('Invalid API key. Please check your VITE_DEEPSEEK_API_KEY.')
    }
  }

  provider.dispose()
}

// ============================================================================
// Example 8: Health Check Before Use
// ============================================================================

async function healthCheckExample() {
  const provider = await autoDetectDeepSeek()
  if (!provider) return

  // Check provider health
  const health = await provider.healthCheck()

  console.log('Health check:')
  console.log('- Healthy:', health.healthy)
  console.log('- Latency:', health.latencyMs, 'ms')
  console.log('- Available models:', health.availableModels)

  if (health.healthy) {
    const response = await provider.complete([
      { role: 'user', content: 'List 3 productivity tips.' }
    ])
    console.log(response.content)
  } else {
    console.error('Provider is not healthy:', health.error)
  }

  provider.dispose()
}

// ============================================================================
// Example 9: List Available Models
// ============================================================================

async function listModelsExample() {
  const provider = await autoDetectDeepSeek()
  if (!provider) return

  const models = await provider.getModels()

  console.log('Available DeepSeek models:')
  for (const model of models) {
    console.log(`- ${model.id}`)
    console.log(`  Description: ${model.description}`)
    console.log(`  Context window: ${model.contextWindow} tokens`)
    console.log(`  Supports streaming: ${model.supportsStreaming}`)
    console.log()
  }

  provider.dispose()
}

// ============================================================================
// Example 10: Abort In-Flight Request
// ============================================================================

async function abortExample() {
  const provider = await autoDetectDeepSeek()
  if (!provider) return

  const completionPromise = provider.complete([
    { role: 'user', content: 'Write a very long essay about task management...' }
  ])

  // Abort after 2 seconds
  setTimeout(() => {
    console.log('Aborting request...')
    provider.abort()
  }, 2000)

  try {
    await completionPromise
  } catch (error: any) {
    console.log('Request aborted:', error.message)
  }

  provider.dispose()
}

// ============================================================================
// Example 11: Integration with FlowState Task Analysis
// ============================================================================

async function taskAnalysisExample() {
  const provider = await autoDetectDeepSeek()
  if (!provider) return

  // Simulate analyzing a task
  const task = {
    title: 'Implement user authentication',
    description: 'Add login/logout functionality with JWT tokens',
    priority: 'high'
  }

  const response = await provider.complete(
    [
      {
        role: 'user',
        content: `Analyze this task and suggest subtasks:\n\nTitle: ${task.title}\nDescription: ${task.description}\nPriority: ${task.priority}`
      }
    ],
    {
      systemPrompt: 'You are a task breakdown assistant. Provide 3-5 concrete, actionable subtasks.',
      temperature: 0.5
    }
  )

  console.log('Suggested subtasks:')
  console.log(response.content)

  provider.dispose()
}

// ============================================================================
// Example 12: Event Monitoring
// ============================================================================

async function eventMonitoringExample() {
  const provider = await autoDetectDeepSeek()
  if (!provider) return

  // Listen to provider events
  provider.on('request:start', (event) => {
    console.log('Request started:', event.data)
  })

  provider.on('request:complete', (event) => {
    console.log('Request completed:', event.data)
  })

  provider.on('request:error', (event) => {
    console.error('Request error:', event.data)
  })

  provider.on('stream:chunk', (event) => {
    console.log('Stream chunk received')
  })

  const response = await provider.complete([
    { role: 'user', content: 'Hello!' }
  ])

  console.log(response.content)

  provider.dispose()
}

// Export examples for documentation
export {
  basicUsageExample,
  autoDetectionExample,
  streamingExample,
  conversationExample,
  reasonerExample,
  systemPromptExample,
  errorHandlingExample,
  healthCheckExample,
  listModelsExample,
  abortExample,
  taskAnalysisExample,
  eventMonitoringExample
}
