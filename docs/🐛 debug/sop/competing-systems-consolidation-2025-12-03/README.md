# SOP: Competing Systems Consolidation Testing

**Date**: 2025-12-03
**Status**: Completed
**Commits**: `dc1c2f4`, `9699c9b`

## Overview

Standard Operating Procedure for detecting and consolidating competing/duplicate system implementations in the codebase, with emphasis on testing for race conditions and system conflicts.

## 1. Detection Phase

### Run the Conflict Detection Skill

```bash
# Use the detect-competing-systems skill
# Located at: .claude/skills/🔍-detect-competing-systems/
```

### Manual Detection Checklist

1. **Search for duplicate implementations**:
   - Multiple files with similar names (e.g., `useBackup*.ts`)
   - Different implementations of same functionality
   - Dead code (imported nowhere)

2. **Analyze severity**:
   - **HIGH**: Multiple active implementations (race conditions possible)
   - **MEDIUM**: Redundant code with partial overlap
   - **LOW**: Dead code (unused, safe to remove)

## 2. Analysis Phase

### For Each Competing System

1. **Identify all files involved**:
   ```bash
   # Example: Find all backup-related composables
   find src/composables -name "*backup*" -o -name "*Backup*"
   ```

2. **Check actual usage**:
   ```bash
   # Search for imports across codebase
   grep -r "from.*useBackupManager" src/
   grep -r "from.*useSimpleBackup" src/
   ```

3. **Determine which implementation to keep**:
   - Most complete feature set
   - Best TypeScript types
   - Active maintenance/usage

## 3. Consolidation Phase

### Safe Deletion Process

1. **Verify file is unused**:
   ```bash
   grep -r "filename" src/ --include="*.ts" --include="*.vue"
   ```

2. **Check git history for context**:
   ```bash
   git log --oneline -- path/to/file.ts
   ```

3. **Delete and verify build**:
   ```bash
   rm path/to/unused-file.ts
   npx vue-tsc --noEmit
   ```

### Migration Process (if file is used)

1. Update imports in consuming files
2. Ensure API compatibility
3. Run TypeScript check after each change

## 4. Testing Phase - CRITICAL

### Pre-Testing Checklist

- [ ] TypeScript build passes (`npx vue-tsc --noEmit`)
- [ ] No import errors in console
- [ ] Dev server starts without errors

### Functional Testing with Playwright

```bash
# Start dev server
PORT=5546 npm run dev

# Use Playwright MCP to test
# 1. Navigate to feature location
# 2. Trigger the functionality
# 3. Verify expected behavior
# 4. Check console for errors
```

### Race Condition Testing

**Key indicators to check**:

1. **Concurrent operation guards**:
   ```
   [Backup] Skipping - backup already in progress
   ```

2. **No duplicate operations** in console logs

3. **State consistency** after operations complete

### What to Look For in Console

| Log Pattern | Meaning | Action |
|-------------|---------|--------|
| `Skipping - already in progress` | Race guard working | Good |
| `Filtered X mock tasks from Y` | Data filtering working | Good |
| `Checksum mismatch` | Data integrity warning | Investigate |
| `Cannot read properties of null` | Null reference error | Fix required |

## 5. Results Documentation

### This Session Results

**Backup System Consolidation**:
- Deleted: `useBackupManager.ts` (345 lines)
- Deleted: `useSimpleBackup.ts` (292 lines)
- Deleted: `useAutoBackup.ts` (238 lines)
- Deleted: `useBackupRestoration.ts` (575 lines)
- Deleted: `RobustBackupSystem.ts` (255 lines)
- **Kept**: `useBackupSystem.ts` (unified implementation)
- **Total removed**: 1,705 lines

**Virtual List Consolidation**:
- Deleted: `useVirtualList.ts` (348 lines) - dead code
- **Kept**: `useVirtualScrolling.ts` (VueUse wrapper)
- **Total removed**: 348 lines

**Grand Total**: 2,053 lines of duplicate/dead code removed

### Test Results

| Test | Result |
|------|--------|
| TypeScript Build | PASS |
| Backup Creation | PASS |
| Race Condition Guard | PASS |
| Mock Task Filtering | PASS |
| Restore Dialog | PASS |

### Pre-existing Issues (NOT from consolidation)

1. CouchDB sync 500 errors - server config issue
2. CloudSyncSettings.vue null reference - sync initialization race

## 6. Post-Consolidation Monitoring

After consolidation, monitor for:

1. **User-reported issues** related to consolidated features
2. **Console errors** in production logs
3. **Performance regressions**

## Quick Reference Commands

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
