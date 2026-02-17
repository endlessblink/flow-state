<template>
  <div
    class="section-node"
    :class="[`section-type-${section.type}`, { 'collapsed': isCollapsed, 'is-dragging': dragging }]"
    :style="{ borderColor: groupColor, backgroundColor: groupColor + '25' }"
    @contextmenu.prevent="handleContextMenu"
  >
    <!-- Section Header -->
    <div class="section-header" :style="{ background: groupColor + '20' }">
      <div class="section-color-dot" :style="{ background: groupColor }" />
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
      <!-- TASK-166: Clickable date picker for bi-directional editing -->
      <NPopover
        v-if="dayOfWeekDateSuffix"
        trigger="click"
        placement="bottom"
        :show="showDatePicker"
        @update:show="showDatePicker = $event"
      >
        <template #trigger>
          <span
            class="section-date-suffix clickable"
            title="Click to change date"
            @click.stop="showDatePicker = true"
          >
            / {{ dayOfWeekDateSuffix }}
          </span>
        </template>
        <NDatePicker
          panel
          type="date"
          :value="currentTargetTimestamp"
          @update:value="handleDateSelect"
        />
      </NPopover>

      <!-- TASK-068: All actions moved to context menu for cleaner header -->

      <div class="section-count" :class="{ 'has-tasks': taskCount > 0 }">
        {{ taskCount }}
        <span v-if="isCollapsed && taskCount > 0" class="hidden-indicator" :title="`${taskCount} hidden tasks`">📦</span>
      </div>
    </div>

    <!-- TASK-141: ADD SLOT FOR CHILD NODES (CRITICAL FOR VUE FLOW NESTING) -->
    <div v-if="!isCollapsed" class="section-body">
      <slot />
    </div>

    <!-- RESIZE HANDLES - BUG-043: Enable all corners AND edges for resizing -->
    <!-- TASK-290: Always render NodeResizer, use CSS to show/hide on hover -->
    <NodeResizer
      is-visible
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
import { ref, computed, watch, onMounted } from 'vue'
import { ChevronDown, ChevronRight } from 'lucide-vue-next'
import { NodeResizer } from '@vue-flow/node-resizer'
import '@vue-flow/node-resizer/dist/style.css'
// TASK-072: Import useNode for reactive node data from Vue Flow state
// TASK-072: Use reactive node data if needed
// BUG-043: Import Position for edge resize handles
import { Position } from '@vue-flow/core'
import { useCanvasStore } from '@/stores/canvas'
// TASK-167: Direct import to ensure latest logic
import { detectPowerKeyword } from '@/composables/usePowerKeywords'
// TASK-166: Date picker for bi-directional day group editing
import { NPopover, NDatePicker } from 'naive-ui'

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

// Computed Properties
// Ensure we handle both structure formats (direct props or nested in data)
const section = computed(() => props.data?.section || props.data)
const isCollapsed = computed(() => !!props.data?.isCollapsed)

// BUG-225 FIX: Get color reactively from store instead of static props.data
// This ensures color updates immediately when changed in the modal without page refresh
const groupColor = computed(() => {
  const groupId = props.data?.id
  if (!groupId) return props.data?.color || '#3b82f6'
  const storeGroup = canvasStore.groups.find(g => g.id === groupId)
  return storeGroup?.color || props.data?.color || '#3b82f6'
})
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

// TASK-166: Date picker state for bi-directional day group editing
const showDatePicker = ref(false)
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Get the current target date as timestamp for the date picker
const currentTargetTimestamp = computed(() => {
  const currentName = sectionName.value
  if (!currentName) return Date.now()

  const explicitKeyword = detectPowerKeyword(currentName)
  if (!explicitKeyword || explicitKeyword.category !== 'day_of_week') {
    return Date.now()
  }

  const targetDayIndex = parseInt(explicitKeyword.value, 10)
  if (isNaN(targetDayIndex)) return Date.now()

  const today = new Date()
  const daysUntilTarget = ((7 + targetDayIndex - today.getDay()) % 7) || 7
  const targetDate = new Date(today)
  targetDate.setDate(today.getDate() + daysUntilTarget)
  return targetDate.getTime()
})

