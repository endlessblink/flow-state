<template>
  <div
    v-if="isOpen"
    class="modal-overlay"
    @click="$emit('close')"
    @keydown="handleKeydown"
  >
    <div class="modal-content" @click.stop>
      <!-- Header -->
      <div class="modal-header">
        <div class="header-left">
          <div class="count-badge">
            <CheckSquare :size="16" :stroke-width="2" />
            <span>Editing {{ taskIds.length }} tasks</span>
          </div>
          <h2 class="modal-title">
            Batch Edit
          </h2>
        </div>
        <button class="close-btn" @click="$emit('close')">
          <X :size="16" />
        </button>
      </div>

      <div class="modal-body">
        <!-- Quick Actions -->
        <section class="quick-actions-section">
          <div class="section-label">
            Quick Actions
          </div>
          <div class="quick-actions-grid">
            <button
              class="quick-action-btn status-done"
              title="Mark all selected tasks as done"
              @click="applyQuickAction('markDone')"
            >
              <CheckCircle :size="18" :stroke-width="2" />
              <span>Mark as Done</span>
            </button>
            <button
              class="quick-action-btn priority-high"
              title="Set all to high priority"
              @click="applyQuickAction('highPriority')"
            >
              <Zap :size="18" :stroke-width="2" />
              <span>High Priority</span>
            </button>
            <button
              class="quick-action-btn danger"
              title="Delete all selected tasks"
              @click="applyQuickAction('deleteAll')"
            >
              <Trash2 :size="18" :stroke-width="2" />
              <span>Delete All</span>
            </button>
          </div>
        </section>

        <!-- Field Selectors -->
        <section class="field-selectors-section">
          <div class="section-label">
            Select Fields to Change
          </div>

          <!-- Status Field -->
          <div class="field-selector">
            <label class="field-checkbox">
              <input
                v-model="fieldChanges.status.enabled"
                type="checkbox"
              >
              <span class="checkbox-label">Change Status</span>
            </label>
            <div v-if="fieldChanges.status.enabled" class="field-input-wrapper">
              <CustomSelect
                :model-value="fieldChanges.status.value || ''"
                :options="statusOptions"
                placeholder="Select status..."
                @update:model-value="(val) => fieldChanges.status.value = val as Task['status']"
              />
            </div>
          </div>

          <!-- Priority Field -->
          <div class="field-selector">
            <label class="field-checkbox">
              <input
                v-model="fieldChanges.priority.enabled"
                type="checkbox"
              >
              <span class="checkbox-label">Change Priority</span>
            </label>
            <div v-if="fieldChanges.priority.enabled" class="field-input-wrapper">
              <CustomSelect
                :model-value="fieldChanges.priority.value || ''"
                :options="priorityOptions"
                placeholder="Select priority..."
                @update:model-value="(val) => fieldChanges.priority.value = val as Task['priority']"
              />
            </div>
          </div>

          <!-- Project Field -->
          <div class="field-selector">
            <label class="field-checkbox">
              <input
                v-model="fieldChanges.projectId.enabled"
                type="checkbox"
              >
              <span class="checkbox-label">Move to Project</span>
            </label>
            <div v-if="fieldChanges.projectId.enabled" class="field-input-wrapper">
              <CustomSelect
                :model-value="fieldChanges.projectId.value || ''"
                :options="projectOptions"
                placeholder="Select project..."
                @update:model-value="(val) => fieldChanges.projectId.value = String(val)"
              />
            </div>
          </div>

          <!-- Due Date Field -->
          <div class="field-selector">
            <label class="field-checkbox">
              <input
                v-model="fieldChanges.dueDate.enabled"
                type="checkbox"
              >
              <span class="checkbox-label">Set Due Date</span>
            </label>
            <div v-if="fieldChanges.dueDate.enabled" class="field-input-wrapper">
              <input
                v-model="fieldChanges.dueDate.value"
                type="date"
                class="field-input"
              >
            </div>
          </div>

          <!-- Estimated Duration Field -->
          <div class="field-selector">
            <label class="field-checkbox">
              <input
                v-model="fieldChanges.estimatedDuration.enabled"
                type="checkbox"
              >
              <span class="checkbox-label">Set Duration</span>
            </label>
            <div v-if="fieldChanges.estimatedDuration.enabled" class="field-input-wrapper">
              <input
                v-model.number="fieldChanges.estimatedDuration.value"
                type="number"
                min="15"
                step="15"
                class="field-input"
                placeholder="60"
              >
              <span class="input-unit">minutes</span>
            </div>
          </div>
        </section>

        <!-- Preview Section -->
        <section v-if="hasChanges" class="preview-section">
          <button class="section-toggle" type="button" @click="showPreview = !showPreview">
            <ChevronDown :size="14" class="chevron-icon" :class="[{ rotated: showPreview }]" />
            <span class="section-label">Preview Changes</span>
          </button>

          <div v-show="showPreview" class="preview-list">
            <div
              v-for="task in selectedTasks"
              :key="task.id"
              class="preview-item"
            >
              <div class="task-name">
                {{ task.title }}
              </div>
              <div class="changes-list">
                <div v-if="fieldChanges.status.enabled" class="change-item">
                  <span class="field-name">Status:</span>
                  <span class="old-value">{{ task.status }}</span>
                  <span class="arrow">→</span>
                  <span class="new-value">{{ fieldChanges.status.value }}</span>
                </div>
                <div v-if="fieldChanges.priority.enabled" class="change-item">
                  <span class="field-name">Priority:</span>
                  <span class="old-value">{{ task.priority }}</span>
                  <span class="arrow">→</span>
                  <span class="new-value">{{ fieldChanges.priority.value }}</span>
                </div>
                <div v-if="fieldChanges.projectId.enabled" class="change-item">
                  <span class="field-name">Project:</span>
                  <span class="old-value">{{ getProjectName(task.projectId) }}</span>
                  <span class="arrow">→</span>
                  <span class="new-value">{{ getProjectName(fieldChanges.projectId.value) }}</span>
                </div>
                <div v-if="fieldChanges.dueDate.enabled" class="change-item">
                  <span class="field-name">Due:</span>
                  <span class="old-value">{{ task.dueDate || 'None' }}</span>
                  <span class="arrow">→</span>
                  <span class="new-value">{{ fieldChanges.dueDate.value }}</span>
                </div>
                <div v-if="fieldChanges.estimatedDuration.enabled" class="change-item">
                  <span class="field-name">Duration:</span>
                  <span class="old-value">{{ task.estimatedDuration || 'None' }}m</span>
                  <span class="arrow">→</span>
                  <span class="new-value">{{ fieldChanges.estimatedDuration.value }}m</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <button class="cancel-btn" @click="$emit('close')">
          Cancel
        </button>
        <button
          class="apply-btn"
          :disabled="!hasChanges"
          @click="applyChanges"
        >
          <Zap :size="16" :stroke-width="2" />
          Apply to {{ taskIds.length }} Tasks
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import type { Task } from '@/stores/tasks'
import {
  X, CheckSquare, CheckCircle, Zap, Trash2, ChevronDown
} from 'lucide-vue-next'
import CustomSelect from '@/components/common/CustomSelect.vue'
import { isTextAreaOrContentEditable } from '@/utils/dom'

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  applied: []
}>()

