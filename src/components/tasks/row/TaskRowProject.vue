<template>
  <div class="task-row__project" @click.stop>
    <!-- Categorized: Show emoji -->
    <span
      v-if="visual.type === 'emoji'"
      class="project-emoji-badge project-visual--emoji"
      :title="`Project: ${projectDisplayName}`"
      @click="toggleDropdown"
    >
      <ProjectEmojiIcon
        :emoji="visual.content"
        size="xs"
      />
    </span>
    <!-- Categorized: Show color circle -->
    <span
      v-else-if="visual.type === 'css-circle'"
      class="project-emoji-badge project-visual--css-circle"
      :title="`Project: ${projectDisplayName}`"
      @click="toggleDropdown"
    >
      <div
        class="project-css-circle"
        :style="{ '--project-color': visual.color }"
      />
    </span>
    <!-- Uncategorized: Show subtle question mark -->
    <span
      v-else
      class="project-placeholder"
      title="Click to assign a project"
      @click="toggleDropdown"
    >❓</span>

    <!-- Project Selector Dropdown -->
    <Transition name="dropdown-slide">
      <div v-if="isOpen" class="project-dropdown">
        <div class="project-dropdown__list">
          <!-- Uncategorized option -->
          <button
            class="project-dropdown__item"
            :class="{ 'is-active': !currentProjectId }"
            @click="selectProject(null)"
          >
            <span class="project-dropdown__icon">❓</span>
            <span class="project-dropdown__name">Uncategorized</span>
            <Check v-if="!currentProjectId" :size="14" class="project-dropdown__check" />
          </button>

          <!-- Project items -->
          <button
            v-for="project in projects"
            :key="project.id"
            class="project-dropdown__item"
            :class="{ 'is-active': currentProjectId === project.id }"
            @click="selectProject(project.id)"
          >
            <span class="project-dropdown__icon">
              <ProjectEmojiIcon
                v-if="project.colorType === 'emoji' && project.emoji"
                :emoji="project.emoji"
                size="xs"
              />
              <div
                v-else-if="project.color"
                class="project-dropdown__color"
                :style="{ backgroundColor: Array.isArray(project.color) ? project.color[0] : project.color }"
              />
            </span>
            <span class="project-dropdown__name">{{ project.name }}</span>
            <Check v-if="currentProjectId === project.id" :size="14" class="project-dropdown__check" />
          </button>
        </div>
      </div>
    </Transition>

    <!-- Click outside overlay -->
    <div
      v-if="isOpen"
      class="project-dropdown__overlay"
      @click="closeDropdown"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Check } from 'lucide-vue-next'
import { useProjectStore } from '@/stores/projects'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'

const props = defineProps<{
  visual: any
  projectDisplayName: string
  currentProjectId?: string | null
}>()

const emit = defineEmits<{
  'update:projectId': [projectId: string | null]
}>()

const projectStore = useProjectStore()
const isOpen = ref(false)

const projects = computed(() => projectStore.projects)

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

const closeDropdown = () => {
  isOpen.value = false
}

const selectProject = (projectId: string | null) => {
  emit('update:projectId', projectId)
  closeDropdown()
}

// Handle escape key to close dropdown
const handleEscapeKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleEscapeKey)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscapeKey)
})
</script>

<style scoped>
.task-row__project {
  grid-area: project;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.project-emoji-badge {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--spring-smooth) ease;
  padding: var(--space-0_5);
  border-radius: var(--radius-full);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
}

.project-emoji-badge:hover {
  background: var(--surface-hover);
  transform: translateY(-1px) translateZ(0);
}

.project-css-circle {
  width: var(--project-indicator-size-md, 24px);
  height: var(--project-indicator-size-md, 24px);
  border-radius: 50%;
  background: var(--project-color);
  box-shadow: var(--project-indicator-shadow-inset);
  position: relative;
  transition: all var(--spring-smooth) ease;
}

.project-emoji-badge:hover .project-css-circle {
  transform: translateZ(0) scale(1.15);
  box-shadow:
    var(--project-indicator-shadow-inset),
    0 0 16px var(--project-color),
    0 0 32px var(--project-color);
}

/* Subtle placeholder for uncategorized tasks */
.project-placeholder {
  color: var(--text-muted);
  font-size: var(--text-sm);
  opacity: 0.5;
  cursor: pointer;
  transition: opacity var(--duration-fast) ease;
}

.project-placeholder:hover {
  opacity: 0.8;
}

/* Project Selector Dropdown - Glass morphism matching CustomSelect */
.project-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 99999;

  /* Glass morphism - matching CustomSelect */
  background: rgba(30, 30, 40, 0.65);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.08) inset;
  border-radius: var(--radius-md);

  min-width: 160px;
  max-width: 220px;
  max-height: 240px;
  overflow: hidden;

  /* Ensure backdrop-filter works */
  isolation: isolate;
  transform: translateX(-50%) translateZ(0);
}

.project-dropdown__list {
  overflow-y: auto;
  max-height: 200px;
  padding: var(--space-1);
}

.project-dropdown__item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-1_5) var(--space-2);
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-primary);
  font-size: var(--text-xs);
  text-align: left;
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  border-radius: var(--radius-md);
  user-select: none;
  white-space: nowrap;
  min-height: 28px;
}

.project-dropdown__item:hover {
  background: var(--surface-hover);
}

.project-dropdown__item.is-active {
  background: rgba(78, 205, 196, 0.15);
  color: var(--brand-primary);
}

.project-dropdown__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.project-dropdown__color {
  width: 14px;
  height: 14px;
  border-radius: 50%;
}

.project-dropdown__name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-dropdown__check {
  color: var(--brand-primary);
  flex-shrink: 0;
}

.project-dropdown__overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
}

/* Dropdown transitions */
.dropdown-slide-enter-active,
.dropdown-slide-leave-active {
  transition: all var(--duration-fast) ease;
}

.dropdown-slide-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-4px);
}

.dropdown-slide-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-4px);
}

/* Custom scrollbar for dropdown list */
.project-dropdown__list::-webkit-scrollbar {
  width: 4px;
}

.project-dropdown__list::-webkit-scrollbar-track {
  background: transparent;
}

.project-dropdown__list::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: var(--radius-sm);
}
</style>
