import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const guardrailPath = resolve(process.cwd(), 'server/local-api/claim-guardrail.cjs')
const coveragePath = resolve(process.cwd(), 'server/local-api/audit-coverage.cjs')

const {
  CLAIM_LEVELS,
  classifyClaimLevel,
  findBroadClaimViolations,
  guardSummaryWording,
  composeAuditSummary,
} = require(guardrailPath)
const {
  createAuditCoverage,
  recordReviewedItem,
  recordUnresolvedRow,
  finalizeAuditCoverageReceipt,
} = require(coveragePath)

const META = {
  auditScope: 'open tasks in personal scope',
  sourceSurface: 'local-api /api/tasks/inventory',
  snapshotAt: '2026-07-15T10:00:00.000Z',
}
const FINALIZED = { finalizedAt: '2026-07-15T10:05:00.000Z' }

const SERVER_READ = { evidenceClass: 'exact-record-read', provenance: 'server-read' }

function receiptOf(kind: string) {
  if (kind === 'full') {
    const coverage = createAuditCoverage({ ...META, expectedItemIds: ['task-a', 'task-b'] })
    recordReviewedItem(coverage, { itemId: 'task-a', ...SERVER_READ })
    recordReviewedItem(coverage, { itemId: 'task-b', ...SERVER_READ })
    return finalizeAuditCoverageReceipt(coverage, FINALIZED)
  }
  if (kind === 'declared-full') {
    const coverage = createAuditCoverage({ ...META, expectedItemIds: ['task-a', 'task-b'] })
    recordReviewedItem(coverage, { itemId: 'task-a', evidenceClass: 'exact-record-read' })
    recordReviewedItem(coverage, { itemId: 'task-b', evidenceClass: 'exact-record-read' })
    return finalizeAuditCoverageReceipt(coverage, FINALIZED)
  }
  if (kind === 'partial') {
    const coverage = createAuditCoverage({ ...META, expectedItemIds: ['task-a', 'task-b'] })
    recordReviewedItem(coverage, { itemId: 'task-a', ...SERVER_READ })
    return finalizeAuditCoverageReceipt(coverage, FINALIZED)
  }
  if (kind === 'sample') {
    const coverage = createAuditCoverage({ ...META, representativeSample: true })
    recordReviewedItem(coverage, { itemId: 'task-a', ...SERVER_READ })
    return finalizeAuditCoverageReceipt(coverage, FINALIZED)
  }
  if (kind === 'unknown') {
    const coverage = createAuditCoverage({ ...META })
    recordReviewedItem(coverage, { itemId: 'task-a', ...SERVER_READ })
    return finalizeAuditCoverageReceipt(coverage, FINALIZED)
  }
  if (kind === 'capability-full') {
    const coverage = createAuditCoverage({
      ...META,
      auditMode: 'capability',
      expectedItemIds: ['cap-read', 'cap-write'],
    })
    recordReviewedItem(coverage, { itemId: 'cap-read', evidenceClass: 'capability-class' })
    recordReviewedItem(coverage, { itemId: 'cap-write', evidenceClass: 'capability-class' })
    return finalizeAuditCoverageReceipt(coverage, FINALIZED)
  }
  if (kind === 'unresolved-rows') {
    const coverage = createAuditCoverage({ ...META, expectedItemIds: ['task-a'] })
    recordReviewedItem(coverage, {
      itemId: 'task-a',
      evidenceClass: 'screenshot-row-reconciled',
      provenance: 'server-read',
    })
    recordUnresolvedRow(coverage, { visibleText: 'לשלוח כביסה', reason: 'title-ambiguous' })
    return finalizeAuditCoverageReceipt(coverage, FINALIZED)
  }
  throw new Error(`unknown receipt kind ${kind}`)
}

describe('claim classification', () => {
  it('exposes the six claim levels', () => {
    expect(CLAIM_LEVELS).toEqual(['verified', 'declared', 'partial', 'inferred', 'blocked', 'unknown'])
  })

  it.each([
    ['full', 'verified'],
    ['declared-full', 'declared'],
    ['partial', 'partial'],
    ['sample', 'partial'],
    ['unknown', 'unknown'],
    ['capability-full', 'inferred'],
  ])('classifies a %s receipt as %s', (kind, level) => {
    expect(classifyClaimLevel({ receipt: receiptOf(kind) })).toBe(level)
  })

  it('classifies any audit with live blockers as blocked', () => {
    expect(
      classifyClaimLevel({
        receipt: receiptOf('full'),
        blockers: ['FlowState live connector authentication failed'],
      }),
    ).toBe('blocked')
  })

  it('classifies a missing or tampered receipt as unknown', () => {
    expect(classifyClaimLevel({ receipt: null })).toBe('unknown')
    expect(
      classifyClaimLevel({ receipt: { ...receiptOf('partial'), completeness: 'full', complete: true } }),
    ).toBe('unknown')
  })
})

