---
name: Undo/Redo Systems Architecture
description: Implement comprehensive undo/redo systems that work across entire codebases. Use when building complex applications with multiple stores, canvas interactions, user actions, and state synchronization challenges.
---

# Undo/Redo Systems Architecture

**⏮️ ACTIVATING UNDO/REDO SYSTEMS SKILL**

Building robust, scalable undo/redo architectures that maintain consistency across complex applications, handle cross-component state synchronization, and provide seamless user experience through command pattern implementation and optimized state management.

## When to Use
- Implementing undo/redo for complex applications with multiple data stores
- Managing state across canvas interactions, forms, and user actions
- Building applications with drag-and-drop, editing capabilities, or content creation
- Handling cross-component state synchronization and consistency
- Optimizing performance for large state trees and frequent updates
- Debugging state management issues and race conditions
- Creating collaborative features with conflict resolution

## Core Architecture Patterns

### 1. Command Pattern Foundation

The Command Pattern provides the foundation for robust undo/redo systems:

```typescript
interface Command {
  execute(): void | Promise<void>
  undo(): void | Promise<void>
  getDescription(): string
  getTimestamp(): number
  canExecute(): boolean
}

abstract class BaseCommand implements Command {
  protected timestamp: number = Date.now()
  protected description: string

  constructor(description: string) {
    this.description = description
  }

  abstract execute(): void | Promise<void>
  abstract undo(): void | Promise<void>

  getDescription(): string {
    return this.description
  }

  getTimestamp(): number {
    return this.timestamp
  }

  canExecute(): boolean {
    return true
  }
}
```

### 2. History Management System

Centralized history manager with optimized storage:

```typescript
interface HistoryEntry {
  id: string
  command: Command
  stateSnapshot?: any
  metadata: {
    timestamp: number
    description: string
    category: 'user' | 'system' | 'canvas' | 'timer'
    batch?: boolean
  }
}

class OptimizedHistory {
  private undoStack: HistoryEntry[] = []
  private redoStack: HistoryEntry[] = []
  private maxHistorySize = 50
  private compressionThreshold = 20

  async execute(command: Command): Promise<void> {
    if (!command.canExecute()) {
      throw new Error('Command cannot be executed')
    }

    try {
      // Execute the command
      await command.execute()

      // Create history entry
      const entry: HistoryEntry = {
        id: generateId(),
        command,
        metadata: {
          timestamp: Date.now(),
          description: command.getDescription(),
          category: this.categorizeCommand(command)
        }
      }

      // Add to undo stack
      this.undoStack.push(entry)

      // Clear redo stack
      this.redoStack = []

      // Manage history size
      this.optimizeHistory()

    } catch (error) {
      // If execution fails, don't add to history
      throw error
    }
  }

  async undo(): Promise<boolean> {
    if (this.undoStack.length === 0) return false

    const entry = this.undoStack.pop()!

    try {
      await entry.command.undo()
      this.redoStack.push(entry)
      return true
    } catch (error) {
      // If undo fails, put back on undo stack
      this.undoStack.push(entry)
      throw error
    }
  }

  async redo(): Promise<boolean> {
    if (this.redoStack.length === 0) return false

    const entry = this.redoStack.pop()!

    try {
      await entry.command.execute()
      this.undoStack.push(entry)
      return true
    } catch (error) {
      // If redo fails, put back on redo stack
      this.redoStack.push(entry)
      throw error
    }
  }

  private optimizeHistory(): void {
    if (this.undoStack.length <= this.maxHistorySize) return

    // Keep recent entries and important checkpoints
    const important = this.undoStack.filter(entry =>
      entry.metadata.category === 'system' ||
      entry.metadata.description.includes('checkpoint')
    )

    const recent = this.undoStack.slice(-this.maxHistorySize / 2)

    this.undoStack = [...important.slice(0, 10), ...recent]
  }

  private categorizeCommand(command: Command): 'user' | 'system' | 'canvas' | 'timer' {
    const desc = command.getDescription().toLowerCase()
    if (desc.includes('canvas') || desc.includes('move') || desc.includes('drag')) return 'canvas'
    if (desc.includes('timer') || desc.includes('session')) return 'timer'
    if (desc.includes('system') || desc.includes('auto')) return 'system'
    return 'user'
  }
}
```

