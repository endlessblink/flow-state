import type { Meta, StoryObj } from '@storybook/vue3'
import { ref, provide } from 'vue'
import KanbanSwimlane from '@/components/kanban/KanbanSwimlane.vue'
import { PROGRESSIVE_DISCLOSURE_KEY } from '@/composables/useProgressiveDisclosure'

// Mock tasks data matching KanbanColumn structure
const mockTasks = [
  { id: '1', title: 'Design dashboard', description: 'Create mockups', status: 'planned', priority: 'high', estimatedTime: 60, projectId: 'proj1', subtasks: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: '2', title: 'Implement drag & drop', description: 'Add vuedraggable', status: 'in_progress', priority: 'medium', estimatedTime: 90, projectId: 'proj1', subtasks: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: '3', title: 'Add task filtering', description: 'Filter by status', status: 'backlog', priority: 'low', estimatedTime: 45, projectId: 'proj1', subtasks: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: '4', title: 'Fix responsive layout', description: 'Mobile support', status: 'on_hold', priority: 'high', estimatedTime: 30, projectId: 'proj1', subtasks: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: '5', title: 'Write documentation', description: 'API docs', status: 'done', priority: 'low', estimatedTime: 60, projectId: 'proj1', subtasks: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
]

const mockProject = {
  id: 'proj1',
  name: 'Productivity App',
  color: '#4ECDC4',
  viewType: 'status' as const,
  createdAt: new Date().toISOString(),
}

const meta = {
  component: KanbanSwimlane,
  title: '✨ Features/📋 Board View/KanbanSwimlane',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Swimlane component that groups tasks by project with collapsible header and multiple view types (status, date, priority). Each swimlane takes full width with 360px fixed-width columns that scroll horizontally.'
      }
    }
  },
  decorators: [
    (story: any) => ({
      components: { story },
      setup() {
        // Provide mock progressive disclosure state directly
        const enabled = ref(false)
        provide(PROGRESSIVE_DISCLOSURE_KEY, {
          enabled,
          toggleEnabled: () => { enabled.value = !enabled.value },
          setEnabled: (value: boolean) => { enabled.value = value }
        })
        return {}
      },
      template: `<div style="
        width: 100%;
        height: 100vh;
        overflow: hidden;
      "><story /></div>`
    })
  ]
} satisfies Meta<typeof KanbanSwimlane>

export default meta
type Story = StoryObj<typeof meta>

// Default: Single swimlane at full width with natural column widths and horizontal scroll
export const Default: Story = {
  render: () => ({
    components: { KanbanSwimlane },
    setup() {
      const project = ref({ ...mockProject })
      const tasks = ref([...mockTasks])
      return { project, tasks }
    },
    template: `
      <KanbanSwimlane
        :project="project"
        :tasks="tasks"
        density="comfortable"
        :show-done-column="true"
        @select-task="() => {}"
        @start-timer="() => {}"
        @edit-task="() => {}"
        @move-task="() => {}"
        @context-menu="() => {}"
      />
    `
  })
}

// View Types: Status, Date, Priority stacked vertically (like real BoardView)
export const ViewTypes: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates the three view types stacked vertically (as in the real app). Each swimlane takes full width with horizontal scrolling. Status shows workflow stages, Date shows Todoist-style scheduling, Priority shows urgency levels.'
      }
    }
  },
  render: () => ({
    components: { KanbanSwimlane },
    setup() {
      const statusProject = ref({ ...mockProject, name: 'Status View', viewType: 'status' as const })
      const dateProject = ref({ ...mockProject, id: 'proj2', name: 'Date View', color: '#FF6B6B', viewType: 'date' as const })
      const priorityProject = ref({ ...mockProject, id: 'proj3', name: 'Priority View', color: '#9B59B6', viewType: 'priority' as const })
      const tasks = ref([...mockTasks])
      return { statusProject, dateProject, priorityProject, tasks }
    },
    template: `
      <div style="display: flex; flex-direction: column; gap: var(--space-3); height: 100%; overflow-y: auto;">
        <KanbanSwimlane
          :project="statusProject"
          :tasks="tasks"
          density="comfortable"
          :show-done-column="true"
          @select-task="() => {}"
          @start-timer="() => {}"
          @edit-task="() => {}"
          @move-task="() => {}"
          @context-menu="() => {}"
        />
        <KanbanSwimlane
          :project="dateProject"
          :tasks="tasks"
          density="comfortable"
          @select-task="() => {}"
          @start-timer="() => {}"
          @edit-task="() => {}"
          @move-task="() => {}"
          @context-menu="() => {}"
        />
        <KanbanSwimlane
          :project="priorityProject"
          :tasks="tasks"
          density="comfortable"
          @select-task="() => {}"
          @start-timer="() => {}"
          @edit-task="() => {}"
          @move-task="() => {}"
          @context-menu="() => {}"
        />
      </div>
    `
  })
}
