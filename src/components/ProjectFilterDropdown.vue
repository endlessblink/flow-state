<template>
  <div class="project-filter-dropdown" :class="{ 'is-open': isOpen }">
    <!-- Trigger button -->
    <button
      class="filter-trigger"
      :class="{ 'has-active-filter': activeProjectId }"
      @click="toggleDropdown"
      :title="getTriggerTitle()"
    >
      <div v-if="activeProject" class="project-indicator">
        <div
          v-if="activeProject.colorType === 'emoji' && activeProject.emoji"
          class="project-emoji"
        >
          {{ activeProject.emoji }}
        </div>
        <div
          v-else-if="activeProject.color"
          class="project-color"
          :style="{ backgroundColor: activeProject.color }"
        ></div>
      </div>
      <div v-else class="all-projects-icon">
        <ListTodo :size="16" />
      </div>

      <span class="filter-label">{{ getTriggerLabel() }}</span>
      <ChevronDown
        :size="14"
        class="dropdown-chevron"
        :class="{ 'is-open': isOpen }"
      />
    </button>

    <!-- Dropdown panel -->
    <Transition name="dropdown-slide">
      <div v-if="isOpen" class="dropdown-panel" @click.stop>
        <div class="dropdown-header">
          <h4>Filter by Project</h4>
        </div>

        <div class="project-list">
          <!-- All Projects option -->
          <button
            class="project-item"
            :class="{ active: !activeProjectId }"
            @click="selectProject(null)"
          >
            <div class="all-projects-icon">
              <ListTodo :size="16" />
            </div>
            <span class="project-name">All Projects</span>
            <div v-if="!activeProjectId" class="active-indicator">
              <Check :size="14" />
            </div>
          </button>

          <!-- Project items -->
          <button
            v-for="project in sortedProjects"
            :key="project.id"
            class="project-item"
            :class="{
              active: activeProjectId === project.id,
              'is-nested': project.parentId
            }"
            @click="selectProject(project.id)"
          >
            <div class="project-indicator">
              <div
                v-if="project.colorType === 'emoji' && project.emoji"
                class="project-emoji"
              >
                {{ project.emoji }}
              </div>
              <div
                v-else-if="project.color"
                class="project-color"
                :style="{ backgroundColor: project.color }"
              ></div>
            </div>

            <span class="project-name">{{ getNestedName(project) }}</span>

            <div class="task-count">{{ getProjectTaskCount(project.id) }}</div>

            <div v-if="activeProjectId === project.id" class="active-indicator">
              <Check :size="14" />
            </div>
          </button>
        </div>
      </div>
    </Transition>

    <!-- Click outside overlay -->
    <div
      v-if="isOpen"
      class="click-outside-overlay"
      @click="closeDropdown"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTaskStore, type Project } from '@/stores/tasks'
import { ChevronDown, ListTodo, Check } from 'lucide-vue-next'

const taskStore = useTaskStore()
const isOpen = ref(false)

// Computed properties
const activeProjectId = computed(() => taskStore.activeProjectId)
const activeProject = computed(() => {
  if (!activeProjectId.value) return null
  return taskStore.getProjectById(activeProjectId.value)
})

// Sort projects: root level first, then nested, alphabetically within each level
const sortedProjects = computed(() => {
  const projects = [...taskStore.projects]

  return projects.sort((a, b) => {
    // Root projects come first
    const aIsRoot = !a.parentId
    const bIsRoot = !b.parentId

    if (aIsRoot !== bIsRoot) {
      return aIsRoot ? -1 : 1
    }

    // Within the same level, sort alphabetically
    return a.name.localeCompare(b.name)
  })
})

// Methods
const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

const closeDropdown = () => {
  isOpen.value = false
}

const selectProject = (projectId: string | null) => {
  taskStore.setActiveProject(projectId)
  closeDropdown()
}

const getTriggerLabel = () => {
  if (!activeProjectId.value) return 'All Projects'
  return activeProject.value?.name || 'Unknown Project'
}

