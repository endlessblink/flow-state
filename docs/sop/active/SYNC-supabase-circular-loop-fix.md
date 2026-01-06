# SOP: Supabase Circular Sync Loop Fix

**Category**: SYNC
**Status**: Active Reference
**Last Updated**: January 6, 2026
**Related Task**: TASK-105

---

## Overview

This SOP documents the fix for a critical circular sync loop that occurred after migrating from PouchDB/CouchDB to Supabase. The loop caused the app to continuously remount and display corrupted/ghost projects.

---

## The Problem

### Symptoms
1. App continuously remounting (HMR updates in dev mode)
2. Canvas showing empty despite tasks loaded
3. Ghost/empty projects appearing in sidebar (no names, just bullet points)
4. Supabase 400 Bad Request errors on saveProjects
5. Console errors: "null value in column 'name' violates not-null constraint"

### Root Causes

**1. Invalid UUID Values Sent to Supabase**
```typescript
// BEFORE: String 'undefined' passed through as-is
parent_id: project.parentId || null  // 'undefined' is truthy!

// The schema expects UUID type, causing 400 errors
```

**2. Circular Sync Loop**
```
Realtime subscription fires
  → updateProjectFromSync() modifies _rawProjects
    → Deep watcher detects change
      → Auto-save triggered after 1s debounce
        → saveProjectsToStorage() writes to Supabase
          → Supabase emits UPDATE event
            → Realtime subscription fires again
              → INFINITE LOOP
```

**3. Corrupted Data from Incomplete Sync Payloads**
```typescript
// BEFORE: Spread without validation could create incomplete objects
const updateProjectFromSync = (projectId: string, data: any) => {
    const normalized = {
        ...data,  // If data has { name: null }, project is corrupted
        createdAt: new Date(data.createdAt || Date.now()),
        updatedAt: new Date(data.updatedAt || Date.now())
    }
    _rawProjects.value[index] = normalized  // Overwrites entire object!
}
```

---

## The Solution

### 1. UUID Sanitization in Mappers (`supabaseMappers.ts`)

```typescript
// Added validation helpers
const isValidUUID = (str: string | null | undefined): boolean => {
    if (!str) return false
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(str)
}

const sanitizeUUID = (value: string | null | undefined): string | null => {
    if (value === null || value === undefined) return null
    if (value === 'undefined' || value === 'null' || value === '') return null
    if (value === 'uncategorized' || value === '1') return null
    if (!isValidUUID(value)) {
        console.warn(`[SUPABASE-MAPPER] Invalid UUID: "${value}"`)
        return null
    }
    return value
}

// Used in toSupabaseProject, toSupabaseTask, toSupabaseGroup
```

### 2. Circular Loop Prevention (`projects.ts`)

```typescript
// Added flag to prevent watcher during sync updates
let syncUpdateInProgress = false

const updateProjectFromSync = (projectId: string, data: any) => {
    // CRITICAL: Validate incoming data
    if (!data.name || data.name.trim() === '') {
        console.warn(`[PROJECT-SYNC] Ignoring project with invalid name`)
        return
    }

    syncUpdateInProgress = true
    try {
        // ... update logic with validation ...
    } finally {
        setTimeout(() => { syncUpdateInProgress = false }, 100)
    }
}

// Watcher checks the flag
watch(projects, (newProjects) => {
    if (syncUpdateInProgress) return  // Break the loop!
    // ... save logic ...
}, { deep: true })
```

### 3. Corrupted Data Filtering (`projects.ts`)

```typescript
// Filter corrupted projects from display
const projects = computed(() => _rawProjects.value.filter(p => {
    if (!p.id) return false
    if (!p.name || typeof p.name !== 'string' || p.name.trim() === '') {
        console.warn(`[PROJECT-FILTER] Hiding project with invalid name:`, p.id)
        return false
    }
    return true
}))
```

---

## Verification Checklist

- [ ] App loads without continuous remounting
- [ ] No Supabase 400 errors in Network tab
- [ ] No ghost/empty projects in sidebar
- [ ] Canvas displays tasks with canvasPosition
- [ ] Realtime updates work without triggering saves
- [ ] `npm run build` passes

---

## Cleanup Commands

If corrupted data persists, run in browser console:

```javascript
// Option 1: Clear all local data
clearAllLocalData()
// Then refresh

// Option 2: Just clean corrupted projects
const store = window.__pinia?.state?.value?.projects
store?.cleanupCorruptedProjects?.()
```

---

## Related Files

| File | Changes |
|------|---------|
| `src/utils/supabaseMappers.ts` | UUID validation helpers, sanitization in mappers |
| `src/stores/projects.ts` | `syncUpdateInProgress` flag, data validation, filtering |
| `src/utils/supabaseMigrationCleanup.ts` | `clearAllLocalData()` helper |

---

## Prevention

To prevent similar issues in future sync implementations:

1. **Always validate incoming sync data** before merging into state
2. **Use flags to prevent circular saves** when updating from external sources
3. **Filter corrupted data at display layer** as a safety net
4. **Sanitize all foreign key values** before sending to database
5. **Test realtime subscriptions** with Network tab open to detect loops
