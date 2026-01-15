<template>
  <Teleport to="body">
    <div
      v-if="isVisible"
      class="modal-overlay"
      @click="close"
    >
      <div
        class="modal-content"
        @click.stop
      >
        <div class="modal-header">
          <h2 class="modal-title">
            Edit Group
          </h2>
          <button
            class="close-btn"
            aria-label="Close modal"
            @click="close"
          >
            <X :size="18" />
          </button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label for="group-name" class="form-label">Group Name</label>
            <input
              id="group-name"
              v-model="formData.name"
              type="text"
              class="form-input"
              placeholder="Enter group name"
              @keydown.enter.prevent="save"
            >
          </div>

          <div class="form-group">
            <label for="group-color" class="form-label">Group Color</label>
            <div class="color-picker-wrapper">
              <input
                id="group-color"
                v-model="formData.color"
                type="color"
                class="color-input"
              >
              <input
                v-model="formData.color"
                type="text"
                class="color-text-input"
                placeholder="#000000"
                @keydown.enter.prevent="save"
              >
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Layout</label>
            <div class="layout-options">
              <button
                v-for="layout in layoutOptions"
                :key="layout.value"
                class="layout-btn"
                :class="{ active: formData.layout === layout.value }"
                @click="formData.layout = layout.value as 'grid' | 'vertical' | 'horizontal'"
              >
                <component :is="layout.icon" :size="16" />
                <span>{{ layout.label }}</span>
              </button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">
              <input
                v-model="formData.isCollapsed"
                type="checkbox"
                class="checkbox"
              >
              Start Collapsed
            </label>
          </div>

          <div class="form-group">
            <label class="form-label">
              <input
                v-model="formData.isVisible"
                type="checkbox"
                class="checkbox"
              >
              Visible
            </label>
          </div>
        </div>

        <div class="modal-footer">
          <button
            class="btn btn-secondary"
            @click="close"
          >
            Cancel
          </button>
          <button
            class="btn btn-primary"
            :disabled="!formData.name.trim()"
            @click="save"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import { X, LayoutGrid, LayoutList, Rows } from 'lucide-vue-next'
import type { CanvasSection } from '@/stores/canvas'

interface Props {
  section: CanvasSection | null
  isVisible: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  save: [section: CanvasSection]
}>()

const formData = reactive({
  name: '',
  color: '#6366f1',
  layout: 'grid' as 'grid' | 'vertical' | 'horizontal',
  isCollapsed: false,
  isVisible: true
})

const layoutOptions = [
  { value: 'grid', label: 'Grid', icon: LayoutGrid },
  { value: 'vertical', label: 'Vertical', icon: LayoutList },
  { value: 'horizontal', label: 'Horizontal', icon: Rows }
]

const resetForm = () => {
  formData.name = ''
  formData.color = '#6366f1'
  formData.layout = 'grid'
  formData.isCollapsed = false
  formData.isVisible = true
}

const close = () => {
  emit('close')
}

const save = () => {
  if (!formData.name.trim()) return
  if (!props.section) return

  const updatedSection: CanvasSection = {
    ...props.section,
    name: formData.name.trim(),
    color: formData.color,
    layout: formData.layout,
    isCollapsed: formData.isCollapsed,
    isVisible: formData.isVisible
  }

  emit('save', updatedSection)
}

// Watch for section changes and update form
watch(() => props.section, (newSection) => {
  if (newSection) {
    formData.name = newSection.name || ''
    formData.color = newSection.color || '#6366f1'
    formData.layout = (newSection.layout || 'grid') as 'grid' | 'vertical' | 'horizontal'
    formData.isCollapsed = newSection.isCollapsed || false
    formData.isVisible = newSection.isVisible !== false
  } else {
    resetForm()
  }
}, { immediate: true })

// Watch for visibility changes
watch(() => props.isVisible, (visible) => {
  if (!visible) {
    resetForm()
  }
})

// Global Enter key handler for the modal
const handleKeydown = (e: KeyboardEvent) => {
  if (props.isVisible && e.key === 'Enter') {
    e.preventDefault()
    save()
  }
}

import { onMounted, onUnmounted } from 'vue'

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0; /* RTL: full screen overlay */
  background: var(--overlay-heavy);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.modal-content {
  background: var(--glass-bg-solid);
  backdrop-filter: blur(20px) saturate(100%);
  -webkit-backdrop-filter: blur(20px) saturate(100%);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-dark-xl);
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow: auto;
  animation: modalSlideIn 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(-8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-6);
  border-bottom: 1px solid var(--glass-border);
}

.modal-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.close-btn {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  transition: all var(--duration-fast);
}

.close-btn:hover {
  background: transparent;
  border-color: var(--glass-border);
  color: var(--text-primary);
}

.modal-body {
  padding: var(--space-6);
}

.form-group {
  margin-bottom: var(--space-5);
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.form-input {
  width: 100%;
  padding: var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-bg-solid);
  color: var(--text-primary);
  font-size: var(--text-sm);
  transition: all var(--duration-fast);
}

.form-input:focus {
  outline: none;
  border-color: var(--glass-border-hover);
  box-shadow: none;
}

.color-picker-wrapper {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}

.color-input {
  width: 60px;
  height: 40px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  padding: var(--space-1);
}

.color-text-input {
  flex: 1;
}

.layout-options {
  display: flex;
  gap: var(--space-3);
}

.layout-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-bg-solid);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.layout-btn:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.layout-btn.active {
  background: transparent;
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.checkbox {
  margin-inline-end: var(--space-2); /* RTL: checkbox spacing */
}

.modal-footer {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
  padding: var(--space-6);
  border-top: 1px solid var(--glass-border);
}

.btn {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
  border: 1px solid;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: transparent;
  border-color: var(--glass-border);
  color: var(--text-secondary);
}

.btn-secondary:hover:not(:disabled) {
  background: transparent;
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.btn-primary {
  background: transparent;
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.btn-primary:hover:not(:disabled) {
  background: transparent;
  border-color: var(--brand-hover);
  color: var(--brand-hover);
}
</style>