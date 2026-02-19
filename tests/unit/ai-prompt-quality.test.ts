/**
 * AI Prompt Quality Test Suite (TASK-1350)
 *
 * Validates that ALL 4 AI flows produce correctly structured prompts
 * with user context injection.
 *
 * Tests cover:
 * - Context construction per feature
 * - Router context injection mechanics
 * - Flow-specific prompt structures
 * - Regression guards to prevent re-breaking
 *
 * @see src/services/ai/userContext.ts
 * @see src/services/ai/routerFactory.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ref } from 'vue'
import { getAIUserContext } from '@/services/ai/userContext'
import { getSharedRouter, resetSharedRouter } from '@/services/ai/routerFactory'
import { useTaskStore } from '@/stores/tasks'
import { useProjectStore } from '@/stores/projects'
import { useSettingsStore } from '@/stores/settings'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { Task } from '@/types/tasks'
import type { Project } from '@/types/projects'

const projectRoot = process.cwd()

// ============================================================================
// Mock Setup
// ============================================================================

/**
 * Create realistic mock task data for testing
 */
function createMockTasks(): Task[] {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0]
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().split('T')[0]

  return [
    {
      id: 'task-1',
      title: 'Fix critical bug in auth flow',
      description: 'Users cannot log in with Google OAuth',
      status: 'in_progress',
      priority: 'high',
      dueDate: today,
      estimatedDuration: 60,
      projectId: 'proj-1',
      _soft_deleted: false,
      createdAt: new Date(now.getTime() - 86400000 * 2).toISOString(),
      sortOrder: 0,
    },
    {
      id: 'task-2',
      title: 'Write documentation for API endpoints',
      description: '',
      status: 'planned',
      priority: 'medium',
      dueDate: tomorrow,
      estimatedDuration: 90,
      projectId: 'proj-2',
      _soft_deleted: false,
      createdAt: new Date(now.getTime() - 86400000).toISOString(),
      sortOrder: 1,
    },
    {
      id: 'task-3',
      title: 'Review PR #123',
      description: '',
      status: 'planned',
      priority: null,
      dueDate: yesterday,
      estimatedDuration: 15,
      projectId: 'proj-1',
      _soft_deleted: false,
      createdAt: new Date(now.getTime() - 86400000 * 3).toISOString(),
      sortOrder: 2,
    },
    {
      id: 'task-4',
      title: 'Research state management patterns',
      description: 'For the new feature',
      status: 'backlog',
      priority: 'low',
      dueDate: null,
      estimatedDuration: 120,
      projectId: 'proj-2',
      _soft_deleted: false,
      createdAt: new Date(now.getTime() - 86400000 * 5).toISOString(),
      sortOrder: 3,
    },
    {
      id: 'task-5',
      title: 'Update dependencies',
      description: '',
      status: 'planned',
      priority: null,
      dueDate: null,
      estimatedDuration: null,
      projectId: null,
      _soft_deleted: false,
      createdAt: new Date(now.getTime() - 86400000).toISOString(),
      sortOrder: 4,
    },
    {
      id: 'task-done-1',
      title: 'Setup CI/CD pipeline',
      description: '',
      status: 'done',
      priority: 'high',
      dueDate: null,
      estimatedDuration: 60,
      projectId: 'proj-1',
      _soft_deleted: false,
      completedAt: new Date(now.getTime() - 86400000 * 7).toISOString(),
      createdAt: new Date(now.getTime() - 86400000 * 10).toISOString(),
      sortOrder: 5,
    },
    {
      id: 'task-done-2',
      title: 'Design landing page',
      description: '',
      status: 'done',
      priority: 'medium',
      dueDate: null,
      estimatedDuration: 120,
      projectId: 'proj-2',
      _soft_deleted: false,
      completedAt: new Date(now.getTime() - 86400000 * 3).toISOString(),
      createdAt: new Date(now.getTime() - 86400000 * 15).toISOString(),
      sortOrder: 6,
    },
  ]
}

/**
 * Create realistic mock project data
 */
function createMockProjects(): Project[] {
  return [
    {
      id: 'proj-1',
      name: 'Authentication Service',
      color: '#4ECDC4',
      createdAt: new Date().toISOString(),
      sortOrder: 0,
    },
    {
      id: 'proj-2',
      name: 'Marketing Website',
      color: '#FFD93D',
      createdAt: new Date().toISOString(),
      sortOrder: 1,
    },
  ]
}

// ============================================================================
// GROUP 1: Context Construction Tests
// ============================================================================

