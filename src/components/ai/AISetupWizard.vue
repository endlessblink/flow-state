<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="isVisible"
        class="wizard-overlay"
        tabindex="-1"
        @keydown="handleKeydown"
      >
        <div class="wizard-modal">
          <!-- Close / Skip -->
          <button class="close-btn" aria-label="Skip setup" @click="skip">
            <X :size="18" />
          </button>

          <!-- Step indicator -->
          <div class="step-dots">
            <span
              v-for="s in totalSteps"
              :key="s"
              class="dot"
              :class="{ active: s === step, done: s < step }"
            />
          </div>

          <!-- ═══ Step 1: Choose Provider ═══ -->
          <div v-if="step === 1" class="step-content">
            <h2 class="step-title">Set up AI</h2>
            <p class="step-desc">
              FlowState uses AI for smart suggestions, task analysis, and chat.
              Choose how you'd like to power it.
            </p>

            <div class="provider-options">
              <button
                class="provider-card"
                :class="{ selected: chosenProvider === 'groq' }"
                @click="chosenProvider = 'groq'"
              >
                <div class="provider-badge recommended">Recommended</div>
                <Zap :size="22" class="provider-icon" />
                <span class="provider-name">Groq Cloud</span>
                <span class="provider-detail">
                  Free API key, fast, high quality (Llama 3.3 70B)
                </span>
              </button>

              <button
                class="provider-card"
                :class="{ selected: chosenProvider === 'ollama' }"
                @click="chosenProvider = 'ollama'"
              >
                <Monitor :size="22" class="provider-icon" />
                <span class="provider-name">Ollama (Local)</span>
                <span class="provider-detail">
                  Runs on your machine, fully private, no API key needed
                </span>
              </button>
            </div>

            <div class="step-actions">
              <button class="btn-primary" :disabled="!chosenProvider" @click="goToStep2">
                Continue
              </button>
              <button class="btn-ghost" @click="skip">
                Skip for now
              </button>
            </div>
          </div>

          <!-- ═══ Step 2a: Groq Setup ═══ -->
          <div v-if="step === 2 && chosenProvider === 'groq'" class="step-content">
            <h2 class="step-title">Connect Groq</h2>
            <p class="step-desc">
              Groq offers free AI API access with generous daily limits.
              Create a free account and paste your API key below.
            </p>

            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              class="external-link"
            >
              <ExternalLink :size="14" />
              Get your free API key at console.groq.com
            </a>

            <div class="api-key-field">
              <label class="field-label">API Key</label>
              <div class="input-row">
                <input
                  :type="showKey ? 'text' : 'password'"
                  v-model="apiKey"
                  placeholder="gsk_..."
                  class="text-input"
                  spellcheck="false"
                  autocomplete="off"
                />
                <button class="icon-btn" @click="showKey = !showKey" :title="showKey ? 'Hide' : 'Show'">
                  <EyeOff v-if="showKey" :size="16" />
                  <Eye v-else :size="16" />
                </button>
              </div>
            </div>

            <!-- Test result -->
            <div v-if="testStatus" class="test-result" :class="testStatus">
              <CheckCircle2 v-if="testStatus === 'success'" :size="16" />
              <AlertCircle v-if="testStatus === 'error'" :size="16" />
              <Loader2 v-if="testStatus === 'testing'" :size="16" class="spin" />
              <span>{{ testMessage }}</span>
            </div>

            <div class="step-actions">
              <button class="btn-secondary" @click="step = 1">
                Back
              </button>
              <button
                class="btn-primary"
                :disabled="!apiKey || testStatus === 'testing'"
                @click="testAndContinue"
              >
                {{ testStatus === 'testing' ? 'Testing...' : 'Test & Continue' }}
              </button>
            </div>
          </div>

          <!-- ═══ Step 2b: Ollama Setup ═══ -->
          <div v-if="step === 2 && chosenProvider === 'ollama'" class="step-content">
            <h2 class="step-title">Connect Ollama</h2>
            <p class="step-desc">
              Ollama runs AI models locally on your machine.
              Make sure Ollama is installed and running.
            </p>

            <div class="ollama-status" :class="ollamaDetected ? 'detected' : 'not-detected'">
              <CheckCircle2 v-if="ollamaDetected" :size="18" />
              <AlertCircle v-else :size="18" />
              <span v-if="ollamaDetected">Ollama detected on localhost:11434</span>
              <span v-else>Ollama not detected</span>
            </div>

            <div v-if="!ollamaDetected" class="ollama-steps">
              <p class="setup-instruction">To set up Ollama:</p>
              <ol class="setup-list">
                <li>
                  Install from
                  <a href="https://ollama.com" target="_blank" rel="noopener noreferrer">ollama.com</a>
                </li>
                <li>Run <code>ollama pull llama3.2</code> in terminal</li>
                <li>Start Ollama with <code>ollama serve</code></li>
              </ol>
              <button class="btn-secondary" @click="detectOllama">
                <RefreshCw :size="14" :class="{ spin: ollamaChecking }" />
                Retry Detection
              </button>
            </div>

            <div class="step-actions">
              <button class="btn-secondary" @click="step = 1">
                Back
              </button>
              <button
                class="btn-primary"
                :disabled="!ollamaDetected"
                @click="step = 3"
              >
                Continue
              </button>
              <button v-if="!ollamaDetected" class="btn-ghost" @click="step = 3">
                Continue anyway
              </button>
            </div>
          </div>

          <!-- ═══ Step 3: Confirmation ═══ -->
          <div v-if="step === 3" class="step-content">
            <div class="confirm-icon">
              <CheckCircle2 :size="40" />
            </div>
            <h2 class="step-title">AI is ready!</h2>
            <p class="step-desc">
              <template v-if="chosenProvider === 'groq'">
                Groq Cloud is configured. FlowState will use Llama 3.3 70B for AI features.
              </template>
              <template v-else>
                Ollama is {{ ollamaDetected ? 'connected' : 'configured as your preferred provider' }}.
                FlowState will use your local models.
              </template>
            </p>
            <p class="step-hint">
              You can change this anytime in Settings &gt; AI.
            </p>
            <div class="step-actions">
              <button class="btn-primary" @click="finish">
                Start Using FlowState
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import {
  X, Zap, Monitor, ExternalLink, Eye, EyeOff,
  CheckCircle2, AlertCircle, Loader2, RefreshCw
} from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'
import { isServiceReachable } from '@/services/ai/utils/tauriHttp'
import { tauriFetch } from '@/services/ai/utils/tauriHttp'
import { resetSharedRouter } from '@/services/ai/routerFactory'
import { isProxyAvailable } from '@/services/ai/proxy/aiChatProxy'

