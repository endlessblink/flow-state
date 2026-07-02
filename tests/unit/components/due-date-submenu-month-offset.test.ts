/**
 * BUG-1901 (part 2): the "+Nmo" quick options must anchor on the task's
 * CURRENT due date, not on today.
 *
 * User repro (2026-07-02): task due Jul 1, user picks "+1mo" expecting Aug 1 —
 * got Aug 2 because emitMonthOffset did `new Date()` (today, Jul 2) +1 month.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DueDateSubmenu from '@/components/tasks/context-menu/DueDateSubmenu.vue'

describe('BUG-1901: DueDateSubmenu +Nmo anchoring', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // "Today" = 2026-07-02 (the user's repro day)
    vi.setSystemTime(new Date(2026, 6, 2, 12, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function pickPlusOneMonth(currentDueDate: string | null) {
    const wrapper = mount(DueDateSubmenu, {
      props: { isVisible: true, parentVisible: true, style: {}, currentDueDate },
      attachTo: document.body,
    })
    // Component teleports to body — query the document, not the wrapper
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === '+1mo')
    expect(btn, '+1mo button not found').toBeTruthy()
    btn!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()
    const emitted = wrapper.emitted('pickDate')
    expect(emitted, 'pickDate not emitted').toBeTruthy()
    const ts = emitted![0][0] as number
    wrapper.unmount()
    return new Date(ts)
  }

  it('anchors +1mo on the current due date (Jul 1 → Aug 1, NOT Aug 2)', async () => {
    const d = await pickPlusOneMonth('2026-07-01')
    expect(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`).toBe('2026-8-1')
  })

  it('falls back to today when the task has no due date (Jul 2 → Aug 2)', async () => {
    const d = await pickPlusOneMonth(null)
    expect(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`).toBe('2026-8-2')
  })

  it('anchors on a PAST due date too, not on today', async () => {
    const d = await pickPlusOneMonth('2026-06-15')
    expect(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`).toBe('2026-7-15')
  })
})