describe('broad claim suppression', () => {
  const BROAD_TEXTS = [
    'I reviewed everything in FlowState.',
    'Everything was reviewed and is in order.',
    'Covered all tasks in the backlog.',
    'All tasks were reviewed against the board.',
    'The sync audit is fully verified.',
    'This was a full audit with complete coverage.',
    'Reviewed all visible tasks in the screenshot.',
    'Every task has been checked.',
  ]

  it.each(BROAD_TEXTS.map(text => [text]))('detects broad wording: %s', (text) => {
    expect(findBroadClaimViolations(text).length).toBeGreaterThan(0)
  })

  it('does not flag honest partial wording', () => {
    expect(
      findBroadClaimViolations(
        'Reviewed 1 of 2 expected tasks; exact task coverage was not completed.',
      ),
    ).toEqual([])
  })

  it.each([
    ['partial'],
    ['sample'],
    ['unknown'],
    ['unresolved-rows'],
  ])('blocks "reviewed everything" language over a %s receipt', (kind) => {
    const result = guardSummaryWording('I reviewed everything and covered all tasks.', {
      receipt: receiptOf(kind),
    })
    expect(result.ok).toBe(false)
    expect(result.violations.some(v => v.code === 'broad-claim')).toBe(true)
  })

  it('regression: a representative subset review cannot claim everything was reviewed', () => {
    const result = guardSummaryWording('I reviewed everything in FlowState.', {
      receipt: receiptOf('sample'),
    })
    expect(result.ok).toBe(false)
    expect(result.level).toBe('partial')
  })

  it('allows broad wording only over proven full item coverage', () => {
    const result = guardSummaryWording('Reviewed all tasks in scope; full coverage proven.', {
      receipt: receiptOf('full'),
    })
    expect(result.ok).toBe(true)
    expect(result.level).toBe('verified')
  })

  it('blocks broad item wording over a capability audit even at full capability coverage', () => {
    const result = guardSummaryWording(
      'All tasks were reviewed. Full capability audit complete.',
      { receipt: receiptOf('capability-full') },
    )
    expect(result.ok).toBe(false)
    expect(result.level).toBe('inferred')
  })

  it('requires capability audits to disclose that they are capability-based', () => {
    const result = guardSummaryWording(
      'Checked the important classes of behavior; nothing broken.',
      { receipt: receiptOf('capability-full') },
    )
    expect(result.ok).toBe(false)
    expect(result.violations.some(v => v.code === 'capability-not-disclosed')).toBe(true)
  })

  it('blocks broad wording when no valid receipt exists at all', () => {
    const result = guardSummaryWording('Reviewed everything.', { receipt: null })
    expect(result.ok).toBe(false)
    expect(result.level).toBe('unknown')
  })
})

describe('blocker and live-verification preservation', () => {
  const BLOCKER = 'FlowState live connector authentication failed'

  it('flags summaries that drop an active blocker', () => {
    const result = guardSummaryWording('Reviewed 1 of 2 expected tasks.', {
      receipt: receiptOf('partial'),
      blockers: [BLOCKER],
    })
    expect(result.ok).toBe(false)
    expect(result.violations.some(v => v.code === 'blocker-omitted')).toBe(true)
  })

  it('flags summaries that imply live verification without live proof', () => {
    const result = guardSummaryWording(
      'Reviewed 1 of 2 expected tasks. Live workflow verified end to end.',
      { receipt: receiptOf('partial'), liveVerified: false },
    )
    expect(result.ok).toBe(false)
    expect(result.violations.some(v => v.code === 'implies-live-verification')).toBe(true)
  })

  it('accepts wording that preserves the blocker and avoids live claims', () => {
    const result = guardSummaryWording(
      `Reviewed 1 of 2 expected tasks. Blocked: ${BLOCKER}. Live workflow not verified.`,
      { receipt: receiptOf('partial'), blockers: [BLOCKER] },
    )
    expect(result.ok).toBe(true)
  })
})

describe('composed summaries', () => {
  it('downgrades a partial audit to explicit partial wording with unreviewed IDs', () => {
    const { level, text } = composeAuditSummary(receiptOf('partial'))
    expect(level).toBe('partial')
    expect(text).toContain('1 of 2')
    expect(text).toContain('task-b')
    expect(text.toLowerCase()).toContain('exact task coverage was not completed')
  })

  it('labels representative samples explicitly', () => {
    const { text } = composeAuditSummary(receiptOf('sample'))
    expect(text.toLowerCase()).toContain('representative sample')
    expect(text.toLowerCase()).not.toContain('full coverage')
  })

  it('says capability audits are capability-based, not item-based', () => {
    const { level, text } = composeAuditSummary(receiptOf('capability-full'))
    expect(level).toBe('inferred')
    expect(text.toLowerCase()).toContain('capability')
    expect(text.toLowerCase()).toContain('not an item-by-item')
  })

  it('preserves blockers and never implies live verification while blocked', () => {
    const blocker = 'FlowState live connector authentication failed'
    const { level, text } = composeAuditSummary(receiptOf('full'), { blockers: [blocker] })
    expect(level).toBe('blocked')
    expect(text).toContain(blocker)
    expect(text.toLowerCase()).toContain('live')
    expect(text.toLowerCase()).not.toContain('live workflow verified.')
  })

  it('reports unresolved screenshot rows separately and marks the review mixed', () => {
    const { text } = composeAuditSummary(receiptOf('unresolved-rows'))
    expect(text.toLowerCase()).toContain('unresolved')
    expect(text.toLowerCase()).toContain('mixed')
  })

  it('keeps an explicit not-covered section', () => {
    const { text } = composeAuditSummary(receiptOf('partial'), {
      notCovered: ['Notion-side reconciliation'],
    })
    expect(text).toContain('Not covered:')
    expect(text).toContain('Notion-side reconciliation')
  })

  it.each([
    ['full', {}],
    ['declared-full', {}],
    ['partial', {}],
    ['sample', {}],
    ['unknown', {}],
    ['capability-full', {}],
    ['unresolved-rows', {}],
    ['full', { blockers: ['live auth blocked'] }],
    ['partial', { notCovered: ['Electron packaging'] }],
    ['partial', { liveVerified: true }],
  ] as Array<[string, Record<string, unknown>]>)(
    'every composed summary passes its own guard (%s %o)',
    (kind, options) => {
      const receipt = receiptOf(kind)
      const { text } = composeAuditSummary(receipt, options)
      const guard = guardSummaryWording(text, { receipt, ...options })
      expect(guard.violations).toEqual([])
      expect(guard.ok).toBe(true)
    },
  )
})
