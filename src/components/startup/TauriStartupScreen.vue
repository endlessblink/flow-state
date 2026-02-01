<script setup lang="ts">
/**
 * TauriStartupScreen
 *
 * Full-screen overlay that shows during app initialization.
 * Manages Docker and Supabase startup sequence.
 */

import { ref, onMounted, watch } from 'vue'
import { useTauriStartup, isTauri } from '@/composables/useTauriStartup'
import TauriModeSelector from './TauriModeSelector.vue'

const emit = defineEmits<{
  ready: []
}>()

const {
  state,
  isReady,
  hasError,
  isLoading,
  statusMessage,
  runStartupSequence,
  skipStartup,
  retry,
  registerCloseHandler
} = useTauriStartup()

// Mode selection state
const showModeSelector = ref(false)
const selectedMode = ref<'cloud' | 'local' | null>(null)

// Watch for ready state and emit event
watch(isReady, async (ready) => {
  if (ready) {
    // Register cleanup handler for graceful shutdown
    // Set to false to keep Supabase running for quick restart
    await registerCloseHandler(false)
    emit('ready')
  }
})

onMounted(async () => {
  // Tauri ALWAYS connects to VPS - skip Docker/Supabase orchestration entirely
  // Local Supabase is only used for backup (separate from app connection)
  skipStartup()
})

async function onModeSelected(mode: 'cloud' | 'local') {
  selectedMode.value = mode
  showModeSelector.value = false
  await startWithMode(mode)
}

async function startWithMode(mode: 'cloud' | 'local') {
  if (mode === 'local') {
    // Local Mode: run Docker/Supabase startup sequence
    if (isTauri()) {
      await runStartupSequence()
    } else {
      skipStartup()
    }
  } else {
    // Cloud Mode: skip Docker/Supabase checks, connect to VPS
    skipStartup()
  }
}

function openDockerDownload() {
  window.open('https://docker.com/products/docker-desktop', '_blank')
}

function openSupabaseInstall() {
  window.open('https://supabase.com/docs/guides/cli/getting-started', '_blank')
}
</script>

<template>
  <!-- Mode Selector (first time only) -->
  <TauriModeSelector
    v-if="showModeSelector"
    @select="onModeSelected"
  />

  <!-- Startup Progress (for Local Mode only) -->
  <Transition name="fade">
    <div v-if="!showModeSelector && (isLoading || hasError)" class="startup-screen">
      <div class="startup-content">
        <!-- Logo -->
        <div class="logo-container">
          <div class="logo">
            <span class="logo-icon">🍅</span>
          </div>
          <h1 class="app-name">
            FlowState
          </h1>
        </div>

        <!-- Status Message -->
        <p class="status-message">
          {{ statusMessage }}
        </p>

        <!-- Progress Bar -->
        <div v-if="isLoading" class="progress-container">
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: `${state.progress}%` }"
            />
          </div>
          <span class="progress-text">{{ state.progress }}%</span>
        </div>

        <!-- Error State -->
        <div v-if="hasError" class="error-container">
          <div class="error-icon">
            ⚠️
          </div>
          <p class="error-message">
            {{ state.error }}
          </p>

          <!-- Specific help based on error type -->
          <div v-if="state.errorType === 'docker_not_installed'" class="error-help">
            <p>Docker Desktop is required to run the local database.</p>
            <ol>
              <li>Download Docker Desktop from the link below</li>
              <li>Install and start Docker Desktop</li>
              <li>Click "Try Again" once Docker is running</li>
            </ol>
          </div>

          <div v-else-if="state.errorType === 'supabase_not_installed'" class="error-help">
            <p>Supabase CLI is required to manage the local database.</p>
            <ol>
              <li>Open a terminal</li>
              <li>Run: <code>npm install -g supabase</code></li>
              <li>Click "Try Again" once installed</li>
            </ol>
          </div>

          <div v-else-if="state.errorType === 'supabase_port_conflict'" class="error-help">
            <p>Required ports are in use by another service.</p>
            <ol>
              <li>Stop any other database services (PostgreSQL, etc.)</li>
              <li>Or run: <code>supabase stop</code> to clean up</li>
              <li>Click "Try Again"</li>
            </ol>
          </div>

          <div class="error-actions">
            <button
              v-if="state.errorType === 'docker_not_installed'"
              class="btn btn-primary"
              @click="openDockerDownload"
            >
              Download Docker Desktop
            </button>
            <button
              v-if="state.errorType === 'supabase_not_installed'"
              class="btn btn-primary"
              @click="openSupabaseInstall"
            >
              Supabase Installation Guide
            </button>
            <button class="btn btn-secondary" @click="retry">
              Try Again
            </button>
          </div>
        </div>

        <!-- Status Indicators -->
        <div v-if="isLoading" class="status-indicators">
          <div class="status-item" :class="{ active: state.step === 'checking_docker' || state.step === 'starting_docker' || state.step === 'waiting_docker', done: state.dockerStatus === 'running' }">
            <span class="status-icon">
              <template v-if="state.dockerStatus === 'running'">✓</template>
              <template v-else-if="state.step === 'checking_docker' || state.step === 'starting_docker' || state.step === 'waiting_docker'">
                <span class="spinner" />
              </template>
              <template v-else>○</template>
            </span>
            <span class="status-label">Docker</span>
            <span v-if="state.dockerVersion" class="status-version">v{{ state.dockerVersion }}</span>
          </div>

          <div class="status-item" :class="{ active: state.step === 'checking_supabase' || state.step === 'starting_supabase', done: state.supabaseStatus === 'running' }">
            <span class="status-icon">
              <template v-if="state.supabaseStatus === 'running'">✓</template>
              <template v-else-if="state.step === 'checking_supabase' || state.step === 'starting_supabase'">
                <span class="spinner" />
              </template>
              <template v-else>○</template>
            </span>
            <span class="status-label">Database</span>
          </div>
        </div>

        <!-- First-time notice -->
        <p v-if="state.step === 'starting_supabase'" class="first-time-notice">
          First-time setup may take a few minutes to download required components.
        </p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.startup-screen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--overlay-component-bg, rgba(28, 25, 45, 0.98));
  backdrop-filter: var(--overlay-component-backdrop, blur(20px));
}

