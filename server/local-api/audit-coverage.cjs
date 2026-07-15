'use strict'

/**
 * Receipt-backed audit coverage (TASK-1959).
 *
 * Records exactly what a review covered so a later summary can never claim
 * more than the evidence supports. The receipt distinguishes full coverage,
 * declared-but-unverified coverage, partial coverage, a declared
 * representative sample, and unknown completeness, and it is digest-bound so
 * tampering is machine-detectable.
 *
 * Trust boundary (hardening): every reviewed item carries a provenance.
 * - 'server-read'  — the sidecar itself re-read the exact record server-side
 *   at audit time. This is the only provenance that can support
 *   completeness "full" and downstream claim level "verified".
 * - 'declared'     — the caller asserted the evidence. Declared evidence is
 *   recorded durably but can never produce "full"/"verified"; at best the
 *   receipt reaches completeness "declared_full".
 *
 * The digest proves integrity (the receipt was not altered), never
 * provenance. Provenance is proven only by the recorded provenance class,
 * which the report executor assigns from server-owned lookups.
 *
 * Exact coverage requires exact identity: a screenshot row, title match, or
 * capability observation without a proven item ID never counts as an exact
 * reviewed item. Weak title-only candidates and ambiguous candidates are
 * durable, ID-bearing receipt fields — never collapsed into generic
 * unresolved observations.
 */

const { canonicalHash } = require('./canonical-receipt.cjs')

const CONTRACT_VERSION = 'audit-coverage-v2'

const AUDIT_MODES = ['item', 'capability']

// Evidence classes that prove exact item identity in item mode.
const EXACT_EVIDENCE_CLASSES = [
  'exact-record-read',
  'canonical-receipt',
  'screenshot-row-reconciled',
]

// Evidence classes that never prove exact item coverage in item mode.
const WEAK_EVIDENCE_CLASSES = [
  'title-only-match',
  'capability-class',
]

const EVIDENCE_CLASSES = [...EXACT_EVIDENCE_CLASSES, ...WEAK_EVIDENCE_CLASSES]

const PROVENANCE_CLASSES = ['server-read', 'declared']

const COMPLETENESS_CLASSES = [
  'full',
  'declared_full',
  'partial',
  'representative_sample',
  'unknown',
]

const EVIDENCE_BASES = ['server-read', 'mixed', 'declared', 'none']

function object(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() === value && value.length > 0
}

function timestamp(value) {
  return nonEmptyString(value) && Number.isFinite(Date.parse(value))
}

function sortedUnique(values) {
  return [...new Set(values)].sort()
}

function assertNonEmptyString(value, field) {
  if (!nonEmptyString(value)) throw new TypeError(`${field} must be a non-empty string`)
}

/** Is this evidence class exact identity proof for the given audit mode? */
function exactEvidence(evidenceClass, auditMode) {
  if (EXACT_EVIDENCE_CLASSES.includes(evidenceClass)) return true
  return evidenceClass === 'capability-class' && auditMode === 'capability'
}

/**
 * Does this reviewed item count as server-verified exact coverage?
 * Capability mode has no server-verifiable record identity, so capability
 * observations count as exact within their (never-verified) mode.
 */
function verifiedExact(item, auditMode) {
  if (!exactEvidence(item.evidenceClass, auditMode)) return false
  if (auditMode === 'capability') return true
  return item.provenance === 'server-read'
}

