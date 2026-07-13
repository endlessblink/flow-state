import { beforeEach, describe, expect, it } from 'vitest'
import {
  canonicalChangeCursorKey,
  createCanonicalChangeCursorStore,
  type CanonicalChangeScope,
} from '@/services/sync/canonicalChangeCursor'

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

const personal = (userId: string): CanonicalChangeScope => ({
  kind: 'personal',
  userId,
})

const workspace = (userId: string, workspaceId: string): CanonicalChangeScope => ({
  kind: 'workspace',
  userId,
  workspaceId,
})

describe('TASK-1947 canonical change cursor', () => {
  let storage: MemoryStorage

  beforeEach(() => {
    storage = new MemoryStorage()
  })

  it('keys personal cursors by the exact signed-in user', () => {
    expect(canonicalChangeCursorKey(personal('user-a'))).not.toBe(
      canonicalChangeCursorKey(personal('user-b'))
    )
  })

  it('keys workspace cursors by both signed-in user and exact workspace', () => {
    const userAWorkspaceOne = canonicalChangeCursorKey(workspace('user-a', 'workspace-1'))

    expect(userAWorkspaceOne).not.toBe(
      canonicalChangeCursorKey(workspace('user-a', 'workspace-2'))
    )
    expect(userAWorkspaceOne).not.toBe(
      canonicalChangeCursorKey(workspace('user-b', 'workspace-1'))
    )
    expect(userAWorkspaceOne).not.toBe(canonicalChangeCursorKey(personal('user-a')))
  })

  it('persists and reads independent personal and workspace high-water sequences', () => {
    const store = createCanonicalChangeCursorStore(storage)
    const personalScope = personal('user-a')
    const workspaceScope = workspace('user-a', 'workspace-1')

    store.write(personalScope, 17)
    store.write(workspaceScope, 91)

    expect(store.read(personalScope)).toBe(17)
    expect(store.read(workspaceScope)).toBe(91)
    expect(store.read(personal('user-b'))).toBeNull()
    expect(store.read(workspace('user-a', 'workspace-2'))).toBeNull()
  })

  it('treats malformed, negative, and fractional stored cursors as absent', () => {
    const store = createCanonicalChangeCursorStore(storage)
    const scopes = [
      personal('malformed'),
      personal('negative'),
      personal('fractional'),
    ]
    storage.setItem(canonicalChangeCursorKey(scopes[0]), 'not-a-sequence')
    storage.setItem(canonicalChangeCursorKey(scopes[1]), '-1')
    storage.setItem(canonicalChangeCursorKey(scopes[2]), '4.5')

    expect(scopes.map(scope => store.read(scope))).toEqual([null, null, null])
  })

  it('refuses to move a durable cursor backwards', () => {
    const store = createCanonicalChangeCursorStore(storage)
    const scope = personal('user-a')

    store.write(scope, 42)
    store.write(scope, 19)

    expect(store.read(scope)).toBe(42)
  })

  it('allows an explicit reset after a verified backend high-water rollback', () => {
    const store = createCanonicalChangeCursorStore(storage)
    const scope = personal('user-a')

    store.write(scope, 42)
    store.reset(scope, 7)

    expect(store.read(scope)).toBe(7)
  })
})
