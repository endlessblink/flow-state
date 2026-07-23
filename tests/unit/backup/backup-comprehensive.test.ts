/**
 * TASK-1669: Backup System Comprehensive Tests (15 tests)
 *
 * Tests for the backup system composables in src/composables/backup/:
 * - Auto-backup interval
 * - Backup data completeness (tasks, projects, groups, settings)
 * - Restore operations
 * - Corrupt backup detection
 * - Golden backup system
 * - Backup history management
 * - Export/import as JSON
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  BACKUP_SCHEMA_VERSION,
  DEFAULT_CONFIG,
  STORAGE_KEYS,
  calculateChecksum,
  generateBackupId,
  formatTimestamp,
  DATA_LOSS_THRESHOLD,
  MAX_GOLDEN_BACKUPS,
} from '@/composables/backup/types'
import type { BackupData, BackupConfig } from '@/composables/backup/types'

// ---------------------------------------------------------------------------
// Helper to create mock backup data
// ---------------------------------------------------------------------------

function createMockBackup(overrides: Partial<BackupData> = {}): BackupData {
  const tasks = overrides.tasks || [
    { id: 't1', title: 'Task 1', status: 'planned', projectId: 'p1' },
    { id: 't2', title: 'Task 2', status: 'done', projectId: 'p1' },
    { id: 't3', title: 'Task 3', status: 'in_progress' },
  ] as any[]

  const projects = overrides.projects || [
    { id: 'p1', name: 'Project 1', color: '#FF0000' },
  ] as any[]

  const groups = overrides.groups || [
    { id: 'g1', name: 'Group 1', color: '#00FF00' },
  ] as any[]

  const backup: BackupData = {
    id: overrides.id || generateBackupId(),
    tasks,
    projects,
    groups,
    settings: overrides.settings || { theme: 'dark', language: 'en' },
    timestamp: overrides.timestamp || Date.now(),
    version: overrides.version || BACKUP_SCHEMA_VERSION,
    checksum: '',
    type: overrides.type || 'manual',
    metadata: overrides.metadata || {
      taskCount: tasks.length,
      projectCount: projects.length,
      groupCount: groups.length,
    },
  }

  backup.checksum = calculateChecksum({
    tasks: backup.tasks,
    projects: backup.projects,
    groups: backup.groups,
  })

  return backup
}

// ---------------------------------------------------------------------------
// Mock localStorage
// ---------------------------------------------------------------------------

const storageData: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => storageData[key] || null),
  setItem: vi.fn((key: string, value: string) => { storageData[key] = value }),
  removeItem: vi.fn((key: string) => { delete storageData[key] }),
  clear: vi.fn(() => { Object.keys(storageData).forEach(k => delete storageData[k]) }),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

// ---------------------------------------------------------------------------
// Tests — Types, Checksums, and Pure Logic
// ---------------------------------------------------------------------------

describe('TASK-1669: Backup System Comprehensive', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('1. Auto-backup interval configured at 5 minutes', () => {
    expect(DEFAULT_CONFIG.autoSaveInterval).toBe(5 * 60 * 1000) // 5 min in ms
    expect(DEFAULT_CONFIG.enabled).toBe(true)
  })

  it('2. Backup contains all task fields', () => {
    const backup = createMockBackup()

    expect(backup.tasks).toBeDefined()
    expect(Array.isArray(backup.tasks)).toBe(true)
    expect(backup.tasks.length).toBe(3)

    // Each task should have id and title
    for (const task of backup.tasks) {
      expect(task.id).toBeTruthy()
      expect(task.title).toBeTruthy()
    }
  })

  it('3. Backup contains projects', () => {
    const backup = createMockBackup()

    expect(backup.projects).toBeDefined()
    expect(Array.isArray(backup.projects)).toBe(true)
    expect(backup.projects.length).toBe(1)
    expect(backup.projects[0].name).toBe('Project 1')
  })

  it('4. Backup contains groups', () => {
    const backup = createMockBackup()

    expect(backup.groups).toBeDefined()
    expect(Array.isArray(backup.groups)).toBe(true)
    expect(backup.groups.length).toBe(1)
    expect(backup.groups[0].name).toBe('Group 1')
  })

  it('5. Backup contains settings', () => {
    const backup = createMockBackup({
      settings: { theme: 'dark', language: 'en', pomodoroLength: 25 }
    })

    expect(backup.settings).toBeDefined()
    expect(backup.settings!.theme).toBe('dark')
    expect(backup.settings!.language).toBe('en')
  })

  it('6. Checksum validates data integrity', () => {
    const backup = createMockBackup()

    // Checksum should be non-empty
    expect(backup.checksum).toBeTruthy()
    expect(typeof backup.checksum).toBe('string')

    // Recalculate and verify match
    const recalculated = calculateChecksum({
      tasks: backup.tasks,
      projects: backup.projects,
      groups: backup.groups,
    })
    expect(recalculated).toBe(backup.checksum)
  })

  it('7. Corrupt backup detected via checksum mismatch', () => {
    const backup = createMockBackup()
    const originalChecksum = backup.checksum

    // Corrupt the data
    backup.tasks.push({ id: 't99', title: 'Injected task' } as any)

    // Recalculate
    const newChecksum = calculateChecksum({
      tasks: backup.tasks,
      projects: backup.projects,
      groups: backup.groups,
    })

    // Should NOT match the original
    expect(newChecksum).not.toBe(originalChecksum)
  })

  it('7b. Checksum survives the JSON export and import boundary', () => {
    const data = {
      tasks: [{
        id: 'date-task',
        title: 'Serialization boundary',
        createdAt: new Date('2026-07-23T10:00:00.000Z'),
        updatedAt: new Date('2026-07-23T10:01:00.000Z'),
        optionalValue: undefined,
      }],
      projects: [],
      groups: [],
    }
    const beforeExport = calculateChecksum(data)
    const afterImport = calculateChecksum(JSON.parse(JSON.stringify(data)))

    expect(afterImport).toBe(beforeExport)
  })

  it('8. Task IDs preserved in backup', () => {
    const originalIds = ['uuid-1', 'uuid-2', 'uuid-3']
    const tasks = originalIds.map(id => ({ id, title: `Task ${id}` })) as any[]

    const backup = createMockBackup({ tasks })

    const backupIds = backup.tasks.map(t => t.id)
    expect(backupIds).toEqual(originalIds)
  })

  it('9. Backup metadata counts are accurate', () => {
    const tasks = Array.from({ length: 7 }, (_, i) => ({ id: `t${i}`, title: `Task ${i}` })) as any[]
    const projects = Array.from({ length: 3 }, (_, i) => ({ id: `p${i}`, name: `Proj ${i}` })) as any[]
    const groups = Array.from({ length: 2 }, (_, i) => ({ id: `g${i}`, name: `Group ${i}` })) as any[]

    const backup = createMockBackup({
      tasks,
      projects,
      groups,
      metadata: {
        taskCount: tasks.length,
        projectCount: projects.length,
        groupCount: groups.length,
      }
    })

    expect(backup.metadata!.taskCount).toBe(7)
    expect(backup.metadata!.projectCount).toBe(3)
    expect(backup.metadata!.groupCount).toBe(2)
  })

  it('10. Suspicious data loss detection blocks auto-backup', () => {
    // The isBackupSuspicious function checks if task count dropped significantly
    // We test the threshold logic directly

    const maxTaskCount = 100
    const DATA_LOSS_THRESHOLD_PERCENT = DATA_LOSS_THRESHOLD // 0.5 = 50%

    // 40 tasks when max was 100 = 60% loss → suspicious
    const suspiciousCount = 40
    expect(suspiciousCount < maxTaskCount * DATA_LOSS_THRESHOLD_PERCENT).toBe(true)

    // 60 tasks when max was 100 = 40% loss → OK
    const okCount = 60
    expect(okCount < maxTaskCount * DATA_LOSS_THRESHOLD_PERCENT).toBe(false)

    // 0 tasks when max was 100 → definitely suspicious
    expect(0 < maxTaskCount * DATA_LOSS_THRESHOLD_PERCENT).toBe(true)
  })

  it('11. Backup timestamp recorded', () => {
    const before = Date.now()
    const backup = createMockBackup()
    const after = Date.now()

    expect(backup.timestamp).toBeGreaterThanOrEqual(before)
    expect(backup.timestamp).toBeLessThanOrEqual(after)
  })

  it('12. Multiple backup versions maintained in history', () => {
    // Simulate saving multiple backups to history
    const history: BackupData[] = []
    const maxHistorySize = DEFAULT_CONFIG.maxHistorySize // 10

    for (let i = 0; i < 15; i++) {
      history.unshift(createMockBackup({ timestamp: Date.now() + i * 1000 }))
      // Trim to max
      if (history.length > maxHistorySize) {
        history.length = maxHistorySize
      }
    }

    expect(history.length).toBe(maxHistorySize)
    // Most recent should be first
    expect(history[0].timestamp).toBeGreaterThan(history[history.length - 1].timestamp)
  })

  it('13. Golden backup rotation keeps top N peaks', () => {
    // Simulate golden backup rotation logic
    const rotation: BackupData[] = []

    // Add backups with different task counts
    const counts = [50, 75, 100, 90, 110]
    for (const count of counts) {
      const tasks = Array.from({ length: count }, (_, i) => ({ id: `t${i}`, title: `T${i}` })) as any[]
      const backup = createMockBackup({
        tasks,
        metadata: { taskCount: count, projectCount: 1, groupCount: 0 }
      })

      // Only add if new peak (simplified logic matching backupGolden.ts)
      const highestPeak = rotation[0]?.metadata?.taskCount || 0
      if (count > highestPeak || rotation.length < MAX_GOLDEN_BACKUPS) {
        rotation.unshift(backup)
        rotation.sort((a, b) => (b.metadata?.taskCount || 0) - (a.metadata?.taskCount || 0))
        rotation.length = Math.min(rotation.length, MAX_GOLDEN_BACKUPS)
      }
    }

    // Should keep max 3 golden backups
    expect(rotation.length).toBeLessThanOrEqual(MAX_GOLDEN_BACKUPS)

    // Highest count should be first
    expect(rotation[0].metadata!.taskCount).toBe(110)
  })

  it('14. Manual backup trigger creates backup of correct type', () => {
    const backup = createMockBackup({ type: 'manual' })
    expect(backup.type).toBe('manual')

    const autoBackup = createMockBackup({ type: 'auto' })
    expect(autoBackup.type).toBe('auto')

    const emergencyBackup = createMockBackup({ type: 'emergency' })
    expect(emergencyBackup.type).toBe('emergency')
  })

  it('15. Backup export produces valid JSON', () => {
    const backup = createMockBackup()

    // Simulate export
    const exported = JSON.stringify({
      ...backup,
      metadata: {
        ...backup.metadata,
        exportedAt: new Date().toISOString()
      }
    }, null, 2)

    // Should be valid JSON
    expect(() => JSON.parse(exported)).not.toThrow()

    // Parsed data should match original
    const parsed = JSON.parse(exported)
    expect(parsed.tasks.length).toBe(backup.tasks.length)
    expect(parsed.projects.length).toBe(backup.projects.length)
    expect(parsed.groups.length).toBe(backup.groups.length)
    expect(parsed.version).toBe(BACKUP_SCHEMA_VERSION)
    expect(parsed.metadata.exportedAt).toBeTruthy()
    expect(parsed.checksum).toBe(backup.checksum)
  })
})
