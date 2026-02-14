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

        <!-- Scrollable Content -->
        <div class="shortcuts-content">
          <!-- Global Shortcuts -->
          <div class="shortcut-category">
            <div class="category-header">
              <Sparkles :size="18" class="category-icon" />
              <h3 class="category-title">Global</h3>
            </div>
            <div class="shortcut-list">
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Ctrl</kbd><kbd>Z</kbd>
                </div>
                <span class="shortcut-description">Undo</span>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>Z</kbd>
                </div>
                <span class="shortcut-description">Redo</span>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Ctrl</kbd><kbd>N</kbd>
                </div>
                <span class="shortcut-description">New task</span>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Ctrl</kbd><kbd>K</kbd>
                </div>
                <span class="shortcut-description">Command palette</span>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Ctrl</kbd><kbd>P</kbd>
                </div>
                <span class="shortcut-description">Search</span>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Ctrl</kbd><kbd>E</kbd>
                </div>
                <span class="shortcut-description">Edit selected task</span>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Alt</kbd><kbd>N</kbd>
                </div>
                <span class="shortcut-description">Quick task create</span>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Shift</kbd><kbd>Del</kbd>
                </div>
                <span class="shortcut-description">Delete selected</span>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>?</kbd>
                </div>
                <span class="shortcut-description">Show this panel</span>
              </div>
            </div>
          </div>

          <!-- Navigation Shortcuts -->
          <div class="shortcut-category">
            <div class="category-header">
              <Compass :size="18" class="category-icon" />
              <h3 class="category-title">Navigation</h3>
            </div>
            <div class="shortcut-list">
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Shift</kbd><kbd>1</kbd>
                </div>
                <span class="shortcut-description">Board view</span>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Shift</kbd><kbd>2</kbd>
                </div>
                <span class="shortcut-description">Calendar view</span>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Shift</kbd><kbd>3</kbd>
                </div>
                <span class="shortcut-description">Canvas view</span>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Shift</kbd><kbd>4</kbd>
                </div>
                <span class="shortcut-description">Catalog view</span>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Shift</kbd><kbd>5</kbd>
                </div>
                <span class="shortcut-description">Quick Sort view</span>
              </div>
            </div>
          </div>

          <!-- Canvas Shortcuts -->
          <div class="shortcut-category">
            <div class="category-header">
              <Grid3x3 :size="18" class="category-icon" />
              <h3 class="category-title">Canvas</h3>
            </div>
            <div class="shortcut-list">
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Del</kbd> / <kbd>Backspace</kbd>
                </div>
                <span class="shortcut-description">Delete selected nodes</span>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Shift</kbd><kbd>Del</kbd>
                </div>
                <span class="shortcut-description">Permanent delete</span>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Shift</kbd><kbd>G</kbd>
                </div>
                <span class="shortcut-description">Create new group</span>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Hold Shift</kbd>
                </div>
                <span class="shortcut-description">Box selection mode</span>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Hold Ctrl</kbd>
                </div>
                <span class="shortcut-description">Multi-select mode</span>
              </div>
            </div>
          </div>

          <!-- Focus Mode Shortcuts -->
          <div class="shortcut-category">
            <div class="category-header">
              <Target :size="18" class="category-icon" />
              <h3 class="category-title">Focus Mode</h3>
            </div>
            <div class="shortcut-list">
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Space</kbd>
                </div>
                <span class="shortcut-description">Start/Pause timer</span>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>C</kbd>
                </div>
                <span class="shortcut-description">Complete task</span>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>P</kbd>
                </div>
                <span class="shortcut-description">Pause & leave</span>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Esc</kbd>
                </div>
                <span class="shortcut-description">Stop & go back</span>
              </div>
            </div>
          </div>

          <!-- Quick Sort Shortcuts -->
          <div class="shortcut-category">
            <div class="category-header">
              <Layers :size="18" class="category-icon" />
              <h3 class="category-title">Quick Sort</h3>
            </div>
            <div class="shortcut-list">
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>D</kbd>
                </div>
                <span class="shortcut-description">Mark done & advance</span>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>S</kbd>
                </div>
                <span class="shortcut-description">Save & advance</span>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Space</kbd>
                </div>
                <span class="shortcut-description">Skip task</span>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>E</kbd>
                </div>
                <span class="shortcut-description">Edit task</span>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Del</kbd>
                </div>
                <span class="shortcut-description">Delete task</span>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Ctrl</kbd><kbd>Z</kbd>
                </div>
                <span class="shortcut-description">Undo last action</span>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Esc</kbd>
                </div>
                <span class="shortcut-description">Exit session</span>
              </div>
            </div>
          </div>

          <!-- Command Palette Shortcuts -->
          <div class="shortcut-category">
            <div class="category-header">
              <Terminal :size="18" class="category-icon" />
              <h3 class="category-title">Command Palette</h3>
            </div>
            <div class="shortcut-list">
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Enter</kbd>
                </div>
                <span class="shortcut-description">Create task & close</span>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Shift</kbd><kbd>Enter</kbd>
                </div>
                <span class="shortcut-description">Create & continue</span>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Esc</kbd>
                </div>
                <span class="shortcut-description">Close</span>
              </div>
            </div>
          </div>

          <!-- Search Shortcuts -->
          <div class="shortcut-category">
            <div class="category-header">
              <Search :size="18" class="category-icon" />
              <h3 class="category-title">Search</h3>
            </div>
            <div class="shortcut-list">
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>↑</kbd> / <kbd>↓</kbd>
                </div>
                <span class="shortcut-description">Navigate results</span>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Enter</kbd>
                </div>
                <span class="shortcut-description">Open selected</span>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Esc</kbd>
                </div>
                <span class="shortcut-description">Close</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="shortcuts-footer">
          <p class="footer-text">Press <kbd>?</kbd> anywhere to toggle this panel</p>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { X, Keyboard, Sparkles, Compass, Grid3x3, Target, Layers, Terminal, Search } from 'lucide-vue-next'

defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const handleBackdropClick = () => {
  emit('close')
}

const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
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
  padding: var(--space-6);
  border-bottom: 1px solid var(--border-subtle);
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

/* Content */
.shortcuts-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
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
