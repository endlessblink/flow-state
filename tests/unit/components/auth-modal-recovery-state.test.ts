import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'

const authState = reactive({
  user: null as null | { id: string; email: string },
  isAuthenticated: false,
  isRestoringSession: false,
  reauthRequired: false,
})

const uiState = reactive({
  authModalOpen: true,
  authModalView: 'login',
  authModalRedirect: null as string | null,
  closeAuthModal: vi.fn(),
  switchAuthView: vi.fn(),
})

vi.mock('@/stores/auth', () => ({ useAuthStore: () => authState }))
vi.mock('@/stores/ui', () => ({ useUIStore: () => uiState }))
vi.mock('vue-router', () => ({
  useRouter: () => ({ currentRoute: { value: { fullPath: '/' } }, push: vi.fn() }),
}))

import AuthModal from '@/components/auth/AuthModal.vue'

const mountModal = () => mount(AuthModal, {
  global: {
    stubs: {
      BaseModal: { template: '<div><slot name="title" /><slot /></div>' },
      LoginForm: { template: '<div data-testid="login-form">Sign In</div>' },
      SignupForm: { template: '<div data-testid="signup-form">Sign Up</div>' },
      GoogleSignInButton: true,
      ResetPasswordView: true,
    },
  },
})

describe('AuthModal remembered-account recovery state', () => {
  beforeEach(() => {
    authState.user = null
    authState.isAuthenticated = false
    authState.isRestoringSession = false
    authState.reauthRequired = false
    uiState.authModalOpen = true
    uiState.authModalView = 'login'
    uiState.closeAuthModal.mockClear()
    uiState.switchAuthView.mockReset()
    uiState.switchAuthView.mockImplementation((view: string) => {
      uiState.authModalView = view
    })
  })

  it('replaces the sign-in form with restoring status for a remembered account', () => {
    authState.user = { id: 'remembered-user', email: 'remembered@example.com' }
    authState.isRestoringSession = true

    const wrapper = mountModal()

    expect(wrapper.get('[data-testid="account-recovery"]').text()).toContain('Restoring your FlowState account')
    expect(wrapper.text()).toContain('remembered@example.com')
    expect(wrapper.find('[data-testid="login-form"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Sign In')
  })

  it('lets a remembered account open the sign-in form when reauthentication is required', async () => {
    authState.user = { id: 'remembered-user', email: 'remembered@example.com' }
    authState.isRestoringSession = true
    authState.reauthRequired = true
    uiState.authModalView = 'signup'

    const wrapper = mountModal()

    expect(wrapper.get('[data-testid="account-recovery"]').text()).toContain('Reconnecting your FlowState account')
    expect(wrapper.find('[data-testid="login-form"]').exists()).toBe(false)
    await wrapper.get('[data-testid="reconnect-account"]').trigger('click')
    expect(uiState.switchAuthView).toHaveBeenCalledWith('login')
    expect(wrapper.find('[data-testid="account-recovery"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="login-form"]').text()).toContain('Sign In')
  })

  it('keeps the normal sign-in form for a confirmed guest', () => {
    const wrapper = mountModal()

    expect(wrapper.find('[data-testid="login-form"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="account-recovery"]').exists()).toBe(false)
  })

  it('closes a stale sign-in modal as soon as the remembered account appears', async () => {
    mountModal()

    authState.isAuthenticated = true
    authState.isRestoringSession = false
    authState.user = { id: 'remembered-user', email: 'remembered@example.com' }
    await nextTick()
    await nextTick()

    expect(uiState.closeAuthModal).toHaveBeenCalled()
  })

  it('does not close a reconnect modal when a remembered identity appears', async () => {
    mountModal()
    uiState.closeAuthModal.mockClear()

    authState.isRestoringSession = true
    authState.user = { id: 'remembered-user', email: 'remembered@example.com' }
    authState.isAuthenticated = true
    await nextTick()
    authState.reauthRequired = true
    await nextTick()

    expect(uiState.closeAuthModal).not.toHaveBeenCalled()
  })
})
