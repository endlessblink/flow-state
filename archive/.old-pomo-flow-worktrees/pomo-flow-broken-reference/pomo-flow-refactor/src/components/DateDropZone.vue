<template>
  <div
    :class="[
      'date-drop-zone',
      {
        'is-drag-target': isDragTarget,
        'is-drag-valid': isDragValid,
        'is-drag-invalid': isDragTarget && !isDragValid && isDragging
      }
    ]"
    @click="$emit('click', $event)"
    @dragenter="handleDragEnter"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <!-- Icon slot -->
    <div v-if="$slots.icon" class="zone-icon">
      <slot name="icon" />
    </div>

    <!-- Label -->
    <span class="zone-label">
      <slot />
    </span>

    <!-- Count badge -->
    <BaseBadge
      v-if="count !== undefined"
      variant="count"
      size="sm"
      rounded
    >
      {{ count }}
    </BaseBadge>

    <!-- Drop target indicator -->
    <div v-if="isDragTarget && isDragValid" class="drop-indicator">
      <Calendar :size="14" />
      <span>Schedule for {{ targetLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Calendar } from 'lucide-vue-next'
import BaseBadge from './base/BaseBadge.vue'
import { useDragAndDrop, type DragData } from '@/composables/useDragAndDrop'
import { useTaskStore } from '@/stores/tasks'

interface Props {
  active?: boolean
  count?: number
  targetType: 'today' | 'weekend' | 'tomorrow' | 'nodate'
}

const props = withDefaults(defineProps<Props>(), {
  active: false
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const { isDragging, dragData, isValidDrop, setDropTarget, startDrag, endDrag } = useDragAndDrop()
const taskStore = useTaskStore()

const isDragTarget = ref(false)

const isDragValid = computed(() => {
  if (!dragData.value) return false

  // Only accept task drops
  if (dragData.value.type === 'task' && dragData.value.taskId) {
    return isValidDrop(dragData.value, 'date-target')
  }

  return false
})

const targetLabel = computed(() => {
  switch (props.targetType) {
    case 'today': return 'Today'
    case 'weekend': return 'This Weekend'
    case 'tomorrow': return 'Tomorrow'
    case 'nodate': return 'No Date'
    default: return props.targetType
  }
})

const handleDragEnter = (event: DragEvent) => {
  event.preventDefault()
  isDragTarget.value = true
  setDropTarget(props.targetType)
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

  // Only clear if actually leaving the element
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const x = event.clientX
  const y = event.clientY

  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
    isDragTarget.value = false
    setDropTarget(null)
  }
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  event.stopPropagation() // Prevent parent elements from handling drop

  isDragTarget.value = false
  setDropTarget(null)

  if (dragData.value && isDragValid.value && dragData.value.type === 'task' && dragData.value.taskId) {
    // Calculate the target date based on the drop zone type
    const targetDate = calculateTargetDate()

    // Update the task with the new date
    taskStore.updateTask(dragData.value.taskId, {
      dueDate: targetDate
    })

    console.log(`✅ Task "${dragData.value.title}" scheduled for ${targetLabel.value} (${targetDate})`)
  }
}

const calculateTargetDate = (): string => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  switch (props.targetType) {
    case 'today':
      return today.toISOString().split('T')[0]

    case 'tomorrow': {
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      return tomorrow.toISOString().split('T')[0]
    }

    case 'weekend': {
      // Find next Saturday (start of weekend)
      const saturday = new Date(today)
      const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7 // If today is Saturday, use next Saturday
      saturday.setDate(today.getDate() + daysUntilSaturday)
      return saturday.toISOString().split('T')[0]
    }

    case 'nodate':
    default:
      return '' // Empty string means no date
  }
}
</script>

<style scoped>
.date-drop-zone {
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

.date-drop-zone:hover {
  background: var(--surface-hover);
}

.date-drop-zone.is-active {
  background: var(--state-active-bg);
  border: 1px solid var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  color: var(--state-active-text);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.zone-icon {
  color: var(--text-muted);
  display: flex;
  align-items: center;
  flex-shrink: 0;
  transition: color var(--duration-normal) var(--spring-smooth);
}

.date-drop-zone.is-active .zone-icon {
  color: var(--text-primary);
}

.date-drop-zone:hover .zone-icon {
  color: var(--text-secondary);
}

.zone-label {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color var(--duration-fast);
}

.date-drop-zone.is-active .zone-label {
  color: var(--text-primary);
  font-weight: var(--font-semibold);
}

.date-drop-zone:hover .zone-label {
  color: var(--text-primary);
}

/* Drag states - Green highlight when valid drop target */
.date-drop-zone.is-drag-target.is-drag-valid {
  background: rgba(78, 205, 196, 0.15) !important;
  border-color: #4ECDC4 !important;
  box-shadow: 0 0 0 2px rgba(78, 205, 196, 0.2) !important;
  animation: pulseValid 1.5s ease-in-out infinite;
}

/* Red highlight when invalid target */
.date-drop-zone.is-drag-target.is-drag-invalid {
  background: rgba(255, 107, 107, 0.1) !important;
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
    rgba(78, 205, 196, 0.95) 0%,
    rgba(78, 205, 196, 0.85) 100%
  );
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(78, 205, 196, 1);
  border-radius: var(--radius-md);
  color: #0a0a0a;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  white-space: nowrap;
  pointer-events: none;
  box-shadow:
    0 4px 12px rgba(78, 205, 196, 0.3),
    0 0 0 2px rgba(78, 205, 196, 0.2);
  z-index: 1000;
  animation: slideInIndicator 0.2s var(--spring-smooth);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

@keyframes pulseValid {
  0%, 100% {
    box-shadow: 0 0 0 2px rgba(78, 205, 196, 0.2) !important;
  }
  50% {
    box-shadow: 0 0 0 4px rgba(78, 205, 196, 0.3) !important;
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

/* Global dragging state - fade out non-target items */
:global(body.dragging-active) .date-drop-zone:not(.is-drag-target) {
  opacity: 0.7;
  transition: opacity var(--duration-fast);
}
</style>