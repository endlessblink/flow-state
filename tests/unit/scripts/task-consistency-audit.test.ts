import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const script = resolve(process.cwd(), 'scripts/task-consistency-audit.cjs')

describe('task consistency audit', () => {
  // Build an isolated fixture repo whose matrix has known-open vectors, so the
  // audit's reporting/fail-closed behavior is asserted independently of the live
  // matrix state (which, once the campaign closes every vector, has zero open).
  function withOpenFixture(run: (fixtureRoot: string) => void) {
    const fixtureRoot = mkdtempSync(resolve(tmpdir(), 'flowstate-matrix-audit-open-'))
    try {
      mkdirSync(resolve(fixtureRoot, 'docs/process'), { recursive: true })
      const matrix = JSON.parse(readFileSync(
        resolve(process.cwd(), 'docs/process/task-consistency-failure-matrix.json'),
        'utf8'
      )) as { vectors: Array<{ id: string; severity: string; status: string }> }
      // Force one critical and one high vector open (evidence arrays untouched).
      const crit = matrix.vectors.find(v => v.severity === 'critical')!
      const high = matrix.vectors.find(v => v.severity === 'high')!
      crit.status = 'open'
      high.status = 'open'
      writeFileSync(
        resolve(fixtureRoot, 'docs/process/task-consistency-failure-matrix.json'),
        JSON.stringify(matrix)
      )
      writeFileSync(resolve(fixtureRoot, 'docs/MASTER_PLAN.md'), readFileSync(
        resolve(process.cwd(), 'docs/MASTER_PLAN.md'),
        'utf8'
      ))
      run(fixtureRoot)
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true })
    }
  }

  it('reports every open cardinal vector as structured JSON', () => {
    withOpenFixture(fixtureRoot => {
      const stdout = execFileSync(process.execPath, [script, '--summary-json'], {
        cwd: fixtureRoot,
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
      expect(report.structuralErrors).toEqual([])
      expect(report.issueCoverage).toMatchObject({
        required: expect.any(Number),
        missingTracking: [],
      })
      expect(report.issueCoverage.required).toBeGreaterThan(0)
      expect(report.issueCoverage.tracked).toBe(report.issueCoverage.required)
      expect(report.dimensionCoverage).toMatchObject({
        mutations: { missing: [] },
        states: { missing: [] },
        surfaces: { missing: [] },
        layers: { missing: [] },
        failureClasses: { missing: [] },
        dataGuarantees: { missing: [] },
      })
    })
  })

  it('fails closed when a release asks for no open cardinal vectors', () => {
    withOpenFixture(fixtureRoot => {
      expect(() => execFileSync(process.execPath, [script, '--fail-on-open'], {
        cwd: fixtureRoot,
        encoding: 'utf8',
      })).toThrow(expect.objectContaining({
        stdout: expect.stringContaining('Open critical/high vectors'),
      }))
    })
  })

  it('the live matrix is release-ready: zero open cardinal vectors and no structural errors', () => {
    const stdout = execFileSync(process.execPath, [script, '--summary-json'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    })
    const report = JSON.parse(stdout) as {
      openCritical: number
      openHigh: number
      structuralErrors: string[]
    }
    expect(report.openCritical).toBe(0)
    expect(report.openHigh).toBe(0)
    expect(report.structuralErrors).toEqual([])
    // --fail-on-open must succeed (exit 0) against the live, fully-closed matrix.
    expect(() => execFileSync(process.execPath, [script, '--fail-on-open'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    })).not.toThrow()
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
