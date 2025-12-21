import type { Meta, StoryObj } from '@storybook/vue3'
import BackupSettings from '@/components/BackupSettings.vue'

const meta: Meta<typeof BackupSettings> = {
    title: 'Auth/BackupSettings',
    component: BackupSettings,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            story: {
                inline: true,
            }
        }
    },
    decorators: [
        () => ({
            template: `
        <div class="backup-settings-story-container" style="
          background: var(--glass-bg-solid);
          height: 800px;
          width: 100%;
          position: relative;
          overflow-y: auto;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 40px;
        ">
          <!-- Force absolute positioning for the container within this wrapper if needed -->
          <style>
             .backup-settings-story-container .backup-settings {
               /* Ensure it doesn't get squashed */
               width: 100%;
               max-width: 600px;
             }
          </style>
          <story />
        </div>
      `
        })
    ]
}

export default meta
type Story = StoryObj<typeof BackupSettings>

export const Default: Story = {
    name: 'Default View',
    args: {}
}
