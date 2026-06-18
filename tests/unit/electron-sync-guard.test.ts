import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = resolve(__dirname, '../..')

const readSource = (relativePath: string) =>
  readFileSync(resolve(projectRoot, relativePath), 'utf8')

describe('Electron sync regression guard', () => {
  it('exposes a single guard command for the auth, sync, delete, and canvas regression suites', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts: Record<string, string>
    }

    const guardCommand = packageJson.scripts['guard:electron-sync']

    expect(guardCommand).toBeDefined()
    expect(guardCommand).toContain('vitest run')
    expect(guardCommand).toContain('tests/unit/stores/auth-flow.test.ts')
    expect(guardCommand).toContain('tests/unit/sync/sync-orchestrator.test.ts')
    expect(guardCommand).toContain('tests/unit/supabase-group-backpressure.test.ts')
    expect(guardCommand).toContain('tests/unit/undo-task-operations.test.ts')
    expect(guardCommand).toContain('tests/unit/geometry-invariants.test.ts')
  })

  it('blocks Electron deploys on the guard unless explicitly skipped for local dry runs', () => {
    const deployScript = readSource('scripts/deploy-electron-update.sh')

    const guardIndex = deployScript.indexOf('npm run guard:electron-sync')
    const buildIndex = deployScript.indexOf('npm run electron:build')
    const uploadIndex = deployScript.indexOf('Deploying to VPS')

    expect(guardIndex).toBeGreaterThan(-1)
    expect(guardIndex).toBeLessThan(buildIndex)
    expect(guardIndex).toBeLessThan(uploadIndex)
    expect(deployScript).toContain('--skip-guard')
    expect(deployScript).toContain('SKIP_GUARD')
  })
})
