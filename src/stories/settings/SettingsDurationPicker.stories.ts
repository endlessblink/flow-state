import type { Meta, StoryObj } from '@storybook/vue3'
import SettingsDurationPicker from '@/components/settings/SettingsDurationPicker.vue'

const meta = {
  component: SettingsDurationPicker,
  title: '⚙️ Settings/SettingsDurationPicker',
  tags: ['autodocs', 'new'],

  args: {
    label: 'Work Duration',
    options: [15, 20, 25, 30],
    value: 25,
    suffix: 'm',
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
        <div style="padding: var(--space-6); background: var(--glass-bg-soft); border-radius: var(--radius-xl); border: 1px solid var(--glass-border); max-width: 500px;">
          <story />
        </div>
      `,
    })
  ],
} satisfies Meta<typeof SettingsDurationPicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WorkDuration: Story = {
  args: {
    label: 'Work Duration',
    options: [15, 20, 25, 30],
    value: 25,
    suffix: 'm',
  },
}

export const ShortBreak: Story = {
  args: {
    label: 'Short Break',
    options: [3, 5, 10],
    value: 5,
    suffix: 'm',
  },
}

export const LongBreak: Story = {
  args: {
    label: 'Long Break',
    options: [10, 15, 20, 30],
    value: 15,
    suffix: 'm',
  },
}

export const CustomSuffix: Story = {
  args: {
    label: 'Interval',
    options: [1, 5, 10, 30],
    value: 5,
    suffix: ' min',
  },
}
