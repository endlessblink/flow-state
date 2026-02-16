<template>
  <div
    class="sidebar-smart-item"
    :class="[
      `color-${color}`,
      {
        'is-active': active,
        'is-compact': compact,
        'is-drag-target': isDragTarget,
        'is-drag-valid': isDragValid,
        'is-drag-invalid': isDragTarget && !isDragValid && isDragging,
        'is-empty': count === 0
      }
    ]"
    @click="$emit('click', $event)"
    @dragenter="handleDragEnter"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <!-- Icon slot -->
    <div v-if="$slots.icon" class="item-icon">
      <slot name="icon" />
    </div>

    <!-- Label -->
    <span class="item-label">
      <slot />
    </span>

    <!-- Count badge -->
    <BaseBadge
      v-if="count !== undefined"
      variant="count"
      size="sm"
      rounded
      class="item-badge"
    >
      {{ count }}
    </BaseBadge>

    <!-- Drop target indicator -->
    <div v-if="isDragTarget && isDragValid" class="drop-indicator">
      <component :is="dropIcon" :size="14" />
      <span>{{ dropLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Calendar, Clock } from 'lucide-vue-next'
import BaseBadge from '@/components/base/BaseBadge.vue'
import { useDragAndDrop } from '@/composables/useDragAndDrop'
import { useTaskStore } from '@/stores/tasks'

interface Props {
  active?: boolean
  count?: number
  compact?: boolean
  color?: 'azure' | 'azure-dark' | 'blue' | 'orange' | 'teal' | 'green' | 'purple' | 'gray'
  dropType?: 'date' | 'duration' | 'none'
  dropValue?: string | number
}

const props = withDefaults(defineProps<Props>(), {
  active: false,
  count: undefined,
  compact: false,
  color: 'teal',
  dropType: 'none',
  dropValue: undefined
})

const _emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const { isDragging, dragData, isValidDrop, setDropTarget, startDrag: _startDrag, endDrag: _endDrag } = useDragAndDrop()
const taskStore = useTaskStore()

const isDragTarget = ref(false)

const isDragValid = computed(() => {
  if (!dragData.value) return false

  // Only accept task drops
  if (dragData.value.type === 'task' && dragData.value.taskId) {
    const targetType = props.dropType === 'date' ? 'date-target' : 'duration-target'
    return isValidDrop(dragData.value, targetType as any)
  }

  return false
})

const dropIcon = computed(() => props.dropType === 'date' ? Calendar : Clock)

const dropLabel = computed(() => {
  if (props.dropType === 'date') {
    switch (props.dropValue) {
      case 'today': return 'Set for Today'
      case 'tomorrow': return 'Set for Tomorrow'
      case 'weekend': return 'Set for Weekend'
      case 'nodate': return 'Clear Date'
      default: return 'Schedule'
    }
  } else if (props.dropType === 'duration') {
    switch (props.dropValue) {
      case 15: return 'Set 15 min'
      case 30: return 'Set 30 min'
      case 60: return 'Set 1 hour'
      case 120: return 'Set 2 hours'
      case -1: return 'Clear Estimate'
      default: return 'Set Duration'
    }
  }
  return 'Drop here'
})

const handleDragEnter = (event: DragEvent) => {
  event.preventDefault()
  isDragTarget.value = true
  const dropId = props.dropType === 'date' ? props.dropValue : `duration-${props.dropValue}`
  setDropTarget(dropId as string)
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  if (isDragValid.value) {
    event.dataTransfer!.dropEffect = 'move'
  } else {
    event.dataTransfer!.dropEffect = 'none'
  }
}

const handleDragLeave = (event: DragEvent) => {
  event.preventDefault()
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const x = event.clientX
  const y = event.clientY

  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
    isDragTarget.value = false
    setDropTarget(null)
  }
}

const handleDrop = async (event: DragEvent) => {
  event.preventDefault()
  event.stopPropagation()

  isDragTarget.value = false
  setDropTarget(null)

  if (dragData.value && isDragValid.value && dragData.value.type === 'task' && dragData.value.taskId) {
    const store = taskStore as any
    const updates: any = {}

    if (props.dropType === 'date') {
      updates.dueDate = calculateTargetDate()
    } else if (props.dropType === 'duration') {
      updates.estimatedDuration = props.dropValue === -1 ? null : props.dropValue
    }

    if (store.updateTaskWithUndo) {
      await store.updateTaskWithUndo(dragData.value.taskId, updates)
    } else {
      await taskStore.updateTask(dragData.value.taskId, updates) // BUG-1051: AWAIT to ensure persistence
    }
  }
}

