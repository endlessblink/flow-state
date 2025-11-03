import type { Meta, StoryObj } from '@storybook/vue3'
import CanvasSection from '@/components/canvas/CanvasSection.vue'

// Mock tasks data
const mockTasks = [
  {
    id: '1',
    title: 'Complete API documentation',
    priority: 'high',
    estimatedDuration: 60,
    status: 'todo',
    projectId: 'proj1',
    subtasks: []
  },
  {
    id: '2',
    title: 'Review pull requests',
    priority: 'medium',
    estimatedDuration: 30,
    status: 'todo',
    projectId: 'proj1',
    subtasks: []
  },
  {
    id: '3',
    title: 'Fix critical bug',
    priority: 'high',
    estimatedDuration: 45,
    status: 'in-progress',
    projectId: 'proj2',
    subtasks: []
  },
  {
    id: '4',
    title: 'Update dependencies',
    priority: 'low',
    estimatedDuration: 20,
    status: 'todo',
    projectId: 'proj1',
    subtasks: []
  },
  {
    id: '5',
    title: 'Design new feature',
    priority: 'medium',
    estimatedDuration: 90,
    status: 'todo',
    projectId: 'proj3',
    subtasks: []
  }
]

// Mock section data
const createMockSection = (overrides = {}) => ({
  id: 'section-1',
  name: 'Development Tasks',
  color: '#3b82f6',
  position: { x: 50, y: 50, width: 600, height: 300 },
  layout: 'grid',
  isVisible: true,
  isCollapsed: false,
  ...overrides
})

const meta = {
  component: CanvasSection,
  title: '✨ Features/🎨 Canvas View/CanvasSection',
  tags: ['autodocs'],

  parameters: {
    layout: 'fullscreen',
  },

  argTypes: {
    section: {
      control: 'object',
      description: 'Canvas section data including position, size, and styling',
    },
    tasks: {
      control: 'array',
      description: 'Array of tasks to display in the section',
    },
    isActive: {
      control: 'boolean',
      description: 'Whether the section is currently active/selected',
    },
    showSectionGuides: {
      control: 'boolean',
      description: 'Whether to show section guides when active',
    },
  },
} satisfies Meta<typeof CanvasSection>

export default meta
type Story = StoryObj<typeof meta>

// Basic Section States
export const Default: Story = {
  args: {
    section: createMockSection(),
    tasks: mockTasks.slice(0, 3),
    isActive: false,
    showSectionGuides: true,
  },
}

export const Active: Story = {
  args: {
    section: createMockSection(),
    tasks: mockTasks.slice(0, 3),
    isActive: true,
    showSectionGuides: true,
  },
}

// Layout Variants
export const GridLayout: Story = {
  args: {
    section: createMockSection({ layout: 'grid', name: 'Grid Layout Section' }),
    tasks: mockTasks,
    isActive: false,
    showSectionGuides: false,
  },
}

export const VerticalLayout: Story = {
  args: {
    section: createMockSection({ layout: 'vertical', name: 'Vertical Layout Section' }),
    tasks: mockTasks,
    isActive: false,
    showSectionGuides: false,
  },
}

export const HorizontalLayout: Story = {
  args: {
    section: createMockSection({ layout: 'horizontal', name: 'Horizontal Layout Section' }),
    tasks: mockTasks,
    isActive: false,
    showSectionGuides: false,
  },
}

// State Variants
export const Collapsed: Story = {
  args: {
    section: createMockSection({ isCollapsed: true, name: 'Collapsed Section' }),
    tasks: mockTasks.slice(0, 3),
    isActive: false,
    showSectionGuides: false,
  },
}

export const EmptySection: Story = {
  args: {
    section: createMockSection({ name: 'Empty Section' }),
    tasks: [],
    isActive: false,
    showSectionGuides: false,
  },
}

// Color Variants
export const DifferentColors: Story = {
  render: () => ({
    components: { CanvasSection },
    setup() {
      const sections = [
        createMockSection({
          id: 'section-blue',
          name: 'Development Tasks',
          color: '#3b82f6',
          position: { x: 20, y: 20, width: 350, height: 220 }
        }),
        createMockSection({
          id: 'section-green',
          name: 'Design Work',
          color: '#10b981',
          position: { x: 390, y: 20, width: 350, height: 220 }
        }),
        createMockSection({
          id: 'section-purple',
          name: 'Research',
          color: '#8b5cf6',
          position: { x: 20, y: 260, width: 350, height: 180 }
        }),
        createMockSection({
          id: 'section-orange',
          name: 'Testing',
          color: '#f59e0b',
          position: { x: 390, y: 260, width: 350, height: 180 }
        })
      ]

      const taskGroups = [
        mockTasks.slice(0, 2),
        mockTasks.slice(2, 3),
        [mockTasks[3]],
        [mockTasks[4]]
      ]

      return { sections, taskGroups }
    },
    template: `
      <div style="width: 100vw; height: 100vh; background: var(--surface-secondary); position: relative; overflow: auto; padding: 20px;">
        <div style="position: relative; min-width: 800px; min-height: 500px;">
          <CanvasSection
            v-for="(section, index) in sections"
            :key="section.id"
            :section="section"
            :tasks="taskGroups[index]"
            :is-active="false"
            :show-section-guides="false"
            @task-drop="(event, slot, section) => console.log('Task dropped:', section.name)"
            @section-update="(section) => console.log('Section updated:', section.name)"
            @section-activate="(sectionId) => console.log('Section activated:', sectionId)"
            @section-context-menu="(event, section) => console.log('Context menu:', section.name)"
          />
        </div>
      </div>
    `,
  })
}

// Different Sizes
export const DifferentSizes: Story = {
  render: () => ({
    components: { CanvasSection },
    setup() {
      const sections = [
        createMockSection({
          id: 'section-small',
          name: 'Quick Tasks',
          position: { x: 20, y: 20, width: 250, height: 180 }
        }),
        createMockSection({
          id: 'section-medium',
          name: 'Development',
          position: { x: 290, y: 20, width: 450, height: 280 }
        }),
        createMockSection({
          id: 'section-large',
          name: 'Project Planning',
          position: { x: 20, y: 320, width: 720, height: 230 }
        })
      ]

      const taskGroups = [
        mockTasks.slice(0, 1),
        mockTasks.slice(0, 3),
        mockTasks
      ]

      return { sections, taskGroups }
    },
    template: `
      <div style="width: 100vw; height: 100vh; background: var(--surface-secondary); position: relative; overflow: auto; padding: 20px;">
        <div style="position: relative; min-width: 780px; min-height: 600px;">
          <CanvasSection
            v-for="(section, index) in sections"
            :key="section.id"
            :section="section"
            :tasks="taskGroups[index]"
            :is-active="false"
            :show-section-guides="false"
            @task-drop="(event, slot, section) => console.log('Task dropped:', section.name)"
            @section-update="(section) => console.log('Section updated:', section.name)"
            @section-activate="(sectionId) => console.log('Section activated:', sectionId)"
            @section-context-menu="(event, section) => console.log('Context menu:', section.name)"
          />
        </div>
      </div>
    `,
  })
}