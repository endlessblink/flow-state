import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import KanbanColumn from '@/components/kanban/KanbanColumn.vue'

// Mock TaskCard component since KanbanColumn depends on it
const MockTaskCard = {
  template: `
    <div class="mock-task-card" style="
      background: var(--surface-primary);
      border: 1px solid var(--border-medium);
      border-radius: var(--radius-lg);
      padding: var(--space-4);
      margin-bottom: var(--space-2);
      cursor: pointer;
      transition: all var(--duration-normal) var(--spring-smooth);
    " @click="$emit('select', task.id)">
      <h4 style="margin: 0 0 var(--space-2) 0; font-size: var(--text-sm); font-weight: var(--font-medium);">{{ task.title }}</h4>
      <p style="margin: 0; font-size: var(--text-xs); color: var(--text-muted);">{{ task.description }}</p>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-2);">
        <span style="font-size: var(--text-xs); color: var(--text-muted);">{{ task.priority }}</span>
        <span style="font-size: var(--text-xs); color: var(--text-muted);">{{ task.estimatedTime }}min</span>
      </div>
    </div>
  `,
  props: ['task'],
  emits: ['select', 'startTimer', 'edit', 'contextMenu']
}

// Mock tasks data
const mockTasks = {
  todo: [
    {
      id: '1',
      title: 'Complete project documentation',
      description: 'Write comprehensive docs for the new API',
      priority: 'High',
      estimatedTime: 60,
      status: 'todo',
      projectId: 'proj1',
      subtasks: []
    },
    {
      id: '2',
      title: 'Review pull requests',
      description: 'Check and approve pending PRs',
      priority: 'Medium',
      estimatedTime: 30,
      status: 'todo',
      projectId: 'proj1',
      subtasks: []
    }
  ],
  inProgress: [
    {
      id: '3',
      title: 'Implement user authentication',
      description: 'Add OAuth and JWT support',
      priority: 'High',
      estimatedTime: 120,
      status: 'in-progress',
      projectId: 'proj2',
      subtasks: []
    }
  ],
  done: [
    {
      id: '4',
      title: 'Setup development environment',
      description: 'Configure Docker and CI/CD pipeline',
      priority: 'Low',
      estimatedTime: 45,
      status: 'done',
      projectId: 'proj1',
      subtasks: []
    },
    {
      id: '5',
      title: 'Create wireframes',
      description: 'Design mockups for the new features',
      priority: 'Medium',
      estimatedTime: 90,
      status: 'done',
      projectId: 'proj2',
      subtasks: []
    }
  ]
}

const meta = {
  component: KanbanColumn,
  title: '✨ Features/📋 Board View/KanbanColumn',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
  },

  argTypes: {
    title: {
      control: 'text',
      description: 'Column title displayed in header',
    },
    status: {
      control: 'select',
      options: ['todo', 'in-progress', 'done'],
      description: 'Task status for this column',
    },
    tasks: {
      control: 'object',
      description: 'Array of tasks to display in the column',
    },
    wipLimit: {
      control: 'number',
      description: 'Work In Progress limit for the column',
    },
  },
} satisfies Meta<typeof KanbanColumn>

export default meta
type Story = StoryObj<typeof meta>

// Basic Column States
export const TodoColumn: Story = {
  args: {
    title: 'To Do',
    status: 'todo',
    tasks: mockTasks.todo,
    wipLimit: 5,
  },
  render: (args) => ({
    components: { KanbanColumn, MockTaskCard },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 350px; height: 600px;">
        <KanbanColumn v-bind="args" @addTask="() => console.log('add task')" @selectTask="id => console.log('select', id)" />
      </div>
    `,
  })
}

export const InProgressColumn: Story = {
  args: {
    title: 'In Progress',
    status: 'in-progress',
    tasks: mockTasks.inProgress,
    wipLimit: 3,
  },
  render: (args) => ({
    components: { KanbanColumn, MockTaskCard },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 350px; height: 600px;">
        <KanbanColumn v-bind="args" @addTask="() => console.log('add task')" @selectTask="id => console.log('select', id)" />
      </div>
    `,
  })
}

