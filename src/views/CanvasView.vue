<!-- /// <reference types="vite/client" /> -->
<!--
  ⚠️ CRITICAL: Vue Flow Integration Rules - DO NOT VIOLATE

  During refactoring, the following Vue Flow elements MUST NEVER be extracted
  from this component into separate components:

  ❌ DO NOT EXTRACT:
    - v-model:nodes and v-model:edges bindings (lines ~153-154)
    - @node-drag-stop, @connect, @edge-created event handlers (lines ~172-181)
    - VueFlow component itself and its direct children (lines ~151-236)
    - Node/edge calculation and synchronization logic
    - useVueFlow() composable usage and its return values
    - syncNodes() function calls that refresh VueFlow state

  ✅ SAFE TO EXTRACT (these don't depend on Vue Flow):
    - Canvas controls (zoom, pan, toolbar buttons)
    - Modals and overlays
    - Context menus (if they don't depend on VueFlow state)
    - Sidebar panels

  VIOLATION OF THESE RULES WILL BREAK:
    - Drag and drop functionality
    - Node connections and edges
    - State synchronization
    - Canvas viewport controls

  These rules are based on analysis of previous refactoring failures in
  old-flow-state-worktrees where Vue Flow extraction caused complete
  breakage of canvas functionality.
-->

<template>
  <div
    class="canvas-layout canvas-contour"
    :class="{ 'shift-selecting': shift }"
  >
    <!-- MAIN CANVAS AREA -->
    <!-- Vue Flow Canvas -->
    <div
      class="canvas-drop-zone relative"
      @drop="handleDrop"
      @dragover.prevent
      @contextmenu.prevent="handleCanvasRightClick"
    >
      <!-- Loading overlay while canvas initializes -->
      <CanvasLoadingOverlay 
        v-if="!isCanvasReady && !hasNoTasks && tasksWithCanvasPositions && tasksWithCanvasPositions.length > 0"
        message="Loading canvas..."
      />

      <!-- Empty state when no tasks exist -->
      <CanvasEmptyState
        v-if="hasNoTasks"
        @add-task="handleAddTask"
        @create-group="createGroup()"
      />

      <!-- Filter Status Indicator -->
      <CanvasStatusBanner
        :active-status-filter="activeStatusFilter"
        @clear-filter="clearStatusFilter"
      />

      <!-- FEATURE-1048: Day group rotation banner (shown after midnight auto-update) -->
      <DayRotationBanner
        :show-banner="dayRotation.showBanner.value"
        :rotated-groups-count="dayRotation.rotatedGroupsCount.value"
        @dismiss="dayRotation.dismissBanner()"
      />

      <!-- Inbox Sidebar -->
      <UnifiedInboxPanel key="canvas-inbox" context="canvas" />

      <!-- Canvas Toolbar - Actions & Filters (MUST be after InboxPanel for z-index stacking) -->
      <CanvasToolbar
        @add-task="handleAddTask"
        @create-group="handleToolbarCreateGroup"
        @rotate-day-groups="handleRotateDayGroups"
        @tidy-layout="handleTidyLayout"
        @debug-tidy-plan="debugTidyPlanOnlyToClipboard"
        @debug-tidy-apply="debugTidyLayoutToClipboard"
      />

      <!-- Canvas Container -->
      <!-- TASK-1722: tabindex="0" makes this div focusable so @keydown receives Delete key.
           Vue Flow's node wrappers steal focus on click (tabindex=0 on node div),
           so @keydown on VueFlow never fires. This wrapper catches it instead. -->
      <div
        ref="canvasContainerRef"
        class="canvas-container"
        tabindex="0"
        @keydown="handleKeyDown"
        @mousedown="handleMouseDown"
        @mousemove="handleMouseMove"
        @mouseup="handleMouseUp"
        @click="handleCanvasContainerClick"
      >
        <!-- BUG-1216: virtualization disabled — mount/unmount during pan causes sluggishness.
             For typical canvas sizes (<100 nodes), keeping all nodes in DOM is faster. -->
        <VueFlow
          ref="vueFlowRef"
          :nodes="nodes"
          :edges="edges"
          :apply-default="false"
          :class="{ 'canvas-ready': isCanvasReady }"
          class="vue-flow-container"
          :node-types="nodeTypes"
          edges-focusable
          :elevate-nodes-on-select="false"
          elevate-edges-on-select
          zoom-on-scroll
          :pan-on-scroll="false"
          zoom-on-pinch
          :pan-on-drag="!shift && !control && !meta"
          :auto-pan-on-node-drag="false"
          :nodes-draggable="!control && !meta && !shift"
          :selection-on-drag="shift"
          :multi-selection-key-code="['Control', 'Meta', 'Shift']"
          :snap-to-grid="false"
          :snap-grid="[16, 16]"
          :node-extent="dynamicNodeExtent"
          :min-zoom="0.05"
          :max-zoom="4.0"
          :fit-view-on-init="false"
          :connection-mode="looseConnectionMode"
          :connection-radius="30"
          :zoom-scroll-sensitivity="1.0"
          :zoom-activation-key-code="null"
          :delete-key-code="disabledDeleteKey"
          prevent-scrolling
          :default-viewport="initialViewport"
          dir="ltr"
          @pane-ready="onPaneReady"
          @node-click="handleNodeClick"
          @node-double-click="handleNodeDoubleClick"
          @node-drag-start="handleNodeDragStart"
          @node-drag="handleNodeDrag"
          @node-drag-stop="handleNodeDragStopWithReorder"
          @nodes-change="handleNodesChange"
          @edges-change="handleEdgesChange"
          @selection-change="handleSelectionChange"
          @pane-click="handlePaneClick"
          @pane-context-menu="handlePaneContextMenu"
          @node-context-menu="handleNodeContextMenu"
          @edge-click="handleEdgeClick"
          @edge-context-menu="handleEdgeContextMenu"
          @edge-double-click="handleEdgeDoubleClick"
          @connect="handleConnect"
          @connect-start="handleConnectStart"
          @connect-end="handleConnectEnd"
          @keydown="handleKeyDown"
        >
          <Background
            pattern-color="#e5e7eb"
            pattern="dots"
            :gap="16"
            :size="1"
          />

          <!-- Section Node Template -->
          <template #node-sectionNode="nodeProps">
            <GroupNodeSimple
              :id="nodeProps.id"
              v-memo="[nodeProps.id, nodeProps.data, nodeProps.selected, nodeProps.dragging]"
              :data="nodeProps.data"
              :selected="nodeProps.selected"
              :dragging="nodeProps.dragging"
              @update="(data) => handleSectionUpdate(nodeProps.id, data)"
              @collect="collectTasksForSection"
              @apply-group-props="(payload) => applyGroupPropsToTasks(payload.groupId, payload.mode)"
              @context-menu="handleSectionContextMenu"
              @open-settings="handleOpenSectionSettings"
              @resize-start="handleSectionResizeStart"
              @resize="handleSectionResize"
              @resize-end="handleSectionResizeEnd"
            />
          </template>



          <!-- Image Node Template (TASK-1690) -->
          <template #node-imageNode="nodeProps">
            <ImageNode :data="nodeProps.data" :selected="nodeProps.selected" />
          </template>

          <!-- Custom Task Node Template -->
          <!-- TASK-262: Using onSelect callback prop instead of @select emit -->
          <!-- Vue's emit system doesn't work reliably in Vue Flow custom nodes -->
          <!-- TASK-279: Using editCallback prop instead of @edit emit -->
          <!-- Vue's emit system doesn't work reliably in Vue Flow custom nodes -->
          <template #node-taskNode="nodeProps">
            <TaskNode
              :task="nodeProps.data.task"
              :is-selected="nodeProps.selected"
              :is-dragging="nodeProps.dragging"
              :multi-select-mode="canvasStore.multiSelectMode"
              :show-priority="canvasStore.showPriorityIndicator"
              :show-status="canvasStore.showStatusBadge"
              :show-duration="canvasStore.showDurationBadge"
              :show-schedule="canvasStore.showScheduleBadge"
              :select-callback="handleTaskSelect"
              :edit-callback="handleEditTask"
              @edit="handleEditTask"
              @select="handleTaskSelect"
              @context-menu="handleTaskContextMenu"
            />
          </template>

          <!-- SVG markers for connection arrows -->
          <svg style="position: absolute; width: 0; height: 0; pointer-events: none;">
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <polygon points="0 0, 10 3, 0 6" fill="var(--border-secondary)" />
              </marker>
              <marker
                id="arrowhead-hover"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <polygon points="0 0, 10 3, 0 6" fill="var(--color-navigation)" />
              </marker>
            </defs>
          </svg>
        </VueFlow>

        <!-- Selection box outside VueFlow to avoid transform issues -->
        <CanvasSelectionBox :selection-box="selectionBox" />

        <CanvasLoadingOverlay
          v-if="!isCanvasReady"
          message="Initializing Canvas..."
        />

        <!-- TASK-1690: Simple image node context menu -->
        <Teleport to="body">
          <div
            v-if="imageContextMenu.show"
            class="image-context-menu"
            :style="{ left: imageContextMenu.x + 'px', top: imageContextMenu.y + 'px' }"
            @click.stop
          >
            <button class="image-context-menu-item danger" @click="deleteImageFromContextMenu">
              Delete Image
            </button>
          </div>
          <div
            v-if="imageContextMenu.show"
            class="image-context-menu-backdrop"
            @click="imageContextMenu.show = false"
            @contextmenu.prevent="imageContextMenu.show = false"
          />
        </Teleport>
      </div>
    </div>

    <!-- Modals -->
    <CanvasModals
      @handle-quick-task-create="handleQuickTaskCreate"
      @handle-batch-edit-applied="handleBatchEditApplied"
      @handle-section-settings-save="handleSectionSettingsSave"
      @handle-group-created="handleGroupCreated"
      @handle-group-updated="handleGroupUpdated"
      @handle-group-edit-save="handleGroupEditSave"
      @confirm-delete-group="confirmDeleteGroup"
      @confirm-bulk-delete="confirmBulkDelete"
    />

    <CanvasContextMenus
      @create-task-here="createTaskHere"
      @create-group="createGroup"
      @edit-group="editGroup"
      @delete-group="deleteGroup"
      @move-to-inbox="moveSelectedTasksToInbox"
      @done-for-now="doneForNowSelectedTasks"
      @delete-tasks="deleteSelectedTasks"
      @align-left="alignLeft"
      @align-right="alignRight"
      @align-top="alignTop"
      @align-bottom="alignBottom"
      @align-center-horizontal="alignCenterHorizontal"
      @align-center-vertical="alignCenterVertical"
      @distribute-horizontal="distributeHorizontal"
      @distribute-vertical="distributeVertical"
      @arrange-in-row="arrangeInRow"
      @arrange-in-column="arrangeInColumn"
      @arrange-in-grid="arrangeInGrid"
      @create-task-in-group="handleCreateTaskInGroupDebug"
      @open-group-settings="handleOpenSectionSettingsFromContext"
      @toggle-power-mode="handleToggleFocusMode"
      @collect-tasks="handleCollectTasksFromMenu"
      @collect-overdue-tasks="handleCollectOverdueFromMenu"
      @disconnect-edge="disconnectEdge"
      @delete-node="deleteNode"
      @create-group-from-selection="createGroupFromSelection"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, markRaw, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { ConnectionMode, VueFlow, useVueFlow, type NodeMouseEvent, type NodeDragEvent, type NodeTypesObject } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import '@vue-flow/node-resizer/dist/style.css'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '../assets/vue-flow-overrides.css'
import { useEventListener } from '@vueuse/core'

import { useTaskStore } from '../stores/tasks'
import { useCanvasStore } from '../stores/canvas'
import { useUIStore } from '../stores/ui'
import { useCanvasContextMenuStore } from '../stores/canvas/contextMenus'
import { getViewportCoordinates } from '@/utils/contextMenuCoordinates'
import type { Task } from '@/types/tasks'
import type { CanvasGroup } from '@/types/canvas'

import TaskNode from '../components/canvas/TaskNode.vue'
import GroupNodeSimple from '../components/canvas/GroupNodeSimple.vue'
import ImageNode from '../components/canvas/ImageNode.vue'
import UnifiedInboxPanel from '../components/inbox/UnifiedInboxPanel.vue'
import CanvasModals from '../components/canvas/CanvasModals.vue'
import CanvasEmptyState from '../components/canvas/CanvasEmptyState.vue'
import CanvasContextMenus from '../components/canvas/CanvasContextMenus.vue'

import { useCanvasModalsStore } from '@/stores/canvas/modals'
import CanvasToolbar from '../components/canvas/CanvasToolbar.vue'
import CanvasStatusBanner from '../components/canvas/CanvasStatusBanner.vue'
import CanvasLoadingOverlay from '../components/canvas/CanvasLoadingOverlay.vue'
import CanvasSelectionBox from '../components/canvas/CanvasSelectionBox.vue'
import DayRotationBanner from '../components/canvas/DayRotationBanner.vue'

import { useCanvasContextMenus } from '@/composables/canvas/useCanvasContextMenus'
import { useCanvasOrchestrator } from '../composables/canvas/useCanvasOrchestrator'
import { useDayGroupRotation } from '@/composables/canvas/useDayGroupRotation'
import { useTidyLayout } from '@/composables/canvas/useTidyLayout'
import { useCurrentDay } from '@/composables/useCurrentDay'
import { useCanvasImagesStore } from '@/stores/canvasImages'
import { useAuthStore } from '@/stores/auth'
import { getClipboardImage, compressImage, uploadCanvasImage } from '@/services/canvasImageUpload'
import { CanvasIds } from '@/utils/canvas/canvasIds'
import { getDeepestContainingGroup } from '@/utils/canvas/spatialContainment'
import { lockManager } from '@/services/canvas/LockManager'

const taskStore = useTaskStore()
const canvasStore = useCanvasStore()
const uiStore = useUIStore()
const modalsStore = useCanvasModalsStore()
const contextMenuStore = useCanvasContextMenuStore()
const activeStatusFilter = computed(() => taskStore.activeStatusFilter)

// Register custom node types
const nodeTypes = {
  taskNode: markRaw(TaskNode),
  sectionNode: markRaw(GroupNodeSimple),
  imageNode: markRaw(ImageNode),
} as unknown as NodeTypesObject
const looseConnectionMode = ConnectionMode.Loose
const disabledDeleteKey = null

// FEATURE-1048: Day group auto-rotation at midnight
const { findNode, getNodes, setNodes, getViewport } = useVueFlow()

type CanvasNodeRecord = {
  id: string
  type?: string
  position?: { x: number; y: number }
  parentNode?: string
  computedPosition?: { x: number; y: number; z?: number }
  dimensions?: { width?: number; height?: number }
  measured?: { width?: number; height?: number }
  width?: number
  height?: number
  style?: Record<string, unknown>
  data?: Record<string, unknown>
  [key: string]: unknown
}

function toPublicVueFlowNode(node: CanvasNodeRecord) {
  const {
    computedPosition: _computedPosition,
    handleBounds: _handleBounds,
    initialized: _initialized,
    isParent: _isParent,
    measured: _measured,
    selected: _selected,
    dragging: _dragging,
    resizing: _resizing,
    ...publicNode
  } = node
  return publicNode
}

// TASK-1756 v10: Vue Flow dimension bookkeeping uses the top-level
// `width` / `height` fields on the node. Setting only `style.width` (px)
// renders visually but Vue Flow's internal bounds use the OLD `width`, so
// NodeResizer + spatial validation see stale dimensions → overlap + detach.
// Pass BOTH the top-level fields (numbers) AND the style (px strings) for
// GroupNodeSimple, which reads off `node.style` in its template.
function applyCanonicalMoves(
  groupMoves: Array<{ nodeId: string; groupId: string; position: { x: number; y: number }; size: { width: number; height: number } }>,
  taskMoves: Array<{ taskId: string; parentId: string; position: { x: number; y: number } }>,
) {
  console.log('[CANONICAL-LAYOUT:VF] Applying atomic layout', {
    groupMoves: groupMoves.length,
    taskMoves: taskMoves.length,
  })

  const groupMovesByNodeId = new Map(groupMoves.map((move) => [move.nodeId, move]))
  const targetGroupPositions = new Map(groupMoves.map((move) => [move.groupId, move.position]))
  const taskMovesByNodeId = new Map(taskMoves.map((move) => [CanvasIds.taskNodeId(move.taskId), move]))
  const currentNodes = (getNodes.value?.length ? getNodes.value : nodes.value) as unknown as CanvasNodeRecord[]
  const originalIndex = new Map(currentNodes.map((node, index) => [node.id, index]))

  const updatedNodes = currentNodes.map((node) => {
    const groupMove = groupMovesByNodeId.get(node.id)
    if (groupMove) {
      console.log(`[CANONICAL-LAYOUT:VF] ${node.id}: x=${Math.round(node.position?.x ?? 0)} -> ${Math.round(groupMove.position.x)}, w=${Math.round(groupMove.size.width)}, h=${Math.round(groupMove.size.height)}`)
      return {
        ...node,
        position: groupMove.position,
        width: groupMove.size.width,
        height: groupMove.size.height,
        dimensions: {
          ...(node.dimensions ?? {}),
          width: groupMove.size.width,
          height: groupMove.size.height,
        },
        style: {
          ...(node.style ?? {}),
          width: `${groupMove.size.width}px`,
          height: `${groupMove.size.height}px`,
        },
      }
    }

    const taskMove = taskMovesByNodeId.get(node.id)
    if (taskMove) {
      const parentNodeId = CanvasIds.groupNodeId(taskMove.parentId)
      const parentAbsPos =
        targetGroupPositions.get(taskMove.parentId) ??
        (() => {
          const updatedParent = groupMovesByNodeId.get(parentNodeId)
          if (updatedParent) return updatedParent.position
          const parentNode = currentNodes.find((candidate) => candidate.id === parentNodeId)
          return parentNode?.position ? { x: parentNode.position.x, y: parentNode.position.y } : undefined
        })() ??
        (() => {
          const parentGroup = canvasStore.groups.find((group) => group.id === taskMove.parentId)
          return parentGroup?.position ? { x: parentGroup.position.x, y: parentGroup.position.y } : undefined
        })()

      if (!parentAbsPos) return node

      const relativePosition = {
        x: taskMove.position.x - parentAbsPos.x,
        y: taskMove.position.y - parentAbsPos.y,
      }

      return {
        ...node,
        position: relativePosition,
        parentNode: parentNodeId,
        extent: undefined,
        expandParent: false,
        draggable: true,
        selectable: true,
      }
    }

    return node
  }).sort((a, b) => {
    if (a.id === b.parentNode) return -1
    if (b.id === a.parentNode) return 1
    if (a.parentNode && !b.parentNode) return 1
    if (!a.parentNode && b.parentNode) return -1
    return (originalIndex.get(a.id) ?? 0) - (originalIndex.get(b.id) ?? 0)
  })

  setNodes(updatedNodes.map(toPublicVueFlowNode) as Parameters<typeof setNodes>[0])
}

const dayRotation = useDayGroupRotation({
  onMoves: (groupMoves) => applyCanonicalMoves(groupMoves, []),
  getNodePosition: (nodeId: string) => getVisualNodePosition(nodeId),
  getNodeSize: (nodeId: string) => getRenderedNodeSize(nodeId),
  isTaskVisible: (taskId: string) => {
    const node = findNode(CanvasIds.taskNodeId(taskId)) as CanvasNodeRecord | undefined
    if (node) return node.hidden !== true
    const taskElement = document.querySelector(`[data-task-id="${CSS.escape(taskId)}"]`)
    return taskElement != null
  },
})

function getVisualNodePosition(nodeId: string): { x: number; y: number } | undefined {
  const node = findNode(nodeId) as CanvasNodeRecord | undefined
  if (!node?.position) return undefined

  const computedPosition = node.computedPosition
  if (Number.isFinite(computedPosition?.x) && Number.isFinite(computedPosition?.y)) {
    return { x: computedPosition!.x, y: computedPosition!.y }
  }

  if (node.parentNode) {
    const parentNode = findNode(node.parentNode) as CanvasNodeRecord | undefined
    if (parentNode?.position) {
      return {
        x: parentNode.position.x + node.position.x,
        y: parentNode.position.y + node.position.y,
      }
    }
  }

  return { x: node.position.x, y: node.position.y }
}

function getRenderedNodeSize(nodeId: string) {
  const element = document.querySelector(`[data-task-id="${CSS.escape(nodeId)}"]`) as HTMLElement | null
    ?? document.querySelector(`[data-id="${CSS.escape(nodeId)}"]`) as HTMLElement | null
  const rect = element?.getBoundingClientRect()
  if (rect && rect.width > 0 && rect.height > 0) {
    const zoom = getRenderedCanvasZoom()
    const measured = {
      width: Math.max(rect.width / zoom, element?.scrollWidth ?? 0, element?.offsetWidth ?? 0),
      height: Math.max(rect.height / zoom, element?.scrollHeight ?? 0, element?.offsetHeight ?? 0),
    }
    return measured
  }

  const node = findNode(nodeId) as CanvasNodeRecord | undefined
  const width = node?.dimensions?.width ?? node?.measured?.width ?? node?.width
  const height = node?.dimensions?.height ?? node?.measured?.height ?? node?.height
  return Number.isFinite(width) && Number.isFinite(height) ? { width: width as number, height: height as number } : undefined
}

function getRenderedCanvasZoom() {
  const viewportElement = document.querySelector('.vue-flow__viewport') as HTMLElement | null
  const transform = viewportElement ? getComputedStyle(viewportElement).transform : ''
  const matrixScale = transform.match(/matrix\(([^)]+)\)/)?.[1]?.split(',')?.[0]
  const renderedZoom = matrixScale ? Number(matrixScale.trim()) : NaN
  if (Number.isFinite(renderedZoom) && renderedZoom > 0) return renderedZoom
  return getViewport().zoom || 1
}

const tidyLayout = useTidyLayout({
  getNodePosition: (nodeId: string) => getVisualNodePosition(nodeId),
  getNodeSize: (nodeId: string) => getRenderedNodeSize(nodeId),
  isTaskVisible: (taskId: string) => {
    const node = findNode(CanvasIds.taskNodeId(taskId)) as CanvasNodeRecord | undefined
    if (node) return node.hidden !== true
    const taskElement = document.querySelector(`[data-task-id="${CSS.escape(taskId)}"]`)
    return taskElement != null
  },
})

// TASK-1756 v10: Vue Flow's dimension + bounds bookkeeping lags Vue's
// reactivity cycle. Single nextTick lets the BUG-1203 spatial validator
// run while VF still sees stale parent dimensions → tasks get orphaned.
// Double nextTick is the reliable pattern.
function releaseOnDoubleNextTick(release: () => void, afterRelease?: () => void, pendingWrites?: Promise<void>) {
  nextTick(() => nextTick(() => {
    const finish = () => {
      release()
      afterRelease?.()
    }
    if (pendingWrites) {
      pendingWrites.finally(finish)
    } else {
      finish()
    }
  }))
}

function handleRotateDayGroups() {
  // TASK-1756 v3: toolbar still bypasses lastRotationDate guard via { force: true }
  // on rotateDayGroups (dueDate/marker path). Physical rotation always produces
  // moves — the canonical primitive owns all geometry math now.
  dayRotation.rotateDayGroups({ force: true })
  const { groupMoves, taskMoves, pendingWrites, release } = dayRotation.rotateDayGroupPositions()
  applyCanonicalMoves(groupMoves, taskMoves)
  releaseOnDoubleNextTick(release, () => {
    syncNodes(undefined, { force: true })
  }, pendingWrites)
}

async function handleTidyLayout() {
  // BUG-1899: Tidy plans from the CURRENT store — if the initial canvas load is
  // still in flight, it lays out a partial store (recorder-proven "3 rows" /
  // groups-skipped flake). Wait briefly for both stores' first load to settle.
  const tidyWaitStart = Date.now()
  const hasUsableCanvasData = () =>
    canvasStore.groups.some((group) => !!group.position)
    || taskStore.rawTasks.some((task) => !!task.canvasPosition)
  while (
    !hasUsableCanvasData() &&
    Date.now() - tidyWaitStart < 10_000
  ) {
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  if (!hasUsableCanvasData()) {
    console.warn('[TIDY] No usable canvas geometry after waiting for initialization')
    return
  }

  // TASK-1756 v8: lay out all smart + day-of-week groups in a clean single row
  // (user's left-to-right order preserved) and restack tasks inside them.
  const { groupMoves, taskMoves, pendingWrites, release } = tidyLayout.tidyDayGroups()
  applyCanonicalMoves(groupMoves, taskMoves)
  // Tidy has two sources to settle: the immediate Vue Flow move and the
  // optimistic store write. After both have settled, force the read path to
  // rebuild Vue Flow nodes from the now-current absolute store geometry. This
  // prevents stale child `position` / `computedPosition` state from surviving
  // a programmatic reparent/restack.
  releaseOnDoubleNextTick(release, () => {
    syncNodes(undefined, { force: true })
    if (import.meta.env.DEV) {
      nextTick(() => nextTick(() => logPostTidySanity(groupMoves, taskMoves)))
    }
  }, pendingWrites)
}

function logPostTidySanity(
  groupMoves: Array<{ groupId: string }>,
  taskMoves: Array<{ taskId: string }>
) {
  const today = getTodayTaskDebugSnapshot()
  const lockedGroups = groupMoves
    .map((move) => move.groupId)
    .filter((id) => lockManager.isLocked(id))
  const lockedTasks = taskMoves
    .map((move) => move.taskId)
    .filter((id) => lockManager.isLocked(id))
  const summary = {
    renderedGapStats: today.renderedGapStats,
    lockedGroups,
    lockedTasks,
    ok: today.renderedGapStats.compact
      && today.renderedGapStats.consistent
      && lockedGroups.length === 0
      && lockedTasks.length === 0,
  }

  if (summary.ok) {
    console.log('[TIDY:SANITY]', summary)
  } else {
    console.warn('[TIDY:SANITY]', summary)
  }
}

function getCanvasNodeSnapshot(limit = 12) {
  const domNodes = Array.from(document.querySelectorAll('.vue-flow__node')) as HTMLElement[]
  const vfNodes = getNodes.value as unknown as CanvasNodeRecord[]
  const vfById = new Map(vfNodes.map((node) => [node.id, node]))
  return domNodes.slice(0, limit).map((el) => {
    const id = el.getAttribute('data-id') ?? ''
    const rect = el.getBoundingClientRect()
    const vfNode = vfById.get(id)
    return {
      id,
      type: vfNode?.type,
      parentNode: vfNode?.parentNode ?? null,
      nodePosition: vfNode?.position ? { ...vfNode.position } : null,
      computedPosition: vfNode?.computedPosition ? { ...vfNode.computedPosition } : null,
      transform: el.getAttribute('style')?.match(/translate\(([^)]+)\)/)?.[1] ?? null,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    }
  })
}

function getCanvasNudgeSnapshot(taskIds?: string[]) {
  const viewportElement = document.querySelector('.vue-flow__viewport') as HTMLElement | null
  const viewportStyle = viewportElement ? getComputedStyle(viewportElement) : null
  const vfNodes = getNodes.value as unknown as CanvasNodeRecord[]
  const vfById = new Map(vfNodes.map((node) => [node.id, node]))
  const ids = taskIds?.length
    ? taskIds
    : taskStore.rawTasks
      .filter((task) => task.canvasPosition)
      .slice(0, 8)
      .map((task) => task.id)

  return {
    viewport: {
      vueFlow: getViewport(),
      store: { ...canvasStore.viewport },
      domTransform: viewportStyle?.transform ?? null,
    },
    groups: canvasStore.groups.map((group) => ({
      id: group.id,
      name: group.name,
      parentGroupId: group.parentGroupId ?? null,
      position: group.position ? { ...group.position } : null,
    })),
    tasks: ids.map((id) => {
      const task = taskStore.rawTasks.find((candidate) => candidate.id === id)
      const node = vfById.get(id)
      const taskElement = document.querySelector(`[data-task-id="${CSS.escape(id)}"]`) as HTMLElement | null
        ?? document.querySelector(`[data-id="${CSS.escape(id)}"]`) as HTMLElement | null
      const nodeElement = taskElement?.closest('.vue-flow__node') as HTMLElement | null
        ?? document.querySelector(`.vue-flow__node[data-id="${CSS.escape(id)}"]`) as HTMLElement | null
      const rect = nodeElement?.getBoundingClientRect()

      return {
        id,
        title: task?.title?.slice(0, 60) ?? null,
        status: task?.status ?? null,
        parentId: task?.parentId ?? null,
        storePosition: task?.canvasPosition ? { ...task.canvasPosition } : null,
        positionVersion: task?.positionVersion ?? null,
        vueFlow: node ? {
          parentNode: node.parentNode ?? null,
          hidden: node.hidden === true,
          position: node.position ? { ...node.position } : null,
          computedPosition: node.computedPosition ? { ...node.computedPosition } : null,
          dimensions: node.dimensions ? { ...node.dimensions } : null,
        } : null,
        dom: rect ? {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          transform: nodeElement?.style.transform || null,
        } : null,
      }
    }),
  }
}

function logCanvasNudgeSnapshot(taskIds?: string[]) {
  const snapshot = getCanvasNudgeSnapshot(taskIds)
  console.warn('[CANVAS-NUDGE-SNAPSHOT]', JSON.stringify(snapshot))
  return snapshot
}

function getTodayTaskDebugSnapshot() {
  const todayGroup = canvasStore.groups.find((group) =>
    group.name === 'Today' || (group as { type?: string }).type === 'today'
  )
  const tasks = todayGroup
    ? taskStore.rawTasks
      .filter((task) => task.parentId === todayGroup.id && task.canvasPosition)
      .sort((a, b) => (a.canvasPosition?.y ?? 0) - (b.canvasPosition?.y ?? 0))
    : []
  const renderedTasks = getRenderedTaskGapMetrics(tasks.map((task) => task.id))
  const renderedGaps = renderedTasks.slice(1).map((task, index) =>
    Math.round(task.visualTop - renderedTasks[index].visualBottom)
  )

  return {
    todayGroup: todayGroup ? {
      id: todayGroup.id,
      name: todayGroup.name,
      position: todayGroup.position ? { ...todayGroup.position } : null,
    } : null,
    count: tasks.length,
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title?.slice(0, 60),
      parentId: task.parentId ?? null,
      canvasPosition: task.canvasPosition ? { ...task.canvasPosition } : null,
    })),
    yDeltas: tasks.slice(1).map((task, index) =>
      Math.round((task.canvasPosition?.y ?? 0) - (tasks[index].canvasPosition?.y ?? 0))
    ),
    renderedTasks,
    renderedGaps,
    renderedGapStats: summarizeRenderedGaps(renderedGaps),
  }
}

