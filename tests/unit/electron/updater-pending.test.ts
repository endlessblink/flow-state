import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  clearBlockedPendingUpdate,
  clearStalePendingUpdate,
  clearObsoletePendingAppImages,
  pendingAppImagePath,
  pendingUpdateFailurePath,
  pendingUpdateFailureVersion,
  clearResolvedPendingUpdateFailure,
  recordPendingUpdateFailure,
  readPendingUpdateFailure,
  shouldSuppressAutomaticRetry,
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

    expect(pendingUpdateFailureVersion(cacheHome)).toBe('1.4.331')

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

  it('recovers the newest downloaded AppImage when updater metadata is missing', () => {
    const cacheHome = makeCacheHome()
    const pending = join(cacheHome, 'flow-state-updater', 'pending')
    writeFileSync(join(pending, 'FlowState-1.4.331-x86_64.AppImage'), 'old')
    writeFileSync(join(pending, 'FlowState-1.4.332-x86_64.AppImage'), 'new')

    expect(pendingAppImagePath(cacheHome)).toBe(join(pending, 'FlowState-1.4.332-x86_64.AppImage'))
    expect(clearObsoletePendingAppImages('1.4.331', cacheHome)).toEqual([
      join(pending, 'FlowState-1.4.331-x86_64.AppImage'),
    ])
    expect(existsSync(join(pending, 'FlowState-1.4.332-x86_64.AppImage'))).toBe(true)
  })

  it('rejects symlinked pending AppImages instead of launching outside the pending directory', () => {
    const cacheHome = makeCacheHome()
    const pending = join(cacheHome, 'flow-state-updater', 'pending')
    const outside = join(cacheHome, 'outside.AppImage')
    writeFileSync(outside, 'outside-app-image')
    symlinkSync(outside, join(pending, 'FlowState-9.9.999-x86_64.AppImage'))
    writePending(pending, 'FlowState-9.9.998-x86_64.AppImage')
    rmSync(join(pending, 'FlowState-9.9.998-x86_64.AppImage'))

    expect(pendingAppImagePath(cacheHome)).toBeNull()
  })

  it('clears a failed marker even after electron-updater removed its metadata', () => {
    const cacheHome = makeCacheHome()
    const pending = join(cacheHome, 'flow-state-updater', 'pending')
    const fileName = 'FlowState-1.4.336-x86_64.AppImage'
    writeFileSync(join(pending, fileName), 'failed-app-image')
    writeFileSync(pendingUpdateFailurePath(cacheHome), `${fileName}\ndirect replacement readiness\n`)

    expect(clearBlockedPendingUpdate('1.4.335', cacheHome)).toMatchObject({
      cleared: true,
      pendingVersion: '1.4.336',
    })
    expect(existsSync(join(pending, fileName))).toBe(false)
    expect(existsSync(pendingUpdateFailurePath(cacheHome))).toBe(false)
  })

  it('clears a failure marker once the installed app has reached that version', () => {
    const cacheHome = makeCacheHome()
    writeFileSync(pendingUpdateFailurePath(cacheHome), 'FlowState-1.4.331-x86_64.AppImage\nreadiness\n')

    expect(clearResolvedPendingUpdateFailure('1.4.331', cacheHome)).toBe(true)
    expect(pendingUpdateFailureVersion(cacheHome)).toBeNull()
  })

  it('cleans a malformed but clearly stale version marker without touching newer markers', () => {
    const cacheHome = makeCacheHome()
    writeFileSync(pendingUpdateFailurePath(cacheHome), '{"version":"1.4.331","attemptCount":oops}\n')

    expect(clearResolvedPendingUpdateFailure('1.4.331', cacheHome)).toBe(true)
    expect(existsSync(pendingUpdateFailurePath(cacheHome))).toBe(false)

    writeFileSync(pendingUpdateFailurePath(cacheHome), '{"version":"1.4.332","attemptCount":oops}\n')
    expect(clearResolvedPendingUpdateFailure('1.4.331', cacheHome)).toBe(false)
    expect(existsSync(pendingUpdateFailurePath(cacheHome))).toBe(true)
  })

  it('stores an inspectable failure receipt and increases the retry delay', () => {
    const cacheHome = makeCacheHome()
    const pending = join(cacheHome, 'flow-state-updater', 'pending')
    const fileName = 'FlowState-1.4.337-x86_64.AppImage'
    writePending(pending, fileName)

    recordPendingUpdateFailure('hash mismatch', cacheHome, {
      errorClass: 'verification',
      artifactUrl: 'https://in-theflow.com/updates/electron/FlowState-1.4.337-x86_64.AppImage',
      digest: 'sha512:expected',
      now: new Date('2026-08-26T10:00:00.000Z'),
    })
    const first = readPendingUpdateFailure(cacheHome)!
    recordPendingUpdateFailure('installer failed', cacheHome, {
      errorClass: 'installer',
      artifactUrl: first.artifactUrl,
      digest: first.digest,
      now: new Date('2026-08-26T10:01:00.000Z'),
    })
    const second = readPendingUpdateFailure(cacheHome)!

    expect(first).toMatchObject({
      version: '1.4.337',
      artifactUrl: 'https://in-theflow.com/updates/electron/FlowState-1.4.337-x86_64.AppImage',
      digest: 'sha512:expected',
      errorClass: 'verification',
      attemptCount: 1,
    })
    expect(second.attemptCount).toBe(2)
    expect(new Date(second.nextRetryAt).getTime()).toBeGreaterThan(new Date(first.nextRetryAt).getTime())
  })

  it('stops automatic retries after repeated failures but permits a manual retry', () => {
    const cacheHome = makeCacheHome()
    const pending = join(cacheHome, 'flow-state-updater', 'pending')
    writePending(pending, 'FlowState-1.4.338-x86_64.AppImage')
    for (let attempt = 0; attempt < 3; attempt += 1) {
      recordPendingUpdateFailure('readiness failed', cacheHome, {
        errorClass: 'readiness',
        now: new Date(`2026-08-26T10:0${attempt}:00.000Z`),
      })
    }

    const failure = readPendingUpdateFailure(cacheHome)!
    expect(failure.attemptCount).toBe(3)
    expect(shouldSuppressAutomaticRetry(failure, new Date('2026-08-26T12:00:00.000Z'))).toBe(true)
    expect(clearBlockedPendingUpdate('1.4.337', cacheHome).cleared).toBe(true)
    expect(readPendingUpdateFailure(cacheHome)).toBeNull()
  })

  it('clears failures for equal or newer installed versions, but keeps a truly newer target', () => {
    const cacheHome = makeCacheHome()
    writeFileSync(pendingUpdateFailurePath(cacheHome), JSON.stringify({
      version: '1.4.340',
      artifactUrl: 'FlowState-1.4.340-x86_64.AppImage',
      digest: 'digest',
      errorClass: 'installer',
      attemptCount: 1,
      failedAt: '2026-08-26T10:00:00.000Z',
      nextRetryAt: '2026-08-26T10:05:00.000Z',
    }))
    expect(clearResolvedPendingUpdateFailure('1.4.340', cacheHome)).toBe(true)

    writeFileSync(pendingUpdateFailurePath(cacheHome), JSON.stringify({
      version: '1.4.341', artifactUrl: 'FlowState-1.4.341-x86_64.AppImage', digest: 'digest',
      errorClass: 'installer', attemptCount: 1, failedAt: '2026-08-26T10:00:00.000Z',
      nextRetryAt: '2026-08-26T10:05:00.000Z',
    }))
    expect(clearResolvedPendingUpdateFailure('1.4.340', cacheHome)).toBe(false)
    expect(pendingUpdateFailureVersion(cacheHome)).toBe('1.4.341')
  })

  it('fails closed for semantically malformed JSON failure receipts', () => {
    const cacheHome = makeCacheHome()
    writeFileSync(pendingUpdateFailurePath(cacheHome), JSON.stringify({
      version: '1.4.340', artifactUrl: 'FlowState-1.4.340-x86_64.AppImage', digest: '',
      errorClass: 'installer', attemptCount: -1,
      failedAt: 'not-a-date', nextRetryAt: 'not-a-date',
    }))

    expect(readPendingUpdateFailure(cacheHome)).toBeNull()
  })

  it('suppresses automatic retry when an in-memory failure receipt has invalid timing', () => {
    expect(shouldSuppressAutomaticRetry({
      version: '1.4.340', artifactUrl: 'FlowState-1.4.340-x86_64.AppImage', digest: '',
      errorClass: 'installer', attemptCount: 1,
      failedAt: 'not-a-date', nextRetryAt: 'not-a-date',
    })).toBe(true)
  })
})
