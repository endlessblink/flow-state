import type { Meta, StoryObj } from '@storybook/vue3'
import { ref, reactive } from 'vue'
import KanbanSwimlane from '@/components/kanban/KanbanSwimlane.vue'
import type { Task, Project } from '@/stores/tasks'

const meta = {
  component: KanbanSwimlane,
  title: '✨ Features/📋 Board View/KanbanSwimlane',
  tags: ['autodocs'],

  parameters: {
    layout: 'fullscreen',
  },

  argTypes: {
    project: {
      control: 'object',
      description: 'Project object with id, name, color, and viewType',
    },
    tasks: {
      control: 'object',
      description: 'Array of tasks belonging to this project',
    },
    currentFilter: {
      control: 'select',
      options: ['today', 'week', null],
      description: 'Time-based filter applied to tasks',
    },
    density: {
      control: 'select',
      options: ['ultrathin', 'compact', 'comfortable', 'spacious'],
      description: 'Display density for task cards',
    },
    showDoneColumn: {
      control: 'boolean',
      description: 'Whether to show the Done column in status view',
    },
  },
} satisfies Meta<typeof KanbanSwimlane>

export default meta
type Story = StoryObj<typeof meta>

// Mock data generation
const createMockProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'proj-1',
  name: 'Productivity App',
  color: '#4ECDC4',
  viewType: 'status',
  createdAt: new Date().toISOString(),
  ...overrides
})

const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: `task-${Math.random().toString(36).substr(2, 9)}`,
  title: 'Sample task',
  description: '',
  status: 'backlog',
  priority: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  projectId: 'proj-1',
  subtasks: [],
  ...overrides
})

const createMockTasks = (count: number, overrides: Partial<Task>[] = []): Task[] => {
  const baseTasks = Array.from({ length: count }, (_, i) => createMockTask({
    title: `Task ${i + 1}`,
    status: ['backlog', 'planned', 'in_progress', 'on_hold', 'done'][i % 5],
    priority: ['high', 'medium', 'low', null][i % 4],
    description: `This is task ${i + 1} with some description content`,
  }))

  // Apply any specific overrides
  overrides.forEach((override, index) => {
    if (baseTasks[index]) {
      Object.assign(baseTasks[index], override)
    }
  })

  return baseTasks
}

// Basic Status View
export const StatusView: Story = {
  args: {
    project: createMockProject(),
    tasks: createMockTasks(8, [
      { title: 'Design dashboard', status: 'planned', priority: 'high' },
      { title: 'Implement drag & drop', status: 'in_progress', priority: 'medium' },
      { title: 'Add task filtering', status: 'backlog', priority: 'low' },
      { title: 'Fix responsive layout', status: 'on_hold', priority: 'high' },
      { title: 'Write documentation', status: 'done', priority: 'low' },
    ]),
    density: 'comfortable',
    showDoneColumn: true,
  },
  render: (args) => ({
    components: { KanbanSwimlane },
    setup() {
      const project = ref(args.project)
      const tasks = ref(args.tasks)

      const handleSelectTask = (taskId: string) => {
        console.log('Task selected:', taskId)
      }

      const handleStartTimer = (taskId: string) => {
        console.log('Timer started for:', taskId)
      }

      const handleEditTask = (taskId: string) => {
        console.log('Edit task:', taskId)
      }

      const handleMoveTask = (taskId: string, newStatus: Task['status']) => {
        const task = tasks.value.find(t => t.id === taskId)
        if (task) {
          task.status = newStatus
          console.log(`Moved task "${task.title}" to ${newStatus}`)
        }
      }

      const handleContextMenu = (event: MouseEvent, task: Task) => {
        console.log('Context menu for:', task.title)
        event.preventDefault()
      }

      return {
        project,
        tasks,
        handleSelectTask,
        handleStartTimer,
        handleEditTask,
        handleMoveTask,
        handleContextMenu
      }
    },
    template: `
      <div style="padding: 24px; background: var(--surface-secondary); min-height: 100vh;">
        <h3 style="margin: 0 0 24px 0; font-size: 20px; color: var(--text-primary);">Status View Swimlane</h3>
        <KanbanSwimlane
          :project="project"
          :tasks="tasks"
          :density="density"
          :show-done-column="showDoneColumn"
          @selectTask="handleSelectTask"
          @startTimer="handleStartTimer"
          @editTask="handleEditTask"
          @moveTask="handleMoveTask"
          @contextMenu="handleContextMenu"
        />
      </div>
    `,
  })
}

