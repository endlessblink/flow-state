<template>
  <Teleport to="body">
    <Transition name="mini-canvas">
      <div v-if="isOpen" class="mini-canvas-overlay" dir="rtl">
        <MiniCanvasToolbar
          :task-title="task?.title || 'Task'"
          :hide-completed="hideCompleted"
          @close="handleClose"
          @add-subtask="handleAddSubtask"
          @add-note="handleAddNote"
          @toggle-completed="hideCompleted = !hideCompleted"
          @fit-view="handleFitView"
          @edit-task="handleEditTask"
        />

        <div class="mini-canvas-body">
          <VueFlow
            id="mini-canvas"
            :nodes="filteredNodes"
            :edges="miniCanvas.edges.value"
            :default-viewport="{ x: 0, y: 0, zoom: 1 }"
            :min-zoom="0.3"
            :max-zoom="2"
            :snap-to-grid="true"
            :snap-grid="[20, 20]"
            :nodes-draggable="true"
            :nodes-connectable="true"
            :pan-on-drag="true"
            :zoom-on-scroll="true"
            fit-view-on-init
            :fit-view-params="{ padding: 0.4, maxZoom: 1 }"
            :connection-line-style="{ stroke: '#4ECDC4', strokeWidth: 1.5 }"
            dir="rtl"
            @node-drag-stop="miniCanvas.onNodeDragStop"
            @pane-click="handlePaneClick"
            @pane-context-menu="handlePaneContextMenu"
            @node-click="handleNodeClick"
            @node-context-menu="handleNodeContextMenu"
            @connect="handleConnect"
            @connect-start="handleConnectStart"
            @connect-end="handleConnectEnd"
          >
            <template #node-parentTaskNode="nodeProps">
              <ParentTaskNode :data="nodeProps.data" />
            </template>

            <template #node-subtaskNode="nodeProps">
              <SubtaskNode
                :data="nodeProps.data"
                :auto-focus="nodeProps.data.subtaskId === pendingFocusSubtaskId"
                @toggle-complete="miniCanvas.toggleSubtaskCompletion"
                @update-title="miniCanvas.updateSubtaskTitle"
                @update-description="miniCanvas.updateSubtaskDescription"
                @auto-focused="pendingFocusSubtaskId = null"
              />
            </template>

            <template #node-noteNode="nodeProps">
              <NoteNode
                :data="nodeProps.data"
                @update-title="miniCanvas.updateNoteTitle"
                @update-description="miniCanvas.updateNoteDescription"
              />
            </template>

            <Background :variant="BackgroundVariant.Dots" :gap="24" :size="1.5" />
          </VueFlow>

          <MiniCanvasEmptyState
            v-if="isEmpty"
            @add-subtask="handleAddSubtask"
            @add-note="handleAddNote"
          />
        </div>

        <!-- Context Menu (teleported to body to escape transforms) -->
        <Teleport to="body">
          <div
            v-if="showContextMenu"
            ref="contextMenuRef"
            class="mini-canvas-context-menu"
            :style="contextMenuStyle"
          >
            <button class="ctx-item" @click="handleContextAddSubtask">
              <CheckSquare :size="16" />
              <span>Add Subtask Here</span>
            </button>
            <button class="ctx-item" @click="handleContextAddNote">
              <StickyNote :size="16" />
              <span>Add Note Here</span>
            </button>
            <template v-if="contextNodeId">
              <div class="ctx-divider" />
              <button class="ctx-item danger" @click="handleContextDelete">
                <Trash2 :size="16" />
                <span>Delete</span>
              </button>
            </template>
          </div>
        </Teleport>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import type { NodeMouseEvent } from '@vue-flow/core'
import { Background, BackgroundVariant } from '@vue-flow/background'
import { useMiniCanvas } from '@/composables/mini-canvas/useMiniCanvas'
import { useCanvasModalsStore } from '@/stores/canvas/modals'
import { useAuthStore } from '@/stores/auth'
import { getClipboardImage, compressImage, uploadCanvasImage } from '@/services/canvasImageUpload'
import MiniCanvasToolbar from './MiniCanvasToolbar.vue'
import MiniCanvasEmptyState from './MiniCanvasEmptyState.vue'
import ParentTaskNode from './ParentTaskNode.vue'
import SubtaskNode from './SubtaskNode.vue'
import NoteNode from './NoteNode.vue'
import { CheckSquare, StickyNote, Trash2 } from 'lucide-vue-next'

