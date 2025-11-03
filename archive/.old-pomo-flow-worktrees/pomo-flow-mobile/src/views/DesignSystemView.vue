<template>
  <div class="design-system-gallery">
    <!-- Gallery Header -->
    <div class="gallery-header">
      <h1 class="gallery-title">Pomo-Flow Design System</h1>
      <p class="gallery-subtitle">Visual style guide and component library</p>
    </div>

    <!-- Section Navigation -->
    <div class="section-nav">
      <button
        v-for="section in sections"
        :key="section.id"
        class="nav-tab"
        :class="{ active: activeSection === section.id }"
        @click="activeSection = section.id"
      >
        <component :is="section.icon" :size="16" :stroke-width="1.5" />
        {{ section.label }}
      </button>
    </div>

    <!-- Color Palette Section -->
    <section v-if="activeSection === 'colors'" class="gallery-section">
      <h2 class="section-title">Color Palette</h2>

      <!-- Functional Colors -->
      <div class="subsection">
        <h3 class="subsection-title">Functional Colors</h3>
        <div class="color-grid">
          <div class="color-card">
            <div class="color-swatch work"></div>
            <div class="color-info">
              <span class="color-name">Work</span>
              <span class="color-value">#10b981</span>
              <span class="color-usage">Active timers, productivity actions</span>
            </div>
          </div>
          <div class="color-card">
            <div class="color-swatch break"></div>
            <div class="color-info">
              <span class="color-name">Break</span>
              <span class="color-value">#f59e0b</span>
              <span class="color-usage">Short breaks, attention needed</span>
            </div>
          </div>
          <div class="color-card">
            <div class="color-swatch focus"></div>
            <div class="color-info">
              <span class="color-name">Focus</span>
              <span class="color-value">#8b5cf6</span>
              <span class="color-usage">Deep work, meditation</span>
            </div>
          </div>
          <div class="color-card">
            <div class="color-swatch navigation"></div>
            <div class="color-info">
              <span class="color-name">Navigation</span>
              <span class="color-value">#3b82f6</span>
              <span class="color-usage">Links, future actions</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Priority Colors -->
      <div class="subsection">
        <h3 class="subsection-title">Priority Colors</h3>
        <div class="color-grid">
          <div class="color-card">
            <div class="color-swatch priority-high"></div>
            <div class="color-info">
              <span class="color-name">High Priority</span>
              <span class="color-value">#ef4444</span>
              <span class="color-usage">Urgent tasks, warnings</span>
            </div>
          </div>
          <div class="color-card">
            <div class="color-swatch priority-medium"></div>
            <div class="color-info">
              <span class="color-name">Medium Priority</span>
              <span class="color-value">#f59e0b</span>
              <span class="color-usage">Default priority level</span>
            </div>
          </div>
          <div class="color-card">
            <div class="color-swatch priority-low"></div>
            <div class="color-info">
              <span class="color-name">Low Priority</span>
              <span class="color-value">#3b82f6</span>
              <span class="color-usage">Future tasks, low urgency</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Typography Section -->
    <section v-if="activeSection === 'typography'" class="gallery-section">
      <h2 class="section-title">Typography</h2>

      <!-- Font Hierarchy -->
      <div class="subsection">
        <h3 class="subsection-title">Font Hierarchy</h3>
        <div class="typography-examples">
          <div class="type-example">
            <div class="type-display type-xl">Page Title (1.25rem)</div>
            <code class="type-code">var(--text-xl) + var(--font-semibold)</code>
          </div>
          <div class="type-example">
            <div class="type-display type-lg">Section Header (1.125rem)</div>
            <code class="type-code">var(--text-lg) + var(--font-semibold)</code>
          </div>
          <div class="type-example">
            <div class="type-display type-base">Body Text (1rem)</div>
            <code class="type-code">var(--text-base) + var(--font-medium)</code>
          </div>
          <div class="type-example">
            <div class="type-display type-sm">Interface Text (0.875rem)</div>
            <code class="type-code">var(--text-sm) + var(--font-medium)</code>
          </div>
          <div class="type-example">
            <div class="type-display type-xs">Metadata (0.75rem)</div>
            <code class="type-code">var(--text-xs) + var(--font-normal)</code>
          </div>
        </div>
      </div>

      <!-- Special Typography -->
      <div class="subsection">
        <h3 class="subsection-title">Special Typography</h3>
        <div class="typography-examples">
          <div class="type-example">
            <div class="timer-display-demo">25:00</div>
            <code class="type-code">Open Sans - Timer Display</code>
          </div>
          <div class="type-example">
            <div class="section-label-demo">PROJECTS</div>
            <code class="type-code">Uppercase Section Labels</code>
          </div>
        </div>
      </div>
    </section>

    <!-- Icon Library Section -->
    <section v-if="activeSection === 'icons'" class="gallery-section">
      <h2 class="section-title">Icon Library</h2>

      <!-- Icon Sizes -->
      <div class="subsection">
        <h3 class="subsection-title">Icon Sizes</h3>
        <div class="icon-size-demo">
          <div class="icon-example">
            <Timer :size="10" :stroke-width="1.5" />
            <span>10px - Micro</span>
          </div>
          <div class="icon-example">
            <Timer :size="12" :stroke-width="1.5" />
            <span>12px - Small</span>
          </div>
          <div class="icon-example">
            <Timer :size="14" :stroke-width="1.5" />
            <span>14px - Medium</span>
          </div>
          <div class="icon-example">
            <Timer :size="16" :stroke-width="1.5" />
            <span>16px - Large</span>
          </div>
          <div class="icon-example">
            <Timer :size="20" :stroke-width="1.5" />
            <span>20px - Display</span>
          </div>
          <div class="icon-example">
            <Timer :size="24" :stroke-width="1.5" />
            <span>24px - Hero</span>
          </div>
        </div>
      </div>

      <!-- Functional Icons -->
      <div class="subsection">
        <h3 class="subsection-title">Functional Icons</h3>
        <div class="functional-icons">
          <div class="icon-group">
            <h4>Productivity</h4>
            <div class="icon-row">
              <div class="icon-demo">
                <Timer :size="16" :stroke-width="1.5" class="icon-work" />
                <span>Timer</span>
              </div>
              <div class="icon-demo">
                <Play :size="16" :stroke-width="1.5" class="icon-work" />
                <span>Play</span>
              </div>
              <div class="icon-demo">
                <Pause :size="16" :stroke-width="1.5" class="icon-break" />
                <span>Pause</span>
              </div>
              <div class="icon-demo">
                <Square :size="16" :stroke-width="1.5" class="icon-danger" />
                <span>Stop</span>
              </div>
            </div>
          </div>

          <div class="icon-group">
            <h4>Navigation</h4>
            <div class="icon-row">
              <div class="icon-demo">
                <Calendar :size="16" :stroke-width="1.5" class="icon-navigation" />
                <span>Calendar</span>
              </div>
              <div class="icon-demo">
                <Inbox :size="16" :stroke-width="1.5" class="icon-navigation" />
                <span>Tasks</span>
              </div>
              <div class="icon-demo">
                <Settings :size="16" :stroke-width="1.5" class="icon-neutral" />
                <span>Settings</span>
              </div>
              <div class="icon-demo">
                <Plus :size="16" :stroke-width="1.5" class="icon-work" />
                <span>Add</span>
              </div>
            </div>
          </div>

          <div class="icon-group">
            <h4>Actions</h4>
            <div class="icon-row">
              <div class="icon-demo">
                <Edit :size="16" :stroke-width="1.5" class="icon-navigation" />
                <span>Edit</span>
              </div>
              <div class="icon-demo">
                <Copy :size="16" :stroke-width="1.5" class="icon-neutral" />
                <span>Copy</span>
              </div>
              <div class="icon-demo">
                <Trash2 :size="16" :stroke-width="1.5" class="icon-danger" />
                <span>Delete</span>
              </div>
              <div class="icon-demo">
                <Flag :size="16" :stroke-width="1.5" class="icon-break" />
                <span>Priority</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Components Section -->
    <section v-if="activeSection === 'components'" class="gallery-section">
      <h2 class="section-title">Component Patterns</h2>

      <!-- Buttons -->
      <div class="subsection">
        <h3 class="subsection-title">Buttons</h3>
        <div class="component-grid">
          <div class="component-example">
            <h4>Primary Buttons</h4>
            <div class="button-row">
              <button class="btn btn-primary">
                <Play :size="14" :stroke-width="1.5" />
                Start Timer
              </button>
              <button class="btn btn-secondary">
                <Settings :size="14" :stroke-width="1.5" />
                Settings
              </button>
              <button class="btn btn-danger">
                <Trash2 :size="14" :stroke-width="1.5" />
                Delete
              </button>
            </div>
          </div>

          <div class="component-example">
            <h4>Icon Buttons</h4>
            <div class="button-row">
              <button class="btn-icon">
                <Play :size="16" :stroke-width="1.5" />
              </button>
              <button class="btn-icon">
                <Pause :size="16" :stroke-width="1.5" />
              </button>
              <button class="btn-icon">
                <Square :size="16" :stroke-width="1.5" />
              </button>
              <button class="btn-icon">
                <Plus :size="16" :stroke-width="1.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Inputs -->
      <div class="subsection">
        <h3 class="subsection-title">Form Elements</h3>
        <div class="component-grid">
          <div class="component-example">
            <h4>Text Inputs</h4>
            <div class="input-examples">
              <input type="text" class="input" placeholder="Standard input field" />
              <div class="input-with-icon">
                <Search :size="14" :stroke-width="1.5" class="input-icon" />
                <input type="text" class="input" placeholder="Search tasks..." />
              </div>
              <textarea class="input textarea" placeholder="Multiline text area" rows="3"></textarea>
            </div>
          </div>
        </div>
      </div>

      <!-- Cards -->
      <div class="subsection">
        <h3 class="subsection-title">Cards & Containers</h3>
        <div class="component-grid">
          <div class="component-example">
            <h4>Task Cards</h4>
            <div class="card-examples">
              <div class="card task-card-demo">
                <div class="task-demo-header">
                  <span class="task-demo-title">Example Task Title</span>
                  <div class="task-demo-badges">
                    <Clock :size="10" :stroke-width="1.5" class="icon-work" />
                    <Flag :size="10" :stroke-width="1.5" class="icon-danger" />
                  </div>
                </div>
                <div class="task-demo-meta">
                  <span class="demo-meta-item">
                    <Timer :size="10" :stroke-width="1.5" />
                    3 sessions
                  </span>
                  <span class="demo-subtask-count">2/4 subtasks</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Interactive Section -->
    <section v-if="activeSection === 'interactive'" class="gallery-section">
      <h2 class="section-title">Interactive Elements</h2>

      <!-- Context Menu Demo -->
      <div class="subsection">
        <h3 class="subsection-title">Context Menus</h3>
        <div class="demo-container">
          <div class="context-menu-demo">
            <div class="demo-task-card" @contextmenu.prevent="showDemoContextMenu = !showDemoContextMenu">
              Right-click to see context menu
            </div>

            <div v-if="showDemoContextMenu" class="demo-context-menu">
              <button class="menu-item">
                <Edit :size="16" :stroke-width="1.5" />
                <span>Edit</span>
                <span class="shortcut">Ctrl+E</span>
              </button>
              <div class="menu-divider"></div>
              <div class="date-section">
                <div class="section-header-demo">
                  <Calendar :size="14" :stroke-width="1.5" />
                  <span>Date</span>
                  <span>T</span>
                </div>
                <div class="icon-row-demo">
                  <button class="icon-btn-demo"><Calendar :size="16" :stroke-width="1.5" class="icon-work" /></button>
                  <button class="icon-btn-demo"><Sun :size="16" :stroke-width="1.5" class="icon-break" /></button>
                  <button class="icon-btn-demo"><Moon :size="16" :stroke-width="1.5" class="icon-focus" /></button>
                  <button class="icon-btn-demo"><ArrowRight :size="16" :stroke-width="1.5" class="icon-navigation" /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Timer Display Demo -->
      <div class="subsection">
        <h3 class="subsection-title">Timer Display</h3>
        <div class="demo-container">
          <div class="timer-demo">
            <div class="timer-display-example">
              <Timer :size="20" :stroke-width="1.5" class="icon-work" />
              <div class="timer-info-demo">
                <div class="timer-time-demo">25:00</div>
                <div class="timer-task-demo">Learning Vue 3 Patterns</div>
              </div>
              <div class="timer-controls-demo">
                <button class="btn-icon">
                  <Play :size="16" :stroke-width="1.5" class="icon-work" />
                </button>
                <button class="btn-icon">
                  <Coffee :size="16" :stroke-width="1.5" class="icon-break" />
                </button>
                <button class="btn-icon">
                  <User :size="16" :stroke-width="1.5" class="icon-focus" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Live Demo Section - NEW COHESIVE DESIGN SYSTEM -->
    <section v-if="activeSection === 'live-demo'" class="gallery-section">
      <h2 class="section-title">Cohesive Design System - Live Demo</h2>

      <!-- Theme Switcher -->
      <div class="subsection">
        <h3 class="subsection-title">
          Theme Switching (Watch Everything Update!)
        </h3>
        <div class="demo-container">
          <BaseButton @click="toggleTheme" variant="primary" size="lg">
            <Moon v-if="!isDarkMode" :size="16" />
            <Sun v-else :size="16" />
            Switch to {{ isDarkMode ? 'Light' : 'Dark' }} Theme
          </BaseButton>
          <p style="margin-top: 1rem; color: var(--text-muted); font-size: var(--text-sm);">
            Notice how ALL components update instantly when you toggle the theme.
            This is the power of a cohesive token-based design system!
          </p>
        </div>
      </div>

      <!-- Base Components -->
      <div class="subsection">
        <h3 class="subsection-title">Base Components (Using Design Tokens)</h3>

        <div class="component-grid">
          <!-- Buttons Demo -->
          <BaseCard>
            <template #header>
              <h4>Button Variants</h4>
            </template>
            <div style="display: flex; flex-direction: column; gap: var(--space-4);">
              <BaseButton variant="primary" size="lg">
                <Play :size="16" />
                Primary Button
              </BaseButton>
              <BaseButton variant="secondary" size="md">
                <Settings :size="14" />
                Secondary Button
              </BaseButton>
              <BaseButton variant="ghost" size="sm">
                <Edit :size="12" />
                Ghost Button
              </BaseButton>
              <BaseButton variant="danger" size="md">
                <Trash2 :size="14" />
                Danger Button
              </BaseButton>
            </div>
          </BaseCard>

          <!-- Input Demo -->
          <BaseCard>
            <template #header>
              <h4>Input Component</h4>
            </template>
            <div style="display: flex; flex-direction: column; gap: var(--space-4);">
              <BaseInput
                v-model="testInputValue"
                label="Task Title"
                placeholder="Enter task name..."
                helper-text="All styling uses design tokens"
              >
                <template #prefix>
                  <Plus :size="14" style="color: var(--text-muted);" />
                </template>
              </BaseInput>

              <BaseInput
                v-model="testInputValue"
                type="email"
                label="Email"
                placeholder="your@email.com"
                required
              />
            </div>
          </BaseCard>

          <!-- Card Variants Demo -->
          <BaseCard glass hoverable>
            <template #header>
              <h4>Glass Card (Hoverable)</h4>
            </template>
            <p style="color: var(--text-secondary); font-size: var(--text-sm);">
              This card uses glassmorphism effects defined in design tokens.
              Hover to see the effect!
            </p>
          </BaseCard>

          <BaseCard elevated>
            <template #header>
              <h4>Elevated Card</h4>
            </template>
            <p style="color: var(--text-secondary); font-size: var(--text-sm);">
              This card has elevated shadows from the token system.
            </p>
          </BaseCard>
        </div>
      </div>

      <!-- Token Visualization -->
      <div class="subsection">
        <h3 class="subsection-title">Current Theme Tokens</h3>
        <div class="token-display">
          <div class="token-row">
            <span class="token-name">Primary Surface:</span>
            <div class="token-value" :style="{ background: 'var(--surface-primary)' }">
              {{ currentTheme.tokens['surface-primary'] }}
            </div>
          </div>
          <div class="token-row">
            <span class="token-name">Primary Text:</span>
            <div class="token-value" :style="{ color: 'var(--text-primary)' }">
              {{ currentTheme.tokens['text-primary'] }}
            </div>
          </div>
          <div class="token-row">
            <span class="token-name">Border Color:</span>
            <div class="token-value" :style="{ borderColor: 'var(--border-primary)', borderWidth: '2px', borderStyle: 'solid' }">
              {{ currentTheme.tokens['border-primary'] }}
            </div>
          </div>
          <p style="margin-top: var(--space-4); color: var(--text-muted); font-size: var(--text-xs);">
            All tokens are reactive. Change one token, and everything using it updates instantly!
          </p>
        </div>
      </div>
    </section>

    <!-- Usage Guidelines -->
    <section v-if="activeSection === 'guidelines'" class="gallery-section">
      <h2 class="section-title">Usage Guidelines</h2>

      <div class="guidelines-grid">
        <div class="guideline-card">
          <h4>Icon Standards</h4>
          <ul class="guideline-list">
            <li>Always use Lucide icons with stroke-width="1.5"</li>
            <li>Follow size scale: 10px, 12px, 14px, 16px, 20px, 24px</li>
            <li>Apply functional colors based on context</li>
            <li>Never mix icon libraries</li>
          </ul>
        </div>

        <div class="guideline-card">
          <h4>Color Application</h4>
          <ul class="guideline-list">
            <li>Green for work, productivity, active states</li>
            <li>Orange for breaks, warnings, attention</li>
            <li>Purple for deep work, meditation, focus</li>
            <li>Blue for navigation, future actions</li>
            <li>Red for urgent tasks, delete actions</li>
          </ul>
        </div>

        <div class="guideline-card">
          <h4>Typography Rules</h4>
          <ul class="guideline-list">
            <li>Open Sans for timer displays and emphasis</li>
            <li>System fonts for UI text and labels</li>
            <li>Follow font weight hierarchy: 400, 500, 600</li>
            <li>Use design tokens: var(--text-*)</li>
          </ul>
        </div>

        <div class="guideline-card">
          <h4>Spacing & Layout</h4>
          <ul class="guideline-list">
            <li>Use 4px grid system: var(--space-*)</li>
            <li>Consistent button sizing: 36x36px standard</li>
            <li>Border radius: 6px for most elements</li>
            <li>Maintain visual rhythm and hierarchy</li>
          </ul>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useTheme } from '@/composables/useTheme'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseCard from '@/components/base/BaseCard.vue'
