import type { Meta, StoryObj } from '@storybook/vue3'
import { ref, reactive } from 'vue'
import CommandPalette from '@/components/CommandPalette.vue'

// Mock CustomSelect component for stories
const MockCustomSelect = {
  template: `
    <select
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
      class="field-select"
      :placeholder="placeholder"
    >
      <option value="">{{ placeholder }}</option>
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  `,
  props: ['modelValue', 'options', 'placeholder'],
  emits: ['update:modelValue']
}

// Mock task store
const createMockTaskStore = () => ({
  projects: [
    { id: '1', name: 'Work Projects', emoji: '💼' },
    { id: '2', name: 'Personal Tasks', emoji: '🏠' },
    { id: '3', name: 'Learning', emoji: '📚' },
    { id: '4', name: 'Fitness', emoji: '💪' }
  ],
  activeProjectId: '1',
  activeSmartView: 'today',
  createTask: async (task: any) => {
    console.log('Creating task:', task)
    return { id: Date.now().toString(), ...task }
  }
})

const meta = {
  component: CommandPalette,
  title: '🧩 Components/📝 Form Controls/CommandPalette',
  tags: ['autodocs'],

  parameters: {
    layout: 'fullscreen',
  },

  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Whether the command palette is open',
    },
  },
} satisfies Meta<typeof CommandPalette>

export default meta
type Story = StoryObj<typeof meta>

