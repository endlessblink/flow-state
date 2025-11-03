import type { Meta, StoryObj } from '@storybook/vue3'
import { ref, reactive, computed } from 'vue'
import TaskManagerSidebar from '@/components/TaskManagerSidebar.vue'
import type { Task } from '@/stores/tasks'

const meta = {
  component: TaskManagerSidebar,
  title: '🧩 Components/📝 Form Controls/TaskManagerSidebar',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
  },

  argTypes: {
    // No props - component manages its own state from taskStore
  },
} satisfies Meta<typeof TaskManagerSidebar>

export default meta
type Story = StoryObj<typeof meta>

// Mock task data generation
const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: `task-${Math.random().toString(36).substr(2, 9)}`,
  title: 'Sample task',
  description: '',
  status: 'planned',
  priority: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  projectId: 'proj-1',
  parentTaskId: null,
  subtasks: [],
  completedPomodoros: 0,
  scheduledDate: null,
  scheduledTime: null,
  instances: [],
  ...overrides
})

const createHierarchicalTasks = () => {
  const parent1 = createMockTask({
    title: 'Complete project documentation',
    priority: 'high',
    status: 'in_progress',
    completedPomodoros: 3,
    subtasks: [
      { id: 'st1', title: 'Write API docs', isCompleted: true },
      { id: 'st2', title: 'Create user guide', isCompleted: false },
      { id: 'st3', title: 'Add examples', isCompleted: false }
    ]
  })

  const child1 = createMockTask({
    title: 'Write API documentation',
    parentTaskId: parent1.id,
    priority: 'high',
    status: 'done',
    completedPomodoros: 2
  })

  const child2 = createMockTask({
    title: 'Create user guide',
    parentTaskId: parent1.id,
    priority: 'medium',
    status: 'planned',
    completedPomodoros: 1
  })

  const child3 = createMockTask({
    title: 'Add code examples',
    parentTaskId: parent1.id,
    priority: 'low',
    status: 'backlog',
    completedPomodoros: 0
  })

  const parent2 = createMockTask({
    title: 'Implement user authentication',
    priority: 'high',
    status: 'planned',
    completedPomodoros: 1,
    subtasks: [
      { id: 'st4', title: 'Design auth flow', isCompleted: true },
      { id: 'st5', title: 'Implement login', isCompleted: false }
    ]
  })

  const child4 = createMockTask({
    title: 'Design authentication flow',
    parentTaskId: parent2.id,
    priority: 'high',
    status: 'done',
    completedPomodoros: 1
  })

  const child5 = createMockTask({
    title: 'Implement login functionality',
    parentTaskId: parent2.id,
    priority: 'high',
    status: 'in_progress',
    completedPomodoros: 0
  })

  const soloTask = createMockTask({
    title: 'Review code quality',
    priority: 'medium',
    status: 'backlog',
    completedPomodoros: 0
  })

  return [parent1, child1, child2, child3, parent2, child4, child5, soloTask]
}

