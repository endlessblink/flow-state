<template>
  <div v-if="isOpen" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2 class="modal-title">
          {{ isEditing ? 'Edit Group' : 'Create Custom Group' }}
        </h2>
        <button class="close-btn" @click="$emit('close')">
          <X :size="16" :stroke-width="1.5" />
        </button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Group Name</label>
          <BaseInput
            ref="nameInput"
            v-model="groupData.name"
            placeholder="Enter group name..."
          />
        </div>

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
import { ref, watch, nextTick, computed } from 'vue'
import { useCanvasStore, type CanvasSection } from '@/stores/canvas'
import { X } from 'lucide-vue-next'
import BaseInput from '@/components/base/BaseInput.vue'

interface Props {
  isOpen: boolean
  group?: CanvasSection | null
  position?: { x: number; y: number }
}

const props = withDefaults(defineProps<Props>(), {
  group: null,
  position: () => ({ x: 100, y: 100 })
})

const emit = defineEmits<{
  close: []
  created: [group: CanvasSection]
  updated: [group: CanvasSection]
}>()

// Try to get canvas store, fallback to mock for Storybook environment
// Try to get canvas store, fallback to mock for Storybook environment
let canvasStore: ReturnType<typeof useCanvasStore> | { 
  sections: CanvasSection[], 
  createSection: (section: Omit<CanvasSection, 'id'>) => CanvasSection, 
  updateSection: (id: string, updates: Partial<CanvasSection>) => void 
}
try {
  canvasStore = useCanvasStore()
} catch (error) {
  console.warn('🔧 GroupModal: Canvas store not available, using mock for Storybook', error)
  // Mock canvas store for Storybook environment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  canvasStore = {
    sections: [],
    createSection: (section: Record<string, unknown>) => {
      const newSection = {
        ...section,
        id: `section-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      }
      console.log('🔧 Storybook Canvas Store: Created section', newSection)
      return newSection
    },
    updateSection: (id: string, updates: Record<string, unknown>) => {
      console.log('🔧 Storybook Canvas Store: Updated section', id, updates)
    }
  } as any // Storybook mock doesn't need full type compliance
}
const nameInput = ref()

const isEditing = computed(() => !!props.group)

const groupData = ref({
  name: '',
  color: '#3b82f6'
})

const customColor = ref('#3b82f6')

// Color presets for quick selection
const colorPresets = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
  '#64748b', // slate
  '#475569', // zinc
  '#71717a', // neutral
]

const selectColor = (color: string) => {
  groupData.value.color = color
  customColor.value = color
}

const handleCustomColorInput = () => {
  // Validate hex color input
  const hexColor = customColor.value.trim()
  if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hexColor)) {
    groupData.value.color = hexColor
  }
}

const handleColorPickerChange = () => {
  groupData.value.color = customColor.value
}

const saveGroup = () => {
  if (!groupData.value.name.trim()) return

  if (isEditing.value && props.group) {
    // Update existing group
    canvasStore.updateSection(props.group.id, {
      name: groupData.value.name.trim(),
      color: groupData.value.color
    })

    const updatedGroup = canvasStore.sections.find((s: { id: string }) => s.id === props.group!.id)
    if (updatedGroup) {
      emit('updated', updatedGroup)
    }
  } else {
    // Create new group at specified position
    const newGroup = canvasStore.createSection({
      name: groupData.value.name.trim(),
      type: 'custom',
      position: {
        x: props.position.x,
        y: props.position.y,
        width: 300,
        height: 200
      },
      color: groupData.value.color,
      layout: 'grid',
      isVisible: true,
      isCollapsed: false
    })

    emit('created', newGroup)
  }

  emit('close')
}

// Watch for group changes (editing mode)
watch(() => props.group, (newGroup) => {
  if (newGroup) {
    groupData.value = {
      name: newGroup.name,
      color: newGroup.color
    }
    customColor.value = newGroup.color
  } else {
    // Reset for new group creation
    groupData.value = {
      name: '',
      color: '#3b82f6'
    }
    customColor.value = '#3b82f6'
  }
}, { immediate: true })

// Focus input when modal opens
watch(() => props.isOpen, async (isOpen) => {
  console.log('🔧 GroupModal: isOpen prop changed to:', isOpen)
  console.log('🔧 GroupModal: props.isOpen =', props.isOpen)

  if (isOpen) {
    console.log('🔧 GroupModal: Modal is opening, focusing input')
    await nextTick()
    nameInput.value?.focus()
    console.log('🔧 GroupModal: Modal should now be visible')
  } else {
    console.log('🔧 GroupModal: Modal is closing')
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(12px) saturate(100%);
  animation: fadeIn var(--duration-normal) var(--spring-smooth);
}

.modal-content {
  background: rgba(0, 0, 0, 0.95);
  backdrop-filter: blur(20px) saturate(100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-xl);
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
  width: 90%;
  max-width: 480px;
  animation: slideUp var(--duration-normal) var(--spring-smooth);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.modal-title {
  color: var(--text-primary);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  margin: 0;
}

.close-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  transition: all var(--duration-fast);
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
  color: var(--text-primary);
}

.modal-body {
  padding: var(--space-6);
}

.form-group {
  margin-bottom: var(--space-6);
}

.form-label {
  display: block;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  margin-bottom: var(--space-3);
}

.color-presets {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: var(--space-2);
  margin-bottom: var(--space-4);
  padding: var(--space-3);
  background: rgba(255, 255, 255, 0.02);
  border-radius: var(--radius-lg);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.color-preset {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  border: 2px solid transparent;
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  position: relative;
}

.color-preset:hover {
  transform: scale(1.1);
  border-color: rgba(255, 255, 255, 0.3);
}

.color-preset.active {
  border-color: white;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1);
  transform: scale(1.1);
}

.color-preset.active::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 14px;
  font-weight: bold;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

.custom-color-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: rgba(255, 255, 255, 0.02);
  border-radius: var(--radius-lg);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.custom-color-input {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.color-label {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

.color-input-wrapper {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.color-text-input {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-family: var(--font-mono);
  transition: all var(--duration-fast);
}

.color-text-input:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.05);
}

.color-picker-input {
  width: 40px;
  height: 36px;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  background: transparent;
}

.color-preview {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: rgba(0, 0, 0, 0.4);
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.preview-box {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.color-value {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-weight: var(--font-medium);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-6) var(--space-6);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.btn-primary {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  transition: all var(--duration-fast);
}

.btn-primary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: var(--text-secondary);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  transition: all var(--duration-fast);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
  color: var(--text-primary);
}
</style>