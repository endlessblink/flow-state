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

      <button
        class="menu-item"
        @click="$emit('editGroup', contextSection)"
      >
        <Edit2 :size="16" :stroke-width="1.5" class="menu-icon" />
        <span class="menu-text">Edit Group</span>
      </button>

      <button
        class="menu-item danger"
        @click="$emit('deleteGroup', contextSection)"
      >
        <Trash2 :size="16" :stroke-width="1.5" class="menu-icon" />
        <span class="menu-text">Delete Group</span>
      </button>

      <div class="menu-divider"></div>
    </template>

    <!-- Create Task Here -->
    <button
      class="menu-item"
      @click="$emit('createTaskHere')"
    >
      <PlusCircle :size="16" :stroke-width="1.5" class="menu-icon" />
      <span class="menu-text">Create Task Here</span>
    </button>

    <!-- Create Custom Group -->
    <button
      v-if="!contextSection"
      class="menu-item"
      @click="handleCreateGroup"
    >
      <Group :size="16" :stroke-width="1.5" class="menu-icon" />
      <span class="menu-text">Create Custom Group</span>
    </button>

    <!-- Create Group (Smart Wizard) -->
    <button
      v-if="!contextSection"
      class="menu-item"
      @click="handleCreateSection"
    >
      <Sparkles :size="16" :stroke-width="1.5" class="menu-icon" />
      <span class="menu-text">Create Group (Smart)</span>
    </button>

    <!-- Task-specific options (when tasks are selected) -->
    <template v-if="hasSelectedTasks && selectedCount >= 1 && !contextSection">
      <div class="menu-divider"></div>

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
      <div class="menu-divider"></div>
      <div
        class="menu-item submenu-item"
        @mouseenter="handleLayoutSubmenuEnter"
        @mouseleave="handleLayoutSubmenuLeave"
      >
        <LayoutGrid :size="16" :stroke-width="1.5" class="menu-icon" />
        <span class="menu-text">Layout</span>
        <ChevronRight :size="16" :stroke-width="1.5" class="submenu-arrow" />

        <!-- Layout Submenu with all align/distribute/arrange options -->
        <div
          v-if="showLayoutSubmenu"
          ref="submenuRef"
          class="submenu"
          :class="{ 'submenu-flipped': submenuPosition.flipHorizontal }"
          :style="{ top: `${submenuPosition.adjustVertical}px` }"
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
            <div class="menu-divider"></div>
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
          <div class="menu-divider"></div>
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
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'
import {
  PlusCircle, Group, AlignLeft, AlignHorizontalJustifyStart, AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyCenter, AlignVerticalJustifyStart,
  AlignVerticalJustifyEnd, AlignVerticalJustifyCenter,
  Columns, ArrowLeftRight, ArrowUpDown, Edit2, Trash2, Inbox,
  LayoutGrid, ChevronRight, Rows, LayoutList, Grid3x3, Sparkles
} from 'lucide-vue-next'
import { useContextMenuEvents } from '@/composables/useContextMenuEvents'
import { useContextMenuPositioning } from '@/composables/useContextMenuPositioning'

interface Props {
  isVisible: boolean
  x: number
  y: number
  hasSelectedTasks?: boolean
  selectedCount?: number
  contextSection?: any // CanvasSection for group context
}

const props = withDefaults(defineProps<Props>(), {
  hasSelectedTasks: false,
  selectedCount: 0
})

const emit = defineEmits<{
  close: []
  createTaskHere: []
  createGroup: []
  createSection: []
  editGroup: [section: any]
  deleteGroup: [section: any]
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
}>()

const menuRef = ref<HTMLElement | null>(null)
const submenuRef = ref<HTMLElement | null>(null)
const showLayoutSubmenu = ref(false)
const submenuTimeout = ref<number | null>(null)
const submenuPosition = ref({ flipHorizontal: false, adjustVertical: 0 })

// Use unified positioning system with reactive getters
const { menuPosition, updatePosition } = useContextMenuPositioning({
  x: () => props.x,
  y: () => props.y,
  menuRef,
  isVisible: () => props.isVisible,
  offset: { x: 0, y: 0 },
  viewportPadding: 16
})

// Use unified event handling with reactive getter
useContextMenuEvents({
  isVisible: () => props.isVisible,
  menuRef,
  closeCallback: () => emit('close'),
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

// Handle create group click
const handleCreateGroup = () => {
  console.log('🔧 CanvasContextMenu: Create Group button clicked!')
  console.log('🔧 CanvasContextMenu: Emitting createGroup event')
  emit('createGroup')
  emit('close')
}

// Handle create smart group click (opens wizard)
const handleCreateSection = () => {
  console.log('✨ CanvasContextMenu: Create Group (Smart) button clicked!')
  console.log('✨ CanvasContextMenu: Emitting createSection event (will open wizard)')
  emit('createSection')
  emit('close')
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

// Cleanup handled by useContextMenuEvents composable
</script>

<style scoped>
.context-menu {
  position: fixed;
  background: linear-gradient(
    135deg,
    var(--surface-primary) 0%,
    var(--surface-secondary) 100%
  );
  backdrop-filter: blur(32px) saturate(150%);
  -webkit-backdrop-filter: blur(32px) saturate(150%);
  border: 1px solid var(--glass-bg-medium);
  border-radius: var(--radius-xl);
  box-shadow:
    0 24px 48px var(--shadow-xl),
    0 12px 24px var(--shadow-xl),
    0 0 0 1px var(--glass-bg-medium),
    inset 0 1px 0 var(--glass-border);
  padding: var(--space-2);
  min-width: 200px;
  max-width: 320px;
  max-height: 80vh;
  overflow-y: auto;
  z-index: var(--z-popover);
  animation: menuSlideIn 150ms cubic-bezier(0.16, 1, 0.3, 1);
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
  background: var(--bg-hover);
}

.menu-item.danger {
  color: var(--danger-text);
}

.menu-item.danger:hover {
  background: var(--danger-bg-subtle);
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
  background: var(--surface-tertiary);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  margin-left: auto;
}

.menu-divider {
  height: 1px;
  background: var(--border-secondary);
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
  background: var(--surface-tertiary);
  border: 1px solid var(--border-secondary);
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
  background: var(--bg-hover);
  border-color: var(--border-hover);
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
  background: var(--surface-secondary);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: var(--space-2) 0;
  min-width: 180px;
  max-width: 280px;
  max-height: 60vh;
  overflow-y: auto;
  z-index: var(--z-popover);
  pointer-events: auto;
  animation: submenuSlideIn var(--duration-fast) ease-out;
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