// Basic States
export const Closed: Story = {
  args: {
    isOpen: false,
  },
  render: (args) => ({
    components: { CommandPalette },
    setup() {
      const taskStore = createMockTaskStore()
      return { args, taskStore }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: var(--surface-secondary);">
        <h3>CommandPalette (Closed)</h3>
        <p>Press Ctrl+K or Cmd+K to open the command palette</p>
        <button
          @click="args.isOpen = true"
          style="margin-top: 20px; padding: 12px 24px; background: var(--brand-primary); color: white; border: none; border-radius: 6px; cursor: pointer;"
        >
          ⚡ Open Command Palette
        </button>
        <CommandPalette v-bind="args" ref="commandPaletteRef" />
      </div>
    `,
  })
}

export const DefaultOpen: Story = {
  args: {
    isOpen: true,
  },
  render: (args) => ({
    components: { CommandPalette },
    setup() {
      const taskStore = createMockTaskStore()
      return { args, taskStore }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: var(--surface-secondary);">
        <h3>CommandPalette (Default State)</h3>
        <p>Minimal interface with quick task input</p>
        <CommandPalette v-bind="args" ref="commandPaletteRef" />
      </div>
    `,
  })
}

// Progressive Disclosure States
export const WithExpandedOptions: Story = {
  args: {
    isOpen: true,
  },
  render: (args) => ({
    components: { CommandPalette },
    setup() {
      const taskStore = createMockTaskStore()
      const commandPaletteRef = ref()

      // Simulate expanded state after mount
      setTimeout(() => {
        if (commandPaletteRef.value) {
          commandPalette.value.showMoreOptions = true
        }
      }, 100)

      return { args, taskStore, commandPaletteRef }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: var(--surface-secondary);">
        <h3>CommandPalette (Expanded Options)</h3>
        <p>Shows additional fields for project, due date, and priority</p>
        <CommandPalette v-bind="args" ref="commandPaletteRef" />
      </div>
    `,
  })
}

// Keyboard Shortcuts Demo
export const KeyboardShortcuts: Story = {
  args: {
    isOpen: true,
  },
  render: (args) => ({
    components: { CommandPalette },
    setup() {
      const taskStore = createMockStore()
      return { args, taskStore }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: var(--surface-secondary);">
        <h3>Keyboard Shortcuts</h3>
        <div style="margin-top: 20px; padding: 20px; background: var(--surface-primary); border-radius: 8px;">
          <h4 style="margin: 0 0 12px 0;">Available Shortcuts:</h4>
          <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
            <li><kbd>Enter</kbd> - Create task</li>
            <li><kbd>Shift+Enter</kbd> - Create task and continue</li>
            <li><kbd>Esc</kbd> - Cancel and close</li>
            <li><kbd>Ctrl+K</kbd> or <kbd>Cmd+K</kbd> - Open command palette</li>
          </ul>
        </div>
        <CommandPalette v-bind="args" ref="commandPaletteRef" />
      </div>
    `,
  })
}

// Interactive Demo
export const InteractiveDemo: Story = {
  render: () => ({
    components: { CommandPalette },
    setup() {
      const isOpen = ref(false)
      const taskStore = createMockStore()
      const commandPaletteRef = ref()
      const createdTasks = ref([])
      const demoMode = ref('quick')

      const openPalette = (mode = 'quick') => {
        demoMode.value = mode
        isOpen.value = true
      }

      const handleTaskCreated = (task: any) => {
        createdTasks.value.unshift({
          ...task,
          timestamp: new Date().toLocaleTimeString()
        })
        console.log('Task created:', task)
      }

      const clearTasks = () => {
        createdTasks.value = []
      }

      const exposeCommandPalette = () => {
        if (commandPaletteRef.value) {
          commandPalette.value.open()
        }
      }

      return {
        isOpen,
        taskStore,
        commandPaletteRef,
        createdTasks,
        demoMode,
        openPalette,
        handleTaskCreated,
        clearTasks,
        exposeCommandPalette
      }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: var(--surface-secondary);">
        <h1>CommandPalette Interactive Demo</h1>

        <!-- Demo Mode Selection -->
        <div style="margin-bottom: 30px; padding: 20px; background: var(--surface-primary); border-radius: 12px; border: 1px solid var(--border-medium);">
          <h2 style="margin: 0 0 16px 0;">Demo Mode</h2>
          <div style="display: flex; gap: 12px; margin-bottom: 16px;">
            <button
              @click="openPalette('quick')"
              :style="{
                background: demoMode === 'quick' ? 'var(--brand-primary)' : 'var(--surface-hover)',
                color: demoMode === 'quick' ? 'white' : 'var(--text-primary)',
                border: '1px solid var(--border-medium)',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer'
              }"
            >
              ⚡ Quick Mode
            </button>
            <button
              @click="openPalette('full')"
              :style="{
                background: demoMode === 'full' ? 'var(--color-navigation)' : 'var(--surface-hover)',
                color: demoMode === 'full' ? 'white' : 'var(--text-primary)',
                border: '1px solid var(--border-medium)',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: pointer'
              }"
            >
              ⚙️ Full Mode
            </button>
          </div>
          <p style="margin: 0; font-size: 14px; color: var(--text-secondary);">
            Current mode: <strong>{{ demoMode === 'quick' ? 'Quick add only' : 'All options available' }}</strong>
          </p>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; gap: 12px; margin-bottom: 30px;">
          <button
            @click="exposeCommandPalette"
            style="padding: 12px 24px; background: var(--brand-primary); color: white; border: none; border-radius: 6px; cursor: pointer;"
          >
            ⚡ Open Palette (Ctrl+K)
          </button>
          <button
            @click="clearTasks"
            style="padding: 12px 24px; background: var(--surface-hover); border: 1px solid var(--border-medium); border-radius: 6px; cursor: pointer;"
          >
            🗑️ Clear Tasks
          </button>
        </div>

        <!-- Created Tasks Display -->
        <div v-if="createdTasks.length > 0" style="margin-bottom: 30px; padding: 20px; background: var(--surface-primary); border-radius: 12px; border: 1px solid var(--border-medium);">
          <h2 style="margin: 0 0 16px 0;">Created Tasks ({{ createdTasks.length }})</h2>
          <div style="display: flex; flex-direction: column; gap: 12px; max-height: 200px; overflow-y: auto;">
            <div
              v-for="task in createdTasks.slice(0, 5)"
              :key="task.id"
              style="padding: 12px; background: var(--surface-hover); border-radius: 8px; border: 1px solid var(--border-subtle);"
            >
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 500;">{{ task.title }}</span>
                <span style="font-size: 12px; color: var(--text-muted);">{{ task.timestamp }}</span>
              </div>
              <div v-if="task.projectId || task.dueDate || task.priority !== 'medium'" style="margin-top: 8px; display: flex; gap: 8px; font-size: 12px; color: var(--text-secondary);">
                <span v-if="task.projectId">📁 {{ taskStore.projects.find(p => p.id === task.projectId)?.name }}</span>
                <span v-if="task.dueDate">📅 {{ task.dueDate }}</span>
                <span v-if="task.priority !== 'medium'">🔥 {{ task.priority }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Keyboard Shortcuts Reference -->
        <div style="padding: 20px; background: var(--surface-primary); border-radius: 12px; border: 1px solid var(--border-medium);">
          <h3 style="margin: 0 0 12px 0;">Keyboard Shortcuts</h3>
          <div style="display: flex; gap: 16px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--surface-hover); border-radius: 6px;">
              <kbd style="padding: 4px 8px; background: var(--surface-tertiary); border: 1px solid var(--border-medium); border-radius: 4px; font-family: monospace; font-size: 12px;">Ctrl+K</kbd>
              <span>Open</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--surface-hover); border-radius: 6px;">
              <kbd style="padding: 4px 8px; background: var(--surface-tertiary); border: 1px solid var(--border-medium); border-radius: 4px; font-family: monospace; font-size: 12px;">Enter</kbd>
              <span>Create</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--surface-hover); border-radius: 6px;">
              <kbd style="padding: 4px 8px; background: var(--surface-tertiary); border: 1px solid var(--border-medium); border-radius: 4px; font-family: monospace; font-size: 12px;">Shift+Enter</kbd>
              <span>Create + Continue</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--surface-hover); border-radius: 6px;">
              <kbd style="padding: 4px 8px; background: var(--surface-tertiary); border: 1px solid var(--border-medium); border-radius: 4px; font-family: monospace; font-size: 12px;">Esc</kbd>
              <span>Close</span>
            </div>
          </div>
        </div>

        <!-- CommandPalette Component -->
        <CommandPalette
          :is-open="isOpen"
          ref="commandPaletteRef"
          @close="isOpen = false"
          @select="handleTaskCreated"
        />
      </div>
    `,
  })
}

// Productivity Workflows
export const ProductivityWorkflow: Story = {
  render: () => ({
    components: { CommandPalette },
    setup() {
      const scenarios = reactive([
        {
          title: 'Quick Capture',
          description: 'Capture tasks as they come to mind',
          input: 'Review quarterly report',
          expectedOutcome: 'Task created with today\'s date'
        },
        {
          title: 'Batch Entry',
          description: 'Add multiple tasks in sequence',
          input: 'Plan Q4 objectives',
          expectedOutcome: 'Task created, input cleared for next task'
        },
        {
          title: 'Detailed Planning',
          description: 'Add task with full details',
          input: 'Complete frontend refactoring',
          expectedOutcome: 'All fields pre-filled from context'
        }
      ])

      const currentScenario = ref(0)
      const isOpen = ref(false)
      const taskStore = createMockTaskStore()

      const runScenario = (index: number) => {
        currentScenario.value = index
        isOpen.value = true
        setTimeout(() => {
          const scenario = scenarios[index]
          // Simulate typing
          const input = document.querySelector('.task-input') as HTMLInputElement
          if (input) {
            input.value = scenario.input
            setTimeout(() => {
              input.focus()
            }, 100)
          }
        }, 300)
      }

      return {
        scenarios,
        currentScenario,
        isOpen,
        taskStore,
        runScenario
      }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: var(--surface-secondary);">
        <h1>CommandPalette Productivity Workflows</h1>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 40px;">
          <div
            v-for="(scenario, index) in scenarios"
            :key="index"
            :style="{
              padding: '24px',
              background: var(--surface-primary)',
              'border-radius': '12px',
              'border': currentScenario === index ? '2px solid var(--brand-primary)' : '1px solid var(--border-medium)'
            }"
          >
            <h3 style="margin: 0 0 12px 0;">{{ scenario.title }}</h3>
            <p style="margin: 0 0 16px 0; color: var(--text-secondary);">{{ scenario.description }}</p>
            <div style="display: flex; gap: 8px; margin-top: 16px;">
              <button
                @click="runScenario(index)"
                style="flex: 1; padding: 8px 16px; background: var(--brand-primary); color: white; border: none; border-radius: 6px; cursor: pointer;"
              >
                ▶️ Demo
              </button>
            </div>
          </div>
        </div>

        <div v-if="currentScenario !== null" style="margin-top: 30px; padding: 20px; background: var(--surface-tertiary); border-radius: 12px;">
          <h3 style="margin: 0 0 12px 0;">Current Scenario: {{ scenarios[currentScenario].title }}</h3>
          <p style="margin: 0 0 8px 0; color: var(--text-secondary);">{{ scenarios[currentScenario].description }}</p>
          <p style="margin: 0 0 16px 0; font-weight: 500;">Expected: {{ scenarios[currentScenario].expectedOutcome }}</p>
        </div>

        <CommandPalette
          :is-open="isOpen"
          ref="commandPaletteRef"
          @close="isOpen = false"
          @select="(task) => console.log('Task created in scenario:', scenarios[currentScenario].title, task)"
        />
      </div>
    `,
  })
}

