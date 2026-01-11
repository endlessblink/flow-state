/**
 * Canvas dimension and layout constants
 */
export const CANVAS = {
    // Node dimensions
    DEFAULT_GROUP_WIDTH: 300,
    DEFAULT_GROUP_HEIGHT: 200,
    DEFAULT_TASK_WIDTH: 220,
    DEFAULT_TASK_HEIGHT: 100,
    MIN_GROUP_WIDTH: 150,
    MIN_GROUP_HEIGHT: 100,

    // Z-index layers
    Z_INDEX_BASE: 1000,
    Z_INDEX_TASK: 1000,
    Z_INDEX_GROUP: 10,
    Z_INDEX_DRAGGING: 3000,
    Z_INDEX_SELECTED: 2000,

    // Timing
    SYNC_DEBOUNCE_MS: 300,
    POSITION_LOCK_TIMEOUT_MS: 7000,
    ANIMATION_DURATION_MS: 200,

    // Limits
    MAX_RECURSION_DEPTH: 50,
    MAX_NESTING_LEVEL: 10,

    // Spacing
    GROUP_PADDING: 20,
    TASK_MARGIN: 10,
    GRID_SNAP_SIZE: 16, // Matching snap grid in CanvasView.vue

    // Borders
    GROUP_BORDER_WIDTH: 2,
} as const

export type CanvasConstants = typeof CANVAS
