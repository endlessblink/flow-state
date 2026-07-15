import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const reconciliationPath = resolve(process.cwd(), 'server/local-api/screenshot-reconciliation.cjs')
const coveragePath = resolve(process.cwd(), 'server/local-api/audit-coverage.cjs')
const guardrailPath = resolve(process.cwd(), 'server/local-api/claim-guardrail.cjs')

const {
  normalizeVisibleText,
  reconcileScreenshotRows,
  applyScreenshotReconciliation,
} = require(reconciliationPath)
const {
  createAuditCoverage,
  finalizeAuditCoverageReceipt,
} = require(coveragePath)
const { guardSummaryWording } = require(guardrailPath)

const TASKS = [
  { id: 'task-laundry', title: 'לשלוח כביסה' },
  { id: 'task-dentist', title: 'לקבוע תור לרופא שיניים' },
  { id: 'task-q3-a', title: 'Draft Q3 plan' },
  { id: 'task-q3-b', title: 'Draft Q3 plan' },
]

describe('visible text normalization', () => {
  it('collapses multiline Hebrew rows and strips directionality marks', () => {
    expect(normalizeVisibleText('לקבוע תור\n  לרופא שיניים ')).toBe('לקבוע תור לרופא שיניים')
    expect(normalizeVisibleText('‏לשלוח כביסה‎')).toBe('לשלוח כביסה')
  })
})

describe('screenshot row reconciliation', () => {
  it('proves a row only when the claimed task ID exists and the title agrees', () => {
    const result = reconcileScreenshotRows({
      rows: [{ visibleText: 'לשלוח כביסה', claimedTaskId: 'task-laundry', reviewed: true }],
      tasks: TASKS,
    })
    const [row] = result.rows
    expect(row.matchedTaskId).toBe('task-laundry')
    expect(row.matchBasis).toBe('exact-id')
    expect(row.matchConfidence).toBe('proven')
    expect(row.unresolved).toBe(false)
    expect(result.exactReviewedTaskIds).toEqual(['task-laundry'])
  })

  it('reconciles multiline Hebrew rows against single-line titles', () => {
    const result = reconcileScreenshotRows({
      rows: [
        {
          visibleText: 'לקבוע תור\nלרופא שיניים',
          claimedTaskId: 'task-dentist',
          reviewed: true,
        },
      ],
      tasks: TASKS,
    })
    expect(result.rows[0].matchConfidence).toBe('proven')
    expect(result.exactReviewedTaskIds).toEqual(['task-dentist'])
  })

  it('leaves a row with no match unresolved', () => {
    const result = reconcileScreenshotRows({
      rows: [{ visibleText: 'Some unknown row', reviewed: true }],
      tasks: TASKS,
    })
    const [row] = result.rows
    expect(row.matchedTaskId).toBe(null)
    expect(row.matchBasis).toBe('unmatched')
    expect(row.matchConfidence).toBe('unresolved')
    expect(row.unresolved).toBe(true)
    expect(result.exactReviewedTaskIds).toEqual([])
  })

  it('labels a unique title-only match as weak and unproven, never as exact', () => {
    const result = reconcileScreenshotRows({
      rows: [{ visibleText: 'לשלוח כביסה', reviewed: true }],
      tasks: TASKS,
    })
    const [row] = result.rows
    expect(row.matchBasis).toBe('title-unique')
    expect(row.matchConfidence).toBe('weak')
    expect(row.matchedTaskId).toBe(null)
    expect(row.candidateTaskIds).toEqual(['task-laundry'])
    expect(row.unresolved).toBe(true)
    expect(result.exactReviewedTaskIds).toEqual([])
  })

  it('labels an ambiguous title as ambiguous with all candidates preserved', () => {
    const result = reconcileScreenshotRows({
      rows: [{ visibleText: 'Draft Q3 plan', reviewed: true }],
      tasks: TASKS,
    })
    const [row] = result.rows
    expect(row.matchBasis).toBe('title-ambiguous')
    expect(row.matchConfidence).toBe('ambiguous')
    expect(row.candidateTaskIds).toEqual(['task-q3-a', 'task-q3-b'])
    expect(row.unresolved).toBe(true)
    expect(result.ambiguousCandidateTaskIds).toEqual(['task-q3-a', 'task-q3-b'])
  })

  it('exposes weak title-only candidate IDs durably', () => {
    const result = reconcileScreenshotRows({
      rows: [{ visibleText: 'לשלוח כביסה', reviewed: true }],
      tasks: TASKS,
    })
    expect(result.weakCandidateTaskIds).toEqual(['task-laundry'])
    expect(result.weakRowCount).toBe(1)
  })

  it('treats a claimed ID whose title disagrees as a conflict, not a review', () => {
    const result = reconcileScreenshotRows({
      rows: [
        { visibleText: 'Draft Q3 plan', claimedTaskId: 'task-laundry', reviewed: true },
      ],
      tasks: TASKS,
    })
    const [row] = result.rows
    expect(row.matchBasis).toBe('id-title-conflict')
    expect(row.matchedTaskId).toBe(null)
    expect(row.unresolved).toBe(true)
    expect(result.exactReviewedTaskIds).toEqual([])
  })

  it('reports review level: exact-task-level, screenshot-level, and mixed', () => {
    const proven = { visibleText: 'לשלוח כביסה', claimedTaskId: 'task-laundry', reviewed: true }
    const weak = { visibleText: 'Draft Q3 plan', reviewed: true }

    expect(reconcileScreenshotRows({ rows: [proven], tasks: TASKS }).reviewLevel)
      .toBe('exact-task-level')
    expect(reconcileScreenshotRows({ rows: [weak], tasks: TASKS }).reviewLevel)
      .toBe('screenshot-level')
    expect(reconcileScreenshotRows({ rows: [proven, weak], tasks: TASKS }).reviewLevel)
      .toBe('mixed')
  })
})

