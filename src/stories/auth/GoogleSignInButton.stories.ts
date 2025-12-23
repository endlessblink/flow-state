import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import GoogleSignInButton from '@/components/auth/GoogleSignInButton.vue'

const meta: Meta<typeof GoogleSignInButton> = {
  title: '🔐 Auth/GoogleSignInButton',
  component: GoogleSignInButton,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      story: {
        inline: false,
        iframeHeight: 600,
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
type Story = StoryObj<typeof GoogleSignInButton>

export const Default: Story = {
  args: {
    text: 'Sign in with Google',
    size: 'md',
    variant: 'primary'
  }
}

export const Loading: Story = {
  args: {
    text: 'Signing in...',
    size: 'md',
    variant: 'primary',
    loading: true
  }
}

export const Small: Story = {
  args: {
    text: 'Sign in with Google',
    size: 'sm',
    variant: 'primary'
  }
}

export const Large: Story = {
  args: {
    text: 'Sign in with Google',
    size: 'lg',
    variant: 'primary'
  }
}

export const Secondary: Story = {
  args: {
    text: 'Sign in with Google',
    size: 'md',
    variant: 'secondary'
  }
}

export const WithoutText: Story = {
  args: {
    text: '',
    size: 'md',
    variant: 'primary'
  }
}

export const WithError: Story = {
  args: {
    text: 'Sign in with Google',
    size: 'md',
    variant: 'primary'
  },
  render: (args) => ({
    components: { GoogleSignInButton },
    setup() {
      const hasError = ref(false)
      const errorMessage = ref('Google sign-in failed. Please try again.')

      const handleSuccess = () => {
        console.log('Google sign-in successful')
      }

      const handleError = () => {
        hasError.value = true
        console.error('Google sign-in error')
      }

      return { args, hasError, errorMessage, handleSuccess, handleError }
    },
    template: `
      <div>
        <GoogleSignInButton
          :text="args.text"
          :size="args.size"
          :variant="args.variant"
          :loading="args.loading"
          @success="handleSuccess"
          @error="handleError"
        />
        <div v-if="hasError" class="error-message" style="margin-top: 1rem; color: var(--color-danger);">
          {{ errorMessage }}
        </div>
      </div>
    `
  })
}
