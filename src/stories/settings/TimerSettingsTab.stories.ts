import type { Meta, StoryObj } from '@storybook/vue3'
import TimerSettingsTab from '@/components/settings/tabs/TimerSettingsTab.vue'
import { createPinia, setActivePinia } from 'pinia'

const pinia = createPinia()
setActivePinia(pinia)

const meta = {
  component: TimerSettingsTab,
  title: '⚙️ Settings/Tabs/TimerSettingsTab',
  tags: ['autodocs', 'new'],

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
        <div style="min-height: 500px; width: 100%; max-width: 800px; padding: var(--space-6); background: var(--glass-bg-soft); border-radius: var(--radius-xl); border: 1px solid var(--glass-border);">
          <story />
        </div>
      `,
    })
  ],
} satisfies Meta<typeof TimerSettingsTab>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const CustomDurations: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Shows Pomodoro timer settings with customizable work, short break, and long break durations.',
      },
    },
  },
}

export const AutoStartEnabled: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Shows settings with auto-start breaks and auto-start work sessions enabled.',
      },
    },
  },
}
