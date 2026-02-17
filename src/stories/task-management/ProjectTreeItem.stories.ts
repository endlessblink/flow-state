import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import ProjectTreeItem from '@/components/projects/ProjectTreeItem.vue'

const meta = {
  component: ProjectTreeItem,
  title: '📝 Task Management/ProjectTreeItem',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
    docs: {
      story: {
        height: '500px',
      },
    },
  },

  argTypes: {
    project: {
      control: 'object',
      description: 'Project data object',
    },
    level: {
      control: 'number',
      description: 'Nesting level in tree',
    },
    isSelected: {
      control: 'boolean',
      description: 'Whether the project is selected',
    },
    isExpanded: {
      control: 'boolean',
      description: 'Whether the project is expanded (has children)',
    },
  },
} satisfies Meta<typeof ProjectTreeItem>

export default meta
type Story = StoryObj<typeof meta>

// Basic project item
export const Default: Story = {
  args: {
    project: {
      id: '1',
      name: 'Website Redesign',
      color: '#3b82f6',
      taskCount: 12,
      completedCount: 8,
    },
    level: 0,
    isSelected: false,
    isExpanded: false,
  },
  render: (args) => ({
    components: { ProjectTreeItem },
    setup() {
      const project = ref(args.project)
      const level = ref(args.level)
      const isSelected = ref(args.isSelected)
      const isExpanded = ref(args.isExpanded)

      const handleSelect = () => {
        isSelected.value = !isSelected.value
      }

      const handleToggle = () => {
        isExpanded.value = !isExpanded.value
      }

      return {
        project,
        level,
        isSelected,
        isExpanded,
        handleSelect,
        handleToggle,
      }
    },
    template: `
      <div style="padding: var(--space-10); min-height: 400px; background: var(--app-background-gradient);">
        <h3 style="margin: 0 0 var(--space-4) 0; font-size: 18px; color: var(--text-primary);">Project Tree Item</h3>
        <p style="margin: 0 0 var(--space-6) 0; color: var(--text-secondary);">Interactive project tree component</p>

        <div style="width: 300px; background: var(--glass-bg-subtle); border: 1px solid var(--glass-border); border-radius: var(--radius-xl); padding: var(--space-4);">
          <ProjectTreeItem
            :project="project"
            :level="level"
            :is-selected="isSelected"
            :is-expanded="isExpanded"
            @select="handleSelect"
            @toggle="handleToggle"
          />
        </div>

        <div style="margin-top: var(--space-6); padding: var(--space-4); background: var(--glass-bg-subtle); border-radius: var(--radius-xl); border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 var(--space-3) 0; font-size: var(--text-base); color: var(--text-primary);">Features</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.6;">
            <li><strong>Visual hierarchy</strong> - Indentation based on nesting level</li>
            <li><strong>Progress tracking</strong> - Shows task completion status</li>
            <li><strong>Color coding</strong> - Custom project colors</li>
            <li><strong>Expandable</strong> - Show/hide subprojects</li>
            <li><strong>Interactive</strong> - Click to select, toggle to expand</li>
            <li><strong>Task counts</strong> - Total and completed tasks</li>
          </ul>
        </div>
      </div>
    `,
  })
}

// Nested projects
export const NestedProjects: Story = {
  render: () => ({
    components: { ProjectTreeItem },
    setup() {
      // Flat list of projects for easier rendering
      const rootProject = ref({
        id: '1',
        name: 'Website Redesign',
        color: '#3b82f6',
        taskCount: 12,
        completedCount: 8,
      })

      const level1Projects = ref([
        {
          id: '1-1',
          name: 'Frontend Development',
          color: '#3b82f6',
          taskCount: 8,
          completedCount: 6,
        },
        {
          id: '1-2',
          name: 'Backend API',
          color: '#3b82f6',
          taskCount: 4,
          completedCount: 2,
        }
      ])

      const level2Projects = ref([
        {
          id: '1-1-1',
          name: 'React Components',
          color: '#3b82f6',
          taskCount: 5,
          completedCount: 4,
        },
        {
          id: '1-1-2',
          name: 'Styling Updates',
          color: '#3b82f6',
          taskCount: 3,
          completedCount: 2,
        }
      ])

      const expandedItems = ref(['1', '1-1'])
      const selectedProject = ref('1-1-1')

      const isExpanded = (id: string) => expandedItems.value.includes(id)
      const isSelected = (id: string) => selectedProject.value === id

      const handleSelect = (id: string) => {
        selectedProject.value = id
      }

      const handleToggle = (id: string) => {
        const index = expandedItems.value.indexOf(id)
        if (index > -1) {
          expandedItems.value.splice(index, 1)
        } else {
          expandedItems.value.push(id)
        }
      }

      return {
        rootProject,
        level1Projects,
        level2Projects,
        expandedItems,
        selectedProject,
        isExpanded,
        isSelected,
        handleSelect,
        handleToggle,
      }
    },
    template: `
      <div style="padding: var(--space-10); min-height: 500px; background: var(--app-background-gradient);">
        <h3 style="margin: 0 0 var(--space-4) 0; font-size: 18px; color: var(--text-primary);">Nested Project Tree</h3>
        <p style="margin: 0 0 var(--space-6) 0; color: var(--text-secondary);">Multi-level project hierarchy</p>

        <div style="width: 350px; background: var(--glass-bg-subtle); border: 1px solid var(--glass-border); border-radius: var(--radius-xl); padding: var(--space-4);">
          <!-- Root level -->
          <ProjectTreeItem
            :project="rootProject"
            :level="0"
            :is-selected="isSelected('1')"
            :is-expanded="isExpanded('1')"
            @select="handleSelect('1')"
            @toggle="handleToggle('1')"
          />

          <!-- Level 1 (shown when root expanded) -->
          <div v-if="isExpanded('1')" style="margin-left: var(--space-4);">
            <ProjectTreeItem
              :project="level1Projects[0]"
              :level="1"
              :is-selected="isSelected('1-1')"
              :is-expanded="isExpanded('1-1')"
              @select="handleSelect('1-1')"
              @toggle="handleToggle('1-1')"
            />

            <!-- Level 2 (shown when Frontend expanded) -->
            <div v-if="isExpanded('1-1')" style="margin-left: var(--space-4);">
              <ProjectTreeItem
                v-for="project in level2Projects"
                :key="project.id"
                :project="project"
                :level="2"
                :is-selected="isSelected(project.id)"
                :is-expanded="false"
                @select="handleSelect(project.id)"
              />
            </div>

            <ProjectTreeItem
              :project="level1Projects[1]"
              :level="1"
              :is-selected="isSelected('1-2')"
              :is-expanded="false"
              @select="handleSelect('1-2')"
            />
          </div>
        </div>

        <div style="margin-top: var(--space-6); padding: var(--space-4); background: var(--glass-bg-subtle); border-radius: var(--radius-xl); border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 var(--space-3) 0; font-size: var(--text-base); color: var(--text-primary);">Project Hierarchy</h4>
          <div style="font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.6;">
            <div><strong>Website Redesign</strong> (12 tasks, 8 done)</div>
            <div style="margin-left: var(--space-5);">├── Frontend Development (8 tasks, 6 done)</div>
            <div style="margin-left: var(--space-10);">├── React Components (5 tasks, 4 done) <span style="color: rgba(78, 205, 196, 1);">← Selected</span></div>
            <div style="margin-left: var(--space-10);">└── Styling Updates (3 tasks, 2 done)</div>
            <div style="margin-left: var(--space-5);">└── Backend API (4 tasks, 2 done)</div>
          </div>
        </div>
      </div>
    `,
  })
}

