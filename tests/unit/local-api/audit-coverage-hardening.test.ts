import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

/**
 * TASK-1959 hardening regressions (adversarial review findings).
 *
 * 1. The server must not notarize caller self-attestation as verified/full/
 *    live coverage. Verified/full requires server-owned proof (the sidecar
 *    re-reads the claimed records itself); caller-declared evidence classes,
 *    knownTasks, and liveVerified can never produce verified/full/live.
 * 2. Broad completeness claims must be blocked by semantic claim shape tied
 *    to the receipt, not a small wording blacklist.
 * 3. Weak title-only and ambiguous screenshot candidates must be durable in
 *    the receipt, with their candidate IDs, distinct from unresolved rows.
 * 4. Screenshot review level must reflect reviewed evidence, not identity
 *    resolution alone.
 * 5. Blocked over-claim attempts must leave a durable audit trail.
 */

const require = createRequire(import.meta.url)
const reportPath = resolve(process.cwd(), 'server/local-api/audit-coverage-report.cjs')
const coveragePath = resolve(process.cwd(), 'server/local-api/audit-coverage.cjs')
const guardrailPath = resolve(process.cwd(), 'server/local-api/claim-guardrail.cjs')
const reconciliationPath = resolve(process.cwd(), 'server/local-api/screenshot-reconciliation.cjs')

const { executeAuditCoverageReport } = require(reportPath)
const {
  createAuditCoverage,
  recordReviewedItem,
  finalizeAuditCoverageReceipt,
  validAuditCoverageReceipt,
} = require(coveragePath)
const { guardSummaryWording, classifyClaimLevel } = require(guardrailPath)
const { reconcileScreenshotRows } = require(reconciliationPath)

const NOW = '2026-07-15T11:00:00.000Z'

const serverTasks = [
  { id: 'task-a', title: 'Alpha' },
  { id: 'task-b', title: 'Beta' },
]

function serverDeps(overrides: Record<string, unknown> = {}) {
  return {
    now: () => NOW,
    persistReceipt: vi.fn(),
    persistBlockedAttempt: vi.fn(),
    fetchTasksByIds: vi.fn(async (ids: string[]) =>
      serverTasks.filter(task => ids.includes(task.id))),
    fetchTasksByTitles: vi.fn(async (titles: string[]) =>
      serverTasks.filter(task => titles.includes(task.title))),
    ...overrides,
  }
}

/** Caller-only deps: no server-side task verification available. */
function declaredOnlyDeps(overrides: Record<string, unknown> = {}) {
  return {
    now: () => NOW,
    persistReceipt: vi.fn(),
    persistBlockedAttempt: vi.fn(),
    ...overrides,
  }
}

const FABRICATED_BODY = {
  auditScope: 'open tasks in personal scope',
  sourceSurface: 'local-api /api/tasks/inventory',
  snapshotAt: '2026-07-15T10:00:00.000Z',
  expectedItemIds: ['fake-1', 'fake-2'],
  reviewedItems: [
    { itemId: 'fake-1', evidenceClass: 'exact-record-read' },
    { itemId: 'fake-2', evidenceClass: 'canonical-receipt' },
  ],
  liveVerified: true,
}

function partialDeclaredReceipt() {
  const coverage = createAuditCoverage({
    auditScope: 'backlog audit',
    sourceSurface: 'local-api',
    snapshotAt: NOW,
    expectedItemIds: ['task-a', 'task-b', 'task-c'],
  })
  recordReviewedItem(coverage, { itemId: 'task-a', evidenceClass: 'exact-record-read' })
  return finalizeAuditCoverageReceipt(coverage, { finalizedAt: NOW })
}

