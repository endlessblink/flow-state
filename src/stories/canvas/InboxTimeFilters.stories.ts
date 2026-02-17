import InboxTimeFilters from '@/components/canvas/InboxTimeFilters.vue'

const meta = {
  title: '🎨 Canvas/InboxTimeFilters',
  component: InboxTimeFilters,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="padding: 6.25rem; background: var(--app-background-gradient); border-radius: var(--radius-xl); display: flex; align-items: center; justify-content: center;">
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
