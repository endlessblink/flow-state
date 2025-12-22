<template>
  <!-- LEFT SIDEBAR NAVIGATION - Extracted from App.vue -->
  <Transition name="sidebar-slide">
    <aside
      v-show="uiStore.mainSidebarVisible"
      class="sidebar"
      aria-label="Main navigation"
      :aria-hidden="!uiStore.mainSidebarVisible"
    >
      <!-- App Header -->
      <div class="sidebar-header">
        <div class="app-brand">
          <span class="brand-icon">🍅</span>
          <span class="brand-text">Pomo-Flow</span>
        </div>
        <BaseButton variant="secondary" size="md" @click="sidebar.openCreateProject">
          <Plus :size="14" />
          Create project
        </BaseButton>

        <div class="icon-button-group">
          <button
            class="icon-btn"
            title="Hide Sidebar"
            aria-label="Hide sidebar"
            @click="uiStore.toggleMainSidebar"
          >
            <PanelLeftClose :size="18" />
          </button>

          <button
            class="icon-btn"
            title="Settings"
            aria-label="Open settings"
            @click="uiStore.openSettingsModal()"
          >
            <Settings :size="18" />
          </button>
        </div>
      </div>

      <!-- Quick Task Creation - REBUILT -->
      <div class="quick-task-section">
        <input
          ref="quickTaskRef"
          type="text"
          class="quick-task-input"
          placeholder="Quick add task (Enter)..."
          @keydown.enter.prevent="createQuickTask"
        >
      </div>

      <!-- Project & Task Management -->
      <div class="task-management-section">
        <div class="section-header">
          <h3 class="section-title">
            <FolderOpen :size="16" class="section-icon" />
            Projects
          </h3>
          <button class="add-project-btn" title="Add Project" @click="sidebar.openCreateProject">
            <Plus :size="14" />
          </button>
        </div>

        <!-- Smart Views - Using DateDropZone for drag and drop functionality -->
        <div class="smart-views">
          <!-- Today - Azure highlight -->
          <DateDropZone
            :active="taskStore.activeSmartView === 'today'"
            :count="todayTaskCount"
            target-type="today"
            filter-color="azure"
            @click="selectSmartView('today')"
          >
            <template #icon>
              <Calendar :size="16" />
            </template>
            Today
          </DateDropZone>

          <!-- This Week - Azure-dark highlight -->
          <DateDropZone
            :active="taskStore.activeSmartView === 'week'"
            :count="weekTaskCount"
            target-type="today"
            filter-color="azure-dark"
            @click="selectSmartView('week')"
          >
            <template #icon>
              <Calendar :size="16" />
            </template>
            This Week
          </DateDropZone>

          <!-- Uncategorized Tasks -->
          <div class="smart-view-uncategorized">
            <!-- All Active Tasks - Blue highlight -->
            <DateDropZone
              :active="taskStore.activeSmartView === 'all_active'"
              :count="allActiveCount"
              target-type="nodate"
              filter-color="blue"
              @click="selectSmartView('all_active')"
            >
              <template #icon>
                <List :size="16" />
              </template>
              All Active
            </DateDropZone>

            <button
              class="uncategorized-filter"
              :class="{ active: taskStore.activeSmartView === 'uncategorized' }"
              title="Show Uncategorized Tasks"
              @click="selectSmartView('uncategorized')"
            >
              <Inbox :size="16" />
              <span>Uncategorized Tasks</span>
              <span
                v-if="uncategorizedCount > 0"
                class="filter-badge"
                :class="{ 'badge-active': taskStore.activeSmartView === 'uncategorized' }"
              >
                {{ uncategorizedCount }}
              </span>
            </button>

            <!-- Quick Sort Button (shows when uncategorized filter is active) -->
            <button
              v-if="taskStore.activeSmartView === 'uncategorized' && uncategorizedCount > 0"
              class="quick-sort-button"
              title="Start Quick Sort to categorize these tasks"
              @click="handleStartQuickSort"
            >
              <Zap :size="16" />
              <span>Quick Sort</span>
            </button>
          </div>
        </div>

        <!-- By Duration Section -->
        <div class="projects-divider" />
        <div class="section-header">
          <h3 class="section-title">
            <Clock :size="16" class="section-icon" />
            By Duration
          </h3>
        </div>

        <div class="smart-views duration-views">
          <DateDropZone
            :active="taskStore.activeSmartView === 'quick'"
            :count="quickCount"
            target-type="nodate"
            filter-color="green"
            @click="selectSmartView('quick')"
          >
            <template #icon>
              <Zap :size="16" />
            </template>
            Quick (< 15m)
          </DateDropZone>

          <DateDropZone
            :active="taskStore.activeSmartView === 'short'"
            :count="shortCount"
            target-type="nodate"
            filter-color="lime"
            @click="selectSmartView('short')"
          >
            <template #icon>
              <Timer :size="16" />
            </template>
            Short (15-30m)
          </DateDropZone>

          <DateDropZone
            :active="taskStore.activeSmartView === 'medium'"
            :count="mediumCount"
            target-type="nodate"
            filter-color="orange"
            @click="selectSmartView('medium')"
          >
            <template #icon>
              <Timer :size="16" />
            </template>
            Medium (30-60m)
          </DateDropZone>

          <DateDropZone
            :active="taskStore.activeSmartView === 'long'"
            :count="longCount"
            target-type="nodate"
            filter-color="red"
            @click="selectSmartView('long')"
          >
            <template #icon>
              <Clock :size="16" />
            </template>
            Long (> 60m)
          </DateDropZone>

          <DateDropZone
            :active="taskStore.activeSmartView === 'unestimated'"
            :count="unestimatedCount"
            target-type="nodate"
            filter-color="gray"
            @click="selectSmartView('unestimated')"
          >
            <template #icon>
              <HelpCircle :size="16" />
            </template>
            Unestimated
          </DateDropZone>
        </div>

        <!-- Projects Section Header -->
        <div class="projects-divider" />

        <!-- Project List - Recursive tree rendering with accessibility -->
        <nav
          class="projects-list"
          role="tree"
          aria-label="Projects"
          :aria-activedescendant="taskStore.activeProjectId ? `project-${taskStore.activeProjectId}` : undefined"
          @keydown="handleProjectTreeKeydown"
        >
          <ProjectTreeItem
            v-for="project in taskStore.projects.filter(p => !p.parentId)"
            :key="project.id"
            :project="project"
            :expanded-projects="sidebar.expandedProjects.value || []"
            :level="1"
            @click="sidebar.selectProject"
            @toggle-expand="sidebar.toggleProjectExpansion"
            @contextmenu="handleProjectContextMenu"
            @project-drop="() => {}"
          />
        </nav>
      </div>
    </aside>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import { useTaskStore, type Project } from '@/stores/tasks'
