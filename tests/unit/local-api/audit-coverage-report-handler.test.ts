import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const reportPath = resolve(process.cwd(), 'server/local-api/audit-coverage-report.cjs')
const coveragePath = resolve(process.cwd(), 'server/local-api/audit-coverage.cjs')

const { executeAuditCoverageReport } = require(reportPath)
const { validAuditCoverageReceipt } = require(coveragePath)

const NOW = '2026-07-15T11:00:00.000Z'

// Server-owned record store: only records the server itself re-reads can
// gain 'server-read' provenance and support verified/full claims.
const SERVER_TASKS = [
  { id: 'task-a', title: 'Alpha' },
  { id: 'task-b', title: 'Beta' },
  { id: 'task-laundry', title: 'לשלוח כביסה' },
  { id: 'task-q3-a', title: 'Draft Q3 plan' },
  { id: 'task-q3-b', title: 'Draft Q3 plan' },
]
const deps = () => ({
  now: () => NOW,
  persistReceipt: vi.fn(),
  persistBlockedAttempt: vi.fn(),
  fetchTasksByIds: vi.fn(async (ids: string[]) =>
    SERVER_TASKS.filter(task => ids.includes(task.id))),
  fetchTasksByTitles: vi.fn(async (titles: string[]) =>
    SERVER_TASKS.filter(task => titles.includes(task.title))),
})

const FULL_BODY = {
  auditScope: 'open tasks in personal scope',
  sourceSurface: 'local-api /api/tasks/inventory',
  snapshotAt: '2026-07-15T10:00:00.000Z',
  expectedItemIds: ['task-a', 'task-b'],
  reviewedItems: [
    { itemId: 'task-a', evidenceClass: 'exact-record-read' },
    { itemId: 'task-b', evidenceClass: 'canonical-receipt' },
  ],
}

