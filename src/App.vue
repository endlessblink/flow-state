<template>
  <NConfigProvider :theme="darkTheme">
    <NGlobalStyle />
    <NMessageProvider>
      <MainLayout ref="mainLayout" />
      <ModalManager ref="modalManager" />
      <FaviconManager />
    </NMessageProvider>
  </NConfigProvider>
</template>

<script setup lang="ts">
// Import design tokens and global overrides first
import '@/assets/design-tokens.css'
import '@/assets/global-overrides.css'

import { NConfigProvider, NMessageProvider, NGlobalStyle, darkTheme } from 'naive-ui'
import { ref, onMounted, onUnmounted } from 'vue'
import { useAppInitialization } from '@/composables/app/useAppInitialization'
import { useAppShortcuts } from '@/composables/app/useAppShortcuts'
import MainLayout from '@/layouts/MainLayout.vue'
import ModalManager from '@/layouts/ModalManager.vue'
import FaviconManager from '@/components/FaviconManager.vue'
import { destroyGlobalKeyboardShortcuts } from '@/utils/globalKeyboardHandlerSimple'

// Refs for child components
const mainLayout = ref<InstanceType<typeof MainLayout> | null>(null)
const modalManager = ref<InstanceType<typeof ModalManager> | null>(null)

// Composables
const { handleKeydown } = useAppShortcuts()

// Initialize App Logic
useAppInitialization()

// Handle global events that require interaction with MainLayout
const handleGlobalNewTask = () => {
  mainLayout.value?.focusQuickTask()
}

onMounted(() => {
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
  background: var(--surface-primary);
  color: var(--text-primary);
  overflow: hidden;
}
</style>