#!/usr/bin/env node

'use strict'

const { createHash } = require('node:crypto')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const SCHEMA_VERSION = 'flowstate-truth-ledger-v1'
const DEFAULT_PUBLIC_MANIFEST = 'https://in-theflow.com/updates/electron/latest-linux.yml'
const DEFAULT_SIDECAR_PROVENANCE = 'http://127.0.0.1:5577/api/provenance'
const CONTRACT_SET = Object.freeze([
  'canonical-task/task-v1',
  'electron-updater/latest-linux-v1',
  'local-task-api/v1',
  'local-task-api/flowstate-hermes-capabilities-v1',
  'notion-activation/notion-activation-v1',
  'truth-ledger/flowstate-truth-ledger-v1',
])

function sha256File(filePath) {
  const hash = createHash('sha256')
  const fd = fs.openSync(filePath, 'r')
  const buffer = Buffer.allocUnsafe(1024 * 1024)
  try {
    let bytesRead = 0
    do {
      bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null)
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead))
    } while (bytesRead > 0)
  } finally {
    fs.closeSync(fd)
  }
  return hash.digest('hex')
}

function parseUpdaterManifest(source) {
  const version = source.match(/^version:\s*([^\s]+)\s*$/m)?.[1] || null
  const artifacts = []
  const lines = source.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const url = lines[index].match(/^\s*-\s+url:\s*([^\s]+)\s*$/)?.[1]
    if (!url) continue
    let sha512 = null
    let size = null
    for (let lookahead = index + 1; lookahead < Math.min(lines.length, index + 5); lookahead += 1) {
      if (/^\s*-\s+url:/.test(lines[lookahead])) break
      sha512 ||= lines[lookahead].match(/^\s+sha512:\s*([^\s]+)\s*$/)?.[1] || null
      const rawSize = lines[lookahead].match(/^\s+size:\s*(\d+)\s*$/)?.[1]
      if (rawSize) size = Number(rawSize)
    }
    artifacts.push({ name: path.basename(url), sha512, size })
  }
  return { version, artifacts }
}

function readSource(root) {
  const git = (...args) => execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()
  return {
    commit: git('rev-parse', 'HEAD'),
    // The canonical frontend/main build refreshes these tracked generated
    // outputs before provenance is sealed. They are not source drift.
    dirty: git(
      'status', '--porcelain', '--untracked-files=no', '--', '.',
      ':(exclude)dist-electron/package.json',
      ':(exclude)stats.html',
    ).length > 0,
  }
}

function readBuild(root, builtAt) {
  const packagePath = path.join(root, 'package.json')
  const manifestPath = path.join(root, 'release', 'latest-linux.yml')
  const sidecarPath = path.join(root, 'dist-electron', 'local-api-server.cjs')
  const packageVersion = JSON.parse(fs.readFileSync(packagePath, 'utf8')).version
  const build = {
    packageVersion,
    builtAt,
    contractSet: [...CONTRACT_SET],
    manifest: { status: 'unavailable', error: 'not_found' },
    sidecar: fs.existsSync(sidecarPath)
      ? { status: 'available', sha256: sha256File(sidecarPath), size: fs.statSync(sidecarPath).size }
      : { status: 'unavailable', error: 'not_found' },
  }

  const embeddedLedgerPath = path.join(root, 'dist-electron', 'flowstate-truth-ledger.json')
  if (fs.existsSync(embeddedLedgerPath)) {
    try {
      const embedded = JSON.parse(fs.readFileSync(embeddedLedgerPath, 'utf8'))
      build.packageProvenance = {
        status: 'available',
        sha256: sha256File(embeddedLedgerPath),
        commit: /^[0-9a-f]{40}$/.test(embedded?.source?.commit || '') ? embedded.source.commit : null,
        dirty: embedded?.source?.dirty === true,
        builtAt: typeof embedded?.build?.builtAt === 'string' ? embedded.build.builtAt : null,
        contractSet: Array.isArray(embedded?.build?.contractSet) ? embedded.build.contractSet : [],
      }
    } catch {
      build.packageProvenance = { status: 'invalid', error: 'invalid_json' }
    }
  }

  if (!fs.existsSync(manifestPath)) return build
  const parsed = parseUpdaterManifest(fs.readFileSync(manifestPath, 'utf8'))
  build.manifest = {
    status: parsed.version ? 'available' : 'invalid',
    version: parsed.version,
    artifacts: parsed.artifacts.map((artifact) => {
      const artifactPath = path.join(root, 'release', artifact.name)
      if (!fs.existsSync(artifactPath)) return { ...artifact, localStatus: 'missing' }
      const stat = fs.statSync(artifactPath)
      const localSha512 = createHash('sha512').update(fs.readFileSync(artifactPath)).digest('base64')
      const localStatus = artifact.size !== stat.size
        ? 'size_mismatch'
        : (artifact.sha512 && artifact.sha512 !== localSha512 ? 'checksum_mismatch' : 'available')
      return {
        ...artifact,
        localStatus,
        sha256: sha256File(artifactPath),
      }
    }),
  }
  return build
}