describe('POST /api/audit/coverage executor', () => {
  it('returns a durable verified receipt for proven full coverage', async () => {
    const dependencies = deps()
    const result = await executeAuditCoverageReport(FULL_BODY, dependencies)

    expect(result.status).toBe(200)
    expect(result.body.ok).toBe(true)
    expect(result.body.claimLevel).toBe('verified')
    expect(result.body.receipt.completeness).toBe('full')
    expect(validAuditCoverageReceipt(result.body.receipt)).toBe(true)
    expect(result.body.persisted).toBe(true)
    expect(dependencies.persistReceipt).toHaveBeenCalledWith(result.body.receipt)
  })

  it('returns partial coverage with a downgraded summary', async () => {
    const result = await executeAuditCoverageReport(
      {
        ...FULL_BODY,
        reviewedItems: [{ itemId: 'task-a', evidenceClass: 'exact-record-read' }],
      },
      deps(),
    )
    expect(result.status).toBe(200)
    expect(result.body.claimLevel).toBe('partial')
    expect(result.body.receipt.unreviewedItemIds).toEqual(['task-b'])
    expect(result.body.summary.toLowerCase()).toContain('exact task coverage was not completed')
  })

  it('reconciles screenshot rows and reports the review level', async () => {
    const result = await executeAuditCoverageReport(
      {
        auditScope: 'tasks visible in the screenshot',
        sourceSurface: 'screenshot + local-api /api/tasks/search',
        snapshotAt: '2026-07-15T10:00:00.000Z',
        screenshotRows: [
          { visibleText: 'לשלוח כביסה', claimedTaskId: 'task-laundry', reviewed: true },
          { visibleText: 'Draft Q3 plan', reviewed: true },
        ],
        knownTasks: [
          { id: 'task-laundry', title: 'לשלוח כביסה' },
          { id: 'task-q3-a', title: 'Draft Q3 plan' },
          { id: 'task-q3-b', title: 'Draft Q3 plan' },
        ],
      },
      deps(),
    )
    expect(result.status).toBe(200)
    expect(result.body.screenshot.reviewLevel).toBe('mixed')
    expect(result.body.screenshot.tasksProvenance).toBe('server-read')
    expect(result.body.screenshot.ambiguousRowCount).toBe(1)
    expect(result.body.receipt.ambiguousCandidateItemIds).toEqual(['task-q3-a', 'task-q3-b'])
    expect(result.body.receipt.reviewedItemIds).toEqual(['task-laundry'])
    expect(result.body.receipt.completeness).not.toBe('full')
  })

  it('blocks an over-broad summary draft and returns a safe rewording', async () => {
    const result = await executeAuditCoverageReport(
      {
        ...FULL_BODY,
        reviewedItems: [{ itemId: 'task-a', evidenceClass: 'exact-record-read' }],
        summaryDraft: 'Reviewed everything; all tasks covered and fully verified.',
      },
      deps(),
    )
    expect(result.status).toBe(422)
    expect(result.body.error).toBe('broad_claim_blocked')
    expect(result.body.violations.length).toBeGreaterThan(0)
    expect(result.body.safeSummary.toLowerCase()).toContain('exact task coverage was not completed')
    expect(validAuditCoverageReceipt(result.body.receipt)).toBe(true)
  })

  it('accepts an honest summary draft for the same partial audit', async () => {
    const result = await executeAuditCoverageReport(
      {
        ...FULL_BODY,
        reviewedItems: [{ itemId: 'task-a', evidenceClass: 'exact-record-read' }],
        summaryDraft:
          'Reviewed 1 of 2 expected tasks; exact task coverage was not completed. Unreviewed: task-b.',
      },
      deps(),
    )
    expect(result.status).toBe(200)
    expect(result.body.summaryGuard.ok).toBe(true)
  })

  it('preserves live blockers in the claim level and summary', async () => {
    const blocker = 'FlowState live connector authentication failed'
    const result = await executeAuditCoverageReport(
      { ...FULL_BODY, blockers: [blocker] },
      deps(),
    )
    expect(result.status).toBe(200)
    expect(result.body.claimLevel).toBe('blocked')
    expect(result.body.summary).toContain(blocker)
  })

  it('rejects invalid audit requests with a typed error', async () => {
    const result = await executeAuditCoverageReport({ sourceSurface: 'x' }, deps())
    expect(result.status).toBe(400)
    expect(result.body.error).toBe('invalid_audit_request')
  })

  it('reports persistence failures instead of silently claiming durability', async () => {
    const result = await executeAuditCoverageReport(FULL_BODY, {
      now: () => NOW,
      persistReceipt: () => {
        throw new Error('disk full')
      },
    })
    expect(result.status).toBe(200)
    expect(result.body.persisted).toBe(false)
    expect(result.body.persistError).toContain('disk full')
  })
})

describe('server wiring contract', () => {
  const SERVER_CJS = readFileSync(
    resolve(__dirname, '../../../server/local-api/server.cjs'),
    'utf-8',
  )

  it('registers POST /api/audit/coverage behind bearer token and auth context checks', () => {
    const route = SERVER_CJS.indexOf("path === '/api/audit/coverage'")
    const tokenCheck = SERVER_CJS.indexOf('if (TOKEN)')
    const ctxCheck = SERVER_CJS.indexOf('classifyMissingAuthContext(rendererAuthState)')

    expect(route, 'audit coverage route not found').toBeGreaterThan(-1)
    expect(tokenCheck).toBeGreaterThan(-1)
    expect(route).toBeGreaterThan(tokenCheck)
    expect(route).toBeGreaterThan(ctxCheck)
  })

  it('durably appends audit coverage receipts under the sidecar data directory', () => {
    expect(SERVER_CJS).toContain("require('./audit-coverage-report.cjs')")
    expect(SERVER_CJS).toContain('audit-coverage-receipts.jsonl')
    expect(SERVER_CJS).toContain('appendFileSync')
  })

  it('durably appends blocked over-claim attempts to their own ledger', () => {
    expect(SERVER_CJS).toContain('audit-coverage-blocked.jsonl')
    expect(SERVER_CJS).toContain('persistBlockedAttempt')
  })

  it('wires server-owned task lookups so provenance cannot come from the caller', () => {
    expect(SERVER_CJS).toContain('fetchTasksByIds')
    expect(SERVER_CJS).toContain('fetchTasksByTitles')
    expect(SERVER_CJS).toMatch(/fetchTasksByIds:[\s\S]{0,200}scopeTaskQuery/)
  })
})
