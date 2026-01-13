<template>
  <div v-if="isOpen" class="modal-overlay" @click="$emit('close')" @keydown="handleKeydown">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title">
            <Group :size="18" />
            {{ isEditing ? 'Edit Group' : 'Create Group' }}
          </h2>
          <button class="close-btn" aria-label="Close modal" @click="$emit('close')">
            <X :size="16" :stroke-width="1.5" />
          </button>
        </div>

        <div class="modal-body">
          <!-- Required: Name -->
          <div class="form-group">
            <label class="form-label">Group Name *</label>
            <BaseInput
              ref="nameInput"
              v-model="groupData.name"
              placeholder="Enter group name..."
              @input="handleNameInput"
            />
            <p v-if="detectedKeyword" class="keyword-hint">
              <Zap :size="12" />
              Detected: {{ detectedKeyword.displayName }}
            </p>
          </div>

          <!-- Required: Color -->
          <div class="form-group">
            <label class="form-label">Group Color</label>

            <!-- Color Presets -->
            <div class="color-presets">
              <button
                v-for="color in colorPresets"
                :key="color"
                class="color-preset"
                :class="[{ active: groupData.color === color }]"
                :style="{ backgroundColor: color }"
                type="button"
                :title="`Select ${color}`"
                @click="selectColor(color)"
              />
            </div>

            <!-- Custom Color Input -->
            <div class="custom-color-section">
              <div class="custom-color-input">
                <label class="color-label">Custom Color</label>
                <div class="color-input-wrapper">
                  <input
                    v-model="customColor"
                    type="text"
                    placeholder="#3b82f6"
                    class="color-text-input"
                    @input="handleCustomColorInput"
                  >
                  <input
                    v-model="customColor"
                    type="color"
                    class="color-picker-input"
                    @input="handleColorPickerChange"
                  >
                </div>
              </div>

              <!-- Color Preview -->
              <div class="color-preview">
                <div
                  class="preview-box"
                  :style="{ backgroundColor: groupData.color }"
                />
                <span class="color-value">{{ groupData.color }}</span>
              </div>
            </div>
          </div>

          <!-- Collapsible: Smart Settings -->
          <section class="smart-settings-section">
            <button
              type="button"
              class="section-toggle"
              @click="showSmartSettings = !showSmartSettings"
            >
              <ChevronDown
                :size="14"
                class="chevron-icon"
                :class="[{ rotated: showSmartSettings }]"
              />
              <span class="section-title">
                <Zap :size="14" />
                Smart Settings
              </span>
              <span v-if="hasSmartSettings" class="settings-badge">Configured</span>
            </button>

            <div v-show="showSmartSettings" class="section-content">
              <p class="settings-hint">
                Tasks dropped into this group will have these properties set automatically
              </p>

              <!-- Priority -->
              <div class="form-group compact">
                <label class="form-label">Priority</label>
                <CustomSelect
                  :model-value="smartSettings.priority || ''"
                  :options="priorityOptions"
                  placeholder="Select priority..."
                  @update:model-value="(val) => smartSettings.priority = val === '' ? null : (val as 'high' | 'medium' | 'low')"
                />
              </div>

              <!-- Status -->
              <div class="form-group compact">
                <label class="form-label">Status</label>
                <CustomSelect
                  :model-value="smartSettings.status || ''"
                  :options="statusOptions"
                  placeholder="Select status..."
                  @update:model-value="(val) => smartSettings.status = val === '' ? null : (val as 'planned' | 'in_progress' | 'done' | 'backlog' | 'on_hold')"
                />
              </div>

              <!-- Due Date -->
              <div class="form-group compact">
                <label class="form-label">Due Date</label>
                <CustomSelect
                  :model-value="smartSettings.dueDate || ''"
                  :options="dueDateOptions"
                  placeholder="Select due date..."
                  @update:model-value="(val) => smartSettings.dueDate = val === '' ? null : (val as 'today' | 'tomorrow' | 'this_week' | 'this_weekend' | 'later')"
                />
              </div>
              <!-- Project -->
              <div class="form-group compact">
                <label class="form-label">Project</label>
                <CustomSelect
                  :model-value="smartSettings.projectId || ''"
                  :options="projectOptions"
                  placeholder="Select project..."
                  @update:model-value="(val) => smartSettings.projectId = val === '' ? null : String(val)"
                />
              </div>

              <!-- Duration -->
              <div class="form-group compact">
                <label class="form-label">Duration</label>
                <CustomSelect
                  :model-value="smartSettings.estimatedDuration === null ? '' : String(smartSettings.estimatedDuration)"
                  :options="durationOptions"
                  placeholder="Select duration..."
                  @update:model-value="(val) => smartSettings.estimatedDuration = val === '' ? null : Number(val)"
                />
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
                  type="button"
                  class="btn btn-ghost"
                  @click="resetToAutoFill"
                >
                  <RefreshCw :size="14" />
                  Reset to auto-detected
                </button>
                <button
                  type="button"
                  class="btn btn-ghost"
                  @click="clearSmartSettings"
                >
                  <Trash2 :size="14" />
                  Clear all
                </button>
              </div>
            </div>
          </section>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="$emit('close')">
            Cancel
          </button>
          <button
            class="btn btn-primary"
            :disabled="!groupData.name.trim()"
            @click="saveGroup"
          >
            {{ isEditing ? 'Save Changes' : 'Create Group' }}
          </button>
        </div>
      </div>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, nextTick, computed } from 'vue'
