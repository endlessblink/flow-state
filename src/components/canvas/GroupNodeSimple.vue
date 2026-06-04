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
      <button
        class="collapse-btn nodrag nopan"
        :title="isCollapsed ? 'Expand group' : 'Collapse group'"
        @pointerdown.stop
        @mousedown.stop
        @touchstart.stop
        @click.stop.prevent="toggleCollapse"
      >
        <ChevronDown v-if="!isCollapsed" :size="14" />
        <ChevronRight v-else :size="14" />
      </button>
      <input
        v-model="sectionName"
        dir="auto"
        class="section-name-input"
        placeholder="Group name..."
        :disabled="isCollapsed"
        @blur="updateName"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      >
      <div class="section-header-meta">
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
            :actions="[]"
            @update:value="handleDateSelect"
          />
        </NPopover>

        <!-- TASK-1811: Apply the group's resolved due date to its tasks. -->
        <!-- Only shown when the group has a resolvable due date. -->
        <NPopover
          v-if="hasResolvableDueDate && !isCollapsed"
          trigger="click"
          placement="bottom-end"
          :show="showApplyMenu"
          @update:show="showApplyMenu = $event"
        >
          <template #trigger>
            <button
              class="apply-due-btn"
              :title="`Apply ${resolvedDueDate} to tasks in this group`"
              @click.stop="showApplyMenu = true"
            >
              <CalendarCheck :size="13" />
            </button>
          </template>
          <div class="apply-menu">
            <button class="apply-option" @click.stop="applyGroupProps('dueDate')">
              Set due date on all tasks
            </button>
            <button class="apply-option" @click.stop="applyGroupProps('all')">
              Apply all group properties
            </button>
          </div>
        </NPopover>

        <!-- TASK-068: All actions moved to context menu for cleaner header -->
        <div class="section-count" :class="{ 'has-tasks': taskCount > 0 }">
          {{ taskCount }}
          <span v-if="isCollapsed && taskCount > 0" class="hidden-indicator" :title="`${taskCount} hidden tasks`">📦</span>
        </div>
      </div>
    </div>

    <!-- TASK-141: ADD SLOT FOR CHILD NODES (CRITICAL FOR VUE FLOW NESTING) -->
    <div v-if="!isCollapsed" class="section-body">
      <slot />
      <!-- TASK-1791: guide users when a group has no tasks yet -->
      <p v-if="taskCount === 0" class="section-empty-hint">
        Drag tasks here
      </p>
    </div>

    <!-- RESIZE HANDLES - BUG-043: Enable all corners AND edges for resizing -->
    <!-- Collapsed groups must not leave a selected resize overlay covering nearby nodes. -->
    <NodeResizer
      v-if="!isCollapsed"
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

    <Handle
      id="group-target-top"
      type="target"
      :position="Position.Top"
      connectable
      class="handle-target group-link-handle"
    />
    <Handle
      id="group-target-right"
      type="target"
      :position="Position.Right"
      connectable
      class="handle-target group-link-handle"
    />
    <Handle
      id="group-target-bottom"
      type="target"
      :position="Position.Bottom"
      connectable
      class="handle-target group-link-handle"
    />
    <Handle
      id="group-target-left"
      type="target"
      :position="Position.Left"
      connectable
      class="handle-target group-link-handle"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { ChevronDown, ChevronRight, CalendarCheck } from 'lucide-vue-next'
import { NodeResizer } from '@vue-flow/node-resizer'
import '@vue-flow/node-resizer/dist/style.css'
// TASK-072: Import useNode for live node data from Vue Flow state
// TASK-072: Use live node data if needed
// BUG-043: Import Position for edge resize handles
import { Position, Handle } from '@vue-flow/core'
import { useCanvasStore } from '@/stores/canvas'
// TASK-167: Direct import to ensure latest logic
import { detectPowerKeyword } from '@/composables/usePowerKeywords'
// TASK-1756: Shared date math — header and rotation must agree
import { getDayGroupDate, formatDayGroupSuffix } from '@/utils/dayGroupDate'
// TASK-1756: Reactive today ref — invalidates header suffix at midnight
import { useCurrentDay } from '@/composables/useCurrentDay'
// TASK-166: Date picker for bi-directional day group editing
import { NPopover, NDatePicker } from 'naive-ui'
import type { CanvasGroup } from '@/types/canvas'
// TASK-1811: Resolve the group's effective due date to apply to its tasks
import { useTaskStore } from '@/stores/tasks'
import { useCanvasSectionProperties } from '@/composables/canvas/useCanvasSectionProperties'

type GroupNodeData = Partial<CanvasGroup> & {
  section?: CanvasGroup
  isCollapsed?: boolean
  width?: number
  height?: number
}

