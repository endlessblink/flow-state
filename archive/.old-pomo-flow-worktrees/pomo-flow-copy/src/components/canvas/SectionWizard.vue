<template>
  <div v-if="isOpen" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content wizard-content" @click.stop>
      <!-- Header -->
      <div class="modal-header">
        <h2 class="modal-title">Create Smart Section</h2>
        <button class="close-btn" @click="$emit('close')">
          <X :size="16" :stroke-width="1.5" />
        </button>
      </div>

      <!-- Step Indicators -->
      <div class="step-indicators">
        <div :class="['step-indicator', { active: currentStep === 1, completed: currentStep > 1 }]">
          <div class="step-number">1</div>
          <div class="step-label">Choose Type</div>
        </div>
        <div class="step-divider"></div>
        <div :class="['step-indicator', { active: currentStep === 2, completed: currentStep > 2 }]">
          <div class="step-number">2</div>
          <div class="step-label">Configure</div>
        </div>
        <div class="step-divider"></div>
        <div :class="['step-indicator', { active: currentStep === 3, completed: currentStep > 3 }]">
          <div class="step-number">3</div>
          <div class="step-label">Customize</div>
        </div>
      </div>

      <!-- Wizard Body -->
      <div class="modal-body wizard-body">
        <!-- Step 1: Choose Section Type -->
        <div v-if="currentStep === 1" class="wizard-step">
          <p class="step-description">
            Select a section type. Sections automatically update task properties when tasks are dragged in.
          </p>

          <div class="section-type-grid">
            <button
              v-for="type in sectionTypes"
              :key="type.value"
              :class="['section-type-card', { selected: wizardData.type === type.value }]"
              @click="selectType(type.value)"
            >
              <component :is="type.icon" :size="32" :stroke-width="1.5" class="type-icon" />
              <h3 class="type-title">{{ type.label }}</h3>
              <p class="type-description">{{ type.description }}</p>
              <div class="type-updates">Updates: <code>{{ type.updates }}</code></div>
            </button>
          </div>
        </div>

        <!-- Step 2: Configure Property Value -->
        <div v-if="currentStep === 2" class="wizard-step">
          <p class="step-description">
            Choose the {{ wizardData.type }} value for this section.
          </p>

          <!-- Priority Values -->
          <div v-if="wizardData.type === 'priority'" class="property-options">
            <button
              v-for="priority in priorityOptions"
              :key="priority.value"
              :class="['property-option', { selected: wizardData.propertyValue === priority.value }]"
              @click="selectPropertyValue(priority.value, priority.label)"
            >
              <div class="option-badge" :style="{ backgroundColor: priority.color }"></div>
              <div class="option-content">
                <div class="option-label">{{ priority.label }}</div>
                <div class="option-description">{{ priority.description }}</div>
              </div>
            </button>
          </div>

          <!-- Status Values -->
          <div v-if="wizardData.type === 'status'" class="property-options">
            <button
              v-for="status in statusOptions"
              :key="status.value"
              :class="['property-option', { selected: wizardData.propertyValue === status.value }]"
              @click="selectPropertyValue(status.value, status.label)"
            >
              <div class="option-badge" :style="{ backgroundColor: status.color }"></div>
              <div class="option-content">
                <div class="option-label">{{ status.label }}</div>
                <div class="option-description">{{ status.description }}</div>
              </div>
            </button>
          </div>

          <!-- Timeline Values -->
          <div v-if="wizardData.type === 'timeline'" class="property-options">
            <button
              v-for="timeline in timelineOptions"
              :key="timeline.value"
              :class="['property-option', { selected: wizardData.propertyValue === timeline.value }]"
              @click="selectPropertyValue(timeline.value, timeline.label)"
            >
              <component :is="timeline.icon" :size="20" :stroke-width="1.5" class="option-icon" />
              <div class="option-content">
                <div class="option-label">{{ timeline.label }}</div>
                <div class="option-description">{{ timeline.description }}</div>
              </div>
            </button>
          </div>

          <!-- Project Values -->
          <div v-if="wizardData.type === 'project'" class="property-options">
            <div v-if="projects.length === 0" class="empty-state">
              <FolderOpen :size="48" :stroke-width="1" />
              <p>No projects available. Create a project first.</p>
            </div>
            <button
              v-for="project in projects"
              :key="project.id"
              :class="['property-option', { selected: wizardData.propertyValue === project.id }]"
              @click="selectPropertyValue(project.id, project.name, project.color)"
            >
              <div class="option-badge" :style="{ backgroundColor: project.color }"></div>
              <div class="option-content">
                <div class="option-label">{{ project.name }}</div>
                <div class="option-description">{{ project.description || 'No description' }}</div>
              </div>
            </button>
          </div>
        </div>

        <!-- Step 3: Customize Appearance -->
        <div v-if="currentStep === 3" class="wizard-step">
          <p class="step-description">
            Customize the section name and appearance.
          </p>

          <div class="form-group">
            <label class="form-label">Section Name</label>
            <BaseInput
              v-model="wizardData.name"
              placeholder="Enter section name..."
              ref="nameInput"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Section Color</label>

            <!-- Color Presets -->
            <div class="color-presets">
              <button
                v-for="color in colorPresets"
                :key="color"
                :class="['color-preset', { active: wizardData.color === color }]"
                :style="{ backgroundColor: color }"
                @click="selectColor(color)"
                type="button"
                :title="`Select ${color}`"
              />
            </div>

            <!-- Custom Color -->
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

              <div class="color-preview">
                <div
                  class="preview-box"
                  :style="{ backgroundColor: wizardData.color }"
                />
                <span class="color-value">{{ wizardData.color }}</span>
              </div>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Width (px)</label>
              <BaseInput
                v-model.number="wizardData.width"
                type="number"
                min="200"
                max="800"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Height (px)</label>
              <BaseInput
                v-model.number="wizardData.height"
                type="number"
                min="150"
                max="600"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Footer with Navigation -->
      <div class="modal-footer wizard-footer">
        <button
          v-if="currentStep > 1"
          class="btn btn-secondary"
          @click="previousStep"
        >
          Back
        </button>

        <button
          v-if="currentStep < 3"
          class="btn btn-primary"
          @click="nextStep"
          :disabled="!canProceed"
        >
          Next
        </button>

        <button
          v-if="currentStep === 3"
          class="btn btn-primary"
          @click="createSection"
          :disabled="!canCreate"
        >
          <Sparkles :size="16" :stroke-width="1.5" />
          Create Section
        </button>

        <button
          class="btn btn-secondary"
          @click="$emit('close')"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { useCanvasStore, type CanvasSection } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import {
  X, Flag, CheckCircle, Calendar, FolderOpen, Folder,
  Sun, Sunrise, CalendarDays, CalendarRange, Sparkles
} from 'lucide-vue-next'
import BaseInput from '@/components/base/BaseInput.vue'

