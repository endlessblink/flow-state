<template>
  <div
    v-if="isVisible"
    ref="menuRef"
    class="context-menu"
    :style="menuPosition"
  >
    <!-- Node/Section Header -->
    <div class="menu-section-header">
      <component :is="nodeIcon" :size="14" :stroke-width="1.5" />
      <span>{{ node?.name || node?.title || 'Node' }}</span>
    </div>

    <!-- Edit Node -->
    <button
      class="menu-item"
      @click="$emit('editNode', node)"
    >
      <Edit2 :size="16" :stroke-width="1.5" class="menu-icon" />
      <span class="menu-text">Edit</span>
      <span class="menu-shortcut">Enter</span>
    </button>

    <!-- Duplicate Node -->
    <button
      class="menu-item"
      @click="$emit('duplicateNode', node)"
    >
      <Copy :size="16" :stroke-width="1.5" class="menu-icon" />
      <span class="menu-text">Duplicate</span>
      <span class="menu-shortcut">Ctrl+D</span>
    </button>

    <!-- Delete Node -->
    <button
      class="menu-item danger"
      @click="$emit('deleteNode', node)"
    >
      <Trash2 :size="16" :stroke-width="1.5" class="menu-icon" />
      <span class="menu-text">Delete</span>
      <span class="menu-shortcut">Del</span>
    </button>

    <div class="menu-divider"></div>

    <!-- Node-specific actions for task nodes -->
    <template v-if="isTaskNode">
      <!-- Complete/Uncomplete -->
      <button
        class="menu-item"
        @click="$emit('toggleComplete', node)"
      >
        <CheckCircle :size="16" :stroke-width="1.5" class="menu-icon" />
        <span class="menu-text">{{ node?.completed ? 'Mark Incomplete' : 'Mark Complete' }}</span>
      </button>

      <!-- Start Timer -->
      <button
        v-if="!node?.completed"
        class="menu-item"
        @click="$emit('startTimer', node)"
      >
        <Play :size="16" :stroke-width="1.5" class="menu-icon" />
        <span class="menu-text">Start Timer</span>
      </button>
    </template>

    <!-- Section-specific actions for section nodes -->
    <template v-if="isSectionNode">
      <!-- Collapse/Expand -->
      <button
        class="menu-item"
        @click="$emit('toggleCollapse', node)"
      >
        <component :is="node?.collapsed ? ChevronDown : ChevronUp" :size="16" :stroke-width="1.5" class="menu-icon" />
        <span class="menu-text">{{ node?.collapsed ? 'Expand Section' : 'Collapse Section' }}</span>
      </button>

      <!-- Sort Section -->
      <button
        class="menu-item"
        @click="$emit('sortSection', node)"
      >
        <ArrowUpDown :size="16" :stroke-width="1.5" class="menu-icon" />
        <span class="menu-text">Sort Tasks</span>
      </button>
    </template>

    <!-- Layout Submenu (when multiple nodes are selected) -->
    <template v-if="hasSelectedTasks && selectedCount >= 2">
      <div class="menu-divider"></div>
      <div
        class="menu-item submenu-item"
        @mouseenter="handleLayoutSubmenuEnter"
        @mouseleave="handleLayoutSubmenuLeave"
      >
        <LayoutGrid :size="16" :stroke-width="1.5" class="menu-icon" />
        <span class="menu-text">Arrange</span>
        <ChevronRight :size="16" :stroke-width="1.5" class="submenu-arrow" />

        <!-- Layout Submenu -->
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
          <button class="menu-item" @click="$emit('alignLeft')">
            <AlignHorizontalJustifyStart :size="16" :stroke-width="1.5" class="menu-icon" />
            <span class="menu-text">Align Left</span>
          </button>
          <button class="menu-item" @click="$emit('alignRight')">
            <AlignHorizontalJustifyEnd :size="16" :stroke-width="1.5" class="menu-icon" />
            <span class="menu-text">Align Right</span>
          </button>
          <button class="menu-item" @click="$emit('alignTop')">
            <AlignVerticalJustifyStart :size="16" :stroke-width="1.5" class="menu-icon" />
            <span class="menu-text">Align Top</span>
          </button>
          <button class="menu-item" @click="$emit('alignBottom')">
            <AlignVerticalJustifyEnd :size="16" :stroke-width="1.5" class="menu-icon" />
            <span class="menu-text">Align Bottom</span>
          </button>
          <button class="menu-item" @click="$emit('alignCenterHorizontal')">
            <AlignHorizontalJustifyCenter :size="16" :stroke-width="1.5" class="menu-icon" />
            <span class="menu-text">Center Horizontally</span>
          </button>
          <button class="menu-item" @click="$emit('alignCenterVertical')">
            <AlignVerticalJustifyCenter :size="16" :stroke-width="1.5" class="menu-icon" />
            <span class="menu-text">Center Vertically</span>
          </button>

          <!-- Distribute Options (3+ nodes) -->
          <template v-if="selectedCount >= 3">
            <div class="menu-divider"></div>
            <button class="menu-item" @click="$emit('distributeHorizontal')">
              <ArrowLeftRight :size="16" :stroke-width="1.5" class="menu-icon" />
              <span class="menu-text">Distribute Horizontally</span>
            </button>
            <button class="menu-item" @click="$emit('distributeVertical')">
              <ArrowUpDown :size="16" :stroke-width="1.5" class="menu-icon" />
              <span class="menu-text">Distribute Vertically</span>
            </button>
          </template>

          <!-- Arrange Options -->
          <div class="menu-divider"></div>
          <button class="menu-item" @click="$emit('arrangeInRow')">
            <Rows :size="16" :stroke-width="1.5" class="menu-icon" />
            <span class="menu-text">Arrange in Row</span>
          </button>
          <button class="menu-item" @click="$emit('arrangeInColumn')">
            <LayoutList :size="16" :stroke-width="1.5" class="menu-icon" />
            <span class="menu-text">Arrange in Column</span>
          </button>
          <button class="menu-item" @click="$emit('arrangeInGrid')">
            <Grid3x3 :size="16" :stroke-width="1.5" class="menu-icon" />
            <span class="menu-text">Arrange in Grid</span>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'
