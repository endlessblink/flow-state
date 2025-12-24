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
        <!-- Smart Views - Using DateDropZone for drag and drop functionality -->
        <div class="smart-views-grid">
          <!-- Today -->
          <SidebarSmartItem
            :active="taskStore.activeSmartView === 'today'"
            :count="todayTaskCount"
            drop-type="date"
            drop-value="today"
            color="azure"
            compact
            @click="selectSmartView('today')"
          >
            <template #icon><Calendar :size="14" /></template>
            Today
          </SidebarSmartItem>

          <!-- This Week -->
          <SidebarSmartItem
            :active="taskStore.activeSmartView === 'week'"
            :count="weekTaskCount"
            drop-type="date"
            drop-value="weekend"
            color="azure-dark"
            compact
            @click="selectSmartView('week')"
          >
            <template #icon><Calendar :size="14" /></template>
            This Week
          </SidebarSmartItem>
        </div>

        <div class="sidebar-sub-divider" />

        <div class="smart-views-grid secondary">
          <!-- All Active -->
          <SidebarSmartItem
            :active="taskStore.activeSmartView === 'all_active'"
            :count="allActiveCount"
            drop-type="date"
            drop-value="nodate"
            color="blue"
            compact
            @click="selectSmartView('all_active')"
          >
            <template #icon><List :size="14" /></template>
            All Active
          </SidebarSmartItem>

          <!-- Uncategorized (Inbox) -->
          <SidebarSmartItem
            :active="taskStore.activeSmartView === 'uncategorized'"
            :count="uncategorizedCount"
            drop-type="date"
            drop-value="nodate"
            color="orange"
            compact
            @click="selectSmartView('uncategorized')"
          >
            <template #icon><Inbox :size="14" /></template>
            Inbox
          </SidebarSmartItem>
        </div>

        <!-- Quick Sort Button (shows when uncategorized filter is active) -->
        <Transition name="fade">
          <button
            v-if="taskStore.activeSmartView === 'uncategorized' && uncategorizedCount > 0"
            class="quick-sort-button-full"
            title="Start Quick Sort to categorize these tasks"
            @click="handleStartQuickSort"
          >
            <Zap :size="16" />
            <span>Categorize Inbox ({{ uncategorizedCount }})</span>
          </button>
        </Transition>

        <!-- Duration Groups - Collapsible Section -->
        <div class="duration-section">
          <button 
            class="section-toggle" 
            @click="sidebar.toggleDurationSection"
            :aria-expanded="sidebar.isDurationSectionExpanded.value"
          >
            <Clock :size="14" />
            <span>By Duration</span>
            <ChevronRight 
              :size="14" 
              class="toggle-chevron" 
              :class="{ rotated: sidebar.isDurationSectionExpanded.value }" 
            />
          </button>
          
          <div v-show="sidebar.isDurationSectionExpanded.value" class="duration-grid">
            <!-- Quick (<15m) -->
            <SidebarSmartItem
              :active="taskStore.activeSmartView === 'quick'"
              :count="sidebar.quickCount.value"
              drop-type="duration"
              :drop-value="15"
              color="green"
              compact
              @click="sidebar.selectSmartView('quick')"
            >
              <template #icon><Zap :size="14" /></template>
              Quick
            </SidebarSmartItem>

            <!-- Short (15-30m) -->
            <SidebarSmartItem
              :active="taskStore.activeSmartView === 'short'"
              :count="sidebar.shortCount.value"
              drop-type="duration"
              :drop-value="30"
              color="teal"
              compact
              @click="sidebar.selectSmartView('short')"
            >
              <template #icon><Coffee :size="14" /></template>
              Short
            </SidebarSmartItem>

            <!-- Medium (30-60m) -->
            <SidebarSmartItem
              :active="taskStore.activeSmartView === 'medium'"
              :count="sidebar.mediumCount.value"
              drop-type="duration"
              :drop-value="60"
              color="teal"
              compact
              @click="sidebar.selectSmartView('medium')"
            >
              <template #icon><Hourglass :size="14" /></template>
              Medium
            </SidebarSmartItem>

            <!-- Long (>60m) -->
            <SidebarSmartItem
              :active="taskStore.activeSmartView === 'long'"
              :count="sidebar.longCount.value"
              drop-type="duration"
              :drop-value="120"
              color="purple"
              compact
              @click="sidebar.selectSmartView('long')"
            >
              <template #icon><Mountain :size="14" /></template>
              Long
            </SidebarSmartItem>

            <!-- Unestimated -->
            <SidebarSmartItem
              :active="taskStore.activeSmartView === 'unestimated'"
              :count="sidebar.unestimatedCount.value"
              drop-type="duration"
              :drop-value="-1"
              color="gray"
              compact
              @click="sidebar.selectSmartView('unestimated')"
            >
              <template #icon><HelpCircle :size="14" /></template>
              No Estimate
            </SidebarSmartItem>
          </div>
        </div>

        <!-- Projects Section Header -->
        <div class="projects-divider" />
        <div class="section-header">
          <h3 class="section-title">
            <FolderOpen :size="16" class="section-icon" />
            Projects
          </h3>
          <button class="add-project-btn" title="Add Project" @click="sidebar.openCreateProject">
            <Plus :size="14" />
          </button>
        </div>

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
  Calendar, List, Inbox, Zap, Clock, Timer, HelpCircle,
  ChevronRight, Coffee, Hourglass, Mountain
} from 'lucide-vue-next'

import BaseButton from '@/components/base/BaseButton.vue'
import SidebarSmartItem from '@/components/layout/SidebarSmartItem.vue'
import ProjectTreeItem from '@/components/projects/ProjectTreeItem.vue'

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
    rgba(255, 255, 255, 0.03) 0%,
    rgba(255, 255, 255, 0.01) 100%
  );
  backdrop-filter: blur(40px) saturate(200%);
  -webkit-backdrop-filter: blur(40px) saturate(200%);
  border-right: 1px solid var(--glass-border);
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
  border-bottom: 1px solid var(--glass-border);
  background: var(--glass-bg-medium);
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
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
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


/* Quick Sort Button */

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
/* Duration Section */
.duration-section {
  margin-bottom: var(--space-4);
}

.section-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-1);
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  letter-spacing: 0.05em;
  cursor: pointer;
  text-transform: uppercase;
  margin-bottom: var(--space-2);
}

.section-toggle:hover {
  color: var(--text-secondary);
}

.toggle-chevron {
  margin-left: auto;
  transition: transform var(--duration-fast);
  opacity: 0.5;
}

.toggle-chevron.rotated {
  transform: rotate(90deg);
}

.smart-views-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-2);
  padding: var(--space-4) var(--space-4) var(--space-2) var(--space-4);
}

.smart-views-grid.secondary {
  padding-top: var(--space-2);
  padding-bottom: var(--space-4);
}

.sidebar-sub-divider {
  height: 1px;
  background: var(--glass-border);
  margin: var(--space-1) var(--space-4);
  opacity: 0.3;
}

.quick-sort-button-full {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: calc(100% - 32px);
  margin: 0 16px var(--space-4) 16px;
  padding: var(--space-2);
  background: var(--brand-primary);
  color: #0a0a0a;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal);
  box-shadow: var(--shadow-sm);
}

.quick-sort-button-full:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
  filter: brightness(1.1);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.duration-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-2);
  padding: 0 var(--space-4) var(--space-4) var(--space-4);
}
</style>