const settingsStore = useSettingsStore()

// Visibility
const isVisible = ref(false)
const step = ref(1)
const totalSteps = 3

// Provider choice
const chosenProvider = ref<'groq' | 'ollama' | null>(null)

// Groq state
const apiKey = ref('')
const showKey = ref(false)
const testStatus = ref<'success' | 'error' | 'testing' | null>(null)
const testMessage = ref('')

// Ollama state
const ollamaDetected = ref(false)
const ollamaChecking = ref(false)

onMounted(async () => {
  // Already set up — nothing to do
  if (settingsStore.aiSetupComplete) return

  // TASK-1350: If the Groq proxy (Supabase Edge Function) is already available,
  // auto-complete setup silently. The developer (or anyone with a configured proxy)
  // should never be asked for an API key.
  try {
    const proxyReady = await isProxyAvailable('groq')
    if (proxyReady) {
      console.log('[AISetupWizard] Groq proxy detected — auto-completing AI setup')
      settingsStore.updateSetting('aiSetupComplete', true)
      settingsStore.updateSetting('aiPreferredProvider', 'groq')
      return
    }
  } catch {
    // Proxy check failed — continue to wizard
  }

  // No proxy available — show wizard for BYOK setup
  isVisible.value = true
})

// Pre-populate API key if user already has one
watch(() => settingsStore.groqApiKey, (key) => {
  if (key && !apiKey.value) {
    apiKey.value = key
  }
}, { immediate: true })

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    skip()
  }
}

