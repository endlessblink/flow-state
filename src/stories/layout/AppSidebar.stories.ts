import type { Meta, StoryObj } from '@storybook/vue3'
import AppSidebar from '@/layouts/AppSidebar.vue'
import { useTaskStore } from '@/stores/tasks'
import { useUIStore } from '@/stores/ui'

const meta = {
    component: AppSidebar,
    title: '🏢 Layout/AppSidebar',
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component: 'The primary navigation sidebar of the application, featuring glassmorphism, quick task creation, smart views, and a hierarchical project tree.'
            }
        },
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
                const taskStore = useTaskStore()
                const uiStore = useUIStore()

                // Ensure sidebar is visible in Storybook
                uiStore.mainSidebarVisible = true

                // Mock some projects
                taskStore.projects = [
                    { id: 'p1', name: 'Work', color: '#4ECDC4', colorType: 'hex', viewType: 'status', createdAt: new Date() },
                    { id: 'p2', name: 'Personal', color: '#FF6B6B', colorType: 'hex', viewType: 'status', createdAt: new Date() },
                    { id: 'p3', name: 'Deep Work', color: '🚀', colorType: 'emoji', viewType: 'status', parentId: 'p1', createdAt: new Date() },
                    { id: 'p4', name: 'Finance', color: '💰', colorType: 'emoji', viewType: 'status', parentId: 'p2', createdAt: new Date() },
                ]

                return {}
            },
            template: '<div style="transform: scale(1); min-height: 600px; width: 100%; display: flex; background: var(--app-background-gradient); border-radius: var(--radius-xl); overflow: hidden;"><story /></div>'
        })
    ]
} satisfies Meta<typeof AppSidebar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
    render: () => ({
        components: { AppSidebar },
        template: '<AppSidebar />'
    })
}

export const ManyProjects: Story = {
    decorators: [
        (story: any) => ({
            components: { story },
            setup() {
                const taskStore = useTaskStore()
                const uiStore = useUIStore()
                uiStore.mainSidebarVisible = true

                const projects = []
                for (let i = 1; i <= 15; i++) {
                    projects.push({
                        id: `proj-${i}`,
                        name: `Project ${i}`,
                        color: i % 2 === 0 ? '#4ECDC4' : '📦',
                        colorType: i % 2 === 0 ? 'hex' : 'emoji',
                        viewType: 'status',
                        createdAt: new Date()
                    })
                }
                taskStore.projects = projects
                return {}
            },
            template: '<div style="transform: scale(1); min-height: 600px; width: 100%; display: flex; background: var(--app-background-gradient); border-radius: var(--radius-xl); overflow: hidden;"><story /></div>'
        })
    ],
    render: () => ({
        components: { AppSidebar },
        template: '<AppSidebar />'
    })
}
