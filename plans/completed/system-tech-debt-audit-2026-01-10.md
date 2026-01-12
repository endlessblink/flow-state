# TASK-176: Comprehensive System Tech Debt Audit

**Date**: January 10, 2026
**Status**: COMPLETE
**Context**: Following the Canvas system rebuild decision (TASK-175), this audit identifies other systems needing attention before they become critical.

---

## Executive Summary

| System | Health Score | LOC | Recommendation | Priority |
|--------|-------------|-----|----------------|----------|
| **Canvas** | 3/10 | 5,151 | **REBUILD** (In Progress) | P0 |
| **Board View** | 4.5/10 | 3,500+ | **REFACTOR** | P1 |
| **Calendar View** | 5.5/10 | 4,200+ | **REFACTOR** | P1 |
| **Timer/Pomodoro** | 6.5/10 | 2,503 | REFACTOR (Focused) | P2 |
| **Authentication** | 6.5/10 | 2,363 | REFACTOR (UserProfile) | P2 |
| **Supabase Sync** | 7.2/10 | 1,800+ | MAINTAIN (Split Later) | P3 |
| **Projects** | 7.2/10 | 1,800+ | MAINTAIN | P3 |
| **Settings** | 5.8/10 | 1,883 | **REFACTOR** | P2 |

**Key Finding**: Board View and Calendar View exhibit similar patterns to Canvas (god objects, deep watchers, excessive defensive code) and should be prioritized for refactoring to prevent future crises.

---

## System Health Scores Visual

```
REBUILD ZONE          REFACTOR ZONE           MAINTAIN ZONE
    |                      |                       |
    1    2    3    4    5    6    7    8    9    10
    |----|----|----|----|----|----|----|----|----|

    [CANVAS 3.0]
              [BOARD 4.5]
                   [CALENDAR 5.5]
                   [SETTINGS 5.8]
                        [TIMER 6.5]
                        [AUTH 6.5]
                              [SUPABASE 7.2]
                              [PROJECTS 7.2]
```

---

## 1. Board View System Audit

### Health Score: 4.5/10

**Total LOC**: ~3,500 across 5 files

| File | LOC | Score | Critical Issues |
|------|-----|-------|-----------------|
| BoardView.vue | 835 | 4/10 | God object, 10 try-catch, 40 console.log |
| tasks.ts | 263 | 5/10 | Circular dependency risk, complex sync |
| KanbanSwimlane.vue | 798 | 4.5/10 | 6-level nesting, ineffective cache |
| KanbanColumn.vue | 387 | 5.5/10 | Duplicate local state pattern |
| TaskCard.vue | 1,217 | 5/10 | 740 lines CSS, 7 inline badge types |

### Key Metrics

| Metric | Count | Concern Level |
|--------|-------|---------------|
| Watchers | 7 | HIGH (2 deep) |
| TASK/BUG comments | 8 | MEDIUM |
| Try-catch blocks | 13 | HIGH |
| Console.log | 60+ | HIGH |
| Defensive guards | 30+ | HIGH |

### Critical Issues

1. **God Object Pattern** - `BoardView.vue:835` lines handles filters, modals, context menus, settings, CRUD
2. **Deep Watchers** - `BoardView.vue:182-190` - deep watch on `filteredTasks` and `projects`
3. **Dual State Management** - Kanban settings in localStorage AND Supabase (race conditions)
4. **Triple State Copying** - Tasks copied to localTasks in BoardView, Swimlane, AND Column
5. **1,217-line TaskCard** - 61% is CSS, 7 inline badge types should be extracted

### Immediate Risks

- Performance degradation with large task lists (deep watchers fire on every change)
- Settings sync conflicts between localStorage and Supabase
- Maintenance nightmare with duplicated local state

### Recommendations

**Phase 1 (Critical)**:
- [ ] Reduce BoardView.vue from 835 to <300 lines - extract modal/menu logic
- [ ] Replace deep watchers with specific field watches
- [ ] Consolidate Kanban settings to single source (Supabase or localStorage)

**Phase 2 (High)**:
- [ ] Extract TaskCard badges to `<TaskMetadataBadges />` component
- [ ] Remove localTasks duplication pattern across components
- [ ] Implement systematic error handling (remove scattered try-catch)

---

## 2. Calendar View System Audit

### Health Score: 5.5/10

**Total LOC**: ~4,200 across 9 files

