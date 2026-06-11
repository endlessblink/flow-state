import { existsSync, readFileSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export interface PendingUpdateClearResult {
  cleared: boolean
  pendingVersion: string | null
  updateInfoPath: string
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

export function pendingAppImagePath(cacheHome?: string): string | null {
  const updateInfoPath = pendingUpdateInfoPath(cacheHome)
  if (!existsSync(updateInfoPath)) return null

  const info = JSON.parse(readFileSync(updateInfoPath, 'utf8')) as { fileName?: string }
  if (typeof info.fileName !== 'string' || !info.fileName.endsWith('.AppImage')) return null

  const updateFilePath = join(dirname(updateInfoPath), info.fileName)
  return existsSync(updateFilePath) ? updateFilePath : null
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
  const shouldClear = !pendingVersion || compareVersions(pendingVersion, appVersion) <= 0

  if (shouldClear) {
    rmSync(updateInfoPath, { force: true })
  }

  return {
    cleared: shouldClear,
    pendingVersion,
    updateInfoPath,
  }
}