describe('reconciliation feeding audit coverage', () => {
  const META = {
    auditScope: 'tasks visible in the shared screenshot',
    sourceSurface: 'screenshot + local-api /api/tasks/search',
    snapshotAt: '2026-07-15T10:00:00.000Z',
  }
  const FINALIZED = { finalizedAt: '2026-07-15T10:05:00.000Z' }

  it('unresolved visible rows prevent "reviewed all visible tasks" wording', () => {
    const coverage = createAuditCoverage({
      ...META,
      expectedItemIds: ['task-laundry', 'task-dentist'],
    })
    const reconciliation = reconcileScreenshotRows({
      rows: [
        { visibleText: 'לשלוח כביסה', claimedTaskId: 'task-laundry', reviewed: true },
        { visibleText: 'Draft Q3 plan', reviewed: true },
      ],
      tasks: TASKS,
      tasksProvenance: 'server-read',
    })
    applyScreenshotReconciliation(coverage, reconciliation)
    const receipt = finalizeAuditCoverageReceipt(coverage, FINALIZED)

    expect(receipt.reviewedItemIds).toEqual(['task-laundry'])
    expect(receipt.ambiguousCandidates).toEqual([
      { visibleText: 'Draft Q3 plan', candidateTaskIds: ['task-q3-a', 'task-q3-b'] },
    ])
    expect(receipt.completeness).toBe('partial')

    const guard = guardSummaryWording('Reviewed all visible tasks in the screenshot.', {
      receipt,
    })
    expect(guard.ok).toBe(false)
  })

  it('produces a mixed exact/unresolved receipt with unresolved rows reported separately', () => {
    const coverage = createAuditCoverage({ ...META })
    const reconciliation = reconcileScreenshotRows({
      rows: [
        { visibleText: 'לשלוח כביסה', claimedTaskId: 'task-laundry', reviewed: true },
        { visibleText: 'לקבוע תור\nלרופא שיניים', claimedTaskId: 'task-dentist', reviewed: true },
        { visibleText: 'Draft Q3 plan', reviewed: true },
        { visibleText: 'Totally unknown row', reviewed: false },
      ],
      tasks: TASKS,
      tasksProvenance: 'server-read',
    })
    expect(reconciliation.reviewLevel).toBe('mixed')

    applyScreenshotReconciliation(coverage, reconciliation)
    const receipt = finalizeAuditCoverageReceipt(coverage, FINALIZED)

    expect(receipt.reviewedItemIds).toEqual(['task-dentist', 'task-laundry'])
    expect(
      receipt.reviewedItems.every(item => item.evidenceClass === 'screenshot-row-reconciled'),
    ).toBe(true)
    expect(
      receipt.reviewedItems.every(item => item.provenance === 'server-read'),
    ).toBe(true)
    expect(receipt.ambiguousCandidates).toEqual([
      { visibleText: 'Draft Q3 plan', candidateTaskIds: ['task-q3-a', 'task-q3-b'] },
    ])
    expect(receipt.unresolvedRows).toEqual([
      { visibleText: 'Totally unknown row', reason: 'unmatched' },
    ])
    expect(receipt.completeness).toBe('unknown')
  })

  it('caller-declared task lists never yield server-read reviewed coverage', () => {
    const coverage = createAuditCoverage({ ...META, expectedItemIds: ['task-laundry'] })
    const reconciliation = reconcileScreenshotRows({
      rows: [
        { visibleText: 'לשלוח כביסה', claimedTaskId: 'task-laundry', reviewed: true },
      ],
      tasks: TASKS,
    })
    applyScreenshotReconciliation(coverage, reconciliation)
    const receipt = finalizeAuditCoverageReceipt(coverage, FINALIZED)

    expect(receipt.reviewedItemIds).toEqual([])
    expect(receipt.declaredReviewedItemIds).toEqual(['task-laundry'])
    expect(receipt.completeness).toBe('declared_full')
    expect(receipt.complete).toBe(false)
  })

  it('a proven but unreviewed row becomes an exact unreviewed ID, not a reviewed one', () => {
    const coverage = createAuditCoverage({ ...META })
    const reconciliation = reconcileScreenshotRows({
      rows: [
        { visibleText: 'לשלוח כביסה', claimedTaskId: 'task-laundry', reviewed: false },
      ],
      tasks: TASKS,
    })
    applyScreenshotReconciliation(coverage, reconciliation)
    const receipt = finalizeAuditCoverageReceipt(coverage, FINALIZED)

    expect(receipt.reviewedItemIds).toEqual([])
    expect(receipt.unreviewedItemIds).toEqual(['task-laundry'])
  })
})
