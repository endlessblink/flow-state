'use strict'

/**
 * POST /api/audit/coverage executor (TASK-1959).
 *
 * Turns review evidence into one durable, machine-checkable audit coverage
 * receipt plus the strongest summary wording that evidence justifies.
 *
 * Trust boundary: the caller's request body is untrusted self-attestation.
 * - Exact reviewed items are server-verified: the executor re-reads the
 *   claimed records through server-owned lookups (deps.fetchTasksByIds /
 *   deps.fetchTasksByTitles, wired to the RLS-scoped database by the route).
 *   Only records the server itself re-read get provenance 'server-read';
 *   everything else stays 'declared' and can never produce completeness
 *   "full" or claim level "verified".
 * - Caller-supplied knownTasks are never authoritative: screenshot rows are
 *   reconciled against server-fetched records when server lookups are
 *   available; otherwise the reconciliation is provenance 'declared'.
 * - liveVerified from the caller is a declaration, never proof. "Live
 *   workflow verified." is unreachable from request input.
 *
 * An optional summaryDraft is checked against the receipt: over-broad
 * wording fails closed with a typed 422, a safe rewording, and a DURABLE
 * blocked-attempt record (deps.persistBlockedAttempt), so blocked
 * over-claims leave the same audit trail as accepted reports.
 */

const {
  createAuditCoverage,
  recordReviewedItem,
  recordUnreviewedItem,
  finalizeAuditCoverageReceipt,
  EXACT_EVIDENCE_CLASSES,
} = require('./audit-coverage.cjs')
const {
  classifyClaimLevel,
  composeAuditSummary,
  guardSummaryWording,
} = require('./claim-guardrail.cjs')
const {
  reconcileScreenshotRows,
  applyScreenshotReconciliation,
  normalizeVisibleText,
} = require('./screenshot-reconciliation.cjs')

function stringArray(value) {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.length > 0
}

/**
 * Re-read claimed records server-side. Returns { tasksById, available }.
 * A lookup failure fails closed: nothing gets server-read provenance.
 */
async function serverReadTasks(input, deps) {
  const fetchByIds = typeof deps.fetchTasksByIds === 'function' ? deps.fetchTasksByIds : null
  const fetchByTitles = typeof deps.fetchTasksByTitles === 'function'
    ? deps.fetchTasksByTitles
    : null
  const tasksById = new Map()
  if (!fetchByIds && !fetchByTitles) {
    return { tasksById, available: false }
  }

  const ids = new Set()
  for (const item of Array.isArray(input.reviewedItems) ? input.reviewedItems : []) {
    if (item && nonEmptyString(item.itemId) &&
        EXACT_EVIDENCE_CLASSES.includes(item.evidenceClass)) {
      ids.add(item.itemId)
    }
  }
  const titles = new Set()
  for (const row of Array.isArray(input.screenshotRows) ? input.screenshotRows : []) {
    if (row && nonEmptyString(row.claimedTaskId)) ids.add(row.claimedTaskId)
    const normalized = normalizeVisibleText(row && row.visibleText)
    if (normalized) titles.add(normalized)
  }

  try {
    if (fetchByIds && ids.size > 0) {
      const rows = await fetchByIds([...ids].sort())
      for (const task of Array.isArray(rows) ? rows : []) {
        if (task && nonEmptyString(task.id)) tasksById.set(task.id, task)
      }
    }
    if (fetchByTitles && titles.size > 0 &&
        Array.isArray(input.screenshotRows) && input.screenshotRows.length > 0) {
      const rows = await fetchByTitles([...titles].sort())
      for (const task of Array.isArray(rows) ? rows : []) {
        if (task && nonEmptyString(task.id)) tasksById.set(task.id, task)
      }
    }
  } catch {
    // Fail closed: a broken lookup must not upgrade anything to server-read.
    return { tasksById: new Map(), available: false }
  }
  return { tasksById, available: true }
}