import { X, Group, Zap, ChevronDown, RefreshCw, Trash2 } from 'lucide-vue-next'
import { useCanvasStore, type CanvasGroup, type AssignOnDropSettings } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import { getUndoSystem } from '@/composables/undoSingleton'
import { detectPowerKeyword, type PowerKeywordResult } from '@/composables/useTaskSmartGroups'
import { getSettingsDescription } from '@/composables/useGroupSettings'
import BaseInput from '@/components/base/BaseInput.vue'
import CustomSelect from '@/components/common/CustomSelect.vue'

const props = withDefaults(defineProps<Props>(), {
  group: null,
  position: () => ({ x: 100, y: 100 })
})

const emit = defineEmits<{
  close: []
  created: [group: CanvasGroup]
  updated: [group: CanvasGroup]
}>()

// Options for smart settings CustomSelect components
const priorityOptions = [
  { label: "Don't change", value: '' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' }
]

const statusOptions = [
  { label: "Don't change", value: '' },
  { label: 'Planned', value: 'planned' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Done', value: 'done' },
  { label: 'Backlog', value: 'backlog' },
  { label: 'On Hold', value: 'on_hold' }
]

const dueDateOptions = [
  { label: "Don't change", value: '' },
  { label: 'Today', value: 'today' },
  { label: 'Tomorrow', value: 'tomorrow' },
  { label: 'This Week', value: 'this_week' },
  { label: 'This Weekend', value: 'this_weekend' },
  { label: 'Later (no specific date)', value: 'later' }
]

const durationOptions = [
  { label: "Don't change", value: '' },
  { label: 'Quick (<15m)', value: '15' },
  { label: 'Short (15-30m)', value: '30' },
  { label: 'Medium (30-60m)', value: '60' },
  { label: 'Long (>60m)', value: '120' },
  { label: 'Unestimated', value: '-1' }
]

// Project options computed - needs to be defined after taskStore is available
// This will be a computed property that references taskStore.projects

interface Props {
  isOpen: boolean
  group?: CanvasGroup | null
  position?: { x: number; y: number }
}

// Stores
const canvasStore = useCanvasStore()
const taskStore = useTaskStore()

// Refs
const nameInput = ref()
const showSmartSettings = ref(false)
const detectedKeyword = ref<PowerKeywordResult | null>(null)

// Form data
const groupData = ref({
  name: '',
  color: '#6366f1'
})

const smartSettings = reactive<AssignOnDropSettings>({
  priority: null,
  status: null,
  dueDate: null,
  projectId: null,
  estimatedDuration: null
})

const customColor = ref('#6366f1')

// Computed
const isEditing = computed(() => !!props.group)

const projects = computed(() => taskStore.projects || [])

// Project options for CustomSelect
const projectOptions = computed(() => [
  { label: "Don't change", value: '' },
  ...projects.value.map(p => ({
    label: p.name,
    value: p.id
  }))
])

const hasSmartSettings = computed(() => {
  return smartSettings.priority || smartSettings.status || smartSettings.dueDate || smartSettings.projectId || smartSettings.estimatedDuration !== null
})

const settingsPreview = computed(() => {
  return getSettingsDescription(smartSettings)
})

// Color presets
const colorPresets = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#64748b', '#475569', '#71717a'
]

// Keyboard handler for Enter/Escape
const handleKeydown = (event: KeyboardEvent) => {
  // Escape - close modal
  if (event.key === 'Escape') {
    emit('close')
    return
  }

  // Enter - save (if valid)
  if (event.key === 'Enter') {
    // Don't submit if in dropdown or other interactive element
    const target = event.target as HTMLElement
    if (target.tagName === 'SELECT' || target.closest('.n-dropdown')) return

    // Don't submit with Shift+Enter
    if (event.shiftKey) return

    // Submit if name is valid
    if (groupData.value.name.trim()) {
      event.preventDefault()
      saveGroup()
    }
  }
}

// Methods
const selectColor = (color: string) => {
  groupData.value.color = color
  customColor.value = color
}

const handleCustomColorInput = () => {
  const hexColor = customColor.value.trim()
  if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hexColor)) {
    groupData.value.color = hexColor
  }
}

