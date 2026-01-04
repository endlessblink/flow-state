<template>
  <div v-if="isOpen" class="search-modal-overlay" @click="$emit('close')">
    <div class="search-modal-content" @click.stop>
      <div class="search-header">
        <div class="search-input-wrapper">
          <Search :size="20" class="search-icon" />
          <input
            ref="searchInput"
            v-model="searchQuery"
            type="text"
            placeholder="Search tasks, projects..."
            class="search-input"
            @keydown="handleKeydown"
            @keydown.enter="selectResult"
            @keydown.arrow-down="moveSelection(1)"
            @keydown.arrow-up="moveSelection(-1)"
            @keydown.escape="$emit('close')"
          >
        </div>
        <kbd class="shortcut-esc">Esc</kbd>
      </div>

      <div v-if="searchQuery.trim()" class="search-results">
        <!-- Tasks Section -->
        <div v-if="filteredTasks.length > 0" class="result-section">
          <div class="section-header">
            <FileText :size="16" />
            <span>Tasks ({{ filteredTasks.length }})</span>
          </div>
          <div
            v-for="(task, index) in filteredTasks"
            :key="`task-${task.id}`"
            class="result-item"
            :class="{ active: selectedIndex === tasksStartIndex + index }"
            @click="selectTask(task)"
            @mouseenter="selectedIndex = tasksStartIndex + index"
          >
            <div class="result-content">
              <!-- eslint-disable-next-line vue/no-v-html -->
              <div class="result-title" v-html="highlightMatch(task.title)" />
              <div class="result-meta">
                <span v-if="task.projectName" class="result-project">{{ task.projectName }}</span>
                <span class="result-status">{{ task.status || 'No status' }}</span>
              </div>
            </div>
            <ChevronRight :size="16" class="result-arrow" />
          </div>
        </div>

        <!-- Projects Section -->
        <div v-if="filteredProjects.length > 0" class="result-section">
          <div class="section-header">
            <FolderOpen :size="16" />
            <span>Projects ({{ filteredProjects.length }})</span>
          </div>
          <div
            v-for="(project, index) in filteredProjects"
            :key="`project-${project.id}`"
            class="result-item"
            :class="{ active: selectedIndex === projectsStartIndex + index }"
            @click="selectProject(project)"
            @mouseenter="selectedIndex = projectsStartIndex + index"
          >
            <div class="result-content">
              <!-- eslint-disable-next-line vue/no-v-html -->
              <div class="result-title" v-html="highlightMatch(project.name)" />
              <div class="result-meta">
                <span class="project-color" :style="{ backgroundColor: project.color as string }" />
                <span>{{ getTaskCountForProject(project.id) }} tasks</span>
              </div>
            </div>
            <ChevronRight :size="16" class="result-arrow" />
          </div>
        </div>

        <!-- No Results -->
        <div v-if="filteredTasks.length === 0 && filteredProjects.length === 0" class="no-results">
          <Search :size="32" />
          <p>No results found for "{{ searchQuery }}"</p>
        </div>
      </div>

      <!-- Initial State - Minimal -->
      <div v-else class="search-empty">
        <span class="empty-hint">Type to search tasks and projects</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { Search, FileText, FolderOpen, ChevronRight } from 'lucide-vue-next'
import { highlightMatchSafe } from '@/utils/security'
import type { Task, Project } from '@/stores/tasks'

interface Props {
  isOpen: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  selectTask: [task: Task]
  selectProject: [project: Project]
}>()

const taskStore = useTaskStore()
const searchInput = ref<HTMLInputElement>()
const searchQuery = ref('')
const selectedIndex = ref(0)

// Computed properties for search results
const filteredTasks = computed(() => {
  if (!searchQuery.value.trim() || !taskStore?.tasks) return []
  
  const query = searchQuery.value.toLowerCase()
  return (taskStore.tasks || []).filter(task => {
    const titleMatch = task.title.toLowerCase().includes(query)
    const projectMatch = (task.projectId && taskStore.projects) ? 
      taskStore.projects.find(p => p.id === task.projectId)?.name.toLowerCase().includes(query) : 
      false
    const statusMatch = task.status?.toLowerCase().includes(query)
    
    return titleMatch || projectMatch || statusMatch
  }).map(task => ({
    ...task,
    projectName: (task.projectId && taskStore.projects) ? taskStore.projects.find(p => p.id === task.projectId)?.name : undefined
  })).slice(0, 8) // Limit results
})

const filteredProjects = computed(() => {
  if (!searchQuery.value.trim() || !taskStore?.projects) return []
  
  const query = searchQuery.value.toLowerCase()
  return taskStore.projects.filter(project => 
    project.name.toLowerCase().includes(query)
  ).slice(0, 5) // Limit results
})

// Calculate selection indices
const tasksStartIndex = 0
const projectsStartIndex = computed(() => tasksStartIndex + filteredTasks.value.length)

