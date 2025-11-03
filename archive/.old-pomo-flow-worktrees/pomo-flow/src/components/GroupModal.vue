<template>
  <BaseModal
    :is-open="isOpen"
    :title="isEditing ? 'Edit Group' : 'Create Custom Group'"
    size="md"
    :show-footer="false"
    @close="$emit('close')"
  >
    <!-- Modal Body Content -->
    <div class="form-group">
      <label class="form-label">Group Name</label>
      <BaseInput
        v-model="groupData.name"
        placeholder="Enter group name..."
        ref="nameInput"
      />
    </div>

    <div class="form-group">
      <label class="form-label">Group Color</label>

      <!-- Color Presets -->
      <div class="color-presets">
        <button
          v-for="color in colorPresets"
          :key="color"
          :class="['color-preset', { active: groupData.color === color }]"
          :style="{ backgroundColor: color }"
          @click="selectColor(color)"
          type="button"
          :title="`Select ${color}`"
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
            />
            <input
              v-model="customColor"
              type="color"
              class="color-picker-input"
              @input="handleColorPickerChange"
            />
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
          @click="saveGroup"
          :disabled="!groupData.name.trim()"
        >
          {{ isEditing ? 'Save Changes' : 'Create Group' }}
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { useCanvasStore, type CanvasSection } from '@/stores/canvas'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseInput from '@/components/base/BaseInput.vue'

interface Props {
  isOpen: boolean
  group?: CanvasSection | null
  position?: { x: number; y: number }
}

const props = withDefaults(defineProps<Props>(), {
  position: () => ({ x: 100, y: 100 })
})

const emit = defineEmits<{
  close: []
  created: [group: CanvasSection]
  updated: [group: CanvasSection]
}>()

const canvasStore = useCanvasStore()
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

    const updatedGroup = canvasStore.sections.find(s => s.id === props.group!.id)
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
  background: var(--glass-bg-soft);
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
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
  border-color: var(--glass-border-medium);
}

.color-preset.active {
  border-color: var(--text-primary);
  box-shadow: 0 0 0 2px var(--glass-bg-light);
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
  background: var(--glass-bg-soft);
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
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
  background: var(--surface-primary);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-family: var(--font-mono);
  transition: all var(--duration-fast);
}

.color-text-input:focus {
  outline: none;
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand-primary) 15%, transparent);
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
  background: var(--surface-primary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-medium);
}

.preview-box {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-secondary);
}

.color-value {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-weight: var(--font-medium);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}
</style>