// Status options for CustomSelect
const statusOptions = [
  { label: 'Planned', value: 'planned' },
  { label: 'Active', value: 'in_progress' },
  { label: '✓', value: 'done' },
  { label: 'Backlog', value: 'backlog' },
  { label: 'On Hold', value: 'on_hold' }
]

// Priority options for CustomSelect
const priorityOptions = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' }
]

interface Props {
  isOpen: boolean
  taskIds: string[]
}

const taskStore = useTaskStore()

// Field changes state
const fieldChanges = ref({
  status: { enabled: false, value: null as Task['status'] | null },
  priority: { enabled: false, value: null as Task['priority'] | null },
  projectId: { enabled: false, value: null as string | null },
  dueDate: { enabled: false, value: null as string | null },
  estimatedDuration: { enabled: false, value: null as number | null }
})

// Preview state
const showPreview = ref(true)

// Computed
const selectedTasks = computed(() => {
  return props.taskIds
    .map(id => taskStore.tasks.find(t => t.id === id))
    .filter(t => t !== undefined) as Task[]
})

const hasChanges = computed(() => {
  return Object.values(fieldChanges.value).some(field => field.enabled)
})

// Project options for CustomSelect
const projectOptions = computed(() =>
  taskStore.projects.map(project => ({
    label: `${project.emoji || '•'} ${project.name}`,
    value: project.id
  }))
)