.startup-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-6, 24px);
  padding: var(--space-8, 32px);
  max-width: 400px;
  text-align: center;
}

.logo-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3, 12px);
}

.logo {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-bg-heavy, rgba(255, 255, 255, 0.06));
  border: var(--overlay-component-border, 1px solid rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-xl, 20px);
}

.logo-icon {
  font-size: 40px;
}

.app-name {
  font-size: var(--text-2xl, 24px);
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
}

.status-message {
  font-size: var(--text-base, 16px);
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  margin: 0;
}

.progress-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2, 8px);
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: var(--glass-bg-heavy, rgba(255, 255, 255, 0.06));
  border-radius: var(--radius-full, 9999px);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #ef4444, #f97316);
  border-radius: var(--radius-full, 9999px);
  transition: width var(--duration-normal, 200ms) var(--ease-out, ease-out);
}

.progress-text {
  font-size: var(--text-sm, 14px);
  color: var(--text-muted, rgba(255, 255, 255, 0.5));
}

.status-indicators {
  display: flex;
  gap: var(--space-6, 24px);
  margin-top: var(--space-4, 16px);
}

.status-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1, 4px);
  opacity: 0.5;
  transition: opacity var(--duration-fast, 150ms);
}

.status-item.active,
.status-item.done {
  opacity: 1;
}

.status-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-lg, 18px);
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
}

.status-item.done .status-icon {
  color: #22c55e;
}

.status-label {
  font-size: var(--text-sm, 14px);
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
}

.status-version {
  font-size: var(--text-xs, 12px);
  color: var(--text-muted, rgba(255, 255, 255, 0.5));
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--glass-border, rgba(255, 255, 255, 0.1));
  border-top-color: #f97316;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4, 16px);
  padding: var(--space-4, 16px);
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-lg, 16px);
  width: 100%;
}

.error-icon {
  font-size: 32px;
}

.error-message {
  font-size: var(--text-sm, 14px);
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  margin: 0;
  line-height: 1.5;
}

.error-help {
  text-align: left;
  width: 100%;
  padding: var(--space-3, 12px);
  background: rgba(255, 255, 255, 0.03);
  border-radius: var(--radius-md, 8px);
}

.error-help p {
  margin: 0 0 var(--space-2, 8px);
  font-size: var(--text-sm, 14px);
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
}

.error-help ol {
  margin: 0;
  padding-left: var(--space-5, 20px);
  font-size: var(--text-sm, 14px);
  color: var(--text-muted, rgba(255, 255, 255, 0.5));
}

.error-help li {
  margin-bottom: var(--space-1, 4px);
}

.error-help code {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: var(--radius-sm, 6px);
  font-family: monospace;
  font-size: var(--text-xs, 12px);
}

.error-actions {
  display: flex;
  gap: var(--space-3, 12px);
  flex-wrap: wrap;
  justify-content: center;
}

.btn {
  padding: var(--space-2, 8px) var(--space-4, 16px);
  border-radius: var(--radius-md, 8px);
  font-size: var(--text-sm, 14px);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast, 150ms) var(--ease-out, ease-out);
  border: none;
}

.btn-primary {
  background: linear-gradient(135deg, #ef4444, #f97316);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.btn-secondary {
  background: var(--glass-bg-heavy, rgba(255, 255, 255, 0.06));
  color: var(--text-primary, #fff);
  border: var(--overlay-component-border, 1px solid rgba(255, 255, 255, 0.1));
}

.btn-secondary:hover {
  background: var(--glass-bg-medium, rgba(255, 255, 255, 0.08));
}

.first-time-notice {
  font-size: var(--text-xs, 12px);
  color: var(--text-muted, rgba(255, 255, 255, 0.5));
  margin: 0;
  font-style: italic;
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-normal, 200ms) var(--ease-out, ease-out);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
