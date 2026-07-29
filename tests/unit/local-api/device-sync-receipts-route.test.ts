import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const server = readFileSync(resolve(__dirname, '../../../server/local-api/server.cjs'), 'utf8')
const capabilities = readFileSync(
  resolve(__dirname, '../../../server/local-api/hermes-route-capabilities.cjs'),
  'utf8',
)

describe('device sync receipt Local API route', () => {
  it('advertises and serves a read-only authenticated device receipt list', () => {
    expect(capabilities).toContain("method: 'GET', path: '/api/sync/devices'")
    expect(server).toContain("req.method === 'GET' && path === '/api/sync/devices'")
    expect(server).toContain("from('device_sync_receipts')")
    expect(server).toContain('handleGetDeviceSyncReceipts')
  })
})
