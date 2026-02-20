<template>
  <Teleport to="body">
    <div
      v-if="isVisible && parentVisible"
      class="submenu"
      :style="style"
      @mouseenter="$emit('mouseenter')"
      @mouseleave="$emit('mouseleave')"
    >
      <!-- Uncategorized option -->
      <button
        class="menu-item menu-item--sm"
        :class="{ active: !currentProjectId }"
        @click.stop="$emit('select', null)"
      >
        <span class="project-icon project-icon--uncategorized">?</span>
        <span class="menu-text">Uncategorized</span>
        <Check v-if="!currentProjectId" :size="12" class="check-icon" />
      </button>

      <div v-if="projects.length" class="submenu-divider" />

      <!-- Project list -->
      <div class="project-list">
        <button
          v-for="project in projects"
          :key="project.id"
          class="menu-item menu-item--sm"
          :class="{ active: currentProjectId === project.id }"
          @click.stop="$emit('select', project.id)"
        >
          <span class="project-icon">
            <span v-if="project.colorType === 'emoji' && project.emoji" class="project-emoji">
              {{ project.emoji }}
            </span>
            <span
              v-else
              class="project-dot"
              :style="{ backgroundColor: Array.isArray(project.color) ? project.color[0] : project.color }"
            />
          </span>
          <span class="menu-text">{{ project.name }}</span>
          <Check v-if="currentProjectId === project.id" :size="12" class="check-icon" />
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CSSProperties } from 'vue'
import { Check } from 'lucide-vue-next'
import { useProjectStore } from '@/stores/projects'

defineProps<{
  isVisible: boolean
  parentVisible?: boolean
  style: CSSProperties
  currentProjectId?: string | null
}>()

defineEmits<{
  select: [projectId: string | null]
  mouseenter: []
  mouseleave: []
}>()

const projectStore = useProjectStore()
const projects = computed(() => projectStore.projects)
</script>

<style scoped>
.submenu {
  position: fixed;
  background: var(--overlay-component-bg);
  backdrop-filter: var(--overlay-component-backdrop);
  border: var(--overlay-component-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--overlay-component-shadow);
  padding: var(--space-1) 0;
  min-width: 160px;
  max-width: 220px;
  z-index: calc(var(--z-dropdown) + 1);
  animation: menuSlideIn var(--duration-fast) var(--ease-out);
}

@keyframes menuSlideIn {
  from { opacity: 0; transform: scale(0.96) translateY(-4px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.project-list {
  max-height: 200px;
  overflow-y: auto;
}

.project-list::-webkit-scrollbar {
  width: var(--space-1);
}

.project-list::-webkit-scrollbar-track {
  background: transparent;
}

.project-list::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: var(--radius-sm);
}

.menu-item {
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-primary);
  padding: var(--space-1_5) var(--space-2_5);
  font-size: var(--text-xs);
  text-align: start;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  transition: background var(--duration-fast);
}

.menu-item:hover { background: var(--glass-bg-heavy); }
.menu-item.active { color: var(--brand-primary); }

.menu-text {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.project-icon--uncategorized {
  font-size: var(--text-xs);
  color: var(--text-muted);
  opacity: 0.6;
}

.project-emoji {
  font-size: 14px;
  line-height: 1;
}

.project-dot {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
}

.check-icon {
  flex-shrink: 0;
  opacity: 0.7;
}

.submenu-divider {
  height: 1px;
  background: var(--glass-bg-heavy);
  margin: var(--space-1) 0;
}
</style>
