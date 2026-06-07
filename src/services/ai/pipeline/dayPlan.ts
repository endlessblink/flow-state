import type { CanvasGroup } from '@/types/canvas'
import type { Task } from '@/types/tasks'
import { CANVAS } from '@/constants/canvas'
import { findMatchingGroupForDueDate } from '@/composables/canvas/useSmartGroupMatcher'
import { formatDateKey } from '@/utils/dateUtils'

type PlanTask = { id: string; [key: string]: unknown }

export interface DayPlanGroup {
  name: string
  tasks: PlanTask[]
}

export interface DayPlanUpdateResult {
  taskUpdates: Array<{ id: string; updates: Partial<Task> }>
  targetGroupName: string | null
  plannedCount: number
}

export function isOverwhelmedDayPlanRequest(message: string): boolean {
  const q = message.toLowerCase()
  return [
    'overwhelmed',
    'overloaded',
    'too much',
    'reorder my day',
    'i have too much',
    'אני מוצף',
    'אני מוצפת',
    'עמוס',
    'עמוסה',
    'יותר מדי',
    'תסדר לי את היום',
    'סדר לי את היום',
  ].some(trigger => q.includes(trigger))
}

/**
 * TASK-1821: normalize text for intent routing — NFC, strip Hebrew niqqud/cantillation,
 * lowercase Latin, collapse whitespace. Hebrew has no word boundaries and attaches
 * particles (ב/ל/ה/ש/מ/כ/ו), so substring matching on a normalized key is more robust.
 */
export function normalizeForRouting(message: string): string {
  return message
    .normalize('NFC')
    .replace(/[֑-ׇ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * TASK-1821: is this a FORWARD planning request ("plan my week/day")?
 *
 * The decisive signal is the predicate/tense, NOT the time word — so this must
 * beat the bare "week"/"השבוע" keyword that previously misrouted planning into
 * the retrospective `get_weekly_summary`. Returns false when a retrospective
 * predicate is present, so "summarize my week" / "מה עשיתי השבוע" stay summaries.
 * Particle prefixes are handled by substring matching on the verb root
 * (e.g. "לתכנן"/"מתכנן" both contain "תכנן").
 */
export function isWeekPlanRequest(message: string): boolean {
  const q = normalizeForRouting(message)

  // Retrospective guard — past/completion intent is never forward planning.
  const retrospective = [
    'summary', 'summarize', 'summarise', 'recap', 'review of', 'what did i', 'did i',
    'completed', 'accomplished', 'stats', 'statistics',
    'סיכום', 'סכם', 'מה עשיתי', 'מה סיימתי', 'מה השלמתי', 'מה הספקתי',
  ]
  if (retrospective.some(t => q.includes(t))) return false

  // Strong planning verbs — unambiguous, match on their own.
  const strong = [
    'plan my', 'plan the', 'plan for', 'plan out', 'plan tomorrow', 'plan today',
    'help me plan', 'schedule my', 'lay out my', 'map out my',
    'תכנן', 'תכנון', 'סדר לי את השבוע', 'סדר לי את היום',
  ]
  if (strong.some(t => q.includes(t))) return true

  // Weak predicates ("what should I do", "מה לעשות") overlap with suggest_next_task,
  // so only treat them as a week/day PLAN when an explicit horizon word is present.
  const weak = [
    'what should i do', 'what to do', 'what can i do', 'what can i finish', 'what next',
    'מה לעשות', 'מה כדאי', 'על מה לעבוד', 'מה הבא',
  ]
  const horizon = ['this week', 'next week', 'today', 'tomorrow', 'שבוע', 'היום', 'מחר']
  const hasHorizon = horizon.some(t => q.includes(t))
  // A bare "plan" verb (word-boundary, so not "explain"/"plant") + a horizon also
  // counts — covers code-switched "plan לי את השבוע".
  if (/\bplan\b/.test(q) && hasHorizon) return true
  return weak.some(t => q.includes(t)) && hasHorizon
}

export function flattenDayPlanTaskIds(groups: DayPlanGroup[]): string[] {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const group of groups) {
    for (const task of group.tasks) {
      if (!task?.id || seen.has(task.id)) continue
      seen.add(task.id)
      ids.push(task.id)
    }
  }
  return ids
}

function planStackPosition(group: CanvasGroup, index: number): { x: number; y: number } {
  const groupX = group.position?.x ?? 0
  const groupY = group.position?.y ?? 0
  const groupWidth = group.position?.width ?? CANVAS.DEFAULT_GROUP_WIDTH
  const taskWidth = CANVAS.DEFAULT_TASK_WIDTH
  const taskHeight = CANVAS.DEFAULT_TASK_HEIGHT
  const padding = 20
  const headerHeight = 50
  const gap = 10
  const x = Math.max(
    groupX + padding,
    Math.min(groupX + padding, groupX + groupWidth - taskWidth - padding),
  )
  return { x, y: groupY + headerHeight + padding + index * (taskHeight + gap) }
}

export function buildDayPlanTaskUpdates(
  groups: DayPlanGroup[],
  allTasks: Task[],
  allGroups: CanvasGroup[],
  today = formatDateKey(new Date()),
): DayPlanUpdateResult {
  const plannedIds = flattenDayPlanTaskIds(groups)
  const plannedIdSet = new Set(plannedIds)
  const tasksById = new Map(allTasks.map(task => [task.id, task]))
  const plannedTasks = plannedIds
    .map(id => tasksById.get(id))
    .filter((task): task is Task => !!task && task.status !== 'done')

  if (plannedTasks.length === 0) {
    return { taskUpdates: [], targetGroupName: null, plannedCount: 0 }
  }

  const targetGroup = findMatchingGroupForDueDate(today, allGroups)
  if (!targetGroup?.position) {
    return {
      taskUpdates: plannedTasks.map(task => ({ id: task.id, updates: { dueDate: today } })),
      targetGroupName: null,
      plannedCount: plannedTasks.length,
    }
  }

  const existingInTarget = allTasks
    .filter(task =>
      task.id &&
      !plannedIdSet.has(task.id) &&
      task.status !== 'done' &&
      task.parentId === targetGroup.id &&
      !!task.canvasPosition,
    )
    .sort((a, b) => {
      const ay = a.canvasPosition?.y ?? 0
      const by = b.canvasPosition?.y ?? 0
      if (ay !== by) return ay - by
      return (a.canvasPosition?.x ?? 0) - (b.canvasPosition?.x ?? 0)
    })

  const ordered = [...plannedTasks, ...existingInTarget]
  return {
    targetGroupName: targetGroup.name,
    plannedCount: plannedTasks.length,
    taskUpdates: ordered.map((task, index) => {
      const base: Partial<Task> = {
        parentId: targetGroup.id,
        canvasPosition: planStackPosition(targetGroup, index),
        positionFormat: 'absolute',
        isInInbox: false,
        canvasDismissed: false,
      }
      if (plannedIdSet.has(task.id)) base.dueDate = today
      return { id: task.id, updates: base }
    }),
  }
}
