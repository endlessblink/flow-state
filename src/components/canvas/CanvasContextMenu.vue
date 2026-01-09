<template>
  <div
    v-if="isVisible"
    ref="menuRef"
    class="context-menu"
    :style="menuPosition"
  >
    <!-- Group-specific options (when contextSection is provided) -->
    <template v-if="contextSection">
      <div class="menu-section-header">
        <Group :size="14" :stroke-width="1.5" />
        <span>{{ contextSection.name || 'Group' }}</span>
      </div>

      <!-- TASK-068: Add Task to Group -->
      <button
        class="menu-item"
        @click="handleCreateTaskInGroup"
      >
        <PlusCircle :size="16" :stroke-width="1.5" class="menu-icon" />
        <span class="menu-text">Add Task to Group</span>
      </button>

      <button
        class="menu-item"
        @click="$emit('editGroup', contextSection)"
      >
        <Edit2 :size="16" :stroke-width="1.5" class="menu-icon" />
        <span class="menu-text">Edit Group</span>
      </button>

      <!-- TASK-068: Group Settings (moved from header) -->
      <button
        class="menu-item"
        @click="handleOpenSettings"
      >
        <Settings :size="16" :stroke-width="1.5" class="menu-icon" />
        <span class="menu-text">Group Settings</span>
      </button>

      <div class="menu-divider" />

      <!-- TASK-068: Power Mode Toggle (moved from header) -->
      <button
        v-if="contextSection.powerKeyword"
        class="menu-item"
        :class="{ 'active': contextSection.isPowerMode }"
        @click="handleTogglePowerMode"
      >
        <Zap :size="16" :stroke-width="1.5" class="menu-icon" />
        <span class="menu-text">{{ contextSection.isPowerMode ? 'Disable Power Mode' : 'Enable Power Mode' }}</span>
      </button>

      <!-- TASK-068: Collect Tasks (moved from header, only in power mode) -->
      <button
        v-if="contextSection.isPowerMode"
        class="menu-item"
        @click="handleCollectTasks"
      >
        <Magnet :size="16" :stroke-width="1.5" class="menu-icon" />
        <span class="menu-text">Collect Matching Tasks</span>
      </button>

      <div class="menu-divider" />

      <button
        class="menu-item danger"
        @click="$emit('deleteGroup', contextSection)"
      >
        <Trash2 :size="16" :stroke-width="1.5" class="menu-icon" />
        <span class="menu-text">Delete Group</span>
      </button>

      <div class="menu-divider" />
    </template>

    <!-- Create Task Here -->
    <button
      class="menu-item"
      @click="$emit('createTaskHere')"
    >
      <PlusCircle :size="16" :stroke-width="1.5" class="menu-icon" />
      <span class="menu-text">Create Task Here</span>
    </button>

    <!-- Create Group (unified modal) -->
    <button
      v-if="!contextSection"
      class="menu-item"
      @click="handleCreateGroup"
    >
      <Group :size="16" :stroke-width="1.5" class="menu-icon" />
      <span class="menu-text">Create Group</span>
    </button>

    <!-- Task-specific options (when tasks are selected) -->
    <template v-if="hasSelectedTasks && selectedCount >= 1 && !contextSection">
      <div class="menu-divider" />

      <!-- Move to Inbox -->
      <button
        class="menu-item"
        @click="handleMoveToInbox"
      >
        <Inbox :size="16" :stroke-width="1.5" class="menu-icon" />
        <span class="menu-text">Move to Inbox</span>
        <span class="menu-shortcut">Del</span>
      </button>

      <!-- Delete Task(s) -->
      <button
        class="menu-item danger"
        @click="handleDeleteTasks"
      >
        <Trash2 :size="16" :stroke-width="1.5" class="menu-icon" />
        <span class="menu-text">Delete {{ selectedCount > 1 ? `${selectedCount} Tasks` : 'Task' }}</span>
        <span class="menu-shortcut">Shift+Del</span>
      </button>
    </template>

    <!-- Layout Submenu (2+ tasks) -->
    <template v-if="selectedCount >= 2">
      <div class="menu-divider" />
      <div
        ref="submenuItemRef"
        class="menu-item submenu-item"
        @mouseenter="handleLayoutSubmenuEnter"
        @mouseleave="handleLayoutSubmenuLeave"
      >
        <LayoutGrid :size="16" :stroke-width="1.5" class="menu-icon" />
        <span class="menu-text">Layout</span>
        <ChevronRight :size="16" :stroke-width="1.5" class="submenu-arrow" />
      </div>
    </template>

    <!-- Teleported Layout Submenu (escapes overflow clipping) -->
    <Teleport to="body">
      <div
        v-if="showLayoutSubmenu && selectedCount >= 2"
        ref="submenuRef"
        class="submenu submenu-teleported"
        :style="submenuStyle"
        @mouseenter="handleLayoutSubmenuEnter"
        @mouseleave="handleLayoutSubmenuLeave"
      >
        <!-- Align Options -->
        <button class="menu-item" @click="handleAlignLeft">
          <AlignHorizontalJustifyStart :size="16" :stroke-width="1.5" class="menu-icon" />
          <span class="menu-text">Align Left</span>
        </button>
        <button class="menu-item" @click="handleAlignRight">
          <AlignHorizontalJustifyEnd :size="16" :stroke-width="1.5" class="menu-icon" />
          <span class="menu-text">Align Right</span>
        </button>
        <button class="menu-item" @click="handleAlignTop">
          <AlignVerticalJustifyStart :size="16" :stroke-width="1.5" class="menu-icon" />
          <span class="menu-text">Align Top</span>
        </button>
        <button class="menu-item" @click="handleAlignBottom">
          <AlignVerticalJustifyEnd :size="16" :stroke-width="1.5" class="menu-icon" />
          <span class="menu-text">Align Bottom</span>
        </button>
        <button class="menu-item" @click="handleAlignCenterHorizontal">
          <AlignHorizontalJustifyCenter :size="16" :stroke-width="1.5" class="menu-icon" />
          <span class="menu-text">Center Horizontally</span>
        </button>
        <button class="menu-item" @click="handleAlignCenterVertical">
          <AlignVerticalJustifyCenter :size="16" :stroke-width="1.5" class="menu-icon" />
          <span class="menu-text">Center Vertically</span>
        </button>

        <!-- Distribute Options (3+ tasks) -->
        <template v-if="selectedCount >= 3">
          <div class="menu-divider" />
          <button class="menu-item" @click="handleDistributeHorizontal">
            <ArrowLeftRight :size="16" :stroke-width="1.5" class="menu-icon" />
            <span class="menu-text">Distribute Horizontally</span>
          </button>
          <button class="menu-item" @click="handleDistributeVertical">
            <ArrowUpDown :size="16" :stroke-width="1.5" class="menu-icon" />
            <span class="menu-text">Distribute Vertically</span>
          </button>
        </template>

        <!-- Arrange Options -->
        <div class="menu-divider" />
        <button class="menu-item" @click="handleArrangeInRow">
          <Rows :size="16" :stroke-width="1.5" class="menu-icon" />
          <span class="menu-text">Arrange in a row</span>
        </button>
        <button class="menu-item" @click="handleArrangeInColumn">
          <LayoutList :size="16" :stroke-width="1.5" class="menu-icon" />
          <span class="menu-text">Arrange in a column</span>
        </button>
        <button class="menu-item" @click="handleArrangeInGrid">
          <Grid3x3 :size="16" :stroke-width="1.5" class="menu-icon" />
          <span class="menu-text">Arrange in a grid</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import {
  PlusCircle, Group, AlignLeft as _AlignLeft, AlignHorizontalJustifyStart, AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyCenter, AlignVerticalJustifyStart,
  AlignVerticalJustifyEnd, AlignVerticalJustifyCenter,
  Columns as _Columns, ArrowLeftRight, ArrowUpDown, Edit2, Trash2, Inbox,
  LayoutGrid, ChevronRight, Rows, LayoutList, Grid3x3,
  Settings, Zap, Magnet // TASK-068: Icons for group actions moved from header
} from 'lucide-vue-next'
import { useContextMenu } from '@/composables/useContextMenu'
import type { CanvasSection } from '@/stores/canvas'

