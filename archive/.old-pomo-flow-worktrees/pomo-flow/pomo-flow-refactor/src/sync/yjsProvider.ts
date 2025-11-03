import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'
import { ref, computed } from 'vue'
import type { Task, Project, PomodoroState } from '@/types'

export class YjsSyncProvider {
  private doc: Y.Doc
  private wsProvider: WebsocketProvider | null = null
  private indexeddbProvider: IndexeddbPersistence | null = null

  // Yjs data structures
  public yTasks: Y.Array<Task>
  public yProjects: Y.Array<Project>
  public ySettings: Y.Map<any>
  public yPomodoro: Y.Map<any>

  // Reactive state
  public syncStatus = ref<'offline' | 'connecting' | 'syncing' | 'synced'>('offline')
  public isOnline = ref(false)
  public lastSyncTime = ref<number | null>(null)
  public pendingOperations = ref(0)

  constructor(
    private roomName: string = 'pomo-flow-default',
    private wsUrl: string = 'ws://localhost:1234' // TODO: Configure actual sync server URL
  ) {
    this.doc = new Y.Doc()

    // Initialize Yjs data structures
    this.yTasks = this.doc.getArray<Task>('tasks')
    this.yProjects = this.doc.getArray<Project>('projects')
    this.ySettings = this.doc.getMap('settings')
    this.yPomodoro = this.doc.getMap('pomodoro')

    this.setupIndexedDB()
    this.setupWebSocket()
    this.setupOnlineListener()
  }

  private async setupIndexedDB() {
    try {
      this.indexeddbProvider = new IndexeddbPersistence('pomo-flow', this.doc)

      this.indexeddbProvider.on('synced', () => {
        console.log('✅ Local persistence synced')
      })

      await this.indexeddbProvider.whenSynced
    } catch (error) {
      console.error('❌ IndexedDB setup failed:', error)
    }
  }

  private setupWebSocket() {
    try {
      this.wsProvider = new WebsocketProvider(
        this.wsUrl,
        this.roomName,
        this.doc,
        {
          connect: navigator.onLine
        }
      )

      // WebSocket event listeners
      this.wsProvider.on('status', ({ status }: { status: string }) => {
        console.log('🔌 WebSocket status:', status)

        if (status === 'connected') {
          this.syncStatus.value = 'synced'
          this.isOnline.value = true
          this.lastSyncTime.value = Date.now()
        } else if (status === 'connecting') {
          this.syncStatus.value = 'connecting'
        } else {
          this.syncStatus.value = 'offline'
          this.isOnline.value = false
        }
      })

      this.wsProvider.on('sync', (isSynced: boolean) => {
        if (isSynced) {
          this.syncStatus.value = 'synced'
          this.lastSyncTime.value = Date.now()
          console.log('✅ Synced with server')
        }
      })

      this.wsProvider.on('connection-error', (error: any) => {
        console.error('❌ WebSocket connection error:', error)
        this.syncStatus.value = 'offline'
        this.isOnline.value = false
      })

    } catch (error) {
      console.error('❌ WebSocket setup failed:', error)
      this.syncStatus.value = 'offline'
    }
  }

  private setupOnlineListener() {
    window.addEventListener('online', () => {
      console.log('🌐 Network online - reconnecting')
      this.wsProvider?.connect()
    })

    window.addEventListener('offline', () => {
      console.log('📡 Network offline')
      this.syncStatus.value = 'offline'
      this.isOnline.value = false
    })
  }

  // Task operations
  public addTask(task: Task) {
    this.doc.transact(() => {
      this.yTasks.push([task])
      this.pendingOperations.value++
    })
  }

  public updateTask(taskId: string, updates: Partial<Task>) {
    this.doc.transact(() => {
      const tasks = this.yTasks.toArray()
      const index = tasks.findIndex(t => t.id === taskId)

      if (index !== -1) {
        const updatedTask = { ...tasks[index], ...updates, updatedAt: Date.now() }
        this.yTasks.delete(index, 1)
        this.yTasks.insert(index, [updatedTask])
        this.pendingOperations.value++
      }
    })
  }

