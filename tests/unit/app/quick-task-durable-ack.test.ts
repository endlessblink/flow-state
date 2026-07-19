import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('vue-router', () => ({ useRoute: () => ({ path: '/canvas' }) }))
vi.mock('@/stores/tasks', () => ({
  useTaskStore: () => ({
    activeSmartView: 'all',
    createTaskWithUndo: vi.fn()
  })
}))
vi.mock('@/composables/useWhisperSpeech', () => ({
  useWhisperSpeech: () => ({
    isRecording: { value: false },
    isProcessing: { value: false },
    transcript: { value: '' },
    error: { value: null },
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    cancelRecording: vi.fn()
  })
}))
vi.mock('@/composables/tasks/useFilterDefaults', () => ({
  useFilterDefaults: () => ({ filterDefaults: { value: {} } })
}))

import { useQuickTaskInput } from '@/composables/app/useQuickTaskInput'

describe('sidebar quick task durable acknowledgement', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('keeps the draft and withholds success when Canvas creation fails', async () => {
    const input = useQuickTaskInput()
    input.quickTaskText.value = 'Do not disappear'
    const listener = (event: Event) => {
      event.preventDefault()
      ;(event as CustomEvent).detail.onComplete?.(false)
    }
    window.addEventListener('sidebar-quick-task-create', listener)

    await input.createQuickTask()

    expect(input.quickTaskText.value).toBe('Do not disappear')
    expect(input.showSuccessFlash.value).toBe(false)
    window.removeEventListener('sidebar-quick-task-create', listener)
  })

  it('times out without clearing the draft when a Canvas listener never acknowledges', async () => {
    vi.useFakeTimers()
    const input = useQuickTaskInput()
    input.quickTaskText.value = 'Still must not disappear'
    const listener = (event: Event) => event.preventDefault()
    window.addEventListener('sidebar-quick-task-create', listener)

    const creation = input.createQuickTask()
    await vi.advanceTimersByTimeAsync(15_000)
    await creation

    expect(input.quickTaskText.value).toBe('Still must not disappear')
    expect(input.showSuccessFlash.value).toBe(false)
    window.removeEventListener('sidebar-quick-task-create', listener)
  })

  it('dispatches only one Canvas create while acknowledgement is pending', async () => {
    const input = useQuickTaskInput()
    input.quickTaskText.value = 'One task only'
    let dispatchCount = 0
    let complete: ((saved: boolean) => void) | undefined
    const listener = (event: Event) => {
      event.preventDefault()
      dispatchCount++
      complete = (event as CustomEvent).detail.onComplete
    }
    window.addEventListener('sidebar-quick-task-create', listener)

    const first = input.createQuickTask()
    const second = input.createQuickTask()
    expect(dispatchCount).toBe(1)
    expect(input.isQuickTaskSubmitting.value).toBe(true)
    complete?.(true)
    await Promise.all([first, second])

    expect(input.quickTaskText.value).toBe('')
    expect(input.isQuickTaskSubmitting.value).toBe(false)
    window.removeEventListener('sidebar-quick-task-create', listener)
  })

  it('does not erase a newer draft when the submitted task is acknowledged', async () => {
    const input = useQuickTaskInput()
    input.quickTaskText.value = 'First task'
    let complete: ((saved: boolean) => void) | undefined
    const listener = (event: Event) => {
      event.preventDefault()
      complete = (event as CustomEvent).detail.onComplete
    }
    window.addEventListener('sidebar-quick-task-create', listener)

    const creation = input.createQuickTask()
    input.quickTaskText.value = 'Second task'
    complete?.(true)
    await creation

    expect(input.quickTaskText.value).toBe('Second task')
    window.removeEventListener('sidebar-quick-task-create', listener)
  })
})
