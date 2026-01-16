import { computed } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import type { useCanvasStore } from '@/stores/canvas'
import { detectPowerKeyword, SMART_GROUPS } from '@/composables/usePowerKeywords'

export function useCanvasNavigation(canvasStore: ReturnType<typeof useCanvasStore>) {
    const { fitView: vueFlowFitView, getNodes, setCenter } = useVueFlow()

    // Safety check - use computed to access viewport properties to avoid crash if store is not ready
    const initialViewport = computed(() => {
        const vp = canvasStore?.viewport || { x: 0, y: 0, zoom: 1 }
        return {
            x: Number.isFinite(vp.x) ? vp.x : 0,
            y: Number.isFinite(vp.y) ? vp.y : 0,
            zoom: (Number.isFinite(vp.zoom) && vp.zoom > 0) ? vp.zoom : 1
        }
    })

    const zoomToSelection = () => {
        // Get selected nodes from store/VueFlow
        const selectedIds = canvasStore.selectedNodeIds
        if (!selectedIds || selectedIds.length === 0) return

        const nodes = getNodes.value
        const selectedNodes = nodes.filter(n => selectedIds.includes(n.id))

        if (selectedNodes.length === 0) return

        // Calculate bounding box
        const _xs = selectedNodes.map(n => n.position.x)
        const _ys = selectedNodes.map(n => n.position.y)


        vueFlowFitView({
            nodes: selectedIds,
            padding: 0.3,
            duration: 300
        })
    }

    const fitCanvas = () => {
        vueFlowFitView({ padding: 0.2, duration: 300 })
    }

    /**
     * TASK-299: Center on Today group or fallback to area with tasks
     * Called on canvas load to provide better initial viewport position
     *
     * Priority:
     * 1. Today group (if exists) - always center on it
     * 2. Busiest group with tasks (first visit fallback)
     * 3. First task (if no groups)
     * 4. Keep saved viewport (return false to indicate no centering)
     *
     * @param forceFallback - If true, use fallback even if no Today group (for first visit)
     */
    const centerOnTodayGroup = (forceFallback = false): boolean => {
        const nodes = getNodes.value
        if (!nodes || nodes.length === 0) {
            console.log('[NAV] No nodes to center on')
            return false
        }

        // Find Today group node (section nodes with "today" power keyword)
        const todayNode = nodes.find(node => {
            if (node.type !== 'sectionNode') return false
            const name = node.data?.name || ''
            const powerKeyword = detectPowerKeyword(name)
            return powerKeyword?.category === 'date' && powerKeyword.value === SMART_GROUPS.TODAY
        })

        if (todayNode) {
            // Calculate center of the Today group
            const nodeWidth = todayNode.dimensions?.width || 300
            const nodeHeight = todayNode.dimensions?.height || 200
            const centerX = todayNode.position.x + nodeWidth / 2
            const centerY = todayNode.position.y + nodeHeight / 2

            console.log('[NAV] Centering on Today group:', todayNode.id, { centerX, centerY })
            setCenter(centerX, centerY, { zoom: 1, duration: 300 })
            return true
        }

        // If no Today group and not forcing fallback, keep saved viewport
        if (!forceFallback) {
            console.log('[NAV] No Today group - keeping saved viewport')
            return false
        }

        // Fallback: Find any group with tasks (for first visit / no saved viewport)
        const groupsWithTasks = nodes.filter(node => {
            if (node.type !== 'sectionNode') return false
            const taskCount = node.data?.aggregatedTaskCount || node.data?.directTaskCount || 0
            return taskCount > 0
        })

        if (groupsWithTasks.length > 0) {
            // Sort by task count (descending) and center on the busiest group
            const busiestGroup = groupsWithTasks.sort((a, b) => {
                const aCount = (a.data?.aggregatedTaskCount || 0) + (a.data?.directTaskCount || 0)
                const bCount = (b.data?.aggregatedTaskCount || 0) + (b.data?.directTaskCount || 0)
                return bCount - aCount
            })[0]

            const nodeWidth = busiestGroup.dimensions?.width || 300
            const nodeHeight = busiestGroup.dimensions?.height || 200
            const centerX = busiestGroup.position.x + nodeWidth / 2
            const centerY = busiestGroup.position.y + nodeHeight / 2

            console.log('[NAV] Centering on busiest group:', busiestGroup.id, { centerX, centerY })
            setCenter(centerX, centerY, { zoom: 1, duration: 300 })
            return true
        }

        // Fallback: Center on first task node if no groups
        const firstTask = nodes.find(node => node.type === 'taskNode')
        if (firstTask) {
            console.log('[NAV] Centering on first task:', firstTask.id)
            setCenter(firstTask.position.x, firstTask.position.y, { zoom: 1, duration: 300 })
            return true
        }

        console.log('[NAV] No target found for centering')
        return false
    }

    return {
        initialViewport,
        zoomToSelection,
        fitCanvas,
        centerOnTodayGroup
    }
}
