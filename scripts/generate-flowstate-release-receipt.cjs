#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const args = process.argv.slice(2)
const value = (name) => {
  const index = args.indexOf(name)
  if (index < 0 || !args[index + 1]) throw new Error(`missing ${name}`)
  return args[index + 1]
}

const version = value('--version')
const sourceCommit = value('--source-commit')
const pwaDir = value('--pwa-dir')
const electronDir = value('--electron-dir')
const output = value('--output')
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const files = (root) => {
  const result = []
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) visit(full)
      else if (entry.isFile()) result.push([path.relative(root, full).split(path.sep).join('/'), full])
    }
  }
  visit(root)
  return result
}

const treeDigest = (root) => {
  const hash = crypto.createHash('sha256')
  const entries = files(root)
  for (const [name, file] of entries) hash.update(`${name}\0${sha256(file)}\n`)
  return { fileCount: entries.length, sha256: hash.digest('hex') }
}

const manifestPath = path.join(electronDir, 'latest-linux.yml')
const manifest = fs.readFileSync(manifestPath, 'utf8')
const manifestVersion = manifest.match(/^version:\s*(\S+)$/m)?.[1]
if (manifestVersion !== version) throw new Error(`manifest/version mismatch: ${manifestVersion}/${version}`)
const artifactNames = [...manifest.matchAll(/^\s+- url:\s*(\S+)$/gm)].map((match) => match[1])
if (artifactNames.length === 0) throw new Error('manifest contains no artifacts')
const artifacts = artifactNames.map((name) => {
  if (!/^[A-Za-z0-9._-]+$/.test(name)) throw new Error(`unsafe artifact name: ${name}`)
  const file = path.join(electronDir, name)
  const stat = fs.statSync(file)
  return { name, sha256: sha256(file), size: stat.size }
})

const receipt = {
  schemaVersion: 'flowstate-release-receipt-v1',
  version,
  source: { commit: sourceCommit, dirty: false },
  artifacts,
  web: treeDigest(pwaDir),
  contractSet: [
    'canonical-task/task-v1',
    'electron-updater/latest-linux-v1',
    'local-task-api/v1',
    'local-task-api/flowstate-hermes-capabilities-v1',
    'notion-activation/notion-activation-v1',
    'truth-ledger/flowstate-truth-ledger-v1',
  ],
}
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, `${JSON.stringify(receipt)}\n`)
console.log(`generated release receipt for ${version}`)
