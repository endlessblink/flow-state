import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CalendarTaskCard from '@/components/inbox/calendar/CalendarTaskCard.vue'

vi.mock('@/composables/useReactiveDate', () => ({
  reactiveToday: { value: new Date('2026-06-15T00:00:00') },
  ensureDateTimer: () => {},
}))

describe('CalendarTaskCard invalid due dates', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders without throwing and omits the due badge for a malformed due date', () => {
    const task = {
      id: 'malformed-due-date',
      title: 'Legacy task',
      status: 'todo',
      dueDate: 'not-a-date',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any

    let wrapper: ReturnType<typeof shallowMount> | undefined

    expect(() => {
      wrapper = shallowMount(CalendarTaskCard, {
        props: {
          task,
          isTimerActive: false,
        },
      })
    }).not.toThrow()

    expect(wrapper!.find('.due-date-badge').exists()).toBe(false)
    wrapper!.unmount()
  })
})
