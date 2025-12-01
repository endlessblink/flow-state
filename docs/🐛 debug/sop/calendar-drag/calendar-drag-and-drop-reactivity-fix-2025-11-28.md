# 🐛 Debug SOP - Calendar Drag-and-Drop Reactivity Issue Resolution

**Date:** 2025-11-28
**Severity:** Major (Critical user functionality broken)
**Time to Fix:** 2 hours

---

## 🔍 Problem Statement

Calendar drag-and-drop functionality was partially broken - users could move existing calendar events but could NOT drag tasks from Board, Canvas, or Inbox views to calendar time slots.

**Symptoms:**
- Calendar-to-calendar drag worked fine
- External sources (Board/Canvas/Inbox) could not drop on calendar time slots
- Console debug showed all time slots had `hasDropListener: false` and `hasDragoverListener: false`

---

## ✅ Solution Applied

### Root Cause Discovery

**Investigation Process:**
1. Added debugging code to check time slot event listeners
2. Verified Vue event bindings (`@drop`, `@dragover`) were not attaching to DOM
3. Identified that `calendarEvents` computed property wasn't reacting to task changes
4. Found that only legacy `task.scheduledDate/time` was being updated, not `task.instances`

**Key Insight:** Vue's reactivity system watches `task.instances` arrays for the `calendarEvents` computed property, but the code was only updating legacy fields.

### Working Pattern Fix

**The Fix:** Update task instances directly to trigger Vue reactivity.

```typescript
// Update the task instance (not legacy schedule)
const taskInstance = task.instances?.[0]
if (taskInstance) {
  taskInstance.scheduledDate = slot.date
  taskInstance.scheduledTime = timeStr
  console.log(`🎯 CALENDAR DROP: Updated task instance ${taskInstance.id} to ${slot.date} at ${timeStr}`)
}
```

**Enhancement:** Force Vue recomputation for immediate UI updates.

```typescript
// Force Vue to re-compute calendar events
await nextTick()
nextTick().then(() => {
  calendarEvents.value  // Trigger reactive update
})
```

---

## 🛠️ Step-by-Step Debug Process

### 1. Initial Investigation

**Actions Taken:**
- Added debugging code to CalendarView.vue `onMounted()` hook
- Checked console output for drop listener status
- Confirmed calendar-to-calendar moves worked (ruling out complete system failure)

**Discovery:** All time slots showed `hasDropListener: false` and `hasDragoverListener: false`

### 2. Component Analysis

**Investigation Focus:** 
- Vue event binding mechanism in calendar time slots
- `calendarEvents` computed property dependencies
- Task store update mechanisms

**Key Finding:** `calendarEvents` computed property depends on `task.instances` but only `task.scheduledDate/time` was being updated.

### 3. Pattern Discovery

**Working Pattern Identified:** 
- Calendar event moves should update BOTH legacy fields AND task instances
- Vue reactivity requires direct modification of reactive arrays/objects
- `nextTick()` helps ensure DOM updates are processed

**Working Code Pattern:**
```typescript
// Pattern: Update instances + legacy fields + force recomputation
if (taskInstance) {
  taskInstance.scheduledDate = slot.date    // Triggers calendarEvents recomputation
  taskInstance.scheduledTime = timeStr
}

taskStore.updateTask(taskId, {
  scheduledDate: slot.date,              // Legacy compatibility
  scheduledTime: timeStr
})

await nextTick()
nextTick().then(() => calendarEvents.value)  // Force UI update
```

### 4. Implementation

**Files Modified:**
1. `src/composables/calendar/useCalendarDayView.ts` - Added task instance updates and forced recomputation
2. `src/views/CalendarView.vue` - Added debugging for event listener verification

**Testing Process:**
- Verified Board → Calendar drag works
- Verified Canvas → Calendar drag works  
- Verified Inbox → Calendar drag works
- Verified Calendar → Calendar moves still work
- Confirmed tasks appear immediately in new time slots

---

## ✅ Results Verified

### Before Fix
- ❌ Board → Calendar: Failed (no drop listeners)
- ❌ Canvas → Calendar: Failed (no drop listeners)
- ❌ Inbox → Calendar: Failed (no drop listeners)
- ✅ Calendar → Calendar: Working (different mechanism)
- Tasks would not appear in new time slots

