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
    NAVIGATION_ANIMATION_MS: 300,

    // Limits
    MAX_RECURSION_DEPTH: 50,
    MAX_NESTING_LEVEL: 10,

    // Spacing
    GROUP_PADDING: 20,
    TASK_MARGIN: 10,
    GRID_SNAP_SIZE: 16, // Matching snap grid in CanvasView.vue

    // TASK-1756 v8: canonical day-group layout
    DAY_GROUP_WIDTH_1COL: 350,
    DAY_GROUP_WIDTH_2COL: 700,
    DAY_GROUP_SPACING: 420, // 350 width + 70 px gutter
    // Exact fit math: HEADER(50) + PADDING(20) + 8*TASK_H(100) + 7*GAP(10) + PADDING(20)
    //                 = 50 + 20 + 800 + 70 + 20 = 960
    // Add 40px slack so BUG-1203's zero-padding spatial check never trips on
    // the 8th task's bottom edge.
    DAY_GROUP_HEIGHT: 1000,
    DAY_GROUP_HEADER_HEIGHT: 50,
    DAY_GROUP_COLUMN_GAP: 20,
    DAY_GROUP_MAX_TASKS_PER_COLUMN: 8,

    // Borders
    GROUP_BORDER_WIDTH: 2,
} as const

export type CanvasConstants = typeof CANVAS
