import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import CommandPalette from './CommandPalette.vue'

// Mock the task store for Storybook
const mockTaskStore = {
  projects: [
    { id: '1', name: 'Work Project' },
    { id: '2', name: 'Personal Project' },
    { id: '3', name: 'Learning Vue' }
  ],
  activeProjectId: '1',
  activeSmartView: 'today',
  createTask: async (taskData: any) => {
    console.log('Creating task:', taskData)
    return { id: Date.now().toString(), ...taskData }
  },
  getProjectDisplayName: (projectId: string) => {
    const project = mockTaskStore.projects.find(p => p.id === projectId)
    return project ? project.name : 'Unknown Project'
  }
}

const meta = {
  title: 'Overlays/CommandPalette',
  component: CommandPalette,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Command palette for quick task creation with progressive disclosure and keyboard shortcuts.'
      }
    },
    // Provide mocked store to component
    vue3: {
      beforeMount(app) {
        app.config.globalProperties.$taskStore = mockTaskStore
        app.provide('taskStore', mockTaskStore)
      }
    }
  },
  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Whether the command palette is open'
    }
  }
} satisfies Meta<typeof CommandPalette>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { CommandPalette },
    setup() {
      const commandPaletteRef = ref()
      const isOpen = ref(true)

      const openCommandPalette = () => {
        isOpen.value = true
        commandPaletteRef.value?.open()
      }

      return { args, commandPaletteRef, isOpen, openCommandPalette }
    },
    template: `
      <div style="position: relative; width: 100vw; height: 100vh; background: #0f0f0f; padding: 40px;">
        <div style="text-align: center; color: white;">
          <h1>Command Palette Demo</h1>
          <p style="margin-bottom: 20px;">Click the button below or press Cmd+K (Ctrl+K) to open the command palette</p>
          <button
            @click="openCommandPalette"
            style="padding: 12px 24px; background: #374151; color: white; border: none; border-radius: 8px; cursor: pointer;"
          >
            Open Command Palette (Cmd+K)
          </button>
        </div>

        <CommandPalette
          ref="commandPaletteRef"
          v-bind="args"
        />
      </div>
    `
  })
}

export const WithPreOpened: Story = {
  render: (args) => ({
    components: { CommandPalette },
    setup() {
      const commandPaletteRef = ref()

      // Auto-open after mount
      setTimeout(() => {
        commandPaletteRef.value?.open()
      }, 100)

      return { args, commandPaletteRef }
    },
    template: `
      <div style="position: relative; width: 100vw; height: 100vh; background: #0f0f0f;">
        <CommandPalette
          ref="commandPaletteRef"
          v-bind="args"
        />
      </div>
    `
  })
}

export const IntegrationExample: Story = {
  render: (args) => ({
    components: { CommandPalette },
    setup() {
      const commandPaletteRef = ref()
      const tasks = ref([
        { id: '1', title: 'Review pull requests', status: 'planned' },
        { id: '2', title: 'Update documentation', status: 'in_progress' },
        { id: '3', title: 'Fix critical bug', status: 'done' }
      ])

      const openCommandPalette = () => {
        commandPaletteRef.value?.open()
      }

      return { args, commandPaletteRef, tasks, openCommandPalette }
    },
    template: `
      <div style="position: relative; width: 100vw; height: 100vh; background: #0f0f0f; padding: 40px;">
        <div style="max-width: 800px; margin: 0 auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0;">Task Management</h1>
            <button
              @click="openCommandPalette"
              style="padding: 8px 16px; background: #374151; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;"
            >
              + Quick Add (Cmd+K)
            </button>
          </div>

          <div style="background: #1a1a1a; border-radius: 8px; padding: 20px;">
            <h2 style="color: white; margin-top: 0;">Today's Tasks</h2>
            <div v-for="task in tasks" :key="task.id" style="background: #2d2d2d; padding: 12px; border-radius: 6px; margin-bottom: 8px;">
              <span style="color: white;">{{ task.title }}</span>
              <span style="color: #9ca3af; margin-left: 10px; font-size: 12px;">{{ task.status }}</span>
            </div>
          </div>
        </div>

        <CommandPalette
          ref="commandPaletteRef"
          v-bind="args"
        />
      </div>
    `
  })
}