# State Synchronization Strategies

## Cross-Component State Management

### Centralized State Coordinator

```typescript
class StateCoordinator {
  private stores = new Map<string, StoreWrapper>()
  private eventBus = new EventTarget()
  private transactionInProgress = false
  private pendingOperations: Operation[] = []

  registerStore(name: string, store: any): void {
    const wrapper = new StoreWrapper(name, store, this.eventBus)
    this.stores.set(name, wrapper)
    this.wrapStoreMethods(wrapper)
  }

  private wrapStoreMethods(wrapper: StoreWrapper): void {
    const store = wrapper.store
    const originalMethods = new Map()

    // Identify and wrap state-changing methods
    Object.getOwnPropertyNames(Object.getPrototypeOf(store)).forEach(methodName => {
      const method = store[methodName]
      if (typeof method === 'function' && this.isStateChangingMethod(methodName)) {
        originalMethods.set(methodName, method)

        store[methodName] = async (...args: any[]) => {
          if (this.transactionInProgress) {
            return this.addToTransaction(wrapper.name, methodName, args, originalMethods.get(methodName))
          }

          return this.executeOperation(wrapper.name, methodName, args, originalMethods.get(methodName))
        }
      }
    })
  }

  private isStateChangingMethod(methodName: string): boolean {
    const stateChangingPatterns = [
      /^create/, /^update/, /^delete/, /^move/, /^add/, /^remove/,
      /^toggle/, /^set/, /^clear/, /^reset/, /^start/, /^stop/, /^pause/
    ]
    return stateChangingPatterns.some(pattern => pattern.test(methodName))
  }

  async executeOperation(storeName: string, method: string, args: any[], originalMethod: Function): Promise<any> {
    const operation = new Operation(storeName, method, args, originalMethod)

    try {
      // Emit pre-operation event
      this.eventBus.dispatchEvent(new CustomEvent('state:beforeChange', {
        detail: { operation, storeName, method, args }
      }))

      // Execute the operation
      const result = await operation.execute()

      // Emit post-operation event
      this.eventBus.dispatchEvent(new CustomEvent('state:changed', {
        detail: { operation, result, storeName, method, args }
      }))

      return result

    } catch (error) {
      this.eventBus.dispatchEvent(new CustomEvent('state:error', {
        detail: { operation, error, storeName, method, args }
      }))
      throw error
    }
  }

  async beginTransaction<T>(operations: () => Promise<T>): Promise<T> {
    if (this.transactionInProgress) {
      throw new Error('Transaction already in progress')
    }

    this.transactionInProgress = true
    this.pendingOperations = []

    try {
      const result = await operations()
      await this.commitTransaction()
      return result
    } catch (error) {
      await this.rollbackTransaction()
      throw error
    } finally {
      this.transactionInProgress = false
      this.pendingOperations = []
    }
  }

  private async commitTransaction(): Promise<void> {
    const batchEvent = new CustomEvent('state:batchChange', {
      detail: { operations: this.pendingOperations }
    })

    this.eventBus.dispatchEvent(batchEvent)
  }

  private async rollbackTransaction(): Promise<void> {
    // Reverse operations for rollback
    for (let i = this.pendingOperations.length - 1; i >= 0; i--) {
      const operation = this.pendingOperations[i]
      try {
        await operation.rollback()
      } catch (error) {
        console.error('Failed to rollback operation:', error)
      }
    }

    this.eventBus.dispatchEvent(new CustomEvent('state:rollback', {
      detail: { operations: this.pendingOperations }
    }))
  }
}

class StoreWrapper {
  constructor(
    public name: string,
    public store: any,
    private eventBus: EventTarget
  ) {}

  getState(): any {
    return this.deepClone(this.store.$state || this.store)
  }

  setState(state: any): void {
    if (this.store.$patch) {
      this.store.$patch(state)
    } else {
      Object.assign(this.store, state)
    }
  }

  private deepClone(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj
    if (obj instanceof Date) return new Date(obj.getTime())
    if (Array.isArray(obj)) return obj.map(item => this.deepClone(item))

    const cloned = {}
    for (const [key, value] of Object.entries(obj)) {
      cloned[key] = this.deepClone(value)
    }
    return cloned
  }
}

class Operation {
  private rollbackData?: any
  private result?: any

  constructor(
    public storeName: string,
    public method: string,
    public args: any[],
    private originalMethod: Function
  ) {}

  async execute(): Promise<any> {
    // Store state for potential rollback
    const stateCoordinator = getStateCoordinator()
    const store = stateCoordinator.stores.get(this.storeName)?.store
    if (store) {
      this.rollbackData = store.getState ? store.getState() : stateCoordinator.deepClone(store)
    }

    this.result = await this.originalMethod.apply(null, this.args)
    return this.result
  }

  async rollback(): Promise<void> {
    if (!this.rollbackData) return

    const stateCoordinator = getStateCoordinator()
    const store = stateCoordinator.stores.get(this.storeName)?.store
    if (store) {
      store.setState(this.rollbackData)
    }
  }

  getUndoCommand(): Command {
    return new RollbackCommand(this.storeName, this.rollbackData)
  }
}
```

