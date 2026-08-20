import { join } from 'path'

export const HEARTBEAT_STALE_AFTER_MS = 15_000
export const RUNTIME_LOG_MAX_BYTES = 8 * 1024 * 1024
export const RUNTIME_LOG_BACKUP_COUNT = 3

export function isRendererHeartbeatStale(lastHeartbeatAt: number | null, now = Date.now()): boolean {
  return lastHeartbeatAt === null || now - lastHeartbeatAt >= HEARTBEAT_STALE_AFTER_MS
}

export function runtimeLogPaths(userDataPath: string): string[] {
  const current = join(userDataPath, 'runtime-diagnostics.log')
  return [current, ...Array.from({ length: RUNTIME_LOG_BACKUP_COUNT }, (_, index) => `${current}.${index + 1}`)]
}

export function formatRuntimeDiagnostic(
  event: string,
  data: Record<string, unknown> = {},
  timestamp = new Date(),
): string {
  return `${JSON.stringify({ ts: timestamp.toISOString(), event, ...data })}\n`
}
