import { BrowserWindow, ipcMain, screen } from 'electron'

/**
 * TASK-2102: "Ready to focus?" must appear on the desktop, not only inside the
 * FlowState window (which is usually minimized or behind other apps).
 *
 * The popup is a tiny script-free page. Buttons navigate to an action URL on
 * a reserved `.invalid` host; the main process cancels that navigation and
 * forwards the action to the main renderer, which owns all timer logic.
 */

export type TimerSuggestionAction = 'start' | 'close' | 'discardToday'

export const TIMER_SUGGESTION_ACTION_HOST = 'flowstate-timer-suggestion.invalid'
export const TIMER_SUGGESTION_SIZE = { width: 400, height: 210 } as const
const EDGE_MARGIN = 24

export function parseTimerSuggestionAction(url: string): TimerSuggestionAction | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== TIMER_SUGGESTION_ACTION_HOST) return null
  const action = parsed.pathname.replace(/^\//, '')
  return action === 'start' || action === 'close' || action === 'discardToday' ? action : null
}

export function computeTimerSuggestionBounds(workArea: { x: number; y: number; width: number; height: number }) {
  const { width, height } = TIMER_SUGGESTION_SIZE
  return {
    width,
    height,
    x: Math.round(workArea.x + workArea.width - width - EDGE_MARGIN),
    y: Math.round(workArea.y + workArea.height - height - EDGE_MARGIN),
  }
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)

export function buildTimerSuggestionHtml(message: string): string {
  const action = (name: TimerSuggestionAction) => `https://${TIMER_SUGGESTION_ACTION_HOST}/${name}`
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>Ready to focus?</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: #252220; overflow: hidden;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #f3f0ec; }
  body { display: flex; flex-direction: column; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; }
  header { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.08); -webkit-app-region: drag; }
  h1 { margin: 0; font-size: 17px; font-weight: 700; }
  .close { -webkit-app-region: no-drag; width: 30px; height: 30px; display: grid; place-items: center;
    border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: #b8b2ab; text-decoration: none; font-size: 14px; }
  p { margin: 0; padding: 14px 20px; font-size: 13px; line-height: 1.55; color: #c9c3bc; flex: 1; }
  footer { display: flex; align-items: center; gap: 8px; padding: 12px 20px 16px;
    border-top: 1px solid rgba(255,255,255,0.08); }
  a.btn { text-decoration: none; font-size: 13px; font-weight: 600; padding: 7px 14px; border-radius: 999px; }
  .discard { color: #a39d96; margin-inline-end: auto; padding-inline: 4px; }
  .secondary { color: #e7e2dc; border: 1px solid rgba(255,255,255,0.16); }
  .primary { color: #2dd4bf; border: 1px solid #2dd4bf; }
  a:hover { filter: brightness(1.2); }
</style></head><body>
<header><h1>Ready to focus?</h1><a class="close" href="${action('close')}" aria-label="Close">✕</a></header>
<p>${escapeHtml(message)}</p>
<footer>
  <a class="btn discard" href="${action('discardToday')}">Discard for today</a>
  <a class="btn secondary" href="${action('close')}">Not now</a>
  <a class="btn primary" href="${action('start')}">Start timer</a>
</footer>
</body></html>`
}

export function registerTimerSuggestionWindow(getMainWindow: () => BrowserWindow | null): void {
  let popup: BrowserWindow | null = null

  const hide = () => {
    if (popup && !popup.isDestroyed()) popup.close()
    popup = null
  }

  const forward = (action: TimerSuggestionAction) => {
    hide()
    const main = getMainWindow()
    if (main && !main.isDestroyed()) main.webContents.send('timerSuggestion:action', action)
  }

  ipcMain.handle('timerSuggestion:show', async (_event, message: unknown) => {
    hide()
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    const window = new BrowserWindow({
      ...computeTimerSuggestionBounds(display.workArea),
      frame: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      show: false,
      title: 'Ready to focus?',
      backgroundColor: '#252220',
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, javascript: false },
    })
    window.setAlwaysOnTop(true, 'screen-saver')
    window.setVisibleOnAllWorkspaces(true)
    window.webContents.on('will-navigate', (event, url) => {
      event.preventDefault()
      const action = parseTimerSuggestionAction(url)
      if (action) forward(action)
    })
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    window.on('closed', () => {
      if (popup === window) popup = null
    })
    popup = window
    const text = typeof message === 'string' && message.trim() ? message : 'Start a focus timer?'
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildTimerSuggestionHtml(text))}`)
    if (popup === window && !window.isDestroyed()) window.showInactive()
    return true
  })

  ipcMain.handle('timerSuggestion:hide', () => {
    hide()
    return true
  })
}
