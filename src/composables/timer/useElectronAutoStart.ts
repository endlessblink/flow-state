export interface ElectronAutoStartMonitorOptions {
  absenceSeconds: number
  getSystemIdleSeconds: () => number | Promise<number>
  onReturn: () => void
  pollIntervalMs?: number
}

export interface ElectronAutoStartApi {
  isElectron: boolean
  getSystemIdleTime: () => Promise<number>
}

export function shouldStartAutomaticPomodoro({
  enabled,
  isTimerActive,
}: {
  enabled: boolean
  isTimerActive: boolean
}): boolean {
  return enabled && !isTimerActive
}

export function createElectronAutoStartMonitor({
  absenceSeconds,
  getSystemIdleSeconds,
  onReturn,
  pollIntervalMs = 1_000,
}: ElectronAutoStartMonitorOptions) {
  let intervalId: ReturnType<typeof setInterval> | null = null
  let wasAway = false

  const poll = async () => {
    let idleSeconds: number
    try {
      idleSeconds = await getSystemIdleSeconds()
    } catch {
      return
    }
    if (idleSeconds >= absenceSeconds) {
      wasAway = true
      return
    }
    if (!wasAway) return
    wasAway = false
    onReturn()
  }

  return {
    start() {
      if (intervalId !== null) return
      poll()
      intervalId = setInterval(poll, pollIntervalMs)
    },
    stop() {
      if (intervalId === null) return
      clearInterval(intervalId)
      intervalId = null
    },
  }
}

export function getElectronAutoStartApi(): ElectronAutoStartApi | null {
  if (typeof window === 'undefined') return null
  const api = (window as unknown as { electronAPI?: ElectronAutoStartApi }).electronAPI
  return api?.isElectron === true ? api : null
}
