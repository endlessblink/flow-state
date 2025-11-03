import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import ViewControls from '@/components/ViewControls.vue'

const meta = {
  component: ViewControls,
  title: '🧩 Components/🔧 UI/ViewControls',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Comprehensive view controls for managing table/list display, density, sorting, and filtering with intuitive UI controls.'
      }
    }
  },

  argTypes: {
    viewType: {
      control: 'select',
      options: ['table', 'list'],
      description: 'Current view type',
    },
    density: {
      control: 'select',
      options: ['compact', 'comfortable', 'spacious'],
      description: 'Table density setting',
    },
    sortBy: {
      control: 'select',
      options: ['dueDate', 'priority', 'title', 'created'],
      description: 'Current sort option',
    },
    filterStatus: {
      control: 'select',
      options: ['all', 'planned', 'in_progress', 'done'],
      description: 'Current filter status',
    },
  },
} satisfies Meta<typeof ViewControls>

export default meta
type Story = StoryObj<typeof meta>

// Default table view
export const Default: Story = {
  args: {
    viewType: 'table',
    density: 'comfortable',
    sortBy: 'dueDate',
    filterStatus: 'all',
  },
  render: (args) => ({
    components: { ViewControls },
    setup() {
      const viewType = ref(args.viewType)
      const density = ref(args.density)
      const sortBy = ref(args.sortBy)
      const filterStatus = ref(args.filterStatus)

      const handleUpdateViewType = (value: string) => {
        viewType.value = value
        console.log('View type changed to:', value)
      }

      const handleUpdateDensity = (value: string) => {
        density.value = value
        console.log('Density changed to:', value)
      }

      const handleUpdateSortBy = (value: string) => {
        sortBy.value = value
        console.log('Sort by changed to:', value)
      }

      const handleUpdateFilterStatus = (value: string) => {
        filterStatus.value = value
        console.log('Filter status changed to:', value)
      }

      const handleExpandAll = () => {
        console.log('Expand all clicked')
      }

      const handleCollapseAll = () => {
        console.log('Collapse all clicked')
      }

      return {
        viewType,
        density,
        sortBy,
        filterStatus,
        handleUpdateViewType,
        handleUpdateDensity,
        handleUpdateSortBy,
        handleUpdateFilterStatus,
        handleExpandAll,
        handleCollapseAll,
      }
    },
    template: `
      <div style="padding: 40px; background: var(--surface-secondary); max-width: 800px;">
        <ViewControls
          :view-type="viewType"
          :density="density"
          :sort-by="sortBy"
          :filter-status="filterStatus"
          @update:view-type="handleUpdateViewType"
          @update:density="handleUpdateDensity"
          @update:sort-by="handleUpdateSortBy"
          @update:filter-status="handleUpdateFilterStatus"
          @expand-all="handleExpandAll"
          @collapse-all="handleCollapseAll"
        />
      </div>
    `,
  }),
}

// List view mode
export const ListViewMode: Story = {
  args: {
    viewType: 'list',
    density: 'comfortable',
    sortBy: 'priority',
    filterStatus: 'in_progress',
  },
  render: (args) => ({
    components: { ViewControls },
    setup() {
      const viewType = ref(args.viewType)
      const density = ref(args.density)
      const sortBy = ref(args.sortBy)
      const filterStatus = ref(args.filterStatus)

      const handleUpdateViewType = (value: string) => {
        viewType.value = value
      }

      const handleUpdateDensity = (value: string) => {
        density.value = value
      }

      const handleUpdateSortBy = (value: string) => {
        sortBy.value = value
      }

      const handleUpdateFilterStatus = (value: string) => {
        filterStatus.value = value
      }

      const handleExpandAll = () => {
        console.log('Expand all list items')
      }

      const handleCollapseAll = () => {
        console.log('Collapse all list items')
      }

      return {
        viewType,
        density,
        sortBy,
        filterStatus,
        handleUpdateViewType,
        handleUpdateDensity,
        handleUpdateSortBy,
        handleUpdateFilterStatus,
        handleExpandAll,
        handleCollapseAll,
      }
    },
    template: `
      <div style="padding: 40px; background: var(--surface-secondary); max-width: 800px;">
        <div style="margin-bottom: 24px; padding: 16px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 8px 0; font-size: 16px; color: var(--text-primary);">List View Mode</h4>
          <p style="margin: 0; font-size: 14px; color: var(--text-secondary);">
            In list view, you can expand/collapse all items and manage hierarchical display.
          </p>
        </div>

        <ViewControls
          :view-type="viewType"
          :density="density"
          :sort-by="sortBy"
          :filter-status="filterStatus"
          @update:view-type="handleUpdateViewType"
          @update:density="handleUpdateDensity"
          @update:sort-by="handleUpdateSortBy"
          @update:filter-status="handleUpdateFilterStatus"
          @expand-all="handleExpandAll"
          @collapse-all="handleCollapseAll"
        />
      </div>
    `,
  }),
}

