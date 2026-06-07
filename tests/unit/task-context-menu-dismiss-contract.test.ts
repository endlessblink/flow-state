import { mount, VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import TaskContextMenu from '@/components/tasks/TaskContextMenu.vue'
import type { Task } from '@/stores/tasks'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() })
}))

const projectRoot = resolve(__dirname, '../..')

const readSource = (relativePath: string) =>
  readFileSync(resolve(projectRoot, relativePath), 'utf8')

const waitForOutsideListeners = () => new Promise(resolve => setTimeout(resolve, 0))

const task = {
  id: 'task-1',
  title: 'Catalogue right-click task',
  status: 'todo',
  priority: 'medium',
  projectId: undefined,
  dueDate: '',
  createdAt: new Date(),
  updatedAt: new Date()
} as Task

const mountMenu = () => mount(TaskContextMenu, {
  attachTo: document.body,
  props: {
    isVisible: true,
    x: 40,
    y: 60,
    task
  },
  global: {
    plugins: [createPinia()],
    stubs: {
      Teleport: false,
      OverflowTooltip: { template: '<span><slot /></span>' },
      MoreSubmenu: true,
      DueDateSubmenu: true,
      PrioritySubmenu: true,
      ProjectSubmenu: true,
      CanvasGroupSubmenu: true,
      DurationSubmenu: true,
      DoneForNowSubmenu: true,
      AITaskAssistPopover: true
    }
  }
})

let wrappers: VueWrapper[] = []

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  for (const wrapper of wrappers) wrapper.unmount()
  wrappers = []
  document.body.innerHTML = ''
})

describe('TaskContextMenu outside dismissal contract', () => {
  it('dismisses on pointer and contextmenu events, not click-only events', () => {
    const source = readSource('src/components/tasks/TaskContextMenu.vue')

    expect(source).toContain('@pointerdown.stop')
    expect(source).toContain('@contextmenu.stop.prevent')
    expect(source).toContain("document.addEventListener('pointerdown', handleOutsidePointerDown, true)")
    expect(source).toContain("document.addEventListener('contextmenu', handleOutsideContextMenu, true)")
    expect(source).toContain("document.removeEventListener('pointerdown', handleOutsidePointerDown, true)")
    expect(source).toContain("document.removeEventListener('contextmenu', handleOutsideContextMenu, true)")
    expect(source).toContain("target.closest('.submenu, .n-date-picker, .n-date-panel, .n-popover, .ai-assist-popover')")
    expect(source).toContain('closeAllSubmenusNow()')

    expect(source).not.toContain("document.addEventListener('click', handleClickOutside, true)")
    expect(source).not.toContain("document.removeEventListener('click', handleClickOutside, true)")
  })

  it('closes on outside right-click without closing owned menu surfaces', async () => {
    const wrapper = mountMenu()
    wrappers.push(wrapper)
    await waitForOutsideListeners()

    const menu = document.body.querySelector('.context-menu')
    expect(menu).toBeTruthy()

    menu?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }))
    expect(wrapper.emitted('close')).toBeUndefined()

    const submenu = document.createElement('div')
    submenu.className = 'submenu'
    document.body.appendChild(submenu)
    submenu.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }))
    expect(wrapper.emitted('close')).toBeUndefined()

    document.body.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }))
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('closes on outside pointerdown so normal clicks cannot leave a stale menu open', async () => {
    const wrapper = mountMenu()
    wrappers.push(wrapper)
    await waitForOutsideListeners()

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('reattaches outside listeners after visible false-to-true reopen transitions', async () => {
    const wrapper = mountMenu()
    wrappers.push(wrapper)
    await waitForOutsideListeners()

    await wrapper.setProps({ isVisible: false })
    await wrapper.setProps({ isVisible: true, x: 120, y: 140 })
    await waitForOutsideListeners()

    document.body.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }))
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
