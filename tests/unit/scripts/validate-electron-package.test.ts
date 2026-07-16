import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import { createPackage } from '@electron/asar'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  HERMES_ROUTE_BUNDLE_MARKERS,
  HERMES_ROUTE_CAPABILITIES,
  HERMES_ROUTE_DISPATCH_MARKERS,
  SCHEMA_VERSION,
} = require('../../../server/local-api/hermes-route-capabilities.cjs') as {
  HERMES_ROUTE_BUNDLE_MARKERS: string[]
  HERMES_ROUTE_CAPABILITIES: Array<Record<string, unknown>>
  HERMES_ROUTE_DISPATCH_MARKERS: string[]
  SCHEMA_VERSION: string
}

const scriptPath = resolve(__dirname, '../../../scripts/validate-electron-package.cjs')
const projectRoot = resolve(__dirname, '../../..')
const tempRoots: string[] = []
let cachedBundledSidecar: string | null = null

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

function bundledSidecar() {
  if (cachedBundledSidecar !== null) return cachedBundledSidecar
  const buildRoot = makeRoot()
  const output = join(buildRoot, 'local-api-server.cjs')
  const result = spawnSync(resolve(projectRoot, 'node_modules/.bin/esbuild'), [
    'server/local-api/server.cjs', '--bundle', '--platform=node', '--target=node22',
    `--outfile=${output}`,
  ], { cwd: projectRoot, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || 'failed to build sidecar fixture')
  cachedBundledSidecar = readFileSync(output, 'utf8')
  return cachedBundledSidecar
}

function capabilityOnlyExecutableSidecar() {
  return `
const http = require('http')
const manifest = ${JSON.stringify({ schemaVersion: SCHEMA_VERSION, routes: HERMES_ROUTE_CAPABILITIES })}
http.createServer((req, res) => {
  const body = req.url === '/api/capabilities'
    ? manifest
    : req.url === '/api/health' ? { ok: true } : { error: 'not found' }
  res.writeHead(req.url === '/api/capabilities' || req.url === '/api/health' ? 200 : 404, {
    'Content-Type': 'application/json',
  })
  res.end(JSON.stringify(body))
}).listen(Number(process.env.FLOW_STATE_API_PORT), '127.0.0.1')
/* ${[...HERMES_ROUTE_BUNDLE_MARKERS, ...HERMES_ROUTE_DISPATCH_MARKERS].join('\n')} */
`
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
          ? options.sidecar ?? bundledSidecar()
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

    expect(result.status, result.stderr).toBe(0)
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

  it('fails before shipping marker text that has no executable route dispatch', async () => {
    const root = makeRoot()
    writeBuilderConfig(root)
    await writeAppAsar(root, [
      '/dist/index.html',
      '/dist-electron/main.cjs',
      '/dist-electron/preload.cjs',
      '/dist-electron/local-api-server.cjs',
      '/dist-electron/flowstate-truth-ledger.json',
      '/package.json',
    ], { sidecar: capabilityOnlyExecutableSidecar() })

    const result = runValidator(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('executable Hermes route contract')
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
