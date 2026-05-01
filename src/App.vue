<template>
  <NConfigProvider :theme="darkTheme" :theme-overrides="themeOverrides">
    <NGlobalStyle />
    <NMessageProvider>
      <!-- BUG-1056: Brave Browser Warning Banner -->
      <BraveBanner />

      <!-- BUG-1101: Route Error Boundary for dynamic import failures -->
      <RouteErrorBoundary />

      <!-- BUG-1339: Loading state while data loads (PWA/browser mode only) -->
      <div v-if="!appReady" class="app-loading">
        <div class="app-loading-spinner" />
      </div>

      <!-- Main App (renders after startup completes AND data is loaded) -->
      <template v-if="appReady">
        <ErrorBoundary>
          <MobileLayout v-if="isMobile" />
          <MainLayout v-else ref="mainLayout" />
        </ErrorBoundary>
        <ModalManager ref="modalManager" />
        <FaviconManager />
        <!-- PWA Reload Prompt (Browser/PWA Only — not native apps) -->
        <ReloadPrompt v-if="!isCapacitorApp && !isElectronApp" />
        <ElectronUpdateNotification v-if="isElectronApp" />
        <!-- FEATURE-1201: Onboarding Wizard (first-time visitors, desktop + mobile) -->
        <OnboardingWizard />
        <!-- TASK-1350: AI Setup Wizard (first-time AI provider setup) -->
        <AISetupWizard ref="aiSetupWizard" />
        <!-- TASK-1495: Morning Ritual — opt-in banner, bottom sheet panel, summary chip (desktop only, no mobile flow designed) -->
        <template v-if="!isMobile">
          <MorningBanner
            :show="morningRitual.showBanner.value"
            @open="morningRitual.openRitual()"
            @dismiss="morningRitual.dismissBanner()"
          />
          <MorningRitualPanel
            :show="morningRitual.isRitualActive.value"
            @close="morningRitual.closeRitual()"
          />
          <MorningSummaryChip
            :show="morningRitual.isRitualCompleted.value"
            :task-count="morningRitual.ritualSummary.value?.taskCount ?? 0"
            :total-minutes="morningRitual.ritualSummary.value?.totalMinutes ?? 0"
          />
        </template>
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
    color: 'rgb(28, 25, 45)', // Match --overlay-component-bg base RGB
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
import ElectronUpdateNotification from '@/components/common/ElectronUpdateNotification.vue'
import BraveBanner from '@/components/ui/BraveBanner.vue'
import RouteErrorBoundary from '@/components/error/RouteErrorBoundary.vue'
import ErrorBoundary from '@/components/common/ErrorBoundary.vue'
import OnboardingWizard from '@/components/onboarding/OnboardingWizard.vue'
// TASK-1350: AI Setup Wizard (first-time BYOK Groq setup)
import AISetupWizard from '@/components/ai/AISetupWizard.vue'
// TASK-1495: Morning Ritual (opt-in banner + panel + summary chip)
import MorningBanner from '@/components/morning-dashboard/MorningBanner.vue'
import MorningRitualPanel from '@/components/morning-dashboard/MorningRitualPanel.vue'
import MorningSummaryChip from '@/components/morning-dashboard/MorningSummaryChip.vue'
import { useMorningRitual } from '@/composables/useMorningRitual'
import { destroyGlobalKeyboardShortcuts } from '@/utils/globalKeyboardHandlerSimple'
import { useMobileDetection } from '@/composables/useMobileDetection'
import { initializeBraveProtection } from '@/utils/braveProtection'
import { isCapacitor as isCapacitorFn } from '@/utils/platform'
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

// TASK-1495: Morning Ritual
const morningRitual = useMorningRitual()

// Startup state - check native wrappers AFTER mount to ensure globals are injected
const isCapacitorApp = ref(false)
const isElectronApp = ref(false)
const initialized = ref(false)

// BUG-1339: Require data to be loaded before showing views.
const appReady = computed(() => {
  return initialized.value && isDataReady.value
})

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
  // Check native wrappers AFTER mount - globals should be injected by now
  isCapacitorApp.value = isCapacitorFn()
  isElectronApp.value = !!(window as any).electronAPI?.isElectron
  initialized.value = true

  console.log('[App] Platform detected:', { electron: isElectronApp.value, capacitor: isCapacitorApp.value })

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
