import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore, type CanvasSection } from '@/stores/canvas'
import { startOfDay } from 'date-fns'

export function useCanvasSmartGroups() {
    const taskStore = useTaskStore()
    const canvasStore = useCanvasStore()

    const OVERDUE_GROUP_NAME = 'Overdue'
    const OVERDUE_GROUP_COLOR = '#ef4444' // Red-500

    // Helper to find or create the Overdue group
    const ensureOverdueGroup = async (): Promise<CanvasSection> => {
        // Cast type check to avoid literal type mismatch since we are introducing a new 'smart_overdue' type
        // that might not be in the CanvasSection type definition yet

        // Find ALL matching groups (case-insensitive)
        const groups = canvasStore.sections.filter(s =>
            s.name.toLowerCase() === OVERDUE_GROUP_NAME.toLowerCase() ||
            (s.type as string) === 'smart_overdue'
        )

        let group: CanvasSection | undefined

        if (groups.length === 0) {
            // Create new group
            // Default position: Top-left area, maybe offset to avoid overlap
            const newGroup: CanvasSection = {
                id: crypto.randomUUID(),
                name: OVERDUE_GROUP_NAME,
                type: 'custom', // Use 'custom' as compliant type, store 'smart_overdue' in metadata if possible or rely on name
                color: OVERDUE_GROUP_COLOR,
                layout: 'grid',
                position: { x: 50, y: 50, width: 400, height: 600 },
                isCollapsed: false,
                isVisible: true
            }

            await canvasStore.createSection(newGroup)
            group = newGroup
        } else {
            // Handle duplicates: Pick the "best" one (e.g. strict name match or first one)
            // If multiple exist, we just use the first valid one found, which effectively "activates" it
            // Future improvement: Merge/Delete duplicates? For now, safer to just pick one.

            // Prioritize strict name match
            group = groups.find(s => s.name === OVERDUE_GROUP_NAME) || groups[0]

            // TASK-100 FIX: Ensure selected group has the correct color and type
            // Also fix casing if needed (e.g. 'overdue' -> 'Overdue')
            const needsUpdate =
                group.color !== OVERDUE_GROUP_COLOR ||
                (group.type as string) !== 'smart_overdue' ||
                group.name !== OVERDUE_GROUP_NAME

            if (needsUpdate) {
                // We can't easily change type if strictly typed, but we can update color and name
                await canvasStore.updateSection(group.id, {
                    name: OVERDUE_GROUP_NAME,
                    color: OVERDUE_GROUP_COLOR,
                    // Update type if possible, or just rely on color/name
                    type: 'custom' // Keep compliant
                })
                // Optimistically update local reference
                group.name = OVERDUE_GROUP_NAME
                group.color = OVERDUE_GROUP_COLOR
            }
        }

        return group
    }

    // Main logic to collect overdue tasks
    const autoCollectOverdueTasks = async () => {
        // 1. Get Overdue Tasks
        // Criteria: dueDate < today (00:00) AND not recurring
        const today = startOfDay(new Date())

        const overdueTasks = taskStore.tasks.filter(task => {
            if (task.status === 'done' || (task.status as string) === 'archive') return false // Ignore completed/archived
            if (task.recurrence) return false // User requested to ignore recurring tasks

            // TASK-100 REFINEMENT: Only collect tasks that are ALREADY on the canvas
            // User feedback: "tasks... in the calendar inbox... shouldn't move to the canvas just to appear there"
            if (!task.canvasPosition) return false

            if (!task.dueDate) return false

            // Compare dates
            const dueDate = new Date(task.dueDate) // Assuming YYYY-MM-DD string
            // Fix timezone offset issue by comparing strings or setting hours carefully
            // Since dueDate is YYYY-MM-DD, we can check if it's strictly less than today's date string
            const todayStr = today.toISOString().split('T')[0]

            return task.dueDate < todayStr
        })

        if (overdueTasks.length === 0) return

        // 2. Ensure Group Exists
        const group = await ensureOverdueGroup()

        // 3. Move tasks into group
        // We update canvasPosition to be relative to the group
        // Or simpler: put them visually inside the group's bounds
        // The sync logic (`useCanvasSync`) automatically parents them if they are visually inside

        const startX = group.position.x + 20
        let currentY = group.position.y + 60 // Header offset
        const GAP = 120 // Height of task + gap

        let updatedCount = 0

        for (const task of overdueTasks) {
            // Check if ALREADY inside the group (by checking overlap or current position)
            // If task already has a position within group bounds, skip
            const currentPos = task.canvasPosition
            if (currentPos) {
                if (currentPos.x >= group.position.x &&
                    currentPos.x <= group.position.x + group.position.width! &&
                    currentPos.y >= group.position.y &&
                    currentPos.y <= group.position.y + group.position.height!) {
                    continue // Already in group
                }
            }

            // Move to group
            await taskStore.updateTask(task.id, {
                canvasPosition: {
                    x: startX,
                    y: currentY
                }
            })

            currentY += GAP
            updatedCount++

            // Expand group height if needed
            if (currentY > group.position.y + group.position.height! - 50) {
                // Increase height
                const newHeight = (currentY - group.position.y) + 100
                await canvasStore.updateSection(group.id, {
                    position: { ...group.position, height: newHeight }
                })
            }
        }

        if (updatedCount > 0) {
            console.log(`🧹 [SmartGroup] Moved ${updatedCount} overdue tasks to Overdue group`)
        }
    }

    return {
        autoCollectOverdueTasks
    }
}
