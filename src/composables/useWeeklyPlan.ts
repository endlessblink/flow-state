import { ref, computed, type Ref } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useSettingsStore } from '@/stores/settings'
import { detectPowerKeyword } from '@/composables/usePowerKeywords'
import { useWeeklyPlanAI, type WeeklyPlan, type WeeklyPlanState, type WeeklyPlanStatus, type TaskSummary, type InterviewAnswers, type BehavioralContext, type DynamicQuestion } from './useWeeklyPlanAI'
import { useWorkProfile } from '@/composables/useWorkProfile'
import { useProjectStore } from '@/stores/projects'
import type { MemoryObservation } from '@/utils/supabaseMappers'
import { formatDateKey as formatDateISO } from '@/utils/dateUtils'

// ============================================================================
// Helpers
// ============================================================================

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

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



// ============================================================================
// Singleton state — persists across navigations AND page refreshes via localStorage
// ============================================================================

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const STORAGE_KEY = 'flowstate-weekly-plan'

let _state: Ref<WeeklyPlanState> | null = null
let _stateCreatedAt = 0

interface StoredPlanState {
  status: WeeklyPlanStatus
  plan: WeeklyPlan | null
  reasoning: string | null
  taskReasons: Record<string, string>
  weekTheme: string | null
  error: string | null
  weekStart: string  // ISO string
  weekEnd: string    // ISO string
  interviewAnswers: InterviewAnswers | null
  skipFeedback: boolean
  savedAt: number
}

