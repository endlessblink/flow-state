import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'

const scriptPath = resolve(__dirname, '../../../scripts/smoke-electron-appimage.sh')
const tempRoots: string[] = []

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), 'flowstate-appimage-smoke-'))
  tempRoots.push(root)
  return root
}

function writeFakeAppImage(root: string, body: string) {
  const appImage = join(root, 'FlowState-fake.AppImage')
  writeFileSync(appImage, `#!/usr/bin/env bash\n${body}\n`)
  chmodSync(appImage, 0o755)
  return appImage
}

function runSmoke(appImage: string) {
  return spawnSync('bash', [scriptPath, appImage], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH || '',
    },
  })
}

describe('smoke-electron-appimage', () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('passes when the packaged app launches without module/load crash output', () => {
    const root = makeRoot()
    const appImage = writeFakeAppImage(root, 'echo "FlowState launched" >&2\nexit 0')

    const result = runSmoke(appImage)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('launched without main-process module/load crashes')
  })

  it('fails before shipping when the main process reports a missing module', () => {
    const root = makeRoot()
    const appImage = writeFakeAppImage(root, 'echo "Error: Cannot find module universalify" >&2\nexit 0')

    const result = runSmoke(appImage)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('main-process module/load crash')
    expect(result.stderr).toContain('Cannot find module')
  })

  it('fails before shipping when the packaged app exits early for another startup failure', () => {
    const root = makeRoot()
    const appImage = writeFakeAppImage(root, 'echo "startup failed" >&2\nexit 42')

    const result = runSmoke(appImage)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('exited early with status 42')
  })
})
