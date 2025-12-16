import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import TaskManagerSidebar from '@/components/TaskManagerSidebar.vue'

const meta = {
  component: TaskManagerSidebar,
  title: '🧩 Components/📝 Form Controls/TaskManagerSidebar',
  tags: ['autodocs'],

  parameters: {
    layout: 'fullscreen',
  },

  argTypes: {
    onAddTask: {
      action: 'addTask',
      description: 'Callback when add task is clicked',
    },
    onStartTimer: {
      action: 'startTimer',
      description: 'Callback when timer is started for a task',
    },
    onEditTask: {
      action: 'editTask',
      description: 'Callback when edit is clicked for a task',
    },
  },
} satisfies Meta<typeof TaskManagerSidebar>

export default meta
type Story = StoryObj<typeof meta>

// Default state
export const Default: Story = {
  render: () => ({
    components: { TaskManagerSidebar },
    setup() {
      const handleAddTask = () => console.log('Add task')
      const handleStartTimer = (id: string) => console.log('Timer:', id)
      const handleEditTask = (id: string) => console.log('Edit:', id)
      return { handleAddTask, handleStartTimer, handleEditTask }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: #000000;">
        <h3 style="color: var(--text-primary); margin: 0 0 12px 0;">TaskManagerSidebar (Default)</h3>
        <p style="color: var(--text-secondary);">Central task management component with search, filters, and task actions</p>
        <div style="margin-top: 24px; width: 320px;">
          <TaskManagerSidebar
            @addTask="handleAddTask"
            @startTimer="handleStartTimer"
            @editTask="handleEditTask"
          />
        </div>
      </div>
    `,
  })
}

// With Search Focus
export const WithSearchFocus: Story = {
  render: () => ({
    components: { TaskManagerSidebar },
    setup() {
      const handleAddTask = () => console.log('Add task')
      const handleStartTimer = (id: string) => console.log('Timer:', id)
      const handleEditTask = (id: string) => console.log('Edit:', id)
      return { handleAddTask, handleStartTimer, handleEditTask }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: #000000;">
        <h3 style="color: var(--text-primary); margin: 0 0 12px 0;">TaskManagerSidebar with Search</h3>
        <p style="color: var(--text-secondary);">Use ⌘K to focus search, type to filter tasks</p>
        <div style="margin-top: 24px; width: 320px;">
          <TaskManagerSidebar
            @addTask="handleAddTask"
            @startTimer="handleStartTimer"
            @editTask="handleEditTask"
          />
        </div>
      </div>
    `,
  })
}

// Interactive Demo
export const InteractiveDemo: Story = {
  render: () => ({
    components: { TaskManagerSidebar },
    setup() {
      const stats = ref({
        tasksAdded: 0,
        timersStarted: 0,
        tasksEdited: 0
      })

      const handleAddTask = () => {
        stats.value.tasksAdded++
        console.log(`✅ Task ${stats.value.tasksAdded} added`)
      }

      const handleStartTimer = (taskId: string) => {
        stats.value.timersStarted++
        console.log(`⏱️ Timer ${stats.value.timersStarted} started for:`, taskId)
      }

      const handleEditTask = (taskId: string) => {
        stats.value.tasksEdited++
        console.log(`✏️ Task ${stats.value.tasksEdited} edited:`, taskId)
      }

      return { stats, handleAddTask, handleStartTimer, handleEditTask }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: #000000;">
        <h1 style="color: var(--text-primary); margin: 0 0 24px 0;">TaskManagerSidebar Interactive Demo</h1>

        <!-- Stats Display -->
        <div style="margin-bottom: 30px; padding: 20px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1);">
          <h2 style="margin: 0 0 16px 0; color: var(--text-primary);">Interaction Stats</h2>
          <div style="display: flex; gap: 40px;">
            <div>
              <div style="font-size: 32px; font-weight: bold; color: rgba(78, 205, 196, 1);">{{ stats.tasksAdded }}</div>
              <div style="font-size: 14px; color: var(--text-secondary);">Tasks Added</div>
            </div>
            <div>
              <div style="font-size: 32px; font-weight: bold; color: rgba(78, 205, 196, 1);">{{ stats.timersStarted }}</div>
              <div style="font-size: 14px; color: var(--text-secondary);">Timers Started</div>
            </div>
            <div>
              <div style="font-size: 32px; font-weight: bold; color: rgba(78, 205, 196, 1);">{{ stats.tasksEdited }}</div>
              <div style="font-size: 14px; color: var(--text-secondary);">Tasks Edited</div>
            </div>
          </div>
        </div>

        <div style="width: 320px;">
          <TaskManagerSidebar
            @addTask="handleAddTask"
            @startTimer="handleStartTimer"
            @editTask="handleEditTask"
          />
        </div>
      </div>
    `,
  })
}

// All Variants Showcase
export const AllVariants: Story = {
  render: () => ({
    components: { TaskManagerSidebar },
    setup() {
      const handleAddTask = () => console.log('Add task')
      const handleStartTimer = (id: string) => console.log('Timer:', id)
      const handleEditTask = (id: string) => console.log('Edit:', id)
      return { handleAddTask, handleStartTimer, handleEditTask }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: #000000;">
        <h1 style="color: var(--text-primary); margin: 0 0 24px 0;">TaskManagerSidebar Component Showcase</h1>

        <div style="display: grid; grid-template-columns: 320px 1fr; gap: 40px;">
          <div>
            <TaskManagerSidebar
              @addTask="handleAddTask"
              @startTimer="handleStartTimer"
              @editTask="handleEditTask"
            />
          </div>

          <div>
            <!-- Feature Cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
              <div style="padding: 24px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1);">
                <h3 style="margin: 0 0 16px 0; color: var(--text-primary);">Task Management</h3>
                <p style="margin: 0 0 16px 0; color: var(--text-secondary);">Create, edit, and organize tasks with priority levels</p>
                <ul style="margin: 0; padding-left: 20px; line-height: 1.8; color: var(--text-secondary);">
                  <li>Quick task creation</li>
                  <li>Priority assignment</li>
                  <li>Due date scheduling</li>
                </ul>
              </div>

              <div style="padding: 24px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1);">
                <h3 style="margin: 0 0 16px 0; color: var(--text-primary);">Timer Integration</h3>
                <p style="margin: 0 0 16px 0; color: var(--text-secondary);">Start Pomodoro sessions directly from task cards</p>
                <ul style="margin: 0; padding-left: 20px; line-height: 1.8; color: var(--text-secondary);">
                  <li>One-click timer start</li>
                  <li>Pomodoro tracking</li>
                  <li>Session history</li>
                </ul>
              </div>

              <div style="padding: 24px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1);">
                <h3 style="margin: 0 0 16px 0; color: var(--text-primary);">Search & Filter</h3>
                <p style="margin: 0 0 16px 0; color: var(--text-secondary);">Find tasks quickly with real-time search</p>
                <ul style="margin: 0; padding-left: 20px; line-height: 1.8; color: var(--text-secondary);">
                  <li>Instant search (⌘K)</li>
                  <li>Filter by status</li>
                  <li>Filter by priority</li>
                </ul>
              </div>
            </div>

            <!-- Key Features -->
            <div style="margin-top: 24px; padding: 24px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1);">
              <h3 style="margin: 0 0 16px 0; color: var(--text-primary);">Key Features</h3>
              <ul style="margin: 0; padding-left: 20px; line-height: 1.8; color: var(--text-secondary);">
                <li>📝 Quick task creation with minimal friction</li>
                <li>⏱️ Integrated Pomodoro timer for each task</li>
                <li>🔍 Real-time search with keyboard shortcut</li>
                <li>🎯 Priority badges with color coding</li>
                <li>📅 Scheduled task display with date/time</li>
                <li>✅ One-click task completion</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `,
  })
}