// Accessibility Features
export const AccessibilityFeatures: Story = {
  args: {
    isOpen: true,
  },
  render: (args) => ({
    components: { CommandPalette },
    setup() {
      const taskStore = createMockStore()
      return { args, taskStore }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: var(--surface-secondary);">
        <h3>Accessibility Features</h3>
        <div style="margin-top: 20px; padding: 20px; background: var(--surface-primary); border-radius: 12px; border: 1px solid var(--border-medium);">
          <h4 style="margin: 0 0 12px 0;">Screen Reader Support</h4>
          <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
            <li>✅ Semantic HTML structure</li>
            <li>✅ ARIA labels and descriptions</li>
            <li>✅ Focus management</li>
            <li>✅ Keyboard navigation</li>
            <li>✅ High contrast support</li>
          </ul>

          <h4 style="margin: 20px 0 12px 0;">Keyboard Navigation</h4>
          <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
            <li>⌨️ Tab order respected</li>
            <li>⌨️ Escape cancels safely</li>
            <li>⌨️ Enter confirms actions</li>
            <li>⌨️ Shift+Enter enables batch mode</li>
          </ul>

          <h4 style="margin: 20px 0 12px 0;">Visual Feedback</h4>
          <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
            <li>🎯 Clear focus indicators</li>
            <li>🎨 Smooth transitions</li>
            <li>📱 Touch-friendly sizing</li>
            <li>🌙 Glass morphism for modern UI</li>
          </ul>
        </div>

        <CommandPalette v-bind="args" />
      </div>
    `,
  })
}

// All Variants Showcase
export const AllVariants: Story = {
  render: () => ({
    components: { CommandPalette },
    setup() {
      const showQuickDemo = ref(false)
      const showFullDemo = ref(false)
      const showWorkflowDemo = ref(false)
      const taskStore = createMockTaskStore()

      return {
        showQuickDemo,
        showFullDemo,
        showWorkflowDemo,
        taskStore
      }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: var(--surface-secondary);">
        <h1>CommandPalette - Complete Component Showcase</h1>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 30px; margin-top: 40px;">
          <!-- Quick Mode -->
          <div style="padding: 30px; background: var(--surface-primary); border-radius: 16px; border: 1px solid var(--border-medium);">
            <h2 style="margin: 0 0 20px 0;">Quick Mode</h2>
            <p style="margin: 0 0 16px 0; color: var(--text-secondary);>
              Minimal interface for rapid task capture
            </p>
            <div style="display: flex; gap: 12px;">
              <button
                @click="showQuickDemo = true"
                style="flex: 1; padding: 12px 16px; background: var(--brand-primary); color: white; border: none; border-radius: 8px; cursor: pointer;"
              >
                ⚡ Demo
              </button>
            </div>
            <div style="margin-top: 16px; padding: 16px; background: var(--surface-tertiary); border-radius: 8px;">
              <strong>Features:</strong> Quick input, Auto-focus, Keyboard shortcuts
            </div>
          </div>

          <!-- Full Mode -->
          <div style="padding: 30px; background: var(--surface-primary); border-radius: 16px; border: 1px solid var(--border-medium);">
            <h2 style="margin: 0 0 20px 0;">Full Mode</h2>
            <p style="margin: 0 0 16px 0; color: var(--text-secondary);">
              Complete task creation with all details
            </p>
            <div style="display: flex; gap: 12px;">
              <button
                @click="showFullDemo = true"
                style="flex: 1; padding: 12px 16px; background: var(--color-navigation); color: white; border: none; border-radius: 8px; cursor: pointer;"
              >
                ⚙️ Demo
              </button>
            </div>
            <div style="margin-top: 16px; padding: 16px; background: var(--surface-tertiary); border-radius: 8px;">
              <strong>Features:</strong> Project selection, Due dates, Priority levels
            </div>
          </div>

          <!-- Workflow Demo -->
          <div style="padding: 30px; background: var(--surface-primary); border-radius: 16px; border: 1px solid var(--border-medium);">
            <h2 style="margin: 0 0 20px 0;">Workflow Demo</h2>
            <p style="margin: 0 0 16px 0; color: var(--text-secondary);">
              See productivity workflows in action
            </p>
            <div style="display: flex; gap: 12px;">
              <button
                @click="showWorkflowDemo = true"
                style="flex: 1; padding: 12px 16px; background: var(--color-break); color: white; border: none; border-radius: 8px; cursor: pointer;"
              >
                🚀 Demo
              </button>
            </div>
            <div style="margin-top: 16px; padding: 16px; background: var(--surface-sterary); border-radius: 8px;">
              <strong>Features:</strong> Batch creation, Smart defaults, Context awareness
            </div>
          </div>

          <!-- Technical Features -->
          <div style="padding: 30px; background: var(--surface-primary); border-radius: 16px; border: 1px solid var(--border-medium);">
            <h2 style="margin: 0 0 20px 0;">Technical Excellence</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; padding: 16px; background: var(--surface-tertiary); border-radius: 8px;">
              <div>
                <h4 style="margin: 0 0 8px 0;">Vue 3 Composition</h4>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">
                  <li>✅ Reactive state management</li>
                  <li>✅ Teleport integration</li>
                  <li>✅ Component composition</li>
                  <li>✅ TypeScript support</li>
                </ul>
              </div>
              <div>
                <h4 style="h4>Performance</h4>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">
                  <li>⚡ Optimized re-renders</li>
                  <li>🔄 Efficient animations</li>
                  <li>💫 Smooth transitions</li>
                  <li>📱 Responsive design</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Glass Morphism -->
          <div style="padding: 30px; background: var(--surface-primary); border-radius: 16px; border: 1px solid var(--border-medium);">
            <h2 style="margin: 0 0 20px 0;">Modern UI Design</h2>
            <div style="margin-top: 16px; padding: 16px; background: var(--surface-tertiary); border-radius: 8px;">
              <strong>Features:</strong> Glass morphism, Blur effects, Smooth gradients, Professional aesthetics
            </div>
          </div>
        </div>

        <!-- Demo Components -->
        <CommandPalette
          v-if="showQuickDemo"
          :is-open="showQuickDemo"
          @close="showQuickDemo = false"
          @select="(task) => console.log('Quick task created:', task)"
        />

        <CommandPalette
          v-if="showFullDemo"
          :is-open="showFullDemo"
          @close="showFullDemo = false"
          @select="(task) => console.log('Full task created:', task)"
        />

        <CommandPalette
          v-if="showWorkflowDemo"
          :is-open="showWorkflowDemo"
          @close="showWorkflowDemo = false"
          @select="(task) => console.log('Workflow task created:', task)"
        />
      </div>
    `,
  })
}