export const DoneColumn: Story = {
  args: {
    title: 'Done',
    status: 'done',
    tasks: mockTasks.done,
    wipLimit: 10,
  },
  render: (args) => ({
    components: { KanbanColumn, MockTaskCard },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 350px; height: 600px;">
        <KanbanColumn v-bind="args" @addTask="() => console.log('add task')" @selectTask="id => console.log('select', id)" />
      </div>
    `,
  })
}

// WIP Limit States
export const WipWarning: Story = {
  args: {
    title: 'Development',
    status: 'in-progress',
    tasks: [
      ...mockTasks.inProgress,
      {
        id: '6',
        title: 'Fix critical bug',
        description: 'Resolve production issue',
        priority: 'High',
        estimatedTime: 30,
        status: 'in-progress',
        projectId: 'proj1',
        subtasks: []
      }
    ],
    wipLimit: 3,
  },
  render: (args) => ({
    components: { KanbanColumn, MockTaskCard },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 350px; height: 600px;">
        <KanbanColumn v-bind="args" @addTask="() => console.log('add task')" @selectTask="id => console.log('select', id)" />
      </div>
    `,
  })
}

export const WipExceeded: Story = {
  args: {
    title: 'Development',
    status: 'in-progress',
    tasks: [
      ...mockTasks.inProgress,
      {
        id: '6',
        title: 'Fix critical bug',
        description: 'Resolve production issue',
        priority: 'High',
        estimatedTime: 30,
        status: 'in-progress',
        projectId: 'proj1',
        subtasks: []
      },
      {
        id: '7',
        title: 'Optimize database queries',
        description: 'Improve performance bottlenecks',
        priority: 'Medium',
        estimatedTime: 60,
        status: 'in-progress',
        projectId: 'proj1',
        subtasks: []
      },
      {
        id: '8',
        title: 'Update dependencies',
        description: 'Upgrade to latest package versions',
        priority: 'Low',
        estimatedTime: 20,
        status: 'in-progress',
        projectId: 'proj1',
        subtasks: []
      }
    ],
    wipLimit: 3,
  },
  render: (args) => ({
    components: { KanbanColumn, MockTaskCard },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 350px; height: 600px;">
        <KanbanColumn v-bind="args" @addTask="() => console.log('add task')" @selectTask="id => console.log('select', id)" />
      </div>
    `,
  })
}

// Empty States
export const EmptyColumn: Story = {
  args: {
    title: 'To Do',
    status: 'todo',
    tasks: [],
    wipLimit: 5,
  },
  render: (args) => ({
    components: { KanbanColumn },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 350px; height: 600px;">
        <KanbanColumn v-bind="args" @addTask="() => console.log('add task')" @selectTask="id => console.log('select', id)" />
      </div>
    `,
  })
}

