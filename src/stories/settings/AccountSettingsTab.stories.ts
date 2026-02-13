import type { Meta, StoryObj } from '@storybook/vue3'
import AccountSettingsTab from '@/components/settings/tabs/AccountSettingsTab.vue'
import { createPinia, setActivePinia } from 'pinia'

const pinia = createPinia()
setActivePinia(pinia)

const meta = {
  component: AccountSettingsTab,
  title: '⚙️ Settings/Tabs/AccountSettingsTab',
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
        <div style="min-height: 600px; width: 100%; max-width: 800px; padding: var(--space-6); background: var(--glass-bg-soft); border-radius: var(--radius-xl); border: 1px solid var(--glass-border);">
          <story />
        </div>
      `,
    })
  ],
} satisfies Meta<typeof AccountSettingsTab>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const Authenticated: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Shows account details when user is logged in via Supabase.',
      },
    },
  },
}

export const GuestMode: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Shows guest mode status when using local storage only.',
      },
    },
  },
}

export const ChangePassword: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Shows the password change form when "Change Password" button is clicked.',
      },
    },
  },
}
