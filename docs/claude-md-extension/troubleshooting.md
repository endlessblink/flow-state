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

### Deleted Canvas Groups Reappearing (BUG-060, BUG-061)
**Symptom**: Groups (Friday, Saturday, Today) keep coming back after deletion and page refresh.

**Root Causes**:
1. Auth watcher didn't clear localStorage-loaded groups when Supabase returned empty
2. `ensureActionGroups()` auto-created Friday/Saturday groups on startup

**Solution**:
- Auth watcher now ALWAYS sets `_rawGroups.value` from Supabase (even if empty)
- `ensureActionGroups()` is disabled - users create groups manually via context menu

**SOP**: `docs/sop/active/CANVAS-group-resurrection-fix.md`

**Key Files**:
- `src/stores/canvas.ts` (auth watcher)
- `src/composables/canvas/useCanvasOverdueCollector.ts` (ensureActionGroups)

### Supabase Realtime WebSocket 403 Errors
**Symptom**: Console shows repeated `WebSocket connection failed: Unexpected response code: 403` and `[REALTIME] Subscription error: Handshake failed (403?)`.

**Root Cause**: JWT keys in `.env.local` were signed with a different secret than what local Supabase expects. The signature verification fails, causing 403 Forbidden.

**Diagnosis**:
- Error appears on app startup when Realtime tries to connect
- REST API works fine (queries succeed)
- Only WebSocket connections fail

**Solution**:
```bash
npm run generate:keys
# Copy output to .env.local
npm run kill && npm run dev
```

**Prevention**: `npm run dev` now validates JWT signatures before starting. If keys drift, you'll see:
```
[Supabase] JWT signature mismatch!
To fix, run: npm run generate:keys
```

**Key Files**:
- `scripts/validate-supabase-keys.cjs` - Startup validation
- `scripts/generate-supabase-keys.cjs` - Key regeneration
- `.env.local` - JWT keys storage

**Local JWT Secret**: `super-secret-jwt-token-with-at-least-32-characters-long`

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

### Tasks Render Empty on First Refresh (BUG-151)
**Symptom**: Task nodes appear as empty shells (frame only, no content) on first page refresh. Second refresh fixes it.

**Root Cause**: Vue Flow viewport copied once during setup, not tracked reactively. When Vue Flow initializes with `zoom: 0`, LOD3 triggers and hides content permanently.

**Solution**: Access viewport through computed property with guards.

**SOP**: `docs/sop/SOP-001-vue-flow-viewport-reactivity.md`

**Key File**: `src/components/canvas/TaskNode.vue` (lines 161-180)

## Standard Operating Procedures (SOPs)

**Location**: `docs/sop/`

SOPs document production fixes with root cause analysis, solution steps, and rollback procedures.

### Available SOPs
| ID | Title | Related Bug |
|----|-------|-------------|
| SOP-001 | Vue Flow Viewport Reactivity | BUG-151 |
| CANVAS-group-resurrection-fix | Deleted Groups Reappearing | BUG-060, BUG-061 |

### When to Create SOPs
- After fixing production bugs
- When implementing complex system changes
- For rollback procedures
