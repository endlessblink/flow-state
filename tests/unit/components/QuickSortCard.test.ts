import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import QuickSortCard from '@/components/QuickSortCard.vue'

// Mock Lucide icons
vi.mock('lucide-vue-next', () => ({
  ArrowRight: { template: '<span data-testid="arrow-right"></span>' },
  ArrowLeft: { template: '<span data-testid="arrow-left"></span>' }
}))

// Mock MarkdownRenderer
vi.mock('@/components/common/MarkdownRenderer.vue', () => ({
  default: {
    template: '<div class="markdown-renderer">{{ content }}</div>',
    props: ['content']
  }
}))

describe('QuickSortCard.vue', () => {
  const mockTask = {
    id: '1',
    title: 'Test Task',
    description: 'Test Description',
    priority: 'low',
    dueDate: '',
    status: 'planned',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any

  it('renders task title and description', () => {
    const wrapper = mount(QuickSortCard, {
      props: { task: mockTask }
    })
    expect(wrapper.text()).toContain('Test Task')
    expect(wrapper.text()).toContain('Test Description')
  })

  it('renders priority buttons', () => {
    const wrapper = mount(QuickSortCard, {
      props: { task: mockTask }
    })
    const buttons = wrapper.findAll('.priority-btn')
    expect(buttons).toHaveLength(3)
  })

  it('priority buttons have accessible labels', () => {
    const wrapper = mount(QuickSortCard, {
      props: { task: mockTask }
    })
    const buttons = wrapper.findAll('.priority-btn')

    expect(buttons[0].attributes('aria-label')).toBe('Set priority to Low')
    expect(buttons[1].attributes('aria-label')).toBe('Set priority to Medium')
    expect(buttons[2].attributes('aria-label')).toBe('Set priority to High')
  })

  it('date buttons have accessible labels', () => {
    const wrapper = mount(QuickSortCard, {
      props: { task: mockTask }
    })
    const buttons = wrapper.findAll('.quick-date-btn')
    // Today, +1, +7, Clear
    expect(buttons[0].attributes('aria-label')).toBe('Set due date to Today')
    expect(buttons[1].attributes('aria-label')).toBe('Set due date to Tomorrow')
    expect(buttons[2].attributes('aria-label')).toBe('Set due date to Next Week')
    expect(buttons[3].attributes('aria-label')).toBe('Clear due date')
  })
})