// Default View with Multiple Tasks
export const Default: Story = {
  render: () => ({
    components: { TaskManagerSidebar },
    setup() {
      // Mock taskStore with tasks
      const mockTasks = createHierarchicalTasks()
      const filteredTasks = ref(mockTasks)

      const handleAddTask = () => {
        console.log('Add task clicked')
        const newTask = createMockTask({
          title: `New task ${mockTasks.length + 1}`,
          priority: ['high', 'medium', 'low', null][Math.floor(Math.random() * 4)]
        })
        mockTasks.push(newTask)
        console.log('Added new task:', newTask.title)
      }

      const handleStartTimer = (taskId: string) => {
        const task = mockTasks.find(t => t.id === taskId)
        if (task) {
          console.log('Timer started for:', task.title)
        }
      }

      const handleEditTask = (taskId: string) => {
        const task = mockTasks.find(t => t.id === taskId)
        if (task) {
          console.log('Edit task:', task.title)
        }
      }

      // Mock taskStore methods
      const taskStore = {
        filteredTasks: filteredTasks,
        hasNestedTasks: (taskId: string) => {
          return mockTasks.some(task => task.parentTaskId === taskId)
        },
        getTaskChildren: (taskId: string) => {
          return mockTasks.filter(task => task.parentTaskId === taskId)
        },
        setActiveStatusFilter: (status: any) => {
          console.log('Status filter set to:', status)
        },
        activeStatusFilter: ref(null)
      }

      return {
        handleAddTask,
        handleStartTimer,
        handleEditTask,
        taskStore
      }
    },
    template: `
      <div style="padding: 24px; background: var(--surface-secondary); min-height: 100vh;">
        <h3 style="margin: 0 0 24px 0; font-size: 20px; color: var(--text-primary);">Task Manager Sidebar</h3>
        <TaskManagerSidebar
          @addTask="handleAddTask"
          @startTimer="handleStartTimer"
          @editTask="handleEditTask"
        />
      </div>
    `,
  })
}

// Scheduled Tasks View
export const ScheduledTasks: Story = {
  render: () => ({
    components: { TaskManagerSidebar },
    setup() {
      const today = new Date()
      const tomorrow = new Date(today.getTime() + 86400000)
      const nextWeek = new Date(today.getTime() + 7 * 86400000)

      const mockTasks = [
        createMockTask({
          title: 'Team standup meeting',
          priority: 'high',
          status: 'planned',
          scheduledDate: today.toISOString(),
          scheduledTime: '09:00',
          completedPomodoros: 0,
          instances: [{ id: 'inst1', scheduledDate: today.toISOString().split('T')[0] }]
        }),
        createMockTask({
          title: 'Complete project proposal',
          priority: 'medium',
          status: 'in_progress',
          scheduledDate: tomorrow.toISOString(),
          scheduledTime: '14:00',
          completedPomodoros: 2,
          instances: [{ id: 'inst2', scheduledDate: tomorrow.toISOString().split('T')[0] }]
        }),
        createMockTask({
          title: 'Code review session',
          priority: 'low',
          status: 'planned',
          scheduledDate: nextWeek.toISOString(),
          scheduledTime: '10:30',
          completedPomodoros: 0,
          instances: [{ id: 'inst3', scheduledDate: nextWeek.toISOString().split('T')[0] }]
        }),
        createMockTask({
          title: 'Unscheduled task',
          priority: 'medium',
          status: 'backlog',
          completedPomodoros: 1
        })
      ]

      const filteredTasks = ref(mockTasks)

      const handleAddTask = () => {
        console.log('Add task clicked')
      }

      const handleStartTimer = (taskId: string) => {
        const task = mockTasks.find(t => t.id === taskId)
        if (task) {
          console.log('Timer started for scheduled task:', task.title)
        }
      }

      const handleEditTask = (taskId: string) => {
        const task = mockTasks.find(t => t.id === taskId)
        if (task) {
          console.log('Edit scheduled task:', task.title)
        }
      }

      return {
        handleAddTask,
        handleStartTimer,
        handleEditTask
      }
    },
    template: `
      <div style="padding: 24px; background: var(--surface-secondary); min-height: 100vh;">
        <h3 style="margin: 0 0 24px 0; font-size: 20px; color: var(--text-primary);">Scheduled Tasks View</h3>
        <TaskManagerSidebar
          @addTask="handleAddTask"
          @startTimer="handleStartTimer"
          @editTask="handleEditTask"
        />
      </div>
    `,
  })
}

