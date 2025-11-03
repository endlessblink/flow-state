import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import ProjectTreeItem from '@/components/ProjectTreeItem.vue'

const meta = {
  component: ProjectTreeItem,
  title: '🧩 Components/📝 Form Controls/ProjectTreeItem',
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
      <div style="padding: 40px; min-height: 400px; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Project Tree Item</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Interactive project tree component</p>

        <div style="width: 300px; background: var(--surface-primary); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 16px;">
          <ProjectTreeItem
            :project="project"
            :level="level"
            :is-selected="isSelected"
            :is-expanded="isExpanded"
            @select="handleSelect"
            @toggle="handleToggle"
          />
        </div>

        <div style="margin-top: 24px; padding: 16px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Features</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
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
      const projects = ref([
        {
          id: '1',
          name: 'Website Redesign',
          color: '#3b82f6',
          taskCount: 12,
          completedCount: 8,
          children: [
            {
              id: '1-1',
              name: 'Frontend Development',
              color: '#3b82f6',
              taskCount: 8,
              completedCount: 6,
              children: [
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
              ]
            },
            {
              id: '1-2',
              name: 'Backend API',
              color: '#3b82f6',
              taskCount: 4,
              completedCount: 2,
            }
          ]
        }
      ])

      const expandedItems = ref(new Set(['1', '1-1']))
      const selectedProject = ref('1-1-1')

      const handleSelect = (projectId: string) => {
        selectedProject.value = projectId
      }

      const handleToggle = (projectId: string) => {
        if (expandedItems.value.has(projectId)) {
          expandedItems.value.delete(projectId)
        } else {
          expandedItems.value.add(projectId)
        }
      }

      const renderProjectTree = (projectList: any[], level = 0) => {
        return projectList.map(project => `
          <ProjectTreeItem
            :project="${JSON.stringify(project).replace(/"/g, '&quot;')}"
            :level="${level}"
            :is-selected="${selectedProject.value === project.id}"
            :is-expanded="${expandedItems.value.has(project.id)}"
            @select="handleSelect('${project.id}')"
            @toggle="handleToggle('${project.id}')"
          />
          ${project.children ? renderProjectTree(project.children, level + 1) : ''}
        `).join('')
      }

      return {
        projects,
        expandedItems,
        selectedProject,
        handleSelect,
        handleToggle,
        renderProjectTree,
      }
    },
    template: `
      <div style="padding: 40px; min-height: 500px; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Nested Project Tree</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Multi-level project hierarchy</p>

        <div style="width: 350px; background: var(--surface-primary); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 16px;">
          <div v-html="renderProjectTree(projects)"></div>
        </div>

        <div style="margin-top: 24px; padding: 16px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Project Hierarchy</h4>
          <div style="font-size: 14px; color: var(--text-secondary); line-height: 1.6;">
            <div><strong>Website Redesign</strong> (12 tasks, 8 done)</div>
            <div style="margin-left: 20px;">├── Frontend Development (8 tasks, 6 done)</div>
            <div style="margin-left: 40px;">├── React Components (5 tasks, 4 done) <span style="color: var(--brand-primary);">← Selected</span></div>
            <div style="margin-left: 40px;">└── Styling Updates (3 tasks, 2 done)</div>
            <div style="margin-left: 20px;">└── Backend API (4 tasks, 2 done)</div>
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
      <div style="padding: 40px; min-height: 600px; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Project States</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Different project statuses and progress</p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
          <div style="space-y: 16px;">
            <div
              v-for="project in projectStates"
              :key="project.id"
              style="margin-bottom: 16px;"
            >
              <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold; color: var(--text-primary); text-transform: capitalize;">
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

          <div style="padding: 20px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
            <h4 style="margin: 0 0 16px 0; font-size: 16px; color: var(--text-primary);">State Indicators</h4>
            <div style="font-size: 14px; color: var(--text-secondary); line-height: 1.8;">
              <div><span style="display: inline-block; width: 12px; height: 12px; background: #22c55e; border-radius: 50%; margin-right: 8px;"></span> <strong>Active:</strong> Currently in progress</div>
              <div><span style="display: inline-block; width: 12px; height: 12px; background: #6b7280; border-radius: 50%; margin-right: 8px;"></span> <strong>Completed:</strong> All tasks finished</div>
              <div><span style="display: inline-block; width: 12px; height: 12px; background: #ef4444; border-radius: 50%; margin-right: 8px;"></span> <strong>Delayed:</strong> Behind schedule</div>
              <div><span style="display: inline-block; width: 12px; height: 12px; background: #f59e0b; border-radius: 50%; margin-right: 8px;"></span> <strong>Planning:</strong> Not started yet</div>
            </div>

            <div style="margin-top: 20px; padding: 16px; background: var(--surface-tertiary); border-radius: 8px; border: 1px solid var(--border-subtle);">
              <h5 style="margin: 0 0 8px 0; font-size: 14px; color: var(--text-primary); font-weight: bold;">Progress Calculations</h5>
              <div style="font-size: 13px; color: var(--text-muted); line-height: 1.4;">
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