// Date View (Todoist-style)
export const DateView: Story = {
  args: {
    project: createMockProject({ name: 'Personal Tasks', color: '#FF6B6B', viewType: 'date' }),
    tasks: createMockTasks(12, [
      { title: 'Overdue task', dueDate: '2024-01-15', status: 'backlog' },
      { title: 'Complete project proposal', dueDate: new Date().toISOString().split('T')[0], status: 'in_progress' },
      { title: 'Team meeting preparation', dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], status: 'planned' },
      { title: 'Review pull requests', status: 'in_progress' },
      { title: 'Update dependencies', status: 'backlog' },
      { title: 'Write blog post', dueDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0], status: 'planned' },
      { title: 'Fix critical bug', status: 'in_progress', priority: 'high' },
    ]),
    density: 'comfortable',
  },
  render: (args) => ({
    components: { KanbanSwimlane },
    setup() {
      const project = ref(args.project)
      const tasks = ref(args.tasks)

      const handleSelectTask = (taskId: string) => {
        console.log('Task selected:', taskId)
      }

      const handleStartTimer = (taskId: string) => {
        console.log('Timer started for:', taskId)
      }

      const handleEditTask = (taskId: string) => {
        console.log('Edit task:', taskId)
      }

      const handleMoveTask = (taskId: string, newStatus: Task['status']) => {
        console.log('Move task:', taskId, 'to:', newStatus)
      }

      const handleContextMenu = (event: MouseEvent, task: Task) => {
        console.log('Context menu for:', task.title)
        event.preventDefault()
      }

      return {
        project,
        tasks,
        handleSelectTask,
        handleStartTimer,
        handleEditTask,
        handleMoveTask,
        handleContextMenu
      }
    },
    template: `
      <div style="padding: 24px; background: var(--surface-secondary); min-height: 100vh;">
        <h3 style="margin: 0 0 24px 0; font-size: 20px; color: var(--text-primary);">Date View Swimlane (Todoist-style)</h3>
        <KanbanSwimlane
          :project="project"
          :tasks="tasks"
          :density="density"
          @selectTask="handleSelectTask"
          @startTimer="handleStartTimer"
          @editTask="handleEditTask"
          @moveTask="handleMoveTask"
          @contextMenu="handleContextMenu"
        />
      </div>
    `,
  })
}

