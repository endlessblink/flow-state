import { computed, getCurrentInstance, onMounted, ref, watch } from 'vue'
import { useTaskStore } from '@/stores/tasks'

export interface Big3Slot {
  taskId: string | null
  title: string
  completed: boolean
}

export interface TimeBlock {
  startTime: string // HH:MM
  duration: number // minutes
}

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

export function useMorningDashboard() {
  const taskStore = useTaskStore()

  const big3Slots = ref<Big3Slot[]>([
    { taskId: null, title: '', completed: false },
    { taskId: null, title: '', completed: false },
    { taskId: null, title: '', completed: false },
  ])

  const allSlotsCompleted = computed(() =>
    big3Slots.value.every((slot) => slot.completed)
  )

  function localStorageKey(): string {
    return `flowstate-big3-${getTodayString()}`
  }

  function saveToLocalStorage() {
    try {
      localStorage.setItem(localStorageKey(), JSON.stringify(big3Slots.value))
    } catch {
      // storage quota or unavailable — silent
    }
  }

  function loadFromLocalStorage(): boolean {
    try {
      const raw = localStorage.getItem(localStorageKey())
      if (!raw) return false
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length === 3) {
        big3Slots.value = parsed
        return true
      }
    } catch {
      // corrupted data — start fresh
    }
    return false
  }

  async function completeSlot(index: number) {
    if (index < 0 || index > 2) return
    const slot = big3Slots.value[index]
    if (!slot.title) return

    big3Slots.value[index] = { ...slot, completed: true }

    if (slot.taskId) {
      try {
        await taskStore.updateTaskWithUndo(slot.taskId, { status: 'done' })
      } catch {
        // task may have been deleted — not fatal
      }
    }
  }

  watch(
    big3Slots,
    () => {
      saveToLocalStorage()
    },
    { deep: true }
  )

  if (getCurrentInstance()) {
    onMounted(() => {
      loadFromLocalStorage()
    })
  } else {
    loadFromLocalStorage()
  }

  return {
    big3Slots,
    allSlotsCompleted,
    completeSlot,
  }
}