## Application-Specific Patterns

### PomoFlow Task Management Commands

```typescript
// Task Creation Command
class CreateTaskCommand extends BaseCommand {
  constructor(
    private taskStore: any,
    private taskData: any,
    private generatedId?: string
  ) {
    super(`Create task: ${taskData.title}`)
  }

  async execute(): Promise<void> {
    this.generatedId = await this.taskStore.createTask(this.taskData)
  }

  async undo(): Promise<void> {
    if (this.generatedId) {
      await this.taskStore.deleteTask(this.generatedId)
    }
  }
}

// Task Update Command
class UpdateTaskCommand extends BaseCommand {
  constructor(
    private taskStore: any,
    private taskId: string,
    private updates: any,
    private previousState?: any
  ) {
    super(`Update task: ${updates.title || updates.status || 'properties'}`)
  }

  async execute(): Promise<void> {
    // Capture previous state
    const task = this.taskStore.tasks.find(t => t.id === this.taskId)
    this.previousState = task ? { ...task } : null

    await this.taskStore.updateTask(this.taskId, this.updates)
  }

  async undo(): Promise<void> {
    if (this.previousState) {
      await this.taskStore.updateTask(this.taskId, this.previousState)
    }
  }
}

// Task Deletion Command
class DeleteTaskCommand extends BaseCommand {
  constructor(
    private taskStore: any,
    private taskId: string,
    private deletedTask?: any
  ) {
    super(`Delete task: ${taskId}`)
  }

  async execute(): Promise<void> {
    // Capture task before deletion
    const task = this.taskStore.tasks.find(t => t.id === this.taskId)
    this.deletedTask = task ? { ...task } : null

    await this.taskStore.deleteTask(this.taskId)
  }

  async undo(): Promise<void> {
    if (this.deletedTask) {
      await this.taskStore.createTask(this.deletedTask)
    }
  }
}
```

### Canvas Interaction Commands

```typescript
// Node Movement Command
class MoveNodeCommand extends BaseCommand {
  constructor(
    private canvasStore: any,
    private nodeId: string,
    private fromPosition: { x: number, y: number },
    private toPosition: { x: number, y: number }
  ) {
    super(`Move node ${nodeId} to (${toPosition.x}, ${toPosition.y})`)
  }

  async execute(): Promise<void> {
    await this.canvasStore.updateNodePosition(this.nodeId, this.toPosition)
  }

  async undo(): Promise<void> {
    await this.canvasStore.updateNodePosition(this.nodeId, this.fromPosition)
  }
}

// Batch Operation Command
class BatchCommand extends BaseCommand {
  constructor(
    private commands: Command[],
    description: string
  ) {
    super(description)
  }

  async execute(): Promise<void> {
    // Execute all commands in order
    for (const command of this.commands) {
      await command.execute()
    }
  }

  async undo(): Promise<void> {
    // Undo all commands in reverse order
    for (const command of [...this.commands].reverse()) {
      await command.undo()
    }
  }

  canExecute(): boolean {
    return this.commands.every(cmd => cmd.canExecute())
  }
}

// Canvas Viewport Change Command
class ViewportCommand extends BaseCommand {
  constructor(
    private canvasStore: any,
    private fromViewport: { x: number, y: number, zoom: number },
    private toViewport: { x: number, y: number, zoom: number }
  ) {
    super(`Change viewport to (${toViewport.x}, ${toViewport.y}, ${toViewport.zoom})`)
  }

  async execute(): Promise<void> {
    await this.canvasStore.setViewport(
      this.toViewport.x,
      this.toViewport.y,
      this.toViewport.zoom
    )
  }

  async undo(): Promise<void> {
    await this.canvasStore.setViewport(
      this.fromViewport.x,
      this.fromViewport.y,
      this.fromViewport.zoom
    )
  }
}
```

