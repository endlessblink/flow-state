/**
 * Database Adapter Pattern
 *
 * This abstraction layer allows easy migration between database providers
 * (Firebase → Supabase → PocketBase, etc.) without changing app logic.
 *
 * Architecture:
 * - IndexedDB is always the primary local storage (never replaced)
 * - Cloud database (Firebase/Supabase/etc) is for sync and backup
 * - Adapters handle the cloud sync implementation
 */

import type { Task, Project } from '@/stores/tasks'

/**
 * Task-related database operations
 */
export interface TaskDatabaseAdapter {
  // Single task operations
  saveTask(userId: string, task: Task): Promise<void>
  loadTask(userId: string, taskId: string): Promise<Task | null>
  deleteTask(userId: string, taskId: string): Promise<void>

  // Bulk operations
  saveTasks(userId: string, tasks: Task[]): Promise<void>
  loadTasks(userId: string): Promise<Task[]>

  // Real-time sync
  subscribeToTasks(userId: string, callback: (tasks: Task[]) => void): () => void
}

/**
 * Project-related database operations
 */
export interface ProjectDatabaseAdapter {
  // Single project operations
  saveProject(userId: string, project: Project): Promise<void>
  loadProject(userId: string, projectId: string): Promise<Project | null>
  deleteProject(userId: string, projectId: string): Promise<void>

  // Bulk operations
  saveProjects(userId: string, projects: Project[]): Promise<void>
  loadProjects(userId: string): Promise<Project[]>

  // Real-time sync
  subscribeToProjects(userId: string, callback: (projects: Project[]) => void): () => void
}

/**
 * Canvas-related database operations
 */
export interface CanvasDatabaseAdapter {
  saveCanvasState(userId: string, canvasData: any): Promise<void>
  loadCanvasState(userId: string): Promise<any>
  subscribeToCanvas(userId: string, callback: (canvasData: any) => void): () => void
}

/**
 * Complete database adapter interface
 * Implement this interface for each database provider
 */
export interface DatabaseAdapter {
  // Provider info
  readonly name: string
  readonly version: string

  // Sub-adapters
  tasks: TaskDatabaseAdapter
  projects: ProjectDatabaseAdapter
  canvas: CanvasDatabaseAdapter

  // Connection management
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean

  // Health check
  ping(): Promise<boolean>
}

/**
 * Sync configuration
 */
export interface SyncConfig {
  // Sync timing
  syncOnChange: boolean        // Sync immediately on every change
  syncInterval?: number        // Batch sync interval in ms (if not syncOnChange)

  // Conflict resolution
  conflictStrategy: 'local-wins' | 'remote-wins' | 'newest-wins' | 'manual'

  // Performance
  batchSize: number           // Max items to sync at once
  retryAttempts: number       // Retry failed syncs
  retryDelay: number          // Delay between retries (ms)

  // Offline support
  queueOfflineChanges: boolean // Queue changes when offline
  maxQueueSize: number        // Max offline queue size
}

/**
 * Default sync configuration
 */
export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  syncOnChange: true,
  conflictStrategy: 'newest-wins',
  batchSize: 50,
  retryAttempts: 3,
  retryDelay: 1000,
  queueOfflineChanges: true,
  maxQueueSize: 1000
}

/**
 * Sync status for monitoring
 */
export interface SyncStatus {
  isOnline: boolean
  lastSync: Date | null
  pendingChanges: number
  syncInProgress: boolean
  lastError: Error | null
}

/**
 * Database adapter factory
 * Returns the appropriate adapter based on configuration
 */
export function createDatabaseAdapter(provider: 'firebase' | 'supabase' | 'pocketbase' = 'firebase'): DatabaseAdapter {
  switch (provider) {
    case 'firebase':
      // Lazy load Firebase adapter to avoid bundling unused providers
      return new (require('./adapters/FirebaseAdapter').FirebaseAdapter)()

    case 'supabase':
      // Future implementation
      throw new Error('Supabase adapter not yet implemented')

    case 'pocketbase':
      // Future implementation
      throw new Error('PocketBase adapter not yet implemented')

    default:
      throw new Error(`Unknown database provider: ${provider}`)
  }
}

/**
 * Composable for database operations with abstraction
 *
 * Usage:
 * ```ts
 * const { adapter, sync, status } = useDatabaseAdapter('firebase')
 *
 * // Save task to cloud
 * await adapter.tasks.saveTask(userId, task)
 *
 * // Load tasks from cloud
 * const tasks = await adapter.tasks.loadTasks(userId)
 *
 * // Subscribe to real-time updates
 * const unsubscribe = adapter.tasks.subscribeToTasks(userId, (tasks) => {
 *   console.log('Tasks updated:', tasks)
 * })
 * ```
 */
export function useDatabaseAdapter(provider: 'firebase' | 'supabase' | 'pocketbase' = 'firebase', config: Partial<SyncConfig> = {}) {
  const adapter = createDatabaseAdapter(provider)
  const syncConfig = { ...DEFAULT_SYNC_CONFIG, ...config }

  return {
    adapter,
    syncConfig,
    // Additional composable methods can be added here
  }
}