describe('finding 1: self-attestation cannot become verified/full/live', () => {
  it('fabricated IDs and evidence classes never produce full/verified', async () => {
    const deps = serverDeps()
    const result = await executeAuditCoverageReport(FABRICATED_BODY, deps)

    expect(result.status).toBe(200)
    expect(result.body.receipt.completeness).not.toBe('full')
    expect(result.body.claimLevel).not.toBe('verified')
    expect(result.body.receipt.complete).toBe(false)
    expect(result.body.summary).not.toContain('Live workflow verified')
  })

  it('without server-side verification deps, declared evidence caps below verified', async () => {
    const body = {
      ...FABRICATED_BODY,
      expectedItemIds: ['task-a', 'task-b'],
      reviewedItems: [
        { itemId: 'task-a', evidenceClass: 'exact-record-read' },
        { itemId: 'task-b', evidenceClass: 'canonical-receipt' },
      ],
    }
    const result = await executeAuditCoverageReport(body, declaredOnlyDeps())

    expect(result.status).toBe(200)
    expect(result.body.receipt.completeness).not.toBe('full')
    expect(result.body.claimLevel).not.toBe('verified')
    expect(result.body.receipt.evidenceBasis).toBe('declared')
  })

  it('server-read verification of real records can still reach verified/full', async () => {
    const body = {
      auditScope: 'open tasks in personal scope',
      sourceSurface: 'local-api /api/tasks/inventory',
      snapshotAt: '2026-07-15T10:00:00.000Z',
      expectedItemIds: ['task-a', 'task-b'],
      reviewedItems: [
        { itemId: 'task-a', evidenceClass: 'exact-record-read' },
        { itemId: 'task-b', evidenceClass: 'exact-record-read' },
      ],
    }
    const result = await executeAuditCoverageReport(body, serverDeps())

    expect(result.status).toBe(200)
    expect(result.body.receipt.completeness).toBe('full')
    expect(result.body.claimLevel).toBe('verified')
    expect(result.body.receipt.evidenceBasis).toBe('server-read')
    expect(validAuditCoverageReceipt(result.body.receipt)).toBe(true)
  })

  it('records which reviewed items were only declared, durably', async () => {
    const body = {
      auditScope: 'open tasks in personal scope',
      sourceSurface: 'local-api /api/tasks/inventory',
      snapshotAt: '2026-07-15T10:00:00.000Z',
      expectedItemIds: ['task-a', 'fake-2'],
      reviewedItems: [
        { itemId: 'task-a', evidenceClass: 'exact-record-read' },
        { itemId: 'fake-2', evidenceClass: 'exact-record-read' },
      ],
    }
    const result = await executeAuditCoverageReport(body, serverDeps())

    expect(result.body.receipt.reviewedItemIds).toEqual(['task-a'])
    expect(result.body.receipt.declaredReviewedItemIds).toEqual(['fake-2'])
    expect(result.body.receipt.evidenceBasis).toBe('mixed')
    expect(validAuditCoverageReceipt(result.body.receipt)).toBe(true)
  })

  it('caller knownTasks cannot make screenshot reconciliation server-verified', async () => {
    const body = {
      auditScope: 'tasks visible in the screenshot',
      sourceSurface: 'screenshot',
      snapshotAt: '2026-07-15T10:00:00.000Z',
      expectedItemIds: ['fake-9'],
      screenshotRows: [
        { visibleText: 'Fabricated', claimedTaskId: 'fake-9', reviewed: true },
      ],
      knownTasks: [{ id: 'fake-9', title: 'Fabricated' }],
    }
    const result = await executeAuditCoverageReport(body, serverDeps())

    expect(result.status).toBe(200)
    expect(result.body.receipt.completeness).not.toBe('full')
    expect(result.body.claimLevel).not.toBe('verified')
    expect(result.body.receipt.reviewedItemIds).not.toContain('fake-9')
  })

  it('liveVerified input can never produce "Live workflow verified."', async () => {
    const body = {
      auditScope: 'open tasks in personal scope',
      sourceSurface: 'local-api /api/tasks/inventory',
      snapshotAt: '2026-07-15T10:00:00.000Z',
      expectedItemIds: ['task-a', 'task-b'],
      reviewedItems: [
        { itemId: 'task-a', evidenceClass: 'exact-record-read' },
        { itemId: 'task-b', evidenceClass: 'exact-record-read' },
      ],
      liveVerified: true,
    }
    const result = await executeAuditCoverageReport(body, serverDeps())

    expect(result.status).toBe(200)
    expect(result.body.summary).not.toContain('Live workflow verified')
    expect(result.body.summary.toLowerCase()).toContain('not server-verified')
  })
})