// High Priority Tasks
export const HighPriorityTasks: Story = {
  render: () => ({
    components: { TaskManagerSidebar },
    setup() {
      const mockTasks = [
        createMockTask({
          title: 'Critical security fix',
          priority: 'high',
          status: 'in_progress',
          completedPomodoros: 4,
          subtasks: [
            { id: 'st1', title: 'Identify vulnerability', isCompleted: true },
            { id: 'st2', title: 'Apply patch', isCompleted: false },
            { id: 'st3', title: 'Test fix', isCompleted: false }
          ]
        }),
        createMockTask({
          title: 'Client presentation preparation',
          priority: 'high',
          status: 'planned',
          scheduledDate: new Date().toISOString(),
          completedPomodoros: 1
        }),
        createMockTask({
          title: 'Database backup verification',
          priority: 'high',
          status: 'planned',
          completedPomodoros: 0
        }),
        createMockTask({
          title: 'Medium priority task',
          priority: 'medium',
          status: 'backlog',
          completedPomodoros: 0
        })
      ]

      const filteredTasks = ref(mockTasks)

      const handleAddTask = () => {
        console.log('Add task clicked')
      }

      const handleStartTimer = (taskId: string) => {
        const task = mockTasks.find(t => t.id === taskId)
        if (task) {
          console.log('Timer started for priority task:', task.title)
        }
      }

      const handleEditTask = (taskId: string) => {
        const task = mockTasks.find(t => t.id === taskId)
        if (task) {
          console.log('Edit priority task:', task.title)
        }
      }

      return {
        handleAddTask,
        handleStartTimer,
        handleEditTask
      }
    },
    template: `
      <div style="padding: 24px; background: var(--surface-secondary); min-height: 100vh;">
        <h3 style="margin: 0 0 24px 0; font-size: 20px; color: var(--text-primary);">High Priority Tasks</h3>
        <TaskManagerSidebar
          @addTask="handleAddTask"
          @startTimer="handleStartTimer"
          @editTask="handleEditTask"
        />
      </div>
    `,
  })
}

// Empty State
export const EmptyState: Story = {
  render: () => ({
    components: { TaskManagerSidebar },
    setup() {
      const filteredTasks = ref([])

      const handleAddTask = () => {
        console.log('Create first task clicked')
        const newTask = createMockTask({
          title: 'My first task',
          priority: 'medium',
          status: 'planned'
        })
        filteredTasks.value.push(newTask)
        console.log('Created first task:', newTask.title)
      }

      const handleStartTimer = (taskId: string) => {
        console.log('Timer started for first task')
      }

      const handleEditTask = (taskId: string) => {
        console.log('Edit first task')
      }

      return {
        handleAddTask,
        handleStartTimer,
        handleEditTask
      }
    },
    template: `
      <div style="padding: 24px; background: var(--surface-secondary); min-height: 100vh;">
        <h3 style="margin: 0 0 24px 0; font-size: 20px; color: var(--text-primary);">Empty State</h3>
        <TaskManagerSidebar
          @addTask="handleAddTask"
          @startTimer="handleStartTimer"
          @editTask="handleEditTask"
        />
      </div>
    `,
  })
}

