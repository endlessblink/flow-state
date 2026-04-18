/**
 * Centralized Supabase table name constants.
 *
 * TASK-1576: Eliminates magic table-name strings scattered across the codebase.
 * All .from('table') calls should reference these constants rather than
 * hard-coded strings.
 */

export const DB_TABLES = {
  TASKS: 'tasks',
  GROUPS: 'groups',
  PROJECTS: 'projects',
  TIMER_SESSIONS: 'timer_sessions',
  TOMBSTONES: 'tombstones',
  NOTIFICATIONS: 'notifications',
  USER_SETTINGS: 'user_settings',
  POMODORO_HISTORY: 'pomodoro_history',
  TASK_DEDUP_AUDIT: 'task_dedup_audit',
  QUICK_SORT_SESSIONS: 'quick_sort_sessions',
  // gamification tables
  USER_GAMIFICATION: 'user_gamification',
  USER_CHALLENGES: 'user_challenges',
  USER_ACHIEVEMENTS: 'user_achievements',
} as const

export type DbTableName = typeof DB_TABLES[keyof typeof DB_TABLES]
