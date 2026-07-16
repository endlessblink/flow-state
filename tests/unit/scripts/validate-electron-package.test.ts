import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import { createPackage } from '@electron/asar'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  HERMES_ROUTE_BUNDLE_MARKERS,
  HERMES_ROUTE_DISPATCH_MARKERS,
} = require('../../../server/local-api/hermes-route-capabilities.cjs') as {
  HERMES_ROUTE_BUNDLE_MARKERS: string[]
  HERMES_ROUTE_DISPATCH_MARKERS: string[]
}

const scriptPath = resolve(__dirname, '../../../scripts/validate-electron-package.cjs')
const tempRoots: string[] = []

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), 'flowstate-electron-package-'))
  tempRoots.push(root)
  return root
}

function writeFile(root: string, relativePath: string, content = 'fixture') {
  const fullPath = join(root, relativePath)
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, content)
}

function writeBuilderConfig(root: string, options: { executableName?: string; startupWMClass?: string } = {}) {
  const executableName = options.executableName ?? 'flowstate'
  const startupWMClass = options.startupWMClass ?? 'flow-state'

  writeFile(
    root,
    'electron-builder.yml',
    `
files:
  - dist/**/*
  - dist-electron/**/*

extraMetadata:
  main: dist-electron/main.cjs

linux:
  executableName: ${executableName}
  desktop:
    entry:
      StartupWMClass: ${startupWMClass}

appImage:
  artifactName: FlowState-\${version}-\${arch}.AppImage
`.trimStart(),
  )
}

async function writeAppAsar(
  root: string,
  entries: string[],
  options: { sidecar?: string } = {},
) {
  const source = join(root, 'asar-source')
  const appAsar = join(root, 'release/linux-unpacked/resources/app.asar')

  for (const entry of entries) {
    const content = entry.endsWith('package.json')
      ? '{"name":"flow-state","main":"dist-electron/main.cjs"}'
      : entry.endsWith('flowstate-truth-ledger.json')
        ? JSON.stringify({
            schemaVersion: 'flowstate-truth-ledger-v1',
            mode: 'non-live',
            source: { commit: 'a'.repeat(40), dirty: false },
            build: {
              builtAt: '2026-07-15T12:00:00.000Z',
              contractSet: [
                'truth-ledger/flowstate-truth-ledger-v1',
                'local-task-api/hermes-tools-v1',
              ],
            },
          })
        : entry.endsWith('local-api-server.cjs')
          ? options.sidecar ?? [...HERMES_ROUTE_BUNDLE_MARKERS, ...HERMES_ROUTE_DISPATCH_MARKERS].join('\n')
        : 'fixture'
    writeFile(source, entry.replace(/^\//, ''), content)
  }

  mkdirSync(dirname(appAsar), { recursive: true })
  await createPackage(source, appAsar)
}

function runValidator(root: string) {
  return spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH || '',
      NODE_PATH: process.env.NODE_PATH || '',
      FLOWSTATE_PACKAGE_ROOT: root,
    },
  })
}

function writeDuplicateDebArchive(root: string) {
  const releaseDir = join(root, 'release')
  const membersDir = join(root, 'deb-members')
  const debPath = join(releaseDir, 'FlowState_1.4.258_amd64.deb')

  mkdirSync(releaseDir, { recursive: true })
  for (const member of ['debian-binary', 'control.tar.xz', 'data.tar.xz']) {
    writeFile(membersDir, member, member === 'debian-binary' ? '2.0\n' : 'fixture')
  }

  const members = ['debian-binary', 'control.tar.xz', 'data.tar.xz'].map((member) =>
    join(membersDir, member),
  )
  expect(spawnSync('ar', ['qc', debPath, ...members]).status).toBe(0)
  expect(spawnSync('ar', ['q', debPath, ...members]).status).toBe(0)
  writeFile(
    root,
    'release/latest-linux.yml',
    '- url: FlowState_1.4.258_amd64.deb\n',
  )
}