| File | LOC | Score | Critical Issues |
|------|-----|-------|-----------------|
| CalendarView.vue | 660 | 4/10 | 11 composables, memory leaks |
| useCalendarDayView.ts | 949 | 5/10 | Triple-nested try-catch, race conditions |
| useCalendarWeekView.ts | 408 | 6/10 | Duplicated overlap calculation |
| useCalendarMonthView.ts | 137 | 7/10 | Minor type issues |
| Calendar Components | 1,600 | 6/10 | Props explosion (30+ props) |

### Key Metrics

| Metric | Count | Concern Level |
|--------|-------|---------------|
| Watchers | 2 | MEDIUM |
| Console.log | 58 | HIGH |
| Memory leak risks | 2 | HIGH |
| Race conditions | 1 | HIGH |
| Dead code | 8 functions | MEDIUM |

### Critical Issues

1. **Memory Leak** - `CalendarView.vue:516-545` - Arrow functions in addEventListener can't be removed
2. **Race Condition** - `useCalendarDayView.ts:505-536` - Triple update mechanism for same data
3. **God Object** - CalendarView orchestrates 11 composables + 3 stores
4. **Props Explosion** - CalendarDayView receives 30+ props including 15+ methods
5. **Duplicated Logic** - Overlap position calculation in both dayView and weekView (68 lines each)

### Immediate Risks

- Memory leaks on view navigation (event listeners not cleaned up)
- Position drift from race conditions in drag-drop
- Performance issues from 47 console.log calls in useCalendarDayView

### Recommendations

**Phase 1 (Critical)**:
- [ ] Fix memory leak - refactor event listeners to use named functions
- [ ] Consolidate overlapping position calculation to shared utility
- [ ] Fix race condition - single update mechanism for drag-drop

**Phase 2 (High)**:
- [ ] Reduce props by moving logic INTO calendar components
- [ ] Remove 8 unused functions from CalendarView.vue
- [ ] Replace magic numbers with constants

---

## 3. Timer/Pomodoro System Audit

### Health Score: 6.5/10

**Total LOC**: 2,503 across 4 files

| File | LOC | Score | Critical Issues |
|------|-----|-------|-----------------|
| timer.ts | 466 | 7/10 | Deep watcher fires 60x/min |
| useCrossTabSync.ts | 1,109 | 5/10 | God object - 3 concerns mixed |
| SettingsModal.vue | 690 | 6/10 | Timer settings embedded |
| FaviconManager.vue | 238 | 8/10 | Clean, focused |

### Key Metrics

| Metric | Count | Concern Level |
|--------|-------|---------------|
| Watchers | 2 (deep) | HIGH |
| setInterval instances | 5 | MEDIUM |
| Duplicate countdown logic | 3 locations | MEDIUM |
| `any` type usage | 2 | HIGH |

### Critical Issues

1. **Deep Watcher Performance** - `timer.ts:418-421` - Fires on every `remainingTime` decrement (60x/min) triggering Supabase writes
2. **Monolithic Sync Composable** - `useCrossTabSync.ts:1,109` lines mixes 3 concerns:
   - Cross-browser-tab communication
   - Cross-device synchronization
   - Timer session coordination
3. **Duplicate Timer Loop** - Same countdown logic at lines 297-304, 434-439, 160-164
4. **Store in Computed** - `timer.ts:90-98, 110-118` - useTaskStore() called inside computed properties

### Recommendations

**Phase 1 (High)**:
- [ ] Change deep watcher to shallow watch on specific fields
- [ ] Extract timer countdown to single reusable function
- [ ] Remove webkit audio context fallback (outdated)

**Phase 2 (Medium)**:
- [ ] Split useCrossTabSync.ts into 3 composables:
  - `useTimerLeaderElection.ts`
  - `useBroadcastChannelSync.ts`
  - `useSupabaseRealtimeSync.ts`
- [ ] Add proper types for Supabase payloads (remove `any`)

---

## 4. Authentication System Audit

### Health Score: 6.5/10

**Total LOC**: 2,363 across 8 files

| File | LOC | Score | Critical Issues |
|------|-----|-------|-----------------|
| auth.ts | 296 | 6/10 | Circular import workaround, BUG-012 |
| UserProfile.vue | 396 | 5/10 | "NUCLEAR OPTION" comments, 13 console.log |
| SignupForm.vue | 527 | 7/10 | Duplicate validation |
| LoginForm.vue | 408 | 7.5/10 | Weak email regex |
| Other components | ~736 | 7.5/10 | Minor issues |

