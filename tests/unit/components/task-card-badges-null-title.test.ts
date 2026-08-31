/**
 * BUG-1795: TaskCardBadges must not crash when a task has a null/undefined title.
 *
 * Regression: `hasTaskTitle` previously did `props.task.title.trim()`, which threw
 * "Cannot read properties of undefined (reading 'trim')" and took down the whole
 * Board view AND the Canvas (via the canvas inbox panel's TaskCard list).
 *
 * No production source code is modified by this file.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import TaskCardBadges from '@/components/kanban/card/TaskCardBadges.vue'

// Heavy/browser-dependent deps stubbed to keep the mount focused on the guard.
vi.mock('@/composables/useReactiveDate', () => ({
  reactiveToday: { value: new Date('2026-05-23T00:00:00Z') },
  ensureDateTimer: () => {},
}))
vi.mock('@/composables/tasks/useWorkBlockProgress', () => ({
  useWorkBlockProgress: () => ({
    workedMinutesToday: { value: 0 },
    isEnoughForToday: { value: false },
  }),
}))
vi.mock('@/utils/recurrenceUtils', () => ({
  describeRecurrenceRule: () => '',
}))

const baseProps = {
  density: 'comfortable' as const,
  formattedDueDate: '',
  formattedDuration: '',
  completedSubtasks: 0,
  hasDependencies: false,
  durationBadgeClass: '',
  projectVisual: null,
}

describe('TaskCardBadges — null/undefined title', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders without throwing when task.title is undefined', () => {
    const task = { id: 't1', status: 'todo' } as any // title intentionally absent
    expect(() => {
      const wrapper = shallowMount(TaskCardBadges, {
        props: { ...baseProps, task },
      })
      wrapper.unmount()
    }).not.toThrow()
  })

  it('renders without throwing when task.title is null', () => {
    const task = { id: 't2', status: 'todo', title: null } as any
    expect(() => {
      const wrapper = shallowMount(TaskCardBadges, {
        props: { ...baseProps, task },
      })
      wrapper.unmount()
    }).not.toThrow()
  })

  it('shows the completion date instead of the unchanged due date for a completed task', () => {
    const wrapper = shallowMount(TaskCardBadges, {
      props: {
        ...baseProps,
        task: {
          id: 'completed-task',
          title: 'Completed task',
          status: 'done',
          dueDate: '2026-08-30',
          completedAt: new Date('2026-08-31T10:00:00Z'),
        } as any,
        formattedDueDate: 'Aug 30',
        formattedCompletedDate: 'Aug 31',
      },
    })

    expect(wrapper.text()).toContain('Completed Aug 31')
    expect(wrapper.text()).not.toContain('Aug 30')
  })
})
