import TaskList from '@/components/TaskList.vue'

const meta = {
  title: '📊 Kanban/TaskList',
  component: TaskList,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="padding: 24px; background: var(--app-background-gradient); border-radius: 12px; min-height: 200px;">
          <story />
        </div>
      `
    })
  ],
}

export default meta

export const Default = {
  args: {
    tasks: [
      { id: '1', title: 'Task 1', priority: 'high', status: 'planned', description: 'Test task 1' },
      { id: '2', title: 'Task 2', priority: 'medium', status: 'in_progress', description: 'Test task 2' }
    ]
  }
}