// Tasks with Subtasks
export const TasksWithSubtasks: Story = {
  render: () => ({
    components: { TaskManagerSidebar },
    setup() {
      const mockTasks = [
        createMockTask({
          title: 'Mobile app development',
          priority: 'high',
          status: 'in_progress',
          completedPomodoros: 5,
          subtasks: [
            { id: 'st1', title: 'Design UI mockups', isCompleted: true },
            { id: 'st2', title: 'Implement navigation', isCompleted: true },
            { id: 'st3', title: 'Add user authentication', isCompleted: false },
            { id: 'st4', title: 'Integrate backend API', isCompleted: false },
            { id: 'st5', title: 'Testing and debugging', isCompleted: false }
          ]
        }),
        createMockTask({
          title: 'Content creation',
          priority: 'medium',
          status: 'planned',
          completedPomodoros: 2,
          subtasks: [
            { id: 'st6', title: 'Write blog post outline', isCompleted: true },
            { id: 'st7', title: 'Draft article content', isCompleted: false },
            { id: 'st8', title: 'Add images and media', isCompleted: false }
          ]
        }),
        createMockTask({
          title: 'Simple task without subtasks',
          priority: 'low',
          status: 'backlog',
          completedPomodoros: 0
        })
      ]

      const filteredTasks = ref(mockTasks)

      const handleAddTask = () => {
        console.log('Add task clicked')
      }

      const handleStartTimer = (taskId: string) => {
        const task = mockTasks.find(t => t.id === taskId)
        if (task) {
          console.log('Timer started for:', task.title, `- ${task.completedPomodoros} pomodoros completed`)
        }
      }

      const handleEditTask = (taskId: string) => {
        const task = mockTasks.find(t => t.id === taskId)
        if (task) {
          console.log('Edit task:', task.title)
        }
      }

      return {
        handleAddTask,
        handleStartTimer,
        handleEditTask
      }
    },
    template: `
      <div style="padding: 24px; background: var(--surface-secondary); min-height: 100vh;">
        <h3 style="margin: 0 0 24px 0; font-size: 20px; color: var(--text-primary);">Tasks with Subtasks</h3>
        <TaskManagerSidebar
          @addTask="handleAddTask"
          @startTimer="handleStartTimer"
          @editTask="handleEditTask"
        />
      </div>
    `,
  })
}

// Interactive Demo
export const InteractiveDemo: Story = {
  render: () => ({
    components: { TaskManagerSidebar },
    setup() {
      const mockTasks = ref(createHierarchicalTasks())
      const stats = reactive({
        tasksAdded: 0,
        timersStarted: 0,
        tasksEdited: 0
      })

      const handleAddTask = () => {
        const newTask = createMockTask({
          title: `New task ${mockTasks.value.length + 1}`,
          priority: ['high', 'medium', 'low', null][Math.floor(Math.random() * 4)],
          status: ['planned', 'in_progress', 'backlog'][Math.floor(Math.random() * 3)]
        })
        mockTasks.value.push(newTask)
        stats.tasksAdded++
        console.log(`✅ Task ${stats.tasksAdded} added:`, newTask.title)
      }

      const handleStartTimer = (taskId: string) => {
        const task = mockTasks.value.find(t => t.id === taskId)
        if (task) {
          task.completedPomodoros++
          stats.timersStarted++
          console.log(`⏱️ Timer ${stats.timersStarted} started for:`, task.title)
        }
      }

      const handleEditTask = (taskId: string) => {
        const task = mockTasks.value.find(t => t.id === taskId)
        if (task) {
          stats.tasksEdited++
          console.log(`✏️ Task ${stats.tasksEdited} edited:`, task.title)
        }
      }

      return {
        mockTasks,
        stats,
        handleAddTask,
        handleStartTimer,
        handleEditTask
      }
    },
    template: `
      <div style="padding: 24px; background: var(--surface-secondary); min-height: 100vh;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <h3 style="margin: 0; font-size: 20px; color: var(--text-primary);">Interactive Task Manager Demo</h3>
          <div style="display: flex; gap: 16px; font-size: 14px; color: var(--text-secondary);">
            <span>📝 Tasks added: {{ stats.tasksAdded }}</span>
            <span>⏱️ Timers started: {{ stats.timersStarted }}</span>
            <span>✏️ Tasks edited: {{ stats.tasksEdited }}</span>
          </div>
        </div>

        <TaskManagerSidebar
          @addTask="handleAddTask"
          @startTimer="handleStartTimer"
          @editTask="handleEditTask"
        />

        <div style="margin-top: 24px; padding: 20px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Try These Interactions:</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; font-size: 14px; color: var(--text-secondary); line-height: 1.6;">
            <div><strong>➕ Add Task:</strong> Click the + button to create new tasks</div>
            <div><strong>🔍 Search:</strong> Type in the search box to filter tasks</div>
            <div><strong>🏷️ Filters:</strong> Click filter tabs to change view</div>
            <div><strong>▶️ Start Timer:</strong> Click play button on tasks</div>
            <div><strong>✏️ Edit Task:</strong> Click the edit button</div>
            <div><strong>📂 Expand/Collapse:</strong> Click chevron for nested tasks</div>
            <div><strong>🖱️ Drag & Drop:</strong> Tasks are draggable (check console)</div>
            <div><strong>📊 View Stats:</strong> Track interactions above</div>
          </div>
        </div>
      </div>
    `,
  })
}

