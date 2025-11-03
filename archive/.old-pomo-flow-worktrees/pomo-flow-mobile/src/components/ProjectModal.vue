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
          <label class="form-label">Color</label>
          <div class="color-picker">
            <button
              v-for="color in colorOptions"
              :key="color.value"
              class="color-option"
              :class="{ active: projectData.color === color.value }"
              :style="{ backgroundColor: color.value }"
              @click="projectData.color = color.value"
              :title="color.name"
            >
              <Check v-if="projectData.color === color.value" :size="12" :stroke-width="2" class="check-icon" />
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
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import type { Project } from '@/stores/tasks'
import { X, Check } from 'lucide-vue-next'
import BaseInput from '@/components/base/BaseInput.vue'

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

const isEditing = computed(() => !!props.project)

const projectData = ref({
  name: '',
  color: '#3b82f6'
})

const colorOptions = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#10b981' },
  { name: 'Orange', value: '#f59e0b' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Teal', value: '#14b8a6' }
]

// Watch for project changes
watch(() => props.project, (newProject) => {
  if (newProject) {
    projectData.value = {
      name: newProject.name,
      color: newProject.color
    }
  } else {
    projectData.value = {
      name: '',
      color: '#3b82f6' // User-selectable project color
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
    // Update existing project
    const updatedProject = {
      ...props.project,
      name: projectData.value.name.trim(),
      color: projectData.value.color,
      updatedAt: new Date()
    }

    // TODO: Add updateProject method to store
    const projectIndex = taskStore.projects.findIndex(p => p.id === props.project.id)
    if (projectIndex !== -1) {
      taskStore.projects[projectIndex] = updatedProject
    }

    emit('updated', updatedProject)
  } else {
    // Create new project
    const newProject: Project = {
      id: Date.now().toString(),
      name: projectData.value.name.trim(),
      color: projectData.value.color,
      createdAt: new Date()
    }

    taskStore.projects.push(newProject)
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

.color-picker {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3);
  max-width: 200px;
}

.color-option {
  width: 44px;
  height: 44px;
  border: 2px solid transparent;
  border-radius: var(--radius-lg);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-normal) var(--spring-bounce);
  position: relative;
  box-shadow: 0 4px 8px var(--shadow-md);
}

.color-option:hover {
  border-color: var(--glass-border-hover);
  transform: scale(1.08) translateY(-2px);
  box-shadow: 0 8px 16px var(--shadow-lg);
}

.color-option.active {
  border-color: var(--glass-border-active);
  box-shadow:
    0 0 0 3px var(--glass-border-soft),
    0 8px 16px var(--shadow-md);
  transform: scale(1.05);
}

.check-icon {
  color: white;
  filter: drop-shadow(0 2px 4px var(--shadow-strong));
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