### Reactive State Synchronization

```typescript
class ReactiveStateSync {
  private watchers = new Map<string, Set<Watcher>>()
  private syncQueue: SyncOperation[] = []
  private isProcessing = false

  watch(storeName: string, path: string, callback: (newValue: any, oldValue: any) => void): () => void {
    const key = `${storeName}.${path}`

    if (!this.watchers.has(key)) {
      this.watchers.set(key, new Set())
    }

    const watcher: Watcher = {
      id: generateId(),
      callback,
      path
    }

    this.watchers.get(key)!.add(watcher)

    // Return unwatch function
    return () => {
      this.watchers.get(key)?.delete(watcher)
    }
  }

  notifyChange(storeName: string, path: string, newValue: any, oldValue: any): void {
    const key = `${storeName}.${path}`
    const watchers = this.watchers.get(key)

    if (watchers) {
      const operation: SyncOperation = {
        type: 'change',
        storeName,
        path,
        newValue,
        oldValue,
        watchers: Array.from(watchers),
        timestamp: Date.now()
      }

      this.syncQueue.push(operation)
      this.processQueue()
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return

    this.isProcessing = true

    while (this.syncQueue.length > 0) {
      const operation = this.syncQueue.shift()!

      try {
        await this.processOperation(operation)
      } catch (error) {
        console.error('Failed to process sync operation:', error)
      }
    }

    this.isProcessing = false
  }

  private async processOperation(operation: SyncOperation): Promise<void> {
    if (operation.type === 'change') {
      await Promise.all(
        operation.watchers.map(watcher =>
          Promise.resolve().then(() =>
            watcher.callback(operation.newValue, operation.oldValue)
          )
        )
      )
    }
  }

  batchNotify(operations: Array<{
    storeName: string
    path: string
    newValue: any
    oldValue: any
  }>): void {
    const batchOperation: SyncOperation = {
      type: 'batch',
      operations,
      timestamp: Date.now()
    }

    this.syncQueue.push(batchOperation)
    this.processQueue()
  }
}

interface Watcher {
  id: string
  callback: (newValue: any, oldValue: any) => void
  path: string
}

interface SyncOperation {
  type: 'change' | 'batch'
  storeName?: string
  path?: string
  newValue?: any
  oldValue?: any
  watchers?: Watcher[]
  operations?: Array<{
    storeName: string
    path: string
    newValue: any
    oldValue: any
  }>
  timestamp: number
}
```

## Conflict Resolution for Collaborative Features

### Operational Transformation (OT) Implementation

