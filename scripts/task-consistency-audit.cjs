#!/usr/bin/env node

const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')

const matrixPath = resolve(process.cwd(), 'docs/process/task-consistency-failure-matrix.json')
const matrix = JSON.parse(readFileSync(matrixPath, 'utf8'))
const masterPlan = readFileSync(resolve(process.cwd(), 'docs/MASTER_PLAN.md'), 'utf8')
const openVectors = matrix.vectors.filter(vector => vector.status === 'open')

const dimensionDefinitions = {
  mutations: 'requiredMutations',
  states: 'requiredStates',
  surfaces: 'requiredSurfaces',
  layers: 'requiredLayers',
  failureClasses: 'requiredFailureClasses',
}

const dimensionCoverage = Object.fromEntries(
  Object.entries(dimensionDefinitions).map(([vectorField, requiredField]) => {
    const required = matrix[requiredField] || []
    const coveredValues = new Set(matrix.vectors.flatMap(vector => vector[vectorField] || []))
    const missing = required.filter(value => !coveredValues.has(value))
    return [vectorField, {
      required: required.length,
      covered: required.length - missing.length,
      missing,
    }]
  })
)

dimensionCoverage.dataGuarantees = {
  required: matrix.requiredDataGuarantees?.length || 0,
  covered: matrix.requiredDataGuarantees?.length || 0,
  missing: [],
}

const vectorIds = matrix.vectors.map(vector => vector.id)
const vectorIdSet = new Set(vectorIds)
const vectorsById = new Map(matrix.vectors.map(vector => [vector.id, vector]))
const duplicateVectorIds = [...new Set(vectorIds.filter((id, index) => vectorIds.indexOf(id) !== index))]
const hasRequiredIssueSignals = Array.isArray(matrix.requiredIssueSignals)
const hasRequiredIssueMappings = (
  matrix.requiredIssueMappings
  && typeof matrix.requiredIssueMappings === 'object'
  && !Array.isArray(matrix.requiredIssueMappings)
)
const requiredIssueSignals = hasRequiredIssueSignals ? matrix.requiredIssueSignals : []
const requiredIssueMappings = hasRequiredIssueMappings ? matrix.requiredIssueMappings : {}
const mappingIssueSignals = Object.keys(requiredIssueMappings)
const programStart = masterPlan.indexOf('### TASK-1943:')
const programEnd = masterPlan.indexOf('\n### ', programStart + 1)
const openProgramSignals = [...masterPlan.slice(programStart, programEnd).matchAll(
  /^- \[ \] \*\*((?:BUG|TASK)-\d+)/gm
)].map(match => match[1])
const unrequiredProgramSignals = openProgramSignals.filter(
  issueSignal => !requiredIssueSignals.includes(issueSignal)
)
const missingIssueSignals = requiredIssueSignals.filter(issueSignal => {
  const mappedVectorIds = requiredIssueMappings[issueSignal]
  return !Array.isArray(mappedVectorIds)
    || mappedVectorIds.length === 0
    || mappedVectorIds.some(vectorId => !vectorIdSet.has(vectorId))
})
const evidenceBackedIssueSignals = requiredIssueSignals.filter(issueSignal => {
  const mappedVectorIds = requiredIssueMappings[issueSignal] || []
  return mappedVectorIds.length > 0 && mappedVectorIds.every(vectorId => {
    const vector = vectorsById.get(vectorId)
    return vector && (vector.automatedEvidence.length > 0 || vector.liveEvidence.length > 0)
  })
})
const liveProvenIssueSignals = requiredIssueSignals.filter(issueSignal => {
  const mappedVectorIds = requiredIssueMappings[issueSignal] || []
  return mappedVectorIds.length > 0 && mappedVectorIds.every(
    vectorId => vectorsById.get(vectorId)?.status === 'live-proven'
  )
})
const issueCoverage = {
  required: requiredIssueSignals.length,
  tracked: requiredIssueSignals.length - missingIssueSignals.length,
  evidenceBacked: evidenceBackedIssueSignals.length,
  liveProven: liveProvenIssueSignals.length,
  missingTracking: missingIssueSignals,
  unproven: requiredIssueSignals.filter(issueSignal => !liveProvenIssueSignals.includes(issueSignal)),
}
const structuralErrors = [
  ...(matrix.schemaVersion === 'flowstate-task-consistency-matrix-v3' && !hasRequiredIssueSignals
    ? ['v3 matrix is missing requiredIssueSignals']
    : []),
  ...(matrix.schemaVersion === 'flowstate-task-consistency-matrix-v3' && !hasRequiredIssueMappings
    ? ['v3 matrix is missing requiredIssueMappings']
    : []),
  ...requiredIssueSignals
    .filter((issueSignal, index) => requiredIssueSignals.indexOf(issueSignal) !== index)
    .map(issueSignal => `duplicate required issue: ${issueSignal}`),
  ...mappingIssueSignals
    .filter(issueSignal => !requiredIssueSignals.includes(issueSignal))
    .map(issueSignal => `mapping exists for non-required issue: ${issueSignal}`),
  ...duplicateVectorIds.map(id => `duplicate vector id: ${id}`),
  ...unrequiredProgramSignals.map(issueSignal => `open trust-program issue is not required: ${issueSignal}`),
  ...missingIssueSignals.map(issueSignal => `unlinked required issue: ${issueSignal}`),
  ...Object.entries(dimensionCoverage).flatMap(([dimension, coverage]) =>
    coverage.missing.map(value => `uncovered ${dimension}: ${value}`)
  ),
  ...matrix.vectors.flatMap(vector => {
    const errors = []
    if (!['critical', 'high', 'medium', 'low'].includes(vector.severity)) {
      errors.push(`invalid severity for ${vector.id}`)
    }
    if (!['open', 'automated', 'live-proven'].includes(vector.status)) {
      errors.push(`invalid status for ${vector.id}`)
    }
    if (!Array.isArray(vector.automatedEvidence) || !Array.isArray(vector.liveEvidence)) {
      errors.push(`missing evidence arrays for ${vector.id}`)
    }
    if (vector.status === 'automated' && vector.automatedEvidence.length === 0) {
      errors.push(`automated vector has no automated evidence: ${vector.id}`)
    }
    if (vector.status === 'live-proven' && vector.liveEvidence.length === 0) {
      errors.push(`live-proven vector has no live evidence: ${vector.id}`)
    }
    return errors
  }),
]

