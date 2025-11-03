<template>
  <div class="section-manager">
    <!-- Section Manager Header -->
    <div class="manager-header">
      <h3 class="manager-title">Canvas Sections</h3>
      <button @click="showCreateModal = true" class="create-btn">
        <Plus :size="16" />
        Add Section
      </button>
    </div>

    <!-- Sections List -->
    <div class="sections-list">
      <div
        v-for="section in sections"
        :key="section.id"
        class="section-item"
        :class="{ active: section.isVisible }"
      >
        <div class="section-info">
          <div
            class="section-color"
            :style="{ backgroundColor: section.color }"
          ></div>
          <div class="section-details">
            <div class="section-name">{{ section.name }}</div>
            <div class="section-type">{{ getSectionTypeLabel(section.type) }}</div>
          </div>
        </div>
        
        <div class="section-controls">
          <button
            @click="toggleSectionVisibility(section.id)"
            class="control-btn"
            :title="section.isVisible ? 'Hide' : 'Show'"
          >
            <Eye v-if="section.isVisible" :size="14" />
            <EyeOff v-else :size="14" />
          </button>
          <button
            @click="editSection(section)"
            class="control-btn"
            title="Edit Section"
          >
            <Edit :size="14" />
          </button>
          <button
            @click="deleteSection(section.id)"
            class="control-btn danger"
            title="Delete Section"
          >
            <Trash2 :size="14" />
          </button>
        </div>
      </div>
      
      <div v-if="sections.length === 0" class="empty-state">
        <div class="empty-icon">
          <Grid3X3 :size="48" />
        </div>
        <p class="empty-text">No sections created yet</p>
        <p class="empty-subtext">Create custom sections to organize your tasks</p>
      </div>
    </div>

    <!-- Create/Edit Section Modal -->
    <div v-if="showCreateModal || editingSection" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ editingSection ? 'Edit Section' : 'Create Section' }}</h3>
          <button @click="closeModal" class="close-btn">
            <X :size="16" />
          </button>
        </div>

        <div class="modal-body">
          <!-- Section Name -->
          <div class="form-group">
            <label class="form-label">Section Name</label>
            <input
              v-model="sectionForm.name"
              type="text"
              class="form-input"
              placeholder="e.g., High Priority Tasks"
            />
          </div>

          <!-- Section Type -->
          <div class="form-group">
            <label class="form-label">Section Type</label>
            <select v-model="sectionForm.type" class="form-select">
              <option value="custom">Custom</option>
              <option value="priority">Priority</option>
              <option value="status">Status</option>
              <option value="project">Project</option>
              <option value="date">Date Range</option>
              <option value="tags">Tags</option>
            </select>
          </div>

          <!-- Section Color -->
          <div class="form-group">
            <label class="form-label">Color</label>
            <div class="color-picker">
              <div
                v-for="color in presetColors"
                :key="color"
                class="color-option"
                :class="{ active: sectionForm.color === color }"
                :style="{ backgroundColor: color }"
                @click="sectionForm.color = color"
              ></div>
              <input
                v-model="sectionForm.color"
                type="color"
                class="color-custom"
                title="Custom color"
              />
            </div>
          </div>

          <!-- Dynamic Filters based on type -->
          <div v-if="sectionForm.type !== 'custom'" class="form-group">
            <label class="form-label">Filters</label>
            
            <!-- Priority Filters -->
            <div v-if="sectionForm.type === 'priority'" class="filter-group">
              <label class="filter-label">Priorities:</label>
              <div class="checkbox-group">
                <label v-for="priority in ['high', 'medium', 'low']" :key="priority" class="checkbox-item">
                  <input
                    v-model="sectionForm.filters.priorities"
                    type="checkbox"
                    :value="priority"
                  />
                  <span class="checkbox-label">{{ priority.charAt(0).toUpperCase() + priority.slice(1) }}</span>
                </label>
              </div>
            </div>

            <!-- Status Filters -->
            <div v-if="sectionForm.type === 'status'" class="filter-group">
              <label class="filter-label">Statuses:</label>
              <div class="checkbox-group">
                <label v-for="status in ['planned', 'in_progress', 'done', 'backlog']" :key="status" class="checkbox-item">
                  <input
                    v-model="sectionForm.filters.statuses"
                    type="checkbox"
                    :value="status"
                  />
                  <span class="checkbox-label">{{ getStatusLabel(status) }}</span>
                </label>
              </div>
            </div>

            <!-- Date Range Filters -->
            <div v-if="sectionForm.type === 'date'" class="filter-group">
              <label class="filter-label">Date Range:</label>
              <div class="date-range-group">
                <input
                  v-model="sectionForm.filters.dateRange.start"
                  type="date"
                  class="form-input"
                  placeholder="Start date"
                />
                <span class="date-separator">to</span>
                <input
                  v-model="sectionForm.filters.dateRange.end"
                  type="date"
                  class="form-input"
                  placeholder="End date"
                />
              </div>
            </div>

            <!-- Project Filters -->
            <div v-if="sectionForm.type === 'project'" class="filter-group">
              <label class="filter-label">Projects:</label>
              <select v-model="sectionForm.filters.projects" class="form-select" multiple>
                <option v-for="project in availableProjects" :key="project.id" :value="project.id">
                  {{ project.name }}
                </option>
              </select>
            </div>
          </div>

          <!-- Layout Options -->
          <div class="form-group">
            <label class="form-label">Layout</label>
            <div class="layout-options">
              <button
                v-for="layout in ['vertical', 'horizontal', 'grid', 'freeform']"
                :key="layout"
                class="layout-btn"
                :class="{ active: sectionForm.layout === layout }"
                @click="sectionForm.layout = layout"
              >
                {{ layout.charAt(0).toUpperCase() + layout.slice(1) }}
              </button>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button @click="closeModal" class="btn-secondary">Cancel</button>
          <button @click="saveSection" class="btn-primary">
            {{ editingSection ? 'Update' : 'Create' }} Section
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Plus, Eye, EyeOff, Edit, Trash2, X, Grid3X3 } from 'lucide-vue-next'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import type { CanvasSection } from '@/stores/canvas'

