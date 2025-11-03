# Perplexity Research Query: Vue 3 Calendar Week View Drag Implementation

## Context

Building a productivity calendar app with Vue 3 Composition API and Pinia state management. Need to implement drag-and-drop functionality for a week view calendar where tasks can be dragged to different days and time slots.

## Current Issue

Implementing drag functionality where:
- Visual feedback works (CSS transforms during drag)
- Mouse events fire correctly (mousedown, mousemove, mouseup)
- State update is called on mouseup
- BUT: Changes don't persist - task snaps back to original position

## Technical Stack

- Vue 3.5+ with Composition API
- Pinia for state management
- TypeScript
- No external drag libraries (native implementation)

## Architecture Details

**Component Structure:**
- CalendarView.vue with conditional week view rendering
- Week grid: 7 columns (days) × 17 rows (6 AM - 10 PM, 30-min slots)
- Tasks rendered as absolutely positioned elements in an events layer
- Computed property `weekEvents` derives task positions from Pinia store

**Current Implementation:**
```typescript
// Simplified current approach
const startWeekDrag = (event: MouseEvent, calendarEvent) => {
  let finalDayIndex = calendarEvent.dayIndex
  let finalSlotFromTop = calendarEvent.startSlot

  const handleMouseMove = (e: MouseEvent) => {
    requestAnimationFrame(() => {
      // Calculate new position
      finalDayIndex = calculateDayIndex(e)
      finalSlotFromTop = calculateSlotIndex(e)

      // Update visual position with CSS transform
      eventElement.style.transform = `translate(${newX}px, ${newY}px)`
    })
  }

  const handleMouseUp = () => {
    // Update Pinia store
    taskStore.updateTaskInstance(taskId, instanceId, {
      scheduledDate: newDateString,
      scheduledTime: newTimeString
    })

    // Reset transform after Vue reactivity
    nextTick(() => {
      eventElement.style.transform = ''
    })
  }
}
```

**Data Flow:**
```
Pinia Store → weekEvents computed → getWeekEventStyle() → absolute positioning
```

## Research Questions

### 1. Vue 3 Reactivity & DOM Manipulation Pattern

**Question:** What is the correct pattern for combining CSS transforms (for smooth visual feedback) with Vue 3 reactive state updates in a drag-and-drop scenario?

**Specific concerns:**
- When to reset CSS transforms vs let Vue re-render?
- Does `nextTick()` guarantee the new position is rendered before transform reset?
- Should we use a temporary "dragging" state separate from actual task data?
- How to prevent the "snap back" issue when computed properties recalculate?

### 2. Pinia State Update Timing

**Question:** Why might a Pinia store update appear to execute but not persist when triggered from a mouseup event handler?

**Specific concerns:**
- Does RAF (requestAnimationFrame) affect Pinia reactivity timing?
- Could event listeners be removed before state update completes?
- Should we use `store.$patch()` instead of individual property updates?
- How to debug Pinia state updates that "silently fail"?

### 3. Calendar Event Positioning Architecture

**Question:** For a calendar with absolutely positioned events controlled by Vue computed properties, what's the best architecture for drag-and-drop that prevents visual glitches?

**Patterns to compare:**
- **Pattern A:** CSS transforms only during drag → reset on mouseup → rely on Vue re-render
- **Pattern B:** Update actual position styles during drag → no transforms
- **Pattern C:** Temporary "drag ghost" element → update real element only on drop
- **Pattern D:** Optimistic UI updates during drag → debounced store updates

### 4. RequestAnimationFrame & Vue Reactivity

**Question:** When using RAF for smooth drag operations in Vue 3, how should we coordinate with Vue's reactivity system to avoid race conditions?

**Specific concerns:**
- Can RAF callbacks outlive Vue component lifecycle?
- Should we cancel RAF in `onBeforeUnmount`?
- Does RAF batching conflict with Vue's reactivity batching?
- Best practice for cleanup of RAF + event listeners?

### 5. Week View Specific Challenges

**Question:** For a week calendar view with tasks spanning multiple 30-minute slots across 7 days, what are proven patterns for handling:

- Cross-day dragging (horizontal movement)
- Time slot changes (vertical movement)
- Scroll during drag (when view is scrollable)
- Multi-slot task height calculation during drag
- Visual snap-to-grid feedback

### 6. Debugging State Persistence Issues

**Question:** What Vue DevTools or debugging techniques can identify why a Pinia state update doesn't persist after a drag operation?

**Need to check:**
- Is `updateTaskInstance` actually being called?
- Does the mutation execute but get immediately overwritten?
- Are there conflicting computed property recalculations?
- Is there a middleware or plugin intercepting updates?

### 7. Real-World Examples

**Request:** Please provide links to production-quality examples of:
- Vue 3 Composition API calendar drag implementations
- Pinia state management with complex drag-and-drop
- Week/month view calendars with native drag support
- GitHub repos with similar architecture

Prefer examples that:
- Don't use vue-draggable or external libraries
- Handle both visual feedback AND state persistence correctly
- Work with TypeScript
- Use modern Vue 3.5+ patterns

## Expected Research Output

1. **Root Cause Analysis:** Why does the current implementation fail to persist state?
2. **Correct Pattern:** Step-by-step implementation pattern that handles both visual feedback and state persistence
3. **Code Example:** Working code snippet showing the proper Vue 3 + Pinia drag pattern
4. **Common Pitfalls:** List of mistakes that cause this exact "visual works but state doesn't persist" issue
5. **Best Practices:** Performance optimization tips for calendar drag operations

## Additional Context

- The Day view drag works perfectly with the same store update method
- Day view uses same architecture (RAF + CSS transforms + nextTick)
- Week view might have different timing due to more complex computed properties
- Task data stored as: `{ scheduledDate: 'YYYY-MM-DD', scheduledTime: 'HH:MM' }`
- Using instance-based architecture (tasks can have multiple scheduled instances)

## Success Criteria

Implementation will be considered successful when:
1. ✅ Drag provides smooth 60fps visual feedback
2. ✅ Task position updates persist in Pinia store
3. ✅ Task renders at new position after drag completes
4. ✅ Sidebar shows updated date/time immediately
5. ✅ No visual glitches or "snap back" behavior
6. ✅ Works across day boundaries and time slots
7. ✅ Handles edge cases (drag outside bounds, rapid drags, etc.)
