
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCanvasAlignment } from '../../src/composables/canvas/useCanvasAlignment';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';

// Mock Global Variables
const mockSelectedNodeIds = vi.hoisted(() => ['A', 'B', 'C']);
const mockMessageWarning = vi.fn();
const mockMessageLoading = vi.fn();
const mockMessageError = vi.fn();
const mockMessageSuccess = vi.fn();

// Mock Naive UI
vi.mock('naive-ui', () => ({
    useMessage: () => ({
        success: mockMessageSuccess,
        error: mockMessageError,
        warning: mockMessageWarning,
        loading: mockMessageLoading
    })
}));

// Mock Vue Flow
const mockGetSelectedNodes = vi.fn();
vi.mock('@vue-flow/core', () => ({
    useVueFlow: () => ({
        getSelectedNodes: mockGetSelectedNodes,
        getNodes: { value: [] },
        onNodesChange: vi.fn(),
    }),
    useVueFlowStore: () => ({ /* stub */ })
}));

// Mock Task Store
const mockUpdateTask = vi.fn();
const mockUpdateGroup = vi.fn();
const mockBatchUpdate = vi.fn();

vi.mock('../../src/stores/tasks', () => ({
    useTaskStore: () => ({
        updateTask: mockUpdateTask,
        updateGroup: mockUpdateGroup,
        batchUpdate: mockBatchUpdate,
    })
}));

vi.mock('../../src/stores/canvas', () => ({
    useCanvasStore: () => ({
        selectedNodeIds: mockSelectedNodeIds
    })
}));

vi.mock('../../src/composables/undoSingleton', () => ({
    getUndoSystem: () => ({
        saveState: vi.fn(),
        commit: vi.fn(),
        pauseRecording: vi.fn(),
        resumeRecording: vi.fn()
    })
}));

// Helper to create a mock node
const createNode = (id: string, x: number, y: number, w: number, h: number) => ({
    id,
    type: 'taskNode',
    position: { x, y },
    computedPosition: { x, y, z: 0 },
    width: w,
    height: h,
    dimensions: { width: w, height: h },
    data: {},
    events: {},
    handleBounds: {},
    selected: true
});

describe('useCanvasAlignment Logic', () => {
    // Mocks for useCanvasAlignment arguments
    const mockNodes = ref<any[]>([]);
    const mockStatus = {
        isVueFlowMounted: ref(true),
        isVueFlowReady: ref(true),
        isCanvasReady: ref(true)
    };
    const mockActions = {
        closeCanvasContextMenu: vi.fn()
    };

    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        mockNodes.value = [];
        document.body.innerHTML = '<div class="vue-flow"></div>';
        // Reset global mock store ids
        mockSelectedNodeIds.length = 0;
    });

    it('alignLeft: should align all selected nodes to the leftmost X', async () => {
        // Setup nodes
        const nodes = [
            createNode('A', 100, 100, 100, 100),
            createNode('B', 200, 100, 100, 100),
            createNode('C', 50, 100, 100, 100),
        ];

        mockNodes.value = nodes;
        mockGetSelectedNodes.mockReturnValue(nodes);
        mockSelectedNodeIds.splice(0, 0, ...nodes.map(n => n.id));

        const { alignLeft } = useCanvasAlignment(mockNodes, mockStatus, mockActions);
        alignLeft();
        await new Promise(resolve => setTimeout(resolve, 0));

        // A -> 50
        expect(mockUpdateTask).toHaveBeenCalledWith('A', expect.objectContaining({ canvasPosition: { x: 50, y: 100 } }), 'DRAG');
        // B -> 50
        expect(mockUpdateTask).toHaveBeenCalledWith('B', expect.objectContaining({ canvasPosition: { x: 50, y: 100 } }), 'DRAG');
        // C -> 50
        expect(mockUpdateTask).toHaveBeenCalledWith('C', expect.objectContaining({ canvasPosition: { x: 50, y: 100 } }), 'DRAG');
    });

    it('alignRight: should align right edges (Dimension Aware)', async () => {
        // A: Right=200, B: Right=250, C: Right=300 (Max)
        const nodes = [
            createNode('A', 100, 0, 100, 100),
            createNode('B', 200, 0, 50, 50),
            createNode('C', 0, 0, 300, 100),
        ];

        mockNodes.value = nodes;
        mockGetSelectedNodes.mockReturnValue(nodes);
        mockSelectedNodeIds.splice(0, 0, ...nodes.map(n => n.id));

        const { alignRight } = useCanvasAlignment(mockNodes, mockStatus, mockActions);
        alignRight();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockUpdateTask).toHaveBeenCalledWith('A', expect.objectContaining({ canvasPosition: { x: 200, y: 0 } }), 'DRAG');
        expect(mockUpdateTask).toHaveBeenCalledWith('B', expect.objectContaining({ canvasPosition: { x: 250, y: 0 } }), 'DRAG');
        expect(mockUpdateTask).toHaveBeenCalledWith('C', expect.objectContaining({ canvasPosition: { x: 0, y: 0 } }), 'DRAG');
    });

    it('alignCenterHorizontal: should align centers (Dimension Aware)', async () => {
        // A: L=100 R=200 Cbox=150
        // B: L=200 R=400 Cbox=300
        // Combined Bounds: 100 to 400. Center = 250.
        // A NewX = 250 - 50 = 200.
        // B NewX = 250 - 100 = 150.

        const nodes = [
            createNode('A', 100, 0, 100, 100),
            createNode('B', 200, 0, 200, 100),
        ];

        mockNodes.value = nodes;
        mockGetSelectedNodes.mockReturnValue(nodes);
        mockSelectedNodeIds.splice(0, 0, ...nodes.map(n => n.id));

        const { alignCenterHorizontal } = useCanvasAlignment(mockNodes, mockStatus, mockActions);
        alignCenterHorizontal();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockUpdateTask).toHaveBeenCalledWith('A', expect.objectContaining({ canvasPosition: { x: 175, y: 0 } }), 'DRAG');
        expect(mockUpdateTask).toHaveBeenCalledWith('B', expect.objectContaining({ canvasPosition: { x: 125, y: 0 } }), 'DRAG');
    });

    it('distributeHorizontal: should space evenly (Dimension Aware)', async () => {
        // A: 0, w=10
        // B: 20, w=10
        // C: 100, w=10
        // Distribute: 0 -- 50 -- 100.

        const nodes = [
            createNode('A', 0, 0, 10, 10),
            createNode('B', 20, 0, 10, 10), // Should move to 50
            createNode('C', 100, 0, 10, 10),
        ];

        mockNodes.value = nodes;
        mockGetSelectedNodes.mockReturnValue(nodes);
        mockSelectedNodeIds.splice(0, 0, ...nodes.map(n => n.id));

        const { distributeHorizontal } = useCanvasAlignment(mockNodes, mockStatus, mockActions);
        distributeHorizontal();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockUpdateTask).toHaveBeenCalledWith('B', expect.objectContaining({ canvasPosition: { x: 50, y: 0 } }), 'DRAG');
    });
});