// Handle date selection from picker
const handleDateSelect = (timestamp: number | null) => {
  if (!timestamp) return

  const selectedDate = new Date(timestamp)
  const dayName = DAY_NAMES[selectedDate.getDay()]

  // Update the group name to the new day
  sectionName.value = dayName
  emit('update', { name: dayName })

  showDatePicker.value = false
}

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
  // Use props.data.id (raw group ID), not props.id (Vue Flow node ID 'section-xxx')
  const groupId = props.data?.id || props.id.replace('section-', '')
  canvasStore.toggleSectionCollapse(groupId)
}

// TASK-068: Removed toggleAutoCollect - feature consolidated

const handleContextMenu = (event: MouseEvent) => {
  emit('contextMenu', event, props.data)
}

// Resize event handlers
const handleResizeStart = (event: unknown) => {
  emit('resizeStart', { sectionId: props.id, event })
}

const rafId = ref<number | null>(null)
const isMounting = ref(true)

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
    const _nearMin = nodeResizerHeight && nodeResizerHeight <= 120
    const _nearMax = nodeResizerHeight && nodeResizerHeight >= 1950

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
  border: var(--space-0_5) solid var(--glass-border-medium) !important;
  border-radius: var(--radius-lg);
  /* BUG-1216: backdrop-filter removed for performance */
  background: var(--glass-bg-heavy) !important;
  position: relative;
  z-index: 1;
  /* TASK-073: Outer line via outline for double-border effect */
  outline: var(--space-0_5) solid var(--glass-border-subtle);
  outline-offset: var(--space-0_5);
  box-shadow:
    0 var(--space-2) var(--space-6) var(--shadow-color-md),
    inset 0 var(--space-0_5) 0 var(--glass-border-subtle);
  /* BUG-1216: removed 80px glow spread - too expensive during pan/zoom */
  /* BUG-1216: explicit properties only - 'all' causes drag sluggishness */
  transition: box-shadow var(--duration-fast) ease, border-color var(--duration-fast) ease, outline var(--duration-fast) ease, opacity var(--duration-fast) ease;
}

.section-node.is-dragging {
  transition: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  filter: none !important;
  box-shadow: 0 var(--space-2) var(--space-8) rgba(var(--color-slate-900), 0.4) !important;
}

.section-node:hover {
  /* TASK-073: Enhanced hover - brighter border and stronger outline */
  border-color: var(--glass-border-strong) !important;
  outline: var(--space-0_5) solid var(--glass-border-medium);
  outline-offset: var(--space-0_75);
  box-shadow:
    0 var(--space-3) var(--space-8) var(--shadow-color-lg),
    inset 0 var(--space-0_5) 0 var(--glass-border-subtle);
  /* BUG-1216: removed 100px glow spread on hover */
}

/* TASK-073: Selected group state - highly visible */
.section-node.selected,
.section-node:focus-within {
  border-color: var(--accent-primary) !important;
  outline: var(--space-0_5) solid rgba(var(--accent-primary-rgb), 0.4);
  outline-offset: var(--space-0_75);
  box-shadow:
    0 var(--space-5) var(--space-14) var(--shadow-color-xl),
    0 var(--space-2_5) var(--space-7) var(--shadow-color-lg),
    0 0 var(--space-25) var(--space-6_25) currentColor,
    /* Accent glow for selection */
    0 0 var(--space-5) var(--space-1) rgba(var(--accent-primary-rgb), 0.4),
    inset 0 var(--space-0_5) 0 var(--glass-border-subtle);
}

.section-header {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  padding-right: var(--space-12_5); /* Make space for count badge */
  border-bottom: var(--space-0_5) solid var(--glass-border-soft);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  min-height: var(--space-10); /* Ensure consistent header height */
  overflow: hidden; /* Prevent header overflow */
  flex-shrink: 0; /* BUG-251: Don't shrink header when using flexbox layout */
}

