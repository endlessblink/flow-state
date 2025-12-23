import type { Meta, StoryObj } from '@storybook/vue3'
import TimeDisplay from '@/components/TimeDisplay.vue'

const meta = {
  title: '📝 Task Management/TimeDisplay',
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
      <div style="padding: 40px; background: rgba(0, 0, 0, 0.95); width: 100%; max-width: 1200px;">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Time Display Dashboard</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Multiple time displays in a dashboard layout</p>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
          <div style="padding: 20px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px;">
            <h4 style="margin: 0 0 12px 0; color: var(--text-secondary); font-size: 12px;">Current Time</h4>
            <TimeDisplay />
          </div>
          <div style="padding: 20px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px;">
            <h4 style="margin: 0 0 12px 0; color: var(--text-secondary); font-size: 12px;">Last Synced</h4>
            <TimeDisplay />
          </div>
          <div style="padding: 20px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px;">
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
      <div style="padding: 40px; background: rgba(0, 0, 0, 0.95); width: 100%; max-width: 600px;">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Time Display Variants</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Different configurations of the TimeDisplay component</p>
        <div style="display: grid; grid-template-columns: 1fr; gap: 20px;">
          <div style="padding: 20px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px;">
            <h4 style="margin: 0 0 16px 0; color: var(--text-secondary); font-size: 12px;">Default Display</h4>
            <TimeDisplay />
          </div>
        </div>
      </div>
    `
  })
}
