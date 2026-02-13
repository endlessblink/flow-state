import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { Timer, Sparkles } from 'lucide-vue-next'

/**
 * AppHeader - Main Application Header
 *
 * The primary navigation and control header for FlowState.
 *
 * **Components:**
 * 1. Page title (dynamic based on route + filter)
 * 2. Control panel (gamification HUD + sync status + AI + timer)
 * 3. View tabs (Canvas, Calendar, Board, Catalog, Quick Sort, Cyberflow)
 *
 * **Features:**
 * - Dynamic hierarchical page title
 * - Gamification HUD with XP/level (FEATURE-1118)
 * - Sync status indicator (TASK-1177)
 * - AI assistant toggle (TASK-1120)
 * - Current time display
 * - Quick task dropdown (FEATURE-1248)
 * - Integrated Pomodoro timer
 * - View tab navigation
 *
 * **Store Dependencies:**
 * - taskStore: Active filters, task count
 * - timerStore: Timer state
 * - aiChatStore: AI panel state
 * - settingsStore: Gamification enabled
 * - authStore: Authentication state
 */
const meta: Meta = {
  title: '🏢 Layout/AppHeader',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `Main application header with navigation, controls, and integrated timer.

**Layout:**
- Top row: Page title + control panel (gamification, sync, AI, time, timer)
- Bottom row: View tabs (Canvas, Calendar, Board, Catalog, Quick Sort, Cyberflow)

**Control Panel:**
- Gamification HUD: XP bar, level, achievements access
- Sync Status: Real-time sync indicator
- AI Assistant: Toggle AI chat panel
- Time Display: Current time
- Quick Task: Dropdown for quick timer actions
- Timer: Pomodoro timer with start/pause/stop controls

**Key Features:**
- Glass morphism styling
- Responsive design
- Keyboard shortcuts
- Real-time updates
- RTL support for task names

**Note:** Full functionality requires store setup. This story shows layout and styling.`
      }
    }
  }
}

export default meta
type Story = StoryObj

function setupMockStores() {
  const pinia = createPinia()
  setActivePinia(pinia)
}

