import type { Meta, StoryObj } from '@storybook/vue3'
import CanvasLoadingOverlay from '@/components/canvas/CanvasLoadingOverlay.vue'

const meta: Meta<typeof CanvasLoadingOverlay> = {
  title: '🎨 Canvas/CanvasLoadingOverlay',
  component: CanvasLoadingOverlay,
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered'
  }
}

export default meta
type Story = StoryObj<typeof CanvasLoadingOverlay>

export const Default: Story = {
  args: {
    message: 'Loading Canvas...'
  },
  render: (args) => ({
    components: { CanvasLoadingOverlay },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 600px; height: 400px; position: relative; background: var(--surface-primary); border-radius: var(--radius-lg);">
        <CanvasLoadingOverlay v-bind="args" />
      </div>
    `
  })
}

export const SyncingData: Story = {
  args: {
    message: 'Synchronizing Data...'
  },
  render: (args) => ({
    components: { CanvasLoadingOverlay },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 600px; height: 400px; position: relative; background: var(--surface-primary); border-radius: var(--radius-lg);">
        <CanvasLoadingOverlay v-bind="args" />
      </div>
    `
  })
}
