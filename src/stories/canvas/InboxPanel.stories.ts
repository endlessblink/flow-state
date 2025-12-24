import type { Meta, StoryObj } from '@storybook/vue3'
import UnifiedInboxPanel from '@/components/inbox/UnifiedInboxPanel.vue'
import { useTaskStore, type Task } from '@/stores/tasks'

const meta = {
  title: 'Canvas/InboxPanel',
  component: UnifiedInboxPanel,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0f172a' },
      ],
    },
  },
  decorators: [
    (story) => ({
      components: { story },
      template: `
        <div style="transform: scale(1); min-height: 600px; width: 100%; display: flex; align-items: center; justify-content: center; background: var(--app-background-gradient); padding: 40px; box-sizing: border-box; border-radius: var(--radius-xl); overflow: hidden;">
          <div style="width: 320px; height: 100%; max-height: 800px; position: relative;">
            <story />
          </div>
        </div>
      `,
      setup() {
        const taskStore = useTaskStore()

        // Populate store with mock tasks for the stories to use
        taskStore.tasks = [
          createMockTask('1', 'Fix CSS issues', 'high'),
          createMockTask('2', 'Plan next week', 'medium'),
          createMockTask('3', 'Email client', 'low'),
          createMockTask('4', 'Task with instances', 'medium', true),
          createMockTask('5', 'Task on canvas', 'medium', false, true),
          createMockTask('6', 'Long title task that should definitely wrap or truncate gracefully in the UI', 'low'),
          createMockTask('7', 'Project task', 'medium', false, false, 'p1'),
          createMockTask('8', 'Personal task', 'high', false, false, 'p2'),
          createMockTask('9', 'Incomplete task', 'low'),
          createMockTask('10', 'Very important task', 'high')
        ]

        return {}
      }
    })
  ],
} satisfies Meta<typeof UnifiedInboxPanel>

export default meta
type Story = StoryObj<typeof meta>

// Helper function to create mock tasks
const createMockTask = (id: string, title: string, priority: Task['priority'] = 'medium', hasInstances = false, onCanvas = false, projectId: string | null = null): Task => ({
  id,
  title,
  description: `Description for ${title}`,
  status: 'planned',
  priority,
  progress: 0,
  completedPomodoros: 0,
  subtasks: [],
  dueDate: '2024-12-25',
  estimatedDuration: 60,
  projectId,
  parentTaskId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  isInInbox: !onCanvas,
  canvasPosition: onCanvas ? { x: 100, y: 200 } : undefined,
  instances: hasInstances ? [{
    id: `instance-${id}`,
    scheduledDate: '2024-12-25',
    scheduledTime: '09:00',
    duration: 60
  }] : [],
  tags: []
})

export const Default: Story = {
  render: () => ({
    components: { UnifiedInboxPanel },
    template: '<UnifiedInboxPanel />',
  }),
}

export const ManyTasks: Story = {
  render: () => ({
    components: { UnifiedInboxPanel },
    template: '<UnifiedInboxPanel />',
  }),
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="transform: scale(1); min-height: 600px; width: 100%; display: flex; align-items: center; justify-content: center; background: var(--app-background-gradient); padding: 40px; box-sizing: border-box; border-radius: var(--radius-xl); overflow: hidden;">
          <div style="width: 320px; height: 100%; max-height: 800px; position: relative;">
            <story />
          </div>
        </div>
      `,
      setup() {
        const taskStore = useTaskStore()
        taskStore.tasks = Array.from({ length: 20 }, (_, i) =>
          createMockTask(`many-${i}`, `Task ${i + 1}`, i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low')
        )
        return {}
      }
    })
  ]
}

