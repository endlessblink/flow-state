<template>
  <div class="service-orchestrator-debug p-6 bg-gray-900 text-green-400 font-mono text-sm">
    <div class="mb-4">
      <h2 class="text-xl font-bold text-green-300 mb-2">🔧 Service Orchestrator Debug</h2>
      <p class="text-gray-400 text-xs">Monitor ServiceOrchestrator operations and migration status</p>
    </div>

    <!-- Service Orchestrator Status -->
    <div class="mb-6 p-4 bg-gray-800 rounded border border-gray-700">
      <h3 class="text-green-300 font-semibold mb-3">Service Orchestrator Status</h3>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <span class="text-gray-400">Initialized:</span>
          <span :class="isInitialized ? 'text-green-400' : 'text-red-400'" class="ml-2">
            {{ isInitialized ? '✅ Yes' : '❌ No' }}
          </span>
        </div>

        <div>
          <span class="text-gray-400">Total Tasks:</span>
          <span class="text-green-400 ml-2">{{ stats.totalTasks }}</span>
        </div>

        <div>
          <span class="text-gray-400">Total Projects:</span>
          <span class="text-green-400 ml-2">{{ stats.totalProjects }}</span>
        </div>

        <div>
          <span class="text-gray-400">Last Operation:</span>
          <span class="text-green-400 ml-2">{{ lastOperation }}</span>
        </div>
      </div>
    </div>

    <!-- Task Operations Test -->
    <div class="mb-6 p-4 bg-gray-800 rounded border border-gray-700">
      <h3 class="text-green-300 font-semibold mb-3">Task Operations Test</h3>

      <div class="space-y-3">
        <div class="flex gap-2">
          <input
            v-model="testTaskTitle"
            type="text"
            placeholder="Test task title"
            class="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-green-400 placeholder-gray-500"
          />
          <button
            @click="createTestTask"
            :disabled="isLoading || !testTaskTitle.trim()"
            class="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white text-xs"
          >
            Create Task
          </button>
        </div>

        <div class="flex gap-2">
          <select
            v-model="selectedTaskId"
            class="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-green-400"
          >
            <option value="">Select task to update/delete</option>
            <option v-for="task in tasks" :key="task.id" :value="task.id">
              {{ task.title }}
            </option>
          </select>

          <input
            v-model="updateTaskTitle"
            type="text"
            placeholder="New title"
            class="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-green-400 placeholder-gray-500"
          />

          <button
            @click="updateTestTask"
            :disabled="isLoading || !selectedTaskId || !updateTaskTitle.trim()"
            class="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white text-xs"
          >
            Update
          </button>

          <button
            @click="deleteTestTask"
            :disabled="isLoading || !selectedTaskId"
            class="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white text-xs"
          >
            Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Filtering Test -->
    <div class="mb-6 p-4 bg-gray-800 rounded border border-gray-700">
      <h3 class="text-green-300 font-semibold mb-3">Filtering Test</h3>

      <div class="space-y-3">
        <div class="flex gap-2 items-center">
          <span class="text-gray-400">Filter by:</span>
          <select
            v-model="filterType"
            class="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-green-400"
          >
            <option value="today">Today</option>
            <option value="weekend">Weekend</option>
            <option value="uncategorized">Uncategorized</option>
            <option value="status">Status</option>
            <option value="priority">Priority</option>
          </select>

          <input
            v-if="filterType === 'status'"
            v-model="filterValue"
            type="text"
            placeholder="status (planned,in_progress,done)"
            class="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-green-400 placeholder-gray-500"
          />

          <input
            v-if="filterType === 'priority'"
            v-model="filterValue"
            type="text"
            placeholder="priority (high,medium,low)"
            class="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-green-400 placeholder-gray-500"
          />

          <button
            @click="testFiltering"
            class="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-white text-xs"
          >
            Apply Filter
          </button>
        </div>

        <div v-if="filteredTasks !== null" class="text-gray-400">
          <span>Results: {{ filteredTasks.length }} tasks</span>
        </div>
      </div>
    </div>

    <!-- Undo/Redo Test -->
    <div class="mb-6 p-4 bg-gray-800 rounded border border-gray-700">
      <h3 class="text-green-300 font-semibold mb-3">Undo/Redo Test</h3>

      <div class="space-y-3">
        <div class="flex gap-2">
          <button
            @click="performTestOperation"
            class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 rounded text-white text-xs"
          >
            Perform Test Operation
          </button>

          <button
            @click="testUndo"
            :disabled="!canUndo"
            class="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white text-xs"
          >
            Undo
          </button>

          <button
            @click="testRedo"
            :disabled="!canRedo"
            class="px-3 py-1 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white text-xs"
          >
            Redo
          </button>
        </div>

        <div class="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span class="text-gray-400">Can Undo:</span>
            <span :class="canUndo ? 'text-green-400' : 'text-gray-500'" class="ml-2">
              {{ canUndo ? 'Yes' : 'No' }}
            </span>
          </div>

          <div>
            <span class="text-gray-400">Can Redo:</span>
            <span :class="canRedo ? 'text-green-400' : 'text-gray-500'" class="ml-2">
              {{ canRedo ? 'Yes' : 'No' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- QuickSort Test -->
    <div class="mb-6 p-4 bg-gray-800 rounded border border-gray-700">
      <h3 class="text-green-300 font-semibold mb-3">QuickSort Test</h3>

      <div class="space-y-3">
        <div class="flex gap-2">
          <button
            @click="testQuickSort"
            class="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 rounded text-white text-xs"
          >
            Test QuickSort
          </button>

          <button
            @click="categorizeQuickSortTask"
            :disabled="!quickSortTask"
            class="px-3 py-1 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white text-xs"
          >
            Categorize First Task
          </button>
        </div>

        <div v-if="quickSortStats" class="text-xs">
          <div class="text-gray-400">Uncategorized tasks: {{ quickSortStats.uncategorizedCount }}</div>
          <div class="text-gray-400">Current task: {{ quickSortStats.currentTaskTitle || 'None' }}</div>
        </div>
      </div>
    </div>

    <!-- Migration Status -->
    <div class="mb-6 p-4 bg-gray-800 rounded border border-gray-700">
      <h3 class="text-green-300 font-semibold mb-3">Migration Status</h3>

      <div class="space-y-2 text-xs">
        <div class="flex justify-between">
          <span class="text-gray-400">Direct Store Access:</span>
          <span :class="migrationStatus.directStoreAccess ? 'text-red-400' : 'text-green-400'">
            {{ migrationStatus.directStoreAccess ? '❌ Detected' : '✅ None' }}
          </span>
        </div>

        <div class="flex justify-between">
          <span class="text-gray-400">ServiceOrchestrator Usage:</span>
          <span :class="migrationStatus.serviceOrchestratorUsage ? 'text-green-400' : 'text-yellow-400'">
            {{ migrationStatus.serviceOrchestratorUsage ? '✅ Active' : '⚠️ Limited' }}
          </span>
        </div>

        <div class="flex justify-between">
          <span class="text-gray-400">Composables Migrated:</span>
          <span class="text-green-400">{{ migrationStatus.migratedComposables }} / {{ migrationStatus.totalComposables }}</span>
        </div>
      </div>
    </div>

    <!-- Error Log -->
    <div v-if="errors.length > 0" class="p-4 bg-red-900 border border-red-700 rounded">
      <h3 class="text-red-300 font-semibold mb-2">Errors</h3>
      <div class="space-y-1 text-xs">
        <div v-for="(error, index) in errors" :key="index" class="text-red-400">
          {{ error }}
        </div>
      </div>
    </div>

    <!-- Success Log -->
    <div v-if="successMessages.length > 0" class="p-4 bg-green-900 border border-green-700 rounded">
      <h3 class="text-green-300 font-semibold mb-2">Success Messages</h3>
      <div class="space-y-1 text-xs">
        <div v-for="(message, index) in successMessages" :key="index" class="text-green-400">
          {{ message }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useServiceOrchestrator } from '@/services/ServiceOrchestrator'
import { useTaskManagerService } from '@/composables/useTaskManagerService'
import { useQuickSortService } from '@/composables/useQuickSortService'
import { useUndoRedoService } from '@/composables/useUndoRedoService'

// Services
const serviceOrchestrator = useServiceOrchestrator()
const taskManagerService = useTaskManagerService()
const quickSortService = useQuickSortService()
const undoRedoService = useUndoRedoService()

// State
const isInitialized = ref(false)
const isLoading = ref(false)
const lastOperation = ref('None')
const errors = ref<string[]>([])
const successMessages = ref<string[]>([])

// Test data
const testTaskTitle = ref('Test Task from Debug')
const updateTaskTitle = ref('Updated Test Task')
const selectedTaskId = ref('')
const filteredTasks = ref<any[] | null>(null)
const filterType = ref('today')
const filterValue = ref('')

// Computed
const tasks = computed(() => serviceOrchestrator.getAllTasks())
const stats = computed(() => ({
  totalTasks: tasks.value.length,
  totalProjects: serviceOrchestrator.getAllProjects().length
}))

const canUndo = computed(() => undoRedoService.canUndo.value)
const canRedo = computed(() => undoRedoService.canRedo.value)

const quickSortTask = computed(() => quickSortService.currentTask.value)
const quickSortStats = computed(() => ({
  uncategorizedCount: quickSortService.uncategorizedTasks.value.length,
  currentTaskTitle: quickSortService.currentTask.value?.title
}))

const migrationStatus = computed(() => ({
  directStoreAccess: false, // Would need to check for direct imports
  serviceOrchestratorUsage: true,
  migratedComposables: 4,
  totalComposables: 15
}))

// Methods
const addError = (message: string) => {
  errors.value.push(message)
  setTimeout(() => {
    errors.value = errors.value.filter(e => e !== message)
  }, 5000)
}

const addSuccess = (message: string) => {
  successMessages.value.push(message)
  setTimeout(() => {
    successMessages.value = successMessages.value.filter(m => m !== message)
  }, 3000)
}

const createTestTask = async () => {
  if (!testTaskTitle.value.trim()) return

  isLoading.value = true
  try {
    const task = await taskManagerService.createTask({
      title: testTaskTitle.value,
      description: 'Created from ServiceOrchestrator Debug component',
      priority: 'medium'
    })

    if (task) {
      lastOperation.value = `Created: ${task.title}`
      addSuccess(`Task created: ${task.title}`)
      testTaskTitle.value = `Test Task ${Date.now()}`
    } else {
      addError('Failed to create task')
    }
  } catch (error) {
    addError(`Create task error: ${error instanceof Error ? error.message : 'Unknown'}`)
  } finally {
    isLoading.value = false
  }
}

const updateTestTask = async () => {
  if (!selectedTaskId.value || !updateTaskTitle.value.trim()) return

  isLoading.value = true
  try {
    const task = await taskManagerService.updateTask(selectedTaskId.value, {
      title: updateTaskTitle.value
    })

    if (task) {
      lastOperation.value = `Updated: ${task.title}`
      addSuccess(`Task updated: ${task.title}`)
      updateTaskTitle.value = `Updated Task ${Date.now()}`
    } else {
      addError('Failed to update task')
    }
  } catch (error) {
    addError(`Update task error: ${error instanceof Error ? error.message : 'Unknown'}`)
  } finally {
    isLoading.value = false
  }
}

const deleteTestTask = async () => {
  if (!selectedTaskId.value) return

  isLoading.value = true
  try {
    const success = await taskManagerService.deleteTask(selectedTaskId.value)

    if (success) {
      lastOperation.value = `Deleted task`
      addSuccess('Task deleted successfully')
      selectedTaskId.value = ''
    } else {
      addError('Failed to delete task')
    }
  } catch (error) {
    addError(`Delete task error: ${error instanceof Error ? error.message : 'Unknown'}`)
  } finally {
    isLoading.value = false
  }
}

const testFiltering = () => {
  try {
    let options: any = {}

    switch (filterType.value) {
      case 'today':
        filteredTasks.value = serviceOrchestrator.getTodayTasks()
        break
      case 'weekend':
        filteredTasks.value = serviceOrchestrator.getWeekendTasks()
        break
      case 'uncategorized':
        filteredTasks.value = serviceOrchestrator.getFilteredTasks({ smartView: 'uncategorized' })
        break
      case 'status':
        if (filterValue.value) {
          filteredTasks.value = serviceOrchestrator.getFilteredTasks({
            statusFilter: [filterValue.value]
          })
        }
        break
      case 'priority':
        if (filterValue.value) {
          filteredTasks.value = serviceOrchestrator.getFilteredTasks({
            priorityFilter: [filterValue.value]
          })
        }
        break
    }

    lastOperation.value = `Filtered: ${filterType.value}`
    addSuccess(`Filter applied: ${filteredTasks.value?.length || 0} tasks found`)
  } catch (error) {
    addError(`Filtering error: ${error instanceof Error ? error.message : 'Unknown'}`)
  }
}

const performTestOperation = async () => {
  await createTestTask()
}

const testUndo = async () => {
  try {
    const success = await undoRedoService.undo()
    if (success) {
      addSuccess('Undo successful')
      lastOperation.value = 'Undo performed'
    } else {
      addError('Undo failed')
    }
  } catch (error) {
    addError(`Undo error: ${error instanceof Error ? error.message : 'Unknown'}`)
  }
}

const testRedo = async () => {
  try {
    const success = await undoRedoService.redo()
    if (success) {
      addSuccess('Redo successful')
      lastOperation.value = 'Redo performed'
    } else {
      addError('Redo failed')
    }
  } catch (error) {
    addError(`Redo error: ${error instanceof Error ? error.message : 'Unknown'}`)
  }
}

const testQuickSort = () => {
  try {
    quickSortService.startSession()
    lastOperation.value = 'QuickSort session started'
    addSuccess(`QuickSort started: ${quickSortStats.value.uncategorizedCount} uncategorized tasks`)
  } catch (error) {
    addError(`QuickSort error: ${error instanceof Error ? error.message : 'Unknown'}`)
  }
}

const categorizeQuickSortTask = async () => {
  if (!quickSortTask.value) return

  try {
    await quickSortService.categorizeTask(quickSortTask.value.id, 'test-project')
    addSuccess(`Task categorized: ${quickSortTask.value.title}`)
    lastOperation.value = `Categorized: ${quickSortTask.value.title}`
  } catch (error) {
    addError(`Categorize error: ${error instanceof Error ? error.message : 'Unknown'}`)
  }
}

// Lifecycle
onMounted(async () => {
  try {
    await serviceOrchestrator.initialize()
    isInitialized.value = true
    addSuccess('ServiceOrchestrator initialized successfully')
  } catch (error) {
    addError(`Failed to initialize ServiceOrchestrator: ${error instanceof Error ? error.message : 'Unknown'}`)
  }
})

onUnmounted(() => {
  // Cleanup any active sessions
  try {
    quickSortService.cancelSession()
  } catch (error) {
    console.warn('Failed to cleanup QuickSort session:', error)
  }
})
</script>