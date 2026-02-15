<template>
  <Transition name="shortcuts-fade">
    <div
      v-if="isOpen"
      class="shortcuts-overlay"
      @click="handleBackdropClick"
    >
      <div
        class="shortcuts-panel"
        role="dialog"
        aria-labelledby="shortcuts-title"
        aria-modal="true"
        @click.stop
      >
        <!-- Header -->
        <div class="shortcuts-header">
          <div class="shortcuts-title-row">
            <Keyboard :size="24" class="shortcuts-icon" />
            <h2 id="shortcuts-title" class="shortcuts-title">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            class="shortcuts-close"
            aria-label="Close shortcuts panel"
            @click="$emit('close')"
          >
            <X :size="20" />
          </button>
        </div>

        <!-- Search -->
        <div class="shortcuts-search">
          <Search :size="16" class="search-icon" />
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="Search shortcuts..."
            aria-label="Filter keyboard shortcuts"
            @keydown.escape.stop="handleSearchEscape"
          >
          <button
            v-if="searchQuery"
            class="search-clear"
            aria-label="Clear search"
            @click="searchQuery = ''"
          >
            <X :size="14" />
          </button>
        </div>

        <!-- Scrollable Content -->
        <div class="shortcuts-content">
          <template v-if="filteredCategories.length > 0">
            <div
              v-for="category in filteredCategories"
              :key="category.title"
              class="shortcut-category"
            >
              <div class="category-header">
                <component :is="category.icon" :size="18" class="category-icon" />
                <h3 class="category-title">
                  {{ category.title }}
                </h3>
                <span v-if="searchQuery" class="category-count">{{ category.shortcuts.length }}</span>
              </div>
              <div class="shortcut-list">
                <div
                  v-for="shortcut in category.shortcuts"
                  :key="shortcut.description"
                  class="shortcut-item"
                >
                  <div class="shortcut-keys">
                    <template v-for="(part, i) in shortcut.keys" :key="i">
                      <span v-if="part === '/'" class="key-separator">/</span>
                      <kbd v-else>{{ part }}</kbd>
                    </template>
                  </div>
                  <span class="shortcut-description">{{ shortcut.description }}</span>
                </div>
              </div>
            </div>
          </template>

          <!-- No Results -->
          <div v-else class="no-results">
            <SearchX :size="40" class="no-results-icon" />
            <p class="no-results-text">
              No shortcuts match "{{ searchQuery }}"
            </p>
            <button class="no-results-clear" @click="searchQuery = ''">
              Clear search
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="shortcuts-footer">
          <p class="footer-text">
            Press <kbd>?</kbd> anywhere to toggle this panel
          </p>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted, type Component } from 'vue'
import { X, Keyboard, Sparkles, Compass, Grid3x3, Target, Layers, Terminal, Search, SearchX } from 'lucide-vue-next'

interface Shortcut {
  keys: string[]  // Array of key labels. Use '/' as separator between alternatives
  description: string
  searchTerms?: string  // Extra terms for search matching
}

interface ShortcutCategory {
  title: string
  icon: Component
  shortcuts: Shortcut[]
}

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const searchQuery = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)

