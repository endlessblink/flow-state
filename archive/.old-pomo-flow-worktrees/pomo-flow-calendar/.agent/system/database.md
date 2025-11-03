# Pomo-Flow Database Architecture

## Overview

Pomo-Flow uses **IndexedDB** via **LocalForage** for client-side data persistence. This provides a robust, offline-capable storage solution with automatic fallbacks and excellent browser compatibility.

## Database Configuration

### LocalForage Instance
```typescript
const db = localforage.createInstance({
  name: 'pomo-flow',
  version: 1.0,
  storeName: 'pomo_flow_data',
  description: 'Pomo-Flow productivity data storage'
})
```

**Key Features:**
- **Automatic fallback**: IndexedDB → WebSQL → localStorage
- **Promise-based API** for async operations
- **Data serialization** via JSON.stringify/parse
- **Cross-browser compatibility** with consistent API

### Database Keys Schema

```typescript
export const DB_KEYS = {
  TASKS: 'tasks',           // Main task storage
  PROJECTS: 'projects',     // Project definitions
  CANVAS: 'canvas',         // Canvas layout data
  TIMER: 'timer',          // Timer session history
  SETTINGS: 'settings',    // App preferences
  VERSION: 'version'       // Schema version tracking
} as const
```

## Data Models

### 1. Task Model

```typescript
interface Task {
  // Core fields
  id: string                    // Unique timestamp-based identifier
  title: string                 // Display title
  description: string           // Detailed description
  status: TaskStatus           // Task lifecycle status
  priority: TaskPriority       // Priority level
  progress: number             // 0-100 completion percentage
  
  // Time tracking
  completedPomodoros: number   // Completed pomodoro sessions
  estimatedDuration?: number    // Estimated minutes per session
  
  // Scheduling
  dueDate: string              // ISO date string for deadline
  instances: TaskInstance[]    // Calendar occurrences (NEW system)
  
  // Legacy scheduling (backward compatibility)
  scheduledDate?: string       // DEPRECATED - use instances
  scheduledTime?: string       // DEPRECATED - use instances
  
  // Hierarchy
  subtasks: Subtask[]          // Nested subtask structure
  projectId: string            // Project association
  
  // Metadata
  createdAt: Date              // Creation timestamp
  updatedAt: Date              // Last modification
  
  // Canvas-specific fields
  canvasPosition?: { x: number; y: number }
  isInInbox?: boolean          // Unpositioned in canvas
  dependsOn?: string[]         // Task dependency IDs
  connectionTypes?: { [taskId: string]: ConnectionType }
}
```

### 2. Task Instance Model (NEW)

```typescript
interface TaskInstance {
  id: string                    // Unique instance identifier
  scheduledDate: string         // ISO date for calendar
  scheduledTime: string         // Time slot (HH:MM format)
  duration?: number            // Duration override in minutes
  completedPomodoros?: number  // Instance-specific pomodoro count
  isLater?: boolean           // Special flag for "Later" column
}
```

**Key Benefits of Instance System:**
- **Task reuse**: Same task can appear multiple times in calendar
- **Instance-specific data**: Different durations/pomodoros per occurrence
- **Backward compatibility**: Legacy fields still supported
- **Flexible scheduling**: Tasks can be scheduled for multiple dates

### 3. Subtask Model

```typescript
interface Subtask {
  id: string                    // Unique identifier
  parentTaskId: string          // Parent task reference
  title: string                 // Subtask title
  description: string           // Detailed description
  completedPomodoros: number    // Pomodoro sessions for subtask
  isCompleted: boolean         // Completion status
  createdAt: Date              // Creation time
  updatedAt: Date              // Last modification
}
```

### 4. Project Model

```typescript
interface Project {
  id: string                    // Unique identifier
  name: string                 // Project display name
  color: string                // Hex color for UI
  viewType: ProjectViewType    // Default Kanban view type
  parentId?: string | null     // Nested project support
  createdAt: Date              // Creation timestamp
}

type ProjectViewType = 'status' | 'date' | 'priority'
```

### 5. Canvas Data Model

```typescript
interface CanvasData {
  sections: CanvasSection[]    // Canvas organization sections
  connections: Connection[]    // Task dependencies
  viewport: ViewportState      // Canvas pan/zoom state
  selectedNodeIds: string[]    // Current selection
}

interface CanvasSection {
  id: string                   // Unique section identifier
  name: string                 // Section title
  position: { x: number; y: number }
  taskIds: string[]            // Tasks in this section
}
```

### 6. Timer Session Model