### Key Metrics

| Metric | Count | Concern Level |
|--------|-------|---------------|
| Console.log | 13 (UserProfile) | HIGH |
| Type assertions `as any` | 1 | HIGH |
| Duplicate validation | 3 files | MEDIUM |
| !important CSS | 3 | MEDIUM |

### Critical Issues

1. **UserProfile.vue "NUCLEAR OPTION"** - Direct DOM manipulation, z-index 99999, !important everywhere
2. **Type Erasure** - `supabase.ts:17` - `export const supabase = supabaseClient as any`
3. **Circular Dependency** - `auth.ts:88` - Dynamic import of useTaskStore
4. **Duplicate Validation** - Same email regex in LoginForm, SignupForm, ResetPassword

### Recommendations

**Phase 1 (Critical)**:
- [ ] Refactor UserProfile.vue dropdown - remove direct DOM manipulation
- [ ] Remove `as any` type erasure in supabase.ts
- [ ] Extract email/password validation to shared utility

**Phase 2 (Medium)**:
- [ ] Resolve circular auth/tasks dependency with events
- [ ] Remove 13 console.log from UserProfile.vue

---

## 5. Supabase Sync Layer Audit

### Health Score: 7.2/10

**Total LOC**: ~1,800 across 4 files

| File | LOC | Score | Critical Issues |
|------|-----|-------|-----------------|
| useSupabaseDatabaseV2.ts | 920 | 6.5/10 | God object, 38 console.log |
| supabaseMappers.ts | 576 | 7/10 | Some `any` types |
| auth.ts (store) | 295 | 7/10 | Already covered above |
| supabase.ts | 20 | 8/10 | Minimal, clean |

### Key Metrics

| Metric | Count | Concern Level |
|--------|-------|---------------|
| Try-catch blocks | 32 | MEDIUM (defensive) |
| Console.log | 38 | HIGH |
| isSyncing flag assignments | 26 | MEDIUM |
| `any` type usage | 8 | MEDIUM |

### Critical Issues

1. **Monolithic Composable** - `useSupabaseDatabaseV2.ts:920` lines handles ALL CRUD for 7 domains
2. **Shared State Flag** - Single `isSyncing` ref for 40+ async operations
3. **RLS Detection Workaround** - TASK-142/BUG-171 fixes added verification logic

### Recommendations

**Phase 1 (Low Priority)**:
- [ ] Remove 38 debug console.log statements
- [ ] Create shared RLS detection helper (duplicated in 3 functions)

**Phase 2 (Future)**:
- [ ] Split into domain composables:
  - `useSupabaseProjects.ts`
  - `useSupabaseTasks.ts`
  - `useSupabaseGroups.ts`
  - `useSupabaseTimers.ts`

---

## 6. Projects System Audit

### Health Score: 7.2/10

**Total LOC**: ~1,800 across 5 files

| File | LOC | Score | Critical Issues |
|------|-----|-------|-----------------|
| projects.ts | 492 | 6.5/10 | 7x `as any`, manual flags |
| ProjectModal.vue | 362 | 7.1/10 | Recursive in computed |
| ProjectFilterDropdown.vue | 447 | 8.2/10 | Clean |
| ProjectDropZone.vue | 278 | 8/10 | Hardcoded colors |
| ProjectTreeItem.vue | 227 | 7.8/10 | Duplicate logic |

### Key Metrics

| Metric | Count | Concern Level |
|--------|-------|---------------|
| `as any` casts | 7 | HIGH |
| Manual operation flags | 3 | MEDIUM |
| Deep watcher | 1 | MEDIUM |

### Critical Issues

1. **Type Safety Violation** - `projects.ts:138-139` - `useTaskStore() as any` and access to private `_rawTasks`
2. **Manual Operation Flags** - Workaround for circular sync logic
3. **Recursive in Computed** - `ProjectModal.vue:155` - Tree building with O(n^2) risk

### Recommendations

- [ ] Remove `as any` casts, create proper inter-store interface
- [ ] Extract recursive tree logic to store with caching
- [ ] Move hardcoded colors to design tokens

---

## 7. Settings System Audit

### Health Score: 5.8/10

**Total LOC**: 1,883 across 4 files

| File | LOC | Score | Critical Issues |
|------|-----|-------|-----------------|
| timer.ts | 466 | (covered above) | Deep watcher |
| ui.ts | 340 | 6.2/10 | Broken i18n |
| SettingsModal.vue | 690 | 5.3/10 | Direct localStorage |
| LanguageSettings.vue | 387 | 6.8/10 | Unused imports |

