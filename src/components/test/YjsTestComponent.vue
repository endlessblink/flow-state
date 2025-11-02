<!-- Yjs Test Component - Phase 1.4 Testing -->
<template>
  <div class="p-6 max-w-4xl mx-auto">
    <h2 class="text-2xl font-bold mb-6">Yjs Sync Test</h2>

    <!-- Connection Status -->
    <div class="mb-6 p-4 rounded-lg border" :class="syncState.isConnected ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'">
      <h3 class="font-semibold mb-2">Connection Status</h3>
      <p>Status: {{ syncState.isConnected ? 'Connected' : 'Disconnected' }}</p>
      <p>Syncing: {{ syncState.isSyncing ? 'Yes' : 'No' }}</p>
      <p v-if="syncState.lastSyncTime">Last Sync: {{ syncState.lastSyncTime.toLocaleTimeString() }}</p>
      <p v-if="syncState.syncError" class="text-red-600">Error: {{ syncState.syncError }}</p>
    </div>

    <!-- Awareness Info -->
    <div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
      <h3 class="font-semibold mb-2">Multi-Tab Awareness</h3>
      <p>Current Tab ID: {{ tabId }}</p>
      <p>Active Tabs: {{ activeTabs.length }}</p>
      <div v-if="activeTabs.length > 0" class="mt-2">
        <p class="font-medium">Other tabs:</p>
        <ul class="list-disc list-inside">
          <li v-for="tab in activeTabs" :key="tab.clientId">
            {{ tab.user?.name }} (ID: {{ tab.clientId }})
            <span v-if="tab.taskFocus" class="text-blue-600"> - Editing task: {{ tab.taskFocus }}</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- Task Operations -->
    <div class="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <h3 class="font-semibold mb-2">Task Operations</h3>
      <div class="flex gap-2 mb-4">
        <input
          v-model="newTaskTitle"
          placeholder="New task title"
          class="px-3 py-2 border rounded-md flex-1"
          @keyup.enter="addTask"
        />
        <button
          @click="addTask"
          class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Add Task
        </button>
      </div>

      <!-- Tasks List -->
      <div v-if="tasks.length === 0" class="text-gray-500">
        No tasks yet. Add one above!
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="task in tasks"
          :key="task.id"
          class="p-3 border rounded-md flex items-center justify-between"
          :class="focusedTasks.some(f => f.taskId === task.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'"
        >
          <div class="flex-1">
            <input
              v-model="task.title"
              class="w-full px-2 py-1 border rounded"
              @focus="() => setTaskFocus(task.id)"
              @blur="() => setTaskFocus(null)"
            />
            <p class="text-sm text-gray-500">
              Status: {{ task.status }} | Priority: {{ task.priority || 'None' }}
              <span v-if="focusedTasks.some(f => f.taskId === task.id)" class="text-blue-600">
                (Being edited by another tab)
              </span>
            </p>
          </div>
          <button
            @click="deleteTask(task.id)"
            class="ml-2 px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Yjs Debug Info -->
    <div class="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
      <h3 class="font-semibold mb-2">Debug Info</h3>
      <p>Total Tasks: {{ tasks.length }}</p>
      <p>Yjs Document Length: {{ yTasks?.length || 0 }}</p>
      <p>Awareness Clients: {{ awareness?.getStates()?.size || 0 }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useYjsSync } from '@/composables/useYjsSync'

// Use Yjs composable
const {
  tasks,
  syncState,
  activeTabs,
  focusedTasks,
  addTask: addTaskToYjs,
  updateTask,
  deleteTask: deleteTaskFromYjs,
  setTaskFocus,
  yTasks,
  awareness,
  tabId
} = useYjsSync()

// Local state for form
const newTaskTitle = ref('')

// Add task function
const addTask = () => {
  if (!newTaskTitle.value.trim()) return

  addTaskToYjs({
    title: newTaskTitle.value,
    description: '',
    status: 'planned',
    priority: null,
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: '',
    instances: [],
    projectId: 'test-project',
    parentTaskId: null
  })

  newTaskTitle.value = ''
}
</script>