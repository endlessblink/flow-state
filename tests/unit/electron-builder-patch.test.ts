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
    expect(patchScript).toContain('childProcess.spawn([command, ...args].join(" ")')
    expect(patchScript).not.toContain('PM.TRAVERSAL')
  })

  it('runs the patch before every tracked Electron packaging path', () => {
    const packageJson = readSource('package.json')
    const deployScript = readSource('scripts/deploy-electron-update.sh')

    expect(packageJson).toContain('"electron:patch-builder": "node scripts/patch-electron-builder-dependency-parser.cjs"')
    expect(packageJson).toContain('npm run electron:patch-builder && electron-builder --config electron-builder.yml')
    expect(deployScript).toContain('npm run electron:build')
    expect(deployScript).not.toContain('npx electron-builder --config electron-builder.yml')
  })
})