function savePlanToStorage(state: WeeklyPlanState) {
  try {
    // Only persist review/applied states — not transient states
    if (state.status !== 'review' && state.status !== 'applied') return
    const stored: StoredPlanState = {
      status: state.status,
      plan: state.plan,
      reasoning: state.reasoning,
      taskReasons: state.taskReasons,
      weekTheme: state.weekTheme,
      error: null,
      weekStart: state.weekStart.toISOString(),
      weekEnd: state.weekEnd.toISOString(),
      interviewAnswers: state.interviewAnswers,
      skipFeedback: state.skipFeedback ?? false,
      savedAt: Date.now(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch {
    // localStorage might be full or unavailable — ignore
  }
}

function loadPlanFromStorage(_weekStartsOn: 0 | 1 = 0): WeeklyPlanState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const stored: StoredPlanState = JSON.parse(raw)

    // Expire after 1 day
    if (Date.now() - stored.savedAt > ONE_DAY_MS) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }

    // Only restore review/applied states
    if (stored.status !== 'review' && stored.status !== 'applied') return null

    return {
      status: stored.status,
      plan: stored.plan,
      reasoning: stored.reasoning,
      taskReasons: stored.taskReasons || {},
      weekTheme: stored.weekTheme || null,
      error: null,
      weekStart: new Date(stored.weekStart),
      weekEnd: new Date(stored.weekEnd),
      interviewAnswers: stored.interviewAnswers,
      skipFeedback: stored.skipFeedback ?? false,
      dynamicQuestions: [],
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

function clearPlanStorage() {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}

function getOrCreateState(weekStartsOn: 0 | 1 = 0): Ref<WeeklyPlanState> {
  const now = Date.now()

  // Expire after 1 day
  if (_state && (now - _stateCreatedAt) > ONE_DAY_MS) {
    _state = null
  }

  if (!_state) {
    // Try restoring from localStorage first
    const restored = loadPlanFromStorage(weekStartsOn)
    if (restored) {
      _state = ref<WeeklyPlanState>(restored)
      _stateCreatedAt = now
      return _state
    }

    _state = ref<WeeklyPlanState>({
      status: 'idle',
      plan: null,
      reasoning: null,
      taskReasons: {},
      weekTheme: null,
      error: null,
      weekStart: getWeekStart(weekStartsOn),
      weekEnd: getWeekEnd(weekStartsOn),
      interviewAnswers: null,
      skipFeedback: false,
      dynamicQuestions: [],
    })
    _stateCreatedAt = now
  }

  return _state
}

// ============================================================================
// Composable
// ============================================================================

export function useWeeklyPlan() {
  const settings = useSettingsStore()

  const state = getOrCreateState(settings.weekStartsOn)

  const { generatePlan: aiGeneratePlan, regenerateDay: aiRegenerateDay, generateDynamicQuestions: aiGenerateDynamicQuestions } = useWeeklyPlanAI()
  const { loadProfile, reloadProfile, computeCapacityMetrics, recordWeeklyOutcome, generateObservationsFromWeeklyOutcome, profile: workProfile } = useWorkProfile()

  // --------------------------------------------------------------------------
  // Eligible tasks
  // --------------------------------------------------------------------------

  function getEligibleTasks(): TaskSummary[] {
    const taskStore = useTaskStore()
    const projectStore = useProjectStore()
    const today = formatDateISO(new Date())
    const weekEnd = formatDateISO(state.value.weekEnd)

    // ── HARD FILTER: Deterministic rules decide what's eligible ──
    // Research consensus: production apps (Motion, Reclaim) use deterministic
    // rules for filtering. LLMs are unreliable at deciding task relevance.
    const eligible = taskStore.tasks.filter(t => {
      if (t._soft_deleted) return false
      if (t.status === 'done') return false

      // HARD EXCLUDE: Task has due date AFTER this week
      // If the user set a future date, they decided it's not for this week.
      // Exception: in_progress tasks (user started it, keep it regardless)
      if (t.dueDate && t.dueDate > weekEnd && t.status !== 'in_progress') return false

      // HARD EXCLUDE: on_hold — user explicitly paused
      if (t.status === 'on_hold') return false

      return true
    })

    // ── SCORING: Sort remaining by relevance (for top-N selection) ──
    const priorityScore: Record<string, number> = { high: 3, medium: 2, low: 1 }

    function relevanceScore(t: typeof eligible[0]): number {
      let score = 0

      // Overdue: MUST be scheduled
      if (t.dueDate && t.dueDate < today) score += 100
      // Due this week: highly relevant
      else if (t.dueDate && t.dueDate <= weekEnd) score += 80

      // In-progress: already started, must continue
      if (t.status === 'in_progress') score += 60
      // Planned: user has actively planned this
      else if (t.status === 'planned') score += 30

      // Priority
      score += (priorityScore[t.priority || ''] || 0) * 10

      // Has estimated duration: user has thought about it
      if (t.estimatedDuration) score += 5

      return score
    }

    // Score, sort, and take top 25 (tighter — only real candidates)
    const scored = eligible.map(t => ({ task: t, score: relevanceScore(t) }))
    scored.sort((a, b) => b.score - a.score)

    const result = scored.slice(0, 25).map(({ task: t }) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      dueDate: t.dueDate || '',
      estimatedDuration: t.estimatedDuration,
      status: t.status,
      projectId: t.projectId || '',
      projectName: t.projectId ? (projectStore.getProjectDisplayName(t.projectId) || '') : '',
      description: t.description || '',
      subtaskCount: t.subtasks?.length || 0,
      completedSubtaskCount: t.subtasks?.filter(s => s.isCompleted).length || 0,
    }))

    console.log(`[WeeklyPlan] Eligible: ${eligible.length} tasks after hard filter (${taskStore.tasks.length} total), sending top ${result.length} to AI`)
    return result
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
  // Behavioral context from actual usage data
  // --------------------------------------------------------------------------

  function computeBehavioralContext(profile: ReturnType<typeof useWorkProfile>['profile']['value']): BehavioralContext {
    const taskStore = useTaskStore()
    const projectStore = useProjectStore()

    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

    // Recently completed tasks (last 2 weeks)
    const recentlyCompleted = taskStore.tasks.filter(t => {
      if (t.status !== 'done') return false
      const completedDate = t.completedAt ? new Date(t.completedAt as string) : null
      return completedDate && completedDate >= twoWeeksAgo
    })

    const recentlyCompletedTitles = recentlyCompleted
      .sort((a, b) => {
        const da = a.completedAt ? new Date(a.completedAt as string).getTime() : 0
        const db = b.completedAt ? new Date(b.completedAt as string).getTime() : 0
        return db - da
      })
      .slice(0, 15)
      .map(t => t.title)

    // Active projects — projects with recently completed or in-progress tasks
    const activeProjectIds = new Set<string>()
    for (const t of recentlyCompleted) {
      if (t.projectId) activeProjectIds.add(t.projectId)
    }
    for (const t of taskStore.tasks) {
      if (t.status === 'in_progress' && t.projectId) activeProjectIds.add(t.projectId)
    }
    const activeProjectNames = Array.from(activeProjectIds)
      .map(id => projectStore.getProjectDisplayName(id))
      .filter(Boolean) as string[]

    // Frequently missed projects from memory observations
    const frequentlyMissedProjects: string[] = []
    const workInsights: string[] = []
    if (profile && profile.memoryGraph) {
      // Map observation relations to actionable planning advice
      const insightMap: Record<string, (obs: MemoryObservation) => string | null> = {
        'overdue_pattern': (obs) => `${obs.value} — prioritize clearing overdue items early in the week`,
        'backlog_heavy': (obs) => `${obs.value} — avoid adding new tasks, focus on clearing existing work`,
        'high_wip': (obs) => `${obs.value} — limit new starts, prioritize finishing in-progress tasks`,
        'underestimates': (obs) => `User ${obs.value} — schedule fewer tasks per day to be realistic`,
        'overestimates': (obs) => `User ${obs.value} — can schedule more tasks per day`,
        'avg_completion_speed': (obs) => `Task completion speed: ${obs.value}`,
        'capacity_gap': (obs) => `Capacity gap: ${obs.value} — schedule conservatively`,
        'stale': (obs) => `${obs.entity.replace('project:', '')} is stale (${obs.value}) — consider scheduling 1 task from it`,
        'most_active': (obs) => `${obs.entity.replace('project:', '')} is the most active project (${obs.value})`,
        'completion_rate': (obs) => `High-priority ${obs.value}`,
      }

      for (const obs of profile.memoryGraph) {
        if (obs.relation === 'frequently_missed' && obs.entity.startsWith('project:')) {
          const projId = obs.entity.replace('project:', '')
          const name = projectStore.getProjectDisplayName(projId)
          if (name) frequentlyMissedProjects.push(name)
        }

        // Generate planning-relevant insights from observations
        const mapper = insightMap[obs.relation]
        if (mapper && obs.confidence >= 0.6) {
          const insight = mapper(obs)
          if (insight) workInsights.push(insight)
        }
      }
    }

    return {
      recentlyCompletedTitles,
      activeProjectNames,
      avgTasksCompletedPerDay: profile?.avgTasksCompletedPerDay ?? null,
      avgWorkMinutesPerDay: profile?.avgWorkMinutesPerDay ?? null,
      peakProductivityDays: profile?.peakProductivityDays ?? [],
      completionRate: profile?.avgPlanAccuracy ?? null,
      frequentlyMissedProjects,
      workInsights,
    }
  }

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

      // FEATURE-1317: Load work profile + auto-refresh insights for AI context
      const settingsStore = useSettingsStore()
      let profile = null
      if (settingsStore.aiLearningEnabled) {
        profile = await loadProfile()
        // Auto-refresh observations so AI always gets current task context
        try {
          await computeCapacityMetrics()
          profile = await reloadProfile()
        } catch (e) {
          console.debug('[WeeklyPlan] Insight refresh skipped:', e)
        }
      }

      // Compute behavioral context from actual app usage data
      const behavioral = computeBehavioralContext(profile)
      console.log('[WeeklyPlan] Behavioral context:', {
        recentCompleted: behavioral.recentlyCompletedTitles.length,
        activeProjects: behavioral.activeProjectNames,
        avgTasks: behavioral.avgTasksCompletedPerDay,
        completionRate: behavioral.completionRate,
      })

      const result = await aiGeneratePlan(tasks, state.value.interviewAnswers || undefined, profile, behavioral)
      state.value.plan = result.plan
      state.value.reasoning = result.reasoning
      state.value.taskReasons = result.taskReasons
      state.value.weekTheme = result.weekTheme
      state.value.status = 'review'
      savePlanToStorage(state.value)
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
    savePlanToStorage(state.value)
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

  async function generateAIQuestions(answers: InterviewAnswers) {
    state.value.interviewAnswers = answers
    state.value.status = 'ai-questions'
    state.value.dynamicQuestions = []

    try {
      const tasks = getEligibleTasks()
      const questions = await aiGenerateDynamicQuestions(tasks, answers.personalContext, answers)

      if (questions.length === 0) {
        // No questions generated — go straight to plan generation
        generatePlan(answers)
        return
      }

      state.value.dynamicQuestions = questions.map((q, i) => ({
        id: `dq-${i}`,
        question: q,
        answer: '',
      }))
      // UI will now show the questions
    } catch (err) {
      console.warn('[WeeklyPlan] Dynamic question generation failed, proceeding to plan:', err)
      generatePlan(answers)
    }
  }

  function submitDynamicAnswers(answeredQuestions: DynamicQuestion[]) {
    const updatedAnswers: InterviewAnswers = {
      ...state.value.interviewAnswers!,
      dynamicAnswers: answeredQuestions,
    }
    state.value.interviewAnswers = updatedAnswers
    generatePlan(updatedAnswers)
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
    savePlanToStorage(state.value)
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
    savePlanToStorage(state.value)
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
      savePlanToStorage(state.value)
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
      if (settingsStoreForFeedback.aiLearningEnabled && !state.value.skipFeedback) {
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
          // Fire-and-forget: record outcome + generate observations
          recordWeeklyOutcome(allPlannedIds, completedIds)
            .then(() => {
              // FEATURE-1317 Phase 2: Generate structured observations from this week's data
              return generateObservationsFromWeeklyOutcome(allPlannedIds, completedIds, taskStore)
            })
            .catch(err => console.warn('[WeeklyPlan] Failed to record weekly outcome:', err))
        }
      }

      state.value.status = 'applied'
      savePlanToStorage(state.value)
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

  const _appliedStats = computed(() => {
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
  // Accuracy data from work profile
  // --------------------------------------------------------------------------

  const lastWeekAccuracy = computed(() => {
    const history = workProfile.value?.weeklyHistory
    if (!history || history.length === 0) return null
    return history[history.length - 1].accuracy
  })

  const avgAccuracy = computed(() => {
    return workProfile.value?.avgPlanAccuracy ?? null
  })

  function setSkipFeedback(val: boolean) {
    state.value.skipFeedback = val
    savePlanToStorage(state.value)
  }

  // --------------------------------------------------------------------------
  // Reset
  // --------------------------------------------------------------------------

  function reset() {
    state.value = {
      status: 'idle',
      plan: null,
      reasoning: null,
      taskReasons: {},
      weekTheme: null,
      error: null,
      weekStart: getWeekStart(settings.weekStartsOn),
      weekEnd: getWeekEnd(settings.weekStartsOn),
      interviewAnswers: null,
      skipFeedback: false,
      dynamicQuestions: [],
    }
    _stateCreatedAt = Date.now()
    clearPlanStorage()
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
    generateAIQuestions,
    submitDynamicAnswers,
    applyPlan,
    reset,
    lastWeekAccuracy,
    avgAccuracy,
    setSkipFeedback,
  }
}
