import type { Meta, StoryObj } from '@storybook/vue3'
import ResetPasswordView from '@/components/auth/ResetPasswordView.vue'
import { ref } from 'vue'

const meta: Meta<typeof ResetPasswordView> = {
  title: 'Auth/ResetPasswordView',
  component: ResetPasswordView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      story: {
        inline: false,
        iframeHeight: 700,
      }
    }
  },
  decorators: [
    () => ({
      template: `
        <div style="
          background: var(--surface-primary);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
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
  args: {
    prefilledEmail: '',
    errorMessage: null,
    isLoading: false
  }
}

export const WithEmail: Story = {
  args: {
    prefilledEmail: 'user@example.com',
    errorMessage: null,
    isLoading: false
  }
}

export const WithError: Story = {
  args: {
    prefilledEmail: 'user@example.com',
    errorMessage: 'Email not found',
    isLoading: false
  }
}

export const Loading: Story = {
  args: {
    prefilledEmail: 'user@example.com',
    errorMessage: null,
    isLoading: true
  }
}

export const Success: Story = {
  args: {
    prefilledEmail: 'user@example.com',
    errorMessage: null,
    isLoading: false
  },
  render: (args) => ({
    components: { ResetPasswordView },
    setup() {
      const showSuccess = ref(true)
      const successMessage = ref('Password reset email sent successfully!')

      const handleSuccess = () => {
        showSuccess.value = true
        console.log('Password reset successful')
      }

      return { args, showSuccess, successMessage, handleSuccess }
    },
    template: `
      <div>
        <ResetPasswordView
          :prefilled-email="args.prefilledEmail"
          :errorMessage="args.errorMessage"
          :isLoading="args.isLoading"
          @success="handleSuccess"
          @switch-to-login="console.log('Switch to login')"
        />
        <div v-if="showSuccess" class="success-message" style="margin-top: 1rem; color: var(--color-success);">
          {{ successMessage }}
        </div>
      </div>
    `
  })
}