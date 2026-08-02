import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  clearBlockedPendingUpdate,
  clearStalePendingUpdate,
  pendingUpdateFailurePath,
  recordPendingUpdateFailure,
} from '../../../electron/updater-pending'

const tempDirs: string[] = []

function makeCacheHome() {
  const cacheHome = mkdtempSync(join(tmpdir(), 'flowstate-updater-test-'))
  tempDirs.push(cacheHome)
  const pending = join(cacheHome, 'flow-state-updater', 'pending')
  mkdirSync(pending, { recursive: true })
  return cacheHome
}

function writePending(pending: string, fileName: string) {
  writeFileSync(join(pending, 'update-info.json'), JSON.stringify({ fileName }))
  writeFileSync(join(pending, fileName), 'pending-app-image')
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('Electron pending update recovery', () => {
  it('records and clears a failed newer update so startup cannot retry it forever', () => {
    const cacheHome = makeCacheHome()
    const fileName = 'FlowState-1.4.331-x86_64.AppImage'
    writePending(join(cacheHome, 'flow-state-updater', 'pending'), fileName)

    recordPendingUpdateFailure('sidecar readiness mismatch', cacheHome)

    expect(readFileSync(pendingUpdateFailurePath(cacheHome), 'utf8')).toContain(fileName)
    expect(clearBlockedPendingUpdate('1.4.330', cacheHome)).toMatchObject({
      cleared: true,
      pendingVersion: '1.4.331',
    })
    expect(existsSync(join(cacheHome, 'flow-state-updater', 'pending', fileName))).toBe(false)
    expect(existsSync(join(cacheHome, 'flow-state-updater', 'pending', 'update-info.json'))).toBe(false)
  })

  it('clears a completed or stale marker and its downloaded image', () => {
    const cacheHome = makeCacheHome()
    const fileName = 'FlowState-1.4.331-x86_64.AppImage'
    writePending(join(cacheHome, 'flow-state-updater', 'pending'), fileName)

    expect(clearStalePendingUpdate('1.4.331', cacheHome)).toMatchObject({
      cleared: true,
      pendingVersion: '1.4.331',
    })
    expect(existsSync(join(cacheHome, 'flow-state-updater', 'pending', fileName))).toBe(false)
  })
})
