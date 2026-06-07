import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import { createPackage } from '@electron/asar'

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

async function writeAppAsar(root: string, entries: string[]) {
  const source = join(root, 'asar-source')
  const appAsar = join(root, 'release/linux-unpacked/resources/app.asar')

  for (const entry of entries) {
    writeFile(source, entry.replace(/^\//, ''), entry.endsWith('package.json')
      ? '{"name":"flow-state","main":"dist-electron/main.cjs"}'
      : 'fixture')
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
      '/package.json',
    ])

    const result = runValidator(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('/dist-electron/local-api-server.cjs')
  })

  it('fails if Linux launcher metadata drifts away from the dock shortcut contract', async () => {
    const root = makeRoot()
    writeBuilderConfig(root, { executableName: 'flow-state' })
    await writeAppAsar(root, [
      '/dist/index.html',
      '/dist-electron/main.cjs',
      '/dist-electron/preload.cjs',
      '/dist-electron/local-api-server.cjs',
      '/package.json',
    ])

    const result = runValidator(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('executableName: flowstate')
  })
})
