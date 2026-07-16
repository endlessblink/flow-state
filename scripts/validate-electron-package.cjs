#!/usr/bin/env node

/**
 * Refuse Electron packages that would boot to a blank/missing renderer or ship
 * an unusable Linux desktop launcher contract.
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const asar = require('@electron/asar')
const {
  HERMES_ROUTE_BUNDLE_MARKERS,
  HERMES_ROUTE_DISPATCH_MARKERS,
  SCHEMA_VERSION: HERMES_CAPABILITIES_SCHEMA_VERSION,
} = require('../server/local-api/hermes-route-capabilities.cjs')
const { probePackagedHermesRoutes } = require('./probe-packaged-hermes-routes.cjs')

const root = process.env.FLOWSTATE_PACKAGE_ROOT || path.resolve(__dirname, '..')
const appAsar = path.join(root, 'release', 'linux-unpacked', 'resources', 'app.asar')
const builderConfig = path.join(root, 'electron-builder.yml')
const latestLinuxManifest = path.join(root, 'release', 'latest-linux.yml')

const requiredAsarEntries = [
  '/dist/index.html',
  '/dist-electron/main.cjs',
  '/dist-electron/preload.cjs',
  '/dist-electron/local-api-server.cjs',
  '/dist-electron/flowstate-truth-ledger.json',
  '/package.json',
]

function fail(message) {
  console.error(`[electron-package] ERROR: ${message}`)
  process.exitCode = 1
}

function latestDebPath() {
  if (!fs.existsSync(latestLinuxManifest)) return null

  const manifest = fs.readFileSync(latestLinuxManifest, 'utf-8')
  const debMatch = manifest.match(/url:\s*(FlowState_[^\s]+_amd64\.deb)/)
  if (!debMatch) return null

  const debPath = path.join(root, 'release', debMatch[1])
  return fs.existsSync(debPath) ? debPath : null
}

function validateDebArchiveMembers(debPath) {
  let members
  try {
    members = execFileSync('ar', ['t', debPath], { encoding: 'utf8' })
      .split(/\r?\n/)
      .map((member) => member.trim())
      .filter(Boolean)
  } catch (error) {
    fail(`Unable to inspect packaged deb archive members: ${error.message}`)
    return
  }

  const required = [
    ['debian-binary', (member) => member === 'debian-binary'],
    ['control.tar.*', (member) => /^control\.tar(?:\..+)?$/.test(member)],
    ['data.tar.*', (member) => /^data\.tar(?:\..+)?$/.test(member)],
  ]
  for (const [label, matches] of required) {
    const count = members.filter(matches).length
    if (count !== 1) {
      fail(`Packaged deb must contain exactly one ${label} member; found ${count}.`)
    }
  }
}

function appAsarFromLatestDeb() {
  const debPath = latestDebPath()
  if (!debPath) return null

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowstate-electron-package-'))
  execFileSync('dpkg-deb', ['-x', debPath, tempDir], { stdio: 'ignore' })
  const extractedAsar = path.join(tempDir, 'opt', 'FlowState', 'resources', 'app.asar')
  return {
    appAsar: extractedAsar,
    cleanup: () => fs.rmSync(tempDir, { recursive: true, force: true }),
  }
}

const manifestDebPath = latestDebPath()
if (manifestDebPath) {
  validateDebArchiveMembers(manifestDebPath)
}

async function validateAppAsar(packagePath) {
  const entries = new Set(asar.listPackage(packagePath))
  const missing = requiredAsarEntries.filter((entry) => !entries.has(entry))
  if (missing.length > 0) {
    fail(`Packaged app archive is missing required entries: ${missing.join(', ')}`)
    return
  }
  try {
    const provenance = JSON.parse(asar.extractFile(
      packagePath,
      'dist-electron/flowstate-truth-ledger.json',
    ).toString('utf8'))
    const valid = (
      provenance.schemaVersion === 'flowstate-truth-ledger-v1'
      && provenance.mode === 'non-live'
      && /^[0-9a-f]{40}$/.test(provenance.source?.commit || '')
      && typeof provenance.source?.dirty === 'boolean'
      && typeof provenance.build?.builtAt === 'string'
      && Number.isFinite(Date.parse(provenance.build.builtAt))
      && Array.isArray(provenance.build?.contractSet)
      && provenance.build.contractSet.length > 0
    )
    if (!valid) fail('Packaged FlowState truth ledger is malformed or incomplete.')
    const serialized = JSON.stringify(provenance)
    if (/authorization|accessToken|refreshToken|cookie|email|homePath/i.test(serialized)) {
      fail('Packaged FlowState truth ledger contains a forbidden sensitive field.')
    }
  } catch (error) {
    fail(`Unable to validate packaged FlowState truth ledger: ${error.message}`)
  }
  try {
    const sidecar = asar.extractFile(
      packagePath,
      'dist-electron/local-api-server.cjs',
    ).toString('utf8')
    const missingMarkers = HERMES_ROUTE_BUNDLE_MARKERS.filter((marker) => !sidecar.includes(marker))
    if (missingMarkers.length > 0) {
      fail(
        `Packaged sidecar is missing the ${HERMES_CAPABILITIES_SCHEMA_VERSION} `
        + `Hermes route capability contract markers: ${missingMarkers.join(', ')}`,
      )
    }
    const missingDispatch = HERMES_ROUTE_DISPATCH_MARKERS.filter((marker) => !sidecar.includes(marker))
    if (missingDispatch.length > 0) {
      fail(
        `Packaged sidecar is missing advertised Hermes route dispatch branches: ${missingDispatch.join(', ')}`,
      )
    }
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowstate-sidecar-probe-'))
    try {
      const sidecarPath = path.join(tempDir, 'local-api-server.cjs')
      fs.writeFileSync(sidecarPath, sidecar)
      await probePackagedHermesRoutes(sidecarPath)
    } catch (error) {
      fail(`Packaged sidecar failed its executable Hermes route contract: ${error.message}`)
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  } catch (error) {
    fail(`Unable to validate packaged Hermes route capability contract: ${error.message}`)
  }
}

async function main() {
  if (fs.existsSync(appAsar)) {
    await validateAppAsar(appAsar)
  } else {
    let extractedPackage = null
    try {
      extractedPackage = appAsarFromLatestDeb()
      if (!extractedPackage || !fs.existsSync(extractedPackage.appAsar)) {
        fail(`Missing packaged app archive: ${appAsar}`)
      } else {
        await validateAppAsar(extractedPackage.appAsar)
      }
    } catch (error) {
      fail(`Unable to validate packaged deb app archive: ${error.message}`)
    } finally {
      extractedPackage?.cleanup()
    }
  }

  if (!fs.existsSync(builderConfig)) {
    fail(`Missing electron-builder config: ${builderConfig}`)
  } else {
    const config = fs.readFileSync(builderConfig, 'utf-8')
    const requiredConfigSnippets = [
      '  - dist/**/*',
      '  - dist-electron/**/*',
      'main: dist-electron/main.cjs',
      'executableName: flowstate',
      'StartupWMClass: flow-state',
      'FlowState-${version}-${arch}.AppImage',
    ]
    const missing = requiredConfigSnippets.filter((snippet) => !config.includes(snippet))
    if (missing.length > 0) {
      fail(`electron-builder.yml is missing required Linux package contract snippets: ${missing.join(', ')}`)
    }
  }

  if (!process.exitCode) {
    console.log('[electron-package] Electron package contains renderer, main process, route-compatible sidecar, and Linux launcher metadata.')
  }
  process.exit(process.exitCode || 0)
}

main().catch(error => {
  fail(`Package validation crashed: ${error.message}`)
  process.exit(process.exitCode || 1)
})