function goToStep2() {
  step.value = 2
  if (chosenProvider.value === 'ollama') {
    detectOllama()
  }
}

// ── Groq test ──
async function testGroqKey(): Promise<boolean> {
  testStatus.value = 'testing'
  testMessage.value = 'Testing connection...'
  try {
    const response = await tauriFetch('https://api.groq.com/openai/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey.value}`,
      },
      signal: AbortSignal.timeout(10000),
    })

    if (response.ok) {
      testStatus.value = 'success'
      testMessage.value = 'Connected successfully!'
      return true
    }

    if (response.status === 401) {
      testStatus.value = 'error'
      testMessage.value = 'Invalid API key. Please check and try again.'
      return false
    }

    testStatus.value = 'error'
    testMessage.value = `Connection failed (HTTP ${response.status})`
    return false
  } catch (err) {
    testStatus.value = 'error'
    testMessage.value = err instanceof Error ? err.message : 'Connection failed'
    return false
  }
}

async function testAndContinue() {
  const ok = await testGroqKey()
  if (ok) {
    // Save key immediately
    settingsStore.updateSetting('groqApiKey', apiKey.value)
    settingsStore.updateSetting('aiPreferredProvider', 'groq')
    resetSharedRouter()
    // Small delay so user sees success message
    setTimeout(() => { step.value = 3 }, 600)
  }
}

// ── Ollama detection ──
async function detectOllama() {
  ollamaChecking.value = true
  try {
    ollamaDetected.value = await isServiceReachable('http://localhost:11434/api/tags', 5000)
  } catch {
    ollamaDetected.value = false
  } finally {
    ollamaChecking.value = false
  }
}

// ── Finish / Skip ──
function finish() {
  if (chosenProvider.value === 'ollama') {
    settingsStore.updateSetting('aiPreferredProvider', 'ollama')
  }
  settingsStore.updateSetting('aiSetupComplete', true)
  resetSharedRouter()
  isVisible.value = false
}

function skip() {
  settingsStore.updateSetting('aiSetupComplete', true)
  isVisible.value = false
}

// Expose for parent to trigger re-run
defineExpose({
  show() {
    step.value = 1
    chosenProvider.value = null
    testStatus.value = null
    apiKey.value = settingsStore.groqApiKey || ''
    isVisible.value = true
  }
})
</script>

<style scoped>
.wizard-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.wizard-modal {
  position: relative;
  width: 440px;
  max-width: 92vw;
  max-height: 90vh;
  overflow-y: auto;
  background: var(--overlay-component-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  backdrop-filter: blur(24px);
  padding: var(--space-6);
}

.close-btn {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast);
}
.close-btn:hover {
  color: var(--text-primary);
  background: var(--glass-bg-soft);
}

/* ── Step dots ── */
.step-dots {
  display: flex;
  justify-content: center;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--glass-border);
  transition: all var(--duration-normal);
}
.dot.active {
  background: var(--brand-primary);
  width: 24px;
}
.dot.done {
  background: var(--brand-primary);
  opacity: 0.5;
}

/* ── Step content ── */
.step-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.step-title {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0;
  text-align: center;
}

.step-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
  text-align: center;
  line-height: var(--leading-relaxed);
}

.step-hint {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: 0;
  text-align: center;
}

