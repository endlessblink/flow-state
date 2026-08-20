import { describe, expect, it } from 'vitest'
import {
  HEARTBEAT_STALE_AFTER_MS,
  formatRuntimeDiagnostic,
  isRendererHeartbeatStale,
  runtimeLogPaths,
} from '../../electron/runtimeDiagnosticsPolicy'

describe('persistent Electron runtime diagnostics', () => {
  it('marks a renderer stale only after the bounded heartbeat window', () => {
    const now = 100_000

    expect(isRendererHeartbeatStale(now - HEARTBEAT_STALE_AFTER_MS + 1, now)).toBe(false)
    expect(isRendererHeartbeatStale(now - HEARTBEAT_STALE_AFTER_MS, now)).toBe(true)
    expect(isRendererHeartbeatStale(null, now)).toBe(true)
  })

  it('keeps the active log and bounded rotated backups in one user-data directory', () => {
    expect(runtimeLogPaths('/tmp/flow-state')).toEqual([
      '/tmp/flow-state/runtime-diagnostics.log',
      '/tmp/flow-state/runtime-diagnostics.log.1',
      '/tmp/flow-state/runtime-diagnostics.log.2',
      '/tmp/flow-state/runtime-diagnostics.log.3',
    ])
  })

  it('writes structured, single-line records with a stable event name', () => {
    const line = formatRuntimeDiagnostic('renderer-heartbeat', { route: '/canvas' }, new Date('2026-08-20T12:00:00.000Z'))

    expect(line).toBe('{"ts":"2026-08-20T12:00:00.000Z","event":"renderer-heartbeat","route":"/canvas"}\n')
  })
})
