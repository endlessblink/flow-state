<template>
  <NConfigProvider :theme="darkTheme">
    <NGlobalStyle />
    <NMessageProvider>
      <!-- Tauri Startup Screen (only shows in Tauri mode during initialization) -->
      <TauriStartupScreen
        v-if="showStartupScreen"
        @ready="onStartupReady"
      />

      <!-- Main App (renders after startup completes or immediately in browser mode) -->
      <template v-if="appReady">
        <MainLayout ref="mainLayout" />
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

import { NConfigProvider, NMessageProvider, NGlobalStyle, darkTheme } from 'naive-ui'
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useAppInitialization } from '@/composables/app/useAppInitialization'
import { useAppShortcuts } from '@/composables/app/useAppShortcuts'
import MainLayout from '@/layouts/MainLayout.vue'
import ModalManager from '@/layouts/ModalManager.vue'
import FaviconManager from '@/components/common/FaviconManager.vue'
import ReloadPrompt from '@/components/common/ReloadPrompt.vue'
import IOSInstallPrompt from '@/components/common/IOSInstallPrompt.vue'
import TauriStartupScreen from '@/components/startup/TauriStartupScreen.vue'
import { destroyGlobalKeyboardShortcuts } from '@/utils/globalKeyboardHandlerSimple'

// Refs for child components
const mainLayout = ref<InstanceType<typeof MainLayout> | null>(null)
const modalManager = ref<InstanceType<typeof ModalManager> | null>(null)

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

// Composables
const { handleKeydown } = useAppShortcuts()

// Initialize App Logic
useAppInitialization()

// Handle global events that require interaction with MainLayout
const handleGlobalNewTask = () => {
  mainLayout.value?.focusQuickTask()
}

onMounted(() => {
  // Check for Tauri AFTER mount - __TAURI__ should be injected by now
  isTauriApp.value = typeof window !== 'undefined' && '__TAURI__' in window
  initialized.value = true

  // Log for debugging
  console.log('[App] Tauri detected:', isTauriApp.value)

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