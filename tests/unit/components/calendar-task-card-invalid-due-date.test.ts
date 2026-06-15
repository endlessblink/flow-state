import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowMount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CalendarTaskCard from '@/components/inbox/calendar/CalendarTaskCard.vue'

vi.mock('@/composables/useReactiveDate', () => ({
  reactiveToday: { value: new Date('2026-06-15T00:00:00') },
  ensureDateTimer: () => {},
}))

describe('CalendarTaskCard invalid due dates', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const mountCard = (dueDate?: string): VueWrapper => {
    const task = {
      id: `task-${dueDate ?? 'no-due-date'}`,
      title: 'Legacy task',
      status: 'todo',
      dueDate,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any

    return shallowMount(CalendarTaskCard, {
      props: {
        task,
        isTimerActive: false,
      },
    })
  }

  it.each([
    'not-a-date',
    '2026-99-99',
    '2026-02-30',
    '2026-99-99T12:00:00Z',
  ])('renders without throwing and omits the due badge for malformed value %s', (dueDate) => {
    let wrapper: VueWrapper | undefined
    expect(() => {
      wrapper = mountCard(dueDate)
    }).not.toThrow()

    expect(wrapper!.find('.due-date-badge').exists()).toBe(false)
    wrapper!.unmount()
  })

  it.each([
    {
      dueDate: '2026-06-15',
      expectedClass: 'due-badge-today',
      expectedLabel: 'Today',
    },
    {
      dueDate: '2026-06-14T18:30:00.000Z',
      expectedClass: 'due-badge-overdue',
      expectedLabel: 'Overdue Jun 14',
    },
    {
      dueDate: '2026-06-16',
      expectedClass: 'due-badge-future',
      expectedLabel: 'Jun 16',
    },
  ])('preserves the due badge for $dueDate', ({ dueDate, expectedClass, expectedLabel }) => {
    const wrapper = mountCard(dueDate)
    const badge = wrapper.get('.due-date-badge')

    expect(badge.classes()).toContain(expectedClass)
    expect(badge.text()).toContain(expectedLabel)
    wrapper.unmount()
  })
})
