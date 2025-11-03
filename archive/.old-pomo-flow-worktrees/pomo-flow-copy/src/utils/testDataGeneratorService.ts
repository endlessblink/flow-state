/**
 * SERVICE-ORCHESTRATOR-BASED TEST DATA GENERATOR
 *
 * Generates test data using ServiceOrchestrator instead of direct store access.
 * Provides consistent test data creation across the application.
 */

import type { Task, Project } from '@/types/task'

// Generate 60 test tasks for performance testing
export function generateTestTasks(count: number = 60): Partial<Task>[] {
  const statuses = ['planned', 'in_progress', 'done']
  const priorities = ['high', 'medium', 'low']
  const projects = ['1', '2', '3']

  const testTasks: Partial<Task>[] = []

  for (let i = 1; i <= count; i++) {
    const status = statuses[i % statuses.length]
    const priority = priorities[i % priorities.length]
    const projectId = projects[i % projects.length]

    testTasks.push({
      title: `Test Task ${i} - Performance Testing`,
      description: `This is a test task for performance validation with larger data sets. Testing drag and drop responsiveness with multiple tasks.`,
      status: status as any,
      priority: priority as any,
      projectId: projectId,
      progress: status === 'done' ? 100 : (status === 'in_progress' ? 50 : 0),
      dueDate: new Date(Date.now() + (i * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
      completedPomodoros: Math.floor(Math.random() * 5),
      subtasks: [],
      dependsOn: [],
      tags: ['test', 'performance']
    })
  }

  return testTasks
}

// Generate test projects
export function generateTestProjects(count: number = 5): Partial<Project>[] {
  const testProjects: Partial<Project>[] = []

  for (let i = 1; i <= count; i++) {
    testProjects.push({
      name: `Test Project ${i}`,
      description: `This is a test project for performance validation`,
      color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][i % 5],
      isDefault: i === 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
  }

  return testProjects
}

// Load test tasks using ServiceOrchestrator
export async function loadTestTasks(serviceOrchestrator: any, count: number = 60) {
  console.log(`Loading ${count} test tasks for performance testing...`)

  const testTasks = generateTestTasks(count)
  const result = await serviceOrchestrator.createMultipleTasks(testTasks)

  if (result.success) {
    console.log('✅ Test tasks loaded successfully!')
    console.log(`Total tasks created: ${result.summary.successful}`)

    // Count tasks by status
    const allTasks = serviceOrchestrator.getAllTasks()
    const plannedCount = allTasks.filter(t => t.status === 'planned').length
    const inProgressCount = allTasks.filter(t => t.status === 'in_progress').length
    const doneCount = allTasks.filter(t => t.status === 'done').length

    console.log(`📊 Task distribution:`)
    console.log(`  - Planned: ${plannedCount}`)
    console.log(`  - In Progress: ${inProgressCount}`)
    console.log(`  - Done: ${doneCount}`)

    return {
      total: allTasks.length,
      planned: plannedCount,
      inProgress: inProgressCount,
      done: doneCount,
      successful: result.summary.successful,
      failed: result.summary.failed,
      errors: result.errors
    }
  } else {
    console.error('❌ Failed to load test tasks:', result.errors)
    return {
      total: 0,
      planned: 0,
      inProgress: 0,
      done: 0,
      successful: 0,
      failed: result.summary.failed,
      errors: result.errors
    }
  }
}

// Load test projects using ServiceOrchestrator
export async function loadTestProjects(serviceOrchestrator: any, count: number = 5) {
  console.log(`Loading ${count} test projects...`)

  const testProjects = generateTestProjects(count)
  const results = []

  for (const projectData of testProjects) {
    const result = await serviceOrchestrator.createProject(projectData)
    if (result.success && result.data) {
      results.push(result.data)
    }
  }

  console.log(`✅ Test projects loaded successfully! (${results.length}/${count})`)
  return results
}

// Load complete test environment (projects + tasks)
export async function loadTestEnvironment(serviceOrchestrator: any, options: {
  projectCount?: number
  taskCount?: number
  includeTasks?: boolean
  includeProjects?: boolean
} = {}) {
  const {
    projectCount = 5,
    taskCount = 60,
    includeTasks = true,
    includeProjects = true
  } = options

  console.log('🚀 Setting up test environment...')

  const results: any = {
    projects: { loaded: 0, errors: [] },
    tasks: { loaded: 0, errors: [] }
  }

  // Load projects first
  if (includeProjects) {
    try {
      const projects = await loadTestProjects(serviceOrchestrator, projectCount)
      results.projects.loaded = projects.length
    } catch (error) {
      console.error('❌ Failed to load test projects:', error)
      results.projects.errors.push(error instanceof Error ? error.message : 'Unknown error')
    }
  }

  // Then load tasks
  if (includeTasks) {
    try {
      const taskResults = await loadTestTasks(serviceOrchestrator, taskCount)
      results.tasks.loaded = taskResults.successful
      if (taskResults.errors?.length) {
        results.tasks.errors = taskResults.errors
      }
    } catch (error) {
      console.error('❌ Failed to load test tasks:', error)
      results.tasks.errors.push(error instanceof Error ? error.message : 'Unknown error')
    }
  }

  console.log('✅ Test environment setup complete!')
  console.log(`📊 Results: ${results.projects.loaded} projects, ${results.tasks.loaded} tasks loaded`)

  return results
}

// Generate specific test scenarios
export const testScenarios = {
  // Generate tasks for testing drag and drop
  generateDragDropTasks: (count: number = 20): Partial<Task>[] => {
    return Array.from({ length: count }, (_, i) => ({
      title: `Drag Drop Task ${i + 1}`,
      description: `Task for testing drag and drop functionality`,
      status: 'planned' as const,
      priority: ['high', 'medium', 'low'][i % 3] as any,
      projectId: 'drag-drop-test-project',
      tags: ['drag-drop', 'test']
    }))
  },

  // Generate tasks for testing filtering
  generateFilterTestTasks: (): Partial<Task>[] => {
    const tasks: Partial<Task>[] = []

    // Tasks for different status filters
    ['planned', 'in_progress', 'done'].forEach(status => {
      tasks.push({
        title: `Status Test - ${status}`,
        description: `Task for testing ${status} filter`,
        status: status as any,
        priority: 'medium' as any,
        projectId: 'filter-test-project'
      })
    })

    // Tasks for different priority filters
    ['high', 'medium', 'low'].forEach(priority => {
      tasks.push({
        title: `Priority Test - ${priority}`,
        description: `Task for testing ${priority} priority filter`,
        status: 'planned' as any,
        priority: priority as any,
        projectId: 'filter-test-project'
      })
    })

    // Tasks for testing date filters
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const nextWeek = new Date(today)
    nextWeek.setDate(nextWeek.getDate() + 7)

    [
      { date: today.toISOString().split('T')[0], label: 'Today' },
      { date: tomorrow.toISOString().split('T')[0], label: 'Tomorrow' },
      { date: nextWeek.toISOString().split('T')[0], label: 'Next Week' }
    ].forEach(({ date, label }) => {
      tasks.push({
        title: `Date Test - ${label}`,
        description: `Task for testing ${label} date filter`,
        status: 'planned' as any,
        priority: 'medium' as any,
        projectId: 'filter-test-project',
        dueDate: date
      })
    })

    return tasks
  },

  // Generate tasks for testing search functionality
  generateSearchTestTasks: (): Partial<Task>[] => {
    const searchTerms = ['important', 'urgent', 'meeting', 'review', 'development']

    return searchTerms.map(term => ({
      title: `Search Test - ${term}`,
      description: `This task contains the search term "${term}" in description`,
      status: 'planned' as any,
      priority: 'medium' as any,
      projectId: 'search-test-project',
      tags: [term, 'search-test']
    }))
  }
}

// Clean up test data
export async function cleanupTestData(serviceOrchestrator: any) {
  console.log('🧹 Cleaning up test data...')

  const allTasks = serviceOrchestrator.getAllTasks()
  const testTasks = allTasks.filter(task =>
    task.tags?.includes('test') ||
    task.title.includes('Test') ||
    task.projectId?.includes('test')
  )

  if (testTasks.length > 0) {
    const taskIds = testTasks.map(task => task.id)
    const result = await serviceOrchestrator.deleteMultipleTasks(taskIds)

    if (result.success) {
      console.log(`✅ Cleaned up ${result.summary.successful} test tasks`)
    } else {
      console.error('❌ Failed to clean up test tasks:', result.errors)
    }

    return result
  }

  console.log('ℹ️ No test data found to clean up')
  return { success: true, summary: { successful: 0, failed: 0 } }
}

// Validate test data
export function validateTestData(serviceOrchestrator: any) {
  const allTasks = serviceOrchestrator.getAllTasks()
  const testTasks = allTasks.filter(task =>
    task.tags?.includes('test') ||
    task.title.includes('Test')
  )

  const validation = {
    totalTasks: allTasks.length,
    testTasks: testTasks.length,
    hasValidProjects: false,
    hasValidStatuses: false,
    hasValidPriorities: false,
    issues: [] as string[]
  }

  // Check for valid projects
  const projects = serviceOrchestrator.getAllProjects()
  validation.hasValidProjects = projects.length > 0

  // Check for valid statuses
  const validStatuses = ['planned', 'in_progress', 'done', 'backlog', 'on_hold']
  validation.hasValidStatuses = testTasks.every(task =>
    validStatuses.includes(task.status)
  )

  // Check for valid priorities
  const validPriorities = ['high', 'medium', 'low', null]
  validation.hasValidPriorities = testTasks.every(task =>
    validPriorities.includes(task.priority)
  )

  // Identify issues
  if (!validation.hasValidProjects) {
    validation.issues.push('No valid projects found')
  }
  if (!validation.hasValidStatuses) {
    validation.issues.push('Tasks with invalid statuses found')
  }
  if (!validation.hasValidPriorities) {
    validation.issues.push('Tasks with invalid priorities found')
  }

  return validation
}