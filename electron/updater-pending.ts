import { closeSync, existsSync, fsyncSync, lstatSync, openSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

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
const RECEIPT_LOCK_RETRIES = 100
const RECEIPT_LOCK_WAIT_MS = 10
const RECEIPT_LOCK_STALE_MS = 60 * 1000

function withPendingFailureLock<T>(failurePath: string, action: () => T): T {
  const lockPath = `${failurePath}.lock`
  let lockDescriptor: number | undefined
  try {
    for (let attempt = 0; attempt < RECEIPT_LOCK_RETRIES; attempt += 1) {
      try {
        lockDescriptor = openSync(lockPath, 'wx', 0o600)
        break
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
        try {
          if (Date.now() - statSync(lockPath).mtimeMs > RECEIPT_LOCK_STALE_MS) rmSync(lockPath, { force: true })
        } catch {
          // The lock may have been released between the failed open and stat.
        }
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, RECEIPT_LOCK_WAIT_MS)
      }
    }
    if (lockDescriptor === undefined) throw new Error('Timed out waiting for the updater failure receipt lock')
    return action()
  } finally {
    if (lockDescriptor !== undefined) rmSync(lockPath, { force: true })
    if (lockDescriptor !== undefined) closeSync(lockDescriptor)
  }
}

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

function artifactIdentityMatches(
  previous: Pick<PendingUpdateFailure, 'version' | 'artifactUrl' | 'digest'>,
  current: { version: string; artifactUrl: string; digest: string },
): boolean {
  if (previous.version !== current.version || previous.artifactUrl !== current.artifactUrl) return false
  return previous.digest === current.digest && (previous.digest.length > 0 || current.digest.length === 0)
}

function safePendingFilePath(updateInfoPath: string, fileName: string): string | null {
  const directory = resolve(dirname(updateInfoPath))
  const candidate = resolve(directory, fileName)
  if (dirname(candidate) !== directory) return null
  try {
    if (lstatSync(candidate).isSymbolicLink()) return null
    if (dirname(realpathSync(candidate)) !== directory) return null
  } catch {
    return null
  }
  return candidate
}

function pendingAppImageCandidates(cacheHome?: string): Array<{ path: string; version: string }> {
  const directory = pendingDirectory(cacheHome)
  if (!existsSync(directory)) return []

  return readdirSync(directory)
    .filter((fileName) => fileName.endsWith('.AppImage'))
    .map((fileName) => ({
      path: safePendingFilePath(join(directory, 'update-info.json'), fileName),
      version: versionFromUpdateFileName(fileName),
    }))
    .filter((candidate): candidate is { path: string; version: string } => Boolean(candidate.path && candidate.version))
    .sort((a, b) => compareVersions(b.version, a.version))
}

