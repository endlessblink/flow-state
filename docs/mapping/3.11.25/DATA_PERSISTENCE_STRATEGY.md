# Pomo-Flow - Data Persistence Strategy

## Overview

Pomo-Flow implements a sophisticated multi-layered data persistence strategy that ensures data reliability, performance, and user experience. The system combines IndexedDB for primary storage, localStorage for fallbacks, and cloud synchronization for cross-device accessibility.

## Architecture Overview

```
Data Persistence Layer
├── IndexedDB (Primary Storage)
│   ├── LocalForage (Abstraction)
│   ├── Task Data Management
│   ├── Canvas State Storage
│   └── Timer Session History
├── localStorage (Fallback Storage)
│   ├── Critical Settings
│   ├── User Preferences
│   └── Session State
├── Cloud Storage (Synchronization)
│   ├── Real-time Sync
│   ├── Conflict Resolution
│   └── Multi-device Support
└── Backup & Recovery
    ├── Automated Backups
    ├── Data Export
    └── Disaster Recovery
```

## Core Technology Stack

### LocalForage Integration
- **Library**: LocalForage
- **Purpose**: IndexedDB abstraction with graceful fallbacks
- **Features**: Promise-based API, automatic fallback, data serialization
- **Configuration**: Custom instance with optimized settings

### Database Schema
- **IndexedDB**: Primary application data
- **localStorage**: User preferences and settings
- **Cloud Storage**: Cross-device synchronization

## Storage Architecture

### Database Collections

```typescript
interface DatabaseCollections {
  // Core application data
  tasks: Task[]                    // All tasks and instances
  projects: Project[]              // Project hierarchy
  canvas: CanvasState             // Canvas layout and positions
  timer: TimerState               // Timer settings and sessions
  ui: UIState                     // User preferences and UI state

  // System data
  version: SchemaVersion          // Database schema version
  settings: AppSettings           // Application settings
  backup: BackupData[]            // Backup points
  sync: SyncState                 // Synchronization state
  analytics: AnalyticsData        // Usage analytics
}
```

### Data Models

```typescript
// Task data structure
interface Task {
  id: string                     // Unique identifier
  title: string                  // Task title
  description: string            // Detailed description
  status: TaskStatus            // Current status
  priority: TaskPriority        // Priority level
  progress: number              // Completion percentage (0-100)
  completedPomodoros: number    // Completed pomodoro sessions
  subtasks: Subtask[]          // Child tasks
  dueDate: string              // Due date (ISO string)
  instances: TaskInstance[]    // Calendar instances
  projectId: string            // Parent project
  parentTaskId?: string        // Parent task (for subtasks)
  createdAt: Date              // Creation timestamp
  updatedAt: Date              // Last modification
  canvasPosition?: Position    // Canvas coordinates
  isInInbox?: boolean          // Inbox status
  dependsOn?: string[]         // Task dependencies
  tags: string[]               // Task tags
  estimatedTime?: number       // Estimated duration (minutes)
  actualTime?: number          // Actual time spent (minutes)
  archivedAt?: Date            // Archive timestamp
}

// Canvas state structure
interface CanvasState {
  viewport: Viewport            // Canvas viewport state
  sections: CanvasSection[]    // Canvas sections
  taskPositions: Map<string, Position> // Task coordinates
  connections: TaskConnection[] // Task dependencies
  selectedNodes: string[]      // Selected nodes
  settings: CanvasSettings     // Canvas preferences
  lastModified: Date           // Last modification
}

// Timer state structure
interface TimerState {
  currentSession?: TimerSession // Active session
  settings: TimerSettings      // Timer configuration
  sessionHistory: TimerSession[] // Completed sessions
  statistics: TimerStatistics  // Usage statistics
  achievements: Achievement[]  // Unlocked achievements
}
```

## Storage Implementation

### Database Configuration

