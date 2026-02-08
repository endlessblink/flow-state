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
  z-index: var(--z-tooltip);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--overlay-component-bg);
  backdrop-filter: var(--overlay-component-backdrop);
}

.startup-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-8);
  max-width: 400px;
  text-align: center;
}

.logo-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}

.logo {
  width: var(--space-20);
  height: var(--space-20);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-bg-heavy);
  border: var(--overlay-component-border);
  border-radius: var(--radius-xl);
}

.logo-icon {
  font-size: var(--space-10);
}

.app-name {
  font-size: var(--text-2xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.status-message {
  font-size: var(--text-base);
  color: var(--text-secondary);
  margin: 0;
}

.progress-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.progress-bar {
  width: 100%;
  height: var(--space-1_5);
  background: var(--glass-bg-heavy);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-danger), var(--color-orange));
  border-radius: var(--radius-full);
  transition: width var(--duration-normal) var(--ease-out);
}

.progress-text {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.status-indicators {
  display: flex;
  gap: var(--space-6);
  margin-top: var(--space-4);
}

.status-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  opacity: 0.5;
  transition: opacity var(--duration-fast);
}

.status-item.active,
.status-item.done {
  opacity: 1;
}

.status-icon {
  width: var(--space-8);
  height: var(--space-8);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-lg);
  color: var(--text-secondary);
}

.status-item.done .status-icon {
  color: var(--color-success);
}

.status-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.status-version {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.spinner {
  width: var(--space-4);
  height: var(--space-4);
  border: var(--space-0_5) solid var(--glass-border);
  border-top-color: var(--color-orange);
  border-radius: var(--radius-full);
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
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--danger-bg-subtle);
  border: 1px solid var(--danger-border);
  border-radius: var(--radius-lg);
  width: 100%;
}

.error-icon {
  font-size: var(--space-8);
}

.error-message {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

.error-help {
  text-align: left;
  width: 100%;
  padding: var(--space-3);
  background: var(--surface-subtle);
  border-radius: var(--radius-md);
}

.error-help p {
  margin: 0 0 var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.error-help ol {
  margin: 0;
  padding-left: var(--space-5);
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.error-help li {
  margin-bottom: var(--space-1);
}

.error-help code {
  background: var(--code-bg);
  padding: var(--space-0_5) var(--space-1_5);
  border-radius: var(--radius-sm);
  font-family: monospace;
  font-size: var(--text-xs);
}

.error-actions {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
  justify-content: center;
}

.btn {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  border: none;
}

.btn-primary {
  background: linear-gradient(135deg, var(--color-danger), var(--color-orange));
  color: white;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-secondary {
  background: var(--glass-bg-heavy);
  color: var(--text-primary);
  border: var(--overlay-component-border);
}

.btn-secondary:hover {
  background: var(--glass-bg-medium);
}

.first-time-notice {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: 0;
  font-style: italic;
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-normal) var(--ease-out);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
