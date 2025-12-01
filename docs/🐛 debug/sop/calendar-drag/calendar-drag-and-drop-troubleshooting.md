# Calendar Drag-and-Drop Troubleshooting SOP

## Issue Overview
**Symptoms**: Calendar drag-and-drop not working - tasks cannot be dropped from Board/Canvas/Inbox to calendar time slots.

## Root Cause Analysis
**Vue Event Binding Issue**: `@drop` and `@dragover` event bindings not attaching to DOM elements, causing external drag sources to fail.

## Debugging Steps

### 1. Check Console Output
1. Open browser DevTools (F12)
2. Navigate to Console tab
3. Look for debug output:
   ```
   🔍 [DEBUG] Checking drop listeners on time slots:
   Slot 0: {hasDropListener: false, hasDragoverListener: false, classes: "time-slot"}
   ```

**Expected**: All slots should show `hasDropListener: true` and `hasDragoverListener: true`

### 2. Verify Drag Operations
1. Try dragging a task from Board to calendar
2. Check console for:
   ```
   🎯 CALENDAR DROP: Task "Task Name" (ID: xyz) from board dropped on YYYY-MM-DD at HH:MM
   ```
3. Check if task appears in calendar after drop

### 3. Test Calendar-to-Calendar Moves
1. Drag existing calendar event to different time slot
2. Should see:
   ```
   🎯 CALENDAR DROP: Moving calendar event to new time slot
   🎯 CALENDAR DROP: Updated task instance instance-id to new time
   ```

## Solutions Applied

### Solution 1: Task Instance Updates (Primary Fix)
**File**: `src/composables/calendar/useCalendarDayView.ts`

**Problem**: Only updating legacy `task.scheduledDate`/`task.scheduledTime`, not instances.

**Fix**: Update task instances directly in `handleDrop()`:
```typescript
// Update the task instance (not legacy schedule)
const taskInstance = task.instances?.[0]
if (taskInstance) {
  taskInstance.scheduledDate = slot.date
  taskInstance.scheduledTime = timeStr
}
```

### Solution 2: Force Vue Reactivity
**File**: `src/composables/calendar/useCalendarDayView.ts`

**Enhancement**: Force calendarEvents recomputation:
```typescript
await nextTick()
nextTick().then(() => {
  calendarEvents.value  // Trigger reactive update
})
```

### Solution 3: Debug Event Listeners
**File**: `src/views/CalendarView.vue`

**Diagnostic**: Add debugging in `onMounted()`:
```typescript
setTimeout(() => {
  const slots = document.querySelectorAll('.time-slot')
  console.log('🔍 [DEBUG] Checking drop listeners on time slots:')
  slots.forEach((slot, idx) => {
    console.log(`Slot ${idx}:`, {
      hasDropListener: slot.ondrop !== null,
      hasDragoverListener: slot.ondragover !== null
    })
  })
}, 500)
```

## Verification Protocol

### Step 1: Technical Verification
1. ✅ Build succeeds: `npm run build`
2. ✅ TypeScript compiles: `npx vue-tsc --noEmit`
3. ✅ Dev server starts: `npm run dev`
4. ✅ No console errors on load

### Step 2: Functional Verification
1. ✅ Board → Calendar drag works
2. ✅ Canvas → Calendar drag works  
3. ✅ Inbox → Calendar drag works
4. ✅ Calendar → Calendar move works
5. ✅ Tasks appear immediately in new time slots
6. ✅ No visual glitches during drag operations

### Step 3: User Confirmation
**REQUIRED**: User must confirm all drag operations work correctly before marking as resolved.

## Files Modified
- `src/composables/calendar/useCalendarDayView.ts` - Task instance updates and reactivity
- `src/views/CalendarView.vue` - Debug logging for event listeners

## Dependencies
- Vue 3 reactivity system
- Task store instances array
- calendarEvents computed property

## Success Criteria
- All drag sources work (Board, Canvas, Inbox, Calendar)
- Tasks appear immediately in correct time slots
- No console errors during drag operations
- Vue reactivity working properly
- User confirms functionality works as expected

## Related Issues
- Vue event binding not attaching properly
- Task instances not triggering calendar recomputation
- Reactive updates not propagating to calendar display

## Maintenance Notes
- Monitor for future Vue updates that might affect event binding
- Keep task instance synchronization with legacy fields
- Regular testing of drag-and-drop functionality