### After Fix
- ✅ Board → Calendar: Working perfectly
- ✅ Canvas → Calendar: Working perfectly
- ✅ Inbox → Calendar: Working perfectly
- ✅ Calendar → Calendar: Still working
- Tasks appear immediately in correct time slots
- No console errors during drag operations

---

## 🎯 Key Learning Points

### 1. Vue Reactivity System
- **Critical Insight**: Computed properties react to changes in their dependencies
- **Pattern**: Always modify the reactive data that computed properties depend on
- **Best Practice**: When arrays are dependencies, modify array elements directly

### 2. Dual Architecture Support
- **Legacy vs Modern**: System supports both legacy `task.scheduledDate/time` and modern `task.instances`
- **Synchronization**: Both systems must be kept in sync for reliability
- **Migration Strategy**: Gradually move from legacy to instance-based system

### 3. Debugging Techniques
- **Event Listener Verification**: Check DOM event bindings with `element.ondrop !== null`
- **Reactivity Debugging**: Add logging to computed property dependencies
- **Force Updates**: Use `nextTick()` to ensure DOM updates are processed

---

## 🚀 Future Debug Approach

### 1. Quick Verification Checklist
When calendar drag-and-drop issues occur:
- [ ] Check console for drop listener status (look for 🔍 [DEBUG] output)
- [ ] Verify task instances are being updated
- [ ] Confirm `calendarEvents` recomputation is triggered
- [ ] Test all drag sources (Board, Canvas, Inbox, Calendar)

### 2. Pattern Library
**Working Vue Reactivity Patterns:**
```typescript
// 1. Direct object property updates
taskInstance.scheduledDate = newValue  // ✅ Reactive
// NOT: taskInstance = {...taskInstance, scheduledDate: newValue}  // ❌ Breaks reactivity

// 2. Array element modifications
task.instances[0].property = newValue  // ✅ Reactive
// NOT: task.instances = [...task.instances]  // ❌ Breaks existing references

// 3. Forced recomputation
nextTick().then(() => computedProperty.value)  // ✅ Triggers update
```

### 3. Debug Tools
**Essential Commands:**
```javascript
// Check event listeners
console.log('Drop listeners:', slot.ondrop !== null)

// Verify computed property dependencies
console.log('Task instances before:', task.instances?.length)

// Force Vue update
nextTick().then(() => calendarEvents.value)
```

---

## 📝 Technical Details

### Files Modified
- **`src/composables/calendar/useCalendarDayView.ts`** (Lines 364-370, 406-410)
  - Added task instance updates in `handleDrop()` function
  - Enhanced with forced `calendarEvents` recomputation
  - Added comprehensive logging for debugging

- **`src/views/CalendarView.vue`** (Lines 678-689)
  - Added debugging in `onMounted()` hook
  - Checks drop listener attachment status
  - Logs time slot event listener state

### Commit Information
- **Branch**: master (stable-working-version)
- **Commit**: `ea0a4a9` - "fix: resolve calendar drag-and-drop event binding and reactivity issues"
- **Files Changed**: 2 files, 17 insertions(+), 1 deletion(-)

### Verification Commands
```bash
# Build verification
npm run build

# TypeScript verification  
npx vue-tsc --noEmit

# Development server test
npm run dev

# Console verification
# Open http://localhost:5546 and check for 🔍 [DEBUG] output
```

### Root Cause Summary
**Primary Issue:** Vue event bindings not attaching to time slot elements
**Secondary Issue:** Task instances not being updated, preventing calendarEvents recomputation
**Solution Applied:** Direct task instance modification + forced Vue recomputation
**Impact:** Restored full calendar drag-and-drop functionality from all sources

---

## 🔗 Related Documentation

- **Current SOP Location**: `docs/🐛 debug/sop/calendar-drag-and-drop-troubleshooting.md`
- **Vue.js Documentation**: Reactivity Fundamentals and Computed Properties
- **Project Documentation**: Calendar system architecture and task instance management
- **Debug Logs**: Console output with 🎯 CALENDAR DROP prefixes for ongoing monitoring

---

**Success Verification:** All drag-and-drop operations now work correctly, with immediate visual feedback and proper task scheduling updates. The fix maintains backward compatibility while enabling modern Vue reactivity patterns.