## State Synchronization Strategies

### Centralized State Manager

```typescript
class ApplicationStateManager {
  private stores = new Map<string, any>()
  private history = new OptimizedHistory()
  private isRecording = true

  registerStore(name: string, store: any): void {
    this.stores.set(name, store)

    // Wrap store methods for automatic history recording
    this.wrapStoreMethods(name, store)
  }

  private wrapStoreMethods(storeName: string, store: any): void {
    const originalMethods = {}

    // Find methods that change state
    for (const [key, value] of Object.entries(store)) {
      if (typeof value === 'function' && key.startsWith('create') ||
          key.startsWith('update') || key.startsWith('delete') ||
          key.startsWith('move')) {

        originalMethods[key] = value

        store[key] = async (...args: any[]) => {
          if (!this.isRecording) {
            return originalMethods[key].apply(store, args)
          }

          // Create appropriate command
          const command = this.createCommand(storeName, key, args, store)

          try {
            await this.history.execute(command)
            return command.getResult()
          } catch (error) {
            console.error(`Failed to execute ${storeName}.${key}:`, error)
            throw error
          }
        }
      }
    }
  }

  private createCommand(storeName: string, method: string, args: any[], store: any): Command {
    switch (storeName) {
      case 'tasks':
        return this.createTaskCommand(method, args, store)
      case 'canvas':
        return this.createCanvasCommand(method, args, store)
      case 'timer':
        return this.createTimerCommand(method, args, store)
      default:
        throw new Error(`Unknown store: ${storeName}`)
    }
  }

  private createTaskCommand(method: string, args: any[], store: any): Command {
    switch (method) {
      case 'createTask':
        return new CreateTaskCommand(store, args[0])
      case 'updateTask':
        return new UpdateTaskCommand(store, args[0], args[1])
      case 'deleteTask':
        return new DeleteTaskCommand(store, args[0])
      // Add other task commands...
      default:
        throw new Error(`Unknown task method: ${method}`)
    }
  }

  async undo(): Promise<boolean> {
    return this.history.undo()
  }

  async redo(): Promise<boolean> {
    return this.history.redo()
  }

  canUndo(): boolean {
    return this.history.undoStack.length > 0
  }

  canRedo(): boolean {
    return this.history.redoStack.length > 0
  }

  pauseRecording(): void {
    this.isRecording = false
  }

  resumeRecording(): void {
    this.isRecording = true
  }

  async createCheckpoint(description: string): Promise<void> {
    const snapshot = await this.captureApplicationState()
    const checkpointCommand = new CheckpointCommand(snapshot, description)
    await this.history.execute(checkpointCommand)
  }

  private async captureApplicationState(): Promise<any> {
    const state = {}

    for (const [name, store] of this.stores) {
      state[name] = await this.serializeStore(store)
    }

    return state
  }

  private async serializeStore(store: any): Promise<any> {
    // Implement safe serialization with circular reference handling
    return this.safeStringify(store)
  }

  private safeStringify(obj: any): any {
    const seen = new WeakSet()

    const replacer = (key: string, value: any) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[Circular]'
        seen.add(value)
      }

      if (typeof value === 'function') return '[Function]'
      if (typeof value === 'symbol') return '[Symbol]'
      if (value === undefined) return null

      return value
    }

    return JSON.parse(JSON.stringify(obj, replacer))
  }
}
```

## Performance Optimization Patterns

### Delta-Based History