### Critical Issues

1. **Broken i18n** - `ui.ts:4, 21-30` - RTL/direction disabled with hardcoded fallbacks
2. **Mixed Persistence** - Settings in timer store (Supabase) AND SettingsModal (localStorage)
3. **Direct localStorage** - `SettingsModal.vue:285-336` bypasses store pattern
4. **Deep Watcher** - `timer.ts:418` fires on every timer tick

### Recommendations

**Phase 1 (Critical)**:
- [ ] Fix i18n - restore direction setting functionality
- [ ] Consolidate settings persistence to single source

**Phase 2 (Medium)**:
- [ ] Split SettingsModal into tab components
- [ ] Add debouncing to settings watcher

---

## Priority Ranking

### Tier 1: Critical (P0-P1) - Immediate Action

| Rank | System | Score | Action | Est. Effort |
|------|--------|-------|--------|-------------|
| 1 | **Canvas** | 3.0 | REBUILD | 40 hours (in progress) |
| 2 | **Board View** | 4.5 | REFACTOR | 24-32 hours |
| 3 | **Calendar View** | 5.5 | REFACTOR | 16-24 hours |

### Tier 2: High Priority (P1-P2)

| Rank | System | Score | Action | Est. Effort |
|------|--------|-------|--------|-------------|
| 4 | **Settings** | 5.8 | REFACTOR (i18n fix) | 8-12 hours |
| 5 | **Authentication** | 6.5 | REFACTOR (UserProfile) | 4-8 hours |
| 6 | **Timer** | 6.5 | REFACTOR (watchers) | 8-12 hours |

### Tier 3: Maintain (P2-P3)

| Rank | System | Score | Action | Est. Effort |
|------|--------|-------|--------|-------------|
| 7 | **Supabase Sync** | 7.2 | MAINTAIN | 4 hours (cleanup) |
| 8 | **Projects** | 7.2 | MAINTAIN | 4 hours (type fixes) |

---

## Dependency Map

```
┌──────────────────────────────────────────────────────────────┐
│                    CORE DEPENDENCIES                          │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐    │
│  │   AUTH      │────▶│   TASKS     │◀────│  PROJECTS   │    │
│  │  Store      │     │   Store     │     │   Store     │    │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘    │
│         │                   │                   │            │
│         │            ┌──────┴──────┐           │            │
│         │            ▼             ▼           │            │
│         │     ┌──────────┐   ┌──────────┐     │            │
│         │     │  BOARD   │   │  CANVAS  │◀────┘            │
│         │     │  View    │   │  View    │                  │
│         │     └──────────┘   └──────────┘                  │
│         │                                                   │
│         │     ┌──────────┐   ┌──────────┐                  │
│         └────▶│ CALENDAR │   │  TIMER   │◀── useCrossTab   │
│               │  View    │   │  Store   │                  │
│               └──────────┘   └──────────┘                  │
│                                   │                         │
│                                   ▼                         │
│                            ┌──────────┐                    │
│                            │ SETTINGS │                    │
│                            │  Modal   │                    │
│                            └──────────┘                    │
│                                                             │
└──────────────────────────────────────────────────────────────┘

SHARED DEPENDENCIES:
├── useSupabaseDatabaseV2.ts (ALL stores)
├── supabaseMappers.ts (sync layer)
└── ui.ts (ALL views)

CIRCULAR RISKS:
├── auth.ts ←→ tasks.ts (dynamic import workaround)
├── projects.ts → tasks.ts (as any cast)
└── timer.ts → tasks.ts (inside computed)
```

---

## Safe vs Risky Refactoring

### Safe to Refactor (Low Risk)

| System | Reason |
|--------|--------|
| **Projects Components** | Well-isolated, clear boundaries |
| **Supabase Mappers** | Pure functions, no side effects |
| **FaviconManager** | Self-contained, no external deps |
| **Auth Components** (except UserProfile) | Clear interfaces |

### Careful Planning Required (Medium Risk)

| System | Reason |
|--------|--------|
| **Timer Watchers** | Affects real-time updates, multi-device sync |
| **Settings Persistence** | Multiple storage locations, migration needed |
| **Calendar Composables** | Shared state between day/week/month views |
| **Board localTasks** | Affects drag-drop functionality |

