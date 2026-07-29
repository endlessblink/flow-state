import { beforeEach, describe, expect, it } from 'vitest'
import { useToast } from '../useToast'

describe('useToast surface', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('renders task failure alerts on an opaque status surface', () => {
    useToast().showToast(
      'Task could not be completed. Refresh and try again.',
      'error',
      { duration: 0 },
    )

    const toast = document.querySelector<HTMLDivElement>('#toast-container > div')

    expect(toast).not.toBeNull()
    expect(toast?.style.background).toBe('var(--overlay-component-bg)')
    expect(toast?.style.backdropFilter).toBeUndefined()
  })
})