const handleColorPickerChange = () => {
  groupData.value.color = customColor.value
}

const handleNameInput = () => {
  // Detect power keywords and auto-fill smart settings
  const keyword = detectPowerKeyword(groupData.value.name)
  detectedKeyword.value = keyword

  if (keyword) {
    // Auto-expand smart settings when keyword detected
    showSmartSettings.value = true

    // Auto-fill based on keyword category
    switch (keyword.category) {
      case 'date':
        smartSettings.dueDate = keyword.value as AssignOnDropSettings['dueDate']
        break
      case 'priority':
        smartSettings.priority = keyword.value as 'high' | 'medium' | 'low'
        break
      case 'status':
        smartSettings.status = keyword.value as AssignOnDropSettings['status']
        break
      case 'duration':
        if (keyword.value === 'quick') smartSettings.estimatedDuration = 15
        else if (keyword.value === 'short') smartSettings.estimatedDuration = 30
        else if (keyword.value === 'medium') smartSettings.estimatedDuration = 60
        else if (keyword.value === 'long') smartSettings.estimatedDuration = 120
        else if (keyword.value === 'unestimated') smartSettings.estimatedDuration = -1 // Use -1 as internal sentinel for unestimated in modal
        break
    }
  }
}

const resetToAutoFill = () => {
  if (detectedKeyword.value) {
    clearSmartSettings()
    handleNameInput()
  }
}

const clearSmartSettings = () => {
  smartSettings.priority = null
  smartSettings.status = null
  smartSettings.dueDate = null
  smartSettings.projectId = null
  smartSettings.estimatedDuration = null
}

const inferGroupType = (): CanvasGroup['type'] => {
  // Infer type from smart settings
  const settingsCount = [
    smartSettings.priority,
    smartSettings.status,
    smartSettings.dueDate,
    smartSettings.projectId,
    smartSettings.estimatedDuration !== null
  ].filter(Boolean).length

  if (settingsCount === 0) return 'custom'
  if (settingsCount > 1) return 'custom' // Multiple settings = custom combination

  if (smartSettings.priority) return 'priority'
  if (smartSettings.status) return 'status'
  if (smartSettings.dueDate) return 'timeline'
  if (smartSettings.projectId) return 'project'
  if (smartSettings.estimatedDuration !== null) return 'custom' // Or create a 'duration' type if preferred

  return 'custom'
}

