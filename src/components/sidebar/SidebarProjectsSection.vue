<template>
  <div>
    <!-- Projects Section Header -->
    <div class="projects-divider" />
    <div class="section-header">
      <h3 class="section-title">
        <FolderOpen :size="16" class="section-icon" />
        {{ $t('common.projects') }}
      </h3>
      <button class="add-project-btn" :title="$t('sidebar.add_project')" @click="sidebar.openCreateProject">
        <Plus :size="14" />
      </button>
    </div>

    <!-- Project Selection Bar (shown when projects are selected) -->
    <Transition name="fade">
      <div v-if="multiSelectMode" class="project-selection-bar">
        <span class="selection-count">{{ selectedProjectIds.size }} selected</span>
        <button
          class="selection-action delete-action"
          title="Delete selected projects"
          @click="confirmDeleteSelectedProjects"
        >
          <Trash2 :size="14" />
          {{ $t('common.delete') }}
        </button>
        <button
          class="selection-action clear-action"
          title="Clear selection (Esc)"
          @click="clearProjectSelection"
        >
          <X :size="14" />
        </button>
      </div>
    </Transition>

    <!-- Delete Confirmation Modal -->
    <Transition name="fade">
      <div v-if="showDeleteConfirm" class="delete-confirm-overlay" @click.self="cancelDeleteProjects">
        <div class="delete-confirm-modal">
          <h4>Delete {{ projectsToDeleteCount }} project{{ projectsToDeleteCount > 1 ? 's' : '' }}?</h4>
          <p>Tasks in {{ projectsToDeleteCount > 1 ? 'these projects' : 'this project' }} will be moved to Inbox. This cannot be undone.</p>
          <div class="confirm-actions">
            <button class="cancel-btn" @click="cancelDeleteProjects">
              {{ $t('common.cancel') }}
            </button>
            <button class="delete-btn" @click="executeDeleteProjects">
              {{ $t('common.delete') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Project List - Recursive tree rendering with accessibility -->
    <nav
      class="projects-list"
      role="tree"
      aria-label="Projects"
      :aria-activedescendant="taskStore.activeProjectId ? `project-${taskStore.activeProjectId}` : undefined"
      @keydown="handleProjectTreeKeydown"
    >
      <!-- All Projects Option -->
      <div class="project-tree-item">
        <BaseNavItem
          :active="!taskStore.activeProjectId && selectedProjectIds.size === 0"
          @click="handleAllProjectsClick"
        >
          <template #icon>
            <Layers :size="16" />
          </template>
          {{ $t('sidebar.all_projects') }}
        </BaseNavItem>
      </div>

      <ProjectTreeItem
        v-for="project in taskStore.projects.filter(p => !p.parentId)"
        :key="project.id"
        :project="project"
        :expanded-projects="sidebar.expandedProjects.value || []"
        :selected-project-ids="selectedProjectIds"
        :level="1"
        @click="handleProjectClick"
        @toggle-expand="sidebar.toggleProjectExpansion"
        @contextmenu="handleProjectContextMenu"
        @project-drop="() => {}"
      />
    </nav>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useTaskStore, type Project } from '@/stores/tasks'
import { useSidebarManagement } from '@/composables/app/useSidebarManagement'
import { FolderOpen, Plus, Trash2, X, Layers } from 'lucide-vue-next'
import BaseNavItem from '@/components/base/BaseNavItem.vue'
import ProjectTreeItem from '@/components/projects/ProjectTreeItem.vue'

const uiStore = useUIStore()
const taskStore = useTaskStore()
const sidebar = useSidebarManagement()

// Project Multi-Select State
const selectedProjectIds = computed(() => uiStore.selectedProjectIds)
const lastSelectedProjectId = computed(() => uiStore.lastSelectedProjectId)
const multiSelectMode = computed(() => uiStore.selectedProjectIds.size > 0)
const showDeleteConfirm = ref(false)

// Handle "All Projects" click
const handleAllProjectsClick = () => {
  taskStore.setActiveProject(null)
  uiStore.clearProjectSelection()
}

// Project Selection Handlers
const handleProjectClick = (event: MouseEvent, project: Project) => {
  // Handle Shift+Click (Range Selection)
  if (event.shiftKey) {
    if (!lastSelectedProjectId.value) {
      uiStore.setProjectSelection([project.id])
      return
    }

    // Has anchor - perform range selection
    const allProjects = getFlattenedProjectList()
    const lastIndex = allProjects.findIndex(p => p.id === lastSelectedProjectId.value)
    const currentIndex = allProjects.findIndex(p => p.id === project.id)

    if (lastIndex === -1) {
      uiStore.setProjectSelection([project.id])
      return
    }

    if (currentIndex !== -1) {
      const start = Math.min(lastIndex, currentIndex)
      const end = Math.max(lastIndex, currentIndex)
      const rangeProjects = allProjects.slice(start, end + 1)

      const ids = rangeProjects.map(p => p.id)
      uiStore.setProjectSelection(ids)
    }
    return
  }

  // Handle Ctrl/Cmd+Click (Toggle Selection)
  if (event.ctrlKey || event.metaKey) {
    uiStore.toggleProjectSelection(project.id)
    return
  }

  // Single click - clear selection and select project normally
  clearProjectSelection()
  sidebar.selectProject(project)
}

const clearProjectSelection = () => {
  uiStore.clearProjectSelection()
  showDeleteConfirm.value = false
}

const deleteSelectedProjects = async () => {
  let idsToDelete: string[] = []

  if (selectedProjectIds.value.size > 0) {
    idsToDelete = Array.from(selectedProjectIds.value)
  } else if (taskStore.activeProjectId && taskStore.activeProjectId !== 'uncategorized') {
    idsToDelete = [taskStore.activeProjectId]
  }

  if (idsToDelete.length === 0) return

  try {
    await taskStore.deleteProjects(idsToDelete)
  } catch (error) {
    console.error('❌ Error deleting projects:', error)
  }
  clearProjectSelection()
}

const confirmDeleteSelectedProjects = () => {
  showDeleteConfirm.value = true
}

const cancelDeleteProjects = () => {
  showDeleteConfirm.value = false
}

const executeDeleteProjects = async () => {
  await deleteSelectedProjects()
  showDeleteConfirm.value = false
}

// Check if there are projects that can be deleted (selected or active)
const hasDeletableProjects = computed(() => {
  if (selectedProjectIds.value.size > 0) return true
  if (taskStore.activeProjectId && taskStore.activeProjectId !== 'uncategorized') return true
  return false
})

// Get count of projects to delete (for modal)
const projectsToDeleteCount = computed(() => {
  if (selectedProjectIds.value.size > 0) return selectedProjectIds.value.size
  if (taskStore.activeProjectId && taskStore.activeProjectId !== 'uncategorized') return 1
  return 0
})

// Keyboard handler for project selection actions (global listener)
const handleProjectKeydown = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
    return
  }

  // BUG-1336: Only handle delete when focus is within the sidebar or when projects are
  // explicitly multi-selected
  const sidebarEl = document.querySelector('.sidebar')
  const isFocusInSidebar = sidebarEl?.contains(target)
  const hasExplicitSelection = selectedProjectIds.value.size > 0

  // Escape: Clear selection
  if (event.key === 'Escape' && hasExplicitSelection) {
    clearProjectSelection()
    return
  }

  // Delete or Backspace: Only when sidebar has focus OR projects are explicitly selected
  if ((event.key === 'Delete' || event.key === 'Backspace') && hasDeletableProjects.value) {
    if (!isFocusInSidebar && !hasExplicitSelection) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    confirmDeleteSelectedProjects()
    return
  }
}