/* ── Provider options ── */
.provider-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.provider-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1_5);
  padding: var(--space-4);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(8px);
  cursor: pointer;
  text-align: left;
  transition: all var(--duration-fast);
}
.provider-card:hover {
  border-color: var(--glass-border-hover);
}
.provider-card.selected {
  border-color: var(--brand-primary);
  background: rgba(78, 205, 196, 0.06);
}

.provider-badge {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  font-size: 10px;
  font-weight: var(--font-semibold);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
}
.provider-badge.recommended {
  background: rgba(78, 205, 196, 0.15);
  color: var(--brand-primary);
}

.provider-icon {
  color: var(--brand-primary);
}

.provider-name {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.provider-detail {
  font-size: var(--text-xs);
  color: var(--text-muted);
  line-height: var(--leading-relaxed);
}

/* ── Step actions ── */
.step-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: center;
  padding-top: var(--space-2);
}

.btn-primary {
  padding: var(--space-2_5) var(--space-5);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  background: var(--glass-bg-soft);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-lg);
  color: var(--brand-primary);
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: all var(--duration-fast);
}
.btn-primary:hover:not(:disabled) {
  background: rgba(78, 205, 196, 0.1);
}
.btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1_5);
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: all var(--duration-fast);
}
.btn-secondary:hover {
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.btn-ghost {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast);
}
.btn-ghost:hover {
  color: var(--text-secondary);
}

/* ── Groq API key field ── */
.external-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1_5);
  font-size: var(--text-sm);
  color: var(--brand-primary);
  text-decoration: none;
  transition: opacity var(--duration-fast);
}
.external-link:hover {
  opacity: 0.8;
}

.api-key-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1_5);
}

.field-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.input-row {
  display: flex;
  gap: var(--space-2);
}

.text-input {
  flex: 1;
  padding: var(--space-2_5) var(--space-3);
  font-size: var(--text-sm);
  font-family: var(--font-mono, monospace);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  backdrop-filter: blur(8px);
  transition: border-color var(--duration-fast);
}
.text-input:focus {
  outline: none;
  border-color: var(--brand-primary);
}
.text-input::placeholder {
  color: var(--text-muted);
  opacity: 0.6;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: all var(--duration-fast);
}
.icon-btn:hover {
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

/* ── Test result ── */
.test-result {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2_5) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}
.test-result.success {
  background: rgba(78, 205, 196, 0.1);
  color: var(--brand-primary);
}
.test-result.error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-danger);
}
.test-result.testing {
  background: var(--glass-bg-soft);
  color: var(--text-secondary);
}

/* ── Ollama detection ── */
.ollama-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}
.ollama-status.detected {
  background: rgba(78, 205, 196, 0.1);
  color: var(--brand-primary);
}
.ollama-status.not-detected {
  background: rgba(245, 158, 11, 0.1);
  color: var(--color-warning);
}

.ollama-steps {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.setup-instruction {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

.setup-list {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
  padding-left: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-1_5);
}
.setup-list a {
  color: var(--brand-primary);
  text-decoration: none;
}
.setup-list a:hover {
  text-decoration: underline;
}
.setup-list code {
  font-family: var(--font-mono, monospace);
  font-size: var(--text-xs);
  background: var(--glass-bg-medium);
  padding: 2px var(--space-1_5);
  border-radius: var(--radius-xs);
}

/* ── Confirmation ── */
.confirm-icon {
  display: flex;
  justify-content: center;
  color: var(--brand-primary);
}

/* ── Transitions ── */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity var(--duration-normal);
}
.modal-fade-enter-active .wizard-modal,
.modal-fade-leave-active .wizard-modal {
  transition: transform var(--duration-normal), opacity var(--duration-normal);
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-from .wizard-modal {
  transform: scale(0.95) translateY(10px);
  opacity: 0;
}
.modal-fade-leave-to .wizard-modal {
  transform: scale(0.95) translateY(10px);
  opacity: 0;
}

.spin {
  animation: wizard-spin 1s linear infinite;
}
@keyframes wizard-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
