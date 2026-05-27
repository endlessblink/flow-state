import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const LOCAL_API_TS = readFileSync(
  resolve(__dirname, '../../../electron/ipc/localApi.ts'),
  'utf-8',
)

function handlerBody(channel: string): string {
  const marker = `ipcMain.handle('${channel}'`
  const start = LOCAL_API_TS.indexOf(marker)
  expect(start, `${channel} handler not found`).toBeGreaterThan(-1)

  const nextHandler = LOCAL_API_TS.indexOf('ipcMain.handle(', start + marker.length)
  return LOCAL_API_TS.slice(start, nextHandler === -1 ? undefined : nextHandler)
}

describe('Electron local API lifecycle regression contract', () => {
  it('starts the localhost sidecar as soon as a signed-in renderer session arrives', () => {
    const body = handlerBody('localApi:setSession')

    expect(body).toContain('latestSession = session')
    expect(body).toContain('startChild()')
    expect(body).toContain('pushSession()')
    expect(body).not.toMatch(/if\s*\(\s*config\.enabled\s*\)\s*{[^}]*startChild\(\)/)
  })

  it('keeps the sidecar running when Local Task API is disabled but a session is still available', () => {
    const body = handlerBody('localApi:setEnabled')

    expect(body).toContain('if (config.enabled)')
    expect(body).toContain('startChild()')
    expect(body).toContain('pushSession()')
    expect(body).toContain('} else if (!latestSession) {')
    expect(body).toContain('stopChild()')
  })

  it('stops the sidecar on sign-out only when no Local Task API consumer needs it', () => {
    const body = handlerBody('localApi:clearSession')

    expect(body).toContain('latestSession = null')
    expect(body).toContain("child.postMessage({ type: 'clear' })")
    expect(body).toContain('if (!config.enabled) stopChild()')
  })

  it('does not report KDE-only background sidecar activity as an enabled task API', () => {
    const body = handlerBody('localApi:status')

    expect(body).toContain('enabled: config.enabled')
    expect(body).toContain('running: config.enabled && !!child')
    expect(body).toContain('listening: config.enabled && listening')
  })
})