interface Props {
  isOpen: boolean
  position?: { x: number; y: number }
}

const props = withDefaults(defineProps<Props>(), {
  position: () => ({ x: 100, y: 100 })
})

const emit = defineEmits<{
  close: []
  created: [section: CanvasSection]
}>()

const canvasStore = useCanvasStore()
const taskStore = useTaskStore()
const nameInput = ref()

// Wizard state
const currentStep = ref(1)
const wizardData = ref({
  type: '' as '' | 'priority' | 'status' | 'timeline' | 'project',
  propertyValue: '',
  name: '',
  color: '#3b82f6',
  width: 300,
  height: 250
})

const customColor = ref('#3b82f6')

// Section types for Step 1
const sectionTypes = [
  {
    value: 'priority',
    label: 'Priority',
    icon: Flag,
    description: 'Organize tasks by urgency level',
    updates: 'task.priority'
  },
  {
    value: 'status',
    label: 'Status',
    icon: CheckCircle,
    description: 'Track task completion stages',
    updates: 'task.status'
  },
  {
    value: 'timeline',
    label: 'Timeline',
    icon: Calendar,
    description: 'Schedule tasks by due date',
    updates: 'task.dueDate'
  },
  {
    value: 'project',
    label: 'Project',
    icon: Folder,
    description: 'Group tasks by project',
    updates: 'task.projectId'
  }
]

// Priority options for Step 2
const priorityOptions = [
  { value: 'high', label: 'High Priority', color: '#ef4444', description: 'Urgent and important tasks' },
  { value: 'medium', label: 'Medium Priority', color: '#f59e0b', description: 'Important but not urgent' },
  { value: 'low', label: 'Low Priority', color: '#6366f1', description: 'Can be done later' }
]

