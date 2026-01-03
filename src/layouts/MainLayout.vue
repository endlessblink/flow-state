<template>
  <div class="app-layout" :class="{ 'sidebar-hidden': !uiStore.mainSidebarVisible }" :dir="direction">
    <!-- LEFT SIDEBAR NAVIGATION -->
    <AppSidebar ref="appSidebar" class="sidebar" />

    <!-- FLOATING SIDEBAR TOGGLE (visible when sidebar is hidden) -->
    <button
      v-if="!uiStore.mainSidebarVisible"
      class="floating-sidebar-toggle"
      :title="`Show Sidebar (${isMac ? 'Cmd' : 'Ctrl'}+B)`"
      aria-label="Show sidebar"
      @click="uiStore.toggleMainSidebar"
    >
      <PanelLeft :size="20" />
    </button>

    <!-- MAIN CONTENT AREA -->
    <main class="main-content" :class="{ 'sidebar-hidden': !uiStore.mainSidebarVisible }">
      <!-- CONSOLIDATED HEADER LAYOUT -->
      <AppHeader />

      <!-- ROUTER VIEW FOR DIFFERENT VIEWS -->
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <div v-if="Component" :key="$route.path" class="view-wrapper">
            <component :is="Component" />
          </div>
        </transition>
      </router-view>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useDirection } from '@/i18n/useDirection'
import { PanelLeft } from 'lucide-vue-next'
import AppSidebar from '@/layouts/AppSidebar.vue'
import AppHeader from '@/layouts/AppHeader.vue'

const uiStore = useUIStore()
const { direction } = useDirection()

const appSidebar = ref<InstanceType<typeof AppSidebar> | null>(null)

const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0

defineExpose({
  focusQuickTask: () => {
    appSidebar.value?.focusQuickTask()
  }
})
</script>

<style scoped>
.app-layout {
  background: var(--app-background-gradient);
  width: 100vw;
  height: 100vh;
  min-height: 100vh;
  font-family: var(--font-sans);
  color: var(--text-primary);
  display: grid;
  grid-template-columns: minmax(240px, 340px) 1fr;
  position: relative;
  overflow-x: hidden;
  overflow-y: visible;
  transition: grid-template-columns 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

.app-layout.sidebar-hidden {
  grid-template-columns: 0px 1fr;
}

.sidebar {
  grid-column: 1;
}

.app-layout.sidebar-hidden .sidebar {
  visibility: hidden;
}

.floating-sidebar-toggle {
  position: fixed;
  top: 50%;
  inset-inline-start: 0;
  transform: translateY(-50%);
  z-index: 1000;
  width: 36px;
  height: 48px;
  background: var(--state-active-bg);
  border: 1px solid var(--state-active-border);
  border-inline-start: none;
  border-start-end-radius: var(--radius-lg);
  border-end-end-radius: var(--radius-lg);
  backdrop-filter: var(--state-active-glass);
  -webkit-backdrop-filter: var(--state-active-glass);
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-normal) var(--spring-bounce);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.floating-sidebar-toggle:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  transform: translateY(-50%) translateX(2px);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.main-content {
  grid-column: 2;
  background: transparent;
  padding: var(--space-10) var(--space-12) 0;
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 100vh;
  max-height: 100vh;
  overflow-x: hidden;
  overflow-y: hidden;
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

.main-content.sidebar-hidden {
  padding: var(--space-10) var(--space-6) 0;
}

.view-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
}

</style>