async function fetchWithTimeout(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(8_000) })
  if (!response.ok) throw new Error(`http_${response.status}`)
  return response
}

async function probePublicRelease({ manifestUrl = DEFAULT_PUBLIC_MANIFEST } = {}) {
  try {
    const response = await fetchWithTimeout(manifestUrl)
    const parsed = parseUpdaterManifest(await response.text())
    if (!parsed.version) return { status: 'unavailable', error: 'invalid_manifest' }
    const baseUrl = new URL('.', manifestUrl)
    const reachability = await Promise.all(parsed.artifacts.map(async (artifact) => {
      try {
        await fetchWithTimeout(new URL(artifact.name, baseUrl), { method: 'HEAD' })
        return true
      } catch {
        return false
      }
    }))
    return {
      status: 'available',
      version: parsed.version,
      artifactsReachable: reachability.length > 0 && reachability.every(Boolean),
    }
  } catch (error) {
    const code = /^http_\d+$/.test(String(error?.message)) ? error.message : 'request_failed'
    return { status: 'unavailable', error: code }
  }
}

function extractInstalledVersion(appImagePath) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowstate-installed-proof-'))
  try {
    execFileSync(appImagePath, ['--appimage-extract', 'resources/app.asar'], {
      cwd: tempDir,
      timeout: 30_000,
      stdio: 'ignore',
    })
    const appAsar = path.join(tempDir, 'squashfs-root', 'resources', 'app.asar')
    if (!fs.existsSync(appAsar)) return null
    const asar = require('@electron/asar')
    return JSON.parse(asar.extractFile(appAsar, 'package.json').toString('utf8')).version || null
  } catch {
    return null
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

async function probeInstalledApp({ installedPath } = {}) {
  const target = installedPath || path.join(os.homedir(), '.local', 'bin', 'FlowState.AppImage')
  if (!fs.existsSync(target)) return { status: 'unavailable', error: 'not_found' }
  const version = extractInstalledVersion(target)
  return {
    status: 'available',
    version,
    sha256: sha256File(target),
    size: fs.statSync(target).size,
    ...(version ? {} : { error: 'version_unavailable' }),
  }
}

async function probeSidecarRuntime({ sidecarUrl = DEFAULT_SIDECAR_PROVENANCE } = {}) {
  try {
    const response = await fetchWithTimeout(sidecarUrl)
    const payload = await response.json()
    if (payload.schemaVersion !== 'flowstate-sidecar-provenance-v1') {
      return { status: 'unavailable', error: 'invalid_schema' }
    }
    return {
      status: 'available',
      health: true,
      appVersion: typeof payload.appVersion === 'string' ? payload.appVersion : null,
      sourceCommit: /^[0-9a-f]{40}$/.test(payload.sourceCommit || '') ? payload.sourceCommit : null,
      sourceDirty: typeof payload.sourceDirty === 'boolean' ? payload.sourceDirty : null,
      builtAt: typeof payload.builtAt === 'string' ? payload.builtAt : null,
      contractSet: Array.isArray(payload.contractSet)
        ? payload.contractSet.filter((entry) => typeof entry === 'string')
        : [],
    }
  } catch (error) {
    const code = /^http_\d+$/.test(String(error?.message)) ? error.message : 'connection_failed'
    return { status: 'unavailable', error: code }
  }
}

function normalizePublic(value) {
  if (value?.status !== 'available') return { status: 'unavailable', error: String(value?.error || 'unknown') }
  return {
    status: 'available',
    version: typeof value.version === 'string' ? value.version : null,
    artifactsReachable: value.artifactsReachable === true,
  }
}

function normalizeInstalled(value) {
  if (value?.status !== 'available') return { status: 'unavailable', error: String(value?.error || 'unknown') }
  return {
    status: 'available',
    version: typeof value.version === 'string' ? value.version : null,
    sha256: /^[0-9a-f]{64}$/.test(value.sha256 || '') ? value.sha256 : null,
    ...(Number.isSafeInteger(value.size) ? { size: value.size } : {}),
    ...(value.error ? { error: String(value.error) } : {}),
  }
}

function normalizeSidecar(value) {
  if (value?.status !== 'available') return { status: 'unavailable', error: String(value?.error || 'unknown') }
  return {
    status: 'available',
    health: value.health === true,
    appVersion: typeof value.appVersion === 'string' ? value.appVersion : null,
    ...(/^[0-9a-f]{40}$/.test(value.sourceCommit || '') ? { sourceCommit: value.sourceCommit } : {}),
    ...(typeof value.sourceDirty === 'boolean' ? { sourceDirty: value.sourceDirty } : {}),
    ...(typeof value.builtAt === 'string' ? { builtAt: value.builtAt } : {}),
    ...(Array.isArray(value.contractSet)
      ? { contractSet: value.contractSet.filter((entry) => typeof entry === 'string') }
      : {}),
    ...(/^[0-9a-f]{64}$/.test(value.bundleSha256 || '') ? { bundleSha256: value.bundleSha256 } : {}),
  }
}

function compareTruth(ledger) {
  const expectedVersion = ledger.build.packageVersion
  const mismatches = []
  const addVersionMismatch = (surface, field, actual) => {
    if (typeof actual === 'string' && actual !== expectedVersion) {
      mismatches.push({ surface, field, expected: expectedVersion, actual })
    }
  }

  if (ledger.source.dirty) {
    mismatches.push({ surface: 'source', field: 'dirty', expected: false, actual: true })
  }
  if (ledger.build.packageProvenance?.status === 'available') {
    if (ledger.build.packageProvenance.commit !== ledger.source.commit) {
      mismatches.push({
        surface: 'build',
        field: 'packageProvenance.commit',
        expected: ledger.source.commit,
        actual: ledger.build.packageProvenance.commit,
      })
    }
  }

  if (ledger.build.manifest.status === 'available') {
    addVersionMismatch('build', 'manifest.version', ledger.build.manifest.version)
    for (const artifact of ledger.build.manifest.artifacts || []) {
      if (artifact.localStatus !== 'available') {
        mismatches.push({ surface: 'build', field: `artifact.${artifact.name}`, expected: 'available', actual: artifact.localStatus })
      }
    }
  }
  if (ledger.mode === 'full') {
    if (ledger.public.status === 'available') addVersionMismatch('public', 'version', ledger.public.version)
    if (ledger.installed.status === 'available') addVersionMismatch('installed', 'version', ledger.installed.version)
    if (ledger.sidecar.status === 'available') {
      addVersionMismatch('sidecar', 'appVersion', ledger.sidecar.appVersion)
      if (ledger.sidecar.sourceCommit && ledger.sidecar.sourceCommit !== ledger.source.commit) {
        mismatches.push({
          surface: 'sidecar',
          field: 'sourceCommit',
          expected: ledger.source.commit,
          actual: ledger.sidecar.sourceCommit,
        })
      }
      if (ledger.sidecar.sourceDirty === true) {
        mismatches.push({ surface: 'sidecar', field: 'sourceDirty', expected: false, actual: true })
      }
      if (
        ledger.sidecar.bundleSha256
        && ledger.build.sidecar.status === 'available'
        && ledger.sidecar.bundleSha256 !== ledger.build.sidecar.sha256
      ) {
        mismatches.push({
          surface: 'sidecar',
          field: 'bundleSha256',
          expected: ledger.build.sidecar.sha256,
          actual: ledger.sidecar.bundleSha256,
        })
      }
    }
  }
  const unavailableLive = ledger.mode === 'full'
    && [ledger.public, ledger.installed, ledger.sidecar].some((surface) => surface.status !== 'available')
  return {
    consistent: mismatches.length > 0 ? false : (unavailableLive ? null : true),
    mismatches,
  }
}

async function buildTruthLedger(options = {}) {
  const root = path.resolve(options.root || path.join(__dirname, '..'))
  const mode = options.mode || 'non-live'
  if (!['non-live', 'full'].includes(mode)) throw new Error('mode must be non-live|full')
  const source = (options.readSource || readSource)(root)
  const generatedAt = options.now || new Date().toISOString()
  const ledger = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt,
    mode,
    source: {
      commit: /^[0-9a-f]{40}$/.test(source.commit || '') ? source.commit : null,
      dirty: source.dirty === true,
    },
    build: readBuild(root, generatedAt),
    public: { status: 'not_checked', reason: 'non_live_mode' },
    installed: { status: 'not_checked', reason: 'non_live_mode' },
    sidecar: { status: 'not_checked', reason: 'non_live_mode' },
  }
  if (mode === 'full') {
    const [publicResult, installedResult, sidecarResult] = await Promise.all([
      (options.probePublic || probePublicRelease)({ manifestUrl: options.publicManifestUrl }),
      (options.probeInstalled || probeInstalledApp)({ installedPath: options.installedPath }),
      (options.probeSidecar || probeSidecarRuntime)({ sidecarUrl: options.sidecarUrl }),
    ])
    ledger.public = normalizePublic(publicResult)
    ledger.installed = normalizeInstalled(installedResult)
    ledger.sidecar = normalizeSidecar(sidecarResult)
  }
  ledger.verdict = compareTruth(ledger)
  return ledger
}

