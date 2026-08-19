import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import UnifiedInboxHeader from '@/components/inbox/unified/UnifiedInboxHeader.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

describe('canvas inbox collapsed hit target', () => {
  it('keeps the right-side panel and collapse control pointer-active above Vue Flow', () => {
    const source = readFileSync(resolve(__dirname, '../../../src/assets/canvas-view-layout.css'), 'utf8')
    const header = readFileSync(resolve(__dirname, '../../../src/components/inbox/unified/UnifiedInboxHeader.vue'), 'utf8')

    expect(source).toMatch(/\.unified-inbox-panel\.is-right-side\)[\s\S]*?z-index:\s*1100[\s\S]*?pointer-events:\s*auto/)
    expect(source).toContain('.unified-inbox-panel.is-right-side .inbox-header')
    expect(source).toContain('.unified-inbox-panel.is-right-side .collapse-btn')
    expect(header).toContain("$emit('toggle-collapse')")
    expect(header).not.toContain("$emit('toggleCollapse')")
  })

  it('emits the parent-listened event when the collapsed header is clicked', async () => {
    const wrapper = mount(UnifiedInboxHeader, {
      props: {
        isCollapsed: true,
        taskCount: 0,
        activeTimeFilter: 'all',
        todayCount: 0,
        next3DaysCount: 0,
        weekCount: 0,
        monthCount: 0,
        showGroupChips: false,
        groupOptions: [],
        selectedCanvasGroups: new Set<string>(),
        unscheduledOnly: false,
        onCanvasOnly: false,
        selectedPriorities: new Set<string>(),
        selectedProjects: new Set<string>(),
        selectedDurations: new Set<string>(),
        hideDoneTasks: true,
        doneTaskCount: 0,
        baseTasks: [],
        rootProjects: [],
        context: 'canvas',
        sortBy: 'newest',
        sortDirection: 'desc',
        searchQuery: '',
      } as any,
      global: {
        stubs: { NPopover: true },
        mocks: { $t: (key: string) => key },
      },
    })

    await wrapper.get('.collapse-btn').trigger('click')

    expect(wrapper.emitted('toggle-collapse')).toHaveLength(1)
  })
})
