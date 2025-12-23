import type { Meta, StoryObj } from '@storybook/vue3'
import FilterControls from '@/components/base/FilterControls.vue'
import { createPinia, setActivePinia } from 'pinia'
import { useTaskStore } from '@/stores/tasks'

const pinia = createPinia()
setActivePinia(pinia)

const meta = {
    component: FilterControls,
    title: '📝 Task Management/FilterControls',
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
            template: `
        <div style="padding: 20px; background: var(--app-background-gradient); min-height: 200px; display: flex; align-items: flex-start; justify-content: center; border-radius: 12px; transform: scale(1);">
          <story />
        </div>
      `,
            setup() {
                const taskStore = useTaskStore()
                taskStore.projects = [
                    { id: 'p1', name: 'Work', emoji: '💼', color: '#3b82f6', colorType: 'emoji', createdAt: new Date(), updatedAt: new Date() },
                    { id: 'p2', name: 'Personal', emoji: '🏠', color: '#10b981', colorType: 'emoji', createdAt: new Date(), updatedAt: new Date() },
                    { id: 'p3', name: 'Side Project', emoji: '🚀', color: '#8b5cf6', colorType: 'emoji', createdAt: new Date(), updatedAt: new Date() }
                ]
                return {}
            }
        })
    ],
} satisfies Meta<typeof FilterControls>

export default meta
type Story = StoryObj<typeof meta>

const mockProjects = [
    { id: 'p1', name: 'Work', emoji: '💼', color: '#3b82f6' },
    { id: 'p2', name: 'Personal', emoji: '🏠', color: '#10b981' },
    { id: 'p3', name: 'Side Project', emoji: '🚀', color: '#8b5cf6' }
]

export const Default: Story = {
    render: () => ({
        components: { FilterControls },
        template: `
        <FilterControls />
      `
    })
}