// Density variations
export const DensityVariations: Story = {
  render: () => ({
    components: { ViewControls },
    setup() {
      const currentViewType = ref('table')
      const currentDensity = ref('comfortable')
      const sortBy = ref('dueDate')
      const filterStatus = ref('all')

      const densityOptions = [
        { value: 'compact', label: 'Compact', description: 'Maximum information density' },
        { value: 'comfortable', label: 'Comfortable', description: 'Balanced spacing' },
        { value: 'spacious', label: 'Spacious', description: 'Generous spacing' }
      ]

      return {
        currentViewType,
        currentDensity,
        sortBy,
        filterStatus,
        densityOptions,
      }
    },
    template: `
      <div style="padding: 40px; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 24px 0; font-size: 18px; color: var(--text-primary);">Density Variations</h3>

        <div style="display: grid; gap: 24px;">
          <div
            v-for="option in densityOptions"
            :key="option.value"
            style="padding: 24px; background: var(--surface-primary); border-radius: 12px; border: 1px solid var(--border-subtle);"
          >
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h4 style="margin: 0; font-size: 16px; color: var(--text-primary);">{{ option.label }}</h4>
              <span
                :style="{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '500',
                  background: currentDensity === option.value ? 'var(--color-primary)' : 'var(--surface-tertiary)',
                  color: currentDensity === option.value ? 'white' : 'var(--text-secondary)'
                }"
              >
                {{ option.value }}
              </span>
            </div>

            <div style="margin-bottom: 20px;">
              <ViewControls
                :view-type="currentViewType"
                :density="currentDensity"
                :sort-by="sortBy"
                :filter-status="filterStatus"
                @update:view-type="currentViewType = $event"
                @update:density="currentDensity = $event"
                @update:sort-by="sortBy = $event"
                @update:filter-status="filterStatus = $event"
              />
            </div>

            <div style="font-size: 14px; color: var(--text-secondary);">
              {{ option.description }}
            </div>
          </div>
        </div>

        <div style="margin-top: 24px; padding: 20px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Density Comparison</h4>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; font-size: 14px; color: var(--text-secondary);">
            <div>
              <strong>Compact:</strong><br>
              • Max information density<br>
              • Minimal spacing<br>
              • Ideal for large datasets
            </div>
            <div>
              <strong>Comfortable:</strong><br>
              • Balanced layout<br>
              • Standard spacing<br>
              • Most versatile option
            </div>
            <div>
              <strong>Spacious:</strong><br>
              • Extra padding<br>
              • Easy to read<br>
              • Best for accessibility
            </div>
          </div>
        </div>
      </div>
    `,
  }),
}

