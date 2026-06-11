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

const root = process.env.FLOWSTATE_PACKAGE_ROOT || path.resolve(__dirname, '..')
const appAsar = path.join(root, 'release', 'linux-unpacked', 'resources', 'app.asar')
const builderConfig = path.join(root, 'electron-builder.yml')
const latestLinuxManifest = path.join(root, 'release', 'latest-linux.yml')

const requiredAsarEntries = [
  '/dist/index.html',
  '/dist-electron/main.cjs',
  '/dist-electron/preload.cjs',
  '/dist-electron/local-api-server.cjs',
  '/package.json',
]

function fail(message) {
  console.error(`[electron-package] ERROR: ${message}`)
  process.exitCode = 1
}

function appAsarFromLatestDeb() {
  if (!fs.existsSync(latestLinuxManifest)) return null

  const manifest = fs.readFileSync(latestLinuxManifest, 'utf-8')
  const debMatch = manifest.match(/url:\s*(FlowState_[^\s]+_amd64\.deb)/)
  if (!debMatch) return null

  const debPath = path.join(root, 'release', debMatch[1])
  if (!fs.existsSync(debPath)) return null

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowstate-electron-package-'))
  execFileSync('dpkg-deb', ['-x', debPath, tempDir], { stdio: 'ignore' })
  const extractedAsar = path.join(tempDir, 'opt', 'FlowState', 'resources', 'app.asar')
  return {
    appAsar: extractedAsar,
    cleanup: () => fs.rmSync(tempDir, { recursive: true, force: true }),
  }
}

function validateAppAsar(packagePath) {
  const entries = new Set(asar.listPackage(packagePath))
  const missing = requiredAsarEntries.filter((entry) => !entries.has(entry))
  if (missing.length > 0) {
    fail(`Packaged app archive is missing required entries: ${missing.join(', ')}`)
  }
}

if (fs.existsSync(appAsar)) {
  validateAppAsar(appAsar)
} else {
  let extractedPackage = null
  try {
    extractedPackage = appAsarFromLatestDeb()
    if (!extractedPackage || !fs.existsSync(extractedPackage.appAsar)) {
      fail(`Missing packaged app archive: ${appAsar}`)
    } else {
      validateAppAsar(extractedPackage.appAsar)
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

if (process.exitCode) {
  process.exit(process.exitCode)
}

console.log('[electron-package] Electron package contains renderer, main process, sidecar, and Linux launcher metadata.')