interface Props {
  isVisible: boolean
  x: number
  y: number
  hasSelectedTasks?: boolean
  selectedCount?: number
  contextSection?: CanvasSection // CanvasSection for group context
}

const props = withDefaults(defineProps<Props>(), {
  hasSelectedTasks: false,
  selectedCount: 0,
  contextSection: undefined
})

const emit = defineEmits<{
  close: []
  createTaskHere: []
  createGroup: []
  editGroup: [section: CanvasSection]
  deleteGroup: [section: CanvasSection]
  moveToInbox: []
  deleteTasks: []
  alignLeft: []
  alignRight: []
  alignTop: []
  alignBottom: []
  alignCenterHorizontal: []
  alignCenterVertical: []
  distributeHorizontal: []
  distributeVertical: []
  arrangeInRow: []
  arrangeInColumn: []
  arrangeInGrid: []
  // TASK-068: New group actions moved from header
  createTaskInGroup: [section: CanvasSection]
  openGroupSettings: [section: CanvasSection]
  togglePowerMode: [section: CanvasSection]
  collectTasks: [section: CanvasSection]
}>()

const menuRef = ref<HTMLElement | null>(null)
const submenuRef = ref<HTMLElement | null>(null)
const submenuItemRef = ref<HTMLElement | null>(null)
const showLayoutSubmenu = ref(false)
const submenuTimeout = ref<number | null>(null)
const submenuPosition = ref({ flipHorizontal: false, adjustVertical: 0 })

