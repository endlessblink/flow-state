import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import SearchModal from '@/components/SearchModal.vue'

// Mock data for search results
const mockTasks = [
  {
    id: '1',
    title: 'Complete project documentation',
    description: 'Write comprehensive docs for the new API',
    projectId: 'proj1',
    status: 'todo',
    priority: 'high'
  },
  {
    id: '2',
    title: 'Review pull requests',
    description: 'Check and approve pending PRs',
    projectId: 'proj1',
    status: 'in-progress',
    priority: 'medium'
  },
  {
    id: '3',
    title: 'Fix critical bug',
    description: 'Resolve production issue',
    projectId: 'proj2',
    status: 'todo',
    priority: 'high'
  },
  {
    id: '4',
    title: 'Update dependencies',
    description: 'Upgrade to latest package versions',
    projectId: 'proj1',
    status: 'done',
    priority: 'low'
  },
  {
    id: '5',
    title: 'Design new feature',
    description: 'Create mockups for upcoming feature',
    projectId: 'proj3',
    status: 'planned',
    priority: 'medium'
  },
  {
    id: '6',
    title: 'Write unit tests',
    description: 'Add test coverage for new components',
    projectId: 'proj2',
    status: 'todo',
    priority: 'medium'
  },
  {
    id: '7',
    title: 'Optimize database queries',
    description: 'Improve performance bottlenecks',
    projectId: 'proj2',
    status: 'in-progress',
    priority: 'high'
  },
  {
    id: '8',
    title: 'Setup CI/CD pipeline',
    description: 'Configure automated deployment',
    projectId: 'proj3',
    status: 'done',
    priority: 'low'
  }
]

const mockProjects = [
  {
    id: 'proj1',
    name: 'Development Tasks',
    color: '#3b82f6',
    description: 'Core development work'
  },
  {
    id: 'proj2',
    name: 'Bug Fixes',
    color: '#ef4444',
    description: 'Critical issue resolution'
  },
  {
    id: 'proj3',
    name: 'Design Work',
    color: '#8b5cf6',
    description: 'UI/UX improvements'
  },
  {
    id: 'proj4',
    name: 'Testing',
    color: '#10b981',
    description: 'Quality assurance'
  },
  {
    id: 'proj5',
    name: 'Infrastructure',
    color: '#f59e0b',
    description: 'DevOps and deployment'
  }
]

const meta = {
  component: SearchModal,
  title: '🎭 Overlays/🪟 Modals/SearchModal',
  tags: ['autodocs'],

  parameters: {
    layout: 'fullscreen',
  },

  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Whether the search modal is open',
    },
  },
} satisfies Meta<typeof SearchModal>

export default meta
type Story = StoryObj<typeof meta>

// Basic Modal States
export const Closed: Story = {
  args: {
    isOpen: false,
  },
  render: (args) => ({
    components: { SearchModal },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 100vw; height: 100vh; background: var(--surface-secondary); position: relative;">
        <div style="padding: 20px; text-align: center;">
          <h3>Search Modal (Closed)</h3>
          <p>Click the button below to open the search modal</p>
          <button @click="$event => console.log('Open search')" style="margin-top: 20px; padding: 12px 24px; background: var(--brand-primary); color: white; border: none; border-radius: 6px; cursor: pointer;">
            Open Search (Ctrl+K)
          </button>
        </div>
        <SearchModal v-bind="args"
          @close="() => console.log('Search closed')"
          @select-task="(task) => console.log('Selected task:', task.title)"
          @select-project="(project) => console.log('Selected project:', project.name)"
        />
      </div>
    `,
  })
}

export const EmptyOpen: Story = {
  args: {
    isOpen: true,
  },
  render: (args) => ({
    components: { SearchModal },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 100vw; height: 100vh; background: var(--surface-secondary); position: relative;">
        <SearchModal v-bind="args"
          @close="() => console.log('Search closed')"
          @select-task="(task) => console.log('Selected task:', task.title)"
          @select-project="(project) => console.log('Selected project:', project.name)"
        />
      </div>
    `,
  })
}