const getProjectName = (projectId: string | null) => {
  if (!projectId) return 'Unknown'
  const project = taskStore.projects.find(p => p.id === projectId)
  return project?.name || 'Unknown'
}

// Quick actions
const applyQuickAction = async (action: 'markDone' | 'highPriority' | 'deleteAll') => {
  if (action === 'markDone') {
    // Mark all as done
    for (const taskId of props.taskIds) {
      await taskStore.updateTask(taskId, { status: 'done' }) // BUG-1051: AWAIT to ensure persistence
    }
    emit('applied')
    emit('close')
  } else if (action === 'highPriority') {
    // Set all to high priority
    for (const taskId of props.taskIds) {
      await taskStore.updateTask(taskId, { priority: 'high' }) // BUG-1051: AWAIT to ensure persistence
    }
    emit('applied')
    emit('close')
  } else if (action === 'deleteAll') {
    // Confirm before deleting
    if (confirm(`Delete ${props.taskIds.length} selected tasks? This cannot be undone.`)) {
      props.taskIds.forEach(taskId => {
        taskStore.deleteTask(taskId)
      })
      emit('applied')
      emit('close')
    }
  }
}

// Apply changes
const applyChanges = async () => {
  if (!hasChanges.value) return

  for (const taskId of props.taskIds) {
    const updates: Partial<Task> = {}

    if (fieldChanges.value.status.enabled && fieldChanges.value.status.value) {
      updates.status = fieldChanges.value.status.value
    }

    if (fieldChanges.value.priority.enabled && fieldChanges.value.priority.value) {
      updates.priority = fieldChanges.value.priority.value
    }

    if (fieldChanges.value.projectId.enabled && fieldChanges.value.projectId.value) {
      updates.projectId = fieldChanges.value.projectId.value
    }

    if (fieldChanges.value.dueDate.enabled && fieldChanges.value.dueDate.value) {
      updates.dueDate = fieldChanges.value.dueDate.value
    }

    if (fieldChanges.value.estimatedDuration.enabled && fieldChanges.value.estimatedDuration.value) {
      updates.estimatedDuration = fieldChanges.value.estimatedDuration.value
    }

    if (Object.keys(updates).length > 0) {
      await taskStore.updateTask(taskId, updates) // BUG-1051: AWAIT to ensure persistence
    }
  }

  emit('applied')
  emit('close')
}

// Keyboard handler for Enter/Escape
const handleKeydown = (event: KeyboardEvent) => {
  // Escape - close modal
  if (event.key === 'Escape') {
    emit('close')
    return
  }

  // Enter - apply (if valid)
  if (event.key === 'Enter') {
    // Don't submit if in textarea or contenteditable
    if (isTextAreaOrContentEditable(event.target)) return

    // Don't submit with Shift+Enter
    if (event.shiftKey) return

    // Submit if there are changes
    if (hasChanges.value) {
      event.preventDefault()
      applyChanges()
    }
  }
}

// Reset form when modal closes
watch(() => props.isOpen, (isOpen) => {
  if (!isOpen) {
    // Reset all fields
    fieldChanges.value = {
      status: { enabled: false, value: null },
      priority: { enabled: false, value: null },
      projectId: { enabled: false, value: null },
      dueDate: { enabled: false, value: null },
      estimatedDuration: { enabled: false, value: null }
    }
    showPreview.value = true
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-backdrop-bg);
  backdrop-filter: blur(12px) saturate(100%);
  -webkit-backdrop-filter: blur(12px) saturate(100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-popover);
  padding: var(--space-4);
  animation: fadeIn var(--duration-normal) var(--spring-smooth);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  /* Standardized overlay styling */
  background: var(--overlay-component-bg);
  backdrop-filter: var(--overlay-component-backdrop);
  -webkit-backdrop-filter: var(--overlay-component-backdrop);
  border: var(--overlay-component-border);
  border-radius: var(--radius-2xl);
  box-shadow: var(--overlay-component-shadow);
  width: 90%;
  max-width: 650px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: slideUp var(--duration-normal) var(--spring-bounce);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--border-subtle);
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.count-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-lg);
  color: var(--brand-primary);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  width: fit-content;
}

.modal-title {
  color: var(--text-primary);
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  margin: 0;
  text-shadow: 0 2px 4px var(--shadow-subtle);
}

