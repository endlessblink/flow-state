/**
 * Canvas Rotation + Layout composable.
 *
 * Extracted from CanvasView.vue (TASK-1788) so the rotation/render handlers
 * can be unit-tested in isolation. Two recent bugs (BUG-1786, BUG-1787)
 * touched these functions and exposed the coverage gap — they were locked
 * inside the SFC and only reachable via E2E.
 *
 * Functions moved here verbatim:
 *   - applyCanonicalLayoutMoves   — apply group geometry moves to Vue Flow
 *   - applyCanonicalTaskMoves     — apply task position+parent moves; owns BUG-1787 null-retry
 *   - refreshRenderedNodesFromModel — nuclear setNodes([]) → nextTick → setNodes(refreshed)
 *   - releaseOnDoubleNextTick     — release sync lock after 2× nextTick
 *   - getVisualNodePosition       — read a node's absolute visual position
 *   - getRenderedNodeSize         — measure rendered node size (DOM-aware)
 *   - getRenderedCanvasZoom       — read viewport zoom from CSS transform matrix
 *   - handleRotateDayGroups       — toolbar handler; owns BUG-1787 sync-lock pre-acquire
 *   - handleTidyLayout            — toolbar handler
 *   - runDayGroupCatchup          — mount-time catchup (preserves BUG-1780 no-group-moves)
 *
 * GEOMETRY INVARIANT (TASK-255): These handlers write geometry, but only in
 * response to explicit user actions (toolbar) or once-per-day catchup. They
 * do NOT run inside the sync watcher.
 */

import { nextTick, type Ref } from 'vue'
import { useVueFlow, type NodeChange } from '@vue-flow/core'
import { useCanvasStore } from '@/stores/canvas'
import { CanvasIds } from '@/utils/canvas/canvasIds'
import { canvasSyncInProgress } from './useCanvasSync'
import { useDayGroupRotation } from './useDayGroupRotation'
import { useTidyLayout } from './useTidyLayout'
import type { Task } from '@/stores/tasks'

export interface CanvasRotationLayoutDeps {
  /**
   * From useCanvasOrchestrator — needed by post-rotate/post-tidy callbacks
   * to flush Vue Flow node state.
   */
  syncNodes: (tasks?: Task[], options?: { force?: boolean }) => void
  /**
   * From useCanvasOrchestrator — applyCanonicalLayoutMoves fires this to
   * propagate position changes through the registered watchers.
   */
  handleNodesChange: (changes: NodeChange[]) => void
  /**
   * Reactive "today" ref used by the catchup watcher. Passed in to avoid a
   * second import of useCurrentDay; CanvasView already has it.
   */
  currentDay: Ref<Date>
}

