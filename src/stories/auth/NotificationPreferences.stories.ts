import type { Meta, StoryObj } from '@storybook/vue3'
import NotificationPreferences from '@/components/notifications/NotificationPreferences.vue'

const meta: Meta<typeof NotificationPreferences> = {
  title: '🔐 Auth/NotificationPreferences',
  component: NotificationPreferences,
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
    (story) => {
      // Inject styles to remove component fills
      if (typeof document !== 'undefined') {
        const styleId = 'notification-preferences-story-styles'
        if (!document.getElementById(styleId)) {
          const style = document.createElement('style')
          style.id = styleId
          style.textContent = `
            .notification-preferences-story-container .notification-preferences {
              background: transparent !important;
            }
            .notification-preferences-story-container .btn-primary {
              background: transparent !important;
              border: 1px solid var(--brand-primary) !important;
              color: var(--brand-primary) !important;
            }
            .notification-preferences-story-container .btn-secondary {
              background: transparent !important;
              border: 1px solid var(--glass-border) !important;
            }
            .notification-preferences-story-container .permission-status {
              background: transparent !important;
            }
            .notification-preferences-story-container .checkbox-input {
              background: transparent !important;
            }
            .notification-preferences-story-container .time-input {
              background: transparent !important;
            }
            .notification-preferences-story-container .select-input {
              background: transparent !important;
            }
          `
          document.head.appendChild(style)
        }
      }
      return {
        components: { story },
        template: `
          <div class="notification-preferences-story-container" style="
            background: var(--glass-bg-solid);
            min-height: 600px;
            height: 100%;
            width: 100%;
            position: relative;
            overflow: hidden;
            display: flex;
            align-items: flex-start;
            justify-content: center;
            border-radius: 8px;
            padding: 2rem;
          ">
            <div style="max-width: 400px; width: 100%;">
              <story />
            </div>
          </div>
        `
      }
    }
  ]
}

export default meta
type Story = StoryObj<typeof NotificationPreferences>

export const Default: Story = {
  args: {
    taskId: 'mock-task-1'
  }
}
