import type { Meta, StoryObj } from '@storybook/vue3'
import CanvasStatusBanner from '@/components/canvas/CanvasStatusBanner.vue'

const meta: Meta<typeof CanvasStatusBanner> = {
  title: '🎨 Canvas/CanvasStatusBanner',
  component: CanvasStatusBanner,
  tags: ['autodocs', 'new']
}

export default meta
type Story = StoryObj<typeof CanvasStatusBanner>

export const NoFilter: Story = {
  args: {
    activeStatusFilter: null
  }
}

export const CompletedFilter: Story = {
  args: {
    activeStatusFilter: 'done'
  }
}

export const InProgressFilter: Story = {
  args: {
    activeStatusFilter: 'in_progress'
  }
}

export const PlannedFilter: Story = {
  args: {
    activeStatusFilter: 'planned'
  }
}

export const BacklogFilter: Story = {
  args: {
    activeStatusFilter: 'backlog'
  }
}
