import type { Meta, StoryObj } from '@storybook/vue3'
import TaskList from '@/components/tasks/TaskList.vue'
import { useTaskStore } from '@/stores/tasks'

const meta = {
  title: '📋 Board/TaskList',
  component: TaskList,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0f172a' },
      ],
    },
  },
  decorators: [
    (story: any) => ({
      components: { story },
      setup() {
        const taskStore = useTaskStore()
        // Initialize mock data if needed
        taskStore.projects = [
          { id: 'p1', name: 'Work', color: '#4ECDC4' },
          { id: 'p2', name: 'Personal', color: '#FF6B6B', emoji: '🏠' }
        ]
        return {}
      },
      template: `
        <div style="transform: scale(1); padding: 40px; background: var(--app-background-gradient); min-height: 400px; border-radius: 12px;">
          <story />
        </div>
      `
    })
  ],
} satisfies Meta<typeof TaskList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    tasks: [
      {
        id: '1',
        title: 'Task 1',
        priority: 'high',
        status: 'planned',
        description: 'Test task 1',
        projectId: 'p1',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '2',
        title: 'Task 2',
        priority: 'medium',
        status: 'in_progress',
        description: 'Test task 2',
        projectId: 'p2',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ] as any
  }
}
