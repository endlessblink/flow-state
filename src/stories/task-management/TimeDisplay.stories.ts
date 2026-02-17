import type { Meta, StoryObj } from '@storybook/vue3'
import TimeDisplay from '@/components/common/TimeDisplay.vue'

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
      <div style="padding: var(--space-10); background: var(--app-background-gradient); width: 100%; max-width: 1200px;">
        <h3 style="margin: 0 0 var(--space-4) 0; font-size: 18px; color: var(--text-primary);">Time Display Dashboard</h3>
        <p style="margin: 0 0 var(--space-6) 0; color: var(--text-secondary);">Multiple time displays in a dashboard layout</p>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: var(--space-4);">
          <div style="padding: var(--space-5); background: var(--glass-bg-subtle); border: 1px solid var(--glass-border); border-radius: var(--radius-xl);">
            <h4 style="margin: 0 0 var(--space-3) 0; color: var(--text-secondary); font-size: var(--text-xs);">Current Time</h4>
            <TimeDisplay />
          </div>
          <div style="padding: var(--space-5); background: var(--glass-bg-subtle); border: 1px solid var(--glass-border); border-radius: var(--radius-xl);">
            <h4 style="margin: 0 0 var(--space-3) 0; color: var(--text-secondary); font-size: var(--text-xs);">Last Synced</h4>
            <TimeDisplay />
          </div>
          <div style="padding: var(--space-5); background: var(--glass-bg-subtle); border: 1px solid var(--glass-border); border-radius: var(--radius-xl);">
            <h4 style="margin: 0 0 var(--space-3) 0; color: var(--text-secondary); font-size: var(--text-xs);">Server Time</h4>
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
      <div style="padding: var(--space-10); background: var(--app-background-gradient); width: 100%; max-width: 600px;">
        <h3 style="margin: 0 0 var(--space-4) 0; font-size: 18px; color: var(--text-primary);">Time Display Variants</h3>
        <p style="margin: 0 0 var(--space-6) 0; color: var(--text-secondary);">Different configurations of the TimeDisplay component</p>
        <div style="display: grid; grid-template-columns: 1fr; gap: var(--space-5);">
          <div style="padding: var(--space-5); background: var(--glass-bg-subtle); border: 1px solid var(--glass-border); border-radius: var(--radius-xl);">
            <h4 style="margin: 0 0 var(--space-4) 0; color: var(--text-secondary); font-size: var(--text-xs);">Default Display</h4>
            <TimeDisplay />
          </div>
        </div>
      </div>
    `
  })
}