// Computed style for teleported submenu - uses fixed positioning
const submenuStyle = computed((): Record<string, string> => {
  if (!submenuItemRef.value) {
    return { display: 'none' }
  }

  const rect = submenuItemRef.value.getBoundingClientRect()
  const viewport = { width: window.innerWidth, height: window.innerHeight }

  // Default: appear to the right of the menu item
  let left = rect.right + 4 // 4px gap
  let top = rect.top

  // Check if submenu would overflow right edge - flip to left side
  const submenuWidth = 200 // Approximate submenu width
  if (left + submenuWidth > viewport.width) {
    left = rect.left - submenuWidth - 4
  }

  // Check if submenu would overflow bottom - adjust upward
  const submenuHeight = 400 // Approximate max height
  if (top + submenuHeight > viewport.height) {
    top = Math.max(8, viewport.height - submenuHeight - 8)
  }

  return {
    position: 'fixed',
    left: `${left}px`,
    top: `${top}px`,
    zIndex: '9999'
  }
})

// Use unified context menu composable (consolidated events + positioning)
const { menuPosition, updatePosition } = useContextMenu({
  x: () => props.x,
  y: () => props.y,
  isVisible: () => props.isVisible,
  menuRef,
  closeCallback: () => emit('close'),
  offset: { x: 0, y: 0 },
  viewportPadding: 16,
  preventCloseOnMenuClick: true
})

// Watch for visibility changes to update positioning
watch(() => props.isVisible, async (isVisible) => {
  if (isVisible) {
    await nextTick()
    updatePosition()
  }
})

// Viewport edge detection for submenu
watch([showLayoutSubmenu, submenuRef], () => {
  if (!showLayoutSubmenu.value || !submenuRef.value || !menuRef.value) return

  nextTick(() => {
    if (!submenuRef.value || !menuRef.value) return

    const submenuRect = submenuRef.value.getBoundingClientRect()
    const viewport = { width: window.innerWidth, height: window.innerHeight }

    // Check right edge overflow - flip to left side if needed
    const flipHorizontal = submenuRect.right > viewport.width

    // Check bottom edge overflow - adjust upward if needed
    let adjustVertical = 0
    if (submenuRect.bottom > viewport.height) {
      adjustVertical = viewport.height - submenuRect.bottom - 8 // 8px padding from edge
    }

    submenuPosition.value = { flipHorizontal, adjustVertical }
  })
})

