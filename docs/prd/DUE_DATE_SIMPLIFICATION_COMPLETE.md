# PRD: Complete Due Date Simplification - 100% Cleanup

## **OBJECTIVE**
Eliminate ALL scheduling complexity and make `dueDate` the ONLY date field throughout the entire application. Remove every trace of instances, scheduledDate, scheduledTime, and scheduling UI.

## **PROBLEM STATEMENT**
- Tasks are still being auto-scheduled in calendar view instead of appearing in inbox
- Task editing still shows scheduling options (scheduledDate/scheduledTime)
- Calendar logic still uses complex `getTaskInstances()` system
- Inconsistent behavior between different parts of the app

## **SUCCESS CRITERIA**
✅ Tasks with due dates appear ONLY as simple due-date events (at 9 AM default)
✅ No auto-scheduling behavior anywhere in the app
✅ Task editing has ONLY dueDate field (no scheduling fields)
✅ No `getTaskInstances()` calls anywhere in codebase
✅ No `TaskInstance` references anywhere
✅ No `scheduledDate`, `scheduledTime`, `instances` fields anywhere
✅ Calendar shows tasks organized by dueDate (deadline view)
✅ Build succeeds with 0 errors
✅ App works perfectly on localhost:5546

## **COMPREHENSIVE CLEANUP PLAN**

### **PHASE 1: CORE STORE CLEANUP**
**Files:**
- `src/stores/tasks.ts`
- `src/stores/taskCore.ts`

**Actions:**
- [ ] Remove `TaskInstance` interface completely
- [ ] Remove `getTaskInstances()` function completely
- [ ] Remove `getTaskInstances` from all exports
- [ ] Remove `createTaskInstance`, `updateTaskInstance`, `deleteTaskInstance` functions
- [ ] Remove all TaskInstance-related actions

### **PHASE 2: SMART VIEW SIMPLIFICATION**
**File:** `src/stores/tasks.ts`

**Actions:**
- [ ] Simplify "Today" filter: `task.dueDate === today || task.status === 'in_progress'`
- [ ] Simplify "Week" filter: `task.dueDate >= today && task.dueDate <= today + 7 days`
- [ ] Remove ALL `getTaskInstances()` calls from smart view logic
- [ ] Remove ALL instance-based filtering
- [ ] Remove ALL legacy scheduledDate/scheduledTime references

### **PHASE 3: CALENDAR COMPOSABLES COMPLETE OVERHAUL**
**Files:**
- `src/composables/calendar/useCalendarDayView.ts`
- `src/composables/calendar/useCalendarWeekView.ts`
- `src/composables/calendar/useCalendarMonthView.ts`

**Actions:**
- [ ] Remove `getTaskInstances` from ALL imports
- [ ] Replace ALL complex instance logic with simple dueDate checking
- [ ] Simple logic: `if (task.dueDate === dateStr) createDueDateEvent(task)`
- [ ] Remove all `hasInstances`, `instances`, `hasLegacySchedule` variables
- [ ] Remove all 3 cases (scheduled, unscheduled, legacy) - replace with 1 simple case
- [ ] Create simple due-date events at 9:00 AM default time

### **PHASE 4: UI COMPONENTS COMPLETE CLEANUP**
**Files to search and fix:**
- `src/components/TaskEditModal.vue`
- `src/components/TaskManagerSidebar.vue`
- `src/views/CalendarView.vue`
- `src/components/kanban/KanbanSwimlane.vue`
- `src/App.vue`
- `src/components/CalendarInboxPanel.vue`
- ANY other files with scheduling references

**Actions:**
- [ ] Remove ALL `getTaskInstances()` imports and calls
- [ ] Remove ALL scheduling input fields (scheduledDate, scheduledTime)
- [ ] Remove ALL instance badges and counts
- [ ] Remove ALL scheduling-related UI elements
- [ ] Keep ONLY dueDate input field in task editing

### **PHASE 5: SMART VIEW LOGIC UPDATE**
**File:** `src/stores/tasks.ts`

**Actions:**
- [ ] Update "Today" smart view to use only dueDate logic
- [ ] Update "Week" smart view to use only dueDate range logic
- [ ] Remove all instance-based filtering from smart views
- [ ] Ensure due-today tasks are NOT auto-scheduled

### **PHASE 6: COMPREHENSIVE TESTING**
**Actions:**
- [ ] Create test tasks with only dueDate
- [ ] Verify they appear as simple calendar events (not auto-scheduled)
- [ ] Verify no scheduling options in task editing
- [ ] Verify smart views work correctly
- [ ] Test build succeeds
- [ ] Test app works on localhost:5546

## **DETAILED IMPLEMENTATION**

### **New Simplified Task Model**
```typescript
interface Task {
  // ... other fields
  dueDate: string // ONLY date field
  // REMOVED: scheduledDate, scheduledTime, instances
}
```

### **New Simplified Calendar Logic**
```typescript
// OLD: Complex instance system
const instances = getTaskInstances(task)
if (instances.length > 0) { ... complex logic ... }

// NEW: Simple dueDate check
if (task.dueDate === dateStr) {
  createSimpleDueDateEvent(task)
}
```

### **New Simplified Smart Views**
```typescript
// OLD: Complex filtering
if (getTaskInstances(task).some(...)) { ... }

// NEW: Simple dueDate filtering
if (task.dueDate === today) { ... }
```

## **FILES TO MODIFY (COMPLETE LIST)**
1. `src/stores/tasks.ts` - Remove instances, simplify smart views
2. `src/stores/taskCore.ts` - Remove TaskInstance interface
3. `src/composables/calendar/useCalendarDayView.ts` - Complete overhaul
4. `src/composables/calendar/useCalendarWeekView.ts` - Complete overhaul
5. `src/composables/calendar/useCalendarMonthView.ts` - Complete overhaul
6. `src/components/TaskEditModal.vue` - Remove scheduling UI
7. `src/components/TaskManagerSidebar.vue` - Remove instance badges
8. `src/views/CalendarView.vue` - Remove getTaskInstances calls
9. `src/components/CalendarInboxPanel.vue` - Simplify to dueDate only
10. `src/components/kanban/KanbanSwimlane.vue` - Remove getTaskInstances calls
11. `src/App.vue` - Remove getTaskInstances calls
12. ANY OTHER FILES with scheduling references

## **VERIFICATION CHECKLIST**
- [ ] No `getTaskInstances` function exists anywhere
- [ ] No `TaskInstance` interface exists anywhere
- [ ] No `scheduledDate` field references anywhere
- [ ] No `scheduledTime` field references anywhere
- [ ] No `instances` field references anywhere
- [ ] No scheduling UI elements exist anywhere
- [ ] Only dueDate field exists in task editing
- [ ] Calendar shows simple due-date events only
- [ ] Build succeeds with 0 errors
- [ ] App works perfectly on localhost:5546

## **EXPECTED RESULT**
- **Before**: Complex scheduling system with auto-scheduling, confusing UI
- **After**: Simple dueDate-only system, clean UI, no auto-scheduling

## **CHECKPOINT**
This PRD serves as the master plan. Every item will be checked off during implementation to ensure 100% completion.