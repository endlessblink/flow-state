import { useTaskStore } from '@/stores/tasks'

// Generate 60 test tasks for performance testing
export function generateTestTasks(count: number = 60) {
  const statuses = ['planned', 'in_progress', 'done']
  const priorities = ['high', 'medium', 'low']
  const projects = ['1', '2', '3']

  const testTasks = []

  for (let i = 1; i <= count; i++) {
    const status = statuses[i % statuses.length]
    const priority = priorities[i % priorities.length]
    const projectId = projects[i % projects.length]

    testTasks.push({
      id: `test-task-${i}`,
      title: `Test Task ${i} - Performance Testing`,
      description: `This is a test task for performance validation with larger data sets. Testing drag and drop responsiveness with multiple tasks.`,
      status: status as any,
      priority: priority as any,
      projectId: projectId,
      progress: status === 'done' ? 100 : (status === 'in_progress' ? 50 : 0),
      dueDate: new Date(Date.now() + (i * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
      completedPomodoros: Math.floor(Math.random() * 5),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      subtasks: [],
      dependsOn: [],
      tags: ['test', 'performance']
    })
  }

  return testTasks
}

// Load test tasks into store
export function loadTestTasks() {
  const taskStore = useTaskStore()
  const testTasks = generateTestTasks(60)

  console.log('Loading 60 test tasks for performance testing...')

  testTasks.forEach(task => {
    taskStore.createTask(task)
  })

  console.log('✅ Test tasks loaded successfully!')
  console.log(`Total tasks in store: ${taskStore.tasks.length}`)

  // Count tasks by status
  const plannedCount = taskStore.tasks.filter(t => t.status === 'planned').length
  const inProgressCount = taskStore.tasks.filter(t => t.status === 'in_progress').length
  const doneCount = taskStore.tasks.filter(t => t.status === 'done').length

  console.log(`📊 Task distribution:`)
  console.log(`  - Planned: ${plannedCount}`)
  console.log(`  - In Progress: ${inProgressCount}`)
  console.log(`  - Done: ${doneCount}`)

  return {
    total: taskStore.tasks.length,
    planned: plannedCount,
    inProgress: inProgressCount,
    done: doneCount
  }
}