// All shortcut data
const categories: ShortcutCategory[] = [
  {
    title: 'Global',
    icon: Sparkles,
    shortcuts: [
      { keys: ['Ctrl', 'Z'], description: 'Undo', searchTerms: 'revert back' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo', searchTerms: 'forward repeat' },
      { keys: ['Ctrl', 'N'], description: 'New task', searchTerms: 'create add' },
      { keys: ['Ctrl', 'K'], description: 'Command palette', searchTerms: 'quick action menu' },
      { keys: ['Ctrl', 'P'], description: 'Search', searchTerms: 'find lookup' },
      { keys: ['Ctrl', 'E'], description: 'Edit selected task', searchTerms: 'modify change' },
      { keys: ['Alt', 'N'], description: 'Quick task create', searchTerms: 'add new fast' },
      { keys: ['Shift', 'Del'], description: 'Delete selected', searchTerms: 'remove trash' },
      { keys: ['?'], description: 'Show this panel', searchTerms: 'help shortcuts keyboard' },
    ]
  },
  {
    title: 'Navigation',
    icon: Compass,
    shortcuts: [
      { keys: ['Shift', '1'], description: 'Board view', searchTerms: 'kanban columns' },
      { keys: ['Shift', '2'], description: 'Calendar view', searchTerms: 'schedule dates' },
      { keys: ['Shift', '3'], description: 'Canvas view', searchTerms: 'whiteboard spatial' },
      { keys: ['Shift', '4'], description: 'Catalog view', searchTerms: 'list all' },
      { keys: ['Shift', '5'], description: 'Quick Sort view', searchTerms: 'triage categorize' },
    ]
  },
  {
    title: 'Canvas',
    icon: Grid3x3,
    shortcuts: [
      { keys: ['Del', '/', 'Backspace'], description: 'Delete selected nodes', searchTerms: 'remove' },
      { keys: ['Shift', 'Del'], description: 'Permanent delete', searchTerms: 'hard remove forever' },
      { keys: ['Shift', 'G'], description: 'Create new group', searchTerms: 'section container' },
      { keys: ['Hold Shift'], description: 'Box selection mode', searchTerms: 'drag select area' },
      { keys: ['Hold Ctrl'], description: 'Multi-select mode', searchTerms: 'multiple pick' },
    ]
  },
  {
    title: 'Focus Mode',
    icon: Target,
    shortcuts: [
      { keys: ['Space'], description: 'Start/Pause timer', searchTerms: 'pomodoro play stop' },
      { keys: ['C'], description: 'Complete task', searchTerms: 'done finish' },
      { keys: ['P'], description: 'Pause & leave', searchTerms: 'exit stop' },
      { keys: ['Esc'], description: 'Stop & go back', searchTerms: 'cancel return escape' },
    ]
  },
  {
    title: 'Quick Sort',
    icon: Layers,
    shortcuts: [
      { keys: ['D'], description: 'Mark done & advance', searchTerms: 'complete next' },
      { keys: ['S'], description: 'Save & advance', searchTerms: 'keep next' },
      { keys: ['Space'], description: 'Skip task', searchTerms: 'pass next' },
      { keys: ['E'], description: 'Edit task', searchTerms: 'modify change' },
      { keys: ['Del'], description: 'Delete task', searchTerms: 'remove trash' },
      { keys: ['Ctrl', 'Z'], description: 'Undo last action', searchTerms: 'revert back' },
      { keys: ['Esc'], description: 'Exit session', searchTerms: 'close leave quit' },
    ]
  },
  {
    title: 'Command Palette',
    icon: Terminal,
    shortcuts: [
      { keys: ['Enter'], description: 'Create task & close', searchTerms: 'submit confirm' },
      { keys: ['Shift', 'Enter'], description: 'Create & continue', searchTerms: 'submit add more' },
      { keys: ['Esc'], description: 'Close', searchTerms: 'cancel exit' },
    ]
  },
  {
    title: 'Search',
    icon: Search,
    shortcuts: [
      { keys: ['↑', '/', '↓'], description: 'Navigate results', searchTerms: 'arrow up down move' },
      { keys: ['Enter'], description: 'Open selected', searchTerms: 'confirm go' },
      { keys: ['Esc'], description: 'Close', searchTerms: 'cancel exit' },
    ]
  },
]

// Filter categories and shortcuts based on search
const filteredCategories = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()
  if (!query) return categories

  return categories
    .map(category => {
      const matchingShortcuts = category.shortcuts.filter(shortcut => {
        const descMatch = shortcut.description.toLowerCase().includes(query)
        const keyMatch = shortcut.keys.some(k => k.toLowerCase().includes(query))
        const termMatch = shortcut.searchTerms?.toLowerCase().includes(query) ?? false
        const categoryMatch = category.title.toLowerCase().includes(query)
        return descMatch || keyMatch || termMatch || categoryMatch
      })

      return matchingShortcuts.length > 0
        ? { ...category, shortcuts: matchingShortcuts }
        : null
    })
    .filter((c): c is ShortcutCategory => c !== null)
})

// Auto-focus search when panel opens
watch(() => props.isOpen, (open) => {
  if (open) {
    searchQuery.value = ''
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  }
})

const handleBackdropClick = () => {
  emit('close')
}

const handleSearchEscape = () => {
  if (searchQuery.value) {
    searchQuery.value = ''
  } else {
    emit('close')
  }
}

const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && !searchQuery.value) {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscape)
})
</script>

<style scoped>
/* Overlay */
.shortcuts-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  padding: var(--space-6);
}

