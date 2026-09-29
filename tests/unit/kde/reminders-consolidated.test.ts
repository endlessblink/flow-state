/**
 * BUG-2110: too many reminders, some blocking typing. Agreed model:
 *  - session end → ONE small corner card + soft sound (no full-screen overlay,
 *    no extra system notification), never taking keyboard focus;
 *  - idle focus/break → the widget card only, never taking keyboard focus;
 *  - 1-minute heads-up → kept, never taking keyboard focus.
 * Reads the live widget QML.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const qml = readFileSync(resolve(__dirname, '../../../packages/kde-widget/contents/ui/main.qml'), 'utf8')

function fn(name: string): string {
  const start = qml.indexOf(`function ${name}(`)
  if (start === -1) throw new Error(`${name} not found`)
  let depth = 0
  for (let i = qml.indexOf('{', start); i < qml.length; i++) {
    if (qml[i] === '{') depth++
    else if (qml[i] === '}' && --depth === 0) return qml.slice(start, i + 1)
  }
  throw new Error('unbalanced')
}
const windowHeader = (id: string) => qml.slice(qml.indexOf(`id: ${id}`), qml.indexOf(`id: ${id}`) + 200)

describe('reminders never block typing (BUG-2110)', () => {
  it('the reminder card and the 1-minute heads-up refuse keyboard focus', () => {
    expect(windowHeader('nudgePopup')).toContain('Qt.WindowDoesNotAcceptFocus')
    expect(windowHeader('preEndWarningPopup')).toContain('Qt.WindowDoesNotAcceptFocus')
    expect(fn('sendNannyNotification')).not.toContain('requestActivate')
    expect(fn('showPreEndWarning')).not.toContain('requestActivate')
    expect(fn('showSessionEndCard')).not.toContain('requestActivate')
  })
})

describe('one reminder at session end (BUG-2110)', () => {
  const complete = fn('onSessionComplete')

  it('shows the small card instead of the full-screen overlay and system notification', () => {
    expect(complete).toContain('showSessionEndCard(root.isWorkSession)')
    expect(complete).not.toContain('showFullScreenOverlay()')
    expect(complete).not.toContain('showTimerNotification(')
  })

  it('offers a break after work and a new session after a break, with one soft sound', () => {
    const card = fn('showSessionEndCard')
    expect(card).toContain('root.nudgeSuggestBreak = wasWorkSession')
    expect(card).toContain('"Work session done"')
    expect(card).toContain('"Break\'s over"')
    expect(card).toContain('paplay')
  })

  it('closes the card as soon as a new session starts anywhere', () => {
    expect(qml).toContain('Auto-dismissed reminder card — new session detected')
  })
})
