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

import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useBackupSystem, BackupData } from '../../src/composables/useBackupSystem'
import {
  BACKUP_SCHEMA_VERSION,
  STORAGE_KEYS,
  calculateChecksum,
} from '../../src/composables/backup/types'

// Mock dependencies
const mockFetchDeletedTaskIds = vi.fn()
const mockFetchTasks = vi.fn()
const mockFetchTrash = vi.fn()
const mockFetchProjects = vi.fn()
const mockFetchGroups = vi.fn()
const mockFetchDeletedProjectIds = vi.fn()
const mockFetchDeletedGroupIds = vi.fn()
const mockFetchTombstones = vi.fn()
const mockRecordTombstone = vi.fn()
const mockCheckTaskIdsAvailability = vi.fn()
const mockSafeCreateTask = vi.fn()
const mockSaveProjects = vi.fn()
const mockSaveGroup = vi.fn()
const mockLogDedupDecision = vi.fn()
const mockRestoreBackupTransaction = vi.fn()

// Mock useSupabaseDatabase
vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    fetchDeletedTaskIds: mockFetchDeletedTaskIds,
    fetchTasks: mockFetchTasks,
    fetchTrash: mockFetchTrash,
    fetchProjects: mockFetchProjects,
    fetchGroups: mockFetchGroups,
    fetchDeletedProjectIds: mockFetchDeletedProjectIds,
    fetchDeletedGroupIds: mockFetchDeletedGroupIds,
    fetchTombstones: mockFetchTombstones,
    recordTombstone: mockRecordTombstone,
    checkTaskIdsAvailability: mockCheckTaskIdsAvailability,
    safeCreateTask: mockSafeCreateTask,
    saveProjects: mockSaveProjects,
    saveGroup: mockSaveGroup,
    logDedupDecision: mockLogDedupDecision,
    restoreBackupTransaction: mockRestoreBackupTransaction,
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
  get _rawTasks() { return this.tasks },
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
let mockAuthUserId: string | null = 'user-1'

