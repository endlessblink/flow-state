// import InboxPanel from '@/components/canvas/InboxPanel.vue'
const InboxPanel = { template: '<div>Mock InboxPanel</div>' }

const meta = {
  title: 'Canvas/InboxPanel',
  component: InboxPanel,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="min-height: 100vh; width: 100%; display: flex; align-items: center; justify-content: center; background: var(--app-background-gradient);">
          <story />
        </div>
      `
    })
  ],
}

export default meta

export const Default = {
  render: () => ({
    components: { InboxPanel },
    template: '<InboxPanel />',
  }),
}
