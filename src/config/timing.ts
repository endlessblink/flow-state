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

/** Flash duration for task highlight animations (e.g. date set via context menu). */
export const FLASH_DURATION_MS = 600

/** Success flash duration for longer confirmation animations. */
export const SUCCESS_FLASH_DURATION_MS = 1200

/** Startup delay before showing the main app after splash/init. */
export const STARTUP_DELAY_MS = 1500

/** Error notification auto-dismiss timeout. */
export const ERROR_NOTIFICATION_TIMEOUT_MS = 10000

/** Toast notification duration for success messages. */
export const TOAST_SUCCESS_DURATION_MS = 2000