import { useSidebarManagement } from '@/composables/app/useSidebarManagement'
import { 
  Plus, PanelLeftClose, Settings, FolderOpen, 
  Calendar, List, Inbox, Zap, Clock, Timer, HelpCircle 
} from 'lucide-vue-next'

import BaseButton from '@/components/base/BaseButton.vue'
import DateDropZone from '@/components/DateDropZone.vue'
import ProjectTreeItem from '@/components/ProjectTreeItem.vue'

const router = useRouter()
const uiStore = useUIStore()
const taskStore = useTaskStore()
const sidebar = useSidebarManagement()

// Quick Task Logic
const quickTaskRef = ref<HTMLInputElement | null>(null)

const createQuickTask = async () => {
  if (!quickTaskRef.value || !quickTaskRef.value.value.trim()) return

  const title = quickTaskRef.value.value.trim()
  try {
    await taskStore.createTaskWithUndo({
      title,
      description: '',
      status: 'planned',
      projectId: undefined
    })
    quickTaskRef.value.value = ''
  } catch (error) {
    console.error('Error creating quick task:', error)
  }
}

// Smart View Counts
const todayTaskCount = computed(() => taskStore.smartViewTaskCounts.today)
const weekTaskCount = computed(() => taskStore.smartViewTaskCounts.week)
const allActiveCount = computed(() => taskStore.smartViewTaskCounts.allActive)
const uncategorizedCount = computed(() => taskStore.getUncategorizedTaskCount())
const quickCount = computed(() => taskStore.smartViewTaskCounts.quick)
const shortCount = computed(() => taskStore.smartViewTaskCounts.short)
const mediumCount = computed(() => taskStore.smartViewTaskCounts.medium)
const longCount = computed(() => taskStore.smartViewTaskCounts.long)
const unestimatedCount = computed(() => taskStore.smartViewTaskCounts.unestimated)

// Methods
const selectSmartView = (view: string) => {
  taskStore.activeProjectId = null
  taskStore.activeSmartView = view as any
}