import {
  Edit2, Copy, Trash2, CheckCircle, Play, ChevronDown, ChevronUp,
  ArrowUpDown, LayoutGrid, ChevronRight, AlignHorizontalJustifyStart,
  AlignHorizontalJustifyEnd, AlignVerticalJustifyStart, AlignVerticalJustifyEnd,
  AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter, ArrowLeftRight,
  Rows, LayoutList, Grid3x3, Layers, Package
} from 'lucide-vue-next'

interface Props {
  isVisible: boolean
  x: number
  y: number
  hasSelectedTasks?: boolean
  selectedCount?: number
  node?: any // Canvas node or section
  section?: any // Canvas section (legacy)
}

const props = withDefaults(defineProps<Props>(), {
  hasSelectedTasks: false,
  selectedCount: 0
})

const emit = defineEmits<{
  close: []
  editNode: [node: any]
  duplicateNode: [node: any]
  deleteNode: [node: any]
  toggleComplete: [node: any]
  startTimer: [node: any]
  toggleCollapse: [node: any]
  sortSection: [node: any]
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

const menuPosition = computed(() => ({
  position: 'fixed' as const,
  left: `${props.x}px`,
  top: `${props.y}px`,
  zIndex: 99999
}) as any)

// Determine node type
const isTaskNode = computed(() => {
  return props.node?.type === 'task' || props.node?.taskData
})

const isSectionNode = computed(() => {
  return props.node?.type === 'section' || props.node?.sectionData
})

const nodeIcon = computed(() => {
  if (isTaskNode.value) return Package
  if (isSectionNode.value) return Layers
  return Package // Default
})

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
    showLayoutSubmenu.value = false
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

.menu-shortcut {
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  padding: var(--space-1) var(--space-2);
  background: var(--surface-tertiary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-secondary);
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
  min-width: 200px;
  z-index: 100000;
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