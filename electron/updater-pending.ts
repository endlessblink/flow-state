import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export interface PendingUpdateClearResult {
  cleared: boolean
  pendingVersion: string | null
  updateInfoPath: string
}

export interface PendingUpdateFailure {
  version: string
  artifactUrl: string
  digest: string
  errorClass: string
  attemptCount: number
  failedAt: string
  nextRetryAt: string
}

export interface PendingUpdateFailureOptions {
  artifactUrl?: string
  digest?: string
  errorClass?: string
  now?: Date
}

const MAX_AUTOMATIC_FAILURES = 3
const RETRY_BACKOFF_MS = 5 * 60 * 1000
const MAX_RETRY_BACKOFF_MS = 24 * 60 * 60 * 1000

export function compareVersions(a: string, b: string): number {
  const aParts = parseVersionCore(a)
  const bParts = parseVersionCore(b)
  for (let i = 0; i < 3; i += 1) {
    const diff = (aParts[i] || 0) - (bParts[i] || 0)
    if (diff !== 0) return diff
  }
  return 0
}

function parseVersionCore(version: string): number[] {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!match) return []
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

export function versionFromUpdateFileName(fileName: unknown): string | null {
  if (typeof fileName !== 'string') return null
  const match = fileName.match(/(\d+\.\d+\.\d+)(?:[+][0-9A-Za-z.-]+)?/)
  return match?.[1] ?? null
}

export function pendingUpdateInfoPath(cacheHome = process.env.XDG_CACHE_HOME || join(homedir(), '.cache')): string {
  return join(cacheHome, 'flow-state-updater', 'pending', 'update-info.json')
}

function pendingDirectory(cacheHome?: string): string {
  return dirname(pendingUpdateInfoPath(cacheHome))
}

function pendingAppImageCandidates(cacheHome?: string): Array<{ path: string; version: string }> {
  const directory = pendingDirectory(cacheHome)
  if (!existsSync(directory)) return []

  return readdirSync(directory)
    .filter((fileName) => fileName.endsWith('.AppImage'))
    .map((fileName) => ({ path: join(directory, fileName), version: versionFromUpdateFileName(fileName) }))
    .filter((candidate): candidate is { path: string; version: string } => Boolean(candidate.version))
    .sort((a, b) => compareVersions(b.version, a.version))
}

export function pendingAppImagePath(cacheHome?: string): string | null {
  const updateInfoPath = pendingUpdateInfoPath(cacheHome)
  if (existsSync(updateInfoPath)) {
    const info = JSON.parse(readFileSync(updateInfoPath, 'utf8')) as { fileName?: string }
    if (typeof info.fileName === 'string' && info.fileName.endsWith('.AppImage')) {
      const updateFilePath = join(dirname(updateInfoPath), info.fileName)
      if (existsSync(updateFilePath)) return updateFilePath
    }
  }

  return pendingAppImageCandidates(cacheHome)[0]?.path ?? null
}

export function clearObsoletePendingAppImages(appVersion: string, cacheHome?: string): string[] {
  const removed: string[] = []
  for (const candidate of pendingAppImageCandidates(cacheHome)) {
    if (compareVersions(candidate.version, appVersion) <= 0) {
      rmSync(candidate.path, { force: true })
      removed.push(candidate.path)
    }
  }
  return removed
}

export function pendingUpdateFailurePath(cacheHome = process.env.XDG_CACHE_HOME || join(homedir(), '.cache')): string {
  return `${pendingUpdateInfoPath(cacheHome)}.failed`
}

export function pendingUpdateFailureVersion(cacheHome?: string): string | null {
  return readPendingUpdateFailure(cacheHome)?.version ?? null
}

export function readPendingUpdateFailure(cacheHome?: string): PendingUpdateFailure | null {
  const failurePath = pendingUpdateFailurePath(cacheHome)
  if (!existsSync(failurePath)) return null
  const raw = readFileSync(failurePath, 'utf8')
  try {
    const parsed = JSON.parse(raw) as Partial<PendingUpdateFailure>
    if (
      typeof parsed.version === 'string' &&
      typeof parsed.artifactUrl === 'string' &&
      typeof parsed.digest === 'string' &&
      typeof parsed.errorClass === 'string' &&
      Number.isInteger(parsed.attemptCount) &&
      typeof parsed.failedAt === 'string' &&
      typeof parsed.nextRetryAt === 'string'
    ) {
      return parsed as PendingUpdateFailure
    }
  } catch {
    // Older releases wrote a three-line marker; current detached installers use key/value lines.
  }
  const [fileName, reason, failedAt] = raw.split('\n')
  const fields = new Map(
    raw.split('\n').slice(1).flatMap((line) => {
      const separator = line.indexOf('=')
      return separator > 0 ? [[line.slice(0, separator), line.slice(separator + 1)]] : []
    }),
  )
  const version = versionFromUpdateFileName(fileName)
  if (!version) return null
  return {
    version: fields.get('version') || version,
    artifactUrl: fields.get('artifactUrl') || fileName,
    digest: fields.get('digest') || '',
    errorClass: fields.get('errorClass') || (reason?.includes('hash') ? 'verification' : 'legacy'),
    attemptCount: Number(fields.get('attemptCount')) || 1,
    failedAt: fields.get('failedAt') || failedAt || new Date(0).toISOString(),
    nextRetryAt: fields.get('nextRetryAt') || new Date(0).toISOString(),
  }
}

