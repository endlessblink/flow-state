import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'

const ONBOARDING_KEY = 'flowstate-onboarding-v2'
const LEGACY_KEY = 'flowstate-welcome-seen'

export function useOnboardingWizard() {
  const authStore = useAuthStore()
  const uiStore = useUIStore()

  // Check if user has already seen onboarding (new key OR legacy key)
  const alreadySeen = !!localStorage.getItem(ONBOARDING_KEY) || !!localStorage.getItem(LEGACY_KEY)

  const isVisible = ref(!alreadySeen)
  const isAuthenticated = computed(() => authStore.isAuthenticated)

  function dismiss() {
    isVisible.value = false
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({
      seen: true,
      version: 2,
      dismissedAt: new Date().toISOString(),
    }))
    // Backward compat — also set legacy key
    localStorage.setItem(LEGACY_KEY, 'true')
  }

  function openSignUp() {
    dismiss()
    uiStore.openAuthModal('signup')
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!isVisible.value) return
    if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault()
      dismiss()
    }
  }

  return {
    isVisible,
    isAuthenticated,
    dismiss,
    openSignUp,
    handleKeydown,
  }
}
