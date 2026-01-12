
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBackupSystem } from '../../src/composables/useBackupSystem';

// Mock dependencies
const mockFetchDeletedTaskIds = vi.fn();
const mockFetchDeletedProjectIds = vi.fn();
const mockFetchDeletedGroupIds = vi.fn();
const mockSaveTasks = vi.fn();
const mockSaveProjects = vi.fn();
const mockSaveGroup = vi.fn();

// Mock useSupabaseDatabaseV2
vi.mock('@/composables/useSupabaseDatabaseV2', () => ({
    useSupabaseDatabase: () => ({
        fetchDeletedTaskIds: mockFetchDeletedTaskIds,
        fetchDeletedProjectIds: mockFetchDeletedProjectIds,
        fetchDeletedGroupIds: mockFetchDeletedGroupIds,
        saveTasks: mockSaveTasks,
        saveProjects: mockSaveProjects,
        saveGroup: mockSaveGroup,
    }),
}));

// Mock Integrity Service
vi.mock('@/utils/integrity', () => ({
    default: {
        calculateChecksum: vi.fn(() => 'abc'),
    },
}));

// Mock Stores
const mockTaskStore = { tasks: [] };
const mockProjectStore = { projects: [] };
const mockCanvasStore = { groups: [] };

vi.mock('@/stores/tasks', () => ({ useTaskStore: () => mockTaskStore }));
vi.mock('@/stores/projects', () => ({ useProjectStore: () => mockProjectStore }));
vi.mock('@/stores/canvas', () => ({ useCanvasStore: () => mockCanvasStore }));

// Mock localStorage
const localStorageMock = (function () {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value.toString(); }),
        clear: vi.fn(() => { store = {}; }),
        removeItem: vi.fn((key: string) => { delete store[key]; })
    };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('Task 153: Backup Validation', () => {
    let backupSystem: ReturnType<typeof useBackupSystem>;

    beforeEach(() => {
        vi.clearAllMocks();
        localStorageMock.clear();
        backupSystem = useBackupSystem();
    });

    const createMockBackup = (timestamp: number, tasks: any[] = []) => ({
        id: 'test-backup',
        tasks,
        projects: [],
        groups: [],
        timestamp,
        version: '3.1.0',
        checksum: 'abc',
        type: 'manual' as const,
        metadata: {
            taskCount: tasks.length,
            projectCount: 0,
            groupCount: 0
        }
    });

    it('validateGoldenBackup warns if backup is too old (>7 days)', async () => {
        const oldTimestamp = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago
        const backup = createMockBackup(oldTimestamp);

        // Setup golden backup in localStorage
        localStorageMock.setItem('pomo-flow-golden-backup', JSON.stringify(backup));

        const validation = await backupSystem.validateGoldenBackup();

        expect(validation?.isValid).toBe(true);
        expect(validation?.warnings.some(w => w.includes('days old'))).toBe(true);
    });

    it('validateGoldenBackup identifies deleted tasks', async () => {
        const backup = createMockBackup(Date.now(), [
            { id: 'task-1', title: 'Task 1' },
            { id: 'task-2', title: 'Task 2' }
        ]);

        localStorageMock.setItem('pomo-flow-golden-backup', JSON.stringify(backup));

        // Mock Supabase returning 'task-1' as deleted
        mockFetchDeletedTaskIds.mockResolvedValue(['task-1']);

        const validation = await backupSystem.validateGoldenBackup();

        expect(validation?.preview.tasks.total).toBe(2);
        expect(validation?.preview.tasks.filtered).toBe(1); // Task 1 filtered
        expect(validation?.preview.tasks.toRestore).toBe(1); // Task 2 remains
        expect(validation?.warnings.some(w => w.includes('1 tasks will be skipped'))).toBe(true);
    });

    it('restoreFromGoldenBackup filters out deleted items', async () => {
        const backup = createMockBackup(Date.now(), [
            { id: 'task-1', title: 'Task 1' },
            { id: 'task-2', title: 'Task 2' }
        ]);

        localStorageMock.setItem('pomo-flow-golden-backup', JSON.stringify(backup));
        mockFetchDeletedTaskIds.mockResolvedValue(['task-1']);

        // Execute restore
        await backupSystem.restoreFromGoldenBackup();

        // Verify saveTasks was called with ONLY task-2
        expect(mockSaveTasks).toHaveBeenCalledTimes(1);
        const savedTasks = mockSaveTasks.mock.calls[0][0];
        expect(savedTasks).toHaveLength(1);
        expect(savedTasks[0].id).toBe('task-2');
    });
});
