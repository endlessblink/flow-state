import type { Meta, StoryObj } from '@storybook/vue3'
import TaskList from '@/components/tasks/TaskList.vue'
import { useTaskStore } from '@/stores/tasks'

const mockTasks = [
  {
    id: '1',
    title: 'Implement user authentication',
    priority: 'high',
    status: 'in_progress',
    description: 'Add JWT-based auth flow',
    projectId: 'p1',
    createdAt: new Date(),
    updatedAt: new Date(),
    subtasks: [],
  },
  {
    id: '2',
    title: 'Design landing page',
    priority: 'medium',
    status: 'planned',
    description: 'Create responsive landing page mockup',
    projectId: 'p2',
    createdAt: new Date(),
    updatedAt: new Date(),
    subtasks: [],
  },
  {
    id: '3',
    title: 'Write API documentation',
    priority: 'low',
    status: 'done',
    description: 'Document all REST endpoints',
    projectId: 'p1',
    createdAt: new Date(),
    updatedAt: new Date(),
    subtasks: [],
  },
  {
    id: '4',
    title: 'Fix navigation bug',
    priority: 'high',
    status: 'planned',
    description: 'Sidebar collapses on mobile',
    projectId: 'p2',
    createdAt: new Date(),
    updatedAt: new Date(),
    subtasks: [],
  },
] as any[]

const mockGroups = [
  {
    key: 'p1',
    title: 'Work',
    color: '#4ECDC4',
    tasks: [mockTasks[0], mockTasks[2]],
    parentTasks: [mockTasks[0], mockTasks[2]],
  },
  {
    key: 'p2',
    title: 'Personal',
    emoji: '🏠',
    color: '#FF6B6B',
    tasks: [mockTasks[1], mockTasks[3]],
    parentTasks: [mockTasks[1], mockTasks[3]],
  },
]

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
    tasks: mockTasks,
    groups: mockGroups,
    groupBy: 'project',
  } as any,
}
