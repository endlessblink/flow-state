import { ref, provide, inject, type Ref } from 'vue'

const PROGRESSIVE_DISCLOSURE_KEY = Symbol('progressiveDisclosure')
const STORAGE_KEY = 'pomo-flow-progressive-disclosure'

export interface ProgressiveDisclosureState {
  enabled: Ref<boolean>
  toggleEnabled: () => void
  setEnabled: (value: boolean) => void
}

export function provideProgressiveDisclosure() {
  // Load from localStorage or default to FALSE (disabled by default for safety)
  const savedEnabled = localStorage.getItem(STORAGE_KEY)
  const enabled = ref<boolean>(savedEnabled === 'true')

  const toggleEnabled = () => {
    enabled.value = !enabled.value
    localStorage.setItem(STORAGE_KEY, String(enabled.value))
  }

  const setEnabled = (value: boolean) => {
    enabled.value = value
    localStorage.setItem(STORAGE_KEY, String(value))
  }

  const state: ProgressiveDisclosureState = {
    enabled,
    toggleEnabled,
    setEnabled
  }

  provide(PROGRESSIVE_DISCLOSURE_KEY, state)

  return state
}

export function useProgressiveDisclosure(): ProgressiveDisclosureState {
  const state = inject<ProgressiveDisclosureState>(PROGRESSIVE_DISCLOSURE_KEY)
  if (!state) {
    // Fallback if not provided - disabled by default
    return {
      enabled: ref(false),
      toggleEnabled: () => {},
      setEnabled: () => {}
    }
  }
  return state
}
