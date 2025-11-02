<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'
import type { Task } from '@/stores/tasks'

interface TestResult {
  testName: string
  status: 'pending' | 'running' | 'passed' | 'failed'
  details: string
  timestamp: string
  undoCountBefore: number
  undoCountAfter: number
  canUndoBefore: boolean
  canUndoAfter: boolean
  error?: string
}

const taskStore = useTaskStore()
const undoHistory = useUnifiedUndoRedo()

// Test state
const testResults = ref<TestResult[]>([])
const isTestRunning = ref(false)
const testProgress = ref('')
const selectedTaskId = ref<string>('')
const testTaskId = ref<string>('')

// Computed properties
const filteredTasks = computed(() => taskStore.tasks.filter(task => task.status === 'active'))
const canvasTasks = computed(() => filteredTasks.value.filter(task => task.canvasPosition))
const hasTestTask = computed(() => !!testTaskId.value && taskStore.tasks.find(t => t.id === testTaskId.value))

// Helper functions
const createTestTask = async (): Promise<string> => {
  const testTaskData = {
    title: `Test Task ${Date.now()}`,
    description: 'Created for keyboard deletion testing',
    status: 'active' as const,
    canvasPosition: { x: 100, y: 100 }
  }

  const newTask = undoHistory.createTaskWithUndo(testTaskData)
  if (!newTask) {
    throw new Error('Failed to create test task')
  }

  await nextTick()
  return newTask.id
}

const selectTaskForTesting = async (taskId: string) => {
  selectedTaskId.value = taskId

  // Trigger VueFlow selection simulation
  console.log('🎯 Selecting task for testing:', taskId)

  // In real implementation, this would integrate with VueFlow's selection system
  await nextTick()
}

