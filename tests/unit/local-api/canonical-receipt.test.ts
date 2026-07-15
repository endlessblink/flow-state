import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const modulePath = resolve(process.cwd(), 'server/local-api/canonical-receipt.cjs')

type ReceiptContract = {
  canonicalJson(value: unknown): string
  canonicalHash(value: unknown): string
  postgresJsonbText(value: unknown): string
  postgresJsonbHash(value: unknown): string
  validCanonicalReceipt(
    value: unknown,
    expected: Record<string, unknown>,
    validReadBack?: (readBack: Record<string, unknown>) => boolean,
  ): boolean
}

const {
  canonicalJson,
  canonicalHash,
  postgresJsonbText,
  postgresJsonbHash,
  validCanonicalReceipt,
} = require(modulePath) as ReceiptContract

const readBack = {
  id: 'task-1',
  canonicalRevision: 3,
  canonicalUpdatedAt: '2026-07-15T07:00:00.000Z',
  title: 'Canonical task',
}

function receipt(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: 'task-v1',
    operationId: 'operation-1',
    source: 'local-api',
    entityType: 'task',
    action: 'patch',
    entityId: 'task-1',
    canonicalRevision: 3,
    canonicalUpdatedAt: '2026-07-15T07:00:00.000Z',
    changeSequence: 9,
    committedAt: '2026-07-15T07:00:00.010Z',
    replayed: false,
    readBack,
    readBackHash: canonicalHash(readBack),
    ...overrides,
  }
}

const expected = {
  contractVersion: 'task-v1',
  operationId: 'operation-1',
  source: 'local-api',
  entityType: 'task',
  action: 'patch',
  entityId: 'task-1',
}

describe('canonical receipt validator', () => {
  it('uses sorted dependency-free canonical JSON and SHA-256', () => {
    const value = { z: [3, { b: true, a: null }], a: 'text' }
    const serialized = '{"a":"text","z":[3,{"a":null,"b":true}]}'

    expect(canonicalJson(value)).toBe(serialized)
    expect(canonicalHash(value)).toBe(
      createHash('sha256').update(serialized).digest('hex'),
    )
  })

  it.each([1.5, 1e-7, -0])('rejects non-integer JSON numbers (%s)', (value) => {
    expect(() => canonicalJson({ value })).toThrow(TypeError)
  })

  it.each([
    [{ 'מפתח': 'value' }],
    [{ value: '\uD800' }],
  ])('rejects values outside the cross-language receipt subset', (value) => {
    expect(() => canonicalJson(value)).toThrow(TypeError)
  })

  it('reproduces the existing task RPC JSONB text hash during migration', () => {
    const value = { canonicalRevision: 3, title: 'Task', id: 'task-1' }
    const serialized = '{"id": "task-1", "title": "Task", "canonicalRevision": 3}'

    expect(postgresJsonbText(value)).toBe(serialized)
    expect(postgresJsonbHash(value)).toBe(
      createHash('sha256').update(serialized).digest('hex'),
    )
  })

  it('accepts a complete identity-bound committed receipt', () => {
    expect(validCanonicalReceipt(receipt(), expected)).toBe(true)
  })

  it.each([
    ['operationId', 'other-operation'],
    ['source', 'web-pwa'],
    ['entityType', 'project'],
    ['action', 'delete'],
    ['entityId', 'task-2'],
    ['canonicalRevision', null],
    ['changeSequence', null],
    ['replayed', 'false'],
    ['readBack', null],
  ])('rejects mismatched or incomplete %s', (field, value) => {
    expect(validCanonicalReceipt(receipt({ [field]: value }), expected)).toBe(false)
  })

  it('rejects a well-shaped hash that does not match the read-back', () => {
    expect(validCanonicalReceipt(
      receipt({ readBackHash: 'a'.repeat(64) }),
      expected,
    )).toBe(false)
  })

  it('rejects revision and update-time disagreement with the read-back', () => {
    for (const changedReadBack of [
      { ...readBack, canonicalRevision: 4 },
      { ...readBack, canonicalUpdatedAt: '2026-07-15T07:00:01.000Z' },
    ]) {
      expect(validCanonicalReceipt(
        receipt({
          readBack: changedReadBack,
          readBackHash: canonicalHash(changedReadBack),
        }),
        expected,
      )).toBe(false)
    }
  })

  it('allows a consumer to reject an incomplete domain read-back', () => {
    expect(validCanonicalReceipt(
      receipt(),
      expected,
      (value) => typeof value.title === 'string' && value.status === 'todo',
    )).toBe(false)
  })

  it('does not mistake an HTTP-only ok response for a receipt', () => {
    expect(validCanonicalReceipt({ ok: true }, expected)).toBe(false)
  })
})
