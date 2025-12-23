import InboxTimeFilters from '@/components/canvas/InboxTimeFilters.vue'

const meta = {
  title: 'Canvas/InboxTimeFilters',
  component: InboxTimeFilters,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  }
}

export default meta

export const Default = {
  args: {
    tasks: [],
    activeFilter: 'all',
  }
}