export function pendingAppImagePath(cacheHome?: string): string | null {
  const updateInfoPath = pendingUpdateInfoPath(cacheHome)
  if (existsSync(updateInfoPath)) {
    try {
      const info = JSON.parse(readFileSync(updateInfoPath, 'utf8')) as { fileName?: string }
      if (typeof info.fileName === 'string' && info.fileName.endsWith('.AppImage')) {
        const updateFilePath = safePendingFilePath(updateInfoPath, info.fileName)
        if (updateFilePath && existsSync(updateFilePath)) return updateFilePath
      }
    } catch {
      // A malformed record is discarded below; never interpret it as a path.
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
    const attemptCount = parsed.attemptCount
    if (
      typeof parsed.version === 'string' &&
      typeof parsed.artifactUrl === 'string' &&
      typeof parsed.digest === 'string' &&
      typeof parsed.errorClass === 'string' &&
      typeof attemptCount === 'number' &&
      Number.isInteger(attemptCount) &&
      attemptCount >= 1 &&
      typeof parsed.failedAt === 'string' &&
      typeof parsed.nextRetryAt === 'string' &&
      /^\d+\.\d+\.\d+$/.test(parsed.version) &&
      !Number.isNaN(Date.parse(parsed.failedAt)) &&
      !Number.isNaN(Date.parse(parsed.nextRetryAt))
    ) {
      return parsed as PendingUpdateFailure
    }
  } catch {
    // Older releases wrote a three-line marker; current detached installers use key/value lines.
  }
  if (raw.trimStart().startsWith('{')) return null
  const [fileName, reason, failedAt] = raw.split('\n')
  const fields = new Map(
    raw.split('\n').slice(1).flatMap((line) => {
      const separator = line.indexOf('=')
      return separator > 0 ? [[line.slice(0, separator), line.slice(separator + 1)]] : []
    }),
  )
  const version = versionFromUpdateFileName(fileName)
  if (!version) return null
  const parsedVersion = fields.get('version') || version
  const parsedFailedAt = fields.get('failedAt') || failedAt || new Date(0).toISOString()
  const parsedNextRetryAt = fields.get('nextRetryAt') || new Date(0).toISOString()
  const parsedAttemptCount = Number(fields.get('attemptCount')) || 1
  if (!/^\d+\.\d+\.\d+$/.test(parsedVersion) || parsedAttemptCount < 1
    || !Number.isInteger(parsedAttemptCount)
    || Number.isNaN(Date.parse(parsedFailedAt)) || Number.isNaN(Date.parse(parsedNextRetryAt))) return null
  return {
    version: parsedVersion,
    artifactUrl: fields.get('artifactUrl') || fileName,
    digest: fields.get('digest') || '',
    errorClass: fields.get('errorClass') || (reason?.includes('hash') ? 'verification' : 'legacy'),
    attemptCount: parsedAttemptCount,
    failedAt: parsedFailedAt,
    nextRetryAt: parsedNextRetryAt,
  }
}

export function shouldSuppressAutomaticRetry(
  failure: PendingUpdateFailure,
  now = new Date(),
): boolean {
  const nextRetryAt = Date.parse(failure.nextRetryAt)
  return failure.attemptCount < 1 || Number.isNaN(nextRetryAt)
    || failure.attemptCount >= MAX_AUTOMATIC_FAILURES || now.getTime() < nextRetryAt
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
  let currentArtifactUrl = resolvedFileName
  let currentDigest = ''
  try {
    const parsedInfo = JSON.parse(info) as { artifactUrl?: unknown; url?: unknown; sha512?: unknown; digest?: unknown }
    if (typeof parsedInfo.artifactUrl === 'string') currentArtifactUrl = parsedInfo.artifactUrl
    else if (typeof parsedInfo.url === 'string') currentArtifactUrl = parsedInfo.url
    if (typeof parsedInfo.digest === 'string') currentDigest = parsedInfo.digest
    else if (typeof parsedInfo.sha512 === 'string') currentDigest = parsedInfo.sha512
  } catch {
    // Legacy metadata only carries the file name; an existing digest cannot be safely reused.
  }
  const exactIdentityBlocked = failure !== null && resolvedFileName.length > 0
    && artifactIdentityMatches(failure, {
      version: pendingVersion ?? '',
      artifactUrl: currentArtifactUrl,
      digest: currentDigest,
    })
  const lexicalCandidate = resolve(dirname(updateInfoPath), resolvedFileName)
  const unsafeMetadataBlocked = failure !== null && resolvedFileName.length > 0
    && failure.version === pendingVersion
    && failure.artifactUrl === resolvedFileName
    && dirname(lexicalCandidate) !== dirname(updateInfoPath)
  const blocked = exactIdentityBlocked || unsafeMetadataBlocked
  if (blocked && pendingVersion && compareVersions(pendingVersion, appVersion) > 0) {
    const updateFilePath = safePendingFilePath(updateInfoPath, resolvedFileName)
    if (!updateFilePath && dirname(lexicalCandidate) === dirname(updateInfoPath) && existsSync(lexicalCandidate)) {
      // The metadata is blocked, but the candidate is unsafe to remove; clear only
      // the updater records and leave the potentially external file untouched.
      rmSync(updateInfoPath, { force: true })
      rmSync(failurePath, { force: true })
      return { cleared: true, pendingVersion, updateInfoPath }
    }
    if (updateFilePath) rmSync(updateFilePath, { force: true })
    rmSync(updateInfoPath, { force: true })
    rmSync(failurePath, { force: true })
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
  const failurePath = pendingUpdateFailurePath(cacheHome)
  withPendingFailureLock(failurePath, () => {
    const info = readFileSync(updateInfoPath, 'utf8')
    const fileName = info.match(/"fileName"\s*:\s*"([^"]+)"/)?.[1]
    if (!fileName) return
    const now = options.now ?? new Date()
    const previous = readPendingUpdateFailure(cacheHome)
    const version = versionFromUpdateFileName(fileName) ?? 'unknown'
    const previousMatchesArtifact = previous
      && artifactIdentityMatches(previous, {
        version,
        artifactUrl: options.artifactUrl ?? fileName,
        digest: options.digest ?? '',
      })
    const priorFailure = previousMatchesArtifact ? previous : undefined
    const attemptCount = (priorFailure?.attemptCount ?? 0) + 1
    const backoff = Math.min(RETRY_BACKOFF_MS * 2 ** (attemptCount - 1), MAX_RETRY_BACKOFF_MS)
    const failure: PendingUpdateFailure = {
      version,
      artifactUrl: options.artifactUrl ?? priorFailure?.artifactUrl ?? fileName,
      digest: options.digest ?? priorFailure?.digest ?? '',
      errorClass: options.errorClass ?? 'unknown',
      attemptCount,
      failedAt: now.toISOString(),
      nextRetryAt: new Date(now.getTime() + backoff).toISOString(),
    }
    const temporaryPath = `${failurePath}.tmp-${process.pid}-${randomUUID()}`
    try {
      writeFileSync(temporaryPath, JSON.stringify(failure, null, 2) + '\n', { encoding: 'utf8', mode: 0o600, flag: 'wx' })
      const fileDescriptor = openSync(temporaryPath, 'r')
      try {
        fsyncSync(fileDescriptor)
      } finally {
        closeSync(fileDescriptor)
      }
      renameSync(temporaryPath, failurePath)
      const directoryDescriptor = openSync(dirname(failurePath), 'r')
      try {
        fsyncSync(directoryDescriptor)
      } finally {
        closeSync(directoryDescriptor)
      }
    } catch (error) {
      rmSync(temporaryPath, { force: true })
      throw error
    }
  })
}

export function clearStalePendingUpdate(
  appVersion: string,
  cacheHome?: string,
): PendingUpdateClearResult {
  const updateInfoPath = pendingUpdateInfoPath(cacheHome)
  if (!existsSync(updateInfoPath)) {
    return { cleared: false, pendingVersion: null, updateInfoPath }
  }

  let info: { fileName?: string }
  try {
    info = JSON.parse(readFileSync(updateInfoPath, 'utf8')) as { fileName?: string }
  } catch {
    rmSync(updateInfoPath, { force: true })
    rmSync(pendingUpdateFailurePath(cacheHome), { force: true })
    return { cleared: true, pendingVersion: null, updateInfoPath }
  }
  const pendingVersion = versionFromUpdateFileName(info.fileName)
  const fileName = info.fileName
  const shouldClear = !pendingVersion || compareVersions(pendingVersion, appVersion) <= 0

  if (shouldClear) {
    rmSync(updateInfoPath, { force: true })
    if (fileName) {
      const updateFilePath = safePendingFilePath(updateInfoPath, fileName)
      if (updateFilePath) rmSync(updateFilePath, { force: true })
    }
    rmSync(pendingUpdateFailurePath(cacheHome), { force: true })
  }

  return {
    cleared: shouldClear,
    pendingVersion,
    updateInfoPath,
  }
}
