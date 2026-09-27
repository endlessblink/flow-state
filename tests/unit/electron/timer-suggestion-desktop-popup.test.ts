/**
 * TASK-2102: "Ready to focus?" must appear on the desktop outside the main
 * window. The popup is script-free; its buttons are action URLs that the main
 * process intercepts.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('electron', () => ({ BrowserWindow: vi.fn(), ipcMain: { handle: vi.fn() }, screen: {} }))

import {
  buildTimerSuggestionHtml,
  computeTimerSuggestionBounds,
  parseTimerSuggestionAction,
  TIMER_SUGGESTION_ACTION_HOST,
  TIMER_SUGGESTION_SIZE,
} from '../../../electron/timerSuggestionWindow'
import { getTimerSuggestionDesktopApi } from '@/composables/timer/useElectronAutoStart'

describe('desktop timer suggestion popup (TASK-2102)', () => {
  afterEach(() => {
    delete (window as unknown as { electronAPI?: unknown }).electronAPI
  })

  it('offers the same three choices as the in-app modal and maps each to an action', () => {
    const html = buildTimerSuggestionHtml('Start a focus timer?')
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1])
    const actions = hrefs.map(parseTimerSuggestionAction)

    expect(html).toContain('Ready to focus?')
    expect(html).toContain('Discard for today')
    expect(html).toContain('Not now')
    expect(html).toContain('Start timer')
    expect(new Set(actions)).toEqual(new Set(['close', 'discardToday', 'start']))
    expect(html).not.toMatch(/<script/i)
  })

  it('ignores any navigation that is not one of its own action URLs', () => {
    expect(parseTimerSuggestionAction(`https://${TIMER_SUGGESTION_ACTION_HOST}/start`)).toBe('start')
    expect(parseTimerSuggestionAction(`https://${TIMER_SUGGESTION_ACTION_HOST}/deleteEverything`)).toBeNull()
    expect(parseTimerSuggestionAction('https://evil.example/start')).toBeNull()
    expect(parseTimerSuggestionAction(`http://${TIMER_SUGGESTION_ACTION_HOST}/start`)).toBeNull()
    expect(parseTimerSuggestionAction('not a url')).toBeNull()
  })

  it('escapes the message so it cannot inject markup', () => {
    const html = buildTimerSuggestionHtml('<img src=x onerror=alert(1)> & "quotes"')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quotes&quot;')
  })

  it('places the popup in the bottom-right of the active screen work area', () => {
    const bounds = computeTimerSuggestionBounds({ x: 1920, y: 0, width: 1920, height: 1040 })
    expect(bounds.width).toBe(TIMER_SUGGESTION_SIZE.width)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(1920 + 1920)
    expect(bounds.x).toBeGreaterThan(1920)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(1040)
  })

  it('only uses the desktop popup when the Electron bridge exposes it', () => {
    expect(getTimerSuggestionDesktopApi()).toBeNull()
    ;(window as unknown as { electronAPI: unknown }).electronAPI = { isElectron: true }
    expect(getTimerSuggestionDesktopApi()).toBeNull()
    ;(window as unknown as { electronAPI: unknown }).electronAPI = {
      isElectron: true,
      showTimerSuggestionWindow: async () => true,
      hideTimerSuggestionWindow: async () => true,
      onTimerSuggestionAction: () => () => {},
    }
    expect(getTimerSuggestionDesktopApi()).not.toBeNull()
  })
})
