import type { Meta, StoryObj } from '@storybook/vue3'
import LoginForm from '@/components/auth/LoginForm.vue'
import { ref, h } from 'vue'

const meta: Meta<typeof LoginForm> = {
  title: '🔐 Auth/LoginForm',
  component: LoginForm,
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
        <div class="login-form-story-container" style="
          background: var(--app-background-gradient);
          height: 600px;
          width: 100%;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
        ">
          <!-- Force absolute positioning for the container within this wrapper -->
          <style>
             .login-form-story-container .auth-container {
               margin: 0 !important;
               max-height: 90% !important;
               overflow-y: auto !important;
             }
          </style>
          <story />
        </div>
      `
    })
  ]
}

export default meta
type Story = StoryObj<typeof LoginForm>

export const Default: Story = {
  args: {
    email: '',
    password: '',
    errorMessage: null,
    isLoading: false
  }
}

export const WithError: Story = {
  args: {
    email: 'test@example.com',
    password: 'wrongpassword',
    errorMessage: 'Invalid email or password',
    isLoading: false
  }
}

export const Loading: Story = {
  args: {
    email: '',
    password: '',
    errorMessage: null,
    isLoading: true
  }
}

export const Filled: Story = {
  args: {
    email: 'user@example.com',
    password: 'password123',
    errorMessage: null,
    isLoading: false
  }
}

export const WithGoogleSignIn: Story = {
  args: {
    email: '',
    password: '',
    errorMessage: null,
    isLoading: false
  },
  render: (args) => ({
    components: { LoginForm, GoogleSignInButton: () => h('div', { class: 'google-signin-placeholder', style: 'height: 40px; background: var(--surface-secondary); display: flex; align-items: center; justify-content: center; color: var(--text-primary);' }, 'Google Sign-In Button') },
    setup() {
      const email = ref(args.email)
      const password = ref(args.password)
      const errorMessage = ref(args.errorMessage)
      const isLoading = ref(args.isLoading)

      return { args, email, password, errorMessage, isLoading }
    },
    template: `
      <LoginForm
        v-model:email="email"
        v-model:password="password"
        :errorMessage="errorMessage"
        :isLoading="isLoading"
        @success="console.log('Login successful')"
        @switchToSignup="console.log('Switch to signup')"
        @forgotPassword="console.log('Forgot password clicked')"
      >
        <template #google-signin>
          <GoogleSignInButton @success="console.log('Google sign-in successful')" />
        </template>
      </LoginForm>
    `
  })
}