```typescript
// LocalForage configuration
const createStorageInstance = () => {
  return localforage.createInstance({
    name: 'pomoflow_db',
    storeName: 'pomoflow_store',
    version: 1.0,
    driver: [
      localforage.INDEXEDDB,
      localforage.WEBSQL,
      localforage.LOCALSTORAGE
    ],
    size: 50 * 1024 * 1024, // 50MB quota
    description: 'Pomo-Flow application data'
  })
}

// Storage instance with error handling
const storage = createStorageInstance()

storage.config({
  // Error handling
  onerror: (error) => {
    console.error('Storage error:', error)
    handleStorageError(error)
  },

  // Driver preference
  driverOrder: [
    localforage.INDEXEDDB,
    localforage.WEBSQL,
    localforage.LOCALSTORAGE
  ],

  // Serialization
  serialize: (data) => JSON.stringify(data),
  deserialize: (data) => JSON.parse(data)
})
```

### Storage Abstraction Layer

```typescript
// Generic storage operations
export class StorageManager {
  private instance: LocalForage

  constructor() {
    this.instance = createStorageInstance()
    this.initializeStorage()
  }

  // Generic save operation
  async save<T>(key: string, data: T): Promise<void> {
    try {
      // Validate data before saving
      if (!this.validateData(data)) {
        throw new Error(`Invalid data for key: ${key}`)
      }

      // Add metadata
      const wrappedData = {
        data,
        metadata: {
          timestamp: new Date().toISOString(),
          version: this.getCurrentVersion(),
          checksum: this.generateChecksum(data)
        }
      }

      await this.instance.setItem(key, wrappedData)

      // Trigger save event
      this.emit('data:saved', { key, data })

    } catch (error) {
      this.handleSaveError(key, data, error)
      throw error
    }
  }

  // Generic load operation
  async load<T>(key: string, defaultValue?: T): Promise<T> {
    try {
      const wrappedData = await this.instance.getItem(key)

      if (!wrappedData) {
        return defaultValue as T
      }

      // Validate metadata
      if (!this.validateMetadata(wrappedData.metadata)) {
        console.warn(`Invalid metadata for key: ${key}, using default`)
        return defaultValue as T
      }

      // Verify data integrity
      if (!this.verifyIntegrity(wrappedData)) {
        console.warn(`Data integrity check failed for key: ${key}`)
        return defaultValue as T
      }

      return wrappedData.data as T

    } catch (error) {
      this.handleLoadError(key, error)
      return defaultValue as T
    }
  }

  // Batch operations
  async batchSave<T>(entries: Array<{ key: string; data: T }>): Promise<void> {
    const transaction = this.instance.transaction()

    try {
      for (const entry of entries) {
        await transaction.setItem(entry.key, this.wrapData(entry.data))
      }

      await transaction.commit()
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  }

  async batchLoad<T>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>()

    for (const key of keys) {
      try {
        const data = await this.load<T>(key)
        if (data !== undefined) {
          results.set(key, data)
        }
      } catch (error) {
        console.error(`Failed to load key ${key}:`, error)
      }
    }

    return results
  }

  // Data validation
  private validateData(data: any): boolean {
    // Basic validation
    if (data === null || data === undefined) return false

    // Type-specific validation
    if (typeof data === 'object') {
      return this.validateObject(data)
    }

    return true
  }

  private validateObject(obj: any): boolean {
    // Check for circular references
    const seen = new WeakSet()

    const hasCircularRef = (o: any): boolean => {
      if (typeof o !== 'object' || o === null) return false
      if (seen.has(o)) return true

      seen.add(o)

      for (const key in o) {
        if (hasCircularRef(o[key])) return true
      }

      return false
    }

    return !hasCircularRef(obj)
  }

  // Data integrity
  private generateChecksum(data: any): string {
    const crypto = window.crypto || (window as any).msCrypto
    const encoder = new TextEncoder()
    const dataString = JSON.stringify(data)
    const dataArray = encoder.encode(dataString)
    const hashBuffer = crypto.subtle.digestSync('SHA-256', dataArray)
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  private verifyIntegrity(wrappedData: any): boolean {
    const expectedChecksum = wrappedData.metadata.checksum
    const actualChecksum = this.generateChecksum(wrappedData.data)
    return expectedChecksum === actualChecksum
  }
}
```