// Search Scenarios
export const TaskSearch: Story = {
  render: () => ({
    components: { SearchModal },
    setup() {
      const isOpen = ref(true)

      // Mock task store data
      const taskStore = {
        tasks: mockTasks,
        projects: mockProjects
      }

      // Mock the store
      const useTaskStore = () => taskStore

      return { isOpen, useTaskStore }
    },
    template: `
      <div style="width: 100vw; height: 100vh; background: var(--surface-secondary); position: relative;">
        <div style="position: absolute; top: 20px; left: 20px; z-index: 100; background: var(--surface-primary); padding: 12px; border-radius: 8px; box-shadow: var(--shadow-md);">
          <p style="margin: 0; font-size: 14px; font-weight: 600;">Task Search Demo</p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-muted);">Try searching for: "documentation", "bug", "fix", "test", "deploy"</p>
        </div>

        <SearchModal :is-open="isOpen"
          @close="isOpen = false"
          @select-task="(task) => { console.log('Selected task:', task.title); isOpen = false }"
          @select-project="(project) => { console.log('Selected project:', project.name); isOpen = false }"
        />
      </div>
    `,
  })
}

export const ProjectSearch: Story = {
  render: () => ({
    components: { SearchModal },
    setup() {
      const isOpen = ref(true)

      // Mock task store data
      const taskStore = {
        tasks: mockTasks,
        projects: mockProjects
      }

      // Mock the store
      const useTaskStore = () => taskStore

      return { isOpen, useTaskStore }
    },
    template: `
      <div style="width: 100vw; height: 100vh; background: var(--surface-secondary); position: relative;">
        <div style="position: absolute; top: 20px; left: 20px; z-index: 100; background: var(--surface-primary); padding: 12px; border-radius: 8px; box-shadow: var(--shadow-md);">
          <p style="margin: 0; font-size: 14px; font-weight: 600;">Project Search Demo</p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-muted);">Try searching for: "development", "design", "testing", "infrastructure"</p>
        </div>

        <SearchModal :is-open="isOpen"
          @close="isOpen = false"
          @select-task="(task) => { console.log('Selected task:', task.title); isOpen = false }"
          @select-project="(project) => { console.log('Selected project:', project.name); isOpen = false }"
        />
      </div>
    `,
  })
}

export const NoResults: Story = {
  render: () => ({
    components: { SearchModal },
    setup() {
      const isOpen = ref(true)

      // Mock task store with empty data
      const taskStore = {
        tasks: [],
        projects: []
      }

      // Mock the store
      const useTaskStore = () => taskStore

      return { isOpen, useTaskStore }
    },
    template: `
      <div style="width: 100vw; height: 100vh; background: var(--surface-secondary); position: relative;">
        <div style="position: absolute; top: 20px; left: 20px; z-index: 100; background: var(--surface-primary); padding: 12px; border-radius: 8px; box-shadow: var(--shadow-md);">
          <p style="margin: 0; font-size: 14px; font-weight: 600;">No Results Demo</p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-muted);">Try searching: "nonexistent" - should show no results</p>
        </div>

        <SearchModal :is-open="isOpen"
          @close="isOpen = false"
          @select-task="(task) => console.log('Selected task:', task.title)"
          @select-project="(project) => console.log('Selected project:', project.name)"
        />
      </div>
    `,
  })
}