vi.mock('@/stores/tasks', () => ({ useTaskStore: () => mockTaskStore }))
vi.mock('@/stores/projects', () => ({ useProjectStore: () => mockProjectStore }))
vi.mock('@/stores/canvas', () => ({ useCanvasStore: () => mockCanvasStore }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: mockAuthUserId ? { id: mockAuthUserId } : null }),
}))

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
    source: { kind: 'account', userId: 'user-1' },
    tasks,
    projects: [],
    groups: [],
    timestamp,
    version: BACKUP_SCHEMA_VERSION,
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
    localStorageMock.getItem.mockImplementation((key: string) => localStorageStore[key] || null)
    localStorageMock.setItem.mockImplementation((key: string, value: string) => {
      localStorageStore[key] = value
    })
    localStorageMock.removeItem.mockImplementation((key: string) => {
      delete localStorageStore[key]
    })
    checksumMap.clear()

    // Reset mock store data
    mockTaskStore.tasks = []
    mockProjectStore.projects = []
    mockCanvasStore.groups = []

    // Default mock implementations
    mockFetchDeletedTaskIds.mockResolvedValue([])
    mockFetchTasks.mockResolvedValue([])
    mockFetchTrash.mockResolvedValue([])
    mockFetchProjects.mockResolvedValue([])
    mockFetchGroups.mockResolvedValue([])
    mockFetchDeletedProjectIds.mockResolvedValue([])
    mockFetchDeletedGroupIds.mockResolvedValue([])
    mockFetchTombstones.mockResolvedValue([])
    mockRecordTombstone.mockResolvedValue(true)
    mockCheckTaskIdsAvailability.mockResolvedValue([])
    mockSafeCreateTask.mockResolvedValue({ status: 'created', message: 'Created' })
    mockLogDedupDecision.mockResolvedValue(undefined)
    mockRestoreBackupTransaction.mockResolvedValue(null)
    mockAuthUserId = 'user-1'

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
    it('binds an authenticated backup to its source account', async () => {
      const backup = await backupSystem.createBackup('manual')

      expect((backup as BackupData & { source?: unknown } | null)?.source).toEqual({
        kind: 'account',
        userId: 'user-1',
      })
    })

    it('captures projects and groups from every accessible remote scope', async () => {
      mockFetchProjects.mockResolvedValue([
        { id: 'personal-project', name: 'Personal', workspaceId: null },
        { id: 'shared-project', name: 'Shared', workspaceId: 'workspace-1' },
      ])
      mockFetchGroups.mockResolvedValue([
        { id: '00000000-0000-4000-8000-000000000001', name: 'Personal group', workspaceId: null },
        { id: '00000000-0000-4000-8000-000000000002', name: 'Shared group', workspaceId: 'workspace-1' },
      ])
      mockProjectStore.projects = [{ id: 'stale-project', name: 'Stale current view' }]
      mockCanvasStore.groups = [{ id: 'stale-group', name: 'Stale current view' }]

      const backup = await backupSystem.createBackup('manual')

      expect(mockFetchProjects).toHaveBeenCalledWith(undefined, expect.objectContaining({
        forceFresh: true,
        onError: expect.any(Function),
      }))
      expect(mockFetchGroups).toHaveBeenCalledWith(undefined, expect.objectContaining({
        forceFresh: true,
        onError: expect.any(Function),
      }))
      expect(backup?.projects.map(project => project.id)).toEqual([
        'personal-project',
        'shared-project',
        'stale-project',
      ])
      expect(backup?.groups.map(group => group.id)).toEqual([
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
        'stale-group',
      ])
    })

    it('refuses a current-schema artifact from a different account before any mutation', async () => {
      const backup = createMockBackup(1, Date.now(), {
        source: { kind: 'account', userId: 'another-user' },
      } as Partial<BackupData>)
      backup.checksum = calculateChecksum({
        source: (backup as BackupData & { source?: unknown }).source,
        tasks: backup.tasks,
        projects: backup.projects,
        groups: backup.groups,
      })

      const restored = await backupSystem.restoreBackup(backup)

      expect(restored).toBe(false)
      expect(backupSystem.state.value.error).toContain('different account')
      expect(mockCheckTaskIdsAvailability).not.toHaveBeenCalled()
      expect(mockRestoreBackupTransaction).not.toHaveBeenCalled()
    })

    it('does not present a different-account artifact as restorable in dry-run analysis', async () => {
      const backup = createMockBackup(1, Date.now(), {
        source: { kind: 'account', userId: 'another-user' },
      })

      const analysis = await backupSystem.analyzeRestore(backup)

      expect(analysis.canProceed).toBe(false)
      expect(analysis.warnings.join(' ')).toContain('different account')
      expect(mockCheckTaskIdsAvailability).not.toHaveBeenCalled()
    })

    it('refuses a shared-workspace artifact before creating an emergency checkpoint', async () => {
      const backup = createMockBackup(1, Date.now(), {
        source: { kind: 'account', userId: 'user-1' },
      } as Partial<BackupData>)
      backup.tasks[0].workspaceId = 'workspace-1'
      backup.metadata = {
        ...backup.metadata!,
        workspaceTaskCount: 1,
      }
      backup.checksum = calculateChecksum({
        source: (backup as BackupData & { source?: unknown }).source,
        tasks: backup.tasks,
        projects: backup.projects,
        groups: backup.groups,
      })

      const restored = await backupSystem.restoreBackup(backup, { skipDedupCheck: true })

      expect(restored).toBe(false)
      expect(backupSystem.state.value.error).toContain('shared workspace')
      expect(backupSystem.backupHistory.value).toEqual([])
      expect(mockRestoreBackupTransaction).not.toHaveBeenCalled()
    })

    it('keeps personal recovery available when an absolute backup also contains shared data', async () => {
      const backup = createMockBackup(2, Date.now(), {
        source: { kind: 'account', userId: 'user-1' },
      } as Partial<BackupData>)
      backup.tasks[1].workspaceId = 'workspace-1'
      backup.tasks[0].projectId = 'shared-project'
      backup.tasks[0].parentTaskId = 'task-2'
      backup.tasks[0].parentId = 'shared-group'
      backup.tasks[0].recurrenceParentId = 'task-2'
      backup.tasks[0].dependsOn = ['task-2']
      backup.tasks[0].connectionTypes = { 'task-2': 'blocker' }
      backup.tasks[0].assignedTo = 'former-workspace-member'
      backup.projects = [{
        id: 'shared-project',
        name: 'Shared project',
        workspaceId: 'workspace-1',
      }] as any
      backup.groups = [{
        id: 'shared-group',
        name: 'Shared group',
        workspaceId: 'workspace-1',
      }] as any
      backup.tombstones = [{
        entityType: 'task',
        entityId: 'unknown-scope-deletion',
      }]
      backup.metadata = {
        ...backup.metadata!,
        workspaceTaskCount: 1,
        tombstoneCount: 1,
        projectCount: 1,
        groupCount: 1,
      }
      backup.checksum = calculateChecksum({
        source: (backup as BackupData & { source?: unknown }).source,
        tasks: backup.tasks,
        projects: backup.projects,
        groups: backup.groups,
        tombstones: backup.tombstones,
      })

      const analysis = await backupSystem.analyzeRestore(backup)

      expect(analysis.canProceed).toBe(true)
      expect(analysis.tasks.toRestore.map(task => task.id)).toEqual(['task-1'])
      expect(analysis.tasks.toRestore[0]).toEqual(expect.objectContaining({
        projectId: '',
        parentTaskId: null,
        parentId: undefined,
        recurrenceParentId: undefined,
        dependsOn: [],
        connectionTypes: {},
        assignedTo: null,
      }))
      expect(analysis.projects.toRestore).toBe(0)
      expect(analysis.groups.toRestore).toBe(0)
      expect(analysis.tasks.skipped).toEqual(expect.arrayContaining([
        expect.objectContaining({
          task: expect.objectContaining({ id: 'task-2' }),
          status: 'shared_workspace',
        }),
      ]))
      expect(analysis.tombstones.toRestore).toBe(0)
      expect(analysis.warnings.join(' ')).toContain('shared workspace')
      expect(analysis.warnings.join(' ')).toContain('tombstones')
      expect(mockCheckTaskIdsAvailability).toHaveBeenCalledWith(['task-1'])
    })

    it('restores only the personal partition of a checksummed mixed-scope artifact', async () => {
      const backup = createMockBackup(2, Date.now(), {
        source: { kind: 'account', userId: 'user-1' },
      } as Partial<BackupData>)
      backup.tasks[1].workspaceId = 'workspace-1'
      backup.tombstones = [{
        entityType: 'task',
        entityId: 'unknown-scope-deletion',
      }]
      backup.metadata = {
        ...backup.metadata!,
        workspaceTaskCount: 1,
        tombstoneCount: 1,
      }
      backup.checksum = calculateChecksum({
        source: (backup as BackupData & { source?: unknown }).source,
        tasks: backup.tasks,
        projects: backup.projects,
        groups: backup.groups,
        tombstones: backup.tombstones,
      })
      mockRestoreBackupTransaction.mockResolvedValue({
        ok: true,
        tasksCreated: 1,
        tasksExisting: 0,
        projectsCreated: 0,
        projectsExisting: 0,
        groupsCreated: 0,
        groupsExisting: 0,
        tombstonesCreated: 0,
      })
      mockCheckTaskIdsAvailability.mockResolvedValue([
        { taskId: 'task-1', status: 'active', reason: 'exists' },
      ])

      const restored = await backupSystem.restoreBackup(backup, { skipDedupCheck: true })

      expect(restored).toBe(true)
      expect(mockRestoreBackupTransaction).toHaveBeenCalledWith(expect.objectContaining({
        artifactHash: backup.checksum,
        tasks: [expect.objectContaining({ id: 'task-1' })],
        projects: [],
        groups: [],
        tombstones: [],
      }))
      expect(mockSafeCreateTask).not.toHaveBeenCalled()
      expect(mockRecordTombstone).not.toHaveBeenCalled()
      expect(backupSystem.state.value.warning).toContain('Shared workspace data')
    })

    it('refuses to claim an emergency backup exists when durable storage rejects it', async () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('storage unavailable')
      })

      const backup = await backupSystem.createBackup('emergency')

      expect(backup).toBeNull()
      expect(backupSystem.state.value.error).toContain('persisted and verified')
      expect(backupSystem.backupHistory.value).toEqual([])
    })

    it('keeps the newest recovery point when quota pressure trims backup history', async () => {
      mockTaskStore.tasks = [{ id: 'quota-task', title: 'Quota task', status: 'todo' }]
      const first = await backupSystem.createBackup('manual')
      expect(first).not.toBeNull()

      let historyAttempts = 0
      localStorageMock.setItem.mockImplementation((key: string, value: string) => {
        if (key === STORAGE_KEYS.HISTORY && historyAttempts++ === 0) {
          throw new DOMException('quota', 'QuotaExceededError')
        }
        localStorageStore[key] = value
      })

      const emergency = await backupSystem.createBackup('emergency')
      const durableHistory = JSON.parse(
        localStorageStore[STORAGE_KEYS.HISTORY] || '[]'
      ) as BackupData[]

      expect(emergency).not.toBeNull()
      expect(durableHistory[0]?.id).toBe(emergency?.id)
      expect(durableHistory.some(item => item.id === first?.id)).toBe(false)
    })

    it('includes active, deleted, completion, and workspace task identities in inventory metadata', async () => {
      mockTaskStore.tasks = [
        { id: 'active-1', title: 'Active', status: 'todo' },
        { id: 'completion-1', title: 'Completion history', status: 'done', isCompletionRecord: true },
      ]
      mockFetchTasks.mockResolvedValue([
        { id: 'active-1', title: 'Older remote copy', status: 'todo' },
        { id: 'workspace-1', title: 'Shared', status: 'todo', workspaceId: 'workspace-a' },
      ])
      mockFetchTrash.mockResolvedValue([
        { id: 'deleted-1', title: 'Deleted but recoverable', status: 'todo', _soft_deleted: true },
      ])

      const backup = await backupSystem.createBackup('manual')

      expect(backup?.tasks.map(task => task.id).sort()).toEqual([
        'active-1',
        'completion-1',
        'deleted-1',
        'workspace-1',
      ])
      expect(backup?.metadata).toEqual(expect.objectContaining({
        taskCount: 4,
        activeTaskCount: 3,
        deletedTaskCount: 1,
        completionRecordCount: 1,
        workspaceTaskCount: 1,
      }))
      expect(backup?.tasks.find(task => task.id === 'active-1')?.title).toBe('Active')
    })

    it('refuses to publish an incomplete backup when deleted-task inventory cannot be read', async () => {
      mockTaskStore.tasks = [{ id: 'active-1', title: 'Active', status: 'todo' }]
      mockFetchTrash.mockImplementation(async (options?: { onError?: () => void }) => {
        options?.onError?.()
        return []
      })

      const backup = await backupSystem.createBackup('manual')

      expect(backup).toBeNull()
      expect(backupSystem.state.value.error).toContain('deleted-task inventory')
    })

    it.each([
      ['project', mockFetchProjects],
      ['group', mockFetchGroups],
    ] as const)(
      'refuses to publish an incomplete backup when %s inventory cannot be read',
      async (entityType, fetchInventory) => {
        mockTaskStore.tasks = [{ id: 'active-1', title: 'Active', status: 'todo' }]
        fetchInventory.mockImplementation(
          async (_workspaceId?: string | null, options?: { onError?: () => void }) => {
            options?.onError?.()
            return []
          },
        )

        const backup = await backupSystem.createBackup('manual')

        expect(backup).toBeNull()
        expect(backupSystem.state.value.error).toContain(`${entityType} inventory`)
      },
    )

    it('includes permanent-delete tombstones in the checksummed inventory', async () => {
      mockTaskStore.tasks = [{ id: 'active-1', title: 'Active', status: 'todo' }]
      mockFetchTombstones.mockResolvedValue([
        { entityType: 'task', entityId: 'gone-task' },
        { entityType: 'project', entityId: 'gone-project' },
      ])

      const backup = await backupSystem.createBackup('manual')

      expect(backup?.tombstones).toEqual([
        { entityType: 'task', entityId: 'gone-task' },
        { entityType: 'project', entityId: 'gone-project' },
      ])
      expect(backup?.metadata?.tombstoneCount).toBe(2)
    })

    it('refuses an artifact that contains both a task and its permanent-delete tombstone', async () => {
      mockTaskStore.tasks = [{
        id: 'stale-task',
        title: 'Stale row retained by another window',
        status: 'todo',
      }]
      mockFetchTombstones.mockResolvedValue([
        { entityType: 'task', entityId: 'stale-task' },
      ])

      const backup = await backupSystem.createBackup('manual')

      expect(backup).toBeNull()
      expect(backupSystem.state.value.error).toContain('contradictory permanent-delete inventory')
      expect(localStorageMock.setItem).not.toHaveBeenCalledWith(
        STORAGE_KEYS.LATEST,
        expect.any(String),
      )
    })

    it.each([
      {
        entityType: 'project' as const,
        entityId: 'stale-project',
        arrange: () => {
          mockProjectStore.projects = [{ id: 'stale-project', name: 'Stale project' }]
        },
      },
      {
        entityType: 'group' as const,
        entityId: 'stale-group',
        arrange: () => {
          mockCanvasStore.groups = [{ id: 'stale-group', name: 'Stale group' }]
        },
      },
    ])('refuses a live $entityType and matching permanent-delete tombstone', async ({
      entityType,
      entityId,
      arrange,
    }) => {
      arrange()
      mockFetchTombstones.mockResolvedValue([{ entityType, entityId }])

      const backup = await backupSystem.createBackup('manual')

      expect(backup).toBeNull()
      expect(backupSystem.state.value.error).toContain('contradictory permanent-delete inventory')
    })

    it('preserves legitimate tasks with test-like titles in default backups', async () => {
      mockTaskStore.tasks = [
        { id: 'real-new-task', title: 'New Task', status: 'todo' },
        { id: 'real-test-task', title: 'Test Task 2', status: 'todo' },
        { id: 'real-performance-task', title: 'Performance testing', status: 'todo' },
      ]

      const backup = await backupSystem.createBackup('manual')

      expect(backup?.tasks.map(task => task.id)).toEqual([
        'real-new-task',
        'real-test-task',
        'real-performance-task',
      ])
    })

    it('refuses to publish a backup when permanent-delete inventory cannot be read', async () => {
      mockFetchTombstones.mockImplementation(async (options?: { onError?: () => void }) => {
        options?.onError?.()
        return []
      })

      const backup = await backupSystem.createBackup('manual')

      expect(backup).toBeNull()
      expect(backupSystem.state.value.error).toContain('permanent-delete inventory')
    })

    it('should include all required fields in backup', async () => {
      mockTaskStore.tasks = [{ id: 'task-1', title: 'Task 1' }]
      mockProjectStore.projects = [{ id: 'proj-1', name: 'Project 1' }]
      mockCanvasStore.groups = [{ id: 'group-1', name: 'Group 1' }]

      const backup = await backupSystem.createBackup('manual')

      expect(backup).toBeDefined()
      expect(backup?.id).toBeDefined()
      expect(backup?.timestamp).toBeDefined()
      expect(backup?.version).toBe(BACKUP_SCHEMA_VERSION)
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
      localStorageMock.setItem('flowstate-backup-golden', 'invalid-json{')

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
        version: BACKUP_SCHEMA_VERSION,
        checksum: 'abc',
        type: 'manual' as const,
        // No metadata
      }

      localStorageMock.setItem('flowstate-backup-golden', JSON.stringify(backupWithoutMetadata))

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

      localStorageMock.setItem('flowstate-backup-golden', JSON.stringify(backup))

      const validation = await backupSystem.validateGoldenBackup()

      expect(validation?.isValid).toBe(true)
      expect(validation?.ageWarning).toContain('days old')
      expect(validation?.warnings.some(w => w.includes('days old'))).toBe(true)
    })

    it('should not warn for recent golden backup', async () => {
      const recentTimestamp = Date.now() - (1 * 24 * 60 * 60 * 1000) // 1 day ago
      const backup = createMockBackup(10, recentTimestamp)

      localStorageMock.setItem('flowstate-backup-golden', JSON.stringify(backup))

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
      localStorageMock.setItem('flowstate-backup-golden-rotation', JSON.stringify([backup1]))
      useBackupSystem() // Trigger potential migration

      localStorageMock.setItem('flowstate-backup-golden-rotation', JSON.stringify([backup2, backup1]))
      useBackupSystem() // Trigger potential migration

      localStorageMock.setItem('flowstate-backup-golden-rotation', JSON.stringify([backup3, backup2, backup1]))
      useBackupSystem() // Trigger potential migration

      // After 4th, rotation should have only 3
      localStorageMock.setItem('flowstate-backup-golden-rotation', JSON.stringify([backup4, backup3, backup2]))

      const backupSystem = useBackupSystem()
      const rotation = backupSystem.getGoldenBackups()

      expect(rotation.length).toBeLessThanOrEqual(3)
    })

    it('should return golden backups sorted by task count descending', () => {
      const backup1 = createMockBackup(10, Date.now() - 3000)
      const backup2 = createMockBackup(30, Date.now() - 2000)
      const backup3 = createMockBackup(20, Date.now() - 1000)

      localStorageMock.setItem('flowstate-backup-golden-rotation', JSON.stringify([backup1, backup2, backup3]))

      const backupSystem = useBackupSystem()
      const rotation = backupSystem.getGoldenBackups()

      expect(rotation[0].metadata?.taskCount).toBe(30)
      expect(rotation[1].metadata?.taskCount).toBe(20)
      expect(rotation[2].metadata?.taskCount).toBe(10)
    })

    it('should migrate legacy single golden backup to rotation', () => {
      const legacyBackup = createMockBackup(50, Date.now())

      // Set only legacy key
      localStorageMock.setItem('flowstate-backup-golden', JSON.stringify(legacyBackup))

      const backupSystem = useBackupSystem()
      const rotation = backupSystem.getGoldenBackups()

      expect(rotation).toHaveLength(1)
      expect(rotation[0].metadata?.taskCount).toBe(50)

      // Verify migration created the rotation array
      const rotationStored = localStorageMock.getItem('flowstate-backup-golden-rotation')
      expect(rotationStored).not.toBeNull()
    })

    it('getGoldenBackup should return the highest peak from rotation', () => {
      const backup1 = createMockBackup(10, Date.now() - 2000)
      const backup2 = createMockBackup(50, Date.now() - 1000) // Highest
      const backup3 = createMockBackup(30, Date.now())

      localStorageMock.setItem('flowstate-backup-golden-rotation', JSON.stringify([backup1, backup2, backup3]))

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
      localStorageMock.setItem('flowstate-max-task-count', '100')

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
      localStorageMock.setItem('flowstate-max-task-count', '100')

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
      localStorageMock.setItem('flowstate-max-task-count', '10')

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

    it('reports a tombstone-only artifact as actionable recovery work', async () => {
      const backup = createMockBackup(0)
      backup.tombstones = [{ entityType: 'task', entityId: 'gone-task' }]
      backup.metadata = { ...backup.metadata!, tombstoneCount: 1 }

      const analysis = await backupSystem.analyzeRestore(backup)

      expect(analysis.tombstones).toEqual({ total: 1, toRestore: 1 })
      expect(analysis.canProceed).toBe(true)
    })
  })

  describe('Restore execution fails closed', () => {
    it('uses one atomic database transaction for the complete durable restore set', async () => {
      const incoming = createMockBackup(1, Date.now(), {
        projects: [{
          id: 'project-1',
          name: 'Recovered project',
          color: '#123456',
          createdAt: new Date().toISOString(),
        }] as any[],
        groups: [{
          id: '00000000-0000-4000-8000-000000000001',
          name: 'Recovered group',
          type: 'status',
          position: { x: 0, y: 0, width: 100, height: 100 },
        }] as any[],
        tombstones: [{ entityType: 'task', entityId: 'gone-task' }],
        metadata: {
          taskCount: 1,
          projectCount: 1,
          groupCount: 1,
          tombstoneCount: 1,
        },
      })
      incoming.checksum = calculateChecksum({
        source: incoming.source,
        tasks: incoming.tasks,
        projects: incoming.projects,
        groups: incoming.groups,
        tombstones: incoming.tombstones,
      })
      mockCheckTaskIdsAvailability
        .mockResolvedValueOnce([
          { taskId: 'task-1', status: 'available', reason: '' },
        ])
        .mockResolvedValueOnce([
          { taskId: 'task-1', status: 'active', reason: 'Readable after commit' },
        ])
      mockFetchTombstones
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ entityType: 'task', entityId: 'gone-task' }])
      mockRestoreBackupTransaction.mockResolvedValue({
        ok: true,
        tasksCreated: 1,
        projectsCreated: 1,
        groupsCreated: 1,
        tombstonesCreated: 1,
      })

      const restored = await backupSystem.restoreBackup(incoming)

      expect(restored).toBe(true)
      expect(mockRestoreBackupTransaction).toHaveBeenCalledWith({
        operationId: incoming.id,
        artifactHash: incoming.checksum,
        schemaVersion: incoming.version,
        tasks: incoming.tasks,
        projects: incoming.projects,
        groups: incoming.groups,
        tombstones: incoming.tombstones,
      })
      expect(mockSafeCreateTask).not.toHaveBeenCalled()
      expect(mockSaveProjects).not.toHaveBeenCalled()
      expect(mockSaveGroup).not.toHaveBeenCalled()
      expect(mockRecordTombstone).not.toHaveBeenCalled()
    })

    it('reports refresh-needed instead of claiming a committed atomic restore failed', async () => {
      const incoming = createMockBackup(1)
      incoming.checksum = calculateChecksum({
        source: incoming.source,
        tasks: incoming.tasks,
        projects: incoming.projects,
        groups: incoming.groups,
      })
      mockCheckTaskIdsAvailability
        .mockResolvedValueOnce([
          { taskId: 'task-1', status: 'available', reason: '' },
        ])
        .mockResolvedValueOnce([])
      mockRestoreBackupTransaction.mockResolvedValue({
        ok: true,
        tasksCreated: 1,
        projectsCreated: 0,
        groupsCreated: 0,
        tombstonesCreated: 0,
      })

      const restored = await backupSystem.restoreBackup(incoming)

      expect(restored).toBe(true)
      expect(backupSystem.state.value.error).toBeNull()
      expect(backupSystem.state.value.warning).toContain('Restore committed')
      expect(backupSystem.state.value.warning).toContain('Refresh is required')
    })

    it('reports refresh-needed when committed task verification cannot be fetched', async () => {
      const incoming = createMockBackup(1)
      incoming.checksum = calculateChecksum({
        source: incoming.source,
        tasks: incoming.tasks,
        projects: incoming.projects,
        groups: incoming.groups,
      })
      mockCheckTaskIdsAvailability
        .mockResolvedValueOnce([
          { taskId: 'task-1', status: 'available', reason: '' },
        ])
        .mockRejectedValueOnce(new Error('Task verification unavailable'))
      mockRestoreBackupTransaction.mockResolvedValue({
        ok: true,
        tasksCreated: 1,
        projectsCreated: 0,
        groupsCreated: 0,
        tombstonesCreated: 0,
      })

      const restored = await backupSystem.restoreBackup(incoming)

      expect(restored).toBe(true)
      expect(backupSystem.state.value.error).toBeNull()
      expect(backupSystem.state.value.warning).toContain('task verification')
      expect(backupSystem.state.value.warning).toContain('Refresh is required')
    })

    it('does not report failure when committed tombstones are temporarily unreadable', async () => {
      const incoming = createMockBackup(0, Date.now(), {
        tombstones: [{ entityType: 'task', entityId: 'committed-gone-task' }],
        metadata: {
          taskCount: 0,
          projectCount: 0,
          groupCount: 0,
          tombstoneCount: 1,
        },
      })
      incoming.checksum = calculateChecksum({
        source: incoming.source,
        tasks: incoming.tasks,
        projects: incoming.projects,
        groups: incoming.groups,
        tombstones: incoming.tombstones,
      })
      mockFetchTombstones.mockResolvedValue([])
      mockRestoreBackupTransaction.mockResolvedValue({
        ok: true,
        tasksCreated: 0,
        projectsCreated: 0,
        groupsCreated: 0,
        tombstonesCreated: 1,
      })

      const restored = await backupSystem.restoreBackup(incoming)

      expect(restored).toBe(true)
      expect(backupSystem.state.value.error).toBeNull()
      expect(backupSystem.state.value.warning).toContain('permanent deletions')
      expect(backupSystem.state.value.warning).toContain('Refresh is required')
    })

    it('reports refresh-needed when committed tombstone verification cannot be fetched', async () => {
      const incoming = createMockBackup(0, Date.now(), {
        tombstones: [{ entityType: 'task', entityId: 'committed-gone-task' }],
        metadata: {
          taskCount: 0,
          projectCount: 0,
          groupCount: 0,
          tombstoneCount: 1,
        },
      })
      incoming.checksum = calculateChecksum({
        source: incoming.source,
        tasks: incoming.tasks,
        projects: incoming.projects,
        groups: incoming.groups,
        tombstones: incoming.tombstones,
      })
      mockFetchTombstones
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('Tombstone verification unavailable'))
      mockRestoreBackupTransaction.mockResolvedValue({
        ok: true,
        tasksCreated: 0,
        projectsCreated: 0,
        groupsCreated: 0,
        tombstonesCreated: 1,
      })

      const restored = await backupSystem.restoreBackup(incoming)

      expect(restored).toBe(true)
      expect(backupSystem.state.value.error).toBeNull()
      expect(backupSystem.state.value.warning).toContain('permanent-deletion verification')
      expect(backupSystem.state.value.warning).toContain('Refresh is required')
    })

    it('restores child-before-parent artifacts in parent-first order', async () => {
      const incoming = createMockBackup(0, Date.now(), {
        tasks: [
          {
            id: 'child-task',
            title: 'Child',
            status: 'todo',
            parentTaskId: 'parent-task',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'parent-task',
            title: 'Parent',
            status: 'todo',
            createdAt: new Date().toISOString(),
          },
        ] as any[],
        metadata: {
          taskCount: 2,
          projectCount: 0,
          groupCount: 0,
        },
      })
      incoming.checksum = calculateChecksum({
        source: incoming.source,
        tasks: incoming.tasks,
        projects: incoming.projects,
        groups: incoming.groups,
      })
      mockCheckTaskIdsAvailability.mockResolvedValue([
        { taskId: 'parent-task', status: 'active', reason: 'Readable' },
        { taskId: 'child-task', status: 'active', reason: 'Readable' },
      ])

      const restored = await backupSystem.restoreBackup(incoming, { skipDedupCheck: true })

      expect(restored).toBe(true)
      expect(mockSafeCreateTask.mock.calls.map(([task]) => task.id)).toEqual([
        'parent-task',
        'child-task',
      ])
    })

    it.each([
      {
        name: 'missing parent',
        tasks: [
          {
            id: 'orphan-task',
            title: 'Orphan',
            status: 'todo',
            parentTaskId: 'absent-parent',
            createdAt: new Date().toISOString(),
          },
        ],
        error: 'missing parent',
      },
      {
        name: 'parent cycle',
        tasks: [
          {
            id: 'cycle-a',
            title: 'Cycle A',
            status: 'todo',
            parentTaskId: 'cycle-b',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'cycle-b',
            title: 'Cycle B',
            status: 'todo',
            parentTaskId: 'cycle-a',
            createdAt: new Date().toISOString(),
          },
        ],
        error: 'cycle',
      },
    ])('rejects a $name before any restore mutation', async ({ tasks, error }) => {
      const incoming = createMockBackup(0, Date.now(), {
        tasks: tasks as any[],
        metadata: {
          taskCount: tasks.length,
          projectCount: 0,
          groupCount: 0,
        },
      })
      incoming.checksum = calculateChecksum({
        source: incoming.source,
        tasks: incoming.tasks,
        projects: incoming.projects,
        groups: incoming.groups,
      })

      const restored = await backupSystem.restoreBackup(incoming, { skipDedupCheck: true })

      expect(restored).toBe(false)
      expect(backupSystem.state.value.error?.toLowerCase()).toContain(error)
      expect(mockSafeCreateTask).not.toHaveBeenCalled()
      expect(mockSaveProjects).not.toHaveBeenCalled()
      expect(mockSaveGroup).not.toHaveBeenCalled()
      expect(mockRecordTombstone).not.toHaveBeenCalled()
    })

    it('rejects a child whose artifact parent is tombstoned before restoring unrelated tasks', async () => {
      const incoming = createMockBackup(0, Date.now(), {
        tasks: [
          {
            id: 'unrelated-task',
            title: 'Unrelated',
            status: 'todo',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'tombstoned-parent',
            title: 'Parent',
            status: 'todo',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'dependent-child',
            title: 'Child',
            status: 'todo',
            parentTaskId: 'tombstoned-parent',
            createdAt: new Date().toISOString(),
          },
        ] as any[],
        metadata: {
          taskCount: 3,
          projectCount: 0,
          groupCount: 0,
        },
      })
      incoming.checksum = calculateChecksum({
        source: incoming.source,
        tasks: incoming.tasks,
        projects: incoming.projects,
        groups: incoming.groups,
      })
      mockCheckTaskIdsAvailability.mockResolvedValue([
        { taskId: 'unrelated-task', status: 'available', reason: '' },
        { taskId: 'tombstoned-parent', status: 'tombstoned', reason: 'Permanently deleted' },
        { taskId: 'dependent-child', status: 'available', reason: '' },
      ])

      const restored = await backupSystem.restoreBackup(incoming)

      expect(restored).toBe(false)
      expect(backupSystem.state.value.error).toContain('omitted parent tombstoned-parent')
      expect(mockSafeCreateTask).not.toHaveBeenCalled()
      expect(mockSaveProjects).not.toHaveBeenCalled()
      expect(mockSaveGroup).not.toHaveBeenCalled()
      expect(mockRecordTombstone).not.toHaveBeenCalled()
    })

    it('rejects a partially selected multi-level hierarchy before any restore mutation', async () => {
      const incoming = createMockBackup(0, Date.now(), {
        tasks: [
          {
            id: 'deleted-root',
            title: 'Root',
            status: 'todo',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'middle-task',
            title: 'Middle',
            status: 'todo',
            parentTaskId: 'deleted-root',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'leaf-task',
            title: 'Leaf',
            status: 'todo',
            parentTaskId: 'middle-task',
            createdAt: new Date().toISOString(),
          },
        ] as any[],
        metadata: {
          taskCount: 3,
          projectCount: 0,
          groupCount: 0,
        },
      })
      incoming.checksum = calculateChecksum({
        source: incoming.source,
        tasks: incoming.tasks,
        projects: incoming.projects,
        groups: incoming.groups,
      })
      mockCheckTaskIdsAvailability.mockResolvedValue([
        { taskId: 'deleted-root', status: 'tombstoned', reason: 'Permanently deleted' },
        { taskId: 'middle-task', status: 'available', reason: '' },
        { taskId: 'leaf-task', status: 'available', reason: '' },
      ])

      const restored = await backupSystem.restoreBackup(incoming)

      expect(restored).toBe(false)
      expect(backupSystem.state.value.error).toContain('omitted parent deleted-root')
      expect(mockSafeCreateTask).not.toHaveBeenCalled()
      expect(mockSaveProjects).not.toHaveBeenCalled()
      expect(mockSaveGroup).not.toHaveBeenCalled()
      expect(mockRecordTombstone).not.toHaveBeenCalled()
    })

    it('rejects a child whose omitted parent is only present in trash', async () => {
      const incoming = createMockBackup(0, Date.now(), {
        tasks: [
          {
            id: 'trashed-parent',
            title: 'Parent in trash',
            status: 'todo',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'visible-child',
            title: 'Child',
            status: 'todo',
            parentTaskId: 'trashed-parent',
            createdAt: new Date().toISOString(),
          },
        ] as any[],
        metadata: {
          taskCount: 2,
          projectCount: 0,
          groupCount: 0,
        },
      })
      incoming.checksum = calculateChecksum({
        source: incoming.source,
        tasks: incoming.tasks,
        projects: incoming.projects,
        groups: incoming.groups,
      })
      mockCheckTaskIdsAvailability.mockResolvedValue([
        { taskId: 'trashed-parent', status: 'soft_deleted', reason: 'Parent is in trash' },
        { taskId: 'visible-child', status: 'available', reason: '' },
      ])

      const restored = await backupSystem.restoreBackup(incoming)

      expect(restored).toBe(false)
      expect(backupSystem.state.value.error).toContain('omitted parent trashed-parent')
      expect(mockSafeCreateTask).not.toHaveBeenCalled()
      expect(mockSaveProjects).not.toHaveBeenCalled()
      expect(mockSaveGroup).not.toHaveBeenCalled()
      expect(mockRecordTombstone).not.toHaveBeenCalled()
    })

    it('does not mutate anything when the emergency rollback backup is refused', async () => {
      mockTaskStore.tasks = [{
        id: 'contradictory-live-task',
        title: 'Stale live state',
        status: 'todo',
      }]
      mockFetchTombstones.mockResolvedValue([
        { entityType: 'task', entityId: 'contradictory-live-task' },
      ])
      const incoming = createMockBackup(1)
      incoming.checksum = calculateChecksum({
        source: incoming.source,
        tasks: incoming.tasks,
        projects: incoming.projects,
        groups: incoming.groups,
      })

      const restored = await backupSystem.restoreBackup(incoming, { skipDedupCheck: true })

      expect(restored).toBe(false)
      expect(backupSystem.state.value.error).toContain('emergency rollback backup')
      expect(mockSafeCreateTask).not.toHaveBeenCalled()
      expect(mockSaveProjects).not.toHaveBeenCalled()
      expect(mockSaveGroup).not.toHaveBeenCalled()
      expect(mockRecordTombstone).not.toHaveBeenCalled()
    })

    it('refuses a validly checksummed artifact with contradictory deletion truth', async () => {
      const backup = createMockBackup(1)
      backup.tombstones = [{ entityType: 'task', entityId: 'task-1' }]
      backup.metadata = {
        ...backup.metadata!,
        tombstoneCount: 1,
      }
      backup.checksum = calculateChecksum({
        source: backup.source,
        tasks: backup.tasks,
        projects: backup.projects,
        groups: backup.groups,
        tombstones: backup.tombstones,
      })

      const restored = await backupSystem.restoreBackup(backup, { skipDedupCheck: true })

      expect(restored).toBe(false)
      expect(backupSystem.state.value.error).toContain('contradictory permanent-delete inventory')
      expect(mockSafeCreateTask).not.toHaveBeenCalled()
      expect(mockRecordTombstone).not.toHaveBeenCalled()
    })

    it('never discards unsynced task changes when a restore artifact is invalid', async () => {
      const queue = await import('@/services/offline/writeQueueDB')
      await queue.clearAll()
      await queue.enqueueOperation({
        entityType: 'task',
        operation: 'update',
        entityId: 'unsynced-task-1',
        payload: { title: 'Only copy of this edit' },
        userId: 'user-1',
        workspaceId: null,
      })
      const backup = createMockBackup(1, Date.now(), { checksum: 'tampered-checksum' })

      try {
        const restored = await backupSystem.restoreBackup(backup, { skipDedupCheck: true })

        expect(restored).toBe(false)
        expect(await queue.getPendingOperations()).toEqual([
          expect.objectContaining({
            entityId: 'unsynced-task-1',
            payload: { title: 'Only copy of this edit' },
          }),
        ])
      } finally {
        await queue.clearAll()
      }
    })

    it('blocks a valid restore until unsynced task changes are resolved', async () => {
      const queue = await import('@/services/offline/writeQueueDB')
      await queue.clearAll()
      await queue.enqueueOperation({
        entityType: 'task',
        operation: 'update',
        entityId: 'unsynced-task-2',
        payload: { title: 'Do not overwrite or discard me' },
        userId: 'user-1',
        workspaceId: null,
      })
      const backup = createMockBackup(1)
      backup.checksum = 'checksum_0'

      try {
        const restored = await backupSystem.restoreBackup(backup, { skipDedupCheck: true })

        expect(restored).toBe(false)
        expect(backupSystem.state.value.error).toContain('1 unsynced local change')
        expect(mockSafeCreateTask).not.toHaveBeenCalled()
        expect(await queue.getPendingOperations()).toEqual([
          expect.objectContaining({ entityId: 'unsynced-task-2' }),
        ])
      } finally {
        await queue.clearAll()
      }
    })

    it('refuses a backup whose checksum does not match its contents', async () => {
      const backup = createMockBackup(1, Date.now(), { checksum: 'tampered-checksum' })

      const restored = await backupSystem.restoreBackup(backup, { skipDedupCheck: true })

      expect(restored).toBe(false)
      expect(backupSystem.state.value.error).toContain('checksum')
      expect(mockSafeCreateTask).not.toHaveBeenCalled()
    })

    it('reports failure when any task could not be recreated', async () => {
      const backup = createMockBackup(2)
      backup.checksum = 'checksum_0'
      mockSafeCreateTask
        .mockResolvedValueOnce({ status: 'created', message: 'Created' })
        .mockResolvedValueOnce({ status: 'error', message: 'Database write failed' })

      const restored = await backupSystem.restoreBackup(backup, { skipDedupCheck: true })

      expect(restored).toBe(false)
      expect(backupSystem.state.value.error).toContain('1 of 2')
    })

    it('reports failure when a claimed restore is not readable afterward', async () => {
      const backup = createMockBackup(1)
      backup.checksum = 'checksum_0'
      mockCheckTaskIdsAvailability.mockResolvedValue([
        { taskId: 'task-1', status: 'available', reason: 'Task is still absent' },
      ])

      const restored = await backupSystem.restoreBackup(backup, { skipDedupCheck: true })

      expect(restored).toBe(false)
      expect(backupSystem.state.value.error).toContain('not readable')
    })

    it('accepts exact deleted-state readback when recovering a soft-deleted task', async () => {
      const backup = createMockBackup(1)
      backup.tasks[0]._soft_deleted = true
      backup.metadata = {
        ...backup.metadata!,
        activeTaskCount: 0,
        deletedTaskCount: 1,
        completionRecordCount: 0,
        workspaceTaskCount: 0,
      }
      backup.checksum = 'checksum_0'
      mockCheckTaskIdsAvailability.mockResolvedValue([
        { taskId: 'task-1', status: 'soft_deleted', reason: 'Deleted task is readable in Trash' },
      ])

      const restored = await backupSystem.restoreBackup(backup, { skipDedupCheck: true })

      expect(restored).toBe(true)
      expect(mockSafeCreateTask).toHaveBeenCalledWith(expect.objectContaining({
        id: 'task-1',
        _soft_deleted: true,
      }))
    })

    it('restores and verifies permanent-delete tombstones after recoverable entities', async () => {
      const backup = createMockBackup(1)
      backup.tombstones = [{ entityType: 'task', entityId: 'gone-task' }]
      backup.metadata = {
        ...backup.metadata!,
        tombstoneCount: 1,
      }
      backup.checksum = 'checksum_0'
      mockFetchTombstones
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ entityType: 'task', entityId: 'gone-task' }])
      mockCheckTaskIdsAvailability.mockResolvedValue([
        { taskId: 'task-1', status: 'active', reason: 'Task is readable' },
      ])

      const restored = await backupSystem.restoreBackup(backup, { skipDedupCheck: true })

      expect(restored).toBe(true)
      expect(mockRecordTombstone).toHaveBeenCalledWith('task', 'gone-task')
    })

    it('does not apply permanent-delete markers when recoverable entity restore fails', async () => {
      const backup = createMockBackup(1)
      backup.tombstones = [{ entityType: 'task', entityId: 'gone-task' }]
      backup.metadata = { ...backup.metadata!, tombstoneCount: 1 }
      backup.checksum = 'checksum_0'
      mockSafeCreateTask.mockResolvedValue({ status: 'error', message: 'Database write failed' })

      const restored = await backupSystem.restoreBackup(backup, { skipDedupCheck: true })

      expect(restored).toBe(false)
      expect(mockRecordTombstone).not.toHaveBeenCalled()
    })

    it('refuses a current-schema artifact with no checksum', async () => {
      const backup = createMockBackup(1, Date.now(), { checksum: '' })

      const restored = await backupSystem.restoreBackup(backup, { skipDedupCheck: true })

      expect(restored).toBe(false)
      expect(backupSystem.state.value.error).toContain('checksum is required')
      expect(mockSafeCreateTask).not.toHaveBeenCalled()
    })

    it('refuses a current-schema artifact with no source-account provenance', async () => {
      const backup = createMockBackup(1) as BackupData & { source?: BackupData['source'] }
      delete backup.source

      const restored = await backupSystem.restoreBackup(backup as BackupData, { skipDedupCheck: true })

      expect(restored).toBe(false)
      expect(backupSystem.state.value.error).toContain('source account')
      expect(mockCheckTaskIdsAvailability).not.toHaveBeenCalled()
      expect(mockRestoreBackupTransaction).not.toHaveBeenCalled()
    })

    it('detects source-account provenance tampering through the checksum', async () => {
      const backup = createMockBackup(1)
      backup.source = { kind: 'account', userId: 'another-user' }
      backup.checksum = calculateChecksum({
        source: backup.source,
        tasks: backup.tasks,
        projects: backup.projects,
        groups: backup.groups,
      })
      backup.source = { kind: 'account', userId: 'user-1' }

      const restored = await backupSystem.restoreBackup(backup, { skipDedupCheck: true })

      expect(restored).toBe(false)
      expect(backupSystem.state.value.error).toContain('checksum mismatch')
      expect(mockRestoreBackupTransaction).not.toHaveBeenCalled()
    })

    it('refuses a current-schema artifact with no count metadata', async () => {
      const backup = createMockBackup(1)
      delete backup.metadata

      const restored = await backupSystem.restoreBackup(backup, { skipDedupCheck: true })

      expect(restored).toBe(false)
      expect(backupSystem.state.value.error).toContain('metadata is required')
      expect(mockSafeCreateTask).not.toHaveBeenCalled()
    })

    it('does not present a source-less legacy artifact as restorable while signed in', async () => {
      const backup = createMockBackup(1, Date.now(), {
        version: '3.1.0',
        checksum: 'legacy-serialization-checksum',
      }) as BackupData & { source?: BackupData['source'] }
      delete backup.source

      const analysis = await backupSystem.analyzeRestore(backup as BackupData)

      expect(analysis.canProceed).toBe(false)
      expect(analysis.warnings.join(' ')).toContain('guest mode')
      expect(mockCheckTaskIdsAvailability).not.toHaveBeenCalled()
    })

    it('accepts a structurally valid legacy artifact with its old unstable checksum in guest mode', async () => {
      const backup = createMockBackup(1, Date.now(), {
        version: '3.1.0',
        checksum: 'legacy-serialization-checksum',
      }) as BackupData & { source?: BackupData['source'] }
      delete backup.source
      mockAuthUserId = null
      mockCheckTaskIdsAvailability.mockResolvedValue([
        { taskId: 'task-1', status: 'active', reason: 'Task is readable' },
      ])

      const restored = await backupSystem.restoreBackup(backup as BackupData, { skipDedupCheck: true })

      expect(restored).toBe(true)
      expect(mockSafeCreateTask).toHaveBeenCalledTimes(1)
    })

    it('restores a valid 3.2.0 backup that predates tombstone inventory', async () => {
      const backup = createMockBackup(1, Date.now(), { version: '3.2.0' }) as BackupData & { source?: BackupData['source'] }
      delete backup.source
      mockAuthUserId = null
      mockCheckTaskIdsAvailability.mockResolvedValue([
        { taskId: 'task-1', status: 'active', reason: 'Task is readable' },
      ])

      const restored = await backupSystem.restoreBackup(backup as BackupData, { skipDedupCheck: true })

      expect(restored).toBe(true)
      expect(mockSafeCreateTask).toHaveBeenCalledTimes(1)
    })
  })

  describe('Recovery entrypoints preserve validated artifacts', () => {
    it('recomputes integrity after filtering intentionally deleted golden items', async () => {
      mockTaskStore.tasks = [
        { id: 'task-1', title: 'Recover me', status: 'todo' },
        { id: 'task-2', title: 'Keep deleted', status: 'todo' },
      ]
      const backup = await backupSystem.createBackup('manual')
      expect(backup).not.toBeNull()
      mockFetchDeletedTaskIds.mockResolvedValue(['task-2'])
      mockCheckTaskIdsAvailability
        .mockResolvedValueOnce([
          { taskId: 'task-1', status: 'available', reason: '' },
        ])
        .mockResolvedValueOnce([
          { taskId: 'task-1', status: 'active', reason: 'Task is readable' },
        ])

      const restored = await backupSystem.restoreFromGoldenBackup(true)

      expect(restored).toBe(true)
      expect(mockSafeCreateTask).toHaveBeenCalledTimes(1)
      expect(mockSafeCreateTask).toHaveBeenCalledWith(expect.objectContaining({ id: 'task-1' }))
    })

    it('adds a valid checksum before restoring a shadow snapshot', async () => {
      mockCheckTaskIdsAvailability
        .mockResolvedValueOnce([
          { taskId: 'shadow-task', status: 'available', reason: '' },
        ])
        .mockResolvedValueOnce([
          { taskId: 'shadow-task', status: 'active', reason: 'Task is readable' },
        ])
      const shadow = {
        source: { kind: 'account', userId: 'user-1' },
        tasks: [{ id: 'shadow-task', title: 'Shadow recovery', status: 'todo' }],
        projects: [],
        groups: [],
        meta: {
          timestamp: Date.now(),
          counts: { tasks: 1, projects: 0, groups: 0 },
        },
      }

      const restored = await backupSystem.restoreFromShadow(shadow)

      expect(restored).toBe(true)
      expect(mockSafeCreateTask).toHaveBeenCalledWith(expect.objectContaining({ id: 'shadow-task' }))
    })

    it('refuses to relabel a source-less shadow snapshot as the current account', async () => {
      const shadow = {
        tasks: [{ id: 'foreign-shadow-task', title: 'Unknown source', status: 'todo' }],
        projects: [],
        groups: [],
        meta: {
          timestamp: Date.now(),
          counts: { tasks: 1, projects: 0, groups: 0 },
        },
      }

      const restored = await backupSystem.restoreFromShadow(shadow)

      expect(restored).toBe(false)
      expect(backupSystem.state.value.error).toContain('source account')
      expect(mockCheckTaskIdsAvailability).not.toHaveBeenCalled()
      expect(mockRestoreBackupTransaction).not.toHaveBeenCalled()
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
