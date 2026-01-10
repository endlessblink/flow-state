<!--
  CanvasViewNew.vue - Fresh Canvas Rebuild

  TASK-184: Canvas System Rebuild - Phase 1

  Target: ~500 lines (orchestration only)
  Current: ~150 lines (Phase 1 foundation)

  Principles:
  - Vue Flow integration is the ONLY complex part
  - Composables handle all business logic
  - Store handles all state
  - This file ONLY orchestrates
-->
<template>
  <div class="canvas-view-new">
    <!-- Main Canvas Area -->
    <div
      ref="canvasContainerRef"
      class="canvas-container"
      @drop="handleDrop"
      @dragover.prevent
    >
      <VueFlow
        :nodes="nodes"
        :edges="edges"
        :node-types="nodeTypes"
        :default-edge-options="defaultEdgeOptions"
        :fit-view-on-init="flowOptions.fitViewOnInit"
        :zoom-on-scroll="flowOptions.zoomOnScroll"
        :pan-on-scroll="flowOptions.panOnScroll"
        :pan-on-drag="flowOptions.panOnDrag"
        :selection-on-drag="flowOptions.selectionOnDrag"
        :snap-to-grid="flowOptions.snapToGrid"
        :snap-grid="flowOptions.snapGrid"
        :min-zoom="flowOptions.minZoom"
        :max-zoom="flowOptions.maxZoom"
        class="canvas-flow"
        @nodes-change="handleNodesChange"
        @edges-change="handleEdgesChange"
        @node-drag-stop="handleNodeDragStop"
        @connect="handleConnect"
      >
        <!-- Background -->
        <Background
          :variant="BackgroundVariant.Dots"
          :gap="20"
          :size="1"
          class="canvas-background"
        />

        <!-- Controls -->
        <Controls
          :show-zoom="true"
          :show-fit-view="true"
          :show-interactive="false"
          class="canvas-controls"
        />

        <!-- MiniMap -->
        <MiniMap
          :pannable="true"
          :zoomable="true"
          class="canvas-minimap"
        />
      </VueFlow>

      <!-- Inbox Panel (Phase 3) -->
      <CanvasInbox />

      <!-- Loading Overlay -->
      <div v-if="isLoading" class="canvas-loading">
        <div class="loading-spinner"></div>
        <span>Loading canvas...</span>
      </div>

      <!-- Empty State (Phase 1) -->
      <div v-if="!isLoading && nodes.length === 0" class="canvas-empty-state">
        <div class="empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="3" y1="9" x2="21" y2="9"></line>
            <line x1="9" y1="21" x2="9" y2="9"></line>
          </svg>
        </div>
        <h3>Canvas Rebuild - Phase 5</h3>
        <p>{{ store.groupCount }} groups, {{ inboxTasks.length }} inbox tasks</p>
        <div class="phase-checklist">
          <div class="check-item done">Vue Flow renders</div>
          <div class="check-item done">Background grid</div>
          <div class="check-item done">Pan/Zoom controls</div>
          <div class="check-item done">MiniMap</div>
          <div class="check-item done">Groups load (Phase 2)</div>
          <div class="check-item done">Tasks + Inbox (Phase 3)</div>
          <div class="check-item done">Drag to canvas (Phase 4)</div>
          <div class="check-item done">Parent-child (Phase 5)</div>
          <div class="check-item pending">Feature parity (Phase 6)</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { VueFlow } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import { Background, BackgroundVariant } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { useCanvasCore } from '@/composables/canvasNew/useCanvasCore'
import { useCanvasGroups } from '@/composables/canvasNew/useCanvasGroups'
import { useCanvasNodes } from '@/composables/canvasNew/useCanvasNodes'
import { useCanvasDrag } from '@/composables/canvasNew/useCanvasDrag'
import { useCanvasNewStore } from '@/stores/canvasNew'
import CanvasInbox from '@/components/canvasNew/CanvasInbox.vue'

// ============================================
// COMPOSABLES
// ============================================

const store = useCanvasNewStore()

// Canvas container ref for drop coordinate calculation
const canvasContainerRef = ref<HTMLElement | null>(null)

const {
  nodes,
  edges,
  nodeTypes,
  defaultEdgeOptions,
  flowOptions,
  handleNodesChange,
  handleEdgesChange,
  handleConnect,
  syncNodes,
  project
} = useCanvasCore()

const {
  loadGroups,
  groupNodes
} = useCanvasGroups()

const {
  taskNodes,
  inboxTasks,
  taskCountsByGroup
} = useCanvasNodes()

const {
  handleCanvasDrop,
  handleNodeDragStop: onNodeDragStop
} = useCanvasDrag()

// ============================================
// COMPUTED
// ============================================

const isLoading = computed(() => store.isLoading)

/**
 * Calculate recursive task count for a group
 * Includes tasks in all nested child groups
 */
function getRecursiveTaskCount(groupId: string, visited = new Set<string>()): number {
  // Prevent infinite loops from circular references
  if (visited.has(groupId)) return 0
  visited.add(groupId)

  // Get direct task count for this group
  let count = taskCountsByGroup.value.get(groupId) ?? 0

  // Find all child groups and add their recursive counts
  store.groups.forEach(group => {
    if (group.parentGroupId === groupId) {
      count += getRecursiveTaskCount(group.id, visited)
    }
  })

  return count
}

/**
 * Enrich group nodes with task counts
 * Phase 5: Groups should show how many tasks they contain
 * Uses RECURSIVE counting - parent groups include tasks from child groups
 */
