import type { Meta, StoryObj } from '@storybook/vue3'
import AboutSettingsTab from '@/components/settings/tabs/AboutSettingsTab.vue'
import { createPinia, setActivePinia } from 'pinia'

const pinia = createPinia()
setActivePinia(pinia)

const meta = {
  component: AboutSettingsTab,
  title: '⚙️ Settings/Tabs/AboutSettingsTab',
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
        <div style="min-height: 800px; width: 100%; max-width: 800px; padding: var(--space-6); background: var(--glass-bg-soft); border-radius: var(--radius-xl); border: 1px solid var(--glass-border);">
          <story />
        </div>
      `,
    })
  ],
} satisfies Meta<typeof AboutSettingsTab>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const UpdateAvailable: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Shows the update notification when a new version is available (Tauri only).',
      },
    },
  },
}

export const CheckingForUpdates: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Shows the checking state with loading spinner.',
      },
    },
  },
}
