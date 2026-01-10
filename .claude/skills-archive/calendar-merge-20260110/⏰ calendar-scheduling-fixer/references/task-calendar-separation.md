# Task-Calendar Separation Principles

## Core Concept

The fundamental principle is **separating task management from calendar commitments**:

- **Tasks** = What needs to be done (productivity management)
- **Calendar** = When it will be done (time commitment management)

## Data Model Architecture

### Task Model (Inbox/Centric)

```typescript
interface Task {
  id: string;
  title: string;
  description: string;

  // Deadline metadata (NOT scheduling)
  dueDate?: string;           // Optional deadline for prioritization

  // Scheduling data (time commitments)
  instances?: TaskInstance[]; // Specific calendar occurrences

  // State management
  isInInbox: boolean;         // True = appears in calendar inbox
  status: TaskStatus;         // planned, in_progress, done, etc.

  // Position/organization
  canvasPosition?: { x: number; y: number };
  projectId: string;
}
```

### Calendar Instance Model

```typescript
interface TaskInstance {
  id: string;
  taskId: string;             // Link back to parent task
  scheduledDate: string;      // YYYY-MM-DD
  scheduledTime: string;      // HH:MM
  duration?: number;          // Minutes
  isLater?: boolean;          // For unspecific future scheduling
}
```

## State Flow Architecture

```
Task Creation → Smart Groups → Calendar Inbox → Manual Scheduling → Calendar Grid
     ↓              ↓              ↓                    ↓              ↓
  New Task     dueDate=Today   isInInbox=true    Create Instance   Show in Calendar
```

### Smart Group Behavior (Canvas "Today" Group)

```typescript
// When task is moved to "Today" smart group:
moveTaskToSmartGroup(taskId, 'today') {
  const updates = {
    dueDate: '2025-11-08',    // Set deadline for organization
    isInInbox: true,          // Keep in inbox for manual scheduling
    // CRITICAL: Do NOT create instances
  }

  updateTask(taskId, updates)
}
```

### Inbox to Calendar Flow

```typescript
// When task is manually scheduled from inbox:
scheduleTaskFromInbox(taskId, date, time) {
  // 1. Create calendar instance
  createTaskInstance(taskId, {
    scheduledDate: date,
    scheduledTime: time
  })

  // 2. Remove from inbox state
  updateTask(taskId, { isInInbox: false })

  // 3. Task now appears in calendar grid
}
```

## Visual Separation Strategy

### Inbox Tasks (Calendar Inbox Panel)

**Characteristics:**
- Card-based layout
- No time positioning
- Drag handles for scheduling
- Status indicators
- Priority badges
- Project colors

**Example:**
```vue
<div class="inbox-task-card" draggable="true">
  <div class="task-content">
    <h4>{{ task.title }}</h4>
    <div class="task-meta">
      <span class="due-date">Due: {{ task.dueDate }}</span>
      <span class="priority">{{ task.priority }}</span>
    </div>
  </div>
  <div class="drag-handle">⋮⋮</div>
</div>
```

### Calendar Events (Calendar Grid)

**Characteristics:**
- Time-based positioning
- Color-coded by project
- Resize handles for duration
- Minimal interaction
- Linked to parent task

**Example:**
```vue
<div
  class="calendar-event"
  :style="{ top: event.top + 'px', height: event.height + 'px' }"
  :style="{ backgroundColor: event.projectColor }"
>
  <div class="event-title">{{ event.title }}</div>
  <div class="event-time">{{ event.startTime }} - {{ event.endTime }}</div>
</div>
```

## Filtering Logic Patterns

### Calendar Inbox "Today" Filter

```typescript
const todayInboxTasks = computed(() => {
  const today = new Date().toISOString().split('T')[0]

  return tasks.value.filter(task => {
    // Must be in inbox state
    if (task.isInInbox === false) return false

    // Must not have time-based scheduling
    if (task.instances?.length > 0) return false

    // Must be relevant for today
    return task.dueDate === today
  })
})
```

### Calendar Grid Events

