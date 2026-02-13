import type { Meta, StoryObj } from '@storybook/vue3'
import SettingsToggle from '@/components/settings/SettingsToggle.vue'

const meta = {
  component: SettingsToggle,
  title: '⚙️ Settings/SettingsToggle',
  tags: ['autodocs', 'new'],

  args: {
    label: 'Auto-start breaks',
    value: false,
  },

  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: 'var(--bg-primary)' },
      ],
    },
  },

  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="padding: var(--space-6); background: var(--glass-bg-soft); border-radius: var(--radius-xl); border: 1px solid var(--glass-border); max-width: 600px;">
          <story />
        </div>
      `,
    })
  ],
} satisfies Meta<typeof SettingsToggle>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Enabled: Story = {
  args: {
    label: 'Auto-start breaks',
    value: true,
  },
}

export const Disabled: Story = {
  args: {
    label: 'Auto-start breaks',
    value: false,
  },
}

export const WithDescription: Story = {
  args: {
    label: 'Enable gamification',
    description: 'Earn XP, level up, and track achievements as you complete tasks.',
    value: true,
  },
}

export const LongDescription: Story = {
  args: {
    label: 'Show undo/redo notifications',
    description: 'Display a brief toast when you undo (Ctrl+Z) or redo (Ctrl+Y) an action. This helps you understand what changed.',
    value: false,
  },
}
