import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const projectRoot = resolve(__dirname, '../..')
const tempDirs: string[] = []

function makeTempDir(): string {
  const directory = mkdtempSync(join(tmpdir(), 'flowstate-appimage-installer-'))
  tempDirs.push(directory)
  return directory
}

function installerScript(): string {
  const source = readFileSync(resolve(projectRoot, 'electron/updater.ts'), 'utf8')
  const match = source.match(/const script = `\n([\s\S]*?)\n\s*`\n\s*const installerArgs/)
  if (!match) throw new Error('Could not extract the detached AppImage installer script')
  return match[1]
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('detached AppImage installer', () => {
  it('keeps a direct replacement when its health endpoint reports the expected version with whitespace', () => {
    const directory = makeTempDir()
    const pendingDirectory = join(directory, 'pending')
    const target = join(directory, 'FlowState.AppImage')
    const pending = join(pendingDirectory, 'FlowState-1.4.777-x86_64.AppImage')
    const info = join(pendingDirectory, 'update-info.json')
    const startedMarker = join(directory, 'replacement-started')
    const binDirectory = join(directory, 'bin')
    const fakeCurl = join(binDirectory, 'curl')
    const fakePs = join(binDirectory, 'ps')

    mkdirSync(pendingDirectory, { recursive: true })
    mkdirSync(binDirectory, { recursive: true })
    writeFileSync(target, '#!/bin/sh\nexit 0\n')
    chmodSync(target, 0o755)
    writeFileSync(pending, `#!/bin/sh\ntouch '${startedMarker}'\nexit 0\n`, { mode: 0o755 })
    writeFileSync(info, JSON.stringify({ fileName: 'FlowState-1.4.777-x86_64.AppImage' }))
    writeFileSync(
      fakeCurl,
      `#!/bin/sh\nif [ -e '${startedMarker}' ]; then\n  printf '{\\n  "schemaVersion": "flowstate-sidecar-provenance-v1",\\n  "appVersion": "1.4.777",\\n  "sourceCommit": "live-shaped-provenance"\\n}\\n'\n  exit 0\nfi\nexit 7\n`,
      { mode: 0o755 },
    )
    writeFileSync(fakePs, '#!/bin/sh\nexit 0\n', { mode: 0o755 })

    try {
      execFileSync('/bin/sh', [
      '-c',
      installerScript(),
      'flowstate-appimage-install',
      target,
      pending,
      info,
      '999999',
      'direct',
      '1.4.777',
      '1.4.776',
    ], {
      env: { ...process.env, PATH: `${binDirectory}:${process.env.PATH}` },
      timeout: 10_000,
      })
    } catch (error) {
      const log = readFileSync(join(pendingDirectory, 'update-install.log'), 'utf8')
      throw new Error('Installer exited unexpectedly: ' + log, { cause: error })
    }

    expect(existsSync(startedMarker)).toBe(true)
    expect(readFileSync(target, 'utf8')).toContain('replacement-started')
    expect(existsSync(info)).toBe(false)
    expect(existsSync(`${info}.failed`)).toBe(false)
  })
})