// Reset search when modal opens/closes
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    searchQuery.value = ''
    selectedIndex.value = 0
    nextTick(() => {
      searchInput.value?.focus()
    })
  }
})

// Handle keyboard navigation
const handleKeydown = (event: KeyboardEvent) => {
  // Prevent default for our handled keys
  if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(event.key)) {
    event.preventDefault()
  }
}

const moveSelection = (direction: number) => {
  const totalResults = filteredTasks.value.length + filteredProjects.value.length
  if (totalResults === 0) return
  
  selectedIndex.value = Math.max(0, Math.min(totalResults - 1, selectedIndex.value + direction))
}

const selectResult = () => {
  const totalResults = filteredTasks.value.length + filteredProjects.value.length
  if (totalResults === 0) return
  
  if (selectedIndex.value < filteredTasks.value.length) {
    // Select task
    const task = filteredTasks.value[selectedIndex.value]
    selectTask(task)
  } else {
    // Select project
    const projectIndex = selectedIndex.value - filteredTasks.value.length
    const project = filteredProjects.value[projectIndex]
    selectProject(project)
  }
}

const selectTask = (task: Task) => {
  emit('selectTask', task)
  emit('close')
}

const selectProject = (project: Project) => {
  emit('selectProject', project)
  emit('close')
}

// Utility functions
const highlightMatch = (text: string) => {
  return highlightMatchSafe(text, searchQuery.value)
}

const getTaskCountForProject = (projectId: string) => {
  return taskStore.tasks.filter(task => task.projectId === projectId).length
}

// Focus management
onMounted(() => {
  if (props.isOpen) {
    nextTick(() => {
      searchInput.value?.focus()
    })
  }
})
</script>

<style scoped>
.search-modal-overlay {
  position: fixed;
  inset: 0; /* RTL: full screen overlay */
  background: var(--overlay-bg);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 15vh;
  z-index: 3000;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  animation: fadeIn var(--duration-normal) var(--spring-smooth);
}

.search-modal-content {
  /* Glass morphism - dark with blur */
  background: rgba(20, 20, 20, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);

  /* Stroke border */
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-xl);

  /* Layered shadow */
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.5),
    0 8px 24px rgba(0, 0, 0, 0.3);

  width: 90%;
  max-width: 600px;
  max-height: 70vh;
  overflow: hidden;
  animation: scaleIn var(--duration-normal) var(--spring-bounce);

  /* Ensure backdrop-filter works */
  isolation: isolate;
  transform: translateZ(0);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.search-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.3);
}

.search-input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.search-input-wrapper:hover {
  border-color: rgba(255, 255, 255, 0.2);
}

.search-input-wrapper:focus-within {
  border-color: rgba(78, 205, 196, 0.5);
  box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.15);
}

.search-icon {
  color: var(--text-subtle);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: var(--text-base);
  font-family: var(--font-sans);
}

.search-input::placeholder {
  color: var(--text-subtle);
}

.shortcut-esc {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-sm);
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  color: var(--text-subtle);
  flex-shrink: 0;
}

.search-results {
  max-height: 400px;
  overflow-y: auto;
  padding: var(--space-2);
}

.result-section {
  margin-bottom: var(--space-4);
}

.result-section:last-child {
  margin-bottom: 0;
}

.section-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--space-2);
}

.result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  margin-bottom: var(--space-1);
}

.result-item:hover,
.result-item.active {
  background: var(--surface-hover);
}

.result-item.active {
  background: color-mix(in srgb, var(--brand-primary) 10%, var(--surface-hover));
}

.result-content {
  flex: 1;
  min-width: 0;
}

.result-title {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin-bottom: var(--space-1);
  line-height: 1.4;
}

.result-title :deep(mark) {
  background: color-mix(in srgb, var(--brand-primary) 20%, transparent);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  padding: 0 2px;
}

.result-meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-xs);
  color: var(--text-subtle);
}

.result-project {
  background: var(--surface-tertiary);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.result-status {
  background: var(--surface-quaternary);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.project-color {
  width: 12px;
  height: 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-secondary);
}

.result-arrow {
  color: var(--text-subtle);
  flex-shrink: 0;
  margin-inline-start: var(--space-2); /* RTL: result arrow spacing */
}

.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  text-align: center;
  color: var(--text-subtle);
}

.no-results svg {
  margin-bottom: var(--space-4);
  opacity: 0.5;
}

.no-results p {
  margin: 0;
  font-size: var(--text-sm);
}

.search-empty {
  padding: var(--space-6);
  text-align: center;
}

.empty-hint {
  font-size: var(--text-sm);
  color: var(--text-subtle);
}

/* Scrollbar styling */
.search-results::-webkit-scrollbar {
  width: 6px;
}

.search-results::-webkit-scrollbar-track {
  background: var(--surface-primary);
}

.search-results::-webkit-scrollbar-thumb {
  background: var(--border-hover);
  border-radius: var(--radius-sm);
}

.search-results::-webkit-scrollbar-thumb:hover {
  background: var(--border-active);
}
</style>