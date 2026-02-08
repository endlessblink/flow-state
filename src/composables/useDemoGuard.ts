import { ref as _ref } from 'vue'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'

// Interface for task-like objects in demo guard
interface TaskLike {
  title?: string
  description?: string
  [key: string]: unknown
}

export function useDemoGuard() {
  const isProduction = import.meta.env.PROD
  const isDevelopment = import.meta.env.DEV

  // Demo data patterns to detect
  const demoPatterns = [
    /^TASK-\d+/,           // TASK-XXXXX pattern
    /Test Task/i,          // "Test Task" variations
    /Test Done Column/i,  // Test tasks
    /task \d+/i,           // "task 1", "task 2" etc.
    /New Task/i,           // "New Task" variations
    /Medium priority task/i, // Demo priority tasks
    /Low priority task/i,  // Demo priority tasks
    /High priority task/i, // Demo priority tasks
    /Debug Task/i,         // Debug/test tasks
    /Demo Task/i           // Demo tasks
  ]

  // Check if content looks like demo data
  const isDemoData = (data: unknown): boolean => {
    if (!data || typeof data !== 'object') {
      return false
    }

    const taskData = data as TaskLike

    // Check for demo task patterns
    if (taskData.title && typeof taskData.title === 'string') {
      return demoPatterns.some(pattern => pattern.test(taskData.title as string))
    }

    // Check arrays of tasks
    if (Array.isArray(data)) {
      return data.some(item => isDemoData(item))
    }

    // Check for demo descriptions
    if (taskData.description && typeof taskData.description === 'string') {
      return demoPatterns.some(pattern => pattern.test(taskData.description as string))
    }

    return false
  }

  // Check if any tasks in array are real user data
  const hasRealUserData = (tasks: TaskLike[]): boolean => {
    return tasks.some(task => {
      if (!task || !task.title) return false

      // Has Hebrew content = real task
      if (/[\u0590-\u05FF]/.test(task.title)) return true
      if (task.description && /[\u0590-\u05FF]/.test(task.description)) return true

      // Has meaningful English content but not demo patterns
      if (!isDemoData(task)) {
        const meaningfulEnglish = task.title.length > 10 &&
          !/^(task|Test|New|Debug)/i.test(task.title.trim())
        if (meaningfulEnglish) return true
      }

      return false
    })
  }

  // Get demo data confirmation status
  const getDemoDataConfirmation = (): boolean => {
    return localStorage.getItem('flowstate-demo-confirmed') === 'true'
  }

  // Set demo data confirmation
  const setDemoDataConfirmation = (confirmed: boolean): void => {
    localStorage.setItem('flowstate-demo-confirmed', String(confirmed))
  }

  // Main guard function - returns whether demo data is allowed
  const allowDemoData = async (data?: unknown): Promise<boolean> => {
    // Never allow demo data in production
    if (isProduction) {
      console.warn('🚫 Demo data blocked in production environment')
      return false
    }

    // If no data provided, check if general demo data is allowed
    if (!data) {
      return isDevelopment && getDemoDataConfirmation()
    }

    // Check if data contains real user data
    const hasRealData = Array.isArray(data) ? hasRealUserData(data as TaskLike[]) : hasRealUserData([data as TaskLike])

    if (hasRealData) {
      console.warn('🚫 Demo data blocked: real user data detected')
      return false
    }

    // In development, require confirmation if not already confirmed
    if (isDevelopment && !getDemoDataConfirmation()) {
      const confirmed = confirm(
        '⚠️ Load demo/test data?\n\n' +
        'This will replace any existing tasks with demo content.\n' +
        'Type "YES" to confirm:'
      )

      if (confirmed && prompt('Type "YES" to confirm:') === 'YES') {
        setDemoDataConfirmation(true)
        return true
      }

      return false
    }

    return isDevelopment
  }

  // Check if current data might be demo data
  const isCurrentDataLikelyDemo = async (): Promise<boolean> => {
    try {
      // Check Supabase for demo data indicators
      const { fetchTasks } = useSupabaseDatabase()
      const tasks = await fetchTasks()
      if (tasks && Array.isArray(tasks)) {
        const demoCount = tasks.filter(task => isDemoData(task)).length

        // If more than 50% of tasks look like demo data, flag as likely demo
        return demoCount > (tasks.length * 0.5)
      }
    } catch (error) {
      console.error('❌ Failed to check current data:', error)
    }

    return false
  }

  // Reset demo confirmation
  const resetDemoConfirmation = (): void => {
    localStorage.removeItem('flowstate-demo-confirmed')
    console.log('🔄 Demo data confirmation reset')
  }

  return {
    isProduction,
    isDevelopment,
    isDemoData,
    hasRealUserData,
    allowDemoData,
    isCurrentDataLikelyDemo,
    getDemoDataConfirmation,
    setDemoDataConfirmation,
    resetDemoConfirmation
  }
}