## Performance Optimization

### Debounced Persistence

```typescript
// Debounced save operations
class DebouncedStorageManager extends StorageManager {
  private saveQueue = new Map<string, NodeJS.Timeout>()
  private readonly DEBOUNCE_DELAY = 1000 // 1 second

  async debouncedSave<T>(key: string, data: T): Promise<void> {
    // Clear existing timeout
    const existingTimeout = this.saveQueue.get(key)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    // Set new timeout
    const timeout = setTimeout(async () => {
      try {
        await this.save(key, data)
        this.saveQueue.delete(key)
      } catch (error) {
        console.error(`Failed to save ${key}:`, error)
      }
    }, this.DEBOUNCE_DELAY)

    this.saveQueue.set(key, timeout)
  }

  // Force immediate save
  async forceSave<T>(key: string, data: T): Promise<void> {
    const timeout = this.saveQueue.get(key)
    if (timeout) {
      clearTimeout(timeout)
      this.saveQueue.delete(key)
    }

    await this.save(key, data)
  }
}
```

### Lazy Loading Strategy

```typescript
// Lazy loading for large datasets
class LazyLoadingManager {
  private loadedData = new Map<string, any>()
  private loadingPromises = new Map<string, Promise<any>>()

  async loadLazy<T>(key: string, loader: () => Promise<T>): Promise<T> {
    // Return cached data if available
    if (this.loadedData.has(key)) {
      return this.loadedData.get(key)
    }

    // Return existing promise if currently loading
    if (this.loadingPromises.has(key)) {
      return this.loadingPromises.get(key)
    }

    // Load data
    const loadingPromise = this.loadWithCache(key, loader)
    this.loadingPromises.set(key, loadingPromise)

    try {
      const data = await loadingPromise
      this.loadedData.set(key, data)
      return data
    } finally {
      this.loadingPromises.delete(key)
    }
  }

  private async loadWithCache<T>(key: string, loader: () => Promise<T>): Promise<T> {
    try {
      // Try cache first
      const cached = await this.loadFromCache<T>(key)
      if (cached) return cached

      // Load from source
      const data = await loader()

      // Cache for future use
      await this.saveToCache(key, data)

      return data
    } catch (error) {
      console.error(`Failed to load ${key}:`, error)
      throw error
    }
  }

  // Memory management
  clearCache(pattern?: string): void {
    if (pattern) {
      const regex = new RegExp(pattern)
      for (const [key] of this.loadedData) {
        if (regex.test(key)) {
          this.loadedData.delete(key)
        }
      }
    } else {
      this.loadedData.clear()
    }
  }
}
```

### Data Compression

```typescript
// Data compression for storage efficiency
class CompressionManager {
  async compressData(data: any): Promise<ArrayBuffer> {
    const jsonString = JSON.stringify(data)
    const encoder = new TextEncoder()
    const uint8Array = encoder.encode(jsonString)

    // Use CompressionStream if available
    if ('CompressionStream' in window) {
      const compressionStream = new CompressionStream('gzip')
      const writer = compressionStream.writable.getWriter()
      const reader = compressionStream.readable.getReader()

      writer.write(uint8Array)
      writer.close()

      const chunks: Uint8Array[] = []
      let done = false

      while (!done) {
        const { value, done: readerDone } = await reader.read()
        done = readerDone
        if (value) chunks.push(value)
      }

      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
      const result = new Uint8Array(totalLength)
      let offset = 0

      for (const chunk of chunks) {
        result.set(chunk, offset)
        offset += chunk.length
      }

      return result.buffer
    }

    // Fallback: return uncompressed
    return uint8Array.buffer
  }

  async decompressData(compressedData: ArrayBuffer): Promise<any> {
    // Use DecompressionStream if available
    if ('DecompressionStream' in window) {
      const decompressionStream = new DecompressionStream('gzip')
      const writer = decompressionStream.writable.getWriter()
      const reader = decompressionStream.readable.getReader()

      writer.write(new Uint8Array(compressedData))
      writer.close()

      const chunks: Uint8Array[] = []
      let done = false

      while (!done) {
        const { value, done: readerDone } = await reader.read()
        done = readerDone
        if (value) chunks.push(value)
      }

      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
      const result = new Uint8Array(totalLength)
      let offset = 0

      for (const chunk of chunks) {
        result.set(chunk, offset)
        offset += chunk.length
      }

      const decoder = new TextDecoder()
      const jsonString = decoder.decode(result)
      return JSON.parse(jsonString)
    }

    // Fallback: assume uncompressed JSON
    const decoder = new TextDecoder()
    const jsonString = decoder.decode(compressedData)
    return JSON.parse(jsonString)
  }
}
```