const report = {
  schemaVersion: matrix.schemaVersion,
  generatedAt: new Date().toISOString(),
  totalVectors: matrix.vectors.length,
  openCritical: openVectors.filter(vector => vector.severity === 'critical').length,
  openHigh: openVectors.filter(vector => vector.severity === 'high').length,
  liveProven: matrix.vectors.filter(vector => vector.status === 'live-proven').length,
  automatedOnly: matrix.vectors.filter(vector => vector.status === 'automated').length,
  structuralErrors,
  dimensionCoverage,
  issueCoverage,
  vectors: matrix.vectors
}

if (process.argv.includes('--summary-json')) {
  const { vectors, ...summary } = report
  process.stdout.write(`${JSON.stringify({
    ...summary,
    vectors: vectors.map(({ id, severity, status }) => ({ id, severity, status })),
  }, null, 2)}\n`)
} else if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
} else {
  process.stdout.write(
    `Open critical/high vectors: ${report.openCritical + report.openHigh} `
    + `(${report.openCritical} critical, ${report.openHigh} high); `
    + `${report.automatedOnly} automated-only; ${report.liveProven} live-proven.\n`
  )
  for (const vector of openVectors) {
    process.stdout.write(`- [${vector.severity.toUpperCase()}] ${vector.id}\n`)
  }
}

if (process.argv.includes('--fail-on-open') && openVectors.length > 0) {
  process.exitCode = 1
}
if (structuralErrors.length > 0) {
  process.exitCode = 1
}
