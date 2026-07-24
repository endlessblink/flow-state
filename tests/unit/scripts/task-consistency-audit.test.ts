import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const script = resolve(process.cwd(), 'scripts/task-consistency-audit.cjs')

describe('task consistency audit', () => {
  it('reports every open cardinal vector as structured JSON', () => {
    const stdout = execFileSync(process.execPath, [script, '--summary-json'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    })

    const report = JSON.parse(stdout) as {
      openCritical: number
      openHigh: number
      vectors: Array<{ id: string; status: string }>
      structuralErrors: string[]
      dimensionCoverage: Record<string, { required: number; covered: number; missing: string[] }>
    }
    expect(report.openCritical).toBeGreaterThan(0)
    expect(report.openHigh).toBeGreaterThan(0)
    expect(report.vectors.some(vector => vector.id === 'backup-restore-absolute-data-existence')).toBe(true)
    expect(report.structuralErrors).toEqual([])
    expect(report.dimensionCoverage).toMatchObject({
      mutations: { missing: [] },
      states: { missing: [] },
      surfaces: { missing: [] },
      layers: { missing: [] },
      failureClasses: { missing: [] },
      dataGuarantees: { missing: [] },
    })
  })

  it('fails closed when a release asks for no open cardinal vectors', () => {
    expect(() => execFileSync(process.execPath, [script, '--fail-on-open'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    })).toThrow(expect.objectContaining({
      stdout: expect.stringContaining('Open critical/high vectors'),
    }))
  })
})
