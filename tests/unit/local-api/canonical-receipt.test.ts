import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const modulePath = resolve(process.cwd(), 'server/local-api/canonical-receipt.cjs')

type CanonicalReceiptModule = {
  canonicalHash: (value: unknown) => string
  canonicalJson: (value: unknown) => string
  validateCanonicalReceipt: (
    receipt: unknown,
    options?: {
      bindPrimaryAffectedReadBack?: boolean
      expectedFields?: Record<string, unknown>
      expectedOperationId?: string
      expectedRequestHash?: string
      validateReadBack?: (value: Record<string, unknown>) => boolean
    },
  ) => { ok: true } | { ok: false; code: string }
}

const canonical = (): CanonicalReceiptModule => require(modulePath) as CanonicalReceiptModule

function receipt(overrides: Record<string, unknown> = {}) {
  const { canonicalHash } = canonical()
  const readBack = {
    id: 'task-1',
    canonicalRevision: 8,
    canonicalUpdatedAt: '2026-07-15T12:00:00.000Z',
    title: 'שלום',
  }
  return {
    ok: true,
    status: 'committed',
    operationId: 'operation-1',
    requestHash: 'a'.repeat(64),
    contractVersion: 'task-v1',
    source: 'local-api',
    entityType: 'task',
    action: 'patch',
    entityId: 'task-1',
    canonicalRevision: 8,
    changeSequence: 42,
    committedAt: '2026-07-15T12:00:01.000Z',
    replayed: false,
    readBack,
    readBackHash: canonicalHash(readBack),
    ...overrides,
  }
}