function getRenderedTaskGapMetrics(taskIds: string[]) {
  const zoom = getRenderedCanvasZoom()
  const vfNodes = getNodes.value as unknown as CanvasNodeRecord[]
  const vfById = new Map(vfNodes.map((node) => [node.id, node]))

  return taskIds
    .map((taskId) => {
      const taskElement = document.querySelector(`[data-task-id="${CSS.escape(taskId)}"]`) as HTMLElement | null
      const nodeElement = taskElement?.closest('.vue-flow__node') as HTMLElement | null
      const rect = taskElement?.getBoundingClientRect()
      const vfNode = vfById.get(taskId)
      const computedY = vfNode?.computedPosition?.y
      const positionY = vfNode?.position?.y
      const visualTop = Number.isFinite(computedY)
        ? computedY
        : Number.isFinite(positionY)
          ? positionY
          : null
      const renderedHeight = rect && zoom > 0
        ? rect.height / zoom
        : null

      return {
        id: taskId,
        visualTop: visualTop ?? 0,
        visualBottom: visualTop != null && renderedHeight != null ? visualTop + renderedHeight : 0,
        renderedHeight: renderedHeight != null ? Math.round(renderedHeight) : null,
        screenRect: rect ? {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        } : null,
        nodeTransform: nodeElement?.getAttribute('style')?.match(/translate\(([^)]+)\)/)?.[1] ?? null,
      }
    })
    .sort((a, b) => a.visualTop - b.visualTop)
}