function createAuditCoverage(input) {
  if (!object(input)) throw new TypeError('audit coverage input must be an object')
  const {
    auditScope,
    sourceSurface,
    snapshotAt,
    auditMode = 'item',
    representativeSample = false,
    expectedItemIds = null,
    expectedItemCount = null,
  } = input

  assertNonEmptyString(auditScope, 'auditScope')
  assertNonEmptyString(sourceSurface, 'sourceSurface')
  if (!timestamp(snapshotAt)) throw new TypeError('snapshotAt must be an ISO timestamp')
  if (!AUDIT_MODES.includes(auditMode)) throw new TypeError('auditMode must be item or capability')
  if (typeof representativeSample !== 'boolean') {
    throw new TypeError('representativeSample must be a boolean')
  }
  if (expectedItemIds !== null) {
    if (!Array.isArray(expectedItemIds) || !expectedItemIds.every(nonEmptyString)) {
      throw new TypeError('expectedItemIds must be null or an array of non-empty strings')
    }
    if (new Set(expectedItemIds).size !== expectedItemIds.length) {
      throw new TypeError('expectedItemIds must be unique')
    }
  }
  if (expectedItemCount !== null) {
    if (!Number.isSafeInteger(expectedItemCount) || expectedItemCount < 0) {
      throw new TypeError('expectedItemCount must be null or a non-negative integer')
    }
  }
  if (expectedItemIds !== null && expectedItemCount !== null &&
      expectedItemIds.length !== expectedItemCount) {
    throw new TypeError('expectedItemCount disagrees with expectedItemIds')
  }

  return {
    auditScope,
    sourceSurface,
    snapshotAt,
    auditMode,
    representativeSample,
    expectedItemIds: expectedItemIds === null ? null : sortedUnique(expectedItemIds),
    expectedItemCount,
    reviewedItems: new Map(),
    explicitUnreviewedItemIds: new Set(),
    weakCandidates: new Map(),
    ambiguousCandidates: [],
    unresolvedRows: [],
  }
}

/** Strength ranking for superseding evidence on the same item. */
function evidenceRank(item, auditMode) {
  if (verifiedExact(item, auditMode)) return 3
  if (exactEvidence(item.evidenceClass, auditMode)) return 2
  return 1
}

function recordReviewedItem(coverage, input) {
  if (!object(input)) throw new TypeError('reviewed item must be an object')
  const { itemId, evidenceClass, provenance = 'declared' } = input
  assertNonEmptyString(itemId, 'itemId')
  if (!EVIDENCE_CLASSES.includes(evidenceClass)) {
    throw new TypeError(`evidenceClass must be one of: ${EVIDENCE_CLASSES.join(', ')}`)
  }
  if (!PROVENANCE_CLASSES.includes(provenance)) {
    throw new TypeError(`provenance must be one of: ${PROVENANCE_CLASSES.join(', ')}`)
  }
  const candidate = { evidenceClass, provenance }
  const existing = coverage.reviewedItems.get(itemId)
  // Stronger evidence always supersedes weaker evidence for the same item.
  if (!existing ||
      evidenceRank(candidate, coverage.auditMode) > evidenceRank(existing, coverage.auditMode)) {
    coverage.reviewedItems.set(itemId, candidate)
  }
  return coverage
}

function recordUnreviewedItem(coverage, itemId) {
  assertNonEmptyString(itemId, 'itemId')
  coverage.explicitUnreviewedItemIds.add(itemId)
  return coverage
}

/** A durable weak candidate: a title-only match whose identity is unproven. */
function recordWeakCandidate(coverage, input) {
  if (!object(input)) throw new TypeError('weak candidate must be an object')
  const { itemId, basis = 'title-unique' } = input
  assertNonEmptyString(itemId, 'itemId')
  assertNonEmptyString(basis, 'basis')
  if (!coverage.weakCandidates.has(itemId)) {
    coverage.weakCandidates.set(itemId, basis)
  }
  return coverage
}

/** A durable ambiguous candidate: one visible row, several possible IDs. */
function recordAmbiguousCandidate(coverage, input) {
  if (!object(input)) throw new TypeError('ambiguous candidate must be an object')
  const { visibleText, candidateTaskIds } = input
  assertNonEmptyString(visibleText, 'visibleText')
  if (!Array.isArray(candidateTaskIds) || candidateTaskIds.length < 2 ||
      !candidateTaskIds.every(nonEmptyString)) {
    throw new TypeError('candidateTaskIds must list at least two non-empty IDs')
  }
  coverage.ambiguousCandidates.push({
    visibleText,
    candidateTaskIds: sortedUnique(candidateTaskIds),
  })
  return coverage
}

