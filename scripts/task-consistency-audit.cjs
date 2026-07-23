#!/usr/bin/env node

const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')

const matrixPath = resolve(process.cwd(), 'docs/process/task-consistency-failure-matrix.json')
const matrix = JSON.parse(readFileSync(matrixPath, 'utf8'))
const openVectors = matrix.vectors.filter(vector => vector.status === 'open')
const report = {
  schemaVersion: matrix.schemaVersion,
  generatedAt: new Date().toISOString(),
  totalVectors: matrix.vectors.length,
  openCritical: openVectors.filter(vector => vector.severity === 'critical').length,
  openHigh: openVectors.filter(vector => vector.severity === 'high').length,
  liveProven: matrix.vectors.filter(vector => vector.status === 'live-proven').length,
  automatedOnly: matrix.vectors.filter(vector => vector.status === 'automated').length,
  vectors: matrix.vectors
}

if (process.argv.includes('--json')) {
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