const groupNodesWithCounts = computed(() => {
  return groupNodes.value.map(node => {
    // Extract group ID from node ID (format: "section-{groupId}")
    const groupId = node.id.replace('section-', '')

    // Get recursive task count (includes tasks in child groups)
    const taskCount = getRecursiveTaskCount(groupId)

    return {
      ...node,
      data: {
        ...node.data,
        taskCount
      }
    }
  })
})

// ============================================
// EVENT HANDLERS
// ============================================

async function handleDrop(event: DragEvent) {
  event.preventDefault()

  // Get container rect for coordinate conversion
  const container = canvasContainerRef.value
  if (!container) {
    console.warn('[CanvasViewNew] No container ref for drop')
    return
  }

  const containerRect = container.getBoundingClientRect()
  await handleCanvasDrop(event, project, containerRect)

  // Re-sync nodes after drop to update Vue Flow
  await syncNodes(groupNodesWithCounts.value, taskNodes.value)
}

async function handleNodeDragStop(event: { node: any }) {
  // Use the drag composable's handler
  await onNodeDragStop(event)

  // Re-sync nodes to update Vue Flow with any parent-child changes
  // This ensures tasks that were dragged into/out of groups have correct parentNode
  await syncNodes(groupNodesWithCounts.value, taskNodes.value)
}

// ============================================
// LIFECYCLE
// ============================================

onMounted(async () => {
  console.log('[CanvasViewNew] Mounted - Loading canvas...')

  // Load groups from Supabase
  await loadGroups()

  // Sync groups AND tasks to Vue Flow
  // Groups must come first (for parent-child relationships)
  await syncNodes(groupNodesWithCounts.value, taskNodes.value)

  store.setInitialized(true)
  console.log('[CanvasViewNew] Initialized with', groupNodesWithCounts.value.length, 'groups and', taskNodes.value.length, 'tasks')
})

onUnmounted(() => {
  console.log('[CanvasViewNew] Unmounted')
})

// NOTE: No watcher for groups - following "Explicit Over Reactive" principle
// Sync is triggered explicitly via loadGroups() or when actions occur
// This prevents the recursive update loops that plagued the old canvas
</script>

<style scoped>
.canvas-view-new {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--color-background, #1a1a2e);
}

.canvas-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.canvas-flow {
  width: 100%;
  height: 100%;
}

/* CRITICAL: Z-index fix for node stacking order
 *
 * Problem: CSS stacking contexts. When a parent element has z-index,
 * it creates a stacking context that traps children inside.
 *
 * Solution:
 * - Groups have z-index: auto (no stacking context)
 * - Child groups appear ABOVE parent groups via later DOM order
 * - Tasks use very high z-index to always be on top
 */

/* GROUPS: Reset z-index to avoid stacking context traps */
:deep(.vue-flow__node-sectionNode) {
  z-index: auto !important;
}

/* TASKS: Always on top of ALL groups, regardless of nesting */
:deep(.vue-flow__node-taskNode) {
  z-index: 1000 !important;
}

/* Selected tasks slightly higher */
:deep(.vue-flow__node-taskNode.selected) {
  z-index: 1001 !important;
}

/* Dragging tasks on top of everything */
:deep(.vue-flow__node-taskNode.dragging) {
  z-index: 10000 !important;
}

/* Background styling */
:deep(.canvas-background) {
  background-color: var(--color-background, #1a1a2e);
}

:deep(.vue-flow__background pattern circle) {
  fill: var(--color-border, #2d2d44);
}

/* Controls styling */
:deep(.canvas-controls) {
  position: absolute;
  bottom: 20px;
  left: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--color-surface, #252538);
  border-radius: 8px;
  padding: 4px;
  border: 1px solid var(--color-border, #2d2d44);
}

:deep(.vue-flow__controls-button) {
  background: transparent;
  border: none;
  color: var(--color-text-secondary, #a0a0b0);
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

:deep(.vue-flow__controls-button:hover) {
  background: var(--color-surface-hover, #2d2d44);
  color: var(--color-text, #ffffff);
}

/* MiniMap styling */
:deep(.canvas-minimap) {
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: var(--color-surface, #252538);
  border-radius: 8px;
  border: 1px solid var(--color-border, #2d2d44);
  overflow: hidden;
}

:deep(.vue-flow__minimap) {
  background: var(--color-surface, #252538);
}

/* Loading overlay */
.canvas-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: rgba(26, 26, 46, 0.9);
  z-index: 100;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border, #2d2d44);
  border-top-color: var(--color-primary, #6366f1);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Empty state */
.canvas-empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: var(--color-text-secondary, #a0a0b0);
  z-index: 10;
  pointer-events: none;
}

.empty-icon {
  margin-bottom: 16px;
  opacity: 0.5;
}

.canvas-empty-state h3 {
  margin: 0 0 8px 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text, #ffffff);
}

.canvas-empty-state p {
  margin: 0 0 24px 0;
  font-size: 0.875rem;
}

.phase-checklist {
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
  padding: 16px;
  background: var(--color-surface, #252538);
  border-radius: 8px;
  border: 1px solid var(--color-border, #2d2d44);
}

.check-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
}

.check-item::before {
  content: '';
  width: 16px;
  height: 16px;
  border-radius: 50%;
  flex-shrink: 0;
}

.check-item.done::before {
  background: var(--color-success, #22c55e);
}

.check-item.pending::before {
  background: var(--color-border, #2d2d44);
}
</style>