describe('finding 2: broad-claim variants are blocked semantically', () => {
  const variants = [
    'The entire backlog was reviewed.',
    'Checked the whole backlog.',
    'No task was missed.',
    'The audit covered each record.',
    'All records look good.',
    'Nothing was skipped during the audit.',
    'The backlog is fully covered end to end.',
  ]

  for (const text of variants) {
    it(`blocks over partial evidence: "${text}"`, () => {
      const receipt = partialDeclaredReceipt()
      const guard = guardSummaryWording(text, { receipt })
      expect(guard.ok).toBe(false)
    })
  }

  it('non-verified summaries without a coverage disclosure are rejected', () => {
    const receipt = partialDeclaredReceipt()
    const guard = guardSummaryWording('Went over the backlog and things are in order.', { receipt })
    expect(guard.ok).toBe(false)
    expect(guard.violations.some((violation: { code: string }) =>
      violation.code === 'missing-coverage-disclosure')).toBe(true)
  })

  it('honest partial wording with disclosure still passes', () => {
    const receipt = partialDeclaredReceipt()
    const guard = guardSummaryWording(
      'Reviewed 1 of 3 expected items. Exact task coverage was not completed. ' +
      'Unreviewed item IDs: task-b, task-c.',
      { receipt },
    )
    expect(guard.ok).toBe(true)
  })
})

describe('finding 3: weak and ambiguous screenshot candidates are durable', () => {
  it('receipt durably separates weak, ambiguous, and unresolved rows', async () => {
    const body = {
      auditScope: 'tasks visible in the screenshot',
      sourceSurface: 'screenshot',
      snapshotAt: '2026-07-15T10:00:00.000Z',
      screenshotRows: [
        { visibleText: 'Alpha', reviewed: true },      // title-unique -> weak candidate
        { visibleText: 'Twin', reviewed: true },       // title-ambiguous -> ambiguous
        { visibleText: 'Ghost row', reviewed: true },  // unmatched -> unresolved
      ],
    }
    const deps = serverDeps({
      fetchTasksByTitles: vi.fn(async () => [
        { id: 'task-a', title: 'Alpha' },
        { id: 'twin-1', title: 'Twin' },
        { id: 'twin-2', title: 'Twin' },
      ]),
    })
    const result = await executeAuditCoverageReport(body, deps)
    const receipt = result.body.receipt

    expect(receipt.weakCandidateItemIds).toEqual(['task-a'])
    expect(receipt.ambiguousCandidates).toEqual([
      { visibleText: 'Twin', candidateTaskIds: ['twin-1', 'twin-2'] },
    ])
    expect(receipt.ambiguousCandidateItemIds).toEqual(['twin-1', 'twin-2'])
    expect(receipt.unresolvedRows).toEqual([
      { visibleText: 'Ghost row', reason: 'unmatched' },
    ])
    expect(validAuditCoverageReceipt(receipt)).toBe(true)
  })

  it('tampering with durable candidate fields breaks receipt validation', async () => {
    const body = {
      auditScope: 'tasks visible in the screenshot',
      sourceSurface: 'screenshot',
      snapshotAt: '2026-07-15T10:00:00.000Z',
      screenshotRows: [{ visibleText: 'Alpha', reviewed: true }],
    }
    const result = await executeAuditCoverageReport(body, serverDeps())
    const receipt = result.body.receipt

    expect(validAuditCoverageReceipt(receipt)).toBe(true)
    expect(validAuditCoverageReceipt({ ...receipt, weakCandidateItemIds: [] })).toBe(false)
  })
})