// Project Tree Navigation
const handleProjectTreeKeydown = (event: KeyboardEvent) => {
  const { key } = event

  switch (key) {
    case 'ArrowDown':
      event.preventDefault()
      navigateToNextProject()
      break
    case 'ArrowUp':
      event.preventDefault()
      navigateToPreviousProject()
      break
    case 'ArrowRight':
      event.preventDefault()
      expandCurrentProject()
      break
    case 'ArrowLeft':
      event.preventDefault()
      collapseCurrentProjectOrNavigateToParent()
      break
    case 'Enter':
    case ' ':
      event.preventDefault()
      activateCurrentProject()
      break
    case 'Home':
      event.preventDefault()
      navigateToFirstProject()
      break
    case 'End':
      event.preventDefault()
      navigateToLastProject()
      break
  }
}

const navigateToNextProject = () => {
  const currentProjectId = taskStore.activeProjectId
  const allProjects = getFlattenedProjectList()
  const currentIndex = allProjects.findIndex(p => p.id === currentProjectId)

  if (currentIndex < allProjects.length - 1) {
    taskStore.setActiveProject(allProjects[currentIndex + 1].id)
  }
}

const navigateToPreviousProject = () => {
  const currentProjectId = taskStore.activeProjectId
  const allProjects = getFlattenedProjectList()
  const currentIndex = allProjects.findIndex(p => p.id === currentProjectId)

  if (currentIndex > 0) {
    taskStore.setActiveProject(allProjects[currentIndex - 1].id)
  }
}

