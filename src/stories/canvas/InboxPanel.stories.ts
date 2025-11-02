import type { Meta, StoryObj } from '@storybook/vue3'
import InboxPanel from '@/components/canvas/InboxPanel.vue'

const meta = {
  component: InboxPanel,
  title: '🧩 Components/🎨 Canvas/InboxPanel',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      story: {
        height: '800px',
      },
    },
  },
} satisfies Meta<typeof InboxPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const Expanded: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'InboxPanel in its default state. The component manages its own expanded/collapsed state internally.',
      },
    },
  },
}