```typescript
const calendarEvents = computed(() => {
  return tasks.value
    .filter(task => task.instances?.length > 0)  // Only scheduled tasks
    .flatMap(task =>
      task.instances!.map(instance => ({
        id: instance.id,
        taskId: task.id,
        title: task.title,
        start: new Date(`${instance.scheduledDate}T${instance.scheduledTime}`),
        end: calculateEndTime(instance),
        backgroundColor: getProjectColor(task.projectId)
      }))
    )
})
```

## Common Violations and Solutions

### Violation 1: Tasks with dueDate appear in calendar

**Problem:**
```typescript
// ❌ Wrong: Creating calendar events from dueDate
if (task.dueDate === today) {
  createCalendarEvent(task)  // This should NOT happen
}
```

**Solution:**
```typescript
// ✅ Correct: Only create events from instances
if (task.instances?.some(inst => inst.scheduledDate === today)) {
  createCalendarEvent(task)  // Only for explicitly scheduled tasks
}
```

### Violation 2: Tasks in both inbox and calendar

**Problem:**
```typescript
// ❌ Wrong: Task appears in both places
const updates = {
  dueDate: today,
  isInInbox: true,
  instances: [{ scheduledDate: today, scheduledTime: '09:00' }]
}
```

**Solution:**
```typescript
// ✅ Correct: Clear state transition
const updates = {
  dueDate: today,
  isInInbox: false,      // Remove from inbox
  instances: [{ scheduledDate: today, scheduledTime: '09:00' }]
}
```

### Violation 3: Smart groups create scheduling

**Problem:**
```typescript
// ❌ Wrong: Smart group creates time-based scheduling
moveTaskToSmartGroup(taskId, 'today') {
  createTaskInstance(taskId, { scheduledDate: today, scheduledTime: '09:00' })
}
```

**Solution:**
```typescript
// ✅ Correct: Smart group only sets deadline
moveTaskToSmartGroup(taskId, 'today') {
  updateTask(taskId, { dueDate: today })
  // Task stays in inbox for manual scheduling
}
```

## User Experience Flow

### Desired Workflow

1. **Canvas Organization**
   - User drags task to "Today" smart group
   - Task gets `dueDate = today` but stays in inbox
   - Task appears in Calendar Inbox "Today" filter

2. **Calendar Inbox Review**
   - User sees today's tasks in inbox panel
   - Tasks are organized but not time-committed
   - User can prioritize and plan the day

3. **Manual Scheduling**
   - User drags task from inbox to calendar time slot
   - System creates task instance
   - Task moves from inbox to calendar grid
   - Time commitment is now explicit

### Mental Model Benefits

- **Canvas** = "What's relevant for today?"
- **Calendar Inbox** = "What should I schedule today?"
- **Calendar Grid** = "When am I doing things today?"

This separation prevents:
- Accidental time commitments
- Calendar clutter from unscheduled tasks
- Confusion between deadlines and appointments
- Loss of flexibility in daily planning

## Implementation Checklist

### For Smart Group Logic
- [ ] Only sets `dueDate`, never creates `instances`
- [ ] Preserves `isInInbox: true` state
- [ ] Updates calendar inbox filtering
- [ ] Does NOT create calendar events

### For Calendar Grid Logic
- [ ] Only shows tasks with `instances`
- [ ] Ignores `dueDate` for event creation
- [ ] Maintains visual distinction from inbox tasks
- [ ] Handles time-based positioning correctly

### For Calendar Inbox Logic
- [ ] Shows tasks with `dueDate === today` and `isInInbox: true`
- [ ] Excludes tasks with `instances`
- [ ] Provides drag handles for scheduling
- [ ] Updates task state when scheduled

### For State Management
- [ ] Clear transitions between inbox and scheduled states
- [ ] No ambiguous states (both inbox and scheduled)
- [ ] Consistent filtering across all components
- [ ] Proper cleanup of old states

## Testing Strategy

### Unit Tests
- Test smart group logic doesn't create instances
- Test calendar inbox filtering
- Test state transitions

### Integration Tests
- Test end-to-end workflow: Canvas → Inbox → Calendar
- Test drag and drop behavior
- Test visual appearance in different views

### Visual Tests (Playwright)
- Verify tasks appear in correct locations
- Test drag and drop interactions
- Confirm visual consistency across views
- Validate no unwanted calendar events are created