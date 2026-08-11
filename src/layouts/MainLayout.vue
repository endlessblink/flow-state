<template>
  <div
    class="app-layout"
    :class="{ 'sidebar-hidden': !uiStore.mainSidebarVisible }"
    :dir="direction"
    @dragover.prevent
    @dragenter.prevent
  >
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

    <!-- Full-width header border spanning both columns -->
    <div
      v-if="uiStore.mainSidebarVisible"
      class="layout-header-border"
      :style="{ top: headerBorderY + 'px' }"
    />

    <!-- AI CHAT PANEL (TASK-1120) -->
    <AIChatPanel />

    <!-- Nanny reminder toast (web app) -->
    <NannyReminder
      v-if="showNannyReminder"
      :minutes="unchosenMinutes"
      @snooze="handleNannySnooze"
      @stop-today="handleNannyStopToday"
      @dismiss="nannyDismissed = true; nannyLastDismissedAt = Date.now()"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useDirection } from '@/i18n/useDirection'
import { useTaskbarNanny } from '@/composables/useTaskbarNanny'
import { PanelLeft } from 'lucide-vue-next'
import AppSidebar from '@/layouts/AppSidebar.vue'
import AppHeader from '@/layouts/AppHeader.vue'
import { AIChatPanel } from '@/components/ai'
import NannyReminder from '@/components/notifications/NannyReminder.vue'

const uiStore = useUIStore()
const { direction } = useDirection()

// Shared header border — tracks content-header bottom position
const headerBorderY = ref(0)
let borderObserver: ResizeObserver | null = null

function updateBorderPosition() {
  const contentHeader = document.querySelector('.content-header')
  if (contentHeader) {
    const rect = contentHeader.getBoundingClientRect()
    headerBorderY.value = rect.bottom
  }
}

onMounted(() => {
  nextTick(() => {
    updateBorderPosition()
    // Observe the main-content for layout changes
    const mainContent = document.querySelector('.main-content')
    if (mainContent) {
      borderObserver = new ResizeObserver(updateBorderPosition)
      borderObserver.observe(mainContent)
    }
  })
})

onUnmounted(() => {
  borderObserver?.disconnect()
})

// Gently remind user to pick a task after 5 min without a Pomodoro
const { unchosenMinutes, shouldNudge } = useTaskbarNanny()

// Nanny reminder state
const nannyDismissed = ref(false)
const nannyLastDismissedAt = ref(0)
const nannySnoozedUntil = ref(0)
const nannyStoppedToday = ref(false)
const NANNY_REDISPLAY_INTERVAL_MS = 15 * 60_000 // Re-show every 15 min if still idle

const showNannyReminder = computed(() => {
  if (nannyStoppedToday.value) return false
  if (nannySnoozedUntil.value > Date.now()) return false
  if (nannyDismissed.value && (Date.now() - nannyLastDismissedAt.value) < NANNY_REDISPLAY_INTERVAL_MS) return false
  return shouldNudge.value
})

function handleNannySnooze(minutes: number) {
  nannySnoozedUntil.value = Date.now() + minutes * 60_000
  nannyDismissed.value = true
  nannyLastDismissedAt.value = Date.now()
  // Re-enable showing after snooze expires
  setTimeout(() => { nannyDismissed.value = false }, minutes * 60_000)
}

function handleNannyStopToday() {
  nannyStoppedToday.value = true
  // Reset at midnight
  const now = new Date()
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  setTimeout(() => { nannyStoppedToday.value = false }, midnight.getTime() - now.getTime())
}

// Reset dismissed state when timer starts (so nanny can fire again next idle period)
watch(unchosenMinutes, (val) => {
  if (val === 0) {
    nannyDismissed.value = false
    nannyLastDismissedAt.value = 0
  }
})

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
  transition: grid-template-columns var(--duration-slow) cubic-bezier(0.4, 0, 0.2, 1);
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
  z-index: var(--z-sticky);
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
  transition: all var(--duration-slow) cubic-bezier(0.4, 0, 0.2, 1);
}

.main-content.sidebar-hidden {
  padding: var(--space-10) var(--space-6) 0;
  padding-inline-start: 64px; /* Space for floating sidebar toggle button */
}

.view-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
}

/* Full-width header border that spans both sidebar and content columns */
.layout-header-border {
  position: absolute;
  inset-inline-start: 0;
  inset-inline-end: 0;
  height: 1px;
  background: var(--glass-border);
  z-index: 2;
  pointer-events: none;
}

</style>