## Synchronization Strategy

### Real-time Sync Architecture

```typescript
// Synchronization manager
class SyncManager {
  private syncQueue: SyncOperation[] = []
  private isSyncing = false
  private lastSyncTime: Date | null = null

  async syncWithCloud(): Promise<void> {
    if (this.isSyncing) return

    this.isSyncing = true

    try {
      // Get local changes
      const localChanges = await this.getLocalChanges()

      // Get remote changes
      const remoteChanges = await this.getRemoteChanges()

      // Resolve conflicts
      const resolvedChanges = await this.resolveConflicts(
        localChanges,
        remoteChanges
      )

      // Apply changes
      await this.applyChanges(resolvedChanges)

      // Update sync state
      this.lastSyncTime = new Date()
      await this.updateSyncState()

      // Emit sync event
      this.emit('sync:completed', {
        timestamp: this.lastSyncTime,
        changesApplied: resolvedChanges.length
      })

    } catch (error) {
      console.error('Sync failed:', error)
      this.emit('sync:error', error)
    } finally {
      this.isSyncing = false
    }
  }

  private async resolveConflicts(
    localChanges: SyncOperation[],
    remoteChanges: SyncOperation[]
  ): Promise<SyncOperation[]> {
    const resolved: SyncOperation[] = []
    const conflictResolver = new ConflictResolver()

    // Find conflicts
    const conflicts = this.findConflicts(localChanges, remoteChanges)

    // Resolve each conflict
    for (const conflict of conflicts) {
      const resolution = await conflictResolver.resolve(conflict)
      resolved.push(resolution)
    }

    // Add non-conflicting changes
    const nonConflicting = [
      ...localChanges.filter(change => !conflicts.some(c => c.involves(change))),
      ...remoteChanges.filter(change => !conflicts.some(c => c.involves(change)))
    ]

    resolved.push(...nonConflicting)

    return resolved
  }

  private findConflicts(
    localChanges: SyncOperation[],
    remoteChanges: SyncOperation[]
  ): SyncConflict[] {
    const conflicts: SyncConflict[] = []

    // Group changes by entity
    const localByEntity = this.groupByEntity(localChanges)
    const remoteByEntity = this.groupByEntity(remoteChanges)

    // Find entities with changes in both local and remote
    for (const [entityId, localEntityChanges] of localByEntity) {
      const remoteEntityChanges = remoteByEntity.get(entityId)

      if (remoteEntityChanges) {
        // Conflict detected
        conflicts.push(new SyncConflict(
          entityId,
          localEntityChanges,
          remoteEntityChanges
        ))
      }
    }

    return conflicts
  }
}
```

### Conflict Resolution Strategies

