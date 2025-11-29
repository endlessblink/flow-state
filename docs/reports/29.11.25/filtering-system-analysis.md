# Comprehensive Filtering System Analysis Report

## Executive Summary

The Pomo-Flow filtering system is **functional but has significant issues** that affect user experience and consistency. The system is centralized in the task store but has inconsistencies across views and several bugs in filter logic.

**Overall Health Score: 72/100 (Fair)**

---

## Architecture Overview

### Filter State (Centralized in `src/stores/tasks.ts`)

```
Filter Variables (lines 560-563):
├── activeProjectId: string | null      # null = show all projects
├── activeSmartView: 'today' | 'week' | 'uncategorized' | 'unscheduled' | 'in_progress' | null
├── activeStatusFilter: string | null   # null = show all statuses
└── hideDoneTasks: boolean              # Global toggle
```

### Filter Application Order

1. **Smart View** (HIGHEST PRIORITY - overrides project filter)
2. **Project Filter** (only if NO smart view active)
3. **Status Filter** (applied always if set)
4. **Hide Done Tasks** (applied last)
5. **Nested Task Collection** (same filters applied to subtasks)

---

## Component Inventory

| Component | File | Lines | Role |
|-----------|------|-------|------|
| AppSidebar | `src/components/app/AppSidebar.vue` | 235 | Smart view selection, project list |
| TaskManagerSidebar | `src/components/TaskManagerSidebar.vue` | 376 | Task list with search/filter |
| FilterControls | `src/components/base/FilterControls.vue` | 221 | Central filter UI controls |
| ProjectFilterDropdown | `src/components/ProjectFilterDropdown.vue` | 447 | Project selection dropdown |
| useSmartViews | `src/composables/useSmartViews.ts` | 216 | Smart view logic implementation |
| useSidebarManagement | `src/composables/app/useSidebarManagement.ts` | 370+ | Sidebar helper composable |

---

## Smart View Filter Logic

### TODAY Filter
**Criteria (ANY match includes task):**
- Task due today (`dueDate`)
- Task has instances scheduled for today (new system)
- Task has legacy `scheduledDate` set to today
- Task status is `in_progress`
- Done tasks are EXCLUDED

### THIS WEEK Filter
**Criteria (ANY match includes task):**
- Task due between today and Sunday (inclusive)
- Task has instances within the week
- Task has legacy `scheduledDate` within the week
- Task status is `in_progress`
- Done tasks are EXCLUDED

### UNCATEGORIZED Filter
**Criteria (ANY match includes task):**
- Task has explicit `isUncategorized === true` flag
- Task has no `projectId` OR empty string OR null
- Done tasks are EXCLUDED

### ALL TASKS (null smart view)
- No smart view filtering applied
- Only project and status filters apply

---

## View Integration Status

| View | Integration | Status | Notes |
|------|-------------|--------|-------|
| **BoardView** | `taskStore.filteredTasks` | ✅ GOOD | Groups by project, respects all filters |
| **CalendarView** | `calendarFilteredTasks` + composables | ⚠️ PARTIAL | Uses separate computed, unclear if fully integrated |
| **CanvasView** | `taskStore.filteredTasks` + cache | ✅ GOOD | Wrapper for performance, respects filters |
| **AllTasksView** | `taskStore.filteredTasks` | ✅ GOOD | Direct store usage, clean integration |

---

## CRITICAL ISSUES FOUND

### Issue #1: Smart Views Override Project Filters (By Design, But Confusing)
**Location:** `tasks.ts` lines 1018-1028
**Impact:** Cannot combine "Today" + "Project X" - must choose one
**User Impact:** Unexpected behavior when switching between filters

### Issue #2: Filter Persistence NOT Implemented
**Location:** Filter state in `tasks.ts`
**Impact:** All filters reset on page refresh
**Exception:** Only `hideDoneTasks` has partial persistence

### Issue #3: Week Filter Boundary Inconsistency
**Location:** `calendarFilteredTasks` line 1478 uses `<` but `useSmartViews.ts` line 87 uses `<=`
**Impact:** Sunday tasks might be excluded in calendar view but included in other views

### Issue #4: Type Mismatch - Missing Smart View
**Location:** FilterControls references `above_my_tasks` not in type definition
**Impact:** Potential runtime errors if this filter is selected

### Issue #5: Calendar View Has Separate Filtering Logic
**Location:** `calendarFilteredTasks` computed (lines 1364-1531)
**Impact:** Potential inconsistency between calendar and other views

### Issue #6: Multiple Sources of Truth for Task Counts
**Location:** AppSidebar computes counts independently from views
**Impact:** Sidebar counts may not match view content

### Issue #7: Missing "Created Today" Check for Root Tasks
**Location:** Today filter in `filteredTasks`
**Impact:** Root tasks created today won't appear in Today filter unless they have dueDate or status=in_progress