function summarizeRenderedGaps(gaps: number[]) {
  if (gaps.length === 0) {
    return {
      count: 0,
      min: null,
      max: null,
      average: null,
      spread: null,
      compact: true,
      consistent: true,
    }
  }

  const min = Math.min(...gaps)
  const max = Math.max(...gaps)
  const average = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length
  return {
    count: gaps.length,
    min,
    max,
    average: Math.round(average),
    spread: max - min,
    compact: max <= 32,
    consistent: max - min <= 16,
  }
}

async function debugTidyLayout() {
  const before = getTidyDebugReadOnlySnapshot()
  const result = tidyLayout.tidyDayGroups()
  const planned = {
    groupMoves: result.groupMoves.map((move) => ({
      groupId: move.groupId,
      nodeId: move.nodeId,
      position: move.position,
      size: move.size,
    })),
    taskMoves: result.taskMoves.map((move) => ({
      taskId: move.taskId,
      parentId: move.parentId,
      position: move.position,
    })),
  }
  applyCanonicalMoves(result.groupMoves, result.taskMoves)
  await Promise.resolve(result.pendingWrites)
  await nextTick()
  await nextTick()
  result.release()
  syncNodes(undefined, { force: true })
  await nextTick()
  await nextTick()
  const after = getTidyDebugReadOnlySnapshot()
  const summary = { planned, before, after }
  ;(window as unknown as Record<string, unknown>).__POMO_FLOW_LAST_TIDY_DEBUG__ = summary
  console.log('[TIDY:DEBUG]', summary)
  console.log('[TIDY:DEBUG:JSON]', JSON.stringify(summary, null, 2))
  return summary
}

