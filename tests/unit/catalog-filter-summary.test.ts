import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia, storeToRefs } from 'pinia'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'
import CatalogViewSummary from '@/components/catalog/CatalogViewSummary.vue'
import ViewControls from '@/components/layout/ViewControls.vue'
import { useCatalogViewStore } from '@/stores/catalogView'
import en from '@/i18n/locales/en.json'
import he from '@/i18n/locales/he.json'

const createTestI18n = (locale: 'en' | 'he' = 'en') => createI18n({
  legacy: false,
  locale,
  fallbackLocale: 'en',
  messages: { en, he },
})

describe('Catalog filter and global-order discoverability', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('shows global ordering separately from the meaningful Catalog view state', () => {
    const wrapper = mount(CatalogViewSummary, {
      global: { plugins: [createTestI18n()] },
      props: {
        sortBy: 'dueDate',
        sortDirection: 'asc',
        scopeLabel: 'All active tasks',
        groupBy: 'dueDate',
        filterStatus: 'todo',
        hideDoneTasks: true,
      },
    })

    expect(wrapper.get('[data-testid="global-order-summary"]').text()).toContain('Global order: Due date ↑')
    const catalogSummary = wrapper.get('[data-testid="catalog-view-summary"]').text()
    expect(catalogSummary).toContain('Catalog view: All active tasks')
    expect(catalogSummary).toContain('Grouped by due date')
    expect(catalogSummary).toContain('Status: To Do')
    expect(catalogSummary).toContain('Completed hidden')
    expect(catalogSummary).not.toContain('Comfortable')
  })

  it('localizes the summaries while keeping sort direction semantic in RTL', () => {
    const wrapper = mount(CatalogViewSummary, {
      global: { plugins: [createTestI18n('he')] },
      props: {
        sortBy: 'priority',
        sortDirection: 'desc',
        scopeLabel: 'כל המשימות הפעילות',
        groupBy: 'none',
        filterStatus: 'all',
        hideDoneTasks: false,
      },
    })

    expect(wrapper.get('[data-testid="global-order-summary"]').text()).toContain('סדר ראשי: עדיפות ↓')
    expect(wrapper.get('[data-testid="catalog-view-summary"]').text()).toContain('ללא קיבוץ')
  })

  it('labels group and global-order selectors even when both select Due Date', () => {
    const wrapper = mount(ViewControls, {
      global: { plugins: [createTestI18n()] },
      props: {
        sortBy: 'dueDate',
        groupBy: 'dueDate',
        filterStatus: 'all',
        density: 'comfortable',
        expanded: true,
      },
    })

    expect(wrapper.get('[data-control="group"] .control-label').text()).toBe('Group by')
    expect(wrapper.get('[data-control="sort"] .control-label').text()).toBe('Global order')
    expect(wrapper.get('[data-control="status"] .control-label').text()).toBe('Status')
    expect(wrapper.get('[data-control="density"] .control-label').text()).toBe('Density')
  })

  it('opens and focuses the requested selector from a header summary', async () => {
    const wrapper = mount(ViewControls, {
      attachTo: document.body,
      global: { plugins: [createTestI18n()] },
      props: {
        sortBy: 'dueDate',
        groupBy: 'dueDate',
        filterStatus: 'all',
        expanded: false,
        focusTarget: null,
      },
    })

    await wrapper.setProps({ expanded: true, focusTarget: 'sort' })
    await nextTick()

    expect(document.activeElement?.getAttribute('aria-label')).toBe('Global order')
    expect(wrapper.emitted('focusHandled')).toBeTruthy()
    wrapper.unmount()
  })

  it('preserves existing Catalog preference keys and chooses the intended focus target', () => {
    localStorage.setItem('flowstate:all-tasks-group-by', 'priority')
    localStorage.setItem('flowstate:task-list-density', 'compact')
    const store = useCatalogViewStore()
    const { groupBy, density, controlsExpanded, focusTarget } = storeToRefs(store)

    expect(groupBy.value).toBe('priority')
    expect(density.value).toBe('compact')

    store.openCatalogViewControls('todo')
    expect(controlsExpanded.value).toBe(true)
    expect(focusTarget.value).toBe('status')

    store.openCatalogViewControls('all')
    expect(focusTarget.value).toBe('group')
  })
})