```typescript
// Conflict resolution strategies
class ConflictResolver {
  async resolve(conflict: SyncConflict): Promise<SyncOperation> {
    const { entityId, localChanges, remoteChanges } = conflict

    // Strategy selection based on data type and user preferences
    const strategy = this.selectResolutionStrategy(entityId, conflict)

    switch (strategy) {
      case 'latest-wins':
        return this.resolveLatestWins(localChanges, remoteChanges)

      case 'manual':
        return await this.resolveManually(conflict)

      case 'merge':
        return await this.resolveMerge(localChanges, remoteChanges)

      case 'local-wins':
        return localChanges[localChanges.length - 1]

      case 'remote-wins':
        return remoteChanges[remoteChanges.length - 1]

      default:
        return this.resolveLatestWins(localChanges, remoteChanges)
    }
  }

  private selectResolutionStrategy(
    entityId: string,
    conflict: SyncConflict
  ): ResolutionStrategy {
    // Task data: prefer merge
    if (entityId.startsWith('task-')) {
      return 'merge'
    }

    // Settings data: prefer latest
    if (entityId.startsWith('settings-')) {
      return 'latest-wins'
    }

    // User preferences: ask user
    if (entityId.startsWith('preferences-')) {
      return 'manual'
    }

    // Default: latest wins
    return 'latest-wins'
  }

  private async resolveMerge(
    localChanges: SyncOperation[],
    remoteChanges: SyncOperation[]
  ): Promise<SyncOperation> {
    const latestLocal = localChanges[localChanges.length - 1]
    const latestRemote = remoteChanges[remoteChanges.length - 1]

    // Merge data structures
    const mergedData = this.mergeDataStructures(
      latestLocal.data,
      latestRemote.data
    )

    return new SyncOperation({
      type: 'update',
      entityId: latestLocal.entityId,
      data: mergedData,
      timestamp: new Date(),
      source: 'merge'
    })
  }

  private mergeDataStructures(local: any, remote: any): any {
    // Deep merge objects
    const result = { ...local }

    for (const [key, value] of Object.entries(remote)) {
      if (key in result) {
        if (typeof result[key] === 'object' && typeof value === 'object') {
          result[key] = this.mergeDataStructures(result[key], value)
        } else {
          // Use remote value for conflicts (can be made smarter)
          result[key] = value
        }
      } else {
        result[key] = value
      }
    }

    return result
  }
}
```

## Backup and Recovery

### Automated Backup System