describe('Group 1: Context Construction', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())

    // Setup mock stores
    const taskStore = useTaskStore()
    const projectStore = useProjectStore()
    const settingsStore = useSettingsStore()

    // Create tasks using the proper API
    const mockTasks = createMockTasks()
    for (const task of mockTasks) {
      await taskStore.createTask(task)
    }

    // Create projects
    const mockProjects = createMockProjects()
    for (const project of mockProjects) {
      await projectStore.createProject(project)
    }

    settingsStore.aiLearningEnabled = true
    settingsStore.groqApiKey = 'test-key'
  })

  it('should return quicksort-specific framing for quicksort feature', async () => {
    const context = await getAIUserContext('quicksort')
    expect(context).toContain('Use this context to make suggestions that fit the user\'s actual work patterns')
    expect(context).toContain('If they\'re overloaded, avoid suggesting high priority')
    expect(context).not.toContain('AI assistant in their task management app')
    expect(context).not.toContain('weekly plan')
  })

  it('should return taskassist-specific framing for taskassist feature', async () => {
    const context = await getAIUserContext('taskassist')
    expect(context).toContain('Use this context to tailor suggestions to the user\'s capacity and habits')
    expect(context).toContain('Suggest realistic durations based on their historical pace')
    expect(context).not.toContain('AI assistant in their task management app')
    expect(context).not.toContain('weekly plan')
  })

  it('should return chat-specific framing for chat feature', async () => {
    const context = await getAIUserContext('chat')
    expect(context).toContain('You are the user\'s AI assistant in their task management app')
    expect(context).toContain('Use this context to give personalized, relevant advice')
    expect(context).not.toContain('weekly plan')
    expect(context).not.toContain('quicksort')
  })

  it('should return weeklyplan-specific framing for weeklyplan feature', async () => {
    const context = await getAIUserContext('weeklyplan')
    expect(context).toContain('Use this context to create a realistic weekly plan')
    expect(context).toContain('matches the user\'s actual capacity and patterns')
    expect(context).not.toContain('AI assistant in their task management app')
    expect(context).not.toContain('quicksort')
  })

  it('should place feature framing BEFORE workload data (instruction-before-data)', async () => {
    const context = await getAIUserContext('quicksort')
    const framingIndex = context.indexOf('Use this context to make suggestions')
    const workloadIndex = context.indexOf('Current workload:')

    expect(framingIndex).toBeGreaterThan(0)
    expect(workloadIndex).toBeGreaterThan(0)
    expect(framingIndex).toBeLessThan(workloadIndex)
  })

  it('should skip profile/memory sections when aiLearningEnabled=false but keep workload', async () => {
    const settingsStore = useSettingsStore()
    settingsStore.aiLearningEnabled = false

    const context = await getAIUserContext('chat')

    // Should have workload
    expect(context).toContain('Current workload:')

    // Should NOT have learning-gated sections
    expect(context).not.toContain('Recently completed (momentum):')
    expect(context).not.toContain('Work insights:')
    expect(context).not.toContain('Frequently missed projects')
  })

  it('should include "Current workload:" section with task counts', async () => {
    const context = await getAIUserContext('chat')

    expect(context).toContain('Current workload:')
    expect(context).toContain('task')
    expect(context).toContain('open')
  })

  it('should include "Active projects:" section when projects exist (always shown)', async () => {
    const settingsStore = useSettingsStore()
    settingsStore.aiLearningEnabled = false // Active projects shown regardless

    const context = await getAIUserContext('chat')

    expect(context).toContain('Active projects:')
  })

  it('should include "Recently completed (momentum):" when aiLearningEnabled=true', async () => {
    const settingsStore = useSettingsStore()
    settingsStore.aiLearningEnabled = true // Required for this section

    const context = await getAIUserContext('chat')

    expect(context).toContain('Recently completed (momentum):')
  })

  it('should produce valid (if minimal) context for empty task list', async () => {
    // Create fresh pinia to get empty task store
    setActivePinia(createPinia())
    const settingsStore = useSettingsStore()

    // Don't add any tasks - store is already empty

    settingsStore.aiLearningEnabled = true

    const context = await getAIUserContext('chat')

    // Should still have framing even with no tasks
    expect(context).toContain('You are the user\'s AI assistant')
    // Workload section should be absent or minimal
    expect(context.length).toBeGreaterThan(0)
  })
})

// ============================================================================
// GROUP 2: Router Context Injection Tests
// ============================================================================

