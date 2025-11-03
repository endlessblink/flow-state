import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import SectionNodeSimple from '@/components/canvas/SectionNodeSimple.vue'

const meta = {
  component: SectionNodeSimple,
  title: '✨ Features/🎨 Canvas View/SectionNodeSimple',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
    docs: {
      story: {
        height: '300px',
      },
    },
  },

  argTypes: {
    data: {
      control: 'object',
      description: 'Section data object with id, name, color, taskCount, and type',
    },
  },
} satisfies Meta<typeof SectionNodeSimple>

export default meta
type Story = StoryObj<typeof meta>

// Default section node
export const Default: Story = {
  args: {
    data: {
      id: 'section-1',
      name: 'Important Tasks',
      color: '#3b82f6',
      taskCount: 5,
      type: 'custom',
    },
  },
  render: (args) => ({
    components: { SectionNodeSimple },
    setup() {
      const sectionData = ref(args.data)

      const handleUpdate = (updates: any) => {
        Object.assign(sectionData.value, updates)
      }

      const handleCollect = (sectionId: string) => {
        console.log('Collect triggered for section:', sectionId)
      }

      const handleContextMenu = (event: MouseEvent, section: any) => {
        console.log('Context menu requested for section:', section)
      }

      return {
        sectionData,
        handleUpdate,
        handleCollect,
        handleContextMenu,
      }
    },
    template: `
      <div style="width: 300px; height: 200px; padding: 20px; background: var(--surface-secondary);">
        <SectionNodeSimple
          :data="sectionData"
          @update="handleUpdate"
          @collect="handleCollect"
          @context-menu="handleContextMenu"
        />
      </div>
    `,
  }),
}

// Priority section with auto-collect
export const PrioritySection: Story = {
  args: {
    data: {
      id: 'section-priority',
      name: 'High Priority',
      color: '#ef4444',
      taskCount: 12,
      type: 'priority',
      propertyValue: 'high',
    },
  },
  render: (args) => ({
    components: { SectionNodeSimple },
    setup() {
      const sectionData = ref(args.data)

      const handleUpdate = (updates: any) => {
        Object.assign(sectionData.value, updates)
      }

      const handleCollect = (sectionId: string) => {
        console.log('Auto-collect triggered for priority section:', sectionId)
      }

      const handleContextMenu = (event: MouseEvent, section: any) => {
        console.log('Context menu requested for priority section:', section)
      }

      return {
        sectionData,
        handleUpdate,
        handleCollect,
        handleContextMenu,
      }
    },
    template: `
      <div style="width: 300px; height: 200px; padding: 20px; background: var(--surface-secondary);">
        <div style="margin-bottom: 16px; font-size: 14px; color: var(--text-secondary);">
          <strong>Priority Section</strong> - Auto-collects high-priority tasks
        </div>
        <SectionNodeSimple
          :data="sectionData"
          @update="handleUpdate"
          @collect="handleCollect"
          @context-menu="handleContextMenu"
        />
      </div>
    `,
  }),
}

// Status section with tasks
export const StatusSection: Story = {
  args: {
    data: {
      id: 'section-status',
      name: 'In Progress',
      color: '#f59e0b',
      taskCount: 8,
      type: 'status',
      propertyValue: 'in_progress',
    },
  },
  render: (args) => ({
    components: { SectionNodeSimple },
    setup() {
      const sectionData = ref(args.data)

      const handleUpdate = (updates: any) => {
        Object.assign(sectionData.value, updates)
      }

      const handleCollect = (sectionId: string) => {
        console.log('Auto-collect triggered for status section:', sectionId)
      }

      const handleContextMenu = (event: MouseEvent, section: any) => {
        console.log('Context menu requested for status section:', section)
      }

      return {
        sectionData,
        handleUpdate,
        handleCollect,
        handleContextMenu,
      }
    },
    template: `
      <div style="width: 300px; height: 200px; padding: 20px; background: var(--surface-secondary);">
        <div style="margin-bottom: 16px; font-size: 14px; color: var(--text-secondary);">
          <strong>Status Section</strong> - Groups tasks by status
        </div>
        <SectionNodeSimple
          :data="sectionData"
          @update="handleUpdate"
          @collect="handleCollect"
          @context-menu="handleContextMenu"
        />
      </div>
    `,
  }),
}

// Project section
export const ProjectSection: Story = {
  args: {
    data: {
      id: 'section-project',
      name: 'Website Redesign',
      color: '#22c55e',
      taskCount: 15,
      type: 'project',
      propertyValue: 'project-1',
    },
  },
  render: (args) => ({
    components: { SectionNodeSimple },
    setup() {
      const sectionData = ref(args.data)

      const handleUpdate = (updates: any) => {
        Object.assign(sectionData.value, updates)
      }

      const handleCollect = (sectionId: string) => {
        console.log('Auto-collect triggered for project section:', sectionId)
      }

      const handleContextMenu = (event: MouseEvent, section: any) => {
        console.log('Context menu requested for project section:', section)
      }

      return {
        sectionData,
        handleUpdate,
        handleCollect,
        handleContextMenu,
      }
    },
    template: `
      <div style="width: 300px; height: 200px; padding: 20px; background: var(--surface-secondary);">
        <div style="margin-bottom: 16px; font-size: 14px; color: var(--text-secondary);">
          <strong>Project Section</strong> - Organizes tasks by project
        </div>
        <SectionNodeSimple
          :data="sectionData"
          @update="handleUpdate"
          @collect="handleCollect"
          @context-menu="handleContextMenu"
        />
      </div>
    `,
  }),
}