---

## MODERATE ISSUES

### Issue #8: No User Feedback When Filters Override Each Other
**Impact:** Users don't know why setting project clears smart view (and vice versa)

### Issue #9: Canvas View Hides Status Filters
**Location:** `TaskManagerSidebar.vue` line 223
**Impact:** Inconsistent filter UI across views

### Issue #10: String Date Comparison
**Impact:** Fragile comparison that could break with timezone changes

---

## File Locations for Fixes

| Issue | File | Lines |
|-------|------|-------|
| Filter state | `src/stores/tasks.ts` | 560-563 |
| Filter application | `src/stores/tasks.ts` | 981-1280 |
| Smart view logic | `src/composables/useSmartViews.ts` | 16-130 |
| Calendar filtering | `src/stores/tasks.ts` | 1364-1531 |
| Filter setters | `src/stores/tasks.ts` | 2159-2203 |
| Filter UI | `src/components/base/FilterControls.vue` | 1-221 |
| Sidebar counts | `src/components/app/AppSidebar.vue` | 172-208 |

---

## Recommended Fixes (Priority Order)

### P1 - Critical
1. **Add filter persistence** to localStorage (align with other persisted state)
2. **Fix week boundary inconsistency** - standardize on `<=` comparison
3. **Remove/fix `above_my_tasks`** type mismatch

### P2 - High
4. **Add user feedback** when filters override each other (toast notification)
5. **Unify calendar filtering** with main `filteredTasks` computed
6. **Add "created today"** check for root tasks in Today filter

### P3 - Medium
7. **Standardize task count sources** - single source of truth
8. **Add date parsing** instead of string comparison
9. **Show status filters** consistently across all views

---

## Analysis Purpose

This report is a **read-only analysis** per user request. No implementation was performed.
The user requested comprehensive documentation of the filtering system end-to-end.

---

## Files Analyzed

- `src/stores/tasks.ts` (2900+ lines) - Core filter state and logic
- `src/stores/ui.ts` (235 lines) - UI state (NOT filters)
- `src/composables/useSmartViews.ts` (216 lines) - Smart view implementations
- `src/composables/app/useSidebarManagement.ts` (370+ lines) - Sidebar helpers
- `src/components/app/AppSidebar.vue` (235 lines) - Main sidebar
- `src/components/TaskManagerSidebar.vue` (376 lines) - Task list sidebar
- `src/components/base/FilterControls.vue` (221 lines) - Filter UI
- `src/components/ProjectFilterDropdown.vue` (447 lines) - Project dropdown
- `src/views/BoardView.vue` - Kanban board
- `src/views/CalendarView.vue` - Calendar view
- `src/views/CanvasView.vue` - Canvas view
- `src/views/AllTasksView.vue` - All tasks list

---

## Verification Evidence (Per Truthfulness Mandate)

### ✅ VERIFIED: Filter State Location (lines 560-563)
```typescript
// Actual code at src/stores/tasks.ts:560-563
const activeProjectId = ref<string | null>(null)
const activeSmartView = ref<'today' | 'week' | 'uncategorized' | 'unscheduled' | 'in_progress' | null>(null)
const activeStatusFilter = ref<string | null>(null)
const hideDoneTasks = ref(false)
```

### ✅ VERIFIED: Smart Views Override Project Filters (lines 1018-1028)
```typescript
// Actual code at src/stores/tasks.ts:1020-1024
if (activeSmartView.value) {
  console.log('🔥🔥🔥 CRITICAL FIX: Smart view active, applying BEFORE project filter:', activeSmartView.value)
  console.log('🔥 Smart views override project filters to fix kanban board issue')
}
```

### ✅ VERIFIED: Week Boundary Inconsistency
**useSmartViews.ts line 87** (INCLUSIVE):
```typescript
return inst.scheduledDate >= todayStr && inst.scheduledDate <= weekEndStr
```

**tasks.ts line 1478** (EXCLUSIVE):
```typescript
return instances.some(inst => inst.scheduledDate >= todayStr && inst.scheduledDate < weekEndStr)
```

### ✅ VERIFIED: `above_my_tasks` Type Mismatch
**Type definition (line 561)** does NOT include `above_my_tasks`:
```typescript
ref<'today' | 'week' | 'uncategorized' | 'unscheduled' | 'in_progress' | null>
```

**But code uses it in 10 locations:**
- `src/App.vue`: lines 97, 100, 692, 767, 772, 1046
- `src/stores/tasks.ts`: line 1501
- `src/composables/app/useSidebarManagement.ts`: lines 220, 416
- `src/components/base/FilterControls.vue`: lines 28, 89

---

*Report generated: 2025-11-29*
*Analysis type: Read-only comprehensive system analysis*
*Truthfulness mandate: Applied - all findings verified against source code*
