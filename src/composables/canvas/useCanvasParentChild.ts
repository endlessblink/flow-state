import { type Node } from '@vue-flow/core'
import { getAbsoluteNodePosition } from '@/utils/canvasGraph'
import { isNodeMoreThanHalfInside, isPointInRect } from '@/utils/geometry'
import type { CanvasSection } from '@/stores/canvas'

/**
 * COMPOSABLE: Canvas Parent-Child Logic
 * 
 * Centralizes all logic for:
 * 1. Determining parent-child relationships based on containment
 * 2. calculating Z-indices based on hierarchy and area
 * 3. Converting between absolute and relative coordinates for nesting
 */

export function useCanvasParentChild(
    nodes: any, // Reactive ref<Node[]>
    sections: any // Reactive ref<CanvasSection[]>
) {

    // --- Containment Logic ---

    /**
     * Calculates the absolute position of a section by traversing its parent chain.
     * Uses the store's section data (CanvasSection) rather than Vue Flow nodes to ensure specific accuracy during sync.
     */
    const getSectionAbsolutePosition = (sect: CanvasSection): { x: number, y: number } => {
        let x = sect.position?.x ?? 0
        let y = sect.position?.y ?? 0
        let currentParentId = sect.parentGroupId

        // Walk up the parent chain, accumulating offsets
        // Safety depth limit to prevent infinite loops
        let depth = 0
        while (currentParentId && currentParentId !== 'NONE' && depth < 50) {
            // Find parent in the provided sections list (source of truth)
            // @ts-ignore - sections is a Ref but we treat it as array in loop if unwrapped, or using .value if ref
            const list = Array.isArray(sections) ? sections : (sections.value || [])
            const parent = list.find((s: CanvasSection) => s.id === currentParentId)

            if (parent) {
                x += parent.position?.x ?? 0
                y += parent.position?.y ?? 0
                currentParentId = parent.parentGroupId
                depth++
            } else {
                break // Parent not found
            }
        }
        return { x, y }
    }

    /**
     * Finds all sections that contain the given node rect, sorted by area (largest first).
     * Useful for applying inherited properties from nested groups.
     */
    const findAllContainingSections = (
        nodeRect: { x: number, y: number, width: number, height: number },
        excludeId?: string
    ): CanvasSection[] => {
        const potentialParents: CanvasSection[] = []

        // @ts-ignore
        const list = Array.isArray(sections) ? sections : (sections.value || [])

        list.forEach((section: CanvasSection) => {
            if (section.id === excludeId) return
            if (section.isVisible === false) return
            // Avoid circular
            if (section.parentGroupId === excludeId) return

            // Calculate Section Absolute Rect
            const absPos = getSectionAbsolutePosition(section)
            const sectionRect = {
                x: absPos.x,
                y: absPos.y,
                width: section.position?.width ?? 300,
                height: section.position?.height ?? 200
            }

            // Use robust check (>50% inside)
            const isInside = isNodeMoreThanHalfInside(
                nodeRect.x,
                nodeRect.y,
                nodeRect.width,
                nodeRect.height,
                sectionRect
            )

            if (isInside) {
                potentialParents.push(section)
            }
        })

        // Sort by area (descending: largest first) - for finding "all parents"
        return potentialParents.sort((a, b) => {
            const areaA = (a.position?.width ?? 300) * (a.position?.height ?? 200)
            const areaB = (b.position?.width ?? 300) * (b.position?.height ?? 200)
            return areaB - areaA
        })
    }

    /**
     * Determines which section, if any, fully contains the given node rect.
     * Returns the smallest containing section (by area) to handle nested groups correctly.
     */
    const findSmallestContainingSection = (
        nodeRect: { x: number, y: number, width: number, height: number },
        excludeId?: string
    ): CanvasSection | null => {
        const containers = findAllContainingSections(nodeRect, excludeId)
        if (containers.length === 0) return null

        // Return the last one (smallest area because findAllContainingSections sorts largest first)
        return containers[containers.length - 1]
    }

    /**
     * Specialized containment check for TASKS only.
     * Uses "Center Point" logic: If the task's center is inside the group, it's contained.
     * This is FASTER and MORE INTUITIVE for drag-drop than the "Area > 50%" check used for groups.
     * 
     * @param taskCenter - { x, y } absolute coordinates of task center
     * @param excludeId - ID of group to ignore (e.g. parent if needed, usually not used)
     */
    const findSectionForTask = (
        taskCenter: { x: number, y: number },
        excludeId?: string
    ): CanvasSection | null => {
        // @ts-ignore
        const list = Array.isArray(sections) ? sections : (sections.value || [])

        const validContainers: CanvasSection[] = []

        list.forEach((section: CanvasSection) => {
            if (section.id === excludeId) return
            if (section.isVisible === false) return
            // Avoid using sections that are collapsed? (Optional: current behavior usually allows dropping into collapsed)

            const absPos = getSectionAbsolutePosition(section)
            const rect = {
                x: absPos.x,
                y: absPos.y,
                width: section.position?.width ?? 300,
                height: section.position?.height ?? 200
            }

            if (isPointInRect(taskCenter.x, taskCenter.y, rect)) {
                validContainers.push(section)
            }
        })

        if (validContainers.length === 0) return null

        // Sort by area (ascending: smallest first) - we want the most specific (deepest) group
        return validContainers.sort((a, b) => {
            const areaA = (a.position?.width ?? 300) * (a.position?.height ?? 200)
            const areaB = (b.position?.width ?? 300) * (b.position?.height ?? 200)
            return areaA - areaB
        })[0]
    }

    /**
     * verifies if a child section is physically strictly inside its claimed parent.
     * Used during sync to detect when a child has been dragged out.
     */
    const isActuallyInsideParent = (childSection: CanvasSection, parentSection: CanvasSection): boolean => {
        const childAbs = getSectionAbsolutePosition(childSection)
        const parentAbs = getSectionAbsolutePosition(parentSection)

        const childWidth = childSection.position?.width ?? 300
        const childHeight = childSection.position?.height ?? 200
        const childCenterX = childAbs.x + childWidth / 2
        const childCenterY = childAbs.y + childHeight / 2

        const parentRect = {
            x: parentAbs.x,
            y: parentAbs.y,
            width: parentSection.position?.width ?? 300,
            height: parentSection.position?.height ?? 200
        }

        return isPointInRect(childCenterX, childCenterY, parentRect)
    }

    // --- Z-Index Logic ---

    /**
     * Calculates z-index based on:
     * 1. Selection state (selected is highest)
     * 2. Area (smaller areas are higher - nested groups on top of parents)
     * 3. Base z-index
     */
    const calculateZIndex = (section: CanvasSection, isSelected: boolean): number => {
        if (isSelected) return 1000

        // Base Z for groups
        const BASE_Z = 10

        // Invert area effect: Larger area = Lower Z
        // Max anticipated area ~ 5000x5000 = 25,000,000
        // We want a bonus of up to ~500 for small items
        const width = section.position?.width ?? 300
        const height = section.position?.height ?? 200
        const area = width * height

        // Bonus: 1000000 / area (capped)
        const sizeBonus = Math.min(500, Math.floor(1000000 / Math.max(1, area)))

        return BASE_Z + sizeBonus
    }

    return {
        // Methods
        getSectionAbsolutePosition,
        findSmallestContainingSection,
        findSectionForTask,
        findAllContainingSections,
        isActuallyInsideParent,
        calculateZIndex,
        isPointInRect
    }
}