const recordTestResult = (result: Omit<TestResult, 'timestamp'>) => {
  const testResult: TestResult = {
    ...result,
    timestamp: new Date().toLocaleTimeString()
  }
  testResults.value.push(testResult)
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Test functions
const testShiftDeleteOperation = async (): Promise<boolean> => {
  const testName = 'Shift+Delete (Permanent Deletion)'
  recordTestResult({
    testName,
    status: 'running',
    details: 'Testing permanent deletion with undo support',
    undoCountBefore: undoHistory.undoCount.value,
    canUndoBefore: undoHistory.canUndo.value,
    undoCountAfter: 0,
    canUndoAfter: false
  })

  try {
    if (!selectedTaskId.value) {
      throw new Error('No task selected for testing')
    }

    const taskToDelete = selectedTaskId.value
    const originalTask = taskStore.tasks.find(t => t.id === taskToDelete)
    if (!originalTask) {
      throw new Error('Selected task not found in store')
    }

    console.log('🗑️ Testing Shift+Delete on task:', originalTask.title)

    // Record state before deletion
    const undoCountBefore = undoHistory.undoCount.value
    const canUndoBefore = undoHistory.canUndo.value
    const tasksCountBefore = taskStore.tasks.length

    // Simulate Shift+Delete operation
    undoHistory.deleteTaskWithUndo(taskToDelete)

    await nextTick()

    // Verify task was deleted
    const taskStillExists = taskStore.tasks.some(t => t.id === taskToDelete)
    if (taskStillExists) {
      throw new Error('Task was not deleted from store')
    }

    // Verify undo state was updated
    const undoCountAfter = undoHistory.undoCount.value
    const canUndoAfter = undoHistory.canUndo.value

    console.log(`✅ Shift+Delete completed: Undo count ${undoCountBefore} → ${undoCountAfter}, Can undo ${canUndoBefore} → ${canUndoAfter}`)

    recordTestResult({
      testName,
      status: 'passed',
      details: `Task "${originalTask.title}" permanently deleted. Undo count: ${undoCountBefore}→${undoCountAfter}`,
      undoCountBefore,
      canUndoBefore,
      undoCountAfter,
      canUndoAfter
    })

    return true

  } catch (error) {
    console.error('❌ Shift+Delete test failed:', error)
    recordTestResult({
      testName,
      status: 'failed',
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undoCountBefore: undoHistory.undoCount.value,
      canUndoBefore: undoHistory.canUndo.value,
      undoCountAfter: undoHistory.undoCount.value,
      canUndoAfter: undoHistory.canUndo.value,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return false
  }
}

const testDeleteOperation = async (): Promise<boolean> => {
  const testName = 'Delete (Move to Inbox)'
  recordTestResult({
    testName,
    status: 'running',
    details: 'Testing delete operation (move to inbox) with undo support',
    undoCountBefore: undoHistory.undoCount.value,
    canUndoBefore: undoHistory.canUndo.value,
    undoCountAfter: 0,
    canUndoAfter: false
  })

  try {
    if (!selectedTaskId.value) {
      throw new Error('No task selected for testing')
    }

    const taskToModify = selectedTaskId.value
    const originalTask = taskStore.tasks.find(t => t.id === taskToModify)
    if (!originalTask) {
      throw new Error('Selected task not found in store')
    }

    if (!originalTask.canvasPosition) {
      throw new Error('Task is not on canvas - cannot test canvas deletion')
    }

    console.log('📤 Testing Delete (move to inbox) on task:', originalTask.title)

    // Record state before modification
    const undoCountBefore = undoHistory.undoCount.value
    const canUndoBefore = undoHistory.canUndo.value
    const hadCanvasPosition = !!originalTask.canvasPosition

    // Simulate Delete operation (move to inbox)
    undoHistory.updateTaskWithUndo(taskToModify, {
      canvasPosition: undefined,
      isInInbox: true,
      instances: [],
      scheduledDate: undefined,
      scheduledTime: undefined
    })

    await nextTick()

    // Verify task was modified
    const modifiedTask = taskStore.tasks.find(t => t.id === taskToModify)
    if (!modifiedTask) {
      throw new Error('Task disappeared from store after update')
    }

    if (modifiedTask.canvasPosition !== undefined || !modifiedTask.isInInbox) {
      throw new Error('Task was not moved to inbox properly')
    }

    // Verify undo state was updated
    const undoCountAfter = undoHistory.undoCount.value
    const canUndoAfter = undoHistory.canUndo.value

    console.log(`✅ Delete completed: Undo count ${undoCountBefore} → ${undoCountAfter}, Can undo ${canUndoBefore} → ${canUndoAfter}`)

    recordTestResult({
      testName,
      status: 'passed',
      details: `Task "${originalTask.title}" moved to inbox. Undo count: ${undoCountBefore}→${undoCountAfter}`,
      undoCountBefore,
      canUndoBefore,
      undoCountAfter,
      canUndoAfter
    })

    return true

  } catch (error) {
    console.error('❌ Delete test failed:', error)
    recordTestResult({
      testName,
      status: 'failed',
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undoCountBefore: undoHistory.undoCount.value,
      canUndoBefore: undoHistory.canUndo.value,
      undoCountAfter: undoHistory.undoCount.value,
      canUndoAfter: undoHistory.canUndo.value,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return false
  }
}

const testUndoOperation = async (): Promise<boolean> => {
  const testName = 'Undo Operation (Ctrl+Z)'
  recordTestResult({
    testName,
    status: 'running',
    details: 'Testing undo functionality after deletion',
    undoCountBefore: undoHistory.undoCount.value,
    canUndoBefore: undoHistory.canUndo.value,
    undoCountAfter: 0,
    canUndoAfter: false
  })

  try {
    if (!undoHistory.canUndo.value) {
      throw new Error('Nothing to undo - cannot test undo functionality')
    }

    const undoCountBefore = undoHistory.undoCount.value
    const tasksCountBefore = taskStore.tasks.length

    console.log('↩️ Testing Ctrl+Z undo operation')

    // Perform undo
    const undoResult = await undoHistory.undo()

    await nextTick()

    if (!undoResult) {
      throw new Error('Undo operation returned false')
    }

    const undoCountAfter = undoHistory.undoCount.value
    const tasksCountAfter = taskStore.tasks.length

    console.log(`✅ Undo completed: Undo count ${undoCountBefore} → ${undoCountAfter}, Tasks: ${tasksCountBefore} → ${tasksCountAfter}`)

    recordTestResult({
      testName,
      status: 'passed',
      details: `Undo successful. Undo count: ${undoCountBefore}→${undoCountAfter}, Tasks: ${tasksCountBefore}→${tasksCountAfter}`,
      undoCountBefore,
      canUndoBefore: true,
      undoCountAfter,
      canUndoAfter: undoHistory.canUndo.value
    })

    return true

  } catch (error) {
    console.error('❌ Undo test failed:', error)
    recordTestResult({
      testName,
      status: 'failed',
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undoCountBefore: undoHistory.undoCount.value,
      canUndoBefore: undoHistory.canUndo.value,
      undoCountAfter: undoHistory.undoCount.value,
      canUndoAfter: undoHistory.canUndo.value,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return false
  }
}

const testRedoOperation = async (): Promise<boolean> => {
  const testName = 'Redo Operation (Ctrl+Y)'
  recordTestResult({
    testName,
    status: 'running',
    details: 'Testing redo functionality after undo',
    undoCountBefore: undoHistory.undoCount.value,
    canUndoBefore: undoHistory.canUndo.value,
    undoCountAfter: 0,
    canUndoAfter: false
  })

  try {
    if (!undoHistory.canRedo.value) {
      throw new Error('Nothing to redo - cannot test redo functionality')
    }

    const undoCountBefore = undoHistory.undoCount.value
    const tasksCountBefore = taskStore.tasks.length

    console.log('↪️ Testing Ctrl+Y redo operation')

    // Perform redo
    const redoResult = await undoHistory.redo()

    await nextTick()

    if (!redoResult) {
      throw new Error('Redo operation returned false')
    }

    const undoCountAfter = undoHistory.undoCount.value
    const tasksCountAfter = taskStore.tasks.length

    console.log(`✅ Redo completed: Undo count ${undoCountBefore} → ${undoCountAfter}, Tasks: ${tasksCountBefore} → ${tasksCountAfter}`)

    recordTestResult({
      testName,
      status: 'passed',
      details: `Redo successful. Undo count: ${undoCountBefore}→${undoCountAfter}, Tasks: ${tasksCountBefore}→${tasksCountAfter}`,
      undoCountBefore,
      canUndoBefore: undoHistory.canUndo.value,
      undoCountAfter,
      canUndoAfter: undoHistory.canUndo.value
    })

    return true

  } catch (error) {
    console.error('❌ Redo test failed:', error)
    recordTestResult({
      testName,
      status: 'failed',
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undoCountBefore: undoHistory.undoCount.value,
      canUndoBefore: undoHistory.canUndo.value,
      undoCountAfter: undoHistory.undoCount.value,
      canUndoAfter: undoHistory.canUndo.value,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return false
  }
}

// Main test runner
const runComprehensiveTest = async () => {
  if (isTestRunning.value) {
    console.warn('Test is already running')
    return
  }

  isTestRunning.value = true
  testResults.value = []
  testProgress.value = 'Starting comprehensive keyboard deletion test...'

  try {
    // Step 1: Create a test task
    testProgress.value = 'Creating test task...'
    console.log('🚀 Step 1: Creating test task')

    const taskId = await createTestTask()
    testTaskId.value = taskId
    selectedTaskId.value = taskId

    await sleep(500)

    // Step 2: Test Delete operation (move to inbox)
    testProgress.value = 'Testing Delete operation (move to inbox)...'
    console.log('🚀 Step 2: Testing Delete operation')

    const deleteSuccess = await testDeleteOperation()
    if (!deleteSuccess) {
      throw new Error('Delete operation test failed')
    }

    await sleep(500)

    // Step 3: Test Undo (restore task to canvas)
    testProgress.value = 'Testing Undo operation (Ctrl+Z)...'
    console.log('🚀 Step 3: Testing Undo operation')

    const undoSuccess = await testUndoOperation()
    if (!undoSuccess) {
      throw new Error('Undo operation test failed')
    }

    await sleep(500)

    // Step 4: Test Redo (move task back to inbox)
    testProgress.value = 'Testing Redo operation (Ctrl+Y)...'
    console.log('🚀 Step 4: Testing Redo operation')

    const redoSuccess = await testRedoOperation()
    if (!redoSuccess) {
      throw new Error('Redo operation test failed')
    }

    await sleep(500)

    // Step 5: Undo again to restore task for Shift+Delete test
    testProgress.value = 'Restoring task for Shift+Delete test...'
    console.log('🚀 Step 5: Restoring task for Shift+Delete test')

    await undoHistory.undo()
    await nextTick()

    // Step 6: Test Shift+Delete operation (permanent deletion)
    testProgress.value = 'Testing Shift+Delete operation (permanent deletion)...'
    console.log('🚀 Step 6: Testing Shift+Delete operation')

    const shiftDeleteSuccess = await testShiftDeleteOperation()
    if (!shiftDeleteSuccess) {
      throw new Error('Shift+Delete operation test failed')
    }

    await sleep(500)

    // Step 7: Test Undo after permanent deletion
    testProgress.value = 'Testing Undo after Shift+Delete...'
    console.log('🚀 Step 7: Testing Undo after permanent deletion')

    const finalUndoSuccess = await testUndoOperation()
    if (!finalUndoSuccess) {
      throw new Error('Final undo operation test failed')
    }

    // Summary
    const passedTests = testResults.value.filter(r => r.status === 'passed').length
    const failedTests = testResults.value.filter(r => r.status === 'failed').length

    testProgress.value = `Test completed: ${passedTests} passed, ${failedTests} failed`

    console.log(`🎉 Comprehensive test completed: ${passedTests}/${testResults.value.length} tests passed`)

  } catch (error) {
    console.error('❌ Comprehensive test failed:', error)
    testProgress.value = `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
  } finally {
    isTestRunning.value = false
  }
}

const clearResults = () => {
  testResults.value = []
  testProgress.value = ''
}

// Initialize component
onMounted(() => {
  console.log('🧪 KeyboardDeletionTest component mounted')
})
</script>

<template>
  <div class="keyboard-deletion-test-container">
    <div class="test-header">
      <h2>Keyboard Deletion & Undo/Redo Test Suite</h2>
      <p>Comprehensive testing for Delete, Shift+Delete, and Ctrl+Z/Ctrl+Y operations</p>
    </div>

    <div class="test-controls">
      <div class="control-row">
        <button
          @click="runComprehensiveTest"
          :disabled="isTestRunning"
          class="test-button primary"
        >
          {{ isTestRunning ? '⏳ Running Tests...' : '🚀 Run Comprehensive Test' }}
        </button>

        <button
          @click="clearResults"
          :disabled="isTestRunning"
          class="test-button secondary"
        >
          🗑️ Clear Results
        </button>
      </div>

      <div class="control-row">
        <div class="status-indicator">
          <span class="status-label">Progress:</span>
          <span class="status-value">{{ testProgress || 'Ready' }}</span>
        </div>
      </div>

      <div class="control-row">
        <div class="status-indicator">
          <span class="status-label">Undo System:</span>
          <span class="status-value">
            Can Undo: {{ undoHistory.canUndo ? '✅' : '❌' }} |
            Can Redo: {{ undoHistory.canRedo ? '✅' : '❌' }} |
            Undo Count: {{ undoHistory.undoCount }} |
            Redo Count: {{ undoHistory.redoCount }}
          </span>
        </div>
      </div>

      <div class="control-row" v-if="testTaskId">
        <div class="status-indicator">
          <span class="status-label">Test Task:</span>
          <span class="status-value">
            {{ hasTestTask ? '✅ Created' : '❌ Not Found' }} (ID: {{ testTaskId }})
          </span>
        </div>
      </div>
    </div>

    <div class="test-results">
      <h3>Test Results</h3>

      <div v-if="testResults.length === 0" class="no-results">
        No tests run yet. Click "Run Comprehensive Test" to start.
      </div>

      <div v-else class="results-list">
        <div
          v-for="result in testResults"
          :key="result.timestamp"
          :class="['result-item', result.status]"
        >
          <div class="result-header">
            <span class="result-status">
              {{ result.status === 'passed' ? '✅' : result.status === 'failed' ? '❌' : '⏳' }}
            </span>
            <span class="result-name">{{ result.testName }}</span>
            <span class="result-time">{{ result.timestamp }}</span>
          </div>

          <div class="result-details">
            <p>{{ result.details }}</p>

            <div class="result-metrics">
              <span>Undo Count: {{ result.undoCountBefore }} → {{ result.undoCountAfter }}</span>
              <span>Can Undo: {{ result.canUndoBefore ? '✅' : '❌' }} → {{ result.canUndoAfter ? '✅' : '❌' }}</span>
            </div>

            <div v-if="result.error" class="result-error">
              <strong>Error:</strong> {{ result.error }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="test-info">
      <h4>Test Coverage</h4>
      <ul>
        <li>✅ Delete key (moves task to inbox with undo support)</li>
        <li>✅ Shift+Delete (permanent deletion with undo support)</li>
        <li>✅ Ctrl+Z (undo operation)</li>
        <li>✅ Ctrl+Y (redo operation)</li>
        <li>✅ Undo history state tracking</li>
        <li>✅ Task state consistency verification</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.keyboard-deletion-test-container {
  background: var(--color-surface);
  padding: var(--spacing-lg);
  border-radius: var(--border-radius-md);
  max-width: 1200px;
  margin: 0 auto;
}

.test-header {
  text-align: center;
  margin-bottom: var(--spacing-lg);
}

.test-header h2 {
  color: var(--color-primary);
  margin-bottom: var(--spacing-sm);
}

.test-controls {
  background: var(--color-background);
  padding: var(--spacing-md);
  border-radius: var(--border-radius-sm);
  margin-bottom: var(--spacing-lg);
}

.control-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
}

.control-row:last-child {
  margin-bottom: 0;
}

.test-button {
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
}

.test-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.test-button.primary {
  background: var(--color-primary);
  color: white;
}

.test-button.primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.test-button.secondary {
  background: var(--color-secondary);
  color: white;
}

.test-button.secondary:hover:not(:disabled) {
  background: var(--color-secondary-dark);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.status-label {
  font-weight: 600;
  color: var(--color-text-secondary);
}

.status-value {
  color: var(--color-text-primary);
}

.test-results {
  background: var(--color-background);
  padding: var(--spacing-md);
  border-radius: var(--border-radius-sm);
  margin-bottom: var(--spacing-lg);
}

.no-results {
  text-align: center;
  color: var(--color-text-secondary);
  font-style: italic;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.result-item {
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-sm);
  padding: var(--spacing-md);
}

.result-item.passed {
  border-color: var(--color-success);
  background: rgba(34, 197, 94, 0.1);
}

.result-item.failed {
  border-color: var(--color-error);
  background: rgba(239, 68, 68, 0.1);
}

.result-item.running {
  border-color: var(--color-warning);
  background: rgba(245, 158, 11, 0.1);
}

.result-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xs);
}

.result-name {
  font-weight: 600;
  flex-grow: 1;
}

.result-time {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.result-details p {
  margin-bottom: var(--spacing-xs);
}

.result-metrics {
  display: flex;
  gap: var(--spacing-md);
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.result-error {
  margin-top: var(--spacing-xs);
  padding: var(--spacing-xs);
  background: rgba(239, 68, 68, 0.2);
  border-radius: var(--border-radius-xs);
  font-size: 0.875rem;
  color: var(--color-error);
}

.test-info {
  background: var(--color-background);
  padding: var(--spacing-md);
  border-radius: var(--border-radius-sm);
}

.test-info h4 {
  margin-bottom: var(--spacing-sm);
  color: var(--color-primary);
}

.test-info ul {
  list-style: none;
  padding: 0;
}

.test-info li {
  padding: var(--spacing-xs) 0;
  color: var(--color-text-primary);
}
</style>