// Yjs Sync Composable - CRDT-based task synchronization
// Phase 1.1: Basic Y.Doc setup and reactive Vue integration
// Phase 1.2: Awareness Protocol integration for multi-tab collaboration

import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness'
import { IndexeddbPersistence } from 'y-indexeddb'
import { computed, ref, watch, onUnmounted } from 'vue'
import type { Task, Subtask, TaskInstance } from '@/stores/taskCore'

export interface YjsSyncState {
  isConnected: boolean
  isSyncing: boolean
  lastSyncTime: Date | null
  syncError: string | null
}

export interface AwarenessState {
  user: {
    id: string
    name: string
    tab: string
  }
  taskFocus?: string
  cursor?: {
    line: number
    ch: number
  }
  lastActivity: number
}

// Global Yjs document, awareness, and persistence - singleton pattern for consistent access across the app
let globalYdoc: Y.Doc | null = null
let globalAwareness: Awareness | null = null
let globalIndexeddbProvider: IndexeddbPersistence | null = null

export function useYjsSync() {
  // Initialize or get existing Yjs document
  if (!globalYdoc) {
    globalYdoc = new Y.Doc()
  }

  const ydoc = globalYdoc

  // Initialize or get existing awareness
  if (!globalAwareness) {
    globalAwareness = new Awareness(ydoc)
  }

  const awareness = globalAwareness

  // Initialize or get existing IndexedDB persistence
  if (!globalIndexeddbProvider) {
    globalIndexeddbProvider = new IndexeddbPersistence('pomo-flow-tasks', ydoc)
  }

  const indexeddbProvider = globalIndexeddbProvider

  // Get Yjs data structures
  const yTasks = ydoc.getArray('tasks')
  const yProjects = ydoc.getMap('projects')
  const yMetadata = ydoc.getMap('metadata')

  // Reactive state
  const syncState = ref<YjsSyncState>({
    isConnected: false,
    isSyncing: false,
    lastSyncTime: null,
    syncError: null
  })

  // IndexedDB provider event handlers
  const handleIndexedDbSync = () => {
    syncState.value.isConnected = true
    syncState.value.isSyncing = false
    syncState.value.lastSyncTime = new Date()
    syncState.value.syncError = null
    console.log('IndexedDB synced successfully')
  }

  const handleIndexedDbSyncFailed = (error: any) => {
    syncState.value.isConnected = false
    syncState.value.isSyncing = false
    syncState.value.syncError = error.message || 'IndexedDB sync failed'
    console.error('IndexedDB sync failed:', error)
  }

  const handleIndexedDbDisconnected = () => {
    syncState.value.isConnected = false
    syncState.value.isSyncing = false
    console.log('IndexedDB disconnected')
  }

  // Tab identification for awareness
  const tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  // Reactive awareness state
  const localAwarenessState = ref<AwarenessState>({
    user: {
      id: tabId,
      name: `Tab ${new Date().toLocaleTimeString()}`,
      tab: tabId
    },
    lastActivity: Date.now()
  })

  // Active tabs/states from other awareness instances
  const activeTabs = computed(() => {
    const states = awareness.getStates()
    const tabs: Array<AwarenessState & { clientId: number }> = []

    states.forEach((state, clientId) => {
      if (clientId !== awareness.clientID) {
        tabs.push({
          ...state,
          clientId
        })
      }
    })

    return tabs
  })

  // Get current focus task across all tabs
  const focusedTasks = computed(() => {
    const focused: Array<{ taskId: string; user: AwarenessState['user']; clientId: number }> = []

    activeTabs.value.forEach(tab => {
      if (tab.taskFocus) {
        focused.push({
          taskId: tab.taskFocus,
          user: tab.user,
          clientId: tab.clientId
        })
      }
    })

    return focused
  })

  // Set local awareness state
  const setLocalAwarenessState = (updates: Partial<AwarenessState>) => {
    const newState = {
      ...localAwarenessState.value,
      ...updates,
      lastActivity: Date.now()
    }

    localAwarenessState.value = newState
    awareness.setLocalState(newState)
  }

  // Set task focus
  const setTaskFocus = (taskId: string | null) => {
    setLocalAwarenessState({
      taskFocus: taskId || undefined
    })
  }

  // Set cursor position
  const setCursor = (position: { line: number; ch: number }) => {
    setLocalAwarenessState({
      cursor: position
    })
  }

  // Update user name
  const setUserName = (name: string) => {
    setLocalAwarenessState({
      user: {
        ...localAwarenessState.value.user,
        name
      }
    })
  }

  // Initialize local awareness state
  awareness.setLocalState(localAwarenessState.value)

  // Listen to awareness changes
  const handleAwarenessChange = () => {
    console.log('Awareness changed:', {
      local: awareness.getLocalState(),
      others: Array.from(awareness.getStates().entries())
    })
  }

  awareness.on('change', handleAwarenessChange)

  // Set up IndexedDB provider event listeners
  indexeddbProvider.on('sync', handleIndexedDbSync)
  indexeddbProvider.on('sync-failed', handleIndexedDbSyncFailed)
  indexeddbProvider.on('disconnected', handleIndexedDbDisconnected)

  // Initialize sync state based on current provider status
  if (indexeddbProvider.synced) {
    syncState.value.isConnected = true
    syncState.value.lastSyncTime = new Date()
  }

  // Convert Yjs array to reactive Vue array
  const tasks = computed(() => {
    const yTasksArray = ydoc.getArray('tasks')
    return yTasksArray.toArray().map(taskMap => {
      const task = taskMap as Y.Map<any>
      return {
        id: task.get('id'),
        title: task.get('title'),
        description: task.get('description'),
        status: task.get('status'),
        priority: task.get('priority'),
        progress: task.get('progress'),
        completedPomodoros: task.get('completedPomodoros'),
        subtasks: task.get('subtasks') || [],
        dueDate: task.get('dueDate'),
        scheduledDate: task.get('scheduledDate'),
        scheduledTime: task.get('scheduledTime'),
        estimatedDuration: task.get('estimatedDuration'),
        instances: task.get('instances') || [],
        projectId: task.get('projectId'),
        parentTaskId: task.get('parentTaskId'),
        createdAt: task.get('createdAt'),
        updatedAt: task.get('updatedAt'),
        canvasPosition: task.get('canvasPosition'),
        isInInbox: task.get('isInInbox'),
        dependsOn: task.get('dependsOn') || [],
        connectionTypes: task.get('connectionTypes') || {}
      }
    })
  })

  // Helper function to convert Task to Yjs Map
  const taskToYMap = (task: Task): Y.Map<any> => {
    const yMap = new Y.Map()
    Object.entries(task).forEach(([key, value]) => {
      yMap.set(key, value)
    })
    return yMap
  }

  // CRUD Operations with Awareness integration
  const addTask = (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTask: Task = {
      ...taskData,
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const yTask = taskToYMap(newTask)
    yTasks.push([yTask])

    // Set focus to the newly created task
    setTaskFocus(newTask.id)

    return newTask
  }

  const updateTask = (taskId: string, updates: Partial<Task>) => {
    const yTasksArray = ydoc.getArray('tasks')

    for (let i = 0; i < yTasksArray.length; i++) {
      const task = yTasksArray.get(i) as Y.Map<any>
      if (task.get('id') === taskId) {
        // Update fields
        Object.entries(updates).forEach(([key, value]) => {
          task.set(key, value)
        })
        task.set('updatedAt', new Date())

        // Set awareness focus to this task being edited
        setTaskFocus(taskId)
        break
      }
    }
  }

  const deleteTask = (taskId: string) => {
    const yTasksArray = ydoc.getArray('tasks')

    for (let i = 0; i < yTasksArray.length; i++) {
      const task = yTasksArray.get(i) as Y.Map<any>
      if (task.get('id') === taskId) {
        yTasksArray.delete(i)

        // Clear focus if this task was being edited
        if (localAwarenessState.value.taskFocus === taskId) {
          setTaskFocus(null)
        }
        break
      }
    }
  }

  // Observe Yjs changes for sync state
  const observeYjsChanges = () => {
    ydoc.on('update', (update: Uint8Array, origin: any) => {
      syncState.value.isSyncing = true
      syncState.value.lastSyncTime = new Date()

      // Simulate sync completion
      setTimeout(() => {
        syncState.value.isSyncing = false
      }, 100)
    })
  }

  // Initialize observers
  observeYjsChanges()

  // Cleanup on unmount
  onUnmounted(() => {
    // Remove awareness listener
    awareness.off('change', handleAwarenessChange)

    // Remove IndexedDB provider listeners
    indexeddbProvider.off('sync', handleIndexedDbSync)
    indexeddbProvider.off('sync-failed', handleIndexedDbSyncFailed)
    indexeddbProvider.off('disconnected', handleIndexedDbDisconnected)

    // Yjs document persists as singleton, don't destroy here
  })

  return {
    // Data
    tasks,
    syncState,

    // Awareness data
    activeTabs,
    focusedTasks,
    localAwarenessState,

    // CRUD operations
    addTask,
    updateTask,
    deleteTask,

    // Awareness operations
    setTaskFocus,
    setCursor,
    setUserName,
    setLocalAwarenessState,

    // Yjs internals for advanced usage
    ydoc,
    yTasks,
    yProjects,
    yMetadata,
    awareness,
    indexeddbProvider,

    // Tab identification
    tabId
  }
}