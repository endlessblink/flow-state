import type { Meta, StoryObj } from '@storybook/vue3'
import AuthStatusNotice from '@/components/ui/AuthStatusNotice.vue'

const meta: Meta<typeof AuthStatusNotice> = {
  component: AuthStatusNotice,
  title: '🔐 Auth/AuthStatusNotice',
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
      // Inject styles to remove component background (no fills)
      if (typeof document !== 'undefined') {
        const styleId = 'auth-status-notice-story-styles'
        if (!document.getElementById(styleId)) {
          const style = document.createElement('style')
          style.id = styleId
          style.textContent = `
            .auth-status-notice-story-container .auth-status-notice {
              background: transparent !important;
              backdrop-filter: none !important;
              -webkit-backdrop-filter: none !important;
              border: none !important;
              box-shadow: none !important;
            }
            .auth-status-notice-story-container .primary-btn {
              background: transparent !important;
              border: 1px solid var(--brand-primary) !important;
              color: var(--brand-primary) !important;
            }
            .auth-status-notice-story-container .primary-btn:hover {
              background: rgba(var(--brand-primary-rgb), 0.1) !important;
            }
            .auth-status-notice-story-container .secondary-btn {
              background: transparent !important;
              border: 1px solid var(--glass-border) !important;
            }
          `
          document.head.appendChild(style)
        }
      }
      return {
        components: { story },
        template: `
          <div class="auth-status-notice-story-container" style="
            background: var(--glass-bg-solid);
            min-height: 400px;
            height: 100%;
            width: 100%;
            position: relative;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            border: 1px solid var(--glass-border);
            padding: 2rem;
          ">
            <story />
          </div>
        `
      }
    }
  ]
}

export default meta
type Story = StoryObj<typeof AuthStatusNotice>

export const Default: Story = {
  render: () => ({
    components: { AuthStatusNotice },
    template: '<AuthStatusNotice @close="() => {}" @learnMore="() => {}" />'
  })
}
