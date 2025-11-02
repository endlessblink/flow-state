<template>
  <BaseModal
    :is-open="isOpen"
    :title="isEditing ? 'Edit Project' : 'Create Project'"
    size="md"
    :show-footer="false"
    @close="emit('close')"
  >
    <!-- Modal Body Content -->
    <div class="form-group">
      <label class="form-label">Project Name</label>
      <BaseInput
        v-model="projectData.name"
        placeholder="Enter project name..."
        ref="nameInput"
      />
    </div>

    <div class="form-group">
      <label class="form-label">Parent Project (Optional)</label>
      <select
        v-model="projectData.parentId"
        class="parent-project-select"
      >
        <option :value="null">None (Top Level)</option>
        <option
          v-for="proj in availableParentProjects"
          :key="proj.id"
          :value="proj.id"
        >
          {{ '  '.repeat(proj.depth) }}{{ proj.depth > 0 ? '└─ ' : '' }}{{ proj.name }}
        </option>
      </select>
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

    <!-- Custom Footer -->
    <template #footer>
      <div class="modal-actions">
        <BaseButton
          variant="secondary"
          @click="emit('close')"
        >
          Cancel
        </BaseButton>
        <BaseButton
          variant="primary"
          @click="saveProject"
          :disabled="!projectData.name.trim()"
        >
          {{ isEditing ? 'Save Changes' : 'Create Project' }}
        </BaseButton>
      </div>
    </template>
  </BaseModal>

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
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import EmojiPicker from './EmojiPicker.vue'

interface Props {
  isOpen: boolean
  project?: Project | null
  parentProjectId?: string | null // Optional parent for new nested projects
}

const props = withDefaults(defineProps<Props>(), {
  parentProjectId: null
})

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
  emoji: undefined as string | undefined,
  parentId: null as string | null
})

// Helper interface for project tree display
interface ProjectNode {
  id: string
  name: string
  depth: number
}

// Available parent projects (excludes "My Tasks", current project, and descendants to prevent circular nesting)
const availableParentProjects = computed<ProjectNode[]>(() => {
  const allProjects = taskStore.projects.filter(p => {
    // Exclude "My Tasks"
    if (p.id === '1') return false

    // Exclude current project when editing
    if (isEditing.value && props.project && p.id === props.project.id) return false

    // Exclude descendants when editing (prevent circular nesting)
    if (isEditing.value && props.project) {
      const isDescendant = taskStore.isDescendantOf(p.id, props.project.id)
      if (isDescendant) return false
    }

    return true
  })

  // Build tree structure with depth tracking
  function buildTree(parentId: string | null | undefined, depth = 0): ProjectNode[] {
    return allProjects
      .filter(p => p.parentId === parentId)
      .flatMap(project => [
        { id: project.id, name: project.name, depth },
        ...buildTree(project.id, depth + 1)
      ])
  }

  return buildTree(null)
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
      emoji: newProject.emoji,
      parentId: newProject.parentId || null
    }
  } else {
    projectData.value = {
      name: '',
      color: '#3b82f6',
      colorType: 'hex',
      emoji: undefined,
      parentId: props.parentProjectId || null // Use passed parent when creating
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
      emoji: projectData.value.emoji,
      parentId: projectData.value.parentId
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
      emoji: projectData.value.emoji,
      parentId: projectData.value.parentId
    })

    emit('created', newProject)
  }

  emit('close')
}
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

.parent-project-select {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-family: inherit;
  cursor: pointer;
  transition: all var(--duration-normal);
}

.parent-project-select:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-hover);
}

.parent-project-select:focus {
  outline: none;
  border-color: var(--brand-primary);
  background: var(--glass-bg-medium);
}

.parent-project-select option {
  background: var(--surface-secondary);
  color: var(--text-primary);
  padding: var(--space-2);
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

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}
</style>