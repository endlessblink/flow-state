<template>
  <div ref="triggerWrapperRef" class="task-row__project" @click.stop>
    <!-- Categorized: Show emoji -->
    <span
      v-if="visual.type === 'emoji'"
      ref="triggerRef"
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
      ref="triggerRef"
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
      ref="triggerRef"
      class="project-placeholder"
      title="Click to assign a project"
      @click="toggleDropdown"
    >&#10067;</span>

    <!-- Project Selector Dropdown (teleported to body to avoid overflow clipping) -->
    <Teleport to="body">
      <Transition name="dropdown-slide">
        <div
          v-if="isOpen"
          ref="dropdownRef"
          class="project-dropdown"
          :style="dropdownStyle"
        >
          <div class="project-dropdown__list">
            <!-- Uncategorized option -->
            <button
              class="project-dropdown__item"
              :class="{ 'is-active': !currentProjectId }"
              @click="selectProject(null)"
            >
              <span class="project-dropdown__icon">&#10067;</span>
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
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { Check } from 'lucide-vue-next'
import { useProjectStore } from '@/stores/projects'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'

defineProps<{
  visual: any
  projectDisplayName: string
  currentProjectId?: string | null
}>()

const emit = defineEmits<{
  'update:projectId': [projectId: string | null]
}>()

const projectStore = useProjectStore()
const isOpen = ref(false)
const triggerWrapperRef = ref<HTMLElement>()
const triggerRef = ref<HTMLElement>()
const dropdownRef = ref<HTMLElement>()

const projects = computed(() => projectStore.projects)

// Fixed positioning for teleported dropdown
const dropdownStyle = ref<Record<string, string>>({
  position: 'fixed',
  top: '0px',
  left: '0px'
})

const calculateDropdownPosition = () => {
  if (!triggerRef.value) return
  const rect = triggerRef.value.getBoundingClientRect()
  const viewportHeight = window.innerHeight
  const dropdownHeight = Math.min((projects.value.length + 1) * 36 + 16, 256)
  const spaceBelow = viewportHeight - rect.bottom
  const positionAbove = spaceBelow < dropdownHeight && rect.top > spaceBelow

  dropdownStyle.value = {
    position: 'fixed',
    top: positionAbove ? `${rect.top - dropdownHeight - 4}px` : `${rect.bottom + 4}px`,
    left: `${rect.left + rect.width / 2}px`,
    transform: 'translateX(-50%)'
  }
}

const toggleDropdown = async () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    await nextTick()
    calculateDropdownPosition()
  }
}

const closeDropdown = () => {
  isOpen.value = false
}

const selectProject = (projectId: string | null) => {
  emit('update:projectId', projectId)
  closeDropdown()
}

// Click outside to close (check both trigger and teleported dropdown)
const handleClickOutside = (event: MouseEvent) => {
  if (!isOpen.value) return
  const target = event.target as Node
  const isInsideTrigger = triggerWrapperRef.value?.contains(target)
  const isInsideDropdown = dropdownRef.value?.contains(target)
  if (!isInsideTrigger && !isInsideDropdown) {
    closeDropdown()
  }
}

const handleEscapeKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape') closeDropdown()
}

const handleScroll = (event: Event) => {
  if (!isOpen.value) return
  const target = event.target as HTMLElement
  if (dropdownRef.value && (target === dropdownRef.value || dropdownRef.value.contains(target))) return
  closeDropdown()
}

onMounted(() => {
  document.addEventListener('keydown', handleEscapeKey)
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('scroll', handleScroll, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleEscapeKey)
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('scroll', handleScroll, true)
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
</style>

<style>
/* Project Dropdown - Dark glass morphism (teleported to body, NOT scoped) */
.project-dropdown {
  z-index: var(--z-tooltip);
  background-color: hsl(var(--slate-900)) !important;
  background: rgba(28, 25, 45, 0.95) !important;
  backdrop-filter: blur(var(--space-4));
  -webkit-backdrop-filter: blur(var(--space-4));
  border: var(--space-0_5) solid rgba(var(--color-slate-50), 0.1) !important;
  box-shadow:
    0 var(--space-2) var(--space-8) rgba(var(--color-slate-900), 0.4),
    0 0 0 var(--space-0_5) rgba(var(--color-slate-50), 0.05) inset;
  border-radius: var(--radius-md);
  min-width: 160px;
  max-width: 220px;
  max-height: 240px;
  overflow: hidden;
  isolation: isolate;
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
  border: none !important;
  background: none !important;
  background-color: transparent !important;
  color: rgba(var(--color-slate-50), 0.9) !important;
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
  background: rgba(var(--color-slate-50), 0.08) !important;
  background-color: rgba(var(--color-slate-50), 0.08) !important;
}

.project-dropdown__item.is-active {
  /* Simple checkmark indicator, no background highlight */
}

.project-dropdown__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--space-5);
  height: var(--space-5);
  flex-shrink: 0;
}

.project-dropdown__color {
  width: var(--space-3_5);
  height: var(--space-3_5);
  border-radius: var(--radius-full);
}

.project-dropdown__name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-dropdown__check {
  flex-shrink: 0;
  opacity: 0.7;
}

/* Custom scrollbar for dropdown list */
.project-dropdown__list::-webkit-scrollbar {
  width: var(--space-1);
}

.project-dropdown__list::-webkit-scrollbar-track {
  background: transparent;
}

.project-dropdown__list::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: var(--radius-sm);
}
</style>
