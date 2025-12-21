<template>
  <aside
    v-show="true"
    class="sidebar"
    aria-label="Main navigation"
    aria-hidden="false"
  >
    <!-- App Header -->
    <div class="sidebar-header">
      <div class="app-brand">
        <span class="brand-icon">🍅</span>
        <span class="brand-text">Pomo-Flow v9 - DEBUGGING TEST</span>
      </div>
      <BaseButton variant="secondary" size="md" @click="() => {}">
        <Plus :size="14" />
        Create project
      </BaseButton>

      <div class="icon-button-group">
        <button
          class="icon-btn"
          title="Hide Sidebar"
          aria-label="Hide sidebar"
          @click="() => {}"
        >
          <PanelLeftClose :size="18" />
        </button>

        <button
          class="icon-btn"
          title="Settings"
          aria-label="Open settings"
          @click="() => {}"
        >
          <Settings :size="18" />
        </button>
      </div>
    </div>

    <!-- Quick Task Creation -->
    <div class="quick-add-section">
      <div class="quick-add-input">
        <Plus :size="16" class="add-icon" />
        <input
          v-model="newTaskTitle"
          type="text"
          placeholder="Add a task..."
          class="task-input"
          @keyup.enter="createQuickTask"
        >
      </div>
    </div>

    <!-- Project & Task Management -->
    <div class="task-management-section">
      <div class="section-header">
        <h3 class="section-title">
          <FolderOpen :size="16" class="section-icon" />
          Projects
        </h3>
        <button class="add-project-btn" title="Add Project" @click="() => {}">
          <Plus :size="14" />
        </button>
      </div>

      <!-- Smart Views - Using DateDropZone for drag and drop functionality -->
      <div class="smart-views">
        <!-- Today - Purple highlight -->
        <DateDropZone
          :active="activeSmartView === 'today'"
          :count="todayTaskCount"
          target-type="today"
          filter-color="azure"
          @click="handleSmartViewClick('today')"
        >
          <template #icon>
            <Calendar :size="16" />
          </template>
          Today
        </DateDropZone>

        <!-- This Week - Indigo highlight -->
        <DateDropZone
          :active="activeSmartView === 'week'"
          :count="weekTaskCount"
          target-type="weekend"
          filter-color="azure-dark"
          @click="handleSmartViewClick('week')"
        >
          <template #icon>
            <Calendar :size="16" />
          </template>
          This Week
        </DateDropZone>

        <!-- Uncategorized Tasks Section -->
        <div class="smart-view-uncategorized">
          <!-- All Active Tasks - Blue highlight -->
          <DateDropZone
            :active="activeSmartView === null && activeProjectId === null"
            :count="allTasksCount"
            target-type="nodate"
            filter-color="blue"
            @click="handleAllTasksClick"
          >
            <template #icon>
              <List :size="16" />
            </template>
            All Tasks
          </DateDropZone>

          <button
            class="uncategorized-filter"
            :class="{ active: activeSmartView === 'uncategorized' }"
            title="Show Uncategorized Tasks"
            @click="handleUncategorizedClick"
          >
            <Inbox :size="16" />
            <span>Uncategorized Tasks</span>
            <span class="filter-badge">
              {{ uncategorizedTaskCount }}
            </span>
          </button>
        </div>
      </div>

      <!-- Projects Section Header -->
      <div class="projects-divider" />

    
      <!-- Project List - Using ProjectTreeItem components -->
      <nav
        class="projects-list"
        role="tree"
        aria-label="Projects"
      >
        <ProjectTreeItem
          v-for="project in rootProjects"
          :key="project.id"
          :project="project"
          :expanded-projects="[]"
          :nested="false"
          :nesting-depth="0"
          :level="1"
          @click="(project) => handleProjectClick(project)"
          @contextmenu="(event, project) => $emit('projectContextMenu', event, project)"
        />
      </nav>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import type { Project } from '@/stores/tasks'
import { useUIStore } from '@/stores/ui'
import ProjectTreeItem from '../ProjectTreeItem.vue'

// Emit events for parent component handling
defineEmits<{
  projectContextMenu: [event: MouseEvent, project: Project]
}>()

console.log('🎯 AppSidebar: Using Board view pattern - script running!')

// Exact same pattern as Board view (line 100)
const taskStore = useTaskStore()
const _uiStore = useUIStore()

// Quick task creation
const newTaskTitle = ref('')

// Use the exact same pattern as Board view (line 168-177) but for root projects only
const rootProjects = computed(() => {
  console.log('🎯 AppSidebar: Computing rootProjects, taskStore.projects length:', taskStore.projects?.length || 0)

  // Filter for root projects only (no parentId) - same logic as Board view
  const projects = taskStore.projects.filter(project => !project.parentId)

  console.log('🎯 AppSidebar: Root projects found:', projects.length, projects.map(p => ({ id: p.id, name: p.name })))

  return projects
})

