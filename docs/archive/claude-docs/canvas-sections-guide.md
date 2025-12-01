# Canvas Sections Guide

## Overview

Canvas containers allow you to organize tasks visually and optionally automate property updates. This guide explains the difference between **Groups** and **Sections**, how they work, and how to create new ones with custom behavior.

## Groups vs Sections: Key Terminology

**Understanding the distinction between Groups and Sections is essential for using the canvas effectively.**

### 📦 Groups (Visual Organization Only)

- **Type**: `'custom'`
- **Behavior**: Visual organization only - NO property updates
- **When tasks are dragged in**: Tasks retain all their existing properties (priority, status, dates, etc.)
- **Use case**: Manually organize related tasks without changing their data
- **Creation**: Use "Create Custom Group" from canvas context menu, or GroupModal.vue
- **Example**: Group tasks by theme, meeting, or any ad-hoc categorization

### ✨ Sections (Smart Automation)

- **Types**: `'priority'`, `'status'`, `'timeline'`, `'project'`
- **Behavior**: Automatically update task properties when tasks are dragged in
- **When tasks are dragged in**: Task properties are updated based on section type and propertyValue
- **Use case**: Automate task management with drag-and-drop workflows
- **Creation**: Use "Create Section (Smart)" from context menu to open the wizard (coming soon)
- **Examples**:
  - Priority Section (`type: 'priority'`) → Sets `task.priority` to 'high', 'medium', or 'low'
  - Status Section (`type: 'status'`) → Sets `task.status` to 'planned', 'in_progress', 'done', or 'backlog'
  - Timeline Section (`type: 'timeline'`) → Sets `task.dueDate` (e.g., "Today", "Tomorrow")
  - Project Section (`type: 'project'`) → Sets `task.projectId` to assign tasks to projects

### Quick Decision Guide

**Choose a Group when:**
- You want to visually organize tasks temporarily
- You DON'T want to change any task properties
- You're exploring ideas or planning without committing to changes
- You need flexible, ad-hoc categorization

**Choose a Section when:**
- You want tasks to automatically update when dragged in
- You're creating a workflow (e.g., Kanban board on canvas)
- You want to automate repetitive property changes
- You're organizing by priority, status, or project assignment

---

## Section Types

### 1. Priority Sections (`type: 'priority'`)

**Behavior**: Automatically update a task's priority when dragged into the section.

**Available Values**: `'high'`, `'medium'`, `'low'`

**Example**:
```typescript
canvasStore.createPrioritySection('high', { x: 100, y: 100 })
```

**What Happens**: When you drag a task into this section:
- Task's `priority` field is set to `'high'`
- UI updates immediately to show high priority styling (red flag icon)

---

### 2. Status Sections (`type: 'status'`)

**Behavior**: Automatically update a task's completion status.

**Available Values**: `'planned'`, `'in_progress'`, `'done'`, `'backlog'`

**Example**:
```typescript
canvasStore.createStatusSection('in_progress', { x: 450, y: 100 })
```

**What Happens**: When you drag a task into this section:
- Task's `status` field is set to `'in_progress'`
- Task card shows "Active" status with appropriate icon and color

---

### 3. Project Sections (`type: 'project'`)

**Behavior**: Assign tasks to specific projects.

**Available Values**: Any project ID from your projects list

**Example**:
```typescript
const project = taskStore.projects.find(p => p.name === 'Website Redesign')
if (project) {
  canvasStore.createProjectSection(project.id, project.name, project.color, { x: 800, y: 100 })
}
```

**What Happens**: When you drag a task into this section:
- Task's `projectId` field is set to the project ID
- Task inherits project color and appears in project views

---

### 4. Timeline Sections (`type: 'timeline'` or `'custom'`)

**Behavior**: Update task dates/scheduling.

**Current Implementation**: "Today" section

**Example (Today)**:
```typescript
canvasStore.createSection({
  name: 'Today',
  type: 'custom',
  propertyValue: 'today',
  position: { x: 100, y: 400, width: 300, height: 250 },
  color: '#10b981',
  layout: 'grid',
  isVisible: true,
  isCollapsed: false
})
```

**What Happens**: When you drag a task into the "Today" section:
- Task's `dueDate` is set to today's date (ISO format: `YYYY-MM-DD`)
- Task's first instance `scheduledDate` is updated to today
- Or a new instance is created if task has no instances

---

### 5. Custom Sections (`type: 'custom'`)

**Behavior**: Manual organization with NO automatic property updates (unless you add custom logic).

**Use Case**: Group related tasks visually without changing their data.

**Example**:
```typescript
canvasStore.createCustomGroup('Ideas', '#9333ea', { x: 1150, y: 100 }, 400, 300)
```

**What Happens**: Tasks retain all their existing properties when dragged in.

---

## How to Create New Smart Sections

### Step 1: Define Section Properties

Every section has these core properties:

```typescript
interface CanvasSection {
  id: string                    // Auto-generated UUID
  name: string                  // Display name (e.g., "Tomorrow", "High Priority")
  type: SectionType             // 'priority' | 'status' | 'timeline' | 'custom' | 'project'
  position: {                   // Position and size on canvas
    x: number
    y: number
    width: number
    height: number
  }
  color: string                 // Hex color for section border/background
  layout: LayoutType            // 'vertical' | 'horizontal' | 'grid' | 'freeform'
  isVisible: boolean            // Whether section is shown
  isCollapsed: boolean          // Whether section is collapsed
  propertyValue?: string        // Value to apply (e.g., 'high', 'today', 'tomorrow')
  autoCollect?: boolean         // Auto-collect matching tasks from inbox
}
```

### Step 2: Create the Section

**Option A: Use Preset Helpers** (Recommended for standard types)

```typescript
// Priority section
canvasStore.createPrioritySection('high', { x: 100, y: 100 })

// Status section
canvasStore.createStatusSection('done', { x: 450, y: 100 })

// Project section
canvasStore.createProjectSection(projectId, 'My Project', '#3b82f6', { x: 800, y: 100 })
```

**Option B: Use createSection() Directly** (For custom behavior)

```typescript
canvasStore.createSection({
  name: 'Tomorrow',
  type: 'custom',
  propertyValue: 'tomorrow',
  position: { x: 400, y: 400, width: 300, height: 250 },
  color: '#3b82f6',
  layout: 'grid',
  isVisible: true,
  isCollapsed: false
})
```

### Step 3: Add Custom Logic (If Needed)

If you're creating a custom section type that should update task properties, add detection logic in `src/views/CanvasView.vue` in the `applySectionPropertiesToTask()` function.

**File**: `src/views/CanvasView.vue`

**Location**: Look for the `switch (section.type)` statement around line 843

**Example: Adding "Tomorrow" Section Logic**

```typescript
case 'custom':
case 'timeline':
  // TODAY detection (existing)
  if (section.propertyValue === 'today' || section.name.toLowerCase().includes('today')) {
    const todayKey = formatDateKey(new Date())
    // ... existing today logic
  }

  // TOMORROW detection (new)
  else if (section.propertyValue === 'tomorrow' || section.name.toLowerCase().includes('tomorrow')) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowKey = formatDateKey(tomorrow)

    const task = taskStore.tasks.find(t => t.id === taskId)
    if (task) {
      const existingInstances = task.instances || []

      if (existingInstances.length > 0) {
        const updatedInstance = {
          ...existingInstances[0],
          scheduledDate: tomorrowKey,
          scheduledTime: existingInstances[0].scheduledTime || '09:00'
        }
        updates.instances = [updatedInstance, ...existingInstances.slice(1)]
        updates.dueDate = tomorrowKey
      } else {
        const newInstance = {
          id: `${taskId}-${tomorrowKey}`,
          scheduledDate: tomorrowKey,
          scheduledTime: '09:00',
          duration: task.estimatedDuration || 25,
          completedPomodoros: 0,
          isLater: false
        }
        updates.instances = [newInstance]
        updates.dueDate = tomorrowKey
      }
    }
  }
  break
```

### Step 4: Test Your Section

1. **Create the section** using the code above
2. **Drag a task** from elsewhere into the new section
3. **Open the task edit modal** and verify the properties changed
4. **Check console logs** for debugging output

---

## Complete Examples

### Example 1: "This Weekend" Timeline Section

```typescript
// Step 1: Create the section
canvasStore.createSection({
  name: 'This Weekend',
  type: 'custom',
  propertyValue: 'weekend',
  position: { x: 400, y: 700, width: 300, height: 250 },
  color: '#f59e0b',
  layout: 'grid',
  isVisible: true,
  isCollapsed: false
})

// Step 2: Add detection logic in CanvasView.vue
else if (section.propertyValue === 'weekend' || section.name.toLowerCase().includes('weekend')) {
  const now = new Date()
  const saturday = new Date(now)
  saturday.setDate(now.getDate() + (6 - now.getDay())) // Next Saturday
  const weekendKey = formatDateKey(saturday)

  // ... similar instance update logic as "today"
  updates.dueDate = weekendKey
  // Update task instances...
}
```

### Example 2: "Urgent" Combined Priority + Status Section

```typescript
// Create section
canvasStore.createSection({
  name: 'Urgent',
  type: 'custom',
  propertyValue: 'urgent',
  position: { x: 700, y: 400, width: 300, height: 250 },
  color: '#ef4444',
  layout: 'grid',
  isVisible: true,
  isCollapsed: false
})

// Add logic in CanvasView.vue
else if (section.propertyValue === 'urgent' || section.name.toLowerCase().includes('urgent')) {
  // Update BOTH priority and status
  updates.priority = 'high'
  updates.status = 'in_progress'

  // Also set due date to today
  const todayKey = formatDateKey(new Date())
  updates.dueDate = todayKey
}
```

### Example 3: "Backlog" with Auto-Collection

```typescript
canvasStore.createSection({
  name: 'Backlog',
  type: 'status',
  propertyValue: 'backlog',
  position: { x: 1000, y: 100, width: 300, height: 400 },
  color: '#64748b',
  layout: 'grid',
  isVisible: true,
  isCollapsed: false,
  autoCollect: true  // Automatically pulls in tasks with status='backlog'
})
```