```typescript
class OperationTransform {
  // Transform two concurrent operations
  static transform(op1: Operation, op2: Operation): [Operation, Operation] {
    if (op1.type === 'insert' && op2.type === 'insert') {
      return this.transformInsertInsert(op1, op2)
    } else if (op1.type === 'insert' && op2.type === 'delete') {
      return this.transformInsertDelete(op1, op2)
    } else if (op1.type === 'delete' && op2.type === 'insert') {
      const [op2Prime, op1Prime] = this.transformInsertDelete(op2, op1)
      return [op1Prime, op2Prime]
    } else if (op1.type === 'delete' && op2.type === 'delete') {
      return this.transformDeleteDelete(op1, op2)
    }

    return [op1, op2]
  }

  private static transformInsertInsert(op1: InsertOperation, op2: InsertOperation): [InsertOperation, InsertOperation] {
    if (op1.position <= op2.position) {
      // op1 comes before op2
      return [
        op1,
        { ...op2, position: op2.position + op1.text.length }
      ]
    } else {
      // op2 comes before op1
      return [
        { ...op1, position: op1.position + op2.text.length },
        op2
      ]
    }
  }

  private static transformInsertDelete(insert: InsertOperation, delete: DeleteOperation): [InsertOperation, DeleteOperation] {
    if (insert.position <= delete.start) {
      // Insert comes before delete
      return [
        insert,
        { ...delete, start: delete.start + insert.text.length, end: delete.end + insert.text.length }
      ]
    } else if (insert.position >= delete.end) {
      // Insert comes after delete
      return [
        { ...insert, position: insert.position - (delete.end - delete.start) },
        delete
      ]
    } else {
      // Insert is inside delete range
      return [
        { ...insert, position: delete.start },
        delete
      ]
    }
  }

  private static transformDeleteDelete(op1: DeleteOperation, op2: DeleteOperation): [DeleteOperation, DeleteOperation] {
    if (op1.end <= op2.start) {
      // op1 comes before op2
      return [
        op1,
        { ...op2, start: op2.start - (op1.end - op1.start), end: op2.end - (op1.end - op1.start) }
      ]
    } else if (op2.end <= op1.start) {
      // op2 comes before op1
      return [
        { ...op1, start: op1.start - (op2.end - op2.start), end: op1.end - (op2.end - op2.start) },
        op2
      ]
    } else {
      // Overlapping deletes - normalize to single operation
      const start = Math.min(op1.start, op2.start)
      const end = Math.max(op1.end, op2.end)
      const normalizedDelete: DeleteOperation = { type: 'delete', start, end }
      return [normalizedDelete, normalizedDelete]
    }
  }
}

interface BaseOperation {
  type: 'insert' | 'delete' | 'retain'
  id: string
  timestamp: number
}

interface InsertOperation extends BaseOperation {
  type: 'insert'
  position: number
  text: string
}

interface DeleteOperation extends BaseOperation {
  type: 'delete'
  start: number
  end: number
}

interface RetainOperation extends BaseOperation {
  type: 'retain'
  length: number
}
```

### CRDT (Conflict-free Replicated Data Type) Implementation

```typescript
class LWWRegister {
  constructor(
    private value: any = null,
    private timestamp: number = 0,
    private nodeId: string = ''
  ) {}

  set(newValue: any, timestamp: number, nodeId: string): void {
    if (timestamp > this.timestamp || (timestamp === this.timestamp && nodeId > this.nodeId)) {
      this.value = newValue
      this.timestamp = timestamp
      this.nodeId = nodeId
    }
  }

  getValue(): any {
    return this.value
  }

  merge(other: LWWRegister): void {
    if (other.timestamp > this.timestamp ||
        (other.timestamp === this.timestamp && other.nodeId > this.nodeId)) {
      this.value = other.value
      this.timestamp = other.timestamp
      this.nodeId = other.nodeId
    }
  }
}

class ORSet {
  private added = new Map<string, any>()
  private removed = new Set<string>()

  add(element: any, id: string): void {
    this.added.set(id, element)
    this.removed.delete(id)
  }

  remove(id: string): void {
    if (this.added.has(id)) {
      this.removed.add(id)
    }
  }

  getElements(): any[] {
    return Array.from(this.added.entries())
      .filter(([id]) => !this.removed.has(id))
      .map(([, element]) => element)
  }

  merge(other: ORSet): void {
    // Merge added elements
    for (const [id, element] of other.added) {
      if (!this.removed.has(id)) {
        this.added.set(id, element)
      }
    }

    // Merge removed elements
    for (const id of other.removed) {
      this.removed.add(id)
    }
  }
}
```