// Priority View
export const PriorityView: Story = {
  args: {
    project: createMockProject({ name: 'Development', color: '#9B59B6', viewType: 'priority' }),
    tasks: createMockTasks(10, [
      { title: 'Critical security fix', priority: 'high', status: 'in_progress' },
      { title: 'Performance optimization', priority: 'high', status: 'planned' },
      { title: 'Add new feature X', priority: 'medium', status: 'backlog' },
      { title: 'Refactor authentication', priority: 'medium', status: 'planned' },
      { title: 'Update documentation', priority: 'low', status: 'backlog' },
      { title: 'Code review', priority: null, status: 'in_progress' },
      { title: 'Database backup', priority: null, status: 'done' },
    ]),
    density: 'comfortable',
  },
  render: (args) => ({
    components: { KanbanSwimlane },
    setup() {
      const project = ref(args.project)
      const tasks = ref(args.tasks)

      const handleSelectTask = (taskId: string) => {
        console.log('Task selected:', taskId)
      }

      const handleStartTimer = (taskId: string) => {
        console.log('Timer started for:', taskId)
      }

      const handleEditTask = (taskId: string) => {
        console.log('Edit task:', taskId)
      }

      const handleMoveTask = (taskId: string, newStatus: Task['status']) => {
        console.log('Move task:', taskId, 'to:', newStatus)
      }

      const handleContextMenu = (event: MouseEvent, task: Task) => {
        console.log('Context menu for:', task.title)
        event.preventDefault()
      }

      return {
        project,
        tasks,
        handleSelectTask,
        handleStartTimer,
        handleEditTask,
        handleMoveTask,
        handleContextMenu
      }
    },
    template: `
      <div style="padding: 24px; background: var(--surface-secondary); min-height: 100vh;">
        <h3 style="margin: 0 0 24px 0; font-size: 20px; color: var(--text-primary);">Priority View Swimlane</h3>
        <KanbanSwimlane
          :project="project"
          :tasks="tasks"
          :density="density"
          @selectTask="handleSelectTask"
          @startTimer="handleStartTimer"
          @editTask="handleEditTask"
          @moveTask="handleMoveTask"
          @contextMenu="handleContextMenu"
        />
      </div>
    `,
  })
}

// Multiple Swimlanes
export const MultipleSwimlanes: Story = {
  render: () => ({
    components: { KanbanSwimlane },
    setup() {
      const projects = ref([
        createMockProject({ id: 'proj-1', name: 'Frontend', color: '#4ECDC4', viewType: 'status' }),
        createMockProject({ id: 'proj-2', name: 'Backend', color: '#FF6B6B', viewType: 'date' }),
        createMockProject({ id: 'proj-3', name: 'Infrastructure', color: '#9B59B6', viewType: 'priority' }),
      ])

      const tasksByProject = reactive({
        'proj-1': createMockTasks(6, [
          { title: 'Implement dashboard', status: 'in_progress', projectId: 'proj-1' },
          { title: 'Add drag & drop', status: 'planned', projectId: 'proj-1' },
          { title: 'Fix responsive issues', status: 'on_hold', projectId: 'proj-1' },
          { title: 'Write tests', status: 'backlog', projectId: 'proj-1' },
        ]),
        'proj-2': createMockTasks(5, [
          { title: 'API endpoint', status: 'in_progress', projectId: 'proj-2' },
          { title: 'Database schema', status: 'planned', projectId: 'proj-2' },
          { title: 'Authentication', status: 'backlog', projectId: 'proj-2' },
        ]),
        'proj-3': createMockTasks(4, [
          { title: 'Docker setup', status: 'in_progress', projectId: 'proj-3' },
          { title: 'CI/CD pipeline', status: 'planned', projectId: 'proj-3' },
        ]),
      })

      const handleSelectTask = (taskId: string) => {
        console.log('Task selected:', taskId)
      }

      const handleStartTimer = (taskId: string) => {
        console.log('Timer started for:', taskId)
      }

      const handleEditTask = (taskId: string) => {
        console.log('Edit task:', taskId)
      }

      const handleMoveTask = (taskId: string, newStatus: Task['status']) => {
        console.log('Move task:', taskId, 'to:', newStatus)
      }

      const handleContextMenu = (event: MouseEvent, task: Task) => {
        console.log('Context menu for:', task.title)
        event.preventDefault()
      }

      return {
        projects,
        tasksByProject,
        handleSelectTask,
        handleStartTimer,
        handleEditTask,
        handleMoveTask,
        handleContextMenu
      }
    },
    template: `
      <div style="padding: 24px; background: var(--surface-secondary); min-height: 100vh;">
        <h3 style="margin: 0 0 24px 0; font-size: 20px; color: var(--text-primary);">Multiple Swimlanes</h3>
        <div style="display: flex; flex-direction: column; gap: 24px;">
          <KanbanSwimlane
            v-for="project in projects"
            :key="project.id"
            :project="project"
            :tasks="tasksByProject[project.id]"
            density="comfortable"
            :show-done-column="true"
            @selectTask="handleSelectTask"
            @startTimer="handleStartTimer"
            @editTask="handleEditTask"
            @moveTask="handleMoveTask"
            @contextMenu="handleContextMenu"
          />
        </div>
      </div>
    `,
  })
}