```typescript
// Backup management
class BackupManager {
  private backupSchedule: BackupSchedule
  private maxBackups = 30 // Keep last 30 days

  constructor() {
    this.backupSchedule = new BackupSchedule({
      daily: true,
      weekly: true,
      monthly: true
    })
  }

  async createBackup(type: BackupType = 'manual'): Promise<Backup> {
    const backup: Backup = {
      id: generateId(),
      type,
      timestamp: new Date(),
      version: this.getCurrentVersion(),
      data: await this.collectBackupData(),
      metadata: {
        size: 0,
        checksum: '',
        compressed: true
      }
    }

    // Compress backup data
    backup.data = await this.compressData(backup.data)
    backup.metadata.size = backup.data.byteLength
    backup.metadata.checksum = await this.generateChecksum(backup.data)

    // Save backup
    await this.saveBackup(backup)

    // Cleanup old backups
    await this.cleanupOldBackups()

    // Emit backup event
    this.emit('backup:created', backup)

    return backup
  }

  private async collectBackupData(): Promise<BackupData> {
    const storage = new StorageManager()

    const data: BackupData = {
      tasks: await storage.load('tasks', []),
      projects: await storage.load('projects', []),
      canvas: await storage.load('canvas', {}),
      timer: await storage.load('timer', {}),
      ui: await storage.load('ui', {}),
      settings: await storage.load('settings', {}),
      version: this.getCurrentVersion(),
      exportedAt: new Date().toISOString()
    }

    return data
  }

  async restoreFromBackup(backupId: string): Promise<void> {
    try {
      const backup = await this.loadBackup(backupId)

      if (!backup) {
        throw new Error(`Backup ${backupId} not found`)
      }

      // Verify backup integrity
      if (!this.verifyBackup(backup)) {
        throw new Error(`Backup ${backupId} is corrupted`)
      }

      // Create safety backup before restore
      await this.createBackup('pre-restore')

      // Decompress and restore data
      const data = await this.decompressData(backup.data)
      await this.restoreBackupData(data)

      // Emit restore event
      this.emit('backup:restored', backup)

    } catch (error) {
      console.error('Restore failed:', error)
      throw error
    }
  }

  private async restoreBackupData(data: BackupData): Promise<void> {
    const storage = new StorageManager()

    // Restore each data type
    await storage.save('tasks', data.tasks)
    await storage.save('projects', data.projects)
    await storage.save('canvas', data.canvas)
    await storage.save('timer', data.timer)
    await storage.save('ui', data.ui)
    await storage.save('settings', data.settings)

    // Trigger application reload
    this.emit('data:restored', data)
  }

  private async cleanupOldBackups(): Promise<void> {
    const backups = await this.listBackups()

    // Sort by timestamp (newest first)
    backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    // Keep different types based on schedule
    const toKeep = this.selectBackupsToKeep(backups)
    const toDelete = backups.filter(backup => !toKeep.includes(backup))

    // Delete old backups
    for (const backup of toDelete) {
      await this.deleteBackup(backup.id)
    }
  }

  private selectBackupsToKeep(backups: Backup[]): Backup[] {
    const now = new Date()
    const toKeep: Backup[] = []

    // Keep daily backups for last 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)

      const dailyBackup = backups.find(backup =>
        backup.type === 'daily' &&
        this.isSameDay(backup.timestamp, date)
      )

      if (dailyBackup) toKeep.push(dailyBackup)
    }

    // Keep weekly backups for last 4 weeks
    for (let i = 0; i < 4; i++) {
      const date = new Date(now)
      date.setDate(date.getDate() - (i * 7))

      const weeklyBackup = backups.find(backup =>
        backup.type === 'weekly' &&
        this.isSameWeek(backup.timestamp, date)
      )

      if (weeklyBackup) toKeep.push(weeklyBackup)
    }

    // Keep monthly backups for last 6 months
    for (let i = 0; i < 6; i++) {
      const date = new Date(now)
      date.setMonth(date.getMonth() - i)

      const monthlyBackup = backups.find(backup =>
        backup.type === 'monthly' &&
        this.isSameMonth(backup.timestamp, date)
      )

      if (monthlyBackup) toKeep.push(monthlyBackup)
    }

    // Keep all manual backups from last 30 days
    const recentManual = backups.filter(backup =>
      backup.type === 'manual' &&
      (now.getTime() - backup.timestamp.getTime()) < (30 * 24 * 60 * 60 * 1000)
    )
    toKeep.push(...recentManual)

    // Remove duplicates
    return Array.from(new Set(toKeep))
  }
}
```

## Error Handling and Recovery

### Storage Error Management

