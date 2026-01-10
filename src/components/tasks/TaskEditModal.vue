<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click="$emit('close')">
      <div class="modal-content" @click.stop>
        
        <!-- Header -->
        <div class="modal-header">
          <h2 class="modal-title">Edit Task</h2>
          <button class="close-btn" @click="$emit('close')">
            <X :size="16" />
          </button>
        </div>

        <div class="modal-body">
          <!-- Main Task Details -->
          <section class="form-section">
            <h3 class="section-title">Task Details</h3>
            
            <TaskEditHeader
              ref="headerRef"
              v-model="editedTask"
            />

            <TaskEditMetadata
              v-model="editedTask"
              :current-section-id="currentSectionId"
              :priority-options="priorityOptions"
              :status-options="statusOptions"
              @section-change="handleSectionChange"
              @schedule-change="handleScheduledDateChange"
            />
          </section>

          <!-- Dependencies -->
          <TaskEditDependencies
            v-if="showDependencies"
            :dependencies="dependencies"
          />

          <!-- Subtasks -->
          <TaskEditSubtasks
            :subtasks="editedTask.subtasks"
            @add="addSubtask"
            @delete="deleteSubtask"
            @update="updateSubtaskCompletion"
          />

          <!-- Action Buttons -->
          <div class="section-header" style="margin-top: 2rem;">
            <div class="left-actions">
              <button
                v-if="showPomodoros"
                class="reset-pomodoros-btn-inline"
                @click="resetPomodoros"
              >
                Reset Pomodoros
              </button>
            </div>
            
            <div class="modal-actions">
              <button class="btn btn-secondary" @click="$emit('close')">
                Cancel
              </button>
              <button 
                class="btn btn-primary" 
                :disabled="isSaving" 
                @click="saveTask"
              >
                {{ isSaving ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { X } from 'lucide-vue-next'
import { type Task, useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'

// Composables
import { useTaskEditState } from '@/composables/tasks/useTaskEditState'
import { useTaskEditActions } from '@/composables/tasks/useTaskEditActions'

// Components
import TaskEditHeader from './edit/TaskEditHeader.vue'
import TaskEditMetadata from './edit/TaskEditMetadata.vue'
import TaskEditDependencies from './edit/TaskEditDependencies.vue'
import TaskEditSubtasks from './edit/TaskEditSubtasks.vue'

// Props & Emitters
const props = defineProps<{
  isOpen: boolean
  task: Task | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const taskStore = useTaskStore()
const canvasStore = useCanvasStore()

// Template Refs
const headerRef = ref<InstanceType<typeof TaskEditHeader> | null>(null)
const titleInputRef = computed(() => headerRef.value?.titleInput)

// State Composable
const {
  editedTask,
  isSaving,
  showDependencies,
  showPomodoros,
  priorityOptions,
  statusOptions
} = useTaskEditState(props, titleInputRef)

// Actions Composable
const {
  addSubtask,
  deleteSubtask,
  updateSubtaskCompletion,
  resetPomodoros,
  handleScheduledDateChange,
  handleSectionChange,
  saveTask
} = useTaskEditActions(props, () => emit('close'), editedTask, isSaving)

// --- Computed Props ---

const dependencies = computed(() => {
  if (!editedTask.value.dependsOn || editedTask.value.dependsOn.length === 0) {
    return []
  }
  return editedTask.value.dependsOn
    .map(taskId => taskStore.tasks.find(t => t.id === taskId))
    .filter(t => t !== undefined) as Task[]
})

const currentSectionId = computed(() => {
  if (!editedTask.value.canvasPosition) return null
  
  const pos = editedTask.value.canvasPosition
  const sections = canvasStore.sections
  
  const containingSection = sections.find(s => 
    pos.x >= s.position.x && 
    pos.x <= s.position.x + s.position.width &&
    pos.y >= s.position.y && 
    pos.y <= s.position.y + s.position.height
  )
  
  return containingSection?.id || null
})

// --- Keyboard Shortcuts ---

const handleKeyDown = (event: KeyboardEvent) => {
  if (!props.isOpen || isSaving.value) return

  if (event.key === 'Escape') {
    emit('close')
  } else if (event.key === 'Enter') {
    const target = event.target as HTMLElement
    const isTextarea = target.tagName === 'TEXTAREA'
    const isContentEditable = target.isContentEditable || target.closest('.ProseMirror') !== null

    if (isTextarea || isContentEditable) {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        saveTask()
      }
      return
    }

    event.preventDefault()
    saveTask()
  }
}

onMounted(() => document.addEventListener('keydown', handleKeyDown))
onUnmounted(() => document.removeEventListener('keydown', handleKeyDown))
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  animation: fadeIn var(--duration-normal) var(--spring-smooth);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  background: linear-gradient(135deg, var(--border-medium) 0%, var(--glass-bg-heavy) 100%);
  backdrop-filter: blur(32px) saturate(200%);
  -webkit-backdrop-filter: blur(32px) saturate(200%);
  border: 1px solid var(--border-hover);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-2xl), var(--shadow-2xl), inset 0 2px 0 var(--glass-border-hover);
  width: 90%;
  max-width: 650px;
  max-height: 85vh;
  overflow-y: auto;
  animation: slideUp var(--duration-normal) var(--spring-gentle);
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-5);
  border-bottom: 1px solid var(--glass-bg-heavy);
  background: linear-gradient(180deg, var(--glass-bg-tint) 0%, transparent 100%);
}

.modal-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.close-btn {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  transition: all var(--duration-normal) var(--spring-smooth);
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: var(--glass-border);
  border-color: var(--glass-border-medium);
  color: var(--text-primary);
  transform: scale(1.05);
}

.modal-body {
  padding: var(--space-4) var(--space-5);
}

.form-section {
  margin-bottom: var(--space-4);
}

.section-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--space-3);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}

.btn {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.btn-secondary {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: var(--glass-bg-base);
  border-color: var(--glass-border-hover);
}

.btn-primary {
  background: var(--brand-primary);
  color: white;
  border: none;
  box-shadow: var(--shadow-md);
}

.btn-primary:hover {
  background: var(--brand-primary-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.reset-pomodoros-btn-inline {
  background: transparent;
  border: 1px solid var(--danger-border-medium);
  color: var(--color-priority-high);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  transition: all var(--duration-fast);
}

.reset-pomodoros-btn-inline:hover {
  background: var(--danger-bg-subtle);
  border-color: var(--danger-border-hover);
}
</style>