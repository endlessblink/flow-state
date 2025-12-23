import TaskList from '@/components/kanban/TaskList.vue'

const meta = {
  title: '📊 Kanban/TaskList',
  component: TaskList,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  }
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