/**
 * Default - No Timer Active
 *
 * Shows the header with inactive timer state.
 */
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Header with inactive timer and all controls visible.'
      }
    }
  },
  render: () => ({
    components: { Timer, Sparkles },
    setup() {
      setupMockStores()
      return {}
    },
    template: `
      <div style="
        min-height: 100vh;
        background: var(--app-background-gradient);
        padding: var(--space-12);
      ">
        <!-- App Header Container -->
        <header style="
          display: flex;
          flex-direction: column;
          width: 100%;
        ">
          <!-- Header Section -->
          <div style="
            display: flex;
            justify-content: flex-start;
            align-items: center;
            gap: var(--space-4);
            margin-bottom: var(--space-6);
          ">
            <!-- Page Title -->
            <div style="
              display: flex;
              flex-direction: column;
              align-items: flex-start;
            ">
              <h1 style="
                font-size: var(--text-2xl);
                font-weight: 800;
                letter-spacing: -0.02em;
                background: linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                margin: 0;
                line-height: 1.1;
              ">Canvas</h1>
              <span style="
                display: flex;
                align-items: center;
                gap: var(--space-2);
                font-size: var(--text-xs);
                font-weight: 600;
                color: var(--text-muted);
                text-transform: uppercase;
                letter-spacing: 0.1em;
                margin-top: var(--space-1);
              ">Workflow</span>
            </div>

            <!-- Integrated Control Panel -->
            <div style="
              display: flex;
              align-items: center;
              gap: var(--space-4);
              padding: var(--space-3) var(--space-4);
              margin-left: auto;
              background: var(--glass-bg-medium);
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-lg);
              backdrop-filter: blur(var(--blur-md));
              box-shadow: var(--shadow-xl);
            ">
              <!-- Sync Status -->
              <div style="
                width: 8px;
                height: 8px;
                background: var(--color-success);
                border-radius: var(--radius-full);
                box-shadow: 0 0 8px var(--success-shadow);
              " title="Synced"></div>

              <div style="
                width: 1px;
                height: 24px;
                background: var(--border-subtle);
              "></div>

              <!-- AI Toggle -->
              <button style="
                display: flex;
                align-items: center;
                justify-content: center;
                width: 36px;
                height: 36px;
                border: none;
                background: transparent;
                color: var(--text-muted);
                border-radius: var(--radius-md);
                cursor: pointer;
              ">
                <Sparkles :size="18" />
              </button>

              <div style="
                width: 1px;
                height: 24px;
                background: var(--border-subtle);
              "></div>

              <!-- Time Display -->
              <div style="
                font-size: var(--text-sm);
                color: var(--text-secondary);
                font-weight: var(--font-medium);
              ">14:35</div>

              <!-- Timer Display -->
              <div style="
                display: flex;
                align-items: center;
                gap: var(--space-3);
                padding: var(--space-2) var(--space-3);
                border-radius: var(--radius-xl);
                border: 1.5px solid transparent;
              ">
                <div style="
                  display: flex;
                  align-items: center;
                  justify-content: center;
                ">
                  <Timer :size="20" style="color: var(--color-work); opacity: 0.7;" />
                </div>
                <div style="
                  display: flex;
                  flex-direction: row;
                  align-items: center;
                  gap: var(--space-2);
                ">
                  <div style="
                    font-family: 'Open Sans', sans-serif;
                    font-size: var(--text-lg);
                    font-weight: var(--font-semibold);
                    color: var(--text-secondary);
                    min-width: 4rem;
                  ">25:00</div>
                </div>
                <div style="display: flex; gap: var(--space-1);">
                  <button style="
                    background: transparent;
                    border: none;
                    color: var(--color-work);
                    width: 1.75rem;
                    height: 1.75rem;
                    border-radius: var(--radius-6);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  ">▶</button>
                </div>
              </div>
            </div>
          </div>

          <!-- View Tabs -->
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: var(--space-6);
            border-bottom: 1px solid var(--glass-border-hover);
            padding-bottom: var(--space-3);
          ">
            <div style="display: flex; gap: 0.125rem;">
              <a href="#" style="
                background: var(--state-active-bg);
                border: 1px solid var(--state-active-border);
                color: var(--state-active-text);
                padding: var(--space-3) var(--space-4);
                font-size: var(--text-sm);
                font-weight: var(--font-semibold);
                border-radius: var(--radius-md);
                text-decoration: none;
                backdrop-filter: var(--state-active-glass);
                box-shadow: var(--shadow-md);
              ">Canvas</a>
              <a href="#" style="
                background: transparent;
                border: 1px solid transparent;
                color: var(--text-muted);
                padding: var(--space-3) var(--space-4);
                font-size: var(--text-sm);
                font-weight: var(--font-medium);
                border-radius: var(--radius-md);
                text-decoration: none;
              ">Calendar</a>
              <a href="#" style="
                background: transparent;
                border: 1px solid transparent;
                color: var(--text-muted);
                padding: var(--space-3) var(--space-4);
                font-size: var(--text-sm);
                font-weight: var(--font-medium);
                border-radius: var(--radius-md);
                text-decoration: none;
              ">Board</a>
              <a href="#" style="
                background: transparent;
                border: 1px solid transparent;
                color: var(--text-muted);
                padding: var(--space-3) var(--space-4);
                font-size: var(--text-sm);
                font-weight: var(--font-medium);
                border-radius: var(--radius-md);
                text-decoration: none;
              ">Catalog</a>
              <a href="#" style="
                background: transparent;
                border: 1px solid transparent;
                color: var(--text-muted);
                padding: var(--space-3) var(--space-4);
                font-size: var(--text-sm);
                font-weight: var(--font-medium);
                border-radius: var(--radius-md);
                text-decoration: none;
                display: flex;
                align-items: center;
                gap: var(--space-2);
              ">
                Quick Sort
                <span style="
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                  min-width: 20px;
                  height: 20px;
                  padding: 0 var(--space-1_5);
                  background: linear-gradient(135deg, var(--color-blue), #8b5cf6);
                  border-radius: var(--radius-md);
                  font-size: var(--text-xs);
                  font-weight: 700;
                  color: #ffffff;
                ">5</span>
              </a>
              <a href="#" style="
                background: transparent;
                border: 1px solid transparent;
                color: var(--text-muted);
                padding: var(--space-3) var(--space-4);
                font-size: var(--text-sm);
                font-weight: var(--font-medium);
                border-radius: var(--radius-md);
                text-decoration: none;
              ">Cyberflow</a>
            </div>
          </div>
        </header>

        <!-- Content Area Placeholder -->
        <div style="
          padding: var(--space-8);
          background: var(--glass-bg-soft);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-xl);
          text-align: center;
          color: var(--text-muted);
        ">
          View content goes here
        </div>
      </div>
    `
  })
}

