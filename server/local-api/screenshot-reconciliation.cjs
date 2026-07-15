'use strict'

/**
 * Screenshot row reconciliation (TASK-1959).
 *
 * A task row visible in a screenshot is not a reviewed task. Each visible row
 * must be reconciled to one exact task record before it can count as exact
 * reviewed coverage: a claimed task ID whose stored title agrees with the
 * visible text is identity-proven; a title-only match (even a unique one)
 * stays a weak candidate; several same-title matches stay ambiguous
 * candidates; everything else is unresolved. Weak and ambiguous candidates
 * keep their candidate task IDs so the durable receipt can preserve them.
 *
 * Identity resolution is not review: the review level reflects rows that were
 * both identity-proven AND actually reviewed. A proven row with
 * reviewed:false can never produce "exact-task-level".
 *
 * Provenance: reconciliation is only as trustworthy as the task list it runs
 * against. Callers pass tasksProvenance 'server-read' only when the task
 * records were fetched server-side; caller-supplied task lists must stay
 * 'declared'.
 *
 * Visible text may be Hebrew and multiline; normalization collapses
 * whitespace and strips Unicode directionality marks before comparison.
 */

const {
  recordReviewedItem,
  recordUnreviewedItem,
  recordWeakCandidate,
  recordAmbiguousCandidate,
  recordUnresolvedRow,
} = require('./audit-coverage.cjs')

// LRM/RLM, embedding/override controls, and isolate controls that screenshot
// OCR or UI copies commonly inject around RTL text.
const DIRECTIONALITY_MARKS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g

const REVIEW_LEVELS = ['exact-task-level', 'identity-only', 'mixed', 'screenshot-level']

