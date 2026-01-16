import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import HierarchicalTaskRow from '@/components/tasks/HierarchicalTaskRow.vue'
import { useTaskStore } from '@/stores/tasks'
import { useProjectStore } from '@/stores/projects'

// Create fresh pinia instance for stories
const pinia = createPinia()
setActivePinia(pinia)

const meta = {
    component: HierarchicalTaskRow,
    title: '📝 Task Management/HierarchicalTaskRow',
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        backgrounds: {
            default: 'dark',
            values: [
                { name: 'dark', value: '#0f172a' },
            ],
        },
    },
    decorators: [
        (story: any) => ({
            components: { story },
            setup() {
                // Use projectStore directly (not readonly passthrough via taskStore)
                const projectStore = useProjectStore()
                projectStore.projects = [
                    { id: 'p1', name: 'Work', color: '#4ECDC4', emoji: '💼', colorType: 'emoji', createdAt: new Date(), updatedAt: new Date() },
                    { id: 'p2', name: 'Personal', color: '#FF6B6B', emoji: '🏠', colorType: 'emoji', createdAt: new Date(), updatedAt: new Date() }
                ]
                return {}
            },
            template: '<div style="padding: 20px; background: var(--app-background-gradient); min-height: 300px;"><div style="max-width: 900px;"><story /></div></div>'
        })
    ],
    argTypes: {
        indentLevel: { control: { type: 'number', min: 0, max: 5 } }
    }
} satisfies Meta<typeof HierarchicalTaskRow>

export default meta
type Story = StoryObj<typeof meta>

const mockTask = {
    id: 'parent-1',
    title: 'Main Project Task',
    description: 'A complex task with subtasks',
    status: 'in_progress',
    priority: 'high',
    progress: 33,
    completedPomodoros: 2,
    subtasks: [],
    dueDate: '2025-12-25',
    projectId: 'p1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
}

export const Default: Story = {
    args: {
        task: mockTask as any,
        indentLevel: 0,
        selected: false,
        expandedTasks: new Set<string>()
    }
}

export const DeeplyNested: Story = {
    args: {
        task: { ...mockTask, id: 'nested-1', title: 'Deep Subtask' } as any,
        indentLevel: 2,
        selected: false,
        expandedTasks: new Set<string>()
    }
}

export const HighPriority: Story = {
    args: {
        task: { ...mockTask, id: 'high-1', priority: 'high', title: 'Urgent Project Task' } as any,
        indentLevel: 0,
        selected: false,
        expandedTasks: new Set<string>()
    }
}

export const Completed: Story = {
    args: {
        task: { ...mockTask, id: 'done-1', status: 'done', progress: 100, title: 'Completed Task' } as any,
        indentLevel: 0,
        selected: false,
        expandedTasks: new Set<string>()
    }
}

export const Selected: Story = {
    args: {
        task: { ...mockTask, id: 'selected-1', title: 'Selected Task' } as any,
        indentLevel: 0,
        selected: true,
        expandedTasks: new Set<string>()
    }
}
