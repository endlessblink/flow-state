/**
 * FEATURE-1162: Smart Filters / Saved Views
 *
 * Composable that captures the current filter state from the task store,
 * applies a saved view, and provides CRUD operations.
 */

import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useTaskStore } from '@/stores/tasks'
import { useSettingsStore } from '@/stores/settings'
import { useProjectStore } from '@/stores/projects'
import type { SavedFilterState, SavedView } from '@/types/savedViews'
import type { SmartView } from '@/composables/tasks/useTaskFiltering'

export function useSavedViews() {
    const taskStore = useTaskStore()
    const settingsStore = useSettingsStore()
    const projectStore = useProjectStore()

    const {
        activeSmartView,
        activeStatusFilter,
        activeDurationFilter,
        hideBoardDoneTasks,
        hideCanvasDoneTasks,
        hideCalendarDoneTasks,
        hideCanvasOverdueTasks,
        showFutureRecurring
    } = storeToRefs(taskStore)

    const savedViews = computed(() => settingsStore.savedViews ?? [])

    function captureCurrentFilters(): SavedFilterState {
        return {
            activeProjectId: projectStore.activeProjectId,
            activeSmartView: activeSmartView.value,
            activeStatusFilter: activeStatusFilter.value,
            activeDurationFilter: activeDurationFilter.value,
            hideBoardDoneTasks: hideBoardDoneTasks.value,
            hideCanvasDoneTasks: hideCanvasDoneTasks.value,
            hideCalendarDoneTasks: hideCalendarDoneTasks.value,
            hideCanvasOverdueTasks: hideCanvasOverdueTasks.value,
            showFutureRecurring: showFutureRecurring.value
        }
    }

    function applyView(view: SavedView) {
        const f = view.filters

        // Use store actions for dimensions that have setters (they also call persistFilters)
        taskStore.setActiveProject(f.activeProjectId)
        taskStore.setSmartView(f.activeSmartView as SmartView)
        taskStore.setActiveStatusFilter(f.activeStatusFilter)
        taskStore.setActiveDurationFilter(
            f.activeDurationFilter as 'quick' | 'short' | 'medium' | 'long' | 'unestimated' | null
        )

        // For the boolean toggle refs, set directly then persist
        hideBoardDoneTasks.value = f.hideBoardDoneTasks
        hideCanvasDoneTasks.value = f.hideCanvasDoneTasks
        hideCalendarDoneTasks.value = f.hideCalendarDoneTasks
        hideCanvasOverdueTasks.value = f.hideCanvasOverdueTasks
        showFutureRecurring.value = f.showFutureRecurring
    }

    /**
     * Checks whether the current live filter state matches a given saved view.
     */
    function isViewActive(view: SavedView): boolean {
        const current = captureCurrentFilters()
        const saved = view.filters
        return (
            current.activeProjectId === saved.activeProjectId &&
            current.activeSmartView === saved.activeSmartView &&
            current.activeStatusFilter === saved.activeStatusFilter &&
            current.activeDurationFilter === saved.activeDurationFilter &&
            current.hideBoardDoneTasks === saved.hideBoardDoneTasks &&
            current.hideCanvasDoneTasks === saved.hideCanvasDoneTasks &&
            current.hideCalendarDoneTasks === saved.hideCalendarDoneTasks &&
            current.hideCanvasOverdueTasks === saved.hideCanvasOverdueTasks &&
            current.showFutureRecurring === saved.showFutureRecurring
        )
    }

    function saveCurrentAsView(name: string, icon?: string, color?: string): SavedView {
        const now = new Date().toISOString()
        const view: SavedView = {
            id: crypto.randomUUID(),
            name,
            filters: captureCurrentFilters(),
            icon,
            color,
            createdAt: now,
            updatedAt: now
        }
        settingsStore.addSavedView(view)
        return view
    }

    function deleteView(id: string) {
        settingsStore.deleteSavedView(id)
    }

    function updateView(id: string, updates: Partial<SavedView>) {
        settingsStore.updateSavedView(id, updates)
    }

    return {
        savedViews,
        captureCurrentFilters,
        applyView,
        isViewActive,
        saveCurrentAsView,
        deleteView,
        updateView
    }
}