// Interactive demo
export const InteractiveDemo: Story = {
  render: () => ({
    components: { ViewControls },
    setup() {
      const viewType = ref('table')
      const density = ref('comfortable')
      const sortBy = ref('dueDate')
      const filterStatus = ref('all')

      // Simulated task data
      const tasks = ref([
        { id: 1, title: 'Complete project documentation', priority: 'high', status: 'in_progress', dueDate: '2024-12-20' },
        { id: 2, title: 'Review pull request', priority: 'medium', status: 'planned', dueDate: '2024-12-18' },
        { id: 3, title: 'Fix navigation bug', priority: 'high', status: 'done', dueDate: '2024-12-15' },
        { id: 4, title: 'Write unit tests', priority: 'low', status: 'planned', dueDate: '2024-12-22' },
        { id: 5, title: 'Deploy to production', priority: 'high', status: 'in_progress', dueDate: '2024-12-21' },
      ])

      const filteredTasks = computed(() => {
        if (filterStatus.value === 'all') return tasks.value
        return tasks.value.filter(task => task.status === filterStatus.value)
      })

      const sortedTasks = computed(() => {
        return [...filteredTasks.value].sort((a, b) => {
          switch (sortBy.value) {
            case 'dueDate':
              return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
            case 'priority':
              const priorityOrder = { high: 3, medium: 2, low: 1 }
              return priorityOrder[b.priority] - priorityOrder[a.priority]
            case 'title':
              return a.title.localeCompare(b.title)
            case 'created':
              return new Date('2024-12-01').getTime() - new Date('2024-12-01').getTime()
            default:
              return 0
          }
        })
      })

      const handleUpdateViewType = (value: string) => {
        viewType.value = value
        console.log(`Switched to ${value} view`)
      }

      const handleUpdateDensity = (value: string) => {
        density.value = value
        console.log(`Changed density to ${value}`)
      }

      const handleUpdateSortBy = (value: string) => {
        sortBy.value = value
        console.log(`Sorted by ${value}`)
      }

      const handleUpdateFilterStatus = (value: string) => {
        filterStatus.value = value
        console.log(`Filtered by ${value}`)
      }

      const handleExpandAll = () => {
        console.log('Expanded all items (list view)')
      }

      const handleCollapseAll = () => {
        console.log('Collapsed all items (list view)')
      }

      return {
        viewType,
        density,
        sortBy,
        filterStatus,
        tasks,
        filteredTasks,
        sortedTasks,
        handleUpdateViewType,
        handleUpdateDensity,
        handleUpdateSortBy,
        handleUpdateFilterStatus,
        handleExpandAll,
        handleCollapseAll,
      }
    },
    template: `
      <div style="padding: 40px; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 24px 0; font-size: 20px; color: var(--text-primary);">Interactive View Controls Demo</h3>

        <div style="margin-bottom: 24px; padding: 16px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h4 style="margin: 0 0 4px 0; font-size: 16px; color: var(--text-primary);">Statistics</h4>
              <p style="margin: 0; font-size: 14px; color: var(--text-secondary);">
                {{ filteredTasks.length }} / {{ tasks.length }} tasks shown
              </p>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">Current Settings</div>
              <div style="font-size: 13px; color: var(--text-secondary);">
                View: {{ viewType }}<br>
                Density: {{ density }}<br>
                Sort: {{ sortBy }}<br>
                Filter: {{ filterStatus }}
              </div>
            </div>
          </div>
        </div>

        <ViewControls
          :view-type="viewType"
          :density="density"
          :sort-by="sortBy"
          :filter-status="filterStatus"
          @update:view-type="handleUpdateViewType"
          @update:density="handleUpdateDensity"
          @update:sort-by="handleUpdateSortBy"
          @update:filter-status="handleUpdateFilterStatus"
          @expand-all="handleExpandAll"
          @collapse-all="handleCollapseAll"
        />

        <div style="margin-top: 24px;">
          <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Task List Preview</h4>
          <div :style="{
            background: 'var(--surface-primary)',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)',
            overflow: 'hidden'
          }">
            <div style="display: grid; grid-template-columns: auto auto auto auto; gap: 1px; background: var(--border-subtle); font-size: 14px; color: var(--text-secondary);">
              <div style="padding: 12px; font-weight: 500;">Title</div>
              <div style="padding: 12px; font-weight: 500;">Priority</div>
              <div style="padding: 12px; font-weight: 500;">Status</div>
              <div style="padding: 12px; font-weight: 500;">Due Date</div>
            </div>

            <div
              v-for="task in sortedTasks"
              :key="task.id"
              style="display: grid; grid-template-columns: auto auto auto auto; gap: 1px; background: var(--surface-primary);"
              :style="{
                padding: density === 'compact' ? '8px 12px' : density === 'spacious' ? '16px 20px' : '12px 16px',
                fontSize: density === 'compact' ? '13px' : '14px'
              }"
            >
              <div style="color: var(--text-primary);">{{ task.title }}</div>
              <div>
                <span
                  :style="{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '500',
                    background: task.priority === 'high' ? '#fef2f2' : task.priority === 'medium' ? '#fffbeb' : '#eff6ff',
                    color: task.priority === 'high' ? '#dc2626' : task.priority === 'medium' ? '#d97706' : '#2563eb',
                  }"
                >
                  {{ task.priority }}
                </span>
              </div>
              <div>
                <span
                  :style="{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '500',
                    background: task.status === 'done' ? '#f0fdf4' : task.status === 'in_progress' ? '#fffbeb' : '#f9fafb',
                    color: task.status === 'done' ? '#166534' : task.status === 'in_progress' ? '#d97706' : '#6b7280',
                  }"
                >
                  {{ task.status }}
                </span>
              </div>
              <div style="color: var(--text-secondary);">{{ task.dueDate }}</div>
            </div>
          </div>
        </div>
      </div>
    `,
  }),
}