const expandCurrentProject = () => {
  const currentProjectId = taskStore.activeProjectId
  if (currentProjectId && hasProjectChildren(currentProjectId)) {
    if (!sidebar.expandedProjects.value.includes(currentProjectId)) {
      sidebar.expandedProjects.value.push(currentProjectId)
    }
  }
}

const collapseCurrentProjectOrNavigateToParent = () => {
  const currentProjectId = taskStore.activeProjectId
  if (!currentProjectId) return

  if (hasProjectChildren(currentProjectId) && sidebar.expandedProjects.value.includes(currentProjectId)) {
    const index = sidebar.expandedProjects.value.indexOf(currentProjectId)
    sidebar.expandedProjects.value.splice(index, 1)
  } else {
    const project = taskStore.getProjectById(currentProjectId)
    if (project?.parentId) {
      taskStore.setActiveProject(project.parentId)
    }
  }
}

const activateCurrentProject = () => {
  const currentProjectId = taskStore.activeProjectId
  if (currentProjectId) {
    const project = taskStore.getProjectById(currentProjectId)
    if (project) {
      sidebar.selectProject(project)
    }
  }
}

const navigateToFirstProject = () => {
  const allProjects = getFlattenedProjectList()
  if (allProjects.length > 0) {
    taskStore.setActiveProject(allProjects[0].id)
  }
}

const navigateToLastProject = () => {
  const allProjects = getFlattenedProjectList()
  if (allProjects.length > 0) {
    taskStore.setActiveProject(allProjects[allProjects.length - 1].id)
  }
}

const getFlattenedProjectList = () => {
  const flatten = (projects: Project[]): Project[] => {
    const result: Project[] = []
    for (const project of projects) {
      result.push(project)
      if (sidebar.expandedProjects.value.includes(project.id)) {
        const children = taskStore.projects.filter(p => p.parentId === project.id)
        result.push(...flatten(children))
      }
    }
    return result
  }
  return flatten(taskStore.projects.filter(p => !p.parentId))
}

const hasProjectChildren = (projectId: string) => {
  return taskStore.projects.some(p => p.parentId === projectId)
}

const handleProjectContextMenu = (event: MouseEvent, project: Project) => {
  event.preventDefault()
  window.dispatchEvent(new CustomEvent('project-context-menu', {
    detail: { event, project }
  }))
}

// Lifecycle - global keyboard listener
onMounted(() => {
  window.addEventListener('keydown', handleProjectKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleProjectKeydown)
})
</script>

<style scoped>
.projects-divider {
  height: 1px;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    var(--glass-bg-heavy) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  margin: var(--space-4) 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  margin: 0;
  letter-spacing: 0.05em;
}

.section-icon {
  color: var(--text-muted);
}

.add-project-btn {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-muted);
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all var(--duration-fast) var(--ease-out);
}

.add-project-btn:hover {
  background: var(--surface-hover);
  border-color: var(--border-strong);
  color: var(--text-secondary);
}

.projects-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  overflow-y: auto;
  max-height: calc(100vh - 500px);
  padding-inline-end: var(--space-2);
  width: 100%; /* BUG-1696: WebKitGTK fix - ensure list fills sidebar width so project names are visible */
}

/* Project Selection Bar */
.project-selection-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--glass-bg-heavy);
  border: 1px solid var(--brand-primary-alpha-30);
  border-radius: var(--radius-md);
  margin: 0 var(--space-4) var(--space-2) var(--space-4);
}

.selection-count {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--brand-primary);
  flex: 1;
}

.selection-action {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: transparent;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.selection-action:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
}

.selection-action.delete-action:hover {
  background: var(--danger-bg-light);
  border-color: var(--danger-border-strong);
  color: var(--color-danger);
}

.selection-action.clear-action {
  padding: var(--space-1);
}

/* Delete Confirmation Modal */
.delete-confirm-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-heavy);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-tooltip);
}

.delete-confirm-modal {
  background: var(--overlay-component-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  max-width: 400px;
  width: 90%;
  box-shadow: var(--shadow-dark-xl);
}

.delete-confirm-modal h4 {
  margin: 0 0 var(--space-3) 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.delete-confirm-modal p {
  margin: 0 0 var(--space-4) 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.5;
}

.confirm-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
}

.confirm-actions button {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.cancel-btn {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-secondary);
}

.cancel-btn:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
}

.delete-btn {
  background: var(--color-danger);
  border: none;
  color: white;
}

.delete-btn:hover {
  background: var(--color-danger);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-slow) var(--ease-out);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
