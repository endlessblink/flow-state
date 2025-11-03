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

    <!-- Alignment Icon Grid (2+ tasks) -->
    <template v-if="selectedCount >= 2">
      <div class="menu-divider"></div>
      <div class="menu-section-header">
        <AlignLeft :size="14" :stroke-width="1.5" />
        <span>Align</span>
      </div>
      <div class="menu-icon-grid">
        <button class="menu-icon-button" @click="$emit('alignLeft')" title="Align Left">
          <AlignHorizontalJustifyStart :size="18" :stroke-width="1.5" />
        </button>
        <button class="menu-icon-button" @click="$emit('alignRight')" title="Align Right">
          <AlignHorizontalJustifyEnd :size="18" :stroke-width="1.5" />
        </button>
        <button class="menu-icon-button" @click="$emit('alignTop')" title="Align Top">
          <AlignVerticalJustifyStart :size="18" :stroke-width="1.5" />
        </button>
        <button class="menu-icon-button" @click="$emit('alignBottom')" title="Align Bottom">
          <AlignVerticalJustifyEnd :size="18" :stroke-width="1.5" />
        </button>
        <button class="menu-icon-button" @click="$emit('alignCenterHorizontal')" title="Center Horizontally">
          <AlignHorizontalJustifyCenter :size="18" :stroke-width="1.5" />
        </button>
        <button class="menu-icon-button" @click="$emit('alignCenterVertical')" title="Center Vertically">
          <AlignVerticalJustifyCenter :size="18" :stroke-width="1.5" />
        </button>
      </div>
    </template>

    <!-- Distribution Icon Row (3+ tasks) -->
    <template v-if="selectedCount >= 3">
      <div class="menu-divider"></div>
      <div class="menu-section-header">
        <Columns :size="14" :stroke-width="1.5" />
        <span>Distribute</span>
      </div>
      <div class="menu-icon-grid">
        <button class="menu-icon-button" @click="$emit('distributeHorizontal')" title="Distribute Horizontally">
          <ArrowLeftRight :size="18" :stroke-width="1.5" />
        </button>
        <button class="menu-icon-button" @click="$emit('distributeVertical')" title="Distribute Vertically">
          <ArrowUpDown :size="18" :stroke-width="1.5" />
        </button>
      </div>
    </template>

    <!-- Arrange Submenu (2+ tasks) -->
    <template v-if="selectedCount >= 2">
      <div class="menu-divider"></div>
      <div
        class="menu-item submenu-item"
        @mouseenter="showArrangeSubmenu = true"
        @mouseleave="handleArrangeSubmenuLeave"
      >
        <LayoutGrid :size="16" :stroke-width="1.5" class="menu-icon" />
        <span class="menu-text">Arrange</span>
        <ChevronRight :size="16" :stroke-width="1.5" class="submenu-arrow" />
      </div>

      <!-- Arrange Submenu -->
      <div
        v-if="showArrangeSubmenu"
        class="submenu"
        @mouseenter="showArrangeSubmenu = true"
        @mouseleave="handleArrangeSubmenuLeave"
      >
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
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import {
  PlusCircle, Group, AlignLeft, AlignHorizontalJustifyStart, AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyCenter, AlignVerticalJustifyStart,
  AlignVerticalJustifyEnd, AlignVerticalJustifyCenter,
  Columns, ArrowLeftRight, ArrowUpDown, Edit2, Trash2,
  LayoutGrid, ChevronRight, Rows, LayoutList, Grid3x3
} from 'lucide-vue-next'

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
  editGroup: [section: any]
  deleteGroup: [section: any]
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
const showArrangeSubmenu = ref(false)

const menuPosition = computed(() => ({
  position: 'fixed',
  left: `${props.x}px`,
  top: `${props.y}px`,
  zIndex: 99999
}))

// Close menu on click outside
const handleClickOutside = (event: MouseEvent) => {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    emit('close')
  }
}

// Close menu on Escape key
const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    emit('close')
  }
}

watch(() => props.isVisible, (visible) => {
  if (visible) {
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
  } else {
    document.removeEventListener('click', handleClickOutside)
    document.removeEventListener('keydown', handleEscape)
  }
})

// Handle create group click
const handleCreateGroup = () => {
  console.log('🔧 CanvasContextMenu: Create Group button clicked!')
  emit('createGroup')
}

// Arrange submenu handlers
const handleArrangeSubmenuLeave = () => {
  setTimeout(() => {
    showArrangeSubmenu.value = false
  }, 200)
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

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleEscape)
})
</script>

<style scoped>
.context-menu {
  position: fixed;
  background: var(--surface-secondary);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: var(--space-2) 0;
  min-width: 240px;
  z-index: 99999 !important;
  animation: menuSlideIn var(--duration-fast) var(--spring-bounce);
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
  left: 100%;
  top: 0;
  margin-left: var(--space-1);
  background: var(--surface-secondary);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: var(--space-2) 0;
  min-width: 200px;
  z-index: 100000;
  animation: submenuSlideIn var(--duration-fast) ease-out;
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
</style>
