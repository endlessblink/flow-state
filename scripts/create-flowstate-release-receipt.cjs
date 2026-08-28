#!/usr/bin/env node
'use strict'

const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { buildTruthLedger, parseUpdaterManifest } = require('./flowstate-truth-ledger.cjs')

function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function walk(root, prefix = '') {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(prefix, entry.name)
    const absolute = path.join(root, entry.name)
    return entry.isDirectory() ? walk(absolute, relative) : [relative]
  })
}

async function main() {
  const root = path.resolve(process.argv[2] || path.join(__dirname, '..'))
  const output = path.resolve(process.argv[3] || path.join(root, 'release', 'flowstate-release-receipt.json'))
  const ledger = await buildTruthLedger({ root, mode: 'non-live' })
  const manifestPath = path.join(root, 'release', 'latest-linux.yml')
  const manifest = parseUpdaterManifest(fs.readFileSync(manifestPath, 'utf8'))
  if (!/^[0-9a-f]{40}$/.test(ledger.source.commit || '')) throw new Error('receipt source commit is not immutable')
  if (ledger.source.dirty !== false) throw new Error('refusing to create a release receipt from dirty source')
  if (!manifest.version || manifest.version !== ledger.build.packageVersion) throw new Error('receipt version does not match package and manifest')
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) throw new Error('receipt has no manifest artifacts')
  if (!fs.existsSync(path.join(root, 'dist'))) throw new Error('receipt web build is missing')
  const artifacts = manifest.artifacts.map(({ name, size }) => {
    const file = path.join(root, 'release', name)
    const stat = fs.statSync(file)
    if (stat.size !== size) throw new Error(`manifest size mismatch: ${name}`)
    return { name, sha256: sha256File(file), size: stat.size }
  })
  const webFiles = walk(path.join(root, 'dist')).sort()
  if (webFiles.length === 0) throw new Error('receipt web build is empty')
  const webHash = createHash('sha256')
  for (const relative of webFiles) {
    const file = path.join(root, 'dist', relative)
    webHash.update(relative).update('\0').update(fs.readFileSync(file)).update('\0')
  }
  const receipt = {
    schemaVersion: 'flowstate-release-receipt-v1',
    version: manifest.version,
    source: ledger.source,
    artifacts,
    web: { fileCount: webFiles.length, sha256: webHash.digest('hex') },
    contractSet: ledger.build.contractSet,
  }
  fs.mkdirSync(path.dirname(output), { recursive: true })
  const temporary = `${output}.${process.pid}.tmp`
  fs.writeFileSync(temporary, `${JSON.stringify(receipt, null, 2)}\n`)
  fs.renameSync(temporary, output)
}

main().catch((error) => {
  console.error(`[flowstate-release-receipt] ${error.message}`)
  process.exitCode = 1
})