const calculateTargetDate = (): string => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  switch (props.dropValue) {
    case 'today':
      return today.toISOString().split('T')[0]
    case 'tomorrow': {
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      return tomorrow.toISOString().split('T')[0]
    }
    case 'weekend': {
      const saturday = new Date(today)
      const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7
      saturday.setDate(today.getDate() + daysUntilSaturday)
      return saturday.toISOString().split('T')[0]
    }
    case 'nodate':
    default:
      return ''
  }
}
</script>

<style scoped>
.sidebar-smart-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  position: relative;
  min-height: 40px;
  user-select: none;
  border: 1px solid transparent;
}

.sidebar-smart-item.is-compact {
  padding: var(--space-1_5) var(--space-2);
  gap: var(--space-2);
  min-height: 32px;
  border-radius: var(--radius-md);
}

.sidebar-smart-item:hover {
  background: var(--surface-hover);
}

/* ADHD-friendly: Dim zero-count items to reduce visual noise */
.sidebar-smart-item.is-empty {
  opacity: 0.5;
}

.sidebar-smart-item.is-empty:hover {
  opacity: 0.8;
}

/* Active Glassmorphism States */
.sidebar-smart-item.is-active {
  backdrop-filter: var(--state-active-glass);
  -webkit-backdrop-filter: var(--state-active-glass);
  color: var(--state-active-text);
  font-weight: var(--font-semibold);
}

/* Color Mapping for Active State */
.sidebar-smart-item.color-azure.is-active {
  background: var(--filter-today-bg);
  border-color: var(--filter-today-border);
  box-shadow: var(--filter-today-glow);
}

.sidebar-smart-item.color-azure-dark.is-active {
  background: var(--filter-week-bg);
  border-color: var(--filter-week-border);
  box-shadow: var(--filter-week-glow);
}

.sidebar-smart-item.color-blue.is-active {
  background: var(--filter-tasks-bg);
  border-color: var(--filter-tasks-border);
  box-shadow: var(--filter-tasks-glow);
}

.sidebar-smart-item.color-orange.is-active {
  background: var(--filter-uncategorized-bg);
  border-color: var(--filter-uncategorized-border);
  box-shadow: var(--filter-uncategorized-glow);
}

.sidebar-smart-item.color-teal.is-active {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  box-shadow: var(--state-hover-glow);
}

/* Duration Specific Colors (New Unified System) */
.sidebar-smart-item.color-green.is-active {
  background: var(--success-bg-subtle);
  border-color: var(--success-border-medium);
  box-shadow: var(--success-glow);
}

.sidebar-smart-item.color-purple.is-active {
  background: var(--purple-bg-subtle);
  border-color: var(--purple-border-medium);
  box-shadow: var(--purple-shadow-medium);
}

.sidebar-smart-item.color-gray.is-active {
  background: var(--glass-bg-heavy);
  border-color: var(--glass-border-hover);
  box-shadow: var(--shadow-sm);
}

.item-icon {
  color: var(--text-muted);
  display: flex;
  align-items: center;
  flex-shrink: 0;
  transition: color var(--duration-normal) var(--spring-smooth);
}

.is-active .item-icon {
  color: var(--text-primary);
}

.sidebar-smart-item:hover .item-icon {
  color: var(--text-secondary);
}

.item-label {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color var(--duration-fast);
}

.is-compact .item-label {
  font-size: var(--text-xs);
}

.is-active .item-label {
  color: var(--text-primary);
}

.sidebar-smart-item:hover .item-label {
  color: var(--text-primary);
}

/* Drag states */
.sidebar-smart-item.is-drag-target.is-drag-valid {
  background: color-mix(in srgb, var(--brand-primary) 15%, transparent) !important;
  border-color: var(--brand-primary) !important;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--brand-primary) 20%, transparent) !important;
  animation: pulseValid 1.5s ease-in-out infinite;
}

.sidebar-smart-item.is-drag-target.is-drag-invalid {
  background: var(--color-danger-bg-light) !important;
  border-color: rgba(255, 107, 107, 0.3) !important;
  opacity: 0.6;
  cursor: not-allowed;
}

/* Drop indicator */
.drop-indicator {
  position: absolute;
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-left: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--brand-primary) 95%, transparent) 0%,
    color-mix(in srgb, var(--brand-primary) 85%, transparent) 100%
  );
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-md);
  color: #0a0a0a;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  white-space: nowrap;
  pointer-events: none;
  box-shadow:
    0 4px 12px color-mix(in srgb, var(--brand-primary) 30%, transparent),
    0 0 0 2px color-mix(in srgb, var(--brand-primary) 20%, transparent);
  z-index: 1000;
  animation: slideInIndicator 0.2s var(--spring-smooth);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

@keyframes pulseValid {
  0%, 100% {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--brand-primary) 20%, transparent) !important;
  }
  50% {
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--brand-primary) 30%, transparent) !important;
  }
}

@keyframes slideInIndicator {
  from {
    opacity: 0;
    transform: translateY(-50%) translateX(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(-50%) translateX(0);
  }
}

</style>