function writeTruthLedger(outputPath, ledger) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  const tempPath = `${outputPath}.${process.pid}.tmp`
  fs.writeFileSync(tempPath, `${JSON.stringify(ledger, null, 2)}\n`, { mode: 0o644 })
  fs.renameSync(tempPath, outputPath)
}

function parseArgs(argv) {
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (!['--mode', '--output', '--root', '--public-manifest-url', '--installed-appimage', '--sidecar-url'].includes(flag)) {
      throw new Error(`unknown argument: ${flag}`)
    }
    const value = argv[index + 1]
    if (!value) throw new Error(`${flag} requires a value`)
    index += 1
    if (flag === '--mode') options.mode = value
    if (flag === '--output') options.output = value
    if (flag === '--root') options.root = value
    if (flag === '--public-manifest-url') options.publicManifestUrl = value
    if (flag === '--installed-appimage') options.installedPath = value
    if (flag === '--sidecar-url') options.sidecarUrl = value
  }
  return options
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2))
    const ledger = await buildTruthLedger(options)
    if (options.output) writeTruthLedger(path.resolve(options.output), ledger)
    else process.stdout.write(`${JSON.stringify(ledger, null, 2)}\n`)
  } catch (error) {
    console.error(`[flowstate-truth-ledger] ${error?.message || 'failed'}`)
    process.exitCode = 1
  }
}

if (require.main === module) main()

module.exports = {
  buildTruthLedger,
  compareTruth,
  parseUpdaterManifest,
  probeInstalledApp,
  probePublicRelease,
  probeSidecarRuntime,
  readSource,
  writeTruthLedger,
}