/* Panel */
.shortcuts-panel {
  position: relative;
  width: 100%;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background: var(--overlay-component-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-2xl);
  box-shadow: var(--overlay-component-shadow);
  backdrop-filter: var(--overlay-component-backdrop);
  -webkit-backdrop-filter: var(--overlay-component-backdrop);
  overflow: hidden;
}

/* Header */
.shortcuts-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-6) var(--space-6) var(--space-4);
}

.shortcuts-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.shortcuts-icon {
  color: var(--brand-primary);
}

.shortcuts-title {
  margin: 0;
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
}

.shortcuts-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
}

.shortcuts-close:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-hover);
  color: var(--text-secondary);
}

/* Search */
.shortcuts-search {
  position: relative;
  display: flex;
  align-items: center;
  margin: 0 var(--space-6) var(--space-4);
}

.search-icon {
  position: absolute;
  left: var(--space-3);
  color: var(--text-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: var(--space-2_5) var(--space-10);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: var(--text-sm);
  transition: all var(--duration-fast);
  outline: none;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.search-input:focus {
  border-color: var(--brand-primary);
  background: var(--glass-bg-medium);
  box-shadow: 0 0 0 2px var(--brand-primary-alpha-20);
}

.search-clear {
  position: absolute;
  right: var(--space-2);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.search-clear:hover {
  background: var(--glass-bg-medium);
  color: var(--text-secondary);
}

/* Content */
.shortcuts-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2) var(--space-6) var(--space-6);
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-6);
}

/* Category */
.shortcut-category {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.category-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border-subtle);
}

.category-icon {
  color: var(--brand-primary);
}

.category-title {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.category-count {
  margin-left: auto;
  font-size: var(--text-xs);
  color: var(--text-muted);
  background: var(--glass-bg-soft);
  padding: 1px var(--space-2);
  border-radius: var(--radius-full);
}

/* Shortcut List */
.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.shortcut-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-subtle);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  transition: all var(--duration-fast) var(--spring-smooth);
}

.shortcut-item:hover {
  background: var(--glass-bg-light);
  border-color: var(--glass-border);
}

.shortcut-keys {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
}

.key-separator {
  color: var(--text-muted);
  font-size: var(--text-xs);
  padding: 0 2px;
}

.shortcut-description {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  text-align: right;
}

/* kbd Key Styling (3D Keycap Effect) */
kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  padding: 2px 6px;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  box-shadow:
    0 2px 0 rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* No Results */
.no-results {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-12) var(--space-6);
  text-align: center;
}

.no-results-icon {
  color: var(--text-muted);
  opacity: 0.5;
}

.no-results-text {
  margin: 0;
  font-size: var(--text-base);
  color: var(--text-muted);
}

.no-results-clear {
  padding: var(--space-2) var(--space-4);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--brand-primary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.no-results-clear:hover {
  background: var(--glass-bg-medium);
  border-color: var(--brand-primary-alpha-40);
}

/* Footer */
.shortcuts-footer {
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--border-subtle);
  text-align: center;
}

.footer-text {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.footer-text kbd {
  margin: 0 var(--space-1);
}

/* Transitions */
.shortcuts-fade-enter-active,
.shortcuts-fade-leave-active {
  transition: opacity var(--duration-normal) var(--spring-smooth);
}

.shortcuts-fade-enter-active .shortcuts-panel,
.shortcuts-fade-leave-active .shortcuts-panel {
  transition:
    opacity var(--duration-normal) var(--spring-smooth),
    transform var(--duration-normal) var(--spring-smooth);
}

.shortcuts-fade-enter-from,
.shortcuts-fade-leave-to {
  opacity: 0;
}

.shortcuts-fade-enter-from .shortcuts-panel,
.shortcuts-fade-leave-to .shortcuts-panel {
  opacity: 0;
  transform: scale(0.95);
}

/* Responsive: Single column on narrow screens */
@media (max-width: 768px) {
  .shortcuts-content {
    grid-template-columns: 1fr;
  }

  .shortcuts-panel {
    max-width: 90vw;
  }
}

/* Scrollbar Styling */
.shortcuts-content::-webkit-scrollbar {
  width: 8px;
}

.shortcuts-content::-webkit-scrollbar-track {
  background: var(--glass-bg-subtle);
  border-radius: var(--radius-sm);
}

.shortcuts-content::-webkit-scrollbar-thumb {
  background: var(--glass-bg-medium);
  border-radius: var(--radius-sm);
}

.shortcuts-content::-webkit-scrollbar-thumb:hover {
  background: var(--glass-bg-heavy);
}
</style>
