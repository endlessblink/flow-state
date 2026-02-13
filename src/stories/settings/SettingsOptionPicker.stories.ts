import type { Meta, StoryObj } from '@storybook/vue3'
import SettingsOptionPicker from '@/components/settings/SettingsOptionPicker.vue'

const meta = {
  component: SettingsOptionPicker,
  title: '⚙️ Settings/SettingsOptionPicker',
  tags: ['autodocs', 'new'],

  args: {
    label: 'Board Density',
    description: 'Adjust the vertical and horizontal spacing of cards.',
    options: [
      { value: 'comfortable', label: 'Comfortable' },
      { value: 'compact', label: 'Compact' },
      { value: 'ultrathin', label: 'Ultrathin' },
    ],
    value: 'comfortable',
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
} satisfies Meta<typeof SettingsOptionPicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const BoardDensity: Story = {
  args: {
    label: 'Board Density',
    description: 'Adjust the vertical and horizontal spacing of cards.',
    options: [
      { value: 'comfortable', label: 'Comfortable' },
      { value: 'compact', label: 'Compact' },
      { value: 'ultrathin', label: 'Ultrathin' },
    ],
    value: 'comfortable',
  },
}

export const PowerGroupMode: Story = {
  args: {
    label: 'Power Group Behavior',
    description: 'When dropping tasks on power groups (Today, High Priority, etc.)',
    options: [
      { value: 'always', label: 'Always update' },
      { value: 'only_empty', label: 'Only if empty' },
      { value: 'ask', label: 'Ask each time' },
    ],
    value: 'always',
  },
}

export const NoDescription: Story = {
  args: {
    label: 'Display Mode',
    options: [
      { value: 'grid', label: 'Grid' },
      { value: 'list', label: 'List' },
    ],
    value: 'grid',
  },
}