## Real-time Synchronization

### WebSocket-based State Sync

```typescript
class StateSynchronizer {
  private ws: WebSocket | null = null
  private pendingUpdates = new Map<string, any>()
  private version = 0
  private isConnected = false

  constructor(private url: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        this.isConnected = true
        this.requestInitialState()
        resolve()
      }

      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data))
      }

      this.ws.onclose = () => {
        this.isConnected = false
        this.handleReconnect()
      }

      this.ws.onerror = (error) => {
        reject(error)
      }
    })
  }

  private requestInitialState(): void {
    this.send({
      type: 'request_state',
      version: this.version
    })
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case 'state_update':
        this.applyStateUpdate(message.payload)
        break
      case 'initial_state':
        this.applyInitialState(message.payload)
        break
      case 'operation':
        this.applyRemoteOperation(message.payload)
        break
      case 'ack':
        this.handleAck(message.operationId)
        break
    }
  }

  sendOperation(operation: Operation): void {
    if (!this.isConnected) {
      // Queue operation for when connection is restored
      this.pendingUpdates.set(operation.id, operation)
      return
    }

    this.send({
      type: 'operation',
      payload: operation,
      version: this.version + 1
    })

    this.version++
  }

  private applyRemoteOperation(operation: Operation): void {
    // Transform against local pending operations
    const transformed = this.transformAgainstPending(operation)

    // Apply the transformed operation
    this.applyOperation(transformed)
  }

  private transformAgainstPending(operation: Operation): Operation {
    let transformedOp = operation

    for (const pendingOp of this.pendingUpdates.values()) {
      if (pendingOp.id !== operation.id) {
        const [op1, op2] = OperationTransform.transform(transformedOp, pendingOp)
        transformedOp = op1
      }
    }

    return transformedOp
  }

  private applyOperation(operation: Operation): void {
    // Apply operation to local state
    switch (operation.type) {
      case 'create_task':
        this.handleCreateTask(operation.payload)
        break
      case 'update_task':
        this.handleUpdateTask(operation.payload)
        break
      case 'delete_task':
        this.handleDeleteTask(operation.payload)
        break
      // Add other operation types...
    }
  }

  private send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  private handleReconnect(): void {
    setTimeout(() => {
      this.connect().then(() => {
        // Resend pending operations
        for (const operation of this.pendingUpdates.values()) {
          this.sendOperation(operation)
        }
      })
    }, 1000)
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.isConnected = false
  }
}
```

### Optimistic Updates with Rollback