// Density Variants
export const DensityVariants: Story = {
  render: () => ({
    components: { KanbanSwimlane },
    setup() {
      const densities = ['ultrathin', 'compact', 'comfortable', 'spacious'] as const
      const project = createMockProject({ name: 'Density Demo', color: '#3498DB', viewType: 'status' })
      const tasks = createMockTasks(8, [
        { title: 'Ultra thin task', status: 'backlog' },
        { title: 'Compact task', status: 'planned' },
        { title: 'Comfortable task', status: 'in_progress' },
        { title: 'Spacious task', status: 'done' },
      ])

      const handleSelectTask = (taskId: string) => {
        console.log('Task selected:', taskId)
      }

      const handleStartTimer = (taskId: string) => {
        console.log('Timer started for:', taskId)
      }

      const handleEditTask = (taskId: string) => {
        console.log('Edit task:', taskId)
      }

      const handleMoveTask = (taskId: string, newStatus: Task['status']) => {
        console.log('Move task:', taskId, 'to:', newStatus)
      }

      const handleContextMenu = (event: MouseEvent, task: Task) => {
        console.log('Context menu for:', task.title)
        event.preventDefault()
      }

      return {
        densities,
        project,
        tasks,
        handleSelectTask,
        handleStartTimer,
        handleEditTask,
        handleMoveTask,
        handleContextMenu
      }
    },
    template: `
      <div style="padding: 24px; background: var(--surface-secondary); min-height: 100vh;">
        <h3 style="margin: 0 0 24px 0; font-size: 20px; color: var(--text-primary);">Density Variants</h3>
        <div style="display: flex; flex-direction: column; gap: 32px;">
          <div v-for="density in densities" :key="density">
            <h4 style="margin: 0 0 16px 0; font-size: 16px; color: var(--text-secondary); text-transform: capitalize;">{{ density }} Density</h4>
            <KanbanSwimlane
              :project="project"
              :tasks="tasks"
              :density="density"
              :show-done-column="true"
              @selectTask="handleSelectTask"
              @startTimer="handleStartTimer"
              @editTask="handleEditTask"
              @moveTask="handleMoveTask"
              @contextMenu="handleContextMenu"
            />
          </div>
        </div>
      </div>
    `,
  })
}

