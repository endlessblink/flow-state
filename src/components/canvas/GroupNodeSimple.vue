<template>
  <div
    class="section-node"
    :class="[`section-type-${section.type}`, { 'collapsed': isCollapsed, 'is-dragging': dragging }]"
    :style="{ borderColor: section.color, backgroundColor: section.color + '25' }"
    @contextmenu.prevent="handleContextMenu"
  >
    <!-- Section Header -->
    <div class="section-header" :style="{ background: section.color + '20' }">
      <div class="section-color-dot" :style="{ background: section.color }" />
      <button class="collapse-btn" :title="isCollapsed ? 'Expand group' : 'Collapse group'" @click="toggleCollapse">
        <ChevronDown v-if="!isCollapsed" :size="14" />
        <ChevronRight v-else :size="14" />
      </button>
      <input
        v-model="sectionName"
        class="section-name-input"
        placeholder="Group name..."
        :disabled="isCollapsed"
        @blur="updateName"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      >
      <!-- TASK-130: Show date suffix for day-of-week groups (e.g., "/ Jan 10") -->
      <span v-if="dayOfWeekDateSuffix" class="section-date-suffix">
        / {{ dayOfWeekDateSuffix }}
      </span>

      <!-- TASK-068: All actions moved to context menu for cleaner header -->

      <div class="section-count" :class="{ 'has-tasks': taskCount > 0 }">
        {{ taskCount }}
        <span v-if="isCollapsed && taskCount > 0" class="hidden-indicator" :title="`${taskCount} hidden tasks`">📦</span>
      </div>
      <!-- DEBUG: Show group ID for deletion debugging -->
      <span class="debug-id" style="position: absolute; top: -18px; right: 4px; font-size: 9px; color: #888; font-family: monospace;">
        {{ (props.data as any)?.id?.slice(0, 8) }} · d:{{ (props.data as any)?.directTaskCount }} a:{{ (props.data as any)?.aggregatedTaskCount }}
      </span>
    </div>

    <!-- TASK-141: ADD SLOT FOR CHILD NODES (CRITICAL FOR VUE FLOW NESTING) -->
    <div v-if="!isCollapsed" class="section-body">
      <slot />
    </div>

    <!-- RESIZE HANDLES - BUG-043: Enable all corners AND edges for resizing -->
    <NodeResizer
      :is-visible="true"
      :min-width="200"
      :min-height="80"
      :max-width="50000"
      :max-height="50000"
      :line-positions="[Position.Top, Position.Right, Position.Bottom, Position.Left]"
      @resize-start="handleResizeStart"
      @resize="handleResize"
      @resize-end="handleResizeEnd"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ChevronDown, ChevronRight } from 'lucide-vue-next'
import { NodeResizer } from '@vue-flow/node-resizer'
import '@vue-flow/node-resizer/dist/style.css'
// TASK-072: Import useNode for reactive node data from Vue Flow state
// TASK-072: Use reactive node data if needed
// BUG-043: Import Position for edge resize handles
import { Position } from '@vue-flow/core'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
// TASK-167: Direct import to ensure latest logic
import { detectPowerKeyword, type PowerKeywordResult } from '@/composables/usePowerKeywords'

// Define Props
const props = defineProps<{
  id: string
  data: any
  selected?: boolean
  dragging?: boolean
}>()

// Define Emits
const emit = defineEmits([
  'update',
  'collect',
  'contextMenu',
  'open-settings',
  'resizeStart',
  'resize',
  'resizeEnd'
])

// Initialize Stores
const canvasStore = useCanvasStore()
const taskStore = useTaskStore()

// Computed Properties
// Ensure we handle both structure formats (direct props or nested in data)
const section = computed(() => props.data?.section || props.data)
const isCollapsed = computed(() => !!props.data?.isCollapsed)
const taskCount = computed(() => {
  const data = props.data as any
  if (!data) return 0

  // Determine which count to show based on whether this is a root or child group
  // - Root groups (no parent): show aggregated count (includes descendants)
  // - Child groups: show only direct count (tasks in this group only)
  const isRootGroup = !data.parentGroupId || data.parentGroupId === 'NONE'
  const direct = data.directTaskCount ?? 0
  const aggregated = data.aggregatedTaskCount ?? direct

  return isRootGroup ? aggregated : direct
})

