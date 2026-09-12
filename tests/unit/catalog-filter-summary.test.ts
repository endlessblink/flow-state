import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia, storeToRefs } from 'pinia'
import { createI18n } from 'vue-i18n'
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

  it('keeps the Catalog structure and shared order visible in one toolbar', () => {
    const wrapper = mount(ViewControls, {
      global: { plugins: [createTestI18n()] },
      props: {
        sortBy: 'dueDate',
        groupBy: 'dueDate',
        filterStatus: 'all',
        density: 'comfortable',
        expanded: false,
      },
    })

    expect(wrapper.get('[data-control="group"] .control-label').text()).toBe('Group by')
    expect(wrapper.get('[data-control="sort"] .control-label').text()).toBe('Global order')
    expect(wrapper.get('[data-testid="catalog-toolbar"]').attributes('role')).toBe('toolbar')
    expect(wrapper.get('[data-testid="global-order-note"]').text()).toBe('Also orders Canvas and Calendar inboxes')
    expect(wrapper.find('[data-control="status"]').exists()).toBe(false)
    expect(wrapper.find('[data-control="density"]').exists()).toBe(false)
  })

  it('reveals secondary Catalog-only controls without duplicating the primary controls', async () => {
    const wrapper = mount(ViewControls, {
      global: { plugins: [createTestI18n()] },
      props: {
        sortBy: 'dueDate',
        groupBy: 'dueDate',
        filterStatus: 'all',
        expanded: false,
      },
    })

    await wrapper.get('[data-testid="catalog-view-options"]').trigger('click')
    await wrapper.setProps({ expanded: true })

    expect(wrapper.get('[data-control="status"] .control-label').text()).toBe('Status')
    expect(wrapper.get('[data-control="density"] .control-label').text()).toBe('Density')
    expect(wrapper.findAll('[data-control="group"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-control="sort"]')).toHaveLength(1)
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