async function debugTidyLayoutToClipboard() {
  const summary = await debugTidyLayout()
  const json = JSON.stringify(summary, null, 2)
  try {
    await navigator.clipboard?.writeText(json)
    console.log('[TIDY:DEBUG:COPIED]', 'Copied Tidy debug JSON to clipboard')
  } catch (err) {
    console.warn('[TIDY:DEBUG:COPY-FAILED]', err)
  }
  return json
}

function getTidyDebugReadOnlySnapshot() {
  const lockSummary = getTidyLockSummary()
  return {
    today: getTodayTaskDebugSnapshot(),
    nodes: getCanvasNodeSnapshot(),
    locks: lockSummary,
    stores: {
      groups: canvasStore.groups.length,
      rawTasks: taskStore.rawTasks.length,
      tasks: taskStore.tasks.length,
      canvasReady: isCanvasReady.value,
      vueFlowReady: isVueFlowReady.value,
    },
  }
}

function getTidyLockSummary() {
  const groupIds = canvasStore.groups.map((group) => group.id)
  const taskIds = taskStore.rawTasks
    .filter((task) => task.canvasPosition)
    .map((task) => task.id)
  const lockedGroups = groupIds.filter((id) => lockManager.isLocked(id))
  const lockedTasks = taskIds.filter((id) => lockManager.isLocked(id))

  return {
    lockedGroups,
    lockedTasks,
    lockedCount: lockedGroups.length + lockedTasks.length,
  }
}