// Local State
const sectionName = ref(props.data?.name || '')

// DEBUG: Watch for count changes to verify reactivity pipeline
watch(
  () => [props.data?.directTaskCount, props.data?.aggregatedTaskCount],
  (newVal, oldVal) => {
    if (newVal[0] !== oldVal?.[0] || newVal[1] !== oldVal?.[1]) {
      console.log('[DEBUG HEADER REACT]', props.data?.id, {
        direct: newVal[0],
        aggregated: newVal[1],
        oldDirect: oldVal?.[0],
        oldAggregated: oldVal?.[1],
      })
    }
  }
)

// TASK-130: Compute upcoming date for day-of-week groups
const dayOfWeekDateSuffix = computed(() => {
  // Use local name ref for immediate reactivity
  const currentName = sectionName.value
  if (!currentName) return null
  
  // Re-detect keyword locally to ensure reactivity allows "instant" feedback
  const explicitKeyword = detectPowerKeyword(currentName)
  
  if (!explicitKeyword || explicitKeyword.category !== 'day_of_week') {
    return null
  }

  const targetDayIndex = parseInt(explicitKeyword.value, 10)
  if (isNaN(targetDayIndex)) return null

  const today = new Date()
  // Calculate next occurrence: same formula as drag-drop
  const daysUntilTarget = ((7 + targetDayIndex - today.getDay()) % 7) || 7
  const targetDate = new Date(today)
  targetDate.setDate(today.getDate() + daysUntilTarget)

  // Format as "D.M.YY" (e.g. 10.1.26)
  const day = targetDate.getDate()
  const month = targetDate.getMonth() + 1
  const year = targetDate.getFullYear().toString().slice(-2)
  
  return `${day}.${month}.${year}`
})

// Watch for external name changes
watch(() => props.data.name, (newName) => {
  sectionName.value = newName
})

const updateName = () => {
  if (sectionName.value !== props.data.name) {
    emit('update', { name: sectionName.value })
  }
}

const toggleCollapse = () => {
  canvasStore.toggleSectionCollapse(props.id)
}

// TASK-068: Removed toggleAutoCollect - feature consolidated

const handleContextMenu = (event: MouseEvent) => {
  console.debug('[BUG-251] GroupNodeSimple.handleContextMenu raw event', {
    nodeId: props.id,
    eventType: event.type,
    target: (event.target as HTMLElement)?.className
  })
  emit('contextMenu', event, props.data)
}

// Resize event handlers
const handleResizeStart = (event: unknown) => {
  emit('resizeStart', { sectionId: props.id, event })
}

const rafId = ref<number | null>(null)
const isMounting = ref(true)

import { onMounted } from 'vue'

onMounted(() => {
  // Guard against spurious resize events during initial render
  setTimeout(() => {
    isMounting.value = false
  }, 500)
})

const handleResize = (event: unknown) => {
  if (isMounting.value) return
  if (rafId.value) cancelAnimationFrame(rafId.value)

  rafId.value = requestAnimationFrame(() => {
    // Try to cast for logging
    const resizeEvent = event as { height?: number; params?: { height?: number } }
    // Extract height being requested by NodeResizer
    const nodeResizerHeight = resizeEvent?.height || resizeEvent?.params?.height

    // Only log when near constraints to reduce noise
    const nearMin = nodeResizerHeight && nodeResizerHeight <= 120
    const nearMax = nodeResizerHeight && nodeResizerHeight >= 1950

    if (nearMin || nearMax) {
      console.log('🔍 Resize Debug:', {
        sectionId: props.id,
        nodeResizerHeight,
        minHeight: 80,
        maxHeight: 2000,
        hitMinConstraint: nodeResizerHeight && nodeResizerHeight <= 80,
        hitMaxConstraint: nodeResizerHeight && nodeResizerHeight >= 2000,
        distanceFromMin: nodeResizerHeight ? nodeResizerHeight - 80 : 0,
        distanceFromMax: nodeResizerHeight ? 2000 - nodeResizerHeight : 0
      })
    }

    emit('resize', { sectionId: props.id, event })
    rafId.value = null
  })
}

const handleResizeEnd = (event: unknown) => {
  if (isMounting.value) return
  emit('resizeEnd', { sectionId: props.id, event })
}
</script>