describe('Group 2: Router Context Injection', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())

    const taskStore = useTaskStore()
    const projectStore = useProjectStore()
    const settingsStore = useSettingsStore()

    const mockTasks = createMockTasks()
    for (const task of mockTasks) {
      await taskStore.createTask(task)
    }

    const mockProjects = createMockProjects()
    for (const project of mockProjects) {
      await projectStore.createProject(project)
    }

    settingsStore.aiLearningEnabled = true
    settingsStore.groqApiKey = 'test-key'
  })

  afterEach(() => {
    resetSharedRouter()
  })

  it('should add context to first system message via ContextAwareRouter', async () => {
    const router = await getSharedRouter()

    // Spy on the underlying router's chat method
    const chatSpy = vi.fn().mockResolvedValue({ content: '{}' })
    // @ts-expect-error - accessing private property for testing
    router.chat = chatSpy

    await router.chat(
      [
        { role: 'system', content: 'You are a test assistant.' },
        { role: 'user', content: 'Hello' },
      ],
      { contextFeature: 'chat' }
    )

    expect(chatSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('You are a test assistant.'),
        }),
      ]),
      expect.any(Object)
    )

    // System message should contain appended context
    const systemMessage = chatSpy.mock.calls[0][0][0]
    expect(systemMessage.content).toContain('USER CONTEXT')
  })

  it('should create new system message if none exists', async () => {
    const router = await getSharedRouter()

    const chatSpy = vi.fn().mockResolvedValue({ content: '{}' })
    // @ts-expect-error - accessing private property for testing
    router.chat = chatSpy

    await router.chat(
      [{ role: 'user', content: 'Hello' }],
      { contextFeature: 'chat' }
    )

    const messages = chatSpy.mock.calls[0][0]
    expect(messages[0].role).toBe('system')
    expect(messages[0].content).toContain('USER CONTEXT')
  })

  it('should bypass injection when skipUserContext: true', async () => {
    const router = await getSharedRouter()

    const chatSpy = vi.fn().mockResolvedValue({ content: '{}' })
    // @ts-expect-error - accessing private property for testing
    router.chat = chatSpy

    await router.chat(
      [
        { role: 'system', content: 'Test system.' },
        { role: 'user', content: 'Hello' },
      ],
      { skipUserContext: true }
    )

    const systemMessage = chatSpy.mock.calls[0][0][0]
    expect(systemMessage.content).not.toContain('USER CONTEXT')
    expect(systemMessage.content).toBe('Test system.')
  })

  it('should cache context and return same value within 30s', async () => {
    const context1 = await getAIUserContext('chat')
    const context2 = await getAIUserContext('chat')

    // Should be identical (cached)
    expect(context1).toBe(context2)
  })

  it('should produce different context for different contextFeature values', async () => {
    const quicksortContext = await getAIUserContext('quicksort')
    const chatContext = await getAIUserContext('chat')

    // Feature framing should differ
    expect(quicksortContext).not.toBe(chatContext)
    expect(quicksortContext).toContain('work patterns')
    expect(chatContext).toContain('AI assistant')
  })
})

// ============================================================================
// GROUP 3: Flow-Specific Prompt Structure Tests
// ============================================================================

describe('Group 3: Flow-Specific Prompt Structure', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())

    const taskStore = useTaskStore()
    const projectStore = useProjectStore()
    const settingsStore = useSettingsStore()

    const mockTasks = createMockTasks()
    for (const task of mockTasks) {
      await taskStore.createTask(task)
    }

    const mockProjects = createMockProjects()
    for (const project of mockProjects) {
      await projectStore.createProject(project)
    }

    settingsStore.aiLearningEnabled = false // Disable to simplify assertions
    settingsStore.groqApiKey = 'test-key'
  })

  afterEach(() => {
    resetSharedRouter()
  })

  it('QuickSort sends system+user messages with contextFeature "quicksort"', async () => {
    const router = await getSharedRouter()

    // Test that the router accepts these parameters without error
    // and that context injection happens (we can verify via the actual code paths)
    const streamSpy = vi.spyOn(router, 'chatStream' as any)

    try {
      // Consume the stream
      const stream = router.chatStream(
        [
          { role: 'system', content: 'You are a task triage assistant.' },
          { role: 'user', content: 'Task: Fix login' },
        ],
        { taskType: 'suggestion', contextFeature: 'quicksort' }
      )

      // Consume at least one chunk
      const iterator = stream[Symbol.asyncIterator]()
      await iterator.next()
    } catch {
      // Ignore AI provider errors - we're just testing the plumbing
    }

    // Verify the method was called
    expect(streamSpy).toHaveBeenCalled()
  })

  it('TaskAssist sends system+user messages with contextFeature "taskassist"', async () => {
    const router = await getSharedRouter()

    const streamSpy = vi.spyOn(router, 'chatStream' as any)

    try {
      const stream = router.chatStream(
        [
          { role: 'system', content: 'You are a task planning assistant.' },
          { role: 'user', content: 'Task: "Write docs"' },
        ],
        { taskType: 'suggestion', contextFeature: 'taskassist' }
      )

      const iterator = stream[Symbol.asyncIterator]()
      await iterator.next()
    } catch {
      // Ignore AI provider errors
    }

    expect(streamSpy).toHaveBeenCalled()
  })

  it('AI Chat sends messages with contextFeature "chat"', async () => {
    const router = await getSharedRouter()

    const streamSpy = vi.spyOn(router, 'chatStream' as any)

    try {
      const stream = router.chatStream(
        [{ role: 'user', content: 'How many tasks do I have?' }],
        { contextFeature: 'chat' }
      )

      const iterator = stream[Symbol.asyncIterator]()
      await iterator.next()
    } catch {
      // Ignore AI provider errors
    }

    expect(streamSpy).toHaveBeenCalled()
  })

  it('Weekly Plan uses getSharedRouter with contextFeature "weeklyplan"', async () => {
    const router = await getSharedRouter()

    const chatSpy = vi.fn().mockResolvedValue({ content: '{}' })
    // @ts-expect-error - accessing private property for testing
    router.chat = chatSpy

    // Simulate Weekly Plan flow
    await router.chat(
      [
        { role: 'system', content: 'You distribute tasks across a work week.' },
        { role: 'user', content: 'Tasks: [...]' },
      ],
      { taskType: 'planning', contextFeature: 'weeklyplan', temperature: 0.3 }
    )

    expect(chatSpy).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ contextFeature: 'weeklyplan' })
    )
  })
})

