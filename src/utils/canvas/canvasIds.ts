/**
 * Normalized ID management for the Canvas system.
 * 
 * Rules:
 * 1. Group Node IDs are always prefixed with 'section-'.
 * 2. Task Node IDs are pure IDs (UUIDs or numeric).
 * 3. Edge IDs are prefixed with 'e-' and combine source/target.
 */
export const CanvasIds = {
    /**
     * Formats a group ID into a Vue Flow node ID.
     */
    groupNodeId: (groupId: string): string =>
        groupId.startsWith('section-') ? groupId : `section-${groupId}`,

    /**
     * Formats a task ID into a Vue Flow node ID.
     */
    taskNodeId: (taskId: string): string =>
        taskId.startsWith('section-') ? taskId.replace('section-', '') : taskId,

    /**
     * Parses a Vue Flow node ID back into its canonical ID and type.
     */
    parseNodeId: (nodeId: string): { type: 'group' | 'task', id: string } => {
        if (nodeId.startsWith('section-')) {
            return { type: 'group', id: nodeId.replace('section-', '') }
        }
        return { type: 'task', id: nodeId }
    },

    /**
     * Type guard for group node IDs.
     */
    isGroupNode: (nodeId: string): boolean => nodeId.startsWith('section-'),

    /**
     * Type guard for task node IDs.
     */
    isTaskNode: (nodeId: string): boolean => !nodeId.startsWith('section-'),

    /**
     * Generates a unique ID for an edge between two nodes.
     */
    edgeId: (sourceId: string, targetId: string): string => `e-${sourceId}-${targetId}`
}
