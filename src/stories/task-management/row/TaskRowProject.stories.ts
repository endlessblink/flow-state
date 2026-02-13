import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import TaskRowProject from '@/components/tasks/row/TaskRowProject.vue'

const meta = {
  title: '📝 Task Management/Row/TaskRowProject',
  component: TaskRowProject,
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    visual: {
      control: 'object',
      description: 'Project visual representation (emoji or css-circle)'
    },
    projectDisplayName: {
      control: 'text'
    },
    currentProjectId: {
      control: 'text'
    }
  }
} satisfies Meta<typeof TaskRowProject>

export default meta
type Story = StoryObj<typeof meta>

export const EmojiVisual: Story = {
  args: {
    visual: { type: 'emoji', content: '🚀' },
    projectDisplayName: 'Rocket Project',
    currentProjectId: 'project-1'
  },
  render: (args) => ({
    components: { TaskRowProject },
    setup() {
      const projectId = ref(args.currentProjectId)
      return { args, projectId }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        min-height: 300px;
      ">
        <TaskRowProject
          :visual="args.visual"
          :project-display-name="args.projectDisplayName"
          :current-project-id="projectId"
          @update:project-id="projectId = $event"
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Emoji project indicator
        </div>
      </div>
    `
  })
}

export const ColorCircleVisual: Story = {
  args: {
    visual: { type: 'css-circle', color: '#3b82f6' },
    projectDisplayName: 'Blue Project',
    currentProjectId: 'project-2'
  },
  render: (args) => ({
    components: { TaskRowProject },
    setup() {
      const projectId = ref(args.currentProjectId)
      return { args, projectId }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        min-height: 300px;
      ">
        <TaskRowProject
          :visual="args.visual"
          :project-display-name="args.projectDisplayName"
          :current-project-id="projectId"
          @update:project-id="projectId = $event"
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Color circle project indicator
        </div>
      </div>
    `
  })
}

export const Uncategorized: Story = {
  args: {
    visual: { type: 'placeholder' },
    projectDisplayName: 'Uncategorized',
    currentProjectId: null
  },
  render: (args) => ({
    components: { TaskRowProject },
    setup() {
      const projectId = ref(args.currentProjectId)
      return { args, projectId }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        min-height: 300px;
      ">
        <TaskRowProject
          :visual="args.visual"
          :project-display-name="args.projectDisplayName"
          :current-project-id="projectId"
          @update:project-id="projectId = $event"
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          No project assigned - shows placeholder
        </div>
      </div>
    `
  })
}

export const MultipleProjects: Story = {
  render: () => ({
    components: { TaskRowProject },
    setup() {
      const projects = ref([
        { id: null, visual: { type: 'placeholder' }, name: 'Uncategorized' },
        { id: 'p1', visual: { type: 'emoji', content: '🚀' }, name: 'Rocket' },
        { id: 'p2', visual: { type: 'emoji', content: '💡' }, name: 'Ideas' },
        { id: 'p3', visual: { type: 'css-circle', color: '#10b981' }, name: 'Green Project' },
        { id: 'p4', visual: { type: 'css-circle', color: '#f59e0b' }, name: 'Orange Project' }
      ])
      const selectedIds = ref([null, 'p1', 'p2', 'p3', 'p4'])

      return { projects, selectedIds }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        display: flex;
        gap: var(--space-4);
        flex-wrap: wrap;
      ">
        <div
          v-for="(project, index) in projects"
          :key="project.id || 'uncategorized'"
          style="
            display: flex;
            flex-direction: column;
            gap: var(--space-2);
            align-items: center;
          "
        >
          <TaskRowProject
            :visual="project.visual"
            :project-display-name="project.name"
            :current-project-id="selectedIds[index]"
            @update:project-id="selectedIds[index] = $event"
          />
          <span style="
            font-size: var(--text-xs);
            color: var(--text-tertiary);
          ">
            {{ project.name }}
          </span>
        </div>
      </div>
    `
  })
}

export const Interactive: Story = {
  args: {
    visual: { type: 'emoji', content: '📝' },
    projectDisplayName: 'Tasks Project',
    currentProjectId: 'project-1'
  },
  render: (args) => ({
    components: { TaskRowProject },
    setup() {
      const projectId = ref(args.currentProjectId)
      return { args, projectId }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        min-height: 300px;
      ">
        <TaskRowProject
          :visual="args.visual"
          :project-display-name="args.projectDisplayName"
          :current-project-id="projectId"
          @update:project-id="projectId = $event"
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Selected Project ID: {{ projectId || 'None' }}
        </div>
        <div style="
          margin-top: var(--space-2);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Click to open project selector dropdown
        </div>
      </div>
    `
  })
}