```typescript
interface StateDelta {
  path: string[]
  operation: 'add' | 'remove' | 'replace' | 'move'
  value?: any
  oldValue?: any
  from?: any
  to?: any
}

class DeltaHistory {
  private baseState: any = null
  private deltas: StateDelta[][] = []
  private currentDeltaIndex = -1

  createDelta(oldState: any, newState: any): StateDelta[] {
    const deltas: StateDelta[] = []
    this.findDeltas(oldState, newState, [], deltas)
    return deltas
  }

  private findDeltas(oldObj: any, newObj: any, path: string[], deltas: StateDelta[]): void {
    if (oldObj === newObj) return

    if (typeof oldObj !== typeof newObj) {
      deltas.push({
        path: [...path],
        operation: 'replace',
        oldValue: oldObj,
        value: newObj
      })
      return
    }

    if (oldObj === null || newObj === null) {
      if (oldObj !== newObj) {
        deltas.push({
          path: [...path],
          operation: 'replace',
          oldValue: oldObj,
          value: newObj
        })
      }
      return
    }

    if (Array.isArray(oldObj) && Array.isArray(newObj)) {
      this.findArrayDeltas(oldObj, newObj, path, deltas)
    } else if (typeof oldObj === 'object' && typeof newObj === 'object') {
      this.findObjectDeltas(oldObj, newObj, path, deltas)
    } else {
      deltas.push({
        path: [...path],
        operation: 'replace',
        oldValue: oldObj,
        value: newObj
      })
    }
  }

  private findArrayDeltas(oldArr: any[], newArr: any[], path: string[], deltas: StateDelta[]): void {
    // Handle array additions, removals, and modifications
    const maxLength = Math.max(oldArr.length, newArr.length)

    for (let i = 0; i < maxLength; i++) {
      const oldItem = oldArr[i]
      const newItem = newArr[i]

      if (i >= oldArr.length) {
        // Item added
        deltas.push({
          path: [...path, i],
          operation: 'add',
          value: newItem
        })
      } else if (i >= newArr.length) {
        // Item removed
        deltas.push({
          path: [...path, i],
          operation: 'remove',
          oldValue: oldItem
        })
      } else {
        // Check for modifications
        this.findDeltas(oldItem, newItem, [...path, i], deltas)
      }
    }
  }

  private findObjectDeltas(oldObj: any, newObj: any, path: string[], deltas: StateDelta[]): void {
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)])

    for (const key of allKeys) {
      const oldVal = oldObj[key]
      const newVal = newObj[key]

      if (!(key in oldObj)) {
        // Property added
        deltas.push({
          path: [...path, key],
          operation: 'add',
          value: newVal
        })
      } else if (!(key in newObj)) {
        // Property removed
        deltas.push({
          path: [...path, key],
          operation: 'remove',
          oldValue: oldVal
        })
      } else {
        // Check for modifications
        this.findDeltas(oldVal, newVal, [...path, key], deltas)
      }
    }
  }

  applyDelta(baseState: any, delta: StateDelta[]): any {
    let newState = this.deepClone(baseState)

    for (const change of delta) {
      newState = this.applyChange(newState, change)
    }

    return newState
  }

  private applyChange(state: any, change: StateDelta): any {
    let current = state

    // Navigate to the parent of the target
    for (let i = 0; i < change.path.length - 1; i++) {
      current = current[change.path[i]]
    }

    const finalKey = change.path[change.path.length - 1]

    switch (change.operation) {
      case 'add':
        current[finalKey] = change.value
        break
      case 'remove':
        delete current[finalKey]
        break
      case 'replace':
        current[finalKey] = change.value
        break
      case 'move':
        // Handle array moves
        if (Array.isArray(current)) {
          const fromIdx = current.indexOf(change.from)
          const toIdx = change.to
          if (fromIdx !== -1) {
            const [item] = current.splice(fromIdx, 1)
            current.splice(toIdx, 0, item)
          }
        }
        break
    }

    return state
  }

  private deepClone(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj
    if (obj instanceof Date) return new Date(obj.getTime())
    if (obj instanceof Array) return obj.map(item => this.deepClone(item))
    if (typeof obj === 'object') {
      const cloned = {}
      for (const [key, value] of Object.entries(obj)) {
        cloned[key] = this.deepClone(value)
      }
      return cloned
    }
  }
}
```

