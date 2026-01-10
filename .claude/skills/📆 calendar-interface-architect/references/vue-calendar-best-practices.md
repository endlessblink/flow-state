# Vue.js Calendar Best Practices

## Data Model Separation

### Task vs Calendar Event Distinction

**Tasks** (Productivity Management):
```typescript
interface Task {
  id: string;
  title: string;
  dueDate?: string;           // Optional deadline, NOT a schedule
  instances?: TaskInstance[]; // Time-specific commitments
  isInInbox: boolean;         // Inbox state management
  canvasPosition?: { x: number; y: number }; // Canvas positioning
}
```

**Calendar Events** (Time Commitments):
```typescript
interface CalendarEvent {
  id: string;
  start: Date;
  end: Date;
  title: string;
  isTaskInstance?: boolean;   // Link back to task
  parentTaskId?: string;
}
```

### State Management Patterns

1. **Inbox State**: Tasks with `isInInbox: true` appear in calendar inbox, not calendar grid
2. **Scheduled State**: Tasks with instances appear as calendar events
3. **Smart Groups**: Canvas "Today" groups set dueDate but maintain inbox state

## Vue 3 Calendar Integration Patterns

### Composition API Usage

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTaskStore } from '@/stores/tasks'

const taskStore = useTaskStore()

// Separate concerns: task logic vs calendar logic
const inboxTasks = computed(() =>
  taskStore.tasks.filter(task =>
    task.isInInbox && !task.instances?.length
  )
)