/** A visible row (screenshot or otherwise) with no proven exact identity. */
function recordUnresolvedRow(coverage, input) {
  if (!object(input)) throw new TypeError('unresolved row must be an object')
  const { visibleText, reason } = input
  assertNonEmptyString(visibleText, 'visibleText')
  assertNonEmptyString(reason, 'reason')
  coverage.unresolvedRows.push({ visibleText, reason })
  return coverage
}

function deriveBuckets(reviewedItems, auditMode) {
  const exact = []
  const declaredExact = []
  const weakEvidence = []
  for (const item of reviewedItems) {
    if (verifiedExact(item, auditMode)) exact.push(item.itemId)
    else if (exactEvidence(item.evidenceClass, auditMode)) declaredExact.push(item.itemId)
    else weakEvidence.push(item.itemId)
  }
  return { exact, declaredExact, weakEvidence }
}

function finalizeAuditCoverageReceipt(coverage, input) {
  if (!object(input) || !timestamp(input.finalizedAt)) {
    throw new TypeError('finalizedAt must be an ISO timestamp')
  }

  const reviewedItems = [...coverage.reviewedItems.entries()]
    .map(([itemId, item]) => ({
      itemId,
      evidenceClass: item.evidenceClass,
      provenance: item.provenance,
    }))
    .sort((a, b) => (a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0))

  const buckets = deriveBuckets(reviewedItems, coverage.auditMode)
  const reviewedItemIds = sortedUnique(buckets.exact)
  const declaredReviewedItemIds = sortedUnique(buckets.declaredExact)
  const weakCandidateItemIds = sortedUnique([
    ...buckets.weakEvidence,
    ...coverage.weakCandidates.keys(),
  ])

  const ambiguousCandidates = coverage.ambiguousCandidates
    .map(candidate => ({
      visibleText: candidate.visibleText,
      candidateTaskIds: [...candidate.candidateTaskIds],
    }))
    .sort((a, b) => (a.visibleText < b.visibleText ? -1 : a.visibleText > b.visibleText ? 1 : 0))
  const ambiguousCandidateItemIds = sortedUnique(
    ambiguousCandidates.flatMap(candidate => candidate.candidateTaskIds),
  )

  const reviewedSet = new Set(reviewedItemIds)
  const declaredSet = new Set(declaredReviewedItemIds)
  const unreviewed = new Set(
    [...coverage.explicitUnreviewedItemIds]
      .filter(id => !reviewedSet.has(id) && !declaredSet.has(id)),
  )
  if (coverage.expectedItemIds) {
    for (const id of coverage.expectedItemIds) {
      if (!reviewedSet.has(id) && !declaredSet.has(id)) unreviewed.add(id)
    }
  }
  const unreviewedItemIds = sortedUnique([...unreviewed])

  let evidenceBasis
  if (reviewedItemIds.length === 0 && declaredReviewedItemIds.length === 0) {
    evidenceBasis = 'none'
  } else if (declaredReviewedItemIds.length === 0) {
    evidenceBasis = coverage.auditMode === 'capability' ? 'declared' : 'server-read'
  } else if (reviewedItemIds.length === 0) {
    evidenceBasis = 'declared'
  } else {
    evidenceBasis = 'mixed'
  }
  // Capability observations are never server-verifiable records.
  if (coverage.auditMode === 'capability' && reviewedItems.length > 0) {
    evidenceBasis = 'declared'
  }

  const unaccountedWeak = weakCandidateItemIds
    .filter(id => !reviewedSet.has(id) && !declaredSet.has(id))
  const coverageComplete =
    unreviewedItemIds.length === 0 &&
    coverage.unresolvedRows.length === 0 &&
    ambiguousCandidates.length === 0 &&
    unaccountedWeak.length === 0

  let completeness
  if (coverage.representativeSample) {
    completeness = 'representative_sample'
  } else if (coverage.expectedItemIds === null) {
    completeness = 'unknown'
  } else if (coverageComplete && declaredReviewedItemIds.length === 0 &&
      evidenceBasis === 'server-read') {
    completeness = 'full'
  } else if (coverageComplete) {
    completeness = 'declared_full'
  } else {
    completeness = 'partial'
  }

  const body = {
    contractVersion: CONTRACT_VERSION,
    auditScope: coverage.auditScope,
    sourceSurface: coverage.sourceSurface,
    snapshotAt: coverage.snapshotAt,
    auditMode: coverage.auditMode,
    representativeSample: coverage.representativeSample,
    expectedItemCount: coverage.expectedItemCount,
    expectedItemIds: coverage.expectedItemIds,
    reviewedItems,
    reviewedItemIds,
    declaredReviewedItemIds,
    weakCandidateItemIds,
    ambiguousCandidates,
    ambiguousCandidateItemIds,
    unreviewedItemIds,
    unresolvedRows: coverage.unresolvedRows.map(row => ({ ...row })),
    unresolvedRowCount: coverage.unresolvedRows.length,
    evidenceBasis,
    completeness,
    complete: completeness === 'full',
    finalizedAt: input.finalizedAt,
  }
  return { ...body, receiptDigest: canonicalHash(body) }
}