function normalizeVisibleText(text) {
  return String(text ?? '')
    .normalize('NFC')
    .replace(DIRECTIONALITY_MARKS, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.length > 0
}

/**
 * Reconcile visible screenshot rows against exact task records.
 * rows: [{ visibleText, claimedTaskId?, reviewed?, inAuditScope? }]
 * tasks: [{ id, title }]
 * tasksProvenance: 'server-read' when tasks were fetched server-side,
 *   otherwise 'declared'.
 */
function reconcileScreenshotRows({ rows, tasks, tasksProvenance = 'declared' } = {}) {
  if (!Array.isArray(rows)) throw new TypeError('rows must be an array')
  if (!Array.isArray(tasks)) throw new TypeError('tasks must be an array')
  if (tasksProvenance !== 'server-read' && tasksProvenance !== 'declared') {
    throw new TypeError('tasksProvenance must be server-read or declared')
  }

  const tasksById = new Map()
  const taskIdsByTitle = new Map()
  for (const task of tasks) {
    if (!task || !nonEmptyString(task.id)) continue
    tasksById.set(task.id, task)
    const title = normalizeVisibleText(task.title)
    if (!title) continue
    if (!taskIdsByTitle.has(title)) taskIdsByTitle.set(title, [])
    taskIdsByTitle.get(title).push(task.id)
  }

  const resultRows = rows.map((row) => {
    const visibleText = String(row?.visibleText ?? '')
    const normalizedText = normalizeVisibleText(visibleText)
    const reviewed = row?.reviewed === true
    const inAuditScope = row?.inAuditScope !== false
    const claimedTaskId = nonEmptyString(row?.claimedTaskId) ? row.claimedTaskId : null

    let matchedTaskId = null
    let matchBasis
    let matchConfidence
    let candidateTaskIds = []

    if (claimedTaskId) {
      const task = tasksById.get(claimedTaskId)
      if (!task) {
        matchBasis = 'unknown-id'
        matchConfidence = 'unresolved'
      } else if (normalizeVisibleText(task.title) === normalizedText && normalizedText !== '') {
        matchedTaskId = claimedTaskId
        matchBasis = 'exact-id'
        matchConfidence = 'proven'
        candidateTaskIds = [claimedTaskId]
      } else {
        matchBasis = 'id-title-conflict'
        matchConfidence = 'unresolved'
        candidateTaskIds = [claimedTaskId]
      }
    } else {
      const byTitle = normalizedText === '' ? [] : (taskIdsByTitle.get(normalizedText) || [])
      if (byTitle.length === 1) {
        matchBasis = 'title-unique'
        matchConfidence = 'weak'
        candidateTaskIds = [...byTitle]
      } else if (byTitle.length > 1) {
        matchBasis = 'title-ambiguous'
        matchConfidence = 'ambiguous'
        candidateTaskIds = [...byTitle].sort()
      } else {
        matchBasis = 'unmatched'
        matchConfidence = 'unresolved'
      }
    }

    return {
      visibleText,
      normalizedText,
      reviewed,
      inAuditScope,
      matchedTaskId,
      matchBasis,
      matchConfidence,
      candidateTaskIds,
      unresolved: matchConfidence !== 'proven',
    }
  })

  const inScope = resultRows.filter(row => row.inAuditScope)
  const proven = inScope.filter(row => row.matchConfidence === 'proven')
  const provenReviewed = proven.filter(row => row.reviewed)
  const provenUnreviewed = proven.filter(row => !row.reviewed)
  const weakRows = inScope.filter(row => row.matchConfidence === 'weak')
  const ambiguousRows = inScope.filter(row => row.matchConfidence === 'ambiguous')
  const unresolvedRows = inScope.filter(row => row.matchConfidence === 'unresolved')

  // Review level reflects reviewed evidence, never identity resolution alone.
  let reviewLevel
  if (provenReviewed.length > 0 && provenUnreviewed.length === 0 &&
      weakRows.length === 0 && ambiguousRows.length === 0 && unresolvedRows.length === 0) {
    reviewLevel = 'exact-task-level'
  } else if (proven.length > 0 && provenReviewed.length === 0) {
    reviewLevel = 'identity-only'
  } else if (provenReviewed.length > 0) {
    reviewLevel = 'mixed'
  } else {
    reviewLevel = 'screenshot-level'
  }

  return {
    rows: resultRows,
    tasksProvenance,
    exactReviewedTaskIds: [...new Set(
      provenReviewed.map(row => row.matchedTaskId),
    )].sort(),
    weakCandidateTaskIds: [...new Set(
      weakRows.flatMap(row => row.candidateTaskIds),
    )].sort(),
    ambiguousCandidateTaskIds: [...new Set(
      ambiguousRows.flatMap(row => row.candidateTaskIds),
    )].sort(),
    unresolvedRowCount: unresolvedRows.length,
    weakRowCount: weakRows.length,
    ambiguousRowCount: ambiguousRows.length,
    reviewLevel,
  }
}

/**
 * Feed a reconciliation into an audit coverage accumulator: only proven and
 * actually-reviewed rows become exact reviewed items (carrying the task-list
 * provenance); proven-but-unreviewed rows become exact unreviewed items;
 * weak title-only candidates and ambiguous candidates are preserved durably
 * with their candidate IDs; only truly unmatchable rows become unresolved
 * observations.
 */
function applyScreenshotReconciliation(coverage, reconciliation) {
  const provenance = reconciliation.tasksProvenance === 'server-read'
    ? 'server-read'
    : 'declared'
  for (const row of reconciliation.rows) {
    if (!row.inAuditScope) continue
    if (row.matchConfidence === 'proven') {
      if (row.reviewed) {
        recordReviewedItem(coverage, {
          itemId: row.matchedTaskId,
          evidenceClass: 'screenshot-row-reconciled',
          provenance,
        })
      } else {
        recordUnreviewedItem(coverage, row.matchedTaskId)
      }
    } else if (row.matchConfidence === 'weak') {
      recordWeakCandidate(coverage, {
        itemId: row.candidateTaskIds[0],
        basis: row.matchBasis,
      })
    } else if (row.matchConfidence === 'ambiguous') {
      recordAmbiguousCandidate(coverage, {
        visibleText: row.visibleText,
        candidateTaskIds: row.candidateTaskIds,
      })
    } else {
      recordUnresolvedRow(coverage, {
        visibleText: row.visibleText,
        reason: row.matchBasis,
      })
    }
  }
  return coverage
}

module.exports = {
  REVIEW_LEVELS,
  normalizeVisibleText,
  reconcileScreenshotRows,
  applyScreenshotReconciliation,
}
