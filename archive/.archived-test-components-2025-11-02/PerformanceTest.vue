<template>
  <div class="performance-test">
    <div class="test-controls">
      <h3>Performance Testing Controls</h3>
      <button @click="loadTestData" :disabled="isLoading">
        {{ isLoading ? 'Loading...' : 'Load 60 Test Tasks' }}
      </button>
      <button @click="clearTestData" :disabled="isLoading || !testDataLoaded">
        Clear Test Data
      </button>
      <button @click="runPerformanceTest" :disabled="!testDataLoaded">
        Run Drag Performance Test
      </button>
    </div>

    <div class="test-results" v-if="testResults.length > 0">
      <h4>Performance Results:</h4>
      <div v-for="(result, index) in testResults" :key="index" class="result-item">
        <strong>{{ result.test }}:</strong> {{ result.duration }}ms
        <span v-if="result.status === 'fast'" class="status-fast">✅ Fast</span>
        <span v-else-if="result.status === 'medium'" class="status-medium">⚠️ Medium</span>
        <span v-else class="status-slow">❌ Slow</span>
      </div>
    </div>

    <div class="test-info" v-if="testDataLoaded">
      <h4>Test Data Info:</h4>
      <p>Total Tasks: {{ taskStore.tasks.length }}</p>
      <p>Planned: {{ plannedCount }}</p>
      <p>In Progress: {{ inProgressCount }}</p>
      <p>Done: {{ doneCount }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { generateTestTasks, loadTestTasks } from '@/utils/testDataGenerator'
import { createPerformanceTest } from '@/utils/performanceTest'

const taskStore = useTaskStore()
const isLoading = ref(false)
const testDataLoaded = ref(false)
const testResults = ref<Array<{test: string, duration: number, status: string}>>([])

const plannedCount = computed(() => taskStore.tasks.filter(t => t.status === 'planned').length)
const inProgressCount = computed(() => taskStore.tasks.filter(t => t.status === 'in_progress').length)
const doneCount = computed(() => taskStore.tasks.filter(t => t.status === 'done').length)

const loadTestData = async () => {
  isLoading.value = true
  console.log('🚀 Starting performance test data load...')

  const startTime = performance.now()

  try {
    loadTestTasks()
    testDataLoaded.value = true
    console.log('✅ Test data loaded successfully!')
  } catch (error) {
    console.error('❌ Error loading test data:', error)
  }

  const endTime = performance.now()
  const duration = Math.round(endTime - startTime)

  testResults.value.push({
    test: 'Load 60 Tasks',
    duration,
    status: duration < 100 ? 'fast' : duration < 300 ? 'medium' : 'slow'
  })

  isLoading.value = false
}

const clearTestData = () => {
  // Clear all test tasks (those with 'test-task-' prefix)
  const testTasks = taskStore.tasks.filter(t => t.id.startsWith('test-task-'))
  testTasks.forEach(task => {
    taskStore.deleteTask(task.id)
  })

  testDataLoaded.value = false
  testResults.value = []
  console.log('🧹 Test data cleared')
}

const runPerformanceTest = async () => {
  console.log('🏃‍♂️ Running comprehensive performance test...')
  isLoading.value = true

  try {
    const performanceTest = createPerformanceTest()
    const results = performanceTest.runFullTest()

    // Convert results to our format
    testResults.value = results.map(result => ({
      test: result.test,
      duration: result.duration,
      status: result.status
    }))

    console.log('✅ Performance test completed successfully!')
  } catch (error) {
    console.error('❌ Performance test failed:', error)
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.performance-test {
  position: fixed;
  top: 20px;
  right: 20px;
  background: var(--surface-primary);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  min-width: 300px;
  box-shadow: var(--shadow-lg);
  z-index: 1000;
}

.test-controls {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.test-controls h3 {
  margin: 0 0 var(--space-2) 0;
  color: var(--text-primary);
}

.test-controls button {
  background: var(--state-active-bg);
  color: var(--state-active-text);
  border: 1px solid var(--state-active-border);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  transition: all var(--duration-normal) ease;
}

.test-controls button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--state-hover-shadow);
}

.test-controls button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.test-results {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-subtle);
}

.test-results h4 {
  margin: 0 0 var(--space-2) 0;
  color: var(--text-primary);
}

.result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-1) 0;
  font-size: var(--text-sm);
}

.status-fast {
  color: var(--color-success);
}

.status-medium {
  color: var(--color-warning);
}

.status-slow {
  color: var(--color-danger);
}

.test-info {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-subtle);
}

.test-info h4 {
  margin: 0 0 var(--space-2) 0;
  color: var(--text-primary);
}

.test-info p {
  margin: var(--space-1) 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
</style>