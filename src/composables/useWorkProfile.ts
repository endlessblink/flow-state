import { ref, computed } from 'vue'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
import type { WorkProfile } from '@/utils/supabaseMappers'

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
  }> {
    const history = await db.fetchPomodoroHistory(28) // Last 4 weeks
    if (history.length === 0) {
      return { avgMinutesPerDay: null, avgTasksPerDay: null, peakDays: [] }
    }

    // Group by day
    const dayMap = new Map<string, { minutes: number; tasks: Set<string> }>()
    const dayOfWeekMinutes = new Map<string, number[]>()

    for (const entry of history) {
      if (entry.isBreak) continue
      const date = entry.completedAt.split('T')[0]
      const dayOfWeek = new Date(entry.completedAt).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()

      if (!dayMap.has(date)) {
        dayMap.set(date, { minutes: 0, tasks: new Set() })
      }
      const dayData = dayMap.get(date)!
      dayData.minutes += Math.round(entry.duration / 60)
      if (entry.taskId) dayData.tasks.add(entry.taskId)

      if (!dayOfWeekMinutes.has(dayOfWeek)) {
        dayOfWeekMinutes.set(dayOfWeek, [])
      }
      dayOfWeekMinutes.get(dayOfWeek)!.push(Math.round(entry.duration / 60))
    }

    const days = Array.from(dayMap.values())
    const avgMinutesPerDay = days.length > 0
      ? Math.round(days.reduce((sum, d) => sum + d.minutes, 0) / days.length * 10) / 10
      : null
    const avgTasksPerDay = days.length > 0
      ? Math.round(days.reduce((sum, d) => sum + d.tasks.size, 0) / days.length * 10) / 10
      : null

    // Find peak days (top 2 by avg minutes)
    const dayAvgs = Array.from(dayOfWeekMinutes.entries())
      .map(([day, mins]) => ({
        day,
        avg: mins.reduce((a, b) => a + b, 0) / mins.length
      }))
      .sort((a, b) => b.avg - a.avg)
    const peakDays = dayAvgs.slice(0, 2).map(d => d.day)

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

    return { avgMinutesPerDay, avgTasksPerDay, peakDays }
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

    return insights.length > 0 ? `Learned work patterns:\n${insights.join('\n')}` : null
  }

  async function resetLearnedData(): Promise<void> {
    await db.saveWorkProfile({
      avgWorkMinutesPerDay: null,
      avgTasksCompletedPerDay: null,
      peakProductivityDays: null,
      avgPlanAccuracy: null,
      weeklyHistory: []
    })
    if (cachedProfile.value) {
      cachedProfile.value.avgWorkMinutesPerDay = null
      cachedProfile.value.avgTasksCompletedPerDay = null
      cachedProfile.value.peakProductivityDays = null
      cachedProfile.value.avgPlanAccuracy = null
      cachedProfile.value.weeklyHistory = []
    }
  }

  return {
    profile,
    hasCompletedInterview,
    isLoading: computed(() => isLoading.value),
    loadProfile,
    savePreferences,
    computeCapacityMetrics,
    recordWeeklyOutcome,
    getProfileContext,
    resetLearnedData
  }
}
