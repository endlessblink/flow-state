import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = resolve(__dirname, '../..')

const readSource = (relativePath: string) =>
  readFileSync(resolve(projectRoot, relativePath), 'utf8')

describe('electron-builder dependency parser patch', () => {
  it('patches the polluted JSON parser start index instead of forcing traversal mode', () => {
    const patchScript = readSource('scripts/patch-electron-builder-dependency-parser.cjs')

    expect(patchScript).toContain('const packageObjectStart = consoleOutput.search(/\\\\{\\\\s*["\']?(name|version|dependencies|problems|error)')
    expect(patchScript).toContain('const starts = [packageObjectStart, fallbackObjectStart, fallbackArrayStart].filter((index) => index >= 0)')
    expect(patchScript).toContain('const start = packageObjectStart >= 0 ? packageObjectStart : (fallbackObjectStart >= 0 ? fallbackObjectStart : fallbackArrayStart)')
    expect(patchScript).toContain('const jsonCandidate = consoleOutput.slice(start)')
    expect(patchScript).toContain('const legacyFixedWithoutDirectParse')
    expect(patchScript).toContain('const escapedRegexBroken')
    expect(patchScript).toContain('FlowState buffered shell-command collector output patch')
    expect(patchScript).not.toContain('PM.TRAVERSAL')
  })

  it('keeps dependency collection off shell-gated npm paths', () => {
    const patchScript = readSource('scripts/patch-electron-builder-dependency-parser.cjs')

    expect(patchScript).toContain('childProcess.spawn(command, args')
    expect(patchScript).toContain('childProcess.execFileSync(command, args')
    expect(patchScript).toContain('shell: false')
    expect(patchScript).toContain('SC_DISABLE_GATE: "1"')
    expect(patchScript).toContain("patched.includes(shellSpawnCollector)")
    expect(patchScript).toContain("patched.includes(syncShellCollector)")
    expect(patchScript).toContain('collectorEnvWithoutShimBypass')
  })

  it('runs the patch before every tracked Electron packaging path', () => {
    const packageJson = readSource('package.json')
    const deployScript = readSource('scripts/deploy-electron-update.sh')
    const builderWrapper = readSource('scripts/run-electron-builder-with-npm-tree.sh')

    expect(packageJson).toContain('"electron:patch-builder": "node scripts/patch-electron-builder-dependency-parser.cjs"')
    // The patch must run immediately before the wrapper that invokes electron-builder,
    // and the wrapper must ultimately call electron-builder with the shared config.
    expect(packageJson).toContain('npm run electron:patch-builder && bash scripts/run-electron-builder-with-npm-tree.sh')
    expect(builderWrapper).toContain('electron-builder --config electron-builder.yml')
    expect(builderWrapper).toContain('-name "FlowState-${VERSION}-*.AppImage"')
    expect(builderWrapper).toContain('-name "FlowState_${VERSION}_*.deb"')
    expect(builderWrapper).toContain('-name "latest-linux.yml"')
    expect(builderWrapper).toContain('-delete')
    expect(deployScript).toContain('npm run electron:build')
    expect(deployScript).not.toContain('npx electron-builder --config electron-builder.yml')
  })

  it('validates the final deb payload when linux-unpacked no longer contains app.asar', () => {
    const validator = readSource('scripts/validate-electron-package.cjs')

    expect(validator).toContain("const latestLinuxManifest = path.join(root, 'release', 'latest-linux.yml')")
    expect(validator).toContain('function appAsarFromLatestDeb()')
    expect(validator).toContain("execFileSync('dpkg-deb', ['-x', debPath, tempDir]")
    expect(validator).toContain("path.join(tempDir, 'opt', 'FlowState', 'resources', 'app.asar')")
    expect(validator).toContain('validateAppAsar(extractedPackage.appAsar)')
  })
})