// Timeline section
export const TimelineSection: Story = {
  args: {
    data: {
      id: 'section-timeline',
      name: 'This Week',
      color: '#8b5cf6',
      taskCount: 7,
      type: 'timeline',
      propertyValue: 'this-week',
    },
  },
  render: (args) => ({
    components: { SectionNodeSimple },
    setup() {
      const sectionData = ref(args.data)

      const handleUpdate = (updates: any) => {
        Object.assign(sectionData.value, updates)
      }

      const handleCollect = (sectionId: string) => {
        console.log('Auto-collect triggered for timeline section:', sectionId)
      }

      const handleContextMenu = (event: MouseEvent, section: any) => {
        console.log('Context menu requested for timeline section:', section)
      }

      return {
        sectionData,
        handleUpdate,
        handleCollect,
        handleContextMenu,
      }
    },
    template: `
      <div style="width: 300px; height: 200px; padding: 20px; background: var(--surface-secondary);">
        <div style="margin-bottom: 16px; font-size: 14px; color: var(--text-secondary);">
          <strong>Timeline Section</strong> - Groups tasks by schedule
        </div>
        <SectionNodeSimple
          :data="sectionData"
          @update="handleUpdate"
          @collect="handleCollect"
          @context-menu="handleContextMenu"
        />
      </div>
    `,
  }),
}

// Empty section
export const EmptySection: Story = {
  args: {
    data: {
      id: 'section-empty',
      name: 'New Section',
      color: '#6b7280',
      taskCount: 0,
      type: 'custom',
    },
  },
  render: (args) => ({
    components: { SectionNodeSimple },
    setup() {
      const sectionData = ref(args.data)

      const handleUpdate = (updates: any) => {
        Object.assign(sectionData.value, updates)
      }

      const handleCollect = (sectionId: string) => {
        console.log('Collect triggered for empty section:', sectionId)
      }

      const handleContextMenu = (event: MouseEvent, section: any) => {
        console.log('Context menu requested for empty section:', section)
      }

      return {
        sectionData,
        handleUpdate,
        handleCollect,
        handleContextMenu,
      }
    },
    template: `
      <div style="width: 300px; height: 200px; padding: 20px; background: var(--surface-secondary);">
        <div style="margin-bottom: 16px; font-size: 14px; color: var(--text-secondary);">
          <strong>Empty Section</strong> - Ready for task organization
        </div>
        <SectionNodeSimple
          :data="sectionData"
          @update="handleUpdate"
          @collect="handleCollect"
          @context-menu="handleContextMenu"
        />
      </div>
    `,
  }),
}

// All section types showcase
export const AllSectionTypes: Story = {
  render: () => ({
    components: { SectionNodeSimple },
    setup() {
      const sections = ref([
        {
          id: 'priority',
          name: 'Priority',
          color: '#ef4444',
          taskCount: 3,
          type: 'priority' as const,
        },
        {
          id: 'status',
          name: 'Status',
          color: '#f59e0b',
          taskCount: 5,
          type: 'status' as const,
        },
        {
          id: 'project',
          name: 'Project',
          color: '#22c55e',
          taskCount: 8,
          type: 'project' as const,
        },
        {
          id: 'timeline',
          name: 'Timeline',
          color: '#8b5cf6',
          taskCount: 2,
          type: 'timeline' as const,
        },
        {
          id: 'custom',
          name: 'Custom',
          color: '#6b7280',
          taskCount: 0,
          type: 'custom' as const,
        },
      ])

      const handleUpdate = (sectionId: string, updates: any) => {
        const section = sections.value.find(s => s.id === sectionId)
        if (section) {
          Object.assign(section, updates)
        }
      }

      const handleCollect = (sectionId: string) => {
        console.log('Collect triggered for section:', sectionId)
      }

      const handleContextMenu = (event: MouseEvent, section: any) => {
        console.log('Context menu requested for section:', section)
      }

      return {
        sections,
        handleUpdate,
        handleCollect,
        handleContextMenu,
      }
    },
    template: `
      <div style="padding: 40px; min-height: 600px; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 24px 0; font-size: 20px; color: var(--text-primary);">Section Node Types</h3>
        <p style="margin: 0 0 32px 0; color: var(--text-secondary);">Different section types with auto-collect capabilities</p>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
          <div
            v-for="section in sections"
            :key="section.id"
            style="background: var(--surface-primary); border-radius: 12px; padding: 20px;"
          >
            <div style="margin-bottom: 16px;">
              <h4 style="margin: 0 0 4px 0; font-size: 16px; color: var(--text-primary); text-transform: capitalize;">
                {{ section.type }} Section
              </h4>
              <p style="margin: 0; font-size: 13px; color: var(--text-muted);">
                {{ section.taskCount }} tasks • Auto-collect enabled
              </p>
            </div>

            <div style="height: 120px; position: relative;">
              <SectionNodeSimple
                :data="section"
                @update="(updates) => handleUpdate(section.id, updates)"
                @collect="handleCollect"
                @context-menu="handleContextMenu"
              />
            </div>
          </div>
        </div>

        <div style="margin-top: 32px; padding: 20px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Section Features</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            <li><strong>Priority Sections</strong> - Auto-assign task priorities (🏳️)</li>
            <li><strong>Status Sections</strong> - Auto-assign task statuses (▶️)</li>
            <li><strong>Project Sections</strong> - Auto-assign task projects (📁)</li>
            <li><strong>Timeline Sections</strong> - Auto-assign task schedules (📅)</li>
            <li><strong>Custom Sections</strong> - Manual task organization</li>
            <li><strong>Auto-collect</strong> - Toggle automatic task assignment (🧲)</li>
            <li><strong>Collapsible</strong> - Expand/collapse sections with chevron</li>
            <li><strong>Task Counting</strong> - Live task count badges</li>
          </ul>
        </div>
      </div>
    `,
  }),
}