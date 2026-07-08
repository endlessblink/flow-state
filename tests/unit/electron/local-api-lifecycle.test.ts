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
  it('resolves the packaged sidecar next to main.cjs, not inside the ipc subdirectory', () => {
    const sidecarStart = LOCAL_API_TS.indexOf('function sidecarPath()')
    expect(sidecarStart, 'sidecarPath helper not found').toBeGreaterThan(-1)

    const sidecarBody = LOCAL_API_TS.slice(
      sidecarStart,
      LOCAL_API_TS.indexOf('\nfunction startChild()', sidecarStart),
    )

    expect(sidecarBody).toContain("join(__dirname, '..', 'local-api-server.cjs')")
    expect(sidecarBody).not.toContain("join(__dirname, 'local-api-server.cjs')")
  })

  it('starts the localhost sidecar as soon as a signed-in renderer session arrives', () => {
    const body = handlerBody('localApi:setSession')

    expect(body).toContain('latestSession = session')
    expect(body).toContain('startChild()')
    expect(body).toContain('pushSession()')
    expect(body).not.toMatch(/if\s*\(\s*config\.enabled\s*\)\s*{[^}]*startChild\(\)/)
  })

  it('passes the Electron userData directory to the sidecar for durable local AI runtime storage', () => {
    const startChild = LOCAL_API_TS.slice(
      LOCAL_API_TS.indexOf('function startChild()'),
      LOCAL_API_TS.indexOf('\nfunction stopChild()', LOCAL_API_TS.indexOf('function startChild()')),
    )

    expect(startChild).toContain('FLOW_STATE_API_DATA_DIR')
    expect(startChild).toContain("app.getPath('userData')")
  })

  it('passes the loaded Electron app version to the sidecar diagnostics context', () => {
    const startChild = LOCAL_API_TS.slice(
      LOCAL_API_TS.indexOf('function startChild()'),
      LOCAL_API_TS.indexOf('\nfunction stopChild()', LOCAL_API_TS.indexOf('function startChild()')),
    )

    expect(startChild).toContain('FLOW_STATE_APP_VERSION')
    expect(startChild).toContain('app.getVersion()')
  })

  it('keeps the sidecar running when Local Task API is disabled but a session is still available', () => {
    const body = handlerBody('localApi:setEnabled')

    expect(body).toContain('if (config.enabled)')
    expect(body).toContain('startChild()')
    expect(body).toContain('pushSession()')
    expect(body).toContain('} else if (!latestSession && !latestTimerSnapshot) {')
    expect(body).toContain('stopChild()')
  })

  it('stops the sidecar on sign-out only when no Local Task API consumer needs it', () => {
    const body = handlerBody('localApi:clearSession')

    expect(body).toContain('latestSession = null')
    expect(body).toContain("child.postMessage({ type: 'clear' })")
    expect(body).toContain('if (!config.enabled && !latestTimerSnapshot) stopChild()')
  })

  it('starts and updates the sidecar from a local timer snapshot without requiring auth', () => {
    const body = handlerBody('localApi:setTimerSnapshot')

    expect(body).toContain('latestTimerSnapshot = snapshot')
    expect(body).toContain('startChild()')
    expect(body).toContain('pushTimerSnapshot()')
    expect(body).not.toContain('latestSession')
  })

  it('does not report KDE-only background sidecar activity as an enabled task API', () => {
    const body = handlerBody('localApi:status')

    expect(body).toContain('enabled: config.enabled')
    expect(body).toContain('running: config.enabled && !!child')
    expect(body).toContain('listening: config.enabled && listening')
  })

  it('reports enough non-secret bridge state to diagnose Electron/KDE timer splits', () => {
    const body = handlerBody('localApi:status')

    expect(body).toContain('childPid')
    expect(body).toContain('appVersion')
    expect(body).toContain('lastStartAttemptAt')
    expect(body).toContain('lastSidecarPath')
    expect(body).toContain('sidecarPathExists')
    expect(body).toContain('lastChildExit')
    expect(body).toContain('lastChildError')
    expect(body).toContain('lastChildMessageType')
    expect(body).toContain('hasLatestSession')
    expect(body).toContain('hasLatestTimerSnapshot')
    expect(body).toContain('latestTimerSnapshotActive')
    expect(body).toContain('latestTimerSnapshotAgeMs')
    expect(body).not.toContain('token')
    expect(body).not.toContain('accessToken')
    expect(body).not.toContain('refreshToken')
  })

  it('records child spawn, message, error, and exit events without secret-bearing values', () => {
    const startChild = LOCAL_API_TS.slice(
      LOCAL_API_TS.indexOf('function startChild()'),
      LOCAL_API_TS.indexOf('\nfunction stopChild()', LOCAL_API_TS.indexOf('function startChild()')),
    )

    expect(startChild).toContain("child.on('spawn'")
    expect(startChild).toContain("child.on('error'")
    expect(startChild).toContain("child.on('exit'")
    expect(startChild).toContain('lastChildError')
    expect(startChild).toContain('lastChildExit')
    expect(startChild).toContain('lastChildMessageType')
    expect(startChild).not.toContain('FLOW_STATE_API_TOKEN: lastChildError')
  })
})