// Define Props
const props = defineProps<{
  id: string
  data: GroupNodeData
  selected?: boolean
  dragging?: boolean
}>()

// Define Emits
const emit = defineEmits([
  'update',
  'collect',
  'contextMenu',
  'open-settings',
  'applyGroupProps',
  'resizeStart',
  'resize',
  'resizeEnd'
])

// Initialize Stores
const canvasStore = useCanvasStore()

// Computed Properties
// Ensure we handle both structure formats (direct props or nested in data)
const section = computed<GroupNodeData>(() => props.data.section || props.data)
// Collapse state must be read reactively from the STORE, not from Vue Flow node
// data. Toggling collapse (canvasStore.toggleSectionCollapse → updateGroup) does
// NOT bump syncTrigger and the orchestrator only re-syncs groups on length
// change, so node `data.collapsed` is never refreshed — the group never visually
// collapsed. Reading the live store group (same approach as `groupColor`,
// BUG-225) makes the chevron/body react immediately. Node data is a fallback for
// ghost nodes not present in the store.
const isCollapsed = computed(() => {
  const groupId = props.data?.id
  const storeGroup = groupId ? canvasStore.groups.find(g => g.id === groupId) : undefined
  const d = props.data as GroupNodeData & { collapsed?: boolean }
  return !!(storeGroup?.isCollapsed ?? d?.collapsed ?? d?.isCollapsed ?? d?.section?.isCollapsed)
})

// BUG-225 FIX: Get color from store instead of static props.data
// This ensures color updates immediately when changed in the modal without page refresh
// TASK-1791b: legacy default group colors were indigo/blue, which clash with
// the Warm Dark palette. Normalize them to a warm neutral at render time so
// existing groups stop showing purple without a DB migration. Groups with a
// deliberate custom color keep it.
const LEGACY_DEFAULT_GROUP_COLORS = new Set(['#6366f1', '#3b82f6'])
const WARM_DEFAULT_GROUP_COLOR = '#8B8178'
const groupColor = computed(() => {
  const groupId = props.data?.id
  const storeGroup = groupId ? canvasStore.groups.find(g => g.id === groupId) : undefined
  const raw = (storeGroup?.color || props.data?.color || '') as string
  if (!raw || LEGACY_DEFAULT_GROUP_COLORS.has(raw.toLowerCase())) return WARM_DEFAULT_GROUP_COLOR
  return raw
})
const taskCount = computed(() => {
  const data = props.data as Record<string, unknown> | undefined
  const groupId = (data?.id as string | undefined) || props.id?.replace(/^section-/, '')
  if (!groupId) return 0

  // Read from store computeds instead of stale node.data snapshot.
  // Root groups show aggregated count (includes descendants); child groups
  // show direct count only.
  const isRootGroup = !data?.parentGroupId || data.parentGroupId === 'NONE'
  const direct = canvasStore.taskCountByGroupId.get(groupId) ?? 0
  const aggregated = canvasStore.aggregatedTaskCountByGroupId.get(groupId) ?? direct

  return isRootGroup ? aggregated : direct
})

// Local State
const sectionName = ref(props.data?.name || '')

// TASK-1756: Reactive "today" — shared across all group nodes; flips at midnight.
const today = useCurrentDay()

