import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  PRIORITY_COLOR_VARS,
  PRIORITY_VALUES,
  comparePriority,
  isPriorityValue,
  priorityOptions,
  priorityRank,
} from '@/utils/taskPriority'
import { compareTaskSortField } from '@/utils/taskSort'
import type { Task } from '@/types/tasks'

const root = resolve(__dirname, '../..')
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8')

const CANONICAL = ['immediate', 'high', 'medium', 'low', 'relaxed']

describe('TASK-2080 priority rank and colors', () => {
  it('ranks every supported priority highest to lowest, with none last', () => {
    expect([...PRIORITY_VALUES]).toEqual(CANONICAL)
    const ranks = CANONICAL.map(priorityRank)
    expect(ranks).toEqual([0, 1, 2, 3, 4])
    expect(priorityRank(null)).toBeGreaterThan(priorityRank('relaxed'))
    expect(priorityRank('bogus')).toBe(priorityRank(undefined))
  })

  it('sorts by rank, not alphabetically', () => {
    const shuffled = ['relaxed', 'high', 'low', 'immediate', 'medium', null]
    const sorted = [...shuffled].sort(comparePriority)
    expect(sorted).toEqual(['immediate', 'high', 'medium', 'low', 'relaxed', null])
    // Alphabetical would put "high" before "immediate": guard against regression.
    expect([...shuffled.filter(Boolean)].sort()).not.toEqual(sorted.filter(Boolean))
  })

  it('taskSort priority key follows the shared rank in both directions', () => {
    const tasks = CANONICAL.map(priority => ({ id: priority, priority }) as unknown as Task)
    const asc = [...tasks].sort((a, b) => compareTaskSortField(a, b, { key: 'priority', direction: 'asc' }))
    const desc = [...tasks].sort((a, b) => compareTaskSortField(a, b, { key: 'priority', direction: 'desc' }))
    expect(asc.map(t => t.id)).toEqual(CANONICAL)
    expect(desc.map(t => t.id)).toEqual([...CANONICAL].reverse())
  })

  it('offers every priority in selectors, in order, with an optional trailing none', () => {
    expect(priorityOptions().map(o => o.value)).toEqual(CANONICAL)
    expect(priorityOptions({ includeNone: true }).map(o => o.value)).toEqual([...CANONICAL, null])
    expect(CANONICAL.every(isPriorityValue)).toBe(true)
    expect(isPriorityValue('none')).toBe(false)
  })

  it('defines a distinct design-token color for every priority', () => {
    const css = read('src/assets/design-tokens.css')
    const colors = new Map<string, string>()
    for (const priority of CANONICAL) {
      const match = css.match(new RegExp(`--color-priority-${priority}:\\s*(#[0-9a-fA-F]{3,8})`))
      expect(match, `--color-priority-${priority} token`).toBeTruthy()
      colors.set(priority, match![1].toLowerCase())
      expect(PRIORITY_COLOR_VARS[priority as keyof typeof PRIORITY_COLOR_VARS]).toBe(`var(--color-priority-${priority})`)
      for (const part of ['bg', 'border', 'text']) {
        expect(css, `--priority-${priority}-${part}`).toMatch(new RegExp(`--priority-${priority}-${part}:`))
      }
    }
    expect(new Set(colors.values()).size).toBe(CANONICAL.length)
  })
})

describe('TASK-2080 selector surfaces stay canonical', () => {
  const SELECTOR_SOURCES = [
    'src/components/tasks/QuickTaskCreateModal.vue',
    'src/components/tasks/BatchEditModal.vue',
    'src/components/tasks/QuickTaskCreate.vue',
    'src/components/layout/CommandPalette.vue',
    'src/composables/tasks/useTaskEditState.ts',
    'src/components/canvas/GroupSettingsMenu.vue',
    'src/components/canvas/UnifiedGroupModal.vue',
    'src/components/base/FilterControls.vue',
    'src/components/inbox/calendar/CalendarInboxHeader.vue',
    'src/components/inbox/unified/InboxFilterPopover.vue',
    'src/components/canvas/InboxFilters.vue',
    'src/components/sidebar/SidebarPriorityFilter.vue',
    'src/mobile/components/TaskEditBottomSheet.vue',
    'src/mobile/components/TaskCreateBottomSheet.vue',
    'src/mobile/views/MobileTodayView.vue',
    'src/components/tasks/row/TaskRowPriority.vue',
  ]

  it.each(SELECTOR_SOURCES)('%s lists all five priorities highest to lowest', (file) => {
    const source = read(file)
    const found = [...source.matchAll(/value:\s*'(immediate|high|medium|low|relaxed)'/g)].map(m => m[1])
    // Take the first full run of the canonical sequence (a file may repeat the list once).
    expect(found.slice(0, CANONICAL.length)).toEqual(CANONICAL)
  })

  it('priority submenu renders from the shared ordered list', () => {
    const source = read('src/components/tasks/context-menu/PrioritySubmenu.vue')
    expect(source).toContain("priorityOptions()")
    expect(source.match(/No Priority/g)?.length).toBe(1)
  })

  it('AI-accepted priorities are not limited to low/medium/high', () => {
    for (const file of ['src/components/tasks/TaskEditModal.vue', 'src/components/tasks/TaskContextMenu.vue']) {
      expect(read(file)).not.toMatch(/\['low', 'medium', 'high'\]\.includes/)
    }
  })

  it('no surface falls back to a shared color for immediate/relaxed', () => {
    for (const file of [
      'src/components/common/CustomSelect.vue',
      'src/components/tasks/TaskContextMenu.vue',
      'src/components/ai/ChatMessage.vue',
      'src/components/sidebar/SidebarPriorityFilter.vue',
      'src/views/CalendarViewVueCal.vue',
      'src/components/ai/TaskQuickEditPopover.vue',
    ]) {
      const lines = read(file).split('\n').filter(l => /immediate|relaxed/.test(l) && /var\(--/.test(l))
      for (const line of lines) {
        const isImmediate = /immediate/.test(line)
        expect(line, `${file}: ${line.trim()}`).toContain(isImmediate ? 'color-priority-immediate' : 'color-priority-relaxed')
      }
    }
  })
})