const handleStartQuickSort = () => {
  router.push('/quick-sort')
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

// Expose focus method
defineExpose({
  focusQuickTask: () => {
    quickTaskRef.value?.focus()
  }
})
</script>

<style scoped>
/* LEFT SIDEBAR - Glass effect */
.sidebar {
  /* Remove fixed width - let CSS Grid control the width */
  min-width: 240px; /* Minimum width for usability */
  max-width: 340px; /* Maximum width to prevent overly wide sidebar */
  width: 100%; /* Fill the grid column */
  background: linear-gradient(
    135deg,
    var(--glass-border) 0%,
    var(--glass-bg-soft) 100%
  );
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  border-right: 1px solid var(--glass-border-hover);
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  position: relative;
  z-index: 100;
  box-shadow:
    var(--shadow-2xl),
    inset -1px 0 0 var(--glass-bg-heavy);
  contain: layout style; /* Performance optimization */
  overflow: hidden; /* Prevent sidebar content from causing horizontal scroll */
}

/* Sidebar toggle transitions */
.sidebar-slide-enter-active,
.sidebar-slide-leave-active {
  transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1),
              opacity 300ms cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform, opacity;
}

.sidebar-slide-enter-from,
.sidebar-slide-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

.sidebar-slide-enter-to,
.sidebar-slide-leave-from {
  transform: translateX(0);
  opacity: 1;
}

.sidebar-header {
  padding: var(--space-10) var(--space-6) var(--space-6) var(--space-6);
  border-bottom: 1px solid var(--glass-bg-heavy);
  background: linear-gradient(
    180deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-weak) 100%
  );
}

.app-brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-6);
}

.brand-icon {
  font-size: var(--text-xl);
}

.brand-text {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

/* Sidebar header buttons */
.sidebar-header button {
  width: 100%;
}

/* Icon button group */
.icon-button-group {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.icon-btn {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-secondary);
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.icon-btn:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  color: var(--text-primary);
  box-shadow: var(--state-hover-shadow);
}

.icon-btn:active {
  transform: scale(0.95);
}

/* Quick Task Section */
.quick-task-section {
  padding: 8px;
  background: var(--glass-bg-soft);
  border-radius: 8px;
  margin: var(--space-4) var(--space-6);
}

.quick-task-input {
  width: 100%;
  padding: 10px;
  background: var(--glass-bg-tint);
  border: 1px solid var(--glass-border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 14px;
}

.quick-task-input:focus {
  outline: none;
  border-color: var(--brand-primary);
  background: var(--glass-bg-light);
}

.task-management-section {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4) var(--space-6);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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
  transition: all 150ms ease;
}

.add-project-btn:hover {
  background: var(--surface-hover);
  border-color: var(--border-strong);
  color: var(--text-secondary);
}

/* Smart Views Section */
.smart-views {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-bottom: var(--space-4);
}

/* Uncategorized Filter Styles */
.smart-view-uncategorized {
  margin-top: var(--space-2);
  border-top: 1px solid var(--glass-bg-heavy);
  padding-top: var(--space-2);
}

.uncategorized-filter {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.uncategorized-filter:hover {
  background: var(--surface-hover);
  color: var(--text-secondary);
  border-color: var(--border-medium);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.uncategorized-filter.active {
  background: var(--brand-primary-bg-subtle);
  border-color: var(--brand-primary-border-medium);
  color: var(--brand-primary);
  font-weight: var(--font-semibold);
  box-shadow: var(--brand-primary-glow-subtle);
}

.uncategorized-filter .filter-badge {
  margin-left: auto;
  background: var(--glass-bg-heavy);
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  min-width: 20px;
  text-align: center;
  border: 1px solid var(--glass-border);
  transition: all var(--duration-fast) var(--spring-smooth);
}

.uncategorized-filter .filter-badge.badge-active {
  background: var(--brand-primary);
  color: white;
  border-color: var(--brand-primary);
  box-shadow: var(--brand-primary-glow-subtle);
}

/* Quick Sort Button */
.quick-sort-button {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: linear-gradient(135deg, var(--brand-primary-bg-subtle), var(--brand-primary-bg-medium));
  border: 1px solid var(--brand-primary-border-medium);
  border-radius: var(--radius-lg);
  color: var(--brand-primary);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: var(--brand-primary-glow-subtle);
}

.quick-sort-button:hover {
  background: linear-gradient(135deg, var(--brand-primary-bg-medium), var(--brand-primary-bg-heavy));
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  transform: translateY(-1px);
  box-shadow: var(--brand-primary-glow-medium);
}

.quick-sort-button:active {
  transform: translateY(0);
}

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

.projects-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  overflow-y: auto;
  max-height: calc(100vh - 500px); /* Leave space for header and controls */
  padding-right: var(--space-2); /* Prevent scroll from interfering with content */
}

/* RTL Support */
[dir="rtl"] .sidebar {
  border-right: none;
  border-left: 1px solid var(--glass-border-hover);
  box-shadow:
    var(--shadow-2xl),
    inset 1px 0 0 var(--glass-bg-heavy);
}

[dir="rtl"] .sidebar-slide-enter-from,
[dir="rtl"] .sidebar-slide-leave-to {
  transform: translateX(100%);
}
</style>