```typescript
class OptimisticUpdater {
  private pendingOperations = new Map<string, PendingOperation>()
  private rollbackStack: RollbackData[] = []

  async executeWithOptimism<T>(
    operationId: string,
    optimisticUpdate: () => void,
    serverOperation: () => Promise<T>
  ): Promise<T> {
    // Create rollback data before optimistic update
    const rollbackData = this.captureRollbackData()
    this.rollbackStack.push(rollbackData)

    try {
      // Apply optimistic update immediately
      optimisticUpdate()

      // Track the pending operation
      this.pendingOperations.set(operationId, {
        id: operationId,
        rollbackData,
        timestamp: Date.now()
      })

      // Execute server operation
      const result = await serverOperation()

      // Success - remove from pending
      this.pendingOperations.delete(operationId)
      this.rollbackStack.pop()

      return result

    } catch (error) {
      // Failed - rollback optimistic update
      this.rollbackTo(rollbackData)
      this.pendingOperations.delete(operationId)
      this.rollbackStack.pop()

      throw error
    }
  }

  private captureRollbackData(): RollbackData {
    // Capture current state of all relevant stores
    const stateCoordinator = getStateCoordinator()
    const state = {}

    for (const [name, wrapper] of stateCoordinator.stores) {
      state[name] = wrapper.getState()
    }

    return {
      state,
      timestamp: Date.now(),
      operations: Array.from(this.pendingOperations.values())
    }
  }

  private rollbackTo(rollbackData: RollbackData): void {
    const stateCoordinator = getStateCoordinator()

    for (const [storeName, storeState] of Object.entries(rollbackData.state)) {
      const wrapper = stateCoordinator.stores.get(storeName)
      if (wrapper) {
        wrapper.setState(storeState)
      }
    }
  }

  getPendingOperations(): PendingOperation[] {
    return Array.from(this.pendingOperations.values())
  }

  hasPendingOperation(operationId: string): boolean {
    return this.pendingOperations.has(operationId)
  }
}

interface PendingOperation {
  id: string
  rollbackData: RollbackData
  timestamp: number
}

interface RollbackData {
  state: Record<string, any>
  timestamp: number
  operations: PendingOperation[]
}
```

## Performance Optimization

### Delta Compression for State Updates

