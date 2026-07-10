import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('Quick Sort source picker integration', () => {
  it('uses one shared picker in both desktop and mobile Quick Sort', () => {
    const pickerPath = 'src/components/quicksort/QuickSortSourcePicker.vue'
    expect(existsSync(resolve(root, pickerPath))).toBe(true)

    expect(read('src/views/QuickSortView.vue')).toContain('QuickSortSourcePicker')
    expect(read('src/mobile/views/MobileQuickSortView.vue')).toContain('QuickSortSourcePicker')
  })

  it('does not auto-start a new session before task pools are chosen', () => {
    const desktop = read('src/views/QuickSortView.vue')
    const mobileLogic = read('src/mobile/composables/useMobileQuickSortLogic.ts')

    expect(desktop).not.toContain('if (!resumed) startSession()')
    expect(mobileLogic).not.toContain('if (!resumed) {\n      startSession()')
  })

  it('forces the Uncategorized pool from the sidebar-specific entry point', () => {
    expect(read('src/components/sidebar/SidebarSmartViews.vue')).toContain("sources: 'uncategorized'")
  })

  it('always confirms before discarding an active captured queue', () => {
    const desktop = read('src/views/QuickSortView.vue')
    const mobileLogic = read('src/mobile/composables/useMobileQuickSortLogic.ts')

    expect(desktop).not.toContain('if (tasksSortedInSession.value > 0)')
    expect(mobileLogic).not.toContain('if (tasksSortedInSession.value > 0)')
  })

  it('makes mobile postpone and undo controls reachable without a swipe gesture', () => {
    const mobileView = read('src/mobile/views/MobileQuickSortView.vue')
    const mobileFilters = read('src/mobile/components/MobileQuickSortFilters.vue')
    const mobileLogic = read('src/mobile/composables/useMobileQuickSortLogic.ts')

    expect(mobileFilters).toContain("$emit('postpone')")
    expect(mobileView).toContain('@postpone="showQuickEditPanel = true"')
    expect(mobileView).toContain('v-if="canUndo"')
    expect(mobileLogic).toContain('undoLastCategorization')
  })

  it('keeps completion undoable until the user finalizes the session', () => {
    const desktop = read('src/views/QuickSortView.vue')
    const mobileLogic = read('src/mobile/composables/useMobileQuickSortLogic.ts')

    expect(desktop).toContain('previewSessionSummary')
    expect(mobileLogic).toContain('previewSessionSummary')
    expect(desktop).not.toContain('if (completed) sessionSummary.value = endSession()')
    expect(mobileLogic).not.toContain('if (completed) sessionSummary.value = endSession()')
  })
})
