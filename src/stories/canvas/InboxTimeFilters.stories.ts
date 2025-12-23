import InboxTimeFilters from '@/components/canvas/InboxTimeFilters.vue'

const meta = {
  title: 'Canvas/InboxTimeFilters',
  component: InboxTimeFilters,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="padding: 100px; background: var(--app-background-gradient); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
          <story />
        </div>
      `
    })
  ],
}

export default meta

export const Default = {
  args: {
    tasks: [],
    activeFilter: 'all',
  }
}
