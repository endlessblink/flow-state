import { ref, computed } from 'vue'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
import { useTaskStore } from '@/stores/tasks'
import type { WorkProfile, MemoryObservation } from '@/utils/supabaseMappers'

const cachedProfile = ref<WorkProfile | null>(null)
const isLoading = ref(false)

export function useWorkProfile() {
  const db = useSupabaseDatabase()

  const hasCompletedInterview = computed(() => cachedProfile.value?.interviewCompleted ?? false)
  const profile = computed(() => cachedProfile.value)

  async function loadProfile(): Promise<WorkProfile | null> {
    if (cachedProfile.value) return cachedProfile.value
    if (isLoading.value) return null

    isLoading.value = true
    try {
      const result = await db.fetchWorkProfile()
      cachedProfile.value = result
      return result
    } finally {
      isLoading.value = false
    }
  }

  /** Force-reload profile from DB (bypasses cache) */
  async function reloadProfile(): Promise<WorkProfile | null> {
    cachedProfile.value = null
    isLoading.value = true
    try {
      const result = await db.fetchWorkProfile()
      cachedProfile.value = result
      return result
    } finally {
      isLoading.value = false
    }
  }

  async function savePreferences(prefs: Partial<WorkProfile>): Promise<void> {
    await db.saveWorkProfile({
      ...prefs,
      interviewCompleted: true
    })
    // Update cache
    if (cachedProfile.value) {
      Object.assign(cachedProfile.value, prefs, { interviewCompleted: true })
    } else {
      cachedProfile.value = {
        id: '',
        userId: '',
        workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        daysOff: [],
        heavyMeetingDays: [],
        maxTasksPerDay: 6,
        preferredWorkStyle: 'balanced',
        topPriorityNote: null,
        avgWorkMinutesPerDay: null,
        avgTasksCompletedPerDay: null,
        peakProductivityDays: null,
        avgPlanAccuracy: null,
        weeklyHistory: [],
        profileVersion: 1,
        interviewCompleted: true,
        ...prefs
      } as WorkProfile
    }
  }

  async function computeCapacityMetrics(): Promise<{
    avgMinutesPerDay: number | null
    avgTasksPerDay: number | null
    peakDays: string[]
    dataSources: string[]
  }> {
    const taskStore = useTaskStore()
    const now = new Date()
    const sinceDate = new Date()
    sinceDate.setDate(now.getDate() - 28)

    // --- Source 1: Pomodoro history (focused time tracking) ---
    const history = await db.fetchPomodoroHistory(28)
    const pomodoroMap = new Map<string, { minutes: number; tasks: Set<string> }>()
    const pomoDayOfWeek = new Map<string, number[]>()

    for (const entry of history) {
      if (entry.isBreak) continue
      const date = entry.completedAt.split('T')[0]
      const dayOfWeek = new Date(entry.completedAt).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()

      if (!pomodoroMap.has(date)) {
        pomodoroMap.set(date, { minutes: 0, tasks: new Set() })
      }
      const dayData = pomodoroMap.get(date)!
      dayData.minutes += Math.round(entry.duration / 60)
      if (entry.taskId) dayData.tasks.add(entry.taskId)

      if (!pomoDayOfWeek.has(dayOfWeek)) {
        pomoDayOfWeek.set(dayOfWeek, [])
      }
      pomoDayOfWeek.get(dayOfWeek)!.push(Math.round(entry.duration / 60))
    }

    // --- Source 2: Completed tasks (from task store) ---
    const completedTasks = taskStore.tasks.filter(t => {
      if (t.status !== 'done') return false
      const cat = t.completedAt
      if (!cat) return false
      const completedDate = cat instanceof Date ? cat : new Date(cat)
      return completedDate >= sinceDate && completedDate <= now
    })

    const taskCompletionMap = new Map<string, number>()
    const taskDayOfWeek = new Map<string, number[]>()

    for (const task of completedTasks) {
      const completedDate = task.completedAt instanceof Date ? task.completedAt : new Date(task.completedAt!)
      const dateStr = completedDate.toISOString().split('T')[0]
      const dayOfWeek = completedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()

      taskCompletionMap.set(dateStr, (taskCompletionMap.get(dateStr) || 0) + 1)

      if (!taskDayOfWeek.has(dayOfWeek)) {
        taskDayOfWeek.set(dayOfWeek, [])
      }
      taskDayOfWeek.get(dayOfWeek)!.push(1)
    }

    const hasPomodoroData = pomodoroMap.size > 0
    const hasTaskData = taskCompletionMap.size > 0
    const dataSources: string[] = []

    if (!hasPomodoroData && !hasTaskData) {
      return { avgMinutesPerDay: null, avgTasksPerDay: null, peakDays: [], dataSources: [] }
    }

    // --- Compute avgMinutesPerDay from pomodoro (only source for time) ---
    let avgMinutesPerDay: number | null = null
    if (hasPomodoroData) {
      const pomoDays = Array.from(pomodoroMap.values())
      avgMinutesPerDay = Math.round(pomoDays.reduce((sum, d) => sum + d.minutes, 0) / pomoDays.length * 10) / 10
      dataSources.push('pomodoro')
    }

    // --- Compute avgTasksPerDay from task completions (more accurate than pomodoro alone) ---
    let avgTasksPerDay: number | null = null
    if (hasTaskData) {
      const taskDays = Array.from(taskCompletionMap.values())
      avgTasksPerDay = Math.round(taskDays.reduce((sum, count) => sum + count, 0) / taskDays.length * 10) / 10
      dataSources.push('tasks')
    } else if (hasPomodoroData) {
      // Fallback: count unique tasks from pomodoro sessions
      const pomoDays = Array.from(pomodoroMap.values())
      avgTasksPerDay = Math.round(pomoDays.reduce((sum, d) => sum + d.tasks.size, 0) / pomoDays.length * 10) / 10
    }

    // --- Compute peakDays from whichever source has data ---
    let peakDays: string[] = []
    if (hasTaskData) {
      // Prefer task completions for peak days (captures all work, not just timed)
      const dayTotals = new Map<string, number>()
      for (const [day, counts] of taskDayOfWeek) {
        dayTotals.set(day, counts.length)
      }
      peakDays = Array.from(dayTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([day]) => day)
    } else if (hasPomodoroData) {
      const dayAvgs = Array.from(pomoDayOfWeek.entries())
        .map(([day, mins]) => ({ day, avg: mins.reduce((a, b) => a + b, 0) / mins.length }))
        .sort((a, b) => b.avg - a.avg)
      peakDays = dayAvgs.slice(0, 2).map(d => d.day)
    }

    // Save computed metrics to profile
    await db.saveWorkProfile({
      avgWorkMinutesPerDay: avgMinutesPerDay,
      avgTasksCompletedPerDay: avgTasksPerDay,
      peakProductivityDays: peakDays
    })

    if (cachedProfile.value) {
      cachedProfile.value.avgWorkMinutesPerDay = avgMinutesPerDay
      cachedProfile.value.avgTasksCompletedPerDay = avgTasksPerDay
      cachedProfile.value.peakProductivityDays = peakDays
    }

    // FEATURE-1317 Phase 2: Generate structured observations from stats
    await generateObservationsFromStats()

    return { avgMinutesPerDay, avgTasksPerDay, peakDays, dataSources }
  }

  async function recordWeeklyOutcome(
    plannedTaskIds: string[],
    completedTaskIds: string[]
  ): Promise<void> {
    const planned = plannedTaskIds.length
    if (planned === 0) return

    const completed = completedTaskIds.filter(id => plannedTaskIds.includes(id)).length
    const accuracy = Math.round((completed / planned) * 100 * 100) / 100

    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - 7)
    const entry = {
      weekStart: weekStart.toISOString().split('T')[0],
      plannedCount: planned,
      completedCount: completed,
      accuracy
    }

    const currentHistory = cachedProfile.value?.weeklyHistory || []
    const newHistory = [...currentHistory, entry].slice(-8) // Keep last 8 weeks

    const avgAccuracy = newHistory.length > 0
      ? Math.round(newHistory.reduce((sum, w) => sum + w.accuracy, 0) / newHistory.length * 100) / 100
      : null

    await db.saveWorkProfile({
      weeklyHistory: newHistory,
      avgPlanAccuracy: avgAccuracy
    })

    if (cachedProfile.value) {
      cachedProfile.value.weeklyHistory = newHistory
      cachedProfile.value.avgPlanAccuracy = avgAccuracy
    }
  }

  async function addMemoryObservation(obs: Omit<MemoryObservation, 'createdAt'>): Promise<void> {
    const current = cachedProfile.value?.memoryGraph || []

    // Dedup: if same entity+relation exists, update it
    const existingIdx = current.findIndex(o => o.entity === obs.entity && o.relation === obs.relation)
    const newObs: MemoryObservation = { ...obs, createdAt: new Date().toISOString() }

    let updated: MemoryObservation[]
    if (existingIdx !== -1) {
      updated = [...current]
      updated[existingIdx] = newObs
    } else {
      updated = [...current, newObs]
    }

    // Cap at 30 observations (FIFO)
    if (updated.length > 30) {
      updated = updated.slice(updated.length - 30)
    }

    await db.saveWorkProfile({ memoryGraph: updated })
    if (cachedProfile.value) {
      cachedProfile.value.memoryGraph = updated
    }
  }

  async function generateObservationsFromStats(): Promise<void> {
    const p = cachedProfile.value
    if (!p) return

    const observations: Omit<MemoryObservation, 'createdAt'>[] = []

    // Peak productivity days
    if (p.peakProductivityDays?.length) {
      for (const day of p.peakProductivityDays) {
        observations.push({
          entity: `day:${day}`,
          relation: 'peak_productivity',
          value: 'consistently highest output',
          confidence: 0.85,
          source: 'pomodoro_data'
        })
      }
    }

    // Capacity gap: completes fewer tasks than planned
    if (p.avgTasksCompletedPerDay && p.maxTasksPerDay && p.avgTasksCompletedPerDay < p.maxTasksPerDay * 0.7) {
      observations.push({
        entity: 'user',
        relation: 'capacity_gap',
        value: `completes ${p.avgTasksCompletedPerDay.toFixed(1)} but plans for ${p.maxTasksPerDay}`,
        confidence: 0.7,
        source: 'pomodoro_data'
      })
    }

    // Plan accuracy observations
    if (p.avgPlanAccuracy !== null && p.avgPlanAccuracy !== undefined) {
      if (p.avgPlanAccuracy < 60) {
        observations.push({
          entity: 'user',
          relation: 'overplans',
          value: `only ${p.avgPlanAccuracy.toFixed(0)}% of planned tasks completed`,
          confidence: 0.75,
          source: 'weekly_history'
        })
      } else if (p.avgPlanAccuracy > 90) {
        observations.push({
          entity: 'user',
          relation: 'reliable_planner',
          value: `${p.avgPlanAccuracy.toFixed(0)}% accuracy`,
          confidence: 0.8,
          source: 'weekly_history'
        })
      }
    }

    for (const obs of observations) {
      await addMemoryObservation(obs)
    }
  }

  async function generateObservationsFromWeeklyOutcome(
    plannedTaskIds: string[],
    completedTaskIds: string[],
    taskStore: { tasks: Array<{ id: string; projectId?: string; status: string }> }
  ): Promise<void> {
    if (plannedTaskIds.length === 0) return

    const completedSet = new Set(completedTaskIds)
    const observations: Omit<MemoryObservation, 'createdAt'>[] = []

    // Group missed tasks by project
    const projectMissCount = new Map<string, { missed: number; total: number }>()
    for (const taskId of plannedTaskIds) {
      const task = taskStore.tasks.find(t => t.id === taskId)
      const projectId = task?.projectId || 'uncategorized'
      if (!projectMissCount.has(projectId)) {
        projectMissCount.set(projectId, { missed: 0, total: 0 })
      }
      const counts = projectMissCount.get(projectId)!
      counts.total++
      if (!completedSet.has(taskId)) {
        counts.missed++
      }
    }

    for (const [projectId, counts] of projectMissCount) {
      if (counts.total >= 2 && counts.missed / counts.total > 0.5) {
        observations.push({
          entity: `project:${projectId}`,
          relation: 'frequently_missed',
          value: `${counts.missed} of ${counts.total} tasks missed`,
          confidence: Math.min(0.9, 0.5 + (counts.total * 0.05)),
          source: 'weekly_history'
        })
      }
    }

    // Check day distribution of completed tasks
    const dayCompletions = new Map<string, number>()
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    for (const taskId of completedTaskIds) {
      const task = taskStore.tasks.find(t => t.id === taskId)
      if (task) {
        // Use current day as approximation (tasks may have been completed on different days)
        const today = daysOfWeek[new Date().getDay()]
        dayCompletions.set(today, (dayCompletions.get(today) || 0) + 1)
      }
    }

    for (const obs of observations) {
      await addMemoryObservation(obs)
    }
  }

  function getProfileContext(): string | null {
    const p = cachedProfile.value
    if (!p) return null

    const insights: string[] = []

    if (p.avgTasksCompletedPerDay) {
      insights.push(`- Historical capacity: user completes ~${p.avgTasksCompletedPerDay} tasks/day on average`)
    }
    if (p.avgWorkMinutesPerDay) {
      insights.push(`- Average focused work time: ~${Math.round(p.avgWorkMinutesPerDay)} minutes/day`)
    }
    if (p.peakProductivityDays?.length) {
      insights.push(`- Most productive days: ${p.peakProductivityDays.join(', ')}. Schedule demanding tasks here.`)
    }
    if (p.avgPlanAccuracy) {
      if (p.avgPlanAccuracy < 60) {
        insights.push(`- Past plans were only ${p.avgPlanAccuracy}% accurate. Schedule FEWER tasks than requested.`)
      } else if (p.avgPlanAccuracy > 90) {
        insights.push(`- Past plans were ${p.avgPlanAccuracy}% accurate. User executes well — schedule confidently.`)
      }
    }
    if (p.preferredWorkStyle === 'frontload') {
      insights.push('- User prefers front-loading: schedule more tasks Mon-Tue, lighter Thu-Fri.')
    } else if (p.preferredWorkStyle === 'backload') {
      insights.push('- User prefers ramping up: lighter Mon-Tue, heavier Thu-Fri.')
    }

    // FEATURE-1317 Phase 2: Include memory observations
    const memoryObs = (p.memoryGraph || [])
      .filter(o => o.confidence >= 0.5)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10)

    if (memoryObs.length > 0) {
      insights.push('')  // blank line separator
      insights.push('Observations from past weeks:')
      for (const obs of memoryObs) {
        insights.push(`- ${obs.entity} ${obs.relation}: ${obs.value} (confidence: ${obs.confidence.toFixed(2)})`)
      }
    }

    return insights.length > 0 ? `Learned work patterns:\n${insights.join('\n')}` : null
  }

  async function resetLearnedData(): Promise<void> {
    await db.saveWorkProfile({
      avgWorkMinutesPerDay: null,
      avgTasksCompletedPerDay: null,
      peakProductivityDays: null,
      avgPlanAccuracy: null,
      weeklyHistory: [],
      memoryGraph: []
    })
    if (cachedProfile.value) {
      cachedProfile.value.avgWorkMinutesPerDay = null
      cachedProfile.value.avgTasksCompletedPerDay = null
      cachedProfile.value.peakProductivityDays = null
      cachedProfile.value.avgPlanAccuracy = null
      cachedProfile.value.weeklyHistory = []
      cachedProfile.value.memoryGraph = []
    }
  }

  return {
    profile,
    hasCompletedInterview,
    isLoading: computed(() => isLoading.value),
    loadProfile,
    reloadProfile,
    savePreferences,
    computeCapacityMetrics,
    recordWeeklyOutcome,
    addMemoryObservation,
    generateObservationsFromStats,
    generateObservationsFromWeeklyOutcome,
    getProfileContext,
    resetLearnedData
  }
}