export function shouldSuppressAutomaticRetry(
  failure: PendingUpdateFailure,
  now = new Date(),
): boolean {
  return failure.attemptCount >= MAX_AUTOMATIC_FAILURES || now.getTime() < Date.parse(failure.nextRetryAt)
}

export function clearResolvedPendingUpdateFailure(appVersion: string, cacheHome?: string): boolean {
  const failurePath = pendingUpdateFailurePath(cacheHome)
  const failureVersion = pendingUpdateFailureVersion(cacheHome) ?? (() => {
    if (!existsSync(failurePath)) return null
    const raw = readFileSync(failurePath, 'utf8')
    const jsonVersion = raw.match(/"version"\s*:\s*"(\d+\.\d+\.\d+)"/)?.[1]
    const fileVersion = versionFromUpdateFileName(raw.split('\n', 1)[0])
    return jsonVersion ?? fileVersion
  })()
  if (!failureVersion || compareVersions(failureVersion, appVersion) > 0) return false
  rmSync(failurePath, { force: true })
  return true
}

export function clearBlockedPendingUpdate(
  appVersion: string,
  cacheHome?: string,
): PendingUpdateClearResult {
  const updateInfoPath = pendingUpdateInfoPath(cacheHome)
  const failurePath = pendingUpdateFailurePath(cacheHome)
  if (!existsSync(failurePath)) {
    return { cleared: false, pendingVersion: null, updateInfoPath }
  }

  const info = existsSync(updateInfoPath) ? readFileSync(updateInfoPath, 'utf8') : ''
  const fileName = (info.match(/"fileName"\s*:\s*"([^"]+)"/)?.[1] ?? '')
  const failedFileName = readFileSync(failurePath, 'utf8').split('\n', 1)[0]
  const resolvedFileName = fileName || failedFileName
  const pendingVersion = versionFromUpdateFileName(resolvedFileName)
  const failure = readPendingUpdateFailure(cacheHome)
  const blocked = resolvedFileName.length > 0 && failure?.artifactUrl.split('/').pop() === resolvedFileName
  if (blocked && pendingVersion && compareVersions(pendingVersion, appVersion) > 0) {
    rmSync(updateInfoPath, { force: true })
    rmSync(failurePath, { force: true })
    rmSync(join(dirname(updateInfoPath), resolvedFileName), { force: true })
    return { cleared: true, pendingVersion, updateInfoPath }
  }

  return { cleared: false, pendingVersion, updateInfoPath }
}

export function recordPendingUpdateFailure(
  reason: string,
  cacheHome?: string,
  options: PendingUpdateFailureOptions = {},
): void {
  const updateInfoPath = pendingUpdateInfoPath(cacheHome)
  if (!existsSync(updateInfoPath)) return
  const info = readFileSync(updateInfoPath, 'utf8')
  const fileName = info.match(/"fileName"\s*:\s*"([^"]+)"/)?.[1]
  if (!fileName) return
  const now = options.now ?? new Date()
  const previous = readPendingUpdateFailure(cacheHome)
  const attemptCount = (previous?.attemptCount ?? 0) + 1
  const backoff = Math.min(RETRY_BACKOFF_MS * 2 ** (attemptCount - 1), MAX_RETRY_BACKOFF_MS)
  const failure: PendingUpdateFailure = {
    version: versionFromUpdateFileName(fileName) ?? 'unknown',
    artifactUrl: options.artifactUrl ?? previous?.artifactUrl ?? fileName,
    digest: options.digest ?? previous?.digest ?? '',
    errorClass: options.errorClass ?? 'unknown',
    attemptCount,
    failedAt: now.toISOString(),
    nextRetryAt: new Date(now.getTime() + backoff).toISOString(),
  }
  writeFileSync(pendingUpdateFailurePath(cacheHome), JSON.stringify(failure, null, 2) + '\n', 'utf8')
}

export function clearStalePendingUpdate(
  appVersion: string,
  cacheHome?: string,
): PendingUpdateClearResult {
  const updateInfoPath = pendingUpdateInfoPath(cacheHome)
  if (!existsSync(updateInfoPath)) {
    return { cleared: false, pendingVersion: null, updateInfoPath }
  }

  const info = JSON.parse(readFileSync(updateInfoPath, 'utf8')) as { fileName?: string }
  const pendingVersion = versionFromUpdateFileName(info.fileName)
  const fileName = info.fileName
  const shouldClear = !pendingVersion || compareVersions(pendingVersion, appVersion) <= 0

  if (shouldClear) {
    rmSync(updateInfoPath, { force: true })
    if (fileName) rmSync(join(dirname(updateInfoPath), fileName), { force: true })
    rmSync(pendingUpdateFailurePath(cacheHome), { force: true })
  }

  return {
    cleared: shouldClear,
    pendingVersion,
    updateInfoPath,
  }
}
