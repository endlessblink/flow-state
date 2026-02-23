<script setup lang="ts">
import { computed } from 'vue'
import { Search } from 'lucide-vue-next'

interface ProjectWithDepth {
  project: { id: string; name: string; emoji?: string; color?: string | string[] }
  depth: number
}

const props = defineProps<{
  show: boolean
  recentProjects: Array<{ id: string; name: string; emoji?: string }>
  filteredProjects: ProjectWithDepth[]
  projectSearch: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'assign-project', projectId: string): void
  (e: 'sort-without-project'): void
  (e: 'update:projectSearch', value: string): void
}>()

// Local search synced with parent
const localSearch = computed({
  get: () => props.projectSearch,
  set: (val) => emit('update:projectSearch', val)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="show" class="sheet-overlay" @click="$emit('close')">
        <div class="project-sheet" @click.stop>
          <div class="sheet-handle" />
          <h3 class="sheet-title">Where does this belong?</h3>

          <!-- Search Input (sticky) -->
          <div class="project-search-wrapper">
            <Search :size="16" class="search-icon" />
            <input
              v-model="localSearch"
              type="text"
              class="project-search"
              placeholder="Search projects..."
            >
          </div>

          <div class="project-list">
            <!-- Keep in Inbox option -->
            <button
              v-if="!localSearch"
              class="project-option inbox-option"
              @click="$emit('sort-without-project')"
            >
              <span class="project-indicator inbox-indicator">📥</span>
              <span class="project-name">Keep in Inbox</span>
              <span class="option-hint">Sort without assigning</span>
            </button>

            <!-- Recent Projects -->
            <div v-if="!localSearch && recentProjects.length > 0" class="recent-projects-section">
              <span class="section-label">Recent</span>
              <div class="recent-projects-grid">
                <button
                  v-for="project in recentProjects"
                  :key="project.id"
                  class="recent-project-chip"
                  @click="$emit('assign-project', project.id)"
                >
                  <span class="chip-emoji">{{ project.emoji || project.name.charAt(0) }}</span>
                  <span class="chip-name">{{ project.name }}</span>
                </button>
              </div>
            </div>

            <div v-if="!localSearch" class="project-divider">
              <span>{{ recentProjects.length > 0 ? 'All projects' : 'Or assign to project' }}</span>
            </div>

            <!-- Filtered/All Projects List -->
            <button
              v-for="{ project, depth } in filteredProjects"
              :key="project.id"
              class="project-option"
              :style="{ paddingLeft: `${16 + Math.min(depth, 2) * 24}px` }"
              @click="$emit('assign-project', project.id)"
            >
              <span v-if="depth > 0" class="hierarchy-line" :style="{ width: `${Math.min(depth, 2) * 24}px` }">
                <span class="hierarchy-connector" />
              </span>
              <span
                class="project-indicator"
                :style="{ backgroundColor: Array.isArray(project.color) ? project.color[0] : project.color }"
              >
                {{ project.emoji || project.name.charAt(0) }}
              </span>
              <span class="project-name">{{ project.name }}</span>
              <span v-if="depth > 2" class="depth-indicator">+{{ depth - 2 }}</span>
            </button>

            <!-- No results message -->
            <div v-if="localSearch && filteredProjects.length === 0" class="no-results">
              No projects match "{{ localSearch }}"
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ================================
   PROJECT SHEET
   ================================ */

.sheet-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  backdrop-filter: blur(var(--blur-xs));
  -webkit-backdrop-filter: blur(var(--blur-xs));
  display: flex;
  align-items: flex-end;
  z-index: var(--z-dropdown);
}

.project-sheet {
  width: 100%;
  max-height: 70vh;
  background: var(--surface-primary);
  border-top-left-radius: var(--radius-2xl);
  border-top-right-radius: var(--radius-2xl);
  padding: var(--space-4) var(--space-5);
  padding-bottom: calc(var(--space-6) + env(safe-area-inset-bottom));
  overflow-y: auto;
}

.sheet-handle {
  width: var(--dropdown-trigger-height-compact);
  height: var(--space-1);
  background: var(--glass-border-strong);
  border-radius: var(--radius-full);
  margin: 0 auto var(--space-5);
}

.sheet-title {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  margin: 0 0 var(--space-4);
  text-align: center;
}

/* Project Search */
.project-search-wrapper {
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  margin-bottom: var(--space-3);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  z-index: var(--z-base);
}

.search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.project-search {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-base);
  outline: none;
}