// CENTRALIZED TASK COUNTS - Using store's unified count system
// These counts now respect combined filters (smart view + project filter)
const todayTaskCount = computed(() => taskStore.smartViewTaskCounts.today)
const weekTaskCount = computed(() => taskStore.smartViewTaskCounts.week)
const allTasksCount = computed(() => taskStore.smartViewTaskCounts.all)
const uncategorizedTaskCount = computed(() => taskStore.smartViewTaskCounts.uncategorized)

// Active filter state from store
const activeSmartView = computed(() => taskStore.activeSmartView)
const activeProjectId = computed(() => taskStore.activeProjectId)

const handleProjectClick = (project: Project) => {
  console.log('🎯 AppSidebar: Project clicked:', project.name)
  taskStore.setActiveProject(project.id)
}

// Smart view click handlers
const handleSmartViewClick = (view: 'today' | 'week') => {
  console.log('🎯 AppSidebar: Smart view clicked:', view)
  taskStore.setSmartView(view)
}

// "All Tasks" clears all filters
const handleAllTasksClick = () => {
  console.log('🎯 AppSidebar: All Tasks clicked - clearing all filters')
  taskStore.setActiveProject(null)
  taskStore.setSmartView(null)
}

// "Uncategorized Tasks" clears project filter and sets uncategorized view
const handleUncategorizedClick = () => {
  console.log('🎯 AppSidebar: Uncategorized clicked - clearing project filter')
  taskStore.setActiveProject(null)
  taskStore.setSmartView('uncategorized')
}

const createQuickTask = async () => {
  if (newTaskTitle.value.trim()) {
    // Create task using the task store (same as Board view)
    taskStore.createTask({
      title: newTaskTitle.value.trim(),
      description: '',
      status: 'planned',
      projectId: undefined
    })
    newTaskTitle.value = ''
  }
}

console.log('🎯 AppSidebar: Script setup completed successfully!')

</script>

<style scoped>
/* Sidebar styles inherited from App.vue */
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
  margin-top: var(--space-2);
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

/* Task Management Sidebar */
.quick-add-section {
  padding: var(--sidebar-quickadd-padding-y) var(--sidebar-quickadd-padding-x);
  border-bottom: 1px solid var(--border-subtle);
}

.quick-add-input {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: var(--shadow-md);
}

.quick-add-input:focus-within {
  border-color: var(--calendar-creating-border);
  background: linear-gradient(
    135deg,
    var(--glass-bg-heavy) 0%,
    var(--glass-bg-tint) 100%
  );
  box-shadow:
    var(--calendar-creating-bg),
    var(--shadow-lg);
}

.add-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.task-input {
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-sm);
  width: 100%;
  outline: none;
}

.task-input::placeholder {
  color: var(--text-muted);
  opacity: 0.7;
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

/* Simple project item styling */
.project-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  border: 1px solid transparent;
}

.project-item:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.project-item.is-active {
  background: var(--state-active-bg);
  border: 1px solid var(--state-active-border);
  color: var(--text-primary);
  font-weight: var(--font-semibold);
  box-shadow: var(--state-hover-shadow);
}

.project-emoji {
  font-size: 16px;
  flex-shrink: 0;
  opacity: 0.9;
}

.project-item:hover .project-emoji {
  opacity: 1;
  transform: scale(1.1);
}

.project-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-count {
  background: var(--glass-bg-heavy);
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  min-width: 20px;
  text-align: center;
  border: 1px solid var(--glass-border);
  transition: all var(--duration-fast);
}

.project-item.is-active .project-count {
  background: var(--brand-primary);
  color: white;
  border-color: var(--brand-primary);
  box-shadow: var(--brand-primary-glow-subtle);
}

/* Ensure the project tree items can use full width */
.projects-list .project-tree-item {
  width: 100%;
}

.project-group {
  display: flex;
  flex-direction: column;
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
  background: var(--filter-uncategorized-bg);
  border-color: var(--filter-uncategorized-border);
  color: rgb(245, 158, 11); /* Orange text */
  font-weight: var(--font-semibold);
  box-shadow: var(--filter-uncategorized-glow);
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
  box-shadow: var(--brand-primary-glow-subtle);
}

/* Projects Empty State */
.projects-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8) var(--space-4);
  text-align: center;
  min-height: 120px;
}

.empty-message {
  color: var(--text-muted);
  font-size: var(--text-sm);
  margin-bottom: var(--space-4);
  font-style: italic;
}

.projects-empty .base-button {
  min-width: 140px;
}
</style><!-- DIAGNOSTIC TEST ADDITION -->
TEST FILE CHANGE AT Thu Nov 27 02:22:48 PM IST 2025
 
// HMR test Thu Nov 27 03:34:13 PM IST 2025
 
// HMR FAST POLL TEST Thu Nov 27 03:38:11 PM IST 2025
 
// WATCHMAN TEST Thu Nov 27 03:42:36 PM IST 2025
// HMR NATIVE INOTIFY TEST Thu Nov 27 03:47:49 PM IST 2025
