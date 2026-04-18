<template>
  <div class="category-selector" :class="{ 'category-selector--compact': compact }">
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
        <ProjectEmojiIcon
          v-if="node.project.colorType === 'emoji' && node.project.emoji"
          :emoji="node.project.emoji"
          size="xs"
          class="project-emoji"
        />
        <span v-else class="color-dot" :style="{ background: getColorValue(node.project.color) }" />

        <!-- Project Name -->
        <span class="project-name" :title="node.project.name">{{ node.project.name }}</span>
      </button>

      <!-- Create New Project Button -->
      <button
        class="category-button create-new-button"
        :tabindex="0"
        aria-label="Create new project"
        @click="handleCreateNew"
        @keydown.enter.prevent="handleCreateNew"
        @keydown.space.prevent="handleCreateNew"
      >
        <Plus :size="20" />
        <span class="project-name">Create New...</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Plus } from 'lucide-vue-next'
import { useTaskStore } from '@/stores/tasks'
import type { Project, ProjectTreeNode } from '@/types/tasks'
import { useSidebarManagement } from '@/composables/app/useSidebarManagement'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'

interface Props {
  maxShortcuts?: number
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  maxShortcuts: 9,
  compact: false
})

const emit = defineEmits<{
  select: [projectId: string]
  skip: []
  createNew: []
}>()

const taskStore = useTaskStore()
const sidebar = useSidebarManagement()
const focusedIndex = ref(-1)

// BUG-1775: Only render projects that are actually visible in the sidebar
// tree. Walk the canonical `projectTree` (defined in projectStore) and
// descend into a parent's children only when the sidebar has that parent
// expanded. This guarantees "same source, same view" across surfaces.
const availableProjects = computed<ProjectTreeNode[]>(() => {
  const expanded = new Set<string>(sidebar.expandedProjects.value ?? [])
  const result: ProjectTreeNode[] = []

  const visit = (nodes: ProjectTreeNode[]) => {
    for (const node of nodes) {
      result.push(node)
      if (node.children.length > 0 && expanded.has(node.project.id)) {
        visit(node.children)
      }
    }
  }

  visit(taskStore.projectTree)
  return result.slice(0, props.maxShortcuts)
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

function shouldIgnoreKeyEvent(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement
  if (!target) return false
  const tagName = target.tagName?.toLowerCase()
  return tagName === 'input' ||
         tagName === 'textarea' ||
         tagName === 'select' ||
         target.isContentEditable ||
         !!target.closest('[role="dialog"], .modal, .n-modal')
}

function handleKeydown(event: KeyboardEvent) {
  // Skip if user is in an input field or modal
  if (shouldIgnoreKeyEvent(event)) return

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
  background: transparent !important; /* Override global tauri styles */
  box-shadow: none !important;
}

.category-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
  max-height: 280px;
  overflow-y: auto;
  padding: var(--space-4);
}

.category-button {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-8) var(--space-4) var(--space-5);
  background: var(--glass-bg-light);
  backdrop-filter: blur(10px);
  border: 2px solid var(--glass-border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out);
  text-align: start;
  min-width: 140px; /* Minimum button width - increased for longer names */
  min-height: 64px; /* Support 2-line text */
}

.category-button.is-nested {
  padding-inline-start: calc(var(--space-5) + (var(--depth, 0) * var(--space-6)));
  background: var(--glass-bg-subtle);
  border-inline-start-width: 3px;
  border-inline-start-color: var(--glass-border-hover);
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
  margin-inline-end: var(--space-1);
  user-select: none;
}

.project-emoji {
  font-size: var(--text-2xl);
  line-height: 1;
  flex-shrink: 0;
}

.color-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}

.project-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.3;
  word-break: break-word;
  max-width: 250px; /* Limit maximum text width for very long names */
}

kbd {
  display: inline-block;
  padding: var(--space-0_5) var(--space-1_5);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  font-family: monospace;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

/* Compact mode — pill-style inline buttons */
.category-selector--compact .category-grid {
  gap: var(--space-1_5) !important;
  padding: var(--space-1) var(--space-2) !important;
  margin-bottom: var(--space-2) !important;
  max-height: 220px;
}

.category-selector--compact .category-button {
  padding: var(--space-1) var(--space-2_5) !important;
  min-height: 32px !important;
  min-width: unset !important;
  font-size: var(--text-sm) !important;
  gap: var(--space-1_5) !important;
  border-width: 1px !important;
  border-radius: var(--radius-md) !important;
  align-items: center !important;
}

.category-selector--compact .category-button.is-nested {
  padding-inline-start: var(--space-2_5) !important;
  border-inline-start-width: 2px !important;
}

.category-selector--compact .category-button:hover {
  transform: none !important;
  box-shadow: none !important;
}

.category-selector--compact .category-button:focus,
.category-selector--compact .category-button.has-focus {
  outline: none !important;
  border-color: var(--brand-primary) !important;
}

.category-selector--compact .shortcut-badge {
  position: static !important;
  width: 16px !important;
  height: 16px !important;
  font-size: 0.6rem !important;
  flex-shrink: 0;
}

.category-selector--compact .nesting-indicator {
  display: none !important;
}

.category-selector--compact .project-emoji {
  font-size: var(--text-sm) !important;
}

.category-selector--compact .color-dot {
  width: 8px !important;
  height: 8px !important;
}

.category-selector--compact .project-name {
  font-size: var(--text-sm) !important;
  display: block !important;
  overflow: visible !important;
  text-overflow: clip !important; /* WebKitGTK-safe */
  white-space: nowrap !important;
  max-width: none !important;
  flex: 0 0 auto !important; /* Don't shrink — take natural text width */
  -webkit-line-clamp: unset !important;
  -webkit-box-orient: unset !important;
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
    flex-direction: column;
  }

  .category-button {
    width: 100%;
  }

  .project-name {
    max-width: none; /* Full width on mobile */
  }

  .shortcut-badge {
    display: none;
  }
}
</style>
