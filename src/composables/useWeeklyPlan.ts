import { ref, computed } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { detectPowerKeyword, DAY_OF_WEEK_KEYWORDS } from '@/composables/usePowerKeywords'
import { useWeeklyPlanAI, type WeeklyPlan, type WeeklyPlanState, type WeeklyPlanStatus, type TaskSummary } from './useWeeklyPlanAI'

// ============================================================================
// Helpers
// ============================================================================

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
type DayKey = typeof DAY_KEYS[number]

function getWeekStart(): Date {
  const now = new Date()
  const day = now.getDay() // 0=Sun, 1=Mon...6=Sat
  // If today is Monday, use today. Otherwise advance to next Monday.
  const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function getWeekEnd(): Date {
  const monday = getWeekStart()
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return sunday
}

function formatDateISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

// ============================================================================
// Composable
// ============================================================================

export function useWeeklyPlan() {
  const state = ref<WeeklyPlanState>({
    status: 'idle',
    plan: null,
    reasoning: null,
    error: null,
    weekStart: getWeekStart(),
    weekEnd: getWeekEnd(),
  })

  const { generatePlan: aiGeneratePlan } = useWeeklyPlanAI()

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

  async function generatePlan() {
    state.value.status = 'loading'
    state.value.error = null

    try {
      const tasks = getEligibleTasks()
      if (tasks.length === 0) {
        state.value.status = 'error'
        state.value.error = 'No eligible tasks found'
        return
      }

      const result = await aiGeneratePlan(tasks)
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
      weekStart: getWeekStart(),
      weekEnd: getWeekEnd(),
    }
  }

  return {
    state,
    eligibleTasks,
    eligibleTaskCount,
    taskMap,
    generatePlan,
    moveTask,
    applyPlan,
    reset,
  }
}
