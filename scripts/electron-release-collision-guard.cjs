#!/usr/bin/env node
'use strict'

const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

function unquote(value) {
  const trimmed = value.trim()
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function parseElectronManifest(manifest) {
  const versionMatch = manifest.match(/^version:\s*(.+?)\s*$/m)
  if (!versionMatch) throw new Error('Manifest is missing version')
  const pathMatch = manifest.match(/^path:\s*(.+?)\s*$/m)
  if (!pathMatch) throw new Error('Manifest is missing top-level path')
  const primaryShaMatch = manifest.match(/^sha512:\s*(.+?)\s*$/m)
  if (!primaryShaMatch) throw new Error('Manifest is missing top-level sha512')

  const files = []
  let inFiles = false
  let current = null
  const finishCurrent = () => {
    if (!current) return
    if (!current.url || !current.sha512 || !Number.isSafeInteger(current.size)) {
      throw new Error(`Manifest has an incomplete file entry: ${current.url || '(missing url)'}`)
    }
    files.push(current)
    current = null
  }

  for (const line of manifest.split(/\r?\n/)) {
    if (/^files:\s*$/.test(line)) {
      inFiles = true
      continue
    }
    if (!inFiles) continue
    if (/^[^\s]/.test(line)) {
      finishCurrent()
      break
    }

    const urlMatch = line.match(/^\s{2}-\s+url:\s*(.+?)\s*$/)
    if (urlMatch) {
      finishCurrent()
      current = { url: unquote(urlMatch[1]), sha512: '', size: NaN }
      continue
    }
    if (!current) continue

    const shaMatch = line.match(/^\s+sha512:\s*(.+?)\s*$/)
    if (shaMatch) current.sha512 = unquote(shaMatch[1])
    const sizeMatch = line.match(/^\s+size:\s*(\d+)\s*$/)
    if (sizeMatch) current.size = Number(sizeMatch[1])
  }
  finishCurrent()

  if (files.length === 0) throw new Error('Manifest has no files')
  const urls = new Set()
  for (const file of files) {
    if (urls.has(file.url)) throw new Error(`Manifest repeats artifact: ${file.url}`)
    urls.add(file.url)
  }

  return {
    version: unquote(versionMatch[1]),
    files,
    primaryPath: unquote(pathMatch[1]),
    primarySha512: unquote(primaryShaMatch[1]),
  }
}

function compareVersions(left, right) {
  const leftParts = left.split('.').map(Number)
  const rightParts = right.split('.').map(Number)
  if (leftParts.some(Number.isNaN) || rightParts.some(Number.isNaN)) {
    throw new Error(`Invalid release version: ${left} or ${right}`)
  }
  const length = Math.max(leftParts.length, rightParts.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0)
    if (difference !== 0) return Math.sign(difference)
  }
  return 0
}

function artifactSignature(manifest) {
  const fileSignature = manifest.files
    .map(({ url, sha512, size }) => `${url}\0${sha512}\0${size}`)
    .sort()
    .join('\n')
  return `${manifest.primaryPath}\0${manifest.primarySha512}\n${fileSignature}`
}

function assertSafeElectronRelease(localManifest, remoteManifest) {
  const local = parseElectronManifest(localManifest)
  const remote = parseElectronManifest(remoteManifest)
  const versionOrder = compareVersions(local.version, remote.version)

  if (versionOrder < 0) {
    throw new Error(`Refusing Electron updater downgrade: local ${local.version}, remote ${remote.version}`)
  }
  if (versionOrder > 0) {
    const remoteFiles = new Map(remote.files.map((file) => [file.url, file]))
    for (const localFile of local.files) {
      const published = remoteFiles.get(localFile.url)
      if (published && (published.sha512 !== localFile.sha512 || published.size !== localFile.size)) {
        throw new Error(`Higher version reuses published artifact filename with different bytes: ${localFile.url}`)
      }
    }
    return { status: 'new-version' }
  }

  if (artifactSignature(local) !== artifactSignature(remote)) {
    throw new Error(
      `Refusing same version with different artifact: ${local.version}. Bump package.json before deploying.`
    )
  }
  return { status: 'idempotent' }
}

function validateManifestArtifacts(localManifest, artifactsDir) {
  const parsed = parseElectronManifest(localManifest)
  const { files } = parsed
  for (const file of files) {
    if (file.url !== path.basename(file.url) || file.url === '.' || file.url === '..' || /[\\/\0]/.test(file.url)) {
      throw new Error(`Unsafe artifact path in manifest: ${file.url}`)
    }

    const artifactPath = path.join(artifactsDir, file.url)
    let stat
    try {
      stat = fs.statSync(artifactPath)
    } catch {
      throw new Error(`Manifest artifact is missing: ${file.url}`)
    }
    if (!stat.isFile()) throw new Error(`Manifest artifact is not a file: ${file.url}`)
    if (stat.size !== file.size) {
      throw new Error(`Artifact size mismatch for ${file.url}: manifest ${file.size}, actual ${stat.size}`)
    }

    const actualSha = createHash('sha512').update(fs.readFileSync(artifactPath)).digest('base64')
    if (actualSha !== file.sha512) throw new Error(`Artifact SHA-512 mismatch for ${file.url}`)
  }

  if (parsed.primaryPath !== path.basename(parsed.primaryPath) || /[\\/\0]/.test(parsed.primaryPath)) {
    throw new Error(`Unsafe top-level artifact path in manifest: ${parsed.primaryPath}`)
  }
  const primary = files.find(({ url }) => url === parsed.primaryPath)
  if (!primary) throw new Error(`Top-level path does not reference a manifest artifact: ${parsed.primaryPath}`)
  if (primary.sha512 !== parsed.primarySha512) {
    throw new Error(`Top-level SHA-512 does not match ${parsed.primaryPath}`)
  }
  return files.map(({ url }) => url)
}

function option(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

if (require.main === module) {
  const localPath = option('--local')
  const artifactsDir = option('--artifacts-dir')
  const remotePath = option('--remote')
  const expectedVersion = option('--expected-version')
  const printFiles = process.argv.includes('--print-files')

  if (!localPath || !artifactsDir) {
    console.error('Usage: electron-release-collision-guard.cjs --local <latest-linux.yml> --artifacts-dir <dir> [--remote <latest-linux.yml>] [--expected-version <version>] [--print-files]')
    process.exit(2)
  }

  try {
    const localManifest = fs.readFileSync(localPath, 'utf8')
    const local = parseElectronManifest(localManifest)
    if (expectedVersion && local.version !== expectedVersion) {
      throw new Error(`Manifest version ${local.version} does not match package version ${expectedVersion}`)
    }
    const files = validateManifestArtifacts(localManifest, artifactsDir)

    let status = 'validated'
    if (remotePath && fs.existsSync(remotePath)) {
      const remoteManifest = fs.readFileSync(remotePath, 'utf8')
      status = assertSafeElectronRelease(localManifest, remoteManifest).status
    } else if (remotePath) {
      status = 'first-release'
    }

    if (printFiles) {
      console.error(`[electron-release] ${status}`)
      process.stdout.write(`${files.join('\n')}\n`)
    } else {
      console.log(`[electron-release] ${status}`)
    }
  } catch (error) {
    console.error(`[electron-release] ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

module.exports = { assertSafeElectronRelease, parseElectronManifest, validateManifestArtifacts }
