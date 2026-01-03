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
            <Settings :size="18" />
            Group Settings
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
          <!-- Section Name (read-only, for context) -->
          <div class="section-info">
            <span class="section-name">{{ section?.name }}</span>
            <span v-if="detectedKeyword" class="keyword-badge">
              <Zap :size="12" />
              {{ detectedKeyword.displayName }}
            </span>
          </div>

          <!-- Auto-assign on drop settings -->
          <div class="settings-section">
            <h3 class="settings-title">
              <Zap :size="16" />
              Auto-assign when task dropped
            </h3>
            <p class="settings-hint">
              Tasks dropped into this group will have these properties set
            </p>

            <div class="form-group">
              <label class="form-label">Priority</label>
              <CustomSelect
                :model-value="localSettings.priority || ''"
                :options="priorityOptions"
                placeholder="Select priority..."
                @update:model-value="(val) => localSettings.priority = val === '' ? null : (val as AssignOnDropSettings['priority'])"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Status</label>
              <CustomSelect
                :model-value="localSettings.status || ''"
                :options="statusOptions"
                placeholder="Select status..."
                @update:model-value="(val) => localSettings.status = val === '' ? null : (val as AssignOnDropSettings['status'])"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Due Date</label>
              <CustomSelect
                :model-value="localSettings.dueDate || ''"
                :options="dueDateOptions"
                placeholder="Select due date..."
                @update:model-value="(val) => localSettings.dueDate = val === '' ? null : (val as AssignOnDropSettings['dueDate'])"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Project</label>
              <CustomSelect
                :model-value="localSettings.projectId || ''"
                :options="projectOptions"
                placeholder="Select project..."
                @update:model-value="(val) => localSettings.projectId = val === '' ? null : String(val)"
              />
            </div>
          </div>

          <!-- Settings Preview -->
          <div v-if="settingsPreview" class="settings-preview">
            <span class="preview-label">Preview:</span>
            <span class="preview-text">{{ settingsPreview }}</span>
          </div>

          <!-- Reset button -->
          <div class="reset-section">
            <button
              v-if="detectedKeyword"
              class="btn btn-ghost"
              @click="resetToAutoFill"
            >
              <RefreshCw :size="14" />
              Reset to auto-detected
            </button>
            <button
              class="btn btn-ghost"
              @click="clearAllSettings"
            >
              <Trash2 :size="14" />
              Clear all settings
            </button>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="close">
            Cancel
          </button>
          <button class="btn btn-primary" @click="save">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { X, Settings, Zap, RefreshCw, Trash2 } from 'lucide-vue-next'
import { useTaskStore } from '@/stores/tasks'
import { detectPowerKeyword, type PowerKeywordResult } from '@/composables/useTaskSmartGroups'
import { useGroupSettings, getSettingsDescription } from '@/composables/useGroupSettings'
import type { CanvasSection, AssignOnDropSettings } from '@/stores/canvas'
import CustomSelect from '@/components/common/CustomSelect.vue'

