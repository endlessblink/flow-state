import type { Meta, StoryObj } from '@storybook/vue3'
import StorageSettingsTab from '@/components/settings/tabs/StorageSettingsTab.vue'
import { createPinia, setActivePinia } from 'pinia'

const pinia = createPinia()
setActivePinia(pinia)

const meta = {
  component: StorageSettingsTab,
  title: '⚙️ Settings/Tabs/StorageSettingsTab',
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
        <div style="min-height: 900px; width: 100%; max-width: 900px; padding: var(--space-6); background: var(--glass-bg-soft); border-radius: var(--radius-xl); border: 1px solid var(--glass-border);">
          <story />
        </div>
      `,
    })
  ],
} satisfies Meta<typeof StorageSettingsTab>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const TauriDesktopMode: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Shows Tauri desktop mode selector (Cloud vs Local) - only visible in desktop app.',
      },
    },
  },
}

export const BackupStrategy: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Displays backup configuration including auto-backup interval, history retention, and filter settings.',
      },
    },
  },
}

export const ShadowHub: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Shows the Shadow Hub always-on sync panel with real-time database monitoring.',
      },
    },
  },
}

export const GoldenBackup: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Displays the Golden Backup rotation (up to 3 peak task snapshots) for disaster recovery.',
      },
    },
  },
}

export const DataCleanup: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Shows data cleanup tools for fixing corrupted tasks and clearing sync queue.',
      },
    },
  },
}
