import type { Meta, StoryObj } from '@storybook/vue3'
import SignupForm from '@/components/auth/SignupForm.vue'
import { ref } from 'vue'

const meta: Meta<typeof SignupForm> = {
  title: 'Auth/SignupForm',
  component: SignupForm,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      story: {
        inline: false,
        iframeHeight: 800,
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
        ">
          <story />
        </div>
      `
    })
  ]
}

export default meta
type Story = StoryObj<typeof SignupForm>

export const Default: Story = {
  args: {
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
    errorMessage: null,
    isLoading: false
  }
}

export const WithError: Story = {
  args: {
    displayName: 'Test User',
    email: 'test@example.com',
    password: 'password',
    confirmPassword: 'different',
    errorMessage: 'Passwords do not match',
    isLoading: false
  }
}

export const Loading: Story = {
  args: {
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
    errorMessage: null,
    isLoading: true
  }
}

export const Filled: Story = {
  args: {
    displayName: 'John Doe',
    email: 'john@example.com',
    password: 'Password123!',
    confirmPassword: 'Password123!',
    errorMessage: null,
    isLoading: false
  }
}

export const StrongPassword: Story = {
  args: {
    displayName: 'Strong User',
    email: 'strong@example.com',
    password: 'Password123!@#$',
    confirmPassword: 'Password123!@#$',
    errorMessage: null,
    isLoading: false
  }
}

export const WeakPassword: Story = {
  args: {
    displayName: 'Weak User',
    email: 'weak@example.com',
    password: '123',
    confirmPassword: '123',
    errorMessage: null,
    isLoading: false
  }
}

export const WithGoogleSignIn: Story = {
  args: {
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
    errorMessage: null,
    isLoading: false
  },
  render: (args) => ({
    components: { SignupForm, GoogleSignInButton: () => <div class="google-signin-placeholder" style="height: 40px; background: var(--surface-secondary); display: flex; align-items: center; justify-content: center; color: var(--text-primary);">Google Sign-In Button</div> },
    setup() {
      const displayName = ref(args.displayName)
      const email = ref(args.email)
      const password = ref(args.password)
      const confirmPassword = ref(args.confirmPassword)
      const errorMessage = ref(args.errorMessage)
      const isLoading = ref(args.isLoading)

      return { args, displayName, email, password, confirmPassword, errorMessage, isLoading }
    },
    template: `
      <SignupForm
        v-model:displayName="displayName"
        v-model:email="email"
        v-model:password="password"
        v-model:confirmPassword="confirmPassword"
        :errorMessage="errorMessage"
        :isLoading="isLoading"
        @success="console.log('Signup successful')"
        @switchToLogin="console.log('Switch to login')"
      >
        <template #google-signin>
          <GoogleSignInButton @success="console.log('Google sign-in successful')" />
        </template>
      </SignupForm>
    `
  })
}