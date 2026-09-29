/**
 * BUG-2109: after a real work session with no break, the desktop focus nudge
 * must suggest a break (Start break, with "Keep working instead"), not more
 * work. isBreakOwed is extracted LIVE from main.qml.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const qml = readFileSync(resolve(__dirname, '../../../packages/kde-widget/contents/ui/main.qml'), 'utf8')

function extract(name: string): string {
  const start = qml.indexOf(`function ${name}(`)
  if (start === -1) throw new Error(`${name} not found`)
  let depth = 0
  for (let i = qml.indexOf('{', start); i < qml.length; i++) {
    if (qml[i] === '{') depth++
    else if (qml[i] === '}' && --depth === 0) return qml.slice(start, i + 1)
  }
  throw new Error('unbalanced')
}

const isBreakOwed = new Function(`${extract('isBreakOwed')}; return isBreakOwed`)() as
  (session: Record<string, unknown> | undefined, nowMs: number) => boolean

const now = Date.parse('2026-09-29T07:14:43Z')
const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString()
const work = (extra: Record<string, unknown> = {}) =>
  ({ is_break: false, completed_at: minutesAgo(11), duration: 1500, remaining_time: 0, ...extra })

describe('isBreakOwed (BUG-2109)', () => {
  it('owes a break after a finished work session with no break since (the user repro)', () => {
    expect(isBreakOwed(work(), now)).toBe(true)
  })

  it('does not owe a break after a break, or with no history', () => {
    expect(isBreakOwed(work({ is_break: true }), now)).toBe(false)
    expect(isBreakOwed(undefined, now)).toBe(false)
  })

  it('ignores a work session stopped after only a few minutes', () => {
    expect(isBreakOwed(work({ remaining_time: 1500 - 4 * 60 }), now)).toBe(false)
    expect(isBreakOwed(work({ remaining_time: 1500 - 12 * 60 }), now)).toBe(true)
  })

  it('stops suggesting a break once the work ended long ago', () => {
    expect(isBreakOwed(work({ completed_at: minutesAgo(89) }), now)).toBe(true)
    expect(isBreakOwed(work({ completed_at: minutesAgo(120) }), now)).toBe(false)
  })
})

describe('nudge offers the break', () => {
  const nudge = qml.slice(qml.indexOf('id: nudgePopup'), qml.indexOf('// Action buttons', qml.indexOf('id: nudgePopup')))

  it('switches the heading and primary action to a break when one is owed', () => {
    expect(nudge).toContain('root.nudgeSuggestBreak ? "Time for a break" : "Ready to focus?"')
    expect(nudge).toContain('root.startNewSessionSupabase(true)')
    expect(nudge).toContain('Keep working instead')
  })

  it('shows the nudge for an owed break even when no tasks are listed', () => {
    const timerChain = qml.slice(qml.indexOf('root.fetchBreakOwed(function(breakOwed)'), qml.indexOf('root.fetchBreakOwed(function(breakOwed)') + 400)
    expect(timerChain).toContain('!breakOwed && !root.hasActionableNannyTasks()')
  })
})
