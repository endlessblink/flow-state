#!/usr/bin/env node

const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')

const matrixPath = resolve(process.cwd(), 'docs/process/task-consistency-failure-matrix.json')
const matrix = JSON.parse(readFileSync(matrixPath, 'utf8'))
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
const duplicateVectorIds = [...new Set(vectorIds.filter((id, index) => vectorIds.indexOf(id) !== index))]
const structuralErrors = [
  ...duplicateVectorIds.map(id => `duplicate vector id: ${id}`),
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
