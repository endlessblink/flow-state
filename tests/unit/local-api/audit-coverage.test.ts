import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const modulePath = resolve(process.cwd(), 'server/local-api/audit-coverage.cjs')
const receiptModulePath = resolve(process.cwd(), 'server/local-api/canonical-receipt.cjs')

const {
  EVIDENCE_CLASSES,
  EXACT_EVIDENCE_CLASSES,
  COMPLETENESS_CLASSES,
  createAuditCoverage,
  recordReviewedItem,
  recordUnreviewedItem,
  recordUnresolvedRow,
  finalizeAuditCoverageReceipt,
  validAuditCoverageReceipt,
} = require(modulePath)
const { canonicalHash } = require(receiptModulePath)

const META = {
  auditScope: 'open tasks in personal scope',
  sourceSurface: 'local-api /api/tasks/inventory',
  snapshotAt: '2026-07-15T10:00:00.000Z',
}
const FINALIZED = { finalizedAt: '2026-07-15T10:05:00.000Z' }

function fullCoverage() {
  const coverage = createAuditCoverage({
    ...META,
    expectedItemIds: ['task-b', 'task-a', 'task-c'],
    expectedItemCount: 3,
  })
  for (const itemId of ['task-a', 'task-b', 'task-c']) {
    recordReviewedItem(coverage, {
      itemId,
      evidenceClass: 'exact-record-read',
      provenance: 'server-read',
    })
  }
  return coverage
}

