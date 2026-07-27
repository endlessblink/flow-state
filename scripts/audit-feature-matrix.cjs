#!/usr/bin/env node
'use strict'

/**
 * TASK-1977 — Feature-audit matrix auditor.
 *
 * Reads docs/process/feature-audit-matrix.json and:
 *   1. validates structure (every feature has id/action/surfaces/expected/states/status),
 *   2. verifies every `evidence` pointer that looks like a file path actually
 *      EXISTS — so an "audited" claim can never quietly rot into a lie when a
 *      test is renamed or deleted,
 *   3. reports coverage (audited / partial / unaudited) overall and per area,
 *   4. exits non-zero on any structural error or missing evidence file.
 *
 * Run: node scripts/audit-feature-matrix.cjs   (or: npm run audit:features)
 */

const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const MATRIX = path.join(ROOT, 'docs/process/feature-audit-matrix.json')

function fail(msg) {
  console.error(`  ✗ ${msg}`)
  process.exitCode = 1
}

const raw = fs.readFileSync(MATRIX, 'utf8')
let doc
try {
  doc = JSON.parse(raw)
} catch (e) {
  console.error(`feature-audit-matrix.json is not valid JSON: ${e.message}`)
  process.exit(1)
}

const REQUIRED = ['id', 'action', 'surfaces', 'expected', 'states', 'status']
const VALID_STATUS = new Set(['audited', 'partial', 'unaudited'])
const validSurfaces = new Set(doc.surfaces || [])

const ids = new Set()
const counts = { audited: 0, partial: 0, unaudited: 0 }
const perArea = []
let featureCount = 0
let evidenceChecked = 0

// An evidence string is treated as a file path when it starts with tests/ or
// src/ or supabase/ (others are memory/doc references, not file assertions).
const isFilePathEvidence = (e) => /^(tests|src|supabase|scripts)\//.test(e)
const fileEvidencePath = (e) => e.replace(/\s*\(.*\)\s*$/, '').split(' ')[0]

for (const area of doc.areas || []) {
  const areaCounts = { audited: 0, partial: 0, unaudited: 0 }
  for (const f of area.features || []) {
    featureCount += 1
    for (const key of REQUIRED) {
      if (f[key] === undefined) fail(`[${area.area}] feature "${f.id || '?'}" missing "${key}"`)
    }
    if (ids.has(f.id)) fail(`duplicate feature id "${f.id}"`)
    ids.add(f.id)
    if (!VALID_STATUS.has(f.status)) fail(`feature "${f.id}" has invalid status "${f.status}"`)
    else {
      counts[f.status] += 1
      areaCounts[f.status] += 1
    }
    for (const s of f.surfaces || []) {
      if (!validSurfaces.has(s)) fail(`feature "${f.id}" references unknown surface "${s}"`)
    }
    // audited/partial features must carry at least one evidence pointer
    if ((f.status === 'audited' || f.status === 'partial') && (!f.evidence || f.evidence.length === 0)) {
      fail(`feature "${f.id}" is "${f.status}" but has no evidence`)
    }
    for (const e of f.evidence || []) {
      if (!isFilePathEvidence(e)) continue
      evidenceChecked += 1
      const p = path.join(ROOT, fileEvidencePath(e))
      if (!fs.existsSync(p)) fail(`feature "${f.id}" cites missing evidence file: ${fileEvidencePath(e)}`)
    }
  }
  perArea.push({ area: area.area, ...areaCounts, total: (area.features || []).length })
}

console.log('FlowState feature-audit matrix\n')
console.log(`Features: ${featureCount}  |  file-evidence pointers verified: ${evidenceChecked}`)
console.log(`  audited:   ${counts.audited}`)
console.log(`  partial:   ${counts.partial}`)
console.log(`  unaudited: ${counts.unaudited}\n`)
console.log('By area:')
for (const a of perArea) {
  console.log(`  ${a.area.padEnd(34)} ${a.audited}✓ ${a.partial}~ ${a.unaudited}· (${a.total})`)
}

if (process.exitCode === 1) {
  console.error('\nMatrix audit FAILED — fix the errors above.')
} else {
  console.log('\nMatrix audit passed: structure valid, every cited test file exists.')
}
