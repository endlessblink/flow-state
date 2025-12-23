import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import HierarchicalTaskRow from '@/components/HierarchicalTaskRow.vue'
import { useTaskStore } from '@/stores/tasks'

const meta = {
    component: HierarchicalTaskRow,
    title: '📝 Task Management/HierarchicalTaskRow',
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
    },
    decorators: [
        (story: any) => ({
            components: { story },
            setup() {
                const taskStore = useTaskStore()
                // Mock some nested tasks for the sub-rows
                taskStore.tasks = [
                    {
                        id: 'child-1',
                        parentId: 'parent-1',
                        title: 'Subtask 1',
                        status: 'planned',
                        priority: 'medium',
                        progress: 0,
                        completedPomodoros: 0,
                        subtasks: [],
                        dueDate: '',
                        projectId: 'p1',
                        createdAt: new Date(),
                        updatedAt: new Date()
                    },
                    {
                        id: 'child-2',
                        parentId: 'parent-1',
                        title: 'Subtask 2',
                        status: 'done',
                        priority: 'low',
                        progress: 100,
                        completedPomodoros: 1,
                        subtasks: [],
                        dueDate: '',
                        projectId: 'p1',
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                ]
                return {}
            },
            template: '<div style="padding: 40px; background: var(--app-background-gradient); min-height: 100vh;"><div style="max-width: 800px; margin: 0 auto;"><story /></div></div>'
        })
    ],
    argTypes: {
        level: { control: { type: 'number', min: 0, max: 5 } }
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
    createdAt: new Date(),
    updatedAt: new Date()
}

export const Default: Story = {
    args: {
        task: mockTask as any,
        level: 0
    }
}

export const DeeplyNested: Story = {
    args: {
        task: { ...mockTask, title: 'Deep Subtask' } as any,
        level: 3
    }
}

export const HighPriority: Story = {
    args: {
        task: { ...mockTask, priority: 'high', title: 'Urgent Project Task' } as any,
        level: 0
    }
}

export const Completed: Story = {
    args: {
        task: { ...mockTask, status: 'done', progress: 100, title: 'Completed Project Task' } as any,
        level: 0
    }
}
