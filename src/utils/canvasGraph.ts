import type { Node } from '@vue-flow/core'

/**
 * Graph Utilities for Canvas
 * 
 * Handles relationships between nodes (parent-child) and coordinate transformations
 * that depend on the graph structure.
 */

/**
 * Recursively calculate the absolute position of a node by traversing its parent chain.
 * 
 * @param nodeId - The ID of the node to find the position for
 * @param nodes - Array of all nodes in the graph (snapshot or reactive ref value)
 * @returns The absolute { x, y } position
 */
export function getAbsoluteNodePosition(nodeId: string, nodes: Node[]): { x: number; y: number } {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return { x: 0, y: 0 }

    // Sanitize node position
    const nodeX = Number.isNaN(node.position.x) ? 0 : node.position.x
    const nodeY = Number.isNaN(node.position.y) ? 0 : node.position.y

    if (!node.parentNode) {
        // No parent = position is already absolute
        return { x: nodeX, y: nodeY }
    }

    // Has parent: recursively get parent's absolute position and add this node's relative position
    const parentAbsolute = getAbsoluteNodePosition(node.parentNode, nodes)
    return {
        x: parentAbsolute.x + nodeX,
        y: parentAbsolute.y + nodeY
    }
}
