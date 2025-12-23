import type { Meta, StoryObj } from '@storybook/vue3'
import CanvasGroup from '@/components/canvas/CanvasGroup.vue'
import mockUseCanvasStore from '../helpers/mockUseCanvasStore'

const meta = {
    component: CanvasGroup,
    title: '🎨 Canvas/CanvasGroup',
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
    }
} satisfies Meta<typeof CanvasGroup>

export default meta
type Story = StoryObj<typeof meta>

const sampleTasks = [
    { id: '1', title: 'Task 1', priority: 'high', status: 'planned', estimatedDuration: 15 },
    { id: '2', title: 'Task 2', priority: 'medium', status: 'in_progress', estimatedDuration: 45 },
    { id: '3', title: 'Task 3', priority: 'low', status: 'planned', estimatedDuration: 90 }
]

const sampleSection = {
    id: 'section-1',
    name: 'Work Tasks',
    type: 'custom',
    position: { x: 0, y: 0, width: 400, height: 300 },
    color: '#3b82f6',
    layout: 'grid',
    isVisible: true,
    isCollapsed: false,
    isPowerMode: false
}

export const Default: Story = {
    args: {
        section: sampleSection,
        tasks: sampleTasks,
        isActive: false
    },
    render: (args: any) => ({
        components: { CanvasGroup },
        setup() {
            // Mock store if needed
            return { args }
        },
        template: `
      <div style="width: 800px; height: 600px; position: relative; background: var(--bg-secondary);">
        <CanvasGroup v-bind="args" />
      </div>
    `
    })
}

export const PowerGroup: Story = {
    args: {
        section: {
            ...sampleSection,
            name: 'High Priority 🔥',
            isPowerMode: true,
            powerKeyword: { category: 'priority', value: 'high', displayName: 'High Priority' }
        },
        tasks: sampleTasks.filter(t => t.priority === 'high'),
        isActive: true
    },
    render: (args: any) => ({
        components: { CanvasGroup },
        setup() {
            return { args }
        },
        template: `
      <div style="width: 800px; height: 600px; position: relative; background: var(--bg-secondary);">
        <CanvasGroup v-bind="args" />
      </div>
    `
    })
}
