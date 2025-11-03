import type { Meta, StoryObj } from '@storybook/vue3'
import ResizeHandle from '@/components/canvas/ResizeHandle.vue'

const meta = {
  component: ResizeHandle,
  title: '✨ Features/🎨 Canvas View/ResizeHandle',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
    docs: {
      story: {
        height: '500px',
      },
    },
  },

  argTypes: {
    position: {
      control: 'select',
      options: ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'],
      description: 'Position of the resize handle',
    },
    onResize: {
      action: 'resize',
      description: 'Callback when resize starts/moves/ends',
    },
  },
} satisfies Meta<typeof ResizeHandle>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    position: 'bottom',
    onResize: (event: string, data: any) => console.log('Resize:', event, data),
  },
}

export const TopHandle: Story = {
  args: {
    position: 'top',
    onResize: (event: string, data: any) => console.log('Top resize:', event, data),
  },
}

export const BottomHandle: Story = {
  args: {
    position: 'bottom',
    onResize: (event: string, data: any) => console.log('Bottom resize:', event, data),
  },
}

export const LeftHandle: Story = {
  args: {
    position: 'left',
    onResize: (event: string, data: any) => console.log('Left resize:', event, data),
  },
}

export const RightHandle: Story = {
  args: {
    position: 'right',
    onResize: (event: string, data: any) => console.log('Right resize:', event, data),
  },
}

export const CornerHandle: Story = {
  args: {
    position: 'bottom-right',
    onResize: (event: string, data: any) => console.log('Corner resize:', event, data),
  },
}