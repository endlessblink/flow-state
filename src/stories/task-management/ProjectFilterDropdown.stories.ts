import type { Meta, StoryObj } from '@storybook/vue3'
import ProjectFilterDropdown from '@/components/projects/ProjectFilterDropdown.vue'
import { createPinia, setActivePinia } from 'pinia'
import { useTaskStore } from '@/stores/tasks'

const pinia = createPinia()
setActivePinia(pinia)

const meta = {
  component: ProjectFilterDropdown,
  title: '📝 Task Management/ProjectFilterDropdown',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="transform: scale(1); min-height: 300px; width: 100%; display: flex; align-items: center; justify-content: center; background: var(--app-background-gradient); padding: 40px; box-sizing: border-box; border-radius: var(--radius-xl); overflow: hidden;">
          <div style="width: auto; position: relative;">
            <story />
          </div>
        </div>
      `,
      setup() {
        const taskStore = useTaskStore()
        taskStore.projects = [
          {
            id: 'p1',
            name: 'Work',
            emoji: '💼',
            color: '#3b82f6',
            colorType: 'emoji',
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: 'p2',
            name: 'Personal',
            emoji: '🏠',
            color: '#10b981',
            colorType: 'emoji',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
        // Add some tasks for counts
        taskStore.tasks = [
          { id: 't1', title: 'Task 1', projectId: 'p1', status: 'planned', createdAt: new Date(), updatedAt: new Date(), subtasks: [], tags: [] },
          { id: 't2', title: 'Task 2', projectId: 'p1', status: 'planned', createdAt: new Date(), updatedAt: new Date(), subtasks: [], tags: [] },
          { id: 't3', title: 'Task 3', projectId: 'p2', status: 'planned', createdAt: new Date(), updatedAt: new Date(), subtasks: [], tags: [] }
        ]
        return {}
      }
    })
  ]
} satisfies Meta<typeof ProjectFilterDropdown>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { ProjectFilterDropdown },
    template: '<ProjectFilterDropdown />'
  })
}