// TASK-166: Date picker state for bi-directional day group editing
const showDatePicker = ref(false)
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Get the current target date as timestamp for the date picker
const currentTargetTimestamp = computed(() => {
  const currentName = sectionName.value
  if (!currentName) return today.value.getTime()

  const explicitKeyword = detectPowerKeyword(currentName)
  if (!explicitKeyword || explicitKeyword.category !== 'day_of_week') {
    return today.value.getTime()
  }

  const targetDayIndex = parseInt(explicitKeyword.value, 10)
  if (isNaN(targetDayIndex)) return today.value.getTime()

  const hasTodayOrTomorrow = canvasStore.groups.some((g) => {
    const kw = detectPowerKeyword(g.name)
    return kw?.category === 'date' && (kw.keyword === 'today' || kw.keyword === 'tomorrow')
  })
  return getDayGroupDate(targetDayIndex, today.value, hasTodayOrTomorrow).getTime()
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

// TASK-130 / TASK-1756: Compute upcoming date for day-of-week, Today, and
// Tomorrow groups using the shared helper so header matches rotation dueDate.
// Depends on the live `today` ref so the suffix re-renders at midnight.
const dayOfWeekDateSuffix = computed(() => {
  const currentName = sectionName.value
  if (!currentName) return null

  const explicitKeyword = detectPowerKeyword(currentName)
  if (!explicitKeyword) return null

  const now = today.value

  if (explicitKeyword.category === 'date') {
    if (explicitKeyword.keyword === 'today') {
      return formatDayGroupSuffix(now)
    }
    if (explicitKeyword.keyword === 'tomorrow') {
      const tmrw = new Date(now)
      tmrw.setDate(tmrw.getDate() + 1)
      return formatDayGroupSuffix(tmrw)
    }
    return null
  }

  if (explicitKeyword.category !== 'day_of_week') return null

  const targetDayIndex = parseInt(explicitKeyword.value, 10)
  if (isNaN(targetDayIndex)) return null

  const hasTodayOrTomorrow = canvasStore.groups.some((g) => {
    const kw = detectPowerKeyword(g.name)
    return kw?.category === 'date' && (kw.keyword === 'today' || kw.keyword === 'tomorrow')
  })

  return formatDayGroupSuffix(getDayGroupDate(targetDayIndex, now, hasTodayOrTomorrow))
})

// TASK-1811: "Apply due date to tasks" affordance.
// Resolve the group's effective due date via the SAME resolver used on drop,
// reading from the store group object (carries assignOnDrop) by id lookup —
// mirrors the groupColor pattern above.
const { getSectionProperties } = useCanvasSectionProperties({
  taskStore: useTaskStore(),
  getAllContainingSections: () => []  // unused by getSectionProperties
})
const storeGroup = computed(() => {
  const groupId = props.data?.id
  return groupId ? canvasStore.groups.find(g => g.id === groupId) || null : null
})
const resolvedDueDate = computed(() => {
  if (!storeGroup.value) return ''
  return getSectionProperties(storeGroup.value as CanvasGroup, canvasStore.groups as CanvasGroup[]).dueDate || ''
})
const hasResolvableDueDate = computed(() => !!resolvedDueDate.value)
const showApplyMenu = ref(false)

const applyGroupProps = (mode: 'dueDate' | 'all') => {
  const groupId = props.data?.id
  if (!groupId) return
  emit('applyGroupProps', { groupId, mode })
  showApplyMenu.value = false
}

// Watch for external name changes
watch(() => props.data.name, (newName) => {
  sectionName.value = newName || ''
})

const updateName = () => {
  if (sectionName.value !== props.data.name) {
    emit('update', { name: sectionName.value })
  }
}

const toggleCollapse = () => {
  // Use props.data.id (raw group ID), not props.id (Vue Flow node ID 'section-xxx')
  const groupId = props.data?.id || props.id?.replace('section-', '')
  if (!groupId) return
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
  min-width: 0; /* Let the title shrink before date/count get clipped */
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

.section-header-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
  min-width: 0;
  margin-inline-start: auto;
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
  justify-content: center;
  gap: var(--space-1);
  flex-shrink: 0;
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

/* TASK-1791: empty-group hint — non-interactive so it never blocks drops */
.section-empty-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  font-size: var(--text-xs);
  color: var(--text-subtle);
  pointer-events: none;
  user-select: none;
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

/* Keep handles measurable while collapsed so existing edges keep a stable
   anchor, but make them non-interactive unless the user is actively connecting. */
.section-node.collapsed .group-link-handle {
  opacity: 0;
  pointer-events: none;
  transform: none;
}

:global(body.connecting-active) .section-node.collapsed .group-link-handle,
.section-node.collapsed:hover .group-link-handle {
  opacity: 0.35;
  pointer-events: auto;
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
  border-inline-start: var(--space-1) solid transparent;
  border-inline-end: var(--space-1) solid transparent;
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
  text-align: start;
  cursor: pointer;
  transition: all var(--duration-fast);
}

.collect-option:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
}

/* TASK-1811: Apply-due-date button + menu */
.apply-due-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-bg-light);
  border: var(--space-0_5) solid var(--glass-border);
  color: var(--text-muted);
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
  flex-shrink: 0;
}

.apply-due-btn:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
  border-color: var(--glass-border-hover);
}

.apply-due-btn:active {
  transform: scale(0.95);
}

.apply-menu {
  display: flex;
  flex-direction: column;
  min-width: 200px;
}

.apply-option {
  display: block;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  text-align: start;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--duration-fast);
}

.apply-option:hover {
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

.group-link-handle {
  width: 9px;
  height: 9px;
  opacity: 0;
  border: 1px solid var(--accent-primary);
  background: var(--surface-primary);
  transition: opacity var(--duration-fast), transform var(--duration-fast);
}

:global(body.connecting-active) .group-link-handle,
.section-node:hover .group-link-handle {
  opacity: 0.45;
}

:global(body.connecting-active) .group-link-handle:hover {
  opacity: 1;
  transform: scale(1.2);
}
</style>
