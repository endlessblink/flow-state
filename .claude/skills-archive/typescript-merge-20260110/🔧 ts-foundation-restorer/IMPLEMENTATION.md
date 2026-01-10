# TypeScript Foundation Restoration Implementation

## Phase 1: Error Analysis

### Step 1: Run Comprehensive TypeScript Check
```bash
npx tsc --noEmit --pretty
```

### Step 2: Categorize All Errors
Create error categories:
- **Missing Properties**: Property 'X' does not exist on type 'Task'
- **Missing Methods**: Property 'Y' does not exist on type 'Store'
- **Type Definition Issues**: Cannot find name 'TaskInstance'
- **Import/Export Issues**: Used as value instead of type
- **Return Type Mismatches**: Type 'Promise<boolean>' is not assignable to type 'Promise<void>'

### Step 3: Create Dependency Map
```typescript
// Map dependencies to understand fix order
const dependencyMap = {
  'Task': ['TaskInstance', 'task store methods'],
  'TaskInstance': ['calendar composables', 'task instances'],
  'store methods': ['app components', 'calendar views'],
  'type imports': ['all files using the types']
}
```

## Phase 2: Task Interface Restoration

### Step 1: Current Task Interface Analysis
Check existing Task interface in `src/stores/tasks.ts`:
```typescript
interface Task {
  id: string
  title: string
  description: string
  status: 'planned' | 'in_progress' | 'done' | 'backlog' | 'on_hold'
  priority: 'low' | 'medium' | 'high' | null
  progress: number
  completedPomodoros: number
  subtasks: Subtask[]
  dueDate: string
  // Missing properties to add:
  // scheduledDate: string
  // scheduledTime: string
  // estimatedDuration: number
  // estimatedPomodoros: number
  // isUncategorized: boolean
  // instances?: TaskInstance[]
  projectId: string
  parentTaskId?: string | null
  createdAt: Date
  updatedAt: Date
  // Canvas-specific:
  canvasPosition?: { x: number; y: number }
  isInInbox?: boolean
  dependsOn?: string[]
}
```

### Step 2: Add Missing Properties
```typescript
// Add to Task interface:
scheduledDate: string
scheduledTime: string
estimatedDuration: number
estimatedPomodoros: number
isUncategorized: boolean
instances?: TaskInstance[]
```

### Step 3: Update Subtask Interface
```typescript
interface Subtask {
  id: string
  title: string
  description: string
  isCompleted: boolean
  completedPomodoros: number
  createdAt: Date
  updatedAt: Date
}
```

## Phase 3: Type Definition Creation

### Step 1: Create TaskInstance Type
```typescript
interface TaskInstance {
  id: string
  taskId: string
  scheduledDate: string
  scheduledTime: string
  duration: number
  completedPomodoros: number
  isCompleted: boolean
  createdAt: Date
  updatedAt: Date
}
```

### Step 2: Create CalendarEvent Type
```typescript
interface CalendarEvent {
  id: string
  taskId: string
  instanceId?: string
  title: string
  description: string
  startTime: Date
  endTime: Date
  color: string
  priority: Task['priority']
  status: Task['status']
  isRecurring?: boolean
  canEdit?: boolean
  canDrag?: boolean
}
```

### Step 3: Add Type Exports
```typescript
// Add to src/stores/tasks.ts
export type { Task, TaskInstance, CalendarEvent }
```

## Phase 4: Store Method Restoration

### Step 1: Add getTask Method
```typescript
// Add to task store
const getTask = (taskId: string): Task | undefined => {
  return tasks.value.find(task => task.id === taskId)
}
```

### Step 2: Add getUncategorizedTaskCount Method
```typescript
const getUncategorizedTaskCount = (): number => {
  return tasks.value.filter(task =>
    task.isUncategorized && task.status !== 'done'
  ).length
}
```

### Step 3: Add Other Missing Methods
```typescript
const getTasksByProject = (projectId: string): Task[] => {
  return tasks.value.filter(task => task.projectId === projectId)
}

const getTasksByStatus = (status: Task['status']): Task[] => {
  return tasks.value.filter(task => task.status === status)
}

const getTaskInstances = (task: Task): TaskInstance[] => {
  return task.instances || []
}
```

### Step 4: Export All Methods
```typescript
// Add to store return object
return {
  // ... existing exports
  getTask,
  getUncategorizedTaskCount,
  getTasksByProject,
  getTasksByStatus,
  getTaskInstances
}
```

## Phase 5: Import Resolution

### Step 1: Fix TaskInstance Imports
```typescript
// Fix imports in files that use TaskInstance
import type { Task, TaskInstance, CalendarEvent } from '@/stores/tasks'
```

### Step 2: Fix Value vs Type Usage
```typescript
// Fix RecurrencePattern usage
import type { RecurrencePattern } from './recurrenceUtils'

// Use as type only:
const pattern: RecurrencePattern = { /* ... */ }
```

### Step 3: Fix Return Type Mismatches
```typescript
// Fix methods returning wrong types
const someMethod = async (): Promise<void> => {
  // Ensure return type matches interface
  // Return void instead of boolean
}
```

## Phase 6: Validation Protocol

### Step 1: TypeScript Compilation Check
```bash
npx tsc --noEmit
# Expected: 0 errors
```

### Step 2: Development Server Test
```bash
npm run dev
# Expected: Server starts quickly (<15 seconds)
# Expected: No compilation errors in console
```

### Step 3: Runtime Validation
```typescript
// Test in browser console:
// 1. Check Task properties exist
taskStore.tasks[0].scheduledDate  // Should work
taskStore.tasks[0].isUncategorized  // Should work

// 2. Check store methods exist
taskStore.getTask('some-id')  // Should work
taskStore.getUncategorizedTaskCount()  // Should work
```

### Step 4: Application Functionality Test
- Navigate to all views (Board, Calendar, Canvas)
- Test task creation and editing
- Verify no runtime errors in console
- Test previously broken functionality

## Success Criteria Check

- [ ] `npx tsc --noEmit` returns with 0 errors
- [ ] Development server starts in <15 seconds
- [ ] All Task properties are accessible
- [ ] All store methods work correctly
- [ ] Application loads without errors
- [ ] All views and features function properly
- [ ] Previous surface-level fixes now work

## Troubleshooting

### If Compilation Still Fails:
1. Check for circular dependencies
2. Verify all imports/exports are correct
3. Ensure type definitions are properly formatted
4. Check for syntax errors in new code

### If Runtime Errors Persist:
1. Verify store initialization
2. Check for undefined properties
3. Test with clean browser cache
4. Verify proper integration with Vue components