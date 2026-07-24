import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

interface FailureVector {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'automated' | 'live-proven'
  failureClasses: string[]
  mutations: string[]
  surfaces: string[]
  states: string[]
  layers: string[]
  automatedEvidence: string[]
  liveEvidence: string[]
}

interface FailureMatrix {
  schemaVersion: string
  requiredMutations: string[]
  requiredStates: string[]
  requiredSurfaces: string[]
  requiredLayers: string[]
  requiredFailureClasses: string[]
  requiredDataGuarantees: string[]
  historyAudit: {
    reviewedThrough: string
    sources: string[]
    gitCommitSignals: string[]
    testSignals: string[]
    clusters: Array<{
      id: string
      issueSignals: string[]
      vectorIds: string[]
    }>
  }
  vectors: FailureVector[]
}

const matrixPath = resolve(process.cwd(), 'docs/process/task-consistency-failure-matrix.json')

function loadMatrix(): FailureMatrix {
  return JSON.parse(readFileSync(matrixPath, 'utf8')) as FailureMatrix
}

describe('cardinal task consistency failure matrix', () => {
  it('tracks every required mutation and failure state with an executable vector', () => {
    expect(existsSync(matrixPath)).toBe(true)
    const matrix = loadMatrix()
    const coveredMutations = new Set(matrix.vectors.flatMap(vector => vector.mutations))
    const coveredStates = new Set(matrix.vectors.flatMap(vector => vector.states))
    const coveredSurfaces = new Set(matrix.vectors.flatMap(vector => vector.surfaces))
    const coveredLayers = new Set(matrix.vectors.flatMap(vector => vector.layers))
    const coveredFailureClasses = new Set(matrix.vectors.flatMap(vector => vector.failureClasses))

    expect(matrix.schemaVersion).toBe('flowstate-task-consistency-matrix-v2')
    expect([...matrix.requiredMutations].sort()).toEqual([...coveredMutations].sort())
    expect([...matrix.requiredStates].sort()).toEqual([...coveredStates].sort())
    expect([...matrix.requiredSurfaces].sort()).toEqual([...coveredSurfaces].sort())
    expect([...matrix.requiredLayers].sort()).toEqual([...coveredLayers].sort())
    expect([...matrix.requiredFailureClasses].sort()).toEqual([...coveredFailureClasses].sort())
  })

  it('covers the failure classes repeatedly found in FlowState history', () => {
    const matrix = loadMatrix()

    expect(matrix.requiredFailureClasses).toEqual(expect.arrayContaining([
      'identity-and-field-mapping',
      'optimistic-rollback',
      'queue-ordering-and-replay',
      'auth-expiry-and-recovery',
      'workspace-scope-isolation',
      'realtime-gap-recovery',
      'concurrent-conflict-resolution',
      'cache-corruption-and-stale-snapshots',
      'recurrence-lifecycle',
      'timezone-and-date-projection',
      'selection-and-filter-scope',
      'delete-tombstone-and-undo',
      'hierarchy-and-project-integrity',
      'canvas-geometry-persistence',
      'timer-cross-runtime-coordination',
      'external-contract-drift',
      'backup-restore-and-inventory',
      'updater-artifact-and-live-runtime',
      'service-worker-cache-skew',
      'cross-tab-echo-and-deduplication',
      'partial-batch-atomicity',
      'write-failure-visibility',
    ]))
  })

  it('maps a broad, deduplicated history census to executable failure vectors', () => {
    const matrix = loadMatrix()
    const vectorIds = new Set(matrix.vectors.map(vector => vector.id))
    const issueSignals = matrix.historyAudit.clusters.flatMap(cluster => cluster.issueSignals)
    const masterPlan = readFileSync(resolve(process.cwd(), 'docs/MASTER_PLAN.md'), 'utf8')
    const gitCommits = execFileSync('git', ['log', '--all', '--format=%H'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    }).split('\n').filter(Boolean)
    const missingVectors = matrix.historyAudit.clusters.flatMap(cluster => (
      cluster.vectorIds
        .filter(vectorId => !vectorIds.has(vectorId))
        .map(vectorId => `${cluster.id}: ${vectorId}`)
    ))

    expect(matrix.historyAudit.reviewedThrough).toBe('2026-07-24')
    expect(matrix.historyAudit.sources).toEqual(expect.arrayContaining([
      'docs/MASTER_PLAN.md',
      'git log --all',
      'tests',
    ]))
    expect(matrix.historyAudit.clusters.length).toBeGreaterThanOrEqual(10)
    expect(new Set(issueSignals).size).toBeGreaterThanOrEqual(50)
    expect(issueSignals.every(signal => /^(BUG|TASK)-\d+$/.test(signal))).toBe(true)
    expect(issueSignals.filter(signal => !masterPlan.includes(signal))).toEqual([])
    expect(new Set(matrix.historyAudit.gitCommitSignals).size).toBe(matrix.historyAudit.gitCommitSignals.length)
    expect(matrix.historyAudit.gitCommitSignals.length).toBeGreaterThanOrEqual(10)
    expect(matrix.historyAudit.gitCommitSignals.filter(signal => (
      !gitCommits.some(commit => commit.startsWith(signal))
    ))).toEqual([])
    expect(new Set(matrix.historyAudit.testSignals).size).toBe(matrix.historyAudit.testSignals.length)
    expect(matrix.historyAudit.testSignals.length).toBeGreaterThanOrEqual(10)
    expect(matrix.historyAudit.testSignals.filter(path => (
      !existsSync(resolve(process.cwd(), path))
    ))).toEqual([])
    expect(missingVectors).toEqual([])
  })

  it('does not call a vector automated without executable evidence', () => {
    const matrix = loadMatrix()
    const invalid = matrix.vectors.filter(vector => (
      vector.status !== 'open'
      && vector.automatedEvidence.length === 0
    ))

    expect(invalid).toEqual([])
  })

  it('treats absolute existence and recoverability as release requirements', () => {
    const matrix = loadMatrix()

    expect(matrix.requiredDataGuarantees).toEqual(expect.arrayContaining([
      'server-read-after-write',
      'independent-client-readback',
      'renderer-reload-readback',
      'electron-restart-readback',
      'complete-task-inventory',
      'backup-artifact-integrity',
      'tombstone-aware-restore',
      'restore-round-trip',
      'point-in-time-recovery-drill',
    ]))
  })

  it('tracks shared recovery as distinct ownership and recoverability failure classes', () => {
    const vectorIds = new Set(loadMatrix().vectors.map(vector => vector.id))

    expect([...vectorIds]).toEqual(expect.arrayContaining([
      'mixed-scope-backup-personal-row-recovery-isolation',
      'shared-tombstone-workspace-provenance',
      'shared-restore-membership-transition-race',
      'shared-restore-deleted-workspace-orphan-recovery',
      'shared-restore-assignee-and-reference-rebinding',
      'shared-restore-cross-workspace-id-collision',
    ]))
  })

  it('keeps every automated evidence path executable and present', () => {
    const matrix = loadMatrix()
    const missing = matrix.vectors.flatMap(vector => (
      vector.automatedEvidence
        .filter(path => !existsSync(resolve(process.cwd(), path)))
        .map(path => `${vector.id}: ${path}`)
    ))

    expect(missing).toEqual([])
  })

  it('does not call a vector live-proven without recorded user-surface evidence', () => {
    const matrix = loadMatrix()
    const invalid = matrix.vectors.filter(vector => (
      vector.status === 'live-proven'
      && vector.liveEvidence.length === 0
    ))

    expect(invalid).toEqual([])
  })

  it('keeps open high-severity vectors explicit until practical proof exists', () => {
    const matrix = loadMatrix()
    const invalid = matrix.vectors.filter(vector => (
      vector.status === 'open'
      && !['critical', 'high'].includes(vector.severity)
    ))

    expect(invalid).toEqual([])
  })

  it('clears test-user tombstones after destructive fixture cleanup', () => {
    const setup = readFileSync(resolve(process.cwd(), 'tests/global-setup.ts'), 'utf8')
    const taskCleanup = setup.indexOf("from('tasks').delete().eq('user_id', userId)")
    const projectCleanup = setup.indexOf("from('projects').delete().eq('user_id', userId)")
    const tombstoneCleanup = setup.indexOf("from('tombstones').delete().eq('user_id', userId)")
    const taskSeed = setup.indexOf("from('tasks').insert([")

    expect(taskCleanup).toBeGreaterThan(-1)
    expect(projectCleanup).toBeGreaterThan(taskCleanup)
    expect(tombstoneCleanup).toBeGreaterThan(projectCleanup)
    expect(taskSeed).toBeGreaterThan(tombstoneCleanup)
  })
})
