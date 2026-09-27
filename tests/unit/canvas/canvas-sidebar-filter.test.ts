/**
 * BUG-2103: sidebar filters did not narrow Canvas, and selecting one while
 * Canvas was open at its '/canvas' alias bounced the user to the catalogue.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { defineComponent } from 'vue'
import { getCanvasViewFilterVisibleIds } from '@/utils/canvas/viewFilterVisibility'

const tasks = [{ id: 'today-task' }, { id: 'week-task' }]

describe('getCanvasViewFilterVisibleIds (BUG-2103)', () => {
  it('shows everything when no sidebar filter is active', () => {
    expect(getCanvasViewFilterVisibleIds({ filteredTasks: tasks })).toBeNull()
    expect(getCanvasViewFilterVisibleIds({ activeStatusFilter: 'all', filteredTasks: tasks })).toBeNull()
  })

  it('keeps only tasks the shared filter pipeline returns for an active filter', () => {
    for (const state of [
      { activeSmartView: 'today' },
      { activeProjectId: 'project-work' },
      { activeDurationFilter: 'quick' },
      { activeStatusFilter: 'in_progress' },
    ]) {
      const visible = getCanvasViewFilterVisibleIds({ ...state, filteredTasks: [{ id: 'today-task' }] })
      expect(visible).toEqual(new Set(['today-task']))
      expect(visible!.has('week-task')).toBe(false)
    }
  })
})

describe('SidebarSmartViews navigation from Canvas (BUG-2103)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const Stub = defineComponent({ template: '<div />' })
  const SmartItem = defineComponent({ emits: ['click'], template: '<button class="smart-item" @click="$emit(\'click\')"><slot /></button>' })
  const mountOptions = (router: ReturnType<typeof makeRouter>) => ({
    global: {
      plugins: [router],
      mocks: { $t: (key: string) => key },
      stubs: { SidebarSmartItem: SmartItem },
    },
  })
  const clickToday = async (wrapper: ReturnType<typeof mount>) => {
    const today = wrapper.findAll('button.smart-item').find(node => node.text().includes('smart_views.today'))
    expect(today).toBeTruthy()
    await today!.trigger('click')
  }
  function makeRouter() { return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', alias: '/canvas', name: 'canvas', component: Stub },
      { path: '/tasks', name: 'all-tasks', component: Stub },
      { path: '/quick-sort', name: 'quick-sort', component: Stub },
      { path: '/timer', name: 'mobile-timer', component: Stub },
    ],
  }) }

  it.each(['/', '/canvas'])('stays on Canvas at %s when a filter is chosen', async (path) => {
    const router = makeRouter()
    await router.push(path)
    await router.isReady()
    const push = vi.spyOn(router, 'push')
    const { default: SidebarSmartViews } = await import('@/components/sidebar/SidebarSmartViews.vue')
    const wrapper = mount(SidebarSmartViews, mountOptions(router))
    await clickToday(wrapper)

    expect(push).not.toHaveBeenCalled()
    expect(router.currentRoute.value.name).toBe('canvas')
  })

  it('still moves to the task list from a view that cannot filter', async () => {
    const router = makeRouter()
    await router.push('/timer')
    await router.isReady()
    const { default: SidebarSmartViews } = await import('@/components/sidebar/SidebarSmartViews.vue')
    const wrapper = mount(SidebarSmartViews, mountOptions(router))
    await clickToday(wrapper)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(router.currentRoute.value.name).toBe('all-tasks')
  })
})