  public deleteTask(taskId: string) {
    this.doc.transact(() => {
      const tasks = this.yTasks.toArray()
      const index = tasks.findIndex(t => t.id === taskId)

      if (index !== -1) {
        this.yTasks.delete(index, 1)
        this.pendingOperations.value++
      }
    })
  }

  public getTasks(): Task[] {
    return this.yTasks.toArray()
  }

  // Project operations
  public addProject(project: Project) {
    this.doc.transact(() => {
      this.yProjects.push([project])
      this.pendingOperations.value++
    })
  }

  public updateProject(projectId: string, updates: Partial<Project>) {
    this.doc.transact(() => {
      const projects = this.yProjects.toArray()
      const index = projects.findIndex(p => p.id === projectId)

      if (index !== -1) {
        const updatedProject = { ...projects[index], ...updates }
        this.yProjects.delete(index, 1)
        this.yProjects.insert(index, [updatedProject])
        this.pendingOperations.value++
      }
    })
  }

  public getProjects(): Project[] {
    return this.yProjects.toArray()
  }

  // Pomodoro state operations
  public updatePomodoroState(state: Partial<PomodoroState>) {
    this.doc.transact(() => {
      Object.entries(state).forEach(([key, value]) => {
        this.yPomodoro.set(key, value)
      })
      this.pendingOperations.value++
    })
  }

  public getPomodoroState(): PomodoroState | null {
    const state = this.yPomodoro.toJSON()
    return Object.keys(state).length > 0 ? state as PomodoroState : null
  }

  // Settings operations
  public updateSettings(settings: Record<string, any>) {
    this.doc.transact(() => {
      Object.entries(settings).forEach(([key, value]) => {
        this.ySettings.set(key, value)
      })
      this.pendingOperations.value++
    })
  }

  public getSettings(): Record<string, any> {
    return this.ySettings.toJSON()
  }

  // Observe changes
  public observeTasks(callback: (tasks: Task[]) => void) {
    this.yTasks.observe(() => {
      callback(this.getTasks())
      this.pendingOperations.value = Math.max(0, this.pendingOperations.value - 1)
    })
  }

  public observeProjects(callback: (projects: Project[]) => void) {
    this.yProjects.observe(() => {
      callback(this.getProjects())
      this.pendingOperations.value = Math.max(0, this.pendingOperations.value - 1)
    })
  }

  public observePomodoro(callback: (state: PomodoroState | null) => void) {
    this.yPomodoro.observe(() => {
      callback(this.getPomodoroState())
      this.pendingOperations.value = Math.max(0, this.pendingOperations.value - 1)
    })
  }

  // Computed status helpers
  public get statusIcon() {
    return computed(() => {
      switch (this.syncStatus.value) {
        case 'synced': return '✓'
        case 'syncing': return '⟳'
        case 'connecting': return '...'
        case 'offline': return '✈'
        default: return '?'
      }
    })
  }

  public get statusText() {
    return computed(() => {
      switch (this.syncStatus.value) {
        case 'synced': return 'Synced'
        case 'syncing': return 'Syncing...'
        case 'connecting': return 'Connecting...'
        case 'offline': return 'Offline'
        default: return 'Unknown'
      }
    })
  }

  // Cleanup
  public destroy() {
    this.wsProvider?.disconnect()
    this.wsProvider?.destroy()
    this.indexeddbProvider?.destroy()
    this.doc.destroy()
  }
}

// Singleton instance
let syncProvider: YjsSyncProvider | null = null

export function useSyncProvider(roomName?: string, wsUrl?: string): YjsSyncProvider {
  if (!syncProvider) {
    syncProvider = new YjsSyncProvider(roomName, wsUrl)
  }
  return syncProvider
}
