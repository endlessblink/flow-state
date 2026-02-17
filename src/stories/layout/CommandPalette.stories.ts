import type { Meta, StoryObj } from '@storybook/vue3'
import { ref, onMounted } from 'vue'
import CommandPalette from '@/components/layout/CommandPalette.vue'
import BaseButton from '@/components/base/BaseButton.vue'

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
    return project ? project.name : 'Uncategorized'
  }
}

const meta = {
  title: '🏢 Layout/CommandPalette',
  component: CommandPalette,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Command palette for quick task creation with progressive disclosure and keyboard shortcuts.'
      }
    },
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0f172a' },
      ],
    },
    // Provide mocked store to component
    vue3: {
      beforeMount(app: any) {
        app.config.globalProperties.$taskStore = mockTaskStore
        app.provide('taskStore', mockTaskStore)
      }
    }
  },
  decorators: [
    (story: any) => ({
      components: { story },
      setup() {
        // Apply background to body for Teleport support
        onMounted(() => {
          document.body.style.background = 'var(--app-background-gradient)'
          document.body.style.minHeight = '100vh'
        })
      },
      template: '<story />'
    })
  ],
} satisfies Meta<typeof CommandPalette>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args: any) => ({
    components: { CommandPalette, BaseButton },
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
      <div style="position: relative; width: 100%; height: 100vh; padding: var(--space-10);">
        <div style="text-align: center; color: white;">
          <h1>Command Palette Demo</h1>
          <p style="margin-bottom: var(--space-5);">Click the button below or press Cmd+K (Ctrl+K) to open the command palette</p>
          <BaseButton
            variant="secondary"
            size="lg"
            @click="openCommandPalette"
          >
            Open Command Palette (Cmd+K)
          </BaseButton>
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
  render: (args: any) => ({
    components: { CommandPalette, BaseButton },
    setup() {
      const commandPaletteRef = ref()
      const isOpen = ref(true)

      const openCommandPalette = () => {
        isOpen.value = true
        commandPaletteRef.value?.open()
      }

      // Auto-open after mount
      onMounted(() => {
        setTimeout(() => {
          commandPaletteRef.value?.open()
        }, 100)
      })

      return { args, commandPaletteRef, isOpen, openCommandPalette }
    },
    template: `
      <div style="position: relative; width: 100%; height: 100vh; padding: var(--space-10);">
        <div style="text-align: center; color: white;">
          <h1>Pre-Opened Command Palette</h1>
          <p style="margin-bottom: var(--space-5);">The palette is open by default in this story</p>
          <BaseButton
            variant="secondary"
            size="lg"
            @click="openCommandPalette"
          >
            Open Command Palette
          </BaseButton>
        </div>

        <CommandPalette
          ref="commandPaletteRef"
          v-bind="args"
        />
      </div>
    `
  })
}

export const IntegrationExample: Story = {
  render: (args: any) => ({
    components: { CommandPalette, BaseButton },
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
      <div style="position: relative; width: 100%; height: 100vh; padding: var(--space-10);">
        <div style="max-width: 800px; margin: 0 auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.875rem;">
            <h1 style="color: white; margin: 0;">Task Management</h1>
            <BaseButton
              variant="secondary"
              size="sm"
              @click="openCommandPalette"
            >
              + Quick Add (Cmd+K)
            </BaseButton>
          </div>

          <div style="background: var(--glass-bg-subtle); backdrop-filter: blur(10px); border-radius: var(--radius-lg); padding: var(--space-5);">
            <h2 style="color: white; margin-top: 0;">Today's Tasks</h2>
            <div v-for="task in tasks" :key="task.id" style="background: var(--glass-bg-subtle); padding: var(--space-3); border-radius: var(--radius-md); margin-bottom: var(--space-2); border: 1px solid var(--glass-border);">
              <span style="color: white;">{{ task.title }}</span>
              <span style="color: var(--text-muted); margin-left: var(--space-2-5); font-size: var(--text-xs);">{{ task.status }}</span>
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
