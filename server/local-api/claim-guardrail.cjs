'use strict'

/**
 * Broad-claim guardrail (TASK-1959).
 *
 * Classifies what a review summary is allowed to claim, based only on a valid
 * audit coverage receipt, and blocks wording that is stronger than the
 * evidence. Enforcement is semantic and receipt-backed, not a wording
 * blacklist:
 *
 * 1. Universal-completeness language (any universal quantifier or
 *    negated-omission construction applied to the audit domain) is blocked
 *    unless the receipt proves server-verified full coverage.
 * 2. Every non-verified summary MUST carry an explicit coverage disclosure
 *    (default-deny): wording that fails to disclose partial/declared/unknown
 *    coverage is rejected even if it invents phrasing no denylist predicted.
 * 3. Live-verification wording requires server-owned live proof. A caller
 *    flag ("liveVerified") is a declaration, never proof, and can never
 *    produce live-verified wording.
 *
 * Claim levels:
 * - verified  — receipt proves server-read full coverage.
 * - declared  — coverage complete only per caller declaration (declared_full).
 * - partial   — receipt proves partial or sampled coverage.
 * - inferred  — capability-class audit; never item-exact.
 * - blocked   — active blockers; nothing stronger may be claimed.
 * - unknown   — no valid receipt or unknown completeness.
 */

const { validAuditCoverageReceipt } = require('./audit-coverage.cjs')

const CLAIM_LEVELS = ['verified', 'declared', 'partial', 'inferred', 'blocked', 'unknown']

// --- Semantic broad-claim model ------------------------------------------

// Universal quantifiers and totality adverbs.
const UNIVERSAL_QUANTIFIER = new RegExp(
  String.raw`\b(?:all|every|each|entire|whole|everything|full|fully|complete|completely|` +
  String.raw`exhaustive(?:ly)?|comprehensive(?:ly)?|100\s*%|end[-\s]to[-\s]end)\b`,
  'i',
)

// Nouns of the audit domain that a universal quantifier can range over.
const AUDIT_DOMAIN_NOUN = new RegExp(
  String.raw`\b(?:tasks?|items?|records?|rows?|backlogs?|boards?|lists?|` +
  String.raw`scopes?|audits?|coverage|inventor(?:y|ies)|entries|cards?)\b`,
  'i',
)

// "Nothing was missed" constructions: a negation plus an omission verb.
const NEGATION = new RegExp(
  String.raw`\b(?:no|none|nothing|not\s+a\s+single|never|without|zero|didn'?t|wasn'?t)\b`,
  'i',
)
const OMISSION_VERB = new RegExp(
  String.raw`\b(?:miss(?:ed|ing)?|skip(?:ped)?|omit(?:ted)?|overlook(?:ed)?|` +
  String.raw`left\s+(?:out|behind|over)|unreviewed|unchecked)\b`,
  'i',
)

// A coverage disclosure that non-verified summaries must carry. This is the
// default-deny half of the guard: novel broad wording without an explicit
// disclosure is rejected without needing to be predicted by a pattern.
const COVERAGE_DISCLOSURES = [
  'not completed',
  'not been completed',
  'not verified',
  'not server-verified',
  'partial',
  'sample',
  'unknown',
  'blocked',
  'declared coverage',
  'capability-based',
  'could not be',
  'incomplete',
]

// Wording that asserts live/production verification.
const LIVE_CLAIM_PATTERNS = [
  /live[- ]verified/i,
  /verified\s+live\b/i,
  /verified\s+in\s+production/i,
  /live\s+(?:workflow|connector|sync|boundary)\s+(?:was\s+|is\s+|has\s+been\s+)?verified/i,
  /confirmed\s+(?:live|in\s+production)/i,
  /works?\s+in\s+production/i,
]

function splitSentences(text) {
  return String(text ?? '')
    .split(/(?<=[.!?;])\s+|\n+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length > 0)
}

/**
 * Find universal-completeness claims: per sentence, a universal quantifier
 * ranging over the audit domain, or a negated-omission construction.
 */
function findBroadClaimViolations(text) {
  const matches = []
  for (const sentence of splitSentences(text)) {
    const quantifier = sentence.match(UNIVERSAL_QUANTIFIER)
    if (quantifier && AUDIT_DOMAIN_NOUN.test(sentence)) {
      matches.push(sentence)
      continue
    }
    if (quantifier && /\beverything\b|100\s*%/i.test(sentence)) {
      matches.push(sentence)
      continue
    }
    if (NEGATION.test(sentence) && OMISSION_VERB.test(sentence)) {
      matches.push(sentence)
    }
  }
  return matches
}