async function debugTidyPlanOnlyToClipboard() {
  const before = getTidyDebugReadOnlySnapshot()
  const result = tidyLayout.planTidyDayGroups()
  const planned = {
    groupMoves: result.groupMoves.map((move) => ({
      groupId: move.groupId,
      nodeId: move.nodeId,
      position: move.position,
      size: move.size,
    })),
    taskMoves: result.taskMoves.map((move) => ({
      taskId: move.taskId,
      parentId: move.parentId,
      position: move.position,
    })),
  }
  const summary = { planned, before }
  const json = JSON.stringify(summary, null, 2)
  ;(window as unknown as Record<string, unknown>).__POMO_FLOW_LAST_TIDY_PLAN__ = summary
  console.log('[TIDY:PLAN:JSON]', json)
  try {
    await navigator.clipboard?.writeText(json)
    console.log('[TIDY:PLAN:COPIED]', 'Copied Tidy plan JSON to clipboard')
  } catch (err) {
    console.warn('[TIDY:PLAN:COPY-FAILED]', err)
  }
  return json
}

// Initialize Orchestrator
const orchestrator = useCanvasOrchestrator()
const {
  nodes, edges, isCanvasReady, isVueFlowReady, initialViewport, shift, control, meta, vueFlowRef,
  tasksWithCanvasPosition, dynamicNodeExtent, hasNoTasks,
  handleNodeDragStart, handleNodeDrag, handleNodeDragStop, handleKeyDown,
  handleSectionResizeStart, handleSectionResize, handleSectionResizeEnd,
  onPaneReady,
  handlePaneClick, handleCanvasRightClick, handlePaneContextMenu, handleDrop,
  // BUG-208: Canvas context menu state now comes from contextMenuStore, not orchestrator
  createTaskHere, createGroup, editGroup, deleteGroup,
  moveSelectedTasksToInbox, doneForNowSelectedTasks, deleteSelectedTasks, createTaskInGroup,
  deleteNode, createGroupFromSelection,
  isSectionSettingsOpen, editingSection,
  handleQuickTaskCreate,
  handleBatchEditApplied, handleSectionSettingsSave,
  handleGroupCreated, handleGroupUpdated,
  handleGroupEditSave, confirmDeleteGroup, confirmBulkDelete, handleConnect, handleConnectStart, handleConnectEnd,
  handleEdgesChange, handleNodesChange,
  handleNodeContextMenu, handleEdgeClick, handleEdgeContextMenu, handleEdgeDoubleClick,
  handleNodeClick, handleSelectionChange,
  screenToFlowCoordinate,

  // From consolidated features
  selectionBox, handleMouseDown, handleMouseMove, handleMouseUp, handleCanvasContainerClick, handleTaskSelect,
  alignLeft, alignRight, alignTop, alignBottom, alignCenterHorizontal, alignCenterVertical,
  distributeHorizontal, distributeVertical, arrangeInRow, arrangeInColumn, arrangeInGrid,
  collectTasksForSection, autoCollectOverdueTasks: handleCollectTasksFromMenu, collectOverdueTasksNearGroup, applyGroupPropsToTasks, disconnectEdge,
  syncNodes
} = orchestrator