```typescript
// Comprehensive error handling
class StorageErrorHandler {
  async handleStorageError(error: Error, context: StorageContext): Promise<void> {
    console.error('Storage error:', error, context)

    // Categorize error
    const errorType = this.categorizeError(error)

    switch (errorType) {
      case 'QUOTA_EXCEEDED':
        await this.handleQuotaExceeded(context)
        break

      case 'STORAGE_DISABLED':
        await this.handleStorageDisabled(context)
        break

      case 'CORRUPTION_DETECTED':
        await this.handleCorruption(context)
        break

      case 'NETWORK_ERROR':
        await this.handleNetworkError(context)
        break

      default:
        await this.handleGenericError(error, context)
    }
  }

  private async handleQuotaExceeded(context: StorageContext): Promise<void> {
    // Try to free up space
    await this.cleanupOldData()

    // Compress existing data
    await this.compressExistingData()

    // Prompt user to clear data
    const userChoice = await this.promptUser(
      'Storage quota exceeded. Would you like to clear old data?',
      ['Clear Old Data', 'Clear All Data', 'Cancel']
    )

    switch (userChoice) {
      case 'Clear Old Data':
        await this.clearOldData()
        break

      case 'Clear All Data':
        await this.clearAllData()
        break

      case 'Cancel':
        throw new Error('User cancelled operation')
    }

    // Retry the original operation
    await this.retryOperation(context)
  }

  private async handleCorruption(context: StorageContext): Promise<void> {
    // Try to recover from backup
    const recentBackup = await this.findRecentBackup()

    if (recentBackup) {
      const userChoice = await this.promptUser(
        'Data corruption detected. Restore from backup?',
        ['Restore from Backup', 'Clear Data', 'Cancel']
      )

      if (userChoice === 'Restore from Backup') {
        await this.restoreFromBackup(recentBackup.id)
        return
      }
    }

    // Fallback: clear corrupted data
    await this.clearCorruptedData(context.key)

    // Reinitialize with default data
    await this.initializeDefaultData(context.key)
  }

  private async cleanupOldData(): Promise<void> {
    const storage = new StorageManager()

    // Clear old analytics data
    await storage.remove('analytics')

    // Clear old session history (keep last 90 days)
    const timerState = await storage.load('timer')
    if (timerState?.sessionHistory) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - 90)

      timerState.sessionHistory = timerState.sessionHistory.filter(
        session => new Date(session.startTime) > cutoffDate
      )

      await storage.save('timer', timerState)
    }

    // Clear old undo/redo history
    await storage.remove('undo-redo-history')
  }
}
```

## Data Migration Strategy

### Schema Versioning

```typescript
// Data migration system
class MigrationManager {
  private migrations: Migration[] = [
    // Example migrations
    {
      version: '1.0.0',
      description: 'Initial version',
      up: async (data: any) => data,
      down: async (data: any) => data
    },
    {
      version: '1.1.0',
      description: 'Add task instances',
      up: async (data: any) => {
        // Add instances array to existing tasks
        if (data.tasks) {
          data.tasks = data.tasks.map((task: any) => ({
            ...task,
            instances: task.instances || [],
            // Migrate legacy scheduled fields
            legacyScheduledDate: task.scheduledDate,
            legacyScheduledTime: task.scheduledTime
          }))
        }
        return data
      },
      down: async (data: any) => {
        // Remove instances, restore legacy fields
        if (data.tasks) {
          data.tasks = data.tasks.map((task: any) => {
            const { instances, legacyScheduledDate, legacyScheduledTime, ...rest } = task
            return {
              ...rest,
              scheduledDate: legacyScheduledDate,
              scheduledTime: legacyScheduledTime
            }
          })
        }
        return data
      }
    }
  ]

  async migrateData(fromVersion: string, toVersion: string): Promise<void> {
    const migrationPath = this.getMigrationPath(fromVersion, toVersion)

    for (const migration of migrationPath) {
      try {
        console.log(`Running migration ${migration.version}: ${migration.description}`)

        const data = await this.loadCurrentData()
        const migratedData = await migration.up(data)
        await this.saveMigratedData(migratedData)

        await this.updateVersion(migration.version)

        console.log(`Migration ${migration.version} completed successfully`)
      } catch (error) {
        console.error(`Migration ${migration.version} failed:`, error)
        throw new Error(`Migration failed: ${error.message}`)
      }
    }
  }

  private getMigrationPath(fromVersion: string, toVersion: string): Migration[] {
    const fromIndex = this.migrations.findIndex(m => m.version === fromVersion)
    const toIndex = this.migrations.findIndex(m => m.version === toVersion)

    if (fromIndex === -1 || toIndex === -1) {
      throw new Error('Unknown version specified')
    }

    if (fromIndex >= toIndex) {
      throw new Error('Cannot migrate backwards')
    }

    return this.migrations.slice(fromIndex + 1, toIndex + 1)
  }
}
```

This comprehensive data persistence strategy ensures reliability, performance, and a great user experience while maintaining data integrity across devices and sessions.

**Last Updated**: November 2, 2025
**Architecture Version**: Vue 3.4.0, IndexedDB, LocalForage