### Memory Management

```typescript
class MemoryManagedHistory {
  private maxMemoryMB = 50 // Maximum memory usage in MB
  private compressionThreshold = 100 // Compress after N entries
  private entries: HistoryEntry[] = []

  addEntry(entry: HistoryEntry): void {
    this.entries.push(entry)

    // Check memory usage
    if (this.getMemoryUsage() > this.maxMemoryMB) {
      this.optimizeMemory()
    }

    // Compress if needed
    if (this.entries.length > this.compressionThreshold) {
      this.compressEntries()
    }
  }

  private getMemoryUsage(): number {
    // Estimate memory usage in MB
    const totalSize = this.entries.reduce((size, entry) => {
      return size + this.estimateObjectSize(entry.command)
    }, 0)

    return totalSize / (1024 * 1024)
  }

  private estimateObjectSize(obj: any): number {
    const jsonString = JSON.stringify(obj)
    return new Blob([jsonString]).size
  }

  private optimizeMemory(): void {
    // Remove less important entries
    const important = this.entries.filter(entry =>
      entry.metadata.category === 'system' ||
      entry.metadata.description.includes('checkpoint') ||
      entry.metadata.timestamp > Date.now() - 3600000 // Keep last hour
    )

    // Keep a mix of recent and important entries
    const recent = this.entries.slice(-25)

    this.entries = [...important.slice(0, 20), ...recent]
  }

  private compressEntries(): void {
    // Compress older entries using delta compression
    const compressPoint = this.entries.length - 30
    const toCompress = this.entries.slice(0, compressPoint)
    const keep = this.entries.slice(compressPoint)

    if (toCompress.length > 1) {
      const compressed = this.compressGroup(toCompress)
      this.entries = [compressed, ...keep]
    }
  }

  private compressGroup(entries: HistoryEntry[]): HistoryEntry {
    // Create a single checkpoint from multiple entries
    const descriptions = entries.map(e => e.metadata.description).join(', ')

    return {
      id: generateId(),
      command: new CheckpointCommand(
        this.extractStateFromEntries(entries),
        `Checkpoint: ${descriptions}`
      ),
      metadata: {
        timestamp: entries[0].metadata.timestamp,
        description: `Compressed checkpoint (${entries.length} actions)`,
        category: 'system',
        batch: true
      }
    }
  }

  private extractStateFromEntries(entries: HistoryEntry[]): any {
    // Extract final state from a series of entries
    // This would need to be implemented based on your specific state structure
    return {}
  }
}
```

## Integration with Vue.js

### Vue Composable for Undo/Redo

```typescript
// composables/useUndoRedoSystem.ts
import { ref, computed, inject, provide } from 'vue'
import type { ApplicationStateManager } from '@/managers/ApplicationStateManager'

const UndoRedoSymbol = Symbol('undoRedo')

export function provideUndoRedoSystem(stateManager: ApplicationStateManager): void {
  provide(UndoRedoSymbol, stateManager)
}

export function useUndoRedoSystem(): {
  canUndo: any
  canRedo: any
  undo: () => Promise<boolean>
  redo: () => Promise<boolean>
  createCheckpoint: (description: string) => Promise<void>
  getHistory: () => any[]
  clearHistory: () => void
  pauseRecording: () => void
  resumeRecording: () => void
} {
  const stateManager = inject<ApplicationStateManager>(UndoRedoSymbol)

  if (!stateManager) {
    throw new Error('Undo/Redo system not provided. Make sure to call provideUndoRedoSystem() in your app root.')
  }

  const canUndo = computed(() => stateManager.canUndo())
  const canRedo = computed(() => stateManager.canRedo())

  const undo = async (): Promise<boolean> => {
    try {
      return await stateManager.undo()
    } catch (error) {
      console.error('Undo failed:', error)
      return false
    }
  }

  const redo = async (): Promise<boolean> => {
    try {
      return await stateManager.redo()
    } catch (error) {
      console.error('Redo failed:', error)
      return false
    }
  }

  const createCheckpoint = async (description: string): Promise<void> => {
    await stateManager.createCheckpoint(description)
  }

  const getHistory = () => {
    return stateManager.getHistory()
  }

  const clearHistory = () => {
    stateManager.clearHistory()
  }

  const pauseRecording = () => {
    stateManager.pauseRecording()
  }

  const resumeRecording = () => {
    stateManager.resumeRecording()
  }

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    createCheckpoint,
    getHistory,
    clearHistory,
    pauseRecording,
    resumeRecording
  }
}
```