const canvasStore = useCanvasStore()
const taskStore = useTaskStore()

const showCreateModal = ref(false)
const editingSection = ref<CanvasSection | null>(null)

const presetColors = [
  // User-selectable section colors (intentionally hardcoded)
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e'
]

const sectionForm = ref({
  name: '',
  type: 'custom' as CanvasSection['type'],
  color: '#3b82f6', // User-selectable section color
  layout: 'vertical' as CanvasSection['layout'],
  filters: {
    priorities: [] as string[],
    statuses: [] as string[],
    projects: [] as string[],
    dateRange: { start: '', end: '' }
  }
})

const sections = computed(() => canvasStore.sections)

const availableProjects = computed(() => {
  // Extract unique projects from tasks
  const projects = new Map()
  taskStore.tasks.forEach(task => {
    if (!projects.has(task.projectId)) {
      projects.set(task.projectId, {
        id: task.projectId,
        name: `Project ${task.projectId}` // You might want to improve this
      })
    }
  })
  return Array.from(projects.values())
})

const getSectionTypeLabel = (type: CanvasSection['type']) => {
  const labels = {
    custom: 'Custom',
    priority: 'Priority',
    status: 'Status',
    project: 'Project',
    date: 'Date Range',
    tags: 'Tags'
  }
  return labels[type]
}

const getStatusLabel = (status: string) => {
  const labels = {
    planned: 'Planned',
    in_progress: 'In Progress',
    done: 'Done',
    backlog: 'Backlog'
  }
  return labels[status] || status
}

const toggleSectionVisibility = (sectionId: string) => {
  canvasStore.toggleSectionVisibility(sectionId)
}

const editSection = (section: CanvasSection) => {
  editingSection.value = section
  sectionForm.value = {
    name: section.name,
    type: section.type,
    color: section.color,
    layout: section.layout,
    filters: {
      priorities: section.filters?.priorities || [],
      statuses: section.filters?.statuses || [],
      projects: section.filters?.projects || [],
      dateRange: section.filters?.dateRange || { start: '', end: '' }
    }
  }
}

const deleteSection = (sectionId: string) => {
  if (confirm('Are you sure you want to delete this section?')) {
    canvasStore.deleteSection(sectionId)
  }
}

const closeModal = () => {
  showCreateModal.value = false
  editingSection.value = null
  resetForm()
}

const resetForm = () => {
  sectionForm.value = {
    name: '',
    type: 'custom',
    color: '#3b82f6', // User-selectable section color
    layout: 'vertical',
    filters: {
      priorities: [],
      statuses: [],
      projects: [],
      dateRange: { start: '', end: '' }
    }
  }
}