import {
  Palette, Type, Smile, Layers, Calendar, Sun, Moon, ArrowRight,
  Timer, Play, Pause, Square, Plus, Settings, Edit, Copy, Trash2,
  Flag, Clock, Inbox, Search, User, Coffee
} from 'lucide-vue-next'

const { isDarkMode, toggleTheme, currentTheme, updateToken } = useTheme()

const activeSection = ref('colors')
const showDemoContextMenu = ref(false)
const testInputValue = ref('')

const sections = [
  { id: 'colors', label: 'Colors', icon: Palette },
  { id: 'typography', label: 'Typography', icon: Type },
  { id: 'icons', label: 'Icons', icon: Smile },
  { id: 'components', label: 'Components', icon: Layers },
  { id: 'interactive', label: 'Interactive', icon: Play },
  { id: 'live-demo', label: 'Live Demo', icon: Settings },
  { id: 'guidelines', label: 'Guidelines', icon: Inbox }
]
</script>

<style scoped>
.design-system-gallery {
  min-height: 100vh;
  background: var(--bg-primary);
  padding: var(--space-8);
}

.gallery-header {
  text-align: center;
  margin-bottom: var(--space-12);
}

.gallery-title {
  color: var(--text-primary);
  font-size: var(--text-3xl);
  font-weight: var(--font-semibold);
  margin: 0 0 var(--space-4) 0;
}

