import type { SyncStatus, WriteOperation } from '@/types/sync'
import { supabase } from '@/services/auth/supabase'
import { getWriteQueueDB } from '@/services/offline/writeQueueDB'
import { isCapacitor, isElectron, isPWA } from '@/utils/platform'

declare const __APP_VERSION__: string

const DEVICE_ID_KEY = 'flowstate-sync-device-id-v1'

export type SyncRuntime = 'pwa' | 'electron' | 'capacitor' | 'browser'

interface BuildDeviceSyncReceiptInput {
  deviceId: string
  runtime: SyncRuntime
  appVersion: string
  status: SyncStatus
  isOnline: boolean
  lastSyncAt?: number
  operations: WriteOperation[]
}

function classifyError(message?: string): string | null {
  if (!message) return null
  const normalized = message.toLowerCase()
  if (/jwt|auth|session|sign.?in|token/.test(normalized)) return 'auth'
  if (/network|fetch|offline|timeout|connection/.test(normalized)) return 'network'
  if (/conflict|revision|version/.test(normalized)) return 'conflict'
  if (/row.level|rls|permission|policy|forbidden/.test(normalized)) return 'authorization'
  return 'write'
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function buildDeviceSyncReceipt(input: BuildDeviceSyncReceiptInput) {
  const unresolved = input.operations.filter(operation => operation.status !== 'completed')
  const operations = await Promise.all(unresolved.slice(0, 20).map(async operation => ({
    localSequence: operation.id ?? null,
    entityType: operation.entityType,
    operation: operation.operation,
    entityId: operation.entityId,
    status: operation.status,
    retryCount: operation.retryCount,
    createdAt: new Date(operation.createdAt).toISOString(),
    lastAttemptAt: operation.lastAttemptAt ? new Date(operation.lastAttemptAt).toISOString() : null,
    titleSha256: typeof operation.payload.title === 'string'
      ? await sha256(operation.payload.title)
      : null,
    errorCode: classifyError(operation.lastError),
  })))

  return {
    deviceId: input.deviceId,
    runtime: input.runtime,
    appVersion: input.appVersion,
    status: input.status,
    isOnline: input.isOnline,
    lastSyncAt: input.lastSyncAt ? new Date(input.lastSyncAt).toISOString() : null,
    queue: {
      pending: unresolved.filter(operation => operation.status === 'pending').length,
      syncing: unresolved.filter(operation => operation.status === 'syncing').length,
      failed: unresolved.filter(operation => operation.status === 'failed').length,
      conflict: unresolved.filter(operation => operation.status === 'conflict').length,
    },
    operations,
  }
}

function getOrCreateDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY)
  if (existing) return existing
  const created = crypto.randomUUID()
  localStorage.setItem(DEVICE_ID_KEY, created)
  return created
}

function detectRuntime(): SyncRuntime {
  if (isElectron()) return 'electron'
  if (isCapacitor()) return 'capacitor'
  if (isPWA()) return 'pwa'
  return 'browser'
}

export async function publishDeviceSyncReceipt(input: {
  userId: string
  status: SyncStatus
  isOnline: boolean
  lastSyncAt?: number
}): Promise<void> {
  if (!supabase || !input.userId || !input.isOnline) return

  const operations = await getWriteQueueDB().operations
    .where('status')
    .anyOf(['pending', 'syncing', 'failed', 'conflict'])
    .toArray()
  const receipt = await buildDeviceSyncReceipt({
    deviceId: getOrCreateDeviceId(),
    runtime: detectRuntime(),
    appVersion: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'unknown',
    status: input.status,
    isOnline: input.isOnline,
    lastSyncAt: input.lastSyncAt,
    operations,
  })

  const { error } = await supabase.from('device_sync_receipts').upsert({
    user_id: input.userId,
    device_id: receipt.deviceId,
    runtime: receipt.runtime,
    app_version: receipt.appVersion,
    status: receipt.status,
    is_online: receipt.isOnline,
    last_sync_at: receipt.lastSyncAt,
    queue: receipt.queue,
    operations: receipt.operations,
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'user_id,device_id' })

  if (error) throw error
}