const modalsStore = useCanvasModalsStore()

const isOpen = computed(() => modalsStore.isMiniCanvasOpen)
const taskId = computed(() => modalsStore.miniCanvasTaskId)

const miniCanvas = useMiniCanvas(() => taskId.value)
const task = miniCanvas.task
const hideCompleted = ref(false)

const filteredNodes = computed(() => {
  if (!hideCompleted.value) return miniCanvas.nodes.value
  return miniCanvas.nodes.value.filter(n =>
    n.type !== 'subtaskNode' || !n.data?.isCompleted
  )
})

// Empty = no subtasks and no notes (parent always exists)
const isEmpty = computed(() => {
  const t = task.value
  if (!t) return true
  return (t.subtasks || []).length === 0 && (t.planningNotes || []).length === 0
})

// ── Context menu state ──
const showContextMenu = ref(false)
const contextMenuRef = ref<HTMLElement | null>(null)
const contextMenuPos = ref({ x: 0, y: 0 })
const contextNodeId = ref<string | null>(null)
const contextNodeType = ref<string | null>(null)
const contextFlowPos = ref({ x: 0, y: 0 })
const selectedNodeId = ref<string | null>(null)
const selectedNodeType = ref<string | null>(null)
const pendingConnectionSource = ref<string | null>(null)
const pendingConnectionSourceHandle = ref<string | null>(null)
const pendingFocusSubtaskId = ref<string | null>(null)
const connectionWasSuccessful = ref(false)

const contextMenuStyle = computed(() => ({
  position: 'fixed' as const,
  left: `${contextMenuPos.value.x}px`,
  top: `${contextMenuPos.value.y}px`,
  zIndex: '99999',
}))

const handleClose = () => {
  miniCanvas.resetEdges()
  modalsStore.closeMiniCanvas()
}

const handleFitView = () => {
  try {
    const { fitView } = useVueFlow({ id: 'mini-canvas' })
    fitView({ padding: 0.4, maxZoom: 1 })
  } catch { /* ignore */ }
}

const handleEditTask = () => {
  const t = task.value
  if (t) {
    // Close mini-canvas and open edit modal
    handleClose()
    // Dispatch global event to open edit modal (same pattern as CanvasView)
    window.dispatchEvent(new CustomEvent('open-task-edit', { detail: { taskId: t.id } }))
  }
}

// ── Add actions ──

const getFlowCenter = () => {
  try {
    const { project } = useVueFlow({ id: 'mini-canvas' })
    const el = document.querySelector('.mini-canvas-body .vue-flow') as HTMLElement
    if (el) {
      const rect = el.getBoundingClientRect()
      const pos = project({ x: rect.width / 2, y: rect.height / 2 })
      return { x: pos.x + (Math.random() - 0.5) * 100, y: pos.y + (Math.random() - 0.5) * 100 }
    }
  } catch { /* fallback */ }
  return { x: 200 + Math.random() * 200, y: 200 + Math.random() * 200 }
}

const getFlowPositionFromEvent = (event: MouseEvent | TouchEvent) => {
  const point = 'changedTouches' in event ? event.changedTouches[0] : event
  if (!point) return null

  try {
    const { project } = useVueFlow({ id: 'mini-canvas' })
    const el = document.querySelector('.mini-canvas-body .vue-flow') as HTMLElement
    if (el) {
      const rect = el.getBoundingClientRect()
      return project({ x: point.clientX - rect.left, y: point.clientY - rect.top })
    }
  } catch { /* fallback below */ }

  return { x: point.clientX, y: point.clientY }
}

const handleAddSubtask = () => {
  miniCanvas.addSubtask(getFlowCenter())
}

const handleAddNote = () => {
  miniCanvas.addNote(getFlowCenter(), 'New note')
}

// ── Pane/node events ──

const handlePaneClick = () => {
  showContextMenu.value = false
  selectedNodeId.value = null
  selectedNodeType.value = null
}

const handleNodeClick = (event: NodeMouseEvent) => {
  selectedNodeId.value = event.node.id
  selectedNodeType.value = event.node.type || null
}

