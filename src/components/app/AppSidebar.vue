<template>
  <aside v-show="uiStore.mainSidebarVisible" class="sidebar" aria-label="Main navigation" :aria-hidden="!uiStore.mainSidebarVisible">
    <!-- App Header -->
    <div class="sidebar-header">
      <div class="app-brand">
        <span class="brand-icon">🍅</span>
        <span class="brand-text">Pomo-Flow</span>
      </div>
      <BaseButton variant="secondary" size="md" @click="openCreateProject">
        <Plus :size="14" />
        Create project
      </BaseButton>

      <div class="icon-button-group">
        <button
          class="icon-btn"
          @click="uiStore.toggleMainSidebar"
          :title="'Hide Sidebar'"
          aria-label="Hide sidebar"
        >
          <PanelLeftClose :size="18" />
        </button>

        <button
          class="icon-btn"
          @click="uiStore.openSettingsModal()"
          title="Settings"
          aria-label="Open settings"
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
        />
      </div>
    </div>

    <!-- Project & Task Management -->
    <div class="task-management-section">
      <div class="section-header">
        <h3 class="section-title">
          <FolderOpen :size="16" class="section-icon" />
          Projects
        </h3>
        <button class="add-project-btn" @click="openCreateProject" title="Add Project">
          <Plus :size="14" />
        </button>
      </div>

      <!-- Smart Views - Using DateDropZone for drag and drop functionality -->
      <div class="smart-views">
        <!-- Today -->
        <DateDropZone
          :active="taskStore.activeSmartView === 'today'"
          :count="todayTaskCount"
          target-type="today"
          @click="selectSmartView('today')"
        >
          <template #icon>
            <Calendar :size="16" />
          </template>
          Today
        </DateDropZone>

        <!-- This Week -->
        <DateDropZone
          :active="taskStore.activeSmartView === 'week'"
          :count="weekTaskCount"
          target-type="week"
          @click="selectSmartView('week')"
        >
          <template #icon>
            <Calendar :size="16" />
          </template>
          This Week
        </DateDropZone>

        <!-- Uncategorized Tasks (My Tasks) -->
        <div class="smart-view-uncategorized">
          <!-- All Tasks -->
          <DateDropZone
            :active="taskStore.activeSmartView === 'above_my_tasks'"
            :count="aboveMyTasksCount"
            target-type="above_my_tasks"
            @click="selectSmartView('above_my_tasks')"
          >
            <template #icon>
              <List :size="16" />
            </template>
            All Tasks
          </DateDropZone>

          <button
            class="uncategorized-filter"
            :class="{ active: taskStore.activeSmartView === 'uncategorized' }"
            @click="selectSmartView('uncategorized')"
            title="Show Uncategorized Tasks"
          >
            <Inbox :size="16" />
            <span>My Tasks</span>
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
            @click="handleStartQuickSort"
            title="Start Quick Sort to categorize these tasks"
          >
            <Zap :size="16" />
            <span>Quick Sort</span>
          </button>
        </div>
      </div>

      <!-- Projects Section Header -->
      <div class="projects-divider"></div>

      <!-- Project List - Recursive tree rendering with accessibility -->
      <nav
        class="projects-list"
        role="tree"
        aria-label="Projects"
        :aria-activedescendant="taskStore.activeProjectId ? `project-${taskStore.activeProjectId}` : undefined"
        @keydown="handleProjectTreeKeydown"
      >
        <ProjectTreeItem
          v-for="project in rootProjects"
          :key="project.id"
          :project="project"
          :expanded-projects="expandedProjects"
          :level="1"
          @click="selectProject"
          @toggle-expand="toggleProjectExpansion"
          @contextmenu="$emit('project-context-menu', $event, project)"
          @project-drop="() => {}"
        />
      </nav>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useSidebarManagement } from '@/composables/app/useSidebarManagement'
import { useUIStore } from '@/stores/ui'
import { useTaskStore } from '@/stores/tasks'
import BaseButton from '@/components/base/BaseButton.vue'
import DateDropZone from '@/components/DateDropZone.vue'
import ProjectTreeItem from '@/components/ProjectTreeItem.vue'
import {
  Plus, Settings, FolderOpen, ChevronDown,
  Calendar, Edit, Trash2, Copy, Palette,
  PanelLeftClose, Zap, List, Inbox
} from 'lucide-vue-next'

// Use sidebar management composable
const {
  // State
  newTaskTitle,
  expandedProjects,
  showProjectModal,
  editingProject,

  // Computed properties
  rootProjects,
  todayTaskCount,
  weekTaskCount,
  aboveMyTasksCount,
  uncategorizedCount,

  // Task management methods
  createQuickTask,

  // Project navigation methods
  toggleProjectExpansion,
  selectProject,
  handleProjectTreeKeydown,
  selectSmartView,
  handleStartQuickSort,

  // Project management methods
  openCreateProject
} = useSidebarManagement()

// Store references
const uiStore = useUIStore()
const taskStore = useTaskStore()

// Emit events for parent component handling
defineEmits<{
  'project-context-menu': [event: MouseEvent, project: any]
}>()
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
  box-shadow: var(--brand-primary-glow-subtle);
}
</style>