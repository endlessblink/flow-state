/**
 * Tauri Startup Composable
 *
 * Manages the startup flow for the Tauri desktop app:
 * 1. Check if Docker is running
 * 2. Start Docker if needed
 * 3. Check if Supabase is running
 * 4. Start Supabase if needed
 * 5. Get Supabase connection config
 *
 * Debug logging added to diagnose view switching issues in Tauri app.
 */

import { ref, computed, onUnmounted, watch } from 'vue'

// Debug prefix for easy filtering in console
const DEBUG_PREFIX = '[TauriStartup]'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

export type StartupStep =
  | 'checking_docker'
  | 'starting_docker'
  | 'waiting_docker'
  | 'checking_supabase'
  | 'starting_supabase'
  | 'running_migrations'
  | 'ready'
  | 'error'

export type ErrorType =
  | 'docker_not_installed'
  | 'docker_not_running'
  | 'docker_start_failed'
  | 'supabase_not_installed'
  | 'supabase_port_conflict'
  | 'supabase_start_failed'
  | 'migration_failed'
  | 'unknown'

export interface StartupState {
  step: StartupStep
  dockerStatus: 'unknown' | 'not_installed' | 'not_running' | 'running'
  dockerVersion: string | null
  supabaseStatus: 'unknown' | 'not_installed' | 'not_running' | 'running'
  supabaseConfig: SupabaseConfig | null
  error: string | null
  errorType: ErrorType | null
  progress: number // 0-100
}

export interface SupabaseConfig {
  API_URL: string
  GRAPHQL_URL: string
  S3_STORAGE_URL: string
  DB_URL: string
  STUDIO_URL: string
  INBUCKET_URL: string
  JWT_SECRET: string
  ANON_KEY: string
  SERVICE_ROLE_KEY: string
  S3_ACCESS_KEY: string
  S3_SECRET_KEY: string
  S3_REGION: string
}

