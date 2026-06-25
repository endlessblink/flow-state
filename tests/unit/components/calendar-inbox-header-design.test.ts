import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { defineComponent, h } from 'vue'
import CalendarInboxHeader from '@/components/inbox/calendar/CalendarInboxHeader.vue'

vi.mock('lucide-vue-next', () => {
  const icon = defineComponent({
    name: 'IconStub',
    props: { size: { type: Number, default: 16 } },
    setup() {
      return () => h('svg', { class: 'icon-stub' })
    },
  })

  return {
    ArrowDownNarrowWide: icon,
    ArrowUpNarrowWide: icon,
    CalendarDays: icon,
    CalendarOff: icon,
    Check: icon,
    CheckCircle2: icon,
    ChevronDown: icon,
    ChevronLeft: icon,
    ChevronRight: icon,
    Clock: icon,
    Filter: icon,
    Flag: icon,
    FolderOpen: icon,
    LayoutGrid: icon,
    List: icon,
    ListFilter: icon,
    ListTree: icon,
    Search: icon,
    X: icon,
  }
})

vi.mock('naive-ui', () => ({
  NBadge: defineComponent({
    name: 'NBadge',
    props: { value: { type: [String, Number], default: '' } },
    setup(props) {
      return () => h('span', { class: 'n-badge-stub' }, String(props.value))
    },
  }),
}))

vi.mock('@/components/common/CustomSelect.vue', () => ({
  default: defineComponent({
    name: 'CustomSelect',
    props: {
      modelValue: { type: [String, Number], default: '' },
      options: { type: Array, default: () => [] },
      placeholder: { type: String, default: '' },
    },
    setup(props) {
      return () => h('button', { class: 'custom-select-stub' }, props.placeholder)
    },
  }),
}))

vi.mock('@/components/filters/SavedViewsDropdown.vue', () => ({
  default: defineComponent({
    name: 'SavedViewsDropdown',
    setup() {
      return () => h('div', { class: 'saved-views-stub' })
    },
  }),
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      calendar: { today: 'Today' },
      filters: {
        all: 'All',
        clear_all: 'Clear all',
        duration: 'Duration',
        hide_filters_simple: 'Hide filters',
        hiding_done: 'Hiding Done',
        more_filters: 'More filters',
        no_project: 'No Project',
        on_canvas: 'Canvas',
        project: 'Project',
        sort_ascending: 'Ascending',
        sort_canvas: 'Canvas',
        sort_descending: 'Descending',
        sort_due: 'Due',
        sort_label: 'Sort',
        sort_newest: 'Newest',
        sort_priority: 'Priority',
        unscheduled: 'Unscheduled',
      },
      smart_views: { inbox: 'Inbox' },
      task: {
        priority_high: 'High',
        priority_low: 'Low',
        priority_medium: 'Medium',
      },
    },
  },
})

function mountHeader(overrides = {}) {
  return mount(CalendarInboxHeader, {
    global: {
      plugins: [i18n],
    },
    props: {
      isCollapsed: false,
      inboxCount: 61,
      showTodayOnly: true,
      todayCount: 9,
      hasActiveFilters: true,
      baseCount: 61,
      canvasGroupOptions: [
        { label: 'All Tasks', value: '' },
        { label: 'Work', value: 'work' },
      ],
      selectedCanvasGroups: new Set(),
      showAdvancedFilters: true,
      unscheduledOnly: true,
      selectedPriorities: new Set(['medium']),
      selectedProjects: new Set(),
      selectedDurations: new Set(),
      hideDoneTasks: true,
      hideSubtasks: false,
      baseTasks: [],
      rootProjects: [],
      searchQuery: '',
      sortBy: 'canvasOrder',
      sortDirection: 'asc',
      ...overrides,
    },
  })
}

describe('CalendarInboxHeader design contract', () => {
  it('uses an attached toolbar and does not render a generic Canvas filter pill', () => {
    const wrapper = mountHeader()

    expect(wrapper.find('.calendar-filter-toolbar').exists()).toBe(true)
    expect(wrapper.find('.advanced-filters-section').exists()).toBe(false)
    expect(wrapper.find('.toggle-filters-btn').exists()).toBe(false)

    const chipLabels = wrapper
      .findAll('.filter-chip, .calendar-filter-token')
      .map((node) => node.text().trim())

    expect(chipLabels).not.toContain('Canvas')

    const sortSelect = wrapper.getComponent({ name: 'CustomSelect' })
    expect(sortSelect.classes()).toContain('calendar-sort-select')
    expect(sortSelect.props('options')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'canvasOrder', label: 'Canvas order' }),
      ]),
    )
  })
})
