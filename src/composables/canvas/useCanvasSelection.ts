import { ref } from 'vue'
import { useCanvasStore } from '@/stores/canvas'
import type { Node } from '@vue-flow/core'
import type { Task } from '@/types/tasks'

export function useCanvasSelection() {
    const canvasStore = useCanvasStore()

    // State
    const selectedTask = ref<Task | null>(null)
    const isEditModalOpen = ref(false)

    // Actions
    const handleEditTask = (task: Task) => {
        selectedTask.value = task
        isEditModalOpen.value = true
    }

    const closeEditModal = () => {
        isEditModalOpen.value = false
        selectedTask.value = null
    }

    const handleSelectionChange = (params: { nodes: Node[] }) => {
        const selectedNodeIds = params.nodes.map(n => n.id)
        canvasStore.setSelectedNodes(selectedNodeIds)
    }

    const clearSelection = () => {
        canvasStore.setSelectedNodes([])
        selectedTask.value = null
    }

    // Visual Helpers
    const getNodeColor = (node: Node) => {
        if (node.type === 'sectionNode') return 'rgba(99, 102, 241, 0.15)'
        const task = (node.data as any)?.task
        if (!task) return '#94a3b8' // Slate-400
        if (task.status === 'done') return '#10b981' // Emerald-500
        if (task.status === 'in-progress') return '#3b82f6' // Blue-500
        return '#94a3b8'
    }

    return {
        selectedTask,
        isEditModalOpen,
        handleEditTask,
        closeEditModal,
        handleSelectionChange,
        clearSelection,
        getNodeColor
    }
}
