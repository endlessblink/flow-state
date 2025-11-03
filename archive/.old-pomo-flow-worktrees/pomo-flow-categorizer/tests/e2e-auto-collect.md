# E2E Auto-Collect Test Plan

## Test Environment Setup
- URL: http://localhost:5546/#/canvas
- Open Browser Console (F12)
- Clear IndexedDB for fresh start (optional)

## Test Scenario 1: Medium Priority Auto-Collect

### Setup
1. Create 3 medium-priority tasks in inbox:
   - "Task A"
   - "Task B"
   - "Task C"

### Execution
1. Click "+" button → Create "Medium Priority" section
2. Click magnet 🧲 on section header
3. Observe console logs

### Expected Results
✅ Console shows:
```
[Auto-Collect] 🧲 Magnet clicked for section: section-xxxxx
[Auto-Collect] Section: {name: "Medium Priority", type: "priority", propertyValue: "medium", autoCollect: true}
[Auto-Collect] Inbox has 3 tasks: [{title: "Task A", priority: "medium"}, ...]
[Auto-Collect]   "Task A": priority=medium, wants=medium, match=true
[Auto-Collect]   "Task B": priority=medium, wants=medium, match=true
[Auto-Collect]   "Task C": priority=medium, wants=medium, match=true
[Auto-Collect] ✓ Placing 3 tasks
[Auto-Collect]   Placing "Task A" at (x, y)
[Auto-Collect]   Placing "Task B" at (x, y)
[Auto-Collect]   Placing "Task C" at (x, y)
```

✅ Visual results:
- All 3 tasks appear in section
- Tasks arranged in grid layout
- Inbox count drops to 0
- Magnet button stays blue (active)

## Test Scenario 2: High Priority Auto-Collect (No Matches)

### Setup
1. Keep Medium Priority section with auto-collect ON
2. Inbox has 3 medium-priority tasks

### Execution
1. Create "High Priority" section
2. Click magnet on High Priority section

### Expected Results
✅ Console shows:
```
[Auto-Collect] 🧲 Magnet clicked for section: section-yyyyy
[Auto-Collect] Section: {name: "High Priority", type: "priority", propertyValue: "high", autoCollect: true}
[Auto-Collect] Inbox has 3 tasks: [{title: "Task A", priority: "medium"}, ...]
[Auto-Collect]   "Task A": priority=medium, wants=high, match=false
[Auto-Collect]   "Task B": priority=medium, wants=high, match=false
[Auto-Collect]   "Task C": priority=medium, wants=high, match=false
[Auto-Collect] ⚠️ No matching tasks
```

✅ Visual results:
- No tasks moved to High Priority section
- Medium tasks stay in Medium Priority section
- Inbox remains empty

## Test Scenario 3: Mixed Priorities

### Setup
1. Clear canvas completely
2. Create tasks with different priorities:
   - "High Task 1" with priority: high (use "!!!")
   - "High Task 2" with priority: high
   - "Med Task 1" with priority: medium
   - "Med Task 2" with priority: medium

### Execution
1. Create "High Priority" section → Click magnet
2. Create "Medium Priority" section → Click magnet

### Expected Results
✅ Console shows matching for each section correctly
✅ Visual results:
- High Priority section: 2 tasks
- Medium Priority section: 2 tasks
- Inbox: 0 tasks

## Test Scenario 4: Status-Based Auto-Collect

### Setup
1. Create tasks with different statuses:
   - "Plan 1" - status: planned
   - "Plan 2" - status: planned
   - "WIP 1" - status: in_progress

### Execution
1. Create "Planned" section → Click magnet
2. Create "In Progress" section → Click magnet

### Expected Results
✅ Planned section: 2 tasks (Plan 1, Plan 2)
✅ In Progress section: 1 task (WIP 1)
✅ Inbox: 0 tasks

## Test Scenario 5: Toggle Auto-Collect Off/On

### Setup
1. Medium Priority section with auto-collect ON
2. 2 medium tasks already collected

### Execution
1. Click magnet to toggle OFF → Button should turn gray
2. Add new medium-priority task to inbox
3. Verify task stays in inbox (no auto-collect)
4. Click magnet to toggle ON
5. Verify task immediately collects

### Expected Results
✅ Auto-collect OFF: New tasks stay in inbox
✅ Auto-collect ON: Clicking magnet collects existing inbox tasks immediately

## Common Failure Modes to Check

### Issue: task.priority is null
- Default priority should be 'medium' (check createTask default)
- If null, matching fails

### Issue: propertyValue mismatch
- Section propertyValue: "medium" (string)
- Task priority: "medium" (should match)
- Strict equality: "medium" === "medium" ✓

### Issue: Event not emitting
- SectionNodeSimple @collect event
- CanvasView @collect="collectTasksForSection" listener
- Check both are connected

### Issue: Watcher not firing
- Watcher was REMOVED (manual-only now)
- Auto-collect only happens when magnet clicked
- No automatic watching (prevents infinite loops)

## Debug Helpers

Add to browser console:
```javascript
// Check section state
window.__canvasStore.sections

// Check specific section
window.__canvasStore.sections.find(s => s.name === 'Medium Priority')

// Check inbox tasks
window.__canvasStore.$state.tasks.filter(t => t.isInInbox)

// Manually trigger collection
window.__canvasStore.toggleAutoCollect('section-xxxxx')
```
