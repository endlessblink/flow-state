<template>
  <div
    :class="[
      'project-drop-zone',
      {
        'is-active': isActive,
        'is-valid': isValid,
        'is-invalid': !isValid && isDragging,
        'is-nested': isNested
      }
    ]"
    @dragenter="handleDragEnter"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <div class="drop-zone-content">
      <div class="drop-zone-icon">
        <svg v-if="isValid" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          <path d="M8 12H16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>

      <div class="drop-zone-text">
        <div v-if="isValid" class="drop-zone-title">
          {{ isNested ? 'Drop to create subproject' : 'Drop to add to project' }}
        </div>
        <div v-else class="drop-zone-title invalid">
          Cannot drop here
        </div>

        <div class="drop-zone-subtitle">
          {{ dragData?.title || 'Item' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDragAndDrop, type DragData } from '../composables/useDragAndDrop'

interface Props {
  projectId: string
  isNested?: boolean
}

interface Emits {
  (e: 'drop', data: DragData): void
}

const props = withDefaults(defineProps<Props>(), {
  isNested: false
})

const emit = defineEmits<Emits>()

const { isDragging, dragData, isValidDrop, setDropTarget } = useDragAndDrop()

const isActive = computed(() => isDragging.value && dragData.value !== null)

const isValid = computed(() => {
  if (!dragData.value) return false
  return isValidDrop(dragData.value, 'project')
})

const handleDragEnter = (event: DragEvent) => {
  event.preventDefault()
  setDropTarget(props.projectId)
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()

  if (isValid.value) {
    event.dataTransfer!.dropEffect = props.isNested ? 'copy' : 'move'
  } else {
    event.dataTransfer!.dropEffect = 'none'
  }
}

const handleDragLeave = (event: DragEvent) => {
  event.preventDefault()

  // Only clear target if leaving the drop zone entirely
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const x = event.clientX
  const y = event.clientY

  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
    setDropTarget(null)
  }
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  setDropTarget(null)

  if (dragData.value && isValid.value) {
    emit('drop', dragData.value)
  }
}
</script>

<style scoped>
.project-drop-zone {
  border: 2px dashed #ddd;
  border-radius: 8px;
  padding: 16px;
  margin: 8px 0;
  transition: all 0.2s ease;
  opacity: 0;
  transform: translateY(-10px);
  pointer-events: none;
}

.project-drop-zone.is-active {
  opacity: 1;
  transform: translateY(0);
  pointer-events: all;
}

.project-drop-zone.is-valid {
  border-color: #4ECDC4;
  background: rgba(78, 205, 196, 0.1);
}

.project-drop-zone.is-invalid {
  border-color: #ff6b6b;
  background: rgba(255, 107, 107, 0.1);
}

.project-drop-zone.is-nested {
  margin-left: 20px;
  border-color: #96CEB4;
}

.project-drop-zone.is-nested.is-valid {
  background: rgba(150, 206, 180, 0.15);
  border-color: #4ECDC4;
}

.drop-zone-content {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #666;
}

.project-drop-zone.is-valid .drop-zone-content {
  color: #4ECDC4;
}

.project-drop-zone.is-invalid .drop-zone-content {
  color: #ff6b6b;
}

.drop-zone-icon {
  flex-shrink: 0;
  opacity: 0.7;
}

.project-drop-zone.is-valid .drop-zone-icon {
  opacity: 1;
}

.drop-zone-text {
  flex: 1;
}

.drop-zone-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
}

.drop-zone-title.invalid {
  color: #ff6b6b;
}

.drop-zone-subtitle {
  font-size: 12px;
  opacity: 0.8;
}

/* Animation for appearance */
.project-drop-zone.is-active {
  animation: slideIn 0.2s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Mobile-friendly styling */
@media (max-width: 768px) {
  .project-drop-zone {
    padding: 12px;
    margin: 6px 0;
  }

  .drop-zone-content {
    gap: 8px;
  }

  .drop-zone-icon {
    width: 20px;
    height: 20px;
  }

  .drop-zone-title {
    font-size: 13px;
  }

  .drop-zone-subtitle {
    font-size: 11px;
  }

  .project-drop-zone.is-nested {
    margin-left: 16px;
  }
}
</style>