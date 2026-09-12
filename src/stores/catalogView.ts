import { ref } from 'vue'
import { defineStore } from 'pinia'
import { usePersistentRef } from '@/composables/usePersistentRef'
import type { GroupByType } from '@/types/tasks'

export type CatalogDensity = 'compact' | 'comfortable' | 'spacious'
export type CatalogFocusTarget = 'group' | 'sort' | 'status' | 'density'

export const useCatalogViewStore = defineStore('catalog-view', () => {
  // Retain the existing keys so upgrades preserve the user's Catalog view.
  const groupBy = usePersistentRef<GroupByType>('flowstate:all-tasks-group-by', 'project')
  const showAllWeekDays = usePersistentRef<boolean>('flowstate-show-all-week-days', false)
  const density = usePersistentRef<CatalogDensity>('flowstate:task-list-density', 'comfortable')
  const controlsExpanded = ref(false)
  const focusTarget = ref<CatalogFocusTarget | null>(null)

  const openGlobalOrderControls = () => {
    controlsExpanded.value = true
    focusTarget.value = 'sort'
  }

  const openCatalogViewControls = (filterStatus: string) => {
    controlsExpanded.value = true
    focusTarget.value = filterStatus === 'all' ? 'group' : 'status'
  }

  const clearFocusTarget = () => {
    focusTarget.value = null
  }

  return {
    groupBy,
    showAllWeekDays,
    density,
    controlsExpanded,
    focusTarget,
    openGlobalOrderControls,
    openCatalogViewControls,
    clearFocusTarget,
  }
})
