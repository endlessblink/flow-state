<template>
  <BaseModal
    :is-open="isOpen"
    title="Create New Task"
    description="Enter a title for your new task"
    size="sm"
    :show-footer="false"
    :close-on-overlay-click="true"
    :close-on-escape="true"
    @close="$emit('cancel')"
    @after-open="handleAfterOpen"
  >
    <!-- Task Title Input -->
    <div class="task-form">
      <div class="form-group">
        <label for="task-title-input" class="form-label">Task Title</label>
        <input
          id="task-title-input"
          ref="titleInput"
          v-model="taskTitle"
          class="form-input"
          :class="[titleAlignmentClasses]"
          :style="titleAlignmentStyles"
          type="text"
          placeholder="Enter task title..."
          maxlength="200"
          @keydown.enter="handleCreateTask"
          @keydown.esc="$emit('cancel')"
        >
        <div class="input-help">
          {{ taskTitle.length }}/200 characters
        </div>
      </div>

      <!-- Optional Description -->
      <div class="form-group">
        <label for="task-description-input" class="form-label">Description (Optional)</label>
        <textarea
          id="task-description-input"
          v-model="taskDescription"
          class="form-textarea"
          :class="[descriptionAlignmentClasses]"
          :style="descriptionAlignmentStyles"
          rows="3"
          placeholder="Add a description..."
          maxlength="500"
        />
        <div class="input-help">
          {{ taskDescription.length }}/500 characters
        </div>
      </div>
    </div>

    <!-- Actions -->
    <template #footer>
      <div class="modal-actions">
        <BaseButton
          variant="secondary"
          @click="$emit('cancel')"
        >
          Cancel
        </BaseButton>
        <BaseButton
          variant="primary"
          :disabled="!taskTitle.trim()"
          :loading="loading"
          @click="handleCreateTask"
        >
          Create Task
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import { useHebrewAlignment } from '@/composables/useHebrewAlignment'

interface Props {
  isOpen: boolean
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

const emit = defineEmits<{
  cancel: []
  create: [title: string, description: string]
}>()

// Template refs
const titleInput = ref<HTMLInputElement>()

// Form state
const taskTitle = ref('')
const taskDescription = ref('')

// Hebrew alignment
const { getAlignmentClasses, applyInputAlignment } = useHebrewAlignment()

// Computed properties for Hebrew text alignment
const titleAlignmentClasses = computed(() => getAlignmentClasses(taskTitle.value))
const titleAlignmentStyles = computed(() => applyInputAlignment(taskTitle.value))
const descriptionAlignmentClasses = computed(() => getAlignmentClasses(taskDescription.value))
const descriptionAlignmentStyles = computed(() => applyInputAlignment(taskDescription.value))

// Handle after open to focus the title input
const handleAfterOpen = () => {
  nextTick(() => {
    // Focus the title input for immediate typing
    titleInput.value?.focus()
    // Select all text so user can immediately type
    titleInput.value?.select()
  })
}

// Handle task creation
const handleCreateTask = () => {
  const trimmedTitle = taskTitle.value.trim()
  if (!trimmedTitle) return

  emit('create', trimmedTitle, taskDescription.value.trim())

  // Reset form
  taskTitle.value = ''
  taskDescription.value = ''
}
</script>

<style scoped>
.task-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-label {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.form-input,
.form-textarea {
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: inset var(--shadow-sm);
  font-family: inherit;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--calendar-creating-border);
  background: linear-gradient(
    135deg,
    var(--glass-bg-heavy) 0%,
    var(--glass-bg-tint) 100%
  );
  box-shadow:
    0 0 0 3px var(--calendar-creating-bg),
    inset var(--shadow-sm);
}

.form-input::placeholder,
.form-textarea::placeholder {
  color: var(--text-muted);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
  line-height: var(--leading-relaxed);
}

.input-help {
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-align: right;
  margin-top: var(--space-1);
}

.modal-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
}

/* Responsive Design */
@media (max-width: 768px) {
  .modal-actions {
    flex-direction: column;
    gap: var(--space-2);
  }

  .modal-actions :deep(.base-button) {
    width: 100%;
  }
}
</style>