.section-color-dot {
  width: var(--space-2_5);
  height: var(--space-2_5);
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
  outline: var(--space-0_5) solid var(--accent-primary);
  outline-offset: var(--space-0_5);
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
  width: var(--space-4);
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
  flex: 1 1 var(--space-15); /* Grow, shrink, min basis of 60px */
  min-width: var(--space-15); /* Minimum readable width */
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
/* TASK-166: Made clickable for date picker */
.section-date-suffix {
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  white-space: nowrap;
  flex-shrink: 0;
  padding-left: var(--space-1);
}

.section-date-suffix.clickable {
  cursor: pointer;
  padding: var(--space-0_5) var(--space-1_5);
  border-radius: var(--radius-sm);
  transition: all var(--duration-fast);
}

.section-date-suffix.clickable:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
}

/* TASK-068: Removed .section-type-badge CSS - non-actionable element removed */

.section-count {
  /* Position badge absolutely to prevent overflow */
  position: absolute;
  top: 50%;
  right: var(--space-3);
  transform: translateY(-50%);

  /* Badge styling */
  background: var(--glass-bg-medium);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  padding: var(--space-0_5) var(--space-2);
  border-radius: var(--radius-sm);
  min-width: var(--space-5);
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
  border: var(--space-0_5) solid var(--blue-border-active);
}

.hidden-indicator {
  font-size: var(--text-xs);
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
  min-height: var(--space-10); /* Minimum clickable area even when empty */
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
  border-color: var(--border-interactive) !important;
  outline: var(--space-0_5) dashed var(--glass-border-subtle);
  outline-offset: var(--space-0_5);
}

.section-node.collapsed:hover {
  border-color: var(--glass-border-medium) !important;
  outline: var(--space-0_5) dashed var(--glass-border-medium);
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
  outline: var(--space-0_5) solid rgba(var(--accent-primary-rgb), 0.4);
  outline-offset: var(--space-0_75);
  box-shadow:
    0 var(--space-4) var(--space-12) var(--shadow-color-lg),
    0 var(--space-2) var(--space-6) var(--shadow-color-md),
    0 0 var(--space-5) var(--space-1) rgba(var(--accent-primary-rgb), 0.4);
}

/* Visual hint for collapsed sections */
.section-node.collapsed::after {
  content: '';
  position: absolute;
  bottom: var(--space-2);
  right: var(--space-2);
  width: 0;
  height: 0;
  border-left: var(--space-1) solid transparent;
  border-right: var(--space-1) solid transparent;
  border-top: var(--space-1) solid var(--text-secondary);
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
  gap: var(--space-0_5);
  background: var(--glass-bg-medium);
  border: var(--space-0_5) solid var(--glass-border);
  color: var(--text-secondary);
  padding: var(--space-0_5) var(--space-1);
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
  background: var(--blue-bg-medium);
  border-color: var(--blue-border-active);
  color: var(--blue-text);
}

.collect-badge {
  background: var(--blue-bg-medium);
  color: var(--blue-text);
  font-size: var(--text-2xs);
  font-weight: var(--font-bold);
  padding: 0 var(--space-1);
  border-radius: var(--radius-full);
  min-width: var(--space-3_5);
  text-align: center;
}

.collect-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: var(--space-1);
  background: var(--glass-bg-solid);
  backdrop-filter: blur(var(--space-5));
  -webkit-backdrop-filter: blur(var(--space-5));
  border: var(--space-0_5) solid var(--glass-border);
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
  border: var(--space-0_5) solid var(--glass-border);
  color: var(--text-muted);
  padding: var(--space-0_5);
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
  background: var(--amber-bg-medium);
  border-color: var(--amber-border-active);
  color: var(--amber-text);
}

/* Settings Button */
.settings-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-bg-light);
  border: var(--space-0_5) solid var(--glass-border);
  color: var(--text-muted);
  padding: var(--space-0_5);
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

/* TASK-290: Resize handle styles moved to canvas-view-overrides.css for global control */
</style>
