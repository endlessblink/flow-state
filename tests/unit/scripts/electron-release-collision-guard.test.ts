import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

const root = process.cwd()
const deploySource = readFileSync(resolve(root, 'scripts/deploy-electron-update.sh'), 'utf8')
const promoteSource = readFileSync(resolve(root, 'scripts/promote-electron-release.sh'), 'utf8')

const manifest = (
  version: string,
  appSha: string,
  debSha = `${appSha}-deb`,
  appSize = 10,
  debSize = 20,
) => `version: ${version}
files:
  - url: FlowState-${version}-x86_64.AppImage
    sha512: ${appSha}
    size: ${appSize}
  - url: FlowState_${version}_amd64.deb
    sha512: ${debSha}
    size: ${debSize}
path: FlowState-${version}-x86_64.AppImage
sha512: ${appSha}
`

async function loadGuard() {
  return import('../../../scripts/electron-release-collision-guard.cjs') as Promise<{
    assertSafeElectronRelease: (localManifest: string, remoteManifest: string) => {
      status: 'new-version' | 'idempotent'
    }
    validateManifestArtifacts: (localManifest: string, artifactsDir: string) => string[]
  }>
}

describe('Electron release collision guard', () => {
  it('promotes under a remote lock and rechecks the manifest before publishing', () => {
    expect(deploySource).toMatch(/flock[^\n]+promote-electron-release\.sh/)
    const guardIndex = promoteSource.indexOf('electron-release-collision-guard.cjs')
    const manifestPublishIndex = promoteSource.indexOf('mv "$STAGE_DIR/latest-linux.yml"')
    expect(guardIndex).toBeGreaterThan(-1)
    expect(manifestPublishIndex).toBeGreaterThan(guardIndex)
  })

  it('requires a non-empty local manifest before staging any artifact', () => {
    const manifestCheckIndex = deploySource.indexOf('[ ! -s "$YML" ]')
    const stageUploadIndex = deploySource.indexOf('# Stage the validated release')
    expect(manifestCheckIndex).toBeGreaterThan(-1)
    expect(stageUploadIndex).toBeGreaterThan(manifestCheckIndex)
    expect(deploySource).not.toContain('[ -n "$YML" ] &&')
  })

  it('rejects reusing a version with a different AppImage checksum', async () => {
    const { assertSafeElectronRelease } = await loadGuard()

    expect(() => assertSafeElectronRelease(
      manifest('1.4.243', 'correct-build'),
      manifest('1.4.243', 'other-build')
    )).toThrow(/same version.*different artifact/i)
  })

  it('allows an idempotent redeploy of the exact same artifact', async () => {
    const { assertSafeElectronRelease } = await loadGuard()
    expect(assertSafeElectronRelease(
      manifest('1.4.243', 'same-build'),
      manifest('1.4.243', 'same-build')
    )).toEqual({ status: 'idempotent' })
  })

  it('rejects a same-version release when any manifest artifact changed', async () => {
    const { assertSafeElectronRelease } = await loadGuard()
    expect(() => assertSafeElectronRelease(
      manifest('1.4.243', 'same-app', 'new-deb'),
      manifest('1.4.243', 'same-app', 'old-deb'),
    )).toThrow(/same version.*different artifact/i)
  })

  it('rejects a same-version release when only the top-level updater target changed', async () => {
    const { assertSafeElectronRelease } = await loadGuard()
    const remote = manifest('1.4.243', 'same-app', 'same-deb')
    expect(() => assertSafeElectronRelease(
      remote.replace(/sha512: same-app\n$/, 'sha512: stale-top-level\n'),
      remote,
    )).toThrow(/top-level|same version.*different artifact/i)
  })

  it('rejects a higher version that reuses a published filename with different bytes', async () => {
    const { assertSafeElectronRelease } = await loadGuard()
    const sharedApp = (value: string) => value.replace(/FlowState-[\d.]+-x86_64\.AppImage/g, 'FlowState-shared.AppImage')
    expect(() => assertSafeElectronRelease(
      sharedApp(manifest('1.4.244', 'new-app')),
      sharedApp(manifest('1.4.243', 'old-app')),
    )).toThrow(/reuses.*artifact|published filename/i)
  })

  it('binds every manifest entry to a safe local filename, size, and SHA-512', async () => {
    const { validateManifestArtifacts } = await loadGuard()
    const artifactsDir = mkdtempSync(resolve(tmpdir(), 'flowstate-release-'))
    const appContents = Buffer.from('app-image')
    const debContents = Buffer.from('debian-package')
    writeFileSync(resolve(artifactsDir, 'FlowState-1.4.244-x86_64.AppImage'), appContents)
    writeFileSync(resolve(artifactsDir, 'FlowState_1.4.244_amd64.deb'), debContents)
    const sha = (contents: Buffer) => createHash('sha512').update(contents).digest('base64')
    const localManifest = manifest(
      '1.4.244',
      sha(appContents),
      sha(debContents),
      appContents.length,
      debContents.length,
    )

    expect(validateManifestArtifacts(localManifest, artifactsDir)).toEqual([
      'FlowState-1.4.244-x86_64.AppImage',
      'FlowState_1.4.244_amd64.deb',
    ])
    writeFileSync(resolve(artifactsDir, 'FlowState_1.4.244_amd64.deb'), 'tampered')
    expect(() => validateManifestArtifacts(localManifest, artifactsDir)).toThrow(/size|sha-512/i)
    writeFileSync(resolve(artifactsDir, 'FlowState_1.4.244_amd64.deb'), debContents)
    expect(() => validateManifestArtifacts(
      localManifest.replace('FlowState-1.4.244-x86_64.AppImage', '../escape.AppImage'),
      artifactsDir,
    )).toThrow(/unsafe artifact/i)
    expect(() => validateManifestArtifacts(
      localManifest.replace(/sha512: [^\n]+\n$/, 'sha512: stale-top-level\n'),
      artifactsDir,
    )).toThrow(/top-level.*sha-512/i)
  })

  it('allows a higher version and rejects a downgrade', async () => {
    const { assertSafeElectronRelease } = await loadGuard()
    expect(assertSafeElectronRelease(
      manifest('1.4.244', 'new-build'),
      manifest('1.4.243', 'old-build')
    )).toEqual({ status: 'new-version' })
    expect(() => assertSafeElectronRelease(
      manifest('1.4.242', 'old-build'),
      manifest('1.4.243', 'new-build')
    )).toThrow(/downgrade/i)
  })
})
