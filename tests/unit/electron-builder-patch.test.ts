import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = resolve(__dirname, '../..')

const readSource = (relativePath: string) =>
  readFileSync(resolve(projectRoot, relativePath), 'utf8')

describe('electron-builder dependency parser patch', () => {
  it('patches the polluted JSON parser start index instead of forcing traversal mode', () => {
    const patchScript = readSource('scripts/patch-electron-builder-dependency-parser.cjs')

    expect(patchScript).toContain('const starts = [bracketOpen, bracketOpenSquare].filter((index) => index >= 0)')
    expect(patchScript).toContain('const start = Math.min(...starts)')
    expect(patchScript).not.toContain('PM.TRAVERSAL')
  })

  it('runs the patch before every tracked Electron packaging path', () => {
    const packageJson = readSource('package.json')
    const deployScript = readSource('scripts/deploy-electron-update.sh')
    const validatorScript = readSource('scripts/validate-electron-vite-env.cjs')

    expect(packageJson).toContain('"electron:patch-builder": "node scripts/patch-electron-builder-dependency-parser.cjs"')
    expect(packageJson).toContain('npm run electron:patch-builder && electron-builder --config electron-builder.yml && node scripts/validate-electron-vite-env.cjs --package')
    expect(deployScript).toContain('npm run electron:patch-builder')
    expect(deployScript).toContain('npx electron-builder --config electron-builder.yml --linux')
    expect(deployScript).toContain('node "$PROJECT_DIR/scripts/validate-electron-vite-env.cjs" --package')
    expect(validatorScript).toContain('/dist/index.html')
    expect(validatorScript).toContain('/dist-electron/main.cjs')
  })
})
