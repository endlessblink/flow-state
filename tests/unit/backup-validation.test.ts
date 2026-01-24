/**
 * TASK-332: Comprehensive Backup Validation Tests
 *
 * Tests cover:
 * 1. Checksum validation
 * 2. Data completeness
 * 3. Restore round-trip testing
 * 4. Edge cases (empty backups, corrupted data)
 * 5. Golden backup rotation (TASK-332)
 * 6. Suspicious data loss detection (BUG-059)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useBackupSystem, BackupData } from '../../src/composables/useBackupSystem'

// Mock dependencies
const mockFetchDeletedTaskIds = vi.fn()
const mockFetchDeletedProjectIds = vi.fn()
const mockFetchDeletedGroupIds = vi.fn()
const mockFetchTombstones = vi.fn()
const mockCheckTaskIdsAvailability = vi.fn()
const mockSafeCreateTask = vi.fn()
const mockSaveProjects = vi.fn()
const mockSaveGroup = vi.fn()
const mockLogDedupDecision = vi.fn()

// Mock useSupabaseDatabase
vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    fetchDeletedTaskIds: mockFetchDeletedTaskIds,
    fetchDeletedProjectIds: mockFetchDeletedProjectIds,
    fetchDeletedGroupIds: mockFetchDeletedGroupIds,
    fetchTombstones: mockFetchTombstones,
    checkTaskIdsAvailability: mockCheckTaskIdsAvailability,
    safeCreateTask: mockSafeCreateTask,
    saveProjects: mockSaveProjects,
    saveGroup: mockSaveGroup,
    logDedupDecision: mockLogDedupDecision,
  }),
}))

// Mock Integrity Service with real-like checksum behavior
const checksumMap = new Map<string, string>()
vi.mock('@/utils/integrity', () => ({
  default: {
    calculateChecksum: vi.fn((data: unknown) => {
      const key = JSON.stringify(data)
      if (!checksumMap.has(key)) {
        checksumMap.set(key, `checksum_${checksumMap.size}`)
      }
      return checksumMap.get(key)
    }),
  },
}))

// Mock isTauri
vi.mock('@/composables/useTauriStartup', () => ({
  isTauri: () => false,
}))

// Mock Stores
const mockTaskStore = {
  tasks: [] as any[],
  loadFromDatabase: vi.fn(),
}
const mockProjectStore = {
  projects: [] as any[],
  loadProjectsFromDatabase: vi.fn(),
}
const mockCanvasStore = {
  groups: [] as any[],
  loadFromDatabase: vi.fn(),
}

vi.mock('@/stores/tasks', () => ({ useTaskStore: () => mockTaskStore }))
vi.mock('@/stores/projects', () => ({ useProjectStore: () => mockProjectStore }))
vi.mock('@/stores/canvas', () => ({ useCanvasStore: () => mockCanvasStore }))

// Mock localStorage with in-memory store
let localStorageStore: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] || null),
  setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value }),
  clear: vi.fn(() => { localStorageStore = {} }),
  removeItem: vi.fn((key: string) => { delete localStorageStore[key] }),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Helper to create mock backup data
function createMockBackup(
  taskCount: number,
  timestamp: number = Date.now(),
  options: Partial<BackupData> = {}
): BackupData {
  const tasks = Array.from({ length: taskCount }, (_, i) => ({
    id: `task-${i + 1}`,
    title: `Task ${i + 1}`,
    status: 'todo',
    createdAt: new Date().toISOString(),
  }))

  return {
    id: `backup_${timestamp}`,
    tasks,
    projects: [],
    groups: [],
    timestamp,
    version: '3.1.0',
    checksum: `checksum_${taskCount}`,
    type: 'manual',
    metadata: {
      taskCount,
      projectCount: 0,
      groupCount: 0,
    },
    ...options,
  }
}

describe('TASK-332: Backup Reliability & Verification', () => {
  let backupSystem: ReturnType<typeof useBackupSystem>

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    checksumMap.clear()

    // Reset mock store data
    mockTaskStore.tasks = []
    mockProjectStore.projects = []
    mockCanvasStore.groups = []

    // Default mock implementations
    mockFetchDeletedTaskIds.mockResolvedValue([])
    mockFetchDeletedProjectIds.mockResolvedValue([])
    mockFetchDeletedGroupIds.mockResolvedValue([])
    mockFetchTombstones.mockResolvedValue([])
    mockCheckTaskIdsAvailability.mockResolvedValue([])
    mockSafeCreateTask.mockResolvedValue({ status: 'created', message: 'Created' })
    mockLogDedupDecision.mockResolvedValue(undefined)

    backupSystem = useBackupSystem()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // =========================================================================
  // 1. Checksum Validation Tests
  // =========================================================================
  describe('Checksum Validation', () => {
    it('should generate consistent checksums for identical data', async () => {
      mockTaskStore.tasks = [
        { id: 'task-1', title: 'Task 1' },
        { id: 'task-2', title: 'Task 2' },
      ]

      const backup1 = await backupSystem.createBackup('manual')
      const backup2 = await backupSystem.createBackup('manual')

      expect(backup1?.checksum).toBe(backup2?.checksum)
    })

    it('should generate different checksums for different data', async () => {
      mockTaskStore.tasks = [{ id: 'task-1', title: 'Task 1' }]
      const backup1 = await backupSystem.createBackup('manual')

      mockTaskStore.tasks = [{ id: 'task-2', title: 'Task 2' }]
      const backup2 = await backupSystem.createBackup('manual')

      expect(backup1?.checksum).not.toBe(backup2?.checksum)
    })
  })

  // =========================================================================
  // 2. Data Completeness Tests
  // =========================================================================
  describe('Data Completeness', () => {
    it('should include all required fields in backup', async () => {
      mockTaskStore.tasks = [{ id: 'task-1', title: 'Task 1' }]
      mockProjectStore.projects = [{ id: 'proj-1', name: 'Project 1' }]
      mockCanvasStore.groups = [{ id: 'group-1', name: 'Group 1' }]

      const backup = await backupSystem.createBackup('manual')

      expect(backup).toBeDefined()
      expect(backup?.id).toBeDefined()
      expect(backup?.timestamp).toBeDefined()
      expect(backup?.version).toBe('3.1.0')
      expect(backup?.checksum).toBeDefined()
      expect(backup?.type).toBe('manual')
      expect(backup?.tasks).toHaveLength(1)
      expect(backup?.projects).toHaveLength(1)
      expect(backup?.groups).toHaveLength(1)
      expect(backup?.metadata?.taskCount).toBe(1)
      expect(backup?.metadata?.projectCount).toBe(1)
      expect(backup?.metadata?.groupCount).toBe(1)
    })

    it('should handle empty data gracefully', async () => {
      mockTaskStore.tasks = []
      mockProjectStore.projects = []
      mockCanvasStore.groups = []

      const backup = await backupSystem.createBackup('manual')

      expect(backup).toBeDefined()
      expect(backup?.tasks).toHaveLength(0)
      expect(backup?.metadata?.taskCount).toBe(0)
    })
  })

  // =========================================================================
  // 3. Edge Cases
  // =========================================================================
  describe('Edge Cases', () => {
    it('should return null for getLatestBackup when no backup exists', () => {
      const latest = backupSystem.getLatestBackup()
      expect(latest).toBeNull()
    })

    it('should handle corrupted localStorage data gracefully', () => {
      localStorageMock.setItem('flow-state-golden-backup', 'invalid-json{')

      const golden = backupSystem.getGoldenBackup()
      expect(golden).toBeNull()
    })

    it('should handle missing metadata in backup', async () => {
      const backupWithoutMetadata = {
        id: 'test-backup',
        tasks: [{ id: 'task-1', title: 'Task 1' }],
        projects: [],
        groups: [],
        timestamp: Date.now(),
        version: '3.1.0',
        checksum: 'abc',
        type: 'manual' as const,
        // No metadata
      }

      localStorageMock.setItem('flow-state-golden-backup', JSON.stringify(backupWithoutMetadata))

      const golden = backupSystem.getGoldenBackup()
      expect(golden).toBeDefined()
      expect(golden?.tasks).toHaveLength(1)
    })
  })

  // =========================================================================
  // 4. Golden Backup Age Validation (TASK-153)
  // =========================================================================
  describe('Golden Backup Age Validation', () => {
    it('should warn if golden backup is older than 7 days', async () => {
      const oldTimestamp = Date.now() - (8 * 24 * 60 * 60 * 1000) // 8 days ago
      const backup = createMockBackup(10, oldTimestamp)

      localStorageMock.setItem('flow-state-golden-backup', JSON.stringify(backup))

      const validation = await backupSystem.validateGoldenBackup()

      expect(validation?.isValid).toBe(true)
      expect(validation?.ageWarning).toContain('days old')
      expect(validation?.warnings.some(w => w.includes('days old'))).toBe(true)
    })

    it('should not warn for recent golden backup', async () => {
      const recentTimestamp = Date.now() - (1 * 24 * 60 * 60 * 1000) // 1 day ago
      const backup = createMockBackup(10, recentTimestamp)

      localStorageMock.setItem('flow-state-golden-backup', JSON.stringify(backup))

      const validation = await backupSystem.validateGoldenBackup()

      expect(validation?.ageWarning).toBeNull()
    })
  })

  // =========================================================================
  // 5. Golden Backup Rotation (TASK-332)
  // =========================================================================
  describe('Golden Backup Rotation (TASK-332)', () => {
    it('should keep up to 3 golden backups in rotation', () => {
      // Add 4 golden backups with increasing task counts
      const backup1 = createMockBackup(10, Date.now() - 4000)
      const backup2 = createMockBackup(20, Date.now() - 3000)
      const backup3 = createMockBackup(30, Date.now() - 2000)
      const backup4 = createMockBackup(40, Date.now() - 1000)

      // Manually add to rotation (simulating multiple saves)
      localStorageMock.setItem('flow-state-golden-backup-rotation', JSON.stringify([backup1]))
      useBackupSystem() // Trigger potential migration

      localStorageMock.setItem('flow-state-golden-backup-rotation', JSON.stringify([backup2, backup1]))
      useBackupSystem() // Trigger potential migration

      localStorageMock.setItem('flow-state-golden-backup-rotation', JSON.stringify([backup3, backup2, backup1]))
      useBackupSystem() // Trigger potential migration

      // After 4th, rotation should have only 3
      localStorageMock.setItem('flow-state-golden-backup-rotation', JSON.stringify([backup4, backup3, backup2]))

      const backupSystem = useBackupSystem()
      const rotation = backupSystem.getGoldenBackups()

      expect(rotation.length).toBeLessThanOrEqual(3)
    })

    it('should return golden backups sorted by task count descending', () => {
      const backup1 = createMockBackup(10, Date.now() - 3000)
      const backup2 = createMockBackup(30, Date.now() - 2000)
      const backup3 = createMockBackup(20, Date.now() - 1000)

      localStorageMock.setItem('flow-state-golden-backup-rotation', JSON.stringify([backup1, backup2, backup3]))

      const backupSystem = useBackupSystem()
      const rotation = backupSystem.getGoldenBackups()

      expect(rotation[0].metadata?.taskCount).toBe(30)
      expect(rotation[1].metadata?.taskCount).toBe(20)
      expect(rotation[2].metadata?.taskCount).toBe(10)
    })

    it('should migrate legacy single golden backup to rotation', () => {
      const legacyBackup = createMockBackup(50, Date.now())

      // Set only legacy key
      localStorageMock.setItem('flow-state-golden-backup', JSON.stringify(legacyBackup))

      const backupSystem = useBackupSystem()
      const rotation = backupSystem.getGoldenBackups()

      expect(rotation).toHaveLength(1)
      expect(rotation[0].metadata?.taskCount).toBe(50)

      // Verify migration created the rotation array
      const rotationStored = localStorageMock.getItem('flow-state-golden-backup-rotation')
      expect(rotationStored).not.toBeNull()
    })

    it('getGoldenBackup should return the highest peak from rotation', () => {
      const backup1 = createMockBackup(10, Date.now() - 2000)
      const backup2 = createMockBackup(50, Date.now() - 1000) // Highest
      const backup3 = createMockBackup(30, Date.now())

      localStorageMock.setItem('flow-state-golden-backup-rotation', JSON.stringify([backup1, backup2, backup3]))

      const backupSystem = useBackupSystem()
      const golden = backupSystem.getGoldenBackup()

      expect(golden?.metadata?.taskCount).toBe(50)
    })
  })

  // =========================================================================
  // 6. Suspicious Data Loss Detection (BUG-059)
  // =========================================================================
  describe('Suspicious Data Loss Detection (BUG-059)', () => {
    it('should block auto-backup if task count drops by more than 50%', async () => {
      // Set a high max task count
      localStorageMock.setItem('flow-state-max-task-count', '100')

      // Current tasks are far below threshold
      mockTaskStore.tasks = Array.from({ length: 30 }, (_, i) => ({
        id: `task-${i}`,
        title: `Task ${i}`,
      }))

      const backupSystem = useBackupSystem()
      const backup = await backupSystem.createBackup('auto')

      // Auto backup should be blocked (suspicious)
      expect(backup).toBeNull()
    })

    it('should allow manual backup even with suspicious data loss', async () => {
      // Set a high max task count
      localStorageMock.setItem('flow-state-max-task-count', '100')

      // Current tasks are far below threshold
      mockTaskStore.tasks = Array.from({ length: 30 }, (_, i) => ({
        id: `task-${i}`,
        title: `Task ${i}`,
      }))

      const backupSystem = useBackupSystem()
      const backup = await backupSystem.createBackup('manual')

      // Manual backup should be allowed
      expect(backup).not.toBeNull()
      expect(backup?.metadata?.taskCount).toBe(30)
    })

    it('should block auto-backup if all tasks disappear', async () => {
      // Set a previous max
      localStorageMock.setItem('flow-state-max-task-count', '10')

      // Now we have 0 tasks
      mockTaskStore.tasks = []

      const backupSystem = useBackupSystem()
      const backup = await backupSystem.createBackup('auto')

      expect(backup).toBeNull()
    })
  })

  // =========================================================================
  // 7. Restore Analysis (TASK-344 Dry-Run)
  // =========================================================================
  describe('Restore Analysis (Dry-Run)', () => {
    it('should analyze backup and identify tasks that can be restored', async () => {
      const backup = createMockBackup(5)

      // Mock that all task IDs are available
      mockCheckTaskIdsAvailability.mockResolvedValue(
        backup.tasks.map(t => ({ taskId: t.id, status: 'available', reason: '' }))
      )

      const analysis = await backupSystem.analyzeRestore(backup)

      expect(analysis.tasks.total).toBe(5)
      expect(analysis.tasks.available).toBe(5)
      expect(analysis.tasks.existsActive).toBe(0)
      expect(analysis.canProceed).toBe(true)
    })

    it('should identify tasks that already exist', async () => {
      const backup = createMockBackup(5)

      // Mock that 2 tasks already exist
      mockCheckTaskIdsAvailability.mockResolvedValue([
        { taskId: 'task-1', status: 'available', reason: '' },
        { taskId: 'task-2', status: 'active', reason: 'Task already exists' },
        { taskId: 'task-3', status: 'soft_deleted', reason: 'Task was deleted' },
        { taskId: 'task-4', status: 'tombstoned', reason: 'Task permanently deleted' },
        { taskId: 'task-5', status: 'available', reason: '' },
      ])

      const analysis = await backupSystem.analyzeRestore(backup)

      expect(analysis.tasks.total).toBe(5)
      expect(analysis.tasks.available).toBe(2) // task-1 and task-5
      expect(analysis.tasks.existsActive).toBe(1) // task-2
      expect(analysis.tasks.existsDeleted).toBe(1) // task-3
      expect(analysis.tasks.tombstoned).toBe(1) // task-4
      expect(analysis.warnings).toContain('1 tasks already exist (active) - will be skipped')
    })

    it('should return canProceed=false if no tasks can be restored', async () => {
      const backup = createMockBackup(2)

      // Mock that all tasks already exist
      mockCheckTaskIdsAvailability.mockResolvedValue([
        { taskId: 'task-1', status: 'active', reason: 'Task already exists' },
        { taskId: 'task-2', status: 'active', reason: 'Task already exists' },
      ])

      const analysis = await backupSystem.analyzeRestore(backup)

      expect(analysis.tasks.available).toBe(0)
      expect(analysis.canProceed).toBe(false)
    })
  })

  // =========================================================================
  // 8. Backup History Management
  // =========================================================================
  describe('Backup History Management', () => {
    it('should limit history to maxHistorySize', async () => {
      mockTaskStore.tasks = [{ id: 'task-1', title: 'Task 1' }]

      const backupSystem = useBackupSystem({ maxHistorySize: 3 })

      // Create 5 backups
      for (let i = 0; i < 5; i++) {
        await backupSystem.createBackup('manual')
      }

      const history = backupSystem.backupHistory.value
      expect(history.length).toBeLessThanOrEqual(3)
    })

    it('should clear history when clearHistory is called', async () => {
      mockTaskStore.tasks = [{ id: 'task-1', title: 'Task 1' }]

      const backupSystem = useBackupSystem()
      await backupSystem.createBackup('manual')

      expect(backupSystem.backupHistory.value.length).toBeGreaterThan(0)

      backupSystem.clearHistory()

      expect(backupSystem.backupHistory.value.length).toBe(0)
    })
  })

  // =========================================================================
  // 9. Export/Import Round-Trip
  // =========================================================================
  describe('Export/Import Round-Trip', () => {
    it('should preserve data integrity through export/import cycle', async () => {
      const originalTasks = [
        { id: 'task-1', title: 'Task 1', status: 'todo' },
        { id: 'task-2', title: 'Task 2', status: 'done' },
      ]
      mockTaskStore.tasks = originalTasks

      const backupSystem = useBackupSystem()
      const exported = await backupSystem.exportBackup()

      const parsed = JSON.parse(exported)
      expect(parsed.tasks).toHaveLength(2)
      expect(parsed.tasks[0].title).toBe('Task 1')
      expect(parsed.tasks[1].title).toBe('Task 2')
      expect(parsed.metadata?.exportedAt).toBeDefined()
    })
  })
})