.gallery-subtitle {
  color: var(--text-muted);
  font-size: var(--text-lg);
  margin: 0;
}

.section-nav {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-12);
  justify-content: center;
  flex-wrap: wrap;
}

.nav-tab {
  background: transparent;
  border: 1px solid var(--border-secondary);
  color: var(--text-muted);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--transition-fast);
}

.nav-tab:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
  color: var(--text-secondary);
}

.nav-tab.active {
  background: var(--color-navigation);
  border-color: var(--color-navigation);
  color: #ffffff;
}

.gallery-section {
  max-width: 1200px;
  margin: 0 auto;
}

.section-title {
  color: var(--text-primary);
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  margin: 0 0 var(--space-8) 0;
}

.subsection {
  margin-bottom: var(--space-12);
}

.subsection-title {
  color: var(--text-secondary);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  margin: 0 0 var(--space-6) 0;
}

/* Color Swatches */
.color-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--space-6);
}

.color-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
}

.color-swatch {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  flex-shrink: 0;
}

.color-swatch.work { background: var(--color-work); }
.color-swatch.break { background: var(--color-break); }
.color-swatch.focus { background: var(--color-focus); }
.color-swatch.navigation { background: var(--color-navigation); }
.color-swatch.priority-high { background: var(--color-priority-high); }
.color-swatch.priority-medium { background: var(--color-priority-medium); }
.color-swatch.priority-low { background: var(--color-priority-low); }

