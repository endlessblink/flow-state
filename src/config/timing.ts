/**
 * Named timing constants extracted from magic numbers across the codebase.
 * Import from here instead of using raw millisecond values.
 */

/** Echo protection timeout for pending writes (sync architecture).
 *  Safety fallback if sync queue hangs or network dies. */
export const PENDING_WRITE_TIMEOUT_MS = 120_000

/** Drag settle delay before allowing sync to clear pendingWrite.
 *  Catches Supabase realtime echo arriving 100ms-2s after drag end. */
export const DRAG_SETTLE_TIMEOUT_MS = 3_000

/** File dialog timeout before fallback to browser download.
 *  XDG Portal can sometimes hang on Linux. */
export const FILE_DIALOG_TIMEOUT_MS = 30_000

/** Cross-tab dedup window for local operations. */
export const CROSS_TAB_DEDUP_TIMEOUT_MS = 5_000

/** Resize settle delay after section resize ends. */
export const RESIZE_SETTLE_TIMEOUT_MS = 1_000