const handleConnectStart = (event: { nodeId?: string | null; handleId?: string | null }) => {
  pendingConnectionSource.value = event.nodeId || null
  pendingConnectionSourceHandle.value = event.handleId || null
  connectionWasSuccessful.value = false
}

const handleConnectEnd = (event: MouseEvent | TouchEvent) => {
  const sourceId = pendingConnectionSource.value

  setTimeout(() => {
    if (sourceId && !connectionWasSuccessful.value) {
      const position = getFlowPositionFromEvent(event)
      if (position) {
        pendingFocusSubtaskId.value = miniCanvas.createConnectedSubtask(sourceId, position, pendingConnectionSourceHandle.value) || null
      }
    }

    pendingConnectionSource.value = null
    pendingConnectionSourceHandle.value = null
    connectionWasSuccessful.value = false
  }, 50)
}

const handleConnect = (params: { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }) => {
  connectionWasSuccessful.value = true
  miniCanvas.onConnect(params)
}

const handlePaneContextMenu = (event: MouseEvent) => {
  event.preventDefault()
  contextMenuPos.value = { x: event.clientX, y: event.clientY }
  contextNodeId.value = null
  contextNodeType.value = null

  // Convert to flow coordinates for placing nodes
  try {
    const { project } = useVueFlow({ id: 'mini-canvas' })
    const el = document.querySelector('.mini-canvas-body .vue-flow') as HTMLElement
    if (el) {
      const rect = el.getBoundingClientRect()
      contextFlowPos.value = project({ x: event.clientX - rect.left, y: event.clientY - rect.top })
    }
  } catch {
    contextFlowPos.value = { x: event.clientX, y: event.clientY }
  }

  showContextMenu.value = true
}

const handleNodeContextMenu = (event: NodeMouseEvent) => {
  const mouseEvent = event.event as MouseEvent
  mouseEvent.preventDefault()
  mouseEvent.stopPropagation()

  // Don't allow deleting parent node
  if (event.node.type === 'parentTaskNode') {
    // Show pane context menu instead
    handlePaneContextMenu(mouseEvent)
    return
  }

  contextMenuPos.value = { x: mouseEvent.clientX, y: mouseEvent.clientY }
  contextNodeId.value = event.node.id
  contextNodeType.value = event.node.type || null
  selectedNodeId.value = event.node.id
  selectedNodeType.value = event.node.type || null

  try {
    const { project } = useVueFlow({ id: 'mini-canvas' })
    const el = document.querySelector('.mini-canvas-body .vue-flow') as HTMLElement
    if (el) {
      const rect = el.getBoundingClientRect()
      contextFlowPos.value = project({ x: mouseEvent.clientX - rect.left, y: mouseEvent.clientY - rect.top })
    }
  } catch {
    contextFlowPos.value = { x: mouseEvent.clientX, y: mouseEvent.clientY }
  }

  showContextMenu.value = true
}

// ── Context menu actions ──

const handleContextAddSubtask = () => {
  miniCanvas.addSubtask(contextFlowPos.value)
  showContextMenu.value = false
}

const handleContextAddNote = () => {
  miniCanvas.addNote(contextFlowPos.value, 'New note')
  showContextMenu.value = false
}

const handleContextDelete = () => {
  if (!contextNodeId.value || !contextNodeType.value) return
  miniCanvas.removeEdgesForNode(contextNodeId.value)
  if (contextNodeType.value === 'subtaskNode') {
    miniCanvas.deleteSubtask(contextNodeId.value)
  } else if (contextNodeType.value === 'noteNode') {
    miniCanvas.deleteNote(contextNodeId.value)
  }
  if (selectedNodeId.value === contextNodeId.value) {
    selectedNodeId.value = null
    selectedNodeType.value = null
  }
  showContextMenu.value = false
}

const deleteSelectedNode = () => {
  if (!selectedNodeId.value) return false

  const nodeType = selectedNodeType.value || miniCanvas.nodes.value.find(n => n.id === selectedNodeId.value)?.type
  miniCanvas.removeEdgesForNode(selectedNodeId.value)
  if (nodeType === 'subtaskNode') {
    miniCanvas.deleteSubtask(selectedNodeId.value)
  } else if (nodeType === 'noteNode') {
    miniCanvas.deleteNote(selectedNodeId.value)
  } else {
    return false
  }

  selectedNodeId.value = null
  selectedNodeType.value = null
  showContextMenu.value = false
  return true
}

