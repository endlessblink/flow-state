<template>
  <div class="category-selector">
    <h3 class="selector-title">Categorize as:</h3>

    <div class="category-grid">
      <button
        v-for="(node, index) in availableProjects"
        :key="node.project.id"
        class="category-button"
        :class="{ 'has-focus': focusedIndex === index, 'is-nested': node.depth > 0 }"
        :style="{ ...getCategoryStyle(node.project), '--depth': node.depth }"
        :aria-label="`Categorize as ${node.project.name}. Press ${index + 1}`"
        :tabindex="0"
        @click="handleSelect(node.project.id)"
        @keydown.enter.prevent="handleSelect(node.project.id)"
        @keydown.space.prevent="handleSelect(node.project.id)"
        @focus="focusedIndex = index"
      >
        <!-- Keyboard Shortcut Badge -->
        <span v-if="index < 9" class="shortcut-badge" aria-hidden="true">
          {{ index + 1 }}
        </span>

        <!-- Nesting Indicator -->
        <span v-if="node.depth > 0" class="nesting-indicator">
          {{ '└─'.repeat(1) }}
        </span>

        <!-- Project Emoji or Color Dot -->
        <span v-if="node.project.colorType === 'emoji' && node.project.emoji" class="project-emoji">
          {{ node.project.emoji }}
        </span>
        <span v-else class="color-dot" :style="{ background: getColorValue(node.project.color) }"></span>

        <!-- Project Name -->
        <span class="project-name">{{ node.project.name }}</span>
      </button>

      <!-- Create New Project Button -->
      <button
        class="category-button create-new-button"
        :tabindex="0"
        @click="handleCreateNew"
        @keydown.enter.prevent="handleCreateNew"
        @keydown.space.prevent="handleCreateNew"
        aria-label="Create new project"
      >
        <Plus :size="20" />
        <span class="project-name">Create New...</span>
      </button>
    </div>

    <!-- Helper Text -->
    <div class="helper-text">
      <kbd>1-9</kbd> to select • <kbd>Space</kbd> to skip • <kbd>Esc</kbd> to exit
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Plus } from 'lucide-vue-next'
import { useTaskStore } from '@/stores/tasks'
import type { Project } from '@/stores/tasks'

interface Props {
  maxShortcuts?: number
}

const props = withDefaults(defineProps<Props>(), {
  maxShortcuts: 9
})

const emit = defineEmits<{
  select: [projectId: string]
  skip: []
  createNew: []
}>()

const taskStore = useTaskStore()
const focusedIndex = ref(-1)

// Category tree node for nested display
interface CategoryNode {
  project: Project
  children: CategoryNode[]
  depth: number
}

// Build nested category tree
const categoryTree = computed<CategoryNode[]>(() => {
  const allProjects = taskStore.projects.filter(p => p.id !== '1') // Exclude "My Tasks"

  function buildTree(parentId: string | null | undefined, depth = 0): CategoryNode[] {
    return allProjects
      .filter(p => p.parentId === parentId)
      .map(project => ({
        project,
        depth,
        children: buildTree(project.id, depth + 1)
      }))
  }

  return buildTree(null)
})

// Flatten tree for rendering (with depth info preserved)
const flattenedCategories = computed<CategoryNode[]>(() => {
  const result: CategoryNode[] = []

  function flatten(nodes: CategoryNode[]) {
    for (const node of nodes) {
      result.push(node)
      if (node.children.length > 0) {
        flatten(node.children)
      }
    }
  }

  flatten(categoryTree.value)
  return result.slice(0, props.maxShortcuts) // Limit to max shortcuts
})

// Get first N projects for keyboard shortcuts (now includes nested structure)
const availableProjects = computed<CategoryNode[]>(() => {
  return flattenedCategories.value
})

function getCategoryStyle(project: Project) {
  if (project.colorType === 'hex' && typeof project.color === 'string') {
    return {
      '--category-color': project.color
    }
  }
  return {}
}

function getColorValue(color: string | string[]): string {
  if (Array.isArray(color)) {
    // Gradient color
    return `linear-gradient(135deg, ${color.join(', ')})`
  }
  return color
}

function handleSelect(projectId: string) {
  emit('select', projectId)
}

function handleCreateNew() {
  emit('createNew')
}

function handleKeydown(event: KeyboardEvent) {
  // Number keys 1-9 for quick selection
  const key = parseInt(event.key)
  if (key >= 1 && key <= 9 && key <= availableProjects.value.length) {
    event.preventDefault()
    const node = availableProjects.value[key - 1]
    if (node) {
      handleSelect(node.project.id)
    }
  }

  // Space to skip
  if (event.code === 'Space') {
    event.preventDefault()
    emit('skip')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.category-selector {
  width: 100%;
  max-width: 800px;
}

.selector-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-5) 0;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

.category-button {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  background: var(--glass-bg-light);
  backdrop-filter: blur(10px);
  border: 2px solid var(--glass-border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out);
  text-align: left;
}

.category-button.is-nested {
  padding-left: calc(var(--space-5) + (var(--depth, 0) * var(--space-6)));
  background: var(--glass-bg-subtle);
  border-left-width: 3px;
  border-left-color: var(--glass-border-hover);
}

.category-button:hover {
  background: var(--glass-bg-medium);
  border-color: var(--category-color, var(--glass-border-hover));
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.category-button:focus,
.category-button.has-focus {
  outline: 3px solid var(--brand-primary);
  outline-offset: 2px;
  border-color: var(--category-color, var(--brand-primary));
}

.category-button:active {
  transform: translateY(0);
}

.create-new-button {
  border-style: dashed !important;
  border-color: var(--glass-border-hover) !important;
  justify-content: center;
}

.create-new-button:hover {
  border-color: var(--brand-primary) !important;
  background: var(--brand-bg) !important;
  color: var(--brand-primary);
}

.shortcut-badge {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--glass-bg-medium);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  color: var(--text-secondary);
}

.nesting-indicator {
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-family: monospace;
  margin-right: var(--space-1);
  user-select: none;
}

.project-emoji {
  font-size: 24px;
  line-height: 1;
  flex-shrink: 0;
}

.color-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.project-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.helper-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  padding: var(--space-3);
  background: var(--glass-bg-subtle);
  border-radius: var(--radius-md);
}

kbd {
  display: inline-block;
  padding: var(--space-1) var(--space-2);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  font-family: monospace;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}

/* Reduce motion for accessibility */
@media (prefers-reduced-motion: reduce) {
  .category-button {
    transition: none !important;
  }
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .category-grid {
    grid-template-columns: 1fr;
  }

  .shortcut-badge {
    display: none;
  }
}
</style>
