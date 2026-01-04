/**
 * PowerSync Vitest Mock
 *
 * Copy this file to: src/__mocks__/@powersync/web.ts
 *
 * Then add to vitest.config.ts:
 *   test: {
 *     alias: {
 *       '@powersync/web': path.resolve(__dirname, './src/__mocks__/@powersync/web.ts')
 *     }
 *   }
 */
import { vi } from 'vitest'

const subscribers = new Set<() => void>()

export class PowerSyncDatabase {
  connect = vi.fn().mockResolvedValue(undefined)
  disconnect = vi.fn()
  execute = vi.fn().mockResolvedValue({ rows: { _array: [] } })
  getAll = vi.fn().mockResolvedValue([])
  get = vi.fn().mockResolvedValue(null)

  // Mock the watcher to return an empty async iterator
  watch = vi.fn().mockReturnValue({
    [Symbol.asyncIterator]: async function* () {
      yield { rows: { _array: [] } }
    }
  })

  onChange = vi.fn()

  // Trigger a fake update for tests
  static emitChange() {
    subscribers.forEach(r => r())
    subscribers.clear()
  }
}

export const WASQLiteOpenFactory = vi.fn()
export const WASQLiteVFS = {
  OPFSCoopSyncVFS: 'OPFSCoopSyncVFS',
  IDBBatchAtomicVFS: 'IDBBatchAtomicVFS'
}
export const AbstractPowerSyncDatabase = vi.fn()
export const column = {
  text: 'text',
  integer: 'integer',
  real: 'real'
}
export class Table {
  constructor(cols: Record<string, string>) {}
}
export class Schema {
  constructor(tables: Table[]) {}
}
