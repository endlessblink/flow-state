export type CanonicalChangeScope =
  | { kind: 'personal'; userId: string }
  | { kind: 'workspace'; userId: string; workspaceId: string }

type CursorStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const CURSOR_PREFIX = 'flowstate:canonical-change-cursor:v1'

function encodeKeyPart(value: string): string {
  return encodeURIComponent(value)
}

export function canonicalChangeCursorKey(scope: CanonicalChangeScope): string {
  const user = encodeKeyPart(scope.userId)
  if (scope.kind === 'personal') return `${CURSOR_PREFIX}:${user}:personal`
  return `${CURSOR_PREFIX}:${user}:workspace:${encodeKeyPart(scope.workspaceId)}`
}

export function createCanonicalChangeCursorStore(storage: CursorStorage = localStorage) {
  return {
    read(scope: CanonicalChangeScope): number | null {
      const raw = storage.getItem(canonicalChangeCursorKey(scope))
      if (raw === null || raw.trim() === '') return null
      const sequence = Number(raw)
      return Number.isSafeInteger(sequence) && sequence >= 0 ? sequence : null
    },

    write(scope: CanonicalChangeScope, sequence: number): void {
      if (!Number.isSafeInteger(sequence) || sequence < 0) {
        throw new Error('Canonical change cursor must be a non-negative integer')
      }
      const current = this.read(scope)
      if (current !== null && sequence < current) return
      storage.setItem(canonicalChangeCursorKey(scope), String(sequence))
    },

    reset(scope: CanonicalChangeScope, sequence: number): void {
      if (!Number.isSafeInteger(sequence) || sequence < 0) {
        throw new Error('Canonical change cursor must be a non-negative integer')
      }
      storage.setItem(canonicalChangeCursorKey(scope), String(sequence))
    },

    clear(scope: CanonicalChangeScope): void {
      storage.removeItem(canonicalChangeCursorKey(scope))
    },
  }
}