// ── Keyboard + global click handlers ──

const handleKeydown = (e: KeyboardEvent) => {
  const target = e.target as HTMLElement | null
  const isEditingText = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable

  if ((e.key === 'Delete' || e.key === 'Backspace') && isOpen.value && !isEditingText) {
    if (deleteSelectedNode()) {
      e.preventDefault()
    }
    return
  }

  if (e.key === 'Escape' && isOpen.value) {
    if (showContextMenu.value) {
      showContextMenu.value = false
    } else {
      handleClose()
    }
  }
}

const handleGlobalClick = (e: MouseEvent) => {
  if (showContextMenu.value && contextMenuRef.value && !contextMenuRef.value.contains(e.target as Node)) {
    showContextMenu.value = false
  }
}

const handlePaste = async (e: ClipboardEvent) => {
  if (!isOpen.value) return

  const imageFile = getClipboardImage(e)
  if (!imageFile) return  // Not an image paste, let it through

  e.preventDefault()

  try {
    const authStore = useAuthStore()
    const userId = authStore.user?.id
    if (!userId) return

    const compressed = await compressImage(imageFile)
    const imageUrl = await uploadCanvasImage(compressed, userId)

    miniCanvas.addNote(getFlowCenter(), '', '', imageUrl)
  } catch (err) {
    console.error('[MiniCanvas] Failed to paste image:', err)
  }
}

watch(isOpen, (open) => {
  if (open) {
    nextTick(() => {
      document.addEventListener('keydown', handleKeydown)
      document.addEventListener('click', handleGlobalClick, true)
      document.addEventListener('paste', handlePaste)
    })
  } else {
    document.removeEventListener('keydown', handleKeydown)
    document.removeEventListener('click', handleGlobalClick, true)
    document.removeEventListener('paste', handlePaste)
    showContextMenu.value = false
    hideCompleted.value = false
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('click', handleGlobalClick, true)
  document.removeEventListener('paste', handlePaste)
})
</script>

<style scoped>
.mini-canvas-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: #0e0e12;
  display: flex;
  flex-direction: column;
}

.mini-canvas-body {
  flex: 1;
  position: relative;
  margin-top: 52px;
}

.mini-canvas-body :deep(.vue-flow) {
  width: 100%;
  height: 100%;
  background: transparent;
}

.mini-canvas-body :deep(.vue-flow__background) {
  opacity: 0.3;
}

/* Connection line handles */
.mini-canvas-body :deep(.vue-flow__handle) {
  width: 8px;
  height: 8px;
  background: var(--glass-border-strong, #555);
  border: 1.5px solid var(--brand-primary, #4ECDC4);
  opacity: 0;
  transition: opacity 150ms ease;
}

.mini-canvas-body :deep(.vue-flow__node:hover .vue-flow__handle) {
  opacity: 1;
}

/* Edge styling */
.mini-canvas-body :deep(.vue-flow__edge-path) {
  stroke-linecap: round;
}

/* Transition */
.mini-canvas-enter-active {
  transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1);
}
.mini-canvas-leave-active {
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
}
.mini-canvas-enter-from {
  opacity: 0;
  transform: scale(0.95);
}
.mini-canvas-leave-to {
  opacity: 0;
  transform: scale(0.97);
}
</style>

<!-- Global styles for context menu (teleported outside scoped) -->
<style>
.mini-canvas-context-menu {
  background: rgba(22, 22, 30, 0.95);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  padding: 6px;
  min-width: 180px;
  animation: miniCtxIn 100ms ease-out;
}

@keyframes miniCtxIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}

.mini-canvas-context-menu .ctx-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: #e0e0e8;
  font-size: 13px;
  cursor: pointer;
  transition: background 100ms ease;
}

.mini-canvas-context-menu .ctx-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.mini-canvas-context-menu .ctx-item.danger {
  color: #ef4444;
}

.mini-canvas-context-menu .ctx-item.danger:hover {
  background: rgba(239, 68, 68, 0.12);
}

.mini-canvas-context-menu .ctx-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 4px 0;
}
</style>