const calendarEvents = computed(() =>
  taskStore.tasks
    .filter(task => task.instances?.length > 0)
    .flatMap(task => task.instances!.map(instance => ({
      id: instance.id,
      title: task.title,
      start: new Date(`${instance.scheduledDate}T${instance.scheduledTime}`),
      backgroundColor: '#3b82f6',
      extendedProps: { taskId: task.id }
    })))
)
</script>
```

### Reactive Calendar Options

```typescript
const calendarOptions = ref({
  plugins: [dayGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  events: calendarEvents,  // Reactive computed property
  dateClick: handleDateClick,
  eventDrop: handleEventDrop,
  eventReceive: handleEventReceive  // For drag from inbox
})
```

## Performance Optimization

### Avoid Common Pitfalls

1. **Don't** create deeply nested computed properties for filtering
2. **Do** use composables for reusable calendar logic
3. **Don't** mix task management logic with calendar rendering
4. **Do** separate data fetching from UI rendering

### Efficient Filtering

```typescript
// ✅ Good: Simple, efficient filtering
const todayTasks = computed(() =>
  taskStore.tasks.filter(task => task.dueDate === today)
)

// ❌ Bad: Complex nested computed properties
const filteredTasks = computed(() => {
  return taskStore.tasks.filter(task => {
    // Complex logic that runs frequently
    return task.dueDate === today &&
           task.isInInbox &&
           !task.canvasPosition &&
           task.status !== 'done'
  })
})
```

## Visual Design Patterns

### Inbox vs Calendar Distinction

**Inbox Tasks**:
- Card-based layout
- Draggable handles
- Status indicators
- Quick actions (schedule, edit, delete)

**Calendar Events**:
- Time-based positioning
- Resize handles
- Color coding by project/priority
- Minimal interaction (click to edit)

### Drag and Drop Implementation

```typescript
const handleEventReceive = (info: any) => {
  const taskId = info.draggedEl.getAttribute('data-task-id')
  const date = info.date

  // Create task instance
  taskStore.createTaskInstance(taskId, {
    scheduledDate: formatDateKey(date),
    scheduledTime: '09:00'
  })

  // Remove from inbox state
  taskStore.updateTask(taskId, { isInInbox: false })
}
```

## Error Handling

### State Validation

```typescript
const validateTaskState = (task: Task) => {
  const issues = []

  if (task.dueDate && !task.instances?.length && !task.isInInbox) {
    issues.push('Task has dueDate but not in inbox and no instances')
  }

  if (task.instances?.length > 0 && task.isInInbox) {
    issues.push('Task has instances but still in inbox')
  }

  return issues
}
```

### Graceful Degradation

```typescript
const safeCalendarEvents = computed(() => {
  try {
    return calendarEvents.value
  } catch (error) {
    console.error('Calendar events error:', error)
    return []
  }
})
```

## Testing Strategies

### Visual Testing Requirements

1. **DOM assertions are insufficient** - must use visual validation
2. **Playwright visual comparison** for calendar layout
3. **Drag-and-drop testing** with actual user interactions
4. **Multi-browser testing** for calendar rendering

### Test Data Management

```typescript
// Create test tasks with specific states
const createTestTask = (overrides: Partial<Task> = {}) => ({
  id: generateId(),
  title: 'Test Task',
  dueDate: '',
  instances: [],
  isInInbox: true,
  ...overrides
})

// Test scenarios
const testScenarios = [
  createTestTask({ dueDate: today }),  // Should be in inbox
  createTestTask({ instances: [{ scheduledDate: today, scheduledTime: '10:00' }] }), // Should be in calendar
  createTestTask({ dueDate: today, instances: [...] }), // Ambiguous state
]
```

## Common Anti-Patterns

### Data Duplication

```typescript
// ❌ Bad: Duplicating task state
const calendarTasks = ref([...taskStore.tasks])

// ✅ Good: Use computed properties
const calendarTasks = computed(() => taskStore.tasks)
```

### Mixed Concerns

```typescript
// ❌ Bad: Mixing task and calendar logic
const scheduleTask = (task: Task) => {
  task.dueDate = today
  task.instances = [{ scheduledDate: today, scheduledTime: '09:00' }]
  renderCalendar()  // UI logic mixed with data logic
}

// ✅ Good: Separate concerns
const scheduleTask = (task: Task, time: string) => {
  taskStore.createTaskInstance(task.id, {
    scheduledDate: today,
    scheduledTime: time
  })
  taskStore.updateTask(task.id, { isInInbox: false })
}
// Calendar will react automatically
```

## Integration with External Libraries

### FullCalendar Vue 3

```typescript
import { createApp } from 'vue'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'

const app = createApp(App)
app.component('FullCalendar', FullCalendar)
```

### Custom Calendar Components

```vue
<template>
  <div class="calendar-container">
    <div class="calendar-inbox">
      <TaskCard
        v-for="task in inboxTasks"
        :key="task.id"
        :task="task"
        draggable="true"
        @dragstart="handleTaskDragStart(task)"
      />
    </div>

    <div class="calendar-grid">
      <FullCalendar :options="calendarOptions" />
    </div>
  </div>
</template>
```

## Accessibility Considerations

### Keyboard Navigation

```typescript
const handleKeyDown = (event: KeyboardEvent) => {
  switch (event.key) {
    case 'Enter':
    case ' ':
      if (focusedTask.value) {
        scheduleTask(focusedTask.value)
      }
      break
    case 'Escape':
      clearSelection()
      break
  }
}
```

### Screen Reader Support

```html
<div
  class="task-card"
  :aria-label="`\${task.title}, due \${task.dueDate}, status: \${task.status}`"
  role="button"
  tabindex="0"
>
  {{ task.title }}
</div>
```

## Performance Monitoring

### Calendar Rendering Performance

```typescript
const calendarPerformance = {
  renderTime: 0,
  eventCount: 0,

  measure() {
    const start = performance.now()
    // Calendar render logic
    this.renderTime = performance.now() - start
    this.eventCount = calendarEvents.value.length

    if (this.renderTime > 100) {
      console.warn('Slow calendar render:', this.renderTime)
    }
  }
}
```

### Memory Management

```typescript
onUnmounted(() => {
  // Clean up calendar event listeners
  calendar.value?.destroy()
  calendar.value = null
})
```