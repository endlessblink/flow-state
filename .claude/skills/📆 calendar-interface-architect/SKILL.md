---
complexity: high
confidence_boost:
  calendar_interface_errors: 0.6
  event_interface_missing: 0.4
  scheduling_problems: 0.5
  temporal_type_issues: 0.5
dependencies:
- typescript
- vue
- pinia
- '@vue/runtime-core'
- vite
- date-fns
- luxon
description: SYSTEMATICALLY architect and fix TypeScript calendar interface issues
  by creating comprehensive temporal type systems, resolving CalendarEvent interface
  problems, and implementing proper task instance type safety. Addresses critical
  calendar functionality that is currently broken due to missing interface properties.
estimated_duration: 25-45 minutes
name: calendar-interface-architect
prerequisites:
- typescript interfaces
- temporal data types
- calendar systems
- date handling
- scheduling algorithms
skill_id: calendar-interface-architect
skill_name: TypeScript Calendar Interface Architect
tags:
- typescript
- calendar
- interface
- temporal
- scheduling
- event
- date
- time
- architectural
token_budget: 4000
triggers:
  contexts:
  - typescript
  - calendar
  - interface
  - temporal
  - scheduling
  - event
  - date
  - time
  file_patterns:
  - src/composables/calendar/*.ts
  - src/views/CalendarView*.vue
  - src/types/recurrence.ts
  - src/stores/taskScheduler.ts
  - src/stores/tasks.ts
  keywords:
  - calendar
  - CalendarEvent
  - isDueDate
  - task instance
  - temporal
  - date
  - time
  - scheduling
  - event interface
  - calendar type
  - TaskInstance
version: 1.0
---

# TypeScript Calendar Interface Architect

This skill provides comprehensive architectural resolution of calendar interface and temporal type system issues in the Pomo-Flow application.

## Quick Context
- **Complexity**: high
- **Duration**: 25-45 minutes
- **Dependencies**: typescript, vue, pinia, @vue/runtime-core, vite, date-fns, luxon

## Activation Triggers
- **Keywords**: calendar, CalendarEvent, isDueDate, task instance, temporal, date, time, scheduling
- **Files**: src/composables/calendar/*.ts, src/views/CalendarView*.vue, src/types/recurrence.ts
- **Contexts**: typescript, calendar, interface, temporal, scheduling, event

## 🚨 CRITICAL CALENDAR INTERFACE ISSUES

### **IMMEDIATE Calendar Blocking Issues**
**CURRENT COMPILATION ERRORS:**
1. **Property 'isDueDate' does not exist in type 'CalendarEvent'**
2. **TaskInstance type mismatches** in calendar operations
3. **Missing temporal interface properties** for scheduling
4. **Calendar composables failing** due to interface problems

### **Why Calendar Issues Block Application:**
```
// PROBLEM: Missing properties in CalendarEvent interface
const calendarEvent: CalendarEvent = {
  title: 'Task',
  date: '2024-01-01',
  isDueDate: true  // ❌ Property does not exist on CalendarEvent
}

// CONSEQUENCE: Calendar functionality breaks, rendering fails
// Task scheduling doesn't work, calendar view crashes
```

## Calendar Interface Architecture Process

### Phase 1: Temporal Type Analysis (Critical)
```typescript
// Comprehensive temporal type system
export interface BaseTemporalEntity {
  id: string
  title: string
  description?: string
  createdAt: Date
  updatedAt: Date
}

export interface CalendarEvent extends BaseTemporalEntity {
  date: string // YYYY-MM-DD format
  time?: string // HH:MM format
  duration?: number // Duration in minutes
  isDueDate: boolean // Whether this represents a task due date
  isAllDay: boolean // Whether this is an all-day event
  color?: string // Event color for UI
  location?: string // Event location
  attendees?: string[] // Event attendees
  recurrencePattern?: RecurrencePattern
  metadata?: Record<string, unknown> // Additional event data
}

export interface TaskCalendarEvent extends CalendarEvent {
  taskId: string // Reference to the original task
  taskStatus: Task['status']
  taskPriority: Task['priority']
  taskProgress: number // Task completion progress
  subtaskProgress?: number[] // Individual subtask progress
  isRecurring: boolean // Whether this is a recurring task instance
  parentTaskId?: string // For recurring task instances
  instanceId?: string // Unique instance identifier
}
```

### Phase 2: TaskInstance Type System (Critical)
```typescript
// Complete TaskInstance interface for calendar operations
export interface TaskInstance {
  id: string // Unique instance identifier
  parentTaskId: string // Reference to original task
  scheduledDate: string // YYYY-MM-DD format
  scheduledTime?: string // HH:MM format
  duration?: number // Duration in minutes
  status: 'scheduled' | 'completed' | 'skipped' | 'in_progress'
  isRecurring: boolean // True for recurring task instances
  isModified?: boolean // True if this instance was modified from pattern
  isSkipped?: boolean // True if this instance is skipped
  recurrenceExceptionId?: string // Link to exception if this is an exception
  pomodoroTracking?: {
    completed: number
    total: number
    duration: number // Duration per pomodoro
  }
  completionData?: {
    completedAt?: Date
    completedBy?: string
    notes?: string
    actualDuration?: number
  }
  metadata?: Record<string, unknown>
}

// Task factory for calendar instances
export interface TaskInstanceFactory {
  createFromTask: (task: Task, date: string, time?: string) => TaskInstance
  createRecurringInstance: (task: Task, pattern: RecurrenceRule, date: string) => TaskInstance
  createException: (instance: TaskInstance, modifications: Partial<TaskInstance>) => TaskInstance
}
```

### Phase 3: Calendar State Management (Critical)
```typescript
// Calendar-specific state management
export interface CalendarState {
  currentDate: Date
  selectedDate: Date | null
  viewMode: 'month' | 'week' | 'day' | 'agenda'
  events: CalendarEvent[]
  taskInstances: TaskInstance[]
  loading: boolean
  error: string | null
  filters: CalendarFilters
}

export interface CalendarFilters {
  showCompleted: boolean
  showInbox: boolean
  projectIds: string[]
  priorities: Task['priority'][]
  statuses: Task['status'][]
}

export interface CalendarActions {
  setCurrentDate: (date: Date) => void
  setSelectedDate: (date: Date | null) => void
  setViewMode: (mode: CalendarState['viewMode']) => void
  addEvent: (event: CalendarEvent) => void
  removeEvent: (eventId: string) => void
  updateEvent: (eventId: string, updates: Partial<CalendarEvent>) => void
  loadTaskInstances: (startDate: Date, endDate: Date) => Promise<void>
  createTaskInstance: (task: Task, date: string, time?: string) => Promise<void>
}
```

### Phase 4: Calendar Composable Architecture (Critical)
```typescript
// Type-safe calendar composables
export function useCalendarDayView(date: Ref<Date>) {
  const dayEvents = computed((): TaskCalendarEvent[] => {
    const dayStart = startOfDay(date.value)
    const dayEnd = endOfDay(date.value)

    return taskStore.taskInstances
      .filter(instance => {
        const instanceDate = parseISO(instance.scheduledDate)
        return isWithinInterval(instanceDate, { start: dayStart, end: dayEnd })
      })
      .map(instance => createTaskCalendarEvent(instance))
  })

  const addTaskToDay = async (task: Task, time?: string) => {
    const instance: TaskInstance = {
      id: generateId(),
      parentTaskId: task.id,
      scheduledDate: format(date.value, 'yyyy-MM-dd'),
      scheduledTime: time,
      duration: task.estimatedDuration || 25,
      status: 'scheduled',
      isRecurring: false,
      pomodoroTracking: {
        completed: 0,
        total: task.estimatedPomodoros || 1,
        duration: 25
      }
    }

    await taskStore.addTaskInstance(instance)
  }

  return {
    dayEvents,
    addTaskToDay,
    removeTaskFromDay: (instanceId: string) => taskStore.removeTaskInstance(instanceId)
  }
}
```

### Phase 5: Recurrence Integration (Critical)
```typescript
// Calendar-aware recurrence system
export interface CalendarRecurrenceIntegration {
  generateRecurringInstances: (
    task: Task,
    pattern: RecurrenceRule,
    startDate: Date,
    endDate: Date
  ) => TaskInstance[]
  applyRecurrenceExceptions: (
    instances: TaskInstance[],
    exceptions: RecurrenceException[]
  ) => TaskInstance[]
  updateRecurringPattern: (
    taskId: string,
    oldPattern: RecurrenceRule,
    newPattern: RecurrenceRule,
    fromDate: Date
  ) => Promise<void>
}

export function useCalendarRecurrence(): CalendarRecurrenceIntegration {
  const generateRecurringInstances = (
    task: Task,
    pattern: RecurrenceRule,
    startDate: Date,
    endDate: Date
  ): TaskInstance[] => {
    const instances: TaskInstance[] = []
    let currentDate = new Date(startDate)

    while (isBefore(currentDate, endDate) || isSameDay(currentDate, endDate)) {
      const instance: TaskInstance = {
        id: `${task.id}-${format(currentDate, 'yyyy-MM-dd')}`,
        parentTaskId: task.id,
        scheduledDate: format(currentDate, 'yyyy-MM-dd'),
        scheduledTime: task.scheduledTime,
        duration: task.estimatedDuration,
        status: 'scheduled',
        isRecurring: true,
        pomodoroTracking: {
          completed: 0,
          total: task.estimatedPomodoros || 1,
          duration: 25
        }
      }

      instances.push(instance)
      currentDate = addRecurrence(currentDate, pattern)
    }

    return instances
  }

  return {
    generateRecurringInstances,
    applyRecurrenceExceptions: applyExceptions,
    updateRecurringPattern: updatePattern
  }
}
```

## Implementation Patterns

### Pattern 1: Calendar Event Factory
```typescript
// Factory for creating calendar events from different sources
export class CalendarEventFactory {
  static fromTask(task: Task, date: string, time?: string): TaskCalendarEvent {
    return {
      id: generateId(),
      title: task.title,
      description: task.description,
      date,
      time,
      duration: task.estimatedDuration || 25,
      isDueDate: true,
      isAllDay: !time,
      color: this.getTaskEventColor(task.priority),
      taskId: task.id,
      taskStatus: task.status,
      taskPriority: task.priority,
      taskProgress: task.progress,
      isRecurring: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  static fromTaskInstance(instance: TaskInstance): TaskCalendarEvent {
    const task = taskStore.getTask(instance.parentTaskId)
    if (!task) {
      throw new Error(`Task not found: ${instance.parentTaskId}`)
    }

    return {
      id: instance.id,
      title: task.title,
      description: task.description,
      date: instance.scheduledDate,
      time: instance.scheduledTime,
      duration: instance.duration,
      isDueDate: true,
      isAllDay: !instance.scheduledTime,
      color: this.getTaskEventColor(task.priority),
      taskId: task.id,
      taskStatus: task.status,
      taskPriority: task.priority,
      taskProgress: task.progress,
      isRecurring: instance.isRecurring,
      parentTaskId: instance.parentTaskId,
      instanceId: instance.id,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  private static getTaskEventColor(priority: Task['priority']): string {
    switch (priority) {
      case 'high': return '#ef4444'
      case 'medium': return '#f59e0b'
      case 'low': return '#10b981'
      default: return '#6b7280'
    }
  }
}
```

### Pattern 2: Type-Safe Calendar Store
```typescript
// Pinia store for calendar state with full type safety
export const useCalendarStore = defineStore('calendar', () => {
  const state = ref<CalendarState>({
    currentDate: new Date(),
    selectedDate: null,
    viewMode: 'month',
    events: [],
    taskInstances: [],
    loading: false,
    error: null,
    filters: {
      showCompleted: true,
      showInbox: true,
      projectIds: [],
      priorities: [],
      statuses: []
    }
  })

  const actions: CalendarActions = {
    setCurrentDate: (date: Date) => {
      state.value.currentDate = date
    },

    addEvent: (event: CalendarEvent) => {
      state.value.events.push(event)
    },

    async createTaskInstance(task: Task, date: string, time?: string): Promise<void> {
      try {
        const instance = taskStore.createTaskInstance(task, date, time)
        state.value.taskInstances.push(instance)
      } catch (error) {
        state.value.error = error instanceof Error ? error.message : 'Failed to create instance'
      }
    }
  }

  // Computed properties
  const filteredEvents = computed((): TaskCalendarEvent[] => {
    return state.value.taskInstances
      .filter(instance => passesFilters(instance, state.value.filters))
      .map(instance => CalendarEventFactory.fromTaskInstance(instance))
  })

  return {
    state: readonly(state),
    actions,
    filteredEvents
  }
})
```

### Pattern 3: Date Type Safety
```typescript
// Type-safe date utilities for calendar operations
export class CalendarDateUtils {
  static parseDateKey(dateKey: string): Date {
    const [year, month, day] = dateKey.split('-').map(Number)
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      throw new Error(`Invalid date format: ${dateKey}`)
    }
    return new Date(year, month - 1, day)
  }

  static formatDateKey(date: Date): string {
    return format(date, 'yyyy-MM-dd')
  }

  static isValidTime(time: string): boolean {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
    return timeRegex.test(time)
  }

  static parseTime(time: string): { hours: number; minutes: number } {
    if (!this.isValidTime(time)) {
      throw new Error(`Invalid time format: ${time}`)
    }

    const [hours, minutes] = time.split(':').map(Number)
    return { hours, minutes }
  }

  static addTimeToDate(date: string, time: string, duration: number): Date {
    const baseDate = this.parseDateKey(date)
    const { hours, minutes } = this.parseTime(time)

    const result = new Date(baseDate)
    result.setHours(hours, minutes, 0, 0)
    result.setMinutes(result.getMinutes() + duration)

    return result
  }
}
```

## Error Resolution Map

### Error Type 1: Missing CalendarEvent Properties
```typescript
// BEFORE (Error):
interface CalendarEvent {
  id: string
  title: string
  date: string
  // Missing isDueDate property
}

const event: CalendarEvent = {
  id: '1',
  title: 'Task',
  date: '2024-01-01',
  isDueDate: true  // ❌ Property does not exist
}

// AFTER (Fixed):
interface CalendarEvent extends BaseTemporalEntity {
  date: string
  time?: string
  duration?: number
  isDueDate: boolean  // ✅ Property exists
  isAllDay: boolean
  color?: string
  // ... other properties
}

const event: CalendarEvent = {
  id: '1',
  title: 'Task',
  date: '2024-01-01',
  isDueDate: true,  // ✅ Works
  createdAt: new Date(),
  updatedAt: new Date(),
  isAllDay: false
}
```

### Error Type 2: TaskInstance Type Mismatch
```typescript
// BEFORE (Error):
// TaskInstance interface incomplete or missing
const instance: TaskInstance = {
  id: '1',
  parentTaskId: 'task-1',
  scheduledDate: '2024-01-01'
  // Missing required properties
}

// AFTER (Fixed):
const instance: TaskInstance = {
  id: '1',
  parentTaskId: 'task-1',
  scheduledDate: '2024-01-01',
  duration: 25,
  status: 'scheduled',
  isRecurring: false,
  pomodoroTracking: {
    completed: 0,
    total: 1,
    duration: 25
  }
  // ✅ All required properties present
}
```

## Expected Outcomes
After successful execution:
- ✅ **Complete CalendarEvent Interface**: All required properties including isDueDate
- ✅ **TaskInstance Type System**: Full type safety for task instances
- ✅ **Calendar Functionality**: All calendar views work properly
- ✅ **Scheduling Integration**: Tasks can be scheduled on calendar
- ✅ **Temporal Type Safety**: All date/time operations are type-safe

## Success Criteria
- [ ] CalendarEvent interface includes isDueDate and all required properties
- [ ] TaskInstance interface is complete and type-safe
- [ ] Calendar composables compile and function properly
- [ ] Task scheduling works in calendar views
- [ ] No calendar-related TypeScript errors

## Validation Commands
```bash
# TypeScript compilation check
npx tsc --noEmit --skipLibCheck

# Calendar-specific tests
npm run test -- --grep "calendar"

# Development server test
npm run dev
```

---
**This skill resolves the critical calendar interface issues that are preventing calendar functionality from working by implementing a comprehensive temporal type system.**

---

## MANDATORY USER VERIFICATION REQUIREMENT

### Policy: No Fix Claims Without User Confirmation

**CRITICAL**: Before claiming ANY issue, bug, or problem is "fixed", "resolved", "working", or "complete", the following verification protocol is MANDATORY:

#### Step 1: Technical Verification
- Run all relevant tests (build, type-check, unit tests)
- Verify no console errors
- Take screenshots/evidence of the fix

#### Step 2: User Verification Request
**REQUIRED**: Use the `AskUserQuestion` tool to explicitly ask the user to verify the fix:

```
"I've implemented [description of fix]. Before I mark this as complete, please verify:
1. [Specific thing to check #1]
2. [Specific thing to check #2]
3. Does this fix the issue you were experiencing?

Please confirm the fix works as expected, or let me know what's still not working."
```

#### Step 3: Wait for User Confirmation
- **DO NOT** proceed with claims of success until user responds
- **DO NOT** mark tasks as "completed" without user confirmation
- **DO NOT** use phrases like "fixed", "resolved", "working" without user verification

#### Step 4: Handle User Feedback
- If user confirms: Document the fix and mark as complete
- If user reports issues: Continue debugging, repeat verification cycle

### Prohibited Actions (Without User Verification)
- Claiming a bug is "fixed"
- Stating functionality is "working"
- Marking issues as "resolved"
- Declaring features as "complete"
- Any success claims about fixes

### Required Evidence Before User Verification Request
1. Technical tests passing
2. Visual confirmation via Playwright/screenshots
3. Specific test scenarios executed
4. Clear description of what was changed

**Remember: The user is the final authority on whether something is fixed. No exceptions.**