.project-search::placeholder {
  color: var(--text-muted);
}

/* Recent Projects Section */
.recent-projects-section {
  margin-bottom: var(--space-3);
}

.section-label {
  display: block;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: var(--space-2);
}

.recent-projects-grid {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding-bottom: var(--space-1);
}

.recent-projects-grid::-webkit-scrollbar {
  display: none;
}

.recent-project-chip {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
  padding: var(--space-2) var(--space-3);
  background: var(--brand-bg-subtle);
  border: 1px solid var(--brand-border-subtle);
  border-radius: var(--radius-full);
  color: var(--text-primary);
  font-size: var(--text-meta);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
  white-space: nowrap;
  box-shadow: var(--shadow-xs);
}

.recent-project-chip:active {
  transform: scale(0.95);
  background: var(--state-active-bg);
  box-shadow: var(--shadow-sm);
}

.chip-emoji {
  font-size: var(--text-base);
}

.chip-name {
  max-width: 120px; /* Component-specific chip width */
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Depth indicator for deeply nested items */
.depth-indicator {
  font-size: var(--text-xs);
  color: var(--text-muted);
  background: var(--glass-bg-weak);
  padding: var(--space-0_5) var(--space-1_5);
  border-radius: var(--radius-sm);
  margin-left: auto;
}

/* No results message */
.no-results {
  padding: var(--space-8) var(--space-4);
  text-align: center;
  color: var(--text-muted);
  font-size: var(--text-sm);
  background: var(--glass-bg-subtle);
  border-radius: var(--radius-lg);
  margin: var(--space-4) 0;
}

.project-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.project-option {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--glass-bg-weak);
  border: 1px solid var(--glass-border-light);
  border-radius: var(--radius-xl);
  color: var(--text-primary);
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) cubic-bezier(0.34, 1.56, 0.64, 1);
  position: relative;
}

.hierarchy-line {
  position: absolute;
  left: var(--space-4);
  top: 50%;
  transform: translateY(-50%);
  height: 100%;
  display: flex;
  align-items: center;
}

.hierarchy-connector {
  width: var(--space-3);
  height: var(--space-px);
  background: var(--border-subtle);
  margin-left: auto;
  border-radius: var(--radius-none);
}

.project-option:active {
  background: var(--glass-bg-light);
  transform: scale(0.98);
}

.project-indicator {
  width: var(--project-indicator-size-md);
  height: var(--project-indicator-size-md);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
  font-size: var(--text-xl);
}

.project-name {
  flex: 1;
  text-align: left;
}

/* Inbox option - special styling */
.inbox-option {
  background: var(--brand-bg-subtle);
  border-color: var(--brand-border-subtle);
  flex-wrap: wrap;
}

.inbox-indicator {
  background: transparent !important;
}

.option-hint {
  width: 100%;
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin-top: var(--space-1);
  padding-left: calc(var(--project-indicator-size-md) + var(--space-3));
}

/* Project divider */
.project-divider {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: var(--space-4) 0;
  color: var(--text-muted);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.project-divider::before,
.project-divider::after {
  content: '';
  flex: 1;
  height: var(--space-px);
  background: var(--border-subtle);
}

/* Sheet transition */
.sheet-enter-active,
.sheet-leave-active {
  transition: all var(--duration-slow) cubic-bezier(0.16, 1, 0.3, 1);
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .project-sheet,
.sheet-leave-to .project-sheet {
  transform: translateY(100%);
}

/* RTL support */
[dir="rtl"] .project-option {
  flex-direction: row-reverse;
}

[dir="rtl"] .project-name {
  text-align: right;
}
</style>