const saveSection = () => {
  if (!sectionForm.value.name.trim()) {
    alert('Please enter a section name')
    return
  }

  const sectionData = {
    name: sectionForm.value.name.trim(),
    type: sectionForm.value.type,
    color: sectionForm.value.color,
    layout: sectionForm.value.layout,
    position: { x: 100, y: 100, width: 300, height: 200 },
    isVisible: true,
    isCollapsed: false,
    filters: sectionForm.value.type !== 'custom' ? {
      ...sectionForm.value.filters,
      // Convert date strings to Date objects
      dateRange: sectionForm.value.filters.dateRange.start || sectionForm.value.filters.dateRange.end ? {
        start: sectionForm.value.filters.dateRange.start ? new Date(sectionForm.value.filters.dateRange.start) : undefined,
        end: sectionForm.value.filters.dateRange.end ? new Date(sectionForm.value.filters.dateRange.end) : undefined
      } : undefined
    } : undefined
  }

  if (editingSection.value) {
    canvasStore.updateSection(editingSection.value.id, sectionData)
  } else {
    canvasStore.createSection(sectionData)
  }

  closeModal()
}

onMounted(() => {
  // Initialize with empty sections
  canvasStore.initializeDefaultSections()
})
</script>

<style scoped>
.section-manager {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  height: 100%;
  overflow-y: auto;
}

.manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.manager-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.create-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--brand-primary);
  border: none;
  color: white;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.create-btn:hover {
  background: var(--brand-primary-hover);
}

.sections-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.section-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3);
  background: var(--surface-primary);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  transition: all var(--duration-fast);
}

.section-item:hover {
  border-color: var(--border-hover);
}

.section-item.active {
  border-color: var(--brand-primary);
  background: var(--purple-bg-subtle);
}

.section-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.section-color {
  width: 16px;
  height: 16px;
  border-radius: var(--radius-full);
  box-shadow: 0 0 8px currentColor;
}

.section-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.section-name {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.section-type {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.section-controls {
  display: flex;
  gap: var(--space-1);
  opacity: 0;
  transition: opacity var(--duration-fast);
}

.section-item:hover .section-controls {
  opacity: 1;
}

.control-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.control-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.control-btn.danger:hover {
  background: var(--danger-bg-light);
  color: #ef4444;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8) var(--space-4);
  text-align: center;
}

.empty-icon {
  color: var(--text-muted);
  margin-bottom: var(--space-4);
}

.empty-text {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin: 0 0 var(--space-2) 0;
}

.empty-subtext {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--surface-primary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px var(--shadow-subtle);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4);
  border-bottom: 1px solid var(--border-secondary);
}

.modal-header h3 {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.modal-body {
  padding: var(--space-4);
}

.form-group {
  margin-bottom: var(--space-4);
}

.form-label {
  display: block;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.form-input,
.form-select {
  width: 100%;
  background: var(--bg-secondary);
  border: 1px solid var(--border-secondary);
  color: var(--text-primary);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 3px var(--purple-bg-subtle);
}

.color-picker {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  flex-wrap: wrap;
}

.color-option {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  cursor: pointer;
  border: 2px solid transparent;
  transition: all var(--duration-fast);
}

.color-option:hover {
  transform: scale(1.1);
}

.color-option.active {
  border-color: var(--text-primary);
  box-shadow: 0 0 0 2px var(--surface-primary);
}

.color-custom {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-full);
  cursor: pointer;
}

.filter-group {
  margin-top: var(--space-3);
}

.filter-label {
  display: block;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
}

.checkbox-label {
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.date-range-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.date-separator {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.layout-options {
  display: flex;
  gap: var(--space-2);
}

.layout-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-secondary);
  color: var(--text-primary);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.layout-btn:hover {
  background: var(--bg-hover);
}

.layout-btn.active {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
  color: white;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-4);
  border-top: 1px solid var(--border-secondary);
}

.btn-secondary,
.btn-primary {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.btn-secondary {
  background: var(--bg-secondary);
  border: 1px solid var(--border-secondary);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: var(--bg-hover);
}

.btn-primary {
  background: var(--brand-primary);
  border: none;
  color: white;
}

.btn-primary:hover {
  background: var(--brand-primary-hover);
}
</style>