describe('canonical assistant receipt validation', () => {
  it('uses the existing FlowState canonical JSON ordering and UTF-8 values', () => {
    const { canonicalHash, canonicalJson } = canonical()

    expect(canonicalJson({ z: 2, nested: { b: true, a: null }, title: 'שלום' }))
      .toBe('{"nested":{"a":null,"b":true},"title":"שלום","z":2}')
    expect(canonicalHash({ b: 2, a: 1 })).toMatch(/^[0-9a-f]{64}$/)
    expect(canonicalHash({ b: 2, a: 1 })).toBe(canonicalHash({ a: 1, b: 2 }))
    expect(canonicalJson({ title: '🧺 Laundry' })).toBe('{"title":"🧺 Laundry"}')
  })

  it('matches the migrated SQL task read-back vector byte-for-byte', () => {
    const { canonicalHash, canonicalJson } = canonical()
    const sqlTaskReadBack = {
      id: 'task-1',
      title: 'שלום',
      status: 'todo',
      completedAt: null,
      dueDate: '2026-07-16T00:00:00+00:00',
      isDeleted: false,
      deletedAt: null,
      workspaceId: null,
      canonicalRevision: 8,
      canonicalUpdatedAt: '2026-07-15T12:00:00+00:00',
      recurrenceRule: { interval: 1, pattern: 'weekly' },
      recurrenceParentId: null,
      recurrenceCount: 2,
      isCompletionRecord: false,
    }

    expect(canonicalJson(sqlTaskReadBack)).toBe('{"canonicalRevision":8,"canonicalUpdatedAt":"2026-07-15T12:00:00+00:00","completedAt":null,"deletedAt":null,"dueDate":"2026-07-16T00:00:00+00:00","id":"task-1","isCompletionRecord":false,"isDeleted":false,"recurrenceCount":2,"recurrenceParentId":null,"recurrenceRule":{"interval":1,"pattern":"weekly"},"status":"todo","title":"שלום","workspaceId":null}')
    expect(canonicalHash(sqlTaskReadBack)).toBe('5c85f453f5d1959a8e737df5ce25434fb2b428ca3bc0dd1ae445af2e8b769456')

    const doneReadBack = {
      ...sqlTaskReadBack,
      completedOccurrence: {
        id: 'history-1', status: 'done', dueDate: '2026-07-12',
        completedAt: '2026-07-15T12:00:00+00:00',
      },
      nextOccurrence: {
        id: 'instance-2', taskId: 'task-1', status: 'todo', dueDate: '2026-07-16',
        scheduledTime: '09:00', duration: 30,
      },
    }
    expect(canonicalJson(doneReadBack)).toBe('{"canonicalRevision":8,"canonicalUpdatedAt":"2026-07-15T12:00:00+00:00","completedAt":null,"completedOccurrence":{"completedAt":"2026-07-15T12:00:00+00:00","dueDate":"2026-07-12","id":"history-1","status":"done"},"deletedAt":null,"dueDate":"2026-07-16T00:00:00+00:00","id":"task-1","isCompletionRecord":false,"isDeleted":false,"nextOccurrence":{"dueDate":"2026-07-16","duration":30,"id":"instance-2","scheduledTime":"09:00","status":"todo","taskId":"task-1"},"recurrenceCount":2,"recurrenceParentId":null,"recurrenceRule":{"interval":1,"pattern":"weekly"},"status":"todo","title":"שלום","workspaceId":null}')
    expect(canonicalHash(doneReadBack)).toBe('be51fdc7e9e104bc072ba39a371aead8366264c7e67449e3cab04f865a553682')

    const mergeReadBack = {
      ...sqlTaskReadBack,
      survivorTaskId: 'task-1', duplicateTaskId: 'task-2', duplicateArchived: true,
    }
    expect(canonicalJson(mergeReadBack)).toBe('{"canonicalRevision":8,"canonicalUpdatedAt":"2026-07-15T12:00:00+00:00","completedAt":null,"deletedAt":null,"dueDate":"2026-07-16T00:00:00+00:00","duplicateArchived":true,"duplicateTaskId":"task-2","id":"task-1","isCompletionRecord":false,"isDeleted":false,"recurrenceCount":2,"recurrenceParentId":null,"recurrenceRule":{"interval":1,"pattern":"weekly"},"status":"todo","survivorTaskId":"task-1","title":"שלום","workspaceId":null}')
    expect(canonicalHash(mergeReadBack)).toBe('f8784c4d040a8d009d8b1fc5773911335409e4d992608f050001f8c3356080fe')
  })

  it.each([
    [{ value: 1.5 }, 'unsafe_json'],
    [{ value: Number.MAX_SAFE_INTEGER + 1 }, 'unsafe_json'],
    [{ '\u05de\u05e4\u05ea\u05d7': 'value' }, 'unsafe_json'],
    [{ value: '\ud800' }, 'unsafe_json'],
  ])('rejects values outside the cross-language canonical subset', (value, code) => {
    const { validateCanonicalReceipt } = canonical()
    const forged = receipt({ readBack: value, readBackHash: 'f'.repeat(64) })

    expect(validateCanonicalReceipt(forged)).toEqual({ ok: false, code })
  })

  it.each(['committed', 'replayed'])('accepts a complete %s receipt without requiring the replayed alias', (status) => {
    const { validateCanonicalReceipt } = canonical()
    const value = receipt({ status, replayed: undefined, domainEvidence: { retained: true } })

    expect(validateCanonicalReceipt(value, {
      expectedOperationId: 'operation-1',
      expectedRequestHash: 'a'.repeat(64),
      expectedFields: {
        contractVersion: 'task-v1',
        source: 'local-api',
        entityType: 'task',
        action: 'patch',
        entityId: 'task-1',
      },
      validateReadBack: readBack => readBack.id === 'task-1',
    })).toEqual({ ok: true })
  })

  it.each([
    ['committed', true],
    ['replayed', false],
    ['committed', 'false'],
  ])('rejects contradictory replay alias for %s', (status, replayed) => {
    const { validateCanonicalReceipt } = canonical()

    expect(validateCanonicalReceipt(receipt({ status, replayed }))).toEqual({
      ok: false,
      code: 'replay_mismatch',
    })
  })

  it.each([
    [{ ok: false }, 'not_committed'],
    [{ status: 'queued' }, 'not_committed'],
    [{ status: 'replayed', replayed: false }, 'replay_mismatch'],
    [{ operationId: 'another-operation' }, 'operation_mismatch'],
    [{ requestHash: 'b'.repeat(64) }, 'request_mismatch'],
    [{ canonicalRevision: 0 }, 'invalid_revision'],
    [{ canonicalRevision: true }, 'invalid_revision'],
    [{ changeSequence: 0 }, 'invalid_sequence'],
    [{ changeSequence: 1.5 }, 'invalid_sequence'],
    [{ committedAt: '2026-07-15T12:00:01' }, 'invalid_timestamp'],
    [{ readBack: null }, 'invalid_read_back'],
    [{ readBackHash: 'f'.repeat(64) }, 'read_back_hash_mismatch'],
    [{ entityId: 'another-task' }, 'identity_mismatch'],
  ])('rejects malformed or mismatched canonical proof %#', (overrides, code) => {
    const { validateCanonicalReceipt } = canonical()

    expect(validateCanonicalReceipt(receipt(overrides), {
      expectedOperationId: 'operation-1',
      expectedRequestHash: 'a'.repeat(64),
      expectedFields: { entityId: 'task-1' },
    })).toEqual({ ok: false, code })
  })

  it('rejects HTTP-only success without a canonical receipt', () => {
    const { validateCanonicalReceipt } = canonical()

    expect(validateCanonicalReceipt({ ok: true })).toEqual({ ok: false, code: 'not_committed' })
  })

  it('validates affected task read-backs whenever the receipt supplies them', () => {
    const { canonicalHash, validateCanonicalReceipt } = canonical()
    const value = receipt()
    const readBack = value.readBack as Record<string, unknown>
    const affected = [{
      entityId: 'task-1', entityType: 'task', action: 'update',
      canonicalRevision: 8, changeSequence: 42,
      readBack, readBackHash: canonicalHash(readBack),
    }]

    expect(validateCanonicalReceipt({ ...value, affected })).toEqual({ ok: true })
    expect(validateCanonicalReceipt({
      ...value,
      affected: [{ ...affected[0], readBackHash: 'f'.repeat(64) }],
    })).toEqual({ ok: false, code: 'invalid_affected_entry' })
  })

  it('binds every primary affected field while allowing enriched top-level evidence', () => {
    const { canonicalHash, validateCanonicalReceipt } = canonical()
    const value = receipt()
    const primaryReadBack = value.readBack as Record<string, unknown>
    const affected = [{
      entityId: 'task-1', entityType: 'task', action: 'update',
      canonicalRevision: 8, changeSequence: 42,
      readBack: primaryReadBack, readBackHash: canonicalHash(primaryReadBack),
    }]
    const enrichedReadBack = { ...primaryReadBack, operationEvidence: { retained: true } }

    expect(validateCanonicalReceipt({
      ...value,
      affected,
      readBack: enrichedReadBack,
      readBackHash: canonicalHash(enrichedReadBack),
    }, { bindPrimaryAffectedReadBack: true })).toEqual({ ok: true })

    const forgedReadBack = { ...enrichedReadBack, title: 'Forged title' }
    expect(validateCanonicalReceipt({
      ...value,
      affected,
      readBack: forgedReadBack,
      readBackHash: canonicalHash(forgedReadBack),
    }, { bindPrimaryAffectedReadBack: true })).toEqual({
      ok: false,
      code: 'invalid_affected_entry',
    })
  })

  it('rejects a read-back that fails the operation-specific invariant', () => {
    const { validateCanonicalReceipt } = canonical()

    expect(validateCanonicalReceipt(receipt(), {
      validateReadBack: readBack => readBack.id === 'another-task',
    })).toEqual({ ok: false, code: 'invalid_read_back' })
  })
})