/**
 * Timer Active
 *
 * Shows the header with an active timer.
 */
export const TimerActive: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Header with active Pomodoro timer showing task name and time remaining.'
      }
    }
  },
  render: () => ({
    setup() {
      return {}
    },
    template: `
      <div style="
        min-height: 100vh;
        background: var(--app-background-gradient);
        padding: var(--space-12);
      ">
        <header style="
          display: flex;
          flex-direction: column;
          width: 100%;
        ">
          <div style="
            display: flex;
            justify-content: flex-start;
            align-items: center;
            gap: var(--space-4);
            margin-bottom: var(--space-6);
          ">
            <div style="
              display: flex;
              flex-direction: column;
              align-items: flex-start;
            ">
              <h1 style="
                font-size: var(--text-2xl);
                font-weight: 800;
                background: linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                margin: 0;
                line-height: 1.1;
              ">Canvas</h1>
            </div>

            <!-- Control Panel with Active Timer -->
            <div style="
              display: flex;
              align-items: center;
              gap: var(--space-4);
              padding: var(--space-3) var(--space-4);
              margin-left: auto;
              background: var(--glass-bg-medium);
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-lg);
              backdrop-filter: blur(var(--blur-md));
              box-shadow: var(--shadow-xl);
            ">
              <!-- Timer Display - Active -->
              <div style="
                display: flex;
                align-items: center;
                gap: var(--space-3);
                padding: var(--space-2) var(--space-3);
                border-radius: var(--radius-xl);
                border: 1.5px solid var(--timer-work-stroke);
                box-shadow: var(--timer-work-stroke-glow);
              ">
                <div style="font-size: var(--text-2xl);">🍅</div>
                <div style="
                  display: flex;
                  flex-direction: row;
                  align-items: center;
                  gap: var(--space-2);
                ">
                  <div style="
                    font-family: 'Open Sans', sans-serif;
                    font-size: var(--text-lg);
                    font-weight: var(--font-semibold);
                    color: var(--text-secondary);
                    min-width: 4rem;
                  ">18:42</div>
                  <div style="
                    font-size: var(--text-sm);
                    color: var(--text-muted);
                    font-weight: var(--font-medium);
                    max-width: 150px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                  ">Review Q4 proposal</div>
                </div>
                <div style="display: flex; gap: var(--space-1);">
                  <button style="
                    background: transparent;
                    border: none;
                    color: var(--color-break);
                    width: 1.75rem;
                    height: 1.75rem;
                    border-radius: var(--radius-6);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  ">⏸</button>
                  <button style="
                    background: transparent;
                    border: none;
                    color: var(--color-danger);
                    width: 1.75rem;
                    height: 1.75rem;
                    border-radius: var(--radius-6);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  ">⏹</button>
                </div>
              </div>
            </div>
          </div>

          <!-- View Tabs (same as default) -->
          <div style="
            display: flex;
            gap: 0.125rem;
            margin-bottom: var(--space-6);
            border-bottom: 1px solid var(--glass-border-hover);
            padding-bottom: var(--space-3);
          ">
            <a href="#" style="
              background: var(--state-active-bg);
              border: 1px solid var(--state-active-border);
              color: var(--state-active-text);
              padding: var(--space-3) var(--space-4);
              font-size: var(--text-sm);
              font-weight: var(--font-semibold);
              border-radius: var(--radius-md);
              text-decoration: none;
            ">Canvas</a>
          </div>
        </header>
      </div>
    `
  })
}
