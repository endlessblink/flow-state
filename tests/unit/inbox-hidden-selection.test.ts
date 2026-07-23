import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUnifiedInboxActions } from '@/composables/inbox/useUnifiedInboxActions'
import type { Task } from '@/types/tasks'

const task = (id: string): Task => ({
  id,
  title: id,
  status: 'todo',
  priority: null,
  tags: [],
  subtasks: [],
  isInInbox: true,
  createdAt: new Date(),
  updatedAt: new Date(),
})

describe('Unified Inbox hidden selection safety', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('drops selected tasks that a filter removes from the inbox', async () => {
    const visible = task('visible')
    const hidden = task('becomes-hidden')
    const inboxTasks = ref([visible, hidden])
    let actions!: ReturnType<typeof useUnifiedInboxActions>
    const Harness = defineComponent({
      setup() {
        actions = useUnifiedInboxActions(inboxTasks, 'canvas')
        return () => h('div')
      },
    })
    const wrapper = mount(Harness)

    actions.handleTaskClick(new MouseEvent('click', { ctrlKey: true }), visible)
    actions.handleTaskClick(new MouseEvent('click', { ctrlKey: true }), hidden)
    expect([...actions.selectedTaskIds.value]).toEqual(['visible', 'becomes-hidden'])

    inboxTasks.value = [visible]
    await nextTick()

    expect([...actions.selectedTaskIds.value]).toEqual(['visible'])
    wrapper.unmount()
  })

  it('excludes stale hidden selections from context-menu and drag payloads', () => {
    const visible = task('visible')
    const inboxTasks = ref([visible])
    let actions!: ReturnType<typeof useUnifiedInboxActions>
    const Harness = defineComponent({
      setup() {
        actions = useUnifiedInboxActions(inboxTasks, 'canvas')
        return () => h('div')
      },
    })
    const wrapper = mount(Harness)
    actions.handleTaskClick(new MouseEvent('click', { ctrlKey: true }), visible)
    actions.selectedTaskIds.value.add('stale-hidden')

    let contextDetail: { selectedIds: string[] } | undefined
    const captureContext = (event: Event) => {
      contextDetail = (event as CustomEvent<{ selectedIds: string[] }>).detail
    }
    window.addEventListener('task-context-menu', captureContext, { once: true })
    actions.handleTaskContextMenu(new MouseEvent('contextmenu'), visible)

    expect(contextDetail?.selectedIds).toEqual(['visible'])

    const setData = vi.fn()
    actions.onDragStart({
      dataTransfer: {
        effectAllowed: 'none',
        setData,
        setDragImage: vi.fn(),
      },
    } as unknown as DragEvent, visible)

    const payload = JSON.parse(setData.mock.calls[0][1])
    expect(payload.taskIds).toEqual(['visible'])
    wrapper.unmount()
  })
})