function hasCoverageDisclosure(text) {
  const source = String(text ?? '').toLowerCase()
  return COVERAGE_DISCLOSURES.some(phrase => source.includes(phrase))
}

function normalizeLiveVerification(options = {}) {
  const raw = options.liveVerification
  if (raw && typeof raw === 'object') {
    return {
      declared: raw.declared === true,
      serverVerified: raw.serverVerified === true,
    }
  }
  // Legacy boolean input is a caller declaration, never server proof.
  return { declared: options.liveVerified === true, serverVerified: false }
}

function classifyClaimLevel({ receipt, blockers = [] } = {}) {
  if (!validAuditCoverageReceipt(receipt)) return 'unknown'
  if (Array.isArray(blockers) && blockers.length > 0) return 'blocked'
  if (receipt.auditMode === 'capability') return 'inferred'
  if (receipt.completeness === 'full') return 'verified'
  if (receipt.completeness === 'declared_full') return 'declared'
  if (receipt.completeness === 'partial' || receipt.completeness === 'representative_sample') {
    return 'partial'
  }
  return 'unknown'
}

/**
 * Check summary wording against the evidence. Returns { ok, level,
 * violations } where each violation is { code, detail }.
 */
function guardSummaryWording(text, options = {}) {
  const { receipt, blockers = [] } = options
  const source = String(text ?? '')
  const level = classifyClaimLevel({ receipt, blockers })
  const live = normalizeLiveVerification(options)
  const violations = []

  if (level !== 'verified') {
    for (const match of findBroadClaimViolations(source)) {
      violations.push({
        code: 'broad-claim',
        detail: `"${match}" claims universal completeness; the receipt only supports level ${level}`,
      })
    }
    if (!hasCoverageDisclosure(source)) {
      violations.push({
        code: 'missing-coverage-disclosure',
        detail:
          `evidence level is ${level}; the summary must explicitly disclose ` +
          'incomplete/declared/unknown coverage (for example: "exact task ' +
          'coverage was not completed")',
      })
    }
  }

  if (validAuditCoverageReceipt(receipt) && receipt.auditMode === 'capability' &&
      !/capabilit/i.test(source)) {
    violations.push({
      code: 'capability-not-disclosed',
      detail: 'capability-based audits must say the review was capability-based, not item-by-item',
    })
  }

  if (validAuditCoverageReceipt(receipt) && receipt.completeness === 'declared_full' &&
      !/(declared|not\s+(?:server-)?verified)/i.test(source)) {
    violations.push({
      code: 'declared-not-disclosed',
      detail: 'declared coverage must be labeled as declared, never as verified coverage',
    })
  }

  for (const blocker of Array.isArray(blockers) ? blockers : []) {
    if (typeof blocker === 'string' && blocker.length > 0 &&
        !source.toLowerCase().includes(blocker.toLowerCase())) {
      violations.push({
        code: 'blocker-omitted',
        detail: `active blocker missing from summary: ${blocker}`,
      })
    }
  }

  if (!live.serverVerified) {
    for (const pattern of LIVE_CLAIM_PATTERNS) {
      const match = source.match(pattern)
      if (match) {
        violations.push({
          code: 'implies-live-verification',
          detail: `"${match[0]}" implies live verification, but live verification has no ` +
            'server-owned proof' + (live.declared ? ' (caller declaration is not proof)' : ''),
        })
      }
    }
  }

  return { ok: violations.length === 0, level, violations }
}

/** Screenshot review level derivable from a coverage receipt, or null. */
function screenshotReviewLevel(receipt) {
  const exactRows = receipt.reviewedItems
    .filter(item => item.evidenceClass === 'screenshot-row-reconciled').length
  const unproven = receipt.unresolvedRowCount +
    receipt.weakCandidateItemIds.length + receipt.ambiguousCandidates.length
  if (exactRows === 0 && unproven === 0) return null
  if (exactRows > 0 && unproven > 0) return 'mixed'
  return exactRows > 0 ? 'exact-task-level' : 'screenshot-level'
}

/**
 * Compose the strongest wording the evidence justifies. The output always
 * passes guardSummaryWording with the same receipt and options.
 */