// TASK-1809: tracks whether the reorder key (F2) is currently held. Updated by
// window keydown/keyup listeners (registered in onMounted) and reset on blur so
// a key released while the window is unfocused can't leave reorder armed.
const reorderKeyHeld = ref(false)
function onReorderKeyDown(e: KeyboardEvent) {
  if (e.key === 'F2') reorderKeyHeld.value = true
}
function onReorderKeyUp(e: KeyboardEvent) {
  if (e.key === 'F2') reorderKeyHeld.value = false
}
function onWindowBlurResetReorderKey() {
  reorderKeyHeld.value = false
}

// TASK-1809: hold F2 + drag to reorder tasks within a canvas column.
// Wrap the normal drag-stop save. When the user held F2 while dropping a
// task inside a group, restack that one column (insert-and-shift) so the
// dropped card takes the slot its drop-Y landed in and the rest shift down.
// Plain drops (F2 not held) are untouched — they keep free placement.
// Why F2 and not a mouse modifier: Shift/Control/Meta disable node dragging
// (:nodes-draggable="!control && !meta && !shift") and Shift is Vue Flow's
// multi-select; Alt is grabbed by KDE's window-move gesture in Electron. F2 is
// outside all of those, so the node still drags and no WM/selection conflict.
async function handleNodeDragStopWithReorder(event: NodeDragEvent) {
  const reorderHeld = reorderKeyHeld.value

  // Plain drag (F2 not held): unchanged single-writer behavior.
  if (!reorderHeld) {
    await handleNodeDragStop(event)
    return
  }

  // Find the dropped task node (skip group/image nodes).
  const droppedTaskNode = (event?.nodes ?? []).find(
    (node) => !CanvasIds.isGroupNode(node.id) && node.type !== 'imageNode'
  )
  const task = droppedTaskNode ? taskStore.getTask(droppedTaskNode.id) : undefined
  const currentParentId = task?.parentId ?? null

  // Same-column detection (synchronous): the node's live `parentNode` still
  // points at the old group here (Vue Flow re-parents later), so use spatial
  // containment. Same column iff the drop is still inside the current parent.
  const allGroups = canvasStore._rawGroups || canvasStore.groups || []
  const absPos = droppedTaskNode?.computedPosition ?? droppedTaskNode?.position
  const containingGroup = droppedTaskNode && absPos
    ? getDeepestContainingGroup(
        {
          position: absPos,
          width: (droppedTaskNode as unknown as { width?: number }).width,
          height: (droppedTaskNode as unknown as { height?: number }).height,
        },
        allGroups
      )
    : null
  const sameColumn = !!currentParentId && containingGroup?.id === currentParentId

  if (!droppedTaskNode || !sameColumn) {
    // Cross-group / not-contained F2 drop (rare): persist the re-parent first,
    // then reorder the destination column. A slight delay here is acceptable.
    await handleNodeDragStop(event)
    const destGroupId = taskStore.getTask(droppedTaskNode?.id ?? '')?.parentId
    if (!destGroupId) return
    const result = tidyLayout.reorderColumn(destGroupId)
    if (result.taskMoves.length === 0) {
      result.release()
      return
    }
    applyCanonicalMoves(result.groupMoves, result.taskMoves)
    const pendingWrites = result.commit()
    releaseOnDoubleNextTick(result.release, () => {
      syncNodes(undefined, { force: true })
    }, pendingWrites)
    return
  }

  // Same-column instant path. Start the drag save but DON'T await yet: its
  // synchronous prefix passes the canvasSyncInProgress guard while the flag is
  // still false, then suspends. reorderColumn (below) flips the flag — so it
  // MUST run after handleNodeDragStop has started.
  const dragDone = handleNodeDragStop(event)

  const result = tidyLayout.reorderColumn(currentParentId)
  if (result.taskMoves.length === 0) {
    result.release()
    await dragDone
    return
  }

  // Instant paint — synchronous Vue Flow update in the drop frame.
  applyCanonicalMoves(result.groupMoves, result.taskMoves)

  // Let the drag handler's (pre-reorder) write land first, THEN commit the
  // reorder writes so they win the last-write-wins race on persistence.
  await dragDone
  const pendingWrites = result.commit()
  releaseOnDoubleNextTick(result.release, () => {
    syncNodes(undefined, { force: true })
  }, pendingWrites)
}

