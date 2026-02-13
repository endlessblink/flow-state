import type { Meta, StoryObj } from '@storybook/vue3'
import SettingsSection from '@/components/settings/SettingsSection.vue'

const meta = {
  component: SettingsSection,
  title: '⚙️ Settings/SettingsSection',
  tags: ['autodocs', 'new'],

  args: {
    title: 'Pomodoro Settings',
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
        <div style="padding: var(--space-6); background: var(--glass-bg-soft); border-radius: var(--radius-xl); border: 1px solid var(--glass-border); max-width: 800px;">
          <story />
        </div>
      `,
    })
  ],
} satisfies Meta<typeof SettingsSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args: any) => ({
    components: { SettingsSection },
    setup() {
      return { args }
    },
    template: `
      <SettingsSection v-bind="args">
        <p style="color: var(--text-secondary); font-size: var(--text-sm);">
          Section content goes here. This is a container component for grouping related settings.
        </p>
      </SettingsSection>
    `,
  }),
}

export const WithTitle: Story = {
  args: {
    title: 'Timer Settings',
  },
  render: (args: any) => ({
    components: { SettingsSection },
    setup() {
      return { args }
    },
    template: `
      <SettingsSection v-bind="args">
        <div style="display: flex; flex-direction: column; gap: var(--space-3);">
          <div style="color: var(--text-secondary); font-size: var(--text-sm);">
            Work duration: 25 minutes
          </div>
          <div style="color: var(--text-secondary); font-size: var(--text-sm);">
            Short break: 5 minutes
          </div>
          <div style="color: var(--text-secondary); font-size: var(--text-sm);">
            Long break: 15 minutes
          </div>
        </div>
      </SettingsSection>
    `,
  }),
}

export const NoTitle: Story = {
  args: {
    title: undefined,
  },
  render: (args: any) => ({
    components: { SettingsSection },
    setup() {
      return { args }
    },
    template: `
      <SettingsSection v-bind="args">
        <p style="color: var(--text-secondary); font-size: var(--text-sm);">
          A section without a title. Useful for grouping controls that don't need a header.
        </p>
      </SettingsSection>
    `,
  }),
}
