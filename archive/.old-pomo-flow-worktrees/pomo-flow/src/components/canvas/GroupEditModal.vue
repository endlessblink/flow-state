<template>
  <BaseModal
    :is-open="isVisible"
    title="Edit Group"
    size="md"
    :show-footer="false"
    @close="close"
  >
    <!-- Modal Body Content -->
    <div class="form-group">
      <label for="group-name" class="form-label">Group Name</label>
      <input
        id="group-name"
        v-model="formData.name"
        type="text"
        class="form-input"
        placeholder="Enter group name"
        @keyup.enter="save"
      />
    </div>

    <div class="form-group">
      <label for="group-color" class="form-label">Group Color</label>
      <div class="color-picker-wrapper">
        <input
          id="group-color"
          v-model="formData.color"
          type="color"
          class="color-input"
        />
        <input
          v-model="formData.color"
          type="text"
          class="color-text-input"
          placeholder="#000000"
          @keyup.enter="save"
        />
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
          @click="formData.layout = layout.value"
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
        />
        Start Collapsed
      </label>
    </div>

    <div class="form-group">
      <label class="form-label">
        <input
          v-model="formData.isVisible"
          type="checkbox"
          class="checkbox"
        />
        Visible
      </label>
    </div>

    <!-- Custom Footer -->
    <template #footer>
      <div class="modal-actions">
        <BaseButton
          variant="secondary"
          @click="close"
        >
          Cancel
        </BaseButton>
        <BaseButton
          variant="primary"
          @click="save"
          :disabled="!formData.name.trim()"
        >
          Save Changes
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import { LayoutGrid, LayoutList, Rows } from 'lucide-vue-next'
import type { CanvasSection } from '@/stores/canvas'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue'

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
    formData.layout = newSection.layout || 'grid'
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
</script>

<style scoped>
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
  background: var(--surface-primary);
  color: var(--text-primary);
  font-size: var(--text-sm);
  transition: all var(--duration-fast);
}

.form-input:focus {
  outline: none;
  border-color: var(--glass-border-active);
  box-shadow: 0 0 0 2px var(--glass-border-subtle);
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
  background: var(--surface-primary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.layout-btn:hover {
  background: var(--glass-bg-light);
  border-color: var(--glass-border-hover);
}

.layout-btn.active {
  background: var(--purple-bg-subtle);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.checkbox {
  margin-inline-end: var(--space-2); /* RTL: checkbox spacing */
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}
</style>
