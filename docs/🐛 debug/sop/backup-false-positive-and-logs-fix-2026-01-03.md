# SOP: Backup System False Positive & Verbose Log Fix

**Date**: January 3, 2026
**Version**: 1.0
**Status**: ✅ FIXED
**Related Issue**: BUG-062

## 1. Problem Description

### Critical Issue: Backup Blocking
The backup system was refusing to run auto-backups, reporting a critical error:
> "🛡️ [Backup] BLOCKED: Task count dropped from 144 to 0 (>50% loss)"

This occurred despite the user actually having 144 valid tasks. The system believed all tasks had been deleted.

### Secondary Issue: Console Noise
The browser console was flooded with high-frequency logs, making debugging impossible:
ac
* `[CANVAS] Sync triggered by external request`
* `Viewport restored from DB`
* `[APP] Fallback timer: stores already reloaded`
* `Group loaded with ID`

## 2. Root Cause Analysis

### Backup False Positive
The "Unified Backup System" (introduced in Phase 13) includes a `filterMockTasks` utility designed to prevent test data from contaminating backups.

1. **Detection Logic**: `src/utils/mockTaskDetector.ts` uses regex patterns to identify mock tasks.
2. **The Flaw**: It contained an `Auto-generated ID Pattern` (`/^\d{11,}$/`) with **Medium Confidence**.
3. **The Trigger**: The user's tasks utilize 13-digit timestamp-based IDs (e.g., `1735829402123`).
4. **The Failure**:
   * The detector flagged *all* 144 tasks as "Likely Mock Data" (Medium Confidence).
   * The backup system defaults to filtering out Medium+ confidence mock tasks.
   * Result: `144 tasks` -> `0 tasks` in the clean set.
   * Safety Check: The `isBackupSuspicious()` guard noticed the drop from 144 to 0 and correctly blocked the backup to prevent data loss, ironically caused by the safety filter itself.

## 3. Implementation Details

### A. Mock Task Detector Fix
Downgraded the confidence levels of over-aggressive patterns in `src/utils/mockTaskDetector.ts`:

```typescript
// BEFORE
{
  name: 'Sample Task Pattern',
  confidence: 'medium', // Too aggressive
},
{
  name: 'Auto-generated ID Pattern',
  pattern: /^\d{11,}$/,
  confidence: 'medium', // INCORRECT: Timestamp IDs are valid
}

// AFTER
{
  name: 'Sample Task Pattern',
  confidence: 'low',
},
{
  name: 'Auto-generated ID Pattern',
  pattern: /^\d{11,}$/,
  confidence: 'low', // Safe: Won't filter unless other signals present
}
```

### B. Emergency Recovery
Added a "Rescue Tasks" button to `BackupSettings.vue` that exposes `recoverSoftDeletedTasks` from `taskPersistence.ts`. This allows users to scan the internal PouchDB database for tasks marked `_soft_deleted` and restore them if they were accidentally removed by previous sync bugs.

### C. Log Silencing
Commented out the following verbose logs to restore console usability:
* **`src/views/CanvasView.vue`**: Sync triggers and viewport restoration.
* **`src/composables/app/useAppInitialization.ts`**: Fallback timer warnings.
* **`src/stores/canvas.ts`**: Group loading logs.

## 4. Verification Steps

### Verifying Backup
1. Open DevTools Console.
2. Trigger a manual backup (or wait for auto-save).
3. Observe `[Backup] Creating auto backup...`.
4. **Success**: No "BLOCKED" warning. `Task count` in backup matches UI.

### Verifying Recovery
1. Go to **Settings > Backup**.
2. Click **"Rescue Tasks"**.
3. Confirm the dialog.
4. System scans for soft-deleted tasks and reports count.

## 5. Monitoring Paths

**Key files to monitor for regression:**
* `src/composables/useBackupSystem.ts`: Main orchestration logic.
* `src/utils/mockTaskDetector.ts`: Regex patterns.
* `src/utils/forensicBackupLogger.ts`: Audit trail of backups.

**Logs to watch for:**
* `🛡️ [Backup] BLOCKED`: Indicates false positive recurrence or actual data loss.
* `🚫 Mock task filtered`: Check if valid tasks are being caught here.