const getTriggerTitle = () => {
  if (!activeProjectId.value) return 'Show all projects'
  return `Filtering by project: ${getTriggerLabel()}`
}

const getNestedName = (project: Project) => {
  if (!project.parentId) return project.name

  // Get hierarchy for nested projects
  const hierarchy = taskStore.getProjectHierarchy(project.id)
  return hierarchy.map(p => p.name).join(' / ')
}

const getProjectTaskCount = (projectId: string): number => {
  const directTasks = taskStore.tasks.filter(task => task.projectId === projectId).length
  const childProjects = taskStore.projects.filter(p => p.parentId === projectId)
  const childTasks = childProjects.reduce((sum, child) => sum + getProjectTaskCount(child.id), 0)
  return directTasks + childTasks
}

// Handle click outside to close dropdown
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.project-filter-dropdown')) {
    closeDropdown()
  }
}

// Handle escape key to close dropdown
const handleEscapeKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleEscapeKey)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleEscapeKey)
})
</script>

<style scoped>
.project-filter-dropdown {
  position: relative;
  display: inline-block;
}

.filter-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  min-width: 140px;
  position: relative;
}

.filter-trigger:hover {
  background: linear-gradient(
    135deg,
    var(--state-hover-bg) 0%,
    var(--glass-bg-soft) 100%
  );
  border-color: var(--state-hover-border);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.filter-trigger.has-active-filter {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  color: var(--state-active-text);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.project-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.project-emoji {
  font-size: 16px;
  opacity: 0.9;
}

.project-color {
  width: 12px;
  height: 12px;
  border-radius: var(--radius-full);
  opacity: 0.9;
  flex-shrink: 0;
}

.all-projects-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  opacity: 0.8;
}

.filter-trigger.has-active-filter .all-projects-icon {
  color: var(--state-active-text);
  opacity: 1;
}

.filter-label {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-chevron {
  transition: transform var(--duration-fast) var(--spring-smooth);
  color: var(--text-muted);
  flex-shrink: 0;
}

.dropdown-chevron.is-open {
  transform: rotate(180deg);
}

.filter-trigger:hover .dropdown-chevron {
  color: var(--text-primary);
}

.dropdown-panel {
  position: absolute;
  top: calc(100% + var(--space-2));
  inset-inline: 0; /* RTL: full width dropdown panel */
  background: var(--surface-primary);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  z-index: 1000;
  min-width: 200px;
  max-width: 300px;
  max-height: 400px;
  overflow: hidden;
}

.dropdown-header {
  padding: var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
}

.dropdown-header h4 {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.project-list {
  overflow-y: auto;
  max-height: 350px;
}

.project-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  text-align: left;
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  position: relative;
}

.project-item:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.project-item.active {
  background: var(--state-active-bg);
  color: var(--state-active-text);
  font-weight: var(--font-semibold);
}

.project-item.is-nested {
  padding-inline-start: var(--space-8); /* RTL: nested project indentation */
}

.project-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.task-count {
  background: var(--glass-bg-heavy);
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  min-width: 20px;
  text-align: center;
  opacity: 0.8;
}

.project-item:hover .task-count,
.project-item.active .task-count {
  background: var(--glass-bg-tint);
  color: var(--text-secondary);
  opacity: 1;
}

.active-indicator {
  color: var(--brand-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.click-outside-overlay {
  position: fixed;
  inset: 0; /* RTL: full screen overlay */
  z-index: 999;
}

/* Transitions */
.dropdown-slide-enter-active,
.dropdown-slide-leave-active {
  transition: all var(--duration-normal) var(--spring-smooth);
}

.dropdown-slide-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.dropdown-slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Custom scrollbar for project list */
.project-list::-webkit-scrollbar {
  width: 6px;
}

.project-list::-webkit-scrollbar-track {
  background: transparent;
}

.project-list::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: var(--radius-md);
}

.project-list::-webkit-scrollbar-thumb:hover {
  background: var(--border-hover);
}
</style>