// Status options for Step 2
const statusOptions = [
  { value: 'planned', label: 'Planned', color: '#6366f1', description: 'Not started yet' },
  { value: 'in_progress', label: 'In Progress', color: '#f59e0b', description: 'Currently working on' },
  { value: 'done', label: 'Done', color: '#10b981', description: 'Completed tasks' },
  { value: 'backlog', label: 'Backlog', color: '#64748b', description: 'Future tasks' }
]

// Timeline options for Step 2
const timelineOptions = [
  { value: 'today', label: 'Today', icon: Sun, description: 'Due today' },
  { value: 'tomorrow', label: 'Tomorrow', icon: Sunrise, description: 'Due tomorrow' },
  { value: 'this_week', label: 'This Week', icon: CalendarDays, description: 'Due this week' },
  { value: 'next_week', label: 'Next Week', icon: CalendarRange, description: 'Due next week' }
]

// Projects from task store
const projects = computed(() => taskStore.projects)

// Color presets (same as GroupModal)
const colorPresets = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b',
  '#475569', '#71717a'
]

// Validation computed properties
const canProceed = computed(() => {
  if (currentStep.value === 1) {
    return wizardData.value.type !== ''
  }
  if (currentStep.value === 2) {
    return wizardData.value.propertyValue !== ''
  }
  return true
})

const canCreate = computed(() => {
  return wizardData.value.name.trim().length > 0 &&
         wizardData.value.color !== ''
})

// Step navigation
const selectType = (type: typeof wizardData.value.type) => {
  wizardData.value.type = type
}

const selectPropertyValue = (value: string, label: string, color?: string) => {
  wizardData.value.propertyValue = value
  wizardData.value.name = label // Pre-fill section name
  if (color) {
    wizardData.value.color = color
    customColor.value = color
  }
}

const nextStep = () => {
  if (canProceed.value && currentStep.value < 3) {
    currentStep.value++
    if (currentStep.value === 3) {
      nextTick(() => {
        nameInput.value?.focus()
      })
    }
  }
}

const previousStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

// Color selection
const selectColor = (color: string) => {
  wizardData.value.color = color
  customColor.value = color
}

const handleCustomColorInput = () => {
  const color = customColor.value
  if (/^#[0-9A-F]{6}$/i.test(color)) {
    wizardData.value.color = color
  }
}

const handleColorPickerChange = () => {
  wizardData.value.color = customColor.value
}

// Create section
const createSection = () => {
  if (!canCreate.value) return

  let newSection: CanvasSection

  const position = {
    x: props.position.x,
    y: props.position.y,
    width: wizardData.value.width,
    height: wizardData.value.height
  }

  // Use type-specific creation methods
  if (wizardData.value.type === 'priority') {
    newSection = canvasStore.createPrioritySection(
      wizardData.value.propertyValue as 'high' | 'medium' | 'low',
      props.position
    )
    // Update with custom values
    canvasStore.updateSection(newSection.id, {
      name: wizardData.value.name.trim(),
      color: wizardData.value.color,
      position
    })
  } else if (wizardData.value.type === 'status') {
    newSection = canvasStore.createStatusSection(
      wizardData.value.propertyValue as 'planned' | 'in_progress' | 'done' | 'backlog',
      props.position
    )
    canvasStore.updateSection(newSection.id, {
      name: wizardData.value.name.trim(),
      color: wizardData.value.color,
      position
    })
  } else if (wizardData.value.type === 'project') {
    const project = projects.value.find(p => p.id === wizardData.value.propertyValue)
    if (project) {
      newSection = canvasStore.createProjectSection(
        project.id,
        wizardData.value.name.trim(),
        wizardData.value.color,
        props.position
      )
      canvasStore.updateSection(newSection.id, { position })
    }
  } else {
    // Timeline or other types
    newSection = canvasStore.createSection({
      name: wizardData.value.name.trim(),
      type: wizardData.value.type as any,
      propertyValue: wizardData.value.propertyValue,
      position,
      color: wizardData.value.color,
      layout: 'grid',
      isVisible: true,
      isCollapsed: false
    })
  }

  if (newSection!) {
    emit('created', newSection)
    emit('close')
    resetWizard()
  }
}

// Reset wizard state
const resetWizard = () => {
  currentStep.value = 1
  wizardData.value = {
    type: '',
    propertyValue: '',
    name: '',
    color: '#3b82f6',
    width: 300,
    height: 250
  }
  customColor.value = '#3b82f6'
}

// Watch for modal open/close
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    resetWizard()
  }
})
</script>