/**
 * Check if running in Tauri environment
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

export function useTauriStartup() {
  const state = ref<StartupState>({
    step: 'checking_docker',
    dockerStatus: 'unknown',
    dockerVersion: null,
    supabaseStatus: 'unknown',
    supabaseConfig: null,
    error: null,
    errorType: null,
    progress: 0
  })

  const isReady = computed(() => state.value.step === 'ready')
  const hasError = computed(() => state.value.step === 'error')
  const isLoading = computed(() => !isReady.value && !hasError.value)

  // Debug: Watch for state changes
  watch(() => state.value.step, (newStep, oldStep) => {
    console.log(`${DEBUG_PREFIX} Step changed: ${oldStep} -> ${newStep}`)
  })

  watch(isReady, (ready) => {
    console.log(`${DEBUG_PREFIX} isReady changed to: ${ready}`)
    if (ready) {
      console.log(`${DEBUG_PREFIX} ✅ Startup sequence completed successfully`)
    }
  })

  const statusMessage = computed(() => {
    switch (state.value.step) {
      case 'checking_docker':
        return 'Checking Docker status...'
      case 'starting_docker':
        return 'Starting Docker Desktop...'
      case 'waiting_docker':
        return 'Waiting for Docker to be ready...'
      case 'checking_supabase':
        return 'Checking database status...'
      case 'starting_supabase':
        return 'Starting database services... (this may take a few minutes on first run)'
      case 'running_migrations':
        return 'Setting up database schema...'
      case 'ready':
        return 'Ready!'
      case 'error':
        return state.value.error || 'An error occurred'
      default:
        return 'Loading...'
    }
  })

  /**
   * Check Docker status via Tauri command
   */
  async function checkDocker(): Promise<boolean> {
    try {
      const result = await invoke<string>('check_docker_status')

      if (result.startsWith('running:')) {
        state.value.dockerStatus = 'running'
        state.value.dockerVersion = result.replace('running:', '')
        return true
      } else {
        state.value.dockerStatus = 'not_running'
        return false
      }
    } catch (error) {
      console.error('Failed to check Docker:', error)
      state.value.dockerStatus = 'not_installed'
      return false
    }
  }

  /**
   * Start Docker Desktop via Tauri command
   */
  async function startDocker(): Promise<boolean> {
    try {
      const result = await invoke<string>('start_docker_desktop')
      return result === 'started'
    } catch (error) {
      console.error('Failed to start Docker:', error)
      return false
    }
  }

  /**
   * Wait for Docker to be ready with polling
   */
  async function waitForDocker(timeoutMs: number = 60000): Promise<boolean> {
    const startTime = Date.now()
    const pollInterval = 2000

    while (Date.now() - startTime < timeoutMs) {
      const isRunning = await checkDocker()
      if (isRunning) return true

      // Update progress based on elapsed time
      const elapsed = Date.now() - startTime
      state.value.progress = Math.min(30 + (elapsed / timeoutMs) * 20, 50)

      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    return false
  }

  /**
   * Check Supabase status via Tauri command
   */
  async function checkSupabase(): Promise<boolean> {
    try {
      const result = await invoke<string>('check_supabase_status')

      if (result.startsWith('running:')) {
        state.value.supabaseStatus = 'running'
        const configJson = result.replace('running:', '')
        try {
          state.value.supabaseConfig = JSON.parse(configJson)
        } catch {
          // Config parsing failed but Supabase is running
        }
        return true
      } else {
        state.value.supabaseStatus = 'not_running'
        return false
      }
    } catch (error) {
      console.error('Failed to check Supabase:', error)
      state.value.supabaseStatus = 'not_running'
      return false
    }
  }

  /**
   * Start Supabase via Tauri command
   */
  async function startSupabase(): Promise<boolean> {
    try {
      const result = await invoke<string>('start_supabase')
      return result === 'started' || result === 'already_running'
    } catch (error) {
      console.error('Failed to start Supabase:', error)
      state.value.error = String(error)
      return false
    }
  }

  /**
   * Get Supabase connection config
   */
  async function getSupabaseConfig(): Promise<SupabaseConfig | null> {
    try {
      const result = await invoke<string>('get_supabase_config')
      const config = JSON.parse(result) as SupabaseConfig
      state.value.supabaseConfig = config
      return config
    } catch (error) {
      console.error('Failed to get Supabase config:', error)
      return null
    }
  }

  /**
   * Run database migrations via Tauri command
   */
  async function runMigrations(): Promise<boolean> {
    try {
      const result = await invoke<string>('run_supabase_migrations')
      return result === 'migrations_complete' || result === 'no_migrations_needed'
    } catch (error) {
      console.error('Failed to run migrations:', error)
      state.value.error = String(error)
      return false
    }
  }

  /**
   * Cleanup services on app exit
   * @param stopSupabase - Whether to stop Supabase containers (default: false to keep running for quick restart)
   */
  async function cleanup(stopSupabase: boolean = false): Promise<void> {
    try {
      await invoke<string>('cleanup_services', { stopSupabaseFlag: stopSupabase })
      console.log('Cleanup completed')
    } catch (error) {
      console.error('Cleanup failed:', error)
    }
  }

  // Track cleanup listener for removal
  let cleanupUnlisten: (() => void) | null = null

  /**
   * Register cleanup handler for when the window is about to close
   * @param stopSupabase - Whether to stop Supabase on close (user preference)
   */
  async function registerCloseHandler(stopSupabase: boolean = false): Promise<void> {
    if (!isTauri()) return

    try {
      const currentWindow = getCurrentWindow()
      cleanupUnlisten = await currentWindow.onCloseRequested(async (event) => {
        // Prevent default close
        event.preventDefault()

        // Run cleanup
        await cleanup(stopSupabase)

        // Actually close the window
        await currentWindow.destroy()
      })
    } catch (error) {
      console.error('Failed to register close handler:', error)
    }
  }

  /**
   * Unregister cleanup handler
   */
  function unregisterCloseHandler(): void {
    if (cleanupUnlisten) {
      cleanupUnlisten()
      cleanupUnlisten = null
    }
  }

  // Auto-cleanup on composable unmount
  onUnmounted(() => {
    unregisterCloseHandler()
  })

  /**
   * Run the full startup sequence
   */
  async function runStartupSequence(): Promise<boolean> {
    console.log(`${DEBUG_PREFIX} 🚀 Starting startup sequence...`)
    const startTime = Date.now()

    // Reset state
    state.value.error = null
    state.value.errorType = null
    state.value.progress = 0

    // Step 1: Check Docker
    console.log(`${DEBUG_PREFIX} [1/7] Checking Docker status...`)
    state.value.step = 'checking_docker'
    state.value.progress = 10

    let dockerRunning = await checkDocker()
    console.log(`${DEBUG_PREFIX} Docker check result: ${dockerRunning ? 'running' : 'not running'}`)

    // Step 2: Start Docker if needed
    if (!dockerRunning) {
      console.log(`${DEBUG_PREFIX} Docker not running, checking if installed...`)
      if (state.value.dockerStatus === 'not_installed') {
        console.error(`${DEBUG_PREFIX} ❌ Docker not installed!`)
        state.value.step = 'error'
        state.value.errorType = 'docker_not_installed'
        state.value.error = 'Docker is not installed. Please install Docker Desktop to use this app.'
        return false
      }

      console.log(`${DEBUG_PREFIX} [2/7] Starting Docker Desktop...`)
      state.value.step = 'starting_docker'
      state.value.progress = 20

      const started = await startDocker()
      console.log(`${DEBUG_PREFIX} Docker start result: ${started}`)
      if (!started) {
        console.error(`${DEBUG_PREFIX} ❌ Failed to start Docker`)
        state.value.step = 'error'
        state.value.errorType = 'docker_start_failed'
        state.value.error = 'Failed to start Docker Desktop. Please start it manually from your applications menu.'
        return false
      }

      // Step 3: Wait for Docker
      console.log(`${DEBUG_PREFIX} [3/7] Waiting for Docker to be ready...`)
      state.value.step = 'waiting_docker'
      state.value.progress = 30

      dockerRunning = await waitForDocker(60000)
      console.log(`${DEBUG_PREFIX} Docker wait result: ${dockerRunning}`)
      if (!dockerRunning) {
        console.error(`${DEBUG_PREFIX} ❌ Docker timeout`)
        state.value.step = 'error'
        state.value.errorType = 'docker_not_running'
        state.value.error = 'Docker is taking too long to start. Please ensure Docker Desktop is running and try again.'
        return false
      }
    }

    console.log(`${DEBUG_PREFIX} ✓ Docker is running`)
    state.value.progress = 50

    // Step 4: Check Supabase
    console.log(`${DEBUG_PREFIX} [4/7] Checking Supabase status...`)
    state.value.step = 'checking_supabase'
    state.value.progress = 60

    let supabaseRunning = await checkSupabase()
    console.log(`${DEBUG_PREFIX} Supabase check result: ${supabaseRunning ? 'running' : 'not running'}`)

    // Step 5: Start Supabase if needed
    if (!supabaseRunning) {
      console.log(`${DEBUG_PREFIX} [5/7] Starting Supabase...`)
      state.value.step = 'starting_supabase'
      state.value.progress = 70

      const started = await startSupabase()
      console.log(`${DEBUG_PREFIX} Supabase start result: ${started}`)
      if (!started) {
        console.error(`${DEBUG_PREFIX} ❌ Failed to start Supabase`)
        state.value.step = 'error'
        // Check if it's a port conflict based on error message
        const errorMsg = state.value.error || ''
        if (errorMsg.includes('port') || errorMsg.includes('already in use') || errorMsg.includes('address already')) {
          state.value.errorType = 'supabase_port_conflict'
          state.value.error = 'Port conflict detected. Another service may be using the required ports (54321-54329). Please stop conflicting services and try again.'
        } else {
          state.value.errorType = 'supabase_start_failed'
          state.value.error = errorMsg || 'Failed to start database services. Please ensure Supabase CLI is installed.'
        }
        return false
      }

      // Wait a bit for Supabase to fully start
      console.log(`${DEBUG_PREFIX} Waiting 5s for Supabase to fully initialize...`)
      state.value.progress = 85
      await new Promise(resolve => setTimeout(resolve, 5000))

      // Verify it's running and get config
      console.log(`${DEBUG_PREFIX} Verifying Supabase is responding...`)
      supabaseRunning = await checkSupabase()
      console.log(`${DEBUG_PREFIX} Supabase verification result: ${supabaseRunning}`)
      if (!supabaseRunning) {
        console.error(`${DEBUG_PREFIX} ❌ Supabase not responding after start`)
        state.value.step = 'error'
        state.value.errorType = 'supabase_start_failed'
        state.value.error = 'Database services started but are not responding. Please check Docker logs or try running "supabase start" manually.'
        return false
      }
    }

    console.log(`${DEBUG_PREFIX} ✓ Supabase is running`)

    // Step 6: Get config if we don't have it yet
    if (!state.value.supabaseConfig) {
      console.log(`${DEBUG_PREFIX} [6/7] Fetching Supabase config...`)
      await getSupabaseConfig()
      console.log(`${DEBUG_PREFIX} Config fetched: ${state.value.supabaseConfig ? 'success' : 'null'}`)
    }

    // Step 7: Run database migrations
    console.log(`${DEBUG_PREFIX} [7/7] Running database migrations...`)
    state.value.step = 'running_migrations'
    state.value.progress = 92

    const migrationsOk = await runMigrations()
    console.log(`${DEBUG_PREFIX} Migrations result: ${migrationsOk}`)
    if (!migrationsOk) {
      console.error(`${DEBUG_PREFIX} ❌ Migrations failed`)
      state.value.step = 'error'
      state.value.errorType = 'migration_failed'
      state.value.error = state.value.error || 'Failed to set up database schema. Please check Supabase logs.'
      return false
    }

    const elapsedMs = Date.now() - startTime
    console.log(`${DEBUG_PREFIX} ✅ Startup sequence completed in ${elapsedMs}ms`)
    state.value.progress = 100
    state.value.step = 'ready'
    return true
  }

  /**
   * Skip startup checks (for web mode or testing)
   */
  function skipStartup() {
    state.value.step = 'ready'
    state.value.progress = 100
  }

  /**
   * Retry startup after an error
   */
  async function retry() {
    state.value.step = 'checking_docker'
    state.value.error = null
    state.value.errorType = null
    state.value.progress = 0
    return runStartupSequence()
  }

  return {
    state,
    isReady,
    hasError,
    isLoading,
    statusMessage,

    // Actions
    runStartupSequence,
    skipStartup,
    retry,

    // Individual checks (for manual control)
    checkDocker,
    startDocker,
    waitForDocker,
    checkSupabase,
    startSupabase,
    getSupabaseConfig,
    runMigrations,
    cleanup,
    registerCloseHandler,
    unregisterCloseHandler
  }
}
