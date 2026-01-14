<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="modal-overlay"
      @click="$emit('cancel')"
      @keydown="handleKeydown"
    >
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title">
            <Layout :size="18" />
            Move to Section
          </h2>
          <button class="close-btn" @click="$emit('cancel')">
            <X :size="16" />
          </button>
        </div>

        <div class="modal-body">
          <p class="section-hint">
            Select a section to place <strong>{{ task?.title }}</strong> on the canvas.
          </p>
          
          <div class="selector-container">
            <label class="form-label">Canvas Section</label>
            <SectionSelector 
              v-model="tempSectionId"
              placeholder="Choose a target section..."
            />
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="$emit('cancel')">
            Cancel
          </button>
          <button 
            class="btn btn-primary" 
            :disabled="!tempSectionId"
            @click="confirmMove"
          >
            Move Task
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { X, Layout } from 'lucide-vue-next'
import type { Task } from '@/stores/tasks'
import SectionSelector from './SectionSelector.vue'
import { isTextAreaOrContentEditable } from '@/utils/dom'

interface Props {
  isOpen: boolean
  task: Task | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'cancel': []
  'confirm': [sectionId: string]
}>()

const tempSectionId = ref<string | null>(null)

watch(() => props.isOpen, (val) => {
  if (val) {
    // Reset selection when opening
    tempSectionId.value = null
  }
})

const confirmMove = () => {
  if (tempSectionId.value) {
    emit('confirm', tempSectionId.value)
  }
}

// Keyboard handler for Enter/Escape
const handleKeydown = (event: KeyboardEvent) => {
  // Escape - close modal
  if (event.key === 'Escape') {
    emit('cancel')
    return
  }

  // Enter - confirm (if valid)
  if (event.key === 'Enter') {
    // Don't submit if in textarea or contenteditable
    if (isTextAreaOrContentEditable(event.target)) return

    // Don't submit with Shift+Enter
    if (event.shiftKey) return

    // Submit if selection is valid
    if (tempSectionId.value) {
      event.preventDefault()
      confirmMove()
    }
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.modal-content {
  background: var(--surface-primary);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-2xl);
  width: 90%;
  max-width: 400px;
  overflow: hidden;
  animation: modal-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modal-in {
  from { opacity: 0; transform: scale(0.95) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5);
  border-bottom: 1px solid var(--glass-border);
}

.modal-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
}

.modal-body {
  padding: var(--space-6);
}

.section-hint {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-bottom: var(--space-5);
}

.selector-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-label {
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  background: rgba(0, 0, 0, 0.1);
  border-top: 1px solid var(--glass-border);
}

.btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 8px 16px;
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid;
}

.btn-secondary {
  background: var(--glass-bg-light);
  border-color: var(--glass-border);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: var(--glass-bg-medium);
}

.btn-primary {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
  color: var(--bg-primary);
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