```typescript
interface TimerSession {
  id: string                   // Session identifier
  taskId: string               // Associated task
  type: 'pomodoro' | 'break'   // Session type
  duration: number             // Planned duration (minutes)
  actualDuration?: number      // Actual duration (minutes)
  completed: boolean           // Success status
  interruptions: number        // Interruption count
  startTime: Date              // Session start
  endTime?: Date               // Session end
}
```

### 7. Settings Model

```typescript
interface AppSettings {
  theme: 'dark' | 'light'      // UI theme preference
  pomodoroDuration: number     // Default pomodoro minutes
  breakDuration: number        // Default break minutes
  notifications: boolean       // Browser notifications
  autoSave: boolean           // Auto-save preference
  version: string             // Last app version
  preferences: UserPreferences // Additional user settings
}
```

## Data Flow Architecture

### 1. Store Integration Flow

```
Vue Component → Pinia Store → Database Composable → IndexedDB
      ↓              ↓              ↓                  ↓
User Action   → State Update → useDatabase() → LocalForage API
      ↓              ↓              ↓                  ↓
UI Reactivity ← Computed ← Store State ← Auto-save (debounced)
```

### 2. Persistence Strategy

**Auto-save with Debouncing**
```typescript
// 1-second debounce to prevent excessive writes
watch(tasks, (newTasks) => {
  if (tasksSaveTimer) clearTimeout(tasksSaveTimer)
  tasksSaveTimer = setTimeout(() => {
    db.save(DB_KEYS.TASKS, newTasks)
  }, 1000)
}, { deep: true, flush: 'post' })
```

**Load on Initialization**
```typescript
const loadFromDatabase = async () => {
  const savedTasks = await db.load<Task[]>(DB_KEYS.TASKS)
  if (savedTasks) {
    tasks.value = savedTasks.map(task => ({
      ...task,
      createdAt: new Date(task.createdAt),
      updatedAt: new Date(task.updatedAt)
    }))
  }
}
```

### 3. Data Migration System

**Legacy Task Migration**
```typescript
const migrateLegacyTasks = () => {
  tasks.value.forEach(task => {
    // Convert legacy scheduled fields to instances array
    if (task.scheduledDate && task.scheduledTime && !task.instances?.length) {
      task.instances = [{
        id: `migrated-${task.id}-${Date.now()}`,
        scheduledDate: task.scheduledDate,
        scheduledTime: task.scheduledTime,
        duration: task.estimatedDuration
      }]
    }
  })
}
```

**Project View Type Migration**
```typescript
const migrateProjects = () => {
  projects.value.forEach(project => {
    if (!project.viewType) {
      project.viewType = 'status' // Default view type
    }
  })
}
```

## Query Patterns

### 1. Task Filtering

**By Project**
```typescript
const filteredTasks = computed(() => {
  let filtered = tasks.value
  if (activeProjectId.value) {
    filtered = filtered.filter(task => task.projectId === activeProjectId.value)
  }
  return filtered
})
```

**By Smart Views**
```typescript
// Today view - combines multiple criteria
if (activeSmartView.value === 'today') {
  filtered = filtered.filter(task => {
    const todayStr = new Date().toISOString().split('T')[0]
    
    // Check instances (new format)
    const instances = getTaskInstances(task)
    if (instances.some(inst => inst.scheduledDate === todayStr)) {
      return true
    }
    
    // Legacy scheduled date fallback
    if (task.scheduledDate === todayStr) return true
    
    // Tasks created today
    const taskCreatedDate = new Date(task.createdAt)
    taskCreatedDate.setHours(0, 0, 0, 0)
    if (taskCreatedDate.getTime() === today.getTime()) return true
    
    // Tasks due today
    if (task.dueDate === todayStr) return true
    
    // Currently in progress
    if (task.status === 'in_progress') return true
    
    return false
  })
}
```

### 2. Instance Management

**Get Task Instances Helper**
```typescript
export const getTaskInstances = (task: Task): TaskInstance[] => {
  // New format: instances array
  if (task.instances && task.instances.length > 0) {
    return task.instances
  }
  
  // Legacy format: create synthetic instance
  if (task.scheduledDate && task.scheduledTime) {
    return [{
      id: `legacy-${task.id}`,
      scheduledDate: task.scheduledDate,
      scheduledTime: task.scheduledTime,
      duration: task.estimatedDuration
    }]
  }
  
  return [] // No instances
}
```

### 3. Date-based Operations

