<template>
  <div class="p-6 bg-gray-50 min-h-screen">
    <div class="max-w-4xl mx-auto">
      <h1 class="text-3xl font-bold text-gray-900 mb-6">ServiceOrchestrator Migration Test</h1>

      <!-- Status Card -->
      <div class="bg-white rounded-lg shadow p-6 mb-6">
        <h2 class="text-xl font-semibold mb-4">Migration Status</h2>
        <div class="grid grid-cols-2 gap-4">
          <div class="p-4 bg-green-50 rounded">
            <h3 class="font-medium text-green-800">Composables Migrated</h3>
            <p class="text-2xl font-bold text-green-600">4 / 15</p>
          </div>
          <div class="p-4 bg-blue-50 rounded">
            <h3 class="font-medium text-blue-800">Service Orchestrator</h3>
            <p class="text-2xl font-bold text-blue-600">{{ isInitialized ? '✅ Active' : '❌ Inactive' }}</p>
          </div>
        </div>
      </div>

      <!-- Task Creation Test -->
      <div class="bg-white rounded-lg shadow p-6 mb-6">
        <h2 class="text-xl font-semibold mb-4">Task Creation Test</h2>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Task Title</label>
            <input
              v-model="testTaskTitle"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter test task title"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              v-model="testTaskPriority"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <button
            @click="testTaskCreation"
            :disabled="isLoading || !testTaskTitle.trim()"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {{ isLoading ? 'Creating...' : 'Create Task via ServiceOrchestrator' }}
          </button>

          <div v-if="creationResult" class="p-4 rounded" :class="creationResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'">
            <p class="font-medium">{{ creationResult.success ? '✅ Success' : '❌ Error' }}</p>
            <p class="text-sm">{{ creationResult.message }}</p>
            <p v-if="creationResult.task" class="text-sm mt-2">Task ID: {{ creationResult.task.id }}</p>
          </div>
        </div>
      </div>

      <!-- Filter Test -->
      <div class="bg-white rounded-lg shadow p-6 mb-6">
        <h2 class="text-xl font-semibold mb-4">Filtering Test</h2>
        <div class="space-y-4">
          <div class="flex gap-2">
            <button
              v-for="filter in filterOptions"
              :key="filter.key"
              @click="testFilter(filter.key)"
              :class="[
                'px-3 py-1 rounded-md text-sm',
                activeFilter === filter.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              ]"
            >
              {{ filter.label }}
            </button>
          </div>

          <div v-if="filterResult" class="p-4 bg-gray-50 rounded">
            <p class="font-medium">Filter Results:</p>
            <p class="text-sm">{{ filterResult.count }} tasks found</p>
            <div v-if="filterResult.tasks.length > 0" class="mt-2 space-y-1">
              <div v-for="task in filterResult.tasks.slice(0, 5)" :key="task.id" class="text-sm p-2 bg-white rounded border">
                {{ task.title }} ({{ task.status }})
              </div>
              <p v-if="filterResult.tasks.length > 5" class="text-xs text-gray-500">
                ... and {{ filterResult.tasks.length - 5 }} more
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Statistics -->
      <div class="bg-white rounded-lg shadow p-6 mb-6">
        <h2 class="text-xl font-semibold mb-4">Current Statistics</h2>
        <div class="grid grid-cols-3 gap-4">
          <div class="text-center">
            <p class="text-2xl font-bold text-gray-900">{{ stats.totalTasks }}</p>
            <p class="text-sm text-gray-600">Total Tasks</p>
          </div>
          <div class="text-center">
            <p class="text-2xl font-bold text-gray-900">{{ stats.totalProjects }}</p>
            <p class="text-sm text-gray-600">Total Projects</p>
          </div>
          <div class="text-center">
            <p class="text-2xl font-bold text-gray-900">{{ stats.completedTasks }}</p>
            <p class="text-sm text-gray-600">Completed Tasks</p>
          </div>
        </div>
      </div>

      <!-- Migration Log -->
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-xl font-semibold mb-4">Activity Log</h2>
        <div class="space-y-2 max-h-60 overflow-y-auto">
          <div v-for="(log, index) in activityLog" :key="index" class="text-sm p-2 bg-gray-50 rounded border-l-4" :class="getLogColor(log.type)">
            <span class="font-medium">{{ log.timestamp }}</span>
            <span class="ml-2">{{ log.message }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useServiceOrchestrator } from '@/services/ServiceOrchestrator'