### Keyboard Shortcuts Integration

```typescript
// composables/useUndoRedoShortcuts.ts
import { useMagicKeys } from '@vueuse/core'
import { useUndoRedoSystem } from './useUndoRedoSystem'

export const useUndoRedoShortcuts = () => {
  const { undo, redo, canUndo, canRedo } = useUndoRedoSystem()
  const { ctrl, shift, z, y } = useMagicKeys()

  // Watch for keyboard shortcuts
  watchEffect(() => {
    if (ctrl.value && z.value && !shift.value) {
      if (canUndo.value) {
        undo()
      }
    }
  })

  watchEffect(() => {
    if (ctrl.value && (shift.value && z.value || y.value)) {
      if (canRedo.value) {
        redo()
      }
    }
  })

  return {
    shortcuts: {
      'Ctrl+Z': 'Undo',
      'Ctrl+Shift+Z': 'Redo',
      'Ctrl+Y': 'Redo'
    }
  }
}
```

## Common Pitfalls and Solutions

### 1. Circular Reference Issues

**Problem**: State objects contain circular references that break JSON serialization.

**Solution**: Implement safe serialization with circular reference detection.

```typescript
const safeSerialize = (obj: any): any => {
  const seen = new WeakSet()

  return JSON.parse(JSON.stringify(obj, (key, val) => {
    if (typeof val === 'object' && val !== null) {
      if (seen.has(val)) return '[Circular]'
      seen.add(val)
    }

    if (typeof val === 'function') return '[Function]'
    if (typeof val === 'symbol') return '[Symbol]'
    if (val === undefined) return null

    return val
  }))
}
```

### 2. Memory Leaks

**Problem**: Undo history grows indefinitely, consuming memory.

**Solution**: Implement automatic cleanup and compression.

```typescript
class MemoryOptimizedHistory {
  private maxSize = 50
  private compressionThreshold = 20
  private entries: HistoryEntry[] = []

  add(entry: HistoryEntry): void {
    this.entries.push(entry)

    if (this.entries.length > this.maxSize) {
      this.optimize()
    }
  }

  private optimize(): void {
    // Keep recent and important entries
    const recent = this.entries.slice(-this.maxSize / 2)
    const important = this.entries.filter(e =>
      e.metadata.category === 'system' ||
      e.metadata.description.includes('checkpoint')
    ).slice(0, 10)

    this.entries = [...important, ...recent]
  }
}
```

### 3. Race Conditions

**Problem**: Concurrent state modifications cause inconsistent history.

**Solution**: Implement operation queuing and locking.

```typescript
class ThreadSafeHistory {
  private isProcessing = false
  private operationQueue: (() => Promise<void>)[] = []

  async execute(command: Command): Promise<void> {
    return new Promise((resolve, reject) => {
      this.operationQueue.push(async () => {
        try {
          await this.processCommand(command)
          resolve()
        } catch (error) {
          reject(error)
        }
      })

      this.processQueue()
    })
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.operationQueue.length === 0) {
      return
    }

    this.isProcessing = true

    while (this.operationQueue.length > 0) {
      const operation = this.operationQueue.shift()!
      await operation()
    }

    this.isProcessing = false
  }
}
```

