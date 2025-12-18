import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import KanbanColumn from '@/components/kanban/KanbanColumn.vue'

// Mock tasks data
const mockTasks = {
  todo: [
    { id: '1', title: 'Complete project documentation', description: 'Write comprehensive docs', priority: 'high', estimatedTime: 60, status: 'planned', projectId: 'proj1', subtasks: [] },
    { id: '2', title: 'Review pull requests', description: 'Check pending PRs', priority: 'medium', estimatedTime: 30, status: 'planned', projectId: 'proj1', subtasks: [] },
    { id: '3', title: 'Setup environment', description: 'Configure dev tools', priority: 'low', estimatedTime: 45, status: 'planned', projectId: 'proj1', subtasks: [] },
  ],
  inProgress: [
    { id: '4', title: 'Implement authentication', description: 'Add OAuth support', priority: 'high', estimatedTime: 120, status: 'in_progress', projectId: 'proj2', subtasks: [] },
  ],
  done: [
    { id: '5', title: 'Create wireframes', description: 'Design mockups', priority: 'medium', estimatedTime: 90, status: 'done', projectId: 'proj2', subtasks: [] },
    { id: '6', title: 'Setup CI/CD', description: 'Configure pipeline', priority: 'low', estimatedTime: 45, status: 'done', projectId: 'proj1', subtasks: [] },
  ]
}

const meta = {
  component: KanbanColumn,
  title: '✨ Features/📋 Board View/KanbanColumn',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Kanban column component for organizing tasks by status. Supports WIP limits, drag-and-drop, and task actions.'
      }
    }
  },
  decorators: [
    () => ({
      template: '<div style="width: 100%; height: 100vh; background: var(--surface-primary); padding: 24px;"><story /></div>'
    })
  ]
} satisfies Meta<typeof KanbanColumn>

export default meta
type Story = StoryObj<typeof meta>

// Default: Basic Board Layout
export const Default: Story = {
  render: () => ({
    components: { KanbanColumn },
    setup() {
      const todoTasks = ref([...mockTasks.todo])
      const inProgressTasks = ref([...mockTasks.inProgress])
      const doneTasks = ref([...mockTasks.done])
      return { todoTasks, inProgressTasks, doneTasks }
    },
    template: `
      <div style="display: flex; gap: 16px; height: 100%;">
        <KanbanColumn
          title="Planned"
          status="planned"
          :tasks="todoTasks"
          :wip-limit="5"
          @add-task="() => {}"
          @select-task="() => {}"
        />
        <KanbanColumn
          title="In Progress"
          status="in_progress"
          :tasks="inProgressTasks"
          :wip-limit="3"
          @add-task="() => {}"
          @select-task="() => {}"
        />
        <KanbanColumn
          title="Done"
          status="done"
          :tasks="doneTasks"
          :wip-limit="10"
          @add-task="() => {}"
          @select-task="() => {}"
        />
      </div>
    `
  })
}

// WIP Limit States
export const WipStates: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates WIP limit visual indicators: normal, warning (approaching limit), and exceeded (over limit).'
      }
    }
  },
  render: () => ({
    components: { KanbanColumn },
    setup() {
      const normalTasks = ref([mockTasks.todo[0]])
      const warningTasks = ref([mockTasks.todo[0], mockTasks.todo[1]])
      const exceededTasks = ref([...mockTasks.todo])
      return { normalTasks, warningTasks, exceededTasks }
    },
    template: `
      <div style="display: flex; gap: 16px; height: 100%;">
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <span style="color: var(--text-muted); font-size: 12px; text-align: center;">Normal (1/3)</span>
          <KanbanColumn
            title="In Progress"
            status="in_progress"
            :tasks="normalTasks"
            :wip-limit="3"
            @add-task="() => {}"
            @select-task="() => {}"
          />
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <span style="color: var(--text-muted); font-size: 12px; text-align: center;">Warning (2/3)</span>
          <KanbanColumn
            title="In Progress"
            status="in_progress"
            :tasks="warningTasks"
            :wip-limit="3"
            @add-task="() => {}"
            @select-task="() => {}"
          />
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <span style="color: var(--text-muted); font-size: 12px; text-align: center;">Exceeded (3/3)</span>
          <KanbanColumn
            title="In Progress"
            status="in_progress"
            :tasks="exceededTasks"
            :wip-limit="3"
            @add-task="() => {}"
            @select-task="() => {}"
          />
        </div>
      </div>
    `
  })
}
