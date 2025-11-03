<template>
  <BaseModal
    :is-open="isOpen"
    title="Batch Edit"
    size="lg"
    :show-footer="false"
    @close="$emit('close')"
  >
    <!-- Custom Header with Count Badge -->
    <template #header>
      <div class="header-left">
        <div class="count-badge">
          <CheckSquare :size="16" :stroke-width="2" />
          <span>Editing {{ taskIds.length }} tasks</span>
        </div>
        <h2 class="modal-title">Batch Edit</h2>
      </div>
    </template>

    <!-- Modal Body Content -->
    <!-- Quick Actions -->
    <section class="quick-actions-section">
      <div class="section-label">Quick Actions</div>
      <div class="quick-actions-grid">
        <button
          class="quick-action-btn status-done"
          @click="applyQuickAction('markDone')"
          title="Mark all selected tasks as done"
        >
          <CheckCircle :size="18" :stroke-width="2" />
          <span>Mark as Done</span>
        </button>
        <button
          class="quick-action-btn priority-high"
          @click="applyQuickAction('highPriority')"
          title="Set all to high priority"
        >
          <Zap :size="18" :stroke-width="2" />
          <span>High Priority</span>
        </button>
        <button
          class="quick-action-btn danger"
          @click="applyQuickAction('deleteAll')"
          title="Delete all selected tasks"
        >
          <Trash2 :size="18" :stroke-width="2" />
          <span>Delete All</span>
        </button>
      </div>
    </section>

    <!-- Field Selectors -->
    <section class="field-selectors-section">
      <div class="section-label">Select Fields to Change</div>

      <!-- Status Field -->
      <div class="field-selector">
        <label class="field-checkbox">
          <input
            type="checkbox"
            v-model="fieldChanges.status.enabled"
          />
          <span class="checkbox-label">Change Status</span>
        </label>
        <div v-if="fieldChanges.status.enabled" class="field-input-wrapper">
          <select v-model="fieldChanges.status.value" class="field-select">
            <option value="planned">Planned</option>
            <option value="in_progress">Active</option>
            <option value="done">✓</option>
            <option value="backlog">Backlog</option>
            <option value="on_hold">On Hold</option>
          </select>
        </div>
      </div>

      <!-- Priority Field -->
      <div class="field-selector">
        <label class="field-checkbox">
          <input
            type="checkbox"
            v-model="fieldChanges.priority.enabled"
          />
          <span class="checkbox-label">Change Priority</span>
        </label>
        <div v-if="fieldChanges.priority.enabled" class="field-input-wrapper">
          <select v-model="fieldChanges.priority.value" class="field-select">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>

      <!-- Project Field -->
      <div class="field-selector">
        <label class="field-checkbox">
          <input
            type="checkbox"
            v-model="fieldChanges.projectId.enabled"
          />
          <span class="checkbox-label">Move to Project</span>
        </label>
        <div v-if="fieldChanges.projectId.enabled" class="field-input-wrapper">
          <select v-model="fieldChanges.projectId.value" class="field-select">
            <option
              v-for="project in taskStore.projects"
              :key="project.id"
              :value="project.id"
            >
              {{ project.emoji || '•' }} {{ project.name }}
            </option>
          </select>
        </div>
      </div>

      <!-- Due Date Field -->
      <div class="field-selector">
        <label class="field-checkbox">
          <input
            type="checkbox"
            v-model="fieldChanges.dueDate.enabled"
          />
          <span class="checkbox-label">Set Due Date</span>
        </label>
        <div v-if="fieldChanges.dueDate.enabled" class="field-input-wrapper">
          <input
            type="date"
            v-model="fieldChanges.dueDate.value"
            class="field-input"
          />
        </div>
      </div>

      <!-- Estimated Duration Field -->
      <div class="field-selector">
        <label class="field-checkbox">
          <input
            type="checkbox"
            v-model="fieldChanges.estimatedDuration.enabled"
          />
          <span class="checkbox-label">Set Duration</span>
        </label>
        <div v-if="fieldChanges.estimatedDuration.enabled" class="field-input-wrapper">
          <input
            type="number"
            v-model.number="fieldChanges.estimatedDuration.value"
            min="15"
            step="15"
            class="field-input"
            placeholder="60"
          />
          <span class="input-unit">minutes</span>
        </div>
      </div>
    </section>

    <!-- Preview Section -->
    <section v-if="hasChanges" class="preview-section">
      <button @click="showPreview = !showPreview" class="section-toggle" type="button">
        <ChevronDown :size="14" :class="['chevron-icon', { rotated: showPreview }]" />
        <span class="section-label">Preview Changes</span>
      </button>

      <div v-show="showPreview" class="preview-list">
        <div
          v-for="task in selectedTasks"
          :key="task.id"
          class="preview-item"
        >
          <div class="task-name">{{ task.title }}</div>
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

    <!-- Custom Footer -->
    <template #footer>
      <div class="modal-actions">
        <BaseButton
          variant="secondary"
          @click="$emit('close')"
        >
          Cancel
        </BaseButton>
        <BaseButton
          variant="primary"
          :disabled="!hasChanges"
          @click="applyChanges"
        >
          <Zap :size="16" :stroke-width="2" />
          Apply to {{ taskIds.length }} Tasks
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import type { Task } from '@/stores/tasks'
import {
  CheckSquare, CheckCircle, Zap, Trash2, ChevronDown
} from 'lucide-vue-next'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue'