// Filter States
export const FilterStates: Story = {
  render: () => ({
    components: { KanbanSwimlane },
    setup() {
      const project = createMockProject({ name: 'Filtered Project', color: '#E74C3C', viewType: 'date' })

      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]
      const tomorrow = new Date(today.getTime() + 86400000).toISOString().split('T')[0]
      const nextWeek = new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0]

      const tasks = ref([
        { ...createMockTask({ title: 'Today task', dueDate: todayStr, status: 'planned' }), id: 'today-1' },
        { ...createMockTask({ title: 'Another today task', status: 'in_progress' }), id: 'today-2' },
        { ...createMockTask({ title: 'Tomorrow task', dueDate: tomorrow, status: 'backlog' }), id: 'tomorrow-1' },
        { ...createMockTask({ title: 'Next week task', dueDate: nextWeek, status: 'backlog' }), id: 'week-1' },
        { ...createMockTask({ title: 'No date task', status: 'planned' }), id: 'nodate-1' },
        { ...createMockTask({ title: 'Overdue task', dueDate: '2024-01-15', status: 'backlog' }), id: 'overdue-1' },
      ])

      const currentFilters = ref<[null, 'today', 'week']>([null, 'today', 'week'])

      const handleSelectTask = (taskId: string) => {
        console.log('Task selected:', taskId)
      }

      const handleStartTimer = (taskId: string) => {
        console.log('Timer started for:', taskId)
      }

      const handleEditTask = (taskId: string) => {
        console.log('Edit task:', taskId)
      }

      const handleMoveTask = (taskId: string, newStatus: Task['status']) => {
        console.log('Move task:', taskId, 'to:', newStatus)
      }

      const handleContextMenu = (event: MouseEvent, task: Task) => {
        console.log('Context menu for:', task.title)
        event.preventDefault()
      }

      return {
        project,
        tasks,
        currentFilters,
        handleSelectTask,
        handleStartTimer,
        handleEditTask,
        handleMoveTask,
        handleContextMenu
      }
    },
    template: `
      <div style="padding: 24px; background: var(--surface-secondary); min-height: 100vh;">
        <h3 style="margin: 0 0 24px 0; font-size: 20px; color: var(--text-primary);">Filter States</h3>
        <div style="display: flex; flex-direction: column; gap: 32px;">
          <div v-for="(filter, index) in currentFilters" :key="filter || 'no-filter'">
            <h4 style="margin: 0 0 16px 0; font-size: 16px; color: var(--text-secondary);">
              {{ filter ? filter.charAt(0).toUpperCase() + filter.slice(1) + ' Filter' : 'No Filter' }}
            </h4>
            <KanbanSwimlane
              :project="project"
              :tasks="tasks"
              :current-filter="filter"
              density="comfortable"
              @selectTask="handleSelectTask"
              @startTimer="handleStartTimer"
              @editTask="handleEditTask"
              @moveTask="handleMoveTask"
              @contextMenu="handleContextMenu"
            />
          </div>
        </div>
      </div>
    `,
  })
}