// Handle create group click (opens unified modal)
const handleCreateGroup = () => {
  console.log('🔧 CanvasContextMenu: Create Group button clicked!')
  console.log('🔧 CanvasContextMenu: Emitting createGroup event (opens unified modal)')
  emit('createGroup')
  emit('close')
}

// TASK-068: Handler for creating task in group
const handleCreateTaskInGroup = () => {
  if (props.contextSection) {
    console.log('➕ CanvasContextMenu: Create Task in Group:', props.contextSection.name)
    emit('createTaskInGroup', props.contextSection)
    emit('close')
  }
}

// TASK-068: Handler for opening group settings
const handleOpenSettings = () => {
  if (props.contextSection) {
    console.log('⚙️ CanvasContextMenu: Open Settings for:', props.contextSection.name)
    emit('openGroupSettings', props.contextSection)
    emit('close')
  }
}

// TASK-068: Handler for toggling power mode
const handleTogglePowerMode = () => {
  if (props.contextSection) {
    console.log('⚡ CanvasContextMenu: Toggle Power Mode for:', props.contextSection.name)
    emit('togglePowerMode', props.contextSection)
    emit('close')
  }
}

// TASK-068: Handler for collecting tasks
const handleCollectTasks = () => {
  if (props.contextSection) {
    console.log('🧲 CanvasContextMenu: Collect Tasks for:', props.contextSection.name)
    emit('collectTasks', props.contextSection)
    emit('close')
  }
}

// Handle move to inbox
const handleMoveToInbox = () => {
  console.log('📥 CanvasContextMenu: Move to Inbox clicked')
  emit('moveToInbox')
  emit('close')
}

// Handle delete tasks
const handleDeleteTasks = () => {
  console.log('🗑️ CanvasContextMenu: Delete Tasks clicked')
  emit('deleteTasks')
  emit('close')
}

// Layout submenu handlers
const handleLayoutSubmenuEnter = () => {
  if (submenuTimeout.value) {
    clearTimeout(submenuTimeout.value)
    submenuTimeout.value = null
  }
  showLayoutSubmenu.value = true
}

const handleLayoutSubmenuLeave = () => {
  submenuTimeout.value = window.setTimeout(() => {
    showLayoutSubmenu.value = false
  }, 200)
}

// Layout action handlers (close menu after action)
const handleAlignLeft = () => {
  emit('alignLeft')
  emit('close')
}

const handleAlignRight = () => {
  emit('alignRight')
  emit('close')
}

const handleAlignTop = () => {
  emit('alignTop')
  emit('close')
}

const handleAlignBottom = () => {
  emit('alignBottom')
  emit('close')
}

const handleAlignCenterHorizontal = () => {
  emit('alignCenterHorizontal')
  emit('close')
}

const handleAlignCenterVertical = () => {
  emit('alignCenterVertical')
  emit('close')
}

const handleDistributeHorizontal = () => {
  emit('distributeHorizontal')
  emit('close')
}

const handleDistributeVertical = () => {
  emit('distributeVertical')
  emit('close')
}

const handleArrangeInRow = () => {
  emit('arrangeInRow')
  emit('close')
}

const handleArrangeInColumn = () => {
  emit('arrangeInColumn')
  emit('close')
}

const handleArrangeInGrid = () => {
  emit('arrangeInGrid')
  emit('close')
}

// Cleanup handled by useContextMenu composable
</script>

<style scoped>
.context-menu {
  position: fixed;
  /* Glass morphism - transparent with purple tint and blur */
  background: rgba(20, 20, 40, 0.85);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  /* Stroke border - more visible */
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-xl);
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.5),
    0 8px 24px rgba(0, 0, 0, 0.3);
  padding: var(--space-2);
  min-width: 200px;
  max-width: 320px;
  max-height: 80vh;
  overflow-y: auto;
  z-index: var(--z-popover);
  animation: menuSlideIn 150ms cubic-bezier(0.16, 1, 0.3, 1);
  /* Ensure backdrop-filter works */
  isolation: isolate;
  transform: translateZ(0);
}

