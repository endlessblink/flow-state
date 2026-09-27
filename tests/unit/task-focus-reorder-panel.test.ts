/**
 * TASK-2104: Focused timeline "Up next" reorder panel — reliable moves,
 * minimal order writes, and no reshuffling under the user while saving.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import type { Task } from '@/types/tasks'
import { moveIdAfter, moveIdBy } from '@/components/kanban/taskFocusReorder'
import { setSharedOrderSectionResolver, visibleReorderUpdates } from '@/utils/taskOrdering'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key, locale: { value: 'en' } }) }))
vi.mock('vuedraggable', () => ({
  default: defineComponent({
    props: { modelValue: { type: Array, required: true } },
    setup(props, { slots }) {
      return () => h('ol', (props.modelValue as Task[]).map((element, index) => slots.item?.({ element, index })))
    },
  }),
}))

const task = (id: string, order: number | undefined, extra: Partial<Task> = {}) =>
  ({ id, title: `Task ${id}`, order, status: 'planned', priority: null, ...extra }) as unknown as Task

describe('focused timeline list moves', () => {
  it('moves by one within bounds and returns the same list when nothing changes', () => {
    const ids = ['a', 'b', 'c']
    expect(moveIdBy(ids, 'b', -1)).toEqual(['b', 'a', 'c'])
    expect(moveIdBy(ids, 'c', 1)).toBe(ids)
    expect(moveIdBy(ids, 'a', -1)).toBe(ids)
  })

  it('makes a task the next one after the current task', () => {
    expect(moveIdAfter(['now', 'b', 'c', 'd'], 'd', 'now')).toEqual(['now', 'd', 'b', 'c'])
    expect(moveIdAfter(['a', 'now', 'b'], 'a', 'now')).toEqual(['now', 'a', 'b'])
    const unchanged = ['now', 'b']
    expect(moveIdAfter(unchanged, 'b', 'now')).toBe(unchanged)
  })
})

describe('visibleReorderUpdates', () => {
  it('writes only the tasks whose position changed, reusing existing slots', () => {
    const tasks = [task('a', 10), task('b', 20), task('hidden', 25), task('c', 30), task('d', 40)]
    const visible = new Set(['a', 'b', 'c', 'd'])
    // Move d up one place: only c and d change.
    expect(visibleReorderUpdates(tasks, ['a', 'b', 'd', 'c'], visible)).toEqual([
      { id: 'd', order: 30 },
      { id: 'c', order: 40 },
    ])
  })

  it('never touches hidden tasks and falls back safely for legacy duplicate orders', () => {
    const tasks = [task('a', 1), task('b', 1), task('hidden', 2), task('c', undefined)]
    const updates = visibleReorderUpdates(tasks, ['c', 'a', 'b'], new Set(['a', 'b', 'c']))
    expect(updates.length).toBeGreaterThan(0)
    const orderOf = new Map(updates.map(update => [update.id, update.order]))
    const finalOrder = (id: string) => orderOf.get(id) ?? tasks.find(candidate => candidate.id === id)!.order!
    expect(finalOrder('c')).toBeLessThan(finalOrder('a'))
    expect(finalOrder('a')).toBeLessThan(finalOrder('b'))
  })
})

describe('TaskFocusReorderPanel', () => {
  afterEach(() => { vi.useRealTimers() })

  const mountPanel = async (tasks: Task[], activeTaskId = 'a') => {
    const { default: Panel } = await import('@/components/kanban/TaskFocusReorderPanel.vue')
    return mount(Panel, { props: { tasks, activeTaskId, sortIsManual: true }, attachTo: document.body })
  }

  it('Make next moves the task right after the current one and saves once', async () => {
    const wrapper = await mountPanel([task('a', 1), task('b', 2), task('c', 3)])
    const rows = wrapper.findAll('[data-reorder-task-id]')
    await rows[2].find('button[aria-label="kanban.make_next_named"]').trigger('click')
    expect(wrapper.emitted('reorder')).toEqual([[['a', 'c', 'b']]])
    wrapper.unmount()
  })

  it('keeps the user order while the save is pending, then follows the saved order', async () => {
    vi.useFakeTimers()
    const tasks = [task('a', 1), task('b', 2), task('c', 3)]
    const wrapper = await mountPanel(tasks)
    const rows = wrapper.findAll('[data-reorder-task-id]')
    await rows[2].find('button[aria-label="kanban.move_up_named"]').trigger('click')
    expect(wrapper.emitted('reorder')?.[0]).toEqual([['a', 'c', 'b']])

    // An unrelated realtime refresh arrives with the old order: no reshuffle.
    await wrapper.setProps({ tasks: [...tasks] })
    await nextTick()
    const order = () => wrapper.findAll('[data-reorder-task-id]').map(row => row.attributes('data-reorder-task-id'))
    expect(order()).toEqual(['a', 'c', 'b'])

    // The saved order arrives: panel follows it.
    await wrapper.setProps({ tasks: [tasks[0], tasks[2], tasks[1]] })
    expect(order()).toEqual(['a', 'c', 'b'])

    // A later external change is reflected once idle.
    await wrapper.setProps({ tasks: [tasks[2], tasks[0], tasks[1]] })
    expect(order()).toEqual(['c', 'a', 'b'])
    wrapper.unmount()
  })

  it('tells the user when reordering will switch the sort to Manual', async () => {
    const { default: Panel } = await import('@/components/kanban/TaskFocusReorderPanel.vue')
    const wrapper = mount(Panel, { props: { tasks: [task('a', 1)], activeTaskId: 'a', sortIsManual: false } })
    expect(wrapper.text()).toContain('kanban.reorder_switches_manual')
    wrapper.unmount()
  })

  it('keeps moves inside a Canvas day and labels each day (BUG-2106)', async () => {
    const sections: Record<string, { rank: number; key: string; label: string }> = {
      a: { rank: 0, key: 'today', label: 'Today' },
      b: { rank: 0, key: 'today', label: 'Today' },
      c: { rank: 1, key: 'thu', label: 'Thursday' },
    }
    setSharedOrderSectionResolver(candidate => sections[candidate.id])
    try {
      const wrapper = await mountPanel([task('a', 1), task('b', 2), task('c', 3)])
      const rows = wrapper.findAll('[data-reorder-task-id]')
      expect(rows[0].attributes('data-section-label')).toBe('Today')
      expect(rows[2].attributes('data-section-label')).toBe('Thursday')
      expect(rows[2].find('button[aria-label="kanban.move_up_named"]').attributes('disabled')).toBeDefined()
      expect(rows[2].find('button[aria-label="kanban.make_next_named"]').attributes('disabled')).toBeDefined()
      expect(rows[1].find('button[aria-label="kanban.move_up_named"]').attributes('disabled')).toBeUndefined()
      wrapper.unmount()
    } finally {
      setSharedOrderSectionResolver(null)
    }
  })
})
