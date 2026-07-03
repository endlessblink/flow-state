/**
 * BUG-1908: KDE widget Today filter ↔ Vue Today smart view parity.
 *
 * The widget's Today list (todayOnly=true) filters raw Supabase rows with
 * taskMatchesToday() in packages/kde-widget/contents/ui/main.qml. The app's
 * Today smart view filters mapper-hydrated tasks with
 * useSmartViews().isTodayTask(). Both must agree on the same row, or tasks
 * silently vanish from the widget while visible in the app (the user repro).
 *
 * The widget functions are extracted LIVE from main.qml source at test time
 * (not re-implemented), so this test fails on the real QML bug and only
 * passes when main.qml itself is fixed.
 *
 * The specific regression: the widget checked instances[] BEFORE
 * scheduled_date and returned false terminally, hiding tasks explicitly
 * scheduled for today that still carry stale calendar instances. Vue fixed
 * that ordering (useSmartViews.ts:92-101); the widget must match.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useSmartViews } from '@/composables/useSmartViews'
import { fromSupabaseTask } from '@/utils/supabaseMappers'
import type { SupabaseTask } from '@/types/supabase'

// ---------------------------------------------------------------------------
// Live extraction of the QML date/filter functions
// ---------------------------------------------------------------------------

const QML_PATH = resolve(__dirname, '../../../packages/kde-widget/contents/ui/main.qml')
const qmlSource = readFileSync(QML_PATH, 'utf8')

/** Slice a `function name(...) { ... }` declaration out of the QML source. */
function extractQmlFunction(name: string): string {
  const marker = `function ${name}(`
  const start = qmlSource.indexOf(marker)
  if (start === -1) throw new Error(`function ${name} not found in main.qml`)
  const bodyStart = qmlSource.indexOf('{', start)
  let depth = 0
  for (let i = bodyStart; i < qmlSource.length; i++) {
    if (qmlSource[i] === '{') depth++
    else if (qmlSource[i] === '}') {
      depth--
      if (depth === 0) return qmlSource.slice(start, i + 1)
    }
  }
  throw new Error(`unbalanced braces extracting ${name}`)
}

interface WidgetFilterFns {
  localDateString: (d: Date) => string
  normalizeTaskDate: (v: unknown) => string
  taskMatchesToday: (task: Record<string, unknown>, todayStr: string) => boolean
}

const widget = new Function(`
  ${extractQmlFunction('localDateString')}
  ${extractQmlFunction('normalizeTaskDate')}
  ${extractQmlFunction('taskMatchesToday')}
  return { localDateString, normalizeTaskDate, taskMatchesToday }
`)() as WidgetFilterFns

// ---------------------------------------------------------------------------
// Fixtures — dynamic dates (no date bombs)
// ---------------------------------------------------------------------------

function localDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const now = new Date()
const todayStr = localDateString(now)
const yesterdayStr = localDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
const tomorrowStr = localDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))

let seq = 0
function makeRow(overrides: Partial<SupabaseTask>): SupabaseTask {
  seq++
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    user_id: '717f5209-42d8-4bb9-8781-740107a384e5',
    title: `parity fixture ${seq}`,
    status: 'planned',
    due_date: null,
    scheduled_date: null,
    instances: [],
    created_at: `${yesterdayStr}T08:00:00+00:00`,
    updated_at: `${yesterdayStr}T08:00:00+00:00`,
    is_deleted: false,
    ...overrides,
  } as SupabaseTask
}

const { isTodayTask } = useSmartViews()

function appShows(row: SupabaseTask): boolean {
  return isTodayTask(fromSupabaseTask(row))
}

function widgetShows(row: SupabaseTask): boolean {
  return widget.taskMatchesToday(row as unknown as Record<string, unknown>, todayStr)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BUG-1908: widget taskMatchesToday parity with Vue isTodayTask', () => {
  it('extracts the real QML functions (sanity)', () => {
    expect(widget.normalizeTaskDate(`${todayStr}T00:00:00+00:00`)).toBe(todayStr)
    expect(widget.localDateString(now)).toBe(todayStr)
  })

  it('USER REPRO: scheduled today + stale calendar instances → must show in widget like in app', () => {
    const row = makeRow({
      scheduled_date: `${todayStr}T09:00:00+00:00`,
      instances: [{ id: 'inst-1', scheduledDate: yesterdayStr, scheduledTime: '10:00', duration: 60 }] as SupabaseTask['instances'],
    })
    expect(appShows(row)).toBe(true)
    expect(widgetShows(row)).toBe(true)
  })

  const parityMatrix: Array<[string, SupabaseTask]> = [
    ['due today, stale instances', makeRow({
      due_date: `${todayStr}T00:00:00+00:00`,
      instances: [{ id: 'i', scheduledDate: yesterdayStr }] as SupabaseTask['instances'],
    })],
    ['instance scheduled today only', makeRow({
      instances: [{ id: 'i', scheduledDate: todayStr }] as SupabaseTask['instances'],
    })],
    ['scheduled today, no instances', makeRow({
      scheduled_date: `${todayStr}T00:00:00+00:00`,
    })],
    ['created today, no date info', makeRow({
      created_at: `${todayStr}T06:00:00`,
    })],
    ['created today but instance scheduled tomorrow', makeRow({
      created_at: `${todayStr}T06:00:00`,
      instances: [{ id: 'i', scheduledDate: tomorrowStr }] as SupabaseTask['instances'],
    })],
    ['due yesterday (overdue) — hidden from Today on both sides', makeRow({
      due_date: `${yesterdayStr}T00:00:00+00:00`,
    })],
    ['due tomorrow — hidden on both sides', makeRow({
      due_date: `${tomorrowStr}T00:00:00+00:00`,
    })],
    ['done task due today — hidden on both sides', makeRow({
      status: 'done',
      due_date: `${todayStr}T00:00:00+00:00`,
    })],
    ['scheduled today + stale instances (repro shape)', makeRow({
      scheduled_date: `${todayStr}T09:00:00+00:00`,
      instances: [{ id: 'i', scheduledDate: yesterdayStr }] as SupabaseTask['instances'],
    })],
  ]

  it.each(parityMatrix)('parity: %s', (_label, row) => {
    expect(widgetShows(row)).toBe(appShows(row))
  })
})
