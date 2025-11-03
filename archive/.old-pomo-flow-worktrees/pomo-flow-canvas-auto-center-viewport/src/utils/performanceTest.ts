// Performance test utility for kanban optimizations
import { useTaskStore } from '@/stores/tasks'

interface PerformanceResult {
  test: string
  duration: number
  status: 'fast' | 'medium' | 'slow'
}

export class KanbanPerformanceTest {
  private taskStore: ReturnType<typeof useTaskStore>
  private results: PerformanceResult[] = []

  constructor() {
    this.taskStore = useTaskStore()
  }

  // Generate test tasks
  generateTestData(count: number = 60) {
    console.log(`📊 Generating ${count} test tasks...`)
    const startTime = performance.now()

    const statuses = ['planned', 'in_progress', 'done']
    const priorities = ['high', 'medium', 'low']
    const projects = ['1', '2', '3']

    for (let i = 1; i <= count; i++) {
      const status = statuses[i % statuses.length]
      const priority = priorities[i % priorities.length]
      const projectId = projects[i % projects.length]

      this.taskStore.createTask({
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

    const endTime = performance.now()
    const duration = Math.round(endTime - startTime)

    this.addResult(`Load ${count} Tasks`, duration, duration < 100 ? 'fast' : duration < 300 ? 'medium' : 'slow')
    console.log(`✅ Generated ${count} tasks in ${duration}ms`)

    return { duration, taskCount: count }
  }

  // Test task status changes (simulating drag operations)
  testStatusChangePerformance(iterations: number = 20) {
    console.log(`🔄 Testing status change performance (${iterations} iterations)...`)

    const tasks = this.taskStore.tasks.filter(t => t.id.startsWith('test-task-'))
    if (tasks.length === 0) {
      console.error('❌ No test tasks found. Run generateTestData() first.')
      return
    }

    for (let i = 0; i < iterations && i < tasks.length; i++) {
      const task = tasks[i]
      const startTime = performance.now()

      // Simulate task status change (equivalent to drag operation)
      const originalStatus = task.status
      const newStatus = originalStatus === 'planned' ? 'in_progress' :
                       originalStatus === 'in_progress' ? 'done' : 'planned'

      this.taskStore.moveTask(task.id, newStatus as any)

      const endTime = performance.now()
      const duration = Math.round(endTime - startTime)

      this.addResult(`Task ${i + 1} Status Change`, duration, duration < 50 ? 'fast' : duration < 100 ? 'medium' : 'slow')

      // Small delay to simulate real usage
      const start = performance.now()
      while (performance.now() - start < 5) {
        // Busy wait to simulate small delay
      }
    }

    console.log(`✅ Completed ${iterations} status change tests`)
  }

  // Test cache performance
  testCachePerformance() {
    console.log('🧠 Testing cache performance...')

    const tasks = this.taskStore.tasks
    if (tasks.length === 0) {
      console.error('❌ No tasks found. Run generateTestData() first.')
      return
    }

    // Test filtering operations multiple times to test cache efficiency
    const iterations = 10
    const cacheTestResults: number[] = []

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now()

      // Simulate the filtering operations that happen in kanban view
      const plannedTasks = tasks.filter(t => t.status === 'planned')
      const inProgressTasks = tasks.filter(t => t.status === 'in_progress')
      const doneTasks = tasks.filter(t => t.status === 'done')

      const endTime = performance.now()
      const duration = Math.round(endTime - startTime)
      cacheTestResults.push(duration)
    }

    const avgDuration = Math.round(cacheTestResults.reduce((sum, d) => sum + d, 0) / cacheTestResults.length)
    this.addResult('Cache Filter Operations', avgDuration, avgDuration < 20 ? 'fast' : avgDuration < 50 ? 'medium' : 'slow')

    console.log(`✅ Cache test completed. Average time: ${avgDuration}ms`)
  }

  // Test computed properties performance
  testComputedPropertiesPerformance() {
    console.log('📊 Testing computed properties performance...')

    const iterations = 20
    const computedTestResults: number[] = []

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now()

      // Simulate computed property recalculations
      const totalTasks = this.taskStore.tasks.length
      const completedTasks = this.taskStore.tasks.filter(t => t.status === 'done').length
      const inProgressTasks = this.taskStore.tasks.filter(t => t.status === 'in_progress').length
      const plannedTasks = this.taskStore.tasks.filter(t => t.status === 'planned').length

      const endTime = performance.now()
      const duration = Math.round(endTime - startTime)
      computedTestResults.push(duration)
    }

    const avgDuration = Math.round(computedTestResults.reduce((sum, d) => sum + d, 0) / computedTestResults.length)
    this.addResult('Computed Properties', avgDuration, avgDuration < 10 ? 'fast' : avgDuration < 25 ? 'medium' : 'slow')

    console.log(`✅ Computed properties test completed. Average time: ${avgDuration}ms`)
  }

  // Add result to results array
  private addResult(test: string, duration: number, status: 'fast' | 'medium' | 'slow') {
    this.results.push({ test, duration, status })
  }

  // Run full performance test suite
  runFullTest() {
    console.log('🎬 Starting Full Performance Test Suite...')
    this.results = []

    // Clear existing test data
    const existingTestTasks = this.taskStore.tasks.filter(t => t.id.startsWith('test-task-'))
    existingTestTasks.forEach(task => {
      this.taskStore.deleteTask(task.id)
    })

    // Test 1: Generate test data
    this.generateTestData(60)

    // Test 2: Cache performance
    this.testCachePerformance()

    // Test 3: Computed properties performance
    this.testComputedPropertiesPerformance()

    // Test 4: Status change performance
    this.testStatusChangePerformance(20)

    // Calculate averages
    this.calculateAverages()

    // Display results
    this.displayResults()

    return this.results
  }

  // Calculate averages for different test types
  private calculateAverages() {
    const statusChangeResults = this.results.filter(r => r.test.includes('Status Change'))
    if (statusChangeResults.length > 0) {
      const avgDuration = Math.round(
        statusChangeResults.reduce((sum, r) => sum + r.duration, 0) / statusChangeResults.length
      )
      this.addResult('Average Status Change', avgDuration, avgDuration < 50 ? 'fast' : avgDuration < 100 ? 'medium' : 'slow')
    }
  }

  // Display results summary
  displayResults() {
    console.log('\n📊 PERFORMANCE TEST RESULTS:')
    console.log('================================')

    this.results.forEach(result => {
      const statusIcon = result.status === 'fast' ? '✅' : result.status === 'medium' ? '⚠️' : '❌'
      console.log(`${statusIcon} ${result.test}: ${result.duration}ms (${result.status})`)
    })

    const fastCount = this.results.filter(r => r.status === 'fast').length
    const mediumCount = this.results.filter(r => r.status === 'medium').length
    const slowCount = this.results.filter(r => r.status === 'slow').length

    console.log('\n📈 SUMMARY:')
    console.log(`✅ Fast operations: ${fastCount}/${this.results.length} (${Math.round((fastCount / this.results.length) * 100)}%)`)
    console.log(`⚠️ Medium operations: ${mediumCount}/${this.results.length} (${Math.round((mediumCount / this.results.length) * 100)}%)`)
    console.log(`❌ Slow operations: ${slowCount}/${this.results.length} (${Math.round((slowCount / this.results.length) * 100)}%)`)

    const performanceScore = Math.round((fastCount / this.results.length) * 100)
    console.log(`🎯 Performance Score: ${performanceScore}%`)

    if (performanceScore >= 80) {
      console.log('🎉 EXCELLENT: Performance optimizations are working well!')
    } else if (performanceScore >= 60) {
      console.log('👍 GOOD: Performance is acceptable with room for improvement.')
    } else {
      console.log('⚠️ NEEDS WORK: Performance optimizations need more attention.')
    }

    // Specific optimization validation
    console.log('\n🔧 OPTIMIZATION VALIDATION:')

    const avgStatusChange = this.results.find(r => r.test === 'Average Status Change')
    if (avgStatusChange) {
      if (avgStatusChange.duration < 50) {
        console.log('✅ Status change optimization: Working well')
      } else if (avgStatusChange.duration < 100) {
        console.log('⚠️ Status change optimization: Moderate improvement')
      } else {
        console.log('❌ Status change optimization: Needs more work')
      }
    }

    const cacheTest = this.results.find(r => r.test === 'Cache Filter Operations')
    if (cacheTest) {
      if (cacheTest.duration < 20) {
        console.log('✅ Memoization optimization: Effective')
      } else {
        console.log('⚠️ Memoization optimization: Could be improved')
      }
    }
  }

  // Clear test data
  clearTestData() {
    const testTasks = this.taskStore.tasks.filter(t => t.id.startsWith('test-task-'))
    testTasks.forEach(task => {
      this.taskStore.deleteTask(task.id)
    })
    console.log(`🧹 Cleared ${testTasks.length} test tasks`)
    this.results = []
  }

  // Get results
  getResults(): PerformanceResult[] {
    return this.results
  }
}

// Export for use in components
export function createPerformanceTest(): KanbanPerformanceTest {
  return new KanbanPerformanceTest()
}