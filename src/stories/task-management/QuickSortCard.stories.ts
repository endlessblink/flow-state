import type { Meta, StoryObj } from '@storybook/vue3'
import QuickSortCard from '@/components/QuickSortCard.vue'
import { useTaskStore } from '@/stores/tasks'

const meta = {
    component: QuickSortCard,
    title: '📝 Task Management/QuickSortCard',
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
    },
    decorators: [
        (story: any) => ({
            components: { story },
            setup() {
                const taskStore = useTaskStore()
                taskStore.projects = [
                    { id: 'p1', name: 'Work', color: '#4ECDC4', colorType: 'hex', viewType: 'status', createdAt: new Date() }
                ]
                return {}
            },
            template: '<div style="width: 650px; padding: 20px;"><story /></div>'
        })
    ]
} satisfies Meta<typeof QuickSortCard>

export default meta
type Story = StoryObj<typeof meta>

const mockTask = {
    id: 't1',
    title: 'Audit Storybook Coverage',
    description: 'Go through all components and ensure they have tokenized stories that match the glassmorphism theme.',
    status: 'planned',
    priority: 'high',
    progress: 0,
    completedPomodoros: 2,
    subtasks: [
        { id: 's1', title: 'List components', isCompleted: true },
        { id: 's2', title: 'Create stories', isCompleted: false }
    ],
    dueDate: '2025-12-23T00:00:00.000Z',
    projectId: 'p1',
    createdAt: new Date(),
    updatedAt: new Date()
}

export const Default: Story = {
    args: {
        task: mockTask as any
    }
}

export const LowPriority: Story = {
    args: {
        task: { ...mockTask, priority: 'low', title: 'A minor task' } as any
    }
}

export const SwipingRight: Story = {
    render: (args) => ({
        components: { QuickSortCard },
        setup() { return { args } },
        template: '<QuickSortCard v-bind="args" class="is-swiping" style="transform: translateX(50px) rotate(5deg);" />'
    }),
    args: {
        task: mockTask as any
    }
}