async function executeAuditCoverageReport(body, deps = {}) {
  const now = deps.now || (() => new Date().toISOString())
  const input = body && typeof body === 'object' ? body : {}

  const blockers = stringArray(input.blockers) ? input.blockers : []
  const notCovered = stringArray(input.notCovered) ? input.notCovered : []
  // Caller input is a declaration only. Server-verified live proof does not
  // exist in this API shape, so "Live workflow verified." is unreachable.
  const liveVerification = {
    declared: input.liveVerified === true,
    serverVerified: false,
  }

  const verification = await serverReadTasks(input, deps)

  let receipt
  let screenshot = null
  try {
    const coverage = createAuditCoverage({
      auditScope: input.auditScope,
      sourceSurface: input.sourceSurface,
      snapshotAt: input.snapshotAt || now(),
      auditMode: input.auditMode ?? 'item',
      representativeSample: input.representativeSample ?? false,
      expectedItemIds: input.expectedItemIds ?? null,
      expectedItemCount: input.expectedItemCount ?? null,
    })

    for (const item of Array.isArray(input.reviewedItems) ? input.reviewedItems : []) {
      const serverRead = item && nonEmptyString(item.itemId) &&
        verification.available && verification.tasksById.has(item.itemId)
      recordReviewedItem(coverage, {
        itemId: item && item.itemId,
        evidenceClass: item && item.evidenceClass,
        provenance: serverRead ? 'server-read' : 'declared',
      })
    }
    for (const itemId of Array.isArray(input.unreviewedItemIds) ? input.unreviewedItemIds : []) {
      recordUnreviewedItem(coverage, itemId)
    }

    if (Array.isArray(input.screenshotRows)) {
      // Server-fetched records are authoritative when available; caller
      // knownTasks are a declared fallback that can never be server-read.
      const reconciliation = verification.available
        ? reconcileScreenshotRows({
            rows: input.screenshotRows,
            tasks: [...verification.tasksById.values()],
            tasksProvenance: 'server-read',
          })
        : reconcileScreenshotRows({
            rows: input.screenshotRows,
            tasks: Array.isArray(input.knownTasks) ? input.knownTasks : [],
            tasksProvenance: 'declared',
          })
      applyScreenshotReconciliation(coverage, reconciliation)
      screenshot = {
        reviewLevel: reconciliation.reviewLevel,
        tasksProvenance: reconciliation.tasksProvenance,
        exactReviewedTaskIds: reconciliation.exactReviewedTaskIds,
        weakCandidateTaskIds: reconciliation.weakCandidateTaskIds,
        ambiguousCandidateTaskIds: reconciliation.ambiguousCandidateTaskIds,
        unresolvedRowCount: reconciliation.unresolvedRowCount,
        weakRowCount: reconciliation.weakRowCount,
        ambiguousRowCount: reconciliation.ambiguousRowCount,
        rows: reconciliation.rows,
      }
    }

    receipt = finalizeAuditCoverageReceipt(coverage, { finalizedAt: now() })
  } catch (error) {
    return {
      status: 400,
      body: { error: 'invalid_audit_request', detail: error && error.message },
    }
  }

  const claimLevel = classifyClaimLevel({ receipt, blockers })
  const composed = composeAuditSummary(receipt, { blockers, liveVerification, notCovered })

  let summaryGuard = null
  if (typeof input.summaryDraft === 'string') {
    summaryGuard = guardSummaryWording(input.summaryDraft, {
      receipt,
      blockers,
      liveVerification,
    })
    if (!summaryGuard.ok) {
      // Blocked over-claims must leave a durable audit trail.
      const blockedAttempt = { persisted: false }
      if (typeof deps.persistBlockedAttempt === 'function') {
        try {
          await deps.persistBlockedAttempt({
            blockedAt: now(),
            claimLevel,
            violations: summaryGuard.violations,
            summaryDraft: input.summaryDraft,
            receipt,
          })
          blockedAttempt.persisted = true
        } catch (error) {
          blockedAttempt.persistError = (error && error.message) || 'persist failed'
        }
      }
      return {
        status: 422,
        body: {
          error: 'broad_claim_blocked',
          violations: summaryGuard.violations,
          claimLevel,
          receipt,
          safeSummary: composed.text,
          screenshot,
          liveVerification,
          blockedAttempt,
        },
      }
    }
  }

  let persisted = false
  let persistError = null
  if (typeof deps.persistReceipt === 'function') {
    try {
      await deps.persistReceipt(receipt)
      persisted = true
    } catch (error) {
      persistError = (error && error.message) || 'persist failed'
    }
  }

  return {
    status: 200,
    body: {
      ok: true,
      contractVersion: receipt.contractVersion,
      receipt,
      claimLevel,
      summary: composed.text,
      summaryLevel: composed.level,
      screenshot,
      summaryGuard,
      liveVerification,
      persisted,
      ...(persistError === null ? {} : { persistError }),
    },
  }
}

module.exports = { executeAuditCoverageReport }