import { useTaskManagerService } from '@/composables/useTaskManagerService'

// Services
const serviceOrchestrator = useServiceOrchestrator()
const taskManagerService = useTaskManagerService()

// State
const isInitialized = ref(false)
const isLoading = ref(false)
const testTaskTitle = ref('ServiceOrchestrator Test Task')
const testTaskPriority = ref('medium')
const activeFilter = ref('')
const activityLog = ref<Array<{ timestamp: string; message: string; type: 'success' | 'error' | 'info' }>>([])

// Results
const creationResult = ref<any>(null)
const filterResult = ref<any>(null)

// Filter options
const filterOptions = [
  { key: 'today', label: 'Today' },
  { key: 'weekend', label: 'Weekend' },
  { key: 'uncategorized', label: 'Uncategorized' },
  { key: 'all', label: 'All Tasks' }
]

// Computed
const stats = computed(() => {
  const allTasks = serviceOrchestrator.getAllTasks()
  return {
    totalTasks: allTasks.length,
    totalProjects: serviceOrchestrator.getAllProjects().length,
    completedTasks: allTasks.filter(t => t.status === 'done').length
  }
})

// Methods
const addLog = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  activityLog.value.unshift({
    timestamp: new Date().toLocaleTimeString(),
    message,
    type
  })
  // Keep only last 20 logs
  if (activityLog.value.length > 20) {
    activityLog.value = activityLog.value.slice(0, 20)
  }
}

const getLogColor = (type: string) => {
  switch (type) {
    case 'success': return 'border-green-500 bg-green-50'
    case 'error': return 'border-red-500 bg-red-50'
    default: return 'border-blue-500 bg-blue-50'
  }
}

const testTaskCreation = async () => {
  if (!testTaskTitle.value.trim()) return

  isLoading.value = true
  creationResult.value = null

  try {
    const task = await taskManagerService.createTask({
      title: testTaskTitle.value,
      description: 'Created via ServiceOrchestrator migration test',
      priority: testTaskPriority.value as any,
      status: 'planned'
    })

    if (task) {
      creationResult.value = {
        success: true,
        message: `Task "${task.title}" created successfully`,
        task
      }
      addLog(`Created task: ${task.title}`, 'success')
      testTaskTitle.value = `Test Task ${Date.now()}`
    } else {
      creationResult.value = {
        success: false,
        message: 'Failed to create task'
      }
      addLog('Failed to create task', 'error')
    }
  } catch (error) {
    creationResult.value = {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }
    addLog(`Task creation error: ${error instanceof Error ? error.message : 'Unknown'}`, 'error')
  } finally {
    isLoading.value = false
  }
}

const testFilter = (filterKey: string) => {
  activeFilter.value = filterKey
  filterResult.value = null

  try {
    let filteredTasks: any[] = []

    switch (filterKey) {
      case 'today':
        filteredTasks = serviceOrchestrator.getTodayTasks()
        break
      case 'weekend':
        filteredTasks = serviceOrchestrator.getWeekendTasks()
        break
      case 'uncategorized':
        filteredTasks = serviceOrchestrator.getFilteredTasks({ smartView: 'uncategorized' })
        break
      case 'all':
        filteredTasks = serviceOrchestrator.getAllTasks()
        break
    }

    filterResult.value = {
      count: filteredTasks.length,
      tasks: filteredTasks
    }

    addLog(`Applied filter: ${filterKey} (${filteredTasks.length} tasks)`, 'success')
  } catch (error) {
    addLog(`Filter error: ${error instanceof Error ? error.message : 'Unknown'}`, 'error')
  }
}

// Lifecycle
onMounted(async () => {
  try {
    await serviceOrchestrator.initialize()
    isInitialized.value = true
    addLog('ServiceOrchestrator initialized successfully', 'success')
  } catch (error) {
    addLog(`Failed to initialize ServiceOrchestrator: ${error instanceof Error ? error.message : 'Unknown'}`, 'error')
  }

  // Get initial statistics
  addLog(`Loaded ${stats.value.totalTasks} tasks and ${stats.value.totalProjects} projects`, 'info')
})
</script>