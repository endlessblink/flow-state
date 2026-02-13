import type { Meta, StoryObj } from '@storybook/vue3'
import CanvasSelectionBox from '@/components/canvas/CanvasSelectionBox.vue'

const meta: Meta<typeof CanvasSelectionBox> = {
  title: '🎨 Canvas/CanvasSelectionBox',
  component: CanvasSelectionBox,
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered'
  }
}

export default meta
type Story = StoryObj<typeof CanvasSelectionBox>

export const Hidden: Story = {
  args: {
    selectionBox: {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      isVisible: false
    }
  },
  render: (args) => ({
    components: { CanvasSelectionBox },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 600px; height: 400px; position: relative; background: var(--surface-primary); border-radius: var(--radius-lg);">
        <CanvasSelectionBox v-bind="args" />
      </div>
    `
  })
}

export const Visible: Story = {
  args: {
    selectionBox: {
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      isVisible: true
    }
  },
  render: (args) => ({
    components: { CanvasSelectionBox },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 600px; height: 400px; position: relative; background: var(--surface-primary); border-radius: var(--radius-lg);">
        <CanvasSelectionBox v-bind="args" />
      </div>
    `
  })
}

export const LargeSelection: Story = {
  args: {
    selectionBox: {
      x: 50,
      y: 50,
      width: 400,
      height: 300,
      isVisible: true
    }
  },
  render: (args) => ({
    components: { CanvasSelectionBox },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 600px; height: 400px; position: relative; background: var(--surface-primary); border-radius: var(--radius-lg);">
        <CanvasSelectionBox v-bind="args" />
      </div>
    `
  })
}
