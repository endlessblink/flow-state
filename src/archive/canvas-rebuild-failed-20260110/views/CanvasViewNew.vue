<script setup lang="ts">
/**
 * Canvas View New - Layer 1 Foundation
 * 
 * TASK-184: Canvas Rebuild
 */
import { ref, onMounted, markRaw, nextTick, computed } from 'vue'
import { VueFlow, Panel } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

import GroupNodeNew from '@/components/canvasNew/GroupNodeNew.vue'
import TaskNodeNew from '@/components/canvasNew/TaskNodeNew.vue'
import { useCanvasCore } from '@/composables/canvasNew/useCanvasCore'
import { useCanvasGroups } from '@/composables/canvasNew/useCanvasGroups'
import { useCanvasTasks } from '@/composables/canvasNew/useCanvasTasks'
import { useCanvasNewStore } from '@/stores/canvasNew'
import type { NodeDragEvent } from '@vue-flow/core'

const canvasStore = useCanvasNewStore()
const canvasCore = useCanvasCore()
const canvasGroups = useCanvasGroups()
const canvasTasks = useCanvasTasks()

const nodeTypes = markRaw({
  sectionNode: GroupNodeNew as any,
  taskNode: TaskNodeNew as any
})

const isLoading = computed(() => canvasStore.isLoading)

// ============================================
// DRAG HANDLING
// ============================================

function handleNodeDragStart(event: NodeDragEvent) {
  const node = event.node
  const nodeId = node.id

  if (nodeId.startsWith('section-')) {
    canvasStore.lockGroupPosition(nodeId.replace('section-', ''))
  } else if (nodeId.startsWith('task-')) {
    canvasStore.lockTaskPosition(nodeId.replace('task-', ''))
  }

  canvasCore.isDragging.value = true
  canvasCore.draggedNodeId.value = nodeId
}

async function handleNodeDragStop(event: NodeDragEvent) {
  const node = event.node
  const nodeId = node.id

  if (nodeId.startsWith('section-')) {
    const groupId = nodeId.replace('section-', '')
    await canvasGroups.persistGroupPosition(groupId, node.position)
    canvasStore.unlockGroupPosition(groupId)
  } else if (nodeId.startsWith('task-')) {
    const taskId = nodeId.replace('task-', '')
    await canvasTasks.persistTaskPosition(taskId, node.position)
    canvasStore.unlockTaskPosition(taskId)
  }

  canvasCore.isDragging.value = false
  canvasCore.draggedNodeId.value = null
}

// ============================================
// INITIALIZATION
// ============================================

async function initialize() {
  canvasStore.setLoading(true)
  try {
    // 1. Load data
    await canvasGroups.loadGroups()
    
    // 2. Convert to nodes
    const groupNodes = canvasGroups.groupsToNodes(canvasCore.groupToNode)
    const taskNodes = canvasTasks.tasksToNodes(
      canvasCore.taskToNode,
      canvasGroups.findContainingGroup
    )
    
    // 3. Set nodes
    canvasCore.setAllNodes([...groupNodes, ...taskNodes])
    
    await nextTick()
    canvasCore.fitView({ padding: 0.2 })
  } finally {
    canvasStore.setLoading(false)
  }
}

onMounted(initialize)
</script>

<template>
  <div class="canvas-view-new h-full w-full bg-gray-900 relative">
    <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-black/50 z-50">
      <div class="text-white">Loading Foundation...</div>
    </div>

    <VueFlow
      :nodes="canvasCore.nodes.value"
      :edges="canvasCore.edges.value"
      :node-types="nodeTypes"
      class="h-full w-full"
      @node-drag-start="handleNodeDragStart"
      @node-drag-stop="handleNodeDragStop"
    >
      <Background :gap="20" pattern-color="rgba(255,255,255,0.05)" />
      <Controls position="bottom-right" />
      <MiniMap position="bottom-left" />
      
      <Panel position="top-left" class="bg-gray-800/80 p-3 rounded-lg text-xs text-gray-300 backdrop-blur">
        <div class="text-blue-400 font-bold mb-1 uppercase tracking-tight">Canvas Rebuild (Layer 1)</div>
        <div>Groups: {{ canvasStore.groupCount }}</div>
        <div>Nodes: {{ canvasCore.nodes.value.length }}</div>
        <div v-if="canvasCore.isDragging.value" class="text-yellow-400 mt-1">Dragging: {{ canvasCore.draggedNodeId.value }}</div>
      </Panel>
    </VueFlow>
  </div>
</template>

<style scoped>
.canvas-view-new {
  height: 100vh;
  width: 100%;
}
</style>