// Different project states
export const ProjectStates: Story = {
  render: () => ({
    components: { ProjectTreeItem },
    setup() {
      const projectStates = ref([
        {
          id: 'active',
          name: 'Active Project',
          color: '#22c55e',
          taskCount: 15,
          completedCount: 10,
          status: 'active'
        },
        {
          id: 'completed',
          name: 'Completed Project',
          color: '#6b7280',
          taskCount: 8,
          completedCount: 8,
          status: 'completed'
        },
        {
          id: 'delayed',
          name: 'Delayed Project',
          color: '#ef4444',
          taskCount: 20,
          completedCount: 5,
          status: 'delayed'
        },
        {
          id: 'planning',
          name: 'Planning Phase',
          color: '#f59e0b',
          taskCount: 0,
          completedCount: 0,
          status: 'planning'
        }
      ])

      return { projectStates }
    },
    template: `
      <div style="padding: var(--space-10); min-height: 600px; background: var(--app-background-gradient);">
        <h3 style="margin: 0 0 var(--space-4) 0; font-size: 18px; color: var(--text-primary);">Project States</h3>
        <p style="margin: 0 0 var(--space-6) 0; color: var(--text-secondary);">Different project statuses and progress</p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-6);">
          <div style="space-y: 16px;">
            <div
              v-for="project in projectStates"
              :key="project.id"
              style="margin-bottom: var(--space-4);"
            >
              <h4 style="margin: 0 0 var(--space-2) 0; font-size: var(--text-sm); font-weight: bold; color: var(--text-primary); text-transform: capitalize;">
                {{ project.status }}
              </h4>
              <ProjectTreeItem
                :project="project"
                :level="0"
                :is-selected="false"
                :is-expanded="false"
              />
            </div>
          </div>

          <div style="padding: var(--space-5); background: var(--glass-bg-subtle); border-radius: var(--radius-xl); border: 1px solid var(--glass-border);">
            <h4 style="margin: 0 0 var(--space-4) 0; font-size: var(--text-base); color: var(--text-primary);">State Indicators</h4>
            <div style="font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.8;">
              <div><span style="display: inline-block; width: 12px; height: 12px; background: var(--color-success); border-radius: var(--radius-full); margin-right: var(--space-2);"></span> <strong>Active:</strong> Currently in progress</div>
              <div><span style="display: inline-block; width: 12px; height: 12px; background: var(--text-muted); border-radius: var(--radius-full); margin-right: var(--space-2);"></span> <strong>Completed:</strong> All tasks finished</div>
              <div><span style="display: inline-block; width: 12px; height: 12px; background: var(--color-danger); border-radius: var(--radius-full); margin-right: var(--space-2);"></span> <strong>Delayed:</strong> Behind schedule</div>
              <div><span style="display: inline-block; width: 12px; height: 12px; background: var(--color-warning); border-radius: var(--radius-full); margin-right: var(--space-2);"></span> <strong>Planning:</strong> Not started yet</div>
            </div>

            <div style="margin-top: var(--space-5); padding: var(--space-4); background: var(--glass-bg-subtle); border-radius: var(--radius-lg); border: 1px solid var(--glass-border);">
              <h5 style="margin: 0 0 var(--space-2) 0; font-size: var(--text-sm); color: var(--text-primary); font-weight: bold;">Progress Calculations</h5>
              <div style="font-size: var(--text-sm); color: var(--text-muted); line-height: 1.4;">
                • Progress bars show completion percentage<br>
                • Color coding indicates project health<br>
                • Task counts update in real-time<br>
                • Zero tasks handled gracefully
              </div>
            </div>
          </div>
        </div>
      </div>
    `,
  })
}
