import { nextTick, type Ref, type ComputedRef } from 'vue'
import { type Node } from '@vue-flow/core'
import type { useCanvasStore } from '@/stores/canvas'
import { type Task, type useTaskStore } from '@/stores/tasks'

interface TaskCountsDeps {
    canvasStore: ReturnType<typeof useCanvasStore>
    nodes: Ref<Node[]>
    filteredTasks: ComputedRef<Task[]>
    taskStore?: ReturnType<typeof useTaskStore>  // BUG-184: Optional for backwards compat
}

export function useCanvasTaskCounts(deps: TaskCountsDeps) {
    const { canvasStore, nodes, filteredTasks, taskStore } = deps

    // BUG-047 FIX: Helper to get all ancestor group IDs for a given group
    // This is needed to update parent groups when a child's count changes
    const getAncestorGroupIds = (groupId: string, visited = new Set<string>()): string[] => {
        if (visited.has(groupId)) return [] // Prevent infinite loops
        visited.add(groupId)

        const group = canvasStore.groups.find(g => g.id === groupId)
        if (!group || !group.parentGroupId) return []

        const ancestors: string[] = [group.parentGroupId]
        ancestors.push(...getAncestorGroupIds(group.parentGroupId, visited))
        return ancestors
    }

    // BUG-047 FIX: Update a single section's task count by mutating node.data
    const updateSingleSectionCount = (sectionId: string, tasks: Task[]) => {
        const sectionNodeId = `section-${sectionId}`
        const newCount = canvasStore.getTaskCountInGroupRecursive(sectionId, tasks)

        // MUTATE the existing node.data to maintain Vue Flow reactivity
        const node = nodes.value.find(n => n.id === sectionNodeId)
        if (node && node.data) {
            node.data.taskCount = newCount
            // console.log(`[BUG-047] Updated "${node.data?.name || sectionId}" taskCount: ${newCount}`)
        }
    }

    // TASK-072 FIX: Update section task counts without calling syncNodes()
    // BUG-047 FIX: Also update all ancestor groups to reflect recursive counting
    // BUG-152 FIX: Use nextTick to ensure task store updates have propagated
    //
    // CRITICAL INSIGHT from Vue Flow docs (https://github.com/bcakmakoglu/vue-flow/discussions/920):
    // "useNode returns us the node object straight from the state - since the node obj is reactive,
    //  we can MUTATE it to update our nodes' data"
    //
    // The key is to MUTATE the existing node.data, NOT replace the node object.
    // Replacing the node breaks the reference that useNode() is watching in custom components.
    const updateSectionTaskCounts = async (oldSectionId?: string, newSectionId?: string) => {
        // BUG-152 FIX: Wait for Vue reactivity to propagate task position updates
        // Without this, filteredTasks may have stale canvasPosition values
        await nextTick()
        await nextTick() // BUG-152: Extra tick for store propagation

        // BUG-184 FIX: Read directly from taskStore to bypass filteredTasks cache
        // The filteredTasks computed has hash-based caching that can return stale positions
        // during drag operations, causing task counts to not update correctly
        let tasks: Task[]
        if (taskStore && taskStore.tasks) {
            // Fresh read from store - filter out soft-deleted tasks
            tasks = taskStore.tasks.filter(t => !t._soft_deleted)
            // console.log(`[BUG-184] Fresh read: ${tasks.length} tasks from store`)
        } else {
            // Fallback to filtered tasks (may be cached)
            tasks = filteredTasks.value || []
        }

        // BUG-152 DEBUG: Log task positions we're using for counting
        if (newSectionId) {
            const section = canvasStore.groups.find(s => s.id === newSectionId)
            if (section) {
                // console.log(`[BUG-152 COUNT DEBUG] Counting for "${section.name}"...`)
            }
        }

        // Collect all sections that need updating (including ancestors)
        const sectionsToUpdate = new Set<string>()

        // Update old section and its ancestors (if task was moved out)
        if (oldSectionId) {
            sectionsToUpdate.add(oldSectionId)
            getAncestorGroupIds(oldSectionId).forEach(id => sectionsToUpdate.add(id))
        }

        // Update new section and its ancestors (if task was moved in)
        if (newSectionId) {
            sectionsToUpdate.add(newSectionId)
            getAncestorGroupIds(newSectionId).forEach(id => sectionsToUpdate.add(id))
        }

        // BUG-047 FIX: Update all affected sections in one pass
        sectionsToUpdate.forEach(sectionId => {
            updateSingleSectionCount(sectionId, tasks)
        })

        // console.log(`[BUG-152] Updated task counts for ${sectionsToUpdate.size} groups`)
    }

    return {
        updateSectionTaskCounts,
        updateSingleSectionCount, // Exported in case needed individually, but mainly internal
        getAncestorGroupIds       // Exported as it was in original file (helper)
    }
}