<style scoped>
/* TASK-073 + TASK-079: Enhanced group outline styling for visibility and distinction */
.section-node {
  width: 100%;
  height: 100%;
  /* BUG-251 FIX: Use flexbox so section-body can fill remaining space */
  display: flex;
  flex-direction: column;
  /* TASK-073: Double-line border effect - inner solid + outer subtle */
  border: 2px solid rgba(255, 255, 255, 0.35) !important;
  border-radius: var(--radius-lg);
  /* TASK-079: Brighter background for contrast against dark canvas */
  background: rgba(45, 48, 58, 0.65) !important;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  position: relative;
  z-index: 1;
  /* TASK-073: Outer line via outline for double-border effect */
  outline: 1px solid rgba(255, 255, 255, 0.12);
  outline-offset: 2px;
  /* TASK-079: Strong glow for zoom-out visibility */
  box-shadow:
    /* Drop shadows */
    0 16px 48px rgba(0, 0, 0, 0.5),
    0 8px 24px rgba(0, 0, 0, 0.3),
    /* ZOOM FIX: Large colored glow */
    0 0 80px 20px currentColor,
    /* TASK-073: Inner subtle highlight */
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  transition: all var(--duration-fast) ease;
}

.section-node.is-dragging {
  transition: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  filter: none !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;
}