### 4. Performance with Large States

**Problem**: Cloning large state objects is slow and memory-intensive.

**Solution**: Use delta compression and lazy loading.

```typescript
class DeltaCompressedHistory {
  private baseState: any = null
  private deltas: StateDelta[] = []

  saveState(newState: any): void {
    if (!this.baseState) {
      this.baseState = this.deepClone(newState)
      return
    }

    const delta = this.createDelta(this.baseState, newState)
    this.deltas.push(delta)

    // Periodically update base state
    if (this.deltas.length > 10) {
      this.baseState = this.deepClone(newState)
      this.deltas = []
    }
  }

  restoreState(index: number): any {
    let state = this.deepClone(this.baseState)

    for (let i = 0; i <= index; i++) {
      state = this.applyDelta(state, this.deltas[i])
    }

    return state
  }
}
```

## Testing Strategies

### Unit Testing Commands

```typescript
describe('CreateTaskCommand', () => {
  test('should create task and undo correctly', async () => {
    const taskStore = createMockTaskStore()
    const command = new CreateTaskCommand(taskStore, { title: 'Test Task' })

    // Test execution
    await command.execute()
    expect(taskStore.tasks).toHaveLength(1)
    expect(taskStore.tasks[0].title).toBe('Test Task')

    // Test undo
    await command.undo()
    expect(taskStore.tasks).toHaveLength(0)
  })

  test('should handle execution failure gracefully', async () => {
    const taskStore = createMockTaskStore()
    taskStore.createTask = jest.fn().mockRejectedValue(new Error('Creation failed'))

    const command = new CreateTaskCommand(taskStore, { title: 'Test Task' })

    await expect(command.execute()).rejects.toThrow('Creation failed')
    expect(taskStore.tasks).toHaveLength(0)
  })
})
```

### Integration Testing

```typescript
describe('Undo/Redo System Integration', () => {
  test('should maintain consistency across multiple stores', async () => {
    const stateManager = new ApplicationStateManager()
    const taskStore = createMockTaskStore()
    const canvasStore = createMockCanvasStore()

    stateManager.registerStore('tasks', taskStore)
    stateManager.registerStore('canvas', canvasStore)

    // Perform operations across stores
    await taskStore.createTask({ title: 'Task 1' })
    await canvasStore.createNode({ taskId: 'Task 1', position: { x: 100, y: 100 } })
    await taskStore.updateTask('Task 1', { status: 'in-progress' })

    // Verify all states are captured
    expect(taskStore.tasks).toHaveLength(1)
    expect(canvasStore.nodes).toHaveLength(1)
    expect(taskStore.tasks[0].status).toBe('in-progress')

    // Undo operations
    await stateManager.undo()
    expect(taskStore.tasks[0].status).not.toBe('in-progress')

    await stateManager.undo()
    expect(canvasStore.nodes).toHaveLength(0)

    await stateManager.undo()
    expect(taskStore.tasks).toHaveLength(0)
  })
})
```

## Skill Activation Message
When this skill is used, Claude Code will start with:
```
⏮️ **UNDO/REDO SYSTEMS SKILL ACTIVATED**
Implementing robust undo/redo architecture with command pattern, state synchronization, and performance optimization...
```

## Implementation Checklist

Before implementing undo/redo systems:
- [ ] Analyze current state management structure
- [ ] Identify all mutable operations across stores
- [ ] Choose appropriate storage strategy (snapshots vs deltas)
- [ ] Design command hierarchy for your domain
- [ ] Plan memory management and optimization strategy
- [ ] Set up comprehensive testing framework
- [ ] Implement error handling and recovery mechanisms
- [ ] Create debugging and monitoring tools

This skill provides a complete architecture for implementing scalable, maintainable undo/redo systems that can handle complex application state while maintaining performance and user experience.