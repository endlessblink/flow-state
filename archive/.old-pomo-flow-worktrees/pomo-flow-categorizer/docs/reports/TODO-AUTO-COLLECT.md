# TODO: Fix Auto-Collect Reliability

## Current Issue
Auto-collect magnet button (🧲) is unreliable:
- ❌ Sometimes pulls from inbox correctly
- ❌ Sometimes doesn't trigger at all
- ❌ Sometimes pulls canvas tasks (despite isInInbox === true fix)

## Root Causes to Investigate

### 1. Event Emission Chain
**Problem:** @collect event may not reach CanvasView
```
SectionNodeSimple.toggleAutoCollect()
  → emit('collect', sectionId)
  → CanvasView @collect="collectTasksForSection"
```

**Debug:**
- Add console.log in SectionNodeSimple:115 to verify click
- Add console.log in emit() call to verify emission
- Check if CanvasView collectTasksForSection actually runs

### 2. Task Matching Logic
**Problem:** taskMatchesSection may have null handling issues

```typescript
// src/stores/canvas.ts:289-316
if (section.type === 'priority' && section.propertyValue) {
  return task.priority === section.propertyValue
}
```

**Edge Cases:**
- `task.priority` can be `null` (type: 'low' | 'medium' | 'high' | null)
- `section.propertyValue` is string 'high' | 'medium' | 'low'
- `null === 'medium'` → false (correct)
- But what if task.priority is undefined vs null?

### 3. State Synchronization
**Problem:** isInInbox might not be set correctly

**When does isInInbox change?**
- createTask: defaults to `true` ✓
- handleDrop: sets to `false` ✓
- But what about tasks created before this system existed?
- Migration at tasks.ts:132-141 should handle this

**Test:**
```javascript
// Check all tasks in console
window.__canvasStore.$state.tasks.map(t => ({
  title: t.title,
  isInInbox: t.isInInbox,
  hasCanvasPos: !!t.canvasPosition
}))
```

### 4. Console Logs Not Showing
**Problem:** If no logs appear when clicking magnet, event isn't firing

**Possible Causes:**
- Button click not propagating
- Event listener not attached
- Component not mounted
- Vue reactivity issue

## Test Scenarios

### Scenario A: Basic Medium Priority
1. Fresh start - clear all tasks
2. Create 3 tasks in inbox (default priority: medium)
3. Create "Medium Priority" section
4. Click magnet
5. **Expected:** All 3 tasks move to section
6. **Check console:** Should see full auto-collect log trail

### Scenario B: High Priority with !!!
1. Brain Dump: `Urgent task !!!`
2. This sets priority to 'high' (see InboxPanel.vue:134-143)
3. Create "High Priority" section
4. Click magnet
5. **Expected:** High priority task moves to section

### Scenario C: Already-Placed Tasks
1. Drag 2 medium tasks to canvas manually
2. Create 2 more medium tasks in inbox
3. Create "Medium Priority" section
4. Click magnet
5. **Expected:** Only 2 inbox tasks collect (not the 2 on canvas)

## Fix Plan

### Step 1: Add Comprehensive Logging
```typescript
// SectionNodeSimple.vue:115
const toggleAutoCollect = () => {
  console.log('🧲 MAGNET CLICKED for section:', props.data.id)
  canvasStore.toggleAutoCollect(props.data.id)
  console.log('🎯 EMITTING collect event for:', props.data.id)
  emit('collect', props.data.id)
  console.log('✅ Event emitted successfully')
}
```

### Step 2: Verify Task Matching
```typescript
// Add to taskMatchesSection in canvas.ts
console.log(`Matching task "${task.title}":`, {
  taskPriority: task.priority,
  taskPriorityType: typeof task.priority,
  sectionValue: section.propertyValue,
  sectionType: typeof section.propertyValue,
  strictEqual: task.priority === section.propertyValue
})
```

### Step 3: Add Window Debug Helper
```typescript
// In CanvasView.vue onMounted:
if (import.meta.env.DEV) {
  window.__debugAutoCollect = (sectionId) => {
    collectTasksForSection(sectionId)
  }
}
```

### Step 4: Test Each Component Independently
1. Test toggleAutoCollect directly from console
2. Test taskMatchesSection with known values
3. Test collectTasksForSection manually
4. Verify full chain works

## Expected Console Output (Working)

```
🧲 MAGNET CLICKED for section: section-1728...
🎯 EMITTING collect event for: section-1728...
✅ Event emitted successfully
[Auto-Collect] 🧲 Magnet clicked for section: section-1728...
[Auto-Collect] Section: {name: "Medium Priority", type: "priority", propertyValue: "medium", autoCollect: true}
[Auto-Collect] Inbox has 3 tasks: [{title: "Task A", priority: "medium", status: "planned"}, ...]
[Auto-Collect]   "Task A": priority=medium, wants=medium, match=true
[Auto-Collect]   "Task B": priority=medium, wants=medium, match=true
[Auto-Collect]   "Task C": priority=medium, wants=medium, match=true
[Auto-Collect] ✓ Placing 3 tasks
[Auto-Collect]   Placing "Task A" at (70, 110)
[Auto-Collect]   Placing "Task B" at (290, 110)
[Auto-Collect]   Placing "Task C" at (510, 110)
```

## If Still Broken

### Nuclear Option: Simplify Auto-Collect
Remove event emission complexity, make magnet a simple button that calls a prop function:

```vue
<!-- SectionNodeSimple.vue -->
<button @click="handleAutoCollect">🧲</button>

<script>
const handleAutoCollect = () => {
  canvasStore.toggleAutoCollect(props.data.id)
  // Call collect function from props instead of emit
  props.onCollect?.(props.data.id)
}
</script>
```

## References
- E2E Test Plan: tests/e2e-auto-collect.md
- Commit fixing canvas collection: 96f1449
- Commit adding auto-collect: 5727e62