// TASK-1756 v3: run day-group catchup once Vue Flow is fully ready (findNode
// works) and whenever the reactive "today" flips (midnight, focus, online,
// pageshow, visibility). The composable's persisted `lastRotationDate` guard
// makes repeat calls on the same day no-ops.
//
// `isVueFlowReady` flips true inside `onPaneReady` — the only safe signal
// that `useVueFlow().findNode('section-xxx')` will return a node. Using
// `isCanvasReady` (which tracks loading/syncing only) races the pane mount
// on cold starts and leaves applyDayGroupMoves with NOT FOUND for every id.
const currentDay = useCurrentDay()
function runDayGroupCatchup() {
  // BUG-1780 / BUG-1980: runCatchupIfNeeded only returns group-moves on a
  // genuine missed-midnight (persisted marker older than today) — never on a
  // same-day reload / app update / first-ever launch, so it does NOT reintroduce
  // the "rearrange reverts on restart" regression. On that once-per-real-day
  // crossing we apply the full physical rotation (positions + re-home) so a
  // closed-at-midnight app self-corrects on open, exactly as the open-at-midnight
  // path would. Same-day reloads stay metadata-only (empty moves here).
  const { groupMoves, taskMoves, pendingWrites, release } = dayRotation.runCatchupIfNeeded()
  const hasMoves = groupMoves.length > 0 || taskMoves.length > 0
  if (hasMoves) applyCanonicalMoves(groupMoves, taskMoves)
  releaseOnDoubleNextTick(
    release,
    groupMoves.length > 0 ? () => syncNodes(undefined, { force: true }) : undefined,
    pendingWrites
  )
}
watch(isVueFlowReady, (ready) => { if (ready) runDayGroupCatchup() }, { immediate: true })
watch(currentDay, runDayGroupCatchup)

// TASK-1722: Focusable canvas container ref for keyboard event handling
const canvasContainerRef = ref<HTMLElement | null>(null)

// TASK-1722: Register ALL hotkeys globally — canvas-container @keydown doesn't reliably
// receive events because VueFlow node wrappers steal focus on drag/click.
useEventListener(window, 'keydown', (e) => {
  handleKeyDown(e)
})

// Aliases for template compatibility
const tasksWithCanvasPositions = tasksWithCanvasPosition
const handleToolbarCreateGroup = createGroup
const handleAddTask = () => createTaskHere()
const clearStatusFilter = () => { taskStore.activeStatusFilter = null }
// UI Wrappers
const handleOpenSectionSettings = (id: string) => {
    const section = canvasStore.groups.find(g => g.id === id)
    if (section) { editingSection.value = section; isSectionSettingsOpen.value = true }
}
const handleOpenSectionSettingsFromContext = () => {
    // BUG-208: Use store for context menu state
    if (contextMenuStore.canvasContextSection) handleOpenSectionSettings(contextMenuStore.canvasContextSection.id)
}
const handleToggleFocusMode = () => uiStore.toggleFocusMode()

// TASK-1222: Collect overdue tasks near a group
const handleCollectOverdueFromMenu = (section: CanvasGroup) => {
  collectOverdueTasksNearGroup(section.id)
}

// TASK-1222: Listen for AI tool collect-overdue-tasks events
useEventListener(window, 'collect-overdue-tasks', (e: Event) => {
  const detail = (e as CustomEvent).detail
  if (detail?.groupId) {
    collectOverdueTasksNearGroup(detail.groupId)
  }
})

// Sidebar quick-add on canvas view: create task at viewport center
useEventListener(window, 'sidebar-quick-task-create', async (e: Event) => {
  e.preventDefault()
  const data = (e as CustomEvent).detail
  if (!data?.title) {
    data?.onComplete?.(false)
    return
  }

  let saved = false
  try {
    // Calculate viewport center in flow coordinates
    const vueFlowElement = document.querySelector('.vue-flow')
    if (vueFlowElement) {
      const rect = vueFlowElement.getBoundingClientRect()
      const screenCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      }
      const flowCoords = screenToFlowCoordinate(screenCenter)
      modalsStore.quickTaskPosition = flowCoords
    } else {
      modalsStore.quickTaskPosition = { x: 200, y: 200 }
    }

    saved = await handleQuickTaskCreate(data)
  } catch (error) {
    console.error('Failed to handle sidebar Canvas task creation:', error)
  } finally {
    data.onComplete?.(saved)
  }
})