// Full Column (many tasks)
export const FullColumn: Story = {
  args: {
    title: 'Backlog',
    status: 'todo',
    tasks: [
      ...mockTasks.todo,
      {
        id: '9',
        title: 'Research new technologies',
        description: 'Evaluate frontend frameworks for next project',
        priority: 'Low',
        estimatedTime: 120,
        status: 'todo',
        projectId: 'proj3',
        subtasks: []
      },
      {
        id: '10',
        title: 'Team meeting preparation',
        description: 'Prepare slides for weekly sync',
        priority: 'Medium',
        estimatedTime: 45,
        status: 'todo',
        projectId: 'proj1',
        subtasks: []
      },
      {
        id: '11',
        title: 'Code review',
        description: 'Review team member\'s implementation',
        priority: 'High',
        estimatedTime: 60,
        status: 'todo',
        projectId: 'proj2',
        subtasks: []
      },
      {
        id: '12',
        title: 'Update documentation',
        description: 'Add API endpoint documentation',
        priority: 'Medium',
        estimatedTime: 30,
        status: 'todo',
        projectId: 'proj1',
        subtasks: []
      }
    ],
    wipLimit: 10,
  },
  render: (args) => ({
    components: { KanbanColumn, MockTaskCard },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 350px; height: 600px;">
        <KanbanColumn v-bind="args" @addTask="() => console.log('add task')" @selectTask="id => console.log('select', id)" />
      </div>
    `,
  })
}

// Interactive Demo
export const InteractiveDemo: Story = {
  render: () => ({
    components: { KanbanColumn, MockTaskCard },
    setup() {
      const todoTasks = ref([...mockTasks.todo])
      const inProgressTasks = ref([...mockTasks.inProgress])
      const doneTasks = ref([...mockTasks.done])

      const handleAddTask = (status: string) => {
        const newTask = {
          id: Date.now().toString(),
          title: `New Task ${Date.now().toString().slice(-4)}`,
          description: 'Created from interactive demo',
          priority: 'Medium',
          estimatedTime: 30,
          status,
          projectId: 'demo',
          subtasks: []
        }

        if (status === 'todo') todoTasks.value.push(newTask)
        else if (status === 'in-progress') inProgressTasks.value.push(newTask)
        else if (status === 'done') doneTasks.value.push(newTask)
      }

      const handleSelectTask = (taskId: string) => {
        console.log('Selected task:', taskId)
      }

      const handleMoveTask = (taskId: string, newStatus: string) => {
        console.log('Move task:', taskId, 'to', newStatus)
      }

      return {
        todoTasks,
        inProgressTasks,
        doneTasks,
        handleAddTask,
        handleSelectTask,
        handleMoveTask
      }
    },
    template: `
      <div style="display: flex; gap: 20px; padding: 20px; min-height: 600px; background: var(--surface-secondary);">
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <h3 style="margin: 0; color: var(--text-secondary); font-size: 14px; font-weight: 600; text-align: center;">TO DO</h3>
          <KanbanColumn
            title="To Do"
            status="todo"
            :tasks="todoTasks"
            :wip-limit="5"
            @add-task="handleAddTask"
            @select-task="handleSelectTask"
            @move-task="handleMoveTask"
          />
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          <h3 style="margin: 0; color: var(--text-secondary); font-size: 14px; font-weight: 600; text-align: center;">IN PROGRESS</h3>
          <KanbanColumn
            title="In Progress"
            status="in-progress"
            :tasks="inProgressTasks"
            :wip-limit="3"
            @add-task="handleAddTask"
            @select-task="handleSelectTask"
            @move-task="handleMoveTask"
          />
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          <h3 style="margin: 0; color: var(--text-secondary); font-size: 14px; font-weight: 600; text-align: center;">DONE</h3>
          <KanbanColumn
            title="Done"
            status="done"
            :tasks="doneTasks"
            :wip-limit="10"
            @add-task="handleAddTask"
            @select-task="handleSelectTask"
            @move-task="handleMoveTask"
          />
        </div>
      </div>
    `,
  })
}

// All WIP States Showcase
export const AllWipStates: Story = {
  render: () => ({
    components: { KanbanColumn, MockTaskCard },
    setup() {
      const normalTasks = ref(mockTasks.todo.slice(0, 1))
      const warningTasks = ref(mockTasks.todo.slice(0, 2))
      const exceededTasks = ref(mockTasks.todo)

      return { normalTasks, warningTasks, exceededTasks }
    },
    template: `
      <div style="display: flex; gap: 20px; padding: 20px; min-height: 500px; background: var(--surface-secondary);">
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <h4 style="margin: 0; color: var(--text-secondary); font-size: 14px; font-weight: 600; text-align: center;">Normal (1/3)</h4>
          <KanbanColumn
            title="Development"
            status="in-progress"
            :tasks="normalTasks"
            :wip-limit="3"
            @add-task="() => {}"
            @select-task="() => {}"
          />
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          <h4 style="margin: 0; color: var(--text-secondary); font-size: 14px; font-weight: 600; text-align: center;">Warning (2/3)</h4>
          <KanbanColumn
            title="Development"
            status="in-progress"
            :tasks="warningTasks"
            :wip-limit="3"
            @add-task="() => {}"
            @select-task="() => {}"
          />
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          <h4 style="margin: 0; color: var(--text-secondary); font-size: 14px; font-weight: 600; text-align: center;">Exceeded (3/3)</h4>
          <KanbanColumn
            title="Development"
            status="in-progress"
            :tasks="exceededTasks"
            :wip-limit="3"
            @add-task="() => {}"
            @select-task="() => {}"
          />
        </div>
      </div>
    `,
  })
}