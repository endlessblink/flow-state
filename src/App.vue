<template>
  <NConfigProvider :theme="darkTheme" :theme-overrides="themeOverrides">
    <NGlobalStyle />
    <NMessageProvider>
      <!-- BUG-1056: Brave Browser Warning Banner -->
      <BraveBanner />

      <!-- Tauri Startup Screen (only shows in Tauri mode during initialization) -->
      <TauriStartupScreen
        v-if="showStartupScreen"
        @ready="onStartupReady"
      />

      <!-- Main App (renders after startup completes or immediately in browser mode) -->
      <template v-if="appReady">
        <MobileLayout v-if="isMobile" />
        <MainLayout v-else ref="mainLayout" />
        <ModalManager ref="modalManager" />
        <FaviconManager />
        <!-- PWA Reload Prompt (Browser Only) -->
        <ReloadPrompt v-if="!isTauriApp" />
        <!-- iOS Install Prompt (Mobile Browser Only) -->
        <IOSInstallPrompt v-if="!isTauriApp" />
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
}
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useAppInitialization } from '@/composables/app/useAppInitialization'
import { useAppShortcuts } from '@/composables/app/useAppShortcuts'
import MainLayout from '@/layouts/MainLayout.vue'
import MobileLayout from '@/mobile/layouts/MobileLayout.vue'
import ModalManager from '@/layouts/ModalManager.vue'
import FaviconManager from '@/components/common/FaviconManager.vue'
import ReloadPrompt from '@/components/common/ReloadPrompt.vue'
import IOSInstallPrompt from '@/components/common/IOSInstallPrompt.vue'
import TauriStartupScreen from '@/components/startup/TauriStartupScreen.vue'
import BraveBanner from '@/components/ui/BraveBanner.vue'
import { destroyGlobalKeyboardShortcuts } from '@/utils/globalKeyboardHandlerSimple'
import { useMobileDetection } from '@/composables/useMobileDetection'
import { initializeBraveProtection } from '@/utils/braveProtection'

// Refs for child components
const mainLayout = ref<InstanceType<typeof MainLayout> | null>(null)
const modalManager = ref<InstanceType<typeof ModalManager> | null>(null)

// Core Composables
const { isMobile } = useMobileDetection()
const { handleKeydown } = useAppShortcuts()

// Startup state - check Tauri AFTER mount to ensure __TAURI__ is injected
const startupComplete = ref(false)
const isTauriApp = ref(false)
const initialized = ref(false)

// Only show startup screen in Tauri mode during initialization
const showStartupScreen = computed(() => initialized.value && isTauriApp.value && !startupComplete.value)

// App is ready when startup is complete OR we're in browser mode
const appReady = computed(() => !initialized.value || startupComplete.value || !isTauriApp.value)

// Handle startup completion
const onStartupReady = () => {
  startupComplete.value = true
}

// Initialize App Logic
useAppInitialization()

// Handle global events that require interaction with MainLayout
const handleGlobalNewTask = () => {
  if (!isMobile.value) {
    mainLayout.value?.focusQuickTask()
  }
}

onMounted(async () => {
  // Check for Tauri AFTER mount - __TAURI__ should be injected by now
  isTauriApp.value = typeof window !== 'undefined' && '__TAURI__' in window
  initialized.value = true

  // Log for debugging
  console.log('[App] Tauri detected:', isTauriApp.value)

  // BUG-1056: Initialize Brave browser detection
  const braveState = await initializeBraveProtection()
  if (braveState.isBrave) {
    console.log('[App] Brave browser detected - monitoring for blocked resources')
  }

  window.addEventListener('global-new-task', handleGlobalNewTask)
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('global-new-task', handleGlobalNewTask)
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
</style>