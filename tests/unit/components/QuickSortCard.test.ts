// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import QuickSortCard from '@/components/QuickSortCard.vue'

describe('QuickSortCard.vue', () => {
  const task = {
    id: '1',
    title: 'Test Task',
    description: 'Test Description',
    priority: 'medium' as const,
    dueDate: '2023-12-31T00:00:00.000Z',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'todo' as const,
    order: 0,
    projectId: '1'
  }

  it('renders priority buttons with accessibility attributes', () => {
    const wrapper = mount(QuickSortCard, {
      props: { task },
      global: {
        stubs: {
          MarkdownRenderer: true,
          ArrowRight: true,
          ArrowLeft: true
        }
      }
    })

    const priorityGroup = wrapper.find('.priority-buttons')
    expect(priorityGroup.exists()).toBe(true)
    expect(priorityGroup.attributes('role')).toBe('group')
    expect(priorityGroup.attributes('aria-label')).toBe('Set priority')

    const lowBtn = priorityGroup.find('.priority-btn:nth-child(1)')
    expect(lowBtn.attributes('aria-label')).toBe('Set priority to Low')

    const medBtn = priorityGroup.find('.priority-btn:nth-child(2)')
    expect(medBtn.attributes('aria-label')).toBe('Set priority to Medium')

    const highBtn = priorityGroup.find('.priority-btn:nth-child(3)')
    expect(highBtn.attributes('aria-label')).toBe('Set priority to High')
  })

  it('renders date buttons with accessibility attributes', () => {
    const wrapper = mount(QuickSortCard, {
      props: { task },
      global: {
        stubs: {
          MarkdownRenderer: true,
          ArrowRight: true,
          ArrowLeft: true
        }
      }
    })

    const dateGroup = wrapper.find('.date-shortcuts')
    expect(dateGroup.exists()).toBe(true)
    expect(dateGroup.attributes('role')).toBe('group')
    expect(dateGroup.attributes('aria-label')).toBe('Quick reschedule')

    const todayBtn = dateGroup.find('.quick-date-btn:nth-child(1)')
    expect(todayBtn.attributes('aria-label')).toBe('Set due date to Today')

    const tomorrowBtn = dateGroup.find('.quick-date-btn:nth-child(2)')
    expect(tomorrowBtn.attributes('aria-label')).toBe('Set due date to Tomorrow')

    const nextWeekBtn = dateGroup.find('.quick-date-btn:nth-child(3)')
    expect(nextWeekBtn.attributes('aria-label')).toBe('Set due date to Next Week')

    const clearBtn = dateGroup.find('.quick-date-btn.clear-btn')
    expect(clearBtn.attributes('aria-label')).toBe('Clear due date')
  })
})