function sortedUniqueStrings(value) {
  return Array.isArray(value) &&
    value.every(nonEmptyString) &&
    new Set(value).size === value.length &&
    value.every((id, index) => index === 0 || value[index - 1] < id)
}

/** Machine-checkable validation: shape, internal consistency, and digest. */
function validAuditCoverageReceipt(value) {
  if (!object(value)) return false
  if (value.contractVersion !== CONTRACT_VERSION) return false
  if (!nonEmptyString(value.auditScope) || !nonEmptyString(value.sourceSurface)) return false
  if (!timestamp(value.snapshotAt) || !timestamp(value.finalizedAt)) return false
  if (!AUDIT_MODES.includes(value.auditMode)) return false
  if (typeof value.representativeSample !== 'boolean') return false
  if (!COMPLETENESS_CLASSES.includes(value.completeness)) return false
  if (!EVIDENCE_BASES.includes(value.evidenceBasis)) return false
  if (value.complete !== (value.completeness === 'full')) return false

  if (value.expectedItemCount !== null &&
      (!Number.isSafeInteger(value.expectedItemCount) || value.expectedItemCount < 0)) {
    return false
  }
  if (value.expectedItemIds !== null && !sortedUniqueStrings(value.expectedItemIds)) return false
  if (value.expectedItemIds !== null && value.expectedItemCount !== null &&
      value.expectedItemIds.length !== value.expectedItemCount) {
    return false
  }

  if (!Array.isArray(value.reviewedItems)) return false
  for (const item of value.reviewedItems) {
    if (!object(item) || !nonEmptyString(item.itemId) ||
        !EVIDENCE_CLASSES.includes(item.evidenceClass) ||
        !PROVENANCE_CLASSES.includes(item.provenance)) {
      return false
    }
  }
  const buckets = deriveBuckets(value.reviewedItems, value.auditMode)
  if (!sortedUniqueStrings(value.reviewedItemIds) ||
      !sortedUniqueStrings(value.declaredReviewedItemIds) ||
      !sortedUniqueStrings(value.weakCandidateItemIds) ||
      !sortedUniqueStrings(value.ambiguousCandidateItemIds) ||
      !sortedUniqueStrings(value.unreviewedItemIds)) {
    return false
  }
  if (JSON.stringify(value.reviewedItemIds) !== JSON.stringify(sortedUnique(buckets.exact))) {
    return false
  }
  if (JSON.stringify(value.declaredReviewedItemIds) !==
      JSON.stringify(sortedUnique(buckets.declaredExact))) {
    return false
  }
  // Weak evidence recorded through reviewedItems must appear among the
  // durable weak candidates (candidates recorded directly may add more).
  const weakSet = new Set(value.weakCandidateItemIds)
  if (sortedUnique(buckets.weakEvidence).some(id => !weakSet.has(id))) return false

  if (!Array.isArray(value.ambiguousCandidates)) return false
  for (const candidate of value.ambiguousCandidates) {
    if (!object(candidate) || !nonEmptyString(candidate.visibleText) ||
        !Array.isArray(candidate.candidateTaskIds) ||
        candidate.candidateTaskIds.length < 2 ||
        !sortedUniqueStrings(candidate.candidateTaskIds)) {
      return false
    }
  }
  const derivedAmbiguousIds = sortedUnique(
    value.ambiguousCandidates.flatMap(candidate => candidate.candidateTaskIds),
  )
  if (JSON.stringify(value.ambiguousCandidateItemIds) !==
      JSON.stringify(derivedAmbiguousIds)) {
    return false
  }

  const reviewedSet = new Set(value.reviewedItemIds)
  const declaredSet = new Set(value.declaredReviewedItemIds)
  if (value.unreviewedItemIds.some(id => reviewedSet.has(id) || declaredSet.has(id))) return false
  if (value.expectedItemIds !== null) {
    const unreviewedSet = new Set(value.unreviewedItemIds)
    for (const id of value.expectedItemIds) {
      if (!reviewedSet.has(id) && !declaredSet.has(id) && !unreviewedSet.has(id)) return false
    }
  }

  if (!Array.isArray(value.unresolvedRows)) return false
  for (const row of value.unresolvedRows) {
    if (!object(row) || !nonEmptyString(row.visibleText) || !nonEmptyString(row.reason)) {
      return false
    }
  }
  if (value.unresolvedRowCount !== value.unresolvedRows.length) return false

  // Evidence basis must match the recorded provenance mix.
  let expectedBasis
  if (value.reviewedItemIds.length === 0 && value.declaredReviewedItemIds.length === 0) {
    expectedBasis = 'none'
  } else if (value.declaredReviewedItemIds.length === 0) {
    expectedBasis = value.auditMode === 'capability' ? 'declared' : 'server-read'
  } else if (value.reviewedItemIds.length === 0) {
    expectedBasis = 'declared'
  } else {
    expectedBasis = 'mixed'
  }
  if (value.auditMode === 'capability' && value.reviewedItems.length > 0) {
    expectedBasis = 'declared'
  }
  if (value.evidenceBasis !== expectedBasis) return false

  // Completeness may only claim what the evidence supports.
  const unaccountedWeak = value.weakCandidateItemIds
    .filter(id => !reviewedSet.has(id) && !declaredSet.has(id))
  const coverageComplete =
    value.unreviewedItemIds.length === 0 &&
    value.unresolvedRows.length === 0 &&
    value.ambiguousCandidates.length === 0 &&
    unaccountedWeak.length === 0

  if (value.completeness === 'full') {
    if (value.representativeSample) return false
    if (value.expectedItemIds === null) return false
    if (!coverageComplete) return false
    if (value.declaredReviewedItemIds.length > 0) return false
    if (value.evidenceBasis !== 'server-read') return false
    if (value.expectedItemIds.some(id => !reviewedSet.has(id))) return false
  }
  if (value.completeness === 'declared_full') {
    if (value.representativeSample) return false
    if (value.expectedItemIds === null) return false
    if (!coverageComplete) return false
    if (value.declaredReviewedItemIds.length === 0 && value.evidenceBasis === 'server-read') {
      return false
    }
  }
  if (value.representativeSample && value.completeness !== 'representative_sample') return false
  if (!value.representativeSample && value.expectedItemIds === null &&
      value.completeness !== 'unknown') {
    return false
  }
  if (!value.representativeSample && value.expectedItemIds !== null &&
      !coverageComplete && value.completeness !== 'partial') {
    return false
  }

  const { receiptDigest, ...body } = value
  try {
    return receiptDigest === canonicalHash(body)
  } catch {
    return false
  }
}

module.exports = {
  CONTRACT_VERSION,
  AUDIT_MODES,
  EVIDENCE_CLASSES,
  EXACT_EVIDENCE_CLASSES,
  WEAK_EVIDENCE_CLASSES,
  PROVENANCE_CLASSES,
  COMPLETENESS_CLASSES,
  EVIDENCE_BASES,
  createAuditCoverage,
  recordReviewedItem,
  recordUnreviewedItem,
  recordWeakCandidate,
  recordAmbiguousCandidate,
  recordUnresolvedRow,
  finalizeAuditCoverageReceipt,
  validAuditCoverageReceipt,
}
