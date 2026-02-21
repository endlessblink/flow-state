/**
 * Tauri Debug Composable (TASK-1060)
 *
 * Monitors memory usage and detects potential SIGTERM causes:
 * 1. Memory growth (unbounded leaks)
 * 2. High memory usage (OOM risk)
 * 3. Logs crashes/exits for post-mortem analysis
 */

import { ref, onMounted, onUnmounted } from 'vue'
import { isTauri } from './useTauriStartup'

export interface MemorySnapshot {
  timestamp: number
  pid: number
  rss: string // Resident Set Size (actual RAM used)
  virtual: string // Virtual memory
  platform: string
  rssBytes?: number // Parsed RSS in bytes
}

export interface MemoryTrend {
  samples: MemorySnapshot[]
  avgGrowthPerMinute: number // bytes per minute
  isLeaking: boolean // >10MB growth per minute sustained
  peakRss: number
  currentRss: number
}

// Parse memory string like "123456 kB" to bytes
function parseMemoryKb(memStr: string): number {
  const match = memStr.match(/(\d+)\s*kB/i)
  if (match) {
    return parseInt(match[1], 10) * 1024
  }
  return 0
}

export function useTauriDebug() {
  const isEnabled = ref(false)
  const memoryHistory = ref<MemorySnapshot[]>([])
  const trend = ref<MemoryTrend | null>(null)
  const lastError = ref<string | null>(null)

  let monitorInterval: ReturnType<typeof setInterval> | null = null
  const SAMPLE_INTERVAL_MS = 30000 // 30 seconds
  const MAX_SAMPLES = 120 // Keep 1 hour of data (120 * 30s = 60 min)
  const LEAK_THRESHOLD_BYTES_PER_MIN = 10 * 1024 * 1024 // 10MB/min is suspicious

  /**
   * Get current memory usage from Tauri backend
   */
  async function getMemoryUsage(): Promise<MemorySnapshot | null> {
    if (!isTauri()) return null

    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const result = await invoke<string>('get_memory_usage')
      const data = JSON.parse(result)

      const snapshot: MemorySnapshot = {
        timestamp: Date.now(),
        pid: data.pid,
        rss: data.rss,
        virtual: data.virtual,
        platform: data.platform,
        rssBytes: parseMemoryKb(data.rss)
      }

      return snapshot
    } catch (error) {
      console.error('[TauriDebug] Failed to get memory usage:', error)
      lastError.value = String(error)
      return null
    }
  }

  /**
   * Calculate memory trend from history
   */
  function calculateTrend(): MemoryTrend | null {
    const samples = memoryHistory.value
    if (samples.length < 2) return null

    const validSamples = samples.filter(s => s.rssBytes && s.rssBytes > 0)
    if (validSamples.length < 2) return null

    // Calculate growth rate
    const first = validSamples[0]
    const last = validSamples[validSamples.length - 1]
    const timeSpanMinutes = (last.timestamp - first.timestamp) / 60000

    if (timeSpanMinutes < 1) return null

    const growthBytes = (last.rssBytes || 0) - (first.rssBytes || 0)
    const avgGrowthPerMinute = growthBytes / timeSpanMinutes

    // Find peak
    const peakRss = Math.max(...validSamples.map(s => s.rssBytes || 0))
    const currentRss = last.rssBytes || 0

    // Detect sustained leak (check last 5 samples all growing)
    const recentSamples = validSamples.slice(-5)
    let isLeaking = false
    if (recentSamples.length >= 5) {
      let allGrowing = true
      for (let i = 1; i < recentSamples.length; i++) {
        if ((recentSamples[i].rssBytes || 0) <= (recentSamples[i - 1].rssBytes || 0)) {
          allGrowing = false
          break
        }
      }
      isLeaking = allGrowing && avgGrowthPerMinute > LEAK_THRESHOLD_BYTES_PER_MIN
    }

    return {
      samples: validSamples,
      avgGrowthPerMinute,
      isLeaking,
      peakRss,
      currentRss
    }
  }

  /**
   * Take a memory sample and update trend
   */
  async function sampleMemory() {
    const snapshot = await getMemoryUsage()
    if (!snapshot) return

    memoryHistory.value.push(snapshot)

    // Trim old samples
    if (memoryHistory.value.length > MAX_SAMPLES) {
      memoryHistory.value = memoryHistory.value.slice(-MAX_SAMPLES)
    }

    // Update trend
    trend.value = calculateTrend()

    // Log warning if leak detected
    if (trend.value?.isLeaking) {
      const mbPerMin = (trend.value.avgGrowthPerMinute / (1024 * 1024)).toFixed(2)
      console.warn(
        `[TauriDebug] Memory leak detected! Growing at ${mbPerMin} MB/min. ` +
        `Current: ${(trend.value.currentRss / (1024 * 1024)).toFixed(1)} MB, ` +
        `Peak: ${(trend.value.peakRss / (1024 * 1024)).toFixed(1)} MB`
      )
    }

    // Log if memory is very high (>500MB)
    if (snapshot.rssBytes && snapshot.rssBytes > 500 * 1024 * 1024) {
      console.warn(
        `[TauriDebug] High memory usage: ${(snapshot.rssBytes / (1024 * 1024)).toFixed(1)} MB`
      )
    }
  }

  /**
   * Start memory monitoring
   */
  function startMonitoring() {
    if (!isTauri()) {
      console.log('[TauriDebug] Not in Tauri environment, monitoring disabled')
      return
    }

    if (monitorInterval) {
      console.log('[TauriDebug] Monitoring already active')
      return
    }

    console.log('[TauriDebug] Starting memory monitoring (30s interval)')
    isEnabled.value = true

    // Take initial sample
    sampleMemory()

    // Start interval
    monitorInterval = setInterval(sampleMemory, SAMPLE_INTERVAL_MS)
  }

  /**
   * Stop memory monitoring
   */
  function stopMonitoring() {
    if (monitorInterval) {
      clearInterval(monitorInterval)
      monitorInterval = null
    }
    isEnabled.value = false
    console.log('[TauriDebug] Memory monitoring stopped')
  }

  /**
   * Get summary for logging/display
   */
  function getSummary(): string {
    if (!trend.value) return 'No data yet'

    const currentMb = (trend.value.currentRss / (1024 * 1024)).toFixed(1)
    const peakMb = (trend.value.peakRss / (1024 * 1024)).toFixed(1)
    const growthMb = (trend.value.avgGrowthPerMinute / (1024 * 1024)).toFixed(2)

    return `Memory: ${currentMb}MB (peak: ${peakMb}MB, growth: ${growthMb}MB/min)${trend.value.isLeaking ? ' [LEAK DETECTED]' : ''}`
  }

  /**
   * Export history for debugging
   */
  function exportHistory(): string {
    return JSON.stringify({
      exportTime: new Date().toISOString(),
      samples: memoryHistory.value,
      trend: trend.value
    }, null, 2)
  }

  // Auto-start in Tauri dev mode
  onMounted(() => {
    if (isTauri() && import.meta.env.DEV) {
      startMonitoring()
    }
  })

  onUnmounted(() => {
    stopMonitoring()
  })

  return {
    isEnabled,
    memoryHistory,
    trend,
    lastError,

    // Actions
    getMemoryUsage,
    sampleMemory,
    startMonitoring,
    stopMonitoring,
    getSummary,
    exportHistory
  }
}

// Singleton for global access (e.g., from devtools)
let globalInstance: ReturnType<typeof useTauriDebug> | null = null

export function getTauriDebugInstance() {
  if (!globalInstance) {
    // Create instance outside of component context
    globalInstance = {
      isEnabled: ref(false),
      memoryHistory: ref<MemorySnapshot[]>([]),
      trend: ref<MemoryTrend | null>(null),
      lastError: ref<string | null>(null),
      getMemoryUsage: async () => null,
      sampleMemory: async () => {},
      startMonitoring: () => {},
      stopMonitoring: () => {},
      getSummary: () => 'Not initialized',
      exportHistory: () => '{}'
    }
  }
  return globalInstance
}

// Expose to window for debugging (DEV only)
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__flowstate_tauri_debug = {
    getSummary: () => globalInstance?.getSummary() || 'Not initialized',
    exportHistory: () => globalInstance?.exportHistory() || '{}',
    getTrend: () => globalInstance?.trend.value
  }
}
