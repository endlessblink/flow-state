import { ref, computed } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useSettingsStore } from '@/stores/settings'
import { detectPowerKeyword, DAY_OF_WEEK_KEYWORDS } from '@/composables/usePowerKeywords'
import { useWeeklyPlanAI, type WeeklyPlan, type WeeklyPlanState, type WeeklyPlanStatus, type TaskSummary, type InterviewAnswers } from './useWeeklyPlanAI'
import { useWorkProfile } from '@/composables/useWorkProfile'

// ============================================================================
// Helpers
// ============================================================================

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
type DayKey = typeof DAY_KEYS[number]

// TASK-1321: Parameterized week start to support Sunday or Monday start
function getWeekStart(weekStartsOn: 0 | 1 = 0): Date {
  const now = new Date()
  const day = now.getDay() // 0=Sun, 1=Mon...6=Sat

  if (weekStartsOn === 1) {
    // Monday start: go back to this week's Monday
    const diff = day === 0 ? -6 : 1 - day
    const start = new Date(now)
    start.setDate(now.getDate() + diff)
    start.setHours(0, 0, 0, 0)
    return start
  } else {
    // Sunday start: go back to this week's Sunday
    const start = new Date(now)
    start.setDate(now.getDate() - day)
    start.setHours(0, 0, 0, 0)
    return start
  }
}

function getWeekEnd(weekStartsOn: 0 | 1 = 0): Date {
  const start = getWeekStart(weekStartsOn)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return end
}

// BUG-1321: Use local date (not UTC) to avoid timezone-related overdue false positives
function formatDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ============================================================================
// Composable
// ============================================================================

