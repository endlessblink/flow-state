# Troubleshooting Guide

## Common Issues & Solutions

### Task Creation Not Working
1. Check undo/redo system is properly initialized
2. Verify task store has database connection
3. Test with Playwright for visual confirmation
4. Check browser console for errors

### Canvas Tasks Not Dragging
1. Verify Vue Flow parent-child relationships
2. Check if `extent: 'parent'` constraint is removed
3. Test drag handlers in TaskNode.vue
4. Verify mouse event propagation

### Database Not Persisting
1. Check PouchDB instance is initialized (singleton pattern)
2. Verify browser supports IndexedDB
3. Check for quota exceeded errors
4. Test with manual save operations
5. Check CouchDB sync status if remote sync enabled

### Theme Switching Issues
1. Verify CSS custom properties are loaded
2. Check Naive UI theme configuration
3. Test design token application
4. Verify Tailwind dark mode configuration

### Sidebar Filters Not Matching Tasks (BUG-007)
**Symptom**: "Today" or "This Week" filter shows fewer tasks than expected.

**Root Cause**: Date strings stored in inconsistent formats:
- `07T00:00:00+00:00-01-2026` (malformed from database)
- `07-01-2026` (DD-MM-YYYY)
- `2026-01-07` (YYYY-MM-DD - expected)

**Solution**: Use `normalizeDateString()` in `useSmartViews.ts` to convert all date formats before comparison.

**Key Files**:
- `src/composables/useSmartViews.ts` - Contains date normalization and filter logic
- Filter functions: `isTodayTask()`, `isWeekTask()`

**Testing**: Use Playwright to click sidebar filters and verify task counts in console logs.

### Tasks Mysteriously Disappearing (BUG-020)
A built-in task disappearance logger exists for debugging data loss:
- **Location**: `src/utils/taskDisappearanceLogger.ts`
- **Skill**: Use `dev-debug-data-loss` skill for detailed instructions
- **Currently**: Auto-enabled on app startup (for BUG-020 investigation)

Quick console commands:
```javascript
window.taskLogger.getDisappearedTasks()  // Check for disappeared tasks
window.taskLogger.printSummary()          // Get logging summary
window.taskLogger.exportLogs()            // Export for analysis
```

## Critical Gotchas

### Undo/Redo System
- **Always use unified system** - Don't create separate undo implementations
- **Save state before mutations** - Call `saveState()` before making changes
- **Test both directions** - Verify both undo and redo work correctly

### Canvas System
- **Task dragging constraints removed** - Tasks can now be dragged outside sections
- **Section collapse data** - Heights are preserved in `collapsedHeight` property
- **Vue Flow parent-child** - Understand parentNode relationships for proper rendering

### Task Instances
- **Backward compatibility** - Legacy `scheduledDate`/`scheduledTime` still supported
- **Instance creation** - Use `getTaskInstances()` helper for consistent access
- **Calendar integration** - Instances enable flexible multi-date scheduling

## Standard Operating Procedures (SOPs)

**Location**: `docs/debug/sop/`

SOPs document production fixes with root cause analysis, solution steps, and rollback procedures.

### When to Create SOPs
- After fixing production bugs
- When implementing complex system changes
- For rollback procedures
