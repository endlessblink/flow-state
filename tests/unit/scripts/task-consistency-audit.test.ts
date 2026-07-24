import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
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
      issueCoverage: {
        required: number
        tracked: number
        evidenceBacked: number
        liveProven: number
        missingTracking: string[]
        unproven: string[]
      }
    }
    expect(report.openCritical).toBeGreaterThan(0)
    expect(report.openHigh).toBeGreaterThan(0)
    expect(report.vectors.some(vector => vector.id === 'backup-restore-absolute-data-existence')).toBe(true)
    expect(report.structuralErrors).toEqual([])
    expect(report.issueCoverage).toMatchObject({
      required: expect.any(Number),
      missingTracking: [],
    })
    expect(report.issueCoverage.required).toBeGreaterThan(0)
    expect(report.issueCoverage.tracked).toBe(report.issueCoverage.required)
    expect(report.issueCoverage.liveProven).toBeLessThan(report.issueCoverage.required)
    expect(report.issueCoverage.unproven.length).toBeGreaterThan(0)
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

  it('fails closed when a v3 matrix removes required issue tracking', () => {
    const fixtureRoot = mkdtempSync(resolve(tmpdir(), 'flowstate-matrix-audit-'))
    const fixtureMatrixPath = resolve(fixtureRoot, 'docs/process/task-consistency-failure-matrix.json')
    const fixtureMasterPlanPath = resolve(fixtureRoot, 'docs/MASTER_PLAN.md')

    try {
      mkdirSync(resolve(fixtureRoot, 'docs/process'), { recursive: true })
      const matrix = JSON.parse(readFileSync(
        resolve(process.cwd(), 'docs/process/task-consistency-failure-matrix.json'),
        'utf8'
      )) as Record<string, unknown>
      delete matrix.requiredIssueSignals
      writeFileSync(fixtureMatrixPath, JSON.stringify(matrix))
      writeFileSync(fixtureMasterPlanPath, readFileSync(
        resolve(process.cwd(), 'docs/MASTER_PLAN.md'),
        'utf8'
      ))

      expect(() => execFileSync(process.execPath, [script, '--summary-json'], {
        cwd: fixtureRoot,
        encoding: 'utf8',
      })).toThrow(expect.objectContaining({
        stdout: expect.stringContaining('v3 matrix is missing requiredIssueSignals'),
      }))
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true })
    }
  })
})