// All controls showcase
export const AllControlsShowcase: Story = {
  render: () => ({
    components: { ViewControls },
    setup() {
      const allControls = ref([
        {
          viewType: 'table',
          density: 'compact',
          sortBy: 'priority',
          filterStatus: 'all',
          label: 'Compact Table',
          description: 'Dense table with priority sorting'
        },
        {
          viewType: 'table',
          density: 'spacious',
          sortBy: 'dueDate',
          filterStatus: 'in_progress',
          label: 'Spacious Table',
          description: 'Roomy table with date sorting'
        },
        {
          viewType: 'list',
          density: 'comfortable',
          sortBy: 'title',
          filterStatus: 'done',
          label: 'List View',
          description: 'Hierarchical list with alphabetical sorting'
        },
      ])

      return {
        allControls,
      }
    },
    template: `
      <div style="padding: 40px; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 24px 0; font-size: 18px; color: var(--text-primary);">All Controls Showcase</h3>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px;">
          <div
            v-for="control in allControls"
            :key="control.label"
            style="padding: 24px; background: var(--surface-primary); border-radius: 12px; border: 1px solid var(--border-subtle);"
          >
            <div style="margin-bottom: 16px;">
              <h4 style="margin: 0 0 4px 0; font-size: 16px; color: var(--text-primary);">{{ control.label }}</h4>
              <p style="margin: 0; font-size: 13px; color: var(--text-secondary);">{{ control.description }}</p>
            </div>

            <ViewControls
              :view-type="control.viewType"
              :density="control.density"
              :sort-by="control.sortBy"
              :filter-status="control.filterStatus"
              @update:view-type="control.viewType = $event"
              @update:density="control.density = $event"
              @update:sort-by="control.sortBy = $event"
              @update:filter-status="control.filterStatus = $event"
              @expand-all="() => console.log('Expand all')"
              @collapse-all="() => console.log('Collapse all')"
            />
          </div>
        </div>

        <div style="margin-top: 32px; padding: 20px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 12px 0; font_size: 16px; color: var(--text-primary);">Control Categories</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; font-size: 14px; color: var(--text-secondary);">
            <div>
              <strong>View Controls:</strong><br>
              • Table/List toggle<br>
              • Density settings (table)<br>
              • Expand/Collapse (list)
            </div>
            <div>
              <strong>Data Controls:</strong><br>
              • Sort by multiple fields<br>
              • Filter by status<br>
              • Real-time updates
            </div>
            <div>
              <strong>Accessibility:</strong><br>
              • Clear visual indicators<br>
              • Keyboard navigation<br>
              • Screen reader support
            </div>
          </div>
        </div>
      </div>
    `,
  }),
}