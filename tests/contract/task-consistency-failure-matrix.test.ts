import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

interface FailureVector {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'automated' | 'live-proven'
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

    expect(matrix.schemaVersion).toBe('flowstate-task-consistency-matrix-v1')
    expect([...matrix.requiredMutations].sort()).toEqual([...coveredMutations].sort())
    expect([...matrix.requiredStates].sort()).toEqual([...coveredStates].sort())
  })

  it('does not call a vector automated without executable evidence', () => {
    const matrix = loadMatrix()
    const invalid = matrix.vectors.filter(vector => (
      vector.status !== 'open'
      && vector.automatedEvidence.length === 0
    ))

    expect(invalid).toEqual([])
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
})
