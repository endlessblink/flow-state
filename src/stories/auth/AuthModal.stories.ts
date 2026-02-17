import type { Meta, StoryObj } from '@storybook/vue3'
import AuthModal from '@/components/auth/AuthModal.vue'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import LoginForm from '@/components/auth/LoginForm.vue'
import SignupForm from '@/components/auth/SignupForm.vue'
import GoogleSignInButton from '@/components/auth/GoogleSignInButton.vue'
import ResetPasswordViewComponent from '@/components/auth/ResetPasswordView.vue'

const meta: Meta<typeof AuthModal> = {
  title: '🔐 Auth/AuthModal',
  component: AuthModal,
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
      // Inject styles dynamically to avoid Vue template compilation error
      if (typeof document !== 'undefined') {
        const styleId = 'auth-modal-story-styles'
        if (!document.getElementById(styleId)) {
          const style = document.createElement('style')
          style.id = styleId
          style.textContent = `
            .auth-modal-story-container .modal-overlay {
              position: absolute !important;
              width: 100% !important;
              height: 100% !important;
              z-index: 10 !important;
            }
            .auth-modal-story-container .modal-container {
              max-height: 90% !important;
              box-shadow: none !important;
            }
          `
          document.head.appendChild(style)
        }
      }
      return {
        components: { story },
        template: `
          <div class="auth-modal-story-container" style="
            background: var(--glass-bg-solid);
            min-height: 600px;
            height: 100%;
            width: 100%;
            position: relative;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: var(--radius-lg);
            border: 1px solid var(--glass-border);
          ">
            <story />
          </div>
        `
      }
    }
  ]
}

export default meta
type Story = StoryObj<typeof AuthModal>

const mockRouter = {
  currentRoute: {
    value: { fullPath: '/' }
  },
  push: () => Promise.resolve()
}

export const Login: Story = {
  name: 'Login View',
  args: {
    isOpen: true,
    view: 'login'
  },
  render: (args: any) => ({
    components: { AuthModal, LoginForm, GoogleSignInButton },
    setup() {
      const uiStore = useUIStore()
      const authStore = useAuthStore()

      // Mock stores for Storybook
      uiStore.authModalOpen = args.isOpen
      uiStore.authModalView = args.view

      // CRITICAL: Reset auth state to prevent modal from auto-closing via watcher
      authStore.user = null
      authStore.isAuthenticated = false

      // Provide mock router manually if needed, or rely on global router decorator
      // but creating a local mock is safer for access like router.currentRoute.value
      // Note: Vue Router 4 composables are hard to mock without a provider,
      // but the global decorator in preview.ts should handle it.
      // We will ensure uiStore state is correct.

      return { args, uiStore, authStore }
    },
    template: `
      <AuthModal
        :is-open="uiStore.authModalOpen"
        @close="uiStore.closeAuthModal"
        @success="authStore.isAuthenticated = true"
        @switch-to-signup="uiStore.switchAuthView('signup')"
        @forgot-password="uiStore.switchAuthView('reset-password')"
      >
        <template #google-signin>
          <GoogleSignInButton @success="authStore.isAuthenticated = true" />
        </template>
      </AuthModal>
    `
  })
}

export const Signup: Story = {
  name: 'Signup View',
  args: {
    isOpen: true,
    view: 'signup'
  },
  render: (args: any) => ({
    components: { AuthModal, SignupForm, GoogleSignInButton },
    setup() {
      const uiStore = useUIStore()
      const authStore = useAuthStore()

      // Mock stores for Storybook
      uiStore.authModalOpen = args.isOpen
      uiStore.authModalView = args.view

      // CRITICAL: Reset auth state
      authStore.user = null
      authStore.isAuthenticated = false

      return { args, uiStore, authStore }
    },
    template: `
      <AuthModal
        :is-open="uiStore.authModalOpen"
        @close="uiStore.closeAuthModal"
        @success="authStore.isAuthenticated = true"
        @switch-to-signup="uiStore.switchAuthView('signup')"
        @forgot-password="uiStore.switchAuthView('reset-password')"
      >
        <template #google-signin>
          <GoogleSignInButton @success="authStore.isAuthenticated = true" />
        </template>
      </AuthModal>
    `
  })
}

export const ResetPassword: Story = {
  name: 'Reset Password View',
  args: {
    isOpen: true,
    view: 'reset-password'
  },
  render: (args: any) => ({
    components: { AuthModal, ResetPasswordView: ResetPasswordViewComponent },
    setup() {
      const uiStore = useUIStore()
      const authStore = useAuthStore()

      // Mock stores for Storybook
      uiStore.authModalOpen = args.isOpen
      uiStore.authModalView = args.view

      // CRITICAL: Reset auth state
      authStore.user = null
      authStore.isAuthenticated = false

      return { args, uiStore, authStore }
    },
    template: `
      <AuthModal
        :is-open="uiStore.authModalOpen"
        @close="uiStore.closeAuthModal"
        @success="authStore.isAuthenticated = true"
        @switch-to-login="uiStore.switchAuthView('login')"
      />
    `
  })
}