// Interactive Demo
export const InteractiveDemo: Story = {
  render: () => ({
    components: { KanbanSwimlane },
    setup() {
      const project = ref(createMockProject({ name: 'Interactive Demo', color: '#2ECC71', viewType: 'status' }))
      const tasks = ref(createMockTasks(8, [
        { title: 'Try dragging me!', status: 'backlog', priority: 'medium' },
        { title: 'I can be moved between columns', status: 'planned', priority: 'high' },
        { title: 'Click my menu button', status: 'in_progress', priority: 'low' },
        { title: 'Change view type below', status: 'on_hold', priority: null },
        { title: 'Try different densities', status: 'done', priority: 'medium' },
      ]))

      const currentViewType = ref<Project['viewType']>('status')
      const density = ref<'ultrathin' | 'compact' | 'comfortable' | 'spacious'>('comfortable')
      const showDoneColumn = ref(true)
      const currentFilter = ref<null | 'today' | 'week'>(null)

      const viewTypes: Array<Project['viewType']> = ['status', 'date', 'priority']
      const densities: Array<'ultrathin' | 'compact' | 'comfortable' | 'spacious'> = ['ultrathin', 'compact', 'comfortable', 'spacious']
      const filters: Array<null | 'today' | 'week'> = [null, 'today', 'week']

      const handleSelectTask = (taskId: string) => {
        console.log('✅ Task selected:', taskId)
      }

      const handleStartTimer = (taskId: string) => {
        console.log('⏱️ Timer started for:', taskId)
      }

      const handleEditTask = (taskId: string) => {
        console.log('✏️ Edit task:', taskId)
      }

      const handleMoveTask = (taskId: string, newStatus: Task['status']) => {
        const task = tasks.value.find(t => t.id === taskId)
        if (task) {
          console.log(`📋 Moved "${task.title}" to ${newStatus}`)
        }
      }

      const handleContextMenu = (event: MouseEvent, task: Task) => {
        console.log('📋 Context menu for:', task.title)
        event.preventDefault()
      }

      const addNewTask = () => {
        const newTask = createMockTask({
          title: `New task ${tasks.value.length + 1}`,
          status: 'backlog',
          priority: ['high', 'medium', 'low', null][Math.floor(Math.random() * 4)]
        })
        tasks.value.push(newTask)
        console.log('➕ Added new task:', newTask.title)
      }

      return {
        project,
        tasks,
        currentViewType,
        density,
        showDoneColumn,
        currentFilter,
        viewTypes,
        densities,
        filters,
        handleSelectTask,
        handleStartTimer,
        handleEditTask,
        handleMoveTask,
        handleContextMenu,
        addNewTask
      }
    },
    template: `
      <div style="padding: 24px; background: var(--surface-secondary); min-height: 100vh;">
        <h3 style="margin: 0 0 24px 0; font-size: 20px; color: var(--text-primary);">Interactive KanbanSwimlane Demo</h3>

        <!-- Controls -->
        <div style="display: flex; gap: 20px; margin-bottom: 24px; flex-wrap: wrap; padding: 20px; background: var(--surface-primary); border-radius: 12px; border: 1px solid var(--border-subtle);">
          <div>
            <label style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">View Type</label>
            <select
              v-model="currentViewType"
              @change="project.viewType = currentViewType"
              style="padding: 6px 12px; border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--surface-tertiary); color: var(--text-primary);"
            >
              <option v-for="viewType in viewTypes" :key="viewType" :value="viewType">
                {{ viewType.charAt(0).toUpperCase() + viewType.slice(1) }}
              </option>
            </select>
          </div>

          <div>
            <label style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Density</label>
            <select
              v-model="density"
              style="padding: 6px 12px; border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--surface-tertiary); color: var(--text-primary);"
            >
              <option v-for="d in densities" :key="d" :value="d">
                {{ d.charAt(0).toUpperCase() + d.slice(1) }}
              </option>
            </select>
          </div>

          <div>
            <label style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Show Done Column</label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" v-model="showDoneColumn" style="margin: 0;">
              <span style="font-size: 14px; color: var(--text-primary);">{{ showDoneColumn ? 'Yes' : 'No' }}</span>
            </label>
          </div>

          <div>
            <label style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Filter</label>
            <select
              v-model="currentFilter"
              style="padding: 6px 12px; border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--surface-tertiary); color: var(--text-primary);"
            >
              <option v-for="filter in filters" :key="filter || 'none'" :value="filter">
                {{ filter || 'None' }}
              </option>
            </select>
          </div>

          <div style="display: flex; align-items: end;">
            <button
              @click="addNewTask"
              style="padding: 8px 16px; background: var(--brand-primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;"
            >
              Add Task
            </button>
          </div>
        </div>

        <!-- Swimlane -->
        <KanbanSwimlane
          :project="project"
          :tasks="tasks"
          :current-filter="currentFilter"
          :density="density"
          :show-done-column="showDoneColumn"
          @selectTask="handleSelectTask"
          @startTimer="handleStartTimer"
          @editTask="handleEditTask"
          @moveTask="handleMoveTask"
          @contextMenu="handleContextMenu"
        />

        <!-- Instructions -->
        <div style="margin-top: 32px; padding: 20px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Try These Interactions:</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; font-size: 14px; color: var(--text-secondary); line-height: 1.6;">
            <div>
              <strong>🖱️ Drag & Drop:</strong> Move tasks between columns
            </div>
            <div>
              <strong>📋 Context Menu:</strong> Right-click tasks for options
            </div>
            <div>
              <strong>👁️ View Switching:</strong> Change view types above
            </div>
            <div>
              <strong>📏 Density:</strong> Try different spacing options
            </div>
            <div>
              <strong>🔍 Filters:</strong> Apply time-based filters
            </div>
            <div>
              <strong>➕ Add Tasks:</strong> Create new tasks dynamically
            </div>
          </div>
        </div>
      </div>
    `,
  })
}