const saveGroup = async () => {
  if (!groupData.value.name.trim()) return

  // Build assignOnDrop settings (only non-null values)
  const assignOnDrop: AssignOnDropSettings = {}
  if (smartSettings.priority) assignOnDrop.priority = smartSettings.priority
  if (smartSettings.status) assignOnDrop.status = smartSettings.status
  if (smartSettings.dueDate) assignOnDrop.dueDate = smartSettings.dueDate
  if (smartSettings.projectId) assignOnDrop.projectId = smartSettings.projectId
  if (smartSettings.estimatedDuration !== null) {
    assignOnDrop.estimatedDuration = smartSettings.estimatedDuration === -1 ? null : smartSettings.estimatedDuration
  }

  // BUG-008 FIX: Use undo-enabled methods for proper Ctrl+Z support
  const undoSystem = getUndoSystem()

  if (isEditing.value && props.group) {
    // Update existing group with undo support
    await undoSystem.updateGroupWithUndo(props.group.id, {
      name: groupData.value.name.trim(),
      color: groupData.value.color,
      type: inferGroupType(),
      assignOnDrop: Object.keys(assignOnDrop).length > 0 ? assignOnDrop : undefined
    })

    const updatedGroup = canvasStore.groups.find(g => g.id === props.group!.id)
    if (updatedGroup) {
      emit('updated', updatedGroup)
    }
  } else {
    // BUG-153 FIX: Detect if creating group inside another group
    // Find the smallest containing group (for proper nesting)
    let parentGroupId: string | undefined = undefined
    let finalPosition = { x: props.position.x, y: props.position.y }

    // BUG-153 DEBUG: Log position and all groups for containment check
    console.log(`[BUG-153 DEBUG] Checking containment for new group at:`, {
      clickPosition: { x: props.position.x, y: props.position.y },
      existingGroups: canvasStore.groups.map(g => ({
        name: g.name,
        id: g.id.substring(0, 10),
        bounds: {
          x: g.position?.x ?? 0,
          y: g.position?.y ?? 0,
          w: g.position?.width ?? 300,
          h: g.position?.height ?? 200
        }
      }))
    })

    // Check all existing groups to see if creation position is inside any
    const containingGroups = canvasStore.groups.filter(group => {
      const gx = group.position?.x ?? 0
      const gy = group.position?.y ?? 0
      const gw = group.position?.width ?? 300
      const gh = group.position?.height ?? 200
      const isInside = props.position.x >= gx && props.position.x <= gx + gw &&
                       props.position.y >= gy && props.position.y <= gy + gh
      console.log(`[BUG-153 DEBUG] "${group.name}": click (${props.position.x.toFixed(0)}, ${props.position.y.toFixed(0)}) vs bounds (${gx.toFixed(0)}-${(gx+gw).toFixed(0)}, ${gy.toFixed(0)}-${(gy+gh).toFixed(0)}) → ${isInside ? 'INSIDE' : 'outside'}`)
      return isInside
    })

    if (containingGroups.length > 0) {
      // Sort by area (smallest first) to get the most nested/specific container
      containingGroups.sort((a, b) => {
        const areaA = (a.position?.width ?? 300) * (a.position?.height ?? 200)
        const areaB = (b.position?.width ?? 300) * (b.position?.height ?? 200)
        return areaA - areaB
      })

      const parentGroup = containingGroups[0]
      parentGroupId = parentGroup.id

      // Convert absolute position to relative (relative to parent's top-left)
      const parentX = parentGroup.position?.x ?? 0
      const parentY = parentGroup.position?.y ?? 0
      finalPosition = {
        x: props.position.x - parentX,
        y: props.position.y - parentY
      }

      console.log(`[BUG-153] Creating nested group inside "${parentGroup.name}" (${parentGroupId})`, {
        absolutePos: { x: props.position.x, y: props.position.y },
        relativePos: finalPosition
      })
    }

    // Create new group with undo support
    const newGroup = await undoSystem.createGroupWithUndo({
      name: groupData.value.name.trim(),
      type: inferGroupType(),
      position: {
        x: finalPosition.x,
        y: finalPosition.y,
        width: 300,
        height: 200
      },
      color: groupData.value.color,
      layout: 'grid',
      isVisible: true,
      isCollapsed: false,
      parentGroupId, // BUG-153: Set parent for nested groups
      assignOnDrop: Object.keys(assignOnDrop).length > 0 ? assignOnDrop : undefined
    })

    emit('created', newGroup)
  }

  emit('close')
}

