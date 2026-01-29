<template>
  <div class="mobile-layout" :dir="isRTL ? 'rtl' : 'ltr'">
    <!-- Hide header on full-screen views like Quick Sort -->
    <header v-if="!isFullScreenView" class="mobile-header">
      <h1>FlowState</h1>
    </header>
    <main class="mobile-content" :class="{ 'full-screen': isFullScreenView }">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <!-- Hide nav on full-screen views -->
    <MobileNav v-if="!isFullScreenView" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import MobileNav from '@/mobile/components/MobileNav.vue'

const router = useRouter()
const route = useRoute()

// Routes that should be full-screen (no header/nav)
const fullScreenRoutes = ['mobile-quick-sort']

const isFullScreenView = computed(() => {
  return fullScreenRoutes.includes(route.name as string)
})

// RTL detection based on browser language
const isRTL = computed(() => {
  const lang = navigator.language || navigator.languages?.[0] || 'en'
  // Hebrew language codes
  return lang.startsWith('he') || lang.startsWith('iw') // 'iw' is legacy code for Hebrew
})

onMounted(() => {
  // Redirect Canvas (/) to Inbox (/tasks) on mobile
  if (route.path === '/' || route.name === 'canvas') {
    router.replace('/tasks')
  }
})
</script>

<style scoped>
.mobile-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh; /* Dynamic viewport height - accounts for iOS browser chrome */
  width: 100vw;
  background: var(--app-background-gradient);
  overflow: hidden;
}

.mobile-header {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-bg-medium);
  backdrop-filter: blur(var(--blur-md));
  border-bottom: 1px solid var(--glass-border);
  z-index: 10;
}

.mobile-header h1 {
  font-size: var(--text-lg);
  font-weight: 800;
  margin: 0;
  background: linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.mobile-content {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 80px; /* Space for nav */
  position: relative;
  -webkit-overflow-scrolling: touch;
}

.mobile-content.full-screen {
  padding-bottom: 0;
  overflow: hidden;
}

/* RTL Layout Adjustments */
.mobile-layout[dir="rtl"] {
  text-align: right;
}

.mobile-layout[dir="rtl"] .mobile-header {
  direction: ltr; /* Keep header LTR for branding */
}
</style>