export function useWeeklyPlan() {
  const settings = useSettingsStore()

  const state = ref<WeeklyPlanState>({
    status: 'idle',
    plan: null,
    reasoning: null,
    error: null,
    weekStart: getWeekStart(settings.weekStartsOn),
    weekEnd: getWeekEnd(settings.weekStartsOn),
    interviewAnswers: null,
  })

  const { generatePlan: aiGeneratePlan, regenerateDay: aiRegenerateDay } = useWeeklyPlanAI()
  const { loadProfile, recordWeeklyOutcome, profile: workProfile } = useWorkProfile()

  // --------------------------------------------------------------------------
  // Eligible tasks
  // --------------------------------------------------------------------------

  function getEligibleTasks(): TaskSummary[] {
    const taskStore = useTaskStore()

    // Include all active tasks — the AI decides what fits the week
    const eligible = taskStore.tasks.filter(t => {
      if (t._soft_deleted) return false
      if (t.status === 'done') return false
      return true
    })

    // Priority score for sorting (higher = more important)
    const today = formatDateISO(new Date())
    const priorityScore: Record<string, number> = { high: 3, medium: 2, low: 1 }

    eligible.sort((a, b) => {
      // Overdue tasks first
      const aOverdue = a.dueDate && a.dueDate < today ? 1 : 0
      const bOverdue = b.dueDate && b.dueDate < today ? 1 : 0
      if (aOverdue !== bOverdue) return bOverdue - aOverdue
      // In-progress tasks next
      const aProgress = a.status === 'in_progress' ? 1 : 0
      const bProgress = b.status === 'in_progress' ? 1 : 0
      if (aProgress !== bProgress) return bProgress - aProgress
      // Then by priority
      const pa = a.priority ? priorityScore[a.priority] ?? 0 : 0
      const pb = b.priority ? priorityScore[b.priority] ?? 0 : 0
      if (pa !== pb) return pb - pa
      // Then by due date (earlier first, no date last)
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
      if (a.dueDate) return -1
      if (b.dueDate) return 1
      return 0
    })

    return eligible.slice(0, 50).map(t => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      dueDate: t.dueDate || '',
      estimatedDuration: t.estimatedDuration,
      status: t.status,
      projectId: t.projectId || '',
      description: t.description || '',
      subtaskCount: t.subtasks?.length || 0,
      completedSubtaskCount: t.subtasks?.filter(s => s.isCompleted).length || 0,
    }))
  }

  // --------------------------------------------------------------------------
  // Task map for quick lookup
  // --------------------------------------------------------------------------

  const taskMap = computed(() => {
    const tasks = getEligibleTasks()
    const map = new Map<string, TaskSummary>()
    for (const t of tasks) {
      map.set(t.id, t)
    }
    return map
  })

  // --------------------------------------------------------------------------
  // Generate plan via AI
  // --------------------------------------------------------------------------

  async function generatePlan(interview?: InterviewAnswers) {
    state.value.status = 'loading'
    state.value.error = null
    if (interview) {
      state.value.interviewAnswers = interview
    }

    try {
      const tasks = getEligibleTasks()
      if (tasks.length === 0) {
        state.value.status = 'error'
        state.value.error = 'No eligible tasks found'
        return
      }

      // FEATURE-1317: Load work profile for AI context (if learning enabled)
      const settingsStore = useSettingsStore()
      const profile = settingsStore.aiLearningEnabled ? await loadProfile() : null

      const result = await aiGeneratePlan(tasks, state.value.interviewAnswers || undefined, profile)
      state.value.plan = result.plan
      state.value.reasoning = result.reasoning
      state.value.status = 'review'
    } catch (err) {
      state.value.status = 'error'
      state.value.error = err instanceof Error ? err.message : 'Failed to generate plan'
    }
  }

  // --------------------------------------------------------------------------
  // Move task between days (drag-drop in review UI)
  // --------------------------------------------------------------------------

  function moveTask(taskId: string, fromDay: keyof WeeklyPlan, toDay: keyof WeeklyPlan) {
    if (!state.value.plan) return
    const fromArr = state.value.plan[fromDay]
    const idx = fromArr.indexOf(taskId)
    if (idx !== -1) {
      fromArr.splice(idx, 1)
    }
    state.value.plan[toDay].push(taskId)
  }

  // --------------------------------------------------------------------------
  // Interview mode
  // --------------------------------------------------------------------------

  function startInterview() {
    state.value.status = 'interview'
    state.value.interviewAnswers = null
  }

  function skipInterview() {
    generatePlan()
  }

  function submitInterview(answers: InterviewAnswers) {
    generatePlan(answers)
  }

  // --------------------------------------------------------------------------
  // Quick actions: remove, snooze, priority cycle
  // --------------------------------------------------------------------------

  function removeTaskFromPlan(taskId: string) {
    if (!state.value.plan) return
    const allKeys = [...DAY_KEYS, 'unscheduled'] as const
    for (const key of allKeys) {
      const arr = state.value.plan[key]
      const idx = arr.indexOf(taskId)
      if (idx !== -1) {
        arr.splice(idx, 1)
        break
      }
    }
    // Move to unscheduled
    state.value.plan.unscheduled.push(taskId)
  }

  function snoozeTask(taskId: string) {
    if (!state.value.plan) return
    // Remove from all days (including unscheduled)
    const allKeys = [...DAY_KEYS, 'unscheduled'] as const
    for (const key of allKeys) {
      const arr = state.value.plan[key]
      const idx = arr.indexOf(taskId)
      if (idx !== -1) {
        arr.splice(idx, 1)
        break
      }
    }
    // Task is simply removed from the plan — it stays in the task store
    // and will appear next week as an eligible task
  }

  function changePriority(taskId: string) {
    const taskStore = useTaskStore()
    const task = taskStore.tasks.find(t => t.id === taskId)
    if (!task) return

    const cycle: Array<'low' | 'medium' | 'high' | null> = ['low', 'medium', 'high', null]
    const currentIdx = cycle.indexOf(task.priority)
    const nextPriority = cycle[(currentIdx + 1) % cycle.length]
    taskStore.updateTask(taskId, { priority: nextPriority })
  }

  // --------------------------------------------------------------------------
  // Re-suggest a single day via AI
  // --------------------------------------------------------------------------

  async function regenerateDay(dayKey: typeof DAY_KEYS[number]) {
    if (!state.value.plan) return

    try {
      const tasks = getEligibleTasks()
      const profile = workProfile.value
      const result = await aiRegenerateDay(dayKey, state.value.plan, tasks, profile)

      // Merge result into existing plan
      state.value.plan[dayKey] = result.dayTasks
      state.value.plan.unscheduled = result.unscheduled
      if (result.reasoning) {
        state.value.reasoning = result.reasoning
      }
    } catch (err) {
      console.warn('[WeeklyPlan] Day re-suggest failed', err)
    }
  }

  // --------------------------------------------------------------------------
  // Apply plan: assign tasks to day groups + set dueDates
  // --------------------------------------------------------------------------

  async function applyPlan() {
    if (!state.value.plan) return

    state.value.status = 'applying'

    try {
      const canvasStore = useCanvasStore()
      const taskStore = useTaskStore()
      const plan = state.value.plan

      // Day-of-week index mapping: DAY_OF_WEEK_KEYWORDS uses JS day indices (0=Sun...6=Sat)
      // But we iterate DAY_KEYS as [Mon=0, Tue=1, ...Sun=6] in our array
      // JS Date getDay(): 0=Sun, 1=Mon...6=Sat
      const jsDayIndices = [1, 2, 3, 4, 5, 6, 0] // Mon=1, Tue=2, ...Sun=0

      for (let dayIndex = 0; dayIndex < DAY_KEYS.length; dayIndex++) {
        const dayKey = DAY_KEYS[dayIndex]
        const taskIds = plan[dayKey]
        if (!taskIds || taskIds.length === 0) continue

        // Calculate target date
        const targetDate = new Date(state.value.weekStart)
        targetDate.setDate(state.value.weekStart.getDate() + dayIndex)
        const targetDateISO = formatDateISO(targetDate)

        // Find existing day-of-week group on canvas
        const jsDayIndex = jsDayIndices[dayIndex]
        let groupId: string | null = null

        for (const group of canvasStore.groups) {
          const result = detectPowerKeyword(group.name)
          if (result && result.category === 'day_of_week' && result.value === String(jsDayIndex)) {
            groupId = group.id
            break
          }
        }

        // Create group if none exists
        if (!groupId) {
          const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
          const dayColors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899']

          const newGroup = await canvasStore.createGroup({
            name: dayNames[dayIndex],
            type: 'timeline',
            position: { x: 100 + (dayIndex * 450), y: 100, width: 400, height: 500 },
            color: dayColors[dayIndex],
            layout: 'vertical',
            isVisible: true,
            isCollapsed: false,
            parentGroupId: null,
          })

          if (newGroup) {
            groupId = newGroup.id
          }
        }

        // Assign tasks to group + set dueDate
        // NOTE: Only parentId and dueDate. NEVER set canvasPosition (geometry invariant).
        for (const taskId of taskIds) {
          const updates: Record<string, unknown> = { dueDate: targetDateISO }
          if (groupId) {
            updates.parentId = groupId
          }
          await taskStore.updateTask(taskId, updates)
        }
      }

      // FEATURE-1317: Record weekly outcome for feedback loop
      const settingsStoreForFeedback = useSettingsStore()
      if (settingsStoreForFeedback.aiLearningEnabled) {
        // Collect all planned task IDs from this plan
        const allPlannedIds: string[] = []
        for (const dayKey of DAY_KEYS) {
          allPlannedIds.push(...plan[dayKey])
        }
        if (allPlannedIds.length > 0) {
          // Get completed task IDs from the task store
          const completedIds = taskStore.tasks
            .filter(t => t.status === 'done' && allPlannedIds.includes(t.id))
            .map(t => t.id)
          // Fire-and-forget: record outcome
          recordWeeklyOutcome(allPlannedIds, completedIds)
            .catch(err => console.warn('[WeeklyPlan] Failed to record weekly outcome:', err))
        }
      }

      state.value.status = 'applied'
    } catch (err) {
      state.value.status = 'error'
      state.value.error = err instanceof Error ? err.message : 'Failed to apply plan'
    }
  }

  // --------------------------------------------------------------------------
  // Computed helpers
  // --------------------------------------------------------------------------

  const eligibleTasks = computed(() => getEligibleTasks())
  const eligibleTaskCount = computed(() => getEligibleTasks().length)

  const appliedStats = computed(() => {
    if (state.value.status !== 'applied' || !state.value.plan) return null
    let totalScheduled = 0
    let daysUsed = 0
    for (const dayKey of DAY_KEYS) {
      const count = state.value.plan[dayKey].length
      totalScheduled += count
      if (count > 0) daysUsed++
    }
    return { totalScheduled, daysUsed }
  })

  // --------------------------------------------------------------------------
  // Reset
  // --------------------------------------------------------------------------

  function reset() {
    state.value = {
      status: 'idle',
      plan: null,
      reasoning: null,
      error: null,
      weekStart: getWeekStart(settings.weekStartsOn),
      weekEnd: getWeekEnd(settings.weekStartsOn),
      interviewAnswers: null,
    }
  }

  return {
    state,
    eligibleTasks,
    eligibleTaskCount,
    taskMap,
    generatePlan,
    moveTask,
    removeTaskFromPlan,
    snoozeTask,
    changePriority,
    regenerateDay,
    startInterview,
    skipInterview,
    submitInterview,
    applyPlan,
    reset,
  }
}
