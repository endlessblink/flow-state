<template>
  <NConfigProvider :theme="darkTheme" :theme-overrides="themeOverrides">
    <NGlobalStyle />
    <NMessageProvider>
      <!-- BUG-1056: Brave Browser Warning Banner -->
      <BraveBanner />

      <!-- BUG-1101: Route Error Boundary for dynamic import failures -->
      <RouteErrorBoundary />

      <!-- Tauri Startup Screen (only shows in Tauri mode during initialization) -->
      <TauriStartupScreen
        v-if="showStartupScreen"
        @ready="onStartupReady"
      />

      <!-- BUG-1339: Loading state while data loads (PWA/browser mode only) -->
      <div v-if="!appReady && !showStartupScreen" class="app-loading">
        <div class="app-loading-spinner" />
      </div>

      <!-- Main App (renders after startup completes AND data is loaded) -->
      <template v-if="appReady">
        <MobileLayout v-if="isMobile" />
        <MainLayout v-else ref="mainLayout" />
        <ModalManager ref="modalManager" />
        <FaviconManager />
        <!-- PWA Reload Prompt (Browser/PWA Only — not native apps) -->
        <ReloadPrompt v-if="!isTauriApp && !isCapacitorApp" />
        <!-- Tauri Update Notification (Desktop Only) -->
        <TauriUpdateNotification v-if="isTauriApp" />
        <!-- FEATURE-1201: Onboarding Wizard (first-time visitors, desktop + mobile) -->
        <OnboardingWizard />
        <!-- TASK-1350: AI Setup Wizard (first-time AI provider setup) -->
        <AISetupWizard ref="aiSetupWizard" />
      </template>
    </NMessageProvider>
  </NConfigProvider>
</template>

<script setup lang="ts">
// Import design tokens and global overrides first
import '@/assets/design-tokens.css'
import '@/assets/global-overrides.css'

import { NConfigProvider, NMessageProvider, NGlobalStyle, darkTheme, type GlobalThemeOverrides } from 'naive-ui'

// Date Picker Theme Override - Clean minimal design
// Today: white text (no special indicator)
// Selected: green stroke + green text, NO fill
const themeOverrides: GlobalThemeOverrides = {
  DatePicker: {
    itemColorActive: 'transparent', // NO fill on selected
    itemColorHover: 'rgba(255, 255, 255, 0.08)',
    itemTextColorActive: '#10b981', // Green text when selected
    itemBorderRadius: '6px',
    panelHeaderDividerColor: 'rgba(255, 255, 255, 0.08)',
    calendarTitleColorHover: 'rgba(255, 255, 255, 0.95)',
    arrowColor: 'rgba(255, 255, 255, 0.45)',
  },
  Popover: {
    color: 'rgb(22, 19, 38)', // Match context menu bg (fully opaque)
    borderRadius: '12px',
  },
}
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useAppInitialization } from '@/composables/app/useAppInitialization'
import { useAppShortcuts } from '@/composables/app/useAppShortcuts'
import MainLayout from '@/layouts/MainLayout.vue'
import MobileLayout from '@/mobile/layouts/MobileLayout.vue'
import ModalManager from '@/layouts/ModalManager.vue'
import FaviconManager from '@/components/common/FaviconManager.vue'
import ReloadPrompt from '@/components/common/ReloadPrompt.vue'
import TauriUpdateNotification from '@/components/common/TauriUpdateNotification.vue'
import TauriStartupScreen from '@/components/startup/TauriStartupScreen.vue'
import BraveBanner from '@/components/ui/BraveBanner.vue'
import RouteErrorBoundary from '@/components/error/RouteErrorBoundary.vue'
import OnboardingWizard from '@/components/onboarding/OnboardingWizard.vue'
// TASK-1350: AI Setup Wizard (first-time BYOK Groq setup)
import AISetupWizard from '@/components/ai/AISetupWizard.vue'
import { destroyGlobalKeyboardShortcuts } from '@/utils/globalKeyboardHandlerSimple'
import { useMobileDetection } from '@/composables/useMobileDetection'
import { initializeBraveProtection } from '@/utils/braveProtection'
import { useTauriDebug } from '@/composables/useTauriDebug'
import { isTauri as isTauriFn, isCapacitor as isCapacitorFn } from '@/utils/platform'
import { useRouter } from 'vue-router'
// FEATURE-1345: Capacitor Android services
import { initCapacitorStatusBar } from '@/composables/useCapacitorStatusBar'
import { initCapacitorLifecycle } from '@/composables/useCapacitorLifecycle'
import { initCapacitorNotifications } from '@/services/notifications/capacitorNotifications'

