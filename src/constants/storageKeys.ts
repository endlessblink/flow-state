/**
 * Centralized localStorage key constants for the FlowState app.
 *
 * TASK-1576: Eliminates magic strings scattered across the codebase.
 *
 * Keys with dynamic segments (date-scoped) are functions that return
 * the full key string.
 *
 * Backup keys are re-exported from the backup subsystem's own types file
 * so that subsystem keeps its own source of truth.
 */

// Re-export backup keys from the backup subsystem
export { STORAGE_KEYS as BACKUP_STORAGE_KEYS } from '@/composables/backup/types'

export const STORAGE_KEYS = {
  // ── Settings & UI ────────────────────────────────────────────────────
  SETTINGS: 'flowstate-settings-v2',
  UI_STATE: 'flowstate-ui-state',
  FILTERS: 'flowstate-filters',

  // ── i18n / direction ─────────────────────────────────────────────────
  APP_LOCALE: 'flowstate-app-locale',
  APP_DIRECTION: 'flowstate-app-direction',

  // ── Canvas ────────────────────────────────────────────────────────────
  CANVAS_VIEWPORT: 'flowstate-canvas-viewport',
  CANVAS_HAS_INITIAL_FIT: 'flowstate-canvas-has-initial-fit',

  // ── AI ────────────────────────────────────────────────────────────────
  AI_CONVERSATIONS: 'flowstate-ai-conversations',
  AI_CHAT_HISTORY: 'flowstate-ai-chat-history',
  AI_SETTINGS: 'flowstate-ai-settings',
  AI_USAGE_LOG: 'flowstate-ai-usage-log',
  AI_QUALITY_REPORTS: 'flowstate-ai-quality-reports',
  AI_EVENTS: 'flowstate-ai-events',

  // ── Quick Sort ────────────────────────────────────────────────────────
  QUICKSORT_HISTORY: 'flowstate-quicksort-history',
  QUICKSORT_LAST_DATE: 'flowstate-quicksort-last-date',
  QUICKSORT_ACTIVE_SESSION: 'flowstate-quicksort-active-session',

  // ── Onboarding / Welcome ──────────────────────────────────────────────
  ONBOARDING: 'flowstate-onboarding-v2',
  WELCOME_SEEN: 'flowstate-welcome-seen',

  // ── Tauri / Desktop ───────────────────────────────────────────────────
  TAURI_MODE: 'flowstate-tauri-mode',

  // ── Guest mode data ───────────────────────────────────────────────────
  GUEST_TASKS: 'flowstate-guest-tasks',
  GUEST_GROUPS: 'flowstate-guest-groups',
  GUEST_PROJECTS: 'flowstate-guest-projects',
  GUEST_SESSION_ID: 'flowstate-guest-session-id',

  // ── Auth ──────────────────────────────────────────────────────────────
  SUPABASE_AUTH: 'flowstate-supabase-auth',
  SUPABASE_AUTH_CODE_VERIFIER: 'flowstate-supabase-auth-code-verifier',

  // ── Misc UI ───────────────────────────────────────────────────────────
  DEV_MODE: 'flowstate-dev-mode',
  DEMO_CONFIRMED: 'flowstate-demo-confirmed',
  LOCAL_BANNER_DISMISSED: 'flowstate-local-banner-dismissed',
  IOS_INSTALL_PROMPT_DISMISSED: 'flowstate-ios-install-prompt-dismissed',
  RECENT_EMOJIS: 'flowstate-recent-emojis',
} as const

/**
 * Returns the localStorage key for the recurrence duplicate-creation lock
 * for a given date string (YYYY-MM-DD).
 *
 * The key rotates daily, so one run per day is enforced automatically.
 *
 * Example: STORAGE_KEYS.RECURRENCE_LOCK('2026-03-18')
 *          → 'flowstate-recurrence-lock-2026-03-18'
 */
export function recurrenceLockKey(date: string): string {
  return `flowstate-recurrence-lock-${date}`
}

/**
 * Returns the localStorage key for the "Big 3" daily priorities
 * for a given date string (YYYY-MM-DD).
 *
 * Example: big3Key('2026-03-18') → 'flowstate-big3-2026-03-18'
 */
export function big3Key(date: string): string {
  return `flowstate-big3-${date}`
}
