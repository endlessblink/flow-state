/**
 * BUG-2107: the KDE widget list must start with the same task as the app —
 * the synced Canvas order (day groups in reading order, Today first, shared
 * `order` inside a day). The widget function is extracted LIVE from main.qml
 * and compared with the app's comparator on the same raw rows.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fromSupabaseTask } from '@/utils/supabaseMappers'
import type { SupabaseTask } from '@/types/supabase'
import type { CanvasGroup } from '@/types/canvas'
import { buildCanvasSequenceSections } from '@/utils/canvas/canvasSequence'
import { setSharedOrderSectionResolver, sortTasksBySharedOrder } from '@/utils/taskOrdering'

const qmlSource = readFileSync(resolve(__dirname, '../../../packages/kde-widget/contents/ui/main.qml'), 'utf8')

function extractQmlFunction(name: string): string {
  const start = qmlSource.indexOf(`function ${name}(`)
  if (start === -1) throw new Error(`function ${name} not found in main.qml`)
  const bodyStart = qmlSource.indexOf('{', start)
  let depth = 0
  for (let i = bodyStart; i < qmlSource.length; i++) {
    if (qmlSource[i] === '{') depth++
    else if (qmlSource[i] === '}' && --depth === 0) return qmlSource.slice(start, i + 1)
  }
  throw new Error(`unbalanced braces extracting ${name}`)
}

const widget = new Function(`
  ${extractQmlFunction('localDateString')}
  ${extractQmlFunction('normalizeTaskDate')}
  ${extractQmlFunction('taskMatchesToday')}
  ${extractQmlFunction('computeSyncedTaskOrder')}
  return { localDateString, computeSyncedTaskOrder }
`)() as {
  localDateString: (d: Date) => string
  computeSyncedTaskOrder: (tasks: unknown[], groups: unknown[], todayStr: string) => Array<{ id: string }>
}

const todayStr = widget.localDateString(new Date())
const future = widget.localDateString(new Date(Date.now() + 4 * 86_400_000))

const groupRows = [
  { id: 'g-today', name: 'Today', position_json: { x: 0, y: 0 }, is_visible: true, parent_group_id: null },
  { id: 'g-tomorrow', name: 'Tomorrow', position_json: { x: 400, y: 0 }, is_visible: true, parent_group_id: null },
  { id: 'g-thu', name: 'Thursday', position_json: { x: 1600, y: 0 }, is_visible: true, parent_group_id: null },
]

const row = (id: string, order: number, extra: Partial<SupabaseTask> & { parentId?: string } = {}) => {
  const { parentId, ...rest } = extra
  return {
    id, title: id, status: 'planned', order, priority: null, due_date: null, scheduled_date: null, instances: [],
    created_at: '2026-01-01T08:00:00+00:00', user_id: 'u', is_deleted: false,
    position: parentId ? { x: 20, y: order, parentId } : null,
    ...rest,
  } as unknown as SupabaseTask
}

// The user's shape: a Thursday task holds the lowest global order and is
// Immediate; Today has the lecture first and the dishes (Immediate) third.
const rows = [
  row('yaniv-thu', 3, { parentId: 'g-thu', priority: 'immediate' as never, due_date: future }),
  row('dishes', 31, { priority: 'immediate' as never, due_date: todayStr }),
  row('lecture', 13, { priority: 'high' as never, due_date: todayStr }),
  row('slides', 24, { parentId: 'g-today', due_date: todayStr }),
  row('tomorrow-1', 40, { parentId: 'g-tomorrow', due_date: future }),
  row('off-canvas', 1),
]

afterEach(() => setSharedOrderSectionResolver(null))

describe('KDE widget synced order (BUG-2107)', () => {
  it('starts with the first Today task on Canvas, not the lowest order or top priority', () => {
    const ids = widget.computeSyncedTaskOrder(rows, groupRows, todayStr).map(task => task.id)
    expect(ids).toEqual(['lecture', 'slides', 'dishes', 'tomorrow-1', 'yaniv-thu', 'off-canvas'])
  })

  it('matches the app order for the same rows', () => {
    const tasks = rows.map(r => fromSupabaseTask(r))
    const groups = groupRows.map(g => ({ id: g.id, name: g.name, position: g.position_json, isVisible: g.is_visible })) as unknown as CanvasGroup[]
    const todayIds = new Set(tasks.filter(t => String(t.dueDate ?? '').startsWith(todayStr)).map(t => t.id))
    const sections = buildCanvasSequenceSections(groups, tasks, todayIds, 'g-today')
    setSharedOrderSectionResolver(task => sections.get(task.id))
    const appIds = sortTasksBySharedOrder(tasks).map(t => t.id)
    expect(widget.computeSyncedTaskOrder(rows, groupRows, todayStr).map(t => t.id)).toEqual(appIds)
  })

  it('defaults the widget list to the synced order', () => {
    expect(qmlSource).toContain('property string taskSortBy: "canvas_order"')
  })
})
