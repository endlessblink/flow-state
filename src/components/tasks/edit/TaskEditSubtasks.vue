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
        <Plus :size="12" />
      </button>
    </div>

    <div v-show="isExpanded" class="section-content">
      <div v-if="subtasks.length === 0" class="empty-subtasks">
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
        >
          <div class="subtask-checkbox-wrapper">
            <input
              v-model="subtask.isCompleted"
              type="checkbox"
              class="subtask-checkbox"
              @change="$emit('update', subtask)"
            />
          </div>
          
          <div class="subtask-content">
            <div class="subtask-header">
              <input
                v-model="subtask.title"
                class="subtask-title-input"
                :class="[getAlignmentClasses(subtask.title), { 'completed': subtask.isCompleted }]"
                :style="applyInputAlignment(subtask.title)"
                placeholder="Subtask title"
                @keydown.enter.prevent="$emit('add')"
              />
              <button class="delete-subtask-btn" @click="$emit('delete', subtask.id)">
                <X :size="14" />
              </button>
            </div>
            
            <textarea
              v-model="subtask.description"
              class="subtask-desc-input"
              :class="[getAlignmentClasses(subtask.description)]"
              :style="applyInputAlignment(subtask.description)"
              rows="1"
              placeholder="Description (optional)..."
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ChevronDown, Plus, X } from 'lucide-vue-next'
import { type Subtask } from '@/stores/tasks'
import { useHebrewAlignment } from '@/composables/useHebrewAlignment'

const props = defineProps<{
  subtasks: Subtask[]
}>()

const emit = defineEmits<{
  (e: 'add'): void
  (e: 'delete', id: string): void
  (e: 'update', subtask: Subtask): void
}>()

const isExpanded = ref(true)

const completedCount = computed(() => 
  props.subtasks.filter(s => s.isCompleted).length
)

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
  margin-bottom: var(--space-2);
}

.chevron-icon {
  transition: transform var(--duration-normal) var(--spring-smooth);
  color: var(--text-muted);
}
.chevron-icon.rotated { transform: rotate(-90deg); }

.count-badge {
  font-size: 10px;
  background: var(--glass-bg-weak);
  padding: 1px 6px;
  border-radius: 10px;
  color: var(--text-tertiary);
  margin-left: 4px;
}

.inline-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.inline-add-btn:hover {
  background: var(--glass-bg-base);
  color: var(--text-primary);
}

.section-content {
  animation: slideDown var(--duration-normal) var(--spring-smooth);
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.empty-subtasks {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  align-items: center;
  padding: var(--space-4);
  background: var(--glass-bg-subtle);
  border-radius: var(--radius-md);
  border: 1px dashed var(--glass-border);
}

.empty-message {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.add-first-subtask {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-base);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.add-first-subtask:hover {
  background: var(--glass-bg-soft);
  border-color: var(--glass-border-hover);
}

.subtasks-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.subtask-item {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-2);
  background: var(--glass-bg-subtle);
  border-radius: var(--radius-md);
  transition: background-color var(--duration-fast);
}

.subtask-item:hover {
  background: var(--glass-bg-base);
}

.subtask-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
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
}

.subtask-title-input:focus { outline: none; }
.subtask-title-input.completed { 
  text-decoration: line-through; 
  color: var(--text-tertiary); 
}

.subtask-desc-input {
  background: transparent;
  border: none;
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  padding: 0;
  resize: vertical;
  min-height: 20px;
}
.subtask-desc-input:focus { outline: none; color: var(--text-secondary); }

.delete-subtask-btn {
  opacity: 0;
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
}

.subtask-item:hover .delete-subtask-btn { opacity: 1; }
.delete-subtask-btn:hover { background: var(--danger-bg-subtle); color: var(--danger-text); }
</style>