```typescript
class StateDeltaCompressor {
  compress(oldState: any, newState: any): StateDelta {
    const delta = {
      timestamp: Date.now(),
      operations: [] as DeltaOperation[]
    }

    this.findDeltas(oldState, newState, [], delta.operations)
    return delta
  }

  decompress(baseState: any, delta: StateDelta): any {
    let currentState = this.deepClone(baseState)

    for (const operation of delta.operations) {
      currentState = this.applyDeltaOperation(currentState, operation)
    }

    return currentState
  }

  private findDeltas(
    oldObj: any,
    newObj: any,
    path: string[],
    operations: DeltaOperation[]
  ): void {
    if (oldObj === newObj) return

    if (typeof oldObj !== typeof newObj) {
      operations.push({
        type: 'replace',
        path: [...path],
        value: newObj,
        oldValue: oldObj
      })
      return
    }

    if (oldObj === null || newObj === null) {
      if (oldObj !== newObj) {
        operations.push({
          type: 'replace',
          path: [...path],
          value: newObj,
          oldValue: oldObj
        })
      }
      return
    }

    if (Array.isArray(oldObj) && Array.isArray(newObj)) {
      this.findArrayDeltas(oldObj, newObj, path, operations)
    } else if (typeof oldObj === 'object' && typeof newObj === 'object') {
      this.findObjectDeltas(oldObj, newObj, path, operations)
    } else {
      operations.push({
        type: 'replace',
        path: [...path],
        value: newObj,
        oldValue: oldObj
      })
    }
  }

  private findArrayDeltas(
    oldArr: any[],
    newArr: any[],
    path: string[],
    operations: DeltaOperation[]
  ): void {
    const minLength = Math.min(oldArr.length, newArr.length)
    const maxLength = Math.max(oldArr.length, newArr.length)

    // Find common prefix
    let prefixLength = 0
    for (let i = 0; i < minLength; i++) {
      if (this.deepEqual(oldArr[i], newArr[i])) {
        prefixLength++
      } else {
        break
      }
    }

    // Find common suffix
    let suffixLength = 0
    for (let i = 0; i < minLength - prefixLength; i++) {
      const oldIndex = oldArr.length - 1 - i
      const newIndex = newArr.length - 1 - i

      if (this.deepEqual(oldArr[oldIndex], newArr[newIndex])) {
        suffixLength++
      } else {
        break
      }
    }

    // Handle removed items
    if (oldArr.length > prefixLength + suffixLength) {
      operations.push({
        type: 'remove',
        path: [...path],
        start: prefixLength,
        count: oldArr.length - prefixLength - suffixLength,
        removedItems: oldArr.slice(prefixLength, oldArr.length - suffixLength)
      })
    }

    // Handle added items
    if (newArr.length > prefixLength + suffixLength) {
      operations.push({
        type: 'insert',
        path: [...path],
        start: prefixLength,
        items: newArr.slice(prefixLength, newArr.length - suffixLength)
      })
    }

    // Handle modified middle section if both arrays had items
    const oldMiddle = oldArr.slice(prefixLength, oldArr.length - suffixLength)
    const newMiddle = newArr.slice(prefixLength, newArr.length - suffixLength)

    if (oldMiddle.length > 0 && newMiddle.length > 0) {
      this.findDeltas(oldMiddle, newMiddle, [...path, prefixLength], operations)
    }
  }

  private findObjectDeltas(
    oldObj: any,
    newObj: any,
    path: string[],
    operations: DeltaOperation[]
  ): void {
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)])

    for (const key of allKeys) {
      const oldVal = oldObj[key]
      const newVal = newObj[key]

      if (!(key in oldObj)) {
        // Property added
        operations.push({
          type: 'add',
          path: [...path, key],
          value: newVal
        })
      } else if (!(key in newObj)) {
        // Property removed
        operations.push({
          type: 'remove',
          path: [...path, key],
          oldValue: oldVal
        })
      } else {
        // Check for modifications
        this.findDeltas(oldVal, newVal, [...path, key], operations)
      }
    }
  }

  private applyDeltaOperation(state: any, operation: DeltaOperation): any {
    let current = state

    // Navigate to parent of target
    for (let i = 0; i < operation.path.length - 1; i++) {
      current = current[operation.path[i]]
    }

    const finalKey = operation.path[operation.path.length - 1]

    switch (operation.type) {
      case 'add':
        if (operation.path.length === 1) {
          // Adding to root array
          current.push(operation.value)
        } else {
          current[finalKey] = operation.value
        }
        break

      case 'remove':
        if (operation.path.length === 0 && Array.isArray(current)) {
          // Remove from root array
          if (typeof operation.start === 'number') {
            current.splice(operation.start, operation.count || 1)
          } else {
            const index = current.indexOf(finalKey)
            if (index !== -1) current.splice(index, 1)
          }
        } else {
          delete current[finalKey]
        }
        break

      case 'replace':
        if (operation.path.length === 0) {
          // Replace root
          return operation.value
        } else {
          current[finalKey] = operation.value
        }
        break

      case 'insert':
        if (Array.isArray(current)) {
          current.splice(operation.start, 0, ...operation.items)
        }
        break
    }

    return state
  }

  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true
    if (a == null || b == null) return a === b
    if (Array.isArray(a) && Array.isArray(b)) {
      return a.length === b.length && a.every((val, i) => this.deepEqual(val, b[i]))
    }
    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a)
      const keysB = Object.keys(b)
      return keysA.length === keysB.length &&
        keysA.every(key => this.deepEqual(a[key], b[key]))
    }
    return false
  }

  private deepClone(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj
    if (obj instanceof Date) return new Date(obj.getTime())
    if (Array.isArray(obj)) return obj.map(item => this.deepClone(item))

    const cloned = {}
    for (const [key, value] of Object.entries(obj)) {
      cloned[key] = this.deepClone(value)
    }
    return cloned
  }
}

interface StateDelta {
  timestamp: number
  operations: DeltaOperation[]
}

interface DeltaOperation {
  type: 'add' | 'remove' | 'replace' | 'insert'
  path: string[]
  value?: any
  oldValue?: any
  start?: number
  count?: number
  items?: any[]
  removedItems?: any[]
}
```

This comprehensive state synchronization documentation provides patterns for managing complex state across multiple components, handling conflicts in collaborative scenarios, and optimizing performance for real-time applications.