// Reset form
const resetForm = () => {
  groupData.value = {
    name: '',
    color: '#6366f1'
  }
  customColor.value = '#6366f1'
  clearSmartSettings()
  showSmartSettings.value = false
  detectedKeyword.value = null
}

// Watch for group changes (editing mode)
watch(() => props.group, (newGroup) => {
  if (newGroup) {
    groupData.value = {
      name: newGroup.name,
      color: newGroup.color
    }
    customColor.value = newGroup.color

    // Load existing smart settings
    if (newGroup.assignOnDrop) {
      smartSettings.priority = newGroup.assignOnDrop.priority || null
      smartSettings.status = newGroup.assignOnDrop.status || null
      smartSettings.dueDate = newGroup.assignOnDrop.dueDate || null
      smartSettings.projectId = newGroup.assignOnDrop.projectId || null
      // Load duration, mapping null (unestimated) to -1 for the dropdown sentinel
      if (newGroup.assignOnDrop.estimatedDuration === null) {
        smartSettings.estimatedDuration = -1
      } else {
        smartSettings.estimatedDuration = newGroup.assignOnDrop.estimatedDuration || null
      }

      // Show smart settings if any are configured
      if (Object.keys(newGroup.assignOnDrop).length > 0) {
        showSmartSettings.value = true
      }
    } else {
      clearSmartSettings()
    }

    // Detect keyword from existing name
    detectedKeyword.value = detectPowerKeyword(newGroup.name)
  } else {
    resetForm()
  }
}, { immediate: true })

// Focus input when modal opens
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    await nextTick()
    nameInput.value?.focus()
  } else {
    resetForm()
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(20px) saturate(100%);
  -webkit-backdrop-filter: blur(20px) saturate(100%);
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
  max-width: 520px;
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

.form-group {
  margin-bottom: var(--space-5);
}

.form-group.compact {
  margin-bottom: var(--space-3);
}

.form-label {
  display: block;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.keyword-hint {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin-top: var(--space-2);
  padding: var(--space-2);
  background: var(--yellow-bg-subtle);
  color: var(--yellow-text);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

/* Color presets */
.color-presets {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  padding: var(--space-3);
  background: var(--glass-bg-light);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
}

.color-preset {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  border: 2px solid transparent;
  cursor: pointer;
  transition: all var(--duration-fast);
}

.color-preset:hover {
  transform: scale(1.1);
  border-color: var(--glass-border-medium);
}

.color-preset.active {
  border-color: var(--text-primary);
  box-shadow: 0 0 0 2px var(--glass-bg-light);
  transform: scale(1.1);
}

.custom-color-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--glass-bg-light);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
}

.custom-color-input {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.color-label {
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.color-input-wrapper {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.color-text-input {
  flex: 1;
  padding: var(--space-2);
  background: var(--surface-primary);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-family: var(--font-mono);
}

.color-text-input:focus {
  outline: none;
  border-color: var(--brand-primary);
}

.color-picker-input {
  width: 36px;
  height: 32px;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  background: transparent;
}

.color-preview {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.preview-box {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
}

.color-value {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* Smart Settings Section */
.smart-settings-section {
  margin-top: var(--space-4);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.section-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: var(--glass-bg-light);
  border: none;
  cursor: pointer;
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-fast);
}

.section-toggle:hover {
  background: var(--glass-bg-medium);
}

.chevron-icon {
  transition: transform var(--duration-fast);
  color: var(--text-muted);
}

.chevron-icon.rotated {
  transform: rotate(180deg);
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  text-align: left;
}

.settings-badge {
  padding: var(--space-1) var(--space-2);
  background: var(--brand-primary);
  color: white;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
}

.section-content {
  padding: var(--space-4);
  background: var(--surface-primary);
  border-top: 1px solid var(--glass-border);
}

.settings-hint {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: 0 0 var(--space-4) 0;
}

.form-select {
  width: 100%;
  padding: var(--space-2) var(--space-3);
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
  border-color: var(--brand-primary);
}

.settings-preview {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--purple-bg-subtle);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-md);
  margin-top: var(--space-3);
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
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-top: var(--space-3);
}

/* Modal Footer */
.modal-footer {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
  padding: var(--space-5);
  border-top: 1px solid var(--glass-border);
}

/* Buttons */
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
