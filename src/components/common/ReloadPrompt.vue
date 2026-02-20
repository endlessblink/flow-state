<script setup lang="ts">
import { computed, ref } from 'vue'
import { RefreshCw, X, CheckCircle2 } from 'lucide-vue-next'
import { NButton, NCard, NText } from 'naive-ui'

// --- State ---
// PWA registration - only available in web builds with PWA plugin
const offlineReady = ref(false)
const needRefresh = ref(false)
let updateServiceWorker = () => {}

// Dynamically import PWA register only when available (web builds)
if (typeof window !== 'undefined' && !('__TAURI__' in window)) {
  // @ts-expect-error - Virtual module provided by vite-plugin-pwa
  import('virtual:pwa-register/vue').then(({ useRegisterSW }) => {
    const sw = useRegisterSW()
    offlineReady.value = sw.offlineReady.value
    needRefresh.value = sw.needRefresh.value
    updateServiceWorker = sw.updateServiceWorker

    // Watch for changes
    if (sw.offlineReady.value) { offlineReady.value = true }
    if (sw.needRefresh.value) { needRefresh.value = true }
  }).catch(() => {
    // PWA plugin not available (Tauri build), ignore
  })
}

// --- Computed ---
const showPrompt = computed(() => offlineReady.value || needRefresh.value)

// --- Methods ---
const close = async () => {
  offlineReady.value = false
  needRefresh.value = false
}

const handleReload = async () => {
  updateServiceWorker()
}
</script>

<template>
  <Transition name="slide-up">
    <div v-if="showPrompt" class="pwa-reload-prompt">
      <NCard class="prompt-card" size="small" :bordered="false">
        <div class="prompt-content">
          <!-- Update Available Mode -->
          <div v-if="needRefresh" class="state-update">
            <div class="icon-wrapper update">
              <RefreshCw class="icon-spin" :size="20" />
            </div>
            <div class="text-content">
              <NText strong class="title">
                Update Available
              </NText>
              <NText depth="3" class="description">
                A new version of FlowState is available.
              </NText>
            </div>
            <div class="actions">
              <NButton 
                secondary 
                type="primary" 
                size="small" 
                @click="handleReload"
              >
                Reload
              </NButton>

              <NButton
                quaternary
                circle
                size="small"
                @click="close"
              >
                <template #icon>
                  <X :size="16" />
                </template>
              </NButton>
            </div>
          </div>

          <!-- Offline Ready Mode -->
          <div v-else-if="offlineReady" class="state-offline">
            <div class="icon-wrapper offline">
              <CheckCircle2 :size="20" />
            </div>
            <div class="text-content">
              <NText strong class="title">
                Ready for Offline
              </NText>
              <NText depth="3" class="description">
                App ready to work offline.
              </NText>
            </div>
            <div class="actions">
              <NButton
                quaternary
                circle
                size="small"
                @click="close"
              >
                <template #icon>
                  <X :size="16" />
                </template>
              </NButton>
            </div>
          </div>
        </div>
      </NCard>
    </div>
  </Transition>
</template>

<style scoped>
.pwa-reload-prompt {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: var(--z-tooltip);
  max-width: 400px;
  width: calc(100% - 48px);
}

.prompt-card {
  background: var(--bg-secondary) !important;
  border: 1px solid var(--border-default) !important;
  box-shadow: var(--shadow-lg) !important;
  backdrop-filter: blur(8px);
}

.prompt-content {
  display: flex;
  flex-direction: column;
}

.state-update, .state-offline {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  flex-shrink: 0;
}

.icon-wrapper.update {
  background: var(--calendar-creating-bg-alt);
  color: var(--indigo-text);
}

.icon-wrapper.offline {
  background: var(--success-bg-subtle);
  color: var(--status-done-text);
}

.text-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.title {
  font-size: var(--text-sm);
}

.description {
  font-size: var(--text-xs);
  margin-top: 2px;
}

.warning {
  color: var(--color-warning);
  font-weight: 600;
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.icon-spin {
  animation: spin 2s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Transitions */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}
</style>