**Move Task to Date**
```typescript
const moveTaskToDate = (taskId: string, dateColumn: string) => {
  const task = tasks.value.find(t => t.id === taskId)
  if (!task) return
  
  if (!task.instances) task.instances = []
  
  // Handle different date columns (today, tomorrow, thisWeek, etc.)
  let targetDate: Date | null = null
  let isLater = false
  
  switch (dateColumn) {
    case 'today':
      targetDate = new Date()
      break
    case 'tomorrow':
      targetDate = new Date()
      targetDate.setDate(targetDate.getDate() + 1)
      break
    case 'later':
      targetDate = new Date()
      targetDate.setDate(targetDate.getDate() + 30)
      isLater = true
      break
    // ... other cases
  }
  
  if (targetDate) {
    const dateStr = formatDateKey(targetDate)
    const timeStr = '09:00' // Default time
    
    // Create or update instance
    if (isLater) {
      // Handle "Later" instances specially
      const existingLaterIndex = task.instances.findIndex(instance => instance.isLater)
      if (existingLaterIndex !== -1) {
        task.instances[existingLaterIndex] = { ...task.instances[existingLaterIndex], scheduledDate: dateStr }
      } else {
        task.instances.push({ id: `instance-${taskId}-${Date.now()}`, scheduledDate: dateStr, scheduledTime: timeStr, isLater: true })
      }
    } else {
      // Regular date instances
      task.instances = task.instances.filter(instance => !instance.isLater) // Remove later instances
      const existingIndex = task.instances.findIndex(instance => instance.scheduledDate === dateStr)
      if (existingIndex !== -1) {
        task.instances[existingIndex] = { ...task.instances[existingIndex], scheduledTime: timeStr }
      } else {
        task.instances.push({ id: `instance-${taskId}-${Date.now()}`, scheduledDate: dateStr, scheduledTime: timeStr })
      }
    }
  } else {
    // No date - remove all instances
    task.instances = []
  }
  
  task.updatedAt = new Date()
}
```

## Performance Optimizations

### 1. Debounced Persistence
- **1-second delay** prevents excessive database writes
- **Post-flush timing** ensures DOM updates complete first
- **Separate timers** for tasks and projects

### 2. Efficient Filtering
- **Computed properties** for cached filtered results
- **Smart view logic** combines multiple criteria efficiently
- **Instance helpers** provide backward compatibility

### 3. Data Structure Optimization
- **Flat arrays** for tasks/projects (easy iteration)
- **Map-like access** via object properties when needed
- **Minimal nesting** for better JSON serialization

## Data Integrity

### 1. Type Safety
```typescript
// Generic type-safe database operations
const save = async <T>(key: string, data: T): Promise<void>
const load = async <T>(key: string): Promise<T | null>
```

### 2. Validation
- **Date parsing** with error handling
- **Required field validation** on task creation
- **Migration guards** for schema changes

### 3. Backup/Restore
```typescript
// Export all data for backup
const exportAll = async (): Promise<Record<string, any>> => {
  const allKeys = await db.keys()
  const data: Record<string, any> = {}
  for (const key of allKeys) {
    const value = await db.getItem<string>(key)
    if (value) data[key] = JSON.parse(value)
  }
  return data
}

// Import data for restore
const importAll = async (data: Record<string, any>): Promise<void> => {
  for (const [key, value] of Object.entries(data)) {
    await db.setItem(key, JSON.stringify(value))
  }
}
```

## Error Handling

### 1. Database Operation Errors
```typescript
const save = async <T>(key: string, data: T): Promise<void> => {
  try {
    await db.setItem(key, JSON.stringify(data))
    console.log(`💾 Saved ${key} to IndexedDB`)
  } catch (error) {
    console.error(`❌ Failed to save ${key}:`, error)
    throw error // Re-throw for component handling
  }
}
```

### 2. Data Corruption Recovery
- **JSON parsing** with try/catch blocks
- **Graceful degradation** when data is missing
- **Migration system** for schema updates

### 3. Storage Quota Management
- **Storage API checks** for available space
- **Data cleanup** strategies for quota exceeded
- **User notifications** for storage issues

## Browser Compatibility

### Supported Browsers
- **Chrome/Edge**: Full IndexedDB support
- **Firefox**: Full IndexedDB support
- **Safari**: IndexedDB with localStorage fallback
- **Mobile browsers**: LocalStorage fallback for older devices

### Fallback Strategy
1. **Primary**: IndexedDB (modern browsers)
2. **Secondary**: WebSQL (older Safari)
3. **Tertiary**: localStorage (universal but limited)

---

*Last Updated: October 9, 2025*
*Database Version: 1.0*
*Storage Technology: IndexedDB via LocalForage*