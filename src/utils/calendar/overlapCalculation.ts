/**
 * Shared utility for calculating overlapping event positions in calendar views.
 * Used by Day and Week views to display events side-by-side when they conflict.
 */

export interface CalendarEventBase {
    id: string;
    startSlot: number;
    slotSpan: number;
    column?: number;
    totalColumns?: number;
}

/**
 * Calculates columns and total columns for overlapping events.
 * Mutates the input array and returns it for convenience.
 * 
 * @param events - Array of events with startSlot and slotSpan
 * @returns Array of events with column and totalColumns assigned
 */
export const calculateOverlappingPositions = <T extends CalendarEventBase>(events: T[]): T[] => {
    if (events.length === 0) return events

    // Sort by start slot primarily, then by span (longer first)
    const sorted = [...events].sort((a, b) => {
        if (a.startSlot !== b.startSlot) {
            return a.startSlot - b.startSlot;
        }
        return b.slotSpan - a.slotSpan;
    })

    // Find groups of overlapping events
    const groups: T[][] = []
    let currentGroup: T[] = []

    sorted.forEach((event, index) => {
        if (index === 0) {
            currentGroup.push(event)
            return
        }

        // Check if this event overlaps with ANY event already in the current group
        const overlapsWithGroup = currentGroup.some(existing =>
            event.startSlot < existing.startSlot + existing.slotSpan &&
            event.startSlot + event.slotSpan > existing.startSlot
        )

        if (overlapsWithGroup) {
            currentGroup.push(event)
        } else {
            groups.push(currentGroup)
            currentGroup = [event]
        }
    })

    if (currentGroup.length > 0) {
        groups.push(currentGroup)
    }

    // Assign columns within each group
    groups.forEach(group => {
        const columns: T[][] = []

        group.forEach(event => {
            let placed = false

            for (let i = 0; i < columns.length; i++) {
                const column = columns[i]
                const hasCollision = column.some(existing =>
                    event.startSlot < existing.startSlot + existing.slotSpan &&
                    event.startSlot + event.slotSpan > existing.startSlot
                )

                if (!hasCollision) {
                    column.push(event)
                    event.column = i
                    placed = true
                    break
                }
            }

            if (!placed) {
                columns.push([event])
                event.column = columns.length - 1
            }
        })

        const totalColumns = columns.length
        group.forEach(event => {
            event.totalColumns = totalColumns
        })
    })

    return sorted
}