### Requires Full Rebuild (High Risk)

| System | Reason |
|--------|--------|
| **Canvas** | Architecture fundamentally broken (in progress) |
| **useCrossTabSync** | Mixed concerns, 1,109 lines |
| **UserProfile Dropdown** | DOM manipulation + CSS hacks |

---

## Anti-Pattern Summary

| Anti-Pattern | Occurrences | Most Affected |
|--------------|-------------|---------------|
| **God Object** | 5 | BoardView, CalendarView, useCrossTabSync, useSupabaseDB |
| **Deep Watchers** | 6 | Board, Calendar, Timer, Projects |
| **Duplicate State** | 4 | Board (localTasks x3), Settings (localStorage + Supabase) |
| **Type Erasure (`as any`)** | 16+ | Projects, Timer, Supabase |
| **Excessive Logging** | 150+ | Calendar (58), Board (60), Timer, Settings |
| **Memory Leaks** | 2 | Calendar event listeners, CrossTabSync |
| **Circular Dependencies** | 3 | auth↔tasks, projects→tasks, timer→tasks |

---

## Quick Wins (< 4 hours each)

1. [ ] Remove 150+ console.log statements across codebase
2. [ ] Change deep watchers to shallow in timer.ts
3. [ ] Extract email validation to shared utility
4. [ ] Remove `as any` from supabase.ts
5. [ ] Fix i18n hardcoded fallbacks in ui.ts
6. [ ] Extract TaskCard badges to component
7. [ ] Remove unused functions from CalendarView (8 functions)
8. [ ] Consolidate UUID validation (3 duplicate functions)

---

## Conclusion

The audit reveals a pattern: **systems start clean, accumulate defensive code and workarounds, then become unmaintainable**. The Canvas system (3.0 health) is the most extreme case, but Board View (4.5) and Calendar View (5.5) are following the same trajectory.

**Recommended Strategy**:
1. Complete Canvas rebuild (TASK-175) to establish new patterns
2. Apply lessons learned to Board View refactoring
3. Use Board View patterns for Calendar View
4. Incrementally address Timer, Auth, and Settings

This proactive approach prevents future "emergency rebuilds" like Canvas.

---

---

## Deepened Research: Best Practices & Patterns

### A. Vue 3 God Object Refactoring Patterns

**Target**: BoardView.vue (835 lines) and CalendarView.vue (660 lines)

**Recommended Composables to Extract for BoardView**:
```
src/composables/board/
  useBoardModals.ts         # Edit modal, quick create modal, confirm modal
  useBoardContextMenu.ts    # Context menu state and handlers
  useBoardSettings.ts       # Kanban settings persistence
  useBoardTaskGroups.ts     # Project grouping, task-by-project computed
  useBoardContext.ts        # Provide/inject for prop drilling elimination
```

**Key Pattern: Provide/Inject for Prop Drilling**
```typescript
// Create BoardContext for deep component access
export const BOARD_CONTEXT_KEY: InjectionKey<BoardContext> = Symbol('board-context')

export function provideBoardContext(context: BoardContext) {
  provide(BOARD_CONTEXT_KEY, context)
}

// In child components - no props needed
const { onSelectTask, onEditTask } = useBoardContext()
```

**Target Result**: BoardView.vue from 835 lines to ~200 lines

---

### B. Watcher Optimization Patterns

**Problem**: Deep watchers fire excessively (60x/min in timer.ts)

**Solutions Using VueUse**:

| Current | Optimized |
|---------|-----------|
| `watch(settings, ..., { deep: true })` | `watchDebounced(settings, ..., { debounce: 1000 })` |
| `watch(currentSession, ...)` | `watchThrottled(() => currentSession.value?.remainingTime, ..., { throttle: 5000 })` |
| Debug watchers in production | Wrap in `if (import.meta.env.DEV)` |

**Specific Fix for timer.ts:418-421**:
```typescript
import { watchDebounced, watchThrottled } from '@vueuse/core'

// Watch state changes immediately
watch(
  () => [currentSession.value?.isActive, currentSession.value?.isPaused],
  () => { if (isDeviceLeader.value) saveTimerSessionWithLeadership() }
)

// Throttle remainingTime updates to every 5 seconds
watchThrottled(
  () => currentSession.value?.remainingTime,
  () => { if (isDeviceLeader.value) saveTimerSessionWithLeadership() },
  { throttle: 5000 }
)
```

---

### C. Memory Leak Prevention Patterns

