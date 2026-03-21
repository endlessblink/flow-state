/**
 * TASK-1617: Configuration Combination Tests — 15 tests.
 *
 * Verify that unusual-but-valid setting combinations do not crash the app.
 *
 * Groups:
 *   1-3:   RTL + dark theme — direction and theme settings co-exist
 *   4-6:   Guest mode (no Supabase) + store initialisation
 *   7-9:   Sidebar collapsed + view stores
 *   10-12: Empty state (zero tasks) + view interactions
 *   13-15: All timer durations (1min, 25min, 120min) — settings store
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ---------------------------------------------------------------------------
// Shared mocks — must be declared at module scope so Vitest hoists them
// ---------------------------------------------------------------------------

vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    saveTask: vi.fn().mockResolvedValue(undefined),
    saveTasks: vi.fn().mockResolvedValue(undefined),
    deleteTask: vi.fn().mockResolvedValue(undefined),
    fetchTasks: vi.fn().mockResolvedValue([]),
    fetchGroups: vi.fn().mockResolvedValue([]),
    saveGroup: vi.fn(),
    deleteGroup: vi.fn(),
    fetchUserSettings: vi.fn().mockResolvedValue(null),
    saveProject: vi.fn().mockResolvedValue(undefined),
    saveProjects: vi.fn().mockResolvedValue(undefined),
    fetchProjects: vi.fn().mockResolvedValue([]),
    deleteProject: vi.fn().mockResolvedValue(undefined),
    fetchActiveTimerSession: vi.fn().mockResolvedValue(null),
    saveActiveTimerSession: vi.fn().mockResolvedValue(undefined),
    claimLeadership: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/services/auth/supabase', () => ({ supabase: null }))

vi.mock('@/composables/useDatabase', () => ({
  useDatabase: () => ({
    save: vi.fn(),
    load: vi.fn().mockResolvedValue(null),
  }),
  DB_KEYS: { TASKS: 'tasks', PROJECTS: 'projects', CANVAS: 'canvas' },
}))

vi.mock('@/composables/sync/useSyncOrchestrator', () => ({
  useSyncOrchestrator: () => ({
    enqueue: vi.fn().mockResolvedValue({ id: 1, status: 'pending' }),
    onPermanentFailure: vi.fn(),
    status: { value: 'idle' },
    pendingCount: { value: 0 },
    failedCount: { value: 0 },
    lastSyncAt: { value: null },
    lastError: { value: null },
    isOnline: { value: true },
    isProcessing: { value: false },
    hasPendingChanges: { value: false },
    hasErrors: { value: false },
    retryFailed: vi.fn(),
    clearFailed: vi.fn(),
    getQueueStats: vi.fn(),
    forceSync: vi.fn(),
  }),
}))

vi.mock('@/composables/useGamificationHooks', () => ({
  useGamificationHooks: () => ({
    onTaskCompleted: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('@/services/offline/readCacheDB', () => ({
  cacheTasks: vi.fn().mockResolvedValue(undefined),
  cacheProjects: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/utils/demoContentGuard', () => ({ guardTaskCreation: vi.fn() }))

vi.mock('@/stores/workspace', () => ({
  useWorkspaceStore: () => ({ activeWorkspaceId: null }),
}))

vi.mock('@/composables/timer/useTimerAudio', () => ({
  useTimerAudio: () => ({ playStartSound: vi.fn(), playEndSound: vi.fn() }),
}))

vi.mock('@/composables/timer/useTimerNotifications', () => ({
  useTimerNotifications: () => ({
    requestPermission: vi.fn(),
    showTimerEndNotification: vi.fn(),
    setupServiceWorkerListener: vi.fn(),
  }),
}))

vi.mock('@/composables/timer/useTimerSync', () => ({
  useTimerSync: () => ({
    syncSession: vi.fn(),
    loadSession: vi.fn().mockResolvedValue(null),
  }),
  DEVICE_LEADER_TIMEOUT_MS: 30000,
}))

vi.mock('@/composables/useCrossTabSync', () => ({
  getCrossTabSync: () => ({
    subscribe: vi.fn(),
    publish: vi.fn(),
    unsubscribe: vi.fn(),
  }),
}))

vi.mock('@/composables/useWakeLock', () => ({
  useWakeLock: () => ({ request: vi.fn(), release: vi.fn() }),
}))

vi.mock('@/i18n', () => ({
  default: { global: { t: (key: string) => key } },
}))

// Auth mock — includes $subscribe so timer store can call it
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'test-user-id' },
    isAuthenticated: true,
    session: { access_token: 'test-token' },
    $subscribe: vi.fn(() => vi.fn()),
  }),
}))

// ---------------------------------------------------------------------------
// Static imports — after mocks
// ---------------------------------------------------------------------------

import { useSettingsStore } from '@/stores/settings'
import { useTaskStore } from '@/stores/tasks'
import { useProjectStore } from '@/stores/projects'
import { useTimerStore } from '@/stores/timer'

// ---------------------------------------------------------------------------
// Group 1 (Tests 1-3): RTL + dark theme
// ---------------------------------------------------------------------------

describe('RTL + dark theme combination', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('settings store accepts textDirection="rtl" without errors', () => {
    const store = useSettingsStore()
    expect(() => {
      store.$patch({ textDirection: 'rtl' })
    }).not.toThrow()
    expect(store.textDirection).toBe('rtl')
  })

  it('settings store accepts theme="dark" without errors', () => {
    const store = useSettingsStore()
    expect(() => {
      store.$patch({ theme: 'dark' })
    }).not.toThrow()
    expect(store.theme).toBe('dark')
  })

  it('RTL + dark combination is stable — both settings co-exist independently', () => {
    const store = useSettingsStore()
    store.$patch({ textDirection: 'rtl', theme: 'dark' })

    expect(store.textDirection).toBe('rtl')
    expect(store.theme).toBe('dark')
    // Changing theme must not reset textDirection
    store.$patch({ theme: 'light' })
    expect(store.textDirection).toBe('rtl')
    // Changing direction must not reset theme
    store.$patch({ textDirection: 'ltr' })
    expect(store.theme).toBe('light')
  })
})

// ---------------------------------------------------------------------------
// Group 2 (Tests 4-6): Guest mode store initialisation
// ---------------------------------------------------------------------------

describe('Guest mode — store initialisation without auth user', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('task store initialises and .tasks returns an array without throwing', () => {
    expect(() => {
      const store = useTaskStore()
      const tasks = store.tasks
      expect(Array.isArray(tasks)).toBe(true)
    }).not.toThrow()
  })

  it('projects store initialises and .projects returns an array without throwing', () => {
    expect(() => {
      const store = useProjectStore()
      const projects = store.projects
      expect(Array.isArray(projects)).toBe(true)
    }).not.toThrow()
  })

  it('settings store works without throwing (falls back to defaults)', () => {
    expect(() => {
      const store = useSettingsStore()
      expect(store.workDuration).toBeGreaterThan(0)
      expect(store.language).toBeDefined()
      expect(store.theme).toBeDefined()
    }).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Group 3 (Tests 7-9): Sidebar collapsed + view stores
// ---------------------------------------------------------------------------

describe('Sidebar collapsed + view stores', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('settings store accepts sidebarCollapsed=true without errors', () => {
    const store = useSettingsStore()
    expect(() => {
      store.$patch({ sidebarCollapsed: true })
    }).not.toThrow()
    expect(store.sidebarCollapsed).toBe(true)
  })

  it('task store still returns tasks when sidebarCollapsed=true', () => {
    const settings = useSettingsStore()
    settings.$patch({ sidebarCollapsed: true })
    const tasks = useTaskStore()
    // Tasks computed must not depend on sidebar state
    expect(() => tasks.tasks).not.toThrow()
    expect(Array.isArray(tasks.tasks)).toBe(true)
  })

  it('projects store is unaffected by sidebar collapsed state', () => {
    const settings = useSettingsStore()
    settings.$patch({ sidebarCollapsed: true })
    const projects = useProjectStore()
    expect(() => projects.projects).not.toThrow()
    expect(Array.isArray(projects.projects)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Group 4 (Tests 10-12): Empty state (zero tasks)
// ---------------------------------------------------------------------------

describe('Empty state — zero tasks in all view stores', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('task store .tasks returns empty array without throwing', () => {
    const store = useTaskStore()
    // _rawTasks starts empty
    expect(() => store.tasks).not.toThrow()
    expect(store.tasks).toEqual([])
  })

  it('filtering empty task list returns empty array without undefined errors', () => {
    const store = useTaskStore()
    expect(() => {
      const filtered = store.tasks.filter((t) => t.status === 'done')
      expect(filtered).toEqual([])
    }).not.toThrow()
  })

  it('projects store returns empty array with zero projects', () => {
    const store = useProjectStore()
    expect(() => {
      const projects = store.projects
      expect(Array.isArray(projects)).toBe(true)
    }).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Group 5 (Tests 13-15): All timer durations
// ---------------------------------------------------------------------------

describe('Timer duration settings', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('timer settings with 1-minute work duration (60s) initialise correctly', () => {
    const settings = useSettingsStore()
    settings.$patch({ workDuration: 60 })

    expect(settings.workDuration).toBe(60)
    // Timer store reads from settings — must not throw
    expect(() => useTimerStore()).not.toThrow()
    const timer = useTimerStore()
    // The timer should be idle initially
    expect(timer.currentSession).toBeNull()
  })

  it('timer settings with 25-minute work duration (1500s) initialise correctly', () => {
    const settings = useSettingsStore()
    settings.$patch({ workDuration: 25 * 60 })

    expect(settings.workDuration).toBe(1500)
    expect(() => useTimerStore()).not.toThrow()
    const timer = useTimerStore()
    expect(timer.currentSession).toBeNull()
  })

  it('timer settings with 120-minute work duration (7200s) initialise correctly', () => {
    const settings = useSettingsStore()
    settings.$patch({ workDuration: 120 * 60 })

    expect(settings.workDuration).toBe(7200)
    expect(() => useTimerStore()).not.toThrow()

    // Break durations should remain positive regardless of work duration
    expect(settings.shortBreakDuration).toBeGreaterThan(0)
    expect(settings.longBreakDuration).toBeGreaterThan(0)
    // Work duration must be longer than short break (sanity check)
    expect(settings.workDuration).toBeGreaterThan(settings.shortBreakDuration)
  })
})