.section-node:hover {
  /* TASK-073: Enhanced hover - brighter border and stronger outline */
  border-color: rgba(255, 255, 255, 0.50) !important;
  outline: 1px solid rgba(255, 255, 255, 0.20);
  outline-offset: 3px;
  box-shadow:
    0 20px 56px rgba(0, 0, 0, 0.55),
    0 10px 28px rgba(0, 0, 0, 0.35),
    /* ZOOM FIX: Even stronger glow on hover */
    0 0 100px 25px currentColor,
    /* TASK-073: Brighter inner highlight on hover */
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

/* TASK-073: Selected group state - highly visible */
.section-node.selected,
.section-node:focus-within {
  border-color: var(--accent-primary) !important;
  outline: 2px solid rgba(99, 102, 241, 0.4);
  outline-offset: 3px;
  box-shadow:
    0 20px 56px rgba(0, 0, 0, 0.55),
    0 10px 28px rgba(0, 0, 0, 0.35),
    0 0 100px 25px currentColor,
    /* Accent glow for selection */
    0 0 20px 4px rgba(99, 102, 241, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

.section-header {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  padding-right: 50px; /* Make space for count badge */
  border-bottom: 1px solid var(--glass-border-soft);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  min-height: 40px; /* Ensure consistent header height */
  overflow: hidden; /* Prevent header overflow */
  flex-shrink: 0; /* BUG-251: Don't shrink header when using flexbox layout */
}

.section-color-dot {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.collapse-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  transition: all var(--duration-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.collapse-btn:hover {
  background: var(--glass-bg-heavy);
  color: var(--text-primary);
}

.collapse-btn:focus {
  outline: 2px solid var(--accent-primary);
  outline-offset: 1px;
}

/* Header Actions Container - handles overflow gracefully */
.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 1;
  min-width: 0; /* Allow shrinking below content size */
  overflow: hidden;
  position: relative;
}

/* Fade mask to indicate overflow */
.header-actions::after {
  content: '';
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 16px;
  background: linear-gradient(to right, transparent, var(--glass-bg-light));
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--duration-fast);
}

/* Show fade mask when container might be overflowing */
.section-header:hover .header-actions::after {
  opacity: 0.8;
}

/* TASK-068: Removed .auto-collect-btn CSS - feature removed to reduce clutter */

.section-name-input {
  flex: 1 1 60px; /* Grow, shrink, min basis of 60px */
  min-width: 60px; /* Minimum readable width */
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  outline: none;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  transition: background var(--duration-fast);
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.section-name-input:hover,
.section-name-input:focus {
  background: var(--glass-bg-medium);
}

/* TASK-130: Day-of-week date suffix styling */
.section-date-suffix {
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  white-space: nowrap;
  flex-shrink: 0;
  padding-left: var(--space-1);
}

/* TASK-068: Removed .section-type-badge CSS - non-actionable element removed */

.section-count {
  /* Position badge absolutely to prevent overflow */
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);

  /* Badge styling */
  background: var(--glass-bg-medium);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  min-width: 20px;
  text-align: center;
  display: flex;
  align-items: center;
  gap: var(--space-1);

  /* Prevent interference with resize handles */
  pointer-events: none;
  z-index: 10;
}

.section-count.has-tasks {
  background: var(--blue-bg-medium);
  color: var(--blue-text);
  border: 1px solid var(--blue-border-active);
}

.hidden-indicator {
  font-size: 10px;
  opacity: 0.7;
  animation: hidden-pulse 2s ease-in-out infinite;
}

@keyframes hidden-pulse {
  0%, 100% {
    opacity: 0.5;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

/* BUG-251 FIX: Ensure section body captures right-click events */
.section-body {
  flex: 1;
  min-height: 40px; /* Minimum clickable area even when empty */
  position: relative;
  /* Ensure clicks on empty space are captured by the group, not the pane */
  pointer-events: auto;
}

.section-node.collapsed {
  min-height: auto;
  height: auto !important;
  cursor: pointer;
  /* TASK-073: Subtle dashed outline for collapsed state distinction */
  border-style: dashed !important;
  border-color: rgba(255, 255, 255, 0.25) !important;
  outline: 1px dashed rgba(255, 255, 255, 0.08);
  outline-offset: 2px;
}

.section-node.collapsed:hover {
  border-color: rgba(255, 255, 255, 0.40) !important;
  outline: 1px dashed rgba(255, 255, 255, 0.15);
}

.section-node.collapsed .section-header {
  border-bottom: none;
  border-radius: var(--radius-lg);
}

/* Hide Vue Flow handles when collapsed */
.section-node.collapsed .vue-flow__handle {
  display: none;
}

/* TASK-073: Collapsed + selected state with accent outline */
.section-node.collapsed.vue-flow__node--selected {
  border-color: var(--accent-primary) !important;
  outline: 2px solid rgba(99, 102, 241, 0.3);
  outline-offset: 3px;
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.5),
    0 8px 24px rgba(0, 0, 0, 0.3),
    0 0 20px 4px rgba(99, 102, 241, 0.25);
}

/* Visual hint for collapsed sections */
.section-node.collapsed::after {
  content: '';
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 4px solid var(--text-secondary);
  opacity: 0.3;
}

/* Power Mode Styles - TASK-068: Removed redundant .power-indicator (toggle button shows state) */

.collect-wrapper {
  position: relative;
  flex-shrink: 0;
}

.collect-btn {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: 2px 4px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
  font-size: var(--text-xs);
}

.collect-btn:hover {
  background: var(--glass-bg-heavy);
  color: var(--text-primary);
}

.collect-btn.has-matches {
  background: var(--blue-bg-medium, rgba(59, 130, 246, 0.2));
  border-color: var(--blue-border-active, rgba(59, 130, 246, 0.4));
  color: var(--blue-text, #3b82f6);
}

.collect-badge {
  background: var(--blue-bg-medium, rgba(59, 130, 246, 0.3));
  color: var(--blue-text, #3b82f6);
  font-size: 9px;
  font-weight: var(--font-bold);
  padding: 0 4px;
  border-radius: var(--radius-full);
  min-width: 14px;
  text-align: center;
}

.collect-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: var(--glass-bg-solid);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-xl);
  z-index: 100;
  min-width: 180px;
  overflow: hidden;
}

.collect-option {
  display: block;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  text-align: left;
  cursor: pointer;
  transition: all var(--duration-fast);
}

.collect-option:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
}

.power-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
  padding: 2px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
  flex-shrink: 0;
}

.power-toggle-btn:hover {
  background: var(--glass-bg-medium);
  color: var(--text-secondary);
}

.power-toggle-btn.power-active {
  background: var(--amber-bg-medium, rgba(245, 158, 11, 0.2));
  border-color: var(--amber-border-active, rgba(245, 158, 11, 0.4));
  color: var(--amber-text, #f59e0b);
}

/* Settings Button */
.settings-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
  padding: 2px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
  flex-shrink: 0;
}

.settings-btn:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
  border-color: var(--glass-border-hover);
}

.settings-btn:active {
  background: var(--glass-bg-heavy);
  transform: scale(0.95);
}
</style>