<style scoped>
/* Modal Overlay (Base Styles) */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-dark);
  display: flex;
  align-items: center;      /* Center vertically */
  justify-content: center;  /* Center horizontally */
  z-index: var(--z-modal, 9999);
  backdrop-filter: blur(12px) saturate(150%);
  -webkit-backdrop-filter: blur(12px) saturate(150%);
  animation: fadeIn var(--duration-normal) var(--spring-smooth);
  padding: var(--space-4);
}

/* Modal Content (Base Container) */
.modal-content {
  background: linear-gradient(
    135deg,
    var(--glass-bg-medium) 0%,
    var(--glass-bg-heavy) 100%
  );
  backdrop-filter: blur(32px) saturate(200%);
  -webkit-backdrop-filter: blur(32px) saturate(200%);
  border: 1px solid var(--glass-border-strong);
  border-radius: var(--radius-2xl);
  box-shadow:
    0 32px 64px var(--shadow-xl),
    0 16px 32px var(--shadow-strong),
    inset 0 2px 0 var(--glass-border-soft);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  overflow: hidden;
  animation: slideUp var(--duration-normal) var(--spring-bounce);
  position: relative;
}

/* Wizard-specific size overrides */
.wizard-content {
  max-width: 600px;
  width: 90%;
}

.wizard-body {
  min-height: 400px;
  max-height: 500px;
  overflow-y: auto;
}

/* Modal Header */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  padding: var(--space-6);
  border-bottom: 1px solid var(--glass-border);
  background: linear-gradient(
    180deg,
    var(--glass-bg-tint) 0%,
    transparent 100%
  );
}

.modal-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
  line-height: var(--leading-tight);
}

/* Close Button */
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
  flex-shrink: 0;
}

.close-btn:hover {
  background: var(--glass-border);
  border-color: var(--glass-border-medium);
  color: var(--text-primary);
  transform: scale(1.05);
}

/* Modal Body */
.modal-body {
  padding: var(--space-6);
  overflow-y: auto;
  flex: 1;
}

/* Modal Footer */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-6);
  border-top: 1px solid var(--glass-border);
  background: linear-gradient(
    180deg,
    transparent 0%,
    var(--glass-bg-weak) 100%
  );
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Step Indicators */
.step-indicators {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--border-secondary);
}

.step-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  opacity: 0.5;
  transition: opacity 0.2s ease;
}

.step-indicator.active,
.step-indicator.completed {
  opacity: 1;
}

.step-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--surface-tertiary);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-semibold);
  font-size: var(--text-sm);
  transition: all 0.2s ease;
}

.step-indicator.active .step-number {
  background: var(--primary);
  color: white;
}

.step-indicator.completed .step-number {
  background: var(--success);
  color: white;
}

.step-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-weight: var(--font-medium);
}

.step-divider {
  width: 40px;
  height: 2px;
  background: var(--border-secondary);
}

/* Wizard Steps */
.wizard-step {
  padding: var(--space-6);
}

.step-description {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  margin-bottom: var(--space-6);
  text-align: center;
}

/* Section Type Grid */
.section-type-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

.section-type-card {
  background: var(--surface-secondary);
  border: 2px solid var(--border-secondary);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}

.section-type-card:hover {
  border-color: var(--primary);
  background: var(--surface-tertiary);
}

.section-type-card.selected {
  border-color: var(--primary);
  background: var(--primary-bg-subtle);
}

.type-icon {
  color: var(--primary);
}

.type-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.type-description {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

.type-updates {
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.type-updates code {
  background: var(--surface-tertiary);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
}

/* Property Options */
.property-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.property-option {
  background: var(--surface-secondary);
  border: 2px solid var(--border-secondary);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  text-align: left;
}

.property-option:hover {
  border-color: var(--primary);
  background: var(--surface-tertiary);
}

.property-option.selected {
  border-color: var(--primary);
  background: var(--primary-bg-subtle);
}

.option-badge {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  flex-shrink: 0;
}

.option-icon {
  color: var(--primary);
  flex-shrink: 0;
}

.option-content {
  flex: 1;
}

.option-label {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.option-description {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-top: var(--space-1);
}

.empty-state {
  text-align: center;
  padding: var(--space-8);
  color: var(--text-muted);
}

.empty-state svg {
  opacity: 0.5;
  margin-bottom: var(--space-4);
}

/* Form styles (reuse from GroupModal) */
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.wizard-footer {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
}

.wizard-footer .btn:first-child {
  margin-right: auto;
}
</style>