describe('validate-electron-package', () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('passes when the packaged Electron app contains the renderer, main process, preload, and sidecar', async () => {
    const root = makeRoot()
    writeBuilderConfig(root)
    await writeAppAsar(root, [
      '/dist/index.html',
      '/dist-electron/main.cjs',
      '/dist-electron/preload.cjs',
      '/dist-electron/local-api-server.cjs',
      '/dist-electron/flowstate-truth-ledger.json',
      '/package.json',
    ])

    const result = runValidator(root)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Electron package contains renderer')
  })

  it('fails before shipping an AppImage that is missing the renderer entrypoint', async () => {
    const root = makeRoot()
    writeBuilderConfig(root)
    await writeAppAsar(root, [
      '/dist-electron/main.cjs',
      '/dist-electron/preload.cjs',
      '/dist-electron/local-api-server.cjs',
      '/dist-electron/flowstate-truth-ledger.json',
      '/package.json',
    ])

    const result = runValidator(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('/dist/index.html')
  })

  it('fails before shipping a package whose sidecar location does not match Electron runtime lookup', async () => {
    const root = makeRoot()
    writeBuilderConfig(root)
    await writeAppAsar(root, [
      '/dist/index.html',
      '/dist-electron/main.cjs',
      '/dist-electron/preload.cjs',
      '/dist-electron/ipc/local-api-server.cjs',
      '/dist-electron/flowstate-truth-ledger.json',
      '/package.json',
    ])

    const result = runValidator(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('/dist-electron/local-api-server.cjs')
  })

  it('fails before shipping a sidecar that omits a Hermes route capability', async () => {
    const root = makeRoot()
    writeBuilderConfig(root)
    await writeAppAsar(root, [
      '/dist/index.html',
      '/dist-electron/main.cjs',
      '/dist-electron/preload.cjs',
      '/dist-electron/local-api-server.cjs',
      '/dist-electron/flowstate-truth-ledger.json',
      '/package.json',
    ], { sidecar: 'health-only sidecar fixture' })

    const result = runValidator(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Hermes route capability contract')
  })

  it('fails before shipping advertised routes that have no dispatch branch', async () => {
    const root = makeRoot()
    writeBuilderConfig(root)
    await writeAppAsar(root, [
      '/dist/index.html',
      '/dist-electron/main.cjs',
      '/dist-electron/preload.cjs',
      '/dist-electron/local-api-server.cjs',
      '/dist-electron/flowstate-truth-ledger.json',
      '/package.json',
    ], { sidecar: HERMES_ROUTE_BUNDLE_MARKERS.join('\n') })

    const result = runValidator(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('route dispatch branches')
  })

  it('fails if Linux launcher metadata drifts away from the dock shortcut contract', async () => {
    const root = makeRoot()
    writeBuilderConfig(root, { executableName: 'flow-state' })
    await writeAppAsar(root, [
      '/dist/index.html',
      '/dist-electron/main.cjs',
      '/dist-electron/preload.cjs',
      '/dist-electron/local-api-server.cjs',
      '/dist-electron/flowstate-truth-ledger.json',
      '/package.json',
    ])

    const result = runValidator(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('executableName: flowstate')
  })

  it('fails when a manifest deb contains duplicate Debian archive members', async () => {
    const root = makeRoot()
    writeBuilderConfig(root)
    await writeAppAsar(root, [
      '/dist/index.html',
      '/dist-electron/main.cjs',
      '/dist-electron/preload.cjs',
      '/dist-electron/local-api-server.cjs',
      '/dist-electron/flowstate-truth-ledger.json',
      '/package.json',
    ])
    writeDuplicateDebArchive(root)

    const result = runValidator(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('exactly one debian-binary')
    expect(result.stderr).toContain('exactly one control.tar.*')
    expect(result.stderr).toContain('exactly one data.tar.*')
  })

  it('fails before shipping a package without embedded source provenance', async () => {
    const root = makeRoot()
    writeBuilderConfig(root)
    await writeAppAsar(root, [
      '/dist/index.html',
      '/dist-electron/main.cjs',
      '/dist-electron/preload.cjs',
      '/dist-electron/local-api-server.cjs',
      '/package.json',
    ])

    const result = runValidator(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('/dist-electron/flowstate-truth-ledger.json')
  })
})
