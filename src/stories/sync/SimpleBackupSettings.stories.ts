import type { Meta, StoryObj } from '@storybook/vue3'
import SimpleBackupSettings from '@/components/SimpleBackupSettings.vue'

const meta = {
    component: SimpleBackupSettings,
    title: '🔄 Sync & Reliability/SimpleBackupSettings',
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
    }
} satisfies Meta<typeof SimpleBackupSettings>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
    render: () => ({
        components: { SimpleBackupSettings },
        template: `
      <div style="background: var(--bg-primary); padding: 2rem; border-radius: 12px; border: 1px solid var(--border-subtle);">
        <SimpleBackupSettings />
      </div>
    `
    })
}
