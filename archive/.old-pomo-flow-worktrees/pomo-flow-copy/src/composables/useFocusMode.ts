import { ref, provide, inject, type Ref } from 'vue'
import { useRouter } from 'vue-router'

export const FOCUS_MODE_KEY = Symbol('focusMode')

export interface FocusModeState {
  isActive: Ref<boolean>
  focusedTaskId: Ref<string | null>
  enterFocusMode: (taskId: string) => void
  exitFocusMode: () => void
}

export function provideFocusMode() {
  const router = useRouter()
  const isActive = ref(false)
  const focusedTaskId = ref<string | null>(null)

  const enterFocusMode = (taskId: string) => {
    focusedTaskId.value = taskId
    isActive.value = true
    router.push(`/focus/${taskId}`)
  }

  const exitFocusMode = () => {
    isActive.value = false
    focusedTaskId.value = null
    router.push('/')
  }

  const state: FocusModeState = {
    isActive,
    focusedTaskId,
    enterFocusMode,
    exitFocusMode
  }

  provide(FOCUS_MODE_KEY, state)

  return state
}

export function useFocusMode(): FocusModeState {
  const state = inject<FocusModeState>(FOCUS_MODE_KEY)
  if (!state) {
    throw new Error('useFocusMode must be used within a component that calls provideFocusMode')
  }
  return state
}
