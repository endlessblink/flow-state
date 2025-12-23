// import InboxPanel from '@/components/canvas/InboxPanel.vue'
const InboxPanel = { template: '<div>Mock InboxPanel</div>' }

const meta = {
  title: 'Canvas/InboxPanel',
  component: InboxPanel,
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta

export const Default = {
  render: () => ({
    components: { InboxPanel },
    template: '<InboxPanel />',
  }),
}