// Hierarchical Tasks Showcase
export const HierarchicalTasks: Story = {
  render: () => ({
    components: { TaskManagerSidebar },
    setup() {
      const mockTasks = [
        // Main project with multiple subtasks
        createMockTask({
          title: '🚀 Launch Website Redesign',
          priority: 'high',
          status: 'in_progress',
          completedPomodoros: 8,
          subtasks: [
            { id: 'st1', title: 'Design mockups', isCompleted: true },
            { id: 'st2', title: 'Develop frontend', isCompleted: true },
            { id: 'st3', title: 'Setup backend', isCompleted: false },
            { id: 'st4', title: 'Testing phase', isCompleted: false }
          ]
        }),
        // Child tasks for main project
        createMockTask({
          title: 'Create design mockups',
          parentTaskId: mockTasks[0].id,
          priority: 'high',
          status: 'done',
          completedPomodoros: 4
        }),
        createMockTask({
          title: 'Implement responsive frontend',
          parentTaskId: mockTasks[0].id,
          priority: 'high',
          status: 'done',
          completedPomodoros: 6
        }),
        createMockTask({
          title: 'Setup Node.js backend',
          parentTaskId: mockTasks[0].id,
          priority: 'medium',
          status: 'in_progress',
          completedPomodoros: 2
        }),
        createMockTask({
          title: 'Comprehensive testing',
          parentTaskId: mockTasks[0].id,
          priority: 'medium',
          status: 'planned',
          completedPomodoros: 0
        }),
        // Another parent task
        createMockTask({
          title: '📊 Analytics Integration',
          priority: 'medium',
          status: 'planned',
          completedPomodoros: 1,
          subtasks: [
            { id: 'st5', title: 'Choose analytics platform', isCompleted: true },
            { id: 'st6', title: 'Implement tracking code', isCompleted: false }
          ]
        }),
        createMockTask({
          title: 'Research and select analytics tool',
          parentTaskId: mockTasks[5].id,
          priority: 'medium',
          status: 'done',
          completedPomodoros: 1
        }),
        createMockTask({
          title: 'Add tracking scripts to website',
          parentTaskId: mockTasks[5].id,
          priority: 'medium',
          status: 'backlog',
          completedPomodoros: 0
        }),
        // Standalone task
        createMockTask({
          title: '📧 Email campaign setup',
          priority: 'low',
          status: 'backlog',
          completedPomodoros: 0
        })
      ]

      const filteredTasks = ref(mockTasks)

      const handleAddTask = () => {
        console.log('Add task clicked')
      }

      const handleStartTimer = (taskId: string) => {
        const task = mockTasks.find(t => t.id === taskId)
        if (task) {
          console.log('Timer started for hierarchical task:', task.title)
        }
      }

      const handleEditTask = (taskId: string) => {
        const task = mockTasks.find(t => t.id === taskId)
        if (task) {
          console.log('Edit hierarchical task:', task.title)
        }
      }

      return {
        handleAddTask,
        handleStartTimer,
        handleEditTask
      }
    },
    template: `
      <div style="padding: 24px; background: var(--surface-secondary); min-height: 100vh;">
        <h3 style="margin: 0 0 24px 0; font-size: 20px; color: var(--text-primary);">Hierarchical Tasks Showcase</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary); font-size: 14px;">
          Click the chevron icons to expand/collapse parent tasks and see their child tasks.
        </p>
        <TaskManagerSidebar
          @addTask="handleAddTask"
          @startTimer="handleStartTimer"
          @editTask="handleEditTask"
        />
      </div>
    `,
  })
}