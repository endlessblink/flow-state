# SOP: System Consolidation Guide

**Category**: SYNC
**Status**: Active Reference
**Last Updated**: January 2026
**Merged From**: competing-systems-consolidation-2025-12-03, duplicate-systems-consolidation-2025-12-25

---

## Overview

Standard operating procedure for detecting, analyzing, and consolidating duplicate/competing system implementations. This prevents race conditions, reduces maintenance burden, and clarifies which utilities to use.

---

## 1. The Current "New World"

**Following consolidation efforts, these are the PRIMARY systems to use:**

| Area | Primary System | Location | Replaces |
|------|----------------|----------|----------|
| **Conflict Management** | `ConflictResolver` | `src/utils/conflictResolver.ts` | conflictResolution.ts |
| **Backup System** | `useBackupSystem` | `src/composables/useBackupSystem.ts` | localBackupManager.ts |
| **Sync Management** | `useReliableSyncManager` | `src/composables/useReliableSyncManager.ts` | unifiedSyncQueue.ts, syncCircuitBreaker.ts |
| **Offline Storage** | `OfflineQueue` | `src/utils/offlineQueue.ts` | unifiedSyncQueue.ts |

---

## 2. Detection Phase

### Manual Detection Checklist

1. **Search for duplicate implementations**:
   ```bash
   # Find all backup-related files
   find src/composables -name "*backup*" -o -name "*Backup*"
   find src/utils -name "*backup*" -o -name "*Backup*"

   # Find all sync-related files
   find src -name "*sync*" -o -name "*Sync*"
   ```

2. **Check actual usage**:
   ```bash
   # Search for imports
   grep -r "from.*useBackupManager" src/
   grep -r "from.*useBackupSystem" src/
   ```

3. **Assess severity**:

   | Severity | Condition | Risk |
   |----------|-----------|------|
   | HIGH | Multiple active implementations | Race conditions |
   | MEDIUM | Redundant code with partial overlap | Maintenance burden |
   | LOW | Dead code (imported nowhere) | Safe to remove |

---

## 3. Analysis Phase

### For Each Competing System

1. **Identify all files involved**
2. **Check git history for context**:
   ```bash
   git log --oneline -- path/to/file.ts
   ```
3. **Determine which implementation to keep**:
   - Most complete feature set
   - Best TypeScript types
   - Active maintenance/usage

---

## 4. Consolidation Phase

### Safe Deletion Process

```bash
# 1. Verify file is unused
grep -r "filename" src/ --include="*.ts" --include="*.vue"

# 2. Delete and verify build
rm path/to/unused-file.ts
npx vue-tsc --noEmit

# 3. If build fails, restore
git checkout -- path/to/unused-file.ts
```

### Migration Process (if file is used)

1. Update imports in consuming files
2. Ensure API compatibility
3. Run TypeScript check after each change
4. Test functionality

---

## 5. Testing Phase

### Pre-Testing Checklist

- [ ] TypeScript build passes (`npx vue-tsc --noEmit`)
- [ ] No import errors in console
- [ ] Dev server starts without errors

### Race Condition Testing

**Key indicators to check:**

| Log Pattern | Meaning | Status |
|-------------|---------|--------|
| `Skipping - already in progress` | Race guard working | Good |
| `Filtered X mock tasks from Y` | Data filtering working | Good |
| `Checksum mismatch` | Data integrity warning | Investigate |
| Duplicate operations in console | Race condition | Fix required |

### Functional Testing

```bash
# Start dev server
PORT=5546 npm run dev

# Test with Playwright MCP:
# 1. Navigate to feature location
# 2. Trigger the functionality
# 3. Verify expected behavior
# 4. Check console for errors
```

---

## 6. Historical Consolidation Results

### Backup System (Dec 2025)

**Deleted** (1,705 lines removed):
- `useBackupManager.ts` (345 lines)
- `useSimpleBackup.ts` (292 lines)
- `useAutoBackup.ts` (238 lines)
- `useBackupRestoration.ts` (575 lines)
- `RobustBackupSystem.ts` (255 lines)

**Kept**: `useBackupSystem.ts` (unified implementation)

### Sync System (Dec 2025)

**Deleted**:
- `conflictResolution.ts` → merged into `conflictResolver.ts`
- `localBackupManager.ts` → replaced by `useBackupSystem.ts`
- `unifiedSyncQueue.ts` → replaced by `offlineQueue.ts`
- `syncCircuitBreaker.ts` → integrated into `useReliableSyncManager.ts`
- `databaseTypes.ts` → merged into `global.d.ts`

### Virtual List (Dec 2025)

**Deleted** (348 lines):
- `useVirtualList.ts` (dead code)

**Kept**: `useVirtualScrolling.ts` (VueUse wrapper)

---

## 7. Common 404 Errors After Consolidation

If you see 404 errors for deleted files:

### `localBackupManager.ts` Not Found

Check these files for stale imports:
- `src/composables/useDatabase.ts`
- `src/composables/useReliableSyncManager.ts`

Ensure they import from `useBackupSystem` instead.

### `IBackupDataSource` Not Found

This type was removed. Update to use the interface from `useBackupSystem.ts`.

---

## 8. Verification Checklist

After any consolidation:

- [ ] **Sync Test Suite**: Run `src/utils/syncTestSuite.ts`
- [ ] **App Load**: No 404 errors in Network tab
- [ ] **Manual Backup**: Settings → Backup → Create Backup works
- [ ] **Conflict Test**: Edit same task in two tabs → conflict resolved

---

## 9. Prevention Guidelines

### When Adding New Utilities

1. **Check for existing implementations first**
   ```bash
   grep -r "backup" src/composables/
   grep -r "sync" src/composables/
   ```

2. **Extend existing systems** rather than creating new ones

3. **Document the "why"** in code comments if creating something new

### When Reviewing Code

- Flag duplicate functionality in PRs
- Require justification for new utility files
- Enforce single source of truth principle

---

## 10. Quick Reference Commands

```bash
# TypeScript check
NODE_OPTIONS="--max-old-space-size=1024" npx vue-tsc --noEmit

# Find unused exports
grep -r "export" src/composables/*.ts | grep -v "import"

# Check file usage
grep -rn "from.*filename" src/

# Start dev server
PORT=5546 npm run dev

# Kill dev server
npm run kill
```

---

**Key Insight**: Multiple implementations of the same functionality cause race conditions and confusion. Always consolidate to a single source of truth before issues compound.
