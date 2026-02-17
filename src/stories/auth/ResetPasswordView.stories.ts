import type { Meta, StoryObj } from '@storybook/vue3'
import ResetPasswordView from '@/components/auth/ResetPasswordView.vue'

const meta: Meta<typeof ResetPasswordView> = {
  title: '🔐 Auth/ResetPasswordView',
  component: ResetPasswordView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      story: {
        inline: true,
        iframeHeight: 600,
      }
    }
  },
  decorators: [
    () => ({
      template: `
        <div style="
          background: var(--glass-bg-solid);
          min-height: 600px;
          padding: var(--space-8);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <story />
        </div>
      `
    })
  ]
}

export default meta
type Story = StoryObj<typeof ResetPasswordView>

export const Default: Story = {
  render: () => ({
    components: { ResetPasswordView },
    template: `
      <ResetPasswordView
        @switchToLogin="() => console.log('Switch to login')"
        @success="() => console.log('Success')"
      />
    `,
  }),
}

export const WithPrefilledEmail: Story = {
  render: () => ({
    components: { ResetPasswordView },
    template: `
      <ResetPasswordView
        prefilled-email="user@example.com"
        @switchToLogin="() => console.log('Switch to login')"
        @success="() => console.log('Success')"
      />
    `,
  }),
}