---

## Date Format Reference

When working with dates in custom sections, use these formats:

### Backend Storage (Task Properties)
```typescript
task.dueDate = '2025-10-24'           // ISO format: YYYY-MM-DD
task.instances[0].scheduledDate = '2025-10-24'  // Same format
```

### UI Display (Canvas Card)
The `TaskNode.vue` component shows `task.dueDate` with a calendar icon:
```vue
<span v-if="task?.dueDate" class="due-date-badge">
  📅 {{ task.dueDate }}
</span>
```

**Note**: The canvas card displays dates in ISO format (`2025-10-24`), while the edit modal's `<input type="date">` also expects and displays ISO format.

### Helper Function
Use `formatDateKey()` to convert a Date object to the correct format:
```typescript
const todayKey = formatDateKey(new Date())  // Returns "2025-10-24"
```

---

## Architecture Details

### How Section Detection Works

1. **Drag ends**: `handleNodeDragStop()` is called in `CanvasView.vue`
2. **Check containment**: System checks if task's center point is inside any section
3. **Apply properties**: If inside a section, `applySectionPropertiesToTask()` is called
4. **Update task**: Task properties are updated via `taskStore.updateTaskWithUndo()`
5. **UI syncs**: All views (Canvas, Board, Calendar) update immediately

### Key Files

- **`src/stores/canvas.ts`** - Section store, creation methods, section state
- **`src/views/CanvasView.vue`** - Drag-drop handling, property application logic
- **`src/components/canvas/TaskNode.vue`** - Task card display (shows dueDate)
- **`src/components/TaskEditModal.vue`** - Edit modal with date inputs

### Console Debugging

Enable debug logs by dragging tasks and watching the console:

```
[handleNodeDragStop] ✓ Task is inside section: Today
[applySectionPropertiesToTask] Called with: task-123, Today
[applySectionPropertiesToTask] Detected Today section, creating instance
[applySectionPropertiesToTask] Updated instance: { scheduledDate: "2025-10-24", ... }
[applySectionPropertiesToTask] Updated dueDate: 2025-10-24
✅ Task updated with undo successfully
💾 Saved tasks to IndexedDB
```

---

## Common Patterns

### Pattern 1: Date-Based Sections

For sections that set dates (Today, Tomorrow, This Week, etc.):
- Always use ISO format (`YYYY-MM-DD`) for `dueDate`
- Update both `dueDate` and `instances[0].scheduledDate`
- Create new instance if task has none
- Replace existing instance's date instead of adding new

### Pattern 2: Multi-Property Sections

For sections that update multiple properties (Urgent = High Priority + In Progress):
- Update all relevant fields in the `updates` object
- Be intentional about which properties to change
- Consider UX: Does changing multiple things at once make sense?

### Pattern 3: Conditional Sections

For sections with smart logic (only update if task meets criteria):
```typescript
if (section.propertyValue === 'auto_high_priority') {
  // Only upgrade priority if task is already medium or low
  const task = taskStore.tasks.find(t => t.id === taskId)
  if (task && task.priority !== 'high') {
    updates.priority = 'high'
  }
}
```

---

## Best Practices

1. **Use descriptive `propertyValue`** - Makes detection logic clearer
2. **Keep sections focused** - Each section should have ONE clear purpose
3. **Test with real tasks** - Drag tasks and verify behavior before committing
4. **Add console logs** - Helps debug when properties don't update as expected
5. **Consider undo** - All updates use `updateTaskWithUndo()` for full undo support
6. **Maintain consistency** - Follow existing color schemes and layouts

---

## Troubleshooting

### Section doesn't update tasks

**Check**:
1. Is `type` set correctly? (`'priority'`, `'status'`, etc.)
2. For custom sections, did you add detection logic in `CanvasView.vue`?
3. Are console logs showing the task is detected as inside the section?

### Date appears empty in edit modal

**Check**:
1. Is `dueDate` in ISO format (`YYYY-MM-DD`)?
2. NOT `dd/mm/yyyy` or other formats
3. Use `todayKey` directly instead of converting

### Task properties don't persist

**Check**:
1. Are updates applied via `taskStore.updateTaskWithUndo()`?
2. Check browser console for IndexedDB errors
3. Verify task ID is correct

---

## Future Enhancements

Ideas for additional section types:

- **Time-based**: "This Morning", "This Afternoon", "This Evening"
- **Effort-based**: "Quick Wins" (tasks < 30min), "Deep Work" (tasks > 2hrs)
- **Energy-based**: "High Energy", "Low Energy", "Creative", "Administrative"
- **Context-based**: "Home", "Office", "On the Go"
- **Waiting**: Auto-set status to "on_hold" for tasks blocked on others

---

## Summary

Canvas sections provide a powerful way to organize and automatically update tasks through drag-and-drop. The system is extensible - you can create new section types by:

1. Creating the section with `canvasStore.createSection()`
2. Adding detection logic in `CanvasView.vue` (for custom types)
3. Testing thoroughly with Playwright

For questions or issues, check the console logs and refer back to this guide.
