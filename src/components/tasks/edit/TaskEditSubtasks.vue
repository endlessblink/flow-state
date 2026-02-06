<template>
  <section class="form-section collapsible">
    <div class="section-toggle-wrapper">
      <button class="section-toggle" type="button" @click="isExpanded = !isExpanded">
        <component
          :is="ChevronDown"
          :size="16"
          class="chevron-icon"
          :class="{ 'rotated': !isExpanded }"
        />
        Subtasks
        <span v-if="subtasks.length > 0" class="count-badge">
          {{ completedCount }}/{{ subtasks.length }}
        </span>
      </button>

      <button
        v-if="isExpanded"
        class="inline-add-btn"
        type="button"
        title="Add subtask"
        @click="$emit('add')"
      >
        <Plus :size="14" />
      </button>
    </div>

    <!-- Progress bar -->
    <div v-if="isExpanded && subtasks.length > 0" class="progress-bar-container">
      <div class="progress-bar-track">
        <div
          class="progress-bar-fill"
          :style="{ width: progressPercent + '%' }"
        />
      </div>
    </div>

    <div v-show="isExpanded" class="section-content">
      <div v-if="subtasks.length === 0" class="empty-subtasks">
        <component :is="CheckCircle2" :size="32" class="empty-icon" />
        <span class="empty-message">No subtasks yet</span>
        <button class="add-first-subtask" type="button" @click="$emit('add')">
          <Plus :size="16" />
          Add your first subtask
        </button>
      </div>

      <div v-else class="subtasks-list">
        <div
          v-for="subtask in subtasks"
          :key="subtask.id"
          class="subtask-item"
          :class="{ 'completed': subtask.isCompleted }"
        >
          <!-- Status indicator stripe -->
          <div class="status-stripe" :class="{ 'completed': subtask.isCompleted }" />

          <!-- Custom checkbox -->
          <button
            class="custom-checkbox"
            :class="{ 'checked': subtask.isCompleted }"
            type="button"
            @click="subtask.isCompleted = !subtask.isCompleted; $emit('update', subtask)"
          >
            <component
              :is="Check"
              :size="14"
              class="check-icon"
            />
          </button>

          <div class="subtask-content">
            <div class="subtask-header">
              <input
                v-model="subtask.title"
                class="subtask-title-input"
                :class="[getAlignmentClasses(subtask.title), { 'completed': subtask.isCompleted }]"
                :style="applyInputAlignment(subtask.title)"
                placeholder="Subtask title"
                @focus="focusedSubtaskId = subtask.id"
                @blur="focusedSubtaskId = null"
                @keydown.enter.prevent="$emit('add')"
              >
              <button
                class="delete-subtask-btn"
                type="button"
                @click="$emit('delete', subtask.id)"
              >
                <X :size="16" />
              </button>
            </div>

            <!-- Description shown only when focused or has content -->
            <textarea
              v-show="focusedSubtaskId === subtask.id || subtask.description?.trim()"
              v-model="subtask.description"
              class="subtask-desc-input"
              :class="[getAlignmentClasses(subtask.description)]"
              :style="applyInputAlignment(subtask.description)"
              rows="2"
              placeholder="Add description..."
              @focus="focusedSubtaskId = subtask.id"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ChevronDown, Plus, X, Check, CheckCircle2 } from 'lucide-vue-next'
import { type Subtask } from '@/stores/tasks'
import { useHebrewAlignment } from '@/composables/useHebrewAlignment'

const props = defineProps<{
  subtasks: Subtask[]
}>()

defineEmits<{
  (e: 'add'): void
  (e: 'delete', id: string): void
  (e: 'update', subtask: Subtask): void
}>()

const isExpanded = ref(true)
const focusedSubtaskId = ref<string | null>(null)

const completedCount = computed(() =>
  props.subtasks.filter(s => s.isCompleted).length
)

const progressPercent = computed(() => {
  if (props.subtasks.length === 0) return 0
  return (completedCount.value / props.subtasks.length) * 100
})

// Hebrew Alignment
const { getAlignmentClasses, applyInputAlignment } = useHebrewAlignment()
</script>

<style scoped>
.collapsible {
  border-radius: var(--radius-lg);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.section-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  background: transparent;
  border: none;
  padding: var(--space-2) 0;
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.section-toggle:hover {
  color: var(--text-secondary);
}

.section-toggle-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.chevron-icon {
  transition: transform var(--duration-normal) var(--spring-smooth);
  color: var(--text-muted);
}
.chevron-icon.rotated {
  transform: rotate(-90deg);
}

.count-badge {
  font-size: var(--text-xs);
  background: var(--glass-bg-weak);
  padding: var(--space-0_5) var(--space-2);
  border-radius: var(--radius-full);
  color: var(--text-tertiary);
  margin-left: var(--space-1);
  font-weight: var(--font-medium);
}

.inline-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
}

