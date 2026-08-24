import type { AIRecommendationFeedback } from '@/types/aiMemory'
import { projectEntityKey, taskEntityKey } from './weeklyMemoryRetrieval'

export type BroadFallbackTask = Record<string, unknown> & { title?: string }

export type BroadFallbackFeedbackSignal = {
  penalty: number
  positiveBoost: number
  suppressed: boolean
}

export function broadFallbackTaskText(task: Record<string, unknown>): string {
  return `${String(task.title || '')} ${String(task.description || '')}`.toLowerCase()
}

export function broadFeedbackMatchesTask(feedback: AIRecommendationFeedback, task: Record<string, unknown>): boolean {
  const taskId = String(task.id || '')
  const projectId = String(task.projectId || '')
  if (feedback.taskId && feedback.taskId === taskId) return true
  if (feedback.entityKey === taskEntityKey(taskId)) return true
  if (feedback.recommendationId && feedback.recommendationId.includes(taskId)) return true
  if (feedback.recommendationId?.startsWith('inline_')) return false
  if (projectId && feedback.entityKey === projectEntityKey(projectId)) return true
  return false
}

export function broadFeedbackSignal(
  task: Record<string, unknown>,
  feedback: AIRecommendationFeedback[] = [],
  now = Date.now(),
): BroadFallbackFeedbackSignal {
  const matching = feedback
    .filter(event => broadFeedbackMatchesTask(event, task))
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
  let penalty = 0
  let positiveBoost = 0
  let suppressed = false
  for (const event of matching.slice(0, 6)) {
    const createdAt = event.createdAt ? Date.parse(event.createdAt) : now
    const ageDays = Number.isFinite(createdAt) ? (now - createdAt) / (24 * 60 * 60 * 1000) : 0
    const revisitAt = event.revisitAt ? Date.parse(event.revisitAt) : null
    const revisitInFuture = revisitAt !== null && Number.isFinite(revisitAt) && revisitAt > now
    if (event.action === 'dismiss') {
      penalty = Math.max(penalty, ageDays < 14 ? 0.9 : 0.45)
      suppressed ||= ageDays < 14
    } else if (event.action === 'postpone') {
      penalty = Math.max(penalty, revisitInFuture ? 0.85 : ageDays < 7 ? 0.55 : 0.25)
      suppressed ||= revisitInFuture || ageDays < 7
    } else if (event.action === 'simplify') {
      penalty = Math.max(penalty, ageDays < 7 ? 0.35 : 0.15)
    } else if (event.action === 'ignore') {
      penalty = Math.max(penalty, ageDays < 7 ? 0.25 : 0.1)
    } else if (event.action === 'accept' || event.action === 'timeblock' || event.implicitPositive) {
      positiveBoost = Math.max(positiveBoost, ageDays < 14 ? 0.25 : 0.1)
    }
  }
  return { penalty, positiveBoost, suppressed }
}

export function scoreBroadFallbackTask(task: Record<string, unknown>, recommendationFeedback: AIRecommendationFeedback[] = []): number {
  const text = broadFallbackTaskText(task)
  let score = 0

  if (task.status === 'in_progress') score += 4
  if (task.priority === 'immediate') score += 7
  if (task.priority === 'high') score += 5
  if (task.priority === 'medium') score += 2
  if (task.priority === 'low' || task.priority === 'relaxed') score += 1
  if (String(task.description || '').trim()) score += 3
  if (/(payment|invoice|cardcom|charge|billing|תשלום|חשבונית|חיוב|קאדרקום)/i.test(text)) score += 8
  if (/(treatment|medicine|dose|twice a day|טיפול|תרופה|מנה|מנות|אוראו|פעמיים ביום)/i.test(text)) score += 7
  if (/(reply|send|call|email|message|stakeholder|להגיב|לשלוח|להתקשר|מייל|הודעה)/i.test(text)) score += 6
  if (/(outreach|cold opener|target list|sales|lead|פייפרפורט|לסקין|רשימת|אאוטריץ|מכירות)/i.test(text)) score += 5
  if (/(lecture|choose|slot|date|הרצאה|לבחור|מועד|תאריך)/i.test(text)) score += 4

  const due = typeof task.dueDate === 'string' ? task.dueDate.slice(0, 10) : ''
  if (due) {
    const today = new Date().toISOString().slice(0, 10)
    if (due < today) score += 6
    else if (due === today) score += 5
    else score += 2
  }
  if (typeof task.daysOverdue === 'number') score += Math.min(6, Math.max(1, task.daysOverdue))
  if (typeof task.estimatedDuration === 'number' && task.estimatedDuration > 0 && task.estimatedDuration <= 30) score += 1

  const feedback = broadFeedbackSignal(task, recommendationFeedback)
  return score + feedback.positiveBoost * 8 - feedback.penalty * 18
}

export function rankBroadFallbackTasks(
  tasks: BroadFallbackTask[],
  recommendationFeedback: AIRecommendationFeedback[] = [],
): BroadFallbackTask[] {
  const ranked = [...tasks].sort((a, b) => scoreBroadFallbackTask(b, recommendationFeedback) - scoreBroadFallbackTask(a, recommendationFeedback))
  const unsuppressed = ranked.filter(task => !broadFeedbackSignal(task, recommendationFeedback).suppressed)
  return unsuppressed.length ? unsuppressed : ranked
}