**Problem**: CalendarView.vue:514-519 uses arrow functions that can't be removed

**Solution 1: Named Function References**
```typescript
let dragEnterHandler: ((e: Event) => void) | null = null

onMounted(() => {
  dragEnterHandler = (e: Event) => handleDragEnterCapture(e as DragEvent)
  calendarEl.addEventListener('dragenter', dragEnterHandler, true)
})

onUnmounted(() => {
  if (dragEnterHandler) calendarEl.removeEventListener('dragenter', dragEnterHandler, true)
  dragEnterHandler = null
})
```

**Solution 2: AbortController (Modern)**
```typescript
let abortController: AbortController | null = null

onMounted(() => {
  abortController = new AbortController()
  const { signal } = abortController

  calendarEl.addEventListener('dragenter',
    (e) => handleDragEnterCapture(e as DragEvent),
    { capture: true, signal }
  )
})

onUnmounted(() => {
  abortController?.abort() // Removes ALL listeners at once
})
```

**Supabase Realtime Cleanup**:
```typescript
// CRITICAL: Use removeChannel to properly dispose
onUnmounted(async () => {
  if (realtimeChannel.value) {
    await supabase.removeChannel(realtimeChannel.value)
  }
})
```

---

### D. Type Safety Patterns (Eliminating `as any`)

**Pattern 1: Store Interface for Cross-Store Access**
```typescript
// types/store-interfaces.ts
export interface ITaskStorePublic {
  readonly _rawTasks: Ref<Task[]>
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>
}

// In projects.ts - type assertion to interface, NOT any
const taskStore = useTaskStore() as unknown as ITaskStorePublic
```

**Pattern 2: Supabase Realtime Payload Types**
```typescript
// Generate types: npx supabase gen types typescript > src/types/database.types.ts

import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
type TimerSessionRow = Database['public']['Tables']['timer_sessions']['Row']
type TimerSessionPayload = RealtimePostgresChangesPayload<TimerSessionRow>

// Now fully typed
const handleRemoteTimerUpdate = async (payload: TimerSessionPayload) => {
  const newDoc = payload.new // Typed as TimerSessionRow
}
```

**Pattern 3: Nullable Supabase Client**
```typescript
// supabase.ts - FIXED
export const supabase: SupabaseClient<Database> | null = supabaseClient

export function assertSupabase(): SupabaseClient<Database> {
  if (!supabase) throw new Error('Supabase not initialized')
  return supabase
}
```

---

## Implementation Roadmap

### Week 1: Quick Wins (8-12 hours)
- [ ] Remove 150+ console.log statements
- [ ] Replace deep watchers with throttled/debounced versions in timer.ts
- [ ] Fix CalendarView.vue memory leaks (event listeners)
- [ ] Generate Supabase types and fix `payload: any`

### Week 2: Board View Refactor (24-32 hours)
- [ ] Extract useBoardModals.ts
- [ ] Extract useBoardSettings.ts
- [ ] Extract useBoardContextMenu.ts
- [ ] Implement BoardContext provide/inject
- [ ] Reduce BoardView.vue to ~200 lines

### Week 3: Calendar View Refactor (16-24 hours)
- [ ] Fix memory leaks with AbortController
- [ ] Reduce props explosion with provide/inject
- [ ] Remove unused functions (8 identified)
- [ ] Consolidate overlapping position calculation

### Week 4: Type Safety & Settings (12-16 hours)
- [ ] Create store interfaces for cross-store access
- [ ] Remove all `as any` casts
- [ ] Fix Settings i18n
- [ ] Consolidate settings persistence

---

## References

- Canvas Rebuild: `docs/MASTER_PLAN.md#task-175-canvas-system-rebuild`
- Previous Audit: `plans/system-consolidation-audit.md`
- CLAUDE.md Architecture Rules: `/CLAUDE.md`

### Research Sources
- [Vue.js Composables Guide](https://vuejs.org/guide/reusability/composables.html)
- [VueUse watchDebounced](https://vueuse.org/shared/watchDebounced/)
- [VueUse watchThrottled](https://vueuse.org/shared/watchThrottled/)
- [Vue Memory Leak Prevention](https://vuejs.org/guide/reusability/composables)
- [Supabase TypeScript Support](https://supabase.com/docs/reference/javascript/typescript-support)
- [Pinia Composing Stores](https://pinia.vuejs.org/cookbook/composing-stores.html)
- [AbortController MDN](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