interface Props {
  isOpen: boolean
  taskIds: string[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  applied: []
}>()

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

const getProjectName = (projectId: string | null) => {
  if (!projectId) return 'Unknown'
  const project = taskStore.projects.find(p => p.id === projectId)
  return project?.name || 'Unknown'
}

// Quick actions
const applyQuickAction = (action: 'markDone' | 'highPriority' | 'deleteAll') => {
  if (action === 'markDone') {
    // Mark all as done
    props.taskIds.forEach(taskId => {
      taskStore.updateTask(taskId, { status: 'done' })
    })
    emit('applied')
    emit('close')
  } else if (action === 'highPriority') {
    // Set all to high priority
    props.taskIds.forEach(taskId => {
      taskStore.updateTask(taskId, { priority: 'high' })
    })
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
const applyChanges = () => {
  if (!hasChanges.value) return

  props.taskIds.forEach(taskId => {
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
      taskStore.updateTask(taskId, updates)
    }
  })

  emit('applied')
  emit('close')
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
  background: linear-gradient(
    135deg,
    var(--purple-gradient-start) 0%,
    var(--purple-gradient-end) 100%
  );
  border: 1px solid var(--purple-border-medium);
  border-radius: var(--radius-lg);
  color: white;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  box-shadow: 0 4px 8px var(--purple-shadow-strong);
  width: fit-content;
}

.modal-title {
  color: var(--text-primary);
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  margin: 0;
  text-shadow: 0 2px 4px var(--shadow-subtle);
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
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: var(--space-5);
  margin-bottom: var(--space-6);
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
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-bounce);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.quick-action-btn:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-medium);
  transform: translateY(-2px);
  box-shadow: 0 8px 16px var(--shadow-lg);
}

.quick-action-btn.status-done {
  color: var(--green-600);
}

.quick-action-btn.status-done:hover {
  background: var(--green-50);
  border-color: var(--green-200);
}

.quick-action-btn.priority-high {
  color: var(--yellow-600);
}

.quick-action-btn.priority-high:hover {
  background: var(--yellow-50);
  border-color: var(--yellow-200);
}

.quick-action-btn.danger {
  color: var(--red-600);
}

.quick-action-btn.danger:hover {
  background: var(--red-50);
  border-color: var(--red-200);
}

/* Field Selectors */
.field-selectors-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.field-selector {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.field-selector:has(input[type="checkbox"]:checked) {
  background: var(--glass-bg-light);
  border-color: var(--purple-border-subtle);
  box-shadow: 0 0 0 2px var(--purple-glow-subtle);
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
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--purple-border-medium);
}

.checkbox-label {
  user-select: none;
}

.field-input-wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding-inline-start: calc(18px + var(--space-3)); /* RTL: field input indentation */
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
  background: var(--glass-bg-medium);
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
  border-color: var(--purple-border-medium);
  background: var(--glass-bg-heavy);
  box-shadow: 0 0 0 3px var(--purple-glow-subtle);
}

.input-unit {
  font-size: var(--text-sm);
  color: var(--text-muted);
  font-weight: var(--font-medium);
}

/* Preview Section */
.preview-section {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
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
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
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
  min-width: 70px;
}

.old-value {
  color: var(--text-muted);
  text-decoration: line-through;
  opacity: 0.7;
}

.arrow {
  color: var(--purple-border-medium);
}

.new-value {
  color: var(--purple-border-active);
  font-weight: var(--font-semibold);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}
</style>