.close-btn {
  background: transparent;
  border: 1px solid var(--glass-border-hover);
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  transition: all var(--duration-normal) var(--spring-smooth);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.close-btn:hover {
  background: var(--glass-bg-tint);
  border-color: var(--border-interactive);
  color: var(--text-primary);
  transform: scale(1.05);
}

.close-btn:focus-visible {
  outline: none;
  border-color: var(--brand-primary-alpha-50);
  box-shadow: var(--focus-ring);
}

.modal-body {
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  overflow-y: auto;
  flex: 1;
}

.section-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--space-3);
}

/* Quick Actions */
.quick-actions-section {
  background: var(--glass-bg-light);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  padding: var(--space-5);
}

.quick-actions-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}

.quick-action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--glass-bg-tint);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-bounce);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.quick-action-btn:hover {
  background: var(--glass-bg-heavy);
  border-color: var(--glass-border-hover);
  transform: translateY(-2px);
}

.quick-action-btn.status-done {
  color: var(--color-success);
}

.quick-action-btn.status-done:hover {
  background: var(--status-done-bg);
  border-color: var(--status-done-border);
}

.quick-action-btn.priority-high {
  color: var(--color-warning);
}

.quick-action-btn.priority-high:hover {
  background: var(--priority-high-bg);
  border-color: var(--priority-high-border);
}

.quick-action-btn.danger {
  color: var(--color-danger);
}

.quick-action-btn.danger:hover {
  background: var(--color-danger-bg-light);
  border-color: var(--color-danger-border);
}

/* Field Selectors */
.field-selectors-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.field-selector {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--glass-bg-light);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.field-selector:has(input[type="checkbox"]:checked) {
  background: var(--glass-bg-medium);
  border-color: var(--brand-primary);
}

.field-checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.field-checkbox input[type="checkbox"] {
  width: var(--space-4_5);
  height: var(--space-4_5);
  cursor: pointer;
  accent-color: var(--brand-primary);
}

.checkbox-label {
  user-select: none;
}

.field-input-wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding-inline-start: calc(var(--space-4_5) + var(--space-3)); /* RTL: field input indentation */
  animation: slideDown var(--duration-fast) var(--spring-smooth);
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.field-input,
.field-select {
  flex: 1;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.field-input:focus,
.field-select:focus {
  outline: none;
  border-color: var(--brand-primary);
  background: var(--glass-bg-heavy);
}

.input-unit {
  font-size: var(--text-sm);
  color: var(--text-muted);
  font-weight: var(--font-medium);
}

/* Preview Section */
.preview-section {
  background: var(--glass-bg-light);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  padding: var(--space-5);
}

.section-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-3);
  transition: color var(--duration-fast);
}

.section-toggle:hover {
  color: var(--text-secondary);
}

.chevron-icon {
  transition: transform var(--duration-normal) var(--spring-smooth);
}

.chevron-icon.rotated {
  transform: rotate(180deg);
}

.preview-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-height: 300px;
  overflow-y: auto;
}

.preview-item {
  padding: var(--space-4);
  background: var(--glass-bg-tint);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
}

.task-name {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.changes-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.change-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.field-name {
  font-weight: var(--font-medium);
  min-width: var(--space-18);
}

.old-value {
  color: var(--text-muted);
  text-decoration: line-through;
  opacity: 0.7;
}

.arrow {
  color: var(--brand-primary);
}

.new-value {
  color: var(--brand-primary);
  font-weight: var(--font-semibold);
}

/* Footer */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-6);
  border-top: 1px solid var(--border-subtle);
}

.cancel-btn {
  background: transparent;
  border: 1px solid var(--glass-border-hover);
  color: var(--text-secondary);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.cancel-btn:hover {
  background: var(--glass-bg-soft);
  border-color: var(--border-interactive);
  color: var(--text-primary);
}

.apply-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: transparent;
  border: 1px solid var(--brand-primary);
  color: var(--brand-primary);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  transition: all var(--duration-normal) var(--spring-bounce);
  box-shadow: 0 0 0 1px var(--brand-primary) inset;
}

.apply-btn:hover:not(:disabled) {
  background: var(--brand-primary);
  color: var(--bg-primary);
  transform: translateY(-1px);
}

.apply-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
</style>
