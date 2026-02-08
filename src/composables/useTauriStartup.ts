/**
 * Tauri Startup Composable
 *
 * Manages the startup flow for the Tauri desktop app:
 * 1. Check if Docker is running
 * 2. Start Docker if needed
 * 3. Check if Supabase is running
 * 4. Start Supabase if needed
 * 5. Get Supabase connection config
 */

import { ref, computed, onUnmounted } from 'vue'
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

/**
 * Get current Tauri mode (cloud or local)
 */
export function getTauriMode(): 'cloud' | 'local' {
  if (typeof window === 'undefined') return 'cloud'
  const savedMode = localStorage.getItem('flowstate-tauri-mode')
  return (savedMode === 'local' ? 'local' : 'cloud') as 'cloud' | 'local'
}

/**
 * Set Tauri mode
 */
export function setTauriMode(mode: 'cloud' | 'local'): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('flowstate-tauri-mode', mode)
  }
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

        // Run cleanup with timeout to prevent hanging on blocked IPC
        try {
          await Promise.race([
            cleanup(stopSupabase),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Cleanup timeout')), 5000))
          ])
        } catch (error) {
          console.warn('Cleanup timed out or failed, forcing window close:', error)
        }

        // Always close the window, even if cleanup failed/timed out
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
    // Reset state
    state.value.error = null
    state.value.errorType = null
    state.value.progress = 0

    // Step 1: Check Docker
    state.value.step = 'checking_docker'
    state.value.progress = 10

    let dockerRunning = await checkDocker()

    // Step 2: Start Docker if needed
    if (!dockerRunning) {
      if (state.value.dockerStatus === 'not_installed') {
        state.value.step = 'error'
        state.value.errorType = 'docker_not_installed'
        state.value.error = 'Docker is not installed. Please install Docker Desktop to use this app.'
        return false
      }

      state.value.step = 'starting_docker'
      state.value.progress = 20

      const started = await startDocker()
      if (!started) {
        state.value.step = 'error'
        state.value.errorType = 'docker_start_failed'
        state.value.error = 'Failed to start Docker Desktop. Please start it manually from your applications menu.'
        return false
      }

      // Step 3: Wait for Docker
      state.value.step = 'waiting_docker'
      state.value.progress = 30

      dockerRunning = await waitForDocker(60000)
      if (!dockerRunning) {
        state.value.step = 'error'
        state.value.errorType = 'docker_not_running'
        state.value.error = 'Docker is taking too long to start. Please ensure Docker Desktop is running and try again.'
        return false
      }
    }

    state.value.progress = 50

    // Step 4: Check Supabase
    state.value.step = 'checking_supabase'
    state.value.progress = 60

    let supabaseRunning = await checkSupabase()

    // Step 5: Start Supabase if needed
    if (!supabaseRunning) {
      state.value.step = 'starting_supabase'
      state.value.progress = 70

      const started = await startSupabase()
      if (!started) {
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
      state.value.progress = 85
      await new Promise(resolve => setTimeout(resolve, 5000))

      // Verify it's running and get config
      supabaseRunning = await checkSupabase()
      if (!supabaseRunning) {
        state.value.step = 'error'
        state.value.errorType = 'supabase_start_failed'
        state.value.error = 'Database services started but are not responding. Please check Docker logs or try running "supabase start" manually.'
        return false
      }
    }

    // Step 6: Get config if we don't have it yet
    if (!state.value.supabaseConfig) {
      await getSupabaseConfig()
    }

    // Step 7: Run database migrations
    state.value.step = 'running_migrations'
    state.value.progress = 92

    const migrationsOk = await runMigrations()
    if (!migrationsOk) {
      state.value.step = 'error'
      state.value.errorType = 'migration_failed'
      state.value.error = state.value.error || 'Failed to set up database schema. Please check Supabase logs.'
      return false
    }

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
