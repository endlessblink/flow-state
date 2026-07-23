import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const script = resolve(process.cwd(), 'scripts/task-consistency-audit.cjs')

describe('task consistency audit', () => {
  it('reports every open cardinal vector as structured JSON', () => {
    const result = spawnSync(process.execPath, [script, '--json'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    })

    expect(result.status).toBe(0)
    const report = JSON.parse(result.stdout) as {
      openCritical: number
      openHigh: number
      vectors: Array<{ id: string; status: string }>
    }
    expect(report.openCritical).toBeGreaterThan(0)
    expect(report.openHigh).toBeGreaterThan(0)
    expect(report.vectors.some(vector => vector.id === 'backup-restore-absolute-data-existence')).toBe(true)
  })

  it('fails closed when a release asks for no open cardinal vectors', () => {
    const result = spawnSync(process.execPath, [script, '--fail-on-open'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    })

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('Open critical/high vectors')
  })
})