@keyframes menuSlideIn {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.menu-item {
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-primary);
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  font-weight: var(--font-normal);
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  transition: background-color 0.15s ease;
}

.menu-item:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-hover);
}

.menu-item.danger {
  color: var(--danger-text);
}

.menu-item.danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

/* TASK-068: Active state for toggleable menu items like power mode */
.menu-item.active {
  color: var(--amber-text, #f59e0b);
  background: var(--amber-bg-medium, rgba(245, 158, 11, 0.15));
}

.menu-item.active:hover {
  background: var(--amber-bg-medium, rgba(245, 158, 11, 0.25));
}

.menu-item:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.menu-icon {
  flex-shrink: 0;
}

.menu-text {
  flex: 1;
  font-weight: var(--font-normal);
}

.menu-shortcut {
  font-size: var(--text-xs);
  color: var(--text-muted);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  margin-left: auto;
}

.menu-divider {
  height: 1px;
  background: var(--glass-border);
  margin: var(--space-2) 0;
}

.menu-section-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: var(--space-2);
}

.menu-icon-grid {
  display: grid;
  grid-template-columns: repeat(3, 36px);
  gap: 0.5rem;
  padding: var(--space-2);
  justify-content: center;
}

.menu-icon-button {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: var(--space-2);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
  width: 2.25rem;
  height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.menu-icon-button:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.15);
}

.menu-icon-button:active {
  transform: scale(0.95);
}

.menu-icon-button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* Submenu Styling */
.submenu-item {
  position: relative;
}

.submenu-arrow {
  margin-left: auto;
  flex-shrink: 0;
}

.submenu {
  position: absolute;
  left: calc(100% + var(--space-1));
  top: 0;
  /* Glass morphism - transparent with purple tint and blur */
  background: rgba(20, 20, 40, 0.85);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  /* Stroke border - more visible */
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-md);
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.5),
    0 8px 24px rgba(0, 0, 0, 0.3);
  padding: var(--space-2) 0;
  min-width: 180px;
  max-width: 280px;
  max-height: 60vh;
  overflow-y: auto;
  z-index: var(--z-popover);
  pointer-events: auto;
  animation: submenuSlideIn var(--duration-fast) ease-out;
  /* Ensure backdrop-filter works */
  isolation: isolate;
  transform: translateZ(0);
}

.submenu.submenu-flipped {
  left: auto;
  right: calc(100% + var(--space-1));
  animation: submenuSlideInFlipped var(--duration-fast) ease-out;
}

@keyframes submenuSlideIn {
  from {
    opacity: 0;
    transform: translateX(-8px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes submenuSlideInFlipped {
  from {
    opacity: 0;
    transform: translateX(8px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>

<!-- Global styles for teleported submenu (escapes scoped styles) -->
<style>
.submenu-teleported {
  /* Glass morphism - transparent with purple tint and blur */
  background: rgba(20, 20, 40, 0.95);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  /* Stroke border - more visible */
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-md, 8px);
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.5),
    0 8px 24px rgba(0, 0, 0, 0.3);
  padding: var(--space-2, 8px) 0;
  min-width: 200px;
  max-width: 280px;
  max-height: 60vh;
  overflow-y: auto;
  pointer-events: auto;
  animation: teleportedSubmenuSlideIn 150ms ease-out;
  /* Ensure backdrop-filter works */
  isolation: isolate;
}

.submenu-teleported .menu-item {
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-primary, #e5e5e5);
  padding: var(--space-3, 12px) var(--space-4, 16px);
  font-size: var(--text-sm, 14px);
  font-weight: var(--font-normal, 400);
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
  transition: background-color 0.15s ease;
}

.submenu-teleported .menu-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.submenu-teleported .menu-icon {
  flex-shrink: 0;
}

.submenu-teleported .menu-text {
  flex: 1;
  font-weight: var(--font-normal, 400);
}

.submenu-teleported .menu-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: var(--space-2, 8px) 0;
}

@keyframes teleportedSubmenuSlideIn {
  from {
    opacity: 0;
    transform: translateX(-8px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