describe('audit coverage receipt', () => {
  it('exposes the completeness and evidence-class vocabularies', () => {
    expect(COMPLETENESS_CLASSES).toEqual([
      'full',
      'declared_full',
      'partial',
      'representative_sample',
      'unknown',
    ])
    expect(EXACT_EVIDENCE_CLASSES).toContain('exact-record-read')
    expect(EXACT_EVIDENCE_CLASSES).toContain('canonical-receipt')
    expect(EXACT_EVIDENCE_CLASSES).toContain('screenshot-row-reconciled')
    expect(EXACT_EVIDENCE_CLASSES).not.toContain('title-only-match')
    expect(EVIDENCE_CLASSES).toContain('title-only-match')
    expect(EVIDENCE_CLASSES).toContain('capability-class')
  })

  it('produces a full-coverage receipt only when every expected ID has exact evidence', () => {
    const receipt = finalizeAuditCoverageReceipt(fullCoverage(), FINALIZED)

    expect(receipt.contractVersion).toBe('audit-coverage-v2')
    expect(receipt.auditScope).toBe(META.auditScope)
    expect(receipt.sourceSurface).toBe(META.sourceSurface)
    expect(receipt.snapshotAt).toBe(META.snapshotAt)
    expect(receipt.expectedItemCount).toBe(3)
    expect(receipt.expectedItemIds).toEqual(['task-a', 'task-b', 'task-c'])
    expect(receipt.reviewedItemIds).toEqual(['task-a', 'task-b', 'task-c'])
    expect(receipt.unreviewedItemIds).toEqual([])
    expect(receipt.unresolvedRows).toEqual([])
    expect(receipt.completeness).toBe('full')
    expect(receipt.complete).toBe(true)
    expect(receipt.finalizedAt).toBe(FINALIZED.finalizedAt)
    expect(validAuditCoverageReceipt(receipt)).toBe(true)
  })

  it('records per-item evidence classes in the receipt', () => {
    const coverage = createAuditCoverage({
      ...META,
      expectedItemIds: ['task-a', 'task-b'],
    })
    recordReviewedItem(coverage, { itemId: 'task-a', evidenceClass: 'exact-record-read' })
    recordReviewedItem(coverage, { itemId: 'task-b', evidenceClass: 'canonical-receipt' })
    const receipt = finalizeAuditCoverageReceipt(coverage, FINALIZED)

    expect(receipt.reviewedItems).toEqual([
      { itemId: 'task-a', evidenceClass: 'exact-record-read', provenance: 'declared' },
      { itemId: 'task-b', evidenceClass: 'canonical-receipt', provenance: 'declared' },
    ])
    expect(receipt.declaredReviewedItemIds).toEqual(['task-a', 'task-b'])
    expect(receipt.evidenceBasis).toBe('declared')
  })

  it('declared exact evidence completes only as declared_full, never full', () => {
    const coverage = createAuditCoverage({
      ...META,
      expectedItemIds: ['task-a', 'task-b'],
    })
    recordReviewedItem(coverage, { itemId: 'task-a', evidenceClass: 'exact-record-read' })
    recordReviewedItem(coverage, { itemId: 'task-b', evidenceClass: 'canonical-receipt' })
    const receipt = finalizeAuditCoverageReceipt(coverage, FINALIZED)

    expect(receipt.completeness).toBe('declared_full')
    expect(receipt.complete).toBe(false)
    expect(receipt.reviewedItemIds).toEqual([])
    expect(validAuditCoverageReceipt(receipt)).toBe(true)
    expect(validAuditCoverageReceipt({ ...receipt, completeness: 'full', complete: true }))
      .toBe(false)
  })

  it('produces a partial receipt with exact unreviewed IDs when review stops early', () => {
    const coverage = createAuditCoverage({
      ...META,
      expectedItemIds: ['task-a', 'task-b', 'task-c'],
    })
    recordReviewedItem(coverage, {
      itemId: 'task-a',
      evidenceClass: 'exact-record-read',
      provenance: 'server-read',
    })
    const receipt = finalizeAuditCoverageReceipt(coverage, FINALIZED)

    expect(receipt.completeness).toBe('partial')
    expect(receipt.complete).toBe(false)
    expect(receipt.reviewedItemIds).toEqual(['task-a'])
    expect(receipt.unreviewedItemIds).toEqual(['task-b', 'task-c'])
    expect(validAuditCoverageReceipt(receipt)).toBe(true)
  })

  it('labels a declared representative sample instead of upgrading it', () => {
    const coverage = createAuditCoverage({
      ...META,
      representativeSample: true,
    })
    recordReviewedItem(coverage, { itemId: 'task-a', evidenceClass: 'exact-record-read' })
    const receipt = finalizeAuditCoverageReceipt(coverage, FINALIZED)

    expect(receipt.representativeSample).toBe(true)
    expect(receipt.completeness).toBe('representative_sample')
    expect(receipt.complete).toBe(false)
    expect(validAuditCoverageReceipt(receipt)).toBe(true)
  })

  it('reports unknown completeness when the expected universe is unknown', () => {
    const coverage = createAuditCoverage({ ...META })
    recordReviewedItem(coverage, { itemId: 'task-a', evidenceClass: 'exact-record-read' })
    const receipt = finalizeAuditCoverageReceipt(coverage, FINALIZED)

    expect(receipt.expectedItemIds).toBe(null)
    expect(receipt.completeness).toBe('unknown')
    expect(receipt.complete).toBe(false)
  })

  it('never treats an expected count without expected IDs as provable full coverage', () => {
    const coverage = createAuditCoverage({ ...META, expectedItemCount: 2 })
    recordReviewedItem(coverage, { itemId: 'task-a', evidenceClass: 'exact-record-read' })
    recordReviewedItem(coverage, { itemId: 'task-b', evidenceClass: 'exact-record-read' })
    const receipt = finalizeAuditCoverageReceipt(coverage, FINALIZED)

    expect(receipt.expectedItemCount).toBe(2)
    expect(receipt.completeness).toBe('unknown')
    expect(receipt.complete).toBe(false)
  })

  it('keeps title-only evidence out of exact reviewed coverage', () => {
    const coverage = createAuditCoverage({
      ...META,
      expectedItemIds: ['task-a', 'task-b'],
    })
    recordReviewedItem(coverage, {
      itemId: 'task-a',
      evidenceClass: 'exact-record-read',
      provenance: 'server-read',
    })
    recordReviewedItem(coverage, { itemId: 'task-b', evidenceClass: 'title-only-match' })
    const receipt = finalizeAuditCoverageReceipt(coverage, FINALIZED)

    expect(receipt.reviewedItemIds).toEqual(['task-a'])
    expect(receipt.weakCandidateItemIds).toEqual(['task-b'])
    expect(receipt.unreviewedItemIds).toEqual(['task-b'])
    expect(receipt.completeness).toBe('partial')
    expect(validAuditCoverageReceipt(receipt)).toBe(true)
  })

  it('keeps unresolved screenshot rows out of coverage and out of full completeness', () => {
    const coverage = fullCoverage()
    recordUnresolvedRow(coverage, {
      visibleText: 'לשלוח כביסה',
      reason: 'title-ambiguous',
    })
    const receipt = finalizeAuditCoverageReceipt(coverage, FINALIZED)

    expect(receipt.unresolvedRows).toEqual([
      { visibleText: 'לשלוח כביסה', reason: 'title-ambiguous' },
    ])
    expect(receipt.unresolvedRowCount).toBe(1)
    expect(receipt.reviewedItemIds).toEqual(['task-a', 'task-b', 'task-c'])
    expect(receipt.completeness).toBe('partial')
    expect(receipt.complete).toBe(false)
    expect(validAuditCoverageReceipt(receipt)).toBe(true)
  })

  it('supports explicit unreviewed item recording', () => {
    const coverage = createAuditCoverage({ ...META })
    recordUnreviewedItem(coverage, 'task-z')
    const receipt = finalizeAuditCoverageReceipt(coverage, FINALIZED)

    expect(receipt.unreviewedItemIds).toEqual(['task-z'])
    expect(receipt.completeness).toBe('unknown')
  })

  it('counts capability-class evidence as coverage only in capability mode', () => {
    const capability = createAuditCoverage({
      ...META,
      auditMode: 'capability',
      expectedItemIds: ['cap-read', 'cap-write'],
    })
    recordReviewedItem(capability, { itemId: 'cap-read', evidenceClass: 'capability-class' })
    recordReviewedItem(capability, { itemId: 'cap-write', evidenceClass: 'capability-class' })
    const capabilityReceipt = finalizeAuditCoverageReceipt(capability, FINALIZED)
    expect(capabilityReceipt.auditMode).toBe('capability')
    // Capability observations are never server-verifiable records, so even a
    // complete capability audit stays declared coverage.
    expect(capabilityReceipt.completeness).toBe('declared_full')

    const item = createAuditCoverage({ ...META, expectedItemIds: ['task-a'] })
    recordReviewedItem(item, { itemId: 'task-a', evidenceClass: 'capability-class' })
    const itemReceipt = finalizeAuditCoverageReceipt(item, FINALIZED)
    expect(itemReceipt.auditMode).toBe('item')
    expect(itemReceipt.reviewedItemIds).toEqual([])
    expect(itemReceipt.completeness).toBe('partial')
  })

  it('rejects invalid construction and recording input', () => {
    expect(() => createAuditCoverage({ ...META, auditScope: '' })).toThrow(TypeError)
    expect(() => createAuditCoverage({ ...META, sourceSurface: '' })).toThrow(TypeError)
    expect(() => createAuditCoverage({ ...META, snapshotAt: 'not-a-date' })).toThrow(TypeError)
    expect(() => createAuditCoverage({ ...META, auditMode: 'vibes' })).toThrow(TypeError)
    expect(() =>
      createAuditCoverage({ ...META, expectedItemIds: ['a'], expectedItemCount: 5 }),
    ).toThrow(TypeError)
    expect(() =>
      createAuditCoverage({ ...META, expectedItemIds: ['a', 'a'] }),
    ).toThrow(TypeError)

    const coverage = createAuditCoverage({ ...META })
    expect(() =>
      recordReviewedItem(coverage, { itemId: '', evidenceClass: 'exact-record-read' }),
    ).toThrow(TypeError)
    expect(() =>
      recordReviewedItem(coverage, { itemId: 'task-a', evidenceClass: 'gut-feeling' }),
    ).toThrow(TypeError)
    expect(() => recordUnresolvedRow(coverage, { visibleText: '', reason: 'x' })).toThrow(TypeError)
  })

  it('is deterministic: identical audits produce identical digests', () => {
    const first = finalizeAuditCoverageReceipt(fullCoverage(), FINALIZED)
    const second = finalizeAuditCoverageReceipt(fullCoverage(), FINALIZED)
    expect(first.receiptDigest).toMatch(/^[0-9a-f]{64}$/)
    expect(first.receiptDigest).toBe(second.receiptDigest)
    const { receiptDigest, ...body } = first
    expect(receiptDigest).toBe(canonicalHash(body))
  })

  it('is machine-checkable: tampering invalidates the receipt', () => {
    const receipt = finalizeAuditCoverageReceipt(fullCoverage(), FINALIZED)
    expect(validAuditCoverageReceipt(receipt)).toBe(true)

    expect(validAuditCoverageReceipt({ ...receipt, complete: false })).toBe(false)
    expect(validAuditCoverageReceipt({ ...receipt, completeness: 'partial' })).toBe(false)
    expect(
      validAuditCoverageReceipt({
        ...receipt,
        reviewedItemIds: [...receipt.reviewedItemIds, 'task-d'],
      }),
    ).toBe(false)
    expect(
      validAuditCoverageReceipt({ ...receipt, receiptDigest: 'a'.repeat(64) }),
    ).toBe(false)
    expect(validAuditCoverageReceipt({ ok: true })).toBe(false)
  })

  it('rejects a hand-built receipt that claims full coverage over unreviewed IDs', () => {
    const honest = finalizeAuditCoverageReceipt(fullCoverage(), FINALIZED)
    const { receiptDigest, ...body } = honest
    const forged = {
      ...body,
      expectedItemIds: ['task-a', 'task-b', 'task-c', 'task-d'],
      expectedItemCount: 4,
    }
    forged.receiptDigest = canonicalHash(forged)
    expect(validAuditCoverageReceipt(forged)).toBe(false)
  })
})