function composeAuditSummary(receipt, options = {}) {
  const { blockers = [], notCovered = [] } = options
  const live = normalizeLiveVerification(options)
  const level = classifyClaimLevel({ receipt, blockers })
  const parts = []

  if (level === 'unknown' && !validAuditCoverageReceipt(receipt)) {
    parts.push('No valid audit coverage receipt exists; nothing can be claimed as reviewed. ' +
      'Coverage is unknown.')
    return { level, text: parts.join(' ') }
  }

  if (blockers.length > 0) {
    parts.push(`BLOCKED: ${blockers.join('; ')}. Live verification was not performed.`)
  }

  const reviewedCount = receipt.reviewedItemIds.length
  const declaredCount = receipt.declaredReviewedItemIds.length
  const expectedCount = receipt.expectedItemIds === null
    ? receipt.expectedItemCount
    : receipt.expectedItemIds.length
  const scopeLabel = `scope "${receipt.auditScope}" via ${receipt.sourceSurface}`

  if (receipt.auditMode === 'capability') {
    parts.push(
      `Capability-class audit of ${scopeLabel}: ${reviewedCount} of ` +
      `${expectedCount ?? 'an unknown number of'} declared capability classes examined. ` +
      'This was a capability-based review, not an item-by-item task review; ' +
      'exact task coverage was not completed.',
    )
  } else if (receipt.completeness === 'full' && level === 'verified') {
    parts.push(
      `Reviewed all ${expectedCount} expected items in ${scopeLabel}; ` +
      'full coverage proven by server-read records and the receipt below.',
    )
  } else if (receipt.completeness === 'declared_full') {
    parts.push(
      `Declared coverage of ${expectedCount} expected items in ${scopeLabel}: the caller ` +
      `declared ${reviewedCount + declaredCount} items reviewed, but ` +
      `${declaredCount > 0 ? `${declaredCount} of them were` : 'the item identities were'} ` +
      'not server-verified. This is declared coverage, not verified coverage.',
    )
  } else if (receipt.completeness === 'representative_sample') {
    parts.push(
      `Reviewed a representative sample (${reviewedCount} items) of ${scopeLabel}; ` +
      'this is a sample, so exact task coverage was not completed for the wider scope.',
    )
  } else if (receipt.completeness === 'unknown') {
    parts.push(
      `Reviewed ${reviewedCount} items in ${scopeLabel}; the expected item universe is ` +
      'unknown, so coverage completeness is unknown and exact task coverage was not completed.',
    )
  } else {
    parts.push(
      `Reviewed ${reviewedCount} of ${expectedCount ?? 'an unknown number of'} expected ` +
      `items in ${scopeLabel}. Exact task coverage was not completed.`,
    )
    if (declaredCount > 0) {
      parts.push(
        `Declared-only reviewed IDs (not server-verified): ` +
        `${receipt.declaredReviewedItemIds.join(', ')}.`,
      )
    }
    if (receipt.unreviewedItemIds.length > 0) {
      parts.push(`Unreviewed item IDs: ${receipt.unreviewedItemIds.join(', ')}.`)
    }
  }

  if (receipt.weakCandidateItemIds.length > 0) {
    parts.push(
      `Title-only candidate IDs (identity unproven, not counted as reviewed): ` +
      `${receipt.weakCandidateItemIds.join(', ')}.`,
    )
  }
  if (receipt.ambiguousCandidates.length > 0) {
    const details = receipt.ambiguousCandidates
      .map(candidate => `"${candidate.visibleText}" -> ${candidate.candidateTaskIds.join(', ')}`)
      .join('; ')
    parts.push(`Ambiguous title candidates (identity unresolved): ${details}.`)
  }
  if (receipt.unresolvedRowCount > 0) {
    parts.push(
      `Unresolved visible rows lacking exact task identity: ${receipt.unresolvedRowCount} ` +
      '(never counted as reviewed).',
    )
  }
  const rowLevel = screenshotReviewLevel(receipt)
  if (rowLevel) {
    parts.push(`Screenshot review level: ${rowLevel}.`)
  }

  if (live.serverVerified) {
    parts.push('Live workflow verified.')
  } else if (live.declared) {
    parts.push('Live verification was declared by the caller but is not server-verified.')
  } else {
    parts.push('Local evidence only; the live workflow is not verified.')
  }

  if (notCovered.length > 0) {
    parts.push(`Not covered: ${notCovered.join('; ')}.`)
  }

  parts.push(`Coverage receipt: ${receipt.contractVersion} ${receipt.receiptDigest}.`)

  return { level, text: parts.join(' ') }
}

module.exports = {
  CLAIM_LEVELS,
  LIVE_CLAIM_PATTERNS,
  findBroadClaimViolations,
  classifyClaimLevel,
  guardSummaryWording,
  composeAuditSummary,
  screenshotReviewLevel,
}