export function useCanvasRotationLayout(deps: CanvasRotationLayoutDeps) {
  const { findNode, updateNode, setNodes, applyNodeChanges, getViewport, nodes } = useVueFlow()
  const canvasStore = useCanvasStore()

  // ===========================================================================
  // Vue Flow apply helpers
  // ===========================================================================

  // TASK-1756 v10: Vue Flow dimension bookkeeping uses the top-level
  // `width` / `height` fields on the node. Setting only `style.width` (px)
  // renders visually but Vue Flow's internal bounds use the OLD `width`, so
  // NodeResizer + spatial validation see stale dimensions → overlap + detach.
  // Pass BOTH the top-level fields (numbers) AND the style (px strings) for
  // GroupNodeSimple, which reads off `node.style` in its template.
  function applyCanonicalLayoutMoves(
    groupMoves: Array<{ nodeId: string; position: { x: number; y: number }; size: { width: number; height: number } }>
  ) {
    console.log('[CANONICAL-LAYOUT:VF] Applying', groupMoves.length, 'group moves')
    for (const move of groupMoves) {
      const node = findNode(move.nodeId)
      if (!node) {
        continue
      }
      console.log(`[CANONICAL-LAYOUT:VF] ${move.nodeId}: x=${Math.round(node.position.x)} → ${Math.round(move.position.x)}, w=${Math.round(move.size.width)}, h=${Math.round(move.size.height)}`)
      updateNode(move.nodeId, {
        width: move.size.width,
        height: move.size.height,
        style: {
          width: `${move.size.width}px`,
          height: `${move.size.height}px`,
        },
      })
      updateNode(move.nodeId, { position: move.position })
      nodes.value = nodes.value.map((candidate) => candidate.id === move.nodeId
        ? {
            ...candidate,
            position: move.position,
            computedPosition: {
              ...(candidate.computedPosition ?? {}),
              x: move.position.x,
              y: move.position.y,
            },
            width: move.size.width,
            height: move.size.height,
            dimensions: {
              ...(candidate.dimensions ?? {}),
              width: move.size.width,
              height: move.size.height,
            },
            style: {
              ...(candidate.style ?? {}),
              width: `${move.size.width}px`,
              height: `${move.size.height}px`,
            },
          }
        : candidate)
    }
    const positionChanges = groupMoves.map((move) => ({
      id: move.nodeId,
      type: 'position',
      position: move.position,
      dragging: false,
    }))
    applyNodeChanges(positionChanges as any)
    deps.handleNodesChange(positionChanges as any)
    setNodes(nodes.value)
  }

  function applyCanonicalTaskMoves(
    taskMoves: Array<{ taskId: string; parentId: string; position: { x: number; y: number } }>,
    groupMoves: Array<{ groupId: string; position: { x: number; y: number } }>
  ) {
    const targetGroupPositions = new Map(groupMoves.map((move) => [move.groupId, move.position]))
    const positionChanges: Array<{ id: string; type: 'position'; position: { x: number; y: number }; dragging: false }> = []
    // BUG-1787: Collect task moves whose Vue Flow node hasn't materialized yet,
    // then retry them on nextTick. Without this retry, tasks that arrived in the
    // store but haven't been picked up by the sync watcher get silently skipped
    // → their relative position stays anchored to the OLD parent position →
    // after the parent moves they render outside the group rect.
    const missing: typeof taskMoves = []

    for (const move of taskMoves) {
      const node = findNode(CanvasIds.taskNodeId(move.taskId))
      if (!node) {
        missing.push(move)
        continue
      }

      const parentAbsPos =
        targetGroupPositions.get(move.parentId) ??
        (() => {
          const parentNode = findNode(CanvasIds.groupNodeId(move.parentId))
          return parentNode ? { x: parentNode.position.x, y: parentNode.position.y } : undefined
        })() ??
        (() => {
          const parentGroup = canvasStore.groups.find((group) => group.id === move.parentId)
          return parentGroup?.position ? { x: parentGroup.position.x, y: parentGroup.position.y } : undefined
        })()

      if (!parentAbsPos) {
        continue
      }

      const taskNodeId = CanvasIds.taskNodeId(move.taskId)
      const relativePosition = {
        x: move.position.x - parentAbsPos.x,
        y: move.position.y - parentAbsPos.y,
      }

      updateNode(taskNodeId, {
        position: relativePosition,
        parentNode: CanvasIds.groupNodeId(move.parentId),
      })
      positionChanges.push({ id: taskNodeId, type: 'position', position: relativePosition, dragging: false })
      nodes.value = nodes.value.map((candidate) => candidate.id === taskNodeId
        ? {
            ...candidate,
            position: relativePosition,
            computedPosition: {
              ...(candidate.computedPosition ?? {}),
              x: move.position.x,
              y: move.position.y,
            },
            parentNode: CanvasIds.groupNodeId(move.parentId),
          }
        : candidate)
    }
    if (positionChanges.length > 0) {
      applyNodeChanges(positionChanges as any)
    }
    setNodes(nodes.value)

    // BUG-1787: Retry tasks whose Vue Flow node wasn't ready yet. One nextTick
    // gives the prior setNodes + sync watcher a chance to materialize them.
    if (missing.length > 0) {
      nextTick(() => {
        const stillMissing = missing.filter(m => !findNode(CanvasIds.taskNodeId(m.taskId)))
        if (stillMissing.length > 0) {
          console.warn(
            `[BUG-1787] ${stillMissing.length}/${missing.length} task nodes still not found after nextTick retry — these may render outside their group:`,
            stillMissing.map(m => m.taskId.slice(0, 8))
          )
        }
        const found = missing.filter(m => findNode(CanvasIds.taskNodeId(m.taskId)))
        if (found.length > 0) {
          applyCanonicalTaskMoves(found, groupMoves)
        }
      })
    }
  }

  function refreshRenderedNodesFromModel() {
    const refreshedNodes = nodes.value.map((node) => ({ ...node }))
    setNodes([])
    nextTick(() => {
      nodes.value = refreshedNodes
      setNodes(refreshedNodes)
    })
  }

  // ===========================================================================
  // DOM-aware measurement helpers
  // ===========================================================================

  function getVisualNodePosition(nodeId: string): { x: number; y: number } | undefined {
    const node = findNode(nodeId) as any
    if (!node?.position) return undefined

    const computedPosition = node.computedPosition
    if (Number.isFinite(computedPosition?.x) && Number.isFinite(computedPosition?.y)) {
      return { x: computedPosition.x, y: computedPosition.y }
    }

    if (node.parentNode) {
      const parentNode = findNode(node.parentNode) as any
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
        width: Math.max(rect.width / zoom, element!.scrollWidth, element!.offsetWidth),
        height: Math.max(rect.height / zoom, element!.scrollHeight, element!.offsetHeight),
      }
      return measured
    }

    const node = findNode(nodeId) as any
    const width = node?.dimensions?.width ?? node?.measured?.width ?? node?.width
    const height = node?.dimensions?.height ?? node?.measured?.height ?? node?.height
    return Number.isFinite(width) && Number.isFinite(height) ? { width, height } : undefined
  }

  function getRenderedCanvasZoom() {
    const viewportElement = document.querySelector('.vue-flow__viewport') as HTMLElement | null
    const transform = viewportElement ? getComputedStyle(viewportElement).transform : ''
    const matrixScale = transform.match(/matrix\(([^)]+)\)/)?.[1]?.split(',')?.[0]
    const renderedZoom = matrixScale ? Number(matrixScale.trim()) : NaN
    if (Number.isFinite(renderedZoom) && renderedZoom > 0) return renderedZoom
    return getViewport().zoom || 1
  }

  // ===========================================================================
  // Composable initializations (require the helpers above to exist)
  // ===========================================================================

  const dayRotation = useDayGroupRotation({
    onMoves: applyCanonicalLayoutMoves,
    getNodePosition: (nodeId: string) => getVisualNodePosition(nodeId),
    getNodeSize: (nodeId: string) => getRenderedNodeSize(nodeId),
  })

  const tidyLayout = useTidyLayout({
    getNodePosition: (nodeId: string) => getVisualNodePosition(nodeId),
    getNodeSize: (nodeId: string) => getRenderedNodeSize(nodeId),
  })

  // ===========================================================================
  // Lock/release pattern
  // ===========================================================================

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

  // ===========================================================================
  // Public handlers
  // ===========================================================================

  function handleRotateDayGroups() {
    // TASK-1756 v3: toolbar still bypasses lastRotationDate guard via { force: true }
    // on rotateDayGroups (dueDate/marker path). Physical rotation always produces
    // moves — the canonical primitive owns all geometry math now.
    //
    // BUG-1787: Pre-acquire the sync lock BEFORE rotateDayGroups so the
    // SMART-GROUP dueDate writes inside it cannot trigger syncStoreToCanvas
    // while we're mid-rotation. Without this, the dueDate writes fire the
    // sync watcher, which rebuilds Vue Flow nodes with stale positions; then
    // rotateDayGroupPositions measures against that stale snapshot and the
    // subsequent applyCanonicalTaskMoves skips findNode misses → tasks
    // render outside their groups even though parent_id is correct in store.
    // rotateDayGroupPositions re-asserts the lock (idempotent), and its
    // release closure is called once via releaseOnDoubleNextTick below.
    canvasSyncInProgress.value = true
    dayRotation.rotateDayGroups({ force: true })
    const { groupMoves, taskMoves, pendingWrites, release } = dayRotation.rotateDayGroupPositions()
    applyCanonicalLayoutMoves(groupMoves)
    applyCanonicalTaskMoves(taskMoves, groupMoves)
    releaseOnDoubleNextTick(release, () => {
      deps.syncNodes(undefined, { force: true })
      refreshRenderedNodesFromModel()
    }, pendingWrites)
  }

  function handleTidyLayout() {
    // TASK-1756 v8: lay out all smart + day-of-week groups in a clean single row
    // (user's left-to-right order preserved) and restack tasks inside them.
    const { groupMoves, taskMoves, pendingWrites, release } = tidyLayout.tidyDayGroups()
    applyCanonicalLayoutMoves(groupMoves)
    applyCanonicalTaskMoves(taskMoves, groupMoves)
    releaseOnDoubleNextTick(release, () => {
      deps.syncNodes(undefined, { force: true })
      refreshRenderedNodesFromModel()
    }, pendingWrites)
  }

  function runDayGroupCatchup() {
    // BUG-1780: do NOT apply canonical group-moves here. Historically the catchup
    // applied groupMoves on every Vue Flow ready (app launch / reload / update)
    // which silently overwrote the user's manually-arranged group positions and
    // sizes with canonical values. That's the "rearrange reverts on restart"
    // regression. Metadata-only work (task re-homing on dueDate rotation) is
    // preserved. The explicit Tidy button (handleTidyLayout) still applies full
    // canonical layout on user request.
    const { taskMoves, release } = dayRotation.runCatchupIfNeeded()
    if (taskMoves.length > 0) applyCanonicalTaskMoves(taskMoves, [])
    releaseOnDoubleNextTick(release)
  }

  // Silence unused-var lint for the deps.currentDay (kept in the interface
  // because future catchup variants may want it; CanvasView wires the watch).
  void deps.currentDay

  return {
    // Public — consumed by CanvasView.vue
    handleRotateDayGroups,
    handleTidyLayout,
    runDayGroupCatchup,
    dayRotation,
    tidyLayout,
    // Test-only — exported so unit tests can drive them directly.
    applyCanonicalTaskMoves,
    applyCanonicalLayoutMoves,
    refreshRenderedNodesFromModel,
    releaseOnDoubleNextTick,
    getVisualNodePosition,
    getRenderedNodeSize,
  }
}