describe('finding 4: review level reflects reviewed evidence, not identity', () => {
  it('a proven identity row with reviewed:false is not exact-task-level', () => {
    const reconciliation = reconcileScreenshotRows({
      rows: [{ visibleText: 'Alpha', claimedTaskId: 'task-a', reviewed: false }],
      tasks: serverTasks,
    })
    expect(reconciliation.reviewLevel).not.toBe('exact-task-level')
    expect(reconciliation.reviewLevel).toBe('identity-only')
    expect(reconciliation.exactReviewedTaskIds).toEqual([])
  })

  it('mixed reviewed and unreviewed proven rows are not exact-task-level', () => {
    const reconciliation = reconcileScreenshotRows({
      rows: [
        { visibleText: 'Alpha', claimedTaskId: 'task-a', reviewed: true },
        { visibleText: 'Beta', claimedTaskId: 'task-b', reviewed: false },
      ],
      tasks: serverTasks,
    })
    expect(reconciliation.reviewLevel).toBe('mixed')
  })

  it('all proven and reviewed rows remain exact-task-level', () => {
    const reconciliation = reconcileScreenshotRows({
      rows: [
        { visibleText: 'Alpha', claimedTaskId: 'task-a', reviewed: true },
        { visibleText: 'Beta', claimedTaskId: 'task-b', reviewed: true },
      ],
      tasks: serverTasks,
    })
    expect(reconciliation.reviewLevel).toBe('exact-task-level')
  })
})

describe('finding 5: blocked over-claim attempts are durable', () => {
  it('persists a durable blocked-attempt record on the 422 path', async () => {
    const deps = serverDeps()
    const result = await executeAuditCoverageReport(
      {
        auditScope: 'backlog audit',
        sourceSurface: 'local-api',
        snapshotAt: '2026-07-15T10:00:00.000Z',
        expectedItemIds: ['task-a', 'task-b'],
        reviewedItems: [{ itemId: 'task-a', evidenceClass: 'exact-record-read' }],
        summaryDraft: 'Reviewed everything; all tasks verified.',
      },
      deps,
    )

    expect(result.status).toBe(422)
    expect(result.body.error).toBe('broad_claim_blocked')
    expect(deps.persistBlockedAttempt).toHaveBeenCalledTimes(1)
    const recorded = deps.persistBlockedAttempt.mock.calls[0][0]
    expect(recorded.receipt.receiptDigest).toBe(result.body.receipt.receiptDigest)
    expect(Array.isArray(recorded.violations)).toBe(true)
    expect(recorded.violations.length).toBeGreaterThan(0)
    expect(recorded.summaryDraft).toContain('Reviewed everything')
    expect(result.body.blockedAttempt).toEqual({ persisted: true })
  })

  it('reports persistence failure for blocked attempts honestly', async () => {
    const deps = serverDeps({
      persistBlockedAttempt: vi.fn(() => { throw new Error('disk full') }),
    })
    const result = await executeAuditCoverageReport(
      {
        auditScope: 'backlog audit',
        sourceSurface: 'local-api',
        snapshotAt: '2026-07-15T10:00:00.000Z',
        expectedItemIds: ['task-a', 'task-b'],
        reviewedItems: [{ itemId: 'task-a', evidenceClass: 'exact-record-read' }],
        summaryDraft: 'Reviewed everything.',
      },
      deps,
    )

    expect(result.status).toBe(422)
    expect(result.body.blockedAttempt.persisted).toBe(false)
    expect(result.body.blockedAttempt.persistError).toBe('disk full')
  })
})

describe('claim level model', () => {
  it('declared-complete coverage classifies as declared, never verified', () => {
    const coverage = createAuditCoverage({
      auditScope: 'backlog audit',
      sourceSurface: 'local-api',
      snapshotAt: NOW,
      expectedItemIds: ['task-a'],
    })
    recordReviewedItem(coverage, { itemId: 'task-a', evidenceClass: 'exact-record-read' })
    const receipt = finalizeAuditCoverageReceipt(coverage, { finalizedAt: NOW })

    expect(receipt.completeness).toBe('declared_full')
    expect(receipt.complete).toBe(false)
    expect(classifyClaimLevel({ receipt })).toBe('declared')
  })
})