// TASK-288 DEBUG: Wrapper to trace createTaskInGroup call
const handleCreateTaskInGroupDebug = (section: CanvasGroup) => {
  // Get context menu position from store directly
  // Get context menu position from store directly
  // const menuX = contextMenuStore.canvasContextMenuX
  // const menuY = contextMenuStore.canvasContextMenuY

  createTaskInGroup(section)
}

const handleSectionUpdate = (id: string, data: Record<string, unknown>) => canvasStore.updateSection(id, data)
const { closeAllContextMenus: closeCanvasContextMenu } = useCanvasContextMenus()
const handleEditTask = (task: Task) => {
    const currentTask = taskStore.getTask(task.id) ?? task
    modalsStore.openEditModal(currentTask)
    closeCanvasContextMenu()
}
// Handle double-click on nodes to open edit modal for tasks
const handleNodeDoubleClick = ({ node }: NodeMouseEvent) => {
    if (node.type === 'taskNode') {
        const taskId = CanvasIds.parseNodeId(node.id).id
        const task = taskStore.getTask(taskId) ?? node.data?.task
        if (task) handleEditTask(task)
    }
}
const handleTaskContextMenu = (event: MouseEvent, task: Task) => {
    if (event) event.preventDefault()
    // Dispatch global event for ModalManager to handle (shared TaskContextMenu)
    window.dispatchEvent(new CustomEvent('task-context-menu', {
        detail: { event, taskId: task.id, task, context: 'canvas' }
    }))
}

const handleSectionContextMenu = (event: MouseEvent, section: CanvasGroup) => {
    if (event) {
        event.preventDefault()
        event.stopPropagation() // STOP PROPAGATION to prevent pane menu
    }
    // BUG-208 FIX: Use Pinia store instead of local refs
    // CanvasContextMenus.vue reads from the store, so we must write to it
    // BUG-1096: Use normalized coordinates for Tauri compatibility
    const { x, y } = getViewportCoordinates(event)
    contextMenuStore.openCanvasContextMenu(x, y, section as unknown as CanvasGroup)
}

// ============================================================================
// TASK-1690: Canvas Image Features (paste, context menu, delete)
// ============================================================================
const canvasImagesStore = useCanvasImagesStore()
const authStore = useAuthStore()

// Image context menu state
const imageContextMenu = ref<{ show: boolean; x: number; y: number; nodeId: string }>({
  show: false, x: 0, y: 0, nodeId: ''
})

const handleImageContextMenu = (e: Event) => {
  const { x, y, nodeId } = (e as CustomEvent).detail
  imageContextMenu.value = { show: true, x, y, nodeId }
}

const deleteImageFromContextMenu = async () => {
  if (imageContextMenu.value.nodeId) {
    const imgData = canvasImagesStore.images.find(i => i.id === imageContextMenu.value.nodeId)
    const removed = await canvasImagesStore.removeCanvasImage(imageContextMenu.value.nodeId)
    const snapshot = imgData ? { ...imgData, position: { ...imgData.position } } : removed
    if (snapshot) {
      const { pushImageDeleteUndo } = await import('@/composables/undoSingleton')
      pushImageDeleteUndo(snapshot)
    }
  }
  imageContextMenu.value.show = false
}

const handleCanvasPaste = async (e: ClipboardEvent) => {
  // Only intercept when not typing in an input / contenteditable
  const target = e.target as HTMLElement | null
  if (target) {
    const tag = target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
    if (target.closest('[role="dialog"], .modal, .n-modal, .n-dialog')) return
  }

  const imageFile = getClipboardImage(e)
  if (!imageFile) return

  e.preventDefault()

  const userId = authStore.user?.id ?? 'guest'

  try {
    const compressed = await compressImage(imageFile)
    const imageUrl = await uploadCanvasImage(compressed, userId)

    // Place at center of current viewport using orchestrator's screenToFlowCoordinate
    const vueFlowEl = document.querySelector('.vue-flow') as HTMLElement | null
    let centerFlow = { x: 400, y: 400 }
    if (vueFlowEl) {
      const rect = vueFlowEl.getBoundingClientRect()
      centerFlow = screenToFlowCoordinate({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    }

    canvasImagesStore.addCanvasImage({
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      imageUrl,
      position: { x: centerFlow.x, y: centerFlow.y },
      createdAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[CANVAS:PASTE] Failed to paste image:', err)
  }
}

onMounted(() => {
  document.addEventListener('paste', handleCanvasPaste)
  window.addEventListener('image-node-context-menu', handleImageContextMenu)
  // TASK-1809: track F2 held state for drag-to-reorder (no preventDefault — F2
  // has no default to suppress and we don't want to interfere with typing).
  window.addEventListener('keydown', onReorderKeyDown)
  window.addEventListener('keyup', onReorderKeyUp)
  window.addEventListener('blur', onWindowBlurResetReorderKey)
})
onUnmounted(() => {
  document.removeEventListener('paste', handleCanvasPaste)
  window.removeEventListener('image-node-context-menu', handleImageContextMenu)
  window.removeEventListener('keydown', onReorderKeyDown)
  window.removeEventListener('keyup', onReorderKeyUp)
  window.removeEventListener('blur', onWindowBlurResetReorderKey)
})

// Expose for testing purposes (Fundamental Stability)
if (process.env.NODE_ENV === 'development' || (window as unknown as Record<string, unknown>).PLAYWRIGHT_TEST) {
  (window as unknown as Record<string, unknown>).__POMO_FLOW_DEBUG__ = {
    orchestrator,
    canvasStore,
    taskStore,
    uiStore,
    debugTidyLayout,
    debugTidyLayoutToClipboard,
    debugTidyPlanOnlyToClipboard,
    getTodayTaskDebugSnapshot,
    getCanvasNodeSnapshot,
    getCanvasNudgeSnapshot,
    logCanvasNudgeSnapshot,
    getTidyLockSummary,
    // Debug Access to Singletons
    get positionManager() { return import('../services/canvas/PositionManager').then(m => m.positionManager) },
    get lockManager() { return import('../services/canvas/LockManager').then(m => m.lockManager) }
  }
}
</script>

<style scoped src="@/assets/canvas-view-layout.css"></style>

<style src="@/assets/canvas-view-overrides.css"></style>

<style>
/* TASK-1690: Image node context menu (teleported to body, must be unscoped) */
.image-context-menu {
  position: fixed;
  z-index: 9999;
  background: var(--overlay-component-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: var(--space-1);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
  min-width: 140px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.image-context-menu-item {
  display: block;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: var(--text-sm);
  text-align: start;
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.image-context-menu-item:hover {
  background: var(--glass-bg-soft);
}

.image-context-menu-item.danger {
  color: var(--color-danger);
}

.image-context-menu-item.danger:hover {
  background: var(--danger-bg-subtle);
}

.image-context-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9998;
}
</style>
