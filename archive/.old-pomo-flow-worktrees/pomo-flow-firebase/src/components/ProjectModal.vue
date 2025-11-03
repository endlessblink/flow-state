<template>
  <div v-if="isOpen" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2 class="modal-title">{{ isEditing ? 'Edit Project' : 'Create Project' }}</h2>
        <button class="close-btn" @click="$emit('close')">
          <X :size="16" :stroke-width="1.5" />
        </button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Project Name</label>
          <BaseInput
            v-model="projectData.name"
            placeholder="Enter project name..."
            ref="nameInput"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Project Icon & Color</label>

          <!-- Current Selection Preview -->
          <div class="selection-preview">
            <div
              class="preview-badge"
              :style="{
                backgroundColor: projectData.colorType === 'hex' ? projectData.color : 'transparent'
              }"
            >
              <span v-if="projectData.colorType === 'emoji' && projectData.emoji" class="preview-emoji">
                {{ projectData.emoji }}
              </span>
            </div>
            <button
              class="change-icon-btn"
              @click="isEmojiPickerOpen = true"
              type="button"
            >
              {{ projectData.colorType === 'emoji' && projectData.emoji ? 'Change Icon' : 'Choose Icon or Color' }}
            </button>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="$emit('close')">
          Cancel
        </button>
        <button class="btn btn-primary" @click="saveProject">
          {{ isEditing ? 'Save Changes' : 'Create Project' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Emoji Picker Modal -->
  <EmojiPicker
    :is-open="isEmojiPickerOpen"
    :current-emoji="projectData.colorType === 'emoji' ? projectData.emoji : undefined"
    :current-color="projectData.colorType === 'hex' ? projectData.color : undefined"
    @close="isEmojiPickerOpen = false"
    @select="handleIconSelect"
  />
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import type { Project } from '@/stores/tasks'
import { X, Check } from 'lucide-vue-next'
import BaseInput from '@/components/base/BaseInput.vue'
import EmojiPicker from './EmojiPicker.vue'

interface Props {
  isOpen: boolean
  project?: Project | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  created: [project: Project]
  updated: [project: Project]
}>()

const taskStore = useTaskStore()
const nameInput = ref()
const isEmojiPickerOpen = ref(false)

const isEditing = computed(() => !!props.project)

const projectData = ref({
  name: '',
  color: '#3b82f6',
  colorType: 'hex' as 'hex' | 'emoji',
  emoji: undefined as string | undefined
})

const handleIconSelect = (data: { type: 'emoji' | 'color'; value: string }) => {
  if (data.type === 'emoji') {
    projectData.value.colorType = 'emoji'
    projectData.value.emoji = data.value
    projectData.value.color = '#3b82f6' // Default background for emoji
  } else {
    projectData.value.colorType = 'hex'
    projectData.value.color = data.value
    projectData.value.emoji = undefined
  }
  isEmojiPickerOpen.value = false
}

// Watch for project changes
watch(() => props.project, (newProject) => {
  if (newProject) {
    projectData.value = {
      name: newProject.name,
      color: typeof newProject.color === 'string' ? newProject.color : '#3b82f6',
      colorType: newProject.colorType || 'hex',
      emoji: newProject.emoji
    }
  } else {
    projectData.value = {
      name: '',
      color: '#3b82f6',
      colorType: 'hex',
      emoji: undefined
    }
  }
}, { immediate: true })

// Focus input when modal opens
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    await nextTick()
    nameInput.value?.focus()
  }
})

const saveProject = () => {
  if (!projectData.value.name.trim()) return

  if (isEditing.value && props.project) {
    // Update existing project using store method
    taskStore.updateProject(props.project.id, {
      name: projectData.value.name.trim(),
      color: projectData.value.color,
      colorType: projectData.value.colorType,
      emoji: projectData.value.emoji
    })

    const updatedProject = taskStore.getProjectById(props.project.id)
    if (updatedProject) {
      emit('updated', updatedProject)
    }
  } else {
    // Create new project
    const newProject = taskStore.createProject({
      name: projectData.value.name.trim(),
      color: projectData.value.color,
      colorType: projectData.value.colorType,
      emoji: projectData.value.emoji
    })

    emit('created', newProject)
  }

  emit('close')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(12px) saturate(150%);
  animation: fadeIn var(--duration-normal) var(--spring-smooth);
}

.modal-content {
  background: linear-gradient(
    135deg,
    var(--glass-bg-medium) 0%,
    var(--glass-bg-heavy) 100%
  );
  backdrop-filter: blur(32px) saturate(200%);
  border: 1px solid var(--glass-border-strong);
  border-radius: var(--radius-2xl);
  box-shadow:
    0 32px 64px var(--shadow-xl),
    0 16px 32px var(--shadow-strong),
    inset 0 2px 0 var(--glass-border-soft);
  width: 90%;
  max-width: 480px;
  animation: scaleIn var(--duration-normal) var(--spring-bounce);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-6) var(--space-6) var(--space-5);
  border-bottom: 1px solid var(--glass-bg-heavy);
  background: linear-gradient(
    180deg,
    var(--glass-bg-tint) 0%,
    transparent 100%
  );
}

.modal-title {
  color: var(--text-primary);
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  margin: 0;
  text-shadow: 0 2px 4px var(--shadow-subtle);
}

.close-btn {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  transition: all var(--duration-normal) var(--spring-smooth);
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: var(--glass-border);
  border-color: var(--glass-border-medium);
  color: var(--text-primary);
  transform: scale(1.05);
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

.selection-preview {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.selection-preview:hover {
  background: var(--glass-bg-light);
  border-color: var(--glass-border-medium);
}

.preview-badge {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 8px var(--shadow-md);
  border: 2px solid var(--glass-border);
  transition: all var(--duration-normal) var(--spring-bounce);
}

.preview-emoji {
  font-size: 32px;
  line-height: 1;
}

.change-icon-btn {
  flex: 1;
  padding: var(--space-3) var(--space-4);
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-bounce);
}

.change-icon-btn:hover {
  background: linear-gradient(
    135deg,
    var(--glass-border) 0%,
    var(--glass-bg-medium) 100%
  );
  border-color: var(--glass-border-medium);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: 0 6px 12px var(--shadow-lg);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-6) var(--space-6);
  border-top: 1px solid var(--glass-bg-heavy);
}

.btn-primary {
  background: linear-gradient(
    135deg,
    var(--purple-gradient-start) 0%,
    var(--purple-gradient-end) 100%
  );
  border: 1px solid var(--purple-border-medium);
  color: white;
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  transition: all var(--duration-normal) var(--spring-bounce);
  box-shadow:
    0 8px 16px var(--purple-border-medium),
    0 0 20px var(--purple-glow-subtle);
}

.btn-primary:hover {
  background: linear-gradient(
    135deg,
    var(--purple-gradient-hover-start) 0%,
    var(--purple-gradient-hover-end) 100%
  );
  transform: translateY(-2px);
  box-shadow:
    0 12px 24px var(--purple-shadow-strong),
    0 0 30px var(--purple-border-medium);
}

.btn-secondary {
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: 0 4px 8px var(--shadow-md);
}

.btn-secondary:hover {
  background: linear-gradient(
    135deg,
    var(--glass-border) 0%,
    var(--glass-bg-medium) 100%
  );
  border-color: var(--glass-border-medium);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: 0 6px 12px var(--shadow-lg);
}
</style>