// Interactive Demo
export const InteractiveDemo: Story = {
  render: () => ({
    components: { SearchModal },
    setup() {
      const isOpen = ref(false)
      const selectedItems = ref<any[]>([])

      // Mock task store data
      const taskStore = {
        tasks: mockTasks,
        projects: mockProjects
      }

      // Mock the store
      const useTaskStore = () => taskStore

      const handleSelectTask = (task: any) => {
        selectedItems.value.push({ type: 'task', ...task })
        isOpen.value = false
        console.log('Selected task:', task.title)
      }

      const handleSelectProject = (project: any) => {
        selectedItems.value.push({ type: 'project', ...project })
        isOpen.value = false
        console.log('Selected project:', project.name)
      }

      const openSearch = () => {
        isOpen.value = true
      }

      const clearSelections = () => {
        selectedItems.value = []
      }

      return {
        isOpen,
        selectedItems,
        useTaskStore,
        handleSelectTask,
        handleSelectProject,
        openSearch,
        clearSelections
      }
    },
    template: `
      <div style="width: 100vw; height: 100vh; background: var(--surface-secondary); position: relative;">
        <!-- Main Content -->
        <div style="padding: 20px; display: flex; flex-direction: column; gap: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h1 style="margin: 0;">Interactive Search Demo</h1>
            <div style="display: flex; gap: 12px;">
              <button
                @click="openSearch"
                style="display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: var(--brand-primary); color: white; border: none; border-radius: 6px; cursor: pointer;"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                  <path d="M11 8v6"></path>
                </svg>
                Search (Ctrl+K)
              </button>
              <button
                @click="clearSelections"
                style="padding: 10px 16px; background: var(--surface-hover); border: 1px solid var(--border-medium); border-radius: 6px; cursor: pointer;"
              >
                Clear Selections
              </button>
            </div>
          </div>

          <!-- Selected Items -->
          <div v-if="selectedItems.length > 0" style="background: var(--surface-primary); padding: 16px; border-radius: 8px; border: 1px solid var(--border-medium);">
            <h3 style="margin: 0 0 12px 0;">Selected Items ({{ selectedItems.length }})</h3>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div v-for="item in selectedItems" :key="item.id"
                   style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--surface-hover); border-radius: 6px;">
                <div>
                  <div style="font-weight: 500; margin-bottom: 4px;">
                    {{ item.type === 'task' ? '📝' : '📁' }} {{ item.title || item.name }}
                  </div>
                  <div style="font-size: 12px; color: var(--text-muted);">
                    {{ item.type === 'task' ? 'Task' : 'Project' }}
                    <span v-if="item.type === 'task' && item.projectName"> • {{ item.projectName }}</span>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span v-if="item.type === 'task'" :style="{
                    padding: '2px 8px',
                    fontSize: '11px',
                    borderRadius: '4px',
                    background: item.priority === 'high' ? 'var(--danger-bg-subtle)' : item.priority === 'medium' ? 'var(--success-bg-subtle)' : 'var(--blue-bg-subtle)',
                    color: item.priority === 'high' ? 'var(--color-danger)' : item.priority === 'medium' ? 'var(--color-work)' : 'var(--brand-primary)'
                  }">
                    {{ item.priority }}
                  </span>
                  <span style="padding: 2px 8px; font-size: 11px; border-radius: 4px; background: var(--surface-tertiary);">
                    {{ item.status || 'Active' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Instructions -->
          <div style="background: var(--surface-primary); padding: 16px; border-radius: 8px; border: 1px solid var(--border-medium);">
            <h3 style="margin: 0 0 12px 0;">How to Use</h3>
            <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary);">
              <li>Press <kbd style="padding: 2px 6px; background: var(--surface-hover); border-radius: 3px; font-size: 11px;">Ctrl+K</kbd> or click the Search button to open</li>
              <li>Type to search tasks and projects</li>
              <li>Use <kbd style="padding: 2px 6px; background: var(--surface-hover); border-radius: 3px; font-size: 11px;">↑</kbd> <kbd style="padding: 2px 6px; background: var(--surface-hover); border-radius: 3px; font-size: 11px;">↓</kbd> to navigate results</li>
              <li>Press <kbd style="padding: 2px 6px; background: var(--surface-hover); border-radius: 3px; font-size: 11px;">Enter</kbd> to select a result</li>
              <li>Press <kbd style="padding: 2px 6px; background: var(--surface-hover); border-radius: 3px; font-size: 11px;">Esc</kbd> to close</li>
            </ul>
          </div>

          <!-- Available Content -->
          <div style="background: var(--surface-primary); padding: 16px; border-radius: 8px; border: 1px solid var(--border-medium);">
            <h3 style="margin: 0 0 12px 0;">Available Content</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
              <div>
                <h4 style="margin: 0 0 8px 0; font-size: 14px; color: var(--text-secondary);">Tasks ({{ mockTasks.length }})</h4>
                <ul style="margin: 0; padding-left: 20px; color: var(--text-muted); font-size: 13px;">
                  <li v-for="task in mockTasks.slice(0, 3)" :key="task.id">{{ task.title }}</li>
                  <li>...and {{ mockTasks.length - 3 }} more</li>
                </ul>
              </div>
              <div>
                <h4 style="margin: 0 0 8px 0; font-size: 14px; color: var(--text-secondary);">Projects ({{ mockProjects.length }})</h4>
                <ul style="margin: 0; padding-left: 20px; color: var(--text-muted); font-size: 13px;">
                  <li v-for="project in mockProjects" :key="project.id">
                    <span :style="{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: project.color, borderRadius: '2px', marginRight: '4px' }"></span>
                    {{ project.name }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <!-- SearchModal -->
        <SearchModal :is-open="isOpen"
          @close="isOpen = false"
          @select-task="handleSelectTask"
          @select-project="handleSelectProject"
        />
      </div>
    `,
  })
}