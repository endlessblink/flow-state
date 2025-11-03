import type { Meta, StoryObj } from '@storybook/vue3'
import TimeDisplay from '@/components/TimeDisplay.vue'

const meta = {
  title: '🧩 Components/📝 Form Controls/TimeDisplay',
  component: TimeDisplay,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Real-time display component showing current time and date with glass-morphism styling.'
      }
    }
  }
} satisfies Meta<typeof TimeDisplay>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { TimeDisplay },
    template: '<TimeDisplay />'
  })
}

export const Dashboard: Story = {
  render: () => ({
    components: { TimeDisplay },
    template: `
      <div style="width: 100%; max-width: 1200px;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
          <div style="padding: 20px; background: var(--surface-primary); border-radius: 12px;">
            <h4 style="margin: 0 0 12px 0; color: var(--text-secondary); font-size: 12px;">Current Time</h4>
            <TimeDisplay />
          </div>
          <div style="padding: 20px; background: var(--surface-primary); border-radius: 12px;">
            <h4 style="margin: 0 0 12px 0; color: var(--text-secondary); font-size: 12px;">Last Synced</h4>
            <TimeDisplay />
          </div>
          <div style="padding: 20px; background: var(--surface-primary); border-radius: 12px;">
            <h4 style="margin: 0 0 12px 0; color: var(--text-secondary); font-size: 12px;">Server Time</h4>
            <TimeDisplay />
          </div>
        </div>
      </div>
    `
  })
}

export const AllVariants: Story = {
  render: () => ({
    components: { TimeDisplay },
    template: `
      <div style="display: grid; grid-template-columns: 1fr; gap: 20px; width: 100%; max-width: 600px;">
        <div style="padding: 20px; background: var(--surface-primary); border-radius: 12px;">
          <h4 style="margin: 0 0 16px 0; color: var(--text-secondary); font-size: 12px;">Default Display</h4>
          <TimeDisplay />
        </div>
      </div>
    `
  })
}
