import type { Task } from '@/types/tasks'

const POMODORO_MINUTES = 25
const ALLOWED_MINUTES = [15, 30, 60, 90, 120] as const

export interface TaskDurationEvidence {
  minutes: number
  confidence: number
  sampleCount: number
  basis: string
}

function tokens(title: string): Set<string> {
  return new Set(title.toLowerCase().split(/[^a-z0-9א-ת]+/i).filter(word => word.length >= 3))
}

function overlap(left: Set<string>, right: Set<string>): number {
  let count = 0
  for (const token of left) if (right.has(token)) count++
  return count
}

function roundToAllowed(minutes: number): number {
  return ALLOWED_MINUTES.reduce((closest, candidate) =>
    Math.abs(candidate - minutes) < Math.abs(closest - minutes) ? candidate : closest
  )
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/** Build duration evidence from completed task work, without assuming a routine. */
export function getTaskDurationEvidence(task: Task, history: Task[]): TaskDurationEvidence | null {
  const taskTokens = tokens(task.title)
  const measured = history
    .filter(candidate => candidate.status === 'done' && candidate.completedPomodoros > 0)
    .map(candidate => {
      const sharedWords = overlap(taskTokens, tokens(candidate.title))
      const sameProject = Boolean(task.projectId && candidate.projectId === task.projectId)
      const relevant = sharedWords >= 2 || (sameProject && sharedWords >= 1)
      if (!relevant) return null
      return {
        actualMinutes: candidate.completedPomodoros * POMODORO_MINUTES,
        estimatedMinutes: candidate.estimatedDuration,
        sharedWords,
        sameProject,
      }
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)

  if (measured.length === 0) return null

  const actualMinutes = median(measured.map(candidate => candidate.actualMinutes))
  const ratios = measured
    .filter(candidate => typeof candidate.estimatedMinutes === 'number' && candidate.estimatedMinutes > 0)
    .map(candidate => candidate.actualMinutes / (candidate.estimatedMinutes ?? 1))
  const correction = ratios.length >= 3 ? Math.min(2, Math.max(0.75, median(ratios))) : 1
  const minutes = roundToAllowed(actualMinutes * correction)
  const similar = measured.filter(candidate => candidate.sharedWords >= 2).length
  const projectMatches = measured.filter(candidate => candidate.sameProject).length
  const confidence = Math.min(0.95, 0.55 + Math.min(0.25, measured.length * 0.05) + (similar > 0 ? 0.1 : 0))
  const basis = similar > 0
    ? `${measured.length} completed similar task${measured.length === 1 ? '' : 's'} measured from Pomodoros`
    : `${measured.length} completed task${measured.length === 1 ? '' : 's'} in the same project measured from Pomodoros`

  return {
    minutes,
    confidence,
    sampleCount: measured.length,
    basis: `${basis}${projectMatches > 0 && similar === 0 ? ` (${projectMatches} project match${projectMatches === 1 ? '' : 'es'})` : ''}${ratios.length >= 3 ? `; corrected by your ${median(ratios).toFixed(1)}x estimate accuracy` : ''}`,
  }
}