.color-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.color-name {
  color: var(--text-primary);
  font-weight: var(--font-semibold);
  font-size: var(--text-sm);
}

.color-value {
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-family: monospace;
}

.color-usage {
  color: var(--text-subtle);
  font-size: var(--text-xs);
}

/* Typography Examples */
.typography-examples {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.type-example {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
}

.type-display {
  color: var(--text-primary);
  margin: 0;
}

.type-xl { font-size: var(--text-xl); font-weight: var(--font-semibold); }
.type-lg { font-size: var(--text-lg); font-weight: var(--font-semibold); }
.type-base { font-size: var(--text-base); font-weight: var(--font-medium); }
.type-sm { font-size: var(--text-sm); font-weight: var(--font-medium); }
.type-xs { font-size: var(--text-xs); font-weight: var(--font-normal); }

.type-code {
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-family: monospace;
  background: var(--bg-tertiary);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
}

.timer-display-demo {
  font-family: var(--font-primary);
  font-size: var(--text-3xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.section-label-demo {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Icon Demonstrations */
.icon-size-demo {
  display: flex;
  gap: var(--space-8);
  align-items: end;
}

.icon-example {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-primary);
}

.icon-example span {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.functional-icons {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.icon-group h4 {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  margin: 0 0 var(--space-4) 0;
}

.icon-row {
  display: flex;
  gap: var(--space-6);
  flex-wrap: wrap;
}

.icon-demo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  min-width: 80px;
}

.icon-demo span {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* Component Examples */
.component-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-8);
}

.component-example {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
}

.component-example h4 {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  margin: 0 0 var(--space-4) 0;
}

.button-row {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.btn-primary {
  background: var(--color-work);
  border-color: var(--color-work);
  color: #ffffff;
}

.btn-secondary {
  background: transparent;
  border-color: var(--border-secondary);
  color: var(--text-muted);
}

.btn-danger {
  background: var(--color-danger);
  border-color: var(--color-danger);
  color: #ffffff;
}

.input-examples {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.input-with-icon {
  position: relative;
}

.input-icon {
  position: absolute;
  left: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-subtle);
}

.input-with-icon .input {
  padding-left: calc(var(--space-8) + var(--space-2));
}

.textarea {
  resize: vertical;
  font-family: inherit;
}

/* Interactive Demos */
.demo-container {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-8);
}

.context-menu-demo {
  position: relative;
  display: inline-block;
}

.demo-task-card {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  padding: var(--space-6);
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.demo-task-card:hover {
  border-color: var(--border-hover);
}

.demo-context-menu {
  position: absolute;
  top: 100%;
  left: 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-dark-lg);
  padding: var(--space-4) 0;
  min-width: 200px;
  z-index: 1000;
}

.menu-item {
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-primary);
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  transition: background-color var(--transition-fast);
}

.menu-item:hover {
  background: var(--bg-hover);
}

.shortcut {
  margin-left: auto;
  color: var(--text-subtle);
  font-size: var(--text-xs);
}

.menu-divider {
  height: 1px;
  background: var(--border-primary);
  margin: var(--space-2) 0;
}

.date-section {
  padding: var(--space-3) var(--space-4);
}

.section-header-demo {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.icon-row-demo {
  display: flex;
  gap: var(--space-2);
}

.icon-btn-demo {
  background: transparent;
  border: 1px solid var(--border-secondary);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.icon-btn-demo:hover {
  background: var(--bg-hover);
}

/* Timer Demo */
.timer-demo {
  display: flex;
  justify-content: center;
}

.timer-display-example {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-lg);
  padding: var(--space-6) var(--space-8);
}

.timer-info-demo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}

.timer-time-demo {
  font-family: var(--font-primary);
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.timer-task-demo {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.timer-controls-demo {
  display: flex;
  gap: var(--space-2);
}

/* Task Card Demo */
.task-card-demo {
  max-width: 300px;
}

.task-demo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.task-demo-title {
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

.task-demo-badges {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.task-demo-meta {
  display: flex;
  gap: var(--space-4);
  align-items: center;
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.demo-meta-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.demo-subtask-count {
  background: var(--blue-bg-subtle);
  color: var(--color-navigation);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-lg);
}

/* Guidelines */
.guidelines-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-6);
}

.guideline-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
}

.guideline-card h4 {
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  margin: 0 0 var(--space-4) 0;
}

.guideline-list {
  margin: 0;
  padding-left: var(--space-6);
  color: var(--text-muted);
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
}

.guideline-list li {
  margin-bottom: var(--space-2);
}

/* Live Demo Section Styles */
.token-display {
  background: var(--surface-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
}

.token-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  margin-bottom: var(--space-2);
  background: var(--surface-hover);
  border-radius: var(--radius-md);
}

.token-name {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

.token-value {
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  padding: var(--space-2) var(--space-4);
  background: var(--surface-tertiary);
  border-radius: var(--radius-sm);
  min-width: 200px;
  text-align: right;
}
</style>