// Refs for child components
const mainLayout = ref<InstanceType<typeof MainLayout> | null>(null)
const modalManager = ref<InstanceType<typeof ModalManager> | null>(null)
const aiSetupWizard = ref<InstanceType<typeof AISetupWizard> | null>(null)

// Core Composables
const { isMobile } = useMobileDetection()
const { handleKeydown } = useAppShortcuts()
const appRouter = useRouter()

// Startup state - check Tauri/Capacitor AFTER mount to ensure globals are injected
const startupComplete = ref(false)
const isTauriApp = ref(false)
const isCapacitorApp = ref(false)
const initialized = ref(false)

// Only show startup screen in Tauri mode during initialization
const showStartupScreen = computed(() => initialized.value && isTauriApp.value && !startupComplete.value)

// App is ready when startup is complete OR we're in browser mode
// BUG-1339: Also require data to be loaded before showing views
// This prevents blank views on first load due to race between render and async data fetch
const appReady = computed(() => {
  const startupOk = !initialized.value || startupComplete.value || !isTauriApp.value
  return startupOk && isDataReady.value
})

// Handle startup completion
const onStartupReady = () => {
  startupComplete.value = true
}

// Initialize App Logic
// BUG-1339: Capture isDataReady to gate view rendering until tasks are loaded
const { isDataReady } = useAppInitialization()

// Handle global events that require interaction with MainLayout
const handleGlobalNewTask = () => {
  if (!isMobile.value) {
    mainLayout.value?.focusQuickTask()
  }
}

// TASK-1350: Handle re-run AI setup wizard from Settings > AI
const handleRerunAIWizard = () => {
  aiSetupWizard.value?.show()
}

onMounted(async () => {
  // Check for Tauri/Capacitor AFTER mount - globals should be injected by now
  isTauriApp.value = isTauriFn()
  isCapacitorApp.value = isCapacitorFn()
  initialized.value = true

  // Log for debugging
  console.log('[App] Platform detected:', { tauri: isTauriApp.value, capacitor: isCapacitorApp.value })

  // TASK-1060: Start Tauri memory monitoring for SIGTERM debugging
  if (isTauriApp.value) {
    const tauriDebug = useTauriDebug()
    tauriDebug.startMonitoring()
    console.log('[App] Tauri memory monitoring started')

  }

  // FEATURE-1345: Initialize Capacitor Android services
  if (isCapacitorApp.value) {
    await Promise.all([
      initCapacitorStatusBar(),
      initCapacitorNotifications(),
      initCapacitorLifecycle(appRouter),
    ])
    console.log('[App] Capacitor services initialized')
  }

  // BUG-1056: Initialize Brave browser detection
  const braveState = await initializeBraveProtection()
  if (braveState.isBrave) {
    console.log('[App] Brave browser detected - monitoring for blocked resources')
  }

  window.addEventListener('global-new-task', handleGlobalNewTask)
  window.addEventListener('global-rerun-ai-wizard', handleRerunAIWizard)
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('global-new-task', handleGlobalNewTask)
  window.removeEventListener('global-rerun-ai-wizard', handleRerunAIWizard)
  window.removeEventListener('keydown', handleKeydown)
  destroyGlobalKeyboardShortcuts()
})
</script>

<style>
/* Global styles that shouldn't be scoped */
html, body, #app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  background: var(--app-background-gradient);
  color: var(--text-primary);
  overflow: hidden;
}

/* BUG-1339: Minimal loading spinner while data loads */
.app-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100vw;
  height: 100vh;
}

.app-loading-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--brand-primary, #4ECDC4);
  border-radius: 50%;
  animation: app-spin 0.8s linear infinite;
}

@keyframes app-spin {
  to { transform: rotate(360deg); }
}
</style>