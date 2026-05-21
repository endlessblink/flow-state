import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import type { Task } from '@/types/tasks'
import { useTimerStore } from '@/stores/timer'

const isToday = (value?: Date | string | null) => {
  if (!value) return false
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return false
  const today = new Date()
  return date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
}

export function useWorkBlockProgress(taskSource: MaybeRefOrGetter<Task | undefined | null>) {
  const timerStore = useTimerStore()

  const workedMinutesToday = computed(() => {
    const task = toValue(taskSource)
    if (!task?.id) return 0

    const completedMinutes = timerStore.sessions
      .filter(session => session.taskId === task.id && !session.isBreak && isToday(session.completedAt))
      .reduce((total, session) => total + Math.ceil(session.duration / 60), 0)

    const activeSession = timerStore.currentSession
    if (!activeSession || activeSession.taskId !== task.id || activeSession.isBreak) return completedMinutes

    const elapsedSeconds = Math.max(0, activeSession.duration - activeSession.remainingTime)
    return completedMinutes + Math.ceil(elapsedSeconds / 60)
  })

  const requiredMinutes = computed(() => toValue(taskSource)?.estimatedDuration || 0)

  const isEnoughForToday = computed(() => {
    return requiredMinutes.value > 0 && workedMinutesToday.value >= requiredMinutes.value
  })

  return {
    workedMinutesToday,
    requiredMinutes,
    isEnoughForToday
  }
}