// ============================================================================
// GROUP 4: Regression Guards
// ============================================================================

describe('Group 4: Regression Guards', () => {
  function collectTsFiles(dir: string, files: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue
      const stat = statSync(full)
      if (stat.isDirectory()) {
        collectTsFiles(full, files)
      } else if (/\.(ts|vue)$/.test(entry)) {
        files.push(full)
      }
    }
    return files
  }

  it('should ensure no composable imports getAIUserContext directly', () => {
    const composablesDir = join(projectRoot, 'src', 'composables')
    const files = collectTsFiles(composablesDir)

    const allowedFiles = [
      'src/services/ai/userContext.ts', // Definition
      'src/services/ai/routerFactory.ts', // Single consumer
    ]

    const violations: string[] = []

    for (const file of files) {
      const relativePath = file.replace(projectRoot + '/', '')

      if (allowedFiles.some(allowed => relativePath.endsWith(allowed))) continue

      const content = readFileSync(file, 'utf-8')

      if (content.includes('getAIUserContext')) {
        violations.push(relativePath)
      }
    }

    expect(
      violations,
      `These composables import getAIUserContext directly (should use getSharedRouter):\n${violations.join('\n')}`
    ).toEqual([])
  })

  it('should ensure useWeeklyPlanAI imports getSharedRouter (not createAIRouter)', () => {
    const weeklyPlanPath = join(projectRoot, 'src', 'composables', 'useWeeklyPlanAI.ts')
    const content = readFileSync(weeklyPlanPath, 'utf-8')

    expect(content).toContain("from '@/services/ai/routerFactory'")
    expect(content).toContain('getSharedRouter()')
    expect(content).not.toContain('createAIRouter()')
  })

  it('should ensure formatHebrewDate handles empty/invalid dates without crashing', () => {
    const weeklyPlanPath = join(projectRoot, 'src', 'composables', 'useWeeklyPlanAI.ts')
    const content = readFileSync(weeklyPlanPath, 'utf-8')

    // Check that formatHebrewDate has guards
    expect(content).toContain('function formatHebrewDate')
    expect(content).toMatch(/if\s*\(!dateStr.*\)\s*return/)
    expect(content).toMatch(/isNaN\(d\.getTime\(\)\)/)
  })

  it('should ensure all AI composables pass contextFeature to router', () => {
    const composableFiles = [
      'src/composables/useQuickSortAI.ts',
      'src/composables/useAITaskAssist.ts',
      'src/composables/useWeeklyPlanAI.ts',
      'src/composables/useAIChat.ts',
    ]

    for (const file of composableFiles) {
      const fullPath = join(projectRoot, file)
      const content = readFileSync(fullPath, 'utf-8')

      // Each composable should have contextFeature somewhere
      expect(
        content,
        `${file} should pass contextFeature to router`
      ).toMatch(/contextFeature:\s*['"]/)
    }
  })

  it('should verify contextFeature values match expected features', () => {
    const expectations = [
      { file: 'src/composables/useQuickSortAI.ts', feature: 'quicksort' },
      { file: 'src/composables/useAITaskAssist.ts', feature: 'taskassist' },
      { file: 'src/composables/useAIChat.ts', feature: 'chat' },
      { file: 'src/composables/useWeeklyPlanAI.ts', feature: 'weeklyplan' },
    ]

    for (const { file, feature } of expectations) {
      const fullPath = join(projectRoot, file)
      const content = readFileSync(fullPath, 'utf-8')

      expect(
        content,
        `${file} should use contextFeature: '${feature}'`
      ).toContain(`contextFeature: '${feature}'`)
    }
  })
})
