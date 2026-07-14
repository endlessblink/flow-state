import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'

const authState = reactive({
  user: null as null | { id: string; email: string },
  isInitialized: false,
  isRestoringSession: true,
})
const openAuthModal = vi.fn()

vi.mock('@/stores/auth', () => ({ useAuthStore: () => authState }))
vi.mock('@/stores/ui', () => ({ useUIStore: () => ({ openAuthModal, openSettingsModal: vi.fn() }) }))

import SidebarUserFooter from '@/components/sidebar/SidebarUserFooter.vue'

describe('SidebarUserFooter auth restoration state', () => {
  beforeEach(() => {
    authState.user = null
    authState.isInitialized = false
    authState.isRestoringSession = true
    openAuthModal.mockClear()
  })

  it('keeps account recovery visible while offering an immediate Sign In escape hatch', async () => {
    const wrapper = mount(SidebarUserFooter, {
      global: {
        mocks: { $t: (key: string) => key },
        stubs: { Settings: true },
      },
    })

    expect(wrapper.text()).toContain('sidebar.restoring_account')
    expect(wrapper.text()).toContain('sidebar.sign_in')
    await wrapper.get('button.sidebar-login-btn').trigger('click')
    expect(openAuthModal).toHaveBeenCalledWith('login')
  })

  it('shows Sign In only after initialization confirms guest mode', async () => {
    authState.isRestoringSession = false
    authState.isInitialized = true
    const wrapper = mount(SidebarUserFooter, {
      global: { mocks: { $t: (key: string) => key }, stubs: { Settings: true } },
    })

    expect(wrapper.text()).toContain('sidebar.sign_in')
    await wrapper.get('button.sidebar-login-btn').trigger('click')
    expect(openAuthModal).toHaveBeenCalledWith('login')
  })
})