.inline-add-btn:hover {
  background: var(--glass-bg-base);
  color: var(--brand-primary);
  border-color: var(--glass-border-hover);
  transform: scale(1.05);
}

/* Progress Bar */
.progress-bar-container {
  margin-bottom: var(--space-4);
  animation: slideDown var(--duration-normal) var(--spring-smooth);
}

.progress-bar-track {
  height: 4px;
  background: var(--glass-bg-soft);
  border-radius: var(--radius-full);
  overflow: hidden;
  position: relative;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--brand-primary), var(--brand-hover));
  border-radius: var(--radius-full);
  transition: width var(--duration-slow) var(--spring-smooth);
  box-shadow: 0 0 8px var(--brand-primary);
}

.section-content {
  animation: slideDown var(--duration-normal) var(--spring-smooth);
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Empty State */
.empty-subtasks {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-8) var(--space-4);
  background: var(--glass-bg-subtle);
  border-radius: var(--radius-lg);
  border: 1px dashed var(--glass-border);
}

.empty-icon {
  color: var(--text-tertiary);
  opacity: 0.5;
}

.empty-message {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  font-weight: var(--font-medium);
}

.add-first-subtask {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2_5) var(--space-4);
  background: var(--glass-bg-base);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
}

.add-first-subtask:hover {
  background: var(--glass-bg-soft);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

/* Subtask List */
.subtasks-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.subtask-item {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--glass-bg-subtle);
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
  transition: all var(--duration-fast) var(--spring-smooth);
  position: relative;
  overflow: hidden;
}

.subtask-item:hover {
  background: var(--glass-bg-base);
  border-color: var(--glass-border-hover);
  transform: translateX(2px);
}

.subtask-item.completed {
  background: var(--glass-bg-weak);
  opacity: 0.7;
}

/* Status Stripe */
.status-stripe {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--glass-border);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.status-stripe.completed {
  background: linear-gradient(180deg, var(--brand-primary), var(--brand-hover));
  box-shadow: 0 0 8px var(--brand-primary);
}

/* Custom Checkbox */
.custom-checkbox {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: var(--radius-sm);
  border: 2px solid var(--glass-border-medium);
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-fast) var(--spring-smooth);
  margin-top: var(--space-0_5);
}

.custom-checkbox:hover {
  border-color: var(--brand-primary);
  background: var(--glass-bg-tint);
}

.custom-checkbox .check-icon {
  opacity: 0;
  transform: scale(0);
  transition: all var(--duration-fast) var(--spring-bounce);
  color: var(--text-primary);
}

.custom-checkbox.checked {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
  box-shadow: 0 0 12px rgba(78, 205, 196, 0.4);
}

.custom-checkbox.checked .check-icon {
  opacity: 1;
  transform: scale(1);
}

/* Subtask Content */
.subtask-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.subtask-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.subtask-title-input {
  flex: 1;
  background: transparent;
  border: none;
  font-size: var(--text-sm);
  color: var(--text-primary);
  padding: 0;
  font-weight: var(--font-medium);
  transition: color var(--duration-fast);
}

.subtask-title-input:focus {
  outline: none;
  color: var(--text-primary);
}

.subtask-title-input.completed {
  text-decoration: line-through;
  color: var(--text-tertiary);
}

.subtask-title-input::placeholder {
  color: var(--text-subtle);
}

.subtask-desc-input {
  background: var(--glass-bg-weak);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  padding: var(--space-2);
  resize: vertical;
  min-height: 40px;
  transition: all var(--duration-fast);
  animation: slideDown var(--duration-fast) var(--spring-smooth);
}

.subtask-desc-input:focus {
  outline: none;
  background: var(--glass-bg-tint);
  border-color: var(--glass-border-hover);
  color: var(--text-secondary);
}

.subtask-desc-input::placeholder {
  color: var(--text-subtle);
}

.delete-subtask-btn {
  opacity: 0;
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  transition: all var(--duration-fast);
  display: flex;
  align-items: center;
  justify-content: center;
}

.subtask-item:hover .delete-subtask-btn {
  opacity: 1;
}

.delete-subtask-btn:hover {
  background: var(--danger-bg-subtle);
  color: var(--danger-text);
  transform: scale(1.1);
}

/* Animations */
@keyframes checkPop {
  0% { transform: scale(0); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
</style>
