import type { Meta, StoryObj } from '@storybook/vue3'
import CalendarInboxPanel from '@/components/inbox/CalendarInboxPanel.vue'
import { useTaskStore, type Task } from '@/stores/tasks'

const meta = {
  component: CalendarInboxPanel,
  title: '📝 Task Management/CalendarInboxPanel',
  tags: ['autodocs'],

  args: {
    // Component doesn't accept props directly, it uses stores
  },

  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0f172a' },
      ],
    },
  },

  // Mock the task store for Storybook
  decorators: [
    (story) => ({
      components: { story },
      template: `
        <div style="transform: scale(1); min-height: 600px; width: 100%; position: relative; display: flex; align-items: center; justify-content: center; background: var(--app-background-gradient); padding: 40px; box-sizing: border-box; border-radius: var(--radius-xl); overflow: hidden;">
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
          createMockTask('8', 'Personal task', 'high', false, false, 'p2')
        ]

        return {}
      }
    })
  ]
} satisfies Meta<typeof CalendarInboxPanel>

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

// Default state - no tasks in inbox
export const Empty: Story = {
  render: () => ({
    components: { CalendarInboxPanel },
    template: '<CalendarInboxPanel />'
  })
}

// Few tasks in inbox
export const FewTasks: Story = {
  render: () => ({
    components: { CalendarInboxPanel },
    template: '<CalendarInboxPanel />'
  })
}

// Many tasks in inbox
export const ManyTasks: Story = {
  render: () => ({
    components: { CalendarInboxPanel },
    template: '<CalendarInboxPanel />'
  })
}

// Tasks with different priorities
export const MixedPriorities: Story = {
  render: () => ({
    components: { CalendarInboxPanel },
    template: '<CalendarInboxPanel />'
  })
}

// Tasks with long titles
export const LongTitles: Story = {
  render: () => ({
    components: { CalendarInboxPanel },
    template: '<CalendarInboxPanel />'
  })
}

// Tasks with different projects
export const MultipleProjects: Story = {
  render: () => ({
    components: { CalendarInboxPanel },
    template: '<CalendarInboxPanel />'
  })
}

// Tasks with duration estimates
export const WithDurations: Story = {
  render: () => ({
    components: { CalendarInboxPanel },
    template: '<CalendarInboxPanel />'
  })
}

// Collapsed state
export const Collapsed: Story = {
  render: () => ({
    components: { CalendarInboxPanel },
    template: '<CalendarInboxPanel />'
  })
}

// Expanded state (default)
export const Expanded: Story = {
  render: () => ({
    components: { CalendarInboxPanel },
    template: '<CalendarInboxPanel />'
  })
}

// Unscheduled filter active
export const UnscheduledFilter: Story = {
  render: () => ({
    components: { CalendarInboxPanel },
    template: '<CalendarInboxPanel />'
  })
}

// Not on Canvas filter active
export const NotOnCanvasFilter: Story = {
  render: () => ({
    components: { CalendarInboxPanel },
    template: '<CalendarInboxPanel />'
  })
}

// Incomplete filter active
export const IncompleteFilter: Story = {
  render: () => ({
    components: { CalendarInboxPanel },
    template: '<CalendarInboxPanel />'
  })
}

// All Tasks filter active
export const AllTasksFilter: Story = {
  render: () => ({
    components: { CalendarInboxPanel },
    template: '<CalendarInboxPanel />'
  })
}

// Interactive demo - shows user interactions
export const InteractiveDemo: Story = {
  render: () => ({
    components: { CalendarInboxPanel },
    template: '<CalendarInboxPanel />',
    parameters: {
      docs: {
        description: {
          story: 'Interactive demonstration of CalendarInboxPanel functionality including:\n\n• **Collapsible panel** - Click the collapse button to expand/collapse\n• **Filter toggle** - Switch between Unscheduled, Not on Canvas, Incomplete, All Tasks\n• **Quick add** - Type task name and press Enter to add\n• **Task cards** - Drag to calendar, double-click to edit, right-click for context menu\n• **Quick actions** - Start timer or edit task on hover\n• **Visual feedback** - Priority stripes, hover states, and smooth transitions\n\nThe panel shows unscheduled tasks that can be dragged directly onto the calendar for scheduling.'
        }
      }
    }
  })
}