// Priority options for CustomSelect
const priorityOptions = [
  { label: "Don't change", value: '' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' }
]

// Status options for CustomSelect
const statusOptions = [
  { label: "Don't change", value: '' },
  { label: 'Planned', value: 'planned' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Done', value: 'done' },
  { label: 'Backlog', value: 'backlog' },
  { label: 'On Hold', value: 'on_hold' }
]

// Due Date options for CustomSelect
const dueDateOptions = [
  { label: "Don't change", value: '' },
  { label: 'Today', value: 'today' },
  { label: 'Tomorrow', value: 'tomorrow' },
  { label: 'This Week', value: 'this_week' },
  { label: 'This Weekend', value: 'this_weekend' },
  { label: 'Later (no specific date)', value: 'later' }
]

interface Props {
  section: CanvasSection | null
  isVisible: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  save: [settings: { assignOnDrop: AssignOnDropSettings }]
}>()

const taskStore = useTaskStore()
const { getAutoFilledSettings } = useGroupSettings()

// Local settings state
const localSettings = reactive<AssignOnDropSettings>({
  priority: null,
  status: null,
  dueDate: null,
  projectId: null
})

// Detected keyword from section name
const detectedKeyword = ref<PowerKeywordResult | null>(null)

// Get projects for dropdown
const projects = computed(() => taskStore.projects || [])

// Project options for CustomSelect
const projectOptions = computed(() => [
  { label: "Don't change", value: '' },
  ...projects.value.map(project => ({
    label: project.name,
    value: project.id
  }))
])

// Settings preview text
const settingsPreview = computed(() => {
  return getSettingsDescription(localSettings)
})

// Reset form to default values
const resetForm = () => {
  localSettings.priority = null
  localSettings.status = null
  localSettings.dueDate = null
  localSettings.projectId = null
}

// Reset to auto-detected settings
const resetToAutoFill = () => {
  if (props.section) {
    const autoSettings = getAutoFilledSettings(props.section.name)
    localSettings.priority = autoSettings.priority || null
    localSettings.status = autoSettings.status || null
    localSettings.dueDate = autoSettings.dueDate || null
    localSettings.projectId = autoSettings.projectId || null
  }
}

// Clear all settings
const clearAllSettings = () => {
  resetForm()
}

const close = () => {
  emit('close')
}

const save = () => {
  // Filter out null values for cleaner storage
  const assignOnDrop: AssignOnDropSettings = {}
  if (localSettings.priority) assignOnDrop.priority = localSettings.priority
  if (localSettings.status) assignOnDrop.status = localSettings.status
  if (localSettings.dueDate) assignOnDrop.dueDate = localSettings.dueDate
  if (localSettings.projectId) assignOnDrop.projectId = localSettings.projectId

  emit('save', { assignOnDrop })
}

// Watch for section changes and load its settings
watch(() => props.section, (newSection) => {
  if (newSection) {
    // Detect keyword from name
    detectedKeyword.value = detectPowerKeyword(newSection.name)

    // Load existing settings or auto-fill
    if (newSection.assignOnDrop) {
      localSettings.priority = newSection.assignOnDrop.priority || null
      localSettings.status = newSection.assignOnDrop.status || null
      localSettings.dueDate = newSection.assignOnDrop.dueDate || null
      localSettings.projectId = newSection.assignOnDrop.projectId || null
    } else {
      // Auto-fill from keyword detection
      resetToAutoFill()
    }
  } else {
    resetForm()
    detectedKeyword.value = null
  }
}, { immediate: true })

// Reset when modal closes
watch(() => props.isVisible, (visible) => {
  if (!visible) {
    resetForm()
    detectedKeyword.value = null
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.modal-content {
  background: var(--surface-primary);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  max-width: 480px;
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
  transition: all var(--duration-fast);
}

.close-btn:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
}

.modal-body {
  padding: var(--space-5);
}

.section-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--glass-bg-light);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-5);
}

.section-name {
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.keyword-badge {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: var(--yellow-bg-subtle);
  color: var(--yellow-text);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.settings-section {
  margin-bottom: var(--space-5);
}

.settings-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-2) 0;
}

.settings-hint {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: 0 0 var(--space-4) 0;
}

.form-group {
  margin-bottom: var(--space-4);
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

.form-select {
  width: 100%;
  padding: var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--surface-primary);
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.form-select:focus {
  outline: none;
  border-color: var(--glass-border-active);
  box-shadow: 0 0 0 2px var(--glass-border-subtle);
}

.settings-preview {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--purple-bg-subtle);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
}

.preview-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--brand-primary);
}

.preview-text {
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.reset-section {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.modal-footer {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
  padding: var(--space-5);
  border-top: 1px solid var(--glass-border);
}

.btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
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

.btn-ghost {
  background: transparent;
  border-color: transparent;
  color: var(--text-muted);
  padding: var(--space-2) var(--space-3);
}

.btn-ghost:hover:not(:disabled) {
  background: var(--glass-bg-light);
  color: var(--text-primary);
}

.btn-secondary {
  background: var(--glass-bg-light);
  border-color: var(--glass-border);
  color: var(--text-primary);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-hover);
}

.btn-primary {
  background: transparent;
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.btn-primary:hover:not(:disabled) {
  background: rgba(78, 205, 196, 0.1);
  border-color: var(--brand-primary);
}
</style>
